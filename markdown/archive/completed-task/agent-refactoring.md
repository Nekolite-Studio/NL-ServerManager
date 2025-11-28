# Agent Refactoring Report

## 概要
`agent/index.js` の肥大化を解消するため、WebSocketサーバーのロジックとメッセージハンドラを分割・リファクタリングしました。

## 変更内容

### 1. ディレクトリ構造の変更
`agent/src/websocket/` ディレクトリを作成し、以下のファイルを配置しました。

*   `server.js`: WebSocketサーバーの初期化、接続管理、ルーティングロジック
*   `handlers/`: 各機能ごとのメッセージハンドラ
    *   `systemHandler.js`: システム情報、メトリクス取得
    *   `serverListHandler.js`: サーバーリスト取得
    *   `serverControlHandler.js`: サーバー作成、更新、削除、起動/停止
    *   `metricsHandler.js`: メトリクスストリーム管理
    *   `javaHandler.js`: Javaインストール
    *   `eulaHandler.js`: EULA同意

### 2. エントリーポイントの簡素化
`agent/index.js` は以下の処理のみを行うシンプルな構成に変更しました。

1.  設定の初期化
2.  サーバーデータのロード
3.  WebSocketサーバーの起動 (`initializeWebSocketServer` 呼び出し)

### 3. コードの移動と整理
*   `agent/index.js` にあった巨大な `switch` 文を各ハンドラファイルに分割しました。
*   `broadcast`, `sendResponse`, `sendProgress` などのヘルパー関数を `agent/src/websocket/server.js` に移動し、各ハンドラから利用できるようにしました。
*   物理サーバーのメトリクス収集ロジックを `metricsHandler.js` に移動しました。

## 影響範囲
*   Agentの起動プロセスとWebSocket通信処理全般。
*   Manager側への影響はありません（プロトコルやメッセージ形式は変更していません）。

## 今後の課題
*   各ハンドラの単体テストの追加
*   エラーハンドリングの統一化（現在は各ハンドラで個別に実装されている部分がある）