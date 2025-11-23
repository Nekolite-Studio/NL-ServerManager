# システムアーキテクチャ

このドキュメントは、Server Managerアプリケーションの全体的なアーキテクチャ、コンポーネントの責務、およびデータフローについて説明します。

## 1. 概要

Server Managerは、Electron製のGUIクライアント (`manager`) と、各物理マシンで動作するNode.js製の`agent`で構成される、クライアント-サーバー型のアプリケーションです。

-   **Manager (クライアント):** ユーザーがサーバーを管理するためのGUIを提供します。複数の`agent`を一元的に操作できます。
-   **Agent (サーバー):** 物理マシンまたは仮想マシン上で動作し、`manager`からの指示に基づいてMinecraftサーバーの作成、起動、監視などの物理的なタスクを実行します。

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

#### Mainプロセス (`main.js`)
-   **アプリケーションライフサイクル:** ウィンドウの作成、終了などの管理。
-   **`src/services/agentManager.js`:** 全ての`agent`とのWebSocket接続を確立・維持・再接続する。Agentリストの管理と永続化も担当する。
-   **`src/ipc/mainHandlers.js`:** RendererプロセスからのIPC要求を受け取り、適切なサービス（AgentManagerやExternalApiService）に処理を委譲する。
-   **`src/storeManager.js`:** `electron-store`を利用して、登録済みAgentリストやウィンドウサイズをディスクに保存する。**スキーマ検証を伴う堅牢な設定管理**を行い、設定破損時にはユーザーに通知し、バックアップと復旧オプションを提供する。
-   **`src/services/externalApiService.js`:** Mojang（バージョン情報）やAdoptium（Javaダウンロード情報）などの外部APIとの通信を担当する。**HTTPクライアントとして`axios`を使用**し、応答データのパースとエラーハンドリングを一元化する。
-   **`src/services/propertyAnnotations.js`:** `server.properties` のUI表示用メタデータ（説明文、グループ分け、入力タイプなど）を提供する。`@nl-server-manager/common` のZodスキーマから動的に生成される。

#### Rendererプロセス (UI)
-   **責務分離:** `renderer-state.js` (状態管理)、`renderer-ui.js` (UI描画)、`renderer.js` (エントリーポイント) に加え、機能ごとにモジュール化が進められている。
-   **`renderer-state.js` (状態):** アプリケーションのUI状態（表示中のビュー、選択中のサーバー、リアルタイムメトリクスなど）を一元管理する。純粋なデータオブジェクト。
-   **`renderer-ui.js` (描画):** `state`オブジェクトのデータに基づき、HTML (DOM) を構築・更新する責務を担う。特にサーバープロパティ画面では、Mainプロセス経由で取得したメタデータを基に、**標準のDOM APIを用いて安全に入力フォームを構築**する。HTML文字列の組み立ては行わない。
-   **`renderer.js` (エントリーポイント):** アプリケーションの初期化、IPCリスナーの設定、DOMイベントリスナーの設定を行うエントリーポイント。
-   **`src/ipc/rendererListeners.js`:** MainプロセスからのIPCイベントを受信し、状態更新やUI描画をトリガーするリスナー群。
-   **`src/dom/eventHandlers.js`:** ユーザー操作（クリックなど）に対するDOMイベントハンドラ群。
-   **`src/services/metricsService.js`:** メトリクスストリームの開始・停止などのロジックを担当するサービス。

### 2.2. Agent

-   **`index.js` (通信ハブ):** `manager`からのWebSocket接続を待ち受け、受信したメッセージを解釈し、`serverManager`に処理を委譲する司令塔。**ESM (ECMAScript Modules) 形式で記述**されており、[`common/protocol.js`](common/protocol.js:1)で定義された定数を用いてメッセージタイプを厳密に管理する。
-   **`serverManager.js` (コアロジック):** Minecraftサーバーのライフサイクル管理に関する全ての物理的な操作を担当する。
    -   **状態の整合性維持:** Agent起動時に実行中のJavaプロセスを`systeminformation`ライブラリを用いてスキャンし、実際のプロセス存在状況に基づいてメモリ上のサーバーステータスを（`running`または`stopped`に）復元する。
    -   **プロセス管理:** `child_process.spawn`により、Minecraftサーバーを**Agentの子プロセスとして**起動・停止する。これにより、Agent終了時にサーバープロセスも確実に終了する。
    -   **ファイル操作:** サーバーファイルの作成、読み取り、削除、および`eula.txt`の同意状態のチェックと更新。**サーバーごとの設定（名前、メモなど）の更新と永続化。** **EULA未同意時にはManagerに通知し、同意を促すインタラクティブなフローをサポートする。**
    -   **ログ収集:** 実行中プロセスの標準出力/エラー出力を監視し、ログを収集する。
    -   **メトリクス収集:**
        -   **ゲームサーバー:** RCON経由でサーバーに接続し、TPSやプレイヤー数を取得する。
        -   **物理サーバー:** `systeminformation`ライブラリを利用し、ホストマシンのCPU、RAM、Disk使用率をリアルタイムで収集する。
    -   **Javaパス解決:** `java_path`または`java_version`に基づいて、インストールされたJava実行ファイルを正確に特定するロジックを実装。
-   **`settingsManager.js` (設定管理):** `agent`自体の設定（APIポート、サーバーディレクトリなど）を管理する。ファイルが存在しない場合はデフォルト値で自動生成される。

## 3. データフローの原則

本アプリケーションのデータフローは、予測可能性とメンテナンス性を高めるために、主に単方向（One-Way Data Flow）で設計されています。

### 3.1. Manager内部のUI更新フロー

`manager`のUIは、ReactやVueのようなモダンフレームワークに似た思想で設計されています。

1.  **イベント発生:** ユーザー操作またはMainプロセスからのIPCメッセージが `renderer.js` に到着する。
2.  **状態更新:** `renderer.js` は、イベントに応じて `renderer-state.js` の `state` オブジェクトを更新する。 **直接DOMを操作することはない。**
3.  **再描画:** `renderer.js` が `renderer-ui.js` の描画関数（例: `updateView()`）を呼び出す。
4.  **UI反映:** `renderer-ui.js` は、更新された `state` オブジェクトを唯一の信頼できる情報源（Single Source of Truth）として参照する。**初回描画時はUI全体を構築するが、更新時はDOMの全置換を避け、変化した値のみを更新する「部分更新 (Partial Update)」を行う。** これにより、状態とUIの一貫性を保証しつつ、入力中のフォームやスクロール位置などのUI状態を維持する。

### 3.2. Manager-Agent間の非同期通信フロー

`manager`と`agent`間の通信は、同期的には行われません。常に非同期であり、以下の2つの主要パターンで構成されます。**メッセージは[`common/protocol.js`](common/protocol.js:1)で定義された定数を使用し、`type`フィールドで識別される。**

-   **リクエスト/レスポンスパターン:**
    -   `manager`が操作（例: サーバー作成）を要求すると、一意な`requestId`を付与して`agent`に送信する。
    -   `agent`は処理完了後、この`requestId`を含む`OPERATION_RESULT`メッセージを返す。
    -   `manager`はこのIDを使って、どの要求に対する応答なのかを判断する。
-   **プッシュ通知パターン:**
    -   `agent`側でイベント（例: サーバーが停止した、新しいログが出力された）が発生すると、`agent`は`manager`からの要求を待たずに、自発的に`SERVER_UPDATE`などのメッセージを送信する。
    -   `manager`はこれらのメッセージを受け取り、リアルタイムでUIに状態変化を反映させる。