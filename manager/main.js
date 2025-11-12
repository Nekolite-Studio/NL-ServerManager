const { app, BrowserWindow } = require('electron');
const path = require('path');
const WebSocket = require('ws');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  const wss = new WebSocket.Server({ port: 8080 });

  function heartbeat() {
    this.isAlive = true;
  }

  wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    console.log('Client connected');
    ws.on('message', message => {
      console.log(`Received message => ${message}`);
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
    ws.send('Hello! You are connected to the WebSocket server.');
  });

  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
      ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toLocaleTimeString() }));
    });
  }, 5000);

  wss.on('close', function close() {
    clearInterval(interval);
  });

  console.log('WebSocket server started on port 8080');

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
