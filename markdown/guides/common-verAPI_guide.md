# ServerJars API (Sir.Systems) 実装ガイド

本ガイドは、**ServerJars API** (`https://serverjars.sir.systems/`) を利用して、Paper (プラグインサーバー) および Mohist (ハイブリッドサーバー) のバージョン情報を取得し、サーバーを構築するための実装詳細を定義します。

**ステータス: 要件定義完了**

## 1\. 全体方針

  * **データソース**: `https://serverjars.sir.systems/` (ServerJars API)
  * **メリット**:
      * PaperMC公式APIの厳しいレート制限を回避可能。
      * Paper, Mohist, Purpur など異なるサーバー種別を**単一のAPI仕様**で統一的に扱えるため、実装コストが低い。
  * **処理の流れ**:
    1.  API (`fetchAll`) からバージョンリストを取得 (`manager`)
    2.  ユーザーがバージョンを選択
    3.  API (`fetchJar`) からダウンロード直リンクとメタデータを取得 (`agent`)
    4.  ファイルをダウンロードして配置 (`agent`)
    5.  起動 (`agent`)

-----

## 2\. API仕様共通事項

  * **Base URL**: `https://serverjars.sir.systems/api`
  * **レスポンス形式**: JSON
  * **共通ラッパー**: すべての成功レスポンスは `{ "status": "success", "response": ... }` の形式で返ってきます。

-----

## 3\. データ取得 (バージョン一覧)

`manager/src/services/externalApiService.js` に実装します。

### 3.1. エンドポイント

**GET** `/fetchAll/{type}`

  * `{type}`: サーバーの種類を指定します。
      * Paper: `paper`
      * Mohist: `mohist`

### 3.2. レスポンススキーマ

```json
{
  "status": "success",
  "response": [
    {
      "version": "1.20.4",
      "file": "paper-1.20.4.jar",
      "size": "45M",
      "md5": "..."
    },
    ...
  ]
}
```

### 3.3. 実装ロジック (`externalApiService.js`)

1.  **リクエスト**: `axios.get('https://serverjars.sir.systems/api/fetchAll/paper')` (または `mohist`) を実行。
2.  **抽出**: レスポンスの `data.response` 配列から各オブジェクトの `version` プロパティを抽出します。
3.  **ソート**: 配列は順不同の可能性があるため、SemVer（セマンティックバージョニング）順、または新しい順にソートして返却します。

-----

## 4\. インストール処理 (ダウンロード)

`agent/src/services/serverConfigService.js` に実装します。

### 4.1. ダウンロード情報の取得

いきなりファイルをダウンロードするのではなく、一度詳細情報を取得して直リンク（URL）を確定させます。

**GET** `/fetchJar/{type}/{version}`

  * `{type}`: `paper` または `mohist`
  * `{version}`: ユーザーが選択したバージョン (例: `1.20.4`)

**レスポンススキーマ:**

```json
{
  "status": "success",
  "response": {
    "file": "paper-1.20.4.jar",
    "size": 47185920,  // バイト単位の数値 (進捗表示に利用可能)
    "url": "https://serverjars.sir.systems/api/fetchJar/paper/1.20.4/download" // 実際のダウンロードURL
  }
}
```

### 4.2. 実装ロジック (`serverConfigService.js`)

1.  **URL特定**:
    `createServer`関数内で、選択された `serverType` と `versionId` を使用して上記APIを呼び出し、`data.response.url` を取得します。
2.  **ダウンロード**:
    取得したURL (`data.response.url`) に対して `downloadFile` 関数を実行し、`server.jar` として保存します。
      * ※ `data.response.size` を利用すれば、より正確な進捗バーを表示できます。
3.  **ファイル配置**:
    ダウンロードしたファイルをサーバーディレクトリ直下の `server.jar` にリネーム/移動します。

### 4.3. 起動コマンド

  * Paper / Mohist ともに、特別なインストーラープロセスは**不要**です。
  * **起動コマンド**: `[JavaPath] -jar server.jar nogui`
  * **Javaバージョン**: バニラと同様に、Minecraftバージョンに基づいた適切なJavaランタイム（Java 8, 17, 21等）を使用します。

-----

## 5\. 各サーバー種別の設定値

実装時にコード内で使用する定数パラメータです。

### Paper (PaperMC)

  * **API Type**: `paper`
  * **表示名**: Paper
  * **カテゴリ**: プラグインサーバー

### Mohist (MohistMC)

  * **API Type**: `mohist`
  * **表示名**: Mohist
  * **カテゴリ**: Mod + プラグイン (ハイブリッド)

-----

## 6\. 実装の注意点

### エラーハンドリング

ServerJars APIがダウンしている場合や、指定バージョンが見つからない場合は `status: "error"` が返る可能性があります。`try-catch` ブロックで捕捉し、ユーザーに「バージョン情報の取得に失敗しました」と通知するように実装してください。

### キャッシュ (オプション)

頻繁にAPIを叩くのを避けるため、`manager`側で取得したバージョンリストを一時的にメモリキャッシュすることを検討してください（`externalApiService.js` 内に変数を設ける等）。