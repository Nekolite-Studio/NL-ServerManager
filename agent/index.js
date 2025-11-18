import WebSocket from 'ws';
import os from 'os';
import path from 'path';
import fs from 'fs'; // fsモジュールを追加
import si from 'systeminformation';
import { initializeSettings, getSettings } from './src/settingsManager.js';

import {
    loadAllServers,
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
} from './src/serverManager.js';

import { Message } from '../common/protocol.js';

// --- 初期化処理 ---

// 1. Agent設定を初期化・ロード
const agentSettings = initializeSettings();
const PORT = agentSettings.api.port;

// 2. ゲームサーバー設定をロード
loadAllServers(agentSettings.servers_directory);


// --- データ取得関数 ---

function getSystemInfo() {
  return {
    os: os.platform(), // OSの種類 (例: 'linux', 'win32', 'darwin')
    arch: os.arch(),   // CPUアーキテクチャ (例: 'x64', 'arm64')
    totalRam: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    cpu: os.cpus()[0].model,
  };
}

async function getMetrics() {
    const servers = getAllServers();
    const runningServers = servers.filter(s => s.status === 'running');
    const stoppedServersCount = servers.length - runningServers.length;
    const totalPlayers = runningServers.reduce((acc, s) => acc + (s.players?.current || 0), 0);

    // systeminformationを使用して実際の値を取得
    const [cpuData, memData, fsData] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize()
    ]);

    // CPU使用率
    const cpuUsage = cpuData.currentLoad.toFixed(2);

    // RAM使用率
    const ramUsage = ((memData.active / memData.total) * 100).toFixed(2);

    // Disk使用率
    const serverDirectory = getSettings().servers_directory;
    const mainDisk = fsData.find(fs => serverDirectory.startsWith(fs.mount));
    const diskUsage = mainDisk ? ((mainDisk.used / mainDisk.size) * 100).toFixed(2) : '0.00';

    return {
        cpuUsage: cpuUsage,
        ramUsage: ramUsage,
        diskUsage: diskUsage,
        networkSpeed: 'N/A', // networkSpeedは一旦N/Aに
        gameServers: {
            running: runningServers.length,
            stopped: stoppedServersCount,
            totalPlayers: totalPlayers,
        },
    };
}

// --- WebSocketサーバー ---

const wss = new WebSocket.Server({ port: PORT });
const physicalServerMetricsIntervals = new Map(); // 物理サーバーのメトリクス収集を管理

// 接続しているすべてのManagerにブロードキャストするヘルパー関数
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// リクエスト元に応答を返すヘルパー関数
function sendResponse(ws, requestId, operation, success, payload, error) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        type: Message.OPERATION_RESULT,
        requestId,
        operation,
        success,
        payload: success ? payload : undefined,
        error: !success ? { message: error, details: payload } : undefined,
    }));
}

// 進捗をリクエスト元に通知するヘルパー関数
function sendProgress(ws, requestId, operation, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        type: Message.PROGRESS_UPDATE,
        requestId,
        operation,
        payload,
    }));
}

// サーバーリストの更新を全Managerに通知する
function broadcastServerListUpdate() {
    const allServers = getAllServers();
    broadcast({ type: Message.SERVER_LIST_UPDATE, payload: allServers });
}


console.log(`Agent WebSocket server started on port ${PORT}`);

wss.on('connection', (ws) => {
  console.log('Manager connected.');

  // 接続時に現在のサーバーリストを送信
  ws.send(JSON.stringify({ type: Message.SERVER_LIST_UPDATE, payload: getAllServers() }));


  ws.on('message', async (message) => {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch (e) {
      console.error('Failed to parse incoming message:', message.toString());
      return;
    }

    console.log('Received message from manager:', parsedMessage);
    const { type, payload, requestId } = parsedMessage;
 
     switch (type) {
        case Message.START_METRICS_STREAM:
            {
                const { streamId, targetType, targetId } = payload;
                if (targetType === 'gameServer') {
                    startMetricsStream(ws, targetId);
                } else if (targetType === 'physicalServer') {
                    if (physicalServerMetricsIntervals.has(streamId)) {
                        console.log(`[Agent] Physical server metrics stream ${streamId} is already running.`);
                        return;
                    }
                    console.log(`[Agent] Starting physical server metrics stream ${streamId}.`);
                    const intervalId = setInterval(async () => {
                        try {
                            const metrics = await getMetrics();
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: Message.PHYSICAL_SERVER_METRICS_UPDATE, payload: metrics }));
                            } else {
                                clearInterval(intervalId);
                                physicalServerMetricsIntervals.delete(streamId);
                            }
                        } catch (error) {
                            console.error(`[Agent] Error getting physical server metrics:`, error);
                        }
                    }, 1000);
                    physicalServerMetricsIntervals.set(streamId, intervalId);
                }
            }
            break;
        case Message.STOP_METRICS_STREAM:
            {
                const { streamId, targetType, targetId } = payload;
                if (targetType === 'gameServer') {
                    stopMetricsStream(targetId);
                } else if (targetType === 'physicalServer') {
                    if (physicalServerMetricsIntervals.has(streamId)) {
                        console.log(`[Agent] Stopping physical server metrics stream ${streamId}.`);
                        clearInterval(physicalServerMetricsIntervals.get(streamId));
                        physicalServerMetricsIntervals.delete(streamId);
                    }
                }
            }
            break;
       // --- System & Server Info ---
       case Message.GET_SYSTEM_INFO:
         ws.send(JSON.stringify({
           type: Message.SYSTEM_INFO_RESPONSE,
           requestId: requestId,
           payload: {
             os: process.platform,
             arch: process.arch
           }
         }));
         break;
       case Message.GET_METRICS:
         {
            const metrics = await getMetrics();
            ws.send(JSON.stringify({ type: Message.METRICS_DATA, payload: metrics }));
         }
         break;
      case Message.GET_ALL_SERVERS:
        ws.send(JSON.stringify({ type: Message.SERVER_LIST_UPDATE, payload: getAllServers() }));
        break;
      
      // --- Server Management ---
      case Message.CREATE_SERVER:
          {
            const serversDirectory = getSettings().servers_directory;
            try {
                const onProgress = (progressPayload) => {
                    sendProgress(ws, requestId, type, progressPayload);
                };
                const result = await createServer(serversDirectory, payload, onProgress);
                sendResponse(ws, requestId, type, true, { ...result.config, path: result.path });
                broadcastServerListUpdate();
            } catch (error) {
                console.error(`[Agent] Failed to create server:`, error);
                sendResponse(ws, requestId, type, false, null, error.message || 'An unknown error occurred during server creation.');
            }
          }
          break;
      case Message.UPDATE_SERVER:
        {
            const { serverId, config } = payload;
            const serversDirectory = getSettings().servers_directory;
            const result = await updateServer(serversDirectory, serverId, config);
            if (result && result.config) {
                // 更新後の完全な設定オブジェクトをペイロードに含める
                sendResponse(ws, requestId, type, true, { serverId, config: result.config });
                broadcastServerListUpdate();
            } else {
                sendResponse(ws, requestId, type, false, { serverId }, 'Failed to update server.');
            }
        }
        break;
      case Message.UPDATE_SERVER_PROPERTIES:
        {
            const { serverId, properties } = payload;
            const serversDirectory = getSettings().servers_directory;
            const result = await updateServer(serversDirectory, serverId, { properties });
            if (result && result.config) {
                sendResponse(ws, requestId, type, true, { ...result.config, path: result.path });
                broadcastServerListUpdate();
            } else {
                sendResponse(ws, requestId, type, false, { serverId }, 'Failed to update server properties.');
            }
        }
        break;
      case Message.UPDATE_SERVER_PROPERTIES:
        {
            const { serverId, properties } = payload;
            const serversDirectory = getSettings().servers_directory;
            const result = await updateServerProperties(serversDirectory, serverId, properties);
            if (result.success) {
                sendResponse(ws, requestId, type, true, { serverId, properties: result.properties });
                // server.propertiesの変更はリスト表示には影響しないため、ブロードキャストは不要
            } else {
                sendResponse(ws, requestId, type, false, { serverId }, result.error);
            }
        }
        break;
      case Message.DELETE_SERVER:
        {
            const { serverId } = payload;
            const serversDirectory = getSettings().servers_directory;
            const result = await deleteServer(serversDirectory, serverId);
            sendResponse(ws, requestId, type, result.success, { serverId, path: result.path }, result.error || (result.success ? null : 'Failed to delete server.'));
            if(result.success) {
                broadcastServerListUpdate();
            }
        }
        break;

      case Message.CONTROL_SERVER:
        {
            const { serverId, action } = payload;
            console.log(`Received control request for server ${serverId}: ${action}`);
            const serversDirectory = getSettings().servers_directory;
            try {
                const onUpdate = (update) => {
                    ws.send(JSON.stringify({
                        type: Message.SERVER_UPDATE,
                        payload: { serverId, ...update }
                    }));
                };

                if (action === 'start') {
                    await startServer(serversDirectory, serverId, ws, onUpdate);
                    sendResponse(ws, requestId, type, true, { serverId, action: 'start' });
                } else if (action === 'stop') {
                    await stopServer(serverId, onUpdate);
                    sendResponse(ws, requestId, type, true, { serverId, action: 'stop' });
                } else {
                    throw new Error(`Unknown server control action: ${action}`);
                }
            } catch (error) {
                if (action === 'start' && error.code === 'EULA_NOT_ACCEPTED') {
                    // EULA未同意の場合はエラーではなく、通常のフローとして扱う
                    console.log(`[Agent] EULA not accepted for server ${serverId}. Requesting agreement from manager.`);
                    ws.send(JSON.stringify({
                        type: Message.REQUIRE_EULA_AGREEMENT,
                        requestId: requestId,
                        payload: {
                            serverId: serverId,
                            eulaContent: error.eulaContent
                        }
                    }));
                    // この時点では失敗応答はせず、ユーザーの操作を待つ
                } else {
                    // その他の予期せぬエラー
                    console.error(`[Agent] Failed to execute action '${action}' for server ${serverId}:`, error);
                    if (action === 'start') {
                       ws.send(JSON.stringify({
                           type: Message.SERVER_UPDATE,
                           payload: { serverId, type: 'status_change', payload: 'stopped' }
                       }));
                       ws.send(JSON.stringify({
                           type: Message.NOTIFY_WARN,
                           payload: { serverId, message: `サーバーの起動に失敗しました。<br>詳細: ${error.message}` }
                       }));
                    }
                    sendResponse(ws, requestId, type, false, { serverId, action }, error.message);
                }
            }
        }
        break;
      
      case Message.ACCEPT_EULA:
        {
            const { serverId } = payload;
            const serversDirectory = getSettings().servers_directory;
            const result = await acceptEula(serversDirectory, serverId);
            if (result.success) {
                // EULA同意に成功したら、再度サーバー起動を試みる
                console.log(`[Agent] EULA accepted for ${serverId}. Retrying start...`);
                // 元のCONTROL_SERVERリクエストと同じrequestIdを再利用する
                const originalRequestId = requestId;
                try {
                    const onUpdate = (update) => {
                        ws.send(JSON.stringify({
                            type: Message.SERVER_UPDATE,
                            payload: { serverId, ...update }
                        }));
                    };
                    await startServer(serversDirectory, serverId, ws, onUpdate);
                    sendResponse(ws, originalRequestId, Message.CONTROL_SERVER, true, { serverId, action: 'start' });
                } catch (error) {
                     console.error(`[Agent] Failed to restart server ${serverId} after EULA acceptance:`, error);
                     sendResponse(ws, originalRequestId, Message.CONTROL_SERVER, false, { serverId, action: 'start' }, error.message);
                }
            } else {
                sendResponse(ws, requestId, type, false, { serverId }, result.error || 'Failed to accept EULA.');
            }
        }
        break;

      case Message.INSTALL_JAVA:
        {
            const { version: javaVersion, downloadUrl } = payload;

            try {
                const installDir = getJavaInstallDir(javaVersion);
                const archivePath = path.join(os.tmpdir(), `java-archive-${javaVersion}${path.extname(downloadUrl)}`);

                const onProgress = (progress, downloaded, total) => {
                    const message = `Java ${javaVersion} をダウンロード中... ${progress}%`;
                    sendProgress(ws, requestId, type, { status: 'downloading', message, progress });
                };

                sendProgress(ws, requestId, type, { status: 'downloading', message: `Java ${javaVersion} のダウンロード準備中...`, progress: 0 });
                await downloadFile(downloadUrl, archivePath, onProgress);

                const onExtractProgress = (progressPayload) => {
                    // 展開処理は詳細な%進捗が取れないため、progress: 100 のままとする
                    sendProgress(ws, requestId, type, { ...progressPayload, progress: 100 });
                };
                await extractArchive(archivePath, installDir, onExtractProgress);

                const javaExecutable = getJavaExecutablePath(installDir);
                fs.unlinkSync(archivePath);
                
                sendResponse(ws, requestId, type, true, { javaVersion, installDir, javaExecutable });

            } catch (error) {
                console.error(`[Agent] Failed to install Java ${javaVersion}:`, error);
                sendResponse(ws, requestId, type, false, { javaVersion }, error.message);
            }
        }
        break;

      default:
        console.log(`Unknown message type: ${type}`);
        ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown message type: ${type}` } }));
    }
  });

  ws.on('close', () => {
    console.log('Manager disconnected.');
    // 接続が切れたら、このクライアントに関連するすべてのストリームを停止
    physicalServerMetricsIntervals.forEach((intervalId, streamId) => {
        console.log(`[Agent] Stopping physical server metrics stream ${streamId} due to disconnect.`);
        clearInterval(intervalId);
        physicalServerMetricsIntervals.delete(streamId);
    });
    // ゲームサーバーのストリームも同様に停止する必要があるが、wsオブジェクトをキーにしないと難しい
    // serverManager側でwsの状態をチェックしているので、一旦はそちらに任せる
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});
