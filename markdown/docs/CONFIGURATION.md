# 設定ファイルリファレンス

このドキュメントは、`manager`と`agent`が使用する設定ファイルについて詳述します。

## 1. Manager の設定

`manager`の設定は、`electron-store`ライブラリによって単一のJSONファイルに集約され、OS標準のユーザーデータディレクトリに保存されます。

-   **場所 (例):**
    -   Linux: `~/.config/ServerManager/config.json`
    -   Windows: `C:\Users\<user>\AppData\Roaming\ServerManager\config.json`
-   **管理モジュール:** [`manager/src/storeManager.js`](manager/src/storeManager.js:1)

### `config.json` の内容

```json
{
    "agents": [
        {
            "id": "a1b2c3d4-...",
            "ip": "192.168.1.10",
            "port": 8080,
            "alias": "リビングPC"
        }
    ],
    "windowBounds": {
        "width": 1280,
        "height": 768,
        "x": 100,
        "y": 100
    }
}
```

-   **`agents` (Array):**
    -   **目的:** `manager`に登録されている全`agent`の接続情報を保持します。
    -   **`id`:** `uuidv4`で生成される`agent`の一意な識別子。
    -   **`ip`:** `agent`のIPアドレス。
    -   **`port`:** `agent`が待ち受けているポート番号。
    -   **`alias`:** UI上に表示される`agent`の分かりやすい別名。
-   **`windowBounds` (Object):**
    -   **目的:** アプリケーション終了時のウィンドウサイズと位置を保存し、次回起動時に復元します。
    -   `x`, `y` はオプションで、指定しない場合はOSが適切な位置を決定します。

> **NOTE:**
> このファイルは`electron-store`によって管理されているため、手動で編集することは推奨されません。
> [`manager/src/storeManager.js`](manager/src/storeManager.js:1)で定義された**スキーマに従って厳密に管理**されており、設定ファイルが破損した場合でも、`manager`は自動で破損ファイルをバックアップし、ユーザーに新しい設定で起動するか、アプリケーションを終了するかを選択させる**堅牢なフェイルセーフ機構**を備えています。

## 2. Agent の設定

`agent`は、自身の動作設定と、管理対象の各Minecraftサーバーの設定という2種類の設定ファイルを管理します。

### 2.1. Agent自体の設定

-   **場所:** `~/.nekolite/server-manager/mc/agent/settings.json`
-   **管理モジュール:** [`agent/src/settingsManager.js`](agent/src/settingsManager.js:1)

#### `settings.json` の内容

```json
{
    "schema_version": "1.0.0",
    "servers_directory": "~/.nekolite/server-manager/mc/agent/servers",
    "api": {
        "port": 8080
    },
    "log_level": "info"
}
```

-   **`schema_version` (string):** 設定ファイルのスキーマバージョン。将来的なマイグレーションのために使用されます。
-   **`servers_directory` (string):**
    -   **目的:** 管理対象のMinecraftサーバー群が格納される親ディレクトリのパス。チルダ (`~`) はホームディレクトリとして解釈されます。
-   **`api.port` (number):**
    -   **目的:** `manager`からのWebSocket接続を待ち受けるポート番号。
-   **`log_level` (string):**
    -   **目的:** Agentのログ出力レベル (`info`, `warn`, `error`, `debug`など)。

> **NOTE:**
> このファイルは`agent`の初回起動時にデフォルト値で自動生成されます。

### 2.2. 各Minecraftサーバーの設定

-   **場所:** 上記`servers_directory`で指定されたパス配下の、各サーバーIDを名前とするディレクトリ内。
    -   例: `~/.nekolite/server-manager/mc/agent/servers/<server-id>/nl-server_manager.json`
-   **管理モジュール:** [`agent/src/serverManager.js`](agent/src/serverManager.js:1)

#### `nl-server_manager.json` の内容

```json
{
    "schema_version": "1.0.0",
    "server_id": "f5g6h7i8-...",
    "server_name": "My Creative Server",
    "server_type": "vanilla",
    "loader_version": null,
    "runtime": {
        "java_path": null,
        "java_version": "17",
        "min_memory": 1024,
        "max_memory": 2048,
        "custom_args": "-XX:+UseG1GC",
        "server_jar": "server.jar"
    },
    "status": "stopped",
    "logs": [],
    "auto_start": false,
    "properties": {
        "gamemode": "survival",
        "pve": true
    }
}
```

-   **`schema_version` (string):** 設定ファイルのスキーマバージョン。
-   **`server_id` (string):** サーバーの一意な識別子。ディレクトリ名と一致します。
-   **`server_name` (string):** `manager`のUI上に表示されるサーバー名。
-   **`server_type` (string):** サーバーの種類。`vanilla`, `forge`, `fabric`, `quilt`, `neoforge`, `paper`, `mohist` のいずれか。
-   **`loader_version` (string | null):** Modローダーのバージョン（Modサーバーの場合）。
-   **`runtime` (Object):** サーバーの実行環境を定義します。
    -   **`java_path` (string | null):** Java実行ファイルの絶対パス。`'default'`または`null`の場合、`java_version`に基づいて自動検出されるか、システムのデフォルト`java`が使用されます。
    -   **`java_version` (string | null):** このサーバーが使用すべきJavaのメジャーバージョン。`manager`のUIからインストールしたJavaのバージョンがここに設定されます。**Agent側では常に文字列として扱われます。**
    -   **`min_memory` (number | null):** サーバーの最小メモリ割り当て（MB）。
    -   **`max_memory` (number | null):** サーバーの最大メモリ割り当て（MB）。
    - **`custom_args` (string | null):** サーバー起動時に追加で渡される、スペース区切りのカスタムJVM引数。
    - **`server_jar` (string):** 起動するサーバーJARファイルの名前。
        - Vanilla: `server.jar`
        - Fabric: `fabric-server-launch.jar`
        - Quilt: `quilt-server-launch.jar`
        - Forge/NeoForge: `server.jar` (ただし、実際の起動には `unix_args.txt` 等が使用されるため、この値は参照されない場合がある)
- **`status` (string):** サーバーの現在の状態。`stopped`, `starting`, `running`, `stopping` のいずれか。**注意:** この値はディスクに保存されますが、Agent起動時には[`serverManager.js`](agent/src/serverManager.js:1)が実際のプロセス存在状況をスキャンし、メモリ上のステータスを上書きします。そのため、ディスク上のこの値はAgentの起動直後には信頼されません。
-   **`logs` (Array<string>):** サーバーの過去のログエントリ（限定的な履歴）。
-   **`auto_start` (boolean):** `agent`起動時にこのサーバーを自動で起動するかどうか。（将来的な機能）
-   **`properties` (Object):** `server.properties`のミラー。`agent`はこのオブジェクトを信頼できる情報源として`server.properties`ファイルに書き込みます。このオブジェクトのスキーマは[`@nl-server-manager/common/property-schema.js`](common/property-schema.js:1)で定義されており、`manager`は`UPDATE_SERVER_PROPERTIES`メッセージを通じてこのファイルを編集できます。

> **NOTE:**
> このファイルとは別に、Minecraftサーバー固有の設定ファイルである `server.properties` も同じディレクトリに格納されます。