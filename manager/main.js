const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const axios = require('axios'); // axiosをインポート
const { v4: uuidv4 } = require('uuid');
const { getAgents, setAgents, getWindowBounds, setWindowBounds } = require('./src/storeManager');

// --- Agent Management ---

const agents = new Map(); // インメモリのAgent接続状態を管理
let mainWindow;

function sendToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function addLog(agentId, message) {
    sendToRenderer('agent-log-entry', { agentId, message: `[${new Date().toLocaleTimeString()}] ${message}` });
}

// Agentリストを永続化するヘルパー関数
function persistAgents() {
    const agentList = Array.from(agents.values()).map(agent => ({
        id: agent.id,
        ...agent.config // configオブジェクトを展開してフラットな構造で保存
    }));
    setAgents(agentList);
}

function createAgent(id, config) {
    const agent = {
        id,
        config, // { ip, port, alias }
        ws: null,
        status: 'Disconnected',
        reconnectInterval: null,
    };
    agents.set(id, agent);
    connectToAgent(id);
    broadcastAgentList();
    return agent;
}

function getAgent(id) {
    return agents.get(id);
}

function deleteAgent(id) {
    const agent = getAgent(id);
    if (!agent) return;

    if (agent.reconnectInterval) {
        clearTimeout(agent.reconnectInterval);
    }
    if (agent.ws) {
        agent.ws.removeAllListeners();
        agent.ws.close();
    }
    agents.delete(id);
    persistAgents(); // 変更を永続化
    console.log(`Agent ${id} deleted.`);
    broadcastAgentList();
}

function connectToAgent(id) {
    const agent = getAgent(id);
    if (!agent) return;

    if (agent.reconnectInterval) {
        clearTimeout(agent.reconnectInterval);
        agent.reconnectInterval = null;
    }

    if (agent.ws && (agent.ws.readyState === WebSocket.OPEN || agent.ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    addLog(id, `Connecting to ws://${agent.config.ip}:${agent.config.port}...`);
    const ws = new WebSocket(`ws://${agent.config.ip}:${agent.config.port}`);
    agent.ws = ws;
    agent.status = 'Connecting...';
    broadcastAgentStatus(id);

    ws.on('open', () => {
        console.log(`Connected to agent: ${agent.config.alias}`);
        addLog(id, 'Connection established.');
        agent.status = 'Connected';
        if (agent.reconnectInterval) {
            clearTimeout(agent.reconnectInterval);
            agent.reconnectInterval = null;
        }
        broadcastAgentStatus(id);
        ws.send(JSON.stringify({ type: 'getSystemInfo' }));
    });

    ws.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data.toString());
            if (parsedData.type !== 'metricsData') {
                 console.log(`Data from ${agent.config.alias}:`, parsedData);
            }
            // Agentからのサーバーリスト更新を中継
            if (parsedData.type === 'server_list_update') {
               sendToRenderer('server_list_update', { agentId: id, servers: parsedData.payload });
               console.log(`[Agent Op] Server list update received from agent ${agent.config.alias}.`);
            } else if (parsedData.payload && parsedData.payload.path) {
               // パス情報を含むイベントをログに出力
               console.log(`[Agent Op] Type: ${parsedData.type}, Path: ${parsedData.payload.path}`);
            }

            if (parsedData.type === 'server_creation_failed') {
               sendToRenderer('server_creation_failed', { agentId: id, error: parsedData.payload.error });
            }
            sendToRenderer('agent-data', { agentId: id, data: parsedData });
        } catch (error) {
            console.error(`Error parsing JSON from agent ${agent.config.alias}:`, error);
            addLog(id, `Error parsing data: ${error.message}`);
        }
    });

    ws.on('close', () => {
        console.log(`Disconnected from agent: ${agent.config.alias}. Reconnecting in 5s.`);
        addLog(id, 'Disconnected. Attempting to reconnect in 5 seconds.');
        agent.status = 'Disconnected';
        agent.ws = null;
        broadcastAgentStatus(id);
        if (!agent.reconnectInterval) {
            agent.reconnectInterval = setTimeout(() => connectToAgent(id), 5000);
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for agent ${agent.config.alias}: ${error.message}`);
        addLog(id, `Connection error: ${error.message}`);
        ws.close();
    });
}

function broadcastAgentStatus(id) {
    const agent = getAgent(id);
    if (agent) {
        sendToRenderer('agent-status-update', {
            id: agent.id,
            status: agent.status,
            config: agent.config
        });
    }
}

function broadcastAgentList() {
    const agentList = Array.from(agents.values()).map(agent => ({
        id: agent.id,
        status: agent.status,
        config: agent.config
    }));
    sendToRenderer('agent-list', agentList);
}

// --- Electron App Setup ---

function createWindow () {
  const { width, height } = getWindowBounds();
  mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // ウィンドウサイズが変更されたら保存する
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    setWindowBounds({ width, height });
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // 保存されたAgentリストを読み込んで接続を開始
  const storedAgents = getAgents();
  if (storedAgents && storedAgents.length > 0) {
      console.log(`Loading ${storedAgents.length} agent(s) from store.`);
      storedAgents.forEach(agentData => {
          // ストアから渡されるデータをコンソールに出力して確認
          console.log('Data from store for createAgent:', agentData);
          // ストアからはフラットな構造で読み込まれるため、メモリで扱うconfigオブジェクトに再構成する
          const { id, ip, port, alias } = agentData;
          createAgent(id, { ip, port, alias });
      });
  } else {
      // 初回起動時など、保存されたAgentがない場合はローカルをデフォルトで追加
      console.log('No stored agents found. Adding default local agent.');
      const id = uuidv4();
      createAgent(id, { ip: '127.0.0.1', port: 8080, alias: 'Local Agent' });
      persistAgents();
  }


  // --- IPC Handlers ---

  ipcMain.on('request-agent-list', (event) => {
    broadcastAgentList();
  });

  ipcMain.on('request-all-servers', (event) => {
    console.log('Received request for all servers from renderer.');
    for (const agent of agents.values()) {
        if (agent.ws && agent.ws.readyState === WebSocket.OPEN) {
            agent.ws.send(JSON.stringify({ type: 'getAllServers' }));
        }
    }
  });

  // --- 起動シーケンス ---
  ipcMain.on('renderer-ready', () => {
    console.log('Renderer is ready. Broadcasting agent list.');
    // 1. まずAgent(物理サーバー)のリストをブロードキャストする
    broadcastAgentList();
    // 2. UIに初期ロードが完了したことを通知 (サーバーリスト要求はUI側が担当)
    sendToRenderer('initial-load-complete');
  });

  ipcMain.on('add-agent', (event, config) => {
    console.log('Received request to add agent:', config);
    const id = uuidv4();
    createAgent(id, config);
    persistAgents();
  });

  ipcMain.on('update-agent-settings', (event, { agentId, config }) => {
    const agent = getAgent(agentId);
    if (agent) {
        console.log(`Updating agent ${agentId} with new config:`, config);
        agent.config = config;
        persistAgents();
        if (agent.ws) {
            agent.ws.close(); // closeイベントで再接続がトリガーされる
        } else {
            connectToAgent(agentId);
        }
        broadcastAgentStatus(agentId);
    }
  });

  ipcMain.on('delete-agent', (event, { agentId }) => {
    console.log(`Received request to delete agent: ${agentId}`);
    deleteAgent(agentId);
  });

  ipcMain.on('create-server', (event, { hostId, versionId }) => {
    console.log(`Received request to create server on host ${hostId} with version ${versionId}`);
    const agent = getAgent(hostId);
    if (agent && agent.ws && agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.send(JSON.stringify({
            type: 'create_server',
            payload: { versionId }
        }));
    } else {
        console.log(`Cannot create server: Agent ${hostId} is not connected.`);
        sendToRenderer('server_creation_failed', { agentId: hostId, error: 'Agent is not connected.' });
    }
  });

  // Agentにメッセージをプロキシする汎用ハンドラ
  ipcMain.on('proxy-to-agent', (event, { agentId, message }) => {
      const agent = getAgent(agentId);
      if (agent && agent.ws && agent.ws.readyState === WebSocket.OPEN) {
          agent.ws.send(JSON.stringify(message));
      } else {
          console.log(`Cannot proxy message: Agent ${agentId} is not connected.`);
      }
  });

  // Adoptium APIからJavaのダウンロード情報を取得するハンドラー
  ipcMain.handle('getJavaDownloadInfo', async (event, { feature_version, os, arch }) => {
    try {
      const jvm_impl = 'hotspot';
      const image_type = 'jdk';
      const vendor = 'eclipse';

      const apiUrl = `https://api.adoptium.net/v3/assets/latest/${feature_version}/${jvm_impl}`;
      const response = await axios.get(apiUrl, {
        params: {
          os,
          architecture: arch,
          image_type,
          vendor
        }
      });

      const release = response.data[0]; // 最初のリリースを取得

      if (release && release.binary && release.binary.package) {
        const downloadLink = release.binary.package.link;
        const fileSize = release.binary.package.size;
        console.log(`Java Download Info: URL=${downloadLink}, Size=${fileSize}`);
        return { success: true, downloadLink, fileSize };
      } else {
        console.warn('No download link or file size found in Adoptium API response.');
        return { success: false, error: 'Download information not found.' };
      }
    } catch (error) {
      console.error('Error fetching Java download info from Adoptium API:', error);
      return { success: false, error: error.message };
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // --- Minecraft Version Handling ---

  // Mojangのバージョンマニフェストを取得する関数
  async function fetchMinecraftVersions() {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        protocol: 'https:',
        hostname: 'launchermeta.mojang.com',
        path: '/mc/game/version_manifest.json'
      });

      let body = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          try {
            const parsedJson = JSON.parse(body);
            resolve(parsedJson.versions);
          } catch (error) {
            reject(`Failed to parse JSON: ${error.message}`);
          }
        });
      });

      request.on('error', (error) => {
        reject(`Request failed: ${error.message}`);
      });

      request.end();
    });
  }

  // レンダラからのバージョン取得要求をハンドル
  ipcMain.on('get-minecraft-versions', async (event) => {
    try {
      const versions = await fetchMinecraftVersions();
      mainWindow.webContents.send('minecraft-versions', { success: true, versions });
    } catch (error) {
      console.error('Failed to fetch Minecraft versions:', error);
      mainWindow.webContents.send('minecraft-versions', { success: false, error: error.toString() });
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});