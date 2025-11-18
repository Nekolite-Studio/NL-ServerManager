# 2. 準備段階: 基盤の整備

本格的なコード変換に着手する前に、プロジェクトの基盤をESM移行に向けて整えるための準備作業を行います。このステップでは、依存ライブラリのESM対応状況を調査する方法と、`package.json`の重要な設定変更について解説します。

## 2.1. Node.jsのバージョン確認

まず、プロジェクトで使用しているNode.jsのバージョンが、ESMを安定してサポートしているか確認します。

**Node.js v14.8.0以上**が推奨されます。特にTop-level `await`などの便利な機能はv14.8.0以降で利用可能になります。プロジェクトの実行環境がこれより古い場合は、まずNode.jsのアップデートを検討してください。

## 2.2. 依存ライブラリのESM対応状況の調査

CJSからESMへの移行で最も重要な作業の一つが、プロジェクトが依存している外部ライブラリ（`dependencies` と `devDependencies`）がESMをサポートしているかどうかの確認です。

ライブラリがESMに未対応の場合でも、多くはESMから`import`することが可能ですが、一部のライブラリでは問題が発生する可能性があります。事前に調査しておくことで、移行中の問題を予測し、対策を立てることができます。

### 調査方法

#### 方法1: `package.json` の `exports` フィールドを確認する (推奨)

ライブラリの `node_modules` ディレクトリにある `package.json` を直接確認するのが最も確実な方法です。

-   `"type": "module"` が設定されている場合、そのパッケージはESMネイティブです。
-   `exports` フィールドが存在し、`"import"` や `"module"` といったキーが含まれている場合、ESMでの利用が公式にサポートされています。

```json
// 例: ESM対応ライブラリの package.json
{
  "name": "a-esm-library",
  "version": "1.0.0",
  "type": "module",
  "main": "./index.js", // ESMのエントリーポイント
  "exports": {
    ".": {
      "import": "./index.js", // import ... from 'a-esm-library' で使われる
      "require": "./index.cjs" // require('a-esm-library') で使われる (相互運用のため)
    }
  }
}
```

#### 方法2: コミュニティツールを利用する

手動での確認を補助する便利なCLIツールが存在します。

-   **`is-esm`**: 指定したパッケージがESMかどうかを判定します。
    ```bash
    npx is-esm <package-name>
    ```
-   **`are-you-es-module`**: プロジェクトの `node_modules` 全体をスキャンし、各依存関係のモジュールタイプを一覧表示します。
    ```bash
    npx are-you-es-module
    ```

#### 方法3: ライブラリの公式ドキュメントを確認する

ライブラリのGitHubリポジトリや公式ドキュメントで、"ESM" や "ECMAScript Modules" といったキーワードで検索します。CHANGELOGやIssueで移行に関する情報が見つかることもあります。

## 2.3. `package.json` の設定変更

プロジェクト内の `.js` ファイルをデフォルトでESMとして扱うように、各パッケージ（`agent/package.json` と `manager/package.json`）を修正します。

### `"type": "module"` の追加

`package.json` のトップレベルに `"type": "module"` を追加します。

```json
// agent/package.json または manager/package.json
{
  "name": "...",
  "version": "...",
  "type": "module",
  "main": "index.js",
  // ...
}
```

#### この変更による影響

-   **`.js` ファイルの扱い:** この設定を追加したパッケージ内のすべての `.js` ファイルは、ESMとして解釈されるようになります。`require` や `module.exports`、`__filename`、`__dirname` を使用するとエラーになります。
-   **CJSファイルの扱い:** 引き続きCommonJS形式で記述する必要があるファイル（例: 一部の設定ファイルや、ESMに移行できない古いスクリプト）は、拡張子を **`.cjs`** に変更する必要があります。`.cjs` 拡張子を持つファイルは、`"type": "module"` の設定に関わらず、常にCJSとして扱われます。

### `main` フィールドの確認

`package.json` の `main` フィールドが、アプリケーションのエントリーポイントを正しく指していることを確認します。`"type": "module"` を設定した場合、このエントリーポイントファイルもESM形式（`import`/`export`）で記述されている必要があります。