# システムアーキテクチャ概要

このドキュメントは、NL-ServerManagerのハイレベルなアーキテクチャ、主要コンポーネント、およびデータフローについて概説します。

## 1. ハイレベルな概要

NL-ServerManagerは、Minecraftサーバーを管理するためのGUIアプリケーションです。システムは、ユーザーインターフェースを提供する **Manager** と、実際のサーバー操作を実行する **Agent** の2つの主要コンポーネントから構成される、典型的な**Manager-Agentアーキテクチャ**を採用しています。

プロジェクト全体は、NPM Workspacesを利用した**モノレポ**として管理されており、`manager`と`agent`がそれぞれ独立したパッケージとなっています。

- **Manager**: ユーザーが操作するGUIアプリケーション。
- **Agent**: Managerからの指示に基づき、リモートまたはローカルでサーバー管理タスクを実行するバックグラウンドプロセス。

この分離により、UIとサーバー管理ロジックが明確に分割され、複数の物理サーバー（Agent）を単一の管理画面（Manager）から一元的に操作することが可能になります。

## 2. 主要コンポーネント

### 2.1. Manager

Managerは[Electron](https://www.electronjs.org/)フレームワークを使用して構築されたデスクトップアプリケーションです。

- **役割**:
    - サーバーやAgentの状態を表示するグラフィカルユーザーインターフェースの提供。
    - ユーザーからの操作（サーバーの作成、起動、停止など）を受け付け。
    - 複数のAgentへの接続管理とコマンド送信。
- **技術スタック**: Electron, Node.js, HTML/CSS/JavaScript
- **主要ファイル**:
    - [`manager/main.js`](manager/main.js:1): **メインプロセス**。アプリケーションのライフサイクル管理、ウィンドウの作成、AgentとのWebSocket通信、設定の永続化（`electron-store`を使用）を担当します。
    - [`manager/renderer.js`](manager/renderer.js:1): **レンダラープロセス**。HTMLと連携し、UIの描画、状態の更新、ユーザーイベントの処理を行います。
    - [`manager/preload.js`](manager/preload.js:1): メインプロセスとレンダラープロセス間の安全な**IPC (Inter-Process Communication) 通信**を仲介するブリッジスクリプトです。

### 2.2. Agent

AgentはNode.jsで動作する軽量なサーバープロセスです。

- **役割**:
    - ManagerからのWebSocket接続を待ち受け、受信したコマンドを実行。
    - Minecraftサーバーのライフサイクル管理（`server.jar`のダウンロード、起動、停止、削除）。
    - サーバープロセスの監視とログ収集。
    - ホストシステムの基本的な情報（OS、CPUアーキテクチャなど）を提供。
- **技術スタック**: Node.js, `ws` (WebSocket)
- **主要ファイル**:
    - [`agent/index.js`](agent/index.js:1): Agentのエントリーポイント。WebSocketサーバーを起動し、Managerからのメッセージを待ち受け、対応する処理にディスパッチします。
    - [`agent/src/serverManager.js`](agent/src/serverManager.js:1): サーバー管理のコアロジック。サーバーの作成（`server.jar`のダウンロード含む）、ファイル操作、プロセス生成（`spawn`）などを担当します。
    - [`agent/src/settingsManager.js`](agent/src/settingsManager.js:5): Agent自体の設定（ポート番号、サーバーディレクトリパスなど）を管理します。

## 3. データフローと通信

### 3.1. Manager内部 (IPC通信)

Electronアプリケーション内では、セキュリティ上の理由からメインプロセスとレンダラープロセスが分離されています。両者間の通信はIPCメカニズムを介して行われます。

1.  **UI → Main**: ユーザーがUIを操作すると、レンダラープロセス ([`renderer.js`](manager/renderer.js:1)) は[`preload.js`](manager/preload.js:1)経由でIPCメッセージをメインプロセスに送信します (例: `ipcRenderer.send('create-server', ...)` )。
2.  **Main → Agent**: メインプロセス ([`main.js`](manager/main.js:1)) は受信したIPCメッセージを解釈し、対応するAgentにWebSocket経由でコマンドを送信します。
3.  **Main → UI**: Agentから受信したデータやステータス更新は、メインプロセスからレンダラープロセスへIPCメッセージとして送信され (例: `mainWindow.webContents.send('server_list_update', ...)` )、UIが更新されます。

### 3.2. Manager ↔ Agent (WebSocket通信)

ManagerとAgent間の通信は、`ws`ライブラリを利用したWebSocketで行われます。

- Managerは**WebSocketクライアント**として動作し、設定された各AgentのIPアドレスとポートに接続します。
- Agentは**WebSocketサーバー**として動作し、Managerからの接続を待ち受けます。
- 通信されるメッセージは、`type`（コマンド種別）と`payload`（データ本体）を含むJSON形式です。

**フローの例 (サーバー作成)**:
1.  **Manager (UI)**: ユーザーが「サーバー作成」ボタンをクリック。
2.  **Manager (Main)**: `create-server` IPCメッセージを受信。
3.  **Manager → Agent**: `{ "type": "create_server", "payload": { "versionId": "1.18.2" } }` というWebSocketメッセージを対象のAgentに送信。
4.  **Agent**: メッセージを受信し、[`serverManager.js`](agent/src/serverManager.js:1)がMojangのAPIから`server.jar`をダウンロードし、サーバーディレクトリと設定ファイルを作成。
5.  **Agent → Manager**: 処理が完了すると、`{ "type": "server_list_update", "payload": [...] }` のようなメッセージをブロードキャストし、接続している全Managerにサーバーリストの更新を通知。
6.  **Manager (Main)**: 更新情報を受信。
7.  **Manager (UI)**: `server_list_update` IPCメッセージを受け取り、画面上のサーバーリストを再描画。

### 3.3. 状態管理と永続化

- **Manager**:
    - Agentの接続設定（IP、ポート、エイリアス）やウィンドウサイズなどの永続的なデータは、[`electron-store`](manager/package.json:40)を利用してユーザーのローカルディスクにJSONファイルとして保存されます。
    - 接続中のAgentの状態やサーバーリストなどの揮発的なデータは、メインプロセスのメモリ内（`Map`オブジェクト）で管理されます。
- **Agent**:
    - 各Minecraftサーバーの設定（JVM引数、サーバー名など）は、それぞれのサーバーディレクトリ内に`nl-server_manager.json`というファイル名で永続化されます。
    - Agent自体の設定（APIポートなど）は、`agent/settings.json`に保存されます。

## 4. ディレクトリ構造

- `/manager`: Manager (Electronアプリケーション) のソースコード。
- `/agent`: Agent (Node.jsバックエンド) のソースコード。
- `/package.json`: モノレポ全体の設定ファイル。`workspaces`プロパティで`manager`と`agent`を管理。