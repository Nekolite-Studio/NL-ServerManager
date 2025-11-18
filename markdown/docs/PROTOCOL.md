# 通信プロトコル仕様

このドキュメントは、`manager`と`agent`間でやり取りされるWebSocketメッセージの仕様を定義します。プロトコルの定義は[`common/protocol.js`](../../../common/protocol.js)に集約されています。

## 1. 基本的なメッセージ構造

送受信される全てのメッセージは、以下の基本構造を持つJSONオブジェクトです。

```json
{
  "type": "message-type-string",
  "requestId": "unique-id-for-request",
  "payload": { "...": "..." },
  "operation": "original-operation-type",
  "success": true,
  "error": { "message": "...", "details": "..." }
}
```

-   **`type` (必須):** メッセージの種類を識別する文字列。
-   **`requestId` (任意):** `manager`が`agent`に操作を要求する際に生成する一意のID。`agent`からの応答にはこのIDが含まれ、`manager`はどの要求に対する応答なのかを特定できます。
-   **`payload` (任意):** 送信するデータ本体。内容は`type`に依存します。
-   **`operation` (任意):** `agent`が操作結果を返す際に、元の操作の`type`を格納します。
-   **`success` & `error` (任意):** `agent`が操作結果を返す際に、処理の成否とエラー情報を示します。

## 2. 通信パターン

通信は、大きく3つのパターンに分類できます。

1.  **Request/Response:** `manager`がある操作を要求し、`agent`がその結果を一度だけ返します。（例: `CREATE_SERVER`）
2.  **進捗更新 + Request/Response:** 時間のかかる操作に対し、`agent`が複数回にわたり進捗を通知し、最後に最終結果を返します。（例: `INSTALL_JAVA`）
3.  **Push通知:** `agent`側で状態変化が起きた際に、`manager`からの要求なしに自発的に情報を送信します。（例: `SERVER_UPDATE`）

## 2.5. サーバー状態 (ServerStatus)

サーバーのライフサイクル状態は、以下の文字列で表現されます。この定義は `common/protocol.js` の `ServerStatus` オブジェクトに集約されています。

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
| `GET_SYSTEM_INFO` | Agentが動作しているマシンの基本情報（OS, アーキテクチャ）を要求する。 | なし | `SYSTEM_INFO_RESPONSE` |
| `GET_ALL_SERVERS` | Agentが管理する全てのサーバーのリストを要求する。 | なし | `SERVER_LIST_UPDATE` |
| `GET_METRICS` | Agentが動作しているマシンの現在のメトリクス（CPU/RAM使用率など）を要求する。 | なし | `METRICS_DATA` |
| `START_METRICS_STREAM` | 指定されたターゲット（ゲーム/物理サーバー）のメトリクスストリーミングを開始する。 | `{ "streamId": "...", "targetType": "gameServer" \| "physicalServer", "targetId": "..." }` | `GAME_SERVER_METRICS_UPDATE`, `PHYSICAL_SERVER_METRICS_UPDATE` |
| `STOP_METRICS_STREAM` | 指定されたメトリクスストリーミングを停止する。 | `{ "streamId": "...", "targetType": "gameServer" \| "physicalServer", "targetId": "..." }` | |
| `CREATE_SERVER` | 新規Minecraftサーバーの作成を要求する。 | `{ "versionId": "1.18.2" }` | `PROGRESS_UPDATE`, `OPERATION_RESULT` |
| `UPDATE_SERVER` | 既存サーバーの設定（名前、起動構成など）を更新する。 | `{ "serverId": "...", "config": { "runtime": { "max_memory": 4096 } } }` | `OPERATION_RESULT` |
| `UPDATE_SERVER_PROPERTIES` | 既存サーバーの`server.properties`の内容を更新する。 | `{ "serverId": "...", "properties": { "pvp": false, "motd": "Hello" } }` | `OPERATION_RESULT` |
| `DELETE_SERVER` | 既存サーバーを削除する。 | `{ "serverId": "..." }` | `OPERATION_RESULT` |
| `CONTROL_SERVER` | サーバーの起動または停止を要求する。 | `{ "serverId": "...", "action": "start" \| "stop" }` | `OPERATION_RESULT`, `SERVER_UPDATE`, `REQUIRE_EULA_AGREEMENT` |
| `INSTALL_JAVA` | 指定バージョンのJava実行環境のインストールを要求する。 | `{ "version": "17", "downloadUrl": "..." }` | `PROGRESS_UPDATE`, `OPERATION_RESULT` |
| `ACCEPT_EULA` | ユーザーがEULAに同意したことを通知する。 | `{ "serverId": "..." }` | `OPERATION_RESULT` |

### 3.2. Agent -> Manager

| メッセージタイプ | 目的 | `payload` の内容 | 関連メッセージ |
| :--- | :--- | :--- | :--- |
| `SYSTEM_INFO_RESPONSE` | `GET_SYSTEM_INFO`に対する応答。 | `{ "os": "linux", "arch": "x64" }` | `GET_SYSTEM_INFO` |
| `SERVER_LIST_UPDATE` | Agentが管理する全サーバーのリストを通知する。Agent接続時やサーバーの増減時に送信される。 | `[ { server_id: "...", server_name: "...", ... }, ... ]` | `GET_ALL_SERVERS` |
| `SERVER_UPDATE` | 個別のサーバーの非同期な状態変化（ステータス変更、ログ追加など）をリアルタイムで通知する。 | `{ "serverId": "...", "type": "status_change" \| "log", "payload": "..." }`<br>`status_change` の場合、`payload` には `ServerStatus` のいずれかの値が入る。 | `CONTROL_SERVER` |
| `METRICS_DATA` | `GET_METRICS`に対する応答。現在のマシンメトリクスを通知する。 | `{ "cpuUsage": "15.5", "ramUsage": "45.2", ... }` | `GET_METRICS` |
| `GAME_SERVER_METRICS_UPDATE` | ゲームサーバーのメトリクスをリアルタイムで通知する（ストリーム）。 | `{ "serverId": "...", "cpu": 10.5, "memory": 2048, "tps": 20.0, ... }` | `START_METRICS_STREAM` |
| `PHYSICAL_SERVER_METRICS_UPDATE` | 物理サーバーのメトリクスをリアルタイムで通知する（ストリーム）。 | `{ "cpuUsage": "25.0", "ramUsage": "60.1", "diskUsage": "75.3" }` | `START_METRICS_STREAM` |
| `OPERATION_RESULT` | `manager`からの要求に対する最終的な処理結果（成功/失敗）を通知する。 | 操作が成功した場合は関連データ、失敗した場合はエラー詳細。 | `CREATE_SERVER`, `UPDATE_SERVER`, etc. |
| `PROGRESS_UPDATE` | 時間のかかる操作の進捗状況を通知する。 | `{ "status": "downloading" \| "extracting", "message": "...", "progress": 50 }` | `CREATE_SERVER`, `INSTALL_JAVA` |
| `REQUIRE_EULA_AGREEMENT` | EULAへの同意が必要であることを通知する。 | `{ "serverId": "...", "eulaContent": "..." }` | `CONTROL_SERVER` |