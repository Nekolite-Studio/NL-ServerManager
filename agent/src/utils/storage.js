const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * ホームディレクトリを考慮してパスを解決する
 * @param {string} filePath - チルダを含む可能性のあるパス
 * @returns {string} - 絶対パス
 */
function resolvePath(filePath) {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * JSONファイルを同期的に読み込み、オブジェクトとして返す
 * @param {string} filePath - ファイルパス
 * @returns {object | null} - パースされたオブジェクト、またはファイルが存在しない/エラーの場合はnull
 */
function loadJsonSync(filePath) {
  const resolvedPath = resolvePath(filePath);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }
  try {
    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`[Storage] Failed to load or parse JSON file at ${resolvedPath}:`, error);
    return null;
  }
}

/**
 * オブジェクトをJSON形式でファイルに同期的に書き込む
 * ディレクトリが存在しない場合は再帰的に作成する
 * @param {string} filePath - ファイルパス
 * @param {object} data - 書き込むデータ
 * @returns {boolean} - 成功した場合はtrue、失敗した場合はfalse
 */
function saveJsonSync(filePath, data) {
  const resolvedPath = resolvePath(filePath);
  try {
    const directory = path.dirname(resolvedPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    const jsonString = JSON.stringify(data, null, 2); // 読みやすいようにインデントを追加
    fs.writeFileSync(resolvedPath, jsonString, 'utf-8');
    return { success: true, resolvedPath };
  } catch (error) {
    console.error(`[Storage] Failed to save JSON file to ${resolvedPath}:`, error);
    return { success: false, resolvedPath };
  }
}

module.exports = {
  resolvePath,
  loadJsonSync,
  saveJsonSync,
};