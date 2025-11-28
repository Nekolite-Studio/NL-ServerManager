## 計画: 設定永続化の実装

### 1. Manager (Electron GUI) 側の設定管理

**目標:** `electron-store` を使用し、AgentリストとUI設定（ダークテーマ等）を `settings.json` に一元化します。

1.  **依存関係の追加:**
    * `manager` ワークスペースに `electron-store` パッケージを追加します。
2.  **メインプロセス (`main.js`) の修正:**
    * `electron-store` をインポートし、インスタンス化します。
    * 起動時に、`electron-store` から保存されている **Agentのリスト**を読み込みます。
    * ハードコードされている `createAgent` の呼び出し を削除し、読み込んだリストに基づいて各Agentへの接続 (`connectToAgent`) を開始するように変更します。
    * Agentの追加・編集・削除を行うIPCハンドラ (`add-agent`, `update-agent-settings`, `delete-agent`) を修正し、変更内容を `electron-store` に保存する処理を追加します。
3.  **UI設定の移行 (`localStorage` 廃止):**
    * `renderer.js` にある `localStorage` を使用したダークテーマ設定の読み書き処理 を削除します。
    * `preload.js` と `main.js` に、UI設定（ダークテーマなど）を読み書きするための新しいIPC通信（例: `getSetting`, `setSetting`）を追加します。
    * `renderer.js` は、起動時と設定変更時に、この新しいIPC通信を使って `electron-store` と設定をやり取りするように変更します。

---

### 2. Agent (Node.js CLI) 側の設定管理

**目標:** `agent` が管理するゲームサーバーの構成を、指定されたディレクトリ内の `nl-server_manager.json` ファイルで管理します。

1.  **依存関係の追加:**
    * `agent` ワークスペースに、ファイルの読み書きやディレクトリ操作を容易にするためのパッケージ（例: `fs-extra`）を追加します。
2.  **設定管理ロジックの実装:**
    * `agent` の設定（ゲームサーバーのベースディレクトリパスなど）を管理する仕組みを導入します。
    * 指定されたID（例: `100`）に基づき、対応するディレクトリ（例: `<ベースディレクトリ>/100/`）内に `nl-server_manager.json` を読み書きする関数を作成します。
3.  **`agent/index.js` の修正:**
    * 起動時に、ゲームサーバーのベースディレクトリをスキャンし、存在するすべての `nl-server_manager.json` を読み込んで、管理対象サーバーのリストをメモリにロードします。
    * ダミーデータを返しているWebSocketの応答ロジック を、実際にロードしたサーバーリストや設定情報（`WS_role.md` にある静的情報など）を返すように修正します。
    * `manager` からの新しいWebSocketメッセージ（例: `createServer`, `updateServerConfig`, `scanServers`）を定義し、それに応じてディレクトリやJSONファイルの作成・更新・スキャンを行う処理を追加します。
    * OS間の差異（例: 起動スクリプトの実行方法）は、この `agent` 側で吸収するように実装します。