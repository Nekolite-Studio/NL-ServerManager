import path from 'path';
import fs from 'fs';
import { resolvePath } from '../utils/storage.js';

/**
 * Javaのインストールディレクトリパスを生成する
 * @param {string} javaVersion - Javaのバージョン (例: jdk-17.0.8.7-hotspot)
 * @returns {string} - 解決されたJavaインストールディレクトリのフルパス
 */
export function getJavaInstallDir(javaVersion) {
    return resolvePath(path.join('~', '.nekolite', 'java', javaVersion));
}

/**
 * インストールされたJavaの実行可能ファイルへのパスを返す
 * @param {string} javaInstallDir - Javaのインストールディレクトリ
 * @returns {string} - Java実行可能ファイルへのフルパス
 */
export function getJavaExecutablePath(javaInstallDir) {
    let javaPath;
    if (process.platform === 'win32') {
        javaPath = path.join(javaInstallDir, 'bin', 'java.exe');
    } else {
        javaPath = path.join(javaInstallDir, 'bin', 'java');
    }

    if (!fs.existsSync(javaPath)) {
        // tar.x の strip オプションでディレクトリが削除される場合があるため、
        // bin/java が直下にある성도も 고려
        javaPath = path.join(javaInstallDir, 'java');
        if (!fs.existsSync(javaPath)) {
            throw new Error(`Java executable not found at ${javaPath}`);
        }
    }
    return javaPath;
}

/**
 * ランタイム設定からJavaの実行可能ファイルパスを解決する
 * @param {object} runtimeConfig
 * @returns {string}
 */
export function resolveJavaExecutable(runtimeConfig) {
    const { java_path, java_version } = runtimeConfig;
    let javaExecutable;

    if (java_path && java_path !== 'default') {
        console.log(`[ServerManager] Using directly specified Java path: ${java_path}`);
        if (!fs.existsSync(java_path)) {
            throw new Error(`指定されたJavaパスが見つかりません: ${java_path}`);
        }
        javaExecutable = java_path;
    } else if (java_version) {
        try {
            const javaInstallDir = getJavaInstallDir(String(java_version));
            javaExecutable = getJavaExecutablePath(javaInstallDir);
            console.log(`[ServerManager] Using Java from configured version ${java_version}: ${javaExecutable}`);
        } catch (error) {
            console.error(`[ServerManager] Failed to get Java executable for version ${java_version}:`, error);
            throw new Error(`要求されたJava ${java_version} はインストールされていません。物理サーバー詳細画面からインストールしてください。`);
        }
    } else {
        console.log(`[ServerManager] java_path or java_version not specified. Falling back to system default 'java'.`);
        javaExecutable = 'java';
    }
    return javaExecutable;
}