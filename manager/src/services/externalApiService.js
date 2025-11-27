import axios from 'axios';
import { getApiCache, setApiCache } from '../storeManager.js';

const CACHE_EXPIRATION_HOURS = 24; // キャッシュ有効期限 (時間)

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
 * 指定されたMinecraftバージョンとサーバータイプに必要なJavaのメジャーバージョンを取得する
 * @param {string} mcVersion
 * @param {string} [serverType='vanilla']
 * @returns {Promise<number>}
 */
async function getRequiredJavaVersion(mcVersion, serverType = 'vanilla') {
    if (!mcVersion) {
        throw new Error('Minecraft version (mcVersion) is required');
    }

    // Mohistは独自のキャッシュキーを持つ
    const cacheKey = serverType === 'mohist'
        ? `javaVersion-${mcVersion}-${serverType}`
        : `javaVersion-${mcVersion}`;

    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

    const manifest = (await axios.get(MANIFEST_URL_V2)).data;
    const entry = manifest.versions.find(v => v.id === mcVersion);
    if (!entry) throw new Error(`Version not found in manifest: ${mcVersion}`);

    const versionJson = (await axios.get(entry.url)).data;

    let javaVersion;
    if (versionJson.javaVersion && versionJson.javaVersion.majorVersion) {
        javaVersion = versionJson.javaVersion.majorVersion;
    } else {
        const releaseTime = new Date(entry.releaseTime);
        javaVersion = detectJavaByDate(releaseTime);
    }

    // Mohist 固有のJavaバージョン上書きロジック
    // Mohistは、MC 1.12.2以前 (Java 8) のバージョンでもJava 11を要求する場合がある
    if (serverType === 'mohist' && javaVersion === 8) {
        console.log(`[getRequiredJavaVersion] Mohist server detected for MC ${mcVersion}. Overriding Java 8 with Java 11.`);
        javaVersion = 11;
    }

    setCachedData(cacheKey, javaVersion);
    return javaVersion;
}

/**
 * Adoptium APIからJavaのダウンロード情報を取得する
 * @param {number} feature_version
 * @param {string} os
 * @param {string} arch
 * @returns {Promise<{success: boolean, downloadLink?: string, fileSize?: number, error?: string}>}
 */
async function getJavaDownloadInfo(feature_version, os, arch) {
    const cacheKey = `javaDownloadInfo-${feature_version}-${os}-${arch}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

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
            const result = { success: true, downloadLink, fileSize };
            setCachedData(cacheKey, result);
            return result;
        } else {
            console.warn('No download link or file size found in Adoptium API response.');
            const result = { success: false, error: 'Download information not found.' };
            setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
            return result;
        }
    } catch (error) {
        console.error('Error fetching Java download info from Adoptium API:', error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

/**
 * Mojangのバージョンマニフェストを取得する
 * @returns {Promise<Array>}
 */
async function fetchMinecraftVersions() {
    const cacheKey = `minecraftVersions`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

    try {
        const response = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        const versions = response.data.versions;
        setCachedData(cacheKey, versions);
        return versions;
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
    const cacheKey = `forgeVersions`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

    try {
        const response = await axios.get('https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json');
        const result = { success: true, promotions: response.data.promos };
        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Failed to fetch Forge versions:', error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

/**
 * Fabricのバージョン情報を取得する
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getFabricVersions() {
    const cacheKey = `fabricVersions`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

    try {
        const response = await axios.get('https://meta.fabricmc.net/v2/versions/loader');
        const result = { success: true, versions: response.data };
        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Failed to fetch Fabric versions:', error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

/**
 * Quiltのバージョン情報を取得する
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getQuiltVersions() {
    const cacheKey = `quiltVersions`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

    try {
        const response = await axios.get('https://meta.quiltmc.org/v3/versions/loader');
        const result = { success: true, versions: response.data };
        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Failed to fetch Quilt versions:', error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

/**
 * NeoForgeのバージョン情報を取得する
 * @param {string} mcVersion Minecraftバージョン
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getNeoForgeVersions(mcVersion, forceRefresh = false) {
    const cacheKey = `neoForgeVersions-${mcVersion}`;
    if (!forceRefresh) {
        const cachedData = getCachedData(cacheKey);
        if (cachedData) return cachedData;
    }

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

        const result = { success: true, versions: filteredVersions };
        setCachedData(cacheKey, result);
        return result;

    } catch (error) {
        console.error('Failed to fetch NeoForge versions:', error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

/**
 * Paperのバージョン情報とビルド情報を新しいAPIエンドポイントから取得する
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getPaperVersions() {
    const cacheKey = `paperVersions_v3`; // 新��いエンドポイント用にキャッシュキーを変更
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

    try {
        const response = await axios.get('https://fill.papermc.io/v3/projects/paper/versions');
        // APIは新しい順にソートされていると仮定するが、念のため降順ソート
        const versions = response.data.versions.sort((a, b) => {
            // 簡単なセマンティックバージョニング比較
            const partsA = a.version.id.split('.').map(Number);
            const partsB = b.version.id.split('.').map(Number);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                const valA = partsA[i] || 0;
                const valB = partsB[i] || 0;
                if (valA > valB) return -1;
                if (valA < valB) return 1;
            }
            return 0;
        });
        const result = { success: true, versions };
        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Failed to fetch Paper versions from v3 API:', error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

/**
 * キャッシュされたPaperのバージョン情報から特定のMCバージョンのビルドリストを取得する
 * @param {string} mcVersion - MinecraftのバージョンID (例: '1.21.10')
 * @returns {Promise<{success: boolean, builds?: Array, error?: string}>}
 */
async function getPaperBuilds(mcVersion, forceRefresh = false) {
    const cacheKey = `paperVersions_v3`;
    let cachedData = null;
    
    if (!forceRefresh) {
        cachedData = getCachedData(cacheKey);
    }

    // キャッシュがない場合は取得を試みる
    if (!cachedData) {
        const versionsResult = await getPaperVersions();
        if (versionsResult.success) {
            cachedData = versionsResult;
        } else {
            return { success: false, error: 'Paper version data is not available.' };
        }
    }

    const versionData = cachedData.versions.find(v => v.version.id === mcVersion);

    if (versionData && versionData.builds) {
        // ビルドは昇順なので、降順(新しい順)にソートする
        const builds = [...versionData.builds].reverse();
        return { success: true, builds };
    } else {
        return { success: false, error: `No builds found for Paper version ${mcVersion}` };
    }
}

/**
 * Mohistのバージョン情報を取得する
 * @returns {Promise<{success: boolean, versions?: Array, error?: string}>}
 */
async function getMohistVersions() {
    const cacheKey = `mohistVersions`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) return cachedData;

    try {
        const response = await axios.get('https://api.mohistmc.com/project/mohist/versions');
        // Mohist APIは {name: "1.X.X"} 形式でバージョンを返す。
        // バージョン番号で降順にソートする
        const versions = response.data.sort((a, b) => {
            const partsA = a.name.split('.').map(Number);
            const partsB = b.name.split('.').map(Number);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                const valA = partsA[i] || 0;
                const valB = partsB[i] || 0;
                if (valA > valB) return -1;
                if (valA < valB) return 1;
            }
            return 0;
        });
        const result = { success: true, versions };
        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Failed to fetch Mohist versions:', error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

/**
 * Mohistのビルド情報を取得する
 * @param {string} mcVersion - MinecraftのバージョンID (例: '1.12.2')
 * @returns {Promise<{success: boolean, builds?: Array, error?: string}>}
 */
async function getMohistBuilds(mcVersion, forceRefresh = false) {
    const cacheKey = `mohistBuilds-${mcVersion}`;
    if (!forceRefresh) {
        const cachedData = getCachedData(cacheKey);
        if (cachedData) return cachedData;
    }

    try {
        const response = await axios.get(`https://api.mohistmc.com/project/mohist/${mcVersion}/builds`);
        // ビルドはIDの昇順(古い順)で来るため、IDの降順(新しい順)���ソートする
        const builds = response.data.sort((a, b) => b.id - a.id);
        const result = { success: true, builds };
        setCachedData(cacheKey, result);
        return result;
    } catch (error) {
        console.error(`Failed to fetch Mohist builds for ${mcVersion}:`, error);
        const result = { success: false, error: error.message };
        setCachedData(cacheKey, result, true); // エラーは短期間キャッシュするか、キャッシュしない
        return result;
    }
}

export {
    getRequiredJavaVersion,
    getJavaDownloadInfo,
    fetchMinecraftVersions,
    getForgeVersions,
    getFabricVersions,
    getQuiltVersions,
    getNeoForgeVersions,
    getPaperVersions,
    getPaperBuilds, // 新しく追加
    getMohistVersions,
    getMohistBuilds,
    getDownloadUrlForServerType
};

/**
 * キャッシュからデータを取得する
 * @param {string} key - キャッシュキー
 * @returns {any | null} - キャッシュデータ、またはnull
 */
function getCachedData(key) {
    const cache = getApiCache();
    const entry = cache[key];
    if (entry && (Date.now() - entry.timestamp) < CACHE_EXPIRATION_HOURS * 60 * 60 * 1000) {
        console.log(`[externalApiService] Cache hit for ${key}`);
        return entry.data;
    }
    console.log(`[externalApiService] Cache miss or expired for ${key}`);
    return null;
}

/**
 * データをキャッシュに保存する
 * @param {string} key - キャッシュキー
 * @param {any} data - 保存するデータ
 * @param {boolean} isError - エラーデータかどうか (trueの場合キャッシュしない、または短期間のみ)
 */
function setCachedData(key, data, isError = false) {
    if (isError) {
        console.log(`[externalApiService] Skipping cache for error result: ${key}`);
        return; // エラーはキャッシュしない (即時リトライ可能にするため)
    }

    const cache = getApiCache();
    cache[key] = {
        timestamp: Date.now(),
        data: data
    };
    setApiCache(cache);
    console.log(`[externalApiService] Data cached for ${key}`);
}

/**
 * 指定されたサーバータイプとバージョンに基づいて、ダウンロードURLを取得する
 * @param {string} serverType - サーバータイプ ('vanilla', 'forge', 'fabric', 'quilt', 'neoforge', 'paper', 'mohist')
 * @param {string} versionId - MinecraftのバージョンID (例: '1.20.4')
 * @param {string} [loaderVersion] - ModローダーのバージョンID (Forge, Fabric, Quilt, NeoForgeの場合)
 * @returns {Promise<string>} ダウンロードURL
 * @throws {Error} 指定されたサーバータイプやバージョンに対応するダウンロードURLが見つからない場合
 */
async function getDownloadUrlForServerType(serverType, versionId, loaderVersion) {
    const cacheKey = `downloadUrl-${serverType}-${versionId}-${loaderVersion || ''}`;
    const cachedUrl = getCachedData(cacheKey);
    if (cachedUrl) {
        return cachedUrl;
    }

    let downloadUrl;
    switch (serverType) {
        case 'vanilla':
            const manifest = (await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json')).data;
            const versionInfo = manifest.versions.find(v => v.id === versionId);
            if (!versionInfo) {
                throw new Error(`Version ${versionId} not found in version manifest.`);
            }
            const versionDetails = (await axios.get(versionInfo.url)).data;
            const serverJarUrl = versionDetails.downloads?.server?.url;
            if (!serverJarUrl) {
                throw new Error(`Server JAR download URL not found for version ${versionId}.`);
            }
            downloadUrl = serverJarUrl;
            break;

        case 'forge':
            if (!loaderVersion) throw new Error('Forge version (loaderVersion) is required for Forge servers.');
            downloadUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${versionId}-${loaderVersion}/forge-${versionId}-${loaderVersion}-installer.jar`;
            break;

        case 'neoforge':
            if (!loaderVersion) throw new Error('NeoForge version (loaderVersion) is required for NeoForge servers.');
            downloadUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/neoforge-${loaderVersion}-installer.jar`;
            break;

        case 'fabric':
            if (!loaderVersion) throw new Error('Fabric Loader version is required for Fabric servers.');
            const fabricInstallerVersion = '1.0.1'; // ガイドに従い固定
            downloadUrl = `https://maven.fabricmc.net/net/fabricmc/fabric-installer/${fabricInstallerVersion}/fabric-installer-${fabricInstallerVersion}.jar`;
            break;

        case 'quilt':
            if (!loaderVersion) throw new Error('Quilt Loader version is required for Quilt servers.');
            const quiltInstallerVersion = '0.9.1'; // ガイドに従い固定
            downloadUrl = `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${quiltInstallerVersion}/quilt-installer-${quiltInstallerVersion}.jar`;
            break;

        case 'paper':
            if (!loaderVersion) throw new Error('Paper build ID (loaderVersion) is required for Paper servers.');
            // loaderVersionにビルドIDが直接渡されることを期待する
            // ファイル名は固定で `paper-{versionId}-{buildId}.jar` となる
            const fileName = `paper-${versionId}-${loaderVersion}.jar`;
            downloadUrl = `https://api.papermc.io/v2/projects/paper/versions/${versionId}/builds/${loaderVersion}/downloads/${fileName}`;
            break;

        case 'mohist':
            if (!loaderVersion) throw new Error('Mohist build ID (loaderVersion) is required for Mohist servers.');
            
            let buildId = loaderVersion;
            // 'latest' が指定された場合、APIから最新のビルドIDを取得する
            if (loaderVersion.toLowerCase() === 'latest') {
                const buildsResponse = await getMohistBuilds(versionId);
                if (buildsResponse.success && buildsResponse.builds.length > 0) {
                    // getMohistBuildsは降順にソート済みなので、最初の要素が最新
                    buildId = buildsResponse.builds.id;
                } else {
                    throw new Error(`Could not determine the latest build for Mohist ${versionId}.`);
                }
            }
            
            // 特定のビルドIDを指定してダウンロード
            downloadUrl = `https://api.mohistmc.com/project/mohist/${versionId}/builds/${buildId}/download`;
            break;

        default:
            throw new Error(`Unsupported server type: ${serverType}`);
    }
    setCachedData(cacheKey, downloadUrl);
    return downloadUrl;
}