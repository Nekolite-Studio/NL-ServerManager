// manager/renderer-ui.js
// UIの描画と更新を担当する関数群
// このファイルは renderer-state.js の後に読み込まれる必要があります。

// ヘルパー関数
const getStatusClasses = (status) => {
    switch (status) {
        case 'running':
            return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20' };
        case 'starting':
        case 'stopping':
            return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-500/20' };
        case 'stopped':
        default:
            return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20' };
    }
};
const getAgentStatusClasses = (status) => {
    switch (status) {
        case 'Connected':
            return { text: 'text-green-800 dark:text-green-200', bg: 'bg-green-100 dark:bg-green-900', dot: 'bg-green-500' };
        case 'Connecting...':
            return { text: 'text-yellow-800 dark:text-yellow-200', bg: 'bg-yellow-100 dark:bg-yellow-900', dot: 'bg-yellow-500 animate-pulse' };
        case 'Disconnected':
        default:
            return { text: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900', dot: 'bg-red-500' };
    }
};
const getTpsColor = (tps) => tps >= 19 ? 'text-green-500' : tps >= 15 ? 'text-yellow-500' : 'text-red-500';
const getCpuColor = (cpu) => cpu >= 80 ? 'text-red-500' : cpu >= 50 ? 'text-yellow-500' : 'text-green-500';
const getMemoryColor = (mem, max) => (mem/max) >= 0.8 ? 'text-red-500' : (mem/max) >= 0.5 ? 'text-yellow-500' : 'text-green-500';


// --- NEW: Notification System ---
window.showNotification = (message, type = 'info', id = null, duration = 5000) => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notifId = id || `notif-${Date.now()}`;
    let notif = document.getElementById(notifId);

    // 同じIDの通知が既にあれば内容を更新、なければ新規作成
    if (notif) {
        // 既存のタイマーをクリア
        const oldTimeout = notif.dataset.timeoutId;
        if (oldTimeout) clearTimeout(parseInt(oldTimeout));
    } else {
        notif = document.createElement('div');
        notif.id = notifId;
        container.appendChild(notif);
    }
    
    const baseClasses = 'w-full max-w-xs p-4 text-white rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300';
    let typeClasses = '';
    let icon = '';

    switch(type) {
        case 'success':
            typeClasses = 'bg-green-500 dark:bg-green-600';
            icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            break;
        case 'error':
            typeClasses = 'bg-red-500 dark:bg-red-600';
            icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            break;
        default: // info
            typeClasses = 'bg-blue-500 dark:bg-blue-600';
            icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            break;
    }

    notif.className = `${baseClasses} ${typeClasses}`;
    notif.innerHTML = `
        <div class="flex-shrink-0">${icon}</div>
        <p class="flex-1">${message}</p>
        <button data-dismiss-target="${notifId}" class="p-1 rounded-md hover:bg-black/20">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;
    
    const removeNotif = () => {
        notif.classList.add('opacity-0');
        setTimeout(() => notif.remove(), 300);
    };

    if (duration > 0) {
        const timeoutId = setTimeout(removeNotif, duration);
        notif.dataset.timeoutId = timeoutId.toString();
    }

    notif.querySelector(`[data-dismiss-target]`).addEventListener('click', () => {
        const timeoutId = notif.dataset.timeoutId;
        if (timeoutId) clearTimeout(parseInt(timeoutId));
        removeNotif();
    });
};
// --- DOM要素 (グローバルアクセス用) ---
// メインの renderer.js の DOMContentLoaded 内で代入されます
let serverListView, physicalServerListView, serverDetailView, physicalServerDetailView, serverListContainer;
let navGameServers, navPhysicalServers;

// D&D状態管理
let draggedAddon = null; // {id, type}


// --- レンダリング関数 (v5で更新) ---
const renderServerList = () => {
    if (!serverListContainer) return;
    serverListContainer.innerHTML = '';
    
    const servers = getters.allServers();

    if (servers.length === 0) {
        serverListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 mt-10">利用可能なゲームサーバーがありません。</p>';
        return;
    }
    servers.forEach(server => {
        const tpsColor = getTpsColor(server.tps);
        const host = state.physicalServers.get(server.hostId);
        const isBeingDeleted = state.serversBeingDeleted.has(server.server_id);

        const serverElement = document.createElement('div');
        serverElement.className = `server-item-container bg-white dark:bg-gray-800 rounded-lg shadow-md transition-all duration-300 ring-1 ring-gray-200 dark:ring-gray-700 ${isBeingDeleted ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg cursor-pointer hover:ring-primary dark:hover:ring-primary'}`;
        serverElement.dataset.serverId = server.server_id;
        
        let serverNameHTML;
        if (isBeingDeleted) {
            serverNameHTML = `<div class="font-bold text-lg text-gray-500 dark:text-gray-400 truncate">削除中...</div>`;
        } else {
            serverNameHTML = `<div contenteditable="true" data-field="name" class="font-bold text-lg text-gray-900 dark:text-white truncate editable" placeholder="サーバー名を入力">${server.server_name}</div>`;
        }

        serverElement.innerHTML = `
            <div class="grid md:grid-cols-[minmax(150px,_1.5fr)_minmax(130px,_1fr)_minmax(200px,_4fr)_minmax(120px,_1fr)_minmax(80px,_0.5fr)_minmax(60px,_0.5fr)] 2xl:grid-cols-[minmax(150px,_1.5fr)_minmax(130px,_1fr)_minmax(200px,_4fr)_minmax(180px,_1.5fr)_minmax(80px,_0.5fr)_minmax(60px,_0.f_fr)_minmax(100px,_1fr)] gap-4 p-4 items-center">
                <!-- サーバー名 -->
                <div class="flex flex-col col-span-full md:col-span-1 overflow-hidden">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400">サーバー名</span>
                    ${serverNameHTML}
                </div>
                <!-- ホストマシン -->
                <div class="col-span-full md:col-span-1 overflow-hidden">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">ホストマシン</span>
                    <div class="text-sm text-gray-600 dark:text-gray-300 truncate">${host.config.alias}</div>
                    <div class="text-xs text-gray-400 truncate">${host.config.ip}</div>
                </div>
                <!-- ログ -->
                <div class="col-span-full md:col-span-1">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">直近のログ</span>
                    <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 log-clamp leading-relaxed">${(server.logs || []).slice(-4).map(log => `<p class="truncate">${log}</p>`).join('')}</div>
                </div>
                <!-- プレイヤー (縦3列表示) -->
                <div class="col-span-full md:col-span-1">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">最近のプレイヤー</span>
                    <div class="grid grid-rows-3 grid-flow-col gap-x-2 gap-y-1">${(server.players && server.players.recent && server.players.recent.length > 0) ? server.players.recent.map(player => `<span class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full truncate" title="${player}">${player}</span>`).join('') : '<span class="text-xs text-gray-400 col-span-3">なし</span>'}</div>
                </div>
                <!-- 人数 -->
                <div class="col-span-1"><span class="md:hidden text-xs text-gray-500 dark:text-gray-400">参加人数</span><p class="font-mono">${server.players ? server.players.current : 0}/${server.players ? server.players.max : 20}</p></div>
                <!-- TPS -->
                <div class="col-span-1"><span class="md:hidden text-xs text-gray-500 dark:text-gray-400">TPS</span><p class="font-mono font-bold ${tpsColor}">${server.status === 'running' ? (server.tps || 0).toFixed(1) : '-'}</p></div>
                <!-- ステータスボタン -->
                <div class="col-span-full sm:col-span-1 hidden 2xl:block">
                    <button data-action="toggle-status" class="w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}" ${isBeingDeleted || server.status === 'starting' || server.status === 'stopping' ? 'disabled' : ''}>
                        ${server.status === 'running' ? '停止' : (server.status === 'stopping' ? '停止中...' : '起動')}
                    </button>
                </div>
            </div>`;
        serverListContainer.appendChild(serverElement);
    });
};

// server.properties 入力フィールド生成
const createPropertyInput = (key, value) => {
    const type = typeof value;
    let inputHtml = '';
    const baseInputClasses = "w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";
    
    if (type === 'boolean') {
        inputHtml = `<label for="${key}" class="form-switch"><input type="checkbox" id="${key}" class="hidden" ${value ? 'checked' : ''}><div class="form-switch-toggle"></div></label>`;
    } else if (key === 'gamemode') {
        inputHtml = `<select id="${key}" class="${baseInputClasses}">${['survival', 'creative', 'adventure', 'spectator'].map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (key === 'difficulty') {
        inputHtml = `<select id="${key}" class="${baseInputClasses}">${['peaceful', 'easy', 'normal', 'hard'].map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (type === 'number') {
        inputHtml = `<input type="number" id="${key}" value="${value}" class="${baseInputClasses}">`;
    } else {
        const inputType = key.includes('password') ? 'password' : 'text';
        inputHtml = `<input type="${inputType}" id="${key}" value="${value}" class="${baseInputClasses}">`;
    }
    
    return `<div class="grid grid-cols-3 gap-4 items-center">
                <label for="${key}" class="text-sm text-gray-500 dark:text-gray-400 truncate col-span-1">${key}</label>
                <div class="col-span-2">${inputHtml}</div>
            </div>`;
};

// server.properties エディタレンダリング
const renderPropertiesEditor = (server) => {
    const properties = server.properties || {};
    const propertyGroups = {
        'ワールド設定': ['level-name', 'level-seed', 'level-type', 'generator-settings', 'generate-structures', 'allow-nether', 'hardcore', 'difficulty', 'gamemode', 'force-gamemode'],
        'プレイヤー設定': ['max-players', 'pvp', 'allow-flight', 'enforce-whitelist', 'white-list', 'player-idle-timeout', 'spawn-protection', 'op-permission-level', 'function-permission-level'],
        'MOB・NPC設定': ['spawn-animals', 'spawn-monsters', 'spawn-npcs'],
        'サーバー技術設定': ['server-port', 'server-ip', 'online-mode', 'prevent-proxy-connections', 'network-compression-threshold', 'max-tick-time', 'view-distance', 'max-build-height', 'max-world-size', 'use-native-transport', 'snooper-enabled'],
        'その他': ['motd', 'resource-pack', 'resource-pack-sha1', 'enable-command-block'],
        'Query & RCON': ['enable-query', 'query.port', 'enable-rcon', 'rcon.port', 'rcon.password', 'broadcast-console-to-ops', 'broadcast-rcon-to-ops']
    };
    let html = '<div id="properties-editor" class="space-y-6 custom-scrollbar pr-2">';
    for (const groupName in propertyGroups) {
        html += `<fieldset class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <legend class="text-lg font-semibold text-gray-900 dark:text-white px-2">${groupName}</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        ${propertyGroups[groupName].map(key => createPropertyInput(key, properties[key])).join('')}
                    </div>
                </fieldset>`;
    }
    html += '</div>';
    return html;
};

// --- v6: 詳細ビューのレンダリング (レイアウト大幅改修) ---
const renderServerDetail = () => {
    const server = getters.selectedServer();
    if (!server || !serverDetailView) return;
    
    const host = state.physicalServers.get(server.hostId);
    const isBeingDeleted = state.serversBeingDeleted.has(server.server_id);
    const statusClasses = getStatusClasses(server.status); // 修正済み
    const tpsColor = getTpsColor(server.tps || 0);
    const cpuColor = getCpuColor(server.cpu || 0);
    const memColor = getMemoryColor(server.memory || 0, server.memoryMax || 1);

    const memo = server.memo || '';
    const memoLines = memo.split('\n');
    const memoLineCount = memoLines.length;
    const showToggleButton = memoLineCount >= 5;
    const previewMemo = memoLines[0] || 'メモなし'; // 1行目だけ表示

    serverDetailView.innerHTML = `
        <!-- ヘッダー -->
        <div>
            <button id="back-to-list-btn" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 mb-4 inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                サーバー一覧に戻る
            </button>
            
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex-grow min-w-0">
                    <div contenteditable="true" data-field="name" class="text-3xl font-bold editable truncate" placeholder="サーバー名を入力">${server.server_name}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        ホスト: <span class="font-medium text-gray-700 dark:text-gray-300">${host ? host.config.alias : '未割り当て'}</span> (${host ? host.config.ip : 'N/A'})
                    </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <button data-action="open-dir" class="w-1/2 sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 flex-grow" ${isBeingDeleted ? 'disabled' : ''}>フォルダ</button>
                    <button data-action="toggle-status" class="w-1/2 sm:w-auto font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 flex-grow ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}" ${isBeingDeleted || server.status === 'starting' || server.status === 'stopping' ? 'disabled' : ''}>
                        ${server.status === 'running' ? '停止' : (server.status === 'starting' ? '起動中...' : (server.status === 'stopping' ? '停止中...' : '起動'))}
                    </button>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">ステータス</div>
                <div class="text-2xl font-bold ${statusClasses.text} mt-1">
                    ${{'running': '起動済み', 'starting': '起動中', 'stopping': '停止中', 'stopped': '停止済み'}[server.status] || '不明'}
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">プレイヤー</div>
                <div class="text-4xl font-extrabold text-primary mt-1">${server.players ? server.players.current : 0} <span class="text-lg text-gray-500">/ ${server.players ? server.players.max : 20}</span></div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">TPS</div>
                <div class="text-4xl font-extrabold ${tpsColor} mt-1">${server.status === 'running' ? (server.tps || 0).toFixed(1) : '-'}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">CPU / メモリ</div>
                <div class="text-2xl font-bold ${cpuColor} mt-1">${server.status === 'running' ? (server.cpu || 0).toFixed(1) : '0.0'}%</div>
                <div class="text-sm ${memColor} mt-1">${(server.memory / 1024).toFixed(1)} GB / ${(server.memoryMax / 1024).toFixed(1)} GB</div>
            </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-6 mt-6">
            <div class="lg:w-64 lg:flex-shrink-0 space-y-6">
                <nav class="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2" aria-label="Tabs">
                    <button data-tab="console" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'console' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>コンソールログ</button>
                    <button data-tab="launch-config" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'launch-config' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>起動構成</button>
                    <button data-tab="properties" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'properties' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>サーバー設定</button>
                    <button data-tab="mods" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'mods' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>Mod</button>
                    <button data-tab="plugins" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'plugins' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>Plugin</button>
                    <button data-tab="players" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'players' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>プレイヤー</button>
                    <button data-tab="danger" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'danger' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>その他</button>
                </nav>
            </div>
            <div class="flex-1">
                <div id="detail-main-area" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700" style="height: calc(100vh - 400px);">
                    <!-- 内容は updateDetailViewContent で動的に挿入 -->
                </div>
            </div>
        </div>
    `;

    updateDetailViewContent(server);
};

const updateDetailViewContent = (server) => {
    const mainArea = document.getElementById('detail-main-area');
    if (!mainArea) return;

    server = server || getters.selectedServer();
    if (!server) return;

    const isBeingDeleted = state.serversBeingDeleted.has(server.server_id);
    if(isBeingDeleted) {
        mainArea.innerHTML = '<div class="p-6 text-center text-gray-500">このサーバーは現在削除処理中です...</div>';
        return;
    }

    switch(state.detailActiveTab) {
        case 'console':
            mainArea.innerHTML = `
                <div class="flex flex-col h-full">
                    <div class="bg-gray-50 dark:bg-black p-4 rounded-t-lg flex-1 overflow-y-auto custom-scrollbar">
                        <pre id="server-log-output" class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">${(server.logs || []).join('\n')}</pre>
                    </div>
                    <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                        <input type="text" id="command-input" placeholder="コマンドを入力..." class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary transition duration-150">
                        <button id="send-command-btn" class="bg-primary hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200">
                            実行
                        </button>
                    </div>
                </div>
            `;
            const logOutputEl = mainArea.querySelector('#server-log-output');
            if(logOutputEl) logOutputEl.parentElement.scrollTop = logOutputEl.parentElement.scrollHeight;
            break;

        case 'launch-config':
            {
                const runtime = server.runtime || {};
                mainArea.innerHTML = `
                    <div class="p-6 h-full flex flex-col">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold">起動構成</h2>
                            <button data-action="save-launch-config" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">構成を保存</button>
                        </div>
                        <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <div class="space-y-6">
                                <div>
                                    <label for="java-path" class="block text-sm font-medium text-gray-500 dark:text-gray-400">Java実行パス</label>
                                    <input type="text" id="java-path" value="${runtime.java_path || ''}" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Agentのデフォルト設定を使用">
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label for="min-memory" class="block text-sm font-medium text-gray-500 dark:text-gray-400">最小メモリ割り当て (MB)</label>
                                        <input type="number" id="min-memory" value="${runtime.min_memory || 1024}" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary">
                                    </div>
                                    <div>
                                        <label for="max-memory" class="block text-sm font-medium text-gray-500 dark:text-gray-400">最大メモリ割り当て (MB)</label>
                                        <input type="number" id="max-memory" value="${runtime.max_memory || 2048}" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary">
                                    </div>
                                </div>
                                <div>
                                    <label for="custom-args" class="block text-sm font-medium text-gray-500 dark:text-gray-400">カスタムJVM引数</label>
                                    <textarea id="custom-args" rows="3" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=50">${runtime.custom_args || ''}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            break;

        case 'properties':
            mainArea.innerHTML = `
                <div class="p-6 h-full flex flex-col">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold">サーバー設定 (server.properties)</h2>
                        <button data-action="save-properties" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">変更を保存</button>
                    </div>
                    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        ${renderPropertiesEditor(server)}
                    </div>
                </div>
            `;
            break;

        case 'mods':
        case 'plugins':
            mainArea.innerHTML = `<div class="p-6"><h3 class="text-xl font-bold">${state.detailActiveTab === 'mods' ? 'Mod' : 'Plugin'}管理</h3><p class="mt-4 text-gray-500">（この機能は現在開発中です）</p></div>`;
            break;

        case 'players':
            mainArea.innerHTML = `<div class="p-6"><h3 class="text-xl font-bold">プレイヤー管理</h3><p class="mt-4 text-gray-500">（この機能は現在開発中です）</p></div>`;
            break;
        
        case 'danger':
            mainArea.innerHTML = `
                <div class="p-6">
                    <h3 class="text-xl font-bold text-red-500 dark:text-red-400">危険ゾーン</h3>
                    <div class="mt-6 bg-red-100 dark:bg-red-900/50 p-6 rounded-lg space-y-6">
                        <div>
                            <h4 class="font-bold text-gray-900 dark:text-red-200">サーバー再起動</h4>
                            <p class="text-sm text-red-700 dark:text-gray-400 mb-3">サーバーを安全に再起動します。</p>
                            <button data-action="restart-server" class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200">
                                サーバー再起動
                            </button>
                        </div>
                        <div class="border-t border-red-300 dark:border-red-500/30"></div>
                        <div>
                            <h4 class="font-bold text-gray-900 dark:text-red-200">サーバーの削除</h4>
                            <p class="text-sm text-red-700 dark:text-gray-400 mb-3">この操作は取り消せません。すべてのデータが削除されます。</p>
                            <button data-action="delete-server" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300" ${server.status === 'running' ? 'disabled' : ''}>
                                ${server.status === 'running' ? '停止してから削除してください' : 'このサーバーを削除する'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            break;
        default:
            mainArea.innerHTML = `<p class="p-6 text-gray-500">不明なタブが選択されました: ${state.detailActiveTab}</p>`;
            break;
    }
};

const updateDetailView = () => {
    if (state.currentView !== 'detail') return;
    renderServerDetail();
};

const renderPhysicalServerList = () => {
    const container = document.getElementById('physical-server-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (state.physicalServers.size === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 mt-10">利用可能なエージェントがありません。</p>';
        return;
    }

    state.physicalServers.forEach(pserv => {
        const el = document.createElement('div');
        el.className = "physical-server-item bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center cursor-pointer hover:ring-2 hover:ring-primary transition-all";
        el.dataset.agentId = pserv.id;

        const statusClasses = getAgentStatusClasses(pserv.status);
        const metrics = pserv.metrics || {};
        const cpu = metrics.cpuUsage || 0;
        const ram = metrics.ramUsage || 0;

        el.innerHTML = `
            <div class="md:col-span-2">
                <div class="font-bold text-lg text-gray-900 dark:text-white">${pserv.config.alias}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400 font-mono">${pserv.config.ip}:${pserv.config.port}</div>
            </div>
            <div>
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusClasses.bg} ${statusClasses.text}">
                    <span class="w-2 h-2 ${statusClasses.dot} rounded-full"></span>
                    ${pserv.status}
                </span>
            </div>
            <div>
                <div class="text-sm text-gray-500 dark:text-gray-400">CPU</div>
                <div class="font-semibold">${cpu}%</div>
            </div>
            <div>
                <div class="text-sm text-gray-500 dark:text-gray-400">RAM</div>
                <div class="font-semibold">${ram}%</div>
            </div>
         `;
        container.appendChild(el);
    });
};

const renderPhysicalServerDetail = () => {
    const agent = getters.selectedPhysicalServer();
    if (!agent || !physicalServerDetailView) return;

    physicalServerDetailView.innerHTML = `
        <!-- Header -->
        <div>
            <button id="back-to-physical-list-btn" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 mb-4 inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                物理サーバー一覧に戻る
            </button>
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-3xl font-bold">${agent.config.alias}</h2>
                    <p class="text-gray-500 dark:text-gray-400 font-mono">${agent.config.ip}:${agent.config.port}</p>
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700 mt-6">
            <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                <button data-tab="status" class="physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${state.physicalServerDetailActiveTab === 'status' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
                    ステータス
                </button>
                <button data-tab="settings" class="physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${state.physicalServerDetailActiveTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
                    設定
                </button>
                <button data-tab="logs" class="physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${state.physicalServerDetailActiveTab === 'logs' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
                    システムログ
                </button>
            </nav>
        </div>

        <div id="physical-detail-content" class="mt-6">
        </div>
    `;
    updatePhysicalServerDetailContent();
};

const updatePhysicalServerDetailContent = () => {
    const container = document.getElementById('physical-detail-content');
    const agent = getters.selectedPhysicalServer();
    if (!container || !agent) return;

    const metrics = agent.metrics || {};
    const systemInfo = agent.systemInfo || {};
    const gameServers = metrics.gameServers || {};

    switch (state.physicalServerDetailActiveTab) {
        case 'status':
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">接続状態</div>
                        <div class="text-2xl font-bold ${getAgentStatusClasses(agent.status).text} mt-1">${agent.status}</div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">CPU 使用率</div>
                        <div class="text-4xl font-extrabold ${getCpuColor(metrics.cpuUsage || 0)} mt-1">${metrics.cpuUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">RAM 使用率</div>
                        <div class="text-4xl font-extrabold ${getMemoryColor((metrics.ramUsage || 0), 100)} mt-1">${metrics.ramUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                     <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Disk 使用率</div>
                        <div class="text-4xl font-extrabold ${getMemoryColor((metrics.diskUsage || 0), 100)} mt-1">${metrics.diskUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 class="text-lg font-semibold mb-4">システム情報</h3>
                        <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">OS</dt><dd class="font-mono">${systemInfo.os || 'N/A'}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">CPU</dt><dd class="font-mono">${systemInfo.cpu || 'N/A'}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Total RAM</dt><dd class="font-mono">${systemInfo.totalRam || 'N/A'}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Network</dt><dd class="font-mono">${metrics.networkSpeed || 'N/A'} Mbps</dd>
                        </dl>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 class="text-lg font-semibold mb-4">ゲームサーバー</h3>
                        <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">実行中</dt><dd class="font-bold text-green-500">${gameServers.running || 0}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">停止中</dt><dd class="font-bold text-red-500">${gameServers.stopped || 0}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">合計プレイヤー</dt><dd class="font-bold">${gameServers.totalPlayers || 0}</dd>
                        </dl>
                    </div>
                </div>
            `;
            break;
        case 'settings':
            const isConnected = agent.status === 'Connected';
            container.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 class="text-lg font-semibold mb-6">エージェント設定</h3>
                        <fieldset id="agent-settings-form" ${!isConnected ? 'disabled' : ''}>
                            <div class="space-y-6">
                                <div>
                                    <label for="agent-alias" class="block text-sm font-medium text-gray-700 dark:text-gray-300">エイリアス</label>
                                    <input type="text" id="agent-alias" value="${agent.config.alias}" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 disabled:opacity-50">
                                </div>
                                <div>
                                    <label for="agent-ip" class="block text-sm font-medium text-gray-700 dark:text-gray-300">IPアドレス</label>
                                    <input type="text" id="agent-ip" value="${agent.config.ip}" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 disabled:opacity-50">
                                </div>
                                <div>
                                    <label for="agent-port" class="block text-sm font-medium text-gray-700 dark:text-gray-300">ポート</label>
                                    <input type="number" id="agent-port" value="${agent.config.port}" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 disabled:opacity-50">
                                </div>
                                 <div>
                                    <label for="agent-path" class="block text-sm font-medium text-gray-700 dark:text-gray-300">サーバーディレクトリ</label>
                                    <input type="text" id="agent-path" value="${agent.config.path || ''}" placeholder="/path/to/servers" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 disabled:opacity-50">
                                </div>
                            </div>
                            <div class="mt-8 flex justify-between items-center">
                                <button data-action="open-java-install-modal" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                                    Javaをインストール
                                </button>
                                <button data-action="save-agent-settings" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                                    設定を保存
                                </button>
                            </div>
                        </fieldset>
                        ${!isConnected ? '<p class="mt-4 text-sm text-yellow-600 dark:text-yellow-400">設定を変更するには、エージェントが接続されている必要があります。</p>' : ''}
                    </div>
                    <div class="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-500/30">
                         <h3 class="text-lg font-semibold text-red-700 dark:text-red-300">危険ゾーン</h3>
                         <p class="mt-2 text-sm text-red-600 dark:text-red-400">以下の操作は元に戻すことができません。十分に注意してください。</p>
                         <div class="mt-6">
                            <button data-action="delete-agent" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                                このエージェントを削除
                            </button>
                            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">これにより、Managerの管理リストからこのエージェントが削除されます。エージェント自体やサーバーファイルは削除されません。</p>
                         </div>
                    </div>
                </div>
            `;
            break;
        case 'logs':
            container.innerHTML = `
                <div class="bg-gray-900 dark:bg-black text-white font-mono text-xs rounded-lg shadow-lg" style="height: 60vh;">
                    <div class="p-4 overflow-y-auto custom-scrollbar h-full">
                        <pre>${(agent.logs || ['No logs yet.']).join('\n')}</pre>
                    </div>
                </div>
            `;
            const logContainer = container.querySelector('.custom-scrollbar');
            if (logContainer) {
                logContainer.scrollTop = logContainer.scrollHeight;
            }
            break;
    }
};

const updateView = () => {
    console.log(`[View] Updating view to: ${state.currentView}`);
    if (!serverListView || !physicalServerListView || !serverDetailView || !physicalServerDetailView) {
        console.error("DOM要素が初期化されていません。");
        return;
    }

    serverListView.classList.toggle('hidden', state.currentView !== 'list');
    physicalServerListView.classList.toggle('hidden', state.currentView !== 'physical');
    serverDetailView.classList.toggle('hidden', state.currentView !== 'detail');
    physicalServerDetailView.classList.toggle('hidden', state.currentView !== 'physical-detail');

    const isGameView = state.currentView === 'list' || state.currentView === 'detail';
    const isPhysicalView = state.currentView === 'physical' || state.currentView === 'physical-detail';

    navGameServers.classList.toggle('bg-primary', isGameView);
    navGameServers.classList.toggle('text-white', isGameView);
    navGameServers.classList.toggle('text-gray-600', !isGameView);
    navGameServers.classList.toggle('dark:text-gray-300', !isGameView);
    
    navPhysicalServers.classList.toggle('bg-primary', isPhysicalView);
    navPhysicalServers.classList.toggle('text-white', isPhysicalView);
    navPhysicalServers.classList.toggle('text-gray-600', !isPhysicalView);
    navPhysicalServers.classList.toggle('dark:text-gray-300', !isPhysicalView);

    if (state.currentView === 'list') {
        renderServerList();
    } else if (state.currentView === 'detail') {
        renderServerDetail();
    } else if (state.currentView === 'physical') {
        renderPhysicalServerList();
    } else if (state.currentView === 'physical-detail') {
        renderPhysicalServerDetail();
    }
};