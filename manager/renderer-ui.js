// manager/renderer-ui.js
// UIの描画と更新を担当する関数群
// このファイルは renderer-state.js の後に読み込まれる必要があります。

// manager/renderer-ui.js
// UIの描画と更新を担当する関数群
import { state } from './renderer-state.js';
import { renderAccordionLayout } from './src/ui/layouts/accordionLayout.js';
import { renderKanbanLayout } from './src/ui/layouts/kanbanLayout.js';
import { renderTreeGridLayout } from './src/ui/layouts/treeGridLayout.js';
import { renderSidebarLayout } from './src/ui/layouts/sidebarLayout.js';
import { renderTabsLayout } from './src/ui/layouts/tabsLayout.js';
import { renderServerDetail, updateDetailViewContent } from './src/ui/views/serverDetailView.js';
import { renderPhysicalServerDetail, updatePhysicalServerDetailContent } from './src/ui/views/physicalServerDetailView.js';
import { updateAccordionServer, updateAccordionAgent } from './src/ui/layouts/accordionLayout.js';

// Component Imports
import { showNotification } from './src/ui/components/notification.js';
import { ServerCreateModal } from './src/ui/components/serverCreateModal.js';
import { SettingsModal } from './src/ui/components/settingsModal.js';
import { AgentRegisterModal } from './src/ui/components/agentRegisterModal.js';

// --- v6 UI Rendering Engine ---

const layoutRenderers = {
    accordion: renderAccordionLayout,
    kanban: renderKanbanLayout,
    treegrid: renderTreeGridLayout,
    sidebar: renderSidebarLayout,
    tabs: renderTabsLayout,
};

const layoutNames = {
    'accordion': 'Accordion List',
    'kanban': 'Kanban Board',
    'treegrid': 'Tree Data Grid',
    'sidebar': 'Sidebar Filter',
    'tabs': 'Tabbed Focus'
};

function renderHeader() {
    const header = document.getElementById('app-header');
    if (!header) return;

    header.innerHTML = `
        <div class="flex justify-between items-center w-full">
            <div class="flex items-center gap-3">
                <div class="bg-primary/10 p-2 rounded-lg">
                    <i data-lucide="cat" class="text-primary w-5 h-5"></i>
                </div>
                <span class="font-bold text-lg text-gray-800 dark:text-white tracking-tight">Nekolite-Server Manager</span>
            </div>
            <div class="flex items-center gap-3">
                <div class="hidden sm:flex items-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <i data-lucide="layout" class="w-3 h-3 mr-2"></i>
                    <span id="current-layout-name">${layoutNames[state.layoutMode] || 'Unknown'}</span>
                </div>
                <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                <button data-action="toggle-theme" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors" title="Toggle Theme">
                    <i data-lucide="moon" class="w-5 h-5 hidden dark:block"></i>
                    <i data-lucide="sun" class="w-5 h-5 block dark:hidden"></i>
                </button>
                <button data-action="open-settings" class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors" title="Settings">
                    <i data-lucide="settings" class="w-5 h-5 animate-spin-slow-hover"></i>
                </button>
            </div>
        </div>
    `;
}


const updateView = () => {
    const container = document.getElementById('app-container');
    if (!container) {
        console.error('App container not found!');
        return;
    }

    // 1. ヘッダーを描画
    renderHeader();

    // 2. テーマを適用
    document.documentElement.classList.toggle('dark', state.theme === 'dark');

    // 3. ビューに応じてコンテンツを描画
    if (state.currentView === 'detail') {
        renderServerDetail(container);
    } else if (state.currentView === 'physical-detail') {
        renderPhysicalServerDetail(container);
    } else {
        // レイアウトに基づいてメインコンテンツを描画
        const renderLayout = layoutRenderers[state.layoutMode];
        if (renderLayout) {
            renderLayout(container);
        } else {
            container.innerHTML = `<div class="p-8 text-center text-red-500">Error: Layout "${state.layoutMode}" not found.</div>`;
        }
    }

    // 4. アイコンを再描画
    lucide.createIcons();
};

// グローバルに公開 (ESMからのアクセス用)
window.updateView = updateView;
window.showNotification = showNotification;
window.serverCreateModal = new ServerCreateModal();
window.settingsModal = new SettingsModal();
window.agentRegisterModal = new AgentRegisterModal();
// Partial Updates
window.updateAccordionServer = updateAccordionServer;
window.updateAccordionAgent = updateAccordionAgent;
window.updateDetailViewContent = updateDetailViewContent;
window.updatePhysicalServerDetailContent = updatePhysicalServerDetailContent;


export {
    updateView,
    showNotification
};