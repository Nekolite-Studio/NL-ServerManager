// manager/renderer.js
import { setupIpcListeners } from './src/ipc/rendererListeners.js';
import { setupDomListeners } from './src/dom/eventHandlers.js';
import { updateView } from './renderer-ui.js';
import { EulaModal } from './src/ui/components/eulaModal.js';

// このファイルはアプリケーションのエントリーポイントとして機能します。
// 1. モジュールの初期化
// 2. IPCイベントリスナーの設定
// 3. DOMイベントリスナーの設定
// 4. イベントに応じてstateの更新やUIの再描画を指示する

document.addEventListener('DOMContentLoaded', () => {
    // --- 初期化 ---
    window.eulaModal = new EulaModal();

    // IPCリスナーの設定
    setupIpcListeners();

    // DOMイベントリスナーの設定
    setupDomListeners();
    
    // 初期ビューの描画
    updateView();
});