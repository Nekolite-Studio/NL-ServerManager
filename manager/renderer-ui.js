// manager/renderer-ui.js
// UIの描画と更新を担当する関数群
// このファイルは renderer-state.js の後に読み込まれる必要があります。

// --- DOM要素 (グローバルアクセス用) ---
// メインの renderer.js の DOMContentLoaded 内で代入されます
let serverListView, physicalServerListView, serverDetailView, serverListContainer;
let navGameServers, navPhysicalServers;

// D&D状態管理
let draggedAddon = null; // {id, type}


// --- レンダリング関数 (v5で更新) ---
const renderServerList = () => {
    if (!serverListContainer) return;
    serverListContainer.innerHTML = '';
    state.servers.forEach(server => {
        const tpsColor = getTpsColor(server.tps);
        const host = physicalServers.find(p => p.id === server.hostId);
        const serverElement = document.createElement('div');
        serverElement.className = 'server-item-container bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-primary dark:hover:ring-primary';
        serverElement.dataset.serverId = server.id;
        serverElement.innerHTML = `
            <div class="grid md:grid-cols-[minmax(150px,_1.5fr)_minmax(130px,_1fr)_minmax(200px,_4fr)_minmax(120px,_1fr)_minmax(80px,_0.5fr)_minmax(60px,_0.5fr)] 2xl:grid-cols-[minmax(150px,_1.5fr)_minmax(130px,_1fr)_minmax(200px,_4fr)_minmax(180px,_1.5fr)_minmax(80px,_0.5fr)_minmax(60px,_0.5fr)_minmax(100px,_1fr)] gap-4 p-4 items-center">
                <!-- サーバー名 -->
                <div class="flex flex-col col-span-full md:col-span-1 overflow-hidden">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400">サーバー名</span>
                    <div contenteditable="true" data-field="name" class="font-bold text-lg text-gray-900 dark:text-white truncate editable" placeholder="サーバー名を入力">${server.name}</div>
                </div>
                <!-- ホストマシン -->
                <div class="col-span-full md:col-span-1 overflow-hidden">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">ホストマシン</span>
                    <div class="text-sm text-gray-600 dark:text-gray-300 truncate">${host ? host.name : '未割り当て'}</div>
                    <div class="text-xs text-gray-400 truncate">${host ? host.ip : ''}</div>
                </div>
                <!-- ログ -->
                <div class="col-span-full md:col-span-1">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">直近のログ</span>
                    <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 log-clamp leading-relaxed">${server.logs.slice(-4).map(log => `<p class="truncate">${log}</p>`).join('')}</div>
                </div>
                <!-- プレイヤー (縦3列表示) -->
                <div class="col-span-full md:col-span-1">
                    <span class="md:hidden text-xs text-gray-500 dark:text-gray-400 mb-1">最近のプレイヤー</span>
                    <div class="grid grid-rows-3 grid-flow-col gap-x-2 gap-y-1">${server.players.recent.length > 0 ? server.players.recent.map(player => `<span class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full truncate" title="${player}">${player}</span>`).join('') : '<span class="text-xs text-gray-400 col-span-3">なし</span>'}</div>
                </div>
                <!-- 人数 -->
                <div class="col-span-1"><span class="md:hidden text-xs text-gray-500 dark:text-gray-400">参加人数</span><p class="font-mono">${server.players.current}/${server.players.max}</p></div>
                <!-- TPS -->
                <div class="col-span-1"><span class="md:hidden text-xs text-gray-500 dark:text-gray-400">TPS</span><p class="font-mono font-bold ${tpsColor}">${server.status === 'running' ? server.tps.toFixed(1) : '-'}</p></div>
                <!-- ステータスボタン -->
                <div class="col-span-full sm:col-span-1 hidden 2xl:block">
                    <button data-action="toggle-status" class="w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}">
                        ${server.status === 'running' ? '停止' : '起動'}
                    </button>
                </div>
            </div>`;
        serverListContainer.appendChild(serverElement);
    });
};

// server.properties 入力フィールド生成
const createPropertyInput = (key, value) => {
    const type = typeof value;
    let inputHtml = '';
    const baseInputClasses = "w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";
    
    if (type === 'boolean') {
        inputHtml = `<label for="${key}" class="form-switch"><input type="checkbox" id="${key}" class="hidden" ${value ? 'checked' : ''}><div class="form-switch-toggle"></div></label>`;
    } else if (key === 'gamemode') {
        inputHtml = `<select id="${key}" class="${baseInputClasses}">${['survival', 'creative', 'adventure', 'spectator'].map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (key === 'difficulty') {
        inputHtml = `<select id="${key}" class="${baseInputClasses}">${['peaceful', 'easy', 'normal', 'hard'].map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (type === 'number') {
        inputHtml = `<input type="number" id="${key}" value="${value}" class="${baseInputClasses}">`;
    } else {
        const inputType = key.includes('password') ? 'password' : 'text';
        inputHtml = `<input type="${inputType}" id="${key}" value="${value}" class="${baseInputClasses}">`;
    }
    
    return `<div class="grid grid-cols-3 gap-4 items-center">
                <label for="${key}" class="text-sm text-gray-500 dark:text-gray-400 truncate col-span-1">${key}</label>
                <div class="col-span-2">${inputHtml}</div>
            </div>`;
};

// server.properties エディタレンダリング
const renderPropertiesEditor = (server) => {
    const properties = server.properties;
    const propertyGroups = {
        'ワールド設定': ['level-name', 'level-seed', 'level-type', 'generator-settings', 'generate-structures', 'allow-nether', 'hardcore', 'difficulty', 'gamemode', 'force-gamemode'],
        'プレイヤー設定': ['max-players', 'pvp', 'allow-flight', 'enforce-whitelist', 'white-list', 'player-idle-timeout', 'spawn-protection', 'op-permission-level', 'function-permission-level'],
        'MOB・NPC設定': ['spawn-animals', 'spawn-monsters', 'spawn-npcs'],
        'サーバー技術設定': ['server-port', 'server-ip', 'online-mode', 'prevent-proxy-connections', 'network-compression-threshold', 'max-tick-time', 'view-distance', 'max-build-height', 'max-world-size', 'use-native-transport', 'snooper-enabled'],
        'その他': ['motd', 'resource-pack', 'resource-pack-sha1', 'enable-command-block'],
        'Query & RCON': ['enable-query', 'query.port', 'enable-rcon', 'rcon.port', 'rcon.password', 'broadcast-console-to-ops', 'broadcast-rcon-to-ops']
    };
    let html = '<div id="properties-editor" class="space-y-6 custom-scrollbar pr-2">';
    for (const groupName in propertyGroups) {
        html += `<fieldset class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <legend class="text-lg font-semibold text-gray-900 dark:text-white px-2">${groupName}</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        ${propertyGroups[groupName].map(key => createPropertyInput(key, properties[key])).join('')}
                    </div>
                </fieldset>`;
    }
    html += '</div>';
    return html;
};

// v5: Mod/Pluginライブラリ（D&D元）のレンダリング
// type: 'mod' or 'plugin'
const renderAddonLibrary = (type) => {
    const library = (type === 'mod') ? modLibrary : pluginLibrary;
    return `
        <div id="addon-library-list" class="mt-4 space-y-2 custom-scrollbar pr-2" style="max-height: calc(100vh - 450px); overflow-y: auto;">
            ${library.map(item => `
                <div class="addon-item bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab" 
                    draggable="true" 
                    data-addon-id="${item.id}"
                    data-addon-type="${type}">
                    <div class="font-medium truncate">${item.name}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${item.size}</div>
                </div>
            `).join('')}
        </div>
    `;
};

// v5: サーバー側Mod/Pluginリスト（D&D先）のレンダリング
// type: 'mod' or 'plugin'
const renderServerAddons = (server, type) => {
    const addonList = (type === 'mod') ? server.installedMods : server.installedPlugins;
    const typeName = (type === 'mod') ? 'Mod' : 'Plugin';
    return `
        <div id="server-addon-list" 
            class="bg-gray-50 dark:bg-gray-900 border-2 border-transparent dark:border-transparent rounded-lg p-4 space-y-2 transition-all duration-300"
            style="min-height: calc(100vh - 250px); max-height: calc(100vh - 250px); overflow-y: auto;"
            data-drop-type="${type}">
            
            ${addonList.length === 0 ? `<p class="text-center text-gray-500 dark:text-gray-400 mt-10">ライブラリから${typeName}をドラッグ＆ドロップしてください</p>` : ''}

            ${addonList.map(item => `
                <div class="server-addon-item flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-gray-200 dark:border-gray-700" 
                    data-installed-id="${item.id}"
                    data-addon-type="${type}">
                    <div>
                        <div class="font-medium truncate">${item.name}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${item.size}</div>
                    </div>
                    <div class="flex items-center gap-4">
                        <label class="form-switch">
                            <input type="checkbox" class="hidden toggle-addon-enabled" ${item.enabled ? 'checked' : ''}>
                            <div class="form-switch-toggle"></div>
                        </label>
                        <button data-action="remove-addon" class="text-red-500 hover:text-red-700" title="削除">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};


// --- v6: 詳細ビューのレンダリング (レイアウト大幅改修) ---
const renderServerDetail = () => {
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server || !serverDetailView) return;
    
    const host = physicalServers.find(p => p.id === server.hostId);
    const statusClasses = getStatusClasses(server.status);
    const tpsColor = getTpsColor(server.tps);
    const cpuColor = getCpuColor(server.cpu);
    const memColor = getMemoryColor(server.memory, server.memoryMax);

    // v6: メモの行数計算とプレビュー生成
    const memoLines = (server.memo || '').split('\n');
    const memoLineCount = memoLines.length;
    const showToggleButton = memoLineCount >= 5;
    const previewMemo = memoLines[0] || 'メモなし'; // 1行目だけ表示

    serverDetailView.innerHTML = `
        <!-- ヘッダー -->
        <div>
            <!-- 修正点 3: ボタンのリスナーは renderer.js のイベント委任で処理 -->
            <button id="back-to-list-btn" class="text-primary hover:text-indigo-700 dark:hover:text-indigo-300 mb-4 inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                サーバー一覧に戻る
            </button>
            
            <!-- v6: ヘッダーレイアウト変更 (メモ追加) -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <!-- サーバー名 -->
                <div class="flex-grow min-w-0">
                    <div contenteditable="true" data-field="name" class="text-3xl font-bold editable truncate" placeholder="サーバー名を入力">${server.name}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        ホスト: <span class="font-medium text-gray-700 dark:text-gray-300">${host ? host.name : '未割り当て'}</span> (${host ? host.ip : 'N/A'})
                    </div>
                </div>

                <!-- v6: メモ (ドロップダウン) -->
                <div id="memo-dropdown-container" class="relative mx-4 flex-shrink min-w-0 hidden lg:block" style="max-width: 25%;">
                    <!-- 格納状態のプレビュー -->
                    <div class="flex items-center justify-end gap-2">
                        <p class="text-sm text-gray-500 dark:text-gray-400 truncate" title="${server.memo.replace(/"/g, '&quot;')}">
                            ${previewMemo}
                        </p>
                        <!-- 5行以上の場合のみボタン表示 -->
                        ${showToggleButton ? `
                            <button data-action="toggle-memo-dropdown" id="memo-toggle-btn" class="flex-shrink-0 p-1 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-transform duration-200">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                        ` : ''}
                    </div>

                    <!-- 展開状態のコンテナ (編集機能もこちらに移動) -->
                    ${showToggleButton ? `
                        <div id="memo-dropdown-content" class="hidden absolute top-full mt-2 right-0 w-[40rem] max-w-2xl z-20 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
                             style="min-height: 10rem; /* 最小8行分 */ max-height: 50vh; /* 最大 画面の半分 */ overflow-y: auto;">
                            <div class="p-4 h-full flex flex-col">
                                <h3 class="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">メモ</h3>
                                <!-- 展開時のみ編集可能 -->
                                <div contenteditable="true" data-field="memo" class="flex-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap editable min-h-[10rem] custom-scrollbar" 
                                    placeholder="メモを入力...">${server.memo}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- ボタン -->
                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <button data-action="open-dir" class="w-1/2 sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 flex-grow">フォルダ</button>
                    <button data-action="toggle-status" class="w-1/2 sm:w-auto font-bold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 flex-grow ${server.status === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}">${server.status === 'running' ? '停止' : '起動'}</button>
                </div>
            </div>
        </div>

        <!-- v5: ステータスカード (ヘッダー直下) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">ステータス</div>
                <div class="text-2xl font-bold ${statusClasses.text} mt-1">${server.status === 'running' ? '起動中' : '停止中'}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">プレイヤー</div>
                <div class="text-4xl font-extrabold text-primary mt-1">${server.players.current} <span class="text-lg text-gray-500">/ ${server.players.max}</span></div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">TPS</div>
                <div class="text-4xl font-extrabold ${tpsColor} mt-1">${server.status === 'running' ? server.tps.toFixed(1) : '-'}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400">CPU / メモリ</div>
                <div class="text-2xl font-bold ${cpuColor} mt-1">${server.status === 'running' ? server.cpu.toFixed(1) : '0.0'}%</div>
                <div class="text-sm ${memColor} mt-1">${(server.memory / 1024).toFixed(1)} GB / ${(server.memoryMax / 1024).toFixed(1)} GB</div>
            </div>
        </div>

        <!-- v6: 3カラムレイアウト (幅指定変更) -->
        <!-- lg:flex-row-reverse を使用し、メインエリアに flex-1 を適用して残りすべてを占有させる -->
        <div class="flex flex-col lg:flex-row-reverse gap-6 mt-6">
            
            <!-- カラム3: メイン編集エリア (残りすべて) -->
            <div class="lg:flex-1">
                <div id="detail-main-area" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700" style="height: calc(100vh - 400px);">
                    <!-- 内容は updateDetailViewContent で動的に挿入 -->
                </div>
            </div>
            
            <!-- カラム2: コンテキスト情報 (メモと同じ幅, w-autoでコンテンツ幅に合わせる) -->
            <div id="detail-context-area" class="lg:w-auto lg:flex-shrink-0">
                <!-- 内容は updateDetailViewContent で動的に挿入 -->
            </div>

            <!-- カラム1: タブナビ (最小コンテンツ幅, w-autoでコンテンツ幅に合わせる) -->
            <!-- v6: メモを削除 -->
            <div class="lg:w-auto lg:flex-shrink-0 space-y-6">
                <!-- 修正点 1, 2: タブのリスナーは renderer.js のイベント委任で処理 -->
                <nav class="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 w-fit" aria-label="Tabs">
                    <button data-tab="basic" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'basic' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">基本設定</button>
                    <button data-tab="mods" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'mods' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">Mod</button>
                    <button data-tab="plugins" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'plugins' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">Plugin</button>
                    <button data-tab="players" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'players' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">プレイヤー</button>
                    <button data-tab="danger" class="detail-tab-btn w-full text-left px-4 py-3 font-medium text-sm rounded-lg ${state.detailActiveTab === 'danger' ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">その他</button>
                </nav>
                <!-- メモはヘッダーに移動したため、ここからは削除 -->
            </div>

        </div>
    `;

    // v5: 初期表示 (タブに基づいたコンテンツの挿入)
    updateDetailViewContent(server);
};

// v5: 詳細ビューのタブ内容を更新する関数 (レイアウト変更)
const updateDetailViewContent = (server) => {
    const contextArea = document.getElementById('detail-context-area');
    const mainArea = document.getElementById('detail-main-area');
    if (!contextArea || !mainArea) return;

    server = server || state.servers.find(s => s.id === state.selectedServerId);
    if (!server) return;

    // 修正点 1: この switch 文が実行されれば、'basic' でも内容は描画されるはず
    switch(state.detailActiveTab) {
        case 'basic':
            // カラム2: 起動構成 (v6: 幅がautoになる)
            contextArea.innerHTML = `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                    <h3 class="text-lg font-semibold">起動構成</h3>
                    <div>
                        <label for="java-path" class="text-sm font-medium text-gray-500 dark:text-gray-400">Java実行パス</label>
                        <input type="text" id="java-path" value="default" class="mt-1 w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary">
                    </div>
                    <div>
                        <label for="memory-alloc" class="text-sm font-medium text-gray-500 dark:text-gray-400">メモリ割り当て (MB)</label>
                        <input type="number" id="memory-alloc" value="${server.memoryMax}" class="mt-1 w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary">
                    </div>
                    <button class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded-lg">
                        構成を保存
                    </button>
                </div>
            `;
            // カラム3: ログ/Properties
            mainArea.innerHTML = `
                <div class="flex border-b border-gray-200 dark:border-gray-700">
                    <button data-subtab="log" class="flex-1 detail-subtab-btn px-4 py-3 font-medium text-sm ${state.detailBasicActiveSubTab === 'log' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}">コンソール / ログ</button>
                    <button data-subtab="props" class="flex-1 detail-subtab-btn px-4 py-3 font-medium text-sm ${state.detailBasicActiveSubTab === 'props' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}">サーバー設定 (properties)</button>
                </div>
                <div id="detail-basic-content" class="p-4" style="height: calc(100% - 50px); overflow-y: auto;">
                    <!-- 内容は updateDetailBasicSubTab で挿入 -->
                </div>
            `;
            updateDetailBasicSubTab(server);
            break;
        
        case 'mods':
            // カラム2: Modライブラリ
            contextArea.innerHTML = `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 class="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-3">Mod ライブラリ</h3>
                    ${renderAddonLibrary('mod')}
                </div>
            `;
            // カラム3: サーバー側Modリスト
            mainArea.innerHTML = `
                <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-semibold">インストール済み Mod (${server.installedMods.length})</h3>
                    <button data-action="save-addons" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors duration-300">変更を保存</button>
                </div>
                <div class="p-4">
                    ${renderServerAddons(server, 'mod')}
                </div>
            `;
            setupDragAndDrop(server, 'mod');
            break;
        
        case 'plugins':
            // カラム2: Pluginライブラリ
            contextArea.innerHTML = `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 class="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-3">Plugin ライブラリ</h3>
                    ${renderAddonLibrary('plugin')}
                </div>
            `;
            // カラム3: サーバー側Pluginリスト
            mainArea.innerHTML = `
                <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-semibold">インストール済み Plugin (${server.installedPlugins.length})</h3>
                    <button data-action="save-addons" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors duration-300">変更を保存</button>
                </div>
                <div class="p-4">
                    ${renderServerAddons(server, 'plugin')}
                </div>
            `;
            setupDragAndDrop(server, 'plugin');
            break;

        case 'players':
            // カラム2: 参加者リスト
            contextArea.innerHTML = `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 class="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-3">参加者 (${server.players.current}人)</h3>
                    <div class="max-h-80 overflow-y-auto custom-scrollbar pr-2">
                        ${server.players.list.length > 0 ? server.players.list.map(p => `<p class="text-gray-700 dark:text-gray-300 py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">${p}</p>`).join('') : '<p class="text-gray-500">現在参加者はいません</p>'}
                    </div>
                </div>
            `;
            // カラム3: プレイヤー管理
            mainArea.innerHTML = `
                <div class="p-4"><h3 class="text-lg font-semibold">プレイヤー管理</h3><p class="mt-4 text-gray-500">（ここに Whitelist / OP / Banリスト の管理UIが入ります）</p></div>
            `;
            break;

        case 'danger':
            // カラム2: コントロール
            contextArea.innerHTML = `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 class="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">コントロール</h3>
                    <button data-action="restart-server" class="w-full mt-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 rounded-lg shadow-md transition duration-200">
                        サーバー再起動
                    </button>
                </div>
            `;
            // カラム3: 危険ゾーン
            mainArea.innerHTML = `
                <div class="p-4">
                    <h3 class="text-lg font-semibold text-red-500 dark:text-red-400">危険ゾーン</h3>
                    <div class="mt-4 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center">
                        <div><p class="font-bold text-gray-900 dark:text-red-200">サーバーの削除</p><p class="text-sm text-red-700 dark:text-gray-400">この操作は取り消せません。すべてのデータが削除されます。</p></div>
                        <button data-action="delete-server" class="mt-3 sm:mt-0 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">このサーバーを削除する</button>
                    </div>
                </div>
            `;
            break;
        // 修正点 1: default ケースを追加（念のため）
        default:
            contextArea.innerHTML = '';
            mainArea.innerHTML = `<p class="p-4 text-gray-500">不明なタブが選択されました: ${state.detailActiveTab}</p>`;
            break;
    }
};

// v5: 「基本」タブのサブタブ（ログ/設定）を更新 (v4と同じ)
const updateDetailBasicSubTab = (server) => {
    const contentArea = document.getElementById('detail-basic-content');
    if (!contentArea) return;

    if (state.detailBasicActiveSubTab === 'log') {
        // ログとコンソール
        contentArea.innerHTML = `
            <div class="flex flex-col h-full">
                <div class="bg-gray-50 dark:bg-black p-3 rounded-md flex-1 overflow-y-auto custom-scrollbar">
                    <pre id="server-log-output" class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">${server.logs.join('\n')}</pre>
                </div>
                <div class="mt-4 flex gap-2">
                    <input type="text" id="command-input" placeholder="コマンドを入力..." class="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary transition duration-150">
                    <button id="send-command-btn" class="bg-primary hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200">
                        実行
                    </button>
                </div>
            </div>
        `;
        const logOutputEl = contentArea.querySelector('#server-log-output');
        if(logOutputEl) logOutputEl.parentElement.scrollTop = logOutputEl.parentElement.scrollHeight;

    } else if (state.detailBasicActiveSubTab === 'props') {
        // Propertiesエディタ
        contentArea.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">server.properties</h2>
                <button data-action="save-properties" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">変更を保存</button>
            </div>
            ${renderPropertiesEditor(server)}
        `;
    }
};

// v5: 詳細ビュー全体を更新
const updateDetailView = () => {
    if (state.currentView !== 'detail') return;
    renderServerDetail(); // UI骨組みとコンテンツの完全再描画
};

// 物理サーバー一覧を描画する関数 (Ping更新とは別)
const renderPhysicalServerList = () => {
    const container = document.getElementById('physical-server-list');
    if (!container) return;
    
    container.innerHTML = ''; // コンテナをクリア
    
    physicalServers.forEach(pserv => {
        const el = document.createElement('div');
        el.id = `server-${pserv.ip}`; // IPをIDとして使用
        el.className = "bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center";
        
        let statusHtml = '';
        let pingHtml = 'N/A';

        if (pserv.status === 'connected') {
            statusHtml = `
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                    接続中
                </span>
            `;
            pingHtml = pserv.latency ? `${pserv.latency} ms` : '計測中...';
        } else {
            // ステータスが 'disconnected' または 'connecting' など
            const bgColor = pserv.status === 'disconnected' ? 'red' : 'yellow';
            const statusText = pserv.status === 'disconnected' ? '切断' : '接続待機中...';
            statusHtml = `
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-${bgColor}-100 dark:bg-${bgColor}-900 text-${bgColor}-800 dark:text-${bgColor}-200">
                    <span class="w-2 h-2 bg-${bgColor}-500 rounded-full"></span>
                    ${statusText}
                </span>
            `;
        }

        el.innerHTML = `
            <div>
                <div class="font-bold text-lg text-gray-900 dark:text-white">${pserv.name}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">${pserv.ip}</div>
            </div>
            <div id="status-${pserv.ip}">
                ${statusHtml}
            </div>
            <div>
                <div class="text-sm">Ping: <span id="ping-${pserv.ip}" class="font-medium">${pingHtml}</span></div>
            </div>
        `;
        container.appendChild(el);
    });
};


// v5: ビュー全体の切り替え関数
const updateView = () => {
    if (!serverListView || !physicalServerListView || !serverDetailView) {
        console.error("DOM要素が初期化されていません。");
        return;
    }

    // (1) 'list' 以外は serverListView を非表示にする
    serverListView.classList.toggle('hidden', state.currentView !== 'list');
    
    // (2) 'physical' 以外は physicalServerListView を非表示にする
    physicalServerListView.classList.toggle('hidden', state.currentView !== 'physical');
    
    // (3) 'detail' 以外は serverDetailView を非表示にする
    serverDetailView.classList.toggle('hidden', state.currentView !== 'detail');

    // サイドバーのアクティブ状態
    navGameServers.classList.toggle('bg-primary', state.currentView === 'list' || state.currentView === 'detail');
    navGameServers.classList.toggle('text-white', state.currentView === 'list' || state.currentView === 'detail');
    navGameServers.classList.toggle('text-gray-600', state.currentView !== 'list' && state.currentView !== 'detail');
    navGameServers.classList.toggle('dark:text-gray-300', state.currentView !== 'list' && state.currentView !== 'detail');
    navPhysicalServers.classList.toggle('bg-primary', state.currentView === 'physical');
    navPhysicalServers.classList.toggle('text-white', state.currentView === 'physical');
    navPhysicalServers.classList.toggle('text-gray-600', state.currentView !== 'physical');
    navPhysicalServers.classList.toggle('dark:text-gray-300', state.currentView !== 'physical');

    if (state.currentView === 'list') {
        renderServerList();
    } else if (state.currentView === 'detail') {
        renderServerDetail();
    } else if (state.currentView === 'physical') {
        // 物理サーバー一覧の描画 (ping更新で部分的に行われるが、初期描画も必要)
        renderPhysicalServerList();
    }
};

// --- v5: D&D関連のロジック (Mod/Plugin分離対応) ---
function setupDragAndDrop(server, type) { // type: 'mod' or 'plugin'
    const libraryList = document.getElementById('addon-library-list');
    const serverAddonList = document.getElementById('server-addon-list');
    if (!libraryList || !serverAddonList) return;

    // 1. ドラッグ元（ライブラリ）
    // イベントリスナーが重複しないよう、簡易的に ondragstart を使用 (本来は addEventListener と AbortController が望ましい)
    libraryList.ondragstart = (e) => {
        const target = e.target.closest('.addon-item');
        if (target) {
            draggedAddon = {
                id: target.dataset.addonId,
                type: target.dataset.addonType
            };
            target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', JSON.stringify(draggedAddon));
        }
    };

    libraryList.ondragend = (e) => {
        if (draggedAddon) {
            const target = e.target.closest('.addon-item');
            if (target) target.classList.remove('dragging');
            draggedAddon = null;
        }
    };

    // 2. ドロップ先（サーバー側リスト）
    serverAddonList.ondragover = (e) => {
        e.preventDefault();
        if (draggedAddon && draggedAddon.type === type) { // 型が一致するか確認
            e.dataTransfer.dropEffect = 'copy';
            serverAddonList.classList.add('drop-target-highlight');
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    };

    serverAddonList.ondragleave = () => {
        serverAddonList.classList.remove('drop-target-highlight');
    };

    serverAddonList.ondrop = (e) => {
        e.preventDefault();
        serverAddonList.classList.remove('drop-target-highlight');
        
        let addonData;
        try {
            addonData = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch (err) {
            console.error("D&Dデータのパースに失敗:", err);
            return;
        }
        
        if (!addonData || addonData.type !== type) return; // 念のため型を再確認

        const addonId = addonData.id;
        const sourceLibrary = (type === 'mod') ? modLibrary : pluginLibrary;
        const targetList = (type === 'mod') ? server.installedMods : server.installedPlugins;
        
        const isAlreadyAdded = targetList.find(m => m.id === addonId);
        if (isAlreadyAdded) {
            // alert() は使用しない
            console.warn(`この${type === 'mod' ? 'Mod' : 'Plugin'}は既に追加されています。`);
            return;
        }

        const addonToAdd = sourceLibrary.find(m => m.id === addonId);
        if (addonToAdd) {
            targetList.push({ ...addonToAdd, enabled: true });
            updateDetailViewContent(server); // UIを再描画
        }
    };
}