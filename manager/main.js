import { app, BrowserWindow, ipcMain, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import axios from 'axios'; // axiosをインポート
import { v4 as uuidv4 } from 'uuid';
import { getAgents, setAgents, getWindowBounds, setWindowBounds } from './src/storeManager.js';
import { Message } from '@nl-server-manager/common/protocol.js';
import { ServerPropertiesAnnotations } from '@nl-server-manager/common/property-schema.js';

// --- ESM Polyfills for __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Agent Management ---

const agents = new Map(); // インメモリのAgent接続状態を管理
const pendingOperations = new Map(); // Agentへのリクエストを追跡する
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
        ws.send(JSON.stringify({ type: Message.GET_SYSTEM_INFO }));
    });

    ws.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data.toString());
            const { type, requestId, payload, operation } = parsedData;

            if (type !== Message.GAME_SERVER_METRICS_UPDATE && type !== Message.PHYSICAL_SERVER_METRICS_UPDATE) {
                 console.log(`Data from ${agent.config.alias}:`, parsedData);
            }

            switch(type) {
                case Message.GAME_SERVER_METRICS_UPDATE:
                    sendToRenderer(Message.GAME_SERVER_METRICS_UPDATE, { agentId: id, payload });
                    break;
                case Message.PHYSICAL_SERVER_METRICS_UPDATE:
                    sendToRenderer(Message.PHYSICAL_SERVER_METRICS_UPDATE, { agentId: id, payload });
                    break;
                case Message.METRICS_DATA:
                    sendToRenderer(Message.METRICS_DATA, { agentId: id, payload });
                    break;
                case Message.SERVER_LIST_UPDATE:
                    sendToRenderer(Message.SERVER_LIST_UPDATE, { agentId: id, servers: payload });
                    break;
                case Message.PROGRESS_UPDATE:
                    sendToRenderer(Message.PROGRESS_UPDATE, { agentId: id, requestId, operation, payload });
                    break;
                case Message.OPERATION_RESULT:
                    if (pendingOperations.has(requestId)) {
                        const { resolve, reject } = pendingOperations.get(requestId);
                        if (parsedData.success) {
                            resolve(payload);
                        } else {
                            console.log(`Operation ${operation} (${requestId}) failed: ${parsedData.error?.message || 'Operation failed'}`);
                        }
                        pendingOperations.delete(requestId);
                    }
                    // 完了/失敗をUIにも通知
                    sendToRenderer(Message.OPERATION_RESULT, { agentId: id, requestId, operation, ...parsedData });
                    break;
                case Message.SERVER_UPDATE:
                     sendToRenderer(Message.SERVER_UPDATE, { agentId: id, payload: payload });
                     break;
                case Message.NOTIFY_WARN:
                    sendToRenderer(Message.NOTIFY_WARN, { agentId: id, payload: payload });
                    break;
                case Message.REQUIRE_EULA_AGREEMENT:
                    sendToRenderer('require-eula-agreement', { agentId: id, requestId, payload });
                    break;
                case Message.SYSTEM_INFO_RESPONSE:
                    sendToRenderer('agent-system-info', { agentId: id, payload: payload });
                    break;
                default:
                    // その他のメッセージタイプもRendererに転送
                    sendToRenderer('agent-data', { agentId: id, data: parsedData });
            }

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

        // このAgentに関連する保留中の操作を失敗させる
        for (const [requestId, op] of pendingOperations.entries()) {
            if (op.agentId === id) {
                const error = new Error('Agent disconnected during operation.');
                op.reject(error);
                sendToRenderer('operation-result', {
                    agentId: id,
                    requestId,
                    operation: op.operation,
                    success: false,
                    error: { message: error.message }
                });
                pendingOperations.delete(requestId);
            }
        }

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
      preload: path.join(__dirname, 'dist/preload.js')
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
            agent.ws.send(JSON.stringify({ type: Message.GET_ALL_SERVERS }));
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

  // Agentにメッセージをプロキシする汎用ハンドラ
  ipcMain.on('proxy-to-agent', (event, { agentId, message }) => {
      const agent = getAgent(agentId);
      if (agent && agent.ws && agent.ws.readyState === WebSocket.OPEN) {
          const requestId = uuidv4();
          const messageWithId = { ...message, requestId };
          agent.ws.send(JSON.stringify(messageWithId));
          
          // 操作を追跡マップに追加
          pendingOperations.set(requestId, {
              agentId,
              operation: message.type,
              // このPromiseはタイムアウトや明示的な応答で使用できる
              resolve: () => {},
              reject: (err) => { console.error(`Operation ${message.type} (${requestId}) failed:`, err); }
          });

      } else {
          console.log(`Cannot proxy message: Agent ${agentId} is not connected.`);
          sendToRenderer('operation-result', {
              agentId,
              requestId: null,
              operation: message.type,
              success: false,
              error: { message: 'Agent is not connected.' }
          });
      }
  });

  // create-server と install-java は proxy-to-agent を使うようにUI側で変更するため、古いハンドラは削除

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

  // --- Java Version Detection ---
  const MANIFEST_URL_V2 = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

  /**
   * リリース日時に基づいてJavaバージョンを判定するフォールバック関数
   * @param {Date} date
   * @returns {number}
   */
  function detectJavaByDate(date) {
      if (date < new Date("2021-06-08T00:00:00Z")) return 8;   // 1.16.5まで
      if (date < new Date("2021-11-30T00:00:00Z")) return 16;  // 1.17.x
      if (date < new Date("2024-04-23T00:00:00Z")) return 17;  // 1.18〜1.20.4
      return 21;                                               // 1.20.5+
  }

  /**
   * 指定されたMinecraftバージョンに必要なJavaのメジャーバージョンを取得する
   * @param {string} mcVersion
   * @returns {Promise<number>}
   */
  async function getRequiredJavaVersion(mcVersion) {
      const manifest = (await axios.get(MANIFEST_URL_V2)).data;
      const entry = manifest.versions.find(v => v.id === mcVersion);
      if (!entry) throw new Error(`Version not found in manifest: ${mcVersion}`);

      const versionJson = (await axios.get(entry.url)).data;

      if (versionJson.javaVersion && versionJson.javaVersion.majorVersion) {
          return versionJson.javaVersion.majorVersion;
      }

      const releaseTime = new Date(entry.releaseTime);
      return detectJavaByDate(releaseTime);
  }

  // Minecraftバージョンから要求Javaバージョンを取得するIPCハンドラ
  ipcMain.handle('get-required-java-version', async (event, { mcVersion }) => {
      try {
          const javaVersion = await getRequiredJavaVersion(mcVersion);
          return { success: true, javaVersion };
      } catch (error) {
          console.error(`Error fetching required Java version for ${mcVersion}:`, error);
          return { success: false, error: error.message };
      }
  });


  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // --- Server Properties Annotations ---
  ipcMain.handle('get-server-properties-annotations', (event) => {
    return ServerPropertiesAnnotations;
  });

  // --- Minecraft Version Handling ---

  // Mojangのバージョンマニフェストを取得する関数 (axiosを使用)
  async function fetchMinecraftVersions() {
    try {
      const response = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      return response.data.versions;
    } catch (error) {
      console.error('Failed to fetch Minecraft versions with axios:', error);
      // エラーを呼び出し元に伝播させる
      throw new Error(error.response?.data?.error || error.message || 'Unknown error fetching versions');
    }
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