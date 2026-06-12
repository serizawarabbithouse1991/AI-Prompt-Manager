# AI File Manager

AI 生成画像のメタデータ・プロンプト・タグを管理するクロスプラットフォームファイルマネージャー（v0.1）。

## 技術スタック

- Tauri v2 + React + TypeScript + Rust + SQLite
- Tailwind CSS + Zustand

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
