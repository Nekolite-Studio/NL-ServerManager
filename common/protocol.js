/**
 * @file This file defines the shared communication protocol constants between the Manager and Agent.
 * It serves as the single source of truth for all message types.
 */

export const Message = Object.freeze({
    // Manager -> Agent
    GET_SYSTEM_INFO: 'get-system-info',
    GET_ALL_SERVERS: 'get-all-servers',
    CREATE_SERVER: 'create-server',
    UPDATE_SERVER: 'update-server',
    UPDATE_SERVER_PROPERTIES: 'update-server-properties',
    DELETE_SERVER: 'delete-server',
    CONTROL_SERVER: 'control-server',
    INSTALL_JAVA: 'install-java',
    GET_METRICS: 'get-metrics',
    ACCEPT_EULA: 'accept-eula', // ユーザーがEULAに同意したことを通知
    START_METRICS_STREAM: 'start-metrics-stream',
    STOP_METRICS_STREAM: 'stop-metrics-stream',

    // Agent -> Manager
    SYSTEM_INFO_RESPONSE: 'system-info-response',       // システム情報の応答
    SERVER_LIST_UPDATE: 'server-list-update',           // 全サーバーリストの更新
    SERVER_UPDATE: 'server-update',                     // 個別サーバーの非同期更新 (ステータス変更、ログ追加など)
    METRICS_DATA: 'metrics-data',                       // グローバルなメトリクスデータ（GET_METRICSへの応答）
    GAME_SERVER_METRICS_UPDATE: 'game-server-metrics-update', // ゲームサーバーのメトリクス更新（ストリーム）
    PHYSICAL_SERVER_METRICS_UPDATE: 'physical-server-metrics-update', // 物理サーバーのメトリクス更新（ストリーム）
    OPERATION_RESULT: 'operation-result',               // 要求された操作の最終結果 (成功/失敗)
    PROGRESS_UPDATE: 'progress-update',                 // 時間のかかる操作の進捗更新
    NOTIFY_WARN: 'notify-warn',                         // UIに警告を通知する
    REQUIRE_EULA_AGREEMENT: 'require-eula-agreement',   // EULAへの同意が必要であることを通知

    // IPC (for reference, not for direct WebSocket use)
    RENDERER_READY: 'renderer-ready',
    PROXY_TO_AGENT: 'proxy-to-agent',
});

export const ServerStatus = Object.freeze({
    STOPPED: 'stopped',
    STARTING: 'starting',
    RUNNING: 'running',
    STOPPING: 'stopping',
});
