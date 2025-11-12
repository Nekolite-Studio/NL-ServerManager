// manager/renderer.js
// メインのイベントリスナーと処理
// このファイルは renderer-state.js と renderer-ui.js の後に読み込まれる必要があります。

let metricsInterval = null;

function startGlobalMetricsLoop() {
    stopGlobalMetricsLoop(); // Clear any existing interval first
    console.log('Starting global metrics loop...');
    metricsInterval = setInterval(() => {
        if (state.physicalServers.size > 0) {
            for (const agentId of state.physicalServers.keys()) {
                const agent = state.physicalServers.get(agentId);
                if (agent.status === 'Connected') {
                    window.electronAPI.requestAgentMetrics(agentId);
                }
            }
        }
    }, 3000);
}

function stopGlobalMetricsLoop() {
    if (metricsInterval) {
        console.log('Stopping global metrics loop.');
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
}


document.addEventListener('DOMContentLoaded', () => {
            
    // --- DOM要素の取得 (グローバル変数への代入) ---
    serverListView = document.getElementById('server-list-view');
    physicalServerListView = document.getElementById('physical-server-list-view');
    serverDetailView = document.getElementById('server-detail-view');
    physicalServerDetailView = document.getElementById('physical-server-detail-view');
    serverListContainer = document.getElementById('server-list');
    navGameServers = document.getElementById('nav-game-servers');
    navPhysicalServers = document.getElementById('nav-physical-servers');

    // このファイル内でのみ使用するDOM要素
    const addServerBtn = document.getElementById('add-server-btn');
    const addAgentBtn = document.getElementById('add-agent-btn');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deletingServerNameSpan = document.getElementById('deleting-server-name');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    // --- 画面切り替え関数 ---
    const showListView = () => { 
        stopGlobalMetricsLoop();
        state.currentView = 'list'; 
        state.selectedServerId = null; 
        updateView(); 
    };
    const showDetailView = (serverId) => { 
        stopGlobalMetricsLoop();
        state.currentView = 'detail'; 
        state.selectedServerId = serverId; 
        state.detailActiveTab = 'basic'; 
        state.detailBasicActiveSubTab = 'log'; 
        updateView(); 
    };
    const showPhysicalListView = () => { 
        startGlobalMetricsLoop();
        state.currentView = 'physical'; 
        state.selectedPhysicalServerId = null; 
        updateView(); 
    };
    const showPhysicalDetailView = (agentId) => {
        startGlobalMetricsLoop(); // Ensure loop is running
        state.currentView = 'physical-detail';
        state.selectedPhysicalServerId = agentId;
        state.physicalServerDetailActiveTab = 'status';
        updateView();
    };
    
    // --- イベントハンドラ (v5で更新) ---
    const toggleServerStatus = (serverId) => {
        const server = state.servers.find(s => s.id === serverId);
        if (server) {
            
            // Send JSON message to agent
            const action = server.status === 'running' ? 'stop' : 'start';
            window.electronAPI.sendJsonMessage({
                type: 'server_control',
                payload: {
                    serverId: server.id,
                    action: action,
                }
            });

            server.status = server.status === 'running' ? 'stopped' : 'running';
            
            if(server.status === 'stopped') { 
                server.tps = 0.0; server.players.current = 0; server.players.list = []; server.cpu = 0.0; server.memory = 0;
            } else { 
                server.tps = 18.0 + Math.random() * 2; 
                server.players.current = Math.floor(Math.random() * server.players.max); 
                server.players.list = server.players.recent.slice(0, server.players.current);
                server.cpu = 20.0 + Math.random() * 30;
                server.memory = (server.memoryMax * 0.3) + (Math.random() * server.memoryMax * 0.4);
            }
            
            if (state.currentView === 'list') {
                renderServerList();
            } else if (state.currentView === 'detail' && state.selectedServerId === serverId) {
                updateDetailView();
            }
        }
    };
    
    const updateServerData = (serverId, field, value) => {
        const server = state.servers.find(s => s.id === serverId);
        if (server && (field === 'name' || field === 'memo')) {
            server[field] = value;
            if(state.currentView === 'list') {
                renderServerList();
            } else if (state.currentView === 'detail' && field === 'memo') {
                updateDetailView();
            }
        }
    };
    
    const saveProperties = (serverId, button) => {
        const server = state.servers.find(s => s.id === serverId);
        if (!server) return;
        const editor = document.getElementById('properties-editor');
        const newProperties = {};
        Object.keys(server.properties).forEach(key => {
            const input = editor.querySelector(`#${key}`);
            if(input) {
                if (input.type === 'checkbox') newProperties[key] = input.checked;
                else if (input.type === 'number') newProperties[key] = parseFloat(input.value) || 0;
                else newProperties[key] = input.value;
            }
        });
        server.properties = newProperties;

        window.electronAPI.sendJsonMessage({
            type: 'update_properties',
            payload: { serverId: server.id, properties: newProperties }
        });

        button.textContent = '保存しました！';
        setTimeout(() => { button.textContent = '変更を保存'; }, 2000);
    };

    // --- メインのイベントリスナー (v6で更新) ---
    navGameServers.addEventListener('click', (e) => { e.preventDefault(); showListView(); });
    navPhysicalServers.addEventListener('click', (e) => { e.preventDefault(); showPhysicalListView(); });

    addServerBtn.addEventListener('click', () => {
        const newId = state.servers.length > 0 ? Math.max(...state.servers.map(s => s.id)) + 1 : 1;
        const newServer = {
            id: newId, hostId: null, name: `新しいサーバー ${newId}`, status: 'stopped', memo: '',
            players: { current: 0, max: 20, list: [], recent: [] }, tps: 0.0, cpu: 0.0, memory: 0, memoryMax: 8192,
            logs: ['[00:00:00] [Server thread/INFO]: Server created.'],
            properties: { ...defaultServerProperties },
            installedMods: [], installedPlugins: []
        };
        state.servers.push(newServer);
        
        window.electronAPI.sendJsonMessage({
            type: 'create_server',
            payload: { serverConfig: newServer }
        });

        showDetailView(newId);
    });

    addAgentBtn.addEventListener('click', () => {
        const newPort = 8080 + state.physicalServers.size;
        window.electronAPI.addAgent({
            ip: '127.0.0.1',
            port: newPort,
            alias: `New Agent ${state.physicalServers.size + 1}`
        });
    });


    // メインコンテンツエリアのイベント委任 (v6で更新)
    document.getElementById('app').addEventListener('click', (e) => {
        const target = e.target;
        const serverItem = target.closest('.server-item-container');
        const physicalServerItem = target.closest('.physical-server-item');

        // --- Physical Server List View ---
        if (state.currentView === 'physical' && physicalServerItem) {
            const agentId = physicalServerItem.dataset.agentId;
            showPhysicalDetailView(agentId);
            return;
        }

        // --- Physical Server Detail View ---
        if (state.currentView === 'physical-detail') {
            const agentId = state.selectedPhysicalServerId;
            if (target.closest('#back-to-physical-list-btn')) {
                showPhysicalListView();
                return;
            }
            const tabBtn = target.closest('.physical-detail-tab-btn');
            if (tabBtn) {
                const newTab = tabBtn.dataset.tab;
                if (state.physicalServerDetailActiveTab !== newTab) {
                    state.physicalServerDetailActiveTab = newTab;
                    renderPhysicalServerDetail(); // Re-render the whole detail view to update tab styles
                }
                return;
            }
            if (target.closest('[data-action="save-agent-settings"]')) {
                const config = {
                    alias: document.getElementById('agent-alias').value,
                    ip: document.getElementById('agent-ip').value,
                    port: parseInt(document.getElementById('agent-port').value, 10),
                    path: document.getElementById('agent-path').value,
                };
                window.electronAPI.updateAgentSettings({ agentId, config });
                target.textContent = '保存しました!';
                setTimeout(() => { target.textContent = '設定を保存'; }, 2000);
                return;
            }
            if (target.closest('[data-action="delete-agent"]')) {
                const agent = state.physicalServers.get(agentId);
                state.physicalServerToDeleteId = agentId;
                deletingServerNameSpan.textContent = agent.config.alias;
                deleteModal.classList.remove('hidden');
                return;
            }
        }

        // --- Game Server List View ---
        if (state.currentView === 'list' && serverItem) {
            const serverId = parseInt(serverItem.dataset.serverId);
            if (target.closest('[data-action="toggle-status"]')) { 
                e.stopPropagation(); 
                toggleServerStatus(serverId); 
                return; 
            }
            if (!target.closest('[contenteditable="true"]') && !target.closest('button')) { 
                showDetailView(serverId); 
                return; 
            }
        }

        // --- Game Server Detail View ---
        if (state.currentView === 'detail') {
            const serverId = state.selectedServerId;
            const server = state.servers.find(s => s.id === serverId);
            if (!server) return;

            if (target.closest('#back-to-list-btn')) { showListView(); return; }
            const tabBtn = target.closest('.detail-tab-btn');
            if (tabBtn) {
                const newTab = tabBtn.dataset.tab;
                if (state.detailActiveTab !== newTab) {
                    state.detailActiveTab = newTab;
                    updateDetailView();
                }
                return;
            }
            if (target.closest('[data-action="toggle-status"]')) { toggleServerStatus(serverId); return; }
            if (target.closest('[data-action="delete-server"]')) {
                state.serverToDeleteId = serverId;
                deletingServerNameSpan.textContent = server.name;
                deleteModal.classList.remove('hidden');
            }
            if (target.closest('[data-action="save-properties"]')) {
                saveProperties(serverId, target.closest('button'));
            }
        }
    });
    
    // 編集可能なフィールド
    document.getElementById('app').addEventListener('focusout', (e) => {
        if (e.target.matches('.editable[contenteditable="true"]')) {
            const serverId = e.target.closest('[data-server-id]') ? parseInt(e.target.closest('[data-server-id]').dataset.serverId) : state.selectedServerId;
            updateServerData(serverId, e.target.dataset.field, e.target.innerText);
        }
    });

    // 削除モーダル
    confirmDeleteBtn.addEventListener('click', () => {
        if (state.serverToDeleteId !== null) {
            window.electronAPI.sendJsonMessage({
                type: 'delete_server',
                payload: { serverId: state.serverToDeleteId }
            });
            state.servers = state.servers.filter(s => s.id !== state.serverToDeleteId);
            state.serverToDeleteId = null;
            showListView();
        }
        if (state.physicalServerToDeleteId !== null) {
            window.electronAPI.deleteAgent(state.physicalServerToDeleteId);
            state.physicalServerToDeleteId = null;
            showPhysicalListView();
        }
        deleteModal.classList.add('hidden');
    });
    cancelDeleteBtn.addEventListener('click', () => { 
        deleteModal.classList.add('hidden'); 
        state.serverToDeleteId = null;
        state.physicalServerToDeleteId = null;
    });
    
    // --- ダークモード ---
    function toggleDarkMode() {
        const htmlEl = document.documentElement;
        const isDark = htmlEl.classList.contains('dark');
        if (isDark) {
            htmlEl.classList.remove('dark'); htmlEl.classList.add('light');
            localStorage.setItem('theme', 'light');
            sunIcon.classList.remove('hidden'); moonIcon.classList.add('hidden');
        } else {
            htmlEl.classList.remove('light'); htmlEl.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            sunIcon.classList.add('hidden'); moonIcon.classList.remove('hidden');
        }
    }
    darkModeToggle.addEventListener('click', toggleDarkMode);
    const savedTheme = localStorage.getItem('theme');
    const htmlEl = document.documentElement;
    if (savedTheme === 'light') {
        htmlEl.classList.remove('dark'); htmlEl.classList.add('light');
        sunIcon.classList.remove('hidden'); moonIcon.classList.add('hidden');
    } else {
        htmlEl.classList.remove('light'); htmlEl.classList.add('dark');
        sunIcon.classList.add('hidden'); moonIcon.classList.remove('hidden');
    }

    // --- Agent/Main Process Communication ---
    window.electronAPI.onAgentList((agentList) => {
        state.physicalServers.clear();
        agentList.forEach(agent => {
            state.physicalServers.set(agent.id, { ...agent, metrics: {}, systemInfo: {}, logs: [] });
        });
        updateView();
    });

    window.electronAPI.onAgentStatusUpdate((agentUpdate) => {
        if (state.physicalServers.has(agentUpdate.id)) {
            const agent = state.physicalServers.get(agentUpdate.id);
            agent.status = agentUpdate.status;
            if (agent.status !== 'Connected') {
                agent.metrics = {};
            }
            updateView();
        }
    });

    window.electronAPI.onAgentData(({ agentId, data }) => {
        if (state.physicalServers.has(agentId)) {
            const agent = state.physicalServers.get(agentId);
            switch (data.type) {
                case 'systemInfo':
                    agent.systemInfo = data.payload;
                    break;
                case 'metricsData':
                    agent.metrics = data.payload;
                    break;
            }
            if ((state.currentView === 'physical-detail' && state.selectedPhysicalServerId === agentId) || state.currentView === 'physical') {
                updateView();
            }
        }
    });

    window.electronAPI.onAgentLogEntry(({ agentId, message }) => {
        if (state.physicalServers.has(agentId)) {
            const agent = state.physicalServers.get(agentId);
            if (!agent.logs) agent.logs = [];
            agent.logs.push(message);
            if (agent.logs.length > 100) agent.logs.shift(); // Keep logs to a reasonable size
            
            if (state.currentView === 'physical-detail' && state.selectedPhysicalServerId === agentId && state.physicalServerDetailActiveTab === 'logs') {
                updatePhysicalServerDetailContent();
            }
        }
    });

    // --- Initial Load ---
    if (state.currentView === 'physical' || state.currentView === 'physical-detail') {
        startGlobalMetricsLoop();
    }
    updateView();
    window.electronAPI.requestAgentList();
});