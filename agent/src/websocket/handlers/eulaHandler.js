import { Message } from '@nl-server-manager/common/protocol.js';
import { acceptEula, startServer } from '../../serverManager.js';
import { getSettings } from '../../settingsManager.js';
import { sendResponse } from '../server.js';

/**
 * EULA関連のメッセージを処理するハンドラ
 * @param {import('ws')} ws
 * @param {object} message
 */
export async function handleEulaMessage(ws, message) {
    const { type, payload, requestId } = message;
    const serversDirectory = getSettings().servers_directory;

    if (type === Message.ACCEPT_EULA) {
        const { serverId } = payload;
        const result = await acceptEula(serversDirectory, serverId);
        if (result.success) {
            // EULA同意に成功したら、再度サーバー起動を試みる
            console.log(`[Agent] EULA accepted for ${serverId}. Retrying start...`);
            // 元のCONTROL_SERVERリクエストと同じrequestIdを再利用する
            const originalRequestId = requestId;
            try {
                const onUpdate = (update) => {
                    ws.send(JSON.stringify({
                        type: Message.SERVER_UPDATE,
                        payload: { serverId, ...update }
                    }));
                };
                await startServer(serversDirectory, serverId, ws, onUpdate);
                sendResponse(ws, originalRequestId, Message.CONTROL_SERVER, true, { serverId, action: 'start' });
            } catch (error) {
                 console.error(`[Agent] Failed to restart server ${serverId} after EULA acceptance:`, error);
                 sendResponse(ws, originalRequestId, Message.CONTROL_SERVER, false, { serverId, action: 'start' }, error.message);
            }
        } else {
            sendResponse(ws, requestId, type, false, { serverId }, result.error || 'Failed to accept EULA.');
        }
    }
}