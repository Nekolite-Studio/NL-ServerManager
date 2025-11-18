import { loadJsonSync, saveJsonSync, resolvePath } from './utils/storage.js';

const SETTINGS_FILE_PATH = '~/.nekolite/server-manager/mc/agent/settings.json';
const SCHEMA_VERSION = '1.0.0';

// インメモリで設定をキャッシュする
let agentSettings = null;

/**
 * デフォルトのAgent設定を返す
 * @returns {object}
 */
function getDefaultSettings() {
  return {
    schema_version: SCHEMA_VERSION,
    servers_directory: '~/.nekolite/server-manager/mc/agent/servers',
    api: {
      port: 8080,
    },
    log_level: 'info',
  };
}

/**
 * Agent設定を初期化または読み込みする。
 * ファイルが存在しない場合はデフォルト設定で作成する。
 * @returns {object} - Agent設定オブジェクト
 */
function initializeSettings() {
  if (agentSettings) {
    return agentSettings;
  }

  let settings = loadJsonSync(SETTINGS_FILE_PATH);

  if (!settings) {
    console.log('[SettingsManager] Settings file not found. Creating with default settings...');
    settings = getDefaultSettings();
    // 修正箇所: saveJsonSyncはオブジェクトを返すため、successプロパティを分割代入で取得
    const { success } = saveJsonSync(SETTINGS_FILE_PATH, settings);
    
    if (!success) {
        // 保存に失敗した場合は、致命的なエラーとしてプロセスを終了するか、
        // フォールバックとしてデフォルト設定をメモリ上でのみ使用する。
        // ここでは後者を選択する。
        console.error('[SettingsManager] CRITICAL: Failed to save initial settings file. Using in-memory defaults.');
    }
  }

  // TODO: スキーマバージョンの比較とマイグレーション処理を将来的にここに追加する
  
  // パスを解決して絶対パスに変換しておく
  settings.servers_directory = resolvePath(settings.servers_directory);

  agentSettings = settings;
  console.log('[SettingsManager] Settings loaded successfully.');
  return agentSettings;
}

/**
 * 現在のAgent設定を取得する。
 * initializeSettingsが呼ばれていない場合はエラーを投げる。
 * @returns {object} - Agent設定オブジェクト
 */
function getSettings() {
  if (!agentSettings) {
    throw new Error('Settings have not been initialized. Call initializeSettings() first.');
  }
  return agentSettings;
}

/**
 * Agent設定をファイルに保存する。
 * @param {object} settings - 保存する設定オブジェクト
 * @returns {boolean} - 保存の成否
 */
function saveSettings(settings) {
  // 修正箇所: successプロパティを取得
  const { success } = saveJsonSync(SETTINGS_FILE_PATH, settings);
  
  if (success) {
    // インメモリキャッシュも更新
    agentSettings = { ...settings };
    // パスを解決し直す
    agentSettings.servers_directory = resolvePath(agentSettings.servers_directory);
  }
  return success;
}

export {
  initializeSettings,
  getSettings,
  saveSettings,
};