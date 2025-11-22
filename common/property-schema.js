import { z } from 'zod';

const PORT_MAX = 2 ** 16 - 2;

// z.coerce.boolean() は 'false' を true に変換してしまうため、自前のプリプロセッサを使用
const boolSetter = (def) =>
  z.preprocess(
    (val) => {
        if (typeof val === 'string') {
            if (val.toLowerCase() === 'true') return true;
            if (val.toLowerCase() === 'false') return false;
        }
        return val;
    },
    z.boolean()
  ).default(def).catch(def);

const stringSetter = (def) => z.string().default(def).catch(def);

const enumSetter = (values, def) => z.enum(values).or(z.string()).default(def).catch(def);

const numberSetter = (def, min, max, step) => {
  let schema = z.coerce.number();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  if (step !== undefined) schema = schema.step(step);
  return schema.default(def).catch(def);
};

/**
 * 標準のサーバープロパティ定義
 * zodスキーマとして定義し、型とデフォルト値を指定する
 */
export const DefaultServerProperties = z
  .object({
    'accepts-transfers': boolSetter(false),
    'allow-flight': boolSetter(false),
    'allow-nether': boolSetter(true),
    'broadcast-console-to-ops': boolSetter(true),
    'broadcast-rcon-to-ops': boolSetter(true),
    difficulty: enumSetter(['peaceful', 'easy', 'normal', 'hard'], 'easy'),
    'enable-command-block': boolSetter(false),
    'enable-jmx-monitoring': boolSetter(false),
    'enable-query': boolSetter(false),
    'enable-rcon': boolSetter(false),
    'enable-status': boolSetter(true),
    'enforce-secure-profile': boolSetter(true),
    'enforce-whitelist': boolSetter(false),
    'entity-broadcast-range-percentage': numberSetter(100, 0, 500),
    'force-gamemode': boolSetter(false),
    'function-permission-level': numberSetter(2, 1, 4, 1),
    gamemode: enumSetter(
      ['survival', 'creative', 'adventure', 'spectator'],
      'survival'
    ),
    'generate-structures': boolSetter(true),
    'generator-settings': stringSetter('{}'),
    hardcore: boolSetter(false),
    'hide-online-players': boolSetter(false),
    'level-seed': stringSetter(''),
    'level-type': enumSetter(
      ['default', 'flat', 'largeBiomes', 'amplified', 'buffet'],
      'default'
    ),
    'log-ips': boolSetter(true),
    'max-build-height': numberSetter(256, undefined, undefined, 8),
    'max-chained-neighbor-updates': numberSetter(1000000),
    'max-players': numberSetter(20, 0, 2 ** 31 - 1),
    'max-tick-time': numberSetter(60000, 0, 2 ** 63 - 1),
    'max-world-size': numberSetter(29999984, 1, 29999984),
    motd: stringSetter('A Minecraft Server'),
    'network-compression-threshold': numberSetter(256, -1),
    'online-mode': boolSetter(true),
    'op-permission-level': numberSetter(4, 1, 4, 1),
    'player-idle-timeout': numberSetter(0, 0),
    'prevent-proxy-connections': boolSetter(false),
    'previews-chat': boolSetter(false),
    pvp: boolSetter(true),
    'query.port': numberSetter(25565, 1, PORT_MAX, 1),
    'rate-limit': numberSetter(0, 0),
    'rcon.password': stringSetter(''),
    'rcon.port': numberSetter(25575, 1, PORT_MAX, 1),
    'region-file-compression': enumSetter(
      ['deflate', 'lz4', 'none'],
      'deflate'
    ),
    'resource-pack': stringSetter(''),
    'resource-pack-id': stringSetter(''),
    'resource-pack-prompt': stringSetter(''),
    'resource-pack-sha1': stringSetter(''),
    'require-resource-pack': boolSetter(false),
    'server-ip': stringSetter(''),
    'server-port': numberSetter(25565, 1, PORT_MAX, 1),
    'simulation-distance': numberSetter(10, 3, 32, 1),
    'snooper-enabled': boolSetter(true),
    'spawn-animals': boolSetter(true),
    'spawn-monsters': boolSetter(true),
    'spawn-npcs': boolSetter(true),
    'spawn-protection': numberSetter(16, 0, undefined, 1),
    'sync-chunk-writes': boolSetter(true),
    'text-filtering-config': stringSetter(''),
    'use-native-transport': boolSetter(true),
    'view-distance': numberSetter(10, 2, 32, 1),
    'white-list': boolSetter(false),
  })
  .catchall(z.string().or(z.number()).or(z.boolean()));

/**
 * サーバープロパティのパース用スキーマ
 * デフォルト値で空のオブジェクトを許容する
 */
export const ServerPropertiesSchema = DefaultServerProperties.default({});