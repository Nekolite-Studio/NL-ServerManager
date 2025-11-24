# Plugin & Hybrid Server Support (Paper, Mohist) 実装ガイド

本ガイドは、主要なプラグインサーバーである **Paper** と、Forgeハイブリッドサーバーである **Mohist** のバージョン情報を取得し、サーバーを構築するための実装詳細をまとめたものです。

## 1. 全体方針

* **データソース**: 各プロジェクトが提供する公式APIを利用します。
* **インストーラーの有無**:
    * Fabric/Forge等と異なり、これらのサーバーソフトウェアは「インストーラー」形式ではなく、**「サーバーJARそのもの」**を直接ダウンロード・配置する形式が一般的です。
    * 初回起動時にライブラリのダウンロードや展開が自動的に行われます。
* **処理の流れ**:
    1.  APIからバージョンリストを取得 (`manager`)
    2.  ユーザーがバージョンを選択
    3.  APIからダウンロードURLを特定・構築 (`manager` または `agent`)
    4.  JARをダウンロードして配置 (`agent`)
    5.  起動 (`agent`)

---

## 2. Paper (PaperMC)

Paperは現在最も普及しているプラグインサーバーであり、APIの仕様も非常に安定しています。

### 2.1. データ取得 (`externalApiService.js`)

* **API エンドポイント (バージョン一覧)**:
    `https://api.papermc.io/v2/projects/paper`
* **取得ロジック**:
    * 上記URLにGETリクエストを送信します。
    * レスポンスJSON内の `versions` 配列（文字列のリスト）を取得します。
    * **注意**: 配列は古い順（昇順）で返されることが多いため、UI表示用に**逆順（降順）にソート**することを推奨します。

### 2.2. ダウンロードURLの特定

PaperのAPIは「最新版のダウンロードURL」を直接提供していません。以下の手順でURLを構築する必要があります。

1.  **ビルド情報の取得**:
    * エンドポイント: `https://api.papermc.io/v2/projects/paper/versions/[VERSION]`
    * レスポンス内の `builds` 配列の**最後の要素**（最大値）を「最新ビルド番号」として特定します。
2.  **ファイル名の特定**:
    * エンドポイント: `https://api.papermc.io/v2/projects/paper/versions/[VERSION]/builds/[BUILD]`
    * レスポンス内の `downloads.application.name` からJARファイル名を取得します（例: `paper-1.20.4-496.jar`）。
3.  **URLの構築**:
    * 形式: `https://api.papermc.io/v2/projects/paper/versions/[VERSION]/builds/[BUILD]/downloads/[FILENAME]`

### 2.3. インストール処理 (`serverConfigService.js`)

* **ファイル配置**:
    * 構築したURLからファイルをダウンロードし、サーバーディレクトリ直下に `server.jar` として保存します。
* **起動コマンド**:
    * Modローダーのような特別な引数は不要です。
    * 標準的な `java -jar server.jar` で起動します。

---

## 3. Mohist (MohistMC)

MohistはForgeとBukkit/Spigotプラグインを併用できるハイブリッドサーバーです。

### 3.1. データ取得 (`externalApiService.js`)

*   **API エンドポイント (バージョン一覧)**:
    *   `https://api.mohistmc.com/project/mohist/versions`
*   **取得ロジック (バージョン一覧)**:
    *   上記URLにGETリクエストを送信します。
    *   レスポンスは `[{ "name": "1.20.1" }, ...]` という形式の配列です。
    *   UIでの利便性を考慮し、バージョン番号で**降順にソート**して返します。
*   **API エンドポイント (ビルド一覧)**:
    *   `https://api.mohistmc.com/project/mohist/[VERSION]/builds`
*   **取得ロジック (ビルド一覧)**:
    *   ユーザーが選択したMinecraftバージョン (`[VERSION]`) を元に上記URLへGETリクエストを送信します。
    *   レスポンスはビルド情報の配列です。
    *   UIでの利便性を考慮し、ビルドID (`id`) で**降順にソート**して返します。

### 3.2. ダウンロードURLの特定

ユーザーがUIから特定のビルドを選択することを前提とし、以下の形式でダウンロードURLを構築します。

*   **エンドポイント形式**:
    *   `https://api.mohistmc.com/project/mohist/[VERSION]/builds/[BUILD_ID]/download`
*   **URL構築**:
    *   `[VERSION]` にはユーザーが選択したMinecraftバージョンが入ります。
    *   `[BUILD_ID]` にはユーザーが選択したビルドIDが入ります。
    *   `'latest'` が指定された場合は、APIを呼び出して最新のビルドIDを自動的に解決します。

### 3.3. インストール処理 (`agent/src/services/serverConfigService.js`)

* **ファイル配置**:
    * ダウンロードしたファイルを `server.jar` として保存します。
* **起動コマンド**:
    * 基本的には `java -jar server.jar` で起動します。
    * **注意**: 初回起動時にForge等のライブラリをダウンロードするため、インターネット接続が必須であり、起動に時間がかかります。`Message.PROGRESS_UPDATE` で「ライブラリのダウンロード中」等の通知を出すと親切です。
    * **Javaバージョン**: ベースとなるMinecraftバージョン（例: 1.16.5ならJava 8/11、1.20.1ならJava 17）に合わせたJavaランタイムを使用する必要があります。既存の `getRequiredJavaVersion` ロジックをそのまま利用可能です。

---

## 4. 実装時の注意点

### バージョンリストのソート
APIから返されるリストは昇順（古い順）であることが多いため、UIで表示する際は `array.reverse()` 等を用いて降順（新しい順）に並べ替える処理を `externalApiService.js` 内に実装してください。

### エラーハンドリング
外部APIはダウンする可能性があります。`try-catch` ブロックで適切にエラーを捕捉し、取得失敗時には `success: false` とエラーメッセージを返すように実装してください。

### キャッシュ戦略（推奨）
バージョンリストやビルド情報は頻繁に変更されるものではありません。必要に応じてメモリ内キャッシュや、Electronの `store` を利用したキャッシュを検討し、APIへの負荷とレスポンス時間を軽減してください。