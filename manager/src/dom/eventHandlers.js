// manager/src/dom/eventHandlers.js
import { startMetricsStream, stopMetricsStream, stopAllMetricsStreams } from '../services/metricsService.js';
import { logUiInteraction } from '../utils/logger.js';

export function setupDomListeners() {
    const state = window.state;
    const getters = window.getters;
    const updateView = window.updateView;
    const settingsModal = window.settingsModal;
    const serverCreateModal = window.serverCreateModal;
    const agentRegisterModal = window.agentRegisterModal;

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const serverId = target.dataset.serverId;
        const agentId = target.dataset.agentId;

        logUiInteraction({
            event: 'click',
            action: action,
            element: target,
            details: { serverId, agentId }
        });

        switch (action) {
            // --- New v6 UI Actions ---
            case 'open-settings':
                settingsModal.open();
                break;
            
            case 'close-settings-modal':
                settingsModal.close();
                break;
            
            case 'toggle-theme':
                state.theme = state.theme === 'dark' ? 'light' : 'dark';
                // TODO: Save theme to localStorage
                updateView();
                break;

            case 'switch-layout':
                const newLayout = target.value;
                if (state.layoutMode !== newLayout) {
                    state.layoutMode = newLayout;
                    // TODO: Save layout preference
                    updateView();
                }
                break;

            case 'add-server':
                if (serverCreateModal) {
                    serverCreateModal.open(agentId); // 特定のエージェントを渡して開く
                }
                break;
            
            case 'add-agent':
                if (agentRegisterModal) {
                    agentRegisterModal.open();
                }
                break;

            case 'view-server-detail':
                if (serverId) {
                    state.selectedServerId = serverId;
                    state.currentView = 'detail';
                    state.detailActiveTab = 'console';
                    startMetricsStream('gameServer', serverId);
                    updateView();
                }
                break;
            
            case 'back-to-list':
                stopAllMetricsStreams();
                state.currentView = 'list';
                state.selectedServerId = null;
                state.selectedPhysicalServerId = null;
                updateView();
                break;

            case 'start-server': {
                const serverToStart = getters.allServers().find(s => s.server_id === serverId);
                if (serverToStart) {
                    window.electronAPI.proxyToAgent(serverToStart.hostId, {
                        type: window.electronAPI.Message.CONTROL_SERVER,
                        payload: { serverId: serverToStart.server_id, action: 'start' }
                    });
                } else {
                     console.error("Could not start server: serverId missing or invalid.", serverId);
                }
                break;
            }

            case 'toggle-status': {
                // 修正: serverIdをまずdata属性から取得し、なければ選択中のサーバーを参照する
                const serverIdToToggle = target.dataset.serverId || state.selectedServerId;
                const server = getters.allServers().find(s => s.server_id === serverIdToToggle);
                
                if (server) {
                    const controlAction = server.status === 'running' || server.status === 'starting' ? 'stop' : 'start';
                    window.electronAPI.proxyToAgent(server.hostId, {
                        type: window.electronAPI.Message.CONTROL_SERVER,
                        payload: { serverId: server.server_id, action: controlAction }
                    });
                } else {
                    console.error("Could not toggle status: No server found for ID.", serverIdToToggle, target);
                }
                break;
            }
            
            case 'toggle-agent-details': {
                const agentContainer = target.closest('[data-agent-container-id]');
                if (agentContainer) {
                    // 2番目の子がコンテンツエリアであると想定
                    const content = agentContainer.children[1];
                    const icon = target.querySelector('i[data-lucide="chevron-down"]');
                    if (content) content.classList.toggle('hidden');
                    if(icon) icon.classList.toggle('rotate-180');
                }
                break;
            }

            case 'toggle-memo-dropdown': {
                const dropdownContent = document.getElementById('memo-dropdown-content');
                const toggleIcon = document.getElementById('memo-toggle-btn')?.querySelector('svg');
                if (dropdownContent) {
                    const isOpening = dropdownContent.classList.toggle('hidden');
                    if(toggleIcon) toggleIcon.classList.toggle('rotate-180', !isOpening);
                    // 開いたときにエディタにフォーカス
                    if (!isOpening) {
                        document.getElementById('memo-editor')?.focus();
                    }
                }
                break;
            }

            case 'open-dir': {
                const server = getters.selectedServer();
                 if (server) {
                    window.electronAPI.proxyToAgent(server.hostId, {
                        type: 'OPEN_SERVER_DIRECTORY', // Should be in protocol
                        payload: { serverId: server.server_id }
                    });
                }
                break;
            }

            case 'switch-detail-tab': {
                const newTab = target.dataset.tab;
                if (state.detailActiveTab !== newTab) {
                    state.detailActiveTab = newTab;
                    // ボタンのスタイルを即時更新
                    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
                        btn.classList.toggle('bg-primary', btn.dataset.tab === newTab);
                        btn.classList.toggle('text-white', btn.dataset.tab === newTab);
                        btn.classList.toggle('text-gray-600', btn.dataset.tab !== newTab);
                        btn.classList.toggle('dark:text-gray-300', btn.dataset.tab !== newTab);
                        btn.classList.toggle('hover:bg-gray-200', btn.dataset.tab !== newTab);
                        btn.classList.toggle('dark:hover:bg-gray-700', btn.dataset.tab !== newTab);
                    });
                    
                    if (typeof window.updateDetailViewContent === 'function') {
                        window.updateDetailViewContent();
                    } else {
                        console.error('window.updateDetailViewContent is not a function');
                    }
                }
                break;
            }
            
            case 'save-launch-config': {
                const server = getters.selectedServer();
                if (server) {
                    const newConfig = {
                        java_path: document.getElementById('java-path').value,
                        min_memory: parseInt(document.getElementById('min-memory').value, 10),
                        max_memory: parseInt(document.getElementById('max-memory').value, 10),
                        custom_args: document.getElementById('custom-args').value,
                    };
                    window.electronAPI.proxyToAgent(server.hostId, {
                        type: window.electronAPI.Message.UPDATE_SERVER,
                        payload: { serverId: server.server_id, config: { runtime: newConfig } }
                    });
                }
                break;
            }

            case 'save-properties': {
                const server = getters.selectedServer();
                if (server) {
                    const newProperties = {};
                    const editor = document.getElementById('properties-editor');
                    if(editor) {
                        editor.querySelectorAll('[data-key]').forEach(input => {
                            const key = input.dataset.key;
                            let value;
                            if (input.type === 'checkbox') {
                                value = input.checked;
                            } else if (input.type === 'number') {
                                value = Number(input.value);
                            } else {
                                value = input.value;
                            }
                            newProperties[key] = value;
                        });
                        
                        window.electronAPI.proxyToAgent(server.hostId, {
                            type: window.electronAPI.Message.UPDATE_SERVER_PROPERTIES,
                            payload: { serverId: server.server_id, properties: newProperties }
                        });
                    }
                }
                break;
            }

            case 'manage-agent':
                if (agentId) {
                    state.selectedPhysicalServerId = agentId;
                    state.currentView = 'physical-detail';
                    state.physicalServerDetailActiveTab = 'status';
                    startMetricsStream('physicalServer', agentId);
                    updateView();
                }
                break;

            case 'switch-physical-detail-tab': {
                const newTab = target.dataset.tab;
                if (state.physicalServerDetailActiveTab !== newTab) {
                    state.physicalServerDetailActiveTab = newTab;
                    window.updatePhysicalServerDetailContent();
                }
                break;
            }

            case 'more-options':
                console.log(`Action: More options for ${serverId}`);
                break;
            
            case 'switch-tab': {
                const agentIdForTab = target.dataset.agentId;
                if (agentIdForTab && window.renderTabsLayout) {
                    const container = document.getElementById('app-container');
                    if (container) {
                        window.renderTabsLayout(container, agentIdForTab);
                        if (window.lucide) {
                           window.lucide.createIcons();
                        }
                    }
                }
                break;
            }

            case 'delete-server': {
                const server = getters.selectedServer() || getters.allServers().find(s => s.server_id === serverId);
                if(server) {
                    const confirmed = confirm(`サーバー「${server.server_name}」を本当に削除しますか？\nこの操作は元に戻せません。`);
                    if (confirmed) {
                        state.serversBeingDeleted.add(server.server_id);
                        updateView(); // UIを無効化するために再描画

                        window.electronAPI.proxyToAgent(server.hostId, {
                            type: window.electronAPI.Message.DELETE_SERVER,
                            payload: { serverId: server.server_id }
                        });
                    }
                }
                break;
            }
        }
    });

    // --- Focusout Listeners for Inline Editing ---
    document.addEventListener('focusout', (e) => {
        const target = e.target;
        if (!target.isContentEditable) return;

        const field = target.dataset.field;
        if (!field) return;

        const server = getters.selectedServer();
        if (!server) return;

        const originalValue = (field === 'memo') ? (server[field] || '') : server[field];
        const newValue = target.textContent;
        
        if (originalValue !== newValue) {
            logUiInteraction({
                event: 'focusout',
                action: `update-field:${field}`,
                element: target,
                details: {
                    serverId: server.server_id,
                    oldValue: originalValue,
                    newValue: newValue
                }
            });

            const config = {};
            config[field] = newValue;

            window.electronAPI.proxyToAgent(server.hostId, {
                type: window.electronAPI.Message.UPDATE_SERVER,
                payload: {
                    serverId: server.server_id,
                    config: config
                }
            });
        }
    });

    // 2. UIの準備ができたことをMainプロセスに通知
    window.electronAPI.rendererReady();
}