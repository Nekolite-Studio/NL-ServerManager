const { app, BrowserWindow } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  const wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', ws => {
    console.log('Client connected');
    // Hardcode the IP for now, as per the plan
    const clientIp = '192.168.1.10'; 

    const pingInterval = setInterval(() => {
      // Send a ping with the current timestamp
      ws.ping(Date.now().toString());
    }, 5000);

    ws.on('pong', (payload) => {
      const startTime = parseInt(payload.toString(), 10);
      const latency = Date.now() - startTime;
      console.log(`Pong received from ${clientIp}. Latency: ${latency}ms`);
      // Send latency to the renderer process
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
      clearInterval(pingInterval); // Stop pinging this client
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(pingInterval);
    });

    ws.send('Hello! You are connected to the WebSocket server.');
  });

  console.log('WebSocket server started on port 8080');

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
