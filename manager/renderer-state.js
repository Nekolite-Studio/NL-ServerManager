// データ定義と状態管理、ユーティリティ関数

// --- データ定義 (v5でMod/Pluginを分離) ---
const defaultServerProperties = {
    'spawn-protection': 16, 'max-tick-time': 60000, 'query.port': 25565, 'generator-settings': '', 'force-gamemode': false, 'allow-nether': true, 'enforce-whitelist': false, 'gamemode': 'survival', 'broadcast-console-to-ops': true, 'enable-query': false, 'player-idle-timeout': 0, 'difficulty': 'easy', 'spawn-monsters': true, 'broadcast-rcon-to-ops': true, 'op-permission-level': 4, 'pvp': true, 'snooper-enabled': true, 'level-type': 'default', 'hardcore': false, 'enable-command-block': false, 'max-players': 20, 'network-compression-threshold': 256, 'resource-pack-sha1': '', 'max-world-size': 29999984, 'function-permission-level': 2, 'rcon.port': 25575, 'server-port': 25565, 'server-ip': '', 'spawn-npcs': true, 'allow-flight': false, 'level-name': 'world', 'view-distance': 10, 'resource-pack': '', 'spawn-animals': true, 'white-list': false, 'rcon.password': '', 'generate-structures': true, 'max-build-height': 256, 'online-mode': true, 'level-seed': '', 'prevent-proxy-connections': false, 'use-native-transport': true, 'enable-rcon': false, 'motd': 'A Minecraft Server'
};

const state = {
    physicalServers: new Map(), // Will be populated from main process
    agentServers: new Map(), // key: agentId, value: [server1, server2, ...]

    get servers() {
        return Array.from(this.agentServers.values()).flat();
    },

    currentView: 'list', // 'list', 'detail', 'physical', 'physical-detail'
    selectedServerId: null,
    selectedPhysicalServerId: null,
    serverToDeleteId: null,
    physicalServerToDeleteId: null,
    detailActiveTab: 'basic', // v5: basic, mods, plugins, players, danger
    physicalServerDetailActiveTab: 'status', // 'status', 'settings', 'logs'
    detailBasicActiveSubTab: 'log',
};

// --- ユーティリティ関数 (v4と同じ) ---
const getStatusClasses = (status) => {
    if (status === 'running') return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20' };
    return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20' };
};
// New status classes for agent connection status
const getAgentStatusClasses = (status) => {
    switch (status) {
        case 'Connected':
            return { text: 'text-green-800 dark:text-green-200', bg: 'bg-green-100 dark:bg-green-900', dot: 'bg-green-500' };
        case 'Connecting...':
            return { text: 'text-yellow-800 dark:text-yellow-200', bg: 'bg-yellow-100 dark:bg-yellow-900', dot: 'bg-yellow-500 animate-pulse' };
        case 'Disconnected':
        default:
            return { text: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900', dot: 'bg-red-500' };
    }
};
const getTpsColor = (tps) => tps >= 19 ? 'text-green-500' : tps >= 15 ? 'text-yellow-500' : 'text-red-500';
const getCpuColor = (cpu) => cpu >= 80 ? 'text-red-500' : cpu >= 50 ? 'text-yellow-500' : 'text-green-500';
const getMemoryColor = (mem, max) => (mem/max) >= 0.8 ? 'text-red-500' : (mem/max) >= 0.5 ? 'text-yellow-500' : 'text-green-500';