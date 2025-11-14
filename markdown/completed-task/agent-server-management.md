# Agent サーバー管理ロジック

## 概要

`serverManager.js`はAgentのコア機能の一部であり、ファイルシステムと直接やり取りしてゲームサーバーの永続化と管理を行う責務を持ちます。

## 主要な機能

### サーバーの作成 (`updateServer` - 新規作成時)

- 新しい一意のID（UUID）が生成されます。
- `servers_directory` 設定で指定されたパス配下に、そのIDを名前とする新しいディレクトリが作成されます。
- そのディレクトリ内に、サーバーの基本設定を記述した `nl-server_manager.json` ファイルが作成されます。

### サーバーの更新 (`updateServer` - 更新時)

- 既存のサーバーIDに対応する `nl-server_manager.json` ファイルの内容を、受け取った設定で上書きします。

### サーバーの削除 (`deleteServer`)

- 指定されたサーバーIDに対応するディレクトリ全体を、再帰的にファイルシステムから物理的に削除します。

### 全サーバーのロード (`loadAllServers`)

- Agent起動時に `servers_directory` をスキャンし、各サーバーディレクトリ内の `nl-server_manager.json` を読み込んで、管理下の全サーバーをメモリにロードします。