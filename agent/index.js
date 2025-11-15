const WebSocket = require('ws');
const os = require('os');
const path = require('path');
const { initializeSettings, getSettings } = require('./src/settingsManager');
const { loadAllServers, getAllServers, getServer, updateServer, deleteServer, startServer, stopServer } = require('./src/serverManager');

// --- 初期化処理 ---

// 1. Agent設定を初期化・ロード
const agentSettings = initializeSettings();
const PORT = agentSettings.api.port;

// 2. ゲームサーバー設定をロード
loadAllServers(agentSettings.servers_directory);


// --- データ取得関数 ---

function getSystemInfo() {
  return {
    os: `${os.type()} ${os.release()}`,
    totalRam: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    cpu: os.cpus()[0].model,
  };
}

function getMetrics() {
  const servers = getAllServers();
  const runningServers = servers.filter(s => s.status === 'running').length;
  const stoppedServers = servers.length - runningServers;

  return {
    // CPU/RAM使用率はダミーのままですが、サーバー数は実際のデータに基づきます
    cpuUsage: (Math.random() * 100).toFixed(2),
    ramUsage: (Math.random() * 100).toFixed(2),
    diskUsage: (Math.random() * 100).toFixed(2),
    networkSpeed: (Math.random() * 1000).toFixed(2),
    gameServers: {
      running: runningServers,
      stopped: stoppedServers,
      totalPlayers: Math.floor(Math.random() * 50), // プレイヤー数はまだダミー
    },
  };
}

// --- WebSocketサーバー ---

const wss = new WebSocket.Server({ port: PORT });

// 接続しているすべてのManagerにブロードキャストするヘルパー関数
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// サーバーリストの更新を全Managerに通知する
function broadcastServerListUpdate() {
    const allServers = getAllServers();
    broadcast({ type: 'server_list_update', payload: allServers });
}


console.log(`Agent WebSocket server started on port ${PORT}`);

wss.on('connection', (ws) => {
  console.log('Manager connected.');

  // 接続時に現在のサーバーリストを送信
  ws.send(JSON.stringify({ type: 'server_list_update', payload: getAllServers() }));


  ws.on('message', async (message) => {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch (e) {
      console.error('Failed to parse incoming message:', message.toString());
      return;
    }

    console.log('Received message from manager:', parsedMessage);
    const { type, payload } = parsedMessage;

    switch (type) {
      // --- System & Server Info ---
      case 'getSystemInfo':
        ws.send(JSON.stringify({ type: 'systemInfo', payload: getSystemInfo() }));
        break;
      case 'getMetrics':
        ws.send(JSON.stringify({ type: 'metricsData', payload: getMetrics() }));
        break;
      case 'getAllServers': // このcaseは下位互換性のために残すが、基本はbroadcastServerListUpdateを使う
        ws.send(JSON.stringify({ type: 'server_list_update', payload: getAllServers() }));
        break;
      
      // --- Server Management ---
      case 'create_server':
        {
            const serversDirectory = getSettings().servers_directory;
            // payloadからversionIdを取得
            const { versionId } = payload;
            // updateServerは非同期になるのでawaitを使う
            // 第3引数にversionIdを含むオブジェクトを渡す
            const result = await updateServer(serversDirectory, null, { versionId });
            if (result && result.config) {
                 ws.send(JSON.stringify({ type: 'server_created', payload: { ...result.config, path: result.path } }));
                 broadcastServerListUpdate(); // リストの更新をブロードキャスト
            } else {
                 // resultがnullの場合、pathも存在しないので調整
                 ws.send(JSON.stringify({ type: 'server_creation_failed', payload: { error: 'Failed to create server. It might already exist or the download failed.', path: 'N/A' } }));
                 // 失敗した場合も、既存のリストを再送してUIの整合性を保つ
                 broadcastServerListUpdate();
            }
        }
        break;
      case 'createServer': // 古いAPI, 将来的に削除
        const createResult = await updateServer(getSettings().servers_directory, null, payload.config);
        if (createResult && createResult.config) {
            ws.send(JSON.stringify({ type: 'serverCreated', payload: { ...createResult.config, path: createResult.path } }));
            broadcastServerListUpdate();
        } else {
            // エラーハンドリングを追加
            ws.send(JSON.stringify({ type: 'server_creation_failed', payload: { serverId: payload.config.server_id, error: 'Failed to create server.' } }));
        }
        break;
      case 'updateServer':
        const updateResult = await updateServer(getSettings().servers_directory, payload.serverId, payload.config);
        ws.send(JSON.stringify({ type: 'serverUpdated', payload: { ...updateResult.config, path: updateResult.path } }));
        broadcastServerListUpdate();
        break;
      case 'deleteServer':
        const deleteResult = deleteServer(getSettings().servers_directory, payload.serverId);
        ws.send(JSON.stringify({ type: 'serverDeleted', payload: { serverId: payload.serverId, success: deleteResult.success, path: deleteResult.path } }));
        broadcastServerListUpdate();
        break;

      case 'control_server':
        {
            const { serverId, action } = payload;
            console.log(`Received control request for server ${serverId}: ${action}`);
            const serversDirectory = getSettings().servers_directory;
            try {
                if (action === 'start') {
                    // サーバーの状態更新をManagerに通知するためのコールバック
                    const onUpdate = (update) => {
                        // この接続（ws）経由でManagerに更新情報を送信
                        ws.send(JSON.stringify({
                            type: 'server_update',
                            payload: {
                                serverId,
                                type: update.type,
                                payload: update.payload
                            }
                        }));
                    };
                    await startServer(serversDirectory, serverId, onUpdate);
                } else if (action === 'stop') {
                    await stopServer(serverId);
                    // サーバー停止は serverManager の 'close' イベントで検知され、
                    // onUpdate コールバックを通じて通知されるので、ここでの個別通知は不要。
                } else {
                    console.warn(`[Agent] Unknown server control action: ${action}`);
                }
            } catch (error) {
                console.error(`[Agent] Failed to execute action '${action}' for server ${serverId}:`, error);
                ws.send(JSON.stringify({ type: 'server_action_failed', payload: { serverId, action, error: error.message } }));
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
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});
