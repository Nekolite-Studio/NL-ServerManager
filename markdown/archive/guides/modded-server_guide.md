Fabric、NeoForge、Quilt のバージョン取得ロジックに関する実装ガイドを作成しました。
開発者がコードを記述する際の設計図としてご利用ください。

---

# Modded Server Support (Fabric, NeoForge, Quilt) 実装ガイド

本ガイドは、Fabric、NeoForge、Quilt の 3 つの主要な Mod ローダーのバージョン情報を取得し、サーバーを構築するための実装詳細をまとめたものです。
**ステータス: 実装完了**

## 1. 全体方針

- **データソース**: 各プロジェクトが提供する公式のメタデータ API または Maven リポジトリを利用。
- **処理の場所**: `manager`の`externalApiService.js`でバージョン情報を取得し、`agent`の`serverConfigService.js`でインストール処理を実行。
- **依存ライブラリ**: `axios` (HTTP リクエスト), `child_process` (インストーラー実行)。

---

## 2. Fabric (FabricMC)

### 2.1. データ取得 (`externalApiService.js`)

- **API エンドポイント**: `https://meta.fabricmc.net/v2/versions/loader`
- **実装**: `getFabricVersions()`
  - 全ての Loader バージョンを取得し、そのままリストとして返却。

### 2.2. インストール処理 (`serverConfigService.js`)

- **インストーラー**: 公式 Maven から JAR をダウンロード。
  - URL: `https://maven.fabricmc.net/net/fabricmc/fabric-installer/[VERSION]/fabric-installer-[VERSION].jar`
  - 現状は安定版として `1.0.1` を使用。
- **コマンド**:
  ```bash
  java -jar fabric-installer.jar server -mcversion [MC_VER] -loader [LOADER_VER] -downloadMinecraft
  ```

---

## 3. Quilt (QuiltMC)

### 3.1. データ取得 (`externalApiService.js`)

- **API エンドポイント**: `https://meta.quiltmc.org/v3/versions/loader`
- **実装**: `getQuiltVersions()`
  - Fabric 同様、全ての Loader バージョンを取得。

### 3.2. インストール処理 (`serverConfigService.js`)

- **インストーラー**: 公式 Maven から JAR をダウンロード。
  - URL: `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/[VERSION]/quilt-installer-[VERSION].jar`
  - 現状は `0.9.1` を使用。
- **コマンド**:
  ```bash
  java -jar quilt-installer.jar install server [MC_VER] [LOADER_VER] --download-server
  ```
- **注意点**:
  - Quiltインストーラーは、デフォルトで `server/` というサブディレクトリを作成し、その中にサーバーファイルを配置します。
  - Agentは起動時にこのディレクトリ構造を検知し、自動的に作業ディレクトリ(CWD)を `server/` に切り替えて起動します。
  - 起動JARファイル名は `quilt-server-launch.jar` です。

---

## 4. NeoForge

### 4.1. データ取得 (`externalApiService.js`)

- **リポジトリ**: `https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml`
- **実装**: `getNeoForgeVersions(mcVersion)`
  - XML を正規表現でパースしてバージョンリストを抽出。
  - **フィルタリング**:
    - 旧形式 (`1.20.1`以前): `[MC_VER]-` で始まるものを抽出。
    - 新形式 (`1.20.2`以降): `[Major].[Minor].` (例: `20.4.`) で始まるものを抽出。
  - 降順にソートして返却。

### 4.2. インストール処理 (`serverConfigService.js`)

- **インストーラー**: 公式 Maven から JAR をダウンロード。
  - URL: `https://maven.neoforged.net/releases/net/neoforged/neoforge/[NEO_VER]/neoforge-[NEO_VER]-installer.jar`
- **コマンド**:
  ```bash
  java -jar neoforge-installer.jar --installServer
  ```
- **起動方法**:
  - Forgeと同様に、インストール後に生成される `libraries/net/neoforged/neoforge/[VERSION]/unix_args.txt` を使用して起動引数を構築します。
  - Agentは自動的にこのファイルを探索し、`@user_jvm_args.txt @libraries/.../unix_args.txt` 形式で起動します。

---

## 5. API リファレンス

### `manager/src/services/externalApiService.js`

- `getFabricVersions()`: Promise<{success, versions}>
- `getQuiltVersions()`: Promise<{success, versions}>
- `getNeoForgeVersions(mcVersion)`: Promise<{success, versions}>

### `agent/src/services/serverConfigService.js`

- `createServer(serversDirectory, serverConfig, onProgress)`
  - `serverConfig.serverType` に `fabric`, `quilt`, `neoforge` を指定可能。
  - 各タイプに応じたインストーラーを自動的にダウンロード・実行。
