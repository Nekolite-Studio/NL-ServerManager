const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { loadJsonSync, saveJsonSync, resolvePath } = require('./utils/storage');

const SERVER_CONFIG_FILENAME = 'nl-server_manager.json';
const SCHEMA_VERSION = '1.0.0';

// インメモリでサーバー設定のリストをキャッシュする
const servers = new Map();

/**
 * デフォルトのサーバー設定を返す
 * @param {string} serverId 
 * @param {string} serverName 
 * @returns {object}
 */
function getDefaultServerConfig(serverId, serverName) {
    return {
        schema_version: SCHEMA_VERSION,
        server_id: serverId,
        server_name: serverName || `My Server (${serverId.substring(0, 8)})`,
        runtime: {
            java_path: null,
            jvm_args: ['-Xmx2G', '-Xms1G'],
            server_jar: 'server.jar',
        },
        status: 'stopped',
        auto_start: false,
    };
}

/**
 * 管理下の全ゲームサーバーの設定を読み込む
 * @param {string} serversDirectory - ゲームサーバーが格納されているディレクトリパス
 */
function loadAllServers(serversDirectory) {
    servers.clear();
    const resolvedServersDir = resolvePath(serversDirectory);
    if (!fs.existsSync(resolvedServersDir)) {
        console.log(`[ServerManager] Servers directory not found: ${resolvedServersDir}. No servers loaded.`);
        return;
    }

    const serverDirs = fs.readdirSync(resolvedServersDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const serverId of serverDirs) {
        const configPath = path.join(resolvedServersDir, serverId, SERVER_CONFIG_FILENAME);
        // loadJsonSync already calls resolvePath, so we don't need to do it twice.
        // However, for consistency and clarity in this file, we pass the unresolved path to loadJsonSync.
        const config = loadJsonSync(path.join(serversDirectory, serverId, SERVER_CONFIG_FILENAME));
        if (config) {
            // サーバーIDがディレクトリ名と一致しているか確認
            if (config.server_id !== serverId) {
                console.warn(`[ServerManager] Server ID in ${configPath} (${config.server_id}) does not match directory name (${serverId}). Skipping.`);
                continue;
            }
            servers.set(serverId, config);
        } else {
            console.warn(`[ServerManager] Config file not found or failed to load for server: ${serverId}`);
        }
    }
    console.log(`[ServerManager] Loaded ${servers.size} server(s).`);
}

/**
 * 指定されたIDのゲームサーバー設定を取得する
 * @param {string} serverId - サーバーID
 * @returns {object | undefined} - サーバー設定オブジェクト
 */
function getServer(serverId) {
    return servers.get(serverId);
}

/**
 * 全てのゲームサーバーのリストを取得する
 * @returns {Array<object>} - 全サーバー設定の配列
 */
function getAllServers() {
    return Array.from(servers.values());
}

/**
 * ゲームサーバー設定を更新または新規作成する
 * @param {string} serversDirectory - ゲームサーバーが格納されているディレクトリパス
 * @param {string} serverId - サーバーID (新規の場合はnull)
 * @param {object} serverConfig - 更新する設定データ
 * @returns {object | null} - 更新/作成後のサーバー設定オブジェクト、または失敗した場合はnull
 */
function updateServer(serversDirectory, serverId, serverConfig) {
    const id = serverId || uuidv4();
    // serversDirectoryは既に解決済みなので、ここではpath.joinのみ使用
    const serverDir = path.join(serversDirectory, id);
    const configPath = path.join(serverDir, SERVER_CONFIG_FILENAME);

    // 新規作成時のみ、ディレクトリの存在をチェック
    if (!serverId && fs.existsSync(serverDir)) {
        console.error(`[ServerManager] Attempted to create a server that already exists: ${id} at ${serverDir}`);
        return null;
    }

    let finalConfig;
    if (serverId) { // 更新
        const existingConfig = servers.get(id);
        if (!existingConfig) {
            console.error(`[ServerManager] Attempted to update non-existent server: ${id}`);
            return null;
        }
        finalConfig = { ...existingConfig, ...serverConfig, server_id: id };
    } else { // 新規作成
        // 渡されたconfigを適用しつつ、server_idは必ずここで生成したUUIDで上書きする
        finalConfig = { ...getDefaultServerConfig(id), ...serverConfig, server_id: id };
    }

    // saveJsonSyncは解決済みのパスを受け取ることを想定しているため、ここでは解決しない
    const { success, resolvedPath } = saveJsonSync(configPath, finalConfig);
    if (success) {
        servers.set(id, finalConfig);
        // 呼び出し元でパスを利用できるよう、設定と解決済みパスを返す
        return { config: finalConfig, path: resolvedPath };
    }
    return null;
}

/**
 * サーバーを削除する
 * @param {string} serversDirectory 
 * @param {string} serverId 
 * @returns {boolean}
 */
function deleteServer(serversDirectory, serverId) {
    // serversDirectoryは既に解決済み
    const serverDir = path.join(serversDirectory, serverId);
    
    if (!servers.has(serverId) && !fs.existsSync(serverDir)) {
        console.warn(`[ServerManager] Attempted to delete a server that does not exist on disk or in memory: ${serverId}`);
        return { success: true, path: serverDir }; // 存在しないので、結果的に削除成功と同じ状態
    }

    try {
        if (fs.existsSync(serverDir)) {
            fs.rmSync(serverDir, { recursive: true, force: true });
            console.log(`[ServerManager] Deleted server directory ${serverDir}.`);
        }
        if (servers.has(serverId)) {
            servers.delete(serverId);
            console.log(`[ServerManager] Deleted server ${serverId} from memory.`);
        }
        return { success: true, path: serverDir };
    } catch (error) {
        console.error(`[ServerManager] Failed to delete server directory ${serverDir}:`, error);
        return { success: false, path: serverDir };
    }
}

module.exports = {
    loadAllServers,
    getServer,
    getAllServers,
    updateServer,
    deleteServer,
};