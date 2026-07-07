#!/usr/bin/env bash
# Build an App Store / TestFlight IPA (requires valid signing & provisioning on this Mac).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
IPA_SRC="src-tauri/gen/apple/build/arm64/AI File Manager.ipa"
IPA_DST="release/ios/AI-File-Manager-${VERSION}-appstore.ipa"
EXPORT_OPTS="scripts/ExportOptions-app-store.plist"
GEN_EXPORT_OPTS="src-tauri/gen/apple/ExportOptions.plist"

echo "==> Sync Privacy Manifest"
cp src-tauri/ios/PrivacyInfo.xcprivacy src-tauri/gen/apple/ai-file-manager_iOS/PrivacyInfo.xcprivacy

echo "==> Sync ExportOptions (app-store)"
cp "$EXPORT_OPTS" "$GEN_EXPORT_OPTS"

echo "==> Frontend build"
npm run build

echo "==> iOS IPA (app-store export for TestFlight)"
npm run tauri ios build -- --export-method app-store --ci

if [[ ! -f "$IPA_SRC" ]]; then
  echo "error: IPA not found at $IPA_SRC" >&2
  exit 1
fi

mkdir -p release/ios
cp "$IPA_SRC" "$IPA_DST"
echo "==> IPA copied to $IPA_DST"
echo ""
echo "Upload to TestFlight:"
echo "  xcrun altool --upload-app -f \"$IPA_DST\" -t ios --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>"
echo "  or use GitHub Actions workflow: ios-testflight.yml"
