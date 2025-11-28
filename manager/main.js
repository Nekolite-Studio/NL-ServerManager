import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWindowBounds, setWindowBounds } from './src/storeManager.js';
import { setupIpcHandlers } from './src/ipc/mainHandlers.js';
import { initializeAgents } from './src/services/agentManager.js';

// --- ESM Polyfills for __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// --- Electron App Setup ---

function createWindow() {
    const { width, height, x, y } = getWindowBounds();
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: x,
        y: y,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'dist/preload.js')
        }
    });

    // ウィンドウサイズが変更されたら保存する
    mainWindow.on('resize', () => {
        const { width, height } = mainWindow.getBounds();
        setWindowBounds({ width, height });
    });

    mainWindow.loadFile('index.html');

    // 起動時にDevToolsを起動する
    mainWindow.webContents.openDevTools();

    // IPCハンドラのセットアップ
    setupIpcHandlers(mainWindow);
}

app.whenReady().then(() => {
    createWindow();

    // Agentの初期化（保存されたAgentの読み込みと接続）
    initializeAgents();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});