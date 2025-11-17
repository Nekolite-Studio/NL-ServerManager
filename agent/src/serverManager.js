const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const tar = require('tar');
const unzipper = require('unzipper');
const si = require('systeminformation');
const { loadJsonSync, saveJsonSync, resolvePath } = require('./utils/storage');
const { Message } = require('../../common/protocol');

const SERVER_CONFIG_FILENAME = 'nl-server_manager.json';
const SCHEMA_VERSION = '1.0.0';

// インメモリでサーバー設定のリストをキャッシュする
const servers = new Map();
// 実行中のサーバープロセスを管理する
const runningProcesses = new Map();
// 実行中のメトリクス収集インターバルを管理する
const metricsIntervals = new Map();

/**
 * デフォルトのサーバー設定を返す
 * @param {string} serverId 
 * @param {string} serverName 
 * @returns {object}
 */
function getDefaultServerConfig(serverId, serverName, runtimeConfig = {}) {
    const defaultConfig = {
        schema_version: SCHEMA_VERSION,
        server_id: serverId,
        server_name: serverName || `My Server (${serverId.substring(0, 8)})`,
        runtime: {
            java_path: null,
            java_version: null,
            jvm_args: ['-Xmx2G', '-Xms1G'],
            server_jar: 'server.jar',
            ...runtimeConfig
        },
        status: 'stopped',
        logs: [],
        auto_start: false,
    };
    return defaultConfig;
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
function downloadFile(url, destPath, onProgress = () => {}) {
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
function extractArchive(archivePath, destDir, onProgress = () => {}) {
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
 * @param {function} onProgress - 進捗を通知するためのコールバック関数
 * @returns {object | null} - 更新/作成後のサーバー設定オブジェクト、または失敗した場合はnull
 */
async function createServer(serversDirectory, serverConfig, onProgress = () => {}) {
    const { versionId, runtime, ...restConfig } = serverConfig;
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

    console.log(`[ServerManager] versionId specified: ${versionId}. Starting download process.`);
    try {
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
    } catch (error) {
        console.error(`[ServerManager] Failed to download server.jar for version ${versionId}:`, error);
        fs.rmSync(serverDir, { recursive: true, force: true });
        console.log(`[ServerManager] Cleaned up directory ${serverDir} due to download failure.`);
        throw error;
    }

    const finalConfig = getDefaultServerConfig(id, restConfig.server_name, runtime);

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

    const finalConfig = { ...existingConfig, ...restConfig, server_id: serverId };
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
async function startServer(serversDirectory, serverId, ws, onUpdate = () => {}) {
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

    const { java_path, java_version, jvm_args, server_jar } = serverConfig.runtime;

    let javaExecutable = java_path;

    // 1. java_path が直接指定されていればそれを使う
    if (javaExecutable) {
        console.log(`[ServerManager] Using directly specified Java path: ${javaExecutable}`);
        if (!fs.existsSync(javaExecutable)) {
             throw new Error(`指定されたJavaパスが見つかりません: ${javaExecutable}`);
        }
    }
    // 2. java_version が指定されていれば、インストール済みか確認して使う
    else if (java_version) {
        try {
            // 防御的プログラミング: java_versionが数値で保存されている可能性を考慮し、文字列に変換する
            const javaInstallDir = getJavaInstallDir(String(java_version));
            javaExecutable = getJavaExecutablePath(javaInstallDir);
            console.log(`[ServerManager] Using Java from configured version ${java_version}: ${javaExecutable}`);
        } catch (error) {
            console.error(`[ServerManager] Failed to get Java executable for version ${java_version}:`, error);
            throw new Error(`要求されたJava ${java_version} はインストールされていません。物理サーバー詳細画面からインストールしてください。`);
        }
    }
    // 3. どちらもなければエラー
    else {
        throw new Error('サーバー設定でJavaのパスまたはバージョンが指定されていません。');
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

        // メトリクス収集を開始
        const intervalId = setInterval(async () => {
            try {
                const processesData = await si.processes();
                const processInfo = processesData.list.find(p => p.pid === process.pid);

                if (processInfo && ws && ws.readyState === 1 /* OPEN */) {
                    const metrics = {
                        serverId: serverId,
                        cpu: processInfo.cpu,
                        memory: processInfo.mem,
                    };
                    // METRICS_UPDATEは未定義なので、次のステップでprotocol.jsに追加する
                    ws.send(JSON.stringify({ type: Message.METRICS_UPDATE, payload: metrics }));
                }
            } catch (err) {
                console.error(`[ServerManager] Failed to collect metrics for server ${serverId}:`, err);
                // エラーが発生したら収集を停止
                clearInterval(intervalId);
                metricsIntervals.delete(serverId);
            }
        }, 5000); // 5秒ごとに収集
        metricsIntervals.set(serverId, intervalId);

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
            // メトリクス収集を停止
            if (metricsIntervals.has(serverId)) {
                clearInterval(metricsIntervals.get(serverId));
                metricsIntervals.delete(serverId);
            }
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
        // メトリクス収集が残っていたら停止
        if (metricsIntervals.has(serverId)) {
            clearInterval(metricsIntervals.get(serverId));
            metricsIntervals.delete(serverId);
        }
        return true; // すでに止まっているので成功とみなす
    }

    console.log(`[ServerManager] Sending 'stop' command to server ${serverId}...`);
    
    // 先にメトリクス収集を停止
    if (metricsIntervals.has(serverId)) {
        clearInterval(metricsIntervals.get(serverId));
        metricsIntervals.delete(serverId);
    }

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


module.exports = {
    loadAllServers,
    getServer,
    getAllServers,
    createServer,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
    acceptEula,
    getJavaInstallDir,
    extractArchive,
    getJavaExecutablePath,
    downloadFile
};