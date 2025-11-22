// manager/src/ui/views/physicalServerListView.js
import { state } from '../../../renderer-state.js';
import { getAgentStatusClasses } from '../utils.js';

export const renderPhysicalServerList = (container) => {
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