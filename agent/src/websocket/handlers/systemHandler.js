import os from 'os';
import si from 'systeminformation';
import { Message } from '@nl-server-manager/common/protocol.js';
import { getAllServers } from '../../serverManager.js';
import { getSettings } from '../../settingsManager.js';

/**
 * システム情報を取得する
 * @returns {object}
 */
function getSystemInfo() {
  return {
    os: os.platform(), // OSの種類 (例: 'linux', 'win32', 'darwin')
    arch: os.arch(),   // CPUアーキテクチャ (例: 'x64', 'arm64')
    totalRam: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    cpu: os.cpus()[0].model,
  };
}

/**
 * システムメトリクスを取得する
 * @returns {Promise<object>}
 */
async function getMetrics() {
    const servers = getAllServers();
    const runningServers = servers.filter(s => s.status === 'running');
    const stoppedServersCount = servers.length - runningServers.length;
    const totalPlayers = runningServers.reduce((acc, s) => acc + (s.players?.current || 0), 0);

    // systeminformationを使用して実際の値を取得
    const [cpuData, memData, fsData] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize()
    ]);

    // CPU使用率
    const cpuUsage = cpuData.currentLoad.toFixed(2);

    // RAM使用率
    const ramUsage = ((memData.active / memData.total) * 100).toFixed(2);

    // Disk使用率
    const serverDirectory = getSettings().servers_directory;
    const mainDisk = fsData.find(fs => serverDirectory.startsWith(fs.mount));
    const diskUsage = mainDisk ? ((mainDisk.used / mainDisk.size) * 100).toFixed(2) : '0.00';

    return {
        cpuUsage: cpuUsage,
        ramUsage: ramUsage,
        diskUsage: diskUsage,
        networkSpeed: 'N/A', // networkSpeedは一旦N/Aに
        gameServers: {
            running: runningServers.length,
            stopped: stoppedServersCount,
            totalPlayers: totalPlayers,
        },
    };
}

/**
 * システム関連のメッセージを処理するハンドラ
 * @param {import('ws')} ws
 * @param {object} message
 */
export async function handleSystemMessage(ws, message) {
    const { type, requestId } = message;

    switch (type) {
        case Message.GET_SYSTEM_INFO:
            ws.send(JSON.stringify({
                type: Message.SYSTEM_INFO_RESPONSE,
                requestId: requestId,
                payload: {
                    os: process.platform,
                    arch: process.arch
                }
            }));
            break;
        case Message.GET_METRICS:
            {
                const metrics = await getMetrics();
                ws.send(JSON.stringify({ type: Message.METRICS_DATA, payload: metrics }));
            }
            break;
    }
}

// 物理サーバーのメトリクス収集用関数をエクスポート（metricsHandlerで使用）
export { getMetrics };