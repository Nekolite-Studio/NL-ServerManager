// manager/src/ipc/rendererListeners.js
import { startMetricsStream } from '../services/metricsService.js';

/**
 * IPCイベントリスナーを設定する
 */
export function setupIpcListeners() {
    // グローバル変数への参照 (renderer-state.js, renderer-ui.js で定義)
    const state = window.state;
    const getters = window.getters;
    const updateView = window.updateView;
    const renderPhysicalServerDetail = window.renderPhysicalServerDetail;
    const showNotification = window.showNotification;

    // Agentリストが更新された
    window.electronAPI.onAgentList((agentList) => {
        const isInitialLoad = state.physicalServers.size === 0;
        state.physicalServers.clear();
        agentList.forEach(agent => {
            state.physicalServers.set(agent.id, { ...agent, metrics: {}, systemInfo: {}, logs: [] });
        });

        // 初回のAgentリスト受信時に、全サーバーリストを要求する
        if (isInitialLoad && agentList.length > 0) {
            console.log('Initial agent list received. Requesting all server lists from all agents.');
            agentList.forEach(agent => {
                if (agent.status === 'Connected') {
                    window.electronAPI.proxyToAgent(agent.id, { type: window.electronAPI.Message.GET_ALL_SERVERS });
                }
            });
        }
        updateView();
    });

    // 特定のAgentの状態が更新された
    window.electronAPI.onAgentStatusUpdate((agentUpdate) => {
        if (state.physicalServers.has(agentUpdate.id)) {
            const agent = state.physicalServers.get(agentUpdate.id);
            agent.status = agentUpdate.status;
            if (agent.status !== 'Connected') {
                agent.metrics = {}; // 切断されたらメトリクスをクリア
            }
            updateView();
        }
    });

    // Agentからの個別サーバー更新
    window.electronAPI.onServerUpdate(({ agentId, payload }) => {
        const hostServers = state.agentServers.get(agentId);
        if (!hostServers) return;
        const server = hostServers.find(s => s.server_id === payload.serverId);
        if (server) {
            if (payload.type === 'status_change') {
                server.status = payload.payload;
                // サーバーが 'running' になり、かつその詳細画面を見ている場合にメトリクスストリームを自動開始
                if (payload.payload === 'starting' || payload.payload === 'running' && state.currentView === 'detail' && state.selectedServerId === payload.serverId) {
                    console.log(`[Metrics] Server ${payload.serverId} started. Auto-starting metrics stream.`);
                    startMetricsStream('gameServer', payload.serverId);
                }
            } else if (payload.type === 'log') {
                if (!server.logs) server.logs = [];
                server.logs.push(payload.payload);
                if (server.logs.length > 200) server.logs.shift();
            }
            if (state.currentView === 'list' || (state.currentView === 'detail' && state.selectedServerId === payload.serverId)) {
                updateView();
            }
        }
    });

    // Agentからのメトリクス更新 (プッシュ)
    window.electronAPI.onMetricsData(({ agentId, payload }) => {
        // これは物理サーバーの全体メトリクス用（従来のポーリング）
        const agent = state.physicalServers.get(agentId);
        if (agent) {
            agent.metrics = payload;
            if (state.currentView === 'physical') {
                updateView();
            }
        }
    });

    // 新しいストリーミング形式のメトリクスハンドラ
    window.electronAPI.onGameServerMetricsUpdate(({ payload }) => {
        const server = getters.allServers().find(s => s.server_id === payload.serverId);
        if (server) {
            Object.assign(server, payload);
            if (state.currentView === 'detail' && state.selectedServerId === payload.serverId) {
                updateView();
            }
        }
    });

    window.electronAPI.onPhysicalServerMetricsUpdate(({ agentId, payload }) => {
        const agent = state.physicalServers.get(agentId);
        if (agent) {
            agent.metrics = payload;
            if (state.currentView === 'physical-detail' && state.selectedPhysicalServerId === agentId) {
                updateView();
            }
        }
    });

    // Agentからのシステム情報更新
    window.electronAPI.onAgentSystemInfo(({ agentId, payload }) => {
        const agent = state.physicalServers.get(agentId);
        if (agent) {
            agent.systemInfo = payload;
            // 必要に応じてUIを更新
            if (state.currentView === 'physical-detail' && state.selectedPhysicalServerId === agentId) {
                updateView();
            }
        }
    });

    // Agentのログが追加された
    window.electronAPI.onAgentLogEntry(({ agentId, message }) => {
        const agent = state.physicalServers.get(agentId);
        if (agent) {
            if (!agent.logs) agent.logs = [];
            agent.logs.push(message);
            if (agent.logs.length > 100) agent.logs.shift();

            if (state.currentView === 'physical-detail' && state.selectedPhysicalServerId === agentId && state.physicalServerDetailActiveTab === 'logs') {
                renderPhysicalServerDetail(); // UI更新
            }
        }
    });

    // ゲームサーバーのリストが更新された
    window.electronAPI.onServerListUpdate(({ agentId, servers }) => {
        const serversWithUIData = servers.map(s => ({
            ...s,
            hostId: agentId,
            logs: s.logs || [],
            players: s.players || { current: 0, max: 20, list: [], recent: [] },
            cpu: s.cpu || 0,
            memory: s.memory || 0,
            memoryMax: s.memoryMax || 2048,
            tps: s.tps || 0,
            memo: s.memo || '',
        }));
        state.agentServers.set(agentId, serversWithUIData);
        if (state.currentView === 'list') {
            updateView();
        }
    });

    // --- 操作の進捗と結果のハンドリング ---

    // 進捗更新
    window.electronAPI.onProgressUpdate(({ agentId, requestId, operation, payload }) => {
        console.log(`[Progress] Op: ${operation}, Req: ${requestId}, Payload:`, payload);
        const agent = state.physicalServers.get(agentId);
        const agentName = agent ? agent.config.alias : 'Unknown';
        const notifId = `progress-${requestId}`;

        if (operation === window.electronAPI.Message.CREATE_SERVER || operation === window.electronAPI.Message.INSTALL_JAVA) {
            showNotification(`${agentName}: ${payload.message}`, 'info', notifId, 0); // 0 = no auto-dismiss
        }
    });

    // 操作完了/失敗
    window.electronAPI.onOperationResult(({ agentId, requestId, operation, success, payload, error }) => {
        console.log(`[Result] Op: ${operation}, Req: ${requestId}, Success: ${success}`);
        const agent = state.physicalServers.get(agentId);
        const agentName = agent ? agent.config.alias : 'Unknown';
        const notifId = `progress-${requestId}`;

        if (operation === window.electronAPI.Message.CREATE_SERVER) {
            if (success) {
                showNotification(`サーバーが正常に作成されました。`, 'success', notifId, 5000);
            } else {
                showNotification(`${agentName}でのサーバー作成失敗: ${error.message}`, 'error', notifId, 10000);
            }
        } else if (operation === window.electronAPI.Message.INSTALL_JAVA) {
            if (success) {
                const javaVersion = payload?.javaVersion || '不明なバージョン';
                showNotification(`Java ${javaVersion} のインストールが完了しました。`, 'success', notifId, 5000);
            } else {
                showNotification(`Javaのインストールに失敗: ${error.message}`, 'error', notifId, 10000);
            }
        } else if (operation === window.electronAPI.Message.DELETE_SERVER) {
            const serverId = payload?.serverId || error?.details?.serverId;
            if (success) {
                showNotification(`サーバー「${serverId.substring(0, 8)}...」を削除しました。`, 'success');
                if (state.agentServers.has(agentId)) {
                    const updatedServers = state.agentServers.get(agentId).filter(s => s.server_id !== serverId);
                    state.agentServers.set(agentId, updatedServers);
                }
            } else {
                showNotification(`サーバー削除失敗: ${error?.message || 'Unknown error'}`, 'error');
            }
            if (serverId) {
                state.serversBeingDeleted.delete(serverId);
            }
            updateView();
        } else if (operation === window.electronAPI.Message.UPDATE_SERVER || operation === window.electronAPI.Message.UPDATE_SERVER_PROPERTIES) {
            if (success) {
                // サーバー名変更の場合は、具体的なメッセージを表示
                if (payload.config && payload.config.server_name) {
                    showNotification(`サーバー名を「${payload.config.server_name}」に変更しました。`, 'success');
                } else if (payload.config && payload.config.memo !== undefined) {
                    // メモの更新は頻繁に行われる可能性があるため、通知は控えめにするか、または出さない
                    // showNotification('メモを保存しました。', 'success');
                } else {
                    showNotification('設定を保存しました。', 'success');
                }

                // stateのサーバー情報を更新
                if (state.agentServers.has(agentId)) {
                    const server = state.agentServers.get(agentId).find(s => s.server_id === payload.serverId);
                    if (server) {
                        // payload に更新された設定が含まれている想定
                        if (payload.properties) {
                            server.properties = payload.properties;
                        }
                        if (payload.config) {
                            Object.assign(server, payload.config);
                        }
                        updateView();
                    }
                }
            } else {
                showNotification(`設定の保存に失敗しました: ${error.message}`, 'error');
            }
        } else if (operation === window.electronAPI.Message.CONTROL_SERVER) {
            if (!success) {
                const action = payload?.action === 'start' ? '起動' : '停止';
                showNotification(`サーバーの${action}に失敗しました: ${error.message}`, 'error', notifId, 10000);
            }
        }
    });

    // Agentからの警告通知
    window.electronAPI.onNotifyWarn(({ agentId, payload }) => {
        const agent = state.physicalServers.get(agentId);
        const agentName = agent ? agent.config.alias : 'Unknown Agent';
        const message = `<b>[${agentName}]</b><br>サーバーID: ${payload.serverId.substring(0, 8)}...<br>${payload.message}`;
        showNotification(message, 'error', `warn-${payload.serverId}`, 10000);
    });

    // Agentからの操作警告通知 (Javaフォールバックなど)
    window.electronAPI.onOperationWarning(({ agentId, payload }) => {
        const agent = state.physicalServers.get(agentId);
        const agentName = agent ? agent.config.alias : 'Unknown Agent';
        const message = `<b>[${agentName}]</b><br>${payload.message}`;
        showNotification(message, 'warning', `op-warn-${Date.now()}`, 10000);
    });

    // EULA同意要求の受信
    window.electronAPI.onRequireEulaAgreement(({ agentId, requestId, payload }) => {
        const eulaModal = document.getElementById('eula-modal');
        const eulaContentEl = document.getElementById('eula-content');
        const confirmBtn = document.getElementById('confirm-eula-btn');
        const cancelBtn = document.getElementById('cancel-eula-btn');

        eulaContentEl.textContent = payload.eulaContent;

        // ボタンのリスナーを一度クリアしてから再設定
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newConfirmBtn.addEventListener('click', () => {
            window.electronAPI.proxyToAgent(agentId, {
                type: window.electronAPI.Message.ACCEPT_EULA,
                payload: { serverId: payload.serverId }
            });
            eulaModal.classList.add('hidden');
        });

        newCancelBtn.addEventListener('click', () => {
            eulaModal.classList.add('hidden');
            // ユーザーがキャンセルしたことを通知 (任意)
            showNotification('EULAへの同意がキャンセルされました。サーバーは起動されません。', 'info');
        });

        eulaModal.classList.remove('hidden');
    });

    // Minecraftバージョンリストの受信
    window.electronAPI.onMinecraftVersions(({ success, versions, error }) => {
        const versionSelect = document.getElementById('version-select');
        if (success) {
            versions.sort((a, b) => (a.type === 'release' && b.type !== 'release') ? -1 : 1);
            versionSelect.innerHTML = versions.map(v => `<option value="${v.id}">${v.id} (${v.type})</option>`).join('');
        } else {
            versionSelect.innerHTML = `<option value="">バージョン取得失敗</option>`;
            showNotification(`Minecraftバージョン取得失敗: ${error}`, 'error');
        }
    });

    // --- 初期ロードシーケンス ---

    // 1. Mainプロセスからの初期ロード完了通知を待つ
    window.electronAPI.onInitialLoadComplete(() => {
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('app').style.visibility = 'visible';
        updateView();
    });
}