# プロジェクト管理ガイド: npm Workspaces とスタンドアロンパッケージの併用

このドキュメントでは、`agent` (Node.js CLI) と `common` (共有モジュール) を npm Workspaces で管理しつつ、`manager` (Electron GUI) をスタンドアロンパッケージとして独立して管理する方法について説明します。

## 1. プロジェクト構造

このプロジェクトは、大部分がモノレポ（monorepo）として構成されていますが、一部のパッケージは独立して管理されています。

-   **npm Workspaces 管理下のパッケージ:**
    -   `agent/`: 各物理サーバー上で動作するNode.jsベースのエージェント。
    -   `common/`: `agent`と`manager`間で共有されるプロトコル定義やスキーマ。
-   **スタンドアロンパッケージ:**
    -   `manager/`: Electronのパッケージング要件のため、npm Workspacesの管理から外されたGUIアプリケーション。

ルートディレクトリの `package.json` は `agent` と `common` のみをワークスペースとして管理しています。

```
.
├── agent/
│   └── package.json
│   └── index.js
├── manager/
│   └── package.json
│   └── main.js
│   └── index.html
│   └── preload.js
├── common/
│   └── package.json
│   └── protocol.js
├── markdown/guides/
│   └── npm_control.md (このファイル)
└── package.json (ルートのpackage.json)
```

## 2. 依存関係のインストール

依存関係のインストールは、**2段階のプロセス**に分かれています。

### ステップ1: Workspaces (`agent`, `common`) のインストール

まず、プロジェクトのルートディレクトリで以下のコマンドを実行し、`agent`と`common`の依存関係をインストールします。

```bash
npm install
```

### ステップ2: `manager` (スタンドアロン) のインストール

次に、`manager`ディレクトリに移動し、`manager`専用の依存関係をインストールします。

```bash
cd manager
npm install
```

**重要:** `manager`の依存関係を追加・更新した場合は、必ず`manager`ディレクトリ内で`npm install`を実行してください。

## 3. アプリケーションの起動 (開発モード)

開発中は、各アプリケーションを個別に、または同時に開発モードで起動できます。

### 3.1. `manager` (Electron GUI) の起動

`manager`はルートディレクトリから起動できます。

```bash
npm run dev:manager
```

**推奨される開発環境:**
`manager`はWindows/macOSでの動作を想定しているため、開発・デバッグは**WindowsまたはmacOSのローカル環境**で行うことを強く推奨します。これにより、ネイティブなパフォーマンスとスムーズなデバッグ体験が得られます。

### 3.2. `agent` (Node.js CLI) の起動

`agent`はワークスペース管理下にあるため、ルートディレクトリから起動できます。

```bash
npm run dev:agent
# または
npm run dev -w agent
```

**推奨される開発環境:**
`agent`はUbuntu ServerなどのCLI環境で動作するため、開発・デバッグは**Ubuntu Server上のVS Code Server環境**で行うのが効率的です。

### 3.3. 両方を同時に起動

もし、GUI付きのLinux環境などで両方のアプリケーションを同時に開発・テストしたい場合は、ルートディレクトリで以下のコマンドを実行できます。

```bash
npm run dev
```

このコマンドは `concurrently` を使用して、`dev:manager` と `dev:agent` の両方を並行して実行します。

## 4. アプリケーションのビルドとパッケージ作成

プロジェクト全体のビルドは、ルートディレクトリで以下のコマンドを実行することで行えます。

```bash
npm run build
```

このコマンドは、`manager`、`agent`、`common`のすべてのパッケージを並行してビルドします。

### 4.1. 個別のパッケージのビルド

特定のパッケージのみをビルドしたい場合は、以下のコマンドを使用します。

-   **`manager`のビルド:**
    ```bash
    npm run build:manager
    # または
    npm run build --prefix manager
    ```

-   **`agent`のビルド:**
    ```bash
    npm run build -w agent
    ```

## 5. 依存関係の更新

### 5.1. 全体の依存関係の更新

ルートディレクトリの `package.json` に定義されている依存関係や、全てのワークスペースの依存関係を更新するには、ルートで以下のコマンドを実行します。

```bash
npm update
```

### 5.2. 特定のパッケージの依存関係の更新

-   **`manager`の更新:**
    `manager`ディレクトリ内で`npm update`を実行します。
    ```bash
    cd manager
    npm update
    ```

-   **`agent`または`common`の更新:**
    ルートディレクトリから`--workspace`フラグを使用して更新します。
    ```bash
    # agent ワークスペースの依存関係のみを更新
    npm update -w agent
    ```

## 6. 新しいワークスペースの追加

新しいパッケージをワークスペースに追加する手順は従来通りです。

1.  新しいディレクトリを作成します (例: `packages/my-new-app`)。
2.  そのディレクトリ内で `npm init` を実行し、`package.json` を作成します。
3.  ルートの `package.json` の `workspaces` 配列に、新しいワークスペースのパスを追加します。
4.  ルートディレクトリで `npm install` を実行します。

**注意:** 新しいパッケージを`manager`のようにスタンドアロンで管理したい場合は、`workspaces`配列には追加しないでください。

## 7. `npm start` と `npm run dev` の違い

このセクションの原則は変わりませんが、`manager`のコマンドは`manager`ディレクトリ内で実行する必要があります。

-   **開発中:**
    ```bash
    cd manager
    npm run dev
    ```
-   **ビルド後の実行:**
    ```bash
    cd manager
    npm start
    ```