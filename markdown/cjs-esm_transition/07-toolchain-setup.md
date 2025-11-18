# 7. ツールチェインの再設定

コードベースをESMに移行した後は、コードの品質を維持し、開発を支援するツールチェイン（リンター、テスティングフレームワークなど）もESMを正しく解釈できるように設定を更新する必要があります。

この章では、特に重要となる `ESLint` の設定変更について解説します。

## 7.1. ESLint の設定変更

ESLintが `import`/`export` 構文や Top-level `await` を正しく解析できるように、設定ファイル（`.eslintrc.js` や `.eslintrc.json` など）を更新します。

### `parserOptions` の更新

ESLintに新しいJavaScript構文とESMのモジュール形式を認識させるため、`parserOptions` を修正します。

-   **`ecmaVersion`**: `import.meta` や Top-level `await` などの新しい構文をサポートするため、`2020` 以上（または `"latest"`）に設定します。
-   **`sourceType`**: これが最も重要な変更です。値を `"module"` に設定することで、ESLintはファイルをCommonJSスクリプトではなく、ES Moduleとして解析するようになります。

**設定変更例 (`.eslintrc.js`):**

この設定は、モノレポのルート、または `agent` と `manager` の各パッケージ内に設定ファイルがある場合は、その両方で行う必要があります。

```javascript
// .eslintrc.js

module.exports = {
  // ... other configs (env, extends, etc.)
  
  // 修正前の parserOptions
  /*
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'script', // または未指定
  },
  */

  // 修正後の parserOptions
  parserOptions: {
    ecmaVersion: 2022, // Top-level await (2022), import() (2020)などをカバー
    sourceType: 'module', // これがESMとして解析させるためのキー設定
  },

  rules: {
    // ...
  },
};
```

この変更により、ESLintは `import` 文をファイルのトップレベル以外で使うとエラーを出すなど、ESMの仕様に沿った静的解析を行えるようになります。

## 7.2. Jest (テストフレームワーク)

**現状、このプロジェクトにはJestは導入されていません。**

もし将来的にJestを導入してテストを記述する場合には、ESM環境でJestを動作させるための追加設定が必要になる点に留意してください。主な設定項目は以下の通りです。

-   **Node.jsの `--experimental-vm-modules` オプション:** `package.json` の `test` スクリプトで、`node --experimental-vm-modules node_modules/jest/bin/jest.js` のようにNode.jsの実験的フラグを有効にしてJestを実行する必要があります。
-   **`jest.config.js` の設定:** `transform` オプションを適切に設定し、Babelなどのトランスパイラと連携してESM構文をJestが理解できる形に変換する設定が必要になる場合があります。

ESMのサポートはJestのバージョンによっても異なるため、導入する時点でのJest公式ドキュメントを参照することが不可欠です。

## 7.3. Prettier (フォーマッター)

Prettierはコードの構文を解析してフォーマットを整えるツールであり、その構文がCJSかESMかによって設定を変更する必要は**基本的にありません**。

ただし、`jscodeshift` などによる自動変換後はコードのフォーマットが崩れがちです。移行プロセスの各ステップで、`prettier --write` を実行してコードをクリーンに保つことを推奨します。