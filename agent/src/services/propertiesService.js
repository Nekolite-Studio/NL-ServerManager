import fs from 'fs';
import path from 'path';
import { ServerPropertiesSchema } from '@nl-server-manager/common/property-schema.js';
import { readJson, writeJson } from '../utils/storage.js';
import { servers } from './serverConfigService.js';

const SERVER_CONFIG_FILENAME = 'nl-server_manager.json';

/**
 * server.propertiesファイルをオブジェクトとして読み込む
 * @param {string} serverPath
 * @returns {Promise<Object>}
 */
export async function readProperties(serverPath) {
    const propertiesPath = path.join(serverPath, 'server.properties');
    try {
        const data = await fs.promises.readFile(propertiesPath, 'utf-8');
        const properties = {};
        data.split('\n').forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    properties[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return properties;
    } catch (error) {
        if (error.code === 'ENOENT') return {}; // ファイルがなければ空オブジェクト
        throw error;
    }
}

/**
 * オブジェクトを server.properties ファイルに書き込む
 * @param {string} serverPath
 * @param {Object} properties
 */
export async function writeProperties(serverPath, properties) {
    const propertiesPath = path.join(serverPath, 'server.properties');
    const data = Object.entries(properties)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    await fs.promises.writeFile(propertiesPath, data);
}

/**
 * サーバーのプロパティを更新する
 * @param {string} serversDirectory
 * @param {string} serverId
 * @param {Object} newProperties
 */
export async function updateServerProperties(serversDirectory, serverId, newProperties) {
    const serverPath = path.join(serversDirectory, serverId);
    const serverConfigPath = path.join(serverPath, SERVER_CONFIG_FILENAME);

    try {
        const server = await readJson(serverConfigPath);

        // 新しいプロパティを既存のものとマージ
        const mergedProperties = { ...(server.properties || {}), ...newProperties };

        // スキーマでパースして不要なプロパティを削除し、型を変換
        const validatedProperties = ServerPropertiesSchema.parse(mergedProperties);

        server.properties = validatedProperties;

        // nl-server_manager.jsonを更新
        await writeJson(serverConfigPath, server);

        // server.properties ファイルを更新
        await writeProperties(serverPath, validatedProperties);

        // メモリ上のキャッシュも更新
        servers.set(serverId, server);

        return { success: true, properties: validatedProperties };
    } catch (error) {
        console.error(`[Agent] Failed to update properties for server ${serverId}:`, error);
        return { success: false, error: error.message };
    }
}