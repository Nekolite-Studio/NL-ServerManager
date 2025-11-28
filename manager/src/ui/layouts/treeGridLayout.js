// manager/src/ui/layouts/treeGridLayout.js
import { getters } from '../../../renderer-state.js';
import { getStatusClasses } from '../utils.js';

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

export function renderTreeGridLayout(container) {
    const unifiedList = getters.getUnifiedServerList();

    const html = `
        <div class="w-full h-full p-6 overflow-y-auto">
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm min-w-[800px]">
                <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th class="px-4 py-3 w-64">Name / Host</th>
                            <th class="px-4 py-3 w-32">Type</th>
                            <th class="px-4 py-3 w-32">Status</th>
                            <th class="px-4 py-3 w-48">Metrics / Players</th>
                            <th class="px-4 py-3 w-32">Version</th>
                            <th class="px-4 py-3 w-24 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700/50">
                        ${unifiedList.map(item => {
                            const { agentInfo, gameServers } = item;
                            const isOffline = agentInfo.status === 'Disconnected';
                            const metrics = agentInfo.metrics || { cpu: 0, ram: 0 };
                            const agentStatusClasses = isOffline 
                                ? 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-400/10'
                                : 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-400/10';
                            const agentStatusDot = isOffline ? 'bg-red-500' : 'bg-green-500';

                            return `
                            <tr class="bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-800/80 transition-colors cursor-pointer">
                                <td class="px-4 py-3 font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    <i data-lucide="chevron-down" class="w-4 h-4 text-gray-500"></i>
                                    <i data-lucide="server" class="w-4 h-4 text-primary"></i>
                                    ${agentInfo.config.alias}
                                </td>
                                <td class="px-4 py-3 text-gray-500 text-xs">${agentInfo.config.ip}</td>
                                <td class="px-4 py-3">
                                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${agentStatusClasses}">
                                        <span class="w-1.5 h-1.5 rounded-full ${agentStatusDot}"></span>
                                        ${agentInfo.status}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-xs text-gray-500 font-mono">
                                    CPU: ${metrics.cpu}% / RAM: ${metrics.ram}%
                                </td>
                                <td class="px-4 py-3 text-gray-500">-</td>
                                <td class="px-4 py-3 text-right">
                                    <button class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors" data-action="manage-agent" data-agent-id="${agentInfo.id}"><i data-lucide="settings" class="w-4 h-4"></i></button>
                                </td>
                            </tr>
                            
                            ${gameServers.map(server => {
                                const statusInfo = getStatusClasses(server.status);
                                return `
                                <tr class="bg-white dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer">
                                    <td class="px-4 py-2 pl-12 text-gray-700 dark:text-gray-300 flex items-center gap-2 border-l-2 border-gray-200 dark:border-gray-800">
                                        <div class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"></div>
                                        ${server.server_name}
                                    </td>
                                    <td class="px-4 py-2">${getTypeBadge(server.server_type)}</td>
                                    <td class="px-4 py-2">
                                         <span class="px-1.5 py-0.5 rounded text-[10px] border ${statusInfo.bg} ${statusInfo.text}">${server.status}</span>
                                    </td>
                                    <td class="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                                        <i data-lucide="users" class="w-3 h-3 inline"></i> ${server.players ? `${server.players.online}/${server.players.max}` : '0/0'}
                                        <span class="ml-2 text-gray-400 dark:text-gray-600">|</span> TPS: ${server.tps || '0.0'}
                                    </td>
                                    <td class="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">${server.versionId}</td>
                                    <td class="px-4 py-2 text-right flex justify-end gap-2">
                                        <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-green-600 dark:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-action="start-server" data-server-id="${server.server_id}"><i data-lucide="play" class="w-3 h-3"></i></button>
                                                                                <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 transition-colors" data-action="view-server-detail" data-server-id="${server.server_id}"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
                                    </td>
                                </tr>
                            `}).join('')}
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}