import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { Rcon } from 'rcon-client';
import * as tar from 'tar';
import unzipper from 'unzipper';
import si from 'systeminformation';
import { loadJsonSync, saveJsonSync, resolvePath, readJson, writeJson } from './utils/storage.js';
import { Message, ServerStatus } from '@nl-server-manager/common/protocol.js';
import { ServerPropertiesSchema } from '@nl-server-manager/common/property-schema.js';

const SERVER_CONFIG_FILENAME = 'nl-server_manager.json';
const SCHEMA_VERSION = '1.0.0';

// インメモリでサーバー設定のリストをキャッシュする
const servers = new Map();
// 実行中のサーバープロセスを管理する
const runningProcesses = new Map();
// 実行中のRCONクライアントを管理する
const runningRconClients = new Map();
// 実行中のメトリクス収集インターバルを管理する
const metricsIntervals = new Map();

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
 * URLからJSONデータを取得してパースするヘルパー関数
 * @param {string} url
 * @returns {Promise<object>}
 */
function getJsonFromUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(new URL(url), (res) => {
            const { statusCode, headers } = res;
            if (statusCode >= 300 && statusCode < 400 && headers.location) {
                getJsonFromUrl(new URL(headers.location, url).href).then(resolve, reject);
                res.resume();
                return;
            }
            if (statusCode !== 200) {
                const error = new Error(`Request Failed. Status Code: ${statusCode}`);
                res.resume();
                reject(error);
                return;
            }
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(rawData));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        }).on('error', (e) => {
            reject(new Error(`Got error: ${e.message}`));
        });
    });
}

/**
 * URLからファイルをダウンロードするヘルパー関数
 * @param {string} url
 * @param {string} destPath
 * @param {function} onProgress - 進捗を通知するコールバック関数 (progress, downloadedSize, totalSize)
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath, onProgress = () => { }) {
    return new Promise((resolve, reject) => {
        const request = (currentUrl) => {
            https.get(new URL(currentUrl), (response) => {
                const { statusCode, headers } = response;

                if (statusCode >= 300 && statusCode < 400 && headers.location) {
                    // リダイレクトを追跡
                    request(new URL(headers.location, currentUrl).href);
                    response.resume(); // consume response data to free up memory
                    return;
                }

                if (statusCode !== 200) {
                    response.resume();
                    reject(new Error(`Request failed. Status code: ${statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(destPath);
                const totalSize = parseInt(headers['content-length'], 10);
                let downloadedSize = 0;
                let lastNotifiedProgress = -1;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize) {
                        const progress = Math.floor((downloadedSize / totalSize) * 100);
                        // 1%単位で通知する
                        if (progress > lastNotifiedProgress) {
                            onProgress(progress, downloadedSize, totalSize);
                            lastNotifiedProgress = progress;
                        }
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close((err) => {
                        if (err) {
                            fs.unlink(destPath, () => reject(err));
                        } else {
                            if (lastNotifiedProgress < 100) {
                                onProgress(100, totalSize, totalSize);
                            }
                            resolve();
                        }
                    });
                });

                file.on('error', (err) => {
                    fs.unlink(destPath, () => reject(err));
                });

            }).on('error', (err) => {
                reject(err);
            });
        };

        request(url);
    });
}

/**
 * Javaのインストールディレクトリパスを生成する
 * @param {string} javaVersion - Javaのバージョン (例: jdk-17.0.8.7-hotspot)
 * @returns {string} - 解決されたJavaインストールディレクトリのフルパス
 */
function getJavaInstallDir(javaVersion) {
    return resolvePath(path.join('~', '.nekolite', 'java', javaVersion));
}

/**
 * 指定されたアーカイブファイルを指定されたディレクトリに展開する
 * @param {string} archivePath - アーカイブファイルへのパス
 * @param {string} destDir - 展開先のディレクトリ
 * @returns {Promise<void>}
 */
function extractArchive(archivePath, destDir, onProgress = () => { }) {
    return new Promise((resolve, reject) => {
        const fileExtension = path.extname(archivePath);
        console.log(`[ServerManager] Extracting ${archivePath} to ${destDir}`);

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const onEntry = (entry) => {
            // strip: 1 に相当する処理
            const strippedPath = entry.path.split(path.sep).slice(1).join(path.sep);
            if (!strippedPath) return; // 親ディレクトリ自体はスキップ
            const destPath = path.join(destDir, strippedPath);

            if (entry.type === 'Directory') {
                fs.mkdirSync(destPath, { recursive: true });
                entry.autodrain();
            } else {
                entry.pipe(fs.createWriteStream(destPath))
                    .on('error', reject);
            }
        };

        const sourceStream = fs.createReadStream(archivePath);
        const totalSize = fs.statSync(archivePath).size;
        let extractedSize = 0;
        let lastNotifiedProgress = -1;

        sourceStream.on('data', (chunk) => {
            extractedSize += chunk.length;
            const progress = Math.floor((extractedSize / totalSize) * 100);
            if (progress > lastNotifiedProgress) {
                onProgress({ status: 'extracting', message: `アーカイブを展開中... ${progress}%`, progress });
                lastNotifiedProgress = progress;
            }
        });

        onProgress({ status: 'extracting', message: 'アーカイブを展開中...', progress: 0 });

        if (fileExtension === '.zip') {
            sourceStream.pipe(unzipper.Parse())
                .on('entry', onEntry)
                .on('finish', () => {
                    if (lastNotifiedProgress < 100) {
                        onProgress({ status: 'extracting', message: '展開完了', progress: 100 });
                    }
                    onProgress({ status: 'extracted', message: '展開完了', progress: 100 });
                    console.log(`[ServerManager] Successfully extracted ${archivePath}`);
                    resolve();
                })
                .on('error', reject);

        } else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz') || archivePath.endsWith('.gz')) {
            sourceStream.pipe(tar.x({
                cwd: destDir,
                strip: 1,
            }))
                .on('finish', () => {
                    if (lastNotifiedProgress < 100) {
                        onProgress({ status: 'extracting', message: '展開完了', progress: 100 });
                    }
                    onProgress({ status: 'extracted', message: '展開完了', progress: 100 });
                    console.log(`[ServerManager] Successfully extracted ${archivePath}`);
                    resolve();
                })
                .on('error', reject);
        } else {
            reject(new Error(`Unsupported archive format: ${fileExtension}`));
        }
    });
}

/**
 * インストールされたJavaの実行可能ファイルへのパスを返す
 * @param {string} javaInstallDir - Javaのインストールディレクトリ
 * @returns {string} - Java実行可能ファイルへのフルパス
 */
function getJavaExecutablePath(javaInstallDir) {
    let javaPath;
    if (process.platform === 'win32') {
        javaPath = path.join(javaInstallDir, 'bin', 'java.exe');
    } else {
        javaPath = path.join(javaInstallDir, 'bin', 'java');
    }

    if (!fs.existsSync(javaPath)) {
        // tar.x の strip オプションでディレクトリが削除される場合があるため、
        // bin/java が直下にある可能性も考慮
        javaPath = path.join(javaInstallDir, 'java');
        if (!fs.existsSync(javaPath)) {
            throw new Error(`Java executable not found at ${javaPath}`);
        }
    }
    return javaPath;
}

/**
 * ランタイム設定からJavaの実行可能ファイルパスを解決する
 * @param {object} runtimeConfig
 * @returns {string}
 */
function resolveJavaExecutable(runtimeConfig) {
    const { java_path, java_version } = runtimeConfig;
    let javaExecutable;

    if (java_path && java_path !== 'default') {
        console.log(`[ServerManager] Using directly specified Java path: ${java_path}`);
        if (!fs.existsSync(java_path)) {
            throw new Error(`指定されたJavaパスが見つかりません: ${java_path}`);
        }
        javaExecutable = java_path;
    } else if (java_version) {
        try {
            const javaInstallDir = getJavaInstallDir(String(java_version));
            javaExecutable = getJavaExecutablePath(javaInstallDir);
            console.log(`[ServerManager] Using Java from configured version ${java_version}: ${javaExecutable}`);
        } catch (error) {
            console.error(`[ServerManager] Failed to get Java executable for version ${java_version}:`, error);
            throw new Error(`要求されたJava ${java_version} はインストールされていません。物理サーバー詳細画面からインストールしてください。`);
        }
    } else {
        console.log(`[ServerManager] java_path or java_version not specified. Falling back to system default 'java'.`);
        javaExecutable = 'java';
    }
    return javaExecutable;
}

/**
 * 管理下の全ゲームサーバーの設定を読み込み、プロセスの実在確認を行う
 * @param {string} serversDirectory - ゲームサーバーが格納されているディレクトリパス
 */
async function loadAllServers(serversDirectory) {
    servers.clear();
    runningProcesses.clear();
    runningRconClients.clear();
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

    // 次に、実行中のJavaプロセスをスキャンして状態を検証する
    try {
        const processes = await si.processes();
        const javaProcesses = processes.list.filter(p => p.name.toLowerCase().includes('java'));

        for (const proc of javaProcesses) {
            // コマンドライン引数にサーバーディレクトリのパスが含まれているかチェック
            const serverId = Array.from(servers.keys()).find(id => {
                const resolvedDir = resolvePath(path.join(serversDirectory, id));
                // CWD (Current Working Directory) を基準に判断するのが最も確実
                return proc.cwd === resolvedDir;
            });

            if (serverId) {
                const serverConfig = servers.get(serverId);
                if (serverConfig) {
                    console.log(`[ServerManager] Found running process (PID: ${proc.pid}) for server ${serverId}.`);
                    serverConfig.status = ServerStatus.RUNNING;
                    // プロセスオブジェクトを再現できないため、PIDのみを保持するなどの工夫が必要かもしれないが、
                    // ここでは状態の整合性を取ることを主目的とする。
                    // runningProcesses.set(serverId, proc); // 'proc' はspawnされた子プロセスオブジェクトではないため、直接の制御はできない
                }
            }
        }
        console.log('[ServerManager] Finished checking running server processes.');
    } catch (error) {
        console.error('[ServerManager] Failed to check running processes:', error);
    }
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
 * @param {function} onProgress - 進捗を通知するためのコールバック関数
 * @returns {object | null} - 更新/作成後のサーバー設定オブジェクト、または失敗した場合はnull
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

async function createServer(serversDirectory, serverConfig, onProgress = () => { }) {
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
async function updateServer(serversDirectory, serverId, serverConfig) {
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
async function deleteServer(serversDirectory, serverId) {
    if (runningProcesses.has(serverId)) {
        console.warn(`[ServerManager] Attempted to delete a running server: ${serverId}. Deletion denied.`);
        return { success: false, path: null, error: 'Cannot delete a running server. Please stop it first.' };
    }
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

/**
 * Minecraftサーバーを起動する
 * @param {string} serversDirectory
 * @param {string} serverId
 * @returns {Promise<boolean>}
 */
async function startServer(serversDirectory, serverId, ws, onUpdate = () => { }) {
    const serverConfig = servers.get(serverId);
    if (!serverConfig) {
        throw new Error(`Server config not found for ${serverId}`);
    }
    if (runningProcesses.has(serverId)) {
        console.warn(`[ServerManager] startServer: Server ${serverId} is already running.`);
        return true;
    }

    const serverDir = path.join(serversDirectory, serverId);

    // EULAチェック
    const eulaPath = path.join(serverDir, 'eula.txt');
    let eulaAccepted = false;
    if (fs.existsSync(eulaPath)) {
        const eulaContent = fs.readFileSync(eulaPath, 'utf-8');
        // コメント行でなく、`eula=true`が設定されているか確認
        if (eulaContent.match(/^\s*eula\s*=\s*true\s*$/m)) {
            eulaAccepted = true;
        }
    }

    if (!eulaAccepted) {
        const error = new Error('Minecraft EULA has not been accepted.');
        error.code = 'EULA_NOT_ACCEPTED';
        try {
            error.eulaContent = fs.readFileSync(eulaPath, 'utf-8');
        } catch (e) {
            // eula.txtが存在しないか読めない場合、MojangのEULAリンクを含むデフォルトの内容を生成
            error.eulaContent = `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n#\n#${new Date().toString()}\neula=false\n`;
        }
        throw error;
    }

    const { java_path, java_version, server_jar, min_memory, max_memory, custom_args } = serverConfig.runtime;

    let javaExecutable;
    try {
        javaExecutable = resolveJavaExecutable(serverConfig.runtime);
    } catch (error) {
        throw error;
    }

    // JVM引数を動的に構築
    const final_jvm_args = [];
    if (min_memory) {
        final_jvm_args.push(`-Xms${min_memory}M`);
    }
    if (max_memory) {
        final_jvm_args.push(`-Xmx${max_memory}M`);
    }
    if (custom_args) {
        // 文字列をスペースで分割して個別の引数として追加
        final_jvm_args.push(...custom_args.split(' ').filter(arg => arg.length > 0));
    }

    const args = [...final_jvm_args];

    if (serverConfig.server_type === 'forge') {
        // Forge Startup Logic
        const argsFile = findForgeArgsFile(serverDir);
        if (argsFile) {
            console.log(`[ServerManager] Found Forge args file: ${argsFile}`);
            // unix_args.txtのパスは絶対パスで指定する必要があるかもしれないが、
            // @libraries/... という形式は相対パスを期待している可能性がある。
            // 通常、java @user_jvm_args.txt @libraries/.../unix_args.txt "$@"
            // user_jvm_args.txt が存在すればそれも使う

            if (fs.existsSync(path.join(serverDir, 'user_jvm_args.txt'))) {
                args.push(`@user_jvm_args.txt`);
            }

            // unix_args.txtへのパスを相対パスに変換 (serverDir基準)
            const relativeArgsPath = path.relative(serverDir, argsFile);
            args.push(`@${relativeArgsPath}`);

            args.push('nogui');
        } else {
            console.warn('[ServerManager] Forge args file not found. Falling back to server.jar (Legacy Forge?)');
            args.push('-jar', server_jar, 'nogui');
        }
    } else {
        // Vanilla Startup Logic
        args.push('-jar', server_jar, 'nogui');
    }

    console.log(`[ServerManager] Starting server ${serverId} in ${serverDir}`);
    console.log(`[ServerManager] Command: ${javaExecutable} ${args.join(' ')}`);

    try {
        const process = spawn(javaExecutable, args, {
            cwd: serverDir,
            // detached: true, // Agentの子プロセスとして管理するため、切り離さない
            stdio: 'pipe' // 'pipe' to control stdin/stdout/stderr
        });

        // 親プロセスが終了しても子プロセスが生き残るようにする
        // process.unref(); // Agent終了時にサーバーも追従して終了させるためコメントアウト

        runningProcesses.set(serverId, process);

        // ステータスを 'STARTING' に更新し、通知する
        serverConfig.status = ServerStatus.STARTING;
        onUpdate({ type: 'status_change', payload: ServerStatus.STARTING });

        const onLog = (log) => {
            console.log(`[${serverId}/stdout] ${log.trim()}`);
            serverConfig.logs.push(log);
            onUpdate({ type: 'log', payload: log });

            // サーバー起動完了を検知
            if (serverConfig.status === ServerStatus.STARTING && log.includes('Done')) {
                console.log(`[ServerManager] Server ${serverId} has started successfully.`);
                serverConfig.status = ServerStatus.RUNNING;
                onUpdate({ type: 'status_change', payload: ServerStatus.RUNNING });

                // RCON接続を試みる
                connectRcon(serverId, serverConfig);
            }
        };

        process.stdout.on('data', (data) => {
            onLog(data.toString());
        });

        process.stderr.on('data', (data) => {
            onLog(data.toString());
        });

        process.on('close', (code) => {
            console.log(`[ServerManager] Server process ${serverId} exited with code ${code}.`);
            // メトリクス収集を停止
            stopMetricsStream(serverId);
            runningProcesses.delete(serverId);
            serverConfig.status = ServerStatus.STOPPED;
            onUpdate({ type: 'status_change', payload: ServerStatus.STOPPED });
        });

        process.on('error', (err) => {
            console.error(`[ServerManager] Failed to start server process for ${serverId}:`, err);
            runningProcesses.delete(serverId);
        });

        return true;
    } catch (error) {
        console.error(`[ServerManager] Error spawning server process for ${serverId}:`, error);
        return false;
    }
}

/**
 * Minecraftサーバーを停止する
 * @param {string} serverId
 * @returns {Promise<boolean>}
 */
async function stopServer(serverId, onUpdate = () => { }) {
    const process = runningProcesses.get(serverId);
    const serverConfig = servers.get(serverId);

    if (!process) {
        console.warn(`[ServerManager] stopServer: Server ${serverId} is not running.`);
        // 念のためステータスを更新
        if (serverConfig && serverConfig.status !== ServerStatus.STOPPED) {
            serverConfig.status = ServerStatus.STOPPED;
            onUpdate({ type: 'status_change', payload: ServerStatus.STOPPED });
        }
        // メトリクス収集が残っていたら停止
        if (metricsIntervals.has(serverId)) {
            clearInterval(metricsIntervals.get(serverId));
            metricsIntervals.delete(serverId);
        }
        return true; // すでに止まっているので成功とみなす
    }

    console.log(`[ServerManager] Sending 'stop' command to server ${serverId}...`);

    // 先にメトリクス収集を停止
    stopMetricsStream(serverId);

    // ステータスを 'STOPPING' に更新
    if (serverConfig) {
        serverConfig.status = ServerStatus.STOPPING;
        onUpdate({ type: 'status_change', payload: ServerStatus.STOPPING });
    }

    try {
        // 'stop'コマンドを標準入力に書き込む
        process.stdin.write('stop\n');

        // RCONクライアントが接続されていれば切断する
        if (runningRconClients.has(serverId)) {
            console.log(`[ServerManager] Disconnecting RCON client for server ${serverId}.`);
            const rcon = runningRconClients.get(serverId);
            rcon.end();
            runningRconClients.delete(serverId);
        }

        // TODO: タイムアウトを設け、指定時間内に終了しない場合は process.kill() を呼ぶ

        return true;
    } catch (error) {
        console.error(`[ServerManager] Error sending 'stop' command to server ${serverId}:`, error);
        // エラーが発生した場合、強制終了を試みる
        process.kill('SIGKILL');
        return false;
    }
}

/**
 * RCONクライアントをサーバーに接続する
 * @param {string} serverId
 * @param {object} serverConfig
 */
async function connectRcon(serverId, serverConfig) {
    // server.propertiesからRCON設定を読み込む処理が未実装のため、serverConfigから直接取得する
    // 将来的には、server.propertiesをパースして使うように変更する
    const rconConfig = serverConfig.properties || {};
    const host = '127.0.0.1'; // Agentと同じマシンで動作している前提
    const port = rconConfig['rcon.port'];
    const password = rconConfig['rcon.password'];

    if (!rconConfig['enable-rcon'] || !port || !password) {
        console.log(`[ServerManager] RCON is not enabled for server ${serverId}. Skipping RCON connection.`);
        return;
    }

    if (runningRconClients.has(serverId)) {
        console.log(`[ServerManager] RCON client for server ${serverId} is already connected or connecting.`);
        return;
    }

    console.log(`[ServerManager] Attempting to connect RCON for server ${serverId} at ${host}:${port}...`);

    try {
        const rcon = new Rcon({ host, port, password });

        rcon.on('connect', () => {
            console.log(`[ServerManager] RCON connected for server ${serverId}.`);
            runningRconClients.set(serverId, rcon);
        });

        rcon.on('error', (err) => {
            console.error(`[ServerManager] RCON error for server ${serverId}:`, err.message);
            runningRconClients.delete(serverId);
        });

        rcon.on('end', () => {
            console.log(`[ServerManager] RCON connection ended for server ${serverId}.`);
            runningRconClients.delete(serverId);
        });

        await rcon.connect();

    } catch (err) {
        console.error(`[ServerManager] Failed to initiate RCON connection for server ${serverId}:`, err.message);
    }
}

/**
 * RCON経由でサーバーからTPSとプレイヤー数を取得する
 * @param {string} serverId
 * @returns {Promise<object>}
 */
async function getGameServerMetrics(serverId) {
    const rcon = runningRconClients.get(serverId);
    if (!rcon) {
        return { tps: 0, players: { current: 0, max: 20, list: [] } };
    }

    try {
        const [tpsResponse, listResponse] = await Promise.all([
            rcon.send('/tps'),
            rcon.send('/list')
        ]);

        // TPSのパース
        let tps = 0;
        const tpsMatch = tpsResponse.match(/TPS from last 1m, 5m, 15m: ([\d\.]+), ([\d\.]+), ([\d\.]+)/);
        if (tpsMatch && tpsMatch[1]) {
            // PaperMCの場合、tpsが20.0*のようにアスタリスクが付くことがある
            tps = parseFloat(tpsMatch[1].replace('*', ''));
        }

        // プレイヤー数のパース
        let currentPlayers = 0;
        let maxPlayers = 20; // デフォルト値
        const listMatch = listResponse.match(/There are ([\d]+) of a max of ([\d]+) players online:/);
        if (listMatch) {
            currentPlayers = parseInt(listMatch[1], 10);
            maxPlayers = parseInt(listMatch[2], 10);
        }

        return {
            tps: tps,
            players: {
                current: currentPlayers,
                max: maxPlayers,
                list: [], // TODO: プレイヤーリストのパース
            }
        };

    } catch (error) {
        console.warn(`[ServerManager] Failed to get metrics via RCON for server ${serverId}:`, error.message);
        // RCONがタイムアウトした場合など
        return { tps: 0, players: { current: 0, max: 20, list: [] } };
    }
}

/**
 * 指定されたゲームサーバーのメトリクス収集ストリームを開始する
 * @param {import('ws')} ws - WebSocketクライアント
 * @param {string} serverId - サーバーID
 */
function startMetricsStream(ws, serverId) {
    if (metricsIntervals.has(serverId)) {
        console.log(`[ServerManager] Metrics stream for server ${serverId} is already running.`);
        return;
    }

    console.log(`[ServerManager] Starting metrics stream for server ${serverId}.`);

    const intervalId = setInterval(async () => {
        const process = runningProcesses.get(serverId);
        if (!process) {
            stopMetricsStream(serverId);
            return;
        }

        try {
            const processInfo = await si.processes();
            const serverProcess = processInfo.list.find(p => p.pid === process.pid);
            const gameMetrics = await getGameServerMetrics(serverId);
            // console.log(serverProcess); // デバッグ用
            if (ws && ws.readyState === 1) {
                const serverConfig = servers.get(serverId);
                const metrics = {
                    serverId: serverId,
                    cpu: serverProcess ? serverProcess.cpu : 0,
                    memory: serverProcess ? Math.round(serverProcess.memRss / 1024) : 0, // MB
                    memoryMax: getMaxMemoryFromConfig(serverConfig), // ヘルパー関数を使用
                    ...gameMetrics,
                };
                ws.send(JSON.stringify({ type: Message.GAME_SERVER_METRICS_UPDATE, payload: metrics }));
            } else {
                // WebSocketが切断されたらストリームを停止
                stopMetricsStream(serverId);
            }
        } catch (err) {
            console.error(`[ServerManager] Failed to collect metrics for server ${serverId}:`, err);
        }
    }, 1000); // 1秒ごと

    metricsIntervals.set(serverId, intervalId);
}

/**
 * 指定されたゲームサーバーのメトリクス収集ストリームを停止する
 * @param {string} serverId - サーバーID
 */
function stopMetricsStream(serverId) {
    if (metricsIntervals.has(serverId)) {
        console.log(`[ServerManager] Stopping metrics stream for server ${serverId}.`);
        clearInterval(metricsIntervals.get(serverId));
        metricsIntervals.delete(serverId);
    }
}

/**
 * eula.txtを更新してEULAに同意する
 * @param {string} serversDirectory
 * @param {string} serverId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function acceptEula(serversDirectory, serverId) {
    const serverDir = path.join(resolvePath(serversDirectory), serverId);
    const eulaPath = path.join(serverDir, 'eula.txt');
    try {
        let content = '';
        if (fs.existsSync(eulaPath)) {
            content = fs.readFileSync(eulaPath, 'utf-8');
            if (content.match(/^\s*eula\s*=\s*false\s*$/m)) {
                // `eula=false` を `eula=true` に置換
                content = content.replace(/^\s*eula\s*=\s*false\s*$/m, 'eula=true');
            } else if (!content.match(/^\s*eula\s*=\s*true\s*$/m)) {
                // `eula=true` も `eula=false` もない場合は追記する
                content += '\neula=true\n';
            }
        } else {
            // ファイルが存在しない場合は、EULAのURLを含む内容で新規作成
            content = `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n#\n#${new Date().toString()}\neula=true\n`;
        }

        fs.writeFileSync(eulaPath, content, 'utf-8');
        console.log(`[ServerManager] EULA accepted for server ${serverId}.`);
        return { success: true };
    } catch (error) {
        console.error(`[ServerManager] Failed to write eula.txt for server ${serverId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * server.propertiesファイルをオブジェクトとして読み込む
 * @param {string} serverPath
 * @returns {Promise<Object>}
 */
async function readProperties(serverPath) {
    const propertiesPath = path.join(serverPath, 'server.properties');
    try {
        const data = await fs.promises.readFile(propertiesPath, 'utf-8');
        const properties = {};
        data.split('\n').forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    properties[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return properties;
    } catch (error) {
        if (error.code === 'ENOENT') return {}; // ファイルがなければ空オブジェクト
        throw error;
    }
}

/**
 * オブジェクトを server.properties ファイルに書き込む
 * @param {string} serverPath
 * @param {Object} properties
 */
async function writeProperties(serverPath, properties) {
    const propertiesPath = path.join(serverPath, 'server.properties');
    const data = Object.entries(properties)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    await fs.promises.writeFile(propertiesPath, data);
}

/**
 * サーバーのプロパティを更新する
 * @param {string} serversDirectory
 * @param {string} serverId
 * @param {Object} newProperties
 */
async function updateServerProperties(serversDirectory, serverId, newProperties) {
    const serverPath = path.join(serversDirectory, serverId);
    const serverConfigPath = path.join(serverPath, SERVER_CONFIG_FILENAME);

    try {
        const server = await readJson(serverConfigPath);

        // 新しいプロパティを既存のものとマージ
        const mergedProperties = { ...(server.properties || {}), ...newProperties };

        // スキーマでパースして不要なプロパティを削除し、型を変換
        const validatedProperties = ServerPropertiesSchema.parse(mergedProperties);

        server.properties = validatedProperties;

        // nl-server_manager.jsonを更新
        await writeJson(serverConfigPath, server);

        // server.properties ファイルを更新
        await writeProperties(serverPath, validatedProperties);

        // メモリ上のキャッシュも更新
        servers.set(serverId, server);

        return { success: true, properties: validatedProperties };
    } catch (error) {
        console.error(`[Agent] Failed to update properties for server ${serverId}:`, error);
        return { success: false, error: error.message };
    }
}

export {
    loadAllServers,
    getServer,
    getAllServers,
    createServer,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
    startMetricsStream,
    stopMetricsStream,
    acceptEula,
    getJavaInstallDir,
    extractArchive,
    getJavaExecutablePath,
    downloadFile,
    updateServerProperties,
};