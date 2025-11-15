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
    const loadingOverlay = document.getElementById('loading-overlay');
    const appContainer = document.getElementById('app');
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
    const createServerModal = document.getElementById('create-server-modal');
    const confirmCreateServerBtn = document.getElementById('confirm-create-server-btn');
    const cancelCreateServerBtn = document.getElementById('cancel-create-server-btn');
    const javaInstallOverlay = document.getElementById('java-install-overlay');
    const javaInstallCancelBtn = document.getElementById('java-install-cancel-btn');
    const javaInstallConfirmBtn = document.getElementById('java-install-confirm-btn');
    const javaDownloadList = document.getElementById('java-download-list');
    const javaInstallProgressBar = document.getElementById('java-install-progress-bar');
    const javaInstallStatusText = document.getElementById('java-install-status-text');

    // --- 画面切り替え関数 ---
    const showListView = () => { 
        stopGlobalMetricsLoop();
        state.currentView = 'list';
        state.selectedServerId = null;
        window.electronAPI.requestAllServers(); // サーバーリストを要求する
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
        const server = state.servers.find(s => s.server_id === serverId);
        if (server) {
            
            // Agentにメッセージを送信する
            const action = server.status === 'running' ? 'stop' : 'start';
            window.electronAPI.proxyToServer(server.hostId, {
                type: 'control_server',
                payload: {
                    serverId: server.server_id,
                    action: action,
                }
            });
            // ダミーロジックは削除。UIの更新はAgentからのレスポンス(server_list_update)によって行われる
        }
    };
    
    const updateServerData = (serverId, field, value) => {
        const server = state.servers.find(s => s.server_id === serverId);
        if (server && (field === 'name' || field === 'memo')) {
            // This needs to be sent to the agent to be persisted
            console.log(`Updating ${field} for server ${serverId} to ${value}`);
            // server[field] = value;
            if(state.currentView === 'list') {
                renderServerList();
            } else if (state.currentView === 'detail' && field === 'memo') {
                updateDetailView();
            }
        }
    };
    
    const saveProperties = (serverId, button) => {
        const server = state.servers.find(s => s.server_id === serverId);
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
        const createServerModal = document.getElementById('create-server-modal');
        const hostSelect = document.getElementById('host-select');

        // ホスト選択のオプションをクリアして再生成
        hostSelect.innerHTML = '';
        const onlineAgents = Array.from(state.physicalServers.values()).filter(p => p.status === 'Connected');

        if (onlineAgents.length === 0) {
            hostSelect.innerHTML = '<option value="">利用可能なホストがありません</option>';
            hostSelect.disabled = true;
            document.getElementById('confirm-create-server-btn').disabled = true;
        } else {
            onlineAgents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = `${agent.config.alias} (${agent.config.ip})`;
                hostSelect.appendChild(option);
            });
            hostSelect.disabled = false;
            document.getElementById('confirm-create-server-btn').disabled = false;
        }
        
        // バージョンリストの取得を要求
        document.getElementById('version-select').innerHTML = '<option>バージョンを読み込み中...</option>';
        window.electronAPI.getMinecraftVersions();

        createServerModal.classList.remove('hidden');
    });

    addAgentBtn.addEventListener('click', () => {
        const newPort = 8080 + state.physicalServers.size;
        window.electronAPI.addAgent({
            ip: '127.0.0.1',
            port: newPort,
            alias: `New Agent ${state.physicalServers.size + 1}`
        });
    });

    // --- 新規サーバー作成モーダル ---
    cancelCreateServerBtn.addEventListener('click', () => {
        createServerModal.classList.add('hidden');
    });

    confirmCreateServerBtn.addEventListener('click', () => {
        const hostId = document.getElementById('host-select').value;
        const versionId = document.getElementById('version-select').value;

        if (!hostId || !versionId) {
            showNotification('ホストマシンまたはバージョンが選択されていません。', 'error');
            return;
        }

        // mainプロセスにサーバー作成を要求
        window.electronAPI.createServer({ hostId, versionId });

        // mainからの応答を待ってUIを更新する
        showNotification(`新規サーバーの作成をホストに要求しました。`, 'info');
        createServerModal.classList.add('hidden');
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
                    if (newTab === 'settings') {
                        // AgentにOS/CPU情報を要求 (WebSocket経由)
                        window.electronAPI.proxyToServer(agentId, { type: 'get-agent-system-info', messageId: `systemInfo-${Date.now()}` });
                    }
                    renderPhysicalServerDetail(); // タブスタイル更新のために再描画
                }
                return;
            }

            // Javaインストールオーバーレイのキャンセルボタン
            if (target === javaInstallCancelBtn) {
                javaInstallOverlay.classList.add('hidden');
                return;
            }

            // Javaインストールオーバーレイのインストールボタン
            if (target === javaInstallConfirmBtn) {
                const selectedJava = document.querySelector('input[name="java-version"]:checked');
                if (!selectedJava) {
                    showNotification('インストールするJavaバージョンを選択してください。', 'error');
                    return;
                }
                const javaInstallData = JSON.parse(selectedJava.value);
                const agentId = state.javaInstallAgentId;

                if (agentId) {
                    window.electronAPI.installJava(agentId, javaInstallData);
                    showNotification(`Agent ${agentId} にJavaのインストールを要求しました。`, 'info');
                    // インストール開始後、プログレスバーを表示
                    javaInstallProgressBar.style.width = '0%';
                    javaInstallProgressBar.classList.remove('hidden');
                    javaInstallStatusText.textContent = 'ダウンロード中...';
                    javaInstallStatusText.classList.remove('hidden');
                }
                return;
            }
            if (target.closest('[data-action="install-java"]')) {
                // Javaインストールオーバーレイを表示
                const javaInstallOverlay = document.getElementById('java-install-overlay');
                javaInstallOverlay.classList.remove('hidden');
                // stateに選択中のagentIdを保存
                state.javaInstallAgentId = agentId;

                // AgentのOSとCPUアーキテクチャが取得済みであることを確認
                const agent = state.physicalServers.get(agentId);
                if (!agent || !agent.systemInfo || !agent.systemInfo.os || !agent.systemInfo.arch) {
                    showNotification('AgentのOS/CPU情報が取得できていません。設定タブで情報を読み込んでください。', 'error');
                    javaInstallOverlay.classList.add('hidden');
                    return;
                }
                
                // JavaダウンロードURL取得時のためにOSとCPUアーキテクチャをstateに保存
                state.javaDownloadOs = agent.systemInfo.os;
                state.javaDownloadArch = agent.systemInfo.arch;

                // Javaのダウンロード候補リストを取得するIPCイベントを呼び出す
                window.electronAPI.getJavaDownloadInfo({
                    feature_version: 'any', // 全てのバージョンを取得
                    os: state.javaDownloadOs,
                    arch: state.javaDownloadArch
                }).then(response => {
                    if (response.success) {
                        // 取得したダウンロード情報には個別のJavaバージョン情報が含まれると仮定
                        // ここでは簡単に、Adoptium APIから取得した情報をそのままrenderJavaDownloadListに渡す
                        // 注意: Adoptium APIのレスポンス形式によっては、renderJavaDownloadListに渡すデータを整形する必要があるかもしれません。
                        renderJavaDownloadList([
                            {
                                version: `Java ${response.feature_version}`, // 例: Java 17
                                downloadUrl: response.downloadLink,
                                fileSize: response.fileSize,
                                os: state.javaDownloadOs,
                                arch: state.javaDownloadArch
                            }
                        ]);
                    } else {
                        showNotification(`Javaダウンロード情報の取得に失敗しました: ${response.error}`, 'error');
                        javaInstallOverlay.classList.add('hidden');
                    }
                }).catch(error => {
                    console.error('Failed to get Java download info:', error);
                    showNotification(`Javaダウンロード情報の取得中にエラーが発生しました: ${error.message}`, 'error');
                    javaInstallOverlay.classList.add('hidden');
                });
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
            const serverId = serverItem.dataset.serverId;
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
            const server = state.servers.find(s => s.server_id === serverId);
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
            const serverId = e.target.closest('[data-server-id]') ? e.target.closest('[data-server-id]').dataset.serverId : state.selectedServerId;
            updateServerData(serverId, e.target.dataset.field, e.target.innerText);
        }
    });

    // 削除モーダル
    confirmDeleteBtn.addEventListener('click', () => {
        if (state.serverToDeleteId !== null) {
            // サーバーオブジェクトとホストIDを見つける
            let serverToDelete = null;
            let hostId = null;
            for (const [agentId, servers] of state.agentServers.entries()) {
                const foundServer = servers.find(s => s.server_id === state.serverToDeleteId);
                if (foundServer) {
                    serverToDelete = foundServer;
                    hostId = agentId;
                    break;
                }
            }

            if (serverToDelete && hostId) {
                // 正しいホストに、正しいメッセージタイプで削除を要求
                window.electronAPI.proxyToServer(hostId, {
                    type: 'deleteServer',
                    payload: { serverId: state.serverToDeleteId }
                });

                // 楽観的UI更新：エージェントからのリスト更新を待たずにUIから削除
                const serversOnHost = state.agentServers.get(hostId) || [];
                const serverIndex = serversOnHost.findIndex(s => s.server_id === state.serverToDeleteId);
                if (serverIndex !== -1) {
                    serversOnHost.splice(serverIndex, 1);
                    state.agentServers.set(hostId, serversOnHost);
                }
            } else {
                console.warn(`削除対象のサーバーが見つかりませんでした: ${state.serverToDeleteId}`);
            }
            
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

    // Javaダウンロードリストをレンダリングする関数
    const renderJavaDownloadList = (javaVersions) => {
        javaDownloadList.innerHTML = ''; // Clear previous list
        if (javaVersions.length === 0) {
            javaDownloadList.innerHTML = '<p>利用可能なJavaバージョンがありません。</p>';
            javaInstallConfirmBtn.disabled = true;
            return;
        }

        javaInstallConfirmBtn.disabled = false;
        javaVersions.forEach((java, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="radio" id="java-${index}" name="java-version" value='${JSON.stringify(java)}' class="mr-2">
                <label for="java-${index}" class="cursor-pointer">
                    ${java.version} (${java.fileSize}) - ${java.os} ${java.arch}
                </label>
            `;
            javaDownloadList.appendChild(li);
        });
    };

    // JavaインストールオーバーレイのUIを更新する関数
    const updateJavaInstallOverlay = (status) => {
        const { progress, message, type, error } = status;

        if (type === 'progress') {
            javaInstallProgressBar.style.width = `${progress}%`;
            javaInstallStatusText.textContent = message;
        } else if (type === 'success') {
            javaInstallProgressBar.style.width = '100%';
            javaInstallStatusText.textContent = 'インストール完了！';
            javaInstallProgressBar.classList.add('hidden');
            javaInstallStatusText.classList.add('hidden');
            // 必要に応じてオーバーレイを閉じる
            javaInstallOverlay.classList.add('hidden');
        } else if (type === 'error') {
            javaInstallProgressBar.style.width = '0%';
            javaInstallStatusText.textContent = `エラー: ${error}`;
            showNotification(`Javaインストールエラー: ${error}`, 'error');
            javaInstallProgressBar.classList.add('hidden');
            javaInstallStatusText.classList.add('hidden');
        }
    };
    
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
    let isInitialAgentListReceived = false;
    window.electronAPI.onAgentList((agentList) => {
        state.physicalServers.clear();
        agentList.forEach(agent => {
            state.physicalServers.set(agent.id, { ...agent, metrics: {}, systemInfo: {}, logs: [] });
        });

        // 初回のAgentリスト受信時に、サーバーリストを要求する
        if (!isInitialAgentListReceived && agentList.length > 0) {
            console.log('Initial agent list received. Requesting server lists.');
            window.electronAPI.requestAllServers();
            isInitialAgentListReceived = true;
        }

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
                case 'server_update':
                    {
                        const { serverId, type, payload } = data.payload;
                        const hostServers = state.agentServers.get(agentId);
                        if (hostServers) {
                            const server = hostServers.find(s => s.server_id === serverId);
                            if (server) {
                                console.log(`[Renderer] Received server_update for ${serverId}: ${type}`);
                                switch (type) {
                                    case 'status_change':
                                        server.status = payload;
                                        break;
                                    case 'log':
                                        // ログがない場合に備えて初期化
                                        if (!server.logs) server.logs = [];
                                        server.logs.push(payload);
                                        // パフォーマンスのためにログ配列の長さを制限
                                        if (server.logs.length > 200) server.logs.shift();
                                        break;
                                }
                                // ゲームサーバー関連のビューが表示されている場合のみUIを更新
                                if (state.currentView === 'list' || (state.currentView === 'detail' && state.selectedServerId === serverId)) {
                                    updateView();
                                }
                            }
                        }
                    }
                    // このメッセージタイプは物理サーバーのビュー更新とは独立しているため、ここで処理を終了
                    return;
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

    window.electronAPI.onServerListUpdate(({ agentId, servers }) => {
        // UI表示に必要なデフォルトプロパティを付与する
        const serversWithUIData = servers.map(s => ({
            ...s,
            hostId: agentId,
            // UIでsliceされる可能性があるため、デフォルト値として空の配列を保証する
            logs: s.logs || [],
            players: s.players || { current: 0, max: 20, list: [], recent: [] },
            cpu: s.cpu || 0,
            memory: s.memory || 0,
            memoryMax: s.memoryMax || 2048,
            tps: s.tps || 0,
            memo: s.memo || '',
        }));
        console.log(`[Agent Op] Received server list update from agent ${agentId}. Total servers: ${serversWithUIData.length}`);
        state.agentServers.set(agentId, serversWithUIData);
        
        // データ到着時にビューを直接更新する
        if (state.currentView === 'list') {
            renderServerList();
        } else if (state.currentView === 'detail') {
            updateDetailView();
        }
    });

    window.electronAPI.onServerCreationFailed(({ agentId, error }) => {
        const agent = state.physicalServers.get(agentId);
        const agentName = agent ? agent.config.alias : agentId;
        showNotification(`作成失敗 on ${agentName}: ${error}`, 'error');
    });

    window.electronAPI.onJavaInstallStatus((status) => {
        console.log('Javaインストールステータスを受信:', status);
        const { agentId, progress, message, type, error, installDir, javaExecutable } = status;

        // 対象のAgentのJavaインストールステータスを更新
        if (state.physicalServers.has(agentId)) {
            const agent = state.physicalServers.get(agentId);
            agent.javaInstallStatus = { progress, message, type, error, installDir, javaExecutable };
            
            // Javaインストールオーバーレイがアクティブな場合、UIを更新
            if (!document.getElementById('java-install-overlay').classList.contains('hidden')) {
                updateJavaInstallOverlay(status);
            }

            if (type === 'success') {
                showNotification(`Agent ${agent.config.alias} にJavaが正常にインストールされました。`, 'success');
                // インストール完了後、オーバーレイを非表示にする
                document.getElementById('java-install-overlay').classList.add('hidden');
            } else if (type === 'error') {
                showNotification(`Agent ${agent.config.alias} でJavaのインストールに失敗しました: ${error}`, 'error');
            }
        }
    });

    window.electronAPI.onMinecraftVersions(({ success, versions, error }) => {
        const versionSelect = document.getElementById('version-select');
        if (success) {
            // release -> snapshot の順にソート
            versions.sort((a, b) => {
                if (a.type === 'release' && b.type !== 'release') return -1;
                if (a.type !== 'release' && b.type === 'release') return 1;
                return 0; // 他は元の順序を維持
            });

            versionSelect.innerHTML = versions.map(v =>
                `<option value="${v.id}">${v.id} (${v.type})</option>`
            ).join('');
        } else {
            versionSelect.innerHTML = `<option value="">バージョン取得失敗</option>`;
            showNotification(`Minecraftバージョンの取得に失敗しました: ${error}`, 'error');
        }
    });

    // --- Initial Load ---
    if (state.currentView === 'physical' || state.currentView === 'physical-detail') {
        startGlobalMetricsLoop();
    }
    updateView();
    // window.electronAPI.requestAgentList(); // 初期エージェントリストはmainから自動で送られる

    // --- 起動シーケンス ---
    // 1. Mainプロセスからの初期ロード完了通知を待つ
    window.electronAPI.onInitialLoadComplete(() => {
        console.log('Initial load complete signal received from main.');
        loadingOverlay.style.display = 'none';
        appContainer.style.visibility = 'visible';
    });

    // 2. UIの準備ができたことをMainプロセスに通知
    console.log('Renderer is ready, notifying main process.');
    window.electronAPI.rendererReady();
});