import { Message } from '@nl-server-manager/common/protocol.js';
import { getAllServers } from '../../serverManager.js';

/**
 * サーバーリスト関連のメッセージを処理するハンドラ
 * @param {import('ws')} ws
 * @param {object} message
 */
export function handleServerListMessage(ws, message) {
    const { type } = message;

    if (type === Message.GET_ALL_SERVERS) {
        ws.send(JSON.stringify({ type: Message.SERVER_LIST_UPDATE, payload: getAllServers() }));
    }
}