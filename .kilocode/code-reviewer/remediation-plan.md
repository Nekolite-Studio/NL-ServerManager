# コード品質改善計画 (Remediation Plan)

このドキュメントは、[`issues.md`](./issues.md:0)で特定された問題点に対する具体的な修正案と実行計画を提示します。

---

## 1. 全体的な一貫性の欠如

### 1.1. API命名規則の不統一 (Inconsistent Naming)

- **問題点**: Manager-Agent間のWebSocketメッセージタイプや、`main`プロセス-`renderer`プロセス間のIPCチャンネル名に一貫性がありません。
- **例**:
    - `create-server` (IPC) vs `create_server` (WebSocket)
    - `delete-agent` (IPC) vs `deleteServer` (WebSocket)
    - `get-agent-system-info` と `systemInfoResponse`
- **影響**: コードの可読性と保守性を低下させ、開発者がAPIを推測しにくくなります。

- **修正案**: **命名規則を`kebab-case`に統一する。**
    1.  Manager-Agent間のWebSocketメッセージタイプを`kebab-case`に統一します。
        - `create_server` → `create-server`
        - `deleteServer` → `delete-server`
        - `systemInfoResponse` → `system-info-response`
        - その他すべてのメッセージタイプを確認し、統一する。
    2.  IPCチャネル名はすでに`kebab-case`が多いため、現状を維持し、新規作成時もこの規則に従います。
    3.  変更箇所は[`manager/main.js`](./manager/main.js:0)、[`agent/index.js`](./agent/index.js:0)、および関連するレンダラープロセスのコードです。

---

### 1.2. ネットワークライブラリの混在 (Mixed Libraries)

- **問題点**: Managerの`main`プロセス内で、ネットワークリクエストに`net`モジュール、`axios`、`ws`が混在しています。
- **影響**: 依存関係が不必要に増加し、エラーハンドリングや設定（タイムアウト、プロキシ）の管理が複雑になります。

- **修正案**: **HTTPリクエストを`axios`に統一する。**
    1.  [`manager/main.js`](./manager/main.js:324)で行われているMinecraftバージョンマニフェストの取得処理を、現在の`net`モジュールによる手動実装から`axios`を利用したリクエストに置き換えます。
    2.  これにより、タイムアウト設定やエラーハンドリングが`axios`の標準的な方法に統一され、コードが簡潔になります。
    3.  `ws`はWebSocket通信専用のライブラリであり、責務が異なるためそのまま使用します。

---

### 1.3. エラー応答形式の不統一 (Inconsistent Error Responses)

- **問題点**: エラー発生時のクライアントへの通知形式が、処理によって異なります。
- **影響**: クライアント側でのエラーハンドリングが複雑化し、脆弱になります。

- **修正案**: **成功/失敗を示す統一的な応答ラッパーを導入する。**
    1.  ManagerからRendererへ、またはAgentからManagerへ返す全ての非同期応答を、以下のいずれかの形式に統一します。
        - **成功時**: `{ success: true, payload: { ... } }`
        - **失敗時**: `{ success: false, error: { message: "エラーの概要", details: "..." } }`
    2.  この変更を[`manager/main.js`](./manager/main.js:0)内のすべてのIPC応答およびWebSocketメッセージ送信箇所に適用します。
    3.  クライアント（Rendererプロセス）側は、まず`success`フラグを確認し、それに応じて`payload`または`error`を処理するように修正します。これにより、エラーハンドリングロジックを共通化できます。

---

## 2. 冗長性と責務分担の問題

### 2.1. 巨大なレンダラープロセス (God Object in Renderer)

- **問題点**: [`manager/renderer.js`](./manager/renderer.js:0) が600行を超えており、UI描画、状態管理、イベントリスナー、ビジネスロジックが密結合しています。
- **影響**: ファイルの見通しが悪く、修正や機能追加が困難です。単一責任の原則に違反しています。

- **修正案**: **[`renderer.js`](./manager/renderer.js:0)を機能ごとに複数ファイルに分割する。**
    1.  **`renderer-ui.js`**: UIの描画、更新、DOM操作に特化したモジュール。サーバーリストのレンダリング、ボタンの有効/無効化、モーダルの表示などを担当します。
    2.  **`renderer-state.js`**: アプリケーションの状態管理を担当するモジュール。サーバーリスト、Agent情報、選択中のアイテムなどの状態を保持し、更新するインターフェースを提供します。
    3.  [`renderer.js`](./manager/renderer.js:0)はエントリーポイントとして機能し、各モジュールを初期化し、IPCリスナーを設定して、イベントに応じて各モジュールを呼び出す役割に限定します。

---

### 2.2. 汎用IPCチャネルの冗長性 (Redundant IPC Channel)

- **問題点**: [`manager/preload.js`](./manager/preload.js:30) で定義されている`sendJsonMessage`は、より具体的な`proxyToServer`で代替可能な汎用的なメッセージング関数であり、現在は`update_properties`のためだけに使用されています。
- **影響**: APIの意図が不明確になり、冗長なコードパスを生み出します。

- **修正案**: **`sendJsonMessage`を廃止し、`proxyToServer`に統合する。**
    1.  [`preload.js`](./manager/preload.js:30)から`sendJsonMessage`関数と、それに対応する`main.js`の`'json-message'`リスナーを削除します。
    2.  現在`sendJsonMessage`を使用しているサーバープロパティの更新処理（`update_properties`）を、`proxyToServer`チャネルを使用するように変更します。
        - `renderer.js`から`window.electron.proxyToServer(agentId, { type: 'update-properties', payload: { ... } })`のように呼び出します。
    3.  これにより、Agentへのメッセージはすべて`proxyToServer`という単一のチャネルを経由することになり、責務が明確になります。

---

### 2.3. 作成と更新の責務が不明確 (Unclear Responsibility in `updateServer`)

- **問題点**: [`agent/src/serverManager.js`](./agent/src/serverManager.js:249) の `updateServer` 関数が、`serverId`の有無によって新規作成と更新の両方を処理しており、責務が曖昧です。
- **影響**: 関数名から挙動が予測しにくく、特に新規作成時の副作用（ディレクトリ作成、ファイルダウンロード）が隠蔽されています。

- **修正案**: **関数を`createServer`と`updateServer`に明確に分割する。**
    1.  **`createServer(options)`**: 新規サーバーの作成に特化した新しい関数を作成します。この関数はディレクトリの作成、`server.jar`のダウンロード、初期設定ファイルの生成などを行います。
    2.  **`updateServer(serverId, options)`**: 既存の`updateServer`関数をリファクタリングし、`serverId`を必須の引数とします。この関数は既存サーバーの設定（`nl-server_manager.json`）の更新のみを担当するように責務を限定します。
    3.  Agentのメッセージハンドラ（[`agent/index.js`](./agent/index.js:0)）は、`'create-server'`メッセージで`createServer`を、`'update-server'`メッセージで`updateServer`を呼び出すように修正します。

---

## 3. 危険なエラーハンドリング

### 3.1. 設定ファイルの破壊的なクリア処理 (Destructive Config Clearing)

- **問題点**: [`manager/src/storeManager.js`](./manager/src/storeManager.js:41-44) は、`electron-store`のスキーマ検証に失敗した場合、ユーザーに通知なく全ての永続化データを`store.clear()`で削除します。
- **影響**: データ損失につながる重大な欠陥です。

- **修正案**: **破壊的な処理を中止し、安全なフォールバック機構を導入する。**
    1.  スキーマ検証に失敗した場合、`store.clear()`を呼び出すのをやめます。
    2.  代わりに、既存の設定ファイル（例: `config.json`）を`config.json.bak`のような名前にリネームしてバックアップします。
    3.  Electronの`dialog.showMessageBox`を使用して、ユーザーに「設定ファイルの読み込みに失敗しました。設定をリセットしますか？以前の設定はバックアップされました。」という趣旨の確認ダイアログを表示します。
    4.  ユーザーが「はい」を選択した場合にのみ、新しい空の設定ファイルを作成します。これにより、ユーザーは意図せず設定を失うことがなくなり、必要に応じて手動でデータを復旧する機会を得られます。
