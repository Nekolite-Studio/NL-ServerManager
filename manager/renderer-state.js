// manager/renderer-state.js

// アプリケーションのUI状態を一元管理するオブジェクト
export const state = {
    // 現在のメインビュー (list | detail | physical | physical-detail)
    currentView: 'list',

    // --- New UI States (v6) ---
    layoutMode: 'accordion', // 'accordion' | 'kanban' | 'treegrid' | 'sidebar' | 'tabs'
    theme: 'dark', // 'dark' | 'light'
    
    // --- Game Servers ---
    // key: agentId, value: Array of server objects
    agentServers: new Map(),
    selectedServerId: null,
    serverToDeleteId: null,
    serversBeingDeleted: new Set(), // 削除処理中のサーバーIDを管理

    // --- Physical Servers (Agents) ---
    // key: agentId, value: agent object { id, config, status, metrics, logs, ... }
    physicalServers: new Map(), 
    selectedPhysicalServerId: null,
    physicalServerToDeleteId: null,

    // --- Detail View States ---
    detailActiveTab: 'console', // console | launch-config | properties | mods | plugins | players | danger
    
    // --- Physical Server Detail View States ---
    physicalServerDetailActiveTab: 'status', // status | servers | settings | logs
    
    // --- Java Installation State ---
    javaInstallAgentId: null,
    javaDownloadOs: null,
    javaDownloadArch: null,
};

// 派生状態（Derived State）を計算するゲッター
export const getters = {
    // すべてのAgentからサーバーリストをフラットな配列として取得
    allServers: () => {
        return Array.from(state.agentServers.values()).flat();
    },
    // 選択されているゲームサーバーオブジェクトを取得
    selectedServer: () => {
        if (!state.selectedServerId) return null;
        const server = getters.allServers().find(s => s.server_id === state.selectedServerId);
        return server;
    },
    // 選択されている物理サーバー（Agent）オブジェクトを取得
    selectedPhysicalServer: () => {
        if (!state.selectedPhysicalServerId) return null;
        return state.physicalServers.get(state.selectedPhysicalServerId);
    },
    // (v6) 新UI用の階層化されたデータ構造を取得
    getUnifiedServerList: () => {
        const unifiedList = [];
        for (const [agentId, agentInfo] of state.physicalServers.entries()) {
            const gameServers = state.agentServers.get(agentId) || [];
            unifiedList.push({
                agentInfo,
                gameServers
            });
        }
        // エイリアス（config.alias）でソート
        return unifiedList.sort((a, b) => {
            const aliasA = a.agentInfo.config.alias.toLowerCase();
            const aliasB = b.agentInfo.config.alias.toLowerCase();
            if (aliasA < aliasB) return -1;
            if (aliasA > aliasB) return 1;
            return 0;
        });
    }
};

// グローバルに公開 (ESMからのアクセス用)
window.state = state;
window.getters = getters;