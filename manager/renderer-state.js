// データ定義と状態管理、ユーティリティ関数

// --- データ定義 (v5でMod/Pluginを分離) ---
const defaultServerProperties = {
    'spawn-protection': 16, 'max-tick-time': 60000, 'query.port': 25565, 'generator-settings': '', 'force-gamemode': false, 'allow-nether': true, 'enforce-whitelist': false, 'gamemode': 'survival', 'broadcast-console-to-ops': true, 'enable-query': false, 'player-idle-timeout': 0, 'difficulty': 'easy', 'spawn-monsters': true, 'broadcast-rcon-to-ops': true, 'op-permission-level': 4, 'pvp': true, 'snooper-enabled': true, 'level-type': 'default', 'hardcore': false, 'enable-command-block': false, 'max-players': 20, 'network-compression-threshold': 256, 'resource-pack-sha1': '', 'max-world-size': 29999984, 'function-permission-level': 2, 'rcon.port': 25575, 'server-port': 25565, 'server-ip': '', 'spawn-npcs': true, 'allow-flight': false, 'level-name': 'world', 'view-distance': 10, 'resource-pack': '', 'spawn-animals': true, 'white-list': false, 'rcon.password': '', 'generate-structures': true, 'max-build-height': 256, 'online-mode': true, 'level-seed': '', 'prevent-proxy-connections': false, 'use-native-transport': true, 'enable-rcon': false, 'motd': 'A Minecraft Server'
};

const state = {
    servers: [
        // This is game server data, we leave it for now.
        // We need to figure out how to link hostId to the new physical server IDs (UUIDs).
        { id: 1, hostId: 1, name: 'バニラサバイバル', status: 'stopped', memo: '友人とのんびり遊ぶためのサーバーです。\nMODは入れていません。\n\nこれは3行目です。\nこれは4行目です。', players: { current: 0, max: 32, list: [], recent: ['Player1', 'Player2', 'Steve'] }, tps: 0.0, cpu: 0.0, memory: 0, memoryMax: 8192, logs: ['[12:34:56] [Server thread/INFO]: Player1 joined the game', '[12:34:58] [Server thread/INFO]: Player2 joined the game', '[12:35:01] [INFO]: Steve fell from a high place', '[12:35:15] [INFO]: Player1 reached advancement [Stone Age]', '[12:35:20] [INFO]: Player2 reached advancement [Getting an Upgrade]'], properties: { ...defaultServerProperties }, installedMods: [], installedPlugins: [{ id: 'plugin1', name: 'WorldEdit-Bukkit-7.2.10.jar', size: '2.8MB', enabled: true }] },
        { id: 2, hostId: 1, name: 'MODてんこ盛りサーバー (Fabric)', status: 'stopped', memo: '工業、魔術、建築など、様々なMODを導入しています。\nメモリ割り当ては多めに設定してください。\n\nこれは3行目です。\nこれは4行目です。\nこれは5行目です。\nこれは6行目です。\nこれは7行目です。\nこれは8行目です。\nこれは9行目です。', players: { current: 0, max: 20, list: [], recent: ['TechnoMage', 'BuilderPro', 'MagicGirl'] }, tps: 0.0, cpu: 0.0, memory: 0, memoryMax: 16384, logs: ['[20:10:05] [Server thread/INFO]: Stopping server', '[20:10:04] [Server thread/INFO]: Saving chunks', '[20:10:02] [INFO]: TechnoMage left the game'], properties: { ...defaultServerProperties, 'gamemode': 'creative', 'difficulty': 'normal', 'allow-flight': true }, installedMods: [{ id: 'mod2', name: 'journeymap-1.19.2-5.9.0-fabric.jar', size: '3.5MB', enabled: true }, { id: 'mod3', name: 'jei-1.19.2-fabric-11.5.0.298.jar', size: '980KB', enabled: false }], installedPlugins: [] },
        { id: 3, hostId: 2, name: 'クリエイティブ建築ワールド (Paper)', status: 'stopped', memo: '巨大建築プロジェクト進行中！\n誰でも参加OKです。', players: { current: 0, max: 50, list: [], recent: ['Architector', 'PixelArtist', 'Redstoner'] }, tps: 0.0, cpu: 0.0, memory: 0, memoryMax: 8192, logs: ['[18:00:11] [Server thread/INFO]: Architector joined the game', '[18:00:25] [Server thread/INFO]: PixelArtist joined the game', '[18:01:00] [INFO]: Weather set to clear'], properties: { ...defaultServerProperties, 'gamemode': 'creative', 'pvp': false, 'spawn-monsters': false }, installedMods: [], installedPlugins: [] },
    ],
    physicalServers: new Map(), // Will be populated from main process
    currentView: 'physical', // 'list', 'detail', 'physical', 'physical-detail'
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