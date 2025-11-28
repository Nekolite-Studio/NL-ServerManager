# デバッグガイド: UIインタラクションロガー

このドキュメントは、ManagerアプリケーションのUIデバッグを効率化するために導入された汎用UIロガー `logUiInteraction` の仕様と利用方法について解説します。

## 1. 目的と重要性

新しいUIは多くのインタラクティブな要素を持つため、バグの追跡や動作確認が複雑になりがちです。このロガーは、以下の目的で導入されました。

-   **操作の可視化**: ユーザーがどのUI要素を、いつ、どのように操作したかをコンソール上で明確に追跡できます。
-   **デバッグの効率化**: `console.log` を各所に散在させる必要がなくなり、一貫したフォーマットで情報を確認できます。
-   **開発規約**: 新しいUIコンポーネントを実装する際、このロガーを使用することで、デバッグの容易さを標準的に担保します。

## 2. ロガーの仕様

-   **モジュールパス**: `manager/src/utils/logger.js`
-   **関数**: `logUiInteraction(options)`

### 2.1. `options` オブジェクトのプロパティ

ロガーに渡す`options`オブジェクトは、以下のプロパティを持ちます。

| プロパティ    | 型          | 必須 | 説明                                                               |
| :------------ | :---------- | :--- | :----------------------------------------------------------------- |
| `event`       | `string`    | **はい** | イベントの種類 (`click`, `change`, `mount`, `unmount`など)         |
| `action`      | `string`    | **はい** | 実行されたアクションの具体的な名前 (`open-modal`, `select-version`など) |
| `component`   | `string`    | 任意 | イベント発生元のコンポーネント名 (例: `ServerCreateModal`)         |
| `element`     | `HTMLElement` | 任意 | イベントが発生したDOM要素。コンソールで直接参照できます。            |
| `details`     | `Object`    | 任意 | 関連する追加データ (例: `{ value: '1.20.1', serverId: 's1' }`) |

### 2.2. コンソール出力例

このロガーは、コンソール上でグループ化された見やすいログを生成します。

```
▼ [ServerCreateModal] select-mc-version
    Event: change
    Element: <select id="mcVersionSelect" ...>...</select>
    Version: 1.20.1
```

## 3. 利用ガイド

### 3.1. イベント委任 (`eventHandlers.js`) での使用

`data-action`属性を持つ要素のクリックイベントは、`eventHandlers.js`で一元的に捕捉され、自動的にログが出力されます。

```javascript
// manager/src/dom/eventHandlers.js

document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    // ...

    logUiInteraction({
        event: 'click',
        action: action,
        element: target,
        details: { serverId, agentId }
    });

    // ... switch文による処理
});
```

### 3.2. コンポーネント内での使用

モーダルの表示/非表示や、`data-action`以外の独自のイベントリスナーを持つコンポーネントでは、各コンポーネントファイル内で明示的にロガーを呼び出します。

#### 例1: モーダルのライフサイクルイベント

```javascript
// manager/src/ui/components/settingsModal.js
import { logUiInteraction } from '../../utils/logger.js';

export class SettingsModal {
    constructor() {
        this.componentName = 'SettingsModal';
        // ...
    }

    open() {
        logUiInteraction({ event: 'mount', action: 'open-modal', component: this.componentName });
        this.render();
    }

    close() {
        logUiInteraction({ event: 'unmount', action: 'close-modal', component: this.componentName });
        // ...
    }
}
```

#### 例2: `change` イベント

```javascript
// manager/src/ui/components/serverCreateModal.js

this.els.snapshotToggle.addEventListener("change", (e) => {
    this.state.showSnapshots = e.target.checked;
    logUiInteraction({
        event: 'change',
        action: 'toggle-snapshots',
        component: this.componentName,
        element: e.target,
        details: { showSnapshots: this.state.showSnapshots }
    });
    this.updateVersionList();
});
```

## 4. 開発者へのお願い

新しいUIコンポーネントやインタラクティブな機能を追加する際は、ユーザーの主要な操作（クリック、値の変更、表示/非表示など）がこのロガーによって記録されるように、適切な箇所で `logUiInteraction` を呼び出してください。これにより、将来のデバッグが大幅に容易になります。