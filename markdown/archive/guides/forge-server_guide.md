# Forge 対応 実装ガイド

本ガイドは、Minecraft Server Manager の Agent 機能を拡張し、Minecraft Forge サーバーのインストールおよび起動に対応するための手順を示します。

## 1\. 概要

Forge サーバーの構築プロセスは、バニラサーバー（公式の`server.jar`を配置するだけ）とは異なり、以下のステップが必要です。

1.  **バージョン特定**: 対象の Minecraft バージョンに対応する Forge のビルド番号を取得する。
2.  **インストーラー取得**: Forge 公式サイト（Maven リポジトリ）からインストーラー JAR をダウンロードする。
3.  **インストール実行**: インストーラーをヘッドレスモード（GUI なし）で実行し、必要なライブラリと起動ファイルを生成する。
4.  **起動構成の調整**: 生成された起動引数ファイル等に基づき、Java プロセスを起動する。

---

## 2\. バージョン情報の取得

Forge のバージョン情報は、公式のプロモーション API を利用して取得します。これにより、「推奨版 (Recommended)」や「最新版 (Latest)」のバージョン番号を特定できます。

### API エンドポイント

- **URL**: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json`
- **メソッド**: GET
- **形式**: JSON

### API 応答雛形 (レスポンス例)

この JSON には、Minecraft バージョンごとの「推奨版」と「最新版」の Forge ビルド番号がキーバリュー形式で格納されています。

```json
{
  "homepage": "http://files.minecraftforge.net/maven/net/minecraftforge/forge/",
  "promos": {
    "1.20.1-latest": "47.3.0",
    "1.20.1-recommended": "47.2.0",
    "1.21-latest": "51.0.0",
    "1.21.10-latest": "60.0.20",
    "1.21.10-recommended": "60.0.15"
  }
}
```

### 実装方針

1.  Manager（または Agent）は上記 URL から JSON を取得します。
2.  ユーザーが選択した Minecraft バージョン（例: `1.21.10`）と、希望するタイプ（`latest` または `recommended`）を組み合わせたキー（例: `1.21.10-recommended`）で`promos`オブジェクトを検索します。
3.  該当する値（例: `60.0.15`）を Forge バージョンとして特定します。

---

## 3\. インストーラーのダウンロード

特定したバージョン情報を用いて、Maven リポジトリからインストーラーのダウンロード URL を構築します。

### URL 構築ルール

Forge のインストーラーは以下の命名規則に従って Maven リポジトリに配置されています。

- **ベース URL**: `https://maven.minecraftforge.net/net/minecraftforge/forge/`
- **パス形式**: `[MC_VER]-[FORGE_VER]/forge-[MC_VER]-[FORGE_VER]-installer.jar`

### 具体的な URL 例

- **Minecraft**: `1.21.10`
- **Forge**: `60.0.20`
- **生成される URL**:
  `https://maven.minecraftforge.net/net/minecraftforge/forge/1.21.10-60.0.20/forge-1.21.10-60.0.20-installer.jar`

### 実装方針

1.  Agent は構築した URL を使用してファイルをダウンロードします。
2.  保存先は一時ディレクトリ、または対象サーバーディレクトリ内の一時ファイルとして保存します。

---

## 4\. サーバーのインストール処理

Forge サーバーは、ダウンロードした JAR をそのまま起動するのではなく、インストーラーを実行してサーバー環境を構築する必要があります。

### インストールコマンド

ダウンロードしたインストーラーに対し、以下の Java コマンドを実行します。これにより、GUI を表示せずにサーバーファイルの展開とライブラリのダウンロードが行われます。

- **コマンド**: `[Javaパス] -Xmx4G -Djava.net.preferIPv4Stack=true -Djava.awt.headless=true -XX:+UseG1GC -jar [インストーラーファイル名] --installServer`
- **補足**: Linux 環境でのインストール速度向上のため、十分なメモリ割り当て（4GB 推奨）と、IPv4 優先・ヘッドレスモード指定・G1GC の利用が推奨されます。また、システムデフォルトの Java ではなく、対象 Minecraft バージョンに適した Java 実行可能ファイルを明示的に指定する必要があります。

### 参考情報

インストール処理の実装にあたっては、既存の自動化スクリプトの挙動が参考になります。特に、インストーラーの実行引数やエラーハンドリングについては以下のリポジトリが有用です。

- **参考**: HellBz/Forge-Server-Starter (GitHub)

### 実装方針

1.  Agent は`child_process.spawn`等を用いて上記のインストールコマンドを実行します。
2.  **作業ディレクトリ (CWD)** は、対象のサーバーディレクトリに設定する必要があります。
3.  プロセスが終了コード `0` で完了するのを待機します。
4.  インストール完了後、インストーラー JAR ファイル（および生成された不要なログファイル）を削除します。

---

## 5\. サーバーの起動

近年の Forge（特に 1.17 以降）では、インストール後に生成されるファイル構成がバニラとは異なります。`server.jar`を直接起動するのではなく、ブートストラップ用の仕組みを利用する必要があります。

### 起動構成の変化

インストールが完了すると、サーバーディレクトリには以下のようなファイルが生成されます（バージョンにより差異あり）。

- `run.bat` / `run.sh`: 起動用スクリプト
- `user_jvm_args.txt`: ユーザー定義の JVM 引数ファイル
- `libraries/`: 依存ライブラリ群
- `args` ファイル（例: `libraries/.../unix_args.txt`）: 実際の Java 起動引数が記述されたファイル

### 実装方針

Agent が Java プロセスを直接管理（PID 取得・監視）するためには、シェルスクリプト(`run.sh`)を経由せず、Java コマンドを直接組み立てて実行することが望ましいです。

1.  **起動コマンドの特定**:
    インストール後に生成された `run.sh` または `run.bat` の中身を解析するか、Forge の仕様に従って以下の形式でコマンドを構築します。

    - **コマンド形式（例）**: `[Javaパス] @user_jvm_args.txt @libraries/net/minecraftforge/forge/.../unix_args.txt "$@"`
    - **実装詳細**: `libraries/net/minecraftforge/forge/[バージョン]/unix_args.txt` を探索し、そのパスを `@` プレフィックス付きで引数に追加します。また、`user_jvm_args.txt` が存在する場合はそれも同様に追加します。

2.  **JVM 引数の適用**:
    Manager から指定されたメモリ設定（`-Xmx`, `-Xms`）などは、コマンドライン引数として渡すか、`user_jvm_args.txt` を動的に書き換えることで適用します。

3.  **プロセスの起動**:
    構築したコマンドでサーバープロセスを起動し、標準入出力を Agent に接続します。
