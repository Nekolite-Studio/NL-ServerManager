// manager/src/ui/views/serverDetailView.js
import { state, getters } from '../../../renderer-state.js';
import { getStatusClasses, getTpsColor, getCpuColor, getMemoryColor } from '../utils.js';
import { renderPropertiesEditor } from '../components/propertiesEditor.js';

export const renderServerDetail = (container) => {
    const server = getters.selectedServer();
    if (!server || !container) return;

    // 既に同じサーバーが表示されている場合は、値のみ更新する (Partial Update)
    const currentServerId = container.dataset.serverId;
    if (currentServerId === server.server_id) {
        updateServerDetailValues(container, server);
        updateDetailViewContent(server); // コンテンツエリアの更新 (タブごとの制御は内部で行う)
        return;
    }

    // 初回描画 (Full Render)
    container.dataset.serverId = server.server_id;
    
    const host = state.physicalServers.get(server.hostId);
    const isBeingDeleted = state.serversBeingDeleted.has(server.server_id);
    const statusClasses = getStatusClasses(server.status);
    const tpsColor = getTpsColor(server.tps || 0);
    const cpuColor = getCpuColor(server.cpu || 0);
    const memColor = getMemoryColor(server.memory || 0, server.memoryMax || 1);

    const memo = server.memo || '';
    const memoLines = memo.split('\n');
    const previewMemo = memoLines[0] || 'メモなし'; // 1行目だけ表示

    container.innerHTML = `
    <div class="p-6 h-full flex flex-col overflow-y-auto custom-scrollbar w-full max-w-7xl mx-auto">
        <!-- ヘッダー -->
        <div class="flex flex-col gap-4">
            <button data-action="back-to-list" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 mb-2 inline-flex items-center gap-2 self-start transition-colors">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                サーバー一覧に戻る
            </button>
            
            <!-- 上段: サーバー名と操作ボタン -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex-grow min-w-0">
                    <div contenteditable="true" data-field="server_name" class="text-3xl font-bold editable truncate outline-none border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:ring-2 focus:ring-primary rounded px-1 -ml-1 transition-colors" placeholder="サーバー名を入力">${server.server_name}</div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                    <button data-action="open-dir" class="w-1/2 sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 flex-grow disabled:opacity-50 disabled:cursor-not-allowed" ${isBeingDeleted ? 'disabled' : ''}>フォルダ</button>
                    <button id="detail-status-btn" data-action="toggle-status" class="w-1/2 sm:w-auto font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 flex-grow ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}" ${isBeingDeleted || server.status === 'starting' || server.status === 'stopping' ? 'disabled' : ''}>
                        ${server.status === 'running' ? '停止' : (server.status === 'starting' ? '起動中...' : (server.status === 'stopping' ? '停止中...' : '起動'))}
                    </button>
                </div>
            </div>

            <!-- 下段: ホスト情報とメモ -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                <div class="text-sm text-gray-500 dark:text-gray-400 truncate flex-shrink-0">
                    ホスト: <span class="font-medium text-gray-700 dark:text-gray-300">${host ? host.config.alias : '未割り当て'}</span> (${host ? host.config.ip : 'N/A'})
                </div>

                <!-- メモ UI コンポーネント -->
                <div id="memo-dropdown-container" class="relative flex-grow min-w-0 flex justify-end sm:justify-start">
                    
                    <!-- 1. 格納状態のプレビュー & トグルボタン -->
                    <div class="flex items-center gap-2 w-full max-w-md bg-gray-100 dark:bg-gray-900/50 rounded-md px-3 py-1 border border-gray-200 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                        <i data-lucide="notebook-pen" class="w-4 h-4 text-gray-500 flex-shrink-0"></i>
                        
                        <p id="memo-preview" class="text-sm ${previewMemo === 'メモなし' ? 'text-gray-500 italic' : 'text-gray-700 dark:text-gray-300'} truncate cursor-pointer select-none flex-grow" title="${memo}">
                            ${previewMemo}
                        </p>
                        
                        <button data-action="toggle-memo-dropdown" id="memo-toggle-btn" class="flex-shrink-0 p-1 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-transform duration-200">
                            <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200"></i>
                        </button>
                    </div>

                    <!-- 2. 展開状態のコンテナ (編集エリア) -->
                    <div id="memo-dropdown-content" class="hidden absolute top-full mt-2 left-0 w-full sm:w-[30rem] z-20 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600"
                         style="min-height: 10rem; max-height: 50vh; overflow-y: auto;">
                        <div class="p-4 h-full flex flex-col">
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="text-gray-500 dark:text-gray-400 text-sm font-semibold">メモ</h3>
                                <span class="text-xs text-gray-400 dark:text-gray-500">フォーカスを外すと保存されます</span>
                            </div>
                            <!-- 編集エリア -->
                            <div id="memo-editor" data-field="memo" contenteditable="true" class="flex-1 text-gray-800 dark:text-gray-300 whitespace-pre-wrap outline-none min-h-[8rem] p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-700 focus:border-primary custom-scrollbar"
                                placeholder="メモを入力...">${memo}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">ステータス</div>
                <div id="detail-status-text" class="text-2xl font-bold ${statusClasses.text} mt-1">
                    ${{'running': '起動済み', 'starting': '起動中', 'stopping': '停止中', 'stopped': '停止済み'}[server.status] || '不明'}
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">プレイヤー</div>
                <div id="detail-players" class="text-4xl font-extrabold text-primary mt-1">${server.players?.current || 0} <span class="text-lg text-gray-500">/ ${server.players?.max || 20}</span></div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">TPS</div>
                <div id="detail-tps" class="text-4xl font-extrabold ${tpsColor} mt-1">${server.status === 'running' ? (server.tps || 0).toFixed(1) : '-'}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">CPU / メモリ</div>
                <div id="detail-cpu" class="text-2xl font-bold ${cpuColor} mt-1">${server.status === 'running' ? (server.cpu || 0).toFixed(1) : '0.0'}%</div>
                <div id="detail-memory" class="text-sm ${memColor} mt-1">${(server.memory / 1024).toFixed(1)} GB / ${(server.memoryMax / 1024).toFixed(1)} GB</div>
            </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-6 mt-6 flex-1 min-h-0">
            <div class="lg:w-75 lg:flex-shrink-0 space-y-6">
                <nav class="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2" aria-label="Tabs">
                    <button data-action="switch-detail-tab" data-tab="console" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${state.detailActiveTab === 'console' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>コンソールログ</button>
                                        <button data-action="switch-detail-tab" data-tab="launch-config" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${state.detailActiveTab === 'launch-config' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>起動構成</button>
                                        <button data-action="switch-detail-tab" data-tab="properties" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${state.detailActiveTab === 'properties' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>サーバー設定</button>
                                        <button data-action="switch-detail-tab" data-tab="mods" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${state.detailActiveTab === 'mods' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>Mod</button>
                                        <button data-action="switch-detail-tab" data-tab="plugins" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${state.detailActiveTab === 'plugins' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>Plugin</button>
                                        <button data-action="switch-detail-tab" data-tab="players" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${state.detailActiveTab === 'players' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>プレイヤー</button>
                                        <button data-action="switch-detail-tab" data-tab="danger" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${state.detailActiveTab === 'danger' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}" ${isBeingDeleted ? 'disabled' : ''}>その他</button>
                </nav>
            </div>
            <div class="flex-1 min-h-0">
                <div id="detail-main-area" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full">
                    <!-- 内容は updateDetailViewContent で動的に挿入 -->
                </div>
            </div>
        </div>
    </div>
    `;

    updateDetailViewContent(server);
};

// 部分更新用の関数
const updateServerDetailValues = (container, server) => {
    const isBeingDeleted = state.serversBeingDeleted.has(server.server_id);
    const statusClasses = getStatusClasses(server.status);
    const tpsColor = getTpsColor(server.tps || 0);
    const cpuColor = getCpuColor(server.cpu || 0);
    const memColor = getMemoryColor(server.memory || 0, server.memoryMax || 1);

    // ステータスボタン
    const statusBtn = container.querySelector('#detail-status-btn');
    if (statusBtn) {
        statusBtn.className = `w-1/2 sm:w-auto font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 flex-grow ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`;
        statusBtn.textContent = server.status === 'running' ? '停止' : (server.status === 'starting' ? '起動中...' : (server.status === 'stopping' ? '停止中...' : '起動'));
        statusBtn.disabled = isBeingDeleted || server.status === 'starting' || server.status === 'stopping';
    }

    // ステータステキスト
    const statusText = container.querySelector('#detail-status-text');
    if (statusText) {
        statusText.className = `text-2xl font-bold ${statusClasses.text} mt-1`;
        statusText.textContent = {'running': '起動済み', 'starting': '起動中', 'stopping': '停止中', 'stopped': '停止済み'}[server.status] || '不明';
    }

    // プレイヤー
    const players = container.querySelector('#detail-players');
    if (players) {
        players.innerHTML = `${server.players?.current || 0} <span class="text-lg text-gray-500">/ ${server.players?.max || 20}</span>`;
    }

    // TPS
    const tps = container.querySelector('#detail-tps');
    if (tps) {
        tps.className = `text-4xl font-extrabold ${tpsColor} mt-1`;
        tps.textContent = server.status === 'running' ? (server.tps || 0).toFixed(1) : '-';
    }

    // CPU
    const cpu = container.querySelector('#detail-cpu');
    if (cpu) {
        cpu.className = `text-2xl font-bold ${cpuColor} mt-1`;
        cpu.textContent = `${server.status === 'running' ? (server.cpu || 0).toFixed(1) : '0.0'}%`;
    }

    // Memory
    const memory = container.querySelector('#detail-memory');
    if (memory) {
        memory.className = `text-sm ${memColor} mt-1`;
        memory.textContent = `${(server.memory / 1024).toFixed(1)} GB / ${(server.memoryMax / 1024).toFixed(1)} GB`;
    }
    
    // タブボタンのアクティブ状態更新
    const tabBtns = container.querySelectorAll('.detail-tab-btn');
    tabBtns.forEach(btn => {
        const tab = btn.dataset.tab;
        if (tab === state.detailActiveTab) {
            btn.className = 'detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg bg-primary text-white';
        } else {
            btn.className = 'detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors';
        }
        btn.disabled = isBeingDeleted;
    });
};

export const updateDetailViewContent = (server) => {
    const mainArea = document.getElementById('detail-main-area');
    if (!mainArea) return;

    server = server || getters.selectedServer();
    if (!server) return;

    const isBeingDeleted = state.serversBeingDeleted.has(server.server_id);
    if(isBeingDeleted) {
        mainArea.innerHTML = '<div class="p-6 text-center text-gray-500">このサーバーは現在削除処理中です...</div>';
        return;
    }

    // 現在表示中のタブコンテンツを確認
    const currentTab = mainArea.dataset.activeTab;

    // タブが切り替わった場合、またはコンテンツが空の場合は再描画
    if (currentTab !== state.detailActiveTab || !mainArea.hasChildNodes()) {
        mainArea.dataset.activeTab = state.detailActiveTab;
        renderTabContent(mainArea, server);
    } else {
        // 同じタブを表示中の場合は、コンテンツ内の動的要素のみ更新
        // 修正: updateTabContentは古い関数。renderTabContentを呼ぶ
        renderTabContent(mainArea, server);
    }
};

const renderTabContent = (container, server) => {
    switch(state.detailActiveTab) {
        case 'console':
            container.innerHTML = `
                <div class="flex flex-col h-full">
                    <div class="bg-gray-50 dark:bg-black p-4 rounded-t-lg flex-1 overflow-y-auto custom-scrollbar">
                        <pre id="server-log-output" class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">${(server.logs || []).join('\n')}</pre>
                    </div>
                    <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                        <input type="text" id="command-input" placeholder="コマンドを入力..." class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary transition duration-150">
                        <button id="send-command-btn" class="bg-primary hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200">
                            実行
                        </button>
                    </div>
                </div>
            `;
            const logOutputEl = container.querySelector('#server-log-output');
            if(logOutputEl) logOutputEl.parentElement.scrollTop = logOutputEl.parentElement.scrollHeight;
            break;

        case 'launch-config':
            {
                const runtime = server.runtime || {};
                container.innerHTML = `
                    <div class="p-6 h-full flex flex-col">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold">起動構成</h2>
                            <button data-action="save-launch-config" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">構成を保存</button>
                        </div>
                        <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <div class="space-y-6">
                                <div>
                                    <label for="java-path" class="block text-sm font-medium text-gray-500 dark:text-gray-400">Java実行パス</label>
                                    <input type="text" id="java-path" value="${runtime.java_path || ''}" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Agentのデフォルト設定を使用">
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label for="min-memory" class="block text-sm font-medium text-gray-500 dark:text-gray-400">最小メモリ割り当て (MB)</label>
                                        <input type="number" id="min-memory" value="${runtime.min_memory || 1024}" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary">
                                    </div>
                                    <div>
                                        <label for="max-memory" class="block text-sm font-medium text-gray-500 dark:text-gray-400">最大メモリ割り当て (MB)</label>
                                        <input type="number" id="max-memory" value="${runtime.max_memory || 2048}" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary">
                                    </div>
                                </div>
                                <div>
                                    <label for="custom-args" class="block text-sm font-medium text-gray-500 dark:text-gray-400">カスタムJVM引数</label>
                                    <textarea id="custom-args" rows="3" class="mt-1 w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=50">${runtime.custom_args || ''}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            break;

        case 'properties':
            container.innerHTML = `
                <div class="p-6 h-full flex flex-col">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold">サーバー設定 (server.properties)</h2>
                        <button data-action="save-properties" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">変更を保存</button>
                    </div>
                    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <div class="text-center p-8 text-gray-500">読み込み中...</div>
                    </div>
                </div>
            `;
            renderPropertiesEditor(server).then(editorElement => {
                const editorContainer = container.querySelector('.custom-scrollbar');
                if (editorContainer) {
                    editorContainer.innerHTML = ''; // 読み込み中... をクリア
                    editorContainer.appendChild(editorElement);
                }
            });
            break;

        case 'mods':
        case 'plugins':
            container.innerHTML = `<div class="p-6"><h3 class="text-xl font-bold">${state.detailActiveTab === 'mods' ? 'Mod' : 'Plugin'}管理</h3><p class="mt-4 text-gray-500">（この機能は現在開発中です）</p></div>`;
            break;

        case 'players':
            container.innerHTML = `<div class="p-6"><h3 class="text-xl font-bold">プレイヤー管理</h3><p class="mt-4 text-gray-500">（この機能は現在開発中です）</p></div>`;
            break;
        
        case 'danger':
            container.innerHTML = `
                <div class="p-6">
                    <h3 class="text-xl font-bold text-red-500 dark:text-red-400">危険ゾーン</h3>
                    <div class="mt-6 bg-red-100 dark:bg-red-900/50 p-6 rounded-lg space-y-6">
                        <div>
                            <h4 class="font-bold text-gray-900 dark:text-red-200">サーバー再起動</h4>
                            <p class="text-sm text-red-700 dark:text-gray-400 mb-3">サーバーを安全に再起動します。</p>
                            <button data-action="restart-server" class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200">
                                サーバー再起動
                            </button>
                        </div>
                        <div class="border-t border-red-300 dark:border-red-500/30"></div>
                        <div>
                            <h4 class="font-bold text-gray-900 dark:text-red-200">サーバーの削除</h4>
                            <p class="text-sm text-red-700 dark:text-gray-400 mb-3">この操作は取り消せません。すべてのデータが削除されます。</p>
                            <button data-action="delete-server" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300" ${server.status === 'running' ? 'disabled' : ''}>
                                ${server.status === 'running' ? '停止してから削除してください' : 'このサーバーを削除する'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            break;
        default:
            container.innerHTML = `<p class="p-6 text-gray-500">不明なタブが選択されました: ${state.detailActiveTab}</p>`;
            break;
    }
};