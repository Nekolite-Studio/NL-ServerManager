# UX改善実装計画書

このドキュメントは、ユーザーインターフェースの操作性向上のため、インタラクティブな要素にスタイルを追加・変更する実装計画を定義します。

## 1. 基本方針

- **ホバー効果**: クリック可能な要素には、背景色や文字色が変化するホバー効果を追加します。
- **トランジション**: スムーズな視覚的変化のため、`transition-colors` `duration-150`などを適用します。
- **アクティブ効果**: 選択中の要素は、`bg-primary/10`などで明確に示します。
- **無効状態**: 操作不可能な要素は、`opacity-50` `cursor-not-allowed`で非活性化します。
- **カーソル**: クリック可能な領域には`cursor-pointer`を適用します。

## 2. 実装計画

これから、各ファイルごとの詳細な変更計画をここに追記していきます。
### 2.1. 共通コンポーネント

#### a. `manager/renderer-ui.js` (アプリケーションヘッダー)

- **対象**: テーマ切替ボタン、設定ボタン
- **変更**: `transition-colors` を追加し、ホバー時の色の変化を滑らかにします。

**変更前:**
```html
<button data-action="toggle-theme" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white" title="Toggle Theme">
...
</button>
<button data-action="open-settings" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white" title="Settings">
...
</button>
```

**変更後:**
```html
<button data-action="toggle-theme" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors" title="Toggle Theme">
...
</button>
<button data-action="open-settings" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors" title="Settings">
...
</button>
```

---

#### b. `manager/src/ui/components/settingsModal.js`

- **対象**: レイアウト選択ラベル、Doneボタン
- **変更**: `transition-colors` を追加します。

**変更前:**
```html
<label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:bg-primary/10">
...
</label>
...
<button data-action="close-settings-modal" class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg shadow transition-colors">
    Done
</button>
```

**変更後:**
```html
<label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:bg-primary/10">
...
</label>
...
<button data-action="close-settings-modal" class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg shadow transition-colors">
    Done
</button>
```

---

#### c. `manager/src/ui/components/serverCreateModal.js`

- **対象**: モーダル内の各種ボタン、入力欄
- **変更**: ホバー効果とトランジションを追加して、インタラクティブ性を向上させます。

**変更箇所と内容:**
- **ホストマシン選択**: `hover:bg-gray-750 transition-colors` を追加。
- **サーバータイプ選択ボタン**: `transition-all duration-200` を `transition-colors` に変更。
- **タイプ選択ドロップダウン内ボタン**: `transition-colors` を追加。
- **バージョン/ビルド選択**: `focus:border-blue-500` に加え、`hover:border-gray-500` を追加。
- **各種更新ボタン**: `transition-colors` を追加。

**変更後 (抜粋):**
```html
<!-- ホストマシン選択 -->
<select id="hostSelect" class="w-full bg-gray-800 text-white pl-10 pr-8 py-3 rounded-lg border border-gray-700 focus:border-blue-500 outline-none appearance-none cursor-pointer hover:bg-gray-750 transition-colors"></select>

<!-- サーバータイプ選択 -->
<button id="typeSelectBtn" type="button" class="w-full bg-gray-800 hover:bg-gray-750 border border-gray-600 hover:border-gray-500 text-left rounded-lg p-3 flex items-center justify-between group transition-colors duration-200">...</button>

<!-- タイプ選択ドロップダウン内ボタン -->
<button type="button" data-type-id="..." class="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-700 transition-colors text-left group">...</button>

<!-- バージョン選択 -->
<select id="mcVersionSelect" class="w-full bg-gray-800 text-white pl-4 pr-8 py-2.5 rounded-lg border border-gray-700 hover:border-gray-500 focus:border-blue-500 outline-none appearance-none cursor-pointer text-sm transition-colors"></select>

<!-- 更新ボタン -->
<button id="refreshManifestBtn" title="Refresh Manifest" class="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">...</button>
```

---

#### d. `manager/src/ui/components/agentRegisterModal.js`

- **対象**: キャンセルボタン、登録ボタン
- **変更**: `transition-colors` を追加します。

**変更前:**
```html
<button id="cancel-register-agent-btn" type="button" class="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded-lg">キャンセル</button>
<button id="confirm-register-agent-btn" type="button" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">登録</button>
```

**変更後:**
```html
<button id="cancel-register-agent-btn" type="button" class="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">キャンセル</button>
<button id="confirm-register-agent-btn" type="button" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">登録</button>
```
### 2.2. レイアウト別

#### a. `manager/src/ui/layouts/accordionLayout.js`

- **対象**: エージェントヘッダー、サーバーアイテム、新規サーバー作成ボタン
- **変更**: ホバー効果とカーソルを追加し、クリック可能な領域を分かりやすくします。

**変更前:**
```html
<!-- エージェントヘッダー -->
<div class="px-4 py-3 ... cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" data-action="toggle-agent-details" ...>
...
</div>
...
<!-- サーバーアイテム (左側) -->
<div class="flex items-center gap-4 min-w-0" data-action="view-server-detail" data-server-id="...">
...
</div>
<!-- サーバーアイテム (右側ボタン) -->
<button class="p-2 rounded-md ... hover:bg-primary hover:text-white ... transition-colors" data-action="view-server-detail" ...>
...
</button>
...
<!-- 新規サーバー作成ボタン -->
<button class="w-full py-2 ... hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors ..." data-action="add-server" ...>
...
</button>
```

**変更後:**
```html
<!-- エージェントヘッダー -->
<div class="px-4 py-3 ... cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" data-action="toggle-agent-details" ...>
...
</div>
...
<!-- サーバーアイテム (左側) -->
<div class="flex items-center gap-4 min-w-0 cursor-pointer" data-action="view-server-detail" data-server-id="...">
...
</div>
<!-- サーバーアイテム (右側ボタン) - 変更なし -->
<button class="p-2 rounded-md ... hover:bg-primary hover:text-white ... transition-colors" data-action="view-server-detail" ...>
...
</button>
...
<!-- 新規サーバー作成ボタン - 変更なし -->
<button class="w-full py-2 ... hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors ..." data-action="add-server" ...>
...
</button>
```

---

#### b. `manager/src/ui/layouts/kanbanLayout.js`

- **対象**: サーバーカード、カード内「...」ボタン、新規エージェント追加カード
- **変更**: ホバー効果を強化し、インタラクティブな要素の視認性を高めます。

**変更前:**
```html
<!-- サーバーカード -->
<div class="bg-white ... p-3 ... hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer group relative overflow-hidden" data-action="view-server-detail" ...>
...
    <!-- 「...」ボタン -->
    <i data-lucide="more-horizontal" class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-white"></i>
...
</div>
...
<!-- 新規エージェント追加カード -->
<div class="w-80 flex ... border-2 border-dashed ... hover:bg-gray-100 dark:hover:bg-gray-800/30 hover:border-gray-400 dark:hover:border-gray-700 cursor-pointer" data-action="add-agent">
...
</div>
```

**変更後:**
```html
<!-- サーバーカード -->
<div class="bg-white ... p-3 ... hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-lg cursor-pointer group transition-all relative overflow-hidden" data-action="view-server-detail" ...>
...
    <!-- 「...」ボタン -->
    <div class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
        <i data-lucide="more-horizontal" class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white"></i>
    </div>
...
</div>
...
<!-- 新規エージェント追加カード -->
<div class="w-80 flex ... border-2 border-dashed ... hover:bg-gray-100 dark:hover:bg-gray-800/30 hover:border-gray-400 dark:hover:border-gray-700 cursor-pointer transition-colors" data-action="add-agent">
...
</div>
```
#### c. `manager/src/ui/layouts/treeGridLayout.js`

- **対象**: テーブルの各行、アクションボタン
- **変更**: 行全体をクリッカブルにし、無効状態のスタイルを追加します。

**変更前:**
```html
<!-- エージェント行 -->
<tr class="bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800/80">
...
    <button class="text-gray-400 hover:text-gray-600 dark:hover:text-white" data-action="manage-agent" ...>...</button>
</tr>
<!-- サーバー行 -->
<tr class="bg-white dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-800/30">
...
    <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-green-600 dark:text-green-400" data-action="start-server" ...>...</button>
    <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400" data-action="view-server-detail" ...>...</button>
</tr>
```

**変更後:**
```html
<!-- エージェント行 -->
<tr class="bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800/80 transition-colors cursor-pointer">
...
    <button class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors" data-action="manage-agent" ...>...</button>
</tr>
<!-- サーバー行 -->
<tr class="bg-white dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer">
...
    <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-green-600 dark:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-action="start-server" ...>...</button>
    <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 transition-colors" data-action="view-server-detail" ...>...</button>
</tr>
```

---

#### d. `manager/src/ui/layouts/sidebarLayout.js`

- **対象**: サイドバーのボタン、メインコンテンツのカード
- **変更**: アクティブ状態のスタイルとトランジションを追加します。

**変更前:**
```html
<!-- サイドバー Agentボタン -->
<button class="w-full text-left px-3 py-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 group" data-action="filter-by-agent" ...>
...
</button>
...
<!-- サーバーカード -->
<div class="bg-white ... p-4 hover:border-gray-400 dark:hover:border-gray-600 relative overflow-hidden group shadow-sm cursor-pointer" data-action="view-server-detail" ...>
...
    <div class="font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary">${server.server_name}</div>
...
</div>
```

**変更後:**
```html
<!-- サイドバー Agentボタン -->
<button class="w-full text-left px-3 py-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors group" data-action="filter-by-agent" ...>
...
</button>
...
<!-- サーバーカード -->
<div class="bg-white ... p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-all relative overflow-hidden group shadow-sm cursor-pointer" data-action="view-server-detail" ...>
...
    <div class="font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors">${server.server_name}</div>
...
</div>
```

---

#### e. `manager/src/ui/layouts/tabsLayout.js`

- **対象**: タブ、ボタン、サーバーアイテム
- **変更**: トランジションと無効状態のスタイルを追加します。

**変更前:**
```html
<!-- タブボタン -->
<button class="px-4 py-3 ... ${isActive ? '...' : '... hover:bg-gray-50 dark:hover:bg-gray-900/50'}" ... data-action="switch-tab" ...>
...
</button>
...
<!-- Settings ボタン -->
<button class="bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-3 py-2 rounded text-sm border border-gray-300 dark:border-gray-600" data-action="manage-agent" ...>Settings</button>
...
<!-- New Server ボタン -->
<button class="text-primary text-sm font-medium hover:underline" data-action="add-server" ...>+ New Server</button>
...
<!-- サーバーアイテム -->
<div class="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/80 border ... rounded-lg ... group cursor-pointer" data-action="view-server-detail" ...>
...
    <!-- 起動ボタン -->
    <button class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-green-100 dark:hover:bg-green-600 text-gray-600 dark:text-white rounded" data-action="start-server" ...>...</button>
    <!-- More Options ボタン -->
    <button class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-white rounded" data-action="more-options" ...>...</button>
...
</div>
```

**変更後:**
```html
<!-- タブボタン -->
<button class="px-4 py-3 ... ${isActive ? '...' : '... hover:bg-gray-50 dark:hover:bg-gray-900/50'} transition-colors" ... data-action="switch-tab" ...>
...
</button>
...
<!-- Settings ボタン -->
<button class="bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-3 py-2 rounded text-sm border border-gray-300 dark:border-gray-600 transition-colors" data-action="manage-agent" ...>Settings</button>
...
<!-- New Server ボタン -->
<button class="text-primary text-sm font-medium hover:text-primary-light hover:underline" data-action="add-server" ...>+ New Server</button>
...
<!-- サーバーアイテム -->
<div class="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/80 border ... rounded-lg ... group cursor-pointer transition-colors" data-action="view-server-detail" ...>
...
    <!-- 起動ボタン -->
    <button class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-green-100 dark:hover:bg-green-600 text-gray-600 dark:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-action="start-server" ...>...</button>
    <!-- More Options ボタン -->
    <button class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-white rounded transition-colors" data-action="more-options" ...>...</button>
...
</div>
```
### 2.3. 詳細ビュー

#### a. `manager/src/ui/views/serverDetailView.js`

- **対象**: ビュー内の各種ボタンとインタラクティブ要素
- **変更**: トランジション、フォーカス効果、無効状態のスタイルを追加し、操作感を向上させます。

**変更前:**
```html
<!-- 戻るボタン -->
<button data-action="back-to-list" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 ...">...</button>
<!-- サーバー名 -->
<div contenteditable="true" data-field="server_name" class="... outline-none border border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded ...">...</div>
<!-- フォルダボタン -->
<button data-action="open-dir" class="... bg-gray-200 hover:bg-gray-300 ... dark:bg-gray-600 dark:hover:bg-gray-700 ... rounded-lg" ...>フォルダ</button>
<!-- タブボタン -->
<button data-action="switch-detail-tab" data-tab="..." class="... ${state.detailActiveTab === '...' ? '...' : '... hover:bg-gray-200 dark:hover:bg-gray-700'}" ...>...</button>
<!-- コンソール実行ボタン -->
<button id="send-command-btn" class="bg-primary hover:bg-indigo-700 ... rounded-lg ...">実行</button>
<!-- 保存ボタン -->
<button data-action="save-launch-config" class="bg-primary hover:bg-indigo-700 ... rounded-lg ...">構成を保存</button>
<!-- 危険ゾーンのボタン -->
<button data-action="delete-server" class="bg-red-600 hover:bg-red-700 ... rounded-lg" ...>...</button>
```

**変更後:**
```html
<!-- 戻るボタン -->
<button data-action="back-to-list" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 ... transition-colors">...</button>
<!-- サーバー名 -->
<div contenteditable="true" data-field="server_name" class="... outline-none border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:ring-2 focus:ring-primary rounded ... transition-colors">...</div>
<!-- フォルダボタン -->
<button data-action="open-dir" class="... bg-gray-200 hover:bg-gray-300 ... dark:bg-gray-600 dark:hover:bg-gray-700 ... rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ...>フォルダ</button>
<!-- タブボタン -->
<button data-action="switch-detail-tab" data-tab="..." class="... ${state.detailActiveTab === '...' ? '...' : '... hover:bg-gray-200 dark:hover:bg-gray-700'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ...>...</button>
<!-- コンソール実行ボタン -->
<button id="send-command-btn" class="bg-primary hover:bg-indigo-700 ... rounded-lg ... transition-colors">実行</button>
<!-- 保存ボタン -->
<button data-action="save-launch-config" class="bg-primary hover:bg-indigo-700 ... rounded-lg transition-colors">構成を保存</button>
<!-- 危険ゾーンのボタン -->
<button data-action="delete-server" class="bg-red-600 hover:bg-red-700 ... rounded-lg transition-colors" ...>...</button>
```

---

#### b. `manager/src/ui/views/physicalServerDetailView.js`

- **対象**: ビュー内の各種ボタン
- **変更**: トランジションを追加して、UIの一貫性を保ちます。

**変更前:**
```html
<!-- 戻るボタン -->
<button data-action="back-to-list" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 ...">...</button>
<!-- タブボタン -->
<button data-action="switch-physical-detail-tab" data-tab="..." class="... ${state.physicalServerDetailActiveTab === '...' ? '...' : '... hover:text-gray-700 hover:border-gray-300'}">...</button>
<!-- 保存ボタン -->
<button data-action="save-agent-settings" class="bg-primary hover:bg-indigo-700 ... rounded-lg">設定を保存</button>
<!-- Javaインストールボタン -->
<button data-action="open-java-install-modal" class="bg-green-500 hover:bg-green-600 ... rounded-lg">Javaをインストール</button>
<!-- エージェント削除ボタン -->
<button data-action="delete-agent" class="w-full bg-red-600 hover:bg-red-700 ... rounded-lg">このエージェントを削除</button>
```

**変更後:**
```html
<!-- 戻るボタン -->
<button data-action="back-to-list" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 ... transition-colors">...</button>
<!-- タブボタン -->
<button data-action="switch-physical-detail-tab" data-tab="..." class="... ${state.physicalServerDetailActiveTab === '...' ? '...' : '... hover:text-gray-700 hover:border-gray-300'} transition-colors">...</button>
<!-- 保存ボタン -->
<button data-action="save-agent-settings" class="bg-primary hover:bg-indigo-700 ... rounded-lg transition-colors">設定を保存</button>
<!-- Javaインストールボタン -->
<button data-action="open-java-install-modal" class="bg-green-500 hover:bg-green-600 ... rounded-lg transition-colors">Javaをインストール</button>
<!-- エージェント削除ボタン -->
<button data-action="delete-agent" class="w-full bg-red-600 hover:bg-red-700 ... rounded-lg transition-colors">このエージェントを削除</button>
```