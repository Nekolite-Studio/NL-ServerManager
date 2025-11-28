# 3. 構文変換ガイド

`"type": "module"` を設定したことで、`.js`ファイルはESMとして扱われます。この章では、既存のCommonJS (CJS) 構文をESM構文に変換するための具体的なパターンを解説します。

## 3.1. `require` から `import` へ

### 3.1.1. 名前付きエクスポートのインポート

CJSで `exports.myFunction = ...` のようにエクスポートされた関数や変数をインポートするパターンです。

-   **CJS (旧)**
    ```javascript
    const { someFunction, someVariable } = require('./my-module.js');
    ```

-   **ESM (新)**
    ```javascript
    import { someFunction, someVariable } from './my-module.js';
    ```
    **注意:** ESMでは、ファイルパスに拡張子 (`.js`) を含めることが推奨されます。

### 3.1.2. デフォルトエクスポートのインポート

CJSで `module.exports = ...` によってエクスポートされた単一の値をインポートするパターンです。

-   **CJS (旧)**
    ```javascript
    const MyClass = require('./my-class.js');
    ```

-   **ESM (新)**
    ```javascript
    import MyClass from './my-class.js';
    ```

### 3.1.3. すべてのエクスポートを名前空間としてインポート

モジュールがエクスポートするすべてのものを、単一のオブジェクトとしてインポートします。

-   **CJS (旧)**
    ```javascript
    const utils = require('./utils.js');
    // utils.func1();
    // utils.func2();
    ```

-   **ESM (新)**
    ```javascript
    import * as utils from './utils.js';
    // utils.func1();
    // utils.func2();
    ```

### 3.1.4.副作用のためだけのインポート

コードを実行させたいだけで、何もインポートしない場合です。（例：ポリフィルの適用など）

-   **CJS (旧)**
    ```javascript
    require('./setup.js');
    ```

-   **ESM (新)**
    ```javascript
    import './setup.js';
    ```

## 3.2. `module.exports` / `exports` から `export` へ

### 3.2.1. 名前付きエクスポート

複数の関数や変数を個別にエクスポートするパターンです。

-   **CJS (旧)**
    ```javascript
    // 方法A: exportsにプロパティを追加
    exports.someFunction = () => { /* ... */ };
    exports.someVariable = 'hello';

    // 方法B: module.exportsにオブジェクトを代入
    module.exports = {
      someFunction: () => { /* ... */ },
      someVariable: 'hello'
    };
    ```

-   **ESM (新)**
    ```javascript
    // 宣言と同時にエクスポート
    export const someFunction = () => { /* ... */ };
    export const someVariable = 'hello';

    // 宣言後にまとめてエクスポート
    const anotherFunction = () => {};
    export { anotherFunction };
    ```

### 3.2.2. デフォルトエクスポート

モジュールから単一のクラスや関数、値をエクスポートする場合に使用します。

-   **CJS (旧)**
    ```javascript
    class MyClass { /* ... */ }
    module.exports = MyClass;
    ```

-   **ESM (新)**
    ```javascript
    export default class MyClass { /* ... */ }
    
    // または
    // class MyClass { /* ... */ }
    // export default MyClass;
    ```
**注意:** 1つのファイルに`export default`は1つしか記述できません。

## 3.3. 特殊なケースの置き換え

### 3.3.1. 動的な `require()` → 非同期 `import()`

CJSでは、条件に応じて動的にモジュールを読み込むことができました。ESMでは、これに相当する機能として非同期の `import()` 構文を使用します。`import()` はPromiseを返します。

-   **CJS (旧)**
    ```javascript
    if (condition) {
      const module = require('./conditional-module.js');
      module.doSomething();
    }
    ```

-   **ESM (新)**
    ```javascript
    if (condition) {
      // import()はPromiseを返すため、async/awaitと組み合わせるのが一般的
      const module = await import('./conditional-module.js');
      module.doSomething();
    }
    ```
    Top-level `await`が利用できる環境では、関数の外側でも`await import(...)`が使用できます。

### 3.3.2. `__dirname` と `__filename` の廃止 → `import.meta.url`

ESMでは、CJSのグローバル変数 `__dirname` (現在のファイルがあるディレクトリのパス) と `__filename` (現在のファイルのパス) は利用できません。
代わりに `import.meta.url` を使用して、同様の機能を実現します。

-   **CJS (旧)**
    ```javascript
    const path = require('path');
    const myFilePath = path.join(__dirname, 'data.json');
    ```

-   **ESM (新)**
    ```javascript
    import path from 'path';
    import { fileURLToPath } from 'url';

    // 1. 現在のファイルのURLを取得
    const __filename = fileURLToPath(import.meta.url);

    // 2. 現在のファイルのディレクトリパスを取得
    const __dirname = path.dirname(__filename);

    // 3. パスを結合
    const myFilePath = path.join(__dirname, 'data.json');
    ```
    この定型句は頻繁に利用するため、ユーティリティ関数としてまとめておくと便利です。

### 3.3.3. JSONファイルのインポート

CJSでは `require` で直接JSONファイルを読み込めましたが、ESMの `import` 文でJSONを直接インポートする機能はまだ実験的です（`--experimental-json-modules` フラグが必要）。
最も互換性の高い方法は、`fs`モジュールを使って手動で読み込むことです。

-   **CJS (旧)**
    ```javascript
    const config = require('./config.json');
    ```

-   **ESM (新)**
    ```javascript
    import fs from 'fs';
    import path from 'path';
    // (必要であれば __dirname を上記の方法で定義)

    const configPath = path.join(__dirname, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    ```
    **Node.js v17.5.0以降**では、`import` assertions を使ってより簡潔に書けます。
    ```javascript
    import config from './config.json' assert { type: 'json' };
    ```
    プロジェクトのNode.jsバージョンに応じて適切な方法を選択してください。