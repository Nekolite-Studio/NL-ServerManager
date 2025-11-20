import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { ServerStatus, Message } from '@nl-server-manager/common/protocol.js';
import { ServerPropertiesSchema } from '@nl-server-manager/common/property-schema.js';
import { loadJsonSync, saveJsonSync, resolvePath, readJson, writeJson } from '../utils/storage.js';
import { getJsonFromUrl, downloadFile } from './fileService.js';
import { resolveJavaExecutable } from './javaService.js';

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
function getDefaultServerConfig(serverId, serverName, runtimeConfig = {}) {
    // 日付フォーマット: YY-MM-DD_hh:mm:ss
    const now = new Date();
    const formattedDate = now.toISOString().replace(/T/, '_').replace(/\..+/, '').slice(2);

    const defaultConfig = {
        schema_version: SCHEMA_VERSION,
        server_id: serverId,
        // デフォルト名: New Server {version} {UUIDの最初}
        // serverName引数が渡された場合はそれを使用するが、通常はnullで渡される想定
        server_name: serverName || `New Server ${runtimeConfig.versionId || ''} ${serverId.substring(0, 8)}`.trim().replace(/\s+/g, ' '),
        runtime: {
            java_path: null,
            java_version: null,
            jvm_args: ['-Xmx2G', '-Xms1G'],
            server_jar: 'server.jar',
            ...runtimeConfig
        },
        status: ServerStatus.STOPPED,
        logs: [],
        auto_start: false,
        memo: formattedDate, // デフォルトメモ: 作成日時
    };
    return defaultConfig;
}

/**
 * サーバー設定から最大メモリ量（MB）を取得する。-Xmx引数をフォールバックとして使用する。
 * @param {object} serverConfig
 * @returns {number}
 */
function getMaxMemoryFromConfig(serverConfig) {
    if (serverConfig?.runtime?.max_memory) {
        return serverConfig.runtime.max_memory;
    }
    if (serverConfig?.runtime?.jvm_args) {
        const xmxArg = serverConfig.runtime.jvm_args.find(arg => arg.startsWith('-Xmx'));
        if (xmxArg) {
            const value = xmxArg.substring(4).toUpperCase();
            const number = parseInt(value, 10);
            if (value.endsWith('G')) {
                return number * 1024;
            }
            if (value.endsWith('M')) {
                return number;
            }
        }
    }
    return 0; // 不明な場合は0
}

/**
 * Forgeサーバーをインストールする
 * @param {string} serverDir
 * @param {string} mcVersion
 * @param {string} forgeVersion
 * @param {string} javaExecutable
 * @param {function} onProgress
 */
async function installForgeServer(serverDir, mcVersion, forgeVersion, javaExecutable, onProgress) {
    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVersion}/forge-${mcVersion}-${forgeVersion}-installer.jar`;
    const installerPath = path.join(serverDir, 'installer.jar');

    console.log(`[ServerManager] Downloading Forge Installer from ${installerUrl}`);
    onProgress({ status: 'downloading', message: 'Forgeインストーラーをダウンロード中...', progress: 0 });

    await downloadFile(installerUrl, installerPath, (p) => {
        onProgress({ status: 'downloading', message: `Forgeインストーラーをダウンロード中... ${p}%`, progress: p });
    });

    onProgress({ status: 'installing', message: 'Forgeサーバーをインストール中 (これには時間がかかります)...', progress: 0 });
    console.log(`[ServerManager] Running Forge Installer...`);

    return new Promise((resolve, reject) => {
        // インストーラーはメモリを大量に消費する場合があるため、ヒープサイズを増やす
        // また、IPv4優先、ヘッドレスモード明示、G1GC使用でパフォーマンス改善を図る
        const installerArgs = [
            '-Xmx4G',
            '-Djava.net.preferIPv4Stack=true',
            '-Djava.awt.headless=true',
            '-XX:+UseG1GC',
            '-jar',
            'installer.jar',
            '--installServer'
        ];
        
        const process = spawn(javaExecutable, installerArgs, {
            cwd: serverDir,
            stdio: 'inherit'
        });

        process.on('close', (code) => {
            if (code === 0) {
                console.log('[ServerManager] Forge installation successful.');
                // Cleanup
                try {
                    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
                    const logFile = path.join(serverDir, 'installer.jar.log');
                    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
                } catch (e) {
                    console.warn('[ServerManager] Failed to cleanup installer files:', e);
                }
                resolve();
            } else {
                reject(new Error(`Forge installation failed with code ${code}`));
            }
        });

        process.on('error', (err) => reject(err));
    });
}

/**
 * Forgeの引数ファイルを探す
 * @param {string} serverDir
 * @returns {string|null}
 */
function findForgeArgsFile(serverDir) {
    const forgeDir = path.join(serverDir, 'libraries', 'net', 'minecraftforge', 'forge');
    if (!fs.existsSync(forgeDir)) return null;

    const versions = fs.readdirSync(forgeDir);
    for (const ver of versions) {
        const argsPath = path.join(forgeDir, ver, 'unix_args.txt');
        if (fs.existsSync(argsPath)) return argsPath;
    }
    return null;
}

/**
 * 管理下の全ゲームサーバーの設定を読み込み、プロセスの実在確認を行う
 * @param {string} serversDirectory - ゲームサーバーが格納されているディレクトリパス
 */
export async function loadAllServers(serversDirectory) {
    servers.clear();
    const resolvedServersDir = resolvePath(serversDirectory);

    if (!fs.existsSync(resolvedServersDir)) {
        console.log(`[ServerManager] Servers directory not found: ${resolvedServersDir}. No servers loaded.`);
        return;
    }

    // 最初にディスクからすべてのサーバー設定を読み込む
    const serverDirs = fs.readdirSync(resolvedServersDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const serverId of serverDirs) {
        const configPath = path.join(serversDirectory, serverId, SERVER_CONFIG_FILENAME);
        const config = loadJsonSync(configPath);
        if (config && config.server_id === serverId) {
            config.logs = config.logs || [];
            // メモリ上の状態は、まずすべて 'stopped' として初期化
            config.status = ServerStatus.STOPPED;
            servers.set(serverId, config);
        } else {
            console.warn(`[ServerManager] Config file not found or invalid for server: ${serverId}`);
        }
    }
    console.log(`[ServerManager] Loaded ${servers.size} server(s) from disk.`);
}

/**
 * 指定されたIDのゲームサーバー設定を取得する
 * @param {string} serverId - サーバーID
 * @returns {object | undefined} - サーバー設定オブジェクト
 */
export function getServer(serverId) {
    return servers.get(serverId);
}

/**
 * 全てのゲームサーバーのリストを取得する
 * @returns {Array<object>} - 全サーバー設定の配列
 */
export function getAllServers() {
    return Array.from(servers.values());
}

/**
 * ゲームサーバー設定を更新または新規作成する
 * @param {string} serversDirectory - ゲームサーバーが格納されているディレクトリパス
 * @param {string} serverId - サーバーID (新規の場合はnull)
 * @param {object} serverConfig - 更新する設定データ
 * @param {function} onProgress - 進捗を通知するためのコールバック関数
 * @returns {object | null} - 更新/作成後のサーバー設定オブジェクト、または失敗した場合はnull
 */
export async function createServer(serversDirectory, serverConfig, onProgress = () => { }) {
    const { versionId, serverType, loaderVersion, runtime, ...restConfig } = serverConfig;
    const id = uuidv4();
    const serverDir = path.join(serversDirectory, id);
    const configPath = path.join(serverDir, SERVER_CONFIG_FILENAME);

    if (fs.existsSync(serverDir)) {
        console.error(`[ServerManager] Attempted to create a server that already exists: ${id} at ${serverDir}`);
        return null;
    }

    try {
        fs.mkdirSync(serverDir, { recursive: true });
        console.log(`[ServerManager] Created server directory: ${serverDir}`);
    } catch (error) {
        console.error(`[ServerManager] Failed to create server directory ${serverDir}:`, error);
        return null;
    }

    // versionIdが必須であることを確認
    if (!versionId) {
        console.error('[ServerManager] createServer requires a versionId.');
        // クリーンアップ
        fs.rmSync(serverDir, { recursive: true, force: true });
        return null;
    }

    console.log(`[ServerManager] Creating server: ${versionId} (${serverType || 'vanilla'})`);

    try {
        if (serverType === 'forge') {
            if (!loaderVersion) throw new Error('Forge version (loaderVersion) is required for Forge servers.');

            // Javaパスを解決する
            // createServer時点では runtime.java_version が渡されているはず
            const javaExecutable = resolveJavaExecutable(runtime);

            await installForgeServer(serverDir, versionId, loaderVersion, javaExecutable, onProgress);
        } else {
            // Vanilla (Default)
            console.log(`[ServerManager] versionId specified: ${versionId}. Starting download process.`);
            const manifest = await getJsonFromUrl('https://launchermeta.mojang.com/mc/game/version_manifest.json');
            const versionInfo = manifest.versions.find(v => v.id === versionId);
            if (!versionInfo) {
                throw new Error(`Version ${versionId} not found in version manifest.`);
            }
            const versionDetails = await getJsonFromUrl(versionInfo.url);
            const serverJarUrl = versionDetails.downloads?.server?.url;
            if (!serverJarUrl) {
                throw new Error(`Server JAR download URL not found for version ${versionId}.`);
            }
            const destPath = path.join(serverDir, 'server.jar');
            console.log(`[ServerManager] Downloading server.jar for version ${versionId} from ${serverJarUrl} to ${destPath}`);

            onProgress({ status: 'downloading', message: `サーバーJAR (v${versionId}) をダウンロード中...`, progress: 0 });
            await downloadFile(serverJarUrl, destPath, (progress) => {
                onProgress({ status: 'downloading', message: `サーバーJARをダウンロード中... ${progress}%`, progress });
            });
            onProgress({ status: 'downloaded', message: 'ダウンロード完了', progress: 100 });

            console.log(`[ServerManager] Successfully downloaded server.jar.`);
        }
    } catch (error) {
        console.error(`[ServerManager] Failed to create server for version ${versionId}:`, error);
        fs.rmSync(serverDir, { recursive: true, force: true });
        console.log(`[ServerManager] Cleaned up directory ${serverDir} due to failure.`);
        throw error;
    }

    // runtimeにversionIdを含めてgetDefaultServerConfigに渡すことで、デフォルト名にバージョンを含める
    const runtimeWithVersion = { ...runtime, versionId };
    const finalConfig = getDefaultServerConfig(id, restConfig.server_name, runtimeWithVersion);

    // サーバータイプとローダーバージョンを保存
    finalConfig.server_type = serverType || 'vanilla';
    finalConfig.loader_version = loaderVersion || null;

    // java_versionが存在すれば、保存前に必ず文字列に変換する
    if (finalConfig.runtime && finalConfig.runtime.java_version != null) {
        finalConfig.runtime.java_version = String(finalConfig.runtime.java_version);
    }

    const { success, resolvedPath } = saveJsonSync(configPath, finalConfig);

    if (success) {
        servers.set(id, finalConfig);
        return { config: finalConfig, path: resolvedPath };
    }

    // 設定ファイルの保存に失敗した場合もクリーンアップ
    fs.rmSync(serverDir, { recursive: true, force: true });
    console.log(`[ServerManager] Cleaned up directory ${serverDir} due to config save failure.`);
    throw new Error('Failed to save server configuration.');
}

/**
 * 既存のゲームサーバー設定を更新する
 * @param {string} serversDirectory - ゲームサーバーが格納されているディレクトリパス
 * @param {string} serverId - 更新するサーバーのID
 * @param {object} serverConfig - 更新する設定データ
 * @returns {object | null} - 更新後のサーバー設定オブジェクト、または失敗した場合はnull
 */
export async function updateServer(serversDirectory, serverId, serverConfig) {
    if (!serverId) {
        console.error('[ServerManager] updateServer requires a serverId.');
        return null;
    }
    const existingConfig = servers.get(serverId);
    if (!existingConfig) {
        console.error(`[ServerManager] Attempted to update non-existent server: ${serverId}`);
        return null;
    }

    const serverDir = path.join(serversDirectory, serverId);
    const configPath = path.join(serverDir, SERVER_CONFIG_FILENAME);

    // versionId in update is not supported for now.
    const { versionId, ...restConfig } = serverConfig;
    if (versionId) {
        console.warn(`[ServerManager] Updating server version is not supported. Ignoring versionId.`);
    }

    // ネストされたruntimeオブジェクトを安全にマージする
    const newRuntime = { ...(existingConfig.runtime || {}), ...(restConfig.runtime || {}) };
    const finalConfig = { ...existingConfig, ...restConfig, runtime: newRuntime, server_id: serverId };
    if (!finalConfig.logs) finalConfig.logs = [];

    const { success, resolvedPath } = saveJsonSync(configPath, finalConfig);
    if (success) {
        servers.set(serverId, finalConfig);
        return { config: finalConfig, path: resolvedPath };
    }

    return null; // Failed to save
}

/**
 * サーバーを削除する
 * @param {string} serversDirectory 
 * @param {string} serverId 
 * @returns {boolean}
 */
export async function deleteServer(serversDirectory, serverId) {
    // serversDirectoryは既に解決済み
    const serverDir = path.join(serversDirectory, serverId);

    if (!servers.has(serverId) && !fs.existsSync(serverDir)) {
        console.warn(`[ServerManager] Attempted to delete a server that does not exist on disk or in memory: ${serverId}`);
        return { success: true, path: serverDir }; // 存在しないので、結果的に削除成功と同じ状態
    }

    try {
        if (fs.existsSync(serverDir)) {
            await fs.promises.rm(serverDir, { recursive: true, force: true });
            console.log(`[ServerManager] Deleted server directory ${serverDir}.`);
        }
        if (servers.has(serverId)) {
            servers.delete(serverId);
            console.log(`[ServerManager] Deleted server ${serverId} from memory.`);
        }
        return { success: true, path: serverDir };
    } catch (error) {
        console.error(`[ServerManager] Failed to delete server directory ${serverDir}:`, error);
        return { success: false, path: serverDir, error: error.message };
    }
}

// 状態管理用のMapを共有
export { servers, getMaxMemoryFromConfig, findForgeArgsFile };