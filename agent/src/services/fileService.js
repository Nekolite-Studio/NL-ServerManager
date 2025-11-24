import fs from 'fs';
import path from 'path';
import https from 'https';
import * as tar from 'tar';
import unzipper from 'unzipper';

/**
 * URLからJSONデータを取得してパースするヘルパー関数
 * @param {string} url
 * @returns {Promise<object>}
 */
export function getJsonFromUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(new URL(url), (res) => {
            const { statusCode, headers } = res;
            if (statusCode >= 300 && statusCode < 400 && headers.location) {
                getJsonFromUrl(new URL(headers.location, url).href).then(resolve, reject);
                res.resume();
                return;
            }
            if (statusCode !== 200) {
                const error = new Error(`Request Failed. Status Code: ${statusCode}`);
                res.resume();
                reject(error);
                return;
            }
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(rawData));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        }).on('error', (e) => {
            reject(new Error(`Got error: ${e.message}`));
        });
    });
}

/**
 * URLからファイルをダウンロードするヘルパー関数
 * @param {string} url
 * @param {string} destPath
 * @param {function} onProgress - 進捗を通知するコールバック関数 (progress, downloadedSize, totalSize)
 * @returns {Promise<void>}
 */
export function downloadFile(url, destPath, onProgress = () => { }) {
    return new Promise((resolve, reject) => {
        const request = (currentUrl) => {
            https.get(new URL(currentUrl), (response) => {
                const { statusCode, headers } = response;

                if (statusCode >= 300 && statusCode < 400 && headers.location) {
                    // リダイレクトを追跡
                    request(new URL(headers.location, currentUrl).href);
                    response.resume(); // consume response data to free up memory
                    return;
                }

                if (statusCode !== 200) {
                    response.resume();
                    reject(new Error(`Request failed. Status code: ${statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(destPath);
                const totalSize = parseInt(headers['content-length'], 10);
                let downloadedSize = 0;
                let lastNotifiedProgress = -1;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize) {
                        const progress = Math.floor((downloadedSize / totalSize) * 100);
                        // 1%単位で通知する
                        if (progress > lastNotifiedProgress) {
                            onProgress(progress, downloadedSize, totalSize);
                            lastNotifiedProgress = progress;
                        }
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close((err) => {
                        if (err) {
                            fs.unlink(destPath, () => reject(err));
                        } else {
                            if (lastNotifiedProgress < 100) {
                                onProgress(100, totalSize, totalSize);
                            }
                            resolve();
                        }
                    });
                });

                file.on('error', (err) => {
                    fs.unlink(destPath, () => reject(err));
                });

            }).on('error', (err) => {
                reject(err);
            });
        };

        request(url);
    });
}

/**
 * 指定されたアーカイブファイルを指定されたディレクトリに展開する
 * @param {string} archivePath - アーカイブファイルへのパス
 * @param {string} destDir - 展開先のディレクトリ
 * @returns {Promise<void>}
 */
export function extractArchive(archivePath, destDir, onProgress = () => { }) {
    return new Promise((resolve, reject) => {
        const fileExtension = path.extname(archivePath);
        console.log(`[ServerManager] Extracting ${archivePath} to ${destDir}`);

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Zip展開時のエントリ処理
        const onEntry = (entry) => {
            // Zip内のパスは通常 '/' 区切りであるため、OS依存の path.sep ではなく '/' で分割する
            const parts = entry.path.split('/');
            
            // strip: 1 に相当する処理 (先頭のディレクトリを除去)
            const strippedParts = parts.slice(1);
            
            // 親ディレクトリ自体、またはルート直下のファイルの場合はスキップ
            if (strippedParts.length === 0) {
                entry.autodrain(); // 重要: スキップする場合でも必ずデータを読み捨てる(drain)必要がある
                return;
            }

            // OSのセパレータを使って展開先パスを構築
            const strippedPath = strippedParts.join(path.sep);
            const destPath = path.join(destDir, strippedPath);

            if (entry.type === 'Directory') {
                fs.mkdirSync(destPath, { recursive: true });
                entry.autodrain();
            } else {
                // ファイル書き込み前に親ディレクトリの存在を確認・作成
                const parentDir = path.dirname(destPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }

                entry.pipe(fs.createWriteStream(destPath))
                    .on('error', (err) => {
                        console.error(`[FileService] Failed to extract ${entry.path}:`, err);
                        reject(err);
                    });
            }
        };

        const sourceStream = fs.createReadStream(archivePath);
        const totalSize = fs.statSync(archivePath).size;
        let extractedSize = 0;
        let lastNotifiedProgress = -1;

        sourceStream.on('data', (chunk) => {
            extractedSize += chunk.length;
            const progress = Math.floor((extractedSize / totalSize) * 100);
            if (progress > lastNotifiedProgress) {
                onProgress({ status: 'extracting', message: `アーカイブを展開中... ${progress}%`, progress });
                lastNotifiedProgress = progress;
            }
        });

        onProgress({ status: 'extracting', message: 'アーカイブを展開中...', progress: 0 });

        if (fileExtension === '.zip') {
            sourceStream.pipe(unzipper.Parse())
                .on('entry', onEntry)
                .on('finish', () => {
                    // 完了通知
                    if (lastNotifiedProgress < 100) {
                        onProgress({ status: 'extracting', message: '展開完了', progress: 100 });
                    }
                    onProgress({ status: 'extracted', message: '展開完了', progress: 100 });
                    console.log(`[ServerManager] Successfully extracted ${archivePath}`);
                    resolve();
                })
                .on('error', reject);

        } else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz') || archivePath.endsWith('.gz')) {
            // node-tar はクロスプラットフォーム対応済み
            sourceStream.pipe(tar.x({
                cwd: destDir,
                strip: 1,
            }))
                .on('finish', () => {
                    if (lastNotifiedProgress < 100) {
                        onProgress({ status: 'extracting', message: '展開完了', progress: 100 });
                    }
                    onProgress({ status: 'extracted', message: '展開完了', progress: 100 });
                    console.log(`[ServerManager] Successfully extracted ${archivePath}`);
                    resolve();
                })
                .on('error', reject);
        } else {
            reject(new Error(`Unsupported archive format: ${fileExtension}`));
        }
    });
}