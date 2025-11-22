# Code Review: Potential Quality Issues

このドキュメントは、`architecture.md` を基準としてコードベース全体をスキャンし、特定された潜在的な品質問題をまとめたものです。機能や保守性に影響を与える可能性のある問題を優先的にリストアップしています。

---

## 1. Manager: UIロジックと描画の密結合

-   **ファイル:**
    -   [`manager/src/dom/eventHandlers.js`](manager/src/dom/eventHandlers.js)
    -   [`manager/renderer.js`](manager/renderer.js)
    -   [`manager/renderer-ui.js`](manager/renderer-ui.js)
-   **問題の説明:**
    アーキテクチャでは `Logic -> State -> UI` という単方向データフローが定義されていますが、現状の実装では `eventHandlers.js` や `renderer.js` から `updateView()` などのUI描画関数が直接呼び出されています。これにより、状態の更新とUIの描画が分離されておらず、コンポーネント間の依存関係が強くなっています。
    また、主要なDOM要素が `window` オブジェクトを介してグローバルに共有されており、どのモジュールがどの要素に依存しているかが不明瞭です。
-   **機能/保守性への影響:**
    -   状態変更が意図しないUI更新を引き起こす可能性があります。
    -   コンポーネントの再利用性が低く、将来的なUIの変更やリファクタリングが困難になります。
    -   グローバルなDOMアクセスは、予期せぬ副作用を生みやすく、デバッグを複雑にします。

## 2. Agent: 巨大なサービスファイルの存在 (Fat Service)

-   **ファイル:**
    -   [`agent/src/services/serverConfigService.js`](agent/src/services/serverConfigService.js) (378行)
    -   [`agent/src/services/lifecycleService.js`](agent/src/services/lifecycleService.js) (270行)
-   **問題の説明:**
    -   `serverConfigService.js` は、サーバー設定のCRUD操作に加えて、Forgeサーバーのインストール、バージョン情報の取得、デフォルト設定の生成など、多数の責務を担っています。特に `createServer` 関数は、ダウンロード、インストール、設定ファイル生成といった複数の処理が凝縮されています。
    -   `lifecycleService.js` は、サーバーの起動・停止だけでなく、RCONクライアントの接続管理、EULAチェック、起動引数の構築など、複数の責務を担っています。
-   **機能/保守性への影響:**
    -   単一責任の原則に違反しており、ファイルの可読性が著しく低下しています。
    -   一つの機能を修正する際の影響範囲が広くなり、意図しないバグ（デグレード）を生むリスクが高まります。
    -   ユニットテストの作成が困難になります。

## 3. Manager/Agent: 不明確な通信プロトコル

-   **ファイル:**
    -   [`manager/preload.js`](manager/preload.js)
    -   [`agent/src/websocket/server.js`](agent/src/websocket/server.js)
-   **問題の説明:**
    `architecture.md` ではリクエスト/レスポンスとプッシュ通知の2パターンが定義されていますが、実装ではIPCチャンネル名とWebSocketメッセージタイプが多岐にわたり、一貫性がありません。例えば、`onAgentList` (IPC) と `SERVER_LIST_UPDATE` (WS) のように、似た目的の処理に異なる命名が使用されています。
    また、`proxy-to-agent` という汎用的なIPCチャンネルに多くの処理が集中しており、ManagerとAgent間でどのような通信が行われているかの全体像を把握するのが困難です。
-   **機能/保守性への影響:**
    -   新しい機能を追加する際に、どの通信チャンネルやメッセージタイプを使用すべきかの判断が難しくなります。
    -   プロトコルの全体像が掴みにくいため、メッセージの見落としや誤った処理に繋がりやすいです。

## 4. Agent: 設定管理における競合状態のリスク

-   **ファイル:** [`agent/src/settingsManager.js`](agent/src/settingsManager.js)
-   **問題の説明:**
    Agentの設定 (`agentSettings`) は、モジュールスコープの変数としてインメモリにキャッシュされています。`saveSettings` 関数はファイルへの保存とキャッシュの更新を行いますが、複数の非同期処理から同時に呼び出された場合の競合状態（Race Condition）に対する排他制御が存在しません。
-   **機能/保守性への影響:**
    -   タイミングによっては、設定の保存が一部失われたり、古い設定がキャッシュに残ったままになったりする可能性があります。
    -   信頼性の低い設定管理は、予期せぬAgentの挙動を引き起こす原因となります。

## 5. Manager: グローバルな状態管理による予測不能性

-   **ファイル:** [`manager/renderer-state.js:53`](manager/renderer-state.js:53)
-   **問題の説明:**
    アプリケーションのUI状態を管理する `state` オブジェクトが `window.state` としてグローバルに公開されています。これにより、どのモジュールからでも `state` を直接変更することが可能になっており、「状態更新は `renderer.js` が一元的に担う」というアーキテクチャ原則に違反しています。
-   **機能/保守性への影響:**
    -   状態がどこでどのように変更されたかを追跡するのが非常に困難になり、デバッグの複雑性が増大します。
    -   アプリケーションの挙動が予測不能になり、状態に関連するバグが頻発する可能性があります。

## 6. Agent: 未使用のバレルファイル

-   **ファイル:** [`agent/src/serverManager.js`](agent/src/serverManager.js)
-   **問題の説明:**
    このファイルは、`src/services/` 配下の各サービスモジュールから関数をインポートし、再エクスポートするだけの「バレルファイル」として機能しています。しかし、実際にこれらの関数を使用しているハンドラファイル (`websocket/handlers/*.js`) や `agent/index.js` は、`serverManager.js` を経由せず、直接サービスモジュールをインポートしています。結果として、このファイルはほぼ未使用（デッドコード）の状態です。
-   **機能/保守性への影響:**
    -   不要なファイルが存在することで、コードベースの理解を妨げ、複雑性を不必要に増大させます。
    -   リファクタリングの際に、このファイルも追従して修正する必要があるかどうかの判断にコストがかかります。