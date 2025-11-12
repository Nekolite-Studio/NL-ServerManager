const WebSocket = require('ws');

console.log('Agent starting...');

function connect() {
  const ws = new WebSocket('ws://localhost:8080');

  ws.on('open', function open() {
    console.log('Connected to manager');
    ws.send('Hello from agent!');
  });

  ws.on('message', function message(data) {
    console.log('received: %s', data);
  });

  ws.on('close', function close() {
    console.log('Disconnected from manager. Reconnecting in 5 seconds...');
    setTimeout(connect, 5000);
  });

  ws.on('error', function error(err) {
    console.error('WebSocket error. Retrying connection...');
    // The 'close' event will be fired next, triggering reconnection.
  });
}

connect();

console.log('Agent is running...');