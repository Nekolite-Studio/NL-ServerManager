import { dialog, app } from 'electron';
import Store from 'electron-store';
import fs from 'fs';

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
            width: 1280,
            height: 720,
            x: undefined,
            y: undefined
        }
    },
    apiCache: {
        type: 'object',
        default: {},
        additionalProperties: { // 動的なキー（APIエンドポイントなど）を許可
            type: 'object',
            properties: {
                timestamp: { type: 'number' },
                data: {} // 任意のデータ型を許可
            },
            required: ['timestamp', 'data']
        }
    }
};

let store;

try {
    store = new Store({ schema });
} catch (error) {
    console.error('Config schema violation detected. Attempting to handle safely.', error);
    
    const storeInstance = new Store();
    const configPath = storeInstance.path;
    const backupPath = `${configPath}.${Date.now()}.bak`;

    try {
        // 設定ファイルをバックアップ
        fs.renameSync(configPath, backupPath);
        console.log(`Backed up corrupted config to: ${backupPath}`);
    } catch (backupError) {
        console.error(`Failed to backup corrupted config file: ${backupError}`);
        // バックアップに失敗した場合は、ユーザーに致命的なエラーを通知するしかない
        dialog.showErrorBox(
            '致命的な設定エラー',
            `設定ファイルの読み込みに失敗し、バックアップも作成できませんでした。\nエラー: ${backupError.message}\nアプリケーションを再インストールする必要があるかもしれません。`
        );
        // アプリケーションを終了させる
        app.quit();
    }

    // ユーザーに状況を通知し、対応を選択させる
    const userChoice = dialog.showMessageBoxSync({
        type: 'warning',
        title: '設定ファイルが破損しています',
        message: '設定ファイルが破損しているか、古い形式の可能性があります。',
        detail: `以前の設定はバックアップされました。\n新しい設定でアプリケーションを続行しますか？\n\nバックアップ場所: ${backupPath}`,
        buttons: ['新しい設定で続行', 'アプリケーションを終了'],
        defaultId: 0,
        cancelId: 1
    });

    if (userChoice === 0) {
        // ユーザーが続行を選択した場合、ストアをクリアして再初期化
        storeInstance.clear();
        store = new Store({ schema });
        console.log('Store has been cleared and re-initialized based on user choice.');
    } else {
        // ユーザーが終了を選択した場合
        app.quit();
    }
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

export {
    getAgents,
    setAgents,
    getWindowBounds,
    setWindowBounds,
    getApiCache,
    setApiCache,
};

/**
 * 保存されているAPIキャッシュ全体を取得する
 * @returns {object} - APIキャッシュオブジェクト
 */
function getApiCache() {
    return store.get('apiCache');
}

/**
 * APIキャッシュを保存する（全体を上書き）
 * @param {object} cache - 保存するAPIキャッシュオブジェクト
 */
function setApiCache(cache) {
    store.set('apiCache', cache);
}