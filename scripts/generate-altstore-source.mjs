#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(resolve(root, "altstore/config.json"), "utf8"));
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const ipaPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(root, "release/ios", `AI-File-Manager-${pkg.version}.ipa`);

const ipaStat = statSync(ipaPath);
const version = pkg.version;
const tag = `v${version}`;
const repo = process.env.ALTSTORE_REPO ?? config.repo;
const releaseIpaName = `AI-File-Manager-${version}.ipa`;
const downloadURL =
  process.env.ALTSTORE_DOWNLOAD_URL ??
  `https://github.com/${repo}/releases/download/${tag}/${releaseIpaName}`;
const sourceURL =
  process.env.ALTSTORE_SOURCE_URL ??
  `https://raw.githubusercontent.com/${repo}/main/altstore/source.json`;
const iconURL =
  process.env.ALTSTORE_ICON_URL ??
  `https://raw.githubusercontent.com/${repo}/main/${config.iconPath}`;

const source = {
  name: config.appName,
  sourceURL,
  apps: [
    {
      name: config.appName,
      bundleIdentifier: config.bundleIdentifier,
      developerName: config.developerName,
      subtitle: config.subtitle,
      version,
      versionDate: new Date().toISOString(),
      versionDescription: `AI File Manager ${version}`,
      downloadURL,
      localizedDescription:
        "AI 生成画像のメタデータ・プロンプト・タグを管理するファイルマネージャー。AltStore 経由でインストールすると、AltServer と同一 Wi-Fi 上で署名が自動更新されます（無料 Apple ID は約7日ごと）。",
      iconURL,
      tintColor: config.tintColor,
      size: ipaStat.size,
    },
  ],
  news: [],
};

const outPath = resolve(root, "altstore/source.json");
writeFileSync(outPath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
console.log(`IPA size: ${ipaStat.size} bytes`);
console.log(`downloadURL: ${downloadURL}`);
