# 6. `manager` パッケージのESM移行手順

この章では、`agent` パッケージの移行で得た知見を活かし、より複雑な `manager` パッケージをESMへ移行するための具体的な手順と、Electron特有の注意点について解説します。

**前提:**
-   `agent` パッケージのESM移行が完了し、安定動作していること。
-   作業を始める前に、Gitで新しいブランチを作成してください。

## ElectronにおけるESMの基本

Electron v14以降、ESMはメインプロセス、レンダラープロセス、プリロードスクリプトでサポートされています。今回の移行は、このサポートを前提に進めます。

-   **メインプロセス (`main.js`):** Node.js環境であり、通常のNode.jsアプリケーションと同様にESM化が可能です。
-   **レンダラープロセス (`renderer.js`など):** Chromiumブラウザ環境であり、`<script type="module">` を使えばネイティブでESMをサポートしています。
-   **プリロードスクリプト (`preload.js`):** 特殊なコンテキストで実行されますが、ESMとして記述することが可能です。

## ステップ 1: `package.json` の設定

`agent` と同様に、`manager/package.json` を編集します。

1.  トップレベルに `"type": "module"` を追加します。
2.  `main` フィールドが `main.js` を指していることを確認します。

**`manager/package.json` の変更例:**
```json
{
  "name": "manager",
  "version": "0.1.0",
  "description": "...",
  "type": "module",
  "main": "main.js",
  // ...
}
```

## ステップ 2: HTMLファイルの修正

レンダラープロセスのJavaScriptファイルをESMとして読み込むために、`manager/index.html` を修正する必要があります。

`<script>` タグに `type="module"` を追加します。これにより、ブラウザ（レンダラープロセス）はこれらのスクリプトをESMとして扱います。

**`manager/index.html` の変更例:**
```html
<!-- 修正前 -->
<!-- <script src="./renderer.js"></script> -->

<!-- 修正後 -->
<script type="module" src="./renderer.js"></script>
<script type="module" src="./renderer-ui.js"></script>
<script type="module" src="./renderer-state.js"></script>
```
*（注意: 実際のファイル構成に合わせて `<script>` タグを修正してください。）*

## ステップ 3: 構文の自動変換

`jscodeshift` を使って、`manager` パッケージ内の `.js` ファイルを自動変換します。

**1. ドライラン:**
```bash
npx jscodeshift -t https://raw.githubusercontent.com/gajus/commonjs-to-es6-codemod/master/transforms/commonjs.js manager/ --dry --print --extensions=js
```

**2. 本実行:**
```bash
npx jscodeshift -t https://raw.githubusercontent.com/gajus/commonjs-to-es6-codemod/master/transforms/commonjs.js manager/ --print --extensions=js
```

## ステップ 4: 手動での修正 (Electron特有の注意点)

自動変換後、Electronアプリケーション特有の事情を考慮した手動修正を行います。

### 4.1. `__dirname` と `path.join` の修正 (`main.js`)

`main.js` では、`preload.js` や `index.html` のパスを解決するために `__dirname` が使われています。これを `import.meta.url` を使ったパターンに置き換えます。

**`main.js` の修正例:**
```javascript
// 修正前
// app.whenReady().then(() => {
//   createWindow({
//     preload: path.join(__dirname, 'preload.js'),
//   })
// });
// win.loadFile(path.join(__dirname, 'index.html'));

// 修正後
import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ...

app.whenReady().then(() => {
  const win = new BrowserWindow({
    // ...
    webPreferences: {
      // __dirname は絶対パスである必要がある
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
});
```

### 4.2. `preload.js` の修正

`preload.js` はメインプロセスとレンダラープロセスの橋渡しをする重要なファイルです。ESM構文に変換しますが、`contextBridge` を使ったAPIの公開方法は基本的に同じです。

**`preload.js` の修正例:**
```javascript
// 修正前
// const { contextBridge, ipcRenderer } = require('electron');
// contextBridge.exposeInMainWorld(...)

// 修正後
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    proxyToAgent: (agentId, message) => ipcRenderer.send('proxy-to-agent', agentId, message),
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
    // ... 他のAPI
  }
);
```

### 4.3. `electron-store` などのCJSライブラリのインポート

`electron-store` は、現行バージョン（v8.1.0時点）ではESMの `export default` を提供していません。このようなライブラリをESMからインポートする場合、インポートの方法に注意が必要です。

**`manager/src/storeManager.js` の修正例:**
```javascript
// 修正前
// const Store = require('electron-store');

// 修正後
import Store from 'electron-store';

// もし `import Store from ...` でエラーが出る場合、
// 以下のような名前付きインポートを試す必要があるかもしれない
// import { default as Store } from 'electron-store';

const store = new Store();
```

## ステップ 5: フォーマット、リンティング、動作確認

1.  **フォーマット:** `prettier` を実行してコードスタイルを整えます。
    ```bash
    npx prettier --write "manager/**/*.js"
    ```
2.  **起動確認:** `dev` スクリプトでアプリケーションを起動し、エラーが出ないか確認します。
    ```bash
    npm run dev:manager
    ```
    -   **DevToolsの確認:** レンダラープロセスのDevToolsコンソールを開き、`Failed to load module script:` のようなエラーが出ていないか確認します。これは `index.html` の `<script type="module">` のパスが間違っている場合などによく発生します。
    -   **メインプロセスのログ確認:** ターミナルに表示されるメインプロセスのログを確認し、`ERR_MODULE_NOT_FOUND` などが出ていないか確認します。
3.  **機能テスト:**
    -   `agent` との接続が確立されるか。
    -   サーバーリストが正しく表示されるか。
    -   サーバーの作成、起動、停止などの操作が正常に行えるか。
    -   UI上のボタンクリックなどが正しく反応するか。
4.  **ビルド確認:**
    最後に、`electron-builder` でアプリケーションが正常にビルドできるかを確認します。ESMへの変更がビルドプロセスに影響を与える可能性があるため、この確認は重要です。
    ```bash
    npm run build -w manager
    ```

これらの手順を慎重に実行することで、Electronアプリケーションである `manager` パッケージも安全にESMへ移行することができます。