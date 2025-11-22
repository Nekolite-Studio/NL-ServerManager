import { DefaultServerProperties } from '@nl-server-manager/common/property-schema.js';

/**
 * ZodスキーマからUIで利用するためのアノテーション（メタデータ）を抽出する
 * @param {z.ZodObject} propSchema - DefaultServerProperties スキーマ
 * @returns {Object} - UIで使いやすい形式に変換されたメタデータオブジェクト
 */
function extractPropertyAnnotations(propSchema) {
    const annotations = {};
    const shape = propSchema.shape;

    const propertyDescriptions = {
        'accepts-transfers': 'Allow servers to access them via transfer packets',
        'allow-flight': 'Allows players to use flight on the server.',
        'allow-nether': 'Allows players to travel to the Nether.',
        'broadcast-console-to-ops': 'Broadcasts console output to online operators.',
        'broadcast-rcon-to-ops': 'Broadcasts RCON output to online operators.',
        difficulty: 'Defines the difficulty (such as peaceful, easy, normal, or hard) of the server.',
        'enable-command-block': 'Enables command blocks.',
        'enable-jmx-monitoring': 'Enables JMX monitoring.',
        'enable-query': 'Enables the GameSpy4 protocol server listener. Used to get information about the server.',
        'enable-rcon': 'Enables remote access to the server console.',
        'enable-status': 'Makes the server appear as "online" on the server list.',
        'enforce-secure-profile': 'If set to true, players without a Mojang-signed public key will be unable to connect.',
        'enforce-whitelist': 'Enforces the server whitelist.',
        'entity-broadcast-range-percentage': 'The range of entities to broadcast to players, as a percentage.',
        'force-gamemode': 'Forces players to join in the default gamemode.',
        'function-permission-level': 'Sets the permission level for functions.',
        gamemode: 'Defines the gamemode for new players.',
        'generate-structures': 'Defines whether structures (such as villages) are generated.',
        'generator-settings': 'The settings used to customize world generation.',
        hardcore: 'If set to true, players are set to Spectator mode upon death.',
        'hide-online-players': 'Hides the online player list.',
        'level-seed': 'The seed for the world.',
        'level-type': 'The type of world to be generated.',
        'log-ips': 'Logs player IP addresses.',
        'max-build-height': 'The maximum height for building.',
        'max-chained-neighbor-updates': 'Limits the number of chained neighbor updates.',
        'max-players': 'The maximum number of players that can play on the server at the same time.',
        'max-tick-time': 'The maximum number of milliseconds a single tick may take before the server watchdog stops the server.',
        'max-world-size': 'The maximum radius of the world, in blocks.',
        motd: 'The message that is displayed in the server list of the client, below the server name.',
        'network-compression-threshold': 'The network compression threshold.',
        'online-mode': 'If set to true, all connecting players are authenticated with Mojang.',
        'op-permission-level': 'Sets the permission level for operators.',
        'player-idle-timeout': 'If non-zero, players are kicked from the server if they are idle for the given number of minutes.',
        'prevent-proxy-connections': 'If set to true, players connecting from a proxy or VPN will be kicked.',
        'previews-chat': 'Enables chat previews.',
        pvp: 'Enables PvP on the server.',
        'query.port': 'The port for the query server.',
        'rate-limit': 'The rate limit for clients.',
        'rcon.password': 'The password for RCON.',
        'rcon.port': 'The port for RCON.',
        'region-file-compression': 'The compression algorithm for region files.',
        'resource-pack': 'The URL of the resource pack.',
        'resource-pack-id': 'The ID of the resource pack.',
        'resource-pack-prompt': 'The prompt to display to the client when a resource pack is required.',
        'resource-pack-sha1': 'The SHA-1 hash of the resource pack.',
        'require-resource-pack': 'If set to true, clients are prompted to accept the resource pack.',
        'server-ip': 'The IP address of the server.',
        'server-port': 'The port of the server.',
        'simulation-distance': 'The simulation distance for entities.',
        'snooper-enabled': 'Enables the snoop server.',
        'spawn-animals': 'Determines if animals can spawn.',
        'spawn-monsters': 'Determines if monsters can spawn.',
        'spawn-npcs': 'Determines if NPCs can spawn.',
        'spawn-protection': 'The radius of the spawn protection.',
        'sync-chunk-writes': 'Enables synchronous chunk writes.',
        'text-filtering-config': 'The text filtering configuration.',
        'use-native-transport': 'Uses native transport for Linux.',
        'view-distance': 'The view distance of the server, in chunks.',
        'white-list': 'Enables the server whitelist.',
    };

    const propertyGroups = {
        'ワールド設定': ['level-seed', 'level-type', 'generate-structures', 'generator-settings', 'max-build-height', 'max-world-size', 'allow-nether'],
        'プレイヤー設定': ['gamemode', 'force-gamemode', 'pvp', 'hardcore', 'difficulty', 'allow-flight', 'max-players', 'player-idle-timeout', 'enforce-whitelist', 'white-list', 'hide-online-players'],
        'MOB・NPC設定': ['spawn-animals', 'spawn-monsters', 'spawn-npcs'],
        'サーバー技術設定': ['motd', 'online-mode', 'server-ip', 'server-port', 'network-compression-threshold', 'use-native-transport', 'enable-status', 'log-ips', 'prevent-proxy-connections', 'rate-limit', 'max-tick-time', 'sync-chunk-writes', 'view-distance', 'simulation-distance', 'entity-broadcast-range-percentage', 'max-chained-neighbor-updates', 'spawn-protection'],
        'Query & RCON': ['enable-query', 'query.port', 'enable-rcon', 'rcon.port', 'rcon.password', 'broadcast-rcon-to-ops', 'broadcast-console-to-ops'],
        'その他': ['enable-command-block', 'function-permission-level', 'op-permission-level', 'resource-pack', 'resource-pack-prompt', 'resource-pack-sha1', 'resource-pack-id', 'require-resource-pack', 'previews-chat', 'snooper-enabled', 'text-filtering-config', 'enable-jmx-monitoring', 'region-file-compression', 'accepts-transfers']
    };

    const getGroup = (key) => {
        for (const group in propertyGroups) {
            if (propertyGroups[group].includes(key)) {
                return group;
            }
        }
        return 'その他';
    };

    for (const key in shape) {
        if (Object.hasOwnProperty.call(shape, key)) {
            const schema = shape[key];
            if (!schema._def || !schema._def.innerType) continue;

            const defaultDef = schema._def.innerType._def;
            const innerSchema = defaultDef.innerType;
            const innerDef = innerSchema._def;

            let annotation = {
                key: key,
                description: propertyDescriptions[key] || `(説明未設定) ${key}`,
                group: getGroup(key),
                default: defaultDef.defaultValue,
            };

            if (innerSchema._def.typeName === 'ZodBoolean') {
                annotation.type = 'boolean';
            } else if (innerSchema._def.typeName === 'ZodString') {
                annotation.type = 'string';
                if (innerDef.checks && innerDef.checks.some(c => c.kind === 'enum')) {
                    annotation.enum = innerDef.checks.find(c => c.kind === 'enum').values;
                }
            } else if (innerSchema._def.typeName === 'ZodNumber') {
                annotation.type = 'number';
                innerDef.checks.forEach((check) => {
                    if (check.kind === 'min') annotation.min = check.value;
                    if (check.kind === 'max') annotation.max = check.value;
                    if (check.kind === 'step') annotation.step = check.value;
                });
            } else if (innerSchema._def.typeName === 'ZodEnum') {
                annotation.type = 'enum';
                annotation.enum = innerDef.values;
            } else if (innerSchema._def.typeName === 'ZodEffects' || innerSchema._def.typeName === 'ZodTransformer') {
                const effectSchema = innerDef.schema;
                if (effectSchema._def.typeName === 'ZodBoolean') {
                    annotation.type = 'boolean';
                }
            } else if (innerSchema._def.typeName === 'ZodUnion' && innerDef.options[0]._def.typeName === 'ZodEnum') {
                annotation.type = 'enum';
                annotation.enum = innerDef.options[0]._def.values;
            }

            annotations[key] = annotation;
        }
    }

    return annotations;
}

export const ServerPropertiesAnnotations = extractPropertyAnnotations(DefaultServerProperties);