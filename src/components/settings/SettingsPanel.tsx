import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useFileStore } from "@/features/files/store";
import { importPaths, pickImportFolder } from "@/lib/tauri";
import { isDesktopPlatform, isMobilePlatform } from "@/lib/platform";

const IMAGE_AND_ZIP_FILTERS = [
  {
    name: "Images & ZIP",
    extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "zip"],
  },
];

const DOCUMENT_PICKER_OPTIONS = {
  multiple: true,
  pickerMode: "document" as const,
  fileAccessMode: "copy" as const,
  filters: IMAGE_AND_ZIP_FILTERS,
};

export function SettingsPanel() {
  const platformName = useFileStore((s) => s.platformName);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const setScanning = useFileStore((s) => s.setScanning);
  const setScanProgress = useFileStore((s) => s.setScanProgress);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const isDesktop = isDesktopPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);

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

  async function handleImportFiles() {
    const selected = await open(
      isMobile ? DOCUMENT_PICKER_OPTIONS : { multiple: true, filters: IMAGE_AND_ZIP_FILTERS },
    );
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await runImport(paths, "iCloud/ファイルからインポート");
  }

  async function handleImportFolder() {
    if (isMobile) {
      const path = await pickImportFolder();
      if (!path) return;
      await runImport([path], "フォルダからインポート");
      return;
    }

    const selected = await open({ directory: true, multiple: false, recursive: true });
    if (typeof selected !== "string") return;
    await runImport([selected], "フォルダからインポート");
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-lg font-medium">設定</h1>
          <p className="mt-1 text-sm text-neutral-500">
            iCloud Drive や Files アプリ内の画像・ZIP を AI Library に取り込みます。
          </p>
        </div>

        <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium">iCloud / ファイルからインポート</h2>
          <p className="text-xs text-neutral-500">
            {isMobile
              ? "フォルダ選択では iCloud Drive 上のフォルダ（NovelAI など）を選べます。ZIP 内の画像も自動展開します。"
              : "ファイルピッカーで iCloud Drive 内のフォルダ・ZIP・画像を選べます。"}
          </p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void handleImportFiles()} className="action-btn">
              画像・ZIP を選択
            </button>
            <button type="button" onClick={() => void handleImportFolder()} className="action-btn">
              フォルダを選択（iCloud 含む）
            </button>
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
