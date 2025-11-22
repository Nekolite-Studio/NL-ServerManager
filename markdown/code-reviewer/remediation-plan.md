# コード品質改善 修正計画書

このドキュメントは、[`issues.md`](./issues.md)で特定された問題点に対する、詳細かつ実行可能な修正計画を定義します。

---

## 1. プロトコル定義の一貫性の欠如 (マジックストリングの使用)

**重要度:** 高

**問題:** `manager`と`agent`間の通信において、[`common/protocol.js`](./common/protocol.js:6)で定義されたメッセージ定数を使わず、ハードコードされた文字列（マジックストリング）が使用されている箇所が複数存在します。これにより、プロトコル仕様の変更時に追跡が困難になり、バグの温床となります。

**実行可能な修正案:**

ハードコードされた文字列を、[`common/protocol.js`](./common/protocol.js:6)で定義されている`Message`オブジェクトの定数に置き換えます。

1.  **対象ファイル:** [`manager/main.js`](./manager/main.js:109)
    *   **修正内容:** `ws.on('message', ...)` 内の `switch` 文で、`'progress-update'` のような文字列リテラルを `Message.PROGRESS_UPDATE` などの定数参照に全て変更します。
    *   **例:**
        ```javascript
        // 修正前
        case 'progress-update':
        // 修正後
        case Message.PROGRESS_UPDATE:
        ```

2.  **対象ファイル:** [`agent/index.js`](./agent/index.js:138)
    *   **修正内容:** `ws.on('message', ...)` 内の `switch` 文で、`'get-metrics'` という文字列リテラルを `Message.GET_METRICS` 定数に置き換えます。
    *   **例:**
        ```javascript
        // 修正前
        case 'get-metrics':
        // 修正後
        case Message.GET_METRICS:
        ```

---

## 2. エラーハンドリングの不備 (UIへの通知漏れ)

**重要度:** 中

**問題:** Agent側で発生した重要なフォールバック処理やエラーが、UI（Manager側）に適切に通知されていません。これにより、ユーザーはシステムの実際の動作を誤解する可能性があります。

**実行可能な修正案:**

`agent`側で重要なフォールバックが発生した際に、その情報を`manager`へ通知する仕組みを実装します。

1.  **対象ファイル:** [`agent/src/serverManager.js`](./agent/src/serverManager.js:442)
    *   **修正内容:** `startServer`関数内で、指定されたJavaバージョンが見つからずにシステムのデフォルトJavaへフォールバックするロジックに、WebSocket経由で`manager`へ通知する処理を追加します。
    *   **実装方針:**
        *   新しいメッセージタイプ `Message.OPERATION_WARNING` を [`common/protocol.js`](./common/protocol.js:6) に追加します。
        *   フォールバック発生時、`serverManager`は`agent`のWebSocketサーバーインスタンスを通じて、`{ type: Message.OPERATION_WARNING, payload: { message: '指定されたJavaバージョンが見つからず、システムのデフォルトを使用しました。' } }` のようなメッセージを送信します。
        *   この通知は、操作をリクエストした`requestId`と関連付けることが望ましいです。

2.  **対象ファイル:** [`manager/main.js`](./manager/main.js)
    *   **修正内容:** `agent`から`OPERATION_WARNING`メッセージを受信した場合、その内容をRendererプロセスに中継するIPC通信を追加します。

3.  **対象ファイル:** [`manager/renderer.js`](./manager/renderer.js)
    *   **修正内容:** Mainプロセスから警告情報を受け取り、[`manager/src/ui/components/notification.js`](./manager/src/ui/components/notification.js)を利用してユーザーにトースト通知などを表示する処理を実装します。

---

## 3. データコントラクトの不備 (未実装の機能)

**重要度:** 中

**問題:** プロトコルとして定義されているにも関わらず、重要な機能がダミーデータまたは未実装のままになっています。

**実行可能な修正案:**

`agent`に実際のシステムメトリクスを取得する機能を実装します。

1.  **依存関係の追加 (`agent`):**
    *   `agent`のディレクトリで `npm install systeminformation` を実行し、ライブラリをプロジェクトに追加します。

2.  **対象ファイル:** [`agent/index.js`](./agent/index.js:47)
    *   **修正内容:** `getMetrics`関数を、`systeminformation`ライブラリを使用して実際のシステム情報を取得するように書き換えます。
    *   **実装方針:**
        *   `systeminformation`の`currentLoad()` (CPU)、`mem()` (メモリ)、`fsSize()` (ディスク) などの関数を利用します。
        *   非同期で取得したデータを整形し、プロトコルに定義された形式で返却します。
        ```javascript
        const si = require('systeminformation');

        async function getMetrics() {
            const [cpu, mem, fs] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize()
            ]);
            
            return {
                cpu: cpu.currentLoad.toFixed(2),
                ram: {
                    total: mem.total,
                    used: mem.used,
                    free: mem.free,
                },
                disk: {
                    total: fs[0].size,
                    used: fs[0].used,
                    free: fs[0].size - fs[0].used,
                }
            };
        }
        ```
    *   `'get-metrics'` 受信時の処理を非同期に対応させます。

---

## 4. 冗長なロジック (DRY原則違反)

**重要度:** 低

**問題:** UIロジックと状態管理において、類似した処理や責任が複数の箇所に分散しており、コードの重複が見られます。

**実行可能な修正案:**

UI描画の責務と、バックグラウンドでのデータポーリング制御の責務を分離します。

1.  **対象ファイル:** [`manager/renderer.js`](./manager/renderer.js:12)
    *   **修正内容:** `updateView`関数から `startGlobalMetricsLoop()` と `stopGlobalMetricsLoop()` の呼び出しを削除します。`updateView`はUIの表示切り替えにのみ責任を持つようにします。

2.  **対象ファイル:** [`manager/renderer.js`](./manager/renderer.js)
    *   **修正内容:** ポーリングの開始と停止は、ビューを切り替えるためのナビゲーションイベントハンドラ（例: `document.getElementById('nav-servers').addEventListener('click', ...)`など）内で明示的に呼び出すように変更します。
    *   **実装方針:**
        *   物理サーバー詳細ビューを表示するイベントハンドラ内で `startGlobalMetricsLoop()` を呼び出します。
        *   他のビュー（サーバーリストなど）に切り替えるイベントハンドラ内で `stopGlobalMetricsLoop()` を呼び出します。これにより、ポーリングが必要な時だけ実行されることが保証されます。