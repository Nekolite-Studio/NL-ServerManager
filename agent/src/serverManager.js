const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const tar = require('tar');
const AdmZip = require('adm-zip');
const { loadJsonSync, saveJsonSync, resolvePath } = require('./utils/storage');

const SERVER_CONFIG_FILENAME = 'nl-server_manager.json';
const SCHEMA_VERSION = '1.0.0';

// インメモリでサーバー設定のリストをキャッシュする
const servers = new Map();
// 実行中のサーバープロセスを管理する
const runningProcesses = new Map();

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
            java_version: null, // 追加: 使用するJavaのバージョン (例: jdk-17.0.8.7-hotspot)
            jvm_args: ['-Xmx2G', '-Xms1G'],
            server_jar: 'server.jar',
        },
        status: 'stopped',
        logs: [],
        auto_start: false,
    };
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
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        
        const request = (currentUrl) => {
            https.get(new URL(currentUrl), (response) => {
                const { statusCode, headers } = response;
                if (statusCode >= 300 && statusCode < 400 && headers.location) {
                    // リダイレクトを追跡
                    request(new URL(headers.location, currentUrl).href);
                    return;
                }
                
                if (statusCode !== 200) {
                    file.close();
                    fs.unlink(destPath, () => {}); // エラー時にファイルを削除
                    reject(new Error(`Request failed. Status code: ${statusCode}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close((err) => {
                        if (err) {
                            fs.unlink(destPath, () => {});
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                
            }).on('error', (err) => {
                file.close();
                fs.unlink(destPath, () => {});
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
async function extractArchive(archivePath, destDir) {
    const fileExtension = path.extname(archivePath);
    console.log(`[ServerManager] Extracting ${archivePath} to ${destDir}`);

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    if (fileExtension === '.zip') {
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(destDir, true);
    } else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
        await tar.x({
            file: archivePath,
            cwd: destDir,
            strip: 1, // 展開時に最上位のディレクトリを削除
        });
    } else {
        throw new Error(`Unsupported archive format: ${fileExtension}`);
    }
    console.log(`[ServerManager] Successfully extracted ${archivePath}`);
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
            config.logs = config.logs || [];
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
async function updateServer(serversDirectory, serverId, serverConfig) {
    const { versionId, ...restConfig } = serverConfig;
    const id = serverId || uuidv4();
    const serverDir = path.join(serversDirectory, id);
    const configPath = path.join(serverDir, SERVER_CONFIG_FILENAME);

    // 新規作成時のみ、ディレクトリの存在をチェック・作成
    if (!serverId) {
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
    }

    // versionIdがあればサーバーjarをダウンロード
    if (versionId) {
        console.log(`[ServerManager] versionId specified: ${versionId}. Starting download process.`);
        try {
            // 1. バージョンマニフェストを取得
            const manifest = await getJsonFromUrl('https://launchermeta.mojang.com/mc/game/version_manifest.json');
            
            // 2. 指定されたversionIdのURLを見つける
            const versionInfo = manifest.versions.find(v => v.id === versionId);
            if (!versionInfo) {
                throw new Error(`Version ${versionId} not found in version manifest.`);
            }
            
            // 3. バージョン詳細を取得
            const versionDetails = await getJsonFromUrl(versionInfo.url);
            
            // 4. サーバーjarのURLを取得
            const serverJarUrl = versionDetails.downloads?.server?.url;
            if (!serverJarUrl) {
                throw new Error(`Server JAR download URL not found for version ${versionId}.`);
            }
            
            // 5. ダウンロードして保存
            const destPath = path.join(serverDir, 'server.jar');
            console.log(`[ServerManager] Downloading server.jar for version ${versionId} from ${serverJarUrl} to ${destPath}`);
            await downloadFile(serverJarUrl, destPath);
            console.log(`[ServerManager] Successfully downloaded server.jar.`);

        } catch (error) {
            console.error(`[ServerManager] Failed to download server.jar for version ${versionId}:`, error);
            // ダウンロードに失敗した場合、作成中のサーバーディレクトリを削除して処理を中断
            if (!serverId) { // 新規作成の場合のみ
                try {
                    fs.rmSync(serverDir, { recursive: true, force: true });
                    console.log(`[ServerManager] Cleaned up directory ${serverDir} due to download failure.`);
                } catch (cleanupError) {
                    console.error(`[ServerManager] Failed to cleanup directory ${serverDir}:`, cleanupError);
                }
            }
            return null;
        }
    }

    let finalConfig;
    if (serverId) { // 更新
        const existingConfig = servers.get(id);
        if (!existingConfig) {
            console.error(`[ServerManager] Attempted to update non-existent server: ${id}`);
            // 更新しようとしたサーバーが存在しない場合、ディレクトリが作られている可能性はないのでクリーンアップは不要
            return null;
        }
        finalConfig = { ...existingConfig, ...restConfig, server_id: id };
        if (!finalConfig.logs) finalConfig.logs = [];
    } else { // 新規作成
        finalConfig = { ...getDefaultServerConfig(id), ...restConfig, server_id: id };
    }

    const { success, resolvedPath } = saveJsonSync(configPath, finalConfig);
    if (success) {
        servers.set(id, finalConfig);
        return { config: finalConfig, path: resolvedPath };
    }
    
    // 設定ファイルの保存に失敗した場合もクリーンアップ
    if (!serverId) {
        try {
            fs.rmSync(serverDir, { recursive: true, force: true });
            console.log(`[ServerManager] Cleaned up directory ${serverDir} due to config save failure.`);
        } catch (cleanupError) {
            console.error(`[ServerManager] Failed to cleanup directory ${serverDir}:`, cleanupError);
        }
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

/**
 * Minecraftサーバーを起動する
 * @param {string} serversDirectory
 * @param {string} serverId
 * @returns {Promise<boolean>}
 */
async function startServer(serversDirectory, serverId, onUpdate = () => {}) {
    const serverConfig = servers.get(serverId);
    if (!serverConfig) {
        console.error(`[ServerManager] startServer: Server config not found for ${serverId}`);
        return false;
    }
    if (runningProcesses.has(serverId)) {
        console.warn(`[ServerManager] startServer: Server ${serverId} is already running.`);
        return true;
    }

    const serverDir = path.join(serversDirectory, serverId);
    const { java_path, java_version, jvm_args, server_jar } = serverConfig.runtime;
    
    let javaExecutable = java_path;
    if (!javaExecutable && java_version) {
        try {
            const javaInstallDir = getJavaInstallDir(java_version);
            javaExecutable = getJavaExecutablePath(javaInstallDir);
            console.log(`[ServerManager] Using Java from configured version: ${javaExecutable}`);
        } catch (error) {
            console.error(`[ServerManager] Failed to get Java executable for version ${java_version}:`, error);
            // Fallback to 'java' if specific version fails
            javaExecutable = 'java';
            console.warn(`[ServerManager] Falling back to default 'java' command for server ${serverId}.`);
        }
    } else if (!javaExecutable) {
        javaExecutable = 'java'; // Fallback to system default 'java'
        console.warn(`[ServerManager] No Java path or version configured. Using default 'java' command for server ${serverId}.`);
    }

    const args = [...jvm_args, '-jar', server_jar, 'nogui'];

    console.log(`[ServerManager] Starting server ${serverId} in ${serverDir}`);
    console.log(`[ServerManager] Command: ${javaExecutable} ${args.join(' ')}`);

    try {
        const process = spawn(javaExecutable, args, {
            cwd: serverDir,
            detached: true,
            stdio: 'pipe' // 'pipe' to control stdin/stdout/stderr
        });

        // 親プロセスが終了しても子プロセスが生き残るようにする
        process.unref();

        runningProcesses.set(serverId, process);

        // ステータスを 'running' に更新し、通知する
        serverConfig.status = 'running';
        onUpdate({ type: 'status_change', payload: 'running' });

        process.stdout.on('data', (data) => {
            const log = data.toString();
            console.log(`[${serverId}/stdout] ${log.trim()}`);
            serverConfig.logs.push(log);
            onUpdate({ type: 'log', payload: log });
        });

        process.stderr.on('data', (data) => {
            const log = data.toString();
            console.error(`[${serverId}/stderr] ${log.trim()}`);
            serverConfig.logs.push(log);
            onUpdate({ type: 'log', payload: log });
        });

        process.on('close', (code) => {
            console.log(`[ServerManager] Server process ${serverId} exited with code ${code}.`);
            runningProcesses.delete(serverId);
            serverConfig.status = 'stopped';
            onUpdate({ type: 'status_change', payload: 'stopped' });
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
async function stopServer(serverId) {
    const process = runningProcesses.get(serverId);
    if (!process) {
        console.warn(`[ServerManager] stopServer: Server ${serverId} is not running.`);
        return true; // すでに止まっているので成功とみなす
    }

    console.log(`[ServerManager] Sending 'stop' command to server ${serverId}...`);

    try {
        // 'stop'コマンドを標準入力に書き込む
        process.stdin.write('stop\n');
        
        // プロセスが正常に終了するのを待つ。ここでは単純化のため、コマンド送信後に即座にMapから削除するが、
        // 本来は'close'イベントで削除するのが望ましい。
        // runningProcesses.delete(serverId); // 'close'イベントハンドラで削除される

        // TODO: タイムアウトを設け、指定時間内に終了しない場合は process.kill() を呼ぶ
        
        return true;
    } catch (error) {
        console.error(`[ServerManager] Error sending 'stop' command to server ${serverId}:`, error);
        // エラーが発生した場合、強制終了を試みる
        process.kill('SIGKILL');
        return false;
    }
}


module.exports = {
    loadAllServers,
    getServer,
    getAllServers,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
};