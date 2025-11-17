# 開発ガイド

このドキュメントは、Server Managerプロジェクトの開発環境をセットアップし、開発に参加するための手順を説明します。

## 1. 概要

本プロジェクトは、以下の2つの独立したNode.jsプロジェクトから構成されるモノレポです。

-   **`manager/`**: GUIクライアント (Electron)
-   **`agent/`**: サーバー管理エージェント (Node.js)

開発を行うには、両方のプロジェクトを個別にセットアップし、同時に実行する必要があります。

## 2. 前提条件

-   [Node.js](https://nodejs.org/) (v18.x 以上を推奨)
-   [npm](https://www.npmjs.com/) (Node.jsに同梱)

## 3. 環境構築

### ステップ1: リポジトリのクローン

```bash
git clone <repository-url>
cd NL-ServerManager
```

### ステップ2: Manager の依存関係をインストール

`manager`ディレクトリに移動し、npmパッケージをインストールします。

```bash
cd manager
npm install
```

### ステップ3: Agent の依存関係をインストール

プロジェクトのルートに戻り、`agent`ディレクトリに移動して、同様にnpmパッケージをインストールします。

```bash
cd ../agent
npm install
```

## 4. 開発環境の実行

開発中は、`agent`と`manager`の両方を同時に実行する必要があります。それぞれ別のターミナルセッションで起動してください。

### ターミナル1: Agent の起動

`agent`は、`manager`からの接続を待ち受けるバックグラウンドプロセスです。

```bash
# /agent ディレクトリにいることを確認
cd agent

# Agentを起動
npm start
```

成功すると、コンソールに以下のようなログが表示されます。

```
[SettingsManager] Settings loaded successfully.
[ServerManager] Loaded 0 server(s).
Agent WebSocket server started on port 8080
```

### ターミナル2: Manager の起動

`manager`は、ホットリロードが有効な開発モードで起動します。これにより、コードの変更が即座にアプリケーションに反映されます。

```bash
# /manager ディレクトリにいることを確認
cd manager

# Managerを開発モードで起動
npm run dev
```

これにより、Electronアプリケーションウィンドウが起動します。起動後、`manager`は自動的にローカルホストの`agent`（デフォルト: `127.0.0.1:8080`）に接続を試みます。

## 5. コードの構造

開発を始めるにあたり、以下の主要なファイルを理解することが役立ちます。

-   **`common/protocol.js`**: `manager`と`agent`間の通信メッセージを定義する最も重要なファイル。
-   **`manager/`**:
    -   `main.js`: ElectronのMainプロセス。バックエンド処理と`agent`との通信を担当。
    -   `preload.js`: MainプロセスとRendererプロセスを安全に橋渡しするスクリプト。
    -   `renderer.js`: UIのイベントロジックを担当。
    -   `renderer-state.js`: UIの状態を一元管理。
    -   `renderer-ui.js`: 状態に基づいてUIを描画。
-   **`agent/`**:
    -   `index.js`: `manager`からの接続を待ち受けるWebSocketサーバー。
    -   `serverManager.js`: Minecraftサーバーの作成、起動、停止などのコアロジック。
    -   `settingsManager.js`: `agent`自体の設定を管理。

## 6. アプリケーションのビルド

`manager`を配布可能な形式（AppImage, deb, exeなど）にビルドするには、以下のコマンドを実行します。

```bash
# /manager ディレクトリにいることを確認
cd manager

# ビルドを実行
npm run build
```

ビルドされた成果物は、`manager/dist/`ディレクトリに出力されます。