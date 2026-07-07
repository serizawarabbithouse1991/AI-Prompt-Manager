#!/usr/bin/env bash
# Build an IPA for AltStore sideloading and generate altstore/source.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
IPA_SRC="src-tauri/gen/apple/build/arm64/AI File Manager.ipa"
IPA_DST="release/ios/AI-File-Manager-${VERSION}.ipa"

echo "==> Sync Privacy Manifest"
cp src-tauri/ios/PrivacyInfo.xcprivacy src-tauri/gen/apple/ai-file-manager_iOS/PrivacyInfo.xcprivacy

echo "==> Frontend build"
npm run build

echo "==> iOS IPA (debugging export for AltStore)"
npm run tauri ios build -- --export-method debugging --ci

if [[ ! -f "$IPA_SRC" ]]; then
  echo "error: IPA not found at $IPA_SRC" >&2
  exit 1
fi

mkdir -p release/ios
cp "$IPA_SRC" "$IPA_DST"
echo "==> IPA copied to $IPA_DST"

echo "==> AltStore source manifest"
node scripts/generate-altstore-source.mjs "$IPA_DST"

echo ""
echo "Done."
echo "  IPA:    $IPA_DST"
echo "  Source: altstore/source.json"
echo ""
echo "Next: upload IPA to GitHub Release, then add this source URL in AltStore on iPhone:"
echo "  https://raw.githubusercontent.com/$(node -p "require('./altstore/config.json').repo")/main/altstore/source.json"
