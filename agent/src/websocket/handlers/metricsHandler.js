import { WebSocket } from 'ws';
import { Message } from '@nl-server-manager/common/protocol.js';
import { startMetricsStream as startGameServerMetricsStream, stopMetricsStream as stopGameServerMetricsStream } from '../../services/metricsService.js';
import { getMetrics } from './systemHandler.js';

// 物理サーバーのメトリクス収集を管理
const physicalServerMetricsIntervals = new Map();

/**
 * メトリクス関連のメッセージを処理するハンドラ
 * @param {import('ws')} ws
 * @param {object} message
 */
export function handleMetricsMessage(ws, message) {
    const { type, payload } = message;

    switch (type) {
        case Message.START_METRICS_STREAM:
            {
                const { streamId, targetType, targetId } = payload;
                if (targetType === 'gameServer') {
                    startGameServerMetricsStream(ws, targetId);
                } else if (targetType === 'physicalServer') {
                    if (physicalServerMetricsIntervals.has(streamId)) {
                        console.log(`[Agent] Physical server metrics stream ${streamId} is already running.`);
                        return;
                    }
                    console.log(`[Agent] Starting physical server metrics stream ${streamId}.`);
                    const intervalId = setInterval(async () => {
                        try {
                            const metrics = await getMetrics();
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: Message.PHYSICAL_SERVER_METRICS_UPDATE, payload: metrics }));
                            } else {
                                clearInterval(intervalId);
                                physicalServerMetricsIntervals.delete(streamId);
                            }
                        } catch (error) {
                            console.error(`[Agent] Error getting physical server metrics:`, error);
                        }
                    }, 1000);
                    physicalServerMetricsIntervals.set(streamId, intervalId);
                }
            }
            break;

        case Message.STOP_METRICS_STREAM:
            {
                const { streamId, targetType, targetId } = payload;
                if (targetType === 'gameServer') {
                    stopGameServerMetricsStream(targetId);
                } else if (targetType === 'physicalServer') {
                    if (physicalServerMetricsIntervals.has(streamId)) {
                        console.log(`[Agent] Stopping physical server metrics stream ${streamId}.`);
                        clearInterval(physicalServerMetricsIntervals.get(streamId));
                        physicalServerMetricsIntervals.delete(streamId);
                    }
                }
            }
            break;
    }
}

/**
 * 切断時に物理サーバーのメトリクスストリームを停止する
 */
export function stopAllPhysicalMetricsStreams() {
    physicalServerMetricsIntervals.forEach((intervalId, streamId) => {
        console.log(`[Agent] Stopping physical server metrics stream ${streamId} due to disconnect.`);
        clearInterval(intervalId);
        physicalServerMetricsIntervals.delete(streamId);
    });
}