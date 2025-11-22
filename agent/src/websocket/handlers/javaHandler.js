import os from 'os';
import path from 'path';
import fs from 'fs';
import { Message } from '@nl-server-manager/common/protocol.js';
import {
    getJavaInstallDir,
    extractArchive,
    getJavaExecutablePath,
    downloadFile,
} from '../../serverManager.js';
import { sendResponse, sendProgress } from '../server.js';

/**
 * Java関連のメッセージを処理するハンドラ
 * @param {import('ws')} ws
 * @param {object} message
 */
export async function handleJavaMessage(ws, message) {
    const { type, payload, requestId } = message;

    if (type === Message.INSTALL_JAVA) {
        const { version: javaVersion, downloadUrl } = payload;

        try {
            const installDir = getJavaInstallDir(javaVersion);
            const archivePath = path.join(os.tmpdir(), `java-archive-${javaVersion}${path.extname(downloadUrl)}`);

            const onProgress = (progress, downloaded, total) => {
                const message = `Java ${javaVersion} をダウンロード中... ${progress}%`;
                sendProgress(ws, requestId, type, { status: 'downloading', message, progress });
            };

            sendProgress(ws, requestId, type, { status: 'downloading', message: `Java ${javaVersion} のダウンロード準備中...`, progress: 0 });
            await downloadFile(downloadUrl, archivePath, onProgress);

            const onExtractProgress = (progressPayload) => {
                // 展開処理は詳細な%進捗が取れないため、progress: 100 のままとする
                sendProgress(ws, requestId, type, { ...progressPayload, progress: 100 });
            };
            await extractArchive(archivePath, installDir, onExtractProgress);

            const javaExecutable = getJavaExecutablePath(installDir);
            fs.unlinkSync(archivePath);
            
            sendResponse(ws, requestId, type, true, { javaVersion, installDir, javaExecutable });

        } catch (error) {
            console.error(`[Agent] Failed to install Java ${javaVersion}:`, error);
            sendResponse(ws, requestId, type, false, { javaVersion }, error.message);
        }
    }
}