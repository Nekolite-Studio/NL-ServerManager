// manager/src/ui/layouts/kanbanLayout.js
import { getters } from '../../../renderer-state.js';

const getTypeBadge = (type) => {
    const styles = {
        'vanilla': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/30',
        'forge': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/30',
        'paper': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/30',
        'fabric': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/30',
        'quilt': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/30',
        'neoforge': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700/30',
        'mohist': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-700/30',
    };
    return `<span class="px-1.5 py-0.5 rounded text-[10px] border ${styles[type] || 'bg-gray-100 dark:bg-gray-700'}">${type}</span>`;
};

export function renderKanbanLayout(container) {
    const unifiedList = getters.getUnifiedServerList();

    const html = `
        <div class="flex-1 overflow-x-auto overflow-y-hidden p-6">
            <div class="flex gap-6 h-full min-w-max">
                ${unifiedList.map(item => {
                    const { agentInfo, gameServers } = item;
                    const isOffline = agentInfo.status === 'Disconnected';
                    const metrics = agentInfo.metrics || { cpu: 0, ram: 0, disk: 0 };
                    return `
                    <div class="w-80 flex flex-col bg-white dark:bg-gray-850 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg flex-shrink-0">
                        <div class="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 rounded-t-xl flex-shrink-0">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-bold text-gray-800 dark:text-gray-200 truncate">${agentInfo.config.alias}</h3>
                                <div class="w-2 h-2 rounded-full ${!isOffline ? 'bg-green-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500'}"></div>
                            </div>
                            <div class="text-xs text-gray-500 font-mono mb-3">${agentInfo.config.ip}</div>
                            ${!isOffline ? `
                                <div class="grid grid-cols-3 gap-1">
                                    <div class="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div style="width: ${metrics.cpu}%" class="h-full bg-blue-500"></div></div>
                                    <div class="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div style="width: ${metrics.ram}%" class="h-full bg-yellow-500"></div></div>
                                    <div class="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div style="width: ${metrics.disk || 0}%" class="h-full bg-gray-500"></div></div>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-100/50 dark:bg-gray-900/30">
                            ${gameServers.map(server => `
                                <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-lg cursor-pointer group transition-all relative overflow-hidden" data-action="view-server-detail" data-server-id="${server.server_id}">
                                    <div class="absolute left-0 top-0 bottom-0 w-1 ${server.status === 'running' ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}"></div>
                                    <div class="flex justify-between items-start mb-2 pl-2">
                                        <div class="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">${server.server_name}</div>
                                        <div class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                                                                                    <i data-lucide="more-horizontal" class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white"></i>
                                                                                </div>
                                    </div>
                                    <div class="pl-2 flex items-center justify-between">
                                        <div class="flex gap-1">
                                            ${getTypeBadge(server.server_type)}
                                        </div>
                                        <div class="text-xs text-gray-500 font-mono">${server.players ? `${server.players.online}/${server.players.max}` : '0/0'}</div>
                                    </div>
                                </div>
                            `).join('')}
                            ${!isOffline ? `
                                <button class="w-full py-3 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors" data-action="add-server" data-agent-id="${agentInfo.id}">
                                    + Add Server
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `}).join('')}
                
                <div class="w-80 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 hover:border-gray-400 dark:hover:border-gray-700 cursor-pointer transition-colors" data-action="add-agent">
                    <div class="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-2">
                        <i data-lucide="plus" class="w-6 h-6 text-gray-400 dark:text-gray-500"></i>
                    </div>
                    <span class="text-sm font-bold text-gray-500">Connect New Agent</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}