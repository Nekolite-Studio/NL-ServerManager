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

/**
 * Fabricのバージョン情報を取得する
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getFabricVersions() {
    try {
        const response = await axios.get('https://meta.fabricmc.net/v2/versions/loader');
        return { success: true, versions: response.data };
    } catch (error) {
        console.error('Failed to fetch Fabric versions:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Quiltのバージョン情報を取得する
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getQuiltVersions() {
    try {
        const response = await axios.get('https://meta.quiltmc.org/v3/versions/loader');
        return { success: true, versions: response.data };
    } catch (error) {
        console.error('Failed to fetch Quilt versions:', error);
        return { success: false, error: error.message };
    }
}

/**
 * NeoForgeのバージョン情報を取得する
 * @param {string} mcVersion Minecraftバージョン
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getNeoForgeVersions(mcVersion) {
    try {
        const response = await axios.get('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
        const xmlData = response.data;

        // XMLを正規表現でパースしてバージョンリストを抽出
        const versionRegex = /<version>(.*?)<\/version>/g;
        const versions = [];
        let match;
        while ((match = versionRegex.exec(xmlData)) !== null) {
            versions.push(match[1]);
        }

        // フィルタリングロジック
        // 旧形式 (1.20.1以前): [MC_VER]- で始まるものを抽出
        // 新形式 (1.20.2以降): [Major].[Minor]. (例: 20.4.) で始まるものを抽出
        // ※ NeoForgeのバージョニングは複雑なため、簡易的にMCバージョンを含むか、
        //    あるいは新しいバージョニング規則に合致するかで判断する。
        
        // MCバージョンのメジャー・マイナーを取得 (例: 1.20.4 -> 20.4)
        const mcVerParts = mcVersion.split('.');
        let neoVerPrefix = '';
        if (mcVerParts.length >= 2) {
            // 1.20.4 -> 20.4
            // 1.21 -> 21.0 (NeoForge 21.0.x)
            if (mcVerParts[0] === '1') {
                neoVerPrefix = `${mcVerParts[1]}.`;
                if (mcVerParts.length === 2) {
                    // 1.21 -> 21.
                    // しかしNeoForge 21.0系の場合は 21.0. となる可能性があるため、
                    // 単純に 21. で始まるものを探すのが安全か。
                    // ガイドに従い [Major].[Minor]. を基本とするが、
                    // 1.20.1以前は mcVersion- がプレフィックスとなる。
                }
            }
        }

        const filteredVersions = versions.filter(v => {
            // 旧形式: 1.20.1-47.1.3 のように MCバージョンで始まる
            if (v.startsWith(`${mcVersion}-`)) return true;

            // 新形式: 20.4.80 のように MCバージョンに対応した数値で始まる
            // 1.20.2 -> 20.2.x
            // 1.20.4 -> 20.4.x
            // 1.21 -> 21.0.x
            if (neoVerPrefix && v.startsWith(neoVerPrefix)) return true;
            
            // 1.21 の場合、NeoForgeは 21.0.x や 21.1.x になる可能性がある
            // 1.21 -> 21.
            if (mcVerParts[0] === '1' && mcVerParts.length >= 2) {
                 const major = mcVerParts[1]; // 21
                 // バージョン文字列が "21." で始まるかチェック
                 if (v.startsWith(`${major}.`)) return true;
            }

            return false;
        });

        // 降順にソート (semverライブラリがないので簡易的な文字列比較または数値比較)
        // NeoForgeのバージョンは数値的に比較可能
        filteredVersions.sort((a, b) => {
            // バージョンを数値配列に変換して比較
            const partsA = a.replace(/[^0-9.]/g, '').split('.').map(Number);
            const partsB = b.replace(/[^0-9.]/g, '').split('.').map(Number);
            
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                const valA = partsA[i] || 0;
                const valB = partsB[i] || 0;
                if (valA > valB) return -1;
                if (valA < valB) return 1;
            }
            return 0;
        });

        return { success: true, versions: filteredVersions };

    } catch (error) {
        console.error('Failed to fetch NeoForge versions:', error);
        return { success: false, error: error.message };
    }
}

export {
    getRequiredJavaVersion,
    getJavaDownloadInfo,
    fetchMinecraftVersions,
    getForgeVersions,
    getFabricVersions,
    getQuiltVersions,
    getNeoForgeVersions
};