# NL-ServerManager 通信フロー解説

このドキュメントは、NL-ServerManagerの`Manager` (Electron GUI) と `Agent` (Node.jsプロセス) 間の通信アーキテクチャとデータフローを包括的に解説します。

## 1. 通信の概要

本システムは、2つの主要な通信チャネルを利用しています。

-   **IPC (プロセス間通信)**: `Manager`の**メインプロセス**と**レンダラープロセス**（UI）間の通信です。セキュリティ上の理由から、UIからの操作要求やメインプロセスからのUI更新通知はすべてこのチャネルを経由します。
-   **WebSocket**: `Manager`の**メインプロセス**と、各`Agent`プロセス間の通信です。実際のサーバー操作コマンドの送信や、`Agent`からの結果・状態通知に使用されます。

## 2. メッセージの基本構造と非同期処理

`Manager`と`Agent`間のWebSocketメッセージは、すべて`common/protocol.js`で定義された規約に従います。

-   **要求ID (`requestId`):** `Manager`から`Agent`へのすべての要求には、一意の`requestId`が付与されます。
-   **応答 (`OPERATION_RESULT`):** `Agent`は、処理が完了した際に必ず同じ`requestId`を含む`OPERATION_RESULT`メッセージを返します。これにより、`Manager`はどの要求に対する応答かを正確に対応付けることができます。
-   **進捗 (`PROGRESS_UPDATE`):** 時間のかかる処理（サーバー作成、Javaインストールなど）の途中経過は、`PROGRESS_UPDATE`メッセージで通知されます。

## 3. 主要な通信フロー

### フロー1: ManagerからAgentへの操作要求 (例: サーバー削除)

ユーザーがUIでサーバー削除ボタンをクリックした際の通信フローです。

```mermaid
sequenceDiagram
    participant Renderer as レンダラー (UI)
    participant Preload as Preload.js
    participant Main as Manager (メイン)
    participant Agent

    Renderer->>Preload: proxyToAgent(agentId, {type: 'delete-server', ...})
    Preload->>Main: IPC 'proxy-to-agent'
    Main->>Main: requestIdを生成
    Main->>Main: pendingOperationsにrequestIdを登録
    Main->>Agent: WebSocket: {type: 'delete-server', requestId, ...}
    Agent->>Agent: サーバー削除処理を実行
    Agent-->>Main: WebSocket: {type: 'OPERATION_RESULT', requestId, success: true, ...}
    Main->>Main: pendingOperationsからrequestIdを削除
    Main->>Preload: IPC 'operation-result'
    Preload->>Renderer: onOperationResultコールバック実行
    Renderer->>Renderer: UI更新 (通知表示など)
```

1.  **UI → Main (IPC):** レンダラープロセスは、[`preload.js`](manager/preload.js:10)を介して`proxy-to-agent`チャネルにIPCメッセージを送信します。
2.  **Main → Agent (WebSocket):** メインプロセスは、メッセージに`requestId`を付与し、対象の`Agent`にWebSocketで送信します。この`requestId`は完了応答を待つために`pendingOperations`マップに保存されます。
3.  **Agent → Main (WebSocket):** `Agent`は処理完了後、`requestId`を含む`OPERATION_RESULT`メッセージを返します。
4.  **Main → UI (IPC):** メインプロセスは結果を`operation-result`チャネルでUIに通知します。

### フロー2: AgentからManagerへの自発的な状態更新 (ブロードキャスト)

`Agent`側でのサーバー作成や削除が完了し、全Managerのサーバーリストを更新する必要がある場合のフローです。

```mermaid
sequenceDiagram
    participant Agent
    participant Main as Manager (メイン)
    participant Preload as Preload.js
    participant Renderer as レンダラー (UI)

    Agent->>Agent: サーバー作成/削除完了
    Agent->>Main: WebSocket (Broadcast): {type: 'server_list_update', payload: [...]}
    Main->>Preload: IPC 'server-list-update'
    Preload->>Renderer: onServerListUpdateコールバック実行
    Renderer->>Renderer: サーバーリストUIを再描画
```

1.  **Agent → Main (WebSocket):** `Agent`は、接続している**すべての**`Manager`クライアントに対し、`server_list_update`メッセージをブロードキャストします。これには`requestId`は含まれません。
2.  **Main → UI (IPC):** メインプロセスは受信したリストを`server-list-update`チャネルでUIに転送します。
3.  **UI更新:** レンダラーは新しいサーバーリストを元に画面を再描画します。

### フロー3: Agent内部イベントの通知 (例: サーバーログ)

実行中のサーバープロセスが新しいログを出力した場合など、Agent内部で発生したイベントを通知するフローです。

```mermaid
sequenceDiagram
    participant ServerProcess as MCサーバー (外部プロセス)
    participant Agent
    participant Main as Manager (メイン)
    participant Renderer as レンダラー (UI)

    Agent->>Main: WebSocket: {type: 'server-update', payload: {serverId, type: 'status_change', payload: 'starting'}}
    Main->>Renderer: IPC: 'server-update'
    Renderer->>Renderer: UIを「起動中」に更新
    
    ServerProcess->>Agent: ログを出力 ("... Done ...")
    Agent->>Agent: 起動完了を検知
    Agent->>Main: WebSocket: {type: 'server-update', payload: {serverId, type: 'status_change', payload: 'running'}}
    Main->>Renderer: IPC: 'server-update'
    Renderer->>Renderer: UIを「起動済み」に更新
```

1.  **起動開始通知:** `startServer`関数が呼ばれると、`Agent`は即座にステータスが`starting`になったことを`Manager`に通知します。UIはこれを受けて「起動中」の表示に切り替わります。
2.  **ログ監視と完了検知:** `Agent`はサーバープロセスの標準出力を監視し、起動完了を示す特定のログ（例: "Done"）を待ち受けます。
3.  **起動完了通知:** 完了を示すログを検知すると、`Agent`はステータスが`running`になったことを`Manager`に通知します。UIはこれを受けて「起動済み」の表示に更新します。

### フロー4: EULA同意フロー

サーバー初回起動時など、`eula.txt`への同意が必要な場合のインタラクティブなフローです。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Renderer as レンダラー (UI)
    participant Main as Manager (メイン)
    participant Agent

    User->>Renderer: 「サーバー起動」をクリック
    Renderer->>Main: IPC: proxyToAgent('control-server', 'start')
    Main->>Agent: WebSocket: {type: 'CONTROL_SERVER', action: 'start', ...}

    Agent->>Agent: eula.txt をチェック
    Agent-->>Main: WebSocket: {type: 'REQUIRE_EULA_AGREEMENT', payload: {eulaContent}, ...}
    Main-->>Renderer: IPC: 'require-eula-agreement'
    Renderer->>User: EULA同意モーダルを表示

    alt ユーザーが同意した場合
        User->>Renderer: 「同意する」をクリック
        Renderer->>Main: IPC: proxyToAgent('accept-eula', ...)
        Main->>Agent: WebSocket: {type: 'ACCEPT_EULA', ...}
        Agent->>Agent: eula.txt を更新
        Agent->>Agent: サーバー起動処理を再試行
        Agent-->>Main: WebSocket: {type: 'OPERATION_RESULT', success: true, ...}
        Main-->>Renderer: IPC: 'operation-result'
        Renderer->>User: UIを更新 (ステータス: 起動中)
    else ユーザーがキャンセルした場合
        User->>Renderer: 「キャンセル」をクリック
        Renderer->>Renderer: モーダルを閉じる
    end
```

1.  **起動要求:** 通常のサーバー起動フローと同様に、`Manager`から`Agent`へ`CONTROL_SERVER`メッセージが送信されます。
2.  **EULAチェック:** `Agent`内の`startServer`関数が、サーバープロセスを起動する前に`eula.txt`をチェックします。
3.  **同意要求 (Agent → Manager):** EULAが未同意の場合、`Agent`はサーバーを起動せず、代わりに`REQUIRE_EULA_AGREEMENT`メッセージを`Manager`に返します。`payload`には`eula.txt`の現在の内容が含まれます。
4.  **モーダル表示:** `Manager`のUIは、このメッセージを受けてEULA同意モーダルをユーザーに提示します。
5.  **同意/拒否 (Manager → Agent):** ユーザーが「同意する」をクリックすると、`Manager`は`ACCEPT_EULA`メッセージを`Agent`に送信します。
6.  **EULA更新と再起動:** `Agent`は`eula.txt`を`eula=true`に更新し、再度`startServer`処理を試行します。成功すれば、通常の`OPERATION_RESULT`を返してフローを完了します。