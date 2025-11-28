import { initializeSettings } from './src/settingsManager.js';
import { loadAllServers } from './src/serverManager.js';
import { initializeWebSocketServer } from './src/websocket/server.js';

// --- 初期化処理 ---

// 1. Agent設定を初期化・ロード
const agentSettings = initializeSettings();
const PORT = agentSettings.api.port;

// 2. ゲームサーバー設定をロード
loadAllServers(agentSettings.servers_directory);

// 3. WebSocketサーバーを起動
initializeWebSocketServer(PORT);