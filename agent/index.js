const WebSocket = require('ws');

const PORT = 8080;

// --- Dummy Data Generators ---

function getDummySystemInfo() {
  return {
    os: 'Linux (Dummy)',
    totalRam: '16 GB',
    cpu: 'Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz (Dummy)',
  };
}

function getDummyMetrics() {
  return {
    cpuUsage: (Math.random() * 100).toFixed(2),
    ramUsage: (Math.random() * 100).toFixed(2),
    diskUsage: (Math.random() * 100).toFixed(2),
    networkSpeed: (Math.random() * 1000).toFixed(2),
    gameServers: {
      running: Math.floor(Math.random() * 5) + 1,
      stopped: Math.floor(Math.random() * 3),
      totalPlayers: Math.floor(Math.random() * 50),
    },
  };
}


// --- WebSocket Server ---

const wss = new WebSocket.Server({ port: PORT });

console.log(`Agent WebSocket server started on port ${PORT}`);

wss.on('connection', (ws) => {
  console.log('Manager connected.');

  ws.on('message', (message) => {
    let parsedMessage;
    try {
      // Message is received as a Buffer, so we convert it to a string first
      parsedMessage = JSON.parse(message.toString());
    } catch (e) {
      console.error('Failed to parse incoming message:', message.toString());
      return;
    }

    console.log('Received message from manager:', parsedMessage);

    switch (parsedMessage.type) {
      case 'getSystemInfo':
        ws.send(JSON.stringify({
          type: 'systemInfo',
          payload: getDummySystemInfo(),
        }));
        break;

      case 'getMetrics':
        ws.send(JSON.stringify({
          type: 'metricsData',
          payload: getDummyMetrics(),
        }));
        break;
      
      // Example of a future push notification
      // case 'someEvent': 
      //   // This would be triggered by some internal agent logic, not a message
      //   ws.send(JSON.stringify({ type: 'notification', payload: { event: 'serverCrashed', serverId: 'mc-1' } }));
      //   break;

      default:
        console.log(`Unknown message type: ${parsedMessage.type}`);
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
