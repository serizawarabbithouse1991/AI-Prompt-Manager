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

### iOS（AltStore ・署名自動更新）

無料 Apple ID で実機インストールしたアプリは **約7日で署名が切れます**。  
**AltStore + AltServer** を使うと、同一 Wi-Fi 上で **期限前に自動再署名** され、再インストールの手間を減らせます。

#### 1. 初回セットアップ（Mac + iPhone）

1. Mac に [AltServer](https://altstore.io/) をインストール（メニューバー常駐）
2. iPhone に **AltStore** を AltServer 経由でインストール
3. iPhone: 設定 → 一般 → VPNとデバイス管理 → 開発者を信頼

#### 2. IPA ビルド

```bash
npm run ios:altstore-ipa
```

生成物:

- `release/ios/AI-File-Manager-<version>.ipa`
- `altstore/source.json`（AltStore 更新ソース）

#### 3. GitHub Release に IPA を公開

```bash
# 例: v0.1.0 タグの Release に IPA を添付
gh release upload v0.1.0 release/ios/AI-File-Manager-0.1.0.ipa
git add altstore/source.json && git commit -m "Update AltStore source" && git push
```

`altstore/source.json` の `downloadURL` は Release の IPA URL と一致させてください。  
再生成: `npm run ios:altstore-source -- release/ios/AI-File-Manager-0.1.0.ipa`

#### 4. iPhone で AltStore ソースを追加

1. AltStore → **Sources** タブ → **+**
2. 次の URL を追加:

```
https://raw.githubusercontent.com/serizawarabbithouse1991/AI-Prompt-Manager/main/altstore/source.json
```

3. **My Apps** から **AI File Manager** をインストール

#### 5. 署名の自動更新（7日ごと）

- Mac で **AltServer を起動** した状態にする
- iPhone と Mac を **同一 Wi-Fi** に接続
- AltStore がバックグラウンドで再署名（Settings → Background Refresh を ON 推奨）

> Xcode / devicectl 直インストールのアプリは AltStore の自動更新対象外です。AltStore から入れ直してください。

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
