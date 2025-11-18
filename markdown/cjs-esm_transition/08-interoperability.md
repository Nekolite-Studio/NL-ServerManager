# 8. CJSとESMの相互運用ガイド

ESMへの移行期間中、またはESMに未対応の依存ライブラリを利用する場合、CommonJS (CJS) と ES Modules (ESM) のコードがプロジェクト内に混在します。この2つのモジュールシステムは設計思想が異なるため、両者を協調させるにはいくつかのルールを理解しておく必要があります。

## 8.1. ESMからCJSをインポートする (最も一般的なケース)

ESMファイル (`.js` で `"type": "module"` が有効な環境) からCJSモジュール (`.cjs` ファイルや古いライブラリ) をインポートするのは比較的簡単です。

Node.jsはCJSモジュールをインポートする際に、ESMと互換性のある形にラップしてくれます。

### 基本的なルール

CJSモジュールの `module.exports` の内容は、ESM側では **デフォルトエクスポート (default export)** として扱えます。

**CJSモジュール (`cjs-module.js`):**
```javascript
// CJS: module.exports にオブジェクトを代入
module.exports = {
  sayHello: () => 'Hello',
  someValue: 42
};

// CJS: module.exports に関数を直接代入
// module.exports = () => 'Hello';
```

**ESMからのインポート (`esm-file.js`):**
```javascript
// CJSモジュールをインポート
import cjsModule from './cjs-module.js';

// module.exports がオブジェクトだったので、cjsModule はそのオブジェクトになる
console.log(cjsModule.sayHello()); // -> 'Hello'
console.log(cjsModule.someValue);  // -> 42

// もし CJS 側が関数を直接エクスポートしていたら
// cjsModule(); // -> 'Hello'
```

### 名前付きエクスポートのシミュレーション

Node.jsは、CJSモジュールのプロパティをESMの名前付きインポートとして扱おうと試みますが、常に成功するとは限りません。最も安全で一貫性のある方法は、一度デフォルトインポートしてから分割代入する方法です。

```javascript
// 安全な方法
import cjsModule from './cjs-module.js';
const { sayHello, someValue } = cjsModule;

console.log(sayHello()); // -> 'Hello'
```

**ベストプラクティス:**
ESMからCJSモジュールをインポートする際は、まず**デフォルトインポート**を試し、その結果（オブジェクト）から必要なプロパティを取り出すのが最も確実です。

## 8.2. CJSからESMをインポートする (非推奨だが、必要な場合も)

**原則として、CJSからESMを `require()` することはできません。**

CJSの `require()` は同期的ですが、ESMの読み込みと評価は非同期フェーズを含むため、同期的な `require()` で直接解決することはできない設計になっています。もし実行しようとすると、以下のようなエラーが発生します。

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported.
```

### 唯一の解決策: 動的な `import()`

CJSファイル内でESMモジュールを利用する必要がある場合の唯一の方法は、非同期の `import()` 構文を使うことです。`import()` はPromiseを返すため、`async`関数内で`await`して使うのが一般的です。

**ESMモジュール (`esm-module.js`):**
```javascript
export const message = 'This is ESM';
```

**CJSからの利用 (`cjs-file.js`):**
```javascript
async function main() {
  console.log('CJS: Loading ESM module...');
  
  // import() は Promise を返す
  const esmModule = await import('./esm-module.js');
  
  console.log(esmModule.message); // -> 'This is ESM'
}

main();
```

このパターンは、`.eslintrc.js` のような設定ファイルがCJS形式である必要があり、かつESMベースのプラグインを読み込みたい、といった特殊なケースで役立ちます。

## 8.3. 拡張子の役割

`"type": "module"` を設定したパッケージ内でのファイルの扱いは、拡張子によって決まります。

-   `.js`: **ES Module** として扱われます。
-   `.cjs`: **CommonJS** として扱われます。`require` や `module.exports` を使用できます。
-   `.mjs`: **ES Module** として扱われます。 (`"type": "module"` がなくてもESMになる)

**実践的な使い方:**
移行期間中、大部分の `.js` ファイルをESMに変換しつつ、何らかの理由でCJSのままにしておく必要があるファイル（例: 古いビルドスクリプトなど）の拡張子を `.cjs` に変更することで、両者を安全に共存させることができます。