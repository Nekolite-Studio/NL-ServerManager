# プロジェクト管理ガイド: npm Workspaces を利用したビルド・起動・更新

このドキュメントでは、`manager` (Electron GUI) と `agent` (Node.js CLI) の2つのアプリケーションを npm Workspaces を利用して管理する方法について説明します。

## 1. プロジェクト構造

このプロジェクトはモノレポ（monorepo）として構成されており、以下のワークスペースが含まれています。

-   `manager/`: Minecraftサーバー管理用のElectronベースのGUIアプリケーション。
-   `agent/`: 各物理サーバー上で動作し、`manager`からの指示を受けたり、サーバー情報を提供するNode.jsベースのエージェント。

ルートディレクトリの `package.json` がこれらのワークスペースを管理しています。

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
├── guide/
│   └── npm_control.md (このファイル)
└── package.json (ルートのpackage.json)
```

## 2. 依存関係のインストール

プロジェクト全体の依存関係は、ルートディレクトリで以下のコマンドを実行することでインストールされます。npm Workspaces の機能により、各ワークスペースの依存関係も適切に解決され、ルートの `node_modules` に一元的に管理されます。

```bash
npm install
```

## 3. アプリケーションの起動 (開発モード)

開発中は、各アプリケーションを個別に、または同時に開発モードで起動できます。

### 3.1. `manager` (Electron GUI) の起動

`manager`アプリケーションはGUIを持つため、デスクトップ環境（Windows, macOS, GUI付きLinuxなど）で実行する必要があります。

```bash
npm run dev:manager
# または
npm run dev -w manager
```

**推奨される開発環境:**
`manager`はWindows/macOSでの動作を想定しているため、開発・デバッグは**WindowsまたはmacOSのローカル環境**で行うことを強く推奨します。これにより、ネイティブなパフォーマンスとスムーズなデバッグ体験が得られます。

### 3.2. `agent` (Node.js CLI) の起動

`agent`アプリケーションはCLIベースであり、サーバー環境（Ubuntu Serverなど）で実行されます。

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

`manager`アプリケーションは `electron-builder` を使用して、各プラットフォーム向けの実行可能ファイルとインストーラーを生成します。ビルドされた成果物は `manager/dist/` ディレクトリに出力されます。

### 4.1. `manager` のビルド

開発時のビルド時間を短縮するため、デフォルトの `build` コマンドはLinux向けのみを生成するように設定されています。

*   **Linux向けビルド (開発用):**
    ```bash
    npm run build -w manager
    ```
    これにより、Linux向けの `AppImage` や `deb` パッケージが生成されます。

*   **Windows向けビルド:**
    ```bash
    npm run build -w manager -- --win
    ```
    これにより、Windows向けの `exe` インストーラーが生成されます。

*   **macOS向けビルド:**
    ```bash
    npm run build -w manager -- --mac
    ```
    これにより、macOS向けの `dmg` パッケージが生成されます。
    **注意:** macOS以外のOSでmacOS向けビルドを行う場合、特定の依存関係や設定（例: コードサイニング）が必要になる場合があります。

### 4.2. `agent` のビルド

`agent`はNode.jsアプリケーションであるため、通常は特別なビルドステップは不要です。`npm install` で依存関係がインストールされていれば、`node index.js` で実行可能です。もしTypeScriptなどで記述する場合は、別途トランスパイルのステップが必要になります。

## 5. 依存関係の更新

### 5.1. 全体の依存関係の更新

ルートディレクトリの `package.json` に定義されている依存関係や、全てのワークスペースの依存関係を更新するには、ルートで以下のコマンドを実行します。

```bash
npm update
```

### 5.2. 特定のワークスペースの依存関係の更新

特定のワークスペース（例: `manager`）の依存関係のみを更新したい場合は、そのワークスペースのディレクトリに移動して `npm update` を実行するか、ルートから `--workspace` フラグを使用します。

```bash
# manager ワークスペースの依存関係のみを更新
npm update -w manager
```

## 6. 新しいワークスペースの追加

新しいアプリケーションやライブラリをモノレポに追加したい場合は、以下の手順で行います。

1.  新しいディレクトリを作成します (例: `packages/my-new-app`)。
2.  そのディレクトリ内で `npm init` を実行し、`package.json` を作成します。
3.  ルートの `package.json` の `workspaces` 配列に、新しいワークスペースのパスを追加します。
    ```json
    // package.json (ルート)
    {
      "name": "server-manager-monorepo",
      "private": true,
      "workspaces": [
        "manager",
        "agent",
        "packages/my-new-app" // ここに追加
      ],
      // ...
    }
    ```
4.  ルートディレクトリで `npm install` を実行し、新しいワークスペースをモノレポに統合します。

## 7. `npm start` と `npm run dev` の違い

`manager/package.json` には以下のスクリプトが定義されています。

*   `"start": "npm run build && electron ."`: このコマンドは、まずアプリケーションをビルドし、その後ビルドされたElectronアプリケーションを実行します。これは、最終的なパッケージング前のテストや、ビルド済みアプリの実行を想定しています。
*   `"dev": "electron ."`: このコマンドは、ビルドステップをスキップし、直接Electronを開発モードで起動します。通常、ホットリロードなどの開発ツールと組み合わせて使用され、開発中の高速なイテレーションに適しています。

開発中は `npm run dev:manager` を使用し、ビルド後の動作確認や配布前の最終チェックには `npm run start -w manager` を使用するのが一般的です。
