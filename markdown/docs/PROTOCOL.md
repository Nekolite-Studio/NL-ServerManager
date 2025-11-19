# 通信プロトコル仕様

このドキュメントは、`manager`と`agent`間でやり取りされるWebSocketメッセージの仕様を定義します。プロトコルの定義は`@nl-server-manager/common`パッケージの[`protocol.js`](common/protocol.js:1)に集約されており、すべてのメッセージタイプはESMの`Message`オブジェクト定数として管理されます。

## 1. 基本的なメッセージ構造

送受信される全てのメッセージは、以下の基本構造を持つJSONオブジェクトです。

```json
{
  "type": "MESSAGE_TYPE_CONSTANT",
  "requestId": "unique-id-for-request",
  "payload": { /* ... typeに依存するデータ ... */ },
  "operation": "ORIGINAL_OPERATION_TYPE",
  "success": true,
  "error": { "message": "エラーメッセージ", "details": "詳細情報" }
}
```

-   **`type` (必須):** メッセージの種類を識別する文字列。[`common/protocol.js`](common/protocol.js:6)の`Message`オブジェクトに定義されている定数を使用します。
-   **`requestId` (任意):** `manager`が`agent`に操作を要求する際に生成する一意のID。`agent`からの応答にはこのIDが含まれ、`manager`はどの要求に対する応答なのかを特定できます。
-   **`payload` (任意):** 送信するデータ本体。内容は`type`に依存します。
-   **`operation` (任意):** `agent`が`OPERATION_RESULT`を返す際に、元の操作の`type`を格納します。
-   **`success` (任意):** `OPERATION_RESULT`メッセージで使用され、操作の成否をブール値で示します。
-   **`error` (任意):** `OPERATION_RESULT`メッセージで`success: false`の場合に、エラーの詳細情報を含むオブジェクト。
    -   `message` (string): ユーザーに表示する簡潔なエラーメッセージ。
    -   `details` (string, 任意): 開発者向けのより詳細なエラー情報。

## 2. 通信パターン

通信は、大きく3つのパターンに分類できます。

1.  **Request/Response:** `manager`がある操作を要求し、`agent`がその結果を一度だけ返します。（例: `Message.CREATE_SERVER`）
2.  **進捗更新 + Request/Response:** 時間のかかる操作に対し、`agent`が複数回にわたり進捗を通知し、最後に最終結果を返します。（例: `Message.INSTALL_JAVA`）
3.  **Push通知:** `agent`側で状態変化が起きた際に、`manager`からの要求なしに自発的に情報を送信します。（例: `Message.SERVER_UPDATE`）

## 2.5. サーバー状態 (ServerStatus)

サーバーのライフサイクル状態は、以下の文字列で表現されます。この定義は `@nl-server-manager/common` パッケージの `protocol.js` の `ServerStatus` オブジェクトに集約されています。

| ステータス   | 説明                                               |
| :----------- | :------------------------------------------------- |
| `stopped`    | サーバーは完全に停止しています。                   |
| `starting`   | サーバーの起動処理が進行中です。                   |
| `running`    | サーバーは起動済みで、プレイヤーが接続可能です。   |
| `stopping`   | サーバーの停止処理が進行中です。                   |

## 3. メッセージ一覧

### 3.1. Manager -> Agent

| メッセージタイプ | 目的 | `payload` の内容 | 応答/関連メッセージ |
| :--- | :--- | :--- | :--- |
| `Message.GET_SYSTEM_INFO` | Agentが動作しているマシンの基本情報（OS, アーキテクチャ）を要求する。 | なし | `Message.SYSTEM_INFO_RESPONSE` |
| `Message.GET_ALL_SERVERS` | Agentが管理する全てのサーバーのリストを要求する。 | なし | `Message.SERVER_LIST_UPDATE` |
| `Message.GET_METRICS` | Agentが動作しているマシンの現在のメトリクス（CPU/RAM使用率など）を要求する。 | なし | `Message.METRICS_DATA` |
| `Message.START_METRICS_STREAM` | 指定されたターゲット（ゲーム/物理サーバー）のメトリクスストリーミングを開始する。 | `{ "streamId": string, "targetType": "gameServer" \| "physicalServer", "targetId": string }` | `Message.GAME_SERVER_METRICS_UPDATE`, `Message.PHYSICAL_SERVER_METRICS_UPDATE` |
| `Message.STOP_METRICS_STREAM` | 指定されたメトリクスストリーミングを停止する。 | `{ "streamId": string, "targetType": "gameServer" \| "physicalServer", "targetId": string }` | なし |
| `Message.CREATE_SERVER` | 新規Minecraftサーバーの作成を要求する。 | `{ "versionId": string, "serverName"?: string, "runtime"?: object }` | `Message.PROGRESS_UPDATE`, `Message.OPERATION_RESULT` |
| `Message.UPDATE_SERVER` | 既存サーバーの設定（名前、起動構成など）を更新する。 | `{ "serverId": string, "config": object }` | `Message.OPERATION_RESULT` |
| `Message.UPDATE_SERVER_PROPERTIES` | 既存サーバーの`server.properties`の内容を更新する。 | `{ "serverId": string, "properties": object }` | `Message.OPERATION_RESULT` |
| `Message.DELETE_SERVER` | 既存サーバーを削除する。 | `{ "serverId": string }` | `Message.OPERATION_RESULT` |
| `Message.CONTROL_SERVER` | サーバーの起動または停止を要求する。 | `{ "serverId": string, "action": "start" \| "stop" }` | `Message.OPERATION_RESULT`, `Message.SERVER_UPDATE`, `Message.REQUIRE_EULA_AGREEMENT` |
| `Message.INSTALL_JAVA` | 指定バージョンのJava実行環境のインストールを要求する。 | `{ "version": string, "downloadUrl": string }` | `Message.PROGRESS_UPDATE`, `Message.OPERATION_RESULT` |
| `Message.ACCEPT_EULA` | ユーザーがEULAに同意したことを通知する。 | `{ "serverId": string }` | `Message.OPERATION_RESULT` |

### 3.2. Agent -> Manager

| メッセージタイプ | 目的 | `payload` の内容 | 関連メッセージ |
| :--- | :--- | :--- | :--- |
| `Message.SYSTEM_INFO_RESPONSE` | `Message.GET_SYSTEM_INFO`に対する応答。 | `{ "os": string, "arch": string, "totalRam": string, "cpu": string }` | `Message.GET_SYSTEM_INFO` |
| `Message.SERVER_LIST_UPDATE` | Agentが管理する全サーバーのリストを通知する。Agent接続時やサーバーの増減時に送信される。 | `Array<{ server_id: string, server_name: string, status: ServerStatus, ... }>` | `Message.GET_ALL_SERVERS` |
| `Message.SERVER_UPDATE` | 個別のサーバーの非同期な状態変化（ステータス変更、ログ追加など）をリアルタイムで通知する。 | `{ "serverId": string, "type": "status_change" \| "log", "payload": string \| ServerStatus }` | `Message.CONTROL_SERVER` |
| `Message.METRICS_DATA` | `Message.GET_METRICS`に対する応答。現在のマシンメトリクスを通知する。 | `{ "cpuUsage": string, "ramUsage": string, "diskUsage": string, "networkSpeed": string, "gameServers": { running: number, stopped: number, totalPlayers: number } }` | `Message.GET_METRICS` |
| `Message.GAME_SERVER_METRICS_UPDATE` | ゲームサーバーのメトリクスをリアルタイムで通知する（ストリーム）。 | `{ "serverId": string, "cpu": number, "memory": number, "memoryMax": number, "tps": number, "players": { current: number, max: number, list: string[] } }` | `Message.START_METRICS_STREAM` |
| `Message.PHYSICAL_SERVER_METRICS_UPDATE` | 物理サーバーのメトリクスをリアルタイムで通知する（ストリーム）。 | `{ "cpuUsage": string, "ramUsage": string, "diskUsage": string }` | `Message.START_METRICS_STREAM` |
| `Message.OPERATION_RESULT` | `manager`からの要求に対する最終的な処理結果（成功/失敗）を通知する。 | 操作が成功した場合は関連データ、失敗した場合はエラー詳細。 | `Message.CREATE_SERVER`, `Message.UPDATE_SERVER`, etc. |
| `Message.PROGRESS_UPDATE` | 時間のかかる操作の進捗状況を通知する。 | `{ "status": "downloading" \| "extracting", "message": string, "progress": number }` | `Message.CREATE_SERVER`, `Message.INSTALL_JAVA` |
| `Message.NOTIFY_WARN` | UIに警告メッセージを通知する。 | `{ "serverId": string, "message": string }` | `Message.CONTROL_SERVER` (例: Javaフォールバック時) |
| `Message.REQUIRE_EULA_AGREEMENT` | EULAへの同意が必要であることを通知する。 | `{ "serverId": string, "eulaContent": string }` | `Message.CONTROL_SERVER` |