import os from 'os';
import si from 'systeminformation';
import pidusage from 'pidusage'; // 追加
import { Message } from '@nl-server-manager/common/protocol.js';
import { getAllServers, runningProcesses } from '../../serverManager.js';
import { getSettings } from '../../settingsManager.js';

// CPU使用率計算用の前回の状態を保持
let previousCpus = os.cpus();

/**
 * OSネイティブ機能を使ってCPU使用率を計算する (非常に軽量)
 */
function getSystemCpuUsage() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (let i = 0; i < cpus.length; i++) {
        const cpu = cpus[i];
        const prevCpu = previousCpus[i];

        for (const type in cpu.times) {
            total += cpu.times[type] - prevCpu.times[type];
        }
        idle += cpu.times.idle - prevCpu.times.idle;
    }

    previousCpus = cpus;
    return total === 0 ? 0 : ((1 - idle / total) * 100).toFixed(2);
}

/**
 * システム情報を取得する (静的情報)
 */
function getSystemInfo() {
  return {
    os: os.platform(),
    arch: os.arch(),
    totalRam: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    cpu: os.cpus()[0].model,
  };
}

/**
 * システムメトリクスを取得する (軽量化版)
 */
async function getMetrics() {
    const servers = getAllServers();
    const runningServers = servers.filter(s => s.status === 'running');
    const stoppedServersCount = servers.length - runningServers.length;
    const totalPlayers = runningServers.reduce((acc, s) => acc + (s.players?.current || 0), 0);

    // 1. CPU使用率 (osモジュールで計算)
    const cpuUsage = getSystemCpuUsage();

    // 2. RAM使用率 (osモジュール)
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = ((usedMem / totalMem) * 100).toFixed(2);

    // 3. DiskとNetwork
    const [fsData, networkData] = await Promise.all([
        si.fsSize(),
        si.networkStats()
    ]);

    // Disk使用率
    const serverDirectory = getSettings().servers_directory;
    const mainDisk = fsData.find(fs => serverDirectory.startsWith(fs.mount)) || fsData[0];
    const diskUsage = mainDisk ? ((mainDisk.used / mainDisk.size) * 100).toFixed(2) : '0.00';

    // Network Speed
    const totalRx = networkData.reduce((acc, iface) => acc + iface.rx_sec, 0);
    const totalTx = networkData.reduce((acc, iface) => acc + iface.tx_sec, 0);
    const networkSpeed = ((totalRx + totalTx) * 8 / 1024 / 1024).toFixed(2);

    // 4. Game Server Process Metrics
    const gameServerMetrics = [];
    const pids = [];
    const serverIdMap = new Map();

    // 実行中のPIDリストを作成
    for (const [serverId, process] of runningProcesses.entries()) {
        if (process && process.pid) {
            pids.push(process.pid);
            serverIdMap.set(process.pid, serverId);
        }
    }

    if (pids.length > 0) {
        try {
            const stats = await pidusage(pids);
            // stats は { pid: { cpu, memory, ... } } の形式
            for (const [pidStr, stat] of Object.entries(stats)) {
                const pid = parseInt(pidStr, 10);
                const serverId = serverIdMap.get(pid);
                if (serverId) {
                    gameServerMetrics.push({
                        serverId: serverId,
                        cpu: stat.cpu.toFixed(1),
                        mem: (stat.memory / 1024 / 1024).toFixed(0) // MB
                    });
                }
            }
        } catch (e) {
            console.warn('[SystemHandler] pidusage error:', e.message);
        }
    }

    return {
        cpuUsage,
        ramUsage,
        diskUsage,
        networkSpeed,
        gameServers: {
            running: runningServers.length,
            stopped: stoppedServersCount,
            totalPlayers: totalPlayers,
            details: gameServerMetrics
        },
    };
}

export async function handleSystemMessage(ws, message) {
    const { type, requestId } = message;

    switch (type) {
        case Message.GET_SYSTEM_INFO:
            ws.send(JSON.stringify({
                type: Message.SYSTEM_INFO_RESPONSE,
                requestId: requestId,
                payload: getSystemInfo()
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

export { getMetrics };