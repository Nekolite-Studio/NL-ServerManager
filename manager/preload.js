const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer to Main (Invoke/Send)
  requestAgentList: () => ipcRenderer.send('request-agent-list'),
  requestAllServers: () => ipcRenderer.send('request-all-servers'),
  requestAgentMetrics: (agentId) => ipcRenderer.send('request-agent-metrics', { agentId }),
  proxyToServer: (agentId, message) => ipcRenderer.send('proxy-to-agent', { agentId, message }),
  addAgent: (config) => ipcRenderer.send('add-agent', config),
  updateAgentSettings: (data) => ipcRenderer.send('update-agent-settings', data), // { agentId, config }
  deleteAgent: (agentId) => ipcRenderer.send('delete-agent', { agentId }),
  createServer: (data) => ipcRenderer.send('create-server', data), // { hostId }
  rendererReady: () => ipcRenderer.send('renderer-ready'),
  getMinecraftVersions: () => ipcRenderer.send('get-minecraft-versions'),
  installJava: (agentId, javaInstallData) => ipcRenderer.send('install-java', { agentId, javaInstallData }),
  getJavaDownloadInfo: (options) => ipcRenderer.invoke('getJavaDownloadInfo', options),

  // Main to Renderer (On)
  onMinecraftVersions: (callback) => ipcRenderer.on('minecraft-versions', (event, ...args) => callback(...args)),
  onInitialLoadComplete: (callback) => ipcRenderer.once('initial-load-complete', (event, ...args) => callback(...args)),
  onAgentList: (callback) => ipcRenderer.on('agent-list', (event, ...args) => callback(...args)),
  onAgentStatusUpdate: (callback) => ipcRenderer.on('agent-status-update', (event, ...args) => callback(...args)),
  onAgentData: (callback) => ipcRenderer.on('agent-data', (event, ...args) => callback(...args)),
  onAgentLogEntry: (callback) => ipcRenderer.on('agent-log-entry', (event, ...args) => callback(...args)),
  onServerListUpdate: (callback) => ipcRenderer.on('server_list_update', (event, ...args) => callback(...args)),
  onServerCreationFailed: (callback) => ipcRenderer.on('server_creation_failed', (event, ...args) => callback(...args)),
  onJavaInstallStatus: (callback) => ipcRenderer.on('java-install-status', (event, ...args) => callback(...args)),

  // Keep this for now for other functionalities, will be removed if not needed
  sendJsonMessage: (message) => ipcRenderer.send('send-json-message', message)
});