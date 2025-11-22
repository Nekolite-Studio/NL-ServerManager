// manager/src/dom/eventHandlers.js
import { startMetricsStream, stopMetricsStream, stopAllMetricsStreams } from '../services/metricsService.js';

let helpPopupTimer = null;

/**
 * DOMイベントリスナーを設定する
 */
export function setupDomListeners() {
    // グローバル変数への参照
    const state = window.state;
    const getters = window.getters;
    const updateView = window.updateView;
    const renderServerDetail = window.renderServerDetail;
    const renderPhysicalServerDetail = window.renderPhysicalServerDetail;
    const showNotification = window.showNotification;

    // メインコンテナへのイベント委譲
    document.getElementById('app').addEventListener('click', (e) => {
        const target = e.target;

        // メモ機能: ドロップダウン外クリックの判定
        const memoContent = document.getElementById('memo-dropdown-content');
        if (memoContent && !memoContent.classList.contains('hidden')) {
            // メモが開いている状態で、メモコンテナ外がクリックされたら閉じる
            if (!target.closest('#memo-dropdown-container')) {
                toggleMemo(state.selectedServerId);
            }
        }

        // ヘルプポップアップ以外がクリックされたら、開いているポップアップを閉じる
        if (!target.closest('[data-action="show-help"]')) {
            document.querySelectorAll('[id^="help-popup-"]:not(.hidden)').forEach(p => p.classList.add('hidden'));
        }

        const serverItem = target.closest('.server-item-container');
        const physicalServerItem = target.closest('.physical-server-item');

        // 物理サーバーリスト -> 詳細
        if (state.currentView === 'physical' && physicalServerItem) {
            const agentId = physicalServerItem.dataset.agentId;
            state.selectedPhysicalServerId = agentId;
            state.currentView = 'physical-detail';
            state.physicalServerDetailActiveTab = 'status';
            startMetricsStream('physicalServer', agentId);
            updateView();
            return;
        }

        // ゲームサーバーリスト -> 詳細
        if (state.currentView === 'list' && serverItem) {
            if (!target.closest('[data-action]')) { // アクションボタン以外をクリック
                const serverId = serverItem.dataset.serverId;
                state.selectedServerId = serverId;
                state.currentView = 'detail';
                state.detailActiveTab = 'console';
                startMetricsStream('gameServer', serverId);
                updateView();
            }
            return;
        }

        // 「戻る」ボタン
        if (target.closest('#back-to-list-btn')) {
            stopAllMetricsStreams();
            state.currentView = 'list';
            state.selectedServerId = null;
            // リストに戻るときに最新情報を要求
            for (const agent of state.physicalServers.values()) {
                if (agent.status === 'Connected') {
                    window.electronAPI.proxyToAgent(agent.id, { type: window.electronAPI.Message.GET_ALL_SERVERS });
                }
            }
            updateView();
            return;
        }
        if (target.closest('#back-to-physical-list-btn')) {
            stopAllMetricsStreams();
            state.currentView = 'physical';
            state.selectedPhysicalServerId = null;
            updateView();
            return;
        }

        // タブ切り替え (ゲームサーバー詳細)
        const detailTabBtn = target.closest('.detail-tab-btn');
        if (detailTabBtn) {
            const newTab = detailTabBtn.dataset.tab;
            if (state.detailActiveTab !== newTab) {
                state.detailActiveTab = newTab;
                renderServerDetail(); // タブスタイルとコンテンツを再描画
            }
            return;
        }

        // タブ切り替え (物理サーバー詳細)
        const physicalTabBtn = target.closest('.physical-detail-tab-btn');
        if (physicalTabBtn) {
            const newTab = physicalTabBtn.dataset.tab;
            if (state.physicalServerDetailActiveTab !== newTab) {
                state.physicalServerDetailActiveTab = newTab;
                if (newTab === 'settings') {
                    window.electronAPI.proxyToAgent(state.selectedPhysicalServerId, { type: window.electronAPI.Message.GET_SYSTEM_INFO });
                }
                renderPhysicalServerDetail(); // タブスタイルとコンテンツを再描画
            }
            return;
        }

        // メモ機能: トグルボタンまたはプレビュークリック
        if (target.closest('[data-action="toggle-memo-dropdown"]') || target.closest('#memo-preview')) {
            if (state.selectedServerId) {
                toggleMemo(state.selectedServerId);
            }
            return;
        }

        // --- アクションボタン ---
        const actionBtn = target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const serverId = state.selectedServerId || (target.closest('.server-item-container') ? target.closest('.server-item-container').dataset.serverId : null);
            const agentId = state.selectedPhysicalServerId;

            switch (action) {
                case 'show-help':
                    {
                        if (helpPopupTimer) {
                            clearTimeout(helpPopupTimer);
                            helpPopupTimer = null;
                        }
                        const key = actionBtn.dataset.key;
                        const popup = document.getElementById(`help-popup-${key}`);
                        if (popup) {
                            // 他のポップアップを閉じる
                            document.querySelectorAll('[id^="help-popup-"]').forEach(p => {
                                if (p.id !== popup.id) p.classList.add('hidden');
                            });
                            // 対象のポップアップの表示をトグル
                            popup.classList.toggle('hidden');
                        }
                        e.stopPropagation();
                    }
                    break;
                case 'open-java-install-modal':
                    {
                        const agent = getters.selectedPhysicalServer();
                        if (agent) {
                            state.javaInstallAgentId = agent.id;
                            const javaInstallModal = document.getElementById('java-install-modal');
                            // Reset fields and show
                            document.getElementById('java-version-select').value = '17';
                            document.getElementById('java-download-url').value = '';
                            document.getElementById('java-file-size').value = '';
                            javaInstallModal.classList.remove('hidden');

                            // Trigger change to auto-fetch URL for the default version
                            document.getElementById('java-version-select').dispatchEvent(new Event('change'));
                        }
                    }
                    break;
                case 'toggle-status':
                    if (serverId) {
                        const server = getters.allServers().find(s => s.server_id === serverId);
                        if (server) {
                            const newAction = server.status === 'running' ? 'stop' : 'start';
                            window.electronAPI.proxyToAgent(server.hostId, {
                                type: window.electronAPI.Message.CONTROL_SERVER,
                                payload: { serverId: server.server_id, action: newAction }
                            });

                        }
                    }
                    break;

                case 'save-properties':
                    if (serverId) {
                        const server = getters.selectedServer();
                        const editor = document.getElementById('properties-editor');
                        if (server && editor) {
                            const newProperties = {};

                            // 通常のinputとselectを取得
                            const inputs = editor.querySelectorAll('.property-input');
                            inputs.forEach(input => {
                                const key = input.dataset.key;
                                if (input.type === 'number') {
                                    newProperties[key] = parseFloat(input.value);
                                } else {
                                    newProperties[key] = input.value;
                                }
                            });

                            // ラジオボタンの値を取得
                            const radioButtons = editor.querySelectorAll('.property-input-radio');
                            const radioGroups = {};
                            radioButtons.forEach(radio => {
                                if (!radioGroups[radio.name]) {
                                    radioGroups[radio.name] = [];
                                }
                                radioGroups[radio.name].push(radio);
                            });

                            for (const key in radioGroups) {
                                const checkedRadio = radioGroups[key].find(r => r.checked);
                                if (checkedRadio) {
                                    newProperties[key] = (checkedRadio.value === 'true');
                                }
                            }

                            window.electronAPI.proxyToAgent(server.hostId, {
                                type: window.electronAPI.Message.UPDATE_SERVER_PROPERTIES,
                                payload: { serverId: server.server_id, properties: newProperties }
                            });
                        }
                    }
                    break;
                case 'save-launch-config':
                    if (serverId) {
                        const server = getters.selectedServer();
                        if (server) {
                            const javaPath = document.getElementById('java-path').value;
                            const minMemory = document.getElementById('min-memory').value;
                            const maxMemory = document.getElementById('max-memory').value;
                            const customArgs = document.getElementById('custom-args').value;

                            const runtimeConfig = {
                                java_path: javaPath.trim() === '' ? null : javaPath,
                                min_memory: parseInt(minMemory, 10) || 1024,
                                max_memory: parseInt(maxMemory, 10) || 2048,
                                custom_args: customArgs,
                            };

                            window.electronAPI.proxyToAgent(server.hostId, {
                                type: window.electronAPI.Message.UPDATE_SERVER,
                                payload: { serverId: server.server_id, config: { runtime: runtimeConfig } }
                            });
                        }
                    }
                    break;
                case 'confirm-reset-property':
                    {
                        const key = actionBtn.dataset.key;
                        if (key) {
                            window.showConfirmationModal('この設定をデフォルト値に戻しますか？', () => {
                                window.electronAPI.getServerPropertiesAnnotations().then(annotations => {
                                    const annotation = annotations[key];
                                    if (annotation) {
                                        if (annotation.type === 'boolean') {
                                            const radioToSelect = document.querySelector(`input[name="${key}"][value="${annotation.default}"]`);
                                            if (radioToSelect) {
                                                radioToSelect.checked = true;
                                            }
                                        } else {
                                            const input = document.getElementById(key);
                                            if (input) {
                                                input.value = annotation.default;
                                            }
                                        }
                                        showNotification(`'${key}' をデフォルト値に戻しました`, 'info', `reset-${key}`, 2000);
                                    }
                                });
                            });
                        }
                    }
                    break;

                case 'delete-server':
                    if (serverId) {
                        const server = getters.allServers().find(s => s.server_id === serverId);
                        if (server) {
                            state.serverToDeleteId = server.server_id;
                            document.getElementById('deleting-server-name').textContent = server.server_name;
                            document.getElementById('delete-modal').classList.remove('hidden');
                        }
                    }
                    break;

                // 他のアクションもここに追加...
            }
        }
    });

    // --- Modal Handlers ---
    const createServerModal = document.getElementById('create-server-modal');
    const addServerBtn = document.getElementById('add-server-btn');
    const cancelCreateServerBtn = document.getElementById('cancel-create-server-btn');
    const confirmCreateServerBtn = document.getElementById('confirm-create-server-btn');

    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    const javaInstallModal = document.getElementById('java-install-modal');
    const javaVersionSelect = document.getElementById('java-version-select');
    const installJavaBtn = document.getElementById('install-java-btn');
    const cancelJavaInstallBtn = document.getElementById('cancel-java-install-btn');


    confirmDeleteBtn.addEventListener('click', () => {
        const serverId = state.serverToDeleteId;
        if (serverId) {
            const server = getters.allServers().find(s => s.server_id === serverId);
            if (server) {
                // UIロックを開始
                state.serversBeingDeleted.add(serverId);
                showNotification(`サーバー「${server.server_name}」の削除要求を送信しました...`, 'info');
                updateView(); // ロック状態を即時反映

                window.electronAPI.proxyToAgent(server.hostId, {
                    type: window.electronAPI.Message.DELETE_SERVER,
                    payload: { serverId: server.server_id }
                });
            }
        }
        deleteModal.classList.add('hidden');
        state.serverToDeleteId = null;
    });

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        state.serverToDeleteId = null;
    });

    if (addServerBtn) {
        addServerBtn.addEventListener('click', () => {
            const hostSelect = document.getElementById('host-select');
            if (!hostSelect) return;

            // ホスト選択のオプションをクリアして再生成
            hostSelect.innerHTML = '';
            const onlineAgents = Array.from(state.physicalServers.values()).filter(p => p.status === 'Connected');

            if (onlineAgents.length === 0) {
                hostSelect.innerHTML = '<option value="">利用可能なホストがありません</option>';
                hostSelect.disabled = true;
                if (confirmCreateServerBtn) confirmCreateServerBtn.disabled = true;
            } else {
                onlineAgents.forEach(agent => {
                    const option = document.createElement('option');
                    option.value = agent.id;
                    option.textContent = `${agent.config.alias} (${agent.config.ip})`;
                    hostSelect.appendChild(option);
                });
                hostSelect.disabled = false;
                if (confirmCreateServerBtn) confirmCreateServerBtn.disabled = false;
            }

            // バージョンリストの取得を要求
            const versionSelect = document.getElementById('version-select');
            if (versionSelect) {
                versionSelect.innerHTML = '<option>バージョンを読み込み中...</option>';
            }
            window.electronAPI.getMinecraftVersions();

            if (createServerModal) createServerModal.classList.remove('hidden');
        });
    }

    if (cancelCreateServerBtn) {
        cancelCreateServerBtn.addEventListener('click', () => {
            if (createServerModal) createServerModal.classList.add('hidden');
        });
    }

    // --- Forge/Loader Logic ---
    const loaderContainer = document.getElementById('loader-version-container');
    const loaderSelect = document.getElementById('loader-version');
    const serverTypeRadios = document.querySelectorAll('input[name="server-type"]');
    const versionSelect = document.getElementById('version-select');
    const serverNameInput = document.getElementById('server-name');

    let cachedForgePromotions = null;

    async function updateLoaderVersions() {
        const type = document.querySelector('input[name="server-type"]:checked').value;
        const mcVersion = versionSelect.value;

        if (type === 'vanilla') {
            if (loaderContainer) loaderContainer.classList.add('hidden');
            return;
        }

        if (loaderContainer) loaderContainer.classList.remove('hidden');
        if (loaderSelect) loaderSelect.innerHTML = '<option>読み込み中...</option>';

        if (type === 'forge') {
            if (!cachedForgePromotions) {
                const result = await window.electronAPI.getForgeVersions();
                if (result.success) {
                    cachedForgePromotions = result.promotions;
                } else {
                    if (loaderSelect) loaderSelect.innerHTML = '<option>取得失敗</option>';
                    showNotification(`Forgeバージョンの取得に失敗しました: ${result.error}`, 'error');
                    return;
                }
            }

            const latestKey = `${mcVersion}-latest`;
            const recommendedKey = `${mcVersion}-recommended`;

            const latest = cachedForgePromotions[latestKey];
            const recommended = cachedForgePromotions[recommendedKey];

            if (loaderSelect) {
                loaderSelect.innerHTML = '';

                if (recommended) {
                    const opt = document.createElement('option');
                    opt.value = recommended;
                    opt.textContent = `${recommended} (Recommended)`;
                    loaderSelect.appendChild(opt);
                }

                if (latest && latest !== recommended) {
                    const opt = document.createElement('option');
                    opt.value = latest;
                    opt.textContent = `${latest} (Latest)`;
                    loaderSelect.appendChild(opt);
                }

                if (!latest && !recommended) {
                    loaderSelect.innerHTML = '<option value="">利用可能なバージョンがありません</option>';
                }
            }
        } else {
            if (loaderSelect) loaderSelect.innerHTML = '<option value="">未実装</option>';
        }
    }

    serverTypeRadios.forEach(radio => {
        radio.addEventListener('change', updateLoaderVersions);
    });

    if (versionSelect) {
        versionSelect.addEventListener('change', () => {
            const checked = document.querySelector('input[name="server-type"]:checked');
            if (checked && checked.value !== 'vanilla') {
                updateLoaderVersions();
            }
        });
    }

    if (confirmCreateServerBtn) {
        confirmCreateServerBtn.addEventListener('click', () => {
            const hostId = document.getElementById('host-select')?.value;
            const versionId = document.getElementById('version-select')?.value;
            const serverType = document.querySelector('input[name="server-type"]:checked')?.value || 'vanilla';
            const loaderVersion = document.getElementById('loader-version')?.value;
            const serverName = document.getElementById('server-name')?.value || 'New Server';

            if (!hostId || !versionId) {
                showNotification('ホストマシンまたはバージョンが選択されていません。', 'error');
                return;
            }

            if (serverType !== 'vanilla' && !loaderVersion) {
                showNotification('Modローダーのバージョンが選択されていません。', 'error');
                return;
            }

            // 先にモーダルを閉じて、処理開始を通知する
            if (createServerModal) createServerModal.classList.add('hidden');
            showNotification(`[${versionId}] (${serverType}) の作成処理を開始します...`, 'info');

            // Javaバージョン取得を非同期で行い、完了後にサーバー作成を要求する
            window.electronAPI.getRequiredJavaVersion({ mcVersion: versionId })
                .then(result => {
                    let requiredJavaVersion = null;
                    if (result.success) {
                        requiredJavaVersion = result.javaVersion;
                        console.log(`[Renderer] Required Java version for ${versionId} is: ${requiredJavaVersion}`);
                    } else {
                        console.warn(`Could not get required Java version for ${versionId}: ${result.error}`);
                        showNotification(`要求Javaバージョンの取得に失敗したため、Agentのデフォルト設定で続行します。`, 'info');
                    }

                    // mainプロセスにサーバー作成を要求
                    window.electronAPI.proxyToAgent(hostId, {
                        type: window.electronAPI.Message.CREATE_SERVER,
                        payload: {
                            versionId,
                            serverType,
                            loaderVersion,
                            serverName,
                            runtime: {
                                java_version: requiredJavaVersion
                            }
                        }
                    });
                })
                .catch(error => {
                    showNotification(`Javaバージョン取得中にエラーが発生しました。Agentのデフォルト設定で続行します。: ${error.message}`, 'error');
                    // エラーが発生しても、Javaバージョン指定なしで作成要求を試みる
                    window.electronAPI.proxyToAgent(hostId, {
                        type: window.electronAPI.Message.CREATE_SERVER,
                        payload: {
                            versionId,
                            serverType,
                            loaderVersion,
                            serverName,
                            runtime: {
                                java_version: null
                            }
                        }
                    });
                });
        });
    }

    // --- Java Install Modal ---
    if (javaVersionSelect) {
        javaVersionSelect.addEventListener('change', async (e) => {
            const version = e.target.value;
            const agent = getters.selectedPhysicalServer();
            if (!agent || !agent.systemInfo || !agent.systemInfo.os) {
                showNotification('Agentのシステム情報が取得できていません。', 'error');
                return;
            }
            // Adoptium API uses 'mac' for darwin, 'windows' for win32
            const os = agent.systemInfo.os === 'darwin' ? 'mac' : (agent.systemInfo.os === 'win32' ? 'windows' : agent.systemInfo.os);
            const arch = agent.systemInfo.arch;

            const urlInput = document.getElementById('java-download-url');
            const sizeInput = document.getElementById('java-file-size');
            urlInput.value = '情報を取得中...';
            sizeInput.value = '';

            try {
                const result = await window.electronAPI.getJavaDownloadInfo({ feature_version: version, os, arch });
                if (result.success) {
                    urlInput.value = result.downloadLink;
                    sizeInput.value = `${(result.fileSize / 1024 / 1024).toFixed(2)} MB`;
                } else {
                    urlInput.value = '取得失敗';
                    showNotification(`Java ${version} のダウンロード情報を取得できませんでした: ${result.error}`, 'error');
                }
            } catch (err) {
                urlInput.value = '取得失敗';
                showNotification(`ダウンロード情報取得中にエラーが発生: ${err.message}`, 'error');
            }
        });
    }

    if (installJavaBtn) {
        installJavaBtn.addEventListener('click', () => {
            const agentId = state.javaInstallAgentId;
            const version = document.getElementById('java-version-select').value;
            const downloadUrl = document.getElementById('java-download-url').value;

            if (!agentId || !version || !downloadUrl || downloadUrl === '情報を取得中...' || downloadUrl === '取得失敗') {
                showNotification('インストール情報が不完全です。', 'error');
                return;
            }

            window.electronAPI.proxyToAgent(agentId, {
                type: window.electronAPI.Message.INSTALL_JAVA,
                payload: { version, downloadUrl }
            });

            if (javaInstallModal) javaInstallModal.classList.add('hidden');
            showNotification(`Java ${version} のインストールをエージェントに要求しました...`, 'info');
        });
    }

    if (cancelJavaInstallBtn) {
        cancelJavaInstallBtn.addEventListener('click', () => {
            if (javaInstallModal) javaInstallModal.classList.add('hidden');
        });
    }

    // インライン編集の保存
    document.getElementById('app').addEventListener('focusout', (e) => {
        if (e.target.matches('.editable[contenteditable="true"]')) {
            const field = e.target.dataset.field;
            const value = e.target.innerText;
            const serverId = state.selectedServerId || e.target.closest('[data-server-id]')?.dataset.serverId;

            // メモは専用の保存ロジック(toggle-memo-dropdown)で処理するためここでは除外
            if (serverId && field && field === 'server_name') {
                const server = getters.allServers().find(s => s.server_id === serverId);
                if (server) {
                    if (server[field] !== value) {
                        console.log(`[Renderer] Updating server name for ${serverId} to "${value}"`);
                        window.electronAPI.proxyToAgent(server.hostId, {
                            type: window.electronAPI.Message.UPDATE_SERVER,
                            payload: { serverId, config: { [field]: value } }
                        });
                    }
                } else {
                    console.error(`[Renderer] Server not found for id: ${serverId}`);
                }
            }
        }
    });

    // ナビゲーション
    navGameServers.addEventListener('click', (e) => {
        e.preventDefault();
        stopAllMetricsStreams();
        state.currentView = 'list';
        state.selectedServerId = null;
        updateView();
    });
    navPhysicalServers.addEventListener('click', (e) => {
        e.preventDefault();
        stopAllMetricsStreams();
        // 物理サーバーリストビューでは、ポーリングベースのメトリクスを再度有効化
        state.currentView = 'physical';
        state.selectedPhysicalServerId = null;
        updateView();
    });

    // --- ヘルプポップアップのホバー処理 ---
    const appElement = document.getElementById('app');

    appElement.addEventListener('mouseover', e => {
        const target = e.target.closest('[data-action="show-help"]');
        if (target) {
            const key = target.dataset.key;
            // 既存のタイマーをクリア
            if (helpPopupTimer) clearTimeout(helpPopupTimer);

            helpPopupTimer = setTimeout(() => {
                const popup = document.getElementById(`help-popup-${key}`);
                if (popup) {
                    // 他のホバー起因のポップアップは閉じる
                    document.querySelectorAll('[id^="help-popup-"]').forEach(p => {
                        if (p.id !== popup.id) p.classList.add('hidden');
                    });
                    popup.classList.remove('hidden');
                }
            }, 500);
        }
    });

    appElement.addEventListener('mouseout', e => {
        const target = e.target.closest('[data-action="show-help"]');
        if (target) {
            // 表示タイマーをキャンセル
            if (helpPopupTimer) {
                clearTimeout(helpPopupTimer);
                helpPopupTimer = null;
            }

            // 短い遅延の後、ポップアップがホバーされていなければ隠す
            const key = target.dataset.key;
            const popup = document.getElementById(`help-popup-${key}`);
            setTimeout(() => {
                if (popup && !popup.matches(':hover')) {
                    popup.classList.add('hidden');
                }
            }, 300);
        }
    });

    // ポップアップからマウスが離れた時
    appElement.addEventListener('mouseleave', (e) => {
        if (e.target.matches('[id^="help-popup-"]')) {
            e.target.classList.add('hidden');
        }
    }, true);

    // 2. UIの準備ができたことをMainプロセスに通知
    window.electronAPI.rendererReady();
}

// メモ機能のトグル処理
function toggleMemo(serverId) {
    const container = document.getElementById('memo-dropdown-container');
    const content = document.getElementById('memo-dropdown-content');
    const editor = document.getElementById('memo-editor');
    const icon = document.getElementById('memo-toggle-btn')?.querySelector('svg');
    const preview = document.getElementById('memo-preview');
    const getters = window.getters;

    if (!container || !content || !editor) return;

    const isOpening = content.classList.contains('hidden');

    if (isOpening) {
        // 開く
        content.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
        editor.focus();
    } else {
        // 閉じる
        content.classList.add('hidden');
        if (icon) icon.classList.remove('rotate-180');

        // 保存処理
        const server = getters.allServers().find(s => s.server_id === serverId);
        const newMemo = editor.innerText;

        if (server && server.memo !== newMemo) {
            console.log(`[Memo] Saving memo for server ${serverId}`);

            // 楽観的更新 (UI)
            server.memo = newMemo;
            const lines = newMemo.split('\n');
            const firstLine = lines[0] || '';
            if (firstLine) {
                preview.innerText = firstLine;
                preview.classList.remove('text-gray-500', 'italic');
                preview.classList.add('text-gray-700', 'dark:text-gray-300');
            } else {
                preview.innerText = 'メモなし';
                preview.classList.add('text-gray-500', 'italic');
                preview.classList.remove('text-gray-700', 'dark:text-gray-300');
            }
            preview.title = newMemo;

            // リクエスト送信
            window.electronAPI.proxyToAgent(server.hostId, {
                type: window.electronAPI.Message.UPDATE_SERVER,
                payload: { serverId, config: { memo: newMemo } }
            });
        }
    }
}