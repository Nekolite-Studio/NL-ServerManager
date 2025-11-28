// manager/src/ui/layouts/accordionLayout.js
import { getters } from '../../../renderer-state.js';
import { getStatusClasses } from '../utils.js';

// モックアップにあった getTypeBadge を移植・調整
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


export function renderAccordionLayout(container) {
    const unifiedList = getters.getUnifiedServerList();

    const html = `
        <div id="accordion-layout" class="w-full h-full overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto">
            ${unifiedList.map(item => {
                const { agentInfo, gameServers } = item;
                const agentStatus = agentInfo.status;
                const agentMetrics = agentInfo.metrics || { cpuUsage: 0, ramUsage: 0 };
                const isOffline = agentStatus === 'Disconnected';

                return `
                <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm" data-agent-container-id="${agentInfo.id}">
                    <div class="px-4 py-3 bg-gray-50 dark:bg-gray-850 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-200 dark:border-gray-700 group" data-action="toggle-agent-details" data-agent-id="${agentInfo.id}">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-400 group-hover:text-primary group-hover:border-primary/30">
                                <i data-lucide="${isOffline ? 'wifi-off' : 'server'}" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    ${agentInfo?.config?.alias || 'Unknown Agent'}
                                    ${isOffline ? `<span class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 rounded">Offline</span>` : ''}
                                </div>
                                <div class="text-xs text-gray-500 font-mono">${agentInfo?.config?.ip || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-6">
                            ${!isOffline ? `
                                <div class="hidden sm:flex gap-4 text-xs text-gray-500 dark:text-gray-400" data-agent-metrics-id="${agentInfo.id}">
                                    <div class="flex items-center gap-1"><i data-lucide="cpu" class="w-3 h-3"></i> ${agentMetrics.cpuUsage || 0}%</div>
                                    <div class="flex items-center gap-1"><i data-lucide="memory-stick" class="w-3 h-3"></i> ${agentMetrics.ramUsage || 0}%</div>
                                </div>
                            ` : ''}
                            <i data-lucide="chevron-down" class="w-5 h-5 text-gray-400"></i>
                        </div>
                    </div>
                    
                    <div class="bg-white dark:bg-gray-900/50">
                        ${gameServers.length > 0 ? gameServers.map(server => {
                            const statusInfo = getStatusClasses(server.status);
                            const tpsColor = server.tps >= 19 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400';
                            return `
                            <div class="server-item px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors" data-server-id="${server.server_id}">
                                <div class="flex items-center gap-4 min-w-0 cursor-pointer" data-action="view-server-detail" data-server-id="${server.server_id}">
                                    <div class="status-indicator w-1.5 h-10 rounded-full ${server.status === 'running' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                                    <div class="min-w-0">
                                        <div class="server-name font-medium text-gray-800 dark:text-gray-200 truncate">${server.server_name}</div>
                                        <div class="flex items-center gap-2 mt-0.5">
                                            ${getTypeBadge(server.server_type)}
                                            <span class="text-xs text-gray-500">${server.versionId}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-6 flex-shrink-0">
                                    <div class="server-metrics text-right hidden sm:block">
                                        <div class="text-xs text-gray-500 dark:text-gray-400"><i data-lucide="users" class="w-3 h-3 inline mr-1"></i><span class="players-count">${server.players ? `${server.players.online}/${server.players.max}` : '0/0'}</span></div>
                                        <div class="tps-value text-xs ${tpsColor} font-mono">TPS: ${server.tps ? server.tps.toFixed(1) : '0.0'}</div>
                                    </div>
                                    <button class="p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-primary hover:text-white text-gray-400 border border-gray-200 dark:border-gray-700 transition-colors" data-action="view-server-detail" data-server-id="${server.server_id}">
                                        <i data-lucide="settings-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                        `}).join('') : `
                            <div class="px-4 py-6 text-center text-sm text-gray-500">
                                No servers configured
                            </div>
                        `}
                        ${!isOffline ? `
                            <div class="px-4 py-2 bg-gray-50 dark:bg-gray-850/50 border-t border-gray-100 dark:border-gray-800/50">
                                <button class="w-full py-2 border border-dashed border-gray-300 dark:border-gray-700 rounded text-xs text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2" data-action="add-server" data-agent-id="${agentInfo.id}">
                                    <i data-lucide="plus" class="w-3 h-3"></i> Create New Server
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;

    container.innerHTML = html;
}

export function updateAccordionServer(serverId, serverData) {
    const serverEl = document.querySelector(`.server-item[data-server-id="${serverId}"]`);
    if (!serverEl) return;

    // Status Indicator
    const indicator = serverEl.querySelector('.status-indicator');
    if (indicator) {
        indicator.className = `status-indicator w-1.5 h-10 rounded-full ${serverData.status === 'running' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`;
    }

    // Players
    const playersEl = serverEl.querySelector('.players-count');
    if (playersEl) {
        playersEl.textContent = serverData.players ? `${serverData.players.online}/${serverData.players.max}` : '0/0';
    }

    // TPS
    const tpsEl = serverEl.querySelector('.tps-value');
    if (tpsEl) {
        const tpsColor = serverData.tps >= 19 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400';
        tpsEl.className = `tps-value text-xs ${tpsColor} font-mono`;
        tpsEl.textContent = `TPS: ${serverData.tps ? serverData.tps.toFixed(1) : '0.0'}`;
    }
}

export function updateAccordionAgent(agentId, agentData) {
    const agentMetricsEl = document.querySelector(`[data-agent-metrics-id="${agentId}"]`);
    if (!agentMetricsEl) return;

    const metrics = agentData.metrics || { cpuUsage: 0, ramUsage: 0 };
    agentMetricsEl.innerHTML = `
        <div class="flex items-center gap-1"><i data-lucide="cpu" class="w-3 h-3"></i> ${metrics.cpuUsage || 0}%</div>
        <div class="flex items-center gap-1"><i data-lucide="memory-stick" class="w-3 h-3"></i> ${metrics.ramUsage || 0}%</div>
    `;
    lucide.createIcons();
}