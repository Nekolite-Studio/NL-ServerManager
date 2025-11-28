// manager/src/ui/views/physicalServerDetailView.js
import { state, getters } from '../../../renderer-state.js';
import { getAgentStatusClasses, getCpuColor, getMemoryColor } from '../utils.js';

export const renderPhysicalServerDetail = (container) => {
    const agent = getters.selectedPhysicalServer();
    if (!agent || !container) return;

    // Partial Update Check
    const currentAgentId = container.dataset.agentId;
    if (currentAgentId === agent.id) {
        updatePhysicalServerDetailValues(container, agent);
        updatePhysicalServerDetailContent();
        return;
    }

    // Full Render
    container.dataset.agentId = agent.id;

    container.innerHTML = `
    <div class="p-6 h-full flex flex-col overflow-y-auto custom-scrollbar w-full max-w-7xl mx-auto">
        <!-- Header -->
        <div>
            <button data-action="back-to-list" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 mb-4 inline-flex items-center gap-2 transition-colors">
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
        <div class="border-b border-gray-200 dark:border-gray-700">
            <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                <button data-action="switch-physical-detail-tab" data-tab="status" class="physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${state.physicalServerDetailActiveTab === 'status' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
                    ステータス
                </button>
                <button data-action="switch-physical-detail-tab" data-tab="settings" class="physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${state.physicalServerDetailActiveTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
                    設定
                </button>
                <button data-action="switch-physical-detail-tab" data-tab="logs" class="physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${state.physicalServerDetailActiveTab === 'logs' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
                    システムログ
                </button>
            </nav>
        </div>

        <div id="physical-detail-content" class="mt-6">
        </div>
    </div>
    `;
    updatePhysicalServerDetailContent();
};

const updatePhysicalServerDetailValues = (container, agent) => {
    // タブのアクティブ状態更新
    const tabBtns = container.querySelectorAll('.physical-detail-tab-btn');
    tabBtns.forEach(btn => {
        const tab = btn.dataset.tab;
        if (tab === state.physicalServerDetailActiveTab) {
            btn.className = 'physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-primary text-primary';
        } else {
            btn.className = 'physical-detail-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
        }
    });
};

export const updatePhysicalServerDetailContent = () => {
    const container = document.getElementById('physical-detail-content');
    const agent = getters.selectedPhysicalServer();
    if (!container || !agent) return;

    const metrics = agent.metrics || {};
    const systemInfo = agent.systemInfo || {};
    const gameServers = metrics.gameServers || {};

    // タブ切り替えチェック
    const currentTab = container.dataset.activeTab;
    if (currentTab !== state.physicalServerDetailActiveTab || !container.hasChildNodes()) {
        container.dataset.activeTab = state.physicalServerDetailActiveTab;
        renderPhysicalTabContent(container, agent, metrics, systemInfo, gameServers);
    } else {
        updatePhysicalTabContent(container, agent, metrics, systemInfo, gameServers);
    }
};

const renderPhysicalTabContent = (container, agent, metrics, systemInfo, gameServers) => {
    switch (state.physicalServerDetailActiveTab) {
        case 'status':
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">接続状態</div>
                        <div id="p-detail-status" class="text-2xl font-bold ${getAgentStatusClasses(agent.status).text} mt-1">${agent.status}</div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">CPU 使用率</div>
                        <div id="p-detail-cpu" class="text-4xl font-extrabold ${getCpuColor(parseFloat(metrics.cpuUsage) || 0)} mt-1">${metrics.cpuUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">RAM 使用率</div>
                        <div id="p-detail-ram" class="text-4xl font-extrabold ${getMemoryColor(parseFloat(metrics.ramUsage) || 0, 100)} mt-1">${metrics.ramUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                     <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Disk 使用率</div>
                        <div id="p-detail-disk" class="text-4xl font-extrabold ${getMemoryColor(parseFloat(metrics.diskUsage) || 0, 100)} mt-1">${metrics.diskUsage || 'N/A'}<span class="text-lg">%</span></div>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    <div class="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 class="text-lg font-semibold mb-4">システム情報</h3>
                        <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                            <dt class="text-sm font-meFium text-gray-500 dark:text-gray-400">OS</dt><dd id="p-detail-os" class="font-mono">${systemInfo.os || 'N/A'}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">CPU</dt><dd id="p-detail-cpu-model" class="font-mono">${systemInfo.cpu || 'N/A'}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Total RAM</dt><dd id="p-detail-total-ram" class="font-mono">${systemInfo.totalRam || 'N/A'}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Network</dt><dd id="p-detail-network" class="font-mono">${metrics.networkSpeed || 'N/A'} Mbps</dd>
                        </dl>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <h3 class="text-lg font-semibold mb-4">ゲームサーバー</h3>
                        <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">実行中</dt><dd id="p-detail-running" class="font-bold text-green-500">${gameServers.running || 0}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">停止中</dt><dd id="p-detail-stopped" class="font-bold text-red-500">${gameServers.stopped || 0}</dd>
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">合計プレイヤー</dt><dd id="p-detail-players" class="font-bold">${gameServers.totalPlayers || 0}</dd>
                        </dl>
                    </div>
                </div>

                <!-- Game Server Process List -->
                <div class="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 class="text-lg font-semibold">実行中のゲームサーバープロセス</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">サーバー名</th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CPU使用率</th>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">メモリ使用量</th>
                                </tr>
                            </thead>
                            <tbody id="p-detail-server-list" class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                <!-- Populated by JS -->
                            </tbody>
                        </table>
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
                        <pre id="physical-log-output">${(agent.logs || ['No logs yet.']).join('\n')}</pre>
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

const updatePhysicalTabContent = (container, agent, metrics, systemInfo, gameServers) => {
    switch (state.physicalServerDetailActiveTab) {
        case 'status':
            const statusEl = container.querySelector('#p-detail-status');
            if (statusEl) {
                statusEl.className = `text-2xl font-bold ${getAgentStatusClasses(agent.status).text} mt-1`;
                statusEl.textContent = agent.status;
            }
            const cpuEl = container.querySelector('#p-detail-cpu');
            if (cpuEl) {
                cpuEl.className = `text-4xl font-extrabold ${getCpuColor(parseFloat(metrics.cpuUsage) || 0)} mt-1`;
                cpuEl.innerHTML = `${metrics.cpuUsage || 'N/A'}<span class="text-lg">%</span>`;
            }
            const ramEl = container.querySelector('#p-detail-ram');
            if (ramEl) {
                ramEl.className = `text-4xl font-extrabold ${getMemoryColor(parseFloat(metrics.ramUsage) || 0, 100)} mt-1`;
                ramEl.innerHTML = `${metrics.ramUsage || 'N/A'}<span class="text-lg">%</span>`;
            }
            const diskEl = container.querySelector('#p-detail-disk');
            if (diskEl) {
                diskEl.className = `text-4xl font-extrabold ${getMemoryColor(parseFloat(metrics.diskUsage) || 0, 100)} mt-1`;
                diskEl.innerHTML = `${metrics.diskUsage || 'N/A'}<span class="text-lg">%</span>`;
            }
            
            // System Info
            const osEl = container.querySelector('#p-detail-os');
            if (osEl) osEl.textContent = systemInfo.os || 'N/A';
            const cpuModelEl = container.querySelector('#p-detail-cpu-model');
            if (cpuModelEl) cpuModelEl.textContent = systemInfo.cpu || 'N/A';
            const totalRamEl = container.querySelector('#p-detail-total-ram');
            if (totalRamEl) totalRamEl.textContent = systemInfo.totalRam || 'N/A';
            const networkEl = container.querySelector('#p-detail-network');
            if (networkEl) networkEl.textContent = `${metrics.networkSpeed || 'N/A'} Mbps`;

            // Game Servers
            const runningEl = container.querySelector('#p-detail-running');
            if (runningEl) runningEl.textContent = gameServers.running || 0;
            const stoppedEl = container.querySelector('#p-detail-stopped');
            if (stoppedEl) stoppedEl.textContent = gameServers.stopped || 0;
            const playersEl = container.querySelector('#p-detail-players');
            if (playersEl) playersEl.textContent = gameServers.totalPlayers || 0;

            // Game Server List
            const serverListEl = container.querySelector('#p-detail-server-list');
            if (serverListEl) {
                const details = gameServers.details || [];
                if (details.length === 0) {
                    serverListEl.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">実行中のサーバーはありません</td></tr>';
                } else {
                    serverListEl.innerHTML = details.map(d => {
                        // サーバー名を取得するためにstateから検索
                        // physicalServerDetailView.jsはagentオブジェクトを持っているので、そこからサーバーリストを引くのは難しい
                        // 代わりにgetters.allServers()から検索する
                        const server = getters.allServers().find(s => s.server_id === d.serverId);
                        const serverName = server ? server.server_name : d.serverId;
                        
                        return `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${serverName}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${d.cpu}%</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${d.mem} MB</td>
                            </tr>
                        `;
                    }).join('');
                }
            }
            break;

        case 'logs':
            const logOutputEl = container.querySelector('#physical-log-output');
            if (logOutputEl) {
                const parent = logOutputEl.parentElement;
                const isScrolledToBottom = parent.scrollHeight - parent.scrollTop <= parent.clientHeight + 50;
                
                logOutputEl.textContent = (agent.logs || ['No logs yet.']).join('\n');
                
                if (isScrolledToBottom) {
                    parent.scrollTop = parent.scrollHeight;
                }
            }
            break;
    }
};