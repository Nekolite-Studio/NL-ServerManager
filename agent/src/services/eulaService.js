import fs from 'fs';
import path from 'path';
import { resolvePath } from '../utils/storage.js';

/**
 * eula.txtを更新してEULAに同意する
 * @param {string} serversDirectory
 * @param {string} serverId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function acceptEula(serversDirectory, serverId) {
    const serverDir = path.join(resolvePath(serversDirectory), serverId);
    const eulaPath = path.join(serverDir, 'eula.txt');
    try {
        let content = '';
        if (fs.existsSync(eulaPath)) {
            content = fs.readFileSync(eulaPath, 'utf-8');
            if (content.match(/^\s*eula\s*=\s*false\s*$/m)) {
                // `eula=false` を `eula=true` に置換
                content = content.replace(/^\s*eula\s*=\s*false\s*$/m, 'eula=true');
            } else if (!content.match(/^\s*eula\s*=\s*true\s*$/m)) {
                // `eula=true` も `eula=false` もない場合は追記する
                content += '\neula=true\n';
            }
        } else {
            // ファイルが存在しない場合は、EULAのURLを含む内容で新規作成
            content = `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n#\n#${new Date().toString()}\neula=true\n`;
        }

        fs.writeFileSync(eulaPath, content, 'utf-8');
        console.log(`[ServerManager] EULA accepted for server ${serverId}.`);
        return { success: true };
    } catch (error) {
        console.error(`[ServerManager] Failed to write eula.txt for server ${serverId}:`, error);
        return { success: false, error: error.message };
    }
}