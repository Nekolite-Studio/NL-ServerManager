const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// --- Agent Management ---

// Using a Map to store agent connections and their state
const agents = new Map();

function sendToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function addLog(agentId, message) {
    sendToRenderer('agent-log-entry', { agentId, message: `[${new Date().toLocaleTimeString()}] ${message}` });
}

function createAgent(config) {
    const id = uuidv4();
    const agent = {
        id,
        config, // { ip, port, alias }
        ws: null,
        status: 'Disconnected',
        reconnectInterval: null,
    };
    agents.set(id, agent);
    connectToAgent(id);
    // Notify renderer of the new agent
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
        // Remove listeners to prevent auto-reconnect on close
        agent.ws.removeAllListeners();
        agent.ws.close();
    }
    agents.delete(id);
    console.log(`Agent ${id} deleted.`);
    broadcastAgentList();
}

function connectToAgent(id) {
    const agent = getAgent(id);
    if (!agent) return;

    // Clear any existing reconnect timer
    if (agent.reconnectInterval) {
        clearTimeout(agent.reconnectInterval);
        agent.reconnectInterval = null;
    }
    
    // Prevent multiple connections
    if (agent.ws && (agent.ws.readyState === WebSocket.OPEN || agent.ws.readyState === WebSocket.CONNECTING)) {
        console.log(`Already connected or connecting to agent ${agent.config.alias}`);
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

        // Request initial system info on connection
        ws.send(JSON.stringify({ type: 'getSystemInfo' }));
    });

    ws.on('message', (data) => {
        try {
            const parsedData = JSON.parse(data.toString());
            // Don't log every metric update
            if (parsedData.type !== 'metricsData') {
                 console.log(`Data from ${agent.config.alias}:`, parsedData);
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
        
        // Setup reconnection
        if (!agent.reconnectInterval) {
            agent.reconnectInterval = setTimeout(() => connectToAgent(id), 5000);
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for agent ${agent.config.alias}: ${error.message}`);
        addLog(id, `Connection error: ${error.message}`);
        // The 'close' event will fire next, triggering the reconnect logic.
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

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // For now, let's create one agent by default to connect to our local server
  createAgent({ ip: '127.0.0.1', port: 8080, alias: 'Local Agent' });

  // --- IPC Handlers ---

  ipcMain.on('request-agent-list', (event) => {
    broadcastAgentList();
  });

  ipcMain.on('add-agent', (event, config) => {
    console.log('Received request to add agent:', config);
    createAgent(config);
  });

  ipcMain.on('update-agent-settings', (event, { agentId, config }) => {
    const agent = getAgent(agentId);
    if (agent) {
        console.log(`Updating agent ${agentId} with new config:`, config);
        agent.config = config;
        // Disconnect and reconnect with new settings
        if (agent.ws) {
            agent.ws.close();
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

  ipcMain.on('request-agent-metrics', (event, { agentId }) => {
    const agent = getAgent(agentId);
    if (agent && agent.ws && agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.send(JSON.stringify({ type: 'getMetrics' }));
    } else {
        // Don't log this, it can be noisy
        // console.log(`Cannot get metrics: Agent ${agentId} is not connected.`);
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});