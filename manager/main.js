const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let wss;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools()
}

function setupWebSocketServer() {
    wss = new WebSocket.Server({ port: 8080 });

    wss.on('connection', ws => {
        console.log('Client connected');
        // Hardcode the IP for now, as per the plan
        const clientIp = '192.168.1.10';

        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping(Date.now().toString());
            } else {
                clearInterval(pingInterval);
            }
        }, 5000);

        ws.on('pong', (payload) => {
            const startTime = parseInt(payload.toString(), 10);
            const latency = Date.now() - startTime;
            console.log(`Pong received from ${clientIp}. Latency: ${latency}ms`);
            if (mainWindow) {
                mainWindow.webContents.send('update-ping', { ip: clientIp, latency });
            }
        });

        ws.on('message', message => {
            console.log(`Received message => ${message}`);
            // Echo message back to all clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            clearInterval(pingInterval);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            clearInterval(pingInterval);
        });

        ws.send('Hello! You are connected to the WebSocket server.');
    });

    console.log('WebSocket server started on port 8080');
}

function broadcastToAgents(message) {
    if (!wss) return;
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}


app.whenReady().then(() => {
  createWindow();
  setupWebSocketServer();

  ipcMain.on('send-json-message', (event, message) => {
    console.log('JSON message from renderer:', message);
    // Here you would typically send this to the agent via WebSocket
    broadcastToAgents(message);
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
