// manager/src/services/metricsService.js

const activeMetricsStreams = new Set();

/**
 * メトリクスストリームを開始する
 * @param {string} targetType - 'physicalServer' | 'gameServer'
 * @param {string} targetId - Agent ID or Server ID
 */
export function startMetricsStream(targetType, targetId) {
    const streamId = `${targetType}-${targetId}`;
    if (activeMetricsStreams.has(streamId)) return;

    console.log(`[Metrics] Starting metrics stream for ${streamId}`);
    
    // getters は renderer-state.js で window.getters に公開されている前提
    const agentId = targetType === 'physicalServer' ? targetId : window.getters.allServers().find(s => s.server_id === targetId)?.hostId;
    
    if (!agentId) {
        console.error(`[Metrics] Cannot start stream, agent not found for ${streamId}`);
        return;
    }

    window.electronAPI.proxyToAgent(agentId, {
        type: window.electronAPI.Message.START_METRICS_STREAM,
        payload: { streamId, targetType, targetId }
    });
    activeMetricsStreams.add(streamId);
}

/**
 * メトリクスストリームを停止する
 * @param {string} streamId 
 */
export function stopMetricsStream(streamId) {
    if (!activeMetricsStreams.has(streamId)) return;

    console.log(`[Metrics] Stopping metrics stream for ${streamId}`);
    const [targetType, targetId] = streamId.split('-');
    const agentId = targetType === 'physicalServer' ? targetId : window.getters.allServers().find(s => s.server_id === targetId)?.hostId;

    if (agentId) {
        window.electronAPI.proxyToAgent(agentId, {
            type: window.electronAPI.Message.STOP_METRICS_STREAM,
            payload: { streamId, targetType, targetId }
        });
    }
    activeMetricsStreams.delete(streamId);
}

/**
 * すべてのメトリクスストリームを停止する
 */
export function stopAllMetricsStreams() {
    console.log('[Metrics] Stopping all active metrics streams.');
    // SetをArrayに変換してからループ（ループ内でSetを直接変更するため）
    [...activeMetricsStreams].forEach(streamId => {
        stopMetricsStream(streamId);
    });
}