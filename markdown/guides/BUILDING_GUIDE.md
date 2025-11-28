# ビルドガイド

このドキュメントでは、`manager`および`agent`の実行可能ファイルをビルドする手順について説明します。

## Manager (Electron App)

`manager`はElectronアプリケーションであり、`electron-builder`を使用してパッケージ化されます。

### 前提条件

- Node.js
- npm

### ビルドコマンド

`manager`ディレクトリで以下のコマンドを実行します。

- **現在のプラットフォーム向けビルド:**
  ```bash
  npm run build
  ```

- **特定のプラットフォーム向けビルド:**
  - Windows:
    ```bash
    npm run build:win
    ```
  - Linux:
    ```bash
    npm run build:linux
    ```
  - Mac:
    ```bash
    npm run build:mac
    ```

ビルドされたファイルは、プロジェクトルートの`releases/manager`ディレクトリに出力されます。

## Agent (Node.js App)

`agent`はNode.jsアプリケーションであり、`pkg`を使用して単一の実行可能ファイルにパッケージ化されます。

### 前提条件

- Node.js
- npm

### ビルドコマンド

`agent`ディレクトリで以下のコマンドを実行します。

- **現在のプラットフォーム向けビルド:**
  ```bash
  npm run build
  ```

- **特定のプラットフォーム向けビルド:**
  - Windows (x64):
    ```bash
    npm run build:win
    ```
  - Linux (x64):
    ```bash
    npm run build:linux
    ```
  - Mac (x64):
    ```bash
    npm run build:mac
    ```

ビルdされたファイルは、プロジェクトルートの`releases/agent`ディレクトリに出力されます。