// manager/renderer-ui.js
// UIの描画と更新を担当する関数群
// このファイルは renderer-state.js の後に読み込まれる必要があります。

import { state } from './renderer-state.js';
import { renderServerList } from './src/ui/views/serverListView.js';
import { renderPhysicalServerList } from './src/ui/views/physicalServerListView.js';
import { renderServerDetail, updateDetailViewContent } from './src/ui/views/serverDetailView.js';
import { renderPhysicalServerDetail, updatePhysicalServerDetailContent } from './src/ui/views/physicalServerDetailView.js';
import { showNotification } from './src/ui/components/notification.js';
import { showConfirmationModal } from './src/ui/components/modal.js';

// --- DOM要素 (グローバルアクセス用) ---
// メインの renderer.js の DOMContentLoaded 内で代入されます
// 注意: これらの変数は renderer.js から window オブジェクト経由でアクセスされることを想定しています
// ここではモジュールスコープの変数として定義せず、windowオブジェクトのプロパティとして扱います

// D&D状態管理
export let draggedAddon = null; // {id, type}

// --- レンダリング関数 (v5で更新) ---

const updateDetailView = () => {
    if (state.currentView !== 'detail') return;
    renderServerDetail(window.serverDetailView);
};

const updateView = () => {
    // console.log(`[View] Updating view to: ${state.currentView}`); // ログ過多を防ぐためコメントアウト
    
    // DOM要素の取得 (renderer.js で初期化されているはずだが、念のためチェック)
    const serverListView = window.serverListView;
    const physicalServerListView = window.physicalServerListView;
    const serverDetailView = window.serverDetailView;
    const physicalServerDetailView = window.physicalServerDetailView;
    const navGameServers = window.navGameServers;
    const navPhysicalServers = window.navPhysicalServers;

    if (!serverListView || !physicalServerListView || !serverDetailView || !physicalServerDetailView) {
        console.error("DOM要素が初期化されていません。");
        return;
    }

    // ビューの表示切り替え
    // 注意: hiddenクラスの切り替えは、DOMの再構築を引き起こさないため安全です
    serverListView.classList.toggle('hidden', state.currentView !== 'list');
    physicalServerListView.classList.toggle('hidden', state.currentView !== 'physical');
    serverDetailView.classList.toggle('hidden', state.currentView !== 'detail');
    physicalServerDetailView.classList.toggle('hidden', state.currentView !== 'physical-detail');

    const isGameView = state.currentView === 'list' || state.currentView === 'detail';
    const isPhysicalView = state.currentView === 'physical' || state.currentView === 'physical-detail';

    if (navGameServers) {
        navGameServers.classList.toggle('bg-primary', isGameView);
        navGameServers.classList.toggle('text-white', isGameView);
        navGameServers.classList.toggle('text-gray-600', !isGameView);
        navGameServers.classList.toggle('dark:text-gray-300', !isGameView);
    }
    
    if (navPhysicalServers) {
        navPhysicalServers.classList.toggle('bg-primary', isPhysicalView);
        navPhysicalServers.classList.toggle('text-white', isPhysicalView);
        navPhysicalServers.classList.toggle('text-gray-600', !isPhysicalView);
        navPhysicalServers.classList.toggle('dark:text-gray-300', !isPhysicalView);
    }

    // 各ビューのレンダリング関数を呼び出し
    // 各関数内部で「初回描画」か「部分更新」かを判断して処理します
    if (state.currentView === 'list') {
        renderServerList(window.serverListContainer);
    } else if (state.currentView === 'detail') {
        renderServerDetail(window.serverDetailView);
    } else if (state.currentView === 'physical') {
        renderPhysicalServerList(document.getElementById('physical-server-list'));
    } else if (state.currentView === 'physical-detail') {
        renderPhysicalServerDetail(window.physicalServerDetailView);
    }
};

// グローバルに公開 (ESMからのアクセス用)
window.updateView = updateView;
window.renderPhysicalServerDetail = () => renderPhysicalServerDetail(window.physicalServerDetailView);
window.renderServerDetail = () => renderServerDetail(window.serverDetailView);
window.updateDetailViewContent = updateDetailViewContent;
window.updatePhysicalServerDetailContent = updatePhysicalServerDetailContent;
window.showNotification = showNotification;
window.showConfirmationModal = showConfirmationModal;

export {
    updateView,
    renderServerList,
    renderPhysicalServerList,
    renderServerDetail,
    renderPhysicalServerDetail,
    updateDetailViewContent,
    updatePhysicalServerDetailContent,
    showNotification,
    showConfirmationModal
};