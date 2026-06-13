import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useFileStore } from "@/features/files/store";
import { importFromSaf, importPaths, pickImportItems, pickImportPhotos } from "@/lib/tauri";
import {
  isAndroidPlatform,
  isDesktopPlatform,
  isIOSPlatform,
  isMobilePlatform,
} from "@/lib/platform";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

const IMAGE_AND_ZIP_FILTERS = [
  {
    name: "Images & ZIP",
    extensions: [...IMAGE_EXTENSIONS, "zip"],
  },
];

const PHOTO_LIBRARY_OPTIONS = {
  multiple: true,
  pickerMode: "image" as const,
  filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
};

export function SettingsPanel() {
  const platformName = useFileStore((s) => s.platformName);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const setScanning = useFileStore((s) => s.setScanning);
  const setScanProgress = useFileStore((s) => s.setScanProgress);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const isDesktop = isDesktopPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);
  const isIOS = isIOSPlatform(platformName);
  const isAndroid = isAndroidPlatform(platformName);

  async function runImport(paths: string[], label: string) {
    if (paths.length === 0) return;
    setScanning(true);
    setScanProgress(`${label}中…`);
    setLastResult(null);
    try {
      const result = await importPaths(paths);
      const message = `完了: 画像 ${result.imageCount} 件, ZIP ${result.zipCount} 件, エラー ${result.errorCount} 件`;
      setScanProgress(message);
      setLastResult(message);
      await setViewMode("ai-library");
    } catch (e) {
      const message = String(e);
      setScanProgress(message);
      setLastResult(message);
    } finally {
      setScanning(false);
    }
  }

  function normalizeSelectedPaths(
    selected: string | string[] | { path: string } | Array<{ path: string }> | null,
  ): string[] {
    if (!selected) return [];
    if (typeof selected === "string") return [selected];
    if (Array.isArray(selected)) {
      return selected.map((item) => (typeof item === "string" ? item : item.path));
    }
    return [selected.path];
  }

  async function handleImportFromICloud() {
    if (isIOS) {
      const paths = await pickImportItems();
      await runImport(paths, "iCloud/ファイル・フォルダからインポート");
      return;
    }

    if (isAndroid) {
      const selected = await open({ multiple: true, filters: IMAGE_AND_ZIP_FILTERS });
      await runImport(normalizeSelectedPaths(selected), "SAF/ファイルからインポート");
      return;
    }

    const selected = await open({ multiple: true, filters: IMAGE_AND_ZIP_FILTERS });
    await runImport(normalizeSelectedPaths(selected), "iCloud/ファイルからインポート");
  }

  async function handleImportFromPhotoLibrary() {
    if (isIOS) {
      const paths = await pickImportPhotos();
      await runImport(paths, "写真ライブラリからインポート");
      return;
    }

    if (isAndroid) {
      const selected = await open(PHOTO_LIBRARY_OPTIONS);
      await runImport(normalizeSelectedPaths(selected), "画像からインポート");
      return;
    }

    const selected = await open(PHOTO_LIBRARY_OPTIONS);
    await runImport(normalizeSelectedPaths(selected), "写真ライブラリからインポート");
  }

  async function handleImportFolder() {
    if (isAndroid) {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected !== "string") return;
      await runImport([selected], "フォルダからインポート");
      return;
    }

    const selected = await open({ directory: true, multiple: false, recursive: true });
    if (typeof selected !== "string") return;
    await runImport([selected], "フォルダからインポート");
  }

  async function handleSafImport() {
    const selected = await open({ multiple: false, filters: IMAGE_AND_ZIP_FILTERS });
    const paths = normalizeSelectedPaths(selected);
    if (paths.length === 0) return;
    const uri = paths[0];
    setScanning(true);
    setScanProgress("SAF インポート中…");
    try {
      await importFromSaf(uri);
      setScanProgress("SAF インポート完了");
      setLastResult("SAF インポート完了");
      await setViewMode("ai-library");
    } catch {
      await runImport(paths, "ファイルからインポート（フォールバック）");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-lg font-medium">設定</h1>
          <p className="mt-1 text-sm text-neutral-500">
            iCloud Drive・写真ライブラリ・画像フォルダから AI Library に取り込みます。
          </p>
        </div>

        <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium">インポート</h2>
          <p className="text-xs text-neutral-500">
            {isIOS
              ? "iCloud では画像ファイル・ZIP・画像フォルダをまとめて選べます。写真ライブラリはオリジナルファイルを保持してインポートします（AIメタデータ付き画像向け）。"
              : isAndroid
                ? "Android ではファイルピッカー（SAF）経由で画像・ZIP・フォルダをインポートします。"
                : "ファイルピッカーで iCloud Drive 内の画像・ZIP、またはフォルダを選べます。"}
          </p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void handleImportFromICloud()} className="action-btn">
              {isIOS
                ? "iCloud / ファイル・フォルダを選択"
                : isAndroid
                  ? "ファイルを選択（SAF）"
                  : "画像・ZIP を選択"}
            </button>
            {isMobile && (
              <button
                type="button"
                onClick={() => void handleImportFromPhotoLibrary()}
                className="action-btn"
              >
                {isAndroid ? "画像を選択" : "写真ライブラリから選択"}
              </button>
            )}
            {(isDesktop || isAndroid) && (
              <button type="button" onClick={() => void handleImportFolder()} className="action-btn">
                フォルダを選択
              </button>
            )}
            {isAndroid && (
              <button type="button" onClick={() => void handleSafImport()} className="action-btn">
                SAF 単一ファイルインポート
              </button>
            )}
          </div>
        </section>

        {isDesktop && (
          <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium">Desktop</h2>
            <p className="text-xs text-neutral-500">
              Sidebar の NovelAI (iCloud) から直接閲覧・スキャンも利用できます。
            </p>
          </section>
        )}

        {lastResult && (
          <p className="rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
            {lastResult}
          </p>
        )}
      </div>
    </div>
  );
}
