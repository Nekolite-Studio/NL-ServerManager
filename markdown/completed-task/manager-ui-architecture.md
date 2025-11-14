# Manager UIアーキテクチャ: 3ファイルによる役割分離モデル

## 概要

ManagerのUIは、[`renderer-state.js`](manager/renderer-state.js)、[`renderer-ui.js`](manager/renderer-ui.js)、[`renderer.js`](manager/renderer.js) の3つのJavaScriptファイルに分割されています。このアーキテクチャは、「関心の分離」の原則に基づいています。それぞれのファイルが明確な役割を持つことで、コードの可読性と保守性を高め、将来的な機能追加や変更を容易にすることを目的としています。

## 各ファイルの役割

### `renderer-state.js`

アプリケーションのUIに関する「状態（[`state`](manager/renderer-state.js)）」を一元的に管理します。このファイルは、UIがどのように表示されるべきかを決定するためのすべてのデータを含んでいます。

- **主な役割:**
  - [`state.currentView`](manager/renderer-state.js): 現在表示されているビュー（例: `'list'`, `'detail'`, `'settings'`）を保持します。
  - [`state.selectedServerId`](manager/renderer-state.js): ユーザーが選択したサーバーの一意なIDを保持します。
  - その他、UIの表示に必要なあらゆる状態（ソート順、フィルター条件など）。

状態を一箇所に集約することで、アプリケーションのデータフローが予測可能になり、デバッグが容易になります。

### `renderer-ui.js`

[`renderer-state.js`](manager/renderer-state.js) で管理されている [`state`](manager/renderer-state.js) オブジェクトを受け取り、それに基づいて動的なHTMLを生成し、DOMに描画する役割を担います。UIの「見た目」に関するロジックがすべてここに集約されています。

- **主な役割:**
  - `state` オブジェクトを引数として受け取る純粋な描画関数を提供します。
  - [`renderServerList()`](manager/renderer-ui.js): サーバーの一覧ビューを生成します。
  - [`renderServerDetail()`](manager/renderer-ui.js): 特定のサーバーの詳細ビューを生成します。
  - 状態が変更されるたびに、これらの関数が呼び出され、UIが再描画されます。

### `renderer.js`

ユーザーからのインタラクション（クリック、入力など）を監視し、それに応じて処理を実行するイベントハンドリングの中心です。このファイルがUIの「振る舞い」を定義します。

- **主な役割:**
  - DOM要素にイベントリスナー（例: `click`, `submit`）を設定します。
  - イベントが発生した際に、[`renderer-state.js`](manager/renderer-state.js) の状態を更新します。
  - 必要に応じて、[`electronAPI`](manager/preload.js) を通じてMainプロセスに非同期処理（ファイルの読み書き、サーバープロセスの操作など）を要求します。
  - 状態変更後に、[`renderer-ui.js`](manager/renderer-ui.js) の描画関数を呼び出してUIを更新します。

## 連携フローの例: サーバー詳細画面の表示

ユーザーがサーバー一覧画面で特定のサーバーをクリックしてから、その詳細画面が表示されるまでの流れは、以下のようになります。

1.  **イベント検知 (`renderer.js`)**:
    [`renderer.js`](manager/renderer.js) に設定されたイベントリスナーが、サーバー一覧内の特定項目に対するクリックイベントを検知します。

2.  **状態更新 (`renderer.js`)**:
    イベントハンドラ関数内で、[`renderer.js`](manager/renderer.js) は [`renderer-state.js`](manager/renderer-state.js) が管理する [`state`](manager/renderer-state.js) オブジェクトを更新します。
    - [`state.currentView`](manager/renderer-state.js) を `'list'` から `'detail'` に変更します。
    - [`state.selectedServerId`](manager/renderer-state.js) を、クリックされたサーバーのIDに設定します。

3.  **UI更新要求 (`renderer.js`)**:
    [`renderer.js`](manager/renderer.js) は、UIを再描画するために [`updateView()`](manager/renderer.js) のような関数を呼び出します。

4.  **描画関数の呼び出し (`updateView`)**:
    [`updateView()`](manager/renderer.js) 関数は、現在の [`state.currentView`](manager/renderer-state.js) の値（この場合は `'detail'`）に基づいて、[`renderer-ui.js`](manager/renderer-ui.js) 内の適切な描画関数（[`renderServerDetail()`](manager/renderer-ui.js)）を呼び出します。

5.  **HTML生成と描画 (`renderer-ui.js`)**:
    [`renderServerDetail()`](manager/renderer-ui.js) 関数は、更新された [`state`](manager/renderer-state.js)（特に [`state.selectedServerId`](manager/renderer-state.js)）を元に、サーバー詳細画面のHTMLを文字列として生成し、メインコンテンツ領域のDOMをそのHTMLで置き換えます。

このように、3つのファイルがそれぞれの役割に徹し、明確なデータフロー（`イベント` -> `状態更新` -> `UI再描画`）に従って連携することで、クリーンでメンテナンスしやすいUIが実現されています。