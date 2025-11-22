import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { getAgents as getStoredAgents, setAgents as setStoredAgents } from '../storeManager.js';
import { Message } from '@nl-server-manager/common/protocol.js';

const agents = new Map(); // インメモリのAgent接続状態を管理
const pendingOperations = new Map(); // Agentへのリクエストを追跡する
let mainWindow;

/**
 * メインウィンドウの参照を設定する
 * @param {import('electron').BrowserWindow} window
 */
function setMainWindow(window) {
    mainWindow = window;
}

/**
 * Rendererプロセスにメッセージを送信する
 * @param {string} channel
 * @param {any} data
 */
function sendToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

/**
 * AgentのログをRendererに送信する
 * @param {string} agentId
 * @param {string} message
 */
function addLog(agentId, message) {
    sendToRenderer('agent-log-entry', { agentId, message: `[${new Date().toLocaleTimeString()}] ${message}` });
}

/**
 * Agentリストを永続化する
 */
function persistAgents() {
    const agentList = Array.from(agents.values()).map(agent => ({
        id: agent.id,
        ...agent.config // configオブジェクトを展開してフラットな構造で保存
    }));
    setStoredAgents(agentList);
}

/**
 * 新しいAgentを作成し、接続を開始する
 * @param {string} id
 * @param {object} config
 * @returns {object}
 */
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

/**
 * Agentを取得する
 * @param {string} id
 * @returns {object|undefined}
 */
function getAgent(id) {
    return agents.get(id);
}

/**
 * 全てのAgentを取得する
 * @returns {Map<string, object>}
 */
function getAllAgents() {
    return agents;
}

/**
 * Agentを削除する
 * @param {string} id
 */
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

/**
 * AgentへのWebSocket接続を確立する
 * @param {string} id
 */
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

            switch (type) {
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
                case Message.OPERATION_WARNING:
                    sendToRenderer('operation-warning', { agentId: id, payload: payload });
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

/**
 * Agentの状態更新をRendererに通知する
 * @param {string} id
 */
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

/**
 * 全AgentリストをRendererに通知する
 */
function broadcastAgentList() {
    const agentList = Array.from(agents.values()).map(agent => ({
        id: agent.id,
        status: agent.status,
        config: agent.config
    }));
    sendToRenderer('agent-list', agentList);
}

/**
 * 保存されたAgent設定を読み込み、初期化する
 */
function initializeAgents() {
    // 保存されたAgentリストを読み込んで接続を開始
    const storedAgents = getStoredAgents();
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
}

/**
 * Agentの設定を更新する
 * @param {string} agentId
 * @param {object} config
 */
function updateAgentSettings(agentId, config) {
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
}

/**
 * RendererからのメッセージをAgentにプロキシする
 * @param {string} agentId
 * @param {object} message
 */
function proxyToAgent(agentId, message) {
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
            resolve: () => { },
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
}

/**
 * 全Agentに対してサーバーリストを要求する
 */
function requestAllServers() {
    console.log('Received request for all servers from renderer.');
    for (const agent of agents.values()) {
        if (agent.ws && agent.ws.readyState === WebSocket.OPEN) {
            agent.ws.send(JSON.stringify({ type: Message.GET_ALL_SERVERS }));
        }
    }
}

export {
    setMainWindow,
    createAgent,
    getAgent,
    getAllAgents,
    deleteAgent,
    connectToAgent,
    broadcastAgentList,
    broadcastAgentStatus,
    initializeAgents,
    updateAgentSettings,
    proxyToAgent,
    requestAllServers,
    persistAgents
};