// manager/renderer.js
// メインのイベントリスナーと処理
// このファイルは renderer-state.js と renderer-ui.js の後に読み込まれる必要があります。

document.addEventListener('DOMContentLoaded', () => {
            
    // --- DOM要素の取得 (グローバル変数への代入) ---
    // renderer-ui.js で参照できるように、グローバルスコープ（またはこのスクリプトスコープ）の変数に代入
    serverListView = document.getElementById('server-list-view');
    physicalServerListView = document.getElementById('physical-server-list-view');
    serverDetailView = document.getElementById('server-detail-view');
    serverListContainer = document.getElementById('server-list');
    navGameServers = document.getElementById('nav-game-servers');
    navPhysicalServers = document.getElementById('nav-physical-servers');

    // このファイル内でのみ使用するDOM要素
    const addServerBtn = document.getElementById('add-server-btn');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const deletingServerNameSpan = document.getElementById('deleting-server-name');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    // --- 画面切り替え関数 ---
    const showListView = () => { state.currentView = 'list'; state.selectedServerId = null; updateView(); };
    const showDetailView = (serverId) => { state.currentView = 'detail'; state.selectedServerId = serverId; state.detailActiveTab = 'basic'; state.detailBasicActiveSubTab = 'log'; updateView(); };
    const showPhysicalListView = () => { state.currentView = 'physical'; state.selectedServerId = null; updateView(); };
    
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
                    // 将来的にサーバー設定（メモリ割当など）も渡す
                }
            });

            // UI上のステータス更新 (エージェントからの応答を待たずに即時反映する例)
            // 本来はエージェントからの成功応答を受けてからUIを更新するのが望ましい
            server.status = server.status === 'running' ? 'stopped' : 'running';
            const host = physicalServers.find(p => p.id === server.hostId);
            const hostIp = host ? host.ip : '不明なホスト';

            if(server.status === 'stopped') { 
                server.tps = 0.0; server.players.current = 0; server.players.list = []; server.cpu = 0.0; server.memory = 0;
                logToDetailView(serverId, `[SYSTEM] サーバー停止処理を ${hostIp} へ要求しました。`, 'warning');
            } else { 
                // ダミーデータで起動状態を仮表示
                server.tps = 18.0 + Math.random() * 2; 
                server.players.current = Math.floor(Math.random() * server.players.max); 
                server.players.list = server.players.recent.slice(0, server.players.current);
                server.cpu = 20.0 + Math.random() * 30;
                server.memory = (server.memoryMax * 0.3) + (Math.random() * server.memoryMax * 0.4);
                logToDetailView(serverId, `[SYSTEM] サーバー起動処理を ${hostIp} へ要求しました。`, 'info');
            }
            
            if (state.currentView === 'list') {
                renderServerList();
            } else if (state.currentView === 'detail' && state.selectedServerId === serverId) {
                updateDetailView(); // v5: 詳細ビュー全体を再描画してステータスカードを更新
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
                // v6: メモを編集した場合、プレビューにも反映させるためヘッダーを再描画
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

        // エージェントに送信
        window.electronAPI.sendJsonMessage({
            type: 'update_properties',
            payload: {
                serverId: server.id,
                properties: newProperties
            }
        });

        console.log('Saved properties for server:', serverId, server.properties);
        button.textContent = '保存しました！';
        logToDetailView(serverId, '[SYSTEM] server.properties を保存しました。', 'info');
        setTimeout(() => { button.textContent = '変更を保存'; }, 2000);
    };

    // --- ログ & コマンド関数 (v5で更新) ---
    const logToDetailView = (serverId, message, type = 'info') => {
        const server = state.servers.find(s => s.id === serverId);
        if (!server) return;
        const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
        let prefix = '[INFO]';
        if(type === 'warning') prefix = '[WARN]';
        if(type === 'error') prefix = '[ERROR]';
        if(type === 'command') prefix = '[USER]';
        const fullLog = `[${timestamp}] ${prefix}: ${message}`;
        server.logs.push(fullLog);
        if (server.logs.length > 50) server.logs.shift();

        // v5: ログタブが表示されている場合のみ更新
        if (state.currentView === 'detail' && 
            state.selectedServerId === serverId &&
            state.detailActiveTab === 'basic' &&
            state.detailBasicActiveSubTab === 'log') {
            
            const logOutput = document.getElementById('server-log-output');
            if (logOutput) {
                logOutput.textContent = server.logs.join('\n');
                logOutput.parentElement.scrollTop = logOutput.parentElement.scrollHeight;
            }
        }
    };

    const sendCommand = () => {
        const input = document.getElementById('command-input');
        const command = input.value.trim();
        const serverId = state.selectedServerId;
        const server = state.servers.find(s => s.id === serverId);
        if (!command || !server) return;
        if (server.status !== 'running') {
            logToDetailView(serverId, `コマンド実行失敗: サーバーが停止しています。`, 'error');
            return;
        }

        // WebSocket経由でエージェントに送信
        window.electronAPI.sendJsonMessage({
            type: 'server_command',
            payload: {
                serverId: server.id,
                command: command
            }
        });

        logToDetailView(serverId, `/${command}`, 'command');
        input.value = '';
        
        // デモ用の即時応答 (本来はエージェントからの応答を待つ)
        setTimeout(() => {
            if (command.toLowerCase().startsWith('say')) { logToDetailView(serverId, `[Server] ${command.substring(4).trim()}`); }
            else if (command.toLowerCase() === 'list') { logToDetailView(serverId, `There are ${server.players.current} of a max ${server.players.max} players online: ${server.players.list.join(', ')}`); }
            else if (command.toLowerCase() === 'stop') { logToDetailView(serverId, `Stopping the server...`); toggleServerStatus(serverId); }
            else { logToDetailView(serverId, `コマンドをエージェントに送信しました。`, 'info'); }
        }, 300);
    };

    // --- メインのイベントリスナー (v6で更新) ---
    navGameServers.addEventListener('click', (e) => { e.preventDefault(); showListView(); });
    navPhysicalServers.addEventListener('click', (e) => { e.preventDefault(); showPhysicalListView(); });

    addServerBtn.addEventListener('click', () => {
        const newId = state.servers.length > 0 ? Math.max(...state.servers.map(s => s.id)) + 1 : 1;
        const defaultHostId = physicalServers.length > 0 ? physicalServers[0].id : null;
        const newServer = {
            id: newId, hostId: defaultHostId, name: `新しいサーバー ${newId}`, status: 'stopped', memo: '',
            players: { current: 0, max: 20, list: [], recent: [] }, tps: 0.0, cpu: 0.0, memory: 0, memoryMax: 8192,
            logs: ['[00:00:00] [Server thread/INFO]: Server created.'],
            properties: { ...defaultServerProperties },
            installedMods: [], installedPlugins: [] // v5
        };
        state.servers.push(newServer);
        
        // エージェントに新規サーバー作成を通知 (本来はホスト選択などが必要)
        window.electronAPI.sendJsonMessage({
            type: 'create_server',
            payload: {
                serverConfig: newServer // 新しいサーバー設定
            }
        });

        showDetailView(newId);
    });

    // メインコンテンツエリアのイベント委任 (v6で更新)
    document.getElementById('app').addEventListener('click', (e) => {
        const target = e.target;
        const serverItem = target.closest('.server-item-container');
        // serverId は、リストアイテムから取得するか、詳細ビューのグローバル state から取得する
        const serverId = serverItem ? parseInt(serverItem.dataset.serverId) : state.selectedServerId;
        const server = state.servers.find(s => s.id === serverId);

        // サーバー一覧画面
        if (state.currentView === 'list' && serverItem) {
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

        // 詳細画面
        if (state.currentView === 'detail' && server) {
            
            // 修正点 3: 戻るボタンの処理
            if (target.closest('#back-to-list-btn')) {
                e.preventDefault();
                showListView();
                return;
            }

            // 修正点 1 & 2: メインタブ切り替え
            const tabBtn = target.closest('.detail-tab-btn');
            if (tabBtn) {
                e.preventDefault();
                const newTab = tabBtn.dataset.tab;
                if (state.detailActiveTab !== newTab) { // 同じタブをクリックした場合は再描画しない
                    state.detailActiveTab = newTab;
                    updateDetailView(); // UI全体を再描画
                }
                return; // 他の処理を中断
            }

            // v6: メモのドロップダウン切り替え
            const memoToggleBtn = e.target.closest('[data-action="toggle-memo-dropdown"]');
            if (memoToggleBtn) {
                e.stopPropagation(); // 他のクリックイベントを防ぐ
                const memoContent = document.getElementById('memo-dropdown-content');
                const memoBtnIcon = memoToggleBtn.querySelector('svg');
                if (memoContent) {
                    memoContent.classList.toggle('hidden');
                    memoBtnIcon.classList.toggle('rotate-180'); // アイコン回転
                }
                return;
            }

            // v6: 展開メモの外側をクリックしたら閉じる
            const memoContent = document.getElementById('memo-dropdown-content');
            if (memoContent && !memoContent.classList.contains('hidden') && !e.target.closest('#memo-dropdown-container')) {
                memoContent.classList.add('hidden');
                const memoBtnIcon = document.getElementById('memo-toggle-btn')?.querySelector('svg');
                if(memoBtnIcon) memoBtnIcon.classList.remove('rotate-180');
            }

            if (target.closest('[data-action="toggle-status"]')) { toggleServerStatus(serverId); return; }
            if (target.closest('[data-action="open-dir"]')) { 
                console.log('フォルダを開く (UIデモ)'); 
                window.electronAPI.sendJsonMessage({ type: 'open_folder', payload: { serverId: server.id }});
            }
            if (target.closest('[data-action="delete-server"]')) {
                state.serverToDeleteId = serverId;
                deletingServerNameSpan.textContent = server.name;
                deleteModal.classList.remove('hidden');
            }
            if (target.closest('[data-action="save-properties"]')) {
                saveProperties(serverId, target.closest('button'));
            }
            if (target.closest('[data-action="restart-server"]')) {
                if (server.status === 'running') {
                    logToDetailView(serverId, 'サーバーを再起動しています...', 'warning');
                    // 停止と起動のコマンドをエージェントに送信
                    window.electronAPI.sendJsonMessage({ type: 'server_control', payload: { serverId: server.id, action: 'restart' }});
                    // UIは即時反映（デモ）
                    toggleServerStatus(serverId); // 停止
                    setTimeout(() => toggleServerStatus(serverId), 2000); // 起動
                } else {
                    logToDetailView(serverId, 'サーバーが停止中のため、再起動できません。', 'error');
                }
            }
            // v5: 「基本」タブのサブタブ切り替え
            if (target.closest('.detail-subtab-btn')) {
                state.detailBasicActiveSubTab = target.closest('.detail-subtab-btn').dataset.subtab;
                updateDetailBasicSubTab(server);
                // スタイル更新
                serverDetailView.querySelectorAll('.detail-subtab-btn').forEach(btn => {
                    btn.classList.toggle('text-primary', btn.dataset.subtab === state.detailBasicActiveSubTab);
                    btn.classList.toggle('border-primary', btn.dataset.subtab === state.detailBasicActiveSubTab);
                    btn.classList.toggle('text-gray-500', btn.dataset.subtab !== state.detailBasicActiveSubTab);
                });
            }
            // v5: Mod/Plugin 削除
            if (target.closest('[data-action="remove-addon"]')) {
                const addonElement = target.closest('.server-addon-item');
                const addonIdToRemove = addonElement.dataset.installedId;
                const addonType = addonElement.dataset.addonType;
                if (addonType === 'mod') {
                    server.installedMods = server.installedMods.filter(m => m.id !== addonIdToRemove);
                } else {
                    server.installedPlugins = server.installedPlugins.filter(p => p.id !== addonIdToRemove);
                }
                updateDetailViewContent(server);
            }
            // コマンド実行ボタン
            if (target.closest('#send-command-btn')) {
                sendCommand();
            }
        }
    });
    
    // コマンド入力欄でのEnterキー
    document.getElementById('app').addEventListener('keypress', (e) => {
        if (e.target.matches('#command-input') && e.key === 'Enter') {
            sendCommand();
        }
    });

    // v5: Mod/Plugin 有効/無効トグル
    document.getElementById('app').addEventListener('change', (e) => {
        if (e.target.classList.contains('toggle-addon-enabled')) {
            const server = state.servers.find(s => s.id === state.selectedServerId);
            if (!server) return;
            const addonElement = e.target.closest('.server-addon-item');
            const addonIdToToggle = addonElement.dataset.installedId;
            const addonType = addonElement.dataset.addonType;
            
            const targetList = (addonType === 'mod') ? server.installedMods : server.installedPlugins;
            const addon = targetList.find(m => m.id === addonIdToToggle);
            
            if(addon) addon.enabled = e.target.checked;
            console.log('Addon toggled:', addonType, addonIdToToggle, addon.enabled);

            // エージェントに変更を通知
            window.electronAPI.sendJsonMessage({
                type: addonType === 'mod' ? 'toggle_mod' : 'toggle_plugin',
                payload: {
                    serverId: server.id,
                    addonId: addon.id,
                    enabled: addon.enabled
                }
            });
        }
    });
    
    // 編集可能なフィールド
    document.getElementById('app').addEventListener('focusout', (e) => {
        if (e.target.matches('.editable[contenteditable="true"]')) {
            // v6: メモ編集時は selectedServerId を参照
            const serverId = e.target.closest('[data-server-id]') ? parseInt(e.target.closest('[data-server-id]').dataset.serverId) : state.selectedServerId;
            updateServerData(serverId, e.target.dataset.field, e.target.innerText);
        }
    });

    // 削除モーダル
    confirmDeleteBtn.addEventListener('click', () => {
        if (state.serverToDeleteId !== null) {
            
            // エージェントに削除を通知
            window.electronAPI.sendJsonMessage({
                type: 'delete_server',
                payload: {
                    serverId: state.serverToDeleteId
                }
            });

            state.servers = state.servers.filter(s => s.id !== state.serverToDeleteId);
            deleteModal.classList.add('hidden');
            state.serverToDeleteId = null;
            showListView();
        }
    });
    cancelDeleteBtn.addEventListener('click', () => { 
        deleteModal.classList.add('hidden'); 
        state.serverToDeleteId = null;
    });
    
    // --- ダークモード (v4と同じ) ---
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

    // --- WebSocket & Ping ---
    window.electronAPI.onUpdatePing(({ ip, latency }) => {
        console.log(`Received ping update for ${ip}: ${latency}ms`);
        const physicalServer = physicalServers.find(p => p.ip.startsWith(ip));
        if (physicalServer) {
            physicalServer.status = 'connected';
            physicalServer.latency = latency;
        }

        // 物理サーバービューが表示されている場合のみ、DOMを直接更新
        if (state.currentView === 'physical') {
            // IPアドレス内のコロンやピリオドをエスケープする必要がある場合も考慮 (ただし、ここでは単純なIDを使用)
            const statusEl = document.getElementById(`status-${physicalServer.ip}`);
            const pingEl = document.getElementById(`ping-${physicalServer.ip}`);
            if (statusEl) {
                statusEl.innerHTML = `
                    <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                        接続中
                    </span>
                `;
            }
            if (pingEl) {
                pingEl.textContent = `${latency} ms`;
            }
        }
    });

    // renderer-ui.js で定義されたグローバル関数 updateView を呼び出す
    updateView();
});