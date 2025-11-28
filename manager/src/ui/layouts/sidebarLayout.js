// manager/src/ui/layouts/sidebarLayout.js
import { getters } from '../../../renderer-state.js';
import { getStatusClasses } from '../utils.js';

export function renderSidebarLayout(container) {
    const unifiedList = getters.getUnifiedServerList();
    const allGameServers = unifiedList.flatMap(item => 
        item.gameServers.map(server => ({ ...server, agentName: item.agentInfo.config.alias }))
    );

    const html = `
        <!-- Sidebar -->
        <div class="w-60 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            <div class="p-4 text-xs font-bold text-gray-500 uppercase">Agents</div>
            <div class="flex-1 px-2 space-y-1">
                <button class="w-full text-left px-3 py-2 rounded bg-primary/10 text-primary border border-primary/20 flex justify-between items-center">
                    <span class="text-sm font-medium">All Servers</span>
                    <span class="bg-primary text-white text-[10px] px-1.5 rounded-full">${allGameServers.length}</span>
                </button>
                ${unifiedList.map(item => {
                    const { agentInfo, gameServers } = item;
                    const isOffline = agentInfo.status === 'Disconnected';
                    return `
                    <button class="w-full text-left px-3 py-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex justify-between items-center group" data-action="filter-by-agent" data-agent-id="${agentInfo.id}">
                        <div class="flex items-center gap-2 truncate">
                            <div class="w-2 h-2 rounded-full ${!isOffline ? 'bg-green-500' : 'bg-red-500'}"></div>
                            <span class="text-sm truncate">${agentInfo.config.alias}</span>
                        </div>
                        <span class="text-[10px] text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400">${gameServers.length}</span>
                    </button>
                `}).join('')}
            </div>
            <div class="p-4 border-t border-gray-200 dark:border-gray-800">
                <button class="w-full py-2 border border-gray-300 dark:border-gray-700 rounded text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800" data-action="manage-agents">Manage Agents</button>
            </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">All Servers</h2>
                <button class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 shadow-lg shadow-primary/30 transition-colors" data-action="add-server">
                    <i data-lucide="plus" class="w-4 h-4"></i> Create
                </button>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                ${allGameServers.map(server => {
                    const statusInfo = getStatusClasses(server.status);
                    return `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-all relative overflow-hidden group shadow-sm cursor-pointer" data-action="view-server-detail" data-server-id="${server.server_id}">
                        <div class="absolute top-0 left-0 w-1 h-full ${server.status === 'running' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                        <div class="flex justify-between items-start mb-3 pl-2">
                            <div>
                                <div class="font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors">${server.server_name}</div>
                                <div class="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                    <i data-lucide="server" class="w-3 h-3"></i> ${server.agentName}
                                </div>
                            </div>
                            <span class="px-1.5 py-0.5 rounded text-[10px] border ${statusInfo.bg} ${statusInfo.text}">${server.status}</span>
                        </div>
                        <div class="pl-2 grid grid-cols-2 gap-2 text-xs mt-4">
                            <div class="bg-gray-100 dark:bg-gray-900/50 p-2 rounded text-center">
                                <div class="text-gray-500 mb-0.5">Type</div>
                                <div class="font-medium text-gray-700 dark:text-gray-300">${server.server_type}</div>
                            </div>
                            <div class="bg-gray-100 dark:bg-gray-900/50 p-2 rounded text-center">
                                <div class="text-gray-500 mb-0.5">Players</div>
                                <div class="font-medium text-gray-700 dark:text-gray-300">${server.players ? `${server.players.online}/${server.players.max}` : '0/0'}</div>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
}