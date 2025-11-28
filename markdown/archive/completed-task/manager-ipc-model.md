# Manager IPCモデル: MainとRendererの連携

## 概要

Electronアプリケーションは、2つの主要なプロセスで構成されています。**Mainプロセス**と**Rendererプロセス**です。

-   **Mainプロセス**は、Node.js環境で動作し、アプリケーションのライフサイクル管理、ネイティブOS機能へのアクセス（例: ファイルシステム、メニュー、ダイアログ）、ウィンドウ（`BrowserWindow`インスタンス）の作成など、バックエンドとしての役割を担います。各アプリケーションにMainプロセスは1つだけ存在します。
-   **Rendererプロセス**は、各ウィンドウ内で動作するChromiumベースのウェブページです。HTML、CSS、JavaScriptを実行し、ユーザーインターフェース（UI）の描画とインタラクションを担当します。

セキュリティ上の理由から、Rendererプロセスは直接Node.jsのAPIやシステムリソースにアクセスできません。そのため、UIからの要求（例: ファイルを読み込みたい、設定を保存したい）をMainプロセスに伝え、処理を依頼する必要があります。このプロセス間の通信を**プロセス間通信（IPC）**と呼びます。

Managerアプリケーションでは、`preload.js`スクリプトを介して、この通信を安全に行っています。

## 各スクリプトの役割

### `main.js` (Mainプロセス)

アプリケーションの心臓部であり、すべてのバックエンド処理を担当します。

-   **ウィンドウ管理:** `BrowserWindow`を作成し、`index.html`をロードします。
-   **Agentとの通信:** AgentとのWebSocket接続を管理し、状態の監視やコマンドの送受信を行います。
-   **ネイティブ機能へのアクセス:** ファイルシステムの読み書き、OSのダイアログ表示など、Rendererプロセスが直接実行できない処理を担当します。
-   **IPCイベントの待受:** `ipcMain`モジュールを使い、Rendererプロセスからの要求（`'request-agent-list'`など）をリッスンし、適切な処理を実行します。

### `renderer.js` (Rendererプロセス)

UIのロジックを担当し、ユーザーの操作に応じて表示を更新します。

-   **HTMLの描画:** `index.html`のDOM要素を操作し、Agentのリストやサーバーの状態などを動的に表示します。
-   **ユーザーインタラクション:** ボタンのクリックやフォームの入力といったユーザーイベントを処理します。
-   **Mainプロセスへの要求:** 必要なデータや処理がある場合、`preload.js`経由で公開されたAPI（`window.electronAPI`）を呼び出し、Mainプロセスに処理を依頼します。

### `preload.js`

MainプロセスとRendererプロセスを安全に橋渡しする特別なスクリプトです。

-   **コンテキストブリッジ:** `contextBridge`を使い、Mainプロセスの機能をすべて公開するのではなく、許可されたAPI（`requestAgentList`など）だけを`window.electronAPI`オブジェクトとしてRendererプロセスに公開します。これにより、悪意のあるスクリプトがRendererプロセスで実行されても、システム全体へのアクセスを防ぎます。
-   **IPC通信の中継:** RendererプロセスからのAPI呼び出しを、`ipcRenderer.send()`や`ipcRenderer.invoke()`を使ってMainプロセスへのIPCメッセージに変換します。また、`ipcRenderer.on()`を使ってMainプロセスからの応答をリッスンし、Rendererプロセスにデータを渡します。

## 通信フローの例（Agentリストの要求）

ユーザーがアプリケーションを起動し、Agentのリストを表示する際のプロセス間通信の流れは以下の通りです。

1.  **Rendererプロセス (`renderer.js`)**
    UIの初期化時に、MainプロセスにAgentリストを要求するため、`preload.js`で公開されたAPIを呼び出します。
    ```javascript
    window.electronAPI.requestAgentList();
    ```

2.  **Preloadスクリプト (`preload.js`)**
    `contextBridge`で公開された`requestAgentList`関数が実行されます。この関数は、`ipcRenderer`を使って`'request-agent-list'`というチャンネル名でMainプロセスにメッセージを送信します。`onAgentList`のようなリスナーもここで一緒に公開されます。
    ```javascript
    // preload.js内
    const { contextBridge, ipcRenderer } = require('electron');

    contextBridge.exposeInMainWorld('electronAPI', {
      requestAgentList: () => ipcRenderer.send('request-agent-list'),
      onAgentList: (callback) => ipcRenderer.on('agent-list', (_event, value) => callback(value))
    });
    ```

3.  **Mainプロセス (`main.js`)**
    `ipcMain.on`で`'request-agent-list'`チャンネルをリッスンしており、メッセージを受信すると登録されたコールバック関数が実行されます。
    ```javascript
    // main.js内
    ipcMain.on('request-agent-list', (event) => {
      // Agentリストを取得する処理を実行
      const agentList = getAgentListFromManager();
      // 結果をRendererプロセスに送り返す
      mainWindow.webContents.send('agent-list', agentList);
    });
    ```

4.  **Mainプロセスから結果を返信**
    Mainプロセスは、管理しているAgentのリストを取得し、`mainWindow.webContents.send()`を使って`'agent-list'`というチャンネルで結果をRendererプロセスに送り返します。

5.  **Rendererプロセス (`renderer.js`)**
    `renderer.js`では、Mainプロセスからのデータを受信するためのリスナーをあらかじめ登録しておきます。
    ```javascript
    // renderer.js内
    window.electronAPI.onAgentList((agentList) => {
      // 受け取ったデータを使ってUIを更新する
      console.log('受信したAgentリスト:', agentList);
      updateAgentListUI(agentList);
    });
    ```
    最終的に、`renderer.js`内のコールバック関数が実行され、受け取ったAgentリストを使ってUIが更新されます。