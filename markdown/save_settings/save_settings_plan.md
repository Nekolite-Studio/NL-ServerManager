# NekoLite Server Manager 設定永続化 実装計画書

## 1. 目的
本計画は、アプリケーション（NekoLite Server Manager）の設定データをファイルシステムに永続化するための実装方針を定義する。これにより、アプリケーション再起動後も設定が維持される堅牢なシステムを構築する。

## 2. 対象コンポーネント
*   **Agent:** ゲームサーバーを直接管理するバックエンドコンポーネント。
*   **Manager:** 複数のAgentを統括管理するElectron製GUIアプリケーション。

## 3. データ構造（JSONスキーマ）

### 3.1. Agent設定 (`~/.nekolite/server-manager/mc/agent/settings.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NekoLite Agent Settings",
  "type": "object",
  "properties": {
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "servers_directory": { "type": "string", "default": "~/.nekolite/server-manager/mc/agent/servers" },
    "api": {
      "type": "object",
      "properties": { "port": { "type": "integer", "default": 8080 } },
      "required": ["port"]
    },
    "log_level": { "type": "string", "enum": ["error", "warn", "info", "debug"], "default": "info" }
  },
  "required": ["schema_version", "servers_directory", "api", "log_level"]
}
```

### 3.2. ゲームサーバー設定 (`{servers_directory}/{server_id}/nl-server_manager.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NekoLite Game Server Settings",
  "type": "object",
  "properties": {
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "server_id": { "type": "string" },
    "server_name": { "type": "string" },
    "runtime": {
       "type": "object",
       "properties": {
          "java_path": { "type": ["string", "null"], "default": null },
          "jvm_args": { "type": "array", "items": { "type": "string" }, "default": [] },
          "server_jar": { "type": "string", "default": "server.jar" }
       },
       "required": ["jvm_args", "server_jar"]
    },
    "status": { "type": "string", "enum": ["running", "stopped", "starting", "stopping", "error"], "default": "stopped", "readOnly": true },
    "auto_start": { "type": "boolean", "default": false }
  },
  "required": ["schema_version", "server_id", "server_name", "runtime"]
}
```

## 4. モジュール設計

### 4.1. Agent側
*   `agent/src/utils/storage.js` (新規): ファイルI/Oとパス解決（チルダ展開）を担当。
*   `agent/src/settingsManager.js` (新規): `settings.json`の初期化、読み書きを管理。
*   `agent/src/serverManager.js` (新規): 全ゲームサーバー(`nl-server_manager.json`)の設定を統括管理。
*   `agent/index.js` (修正): 上記モジュールを呼び出し、永続化された設定に基づいて動作するよう修正。

### 4.2. Manager側
*   `manager/src/storeManager.js` (新規): `electron-store`をラップし、AgentリストやUI設定の永続化を担当。
*   `manager/main.js` (修正): `storeManager`を利用して、起動時に設定を復元し、設定変更時に永続化するよう修正。

## 5. 実装タスクと順序
開発はAgent側の基盤から着手し、その後Manager側の実装を進める。

```mermaid
graph TD
    subgraph Agent側実装
        A1[【Agent】ファイルI/Oユーティリティの作成<br>(storage.js)] --> A2;
        A2[【Agent】Agent設定管理モジュールの実装<br>(settingsManager.js)] --> A3;
        A3[【Agent】ゲームサーバー管理モジュールの実装<br>(serverManager.js)] --> A4;
        A4[【Agent】コアロジックの修正<br>(index.js)]
    end

    subgraph Manager側実装
        M1[【Manager】依存ライブラリの追加<br>(electron-store)] --> M2;
        M2[【Manager】設定管理モジュールの実装<br>(storeManager.js)] --> M3;
        M3[【Manager】メインプロセスの修正<br>(main.js)]
    end

    A4 --> M3;
```

## 6. 考慮事項
*   **初回起動:** 設定ファイルが存在しない場合、デフォルト値で自動生成する。
*   **エラーハンドリング:** ファイルI/OやJSONパースのエラーを`try...catch`で捕捉し、ログ出力を行う。
*   **データ移行:** `schema_version`キーを導入し、将来のスキーマ変更に対応する土台を構築する。
*   **パス解決:** `os.homedir()`を利用し、OS非依存でチルダパスを解決する。
*   **競合状態:** ファイルI/Oを同期的に行い、単純な更新における競合を回避する。

---

この計画にご満足いただけましたでしょうか？ 変更のご希望や、追加のご要望があればお申し付けください。
承認いただけましたら、開発フェーズに移行するため、実装を担当する`code`モードに切り替えることを提案します。