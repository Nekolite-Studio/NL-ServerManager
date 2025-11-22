// manager/src/ui/views/serverListView.js
import { state, getters } from '../../../renderer-state.js';
import { getTpsColor } from '../utils.js';

export const renderServerList = (container) => {
    if (!container) return;
    container.innerHTML = '';
    
    const servers = getters.allServers();

    if (servers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 mt-10">利用可能なゲームサーバーがありません。</p>';
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
            serverNameHTML = `<div class="font-bold text-lg text-gray-900 dark:text-white truncate">${server.server_name}</div>`;
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
        container.appendChild(serverElement);
    });
};