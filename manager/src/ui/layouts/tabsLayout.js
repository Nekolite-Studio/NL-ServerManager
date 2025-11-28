// manager/src/ui/layouts/tabsLayout.js
import { getters } from '../../../renderer-state.js';
import { getStatusClasses } from '../utils.js';

export function renderTabsLayout(container, activeAgentId) {
    const unifiedList = getters.getUnifiedServerList();
    if (unifiedList.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-gray-500">No agents connected.</div>`;
        return;
    }

    const targetAgentId = activeAgentId || unifiedList[0].agentInfo.id;
    const activeItem = unifiedList.find(item => item.agentInfo.id === targetAgentId);
    if (!activeItem) {
        console.error("Active agent not found for tabs layout");
        return;
    }
    const { agentInfo, gameServers } = activeItem;
    const isOffline = agentInfo.status === 'Disconnected';
    const metrics = agentInfo.metrics || { cpu: 0, ram: 0, disk: 0 };


    const html = `
        <div class="w-full h-full flex flex-col">
            <!-- Tabs Header -->
            <div class="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 pt-4 flex items-end gap-1 overflow-x-auto">
                ${unifiedList.map(item => {
                    const agent = item.agentInfo;
                    const isActive = agent.id === targetAgentId;
                    return `
                    <button class="px-4 py-3 rounded-t-lg border-t border-l border-r relative group min-w-[160px] text-left transition-colors ${isActive ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 z-10' : 'bg-gray-100 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900/50'}" style="${isActive ? 'border-bottom-color: transparent' : ''}" data-action="switch-tab" data-agent-id="${agent.id}">
                        <div class="flex items-center gap-2 mb-1">
                            <div class="w-2 h-2 rounded-full ${agent.status !== 'Disconnected' ? 'bg-green-500' : 'bg-red-500'}"></div>
                            <span class="font-bold text-sm truncate ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'}">${agent.config.alias}</span>
                        </div>
                        <div class="text-[10px] opacity-70 font-mono truncate ${isActive ? 'text-gray-600 dark:text-gray-400' : ''}">${agent.config.ip}</div>
                        ${isActive ? '<div class="absolute bottom-[-1px] left-0 w-full h-1 bg-gray-50 dark:bg-gray-900"></div>' : ''}
                    </button>
                `}).join('')}
                <button class="px-3 py-3 mb-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors" data-action="add-agent"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div>

            <!-- Active Tab Content -->
            <div class="flex-1 bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto">
                <!-- Agent Summary -->
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 flex flex-wrap gap-6 items-center shadow-sm">
                    <div class="flex-1 min-w-[200px]">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">${agentInfo.config.alias}</h2>
                        <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span class="flex items-center gap-1"><i data-lucide="globe" class="w-3 h-3"></i> ${agentInfo.config.ip}</span>
                            <span class="flex items-center gap-1 ${!isOffline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}"><i data-lucide="check-circle" class="w-3 h-3"></i> ${agentInfo.status}</span>
                        </div>
                    </div>
                    <div class="flex gap-8 px-6 border-l border-gray-200 dark:border-gray-700">
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">CPU</div>
                            <div class="text-xl font-mono font-bold text-gray-800 dark:text-white">${metrics.cpu}%</div>
                        </div>
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">RAM</div>
                            <div class="text-xl font-mono font-bold text-yellow-600 dark:text-yellow-400">${metrics.ram}%</div>
                        </div>
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">Disk</div>
                            <div class="text-xl font-mono font-bold text-gray-800 dark:text-white">${metrics.disk || 0}%</div>
                        </div>
                    </div>
                    <div class="ml-auto">
                        <button class="bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-3 py-2 rounded text-sm border border-gray-300 dark:border-gray-600 transition-colors" data-action="manage-agent" data-agent-id="${agentInfo.id}">Settings</button>
                    </div>
                </div>

                <!-- Server List -->
                <div class="space-y-3">
                    <div class="flex justify-between items-end mb-2">
                        <h3 class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Managed Servers</h3>
                        <button class="text-primary text-sm font-medium hover:text-primary-light hover:underline" data-action="add-server" data-agent-id="${agentInfo.id}">+ New Server</button>
                    </div>
                    ${gameServers.map(server => {
                        const statusInfo = getStatusClasses(server.status);
                        const serverIcon = server.server_type === 'vanilla' ? '🧊' : (server.server_type === 'forge' ? '⚒️' : '📄');
                        return `
                        <div class="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-4 transition-colors group cursor-pointer" data-action="view-server-detail" data-server-id="${server.server_id}">
                            <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-2xl">
                                ${serverIcon}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-gray-900 dark:text-white text-lg truncate">${server.server_name}</h4>
                                    <span class="px-1.5 py-0.5 rounded text-[10px] border ${statusInfo.bg} ${statusInfo.text}">${server.status}</span>
                                </div>
                                <div class="text-xs text-gray-500 mt-1 flex gap-3">
                                    <span>${server.server_type} ${server.versionId}</span>
                                    <span>•</span>
                                    <span>Port: ${server.properties ? server.properties['server-port'] : 'N/A'}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 text-right">
                                <div>
                                    <div class="text-xs text-gray-500">Players</div>
                                    <div class="font-bold text-gray-700 dark:text-gray-300">${server.players ? server.players.online : 0} <span class="text-gray-400 dark:text-gray-600">/</span> ${server.players ? server.players.max : 0}</div>
                                </div>
                                <div class="w-px h-8 bg-gray-200 dark:border-gray-700 mx-2"></div>
                                <div class="flex gap-2">
                                    <button class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-green-100 dark:hover:bg-green-600 text-gray-600 dark:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-action="start-server" data-server-id="${server.server_id}"><i data-lucide="play" class="w-4 h-4"></i></button>
                                    <button class="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-white rounded transition-colors" data-action="more-options" data-server-id="${server.server_id}"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}