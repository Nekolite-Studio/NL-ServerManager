import axios from 'axios';

// --- Java Version Detection ---
const MANIFEST_URL_V2 = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

/**
 * リリース日時に基づいてJavaバージョンを判定するフォールバック関数
 * @param {Date} date
 * @returns {number}
 */
function detectJavaByDate(date) {
    if (date < new Date("2021-06-08T00:00:00Z")) return 8;   // 1.16.5まで
    if (date < new Date("2021-11-30T00:00:00Z")) return 16;  // 1.17.x
    if (date < new Date("2024-04-23T00:00:00Z")) return 17;  // 1.18〜1.20.4
    return 21;                                               // 1.20.5+
}

/**
 * 指定されたMinecraftバージョンに必要なJavaのメジャーバージョンを取得する
 * @param {string} mcVersion
 * @returns {Promise<number>}
 */
async function getRequiredJavaVersion(mcVersion) {
    const manifest = (await axios.get(MANIFEST_URL_V2)).data;
    const entry = manifest.versions.find(v => v.id === mcVersion);
    if (!entry) throw new Error(`Version not found in manifest: ${mcVersion}`);

    const versionJson = (await axios.get(entry.url)).data;

    if (versionJson.javaVersion && versionJson.javaVersion.majorVersion) {
        return versionJson.javaVersion.majorVersion;
    }

    const releaseTime = new Date(entry.releaseTime);
    return detectJavaByDate(releaseTime);
}

/**
 * Adoptium APIからJavaのダウンロード情報を取得する
 * @param {number} feature_version
 * @param {string} os
 * @param {string} arch
 * @returns {Promise<{success: boolean, downloadLink?: string, fileSize?: number, error?: string}>}
 */
async function getJavaDownloadInfo(feature_version, os, arch) {
    try {
        const jvm_impl = 'hotspot';
        const image_type = 'jdk';
        const vendor = 'eclipse';

        const apiUrl = `https://api.adoptium.net/v3/assets/latest/${feature_version}/${jvm_impl}`;
        const response = await axios.get(apiUrl, {
            params: {
                os,
                architecture: arch,
                image_type,
                vendor
            }
        });

        const release = response.data[0]; // 最初のリリースを取得

        if (release && release.binary && release.binary.package) {
            const downloadLink = release.binary.package.link;
            const fileSize = release.binary.package.size;
            console.log(`Java Download Info: URL=${downloadLink}, Size=${fileSize}`);
            return { success: true, downloadLink, fileSize };
        } else {
            console.warn('No download link or file size found in Adoptium API response.');
            return { success: false, error: 'Download information not found.' };
        }
    } catch (error) {
        console.error('Error fetching Java download info from Adoptium API:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mojangのバージョンマニフェストを取得する
 * @returns {Promise<Array>}
 */
async function fetchMinecraftVersions() {
    try {
        const response = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        return response.data.versions;
    } catch (error) {
        console.error('Failed to fetch Minecraft versions with axios:', error);
        // エラーを呼び出し元に伝播させる
        throw new Error(error.response?.data?.error || error.message || 'Unknown error fetching versions');
    }
}

/**
 * Forgeのバージョン情報を取得する
 * @returns {Promise<{success: boolean, promotions?: object, error?: string}>}
 */
async function getForgeVersions() {
    try {
        const response = await axios.get('https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json');
        return { success: true, promotions: response.data.promos };
    } catch (error) {
        console.error('Failed to fetch Forge versions:', error);
        return { success: false, error: error.message };
    }
}

export {
    getRequiredJavaVersion,
    getJavaDownloadInfo,
    fetchMinecraftVersions,
    getForgeVersions
};