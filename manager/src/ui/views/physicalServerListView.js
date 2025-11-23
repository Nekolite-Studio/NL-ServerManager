// manager/src/ui/views/physicalServerListView.js
import { state } from '../../../renderer-state.js';
import { getAgentStatusClasses } from '../utils.js';

export const renderPhysicalServerList = (container) => {
    if (!container) return;
    
    // 空の状態のメッセージ要素を取得または作成
    let emptyMessage = container.querySelector('#no-agents-message');

    if (state.physicalServers.size === 0) {
        // エージェントがない場合
        // 既存のエージェント要素をすべて削除
        container.querySelectorAll('.physical-server-item').forEach(el => el.remove());

        if (!emptyMessage) {
            emptyMessage = document.createElement('p');
            emptyMessage.id = 'no-agents-message';
            emptyMessage.className = 'text-center text-gray-500 dark:text-gray-400 mt-10';
            emptyMessage.textContent = '利用可能なエージェントがありません。';
            container.appendChild(emptyMessage);
        }
        return;
    } else {
        // エージェントがある場合、メッセージがあれば削除
        if (emptyMessage) {
            emptyMessage.remove();
        }
    }

    // 既存要素のマップ化
    const existingElements = new Map();
    container.querySelectorAll('.physical-server-item').forEach(el => {
        existingElements.set(el.dataset.agentId, el);
    });

    // 削除されたエージェントの要素を削除
    const currentAgentIds = new Set(state.physicalServers.keys());
    existingElements.forEach((el, id) => {
        if (!currentAgentIds.has(id)) {
            el.remove();
        }
    });

    // 新規追加または更新
    state.physicalServers.forEach(pserv => {
        let el = existingElements.get(pserv.id);

        if (el) {
            updatePhysicalServerListItem(el, pserv);
        } else {
            el = createPhysicalServerListItem(pserv);
            container.appendChild(el);
        }
    });
};

const createPhysicalServerListItem = (pserv) => {
    const el = document.createElement('div');
    el.className = "physical-server-item bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center cursor-pointer hover:ring-2 hover:ring-primary transition-all";
    el.dataset.agentId = pserv.id;

    const statusClasses = getAgentStatusClasses(pserv.status);
    const metrics = pserv.metrics || {};
    const cpu = metrics.cpuUsage || '0.00';
    const ram = metrics.ramUsage || '0.00';

    el.innerHTML = `
        <div class="md:col-span-2">
            <div class="font-bold text-lg text-gray-900 dark:text-white" data-field="alias">${pserv.config.alias}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400 font-mono" data-field="address">${pserv.config.ip}:${pserv.config.port}</div>
        </div>
        <div>
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusClasses.bg} ${statusClasses.text}" data-field="status-badge">
                <span class="w-2 h-2 ${statusClasses.dot} rounded-full"></span>
                <span data-field="status-text">${pserv.status}</span>
            </span>
        </div>
        <div>
            <div class="text-sm text-gray-500 dark:text-gray-400">CPU</div>
            <div class="font-semibold" data-field="cpu">${cpu}%</div>
        </div>
        <div>
            <div class="text-sm text-gray-500 dark:text-gray-400">RAM</div>
            <div class="font-semibold" data-field="ram">${ram}%</div>
        </div>
     `;
    return el;
};

const updatePhysicalServerListItem = (el, pserv) => {
    const statusClasses = getAgentStatusClasses(pserv.status);
    const metrics = pserv.metrics || {};
    const cpu = metrics.cpuUsage || '0.00';
    const ram = metrics.ramUsage || '0.00';

    // Alias & Address
    const aliasEl = el.querySelector('[data-field="alias"]');
    if (aliasEl) aliasEl.textContent = pserv.config.alias;
    const addressEl = el.querySelector('[data-field="address"]');
    if (addressEl) addressEl.textContent = `${pserv.config.ip}:${pserv.config.port}`;

    // Status
    const statusBadge = el.querySelector('[data-field="status-badge"]');
    if (statusBadge) {
        statusBadge.className = `inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusClasses.bg} ${statusClasses.text}`;
        statusBadge.innerHTML = `<span class="w-2 h-2 ${statusClasses.dot} rounded-full"></span><span data-field="status-text">${pserv.status}</span>`;
    }

    // Metrics
    const cpuEl = el.querySelector('[data-field="cpu"]');
    if (cpuEl) cpuEl.textContent = `${cpu}%`;
    const ramEl = el.querySelector('[data-field="ram"]');
    if (ramEl) ramEl.textContent = `${ram}%`;
};