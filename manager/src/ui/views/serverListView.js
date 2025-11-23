// manager/src/ui/views/serverListView.js
import { state, getters } from '../../../renderer-state.js';
import { getTpsColor } from '../utils.js';

export const renderServerList = (container) => {
    if (!container) return;
    
    const servers = getters.allServers();

    // 空の状態のメッセージ要素を取得または作成
    let emptyMessage = container.querySelector('#no-servers-message');
    
    if (servers.length === 0) {
        // サーバーがない場合
        // 既存のサーバー要素をすべて削除
        container.querySelectorAll('.server-item-container').forEach(el => el.remove());

        if (!emptyMessage) {
            emptyMessage = document.createElement('p');
            emptyMessage.id = 'no-servers-message';
            emptyMessage.className = 'text-center text-gray-500 dark:text-gray-400 mt-10';
            emptyMessage.textContent = '利用可能なゲームサーバーがありません。';
            container.appendChild(emptyMessage);
        }
        return;
    } else {
        // サーバーがある場合、メッセージがあれば削除
        if (emptyMessage) {
            emptyMessage.remove();
        }
    }

    // 既存のサーバー要素をマップ化 (ID -> Element)
    const existingElements = new Map();
    container.querySelectorAll('.server-item-container').forEach(el => {
        existingElements.set(el.dataset.serverId, el);
    });

    // サーバーリストの差分更新
    // 1. 削除されたサーバーの要素を削除
    const currentServerIds = new Set(servers.map(s => s.server_id));
    existingElements.forEach((el, id) => {
        if (!currentServerIds.has(id)) {
            el.remove();
        }
    });

    // 2. 新規追加または更新
    servers.forEach(server => {
        let serverElement = existingElements.get(server.server_id);

        if (serverElement) {
            // 既存要素の更新 (Partial Update)
            updateServerListItem(serverElement, server);
        } else {
            // 新規要素の作成
            serverElement = createServerListItem(server);
            container.appendChild(serverElement);
        }
    });
};

const createServerListItem = (server) => {
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
        serverNameHTML = `<div class="font-bold text-lg text-gray-900 dark:text-white truncate" data-field="name">${server.server_name}</div>`;
    }

    serverElement.innerHTML = `
        <div class="grid md:grid-cols-[minmax(150px,_1.5fr)_minmax(130px,_1fr)_minmax(200px,_4fr)_minmax(120px,_1fr)_minmax(80px,_0.5fr)_minmax(60px,_0.5fr)] 2xl:grid-cols-[minmax(150px,_1.5fr)_minmax(130px,_1fr)_minmax(200px,_4fr)_minmax(180px,_1.5fr)_minmax(80px,_0.5fr)_minmax(60px,_0.5fr)_minmax(100px,_1fr)] gap-4 p-4 items-center">
            <!-- サーバー名 -->
            <div class="flex flex-col col-span-full md:col-span-1 overflow-hidden">
                <span class="md:hidden text-xs text-gray-500 dark:text-gray-400">サーバー名</span>
                ${serverNameHTML}
            </div>
            <!-- ホストマシン -->
            <div class="col-span-full md:col-span-1 overflow-hidden">
                <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">ホストマシン</span>
                <div class="text-sm text-gray-600 dark:text-gray-300 truncate">${host ? host.config.alias : 'Unknown'}</div>
                <div class="text-xs text-gray-400 truncate">${host ? host.config.ip : 'N/A'}</div>
            </div>
            <!-- ログ -->
            <div class="col-span-full md:col-span-1">
                <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">直近のログ</span>
                <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 log-clamp leading-relaxed" data-field="logs">${(server.logs || []).slice(-4).map(log => `<p class="truncate">${log}</p>`).join('')}</div>
            </div>
            <!-- プレイヤー (縦3列表示) -->
            <div class="col-span-full md:col-span-1">
                <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">最近のプレイヤー</span>
                <div class="grid grid-rows-3 grid-flow-col gap-x-2 gap-y-1" data-field="recent-players">${(server.players && server.players.recent && server.players.recent.length > 0) ? server.players.recent.map(player => `<span class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full truncate" title="${player}">${player}</span>`).join('') : '<span class="text-xs text-gray-400 col-span-3">なし</span>'}</div>
            </div>
            <!-- 人数 -->
            <div class="col-span-1"><span class="md:hidden text-xs text-gray-500 dark:text-gray-400">参加人数</span><p class="font-mono" data-field="player-count">${server.players ? server.players.current : 0}/${server.players ? server.players.max : 20}</p></div>
            <!-- TPS -->
            <div class="col-span-1"><span class="md:hidden text-xs text-gray-500 dark:text-gray-400">TPS</span><p class="font-mono font-bold ${tpsColor}" data-field="tps">${server.status === 'running' ? (server.tps || 0).toFixed(1) : '-'}</p></div>
            <!-- ステータスボタン -->
            <div class="col-span-full sm:col-span-1 hidden 2xl:block">
                <button data-action="toggle-status" class="w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}" ${isBeingDeleted || server.status === 'starting' || server.status === 'stopping' ? 'disabled' : ''}>
                    ${server.status === 'running' ? '停止' : (server.status === 'stopping' ? '停止中...' : '起動')}
                </button>
            </div>
        </div>`;
    return serverElement;
};

const updateServerListItem = (element, server) => {
    const isBeingDeleted = state.serversBeingDeleted.has(server.server_id);
    const tpsColor = getTpsColor(server.tps);

    // コンテナクラスの更新 (削除中状態など)
    element.className = `server-item-container bg-white dark:bg-gray-800 rounded-lg shadow-md transition-all duration-300 ring-1 ring-gray-200 dark:ring-gray-700 ${isBeingDeleted ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg cursor-pointer hover:ring-primary dark:hover:ring-primary'}`;

    // サーバー名
    const nameEl = element.querySelector('[data-field="name"]');
    if (nameEl && !isBeingDeleted) {
        nameEl.textContent = server.server_name;
    }

    // ログ
    const logsEl = element.querySelector('[data-field="logs"]');
    if (logsEl) {
        logsEl.innerHTML = (server.logs || []).slice(-4).map(log => `<p class="truncate">${log}</p>`).join('');
    }

    // 最近のプレイヤー
    const recentPlayersEl = element.querySelector('[data-field="recent-players"]');
    if (recentPlayersEl) {
        recentPlayersEl.innerHTML = (server.players && server.players.recent && server.players.recent.length > 0)
            ? server.players.recent.map(player => `<span class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full truncate" title="${player}">${player}</span>`).join('')
            : '<span class="text-xs text-gray-400 col-span-3">なし</span>';
    }

    // 参加人数
    const playerCountEl = element.querySelector('[data-field="player-count"]');
    if (playerCountEl) {
        playerCountEl.textContent = `${server.players ? server.players.current : 0}/${server.players ? server.players.max : 20}`;
    }

    // TPS
    const tpsEl = element.querySelector('[data-field="tps"]');
    if (tpsEl) {
        tpsEl.className = `font-mono font-bold ${tpsColor}`;
        tpsEl.textContent = server.status === 'running' ? (server.tps || 0).toFixed(1) : '-';
    }

    // ステータスボタン
    const btn = element.querySelector('[data-action="toggle-status"]');
    if (btn) {
        btn.className = `w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`;
        btn.textContent = server.status === 'running' ? '停止' : (server.status === 'stopping' ? '停止中...' : '起動');
        btn.disabled = isBeingDeleted || server.status === 'starting' || server.status === 'stopping';
    }
};