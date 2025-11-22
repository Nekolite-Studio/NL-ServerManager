import { spawn } from 'child_process';
import { Rcon } from 'rcon-client';
import fs from 'fs';
import path from 'path';
import { ServerStatus, Message } from '@nl-server-manager/common/protocol.js';
import { getServer, findForgeArgsFile } from './serverConfigService.js';
import { resolveJavaExecutable } from './javaService.js';

// 実行中のサーバープロセスを管理する
const runningProcesses = new Map();
// 実行中のRCONクライアントを管理する
const runningRconClients = new Map();

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
 * Minecraftサーバーを起動する
 * @param {string} serversDirectory
 * @param {string} serverId
 * @returns {Promise<boolean>}
 */
export async function startServer(serversDirectory, serverId, ws, onUpdate = () => { }) {
    const serverConfig = getServer(serverId);
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
        // 指定されたJavaが見つからない場合、システムデフォルトへのフォールバックを試みる
        if (serverConfig.runtime.java_version) {
            console.warn(`[ServerManager] Requested Java version ${serverConfig.runtime.java_version} not found. Falling back to system default.`);
            javaExecutable = 'java';
            
            // Managerに警告を通知
            if (ws) {
                ws.send(JSON.stringify({
                    type: Message.OPERATION_WARNING,
                    payload: {
                        serverId: serverId,
                        message: `指定されたJavaバージョン (${serverConfig.runtime.java_version}) が見つかりません。システムのデフォルトJavaを使用して起動を試みます。`
                    }
                }));
            }
        } else {
            throw error;
        }
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
        // Agent終了時にサーバーも追従して終了させるため、unref()は呼び出さない

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
export async function stopServer(serverId, onUpdate = () => { }) {
    const process = runningProcesses.get(serverId);
    const serverConfig = getServer(serverId);

    if (!process) {
        console.warn(`[ServerManager] stopServer: Server ${serverId} is not running.`);
        // 念のためステータスを更新
        if (serverConfig && serverConfig.status !== ServerStatus.STOPPED) {
            serverConfig.status = ServerStatus.STOPPED;
            onUpdate({ type: 'status_change', payload: ServerStatus.STOPPED });
        }
        return true; // すでに止まっているので成功とみなす
    }

    console.log(`[ServerManager] Sending 'stop' command to server ${serverId}...`);

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

// 状態管理用のMapを共有
export { runningProcesses, runningRconClients };