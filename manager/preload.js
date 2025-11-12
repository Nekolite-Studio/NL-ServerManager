const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdatePing: (callback) => ipcRenderer.on('update-ping', (event, ...args) => callback(...args)),
  sendJsonMessage: (message) => ipcRenderer.send('send-json-message', message)
});