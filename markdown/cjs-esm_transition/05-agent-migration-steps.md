# 5. `agent` パッケージのESM移行手順

この章では、これまでのガイドで定義した戦略と知識に基づき、`agent` パッケージを CommonJS (CJS) から ES Modules (ESM) へ移行するための具体的な手順をステップバイステップで示します。

**前提:**
-   作業を始める前に、Gitで新しいブランチを作成してください。
-   `agent` ディレクトリでコマンドを実行してください。

## ステップ 1: `package.json` の設定

まず、`agent/package.json` を編集し、ESMプロジェクトとして設定します。

1.  `package.json` を開き、トップレベルに `"type": "module"` を追加します。
2.  `main` フィールドが `index.js` を指していることを確認します。

**`agent/package.json` の変更例:**
```json
{
  "name": "agent",
  "version": "0.1.0",
  "description": "Server agent to be controlled by the manager",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  // ... dependencies
}
```

## ステップ 2: 依存関係のESM対応調査

ガイド「2. 準備段階」で解説した方法で、`agent`の依存ライブラリのESM対応状況を確認します。

```bash
# agentディレクトリに移動して実行
cd agent
npx are-you-es-module
cd ..
```

特に `ws`, `systeminformation`, `rcon-client` など、主要なライブラリがESMでどのようにインポートされるべきか（名前付きインポートか、デフォルトインポートか）を把握しておくと、後の手動修正がスムーズになります。

## ステップ 3: 構文の自動変換

ガイド「4. 自動化ツールの活用」で説明した `jscodeshift` を使って、コードの大部分を自動でESM構文に変換します。

**1. ドライラン (変更内容の確認):**
```bash
npx jscodeshift -t https://raw.githubusercontent.com/gajus/commonjs-to-es6-codemod/master/transforms/commonjs.js agent/ --dry --print --extensions=js
```
出力結果を確認し、意図しない変更がないかレビューします。

**2. 本実行 (ファイルの書き換え):**
ドライランで問題がなければ、実際にファイルを変換します。
```bash
npx jscodeshift -t https://raw.githubusercontent.com/gajus/commonjs-to-es6-codemod/master/transforms/commonjs.js agent/ --print --extensions=js
```

## ステップ 4: 手動での修正

自動変換は完璧ではありません。以下の点に注意しながら、手動でコードを修正していきます。

### 4.1. `__dirname` / `__filename` の置き換え

`agent` コード内で `__dirname` や `__filename` が使われている箇所を探します。これらは主に設定ファイルやサーバーファイルのパスを解決するために使われている可能性が高いです。

ガイド「3. 構文変換ガイド」で説明した `import.meta.url` を使ったパターンに置き換えます。

**修正例 (`agent/src/utils/storage.js` など):**
```javascript
// 修正前
// const storagePath = path.join(__dirname, '..', '..', 'data');

// 修正後
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storagePath = path.join(__dirname, '..', '..', 'data');
```

### 4.2. JSON ファイルのインポート

`require('./some-data.json')` のようなコードは、`fs.readFileSync` を使った読み込みに手動で修正します。

### 4.3. インポートパスの修正

自動変換ツールは、インポートパスに拡張子 `.js` を追加しない場合があります。ESMでは拡張子を省略しないことが推奨されるため、`from './my-module'` のようなパスを `from './my-module.js'` のように修正します。

### 4.4. 依存ライブラリのインポート方法の修正

`jscodeshift` は、ライブラリのインポート方法（デフォルトか名前付きか）を間違うことがあります。ステップ2で調査した結果や、ライブラリのドキュメントを参考に、正しいインポート方法に修正します。

**修正例:**
```javascript
// 修正前 (誤)
// import ws from 'ws';

// 修正後 (正) - wsは名前付きエクスポート
import { WebSocketServer } from 'ws';
```

## ステップ 5: フォーマットとリンティング

コードの変換によってフォーマットが崩れている可能性が高いため、`Prettier` などのフォーマッターを実行します。

```bash
npx prettier --write "agent/**/*.js"
```

その後、`ESLint` を実行して構文エラーやその他の問題がないか確認します。（ESLint自体の設定変更は後の章で解説します）

## ステップ 6: 動作確認

ここまでで、`agent` はESMとして動作する準備が整いました。以下のコマンドで `agent` を単体で起動し、エラーが出ずに起動するか確認します。

```bash
npm run dev:agent
```

-   `SyntaxError: Cannot use import statement outside a module` -> `package.json` に `"type": "module"` が設定されているか確認してください。
-   `ERR_MODULE_NOT_FOUND` -> インポートパスが間違っている（拡張子 `.js` が抜けているなど）可能性があります。
-   `ReferenceError: require is not defined` -> コード内に `require` が残っています。`import` に修正してください。

`manager` を接続して、サーバー作成、起動、停止などの基本的な機能が以前と同様に動作するかを一通りテストします。問題があれば、エラーメッセージをヒントに原因を特定し、修正します。

このステップが完了すれば、`agent` パッケージのESM移行は完了です。