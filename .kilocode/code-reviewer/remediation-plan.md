# コード品質改善計画

このドキュメントは、[`issues.md`](./issues.md)で指摘された各課題に対する、具体的で実行可能な修正計画を提示します。

---

## 1. プロトコル定義の一貫性の欠如 (マジックストリングの使用)

**課題:** `manager`と`agent`間の通信で、定義済みのプロトコル定数ではなくハードコードされた文字列が使用されている。

**重要度:** 高

### 具体的な修正案

[`common/protocol.js`](./common/protocol.js:6)で定義されている`Message`定数を使用するように、すべてのメッセージハンドラを統一します。これにより、プロトコルの変更に強く、予測可能なコードになります。

#### 1.1. `manager/main.js`の修正

`ws.on('message', ...)`内の`switch`文を修正し、文字列リテラルを`Message`定数に置き換えます。

**対象ファイル:** [`manager/main.js`](./manager/main.js:109)

**修正例 (`apply_diff`用):**
```diff
<<<<<<< SEARCH
// manager/main.js L112-
    switch(type) {
        case Message.SERVER_LIST_UPDATE:
            mainWindow.webContents.send('server-list-update', payload);
            break;
        case 'progress-update':
            mainWindow.webContents.send('progress-update', payload);
            break;
        case 'operation-result':
            mainWindow.webContents.send('operation-result', payload);
            break;
        case 'server-log':
            mainWindow.webContents.send('server-log', payload);
            break;
        case 'server-status-update':
            mainWindow.webContents.send('server-status-update', payload);
            break;
=======
// manager/main.js L112-
    switch(type) {
        case Message.SERVER_LIST_UPDATE:
            mainWindow.webContents.send(Message.SERVER_LIST_UPDATE, payload);
            break;
        case Message.PROGRESS_UPDATE:
            mainWindow.webContents.send(Message.PROGRESS_UPDATE, payload);
            break;
        case Message.OPERATION_RESULT:
            mainWindow.webContents.send(Message.OPERATION_RESULT, payload);
            break;
        case Message.SERVER_LOG:
            mainWindow.webContents.send(Message.SERVER_LOG, payload);
            break;
        case Message.SERVER_STATUS_UPDATE:
            mainWindow.webContents.send(Message.SERVER_STATUS_UPDATE, payload);
            break;
>>>>>>> REPLACE
```

#### 1.2. `agent/index.js`の修正

Managerからのメッセージを処理する`switch`文で、`'get-metrics'`という文字列を`Message.GET_METRICS`に置き換えます。

**対象ファイル:** [`agent/index.js`](./agent/index.js:138)

**修正例 (`apply_diff`用):**
```diff
<<<<<<< SEARCH
// agent/index.js L138-
    switch (type) {
      case 'get-metrics': // Message.GET_METRICS を使うべき
        ws.send(JSON.stringify({ type: 'metrics-data', payload: getMetrics() }));
        break;
      // ... other cases
    }
=======
// agent/index.js L138-
    switch (type) {
      case Message.GET_METRICS:
        ws.send(JSON.stringify({ type: Message.METRICS_DATA, payload: getMetrics() }));
        break;
      // ... other cases
    }
>>>>>>> REPLACE
```
*補足: 応答メッセージの`type`も`'metrics-data'`から`Message.METRICS_DATA`に修正することが望ましいです。*

---

## 2. エラーハンドリングの不備 (UIへの通知漏れ)

**課題:** Agent側で発生した重要なフォールバック処理（Javaバージョンの代替実行など）がManager側のUIに通知されない。

**重要度:** 中

### 具体的な修正案

ユーザーが意図しない動作を認識できるよう、重要なフォールバックや警告が発生した際に、その情報をManagerに通知する仕組みを導入します。

#### 2.1. `agent/src/serverManager.js`の修正

指定されたJavaが見つからず、システムのデフォルト`java`にフォールバックする際に、Managerへ通知を送信します。

**対象ファイル:** [`agent/src/serverManager.js`](./agent/src/serverManager.js:442)

**修正方針:**
1. `startServer`関数に、WebSocketインスタンス (`ws`) を引数として渡せるようにします。
2. フォールバックが発生した箇所で、`ws.send()`を呼び出し、新しい警告メッセージを送信します。

**修正例:**
```javascript
// agent/src/serverManager.js L442付近

// ...
if (!fs.existsSync(javaPath)) {
    logger.warn(`Java version ${javaVersion} not found at ${javaPath}. Falling back to system default 'java'.`);
    
    // UIへの通知を追加
    if (ws) {
        ws.send(JSON.stringify({
            type: Message.NOTIFY_WARN, // 新しいプロトコル定数
            payload: {
                serverId: serverId,
                message: `指定されたJava ${javaVersion} が見つかりません。システムのデフォルトJavaで起動します。`
            }
        }));
    }

    javaPath = 'java'; // フォールバック
}
// ...
```
*注意: この修正には、`common/protocol.js`への`NOTIFY_WARN`定数の追加と、Manager側での受信ハンドリング実装が別途必要です。*

---

## 3. データコントラクトの不備 (未実装の機能)

**課題:** Agentから送信されるサーバーメトリクスが、実際の値ではなくダミーデータになっている。

**重要度:** 中

### 具体的な修正案

Node.jsの標準モジュールや、必要であれば外部ライブラリを導入し、実際のシステムメトリクスを取得・送信するように`getMetrics`関数を実装します。

#### 3.1. `agent/index.js`の`getMetrics`関数を実装

まずはNode.jsの`os`モジュールを利用して、CPUとメモリの使用率を実装します。

**対象ファイル:** [`agent/index.js`](./agent/index.js:47)

**修正例:**
```javascript
// agent/index.js

const os = require('os');

// ...

function getMetrics() {
    // CPU使用率 (簡易的な計算)
    // 本番環境では、より正確な計算のために計測期間を設けるべき
    const cpus = os.cpus();
    const totalCpuTime = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0);
    const totalIdleTime = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    // この関数が呼ばれるたびに計算すると差分が取れないため、実際には前回の値との差分で計算する必要がある。
    // ここでは簡易的にロードアベレージを使用する。
    const cpuUsage = os.loadavg()[0] / os.cpus().length;

    // メモリ使用率
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = usedMem / totalMem;

    // ディスク使用率 (要外部ライブラリ or コマンド実行)
    // ここではダミーのままにしておくが、将来的には 'systeminformation' などの導入を検討
    const diskUsage = Math.random();

    return {
        cpu: cpuUsage,
        ram: ramUsage,
        disk: diskUsage,
    };
}
```
*補足: 正確なCPU使用率の計算は複雑なため、`systeminformation`のようなライブラリを導入することが最も堅牢な解決策です。上記は`os`モジュールのみで実現可能な簡易実装です。*

---

## 4. 冗長なロジック (DRY原則違反)

**課題:** UIの描画ロジックと、バックグラウンドでのデータポーリング制御が密結合している。

**重要度:** 低

### 具体的な修正案

UIの描画 (`updateView`) とポーリングの制御を分離します。ポーリングの開始・停止は、ビューが切り替わる根本的なイベント（例: ナビゲーションクリック）ハンドラ内で明示的に行います。

#### 4.1. `manager/renderer.js`のリファクタリング

**対象ファイル:** [`manager/renderer.js`](./manager/renderer.js:12)

**修正方針:**
1.  `updateView`関数から`startGlobalMetricsLoop()`と`stopGlobalMetricsLoop()`の呼び出しを削除します。
2.  ナビゲーション要素（例: `#nav-dashboard`, `#nav-server-details`）のクリックイベントリスナーを修正します。
3.  クリックイベントリスナー内で、`showView(viewId)`を呼び出す直前・直後に、ビューIDに応じてポーリング制御関数を呼び出します。

**修正例:**
```javascript
// manager/renderer.js

// 1. updateViewからポーリング制御を削除
function updateView() {
    // ... (現在の描画ロジックのみ残す)
    // startGlobalMetricsLoop(); や stopGlobalMetricsLoop(); は削除
}

// 2. ナビゲーションイベントでポーリングを制御
document.querySelector('#nav-dashboard').addEventListener('click', () => {
    stopServerMetricsLoop(); // サーバー詳細のポーリングを停止
    startGlobalMetricsLoop(); // グローバルメトリクスのポーリングを開始
    showView('dashboard');
});

document.querySelector('#server-list').addEventListener('click', (event) => {
    const serverItem = event.target.closest('.server-item');
    if (serverItem) {
        stopGlobalMetricsLoop(); // グローバルメトリクスのポーリングを停止
        state.selectedServerId = serverItem.dataset.serverId;
        startServerMetricsLoop(state.selectedServerId); // 選択したサーバーのポーリングを開始
        showView('server-details');
    }
});

// showView関数自体は変更不要
function showView(viewId) {
    state.currentView = viewId;
    updateView();
}
```
このリファクタリングにより、`updateView`は状態を描画する責務に専念し、ポーリングのライフサイクル管理は関心事の発生源であるナビゲーションロジックに集約されます。
> **[完了済み]** このリファクタリングは、`manager/renderer.js` と `manager/renderer-ui.js` への変更を通じて実装されました。ポーリング制御は `renderer.js` に集約され、UI描画の責務と分離されています。