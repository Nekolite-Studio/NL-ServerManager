# プロジェクト管理ガイド: スタンドアロンパッケージ構成

このドキュメントでは、`manager` (Electron GUI)、`agent` (Node.js CLI)、および`common` (共有モジュール) の各パッケージを、それぞれ独立したスタンドアロンパッケージとして管理する方法について説明します。

npm Workspacesは使用せず、プロジェクトルートの`package.json`をコマンドランチャーとして利用することで、統一的な開発体験を提供します。

## 1. プロジェクト構造

このプロジェクトは、複数の独立したnpmパッケージの集合体として構成されています。

-   `manager/`: Minecraftサーバー管理用のElectronベースのGUIアプリケーション。
-   `agent/`: 各物理サーバー上で動作するNode.jsベースのエージェント。
-   `common/`: `manager`と`agent`間で共有されるプロトコル定義やスキーマなどのモジュール。

各パッケージは自身の依存関係を`package.json`で管理し、`common`への依存は`file:../common`という形式の相対パスで解決されます。

## 2. 依存関係のインストール

プロジェクトのセットアップは、ルートディレクトリで以下のコマンドを一度実行するだけで完了します。

**重要:** `install:all` は `package.json` で定義されたスクリプトのため、必ず `npm run` を付けて実行してください。

```bash
npm run install:all
```

このコマンドは、`manager`、`agent`、`common`、およびルート自身のすべての依存関係を並行してインストールします。これにより、各パッケージが他のローカルパッケージを参照する際に必要な推移的依存関係も解決されます。

### 個別の依存関係のインストール

特定のパッケージにのみ依存関係を追加・更新した場合は、個別のインストールコマンドも利用できます。（こちらも同様に `npm run` が必要です）

-   **`manager`のみインストール:** `npm run install:manager`
-   **`agent`のみインストール:** `npm run install:agent`

**注意:** 新しいパッケージを `manager` や `agent` に追加した場合は、`npm run install:all` を再実行するか、上記の個別インストールコマンドを実行してください。

## 3. アプリケーションの起動 (開発モード)

開発サーバーの起動は、プロジェクトの**ルートディレクトリ**から、統一されたコマンドで実行できます。

-   **`manager`と`agent`を同時に起動:**
    ```bash
    npm run dev
    ```

-   **`manager`のみを起動:**
    ```bash
    npm run dev:manager
    ```

-   **`agent`のみを起動:**
    ```bash
    npm run dev:agent
    ```

## 4. アプリケーションのビルド

アプリケーションのビルドも、プロジェクトの**ルートディレクトリ**から実行できます。

-   **`manager`と`agent`を両方ビルド (現在のOS向け):**
    ```bash
    npm run build
    ```

-   **`manager`のみをビルド (現在のOS向け):**
    ```bash
    npm run build:manager
    ```

-   **`agent`のみをビルド (現在のOS向け):**
    ```bash
    npm run build:agent
    ```

### プラットフォームを指定したビルド

特定のOS向けのビルドも、ルートから実行可能です。

-   **`manager`をWindows向けにビルド:**
    ```bash
    npm run build:manager:win
    ```

-   **`agent`をLinux向けにビルド:**
    ```bash
    npm run build:agent:linux
    ```
(他のOSも`package.json`のscriptsセクションを参照してください)

## 5. 新しいパッケージの追加

新しいパッケージ（例: `my-new-app`）を追加する場合は、以下の手順で行います。

1.  ルートに新しいディレクトリを作成します (例: `my-new-app/`)。
2.  そのディレクトリ内で`npm init`を実行し、`package.json`を作成します。
3.  必要に応じて、ルートの`package.json`に、その新しいパッケージを操作するためのスクリプトを追加します（例: `dev:my-new-app`）。

この構成では、npm Workspacesのように自動でパッケージがリンクされることはないため、すべて手動で管理します。