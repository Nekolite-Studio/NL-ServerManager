import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as agentManager from '../services/agentManager.js';
import * as externalApiService from '../services/externalApiService.js';
import { ServerPropertiesAnnotations } from '../services/propertyAnnotations.js';

export function setupIpcHandlers(mainWindow) {
    // AgentManagerにMainWindowを設定
    agentManager.setMainWindow(mainWindow);

    // --- Agent Management Handlers ---

    ipcMain.on('request-agent-list', (event) => {
        agentManager.broadcastAgentList();
    });

    ipcMain.on('request-all-servers', (event) => {
        agentManager.requestAllServers();
    });

    // --- 起動シーケンス ---
    ipcMain.on('renderer-ready', () => {
        console.log('Renderer is ready. Broadcasting agent list.');
        // 1. まずAgent(物理サーバー)のリストをブロードキャストする
        agentManager.broadcastAgentList();
        // 2. UIに初期ロードが完了したことを通知 (サーバーリスト要求はUI側が担当)
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('initial-load-complete');
        }
    });

    ipcMain.handle('add-agent', async (event, config) => {
        console.log('Received request to add agent:', config);
        try {
            const id = uuidv4();
            agentManager.createAgent(id, config);
            agentManager.persistAgents();
            return { success: true, id };
        } catch (error) {
            console.error('Failed to add agent:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-agent-settings', (event, { agentId, config }) => {
        agentManager.updateAgentSettings(agentId, config);
    });

    ipcMain.handle('delete-agent', async (event, { agentId }) => {
        console.log(`Received request to delete agent: ${agentId}`);
        try {
            agentManager.deleteAgent(agentId);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete agent:', error);
            return { success: false, error: error.message };
        }
    });

    // Agentにメッセージをプロキシする汎用ハンドラ
    ipcMain.on('proxy-to-agent', async (event, { agentId, message }) => {
        if (message.type === 'create-server') {
            try {
                // externalApiServiceからdownloadUrlを取得し、メッセージに追加
                const downloadUrl = await externalApiService.getDownloadUrlForServerType(
                    message.payload.serverType || 'vanilla',
                    message.payload.versionId,
                    message.payload.loaderVersion
                );
                message.payload.downloadUrl = downloadUrl;
            } catch (error) {
                console.error(`Failed to get download URL for server creation: ${error.message}`);
                // エラーをRendererプロセスに返す
                event.sender.send('operation-result', {
                    requestId: message.requestId,
                    success: false,
                    error: { message: `サーバーJARのダウンロードURL取得に失敗しました: ${error.message}` }
                });
                return;
            }
        }
        agentManager.proxyToAgent(agentId, message);
    });

    // --- External API Handlers ---

    // Adoptium APIからJavaのダウンロード情報を取得するハンドラー
    ipcMain.handle('getJavaDownloadInfo', async (event, { feature_version, os, arch }) => {
        return await externalApiService.getJavaDownloadInfo(feature_version, os, arch);
    });

    // Minecraftバージョンから要求Javaバージョンを取得するIPCハンドラ
    ipcMain.handle('get-required-java-version', async (event, { mcVersion }) => {
        try {
            const javaVersion = await externalApiService.getRequiredJavaVersion(mcVersion);
            return { success: true, javaVersion };
        } catch (error) {
            console.error(`Error fetching required Java version for ${mcVersion}:`, error);
            return { success: false, error: error.message };
        }
    });

    // --- Server Properties Annotations ---
    ipcMain.handle('get-server-properties-annotations', (event) => {
        return ServerPropertiesAnnotations;
    });

    // --- Minecraft Version Handling ---

    // レンダラからのバージョン取得要求をハンドル
    ipcMain.on('get-minecraft-versions', async (event) => {
        try {
            const versions = await externalApiService.fetchMinecraftVersions();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('minecraft-versions', { success: true, versions });
            }
        } catch (error) {
            console.error('Failed to fetch Minecraft versions:', error);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('minecraft-versions', { success: false, error: error.toString() });
            }
        }
    });

    // Forge Version Handling
    ipcMain.handle('get-forge-versions', async (event) => {
        return await externalApiService.getForgeVersions();
    });

    // Fabric Version Handling
    ipcMain.handle('get-fabric-versions', async (event) => {
        return await externalApiService.getFabricVersions();
    });

    // Quilt Version Handling
    ipcMain.handle('get-quilt-versions', async (event) => {
        return await externalApiService.getQuiltVersions();
    });

    // NeoForge Version Handling
    ipcMain.handle('get-neoforge-versions', async (event, { mcVersion }) => {
        return await externalApiService.getNeoForgeVersions(mcVersion);
    });

    // Paper Version Handling
    ipcMain.handle('get-paper-versions', async (event) => {
        return await externalApiService.getPaperVersions();
    });

    // Mohist Version Handling
    ipcMain.handle('get-mohist-versions', async (event) => {
        return await externalApiService.getMohistVersions();
    });

    // Mohist Build Handling
    ipcMain.handle('get-mohist-builds', async (event, { mcVersion }) => {
        return await externalApiService.getMohistBuilds(mcVersion);
    });
}