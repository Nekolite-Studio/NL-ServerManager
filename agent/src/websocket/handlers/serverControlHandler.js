import { Message } from '@nl-server-manager/common/protocol.js';
import {
    createServer,
    updateServer,
    deleteServer,
    startServer,
    stopServer,
    updateServerProperties,
} from '../../serverManager.js';
import { getSettings } from '../../settingsManager.js';
import { sendResponse, sendProgress, broadcastServerListUpdate } from '../server.js';

/**
 * サーバー操作関連のメッセージを処理するハンドラ
 * @param {import('ws')} ws
 * @param {object} message
 */
export async function handleServerControlMessage(ws, message) {
    const { type, payload, requestId } = message;
    const serversDirectory = getSettings().servers_directory;

    switch (type) {
        case Message.CREATE_SERVER:
            {
                try {
                    const onProgress = (progressPayload) => {
                        sendProgress(ws, requestId, type, progressPayload);
                    };
                    const result = await createServer(serversDirectory, payload, onProgress);
                    sendResponse(ws, requestId, type, true, { ...result.config, path: result.path });
                    broadcastServerListUpdate();
                } catch (error) {
                    console.error(`[Agent] Failed to create server:`, error);
                    sendResponse(ws, requestId, type, false, null, error.message || 'An unknown error occurred during server creation.');
                }
            }
            break;

        case Message.UPDATE_SERVER:
            {
                const { serverId, config } = payload;
                const result = await updateServer(serversDirectory, serverId, config);
                if (result && result.config) {
                    // 更新後の完全な設定オブジェクトをペイロードに含める
                    sendResponse(ws, requestId, type, true, { serverId, config: result.config });
                    broadcastServerListUpdate();
                } else {
                    sendResponse(ws, requestId, type, false, { serverId }, 'Failed to update server.');
                }
            }
            break;

        case Message.UPDATE_SERVER_PROPERTIES:
            {
                const { serverId, properties } = payload;
                const result = await updateServerProperties(serversDirectory, serverId, properties);
                if (result.success) {
                    sendResponse(ws, requestId, type, true, { serverId, properties: result.properties });
                    // server.propertiesの変更はリスト表示には影響しないため、ブロードキャストは不要
                } else {
                    sendResponse(ws, requestId, type, false, { serverId }, result.error);
                }
            }
            break;

        case Message.DELETE_SERVER:
            {
                const { serverId } = payload;
                const result = await deleteServer(serversDirectory, serverId);
                sendResponse(ws, requestId, type, result.success, { serverId, path: result.path }, result.error || (result.success ? null : 'Failed to delete server.'));
                if (result.success) {
                    broadcastServerListUpdate();
                }
            }
            break;

        case Message.CONTROL_SERVER:
            {
                const { serverId, action } = payload;
                console.log(`Received control request for server ${serverId}: ${action}`);
                try {
                    const onUpdate = (update) => {
                        ws.send(JSON.stringify({
                            type: Message.SERVER_UPDATE,
                            payload: { serverId, ...update }
                        }));
                    };

                    if (action === 'start') {
                        await startServer(serversDirectory, serverId, ws, onUpdate);
                        sendResponse(ws, requestId, type, true, { serverId, action: 'start' });
                    } else if (action === 'stop') {
                        await stopServer(serverId, onUpdate);
                        sendResponse(ws, requestId, type, true, { serverId, action: 'stop' });
                    } else {
                        throw new Error(`Unknown server control action: ${action}`);
                    }
                } catch (error) {
                    if (action === 'start' && error.code === 'EULA_NOT_ACCEPTED') {
                        // EULA未同意の場合はエラーではなく、通常のフローとして扱う
                        console.log(`[Agent] EULA not accepted for server ${serverId}. Requesting agreement from manager.`);
                        ws.send(JSON.stringify({
                            type: Message.REQUIRE_EULA_AGREEMENT,
                            requestId: requestId,
                            payload: {
                                serverId: serverId,
                                eulaContent: error.eulaContent
                            }
                        }));
                        // この時点では失敗応答はせず、ユーザーの操作を待つ
                    } else {
                        // その他の予期せぬエラー
                        console.error(`[Agent] Failed to execute action '${action}' for server ${serverId}:`, error);
                        if (action === 'start') {
                            ws.send(JSON.stringify({
                                type: Message.SERVER_UPDATE,
                                payload: { serverId, type: 'status_change', payload: 'stopped' }
                            }));
                            ws.send(JSON.stringify({
                                type: Message.NOTIFY_WARN,
                                payload: { serverId, message: `サーバーの起動に失敗しました。<br>詳細: ${error.message}` }
                            }));
                        }
                        sendResponse(ws, requestId, type, false, { serverId, action }, error.message);
                    }
                }
            }
            break;
    }
}