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

// --- NEW: Confirmation Modal ---
window.showConfirmationModal = (message, onConfirm) => {
    // 既存のモーダルがあれば削除
    const existingModal = document.getElementById('confirmation-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';
    modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 dark:bg-opacity-80 flex justify-center items-center z-50 transition-opacity duration-300';
    
    // フェードインのために少し遅延させる
    setTimeout(() => modal.classList.add('opacity-100'), 10);

    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md transform transition-all duration-300 scale-95">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">確認</h3>
            <p class="text-gray-600 dark:text-gray-300 mt-4">${message}</p>
            <div class="mt-8 flex justify-end gap-4">
                <button id="confirm-cancel-btn" class="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 font-semibold">いいえ</button>
                <button id="confirm-ok-btn" class="px-6 py-2 bg-primary text-white rounded-md hover:bg-indigo-700 font-semibold">はい</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    const content = modal.querySelector('div > div');
    setTimeout(() => content.classList.add('scale-100'), 10);


    const closeModal = () => {
        modal.classList.remove('opacity-100');
        content.classList.remove('scale-100');
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('#confirm-ok-btn').addEventListener('click', () => {
        if(onConfirm) onConfirm();
        closeModal();
    });
    modal.querySelector('#confirm-cancel-btn').addEventListener('click', closeModal);
    // 背景クリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'confirmation-modal') {
            closeModal();
        }
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

// server.properties 入力フィールド生成（メタデータ駆動）
const createPropertyInput = (prop, currentValue) => {
    const { key, type, description, 'default': defaultValue, 'enum': enumValues, min, max, step } = prop;

    const container = document.createElement('div');
    // 新レイアウト: グリッドで要素を配置
    container.className = 'grid grid-cols-[auto_minmax(0,_1fr)_minmax(0,_1.5fr)_auto] items-center gap-x-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0';

    // 1. ヘルプアイコンとポップアップ
    const helpContainer = document.createElement('div');
    helpContainer.className = 'relative flex items-center justify-center';
    helpContainer.innerHTML = `
        <button data-action="show-help" data-key="${key}" class="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </button>
        <div id="help-popup-${key}" class="absolute bottom-full left-0 mb-2 w-72 bg-gray-800 text-white text-sm rounded py-2 px-3 transition-opacity duration-300 pointer-events-none z-20 hidden">
            <p class="font-semibold">${key}</p>
            <p class="mt-1 text-xs text-gray-300">${description}</p>
            <div class="font-mono text-gray-400 text-xs mt-2">Default: ${defaultValue}</div>
        </div>
    `;
    container.appendChild(helpContainer);


    // 2. 設定タイトル
    const label = document.createElement('label');
    label.htmlFor = key;
    label.className = 'text-sm font-medium text-gray-800 dark:text-gray-200 truncate';
    label.textContent = key;
    container.appendChild(label);
    
    // 3. 入力要素
    const inputContainer = document.createElement('div');
    let inputElement;
    const baseInputClasses = "w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";

    switch (type) {
        case 'boolean':
            // On/Offのラジオボタンに変更
            inputElement = document.createElement('div');
            inputElement.className = 'flex items-center gap-x-4';
            const idOn = `${key}-on`;
            const idOff = `${key}-off`;
            const checkedOn = currentValue === true ? 'checked' : '';
            const checkedOff = currentValue === false ? 'checked' : '';
            inputElement.innerHTML = `
                <div class="flex items-center">
                    <input id="${idOn}" name="${key}" type="radio" data-key="${key}" value="true" ${checkedOn} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary property-input-radio">
                    <label for="${idOn}" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">On</label>
                </div>
                <div class="flex items-center">
                    <input id="${idOff}" name="${key}" type="radio" data-key="${key}" value="false" ${checkedOff} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary property-input-radio">
                    <label for="${idOff}" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">Off</label>
                </div>
            `;
            break;
        case 'enum':
            inputElement = document.createElement('select');
            inputElement.id = key;
            inputElement.dataset.key = key;
            inputElement.className = `${baseInputClasses} property-input`;
            (enumValues || []).forEach(o => {
                const option = document.createElement('option');
                option.value = o;
                option.textContent = o;
                if (currentValue === o) {
                    option.selected = true;
                }
                inputElement.appendChild(option);
            });
            break;
        case 'number':
            inputElement = document.createElement('input');
            inputElement.type = 'number';
            inputElement.id = key;
            inputElement.dataset.key = key;
            inputElement.value = currentValue;
            inputElement.className = `${baseInputClasses} property-input`;
            if (min !== undefined) inputElement.min = min;
            if (max !== undefined) inputElement.max = max;
            if (step !== undefined) inputElement.step = step;
            break;
        case 'string':
        default:
            inputElement = document.createElement('input');
            inputElement.type = key.includes('password') ? 'password' : 'text';
            inputElement.id = key;
            inputElement.dataset.key = key;
            inputElement.value = currentValue;
            inputElement.className = `${baseInputClasses} property-input`;
            break;
    }
    inputContainer.appendChild(inputElement);
    container.appendChild(inputContainer);

    // 4. リセットボタン
    const resetContainer = document.createElement('div');
    resetContainer.className = 'flex items-center justify-end';
    const resetButton = document.createElement('button');
    resetButton.dataset.action = 'confirm-reset-property';
    resetButton.dataset.key = key;
    resetButton.className = 'p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400';
    resetButton.title = 'デフォルト値に戻す';
    resetButton.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3"></path></svg>`;
    resetContainer.appendChild(resetButton);
    container.appendChild(resetContainer);
    
    return container;
};


// server.properties エディタレンダリング
const renderPropertiesEditor = async (server) => {
    const properties = server.properties || {};
    const annotations = await window.electronAPI.getServerPropertiesAnnotations();

    // アノテーションをグループごとに動的に分類
    const groupedAnnotations = Object.values(annotations).reduce((acc, annotation) => {
        const groupName = annotation.group || 'その他';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(annotation);
        return acc;
    }, {});

    const editorContainer = document.createElement('div');
    editorContainer.id = 'properties-editor';
    editorContainer.className = 'space-y-4 custom-scrollbar pr-2';

    // 定義済みの順序、なければアルファベット順
    const groupOrder = ['ワールド設定', 'プレイヤー設定', 'MOB・NPC設定', 'サーバー技術設定', 'Query & RCON', 'その他'];
    const sortedGroupNames = Object.keys(groupedAnnotations).sort((a, b) => {
        const indexA = groupOrder.indexOf(a);
        const indexB = groupOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    for (const groupName of sortedGroupNames) {
        const groupAnnotations = groupedAnnotations[groupName];
        
        const details = document.createElement('details');
        details.className = 'group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 open:ring-2 open:ring-primary/50 dark:open:ring-primary/70 transition-all';
        details.open = true;

        const summary = document.createElement('summary');
        summary.className = 'text-lg font-bold text-gray-800 dark:text-white p-4 cursor-pointer flex items-center justify-between list-none';
        summary.innerHTML = `
            <span>${groupName}</span>
            <svg class="w-6 h-6 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        `;
        details.appendChild(summary);

        const itemsContainer = document.createElement('div');
        // レスポンシブグリッドレイアウト
        itemsContainer.className = 'px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-x-6';
        
        groupAnnotations.forEach(annotation => {
            const { key } = annotation;
            // サーバーに値がなければ、アノテーションのデフォルト値を使用
            const currentValue = properties[key] !== undefined ? properties[key] : annotation.default;
            const inputElement = createPropertyInput(annotation, currentValue);
            itemsContainer.appendChild(inputElement);
        });

        if (itemsContainer.hasChildNodes()) {
            details.appendChild(itemsContainer);
            editorContainer.appendChild(details);
        }
    }
    return editorContainer;
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
                <div class="text-4xl font-extrabold text-primary mt-1">${server.players?.current || 0} <span class="text-lg text-gray-500">/ ${server.players?.max || 20}</span></div>
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
            <div class="lg:w-75 lg:flex-shrink-0 space-y-6">
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
                <div id="detail-main-area" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700" style="height: calc(100vh - 335px);">
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
                                <div class="text-center p-8 text-gray-500">読み込み中...</div>
                            </div>
                        </div>
                    `;
                    renderPropertiesEditor(server).then(editorElement => {
                        const editorContainer = mainArea.querySelector('.custom-scrollbar');
                        if (editorContainer) {
                            editorContainer.innerHTML = ''; // 読み込み中... をクリア
                            editorContainer.appendChild(editorElement);
                        }
                    });
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
        const cpu = metrics.cpuUsage || '0.00';
        const ram = metrics.ramUsage || '0.00';

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
                        <div class="text-4xl font-extrabold ${getCpuColor(parseFloat(metrics.cpuUsage) || 0)} mt-1">${metrics.cpuUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">RAM 使用率</div>
                        <div class="text-4xl font-extrabold ${getMemoryColor(parseFloat(metrics.ramUsage) || 0, 100)} mt-1">${metrics.ramUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                     <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Disk 使用率</div>
                        <div class="text-4xl font-extrabold ${getMemoryColor(parseFloat(metrics.diskUsage) || 0, 100)} mt-1">${metrics.diskUsage || 'N/A'}<span class="text-lg">%</span></div>
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