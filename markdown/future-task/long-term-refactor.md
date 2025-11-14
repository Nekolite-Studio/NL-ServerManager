# 長期的なリファクタリング計画: 型定義の導入による堅牢性向上

## 目的
`electron-store`のスキーマと実装の乖離によって繰り返し発生したバグを踏まえ、将来同様の問題を防ぐための恒久的な設計改善を行う。

## 課題
現状のコードベースでは、`main.js`のメモリ上のデータ構造と、`storeManager.js`が永続化層で期待するデータ構造が分離しており、両者間の整合性を保証する仕組みが存在しない。これにより、片方の変更がもう片方に追随されず、スキーマ違反エラーが発生しやすい状態になっている。

## 提案: 共有型定義ファイルの導入
プロジェクト全体で共有される`common/types.js`ファイルを作成し、JSDoc形式で主要なデータ構造の型を一元管理する。

### `common/types.js` の例
```javascript
/**
 * electron-storeに永続化されるAgentのデータ構造
 * @typedef {object} StoredAgent
 * @property {string} id - 一意のID
 * @property {string} ip - IPアドレス
 * @property {number} port - ポート番号
 * @property {string} alias - 表示名
 */

/**
 * メモリ上で管理されるAgentの状態オブジェクト
 * @typedef {object} RuntimeAgent
 * @property {string} id - 一意のID
 * @property {StoredAgent} config - 永続化される設定データ
 * @property {import('ws') | null} ws - WebSocket接続インスタンス
 * @property {'Connected' | 'Disconnected' | 'Connecting...'} status - 接続状態
 * @property {NodeJS.Timeout | null} reconnectInterval - 再接続タイマー
 */
```

### 期待される効果
- **信頼の単一情報源:** `types.js`がデータ構造の唯一の正解となる。
- **開発者体験の向上:** IDEによる強力な型チェックと自動補完が有効になり、開発段階で構造の不一致を発見できる。
- **堅牢性の向上:** 実行時エラーに頼らず、静的解析によってバグを早期発見できる。

このタスクは、現在の`TypeError`バグ修正が完了した後に着手する。