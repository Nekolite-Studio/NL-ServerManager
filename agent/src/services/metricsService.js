import si from 'systeminformation';
import { Message } from '@nl-server-manager/common/protocol.js';
import { getServer, getMaxMemoryFromConfig } from './serverConfigService.js';
import { runningProcesses, runningRconClients } from './lifecycleService.js';

// 実行中のメトリクス収集インターバルを管理する
const metricsIntervals = new Map();

/**
 * RCON経由でサーバーからTPSとプレイヤー数を取得する
 * @param {string} serverId
 * @returns {Promise<object>}
 */
async function getGameServerMetrics(serverId) {
    const rcon = runningRconClients.get(serverId);
    if (!rcon) {
        return { tps: 0, players: { current: 0, max: 20, list: [] } };
    }

    try {
        const [tpsResponse, listResponse] = await Promise.all([
            rcon.send('/tps'),
            rcon.send('/list')
        ]);

        // TPSのパース
        let tps = 0;
        const tpsMatch = tpsResponse.match(/TPS from last 1m, 5m, 15m: ([\d\.]+), ([\d\.]+), ([\d\.]+)/);
        if (tpsMatch && tpsMatch[1]) {
            // PaperMCの場合、tpsが20.0*のようにアスタリスクが付くことがある
            tps = parseFloat(tpsMatch[1].replace('*', ''));
        }

        // プレイヤー数のパース
        let currentPlayers = 0;
        let maxPlayers = 20; // デフォルト値
        const listMatch = listResponse.match(/There are ([\d]+) of a max of ([\d]+) players online:/);
        if (listMatch) {
            currentPlayers = parseInt(listMatch[1], 10);
            maxPlayers = parseInt(listMatch[2], 10);
        }

        return {
            tps: tps,
            players: {
                current: currentPlayers,
                max: maxPlayers,
                list: [], // TODO: プレイヤーリストのパース
            }
        };

    } catch (error) {
        console.warn(`[ServerManager] Failed to get metrics via RCON for server ${serverId}:`, error.message);
        // RCONがタイムアウトした場合など
        return { tps: 0, players: { current: 0, max: 20, list: [] } };
    }
}

/**
 * 指定されたゲームサーバーのメトリクス収集ストリームを開始する
 * @param {import('ws')} ws - WebSocketクライアント
 * @param {string} serverId - サーバーID
 */
export function startMetricsStream(ws, serverId) {
    if (metricsIntervals.has(serverId)) {
        console.log(`[ServerManager] Metrics stream for server ${serverId} is already running.`);
        return;
    }

    console.log(`[ServerManager] Starting metrics stream for server ${serverId}.`);

    let isCollecting = false;
    const intervalId = setInterval(async () => {
        if (isCollecting) return;
        isCollecting = true;

        try {
            const process = runningProcesses.get(serverId);
            if (!process) {
                stopMetricsStream(serverId);
                return;
            }

            const processInfo = await si.processes();
            const serverProcess = processInfo.list.find(p => p.pid === process.pid);
            const gameMetrics = await getGameServerMetrics(serverId);

            if (ws && ws.readyState === 1) {
                const serverConfig = getServer(serverId);
                const metrics = {
                    serverId: serverId,
                    cpu: serverProcess ? serverProcess.cpu : 0,
                    memory: serverProcess ? Math.round(serverProcess.memRss / 1024) : 0,
                    memoryMax: getMaxMemoryFromConfig(serverConfig),
                    ...gameMetrics,
                };
                ws.send(JSON.stringify({ type: Message.GAME_SERVER_METRICS_UPDATE, payload: metrics }));
            } else {
                stopMetricsStream(serverId);
            }
        } catch (err) {
            console.error(`[ServerManager] Failed to collect metrics for server ${serverId}:`, err);
        } finally {
            isCollecting = false; // ロック解除
        }
    }, 500); 

    metricsIntervals.set(serverId, intervalId);
}

/**
 * 指定されたゲームサーバーのメトリクス収集ストリームを停止する
 * @param {string} serverId - サーバーID
 */
export function stopMetricsStream(serverId) {
    if (metricsIntervals.has(serverId)) {
        console.log(`[ServerManager] Stopping metrics stream for server ${serverId}.`);
        clearInterval(metricsIntervals.get(serverId));
        metricsIntervals.delete(serverId);
    }
}

// 状態管理用のMapを共有
export { metricsIntervals };