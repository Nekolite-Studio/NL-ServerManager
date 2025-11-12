const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer to Main (Invoke/Send)
  requestAgentList: () => ipcRenderer.send('request-agent-list'),
  requestAgentMetrics: (agentId) => ipcRenderer.send('request-agent-metrics', { agentId }),
  addAgent: (config) => ipcRenderer.send('add-agent', config),
  updateAgentSettings: (data) => ipcRenderer.send('update-agent-settings', data), // { agentId, config }
  deleteAgent: (agentId) => ipcRenderer.send('delete-agent', { agentId }),

  // Main to Renderer (On)
  onAgentList: (callback) => ipcRenderer.on('agent-list', (event, ...args) => callback(...args)),
  onAgentStatusUpdate: (callback) => ipcRenderer.on('agent-status-update', (event, ...args) => callback(...args)),
  onAgentData: (callback) => ipcRenderer.on('agent-data', (event, ...args) => callback(...args)),
  onAgentLogEntry: (callback) => ipcRenderer.on('agent-log-entry', (event, ...args) => callback(...args)),

  // Keep this for now for other functionalities, will be removed if not needed
  sendJsonMessage: (message) => ipcRenderer.send('send-json-message', message)
});