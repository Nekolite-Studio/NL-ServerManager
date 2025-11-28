# システムアーキテクチャ

このドキュメントは、Server Manager アプリケーションの全体的なアーキテクチャ、コンポーネントの責務、およびデータフローについて説明します。

## 1. 概要

Server Manager は、Electron 製の GUI クライアント (`manager`) と、各物理マシンで動作する Node.js 製の`agent`で構成される、クライアント-サーバー型のアプリケーションです。

- **Manager (クライアント):** ユーザーがサーバーを管理するための GUI を提供します。複数の`agent`を一元的に操作できます。
- **Agent (サーバー):** 物理マシンまたは仮想マシン上で動作し、`manager`からの指示に基づいて Minecraft サーバーの作成、起動、監視などの物理的なタスクを実行します。

```mermaid
graph TD
    subgraph Manager (Electron App)
        direction LR
        subgraph Renderer Process (UI)
            direction TB
            renderer_state[State (renderer-state.js)] -- Provides data --> renderer_ui[UI (renderer-ui.js)]
            renderer_logic[Logic (renderer.js)] -- Updates --> renderer_state
            renderer_ui -- Renders --> DOM
            DOM -- User Interaction --> renderer_logic
        end
        subgraph Main Process (main.js)
            direction TB
            ipc[IPC Handlers (mainHandlers.js)]
            agent_mgr[Agent Manager (agentManager.js)]
            ext_api[External API (externalApiService.js)]
            store[Settings (storeManager.js)]
            prop_anno[Property Annotations (propertyAnnotations.js)]
        end
    end

    subgraph Agent (Node.js App)
        direction TB
        ws_server[WebSocket Server (index.js)]
        server_manager[Server Manager (serverManager.js)]
        settings_manager[Settings Manager (settingsManager.js)]
    end

    subgraph "Minecraft Server"
        mc_process[Java Process]
    end

    %% Interactions
    renderer_logic -- IPC via Preload --> ipc
    ipc -- Calls --> agent_mgr
    ipc -- Calls --> ext_api
    ipc -- Calls --> prop_anno
    agent_mgr -- WebSocket --> ws_server
    ws_server -- Delegates task --> server_manager
    server_manager -- Spawns/Manages --> mc_process

    mc_process -- stdout/stderr --> server_manager
    server_manager -- Pushes update --> ws_server
    ws_server -- Pushes update --> agent_mgr
    agent_mgr -- Pushes update --> ipc
    ipc -- Pushes update --> renderer_logic
```

## 2. コンポーネントの責務

### 2.1. Manager

#### Main プロセス (`main.js`)

- **アプリケーションライフサイクル:** ウィンドウの作成、終了などの管理。
- **`src/services/agentManager.js`:** 全ての`agent`との WebSocket 接続を確立・維持・再接続する。UI からの要求に応じて Agent の動的な追加・削除を行い、Agent リストの管理と永続化も担当する。
- **`src/ipc/mainHandlers.js`:** Renderer プロセスからの IPC 要求を受け取り、適切なサービス（AgentManager や ExternalApiService）に処理を委譲する。
- **`src/storeManager.js`:** `electron-store`を利用して、登録済み Agent リストやウィンドウサイズをディスクに保存する。**スキーマ検証を伴う堅牢な設定管理**を行い、設定破損時にはユーザーに通知し、バックアップと復旧オプションを提供する。
- **`src/services/externalApiService.js`:** Mojang（バージョン情報）や Adoptium（Java ダウンロード情報）などの外部 API との通信、およびサーバー JAR のダウンロード URL 解決を担当する。**HTTP クライアントとして`axios`を使用**し、応答データのパースとエラーハンドリングを一元化する。また、**取得した API 応答を`electron-store`を利用してキャッシュし、外部 API へのリクエスト数を削減する。** ただし、エラー応答はキャッシュせず（または短期間のみキャッシュ）、一時的な障害からの即時回復を可能にする。また、UI からの強制更新（Force Refresh）要求にも対応し、キャッシュをバイパスして最新データを取得する機能を持つ。
- **`src/services/propertyAnnotations.js`:** `server.properties` の UI 表示用メタデータ（説明文、グループ分け、入力タイプなど）を提供する。`@nl-server-manager/common` の Zod スキーマから動的に生成される。

#### Renderer プロセス (UI) - v6アーキテクチャ

v6 UIへの刷新により、Rendererプロセスはより宣言的でコンポーネントベースのアーキテクチャに移行しました。

- **`index.html` (スケルトン):** アプリケーションの骨格のみを定義する最小限のHTMLファイル。実際のコンテンツはすべてJavaScriptによって動的に注入されます。
- **`renderer-state.js` (状態管理):** アプリケーション全体のUI状態（`currentView`, `layoutMode`, `theme`, サーバーリストなど）を一元管理します。`currentView` は `'list'`, `'detail'`, `'physical-detail'` などの値を取り、現在の表示画面を決定します。`getters`を通じて、UIが必要とする形式に整形されたデータを提供します（例: `getUnifiedServerList`）。
- **`renderer-ui.js` (描画オーケストレーター):** `updateView`関数が中心となり、現在の`state`に基づいて全体のUIを描画する責務を担います。
    - アプリケーションヘッダーを描画します。
    - `state.currentView` に応じて、`renderServerDetail` や `renderPhysicalServerDetail` などの詳細ビュー関数、または `state.layoutMode` に基づくレイアウト描画関数を呼び出します。
    - テーマ（ダーク/ライト）を適用します。
- **`src/ui/layouts/*.js` (レイアウトエンジン):** 各レイアウト（Accordion, Kanbanなど）のHTML構造を生成する責務を担います。`state`から渡されたデータに基づき、テンプレートリテラルを用いてUIを構築します。
- **`src/ui/components/*.js` (UIコンポーネント):** `ServerCreateModal.js`、`SettingsModal.js`、`AgentRegisterModal.js`、`EulaModal.js`のように、再利用可能なUI部品（モーダルなど）をクラスとしてカプセル化します。
- **`renderer.js` (エントリーポイント):** アプリケーションの初期化、IPCリスナー、DOMイベントリスナーの設定を行います。
- **`src/dom/eventHandlers.js` (イベントハブ):** `document`へのイベント委譲モデルを採用し、すべてのUI操作を`data-action`属性に基づいて処理します。サーバーの起動/停止、設定の保存、UIの表示切り替え（`view-server-detail`, `manage-agent`）、タブ切り替え（`switch-detail-tab`, `switch-physical-detail-tab`）など、ユーザーからのあらゆるインタラクションを仲介し、DOM構造の変更に強い堅牢なイベント処理を実現します。
- **`src/ipc/rendererListeners.js`:** Mainプロセスからの非同期イベント（サーバー状態更新など）を受け取り、`state`を更新した後、必要に応じて`updateView()`や部分更新関数を呼び出してUIに反映させます。

### 2.2. Agent

- **`index.js` (通信ハブ):** `manager`からの WebSocket 接続を待ち受け、受信したメッセージを解釈し、`serverManager`に処理を委譲する司令塔。**ESM (ECMAScript Modules) 形式で記述**されており、[`common/protocol.js`](https://www.google.com/search?q=common/protocol.js:1)で定義された定数を用いてメッセージタイプを厳密に管理する。
- **`serverManager.js` (コアロジック):** Minecraft サーバーのライフサイクル管理に関する全ての物理的な操作を担当する。
  - **状態の整合性維持:** Agent 起動時に実行中の Java プロセスを`pidusage`等を用いてスキャンし、実際のプロセス存在状況に基づいてメモリ上のサーバーステータスを（`running`または`stopped`に）復元する。
  - **プロセス管理:** `child_process.spawn`により、Minecraft サーバーを**Agent の子プロセスとして**起動・停止する。これにより、Agent 終了時にサーバープロセスも確実に終了する。
  - **ファイル操作:** サーバーファイルの作成、読み取り、削除、および`eula.txt`の同意状態のチェックと更新。**サーバーごとの設定（名前、メモなど）の更新と永続化。** **EULA 未同意時には Manager に通知し、同意を促すインタラクティブなフローをサポートする。**
  - **ログ収集:** 実行中プロセスの標準出力/エラー出力を監視し、ログを収集する。
  - **メトリクス収集:**
    - **ゲームサーバー:** RCON 経由で TPS やプレイヤー数を取得するほか、`pidusage`を用いてプロセスごとのリソース使用量を軽量に監視する。
    - **物理サーバー:** Node.js 標準の`os`モジュール、`pidusage`、および一部`systeminformation`ライブラリを併用し、クロスプラットフォームかつ低負荷に CPU、RAM、Disk 使用率をリアルタイムで収集する。
  - **Java パス解決:** `java_path`または`java_version`に基づいて、インストールされた Java 実行ファイルを正確に特定するロジックを実装。
  - **サーバー JAR ダウンロード:** Manager から提供された URL を使用して、サーバー JAR ファイルをダウンロードする。
- **`settingsManager.js` (設定管理):** `agent`自体の設定（API ポート、サーバーディレクトリなど）を管理する。ファイルが存在しない場合はデフォルト値で自動生成される。

## 3. データフローの原則

本アプリケーションのデータフローは、予測可能性とメンテナンス性を高めるために、主に単方向（One-Way Data Flow）で設計されています。

### 3.1. Manager 内部の UI 更新フロー

`manager`の UI (v6) は、状態駆動の宣言的なレンダリングモデルを採用しています。

1.  **イベント発生:** ユーザー操作（例: ボタンクリック）は `eventHandlers.js` によって `data-action` 属性を元に捕捉されます。または、Mainプロセスからの非同期メッセージが `rendererListeners.js` に到着します。
2.  **状態更新:** イベントハンドラは、`renderer-state.js` の `state` オブジェクトを直接更新します。UIの見た目を直接変更する操作は行いません。
3.  **再描画トリガー:** 状態が変更された後、ハンドラは `updateView()` 関数を呼び出します。
4.  **UI構築:** `renderer-ui.js` の `updateView()` 関数が実行されます。
    - `state.layoutMode` に基づき、`src/ui/layouts/` から適切なレイアウト関数（例: `renderAccordionLayout`）を選択します。
    - 選択されたレイアウト関数が、`state` と `getters` から最新のデータを取得し、ページのHTMLコンテンツ全体を再構築します。
5.  **部分更新 (リアルタイムメトリクス):** WebSocketからサーバーのメトリクス更新など、高頻度で発生するイベントについては、`updateView()`による全体再描画を避けます。代わりに、`rendererListeners.js` は、特定のDOM要素を直接更新する部分更新関数（例: `updateAccordionServer()`）を呼び出し、パフォーマンスを最適化します。

### 3.2. Manager-Agent 間の非同期通信フロー

`manager`と`agent`間の通信は、同期的には行われません。常に非同期であり、以下の 2 つの主要パターンで構成されます。**メッセージは[`common/protocol.js`](https://www.google.com/search?q=common/protocol.js:1)で定義された定数を使用し、`type`フィールドで識別される。**

- **リクエスト/レスポンスパターン:**
  - `manager`が操作（例: サーバー作成）を要求すると、一意な`requestId`を付与して`agent`に送信する。
  - `agent`は処理完了後、この`requestId`を含む`OPERATION_RESULT`メッセージを返す。
  - `manager`はこの ID を使って、どの要求に対する応答なのかを判断する。
- **プッシュ通知パターン:**
  - `agent`側でイベント（例: サーバーが停止した、新しいログが出力された）が発生すると、`agent`は`manager`からの要求を待たずに、自発的に`SERVER_UPDATE`などのメッセージを送信する。
  - `manager`はこれらのメッセージを受け取り、リアルタイムで UI に状態変化を反映させる。
