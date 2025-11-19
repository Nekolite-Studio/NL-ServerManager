import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Renderer to Main (Invoke/Send)
  rendererReady: () => ipcRenderer.send('renderer-ready'),
  getMinecraftVersions: () => ipcRenderer.send('get-minecraft-versions'),
  getJavaDownloadInfo: (options) => ipcRenderer.invoke('getJavaDownloadInfo', options),
  getRequiredJavaVersion: (options) => ipcRenderer.invoke('get-required-java-version', options),
  getServerPropertiesAnnotations: () => ipcRenderer.invoke('get-server-properties-annotations'),
  getForgeVersions: () => ipcRenderer.invoke('get-forge-versions'),

  // 汎用プロキシ経由でAgentにメッセージを送信
  proxyToAgent: (agentId, message) => ipcRenderer.send('proxy-to-agent', { agentId, message }),

  // Main to Renderer (On)
  onInitialLoadComplete: (callback) => ipcRenderer.once('initial-load-complete', (event, ...args) => callback(...args)),
  onMinecraftVersions: (callback) => ipcRenderer.on('minecraft-versions', (event, ...args) => callback(...args)),

  // Agentからの非同期データ受信
  onAgentList: (callback) => ipcRenderer.on('agent-list', (event, ...args) => callback(...args)),
  onAgentStatusUpdate: (callback) => ipcRenderer.on('agent-status-update', (event, ...args) => callback(...args)),
  onAgentSystemInfo: (callback) => ipcRenderer.on('agent-system-info', (event, ...args) => callback(...args)),
  onAgentLogEntry: (callback) => ipcRenderer.on('agent-log-entry', (event, ...args) => callback(...args)),
  onServerListUpdate: (callback) => ipcRenderer.on('server-list-update', (event, ...args) => callback(...args)),
  onServerUpdate: (callback) => ipcRenderer.on('server-update', (event, ...args) => callback(...args)),
  onMetricsData: (callback) => ipcRenderer.on('metrics-data', (event, ...args) => callback(...args)), // メトリクス専用
  onGameServerMetricsUpdate: (callback) => ipcRenderer.on('game-server-metrics-update', (event, ...args) => callback(...args)),
  onPhysicalServerMetricsUpdate: (callback) => ipcRenderer.on('physical-server-metrics-update', (event, ...args) => callback(...args)),

  // 操作の進捗と結果
  onProgressUpdate: (callback) => ipcRenderer.on('progress-update', (event, ...args) => callback(...args)),
  onOperationResult: (callback) => ipcRenderer.on('operation-result', (event, ...args) => callback(...args)),
  onNotifyWarn: (callback) => ipcRenderer.on('notify-warn', (event, ...args) => callback(...args)),
  onRequireEulaAgreement: (callback) => ipcRenderer.on('require-eula-agreement', (event, ...args) => callback(...args)),
});