const Store = require('electron-store');

// スキーマを定義して、データの型とデフォルト値を保証する
const schema = {
    agents: {
        type: 'array',
        default: [],
        items: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                ip: { type: 'string' },
                port: { type: 'number' },
                alias: { type: 'string' }
            },
            required: ['id', 'ip', 'port', 'alias']
        }
    },
    windowBounds: {
        type: 'object',
        properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            x: { type: 'number' },
            y: { type: 'number' }
        },
        default: {
            width: 1200,
            height: 800,
            x: undefined,
            y: undefined
        }
    }
};

let store;

try {
    store = new Store({ schema });
} catch (error) {
    console.error('Config schema violation detected. Clearing stored data and re-initializing.', error);
    // 不正な設定ファイルをクリアする
    const storeForClear = new Store();
    storeForClear.clear();
    // 再度初期化を試みる
    store = new Store({ schema });
    console.log('Store has been cleared and re-initialized.');
}

/**
 * 保存されているすべてのAgent設定を取得する
 * @returns {Array<object>} - Agent設定の配列
 */
function getAgents() {
    return store.get('agents');
}

/**
 * Agent設定を保存する（リスト全体を上書き）
 * @param {Array<object>} agents - 保存するAgent設定の配列
 */
function setAgents(agents) {
    store.set('agents', agents);
}

/**
 * ウィンドウサイズを保存する
 * @param {{width: number, height: number}} bounds - ウィンドウの幅と高さ
 */
function setWindowBounds(bounds) {
    store.set('windowBounds', bounds);
}

/**
 * 保存されているウィンドウサイズを取得する
 * @returns {{width: number, height: number}} - ウィンドウの幅と高さ
 */
function getWindowBounds() {
    return store.get('windowBounds');
}

module.exports = {
    getAgents,
    setAgents,
    getWindowBounds,
    setWindowBounds,
};