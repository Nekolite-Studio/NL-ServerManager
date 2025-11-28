# UI Migration Plan: Unified Dashboard (v6)

**目的:**
ManagerのUIをモックアップ (`mockups/server-manage-ui/2.html`) ベースの新しいデザイン（v6）に完全移行する。サイドバーを廃止し、物理/ゲームサーバーの統合管理、5つのレイアウト切り替え、ダークモード対応を実現する。
特に、保守性を高めるために `index.html` をスケルトン化し、各ビューのHTMLはJavaScript側で動的に生成・注入するアーキテクチャを採用する。

**前提条件:**
- 既存のバックエンド機能（IPC, WebSocket, Agent通信）は変更しない。
- 既存のドメインロジック（サーバー起動/停止、作成など）はそのまま利用する。
- 作業はAIエージェントによって自律的に行われる。

---

## Phase 1: 現状分析とデータ構造の整備

新UIは「物理サーバー（Agent）」の下に「ゲームサーバー」がぶら下がる階層構造を前提としているため、データの持ち方と提供方法を整備する。

### 1.1. データアクセサの拡張
- [ ] **ファイル:** `manager/renderer-state.js`
- [ ] **タスク:** `getters` オブジェクトを拡張し、新UIの描画に必要な「階層化されたデータ構造」を返す関数 `getUnifiedServerList()` を実装する。
    - `state.physicalServers` (Map) と `state.agentServers` (Map) を結合する。
    - 返り値のイメージ: `[{ agentInfo, gameServers: [...] }, ...]`
    - これにより、UI側でのデータ結合ロジックを排除する。

### 1.2. UI状態管理の更新
- [ ] **ファイル:** `manager/renderer-state.js`
- [ ] **タスク:** `state` オブジェクトに以下のプロパティを追加・変更する。
    - `layoutMode`: `'accordion' | 'kanban' | 'treegrid' | 'sidebar' | 'tabs'` (デフォルト: `'accordion'`)
    - `theme`: `'dark' | 'light'` (localStorageと同期)
    - 旧 `currentView` の扱いを検討（詳細画面表示中かどうかのフラグとして残すか、ルーター的に扱うか決定する）。

---

## Phase 2: ビュー実装 (コンポーネント化とindex.htmlの分割)

巨大な `renderer-ui.js` と `index.html` を防ぐため、レイアウトごとにファイルを分割し、HTMLはJS内のテンプレートリテラルとして管理する。

### 2.1. ディレクトリ作成
- [ ] `manager/src/ui/layouts/` ディレクトリを作成する。

### 2.2. レイアウト描画関数の実装 (HTML移設)
モックアップ `2.html` の各レンダリング関数とHTML構造を、実データ (`state` / `getters`) を使用するように書き換えて各ファイルに移植する。

- [ ] **`manager/src/ui/layouts/accordionLayout.js`**: アコーディオンリストの実装。
- [ ] **`manager/src/ui/layouts/kanbanLayout.js`**: カンバンボードの実装。
- [ ] **`manager/src/ui/layouts/treeGridLayout.js`**: ツリーグリッドの実装。
- [ ] **`manager/src/ui/layouts/sidebarLayout.js`**: フィルタ付きリストの実装。
- [ ] **`manager/src/ui/layouts/tabsLayout.js`**: タブ切り替えビューの実装。
- [ ] **共通事項:**
    - 各関数は `container` 要素を受け取り、`container.innerHTML` にテンプレートリテラルでHTMLを注入する。
    - `onclick` 属性ではなく、`data-action` 属性と `data-id` を付与してイベント委譲に備える。
    - ステータスに応じたクラス（色）適用ロジックは `manager/src/ui/utils.js` を再利用/拡張する。

### 2.3. index.html のスケルトン化
- [ ] **ファイル:** `manager/index.html`
- [ ] **タスク:** 既存の `<body>` 内のコンテンツを削除し、最小限のコンテナのみを残す（目標100行以内）。
    - 残す要素:
        - `<head>` (CSS読み込み等は維持)
        - `<div id="app-container"></div>` (メインコンテンツ用)
        - `<div id="modal-container"></div>` (モーダル用)
        - `<script type="module">` (エントリーポイント読み込み)
    - 既存のモーダル（`create-server-modal` 等）のHTMLも、可能であれば `src/ui/components/` 以下のJSファイルに移設し、動的に生成するように変更する。

### 2.4. 設定モーダルの実装
- [ ] **ファイル:** `manager/src/ui/components/settingsModal.js` (新規作成)
- [ ] **タスク:** レイアウト切り替えとテーマ切り替えを行う設定モーダルをクラスとして実装する。
    - `ServerCreateModal` と同様の設計パターンを採用する。

---

## Phase 3: ロジックの統合 (Wiring)

新UIのDOMイベントを既存のロジックに結びつける。

### 3.1. レンダラーUIの統合
- [ ] **ファイル:** `manager/renderer-ui.js`
- [ ] **タスク:** `updateView()` 関数を全面的に書き換える。
    - `state.layoutMode` に基づいて、Phase 2.2 で作成した適切なレイアウト関数を呼び出す。
    - ダークモードのクラス適用ロジックを統合する。
    - `index.html` が空になるため、ヘッダー等の共通部分もここで描画するか、共通レイアウト関数を作成して呼び出す。

### 3.2. イベントハンドラの再設定
- [ ] **ファイル:** `manager/src/dom/eventHandlers.js`
- [ ] **タスク:** 廃止されたサイドバー関連のイベントリスナーを削除する。
- [ ] **タスク:** 新UIの各アクションに対するイベントリスナーを追加/修正する。
    - **レイアウト切り替え:** 設定モーダルからの変更を受け付ける。
    - **サーバー詳細:** 新しいリストアイテムクリック (`.server-card` 等) で `state.selectedServerId` を更新し、詳細ビューを表示する。
    - **物理サーバー詳細:** Agentカード/行のクリックで `state.selectedPhysicalServerId` を更新し、詳細ビューを表示する。
    - **起動/停止:** 新UI上のボタン（KanbanやTreeGridにある）から `proxyToAgent` を呼ぶ。
    - **Agent追加:** 新UIの「Connect New Agent」ボタン等に対応させる。

---

## Phase 4: 既存機能の完全動作確認と調整

移行したUIで、既存機能が正しく動作するか検証し、修正する。

### 4.1. 詳細画面の表示制御
- [ ] **課題:** 新UIは「一覧」がベースであり、詳細画面はオーバーレイまたは全画面切り替えとなる。
- [ ] **タスク:** `renderer-ui.js` に、詳細画面（`serverDetailView.js`, `physicalServerDetailView.js`）を表示する際のコンテナ切り替えロジックを実装する。

### 4.2. サーバー作成モーダル
- [ ] **タスク:** ヘッダーの「Create」ボタン等が `window.serverCreateModal.open()` を正しく呼び出せるようにする。

### 4.3. リアルタイム更新の確認
- [ ] **タスク:** WebSocket (`server-update`, `metrics-data`) 受信時に、新UI（KanbanのプログレスバーやTreeGridのステータス）が再描画なし、または部分更新で反映されるか確認。
    - 必要であれば、各レイアウトファイルに `updateServerStatus(serverId, status)` のような部分更新用関数を追加する。

---

## Phase 5: クリーンアップ

### 5.1. 不要コードの削除
- [ ] 旧サイドバー関連のCSS/JSコードを削除。
- [ ] 使われなくなったDOM IDへの参照を削除。

### 5.2. デザイン調整
- [ ] Tailwindの設定 (`tailwind.config`) を `index.html` から抽出し、ビルドプロセスまたは共通設定ファイルに統合することを検討。
- [ ] スクロールバーやアニメーションの微調整。

---

## AIエージェント用 ToDo リスト

このリストを上から順に実行してください。

- [ ] **Task 1: データ構造の準備** (`renderer-state.js` に `getUnifiedServerList` と `layoutMode` を追加)
- [ ] **Task 2: レイアウトファイルの作成** (`src/ui/layouts/` に5つのJSファイルを作成し、モックアップのHTML生成ロジックを移植)
- [ ] **Task 3: index.htmlのスケルトン化** (`index.html` からHTMLコンテンツを削除し、JSからの注入用コンテナのみにする)
- [ ] **Task 4: 設定モーダルの実装** (`src/ui/components/settingsModal.js` の作成と `renderer.js` への組み込み)
- [ ] **Task 5: レンダリングロジックの結合** (`renderer-ui.js` の `updateView` を新レイアウト対応に変更し、ヘッダーや共通部分の描画ロジックを追加)
- [ ] **Task 6: イベントハンドラの修正** (`eventHandlers.js` で新UIのクリックイベントを既存ロジックにマッピング)
- [ ] **Task 7: 詳細画面の表示ロジック修正** (一覧⇔詳細の切り替えが正しく動くように `renderer-ui.js` を調整)
- [ ] **Task 8: 動作確認とバグ修正** (起動/停止、リアルタイム更新、モーダル開閉の確認)