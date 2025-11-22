import { WebSocketServer, WebSocket } from 'ws';
import { Message } from '@nl-server-manager/common/protocol.js';
import { getAllServers } from '../serverManager.js';
import { handleSystemMessage } from './handlers/systemHandler.js';
import { handleServerListMessage } from './handlers/serverListHandler.js';
import { handleServerControlMessage } from './handlers/serverControlHandler.js';
import { handleMetricsMessage, stopAllPhysicalMetricsStreams } from './handlers/metricsHandler.js';
import { handleJavaMessage } from './handlers/javaHandler.js';
import { handleEulaMessage } from './handlers/eulaHandler.js';

let wss;

/**
 * WebSocketサーバーを初期化する
 * @param {number} port
 */
export function initializeWebSocketServer(port) {
    wss = new WebSocketServer({ port });

    console.log(`Agent WebSocket server started on port ${port}`);

    wss.on('connection', (ws) => {
        console.log('Manager connected.');

        // 接続時に現在のサーバーリストを送信
        ws.send(JSON.stringify({ type: Message.SERVER_LIST_UPDATE, payload: getAllServers() }));

        ws.on('message', async (message) => {
            let parsedMessage;
            try {
                parsedMessage = JSON.parse(message.toString());
            } catch (e) {
                console.error('Failed to parse incoming message:', message.toString());
                return;
            }

            console.log('Received message from manager:', parsedMessage);
            const { type } = parsedMessage;

            // メッセージタイプに基づいて適切なハンドラにルーティング
            try {
                switch (type) {
                    case Message.GET_SYSTEM_INFO:
                    case Message.GET_METRICS:
                        await handleSystemMessage(ws, parsedMessage);
                        break;

                    case Message.GET_ALL_SERVERS:
                        handleServerListMessage(ws, parsedMessage);
                        break;

                    case Message.CREATE_SERVER:
                    case Message.UPDATE_SERVER:
                    case Message.UPDATE_SERVER_PROPERTIES:
                    case Message.DELETE_SERVER:
                    case Message.CONTROL_SERVER:
                        await handleServerControlMessage(ws, parsedMessage);
                        break;

                    case Message.START_METRICS_STREAM:
                    case Message.STOP_METRICS_STREAM:
                        handleMetricsMessage(ws, parsedMessage);
                        break;

                    case Message.INSTALL_JAVA:
                        await handleJavaMessage(ws, parsedMessage);
                        break;

                    case Message.ACCEPT_EULA:
                        await handleEulaMessage(ws, parsedMessage);
                        break;

                    default:
                        console.log(`Unknown message type: ${type}`);
                        ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown message type: ${type}` } }));
                }
            } catch (error) {
                console.error(`Error handling message type ${type}:`, error);
                ws.send(JSON.stringify({ type: 'error', payload: { message: `Internal server error processing ${type}` } }));
            }
        });

        ws.on('close', () => {
            console.log('Manager disconnected.');
            stopAllPhysicalMetricsStreams();
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
    });
}

// --- ヘルパー関数 ---

/**
 * 接続しているすべてのManagerにブロードキャストする
 * @param {object} message
 */
export function broadcast(message) {
    if (!wss) return;
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

/**
 * リクエスト元に応答を返す
 * @param {import('ws')} ws
 * @param {string} requestId
 * @param {string} operation
 * @param {boolean} success
 * @param {any} payload
 * @param {string} error
 */
export function sendResponse(ws, requestId, operation, success, payload, error) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        type: Message.OPERATION_RESULT,
        requestId,
        operation,
        success,
        payload: success ? payload : undefined,
        error: !success ? { message: error, details: payload } : undefined,
    }));
}

/**
 * 進捗をリクエスト元に通知する
 * @param {import('ws')} ws
 * @param {string} requestId
 * @param {string} operation
 * @param {any} payload
 */
export function sendProgress(ws, requestId, operation, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        type: Message.PROGRESS_UPDATE,
        requestId,
        operation,
        payload,
    }));
}

/**
 * サーバーリストの更新を全Managerに通知する
 */
export function broadcastServerListUpdate() {
    const allServers = getAllServers();
    broadcast({ type: Message.SERVER_LIST_UPDATE, payload: allServers });
}