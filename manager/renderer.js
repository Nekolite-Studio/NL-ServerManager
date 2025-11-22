// manager/renderer.js
import { setupIpcListeners } from './src/ipc/rendererListeners.js';
import { setupDomListeners } from './src/dom/eventHandlers.js';
import { updateView } from './renderer-ui.js';

// このファイルはアプリケーションのエントリーポイントとして機能します。
// 1. モジュールの初期化
// 2. IPCイベントリスナーの設定
// 3. DOMイベントリスナーの設定
// 4. イベントに応じてstateの更新やUIの再描画を指示する

document.addEventListener('DOMContentLoaded', () => {
    // --- 初期化 ---
    // DOM要素をグローバル変数に代入 (renderer-ui.js で定義されたグローバル変数)
    window.serverListView = document.getElementById('server-list-view');
    window.physicalServerListView = document.getElementById('physical-server-list-view');
    window.serverDetailView = document.getElementById('server-detail-view');
    window.physicalServerDetailView = document.getElementById('physical-server-detail-view');
    window.serverListContainer = document.getElementById('server-list');
    window.navGameServers = document.getElementById('nav-game-servers');
    window.navPhysicalServers = document.getElementById('nav-physical-servers');

    // IPCリスナーの設定
    setupIpcListeners();

    // DOMイベントリスナーの設定
    setupDomListeners();
    
    // 初期ビューの描画
    updateView();
});