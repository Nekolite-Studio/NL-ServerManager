# コード品質レビュー: 問題点リスト

## 1. 全体的な一貫性の欠如

### 1.1. API命名規則の不統一 (Inconsistent Naming)

- **問題点**: Manager-Agent間のWebSocketメッセージタイプや、`main`プロセス-`renderer`プロセス間のIPCチャンネル名に一貫性がありません。
- **例**:
    - `create-server` (IPC) vs `create_server` (WebSocket)
    - `delete-agent` (IPC) vs `deleteServer` (WebSocket)
    - `get-agent-system-info` と `systemInfoResponse`
- **影響**: コードの可読性と保守性を低下させ、開発者がAPIを推測しにくくなります。
- **ファイル**:
    - [`manager/main.js`](manager/main.js)
    - [`manager/preload.js`](manager/preload.js)
    - [`agent/index.js`](agent/index.js)

### 1.2. ネットワークライブラリの混在 (Mixed Libraries)

- **問題点**: Managerの`main`プロセス内で、ネットワークリクエストに`net`モジュール、`axios`、`ws`が混在しています。
- **例**:
    - Minecraftバージョン取得: [`net`](manager/main.js:324)
    - Adoptium APIからのJava情報取得: [`axios`](manager/main.js:289)
    - Agent通信: [`ws`](manager/main.js:81)
- **影響**: 依存関係が不必要に増加し、エラーハンドリングや設定（タイムアウト、プロキシ）の管理が複雑になります。
- **ファイル**: [`manager/main.js`](manager/main.js)

### 1.3. エラー応答形式の不統一 (Inconsistent Error Responses)

- **問題点**: エラー発生時のクライアントへの通知形式が、処理によって異なります。
- **例**:
    - `server_creation_failed`イベントでは `{ agentId, error }` という形式。
    - `getJavaDownloadInfo`の失敗時は `{ success: false, error }` という形式。
- **影響**: クライアント側でのエラーハンドリングが複雑化し、脆弱になります。
- **ファイル**:
    - [`manager/main.js`](manager/main.js:113)
    - [`manager/main.js`](manager/main.js:311)

## 2. 冗長性と責務分担の問題

### 2.1. 巨大なレンダラープロセス (God Object in Renderer)

- **問題点**: [`manager/renderer.js`](manager/renderer.js) が600行を超えており、UI描画、状態管理、イベントリスナー、ビジネスロジックが密結合しています。
- **影響**: ファイルの見通しが悪く、修正や機能追加が困難です。単一責任の原則に違反しています。
- **ファイル**: [`manager/renderer.js`](manager/renderer.js)

### 2.2. 汎用IPCチャネルの冗長性 (Redundant IPC Channel)

- **問題点**: [`manager/preload.js`](manager/preload.js:30) で定義されている`sendJsonMessage`は、より具体的な`proxyToServer`で代替可能な汎用的なメッセージング関数であり、現在は`update_properties`のためだけに使用されています。
- **影響**: APIの意図が不明確になり、冗長なコードパスを生み出します。
- **ファイル**:
    - [`manager/preload.js`](manager/preload.js:30)
    - [`manager/renderer.js`](manager/renderer.js:141)

### 2.3. 作成と更新の責務が不明確 (Unclear Responsibility in `updateServer`)

- **問題点**: [`agent/src/serverManager.js`](agent/src/serverManager.js:249) の `updateServer` 関数が、`serverId`の有無によって新規作成と更新の両方を処理しており、責務が曖昧です。
- **影響**: 関数名から挙動が予測しにくく、特に新規作成時の副作用（ディレクトリ作成、ファイルダウンロード）が隠蔽されています。
- **ファイル**: [`agent/src/serverManager.js`](agent/src/serverManager.js:249)

## 3. 危険なエラーハンドリング

### 3.1. 設定ファイルの破壊的なクリア処理 (Destructive Config Clearing)

- **問題点**: [`manager/src/storeManager.js`](manager/src/storeManager.js:41-44) は、`electron-store`のスキーマ検証に失敗した場合、ユーザーに通知なく全ての永続化データを`store.clear()`で削除します。
- **影響**: アプリケーションのアップデートなどでスキーマが変更された場合に、ユーザーが設定したAgent接続情報などがすべて失われる可能性があります。これはデータ損失につながる重大な欠陥です。
- **ファイル**: [`manager/src/storeManager.js`](manager/src/storeManager.js:41-44)
