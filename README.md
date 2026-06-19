# AI File Manager

AI 生成画像のメタデータ・プロンプト・タグを管理するクロスプラットフォームファイルマネージャー（v0.1）。

## 技術スタック

- Tauri v2 + React + TypeScript + Rust + SQLite
- Tailwind CSS + Zustand

## Windows 前提

- [Node.js](https://nodejs.org/) 22 LTS 推奨
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（「C++ によるデスクトップ開発」ワークロード）
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 10/11 では多くの環境で既にインストール済み）

## 開発

```bash
npm install
npm run tauri dev          # Desktop (macOS / Windows)
npm run tauri android dev  # Android (要 Android Studio / SDK)
```

## ビルド

```bash
npm run build
npm run tauri build
npm run tauri android build
```

### Windows インストーラ

`npm run tauri build` 成功後、NSIS インストーラは次のパスに生成されます。

```
src-tauri/target/release/bundle/nsis/AI File Manager_*_x64-setup.exe
```

- インストール先: ユーザー単位（管理者権限不要）
- アプリデータ: `%APPDATA%\com.ryotaro.ai-file-manager\`（DB・AI Library・サムネイル）

### GitHub Release（Windows）

Windows 向けインストーラは [GitHub Releases](https://github.com/serizawarabbithouse1991/AI-Prompt-Manager/releases) からダウンロードできます。最新の `*-setup.exe` を取得して実行してください。

リリース用ビルドは `v*` 形式の tag を push すると [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml) が自動実行され、GitHub Release にインストーラが添付されます。

```bash
git tag v0.1.0
git push origin v0.1.0
```

未署名ビルドのため、初回インストール時に SmartScreen の警告が出る場合があります。「詳細情報」→「実行」で続行できます。

## v0.1 機能

### Desktop
- フォルダ閲覧・ナビゲーション
- 画像プレビュー・サムネイル
- AI メタデータ抽出（NovelAI / A1111 / ComfyUI）
- タグ・お気に入り・検索
- リネーム・ゴミ箱移動
- フォルダ再帰スキャン → SQLite 保存

### Android
- SAF 経由の画像インポート → AI Library
- 閲覧・メタデータ・タグ・検索・お気に入り

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
