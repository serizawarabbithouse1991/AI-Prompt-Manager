import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useFileStore } from "@/features/files/store";
import { isAndroidPlatform, isDesktopPlatform } from "@/lib/platform";
import { importFromSaf, scanFolder } from "@/lib/tauri";

export function Toolbar() {
  const goBack = useFileStore((s) => s.goBack);
  const goForward = useFileStore((s) => s.goForward);
  const goUp = useFileStore((s) => s.goUp);
  const runSearch = useFileStore((s) => s.runSearch);
  const refresh = useFileStore((s) => s.refresh);
  const scanning = useFileStore((s) => s.scanning);
  const scanProgress = useFileStore((s) => s.scanProgress);
  const setScanning = useFileStore((s) => s.setScanning);
  const setScanProgress = useFileStore((s) => s.setScanProgress);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const platformName = useFileStore((s) => s.platformName);
  const viewMode = useFileStore((s) => s.viewMode);

  useEffect(() => {
    const input = document.getElementById("search-input") as HTMLInputElement | null;
    if (!input) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const value = target.value.trim();
      if (value) void runSearch(value);
      else if (viewMode === "search") void setViewMode("browse");
    };
    input.addEventListener("change", handler);
    return () => input.removeEventListener("change", handler);
  }, [runSearch, setViewMode, viewMode]);

  async function handleOpenFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await useFileStore.getState().navigateTo(selected);
    }
  }

  async function handleAndroidImport() {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setScanning(true);
    setScanProgress("インポート中…");
    try {
      for (const path of paths) {
        await importFromSaf(path);
      }
      setScanProgress(`インポート完了: ${paths.length} 件`);
      await setViewMode("ai-library");
    } catch (e) {
      setScanProgress(String(e));
    } finally {
      setScanning(false);
    }
  }

  async function handleScan() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;
    setScanning(true);
    setScanProgress("スキャン中…");
    try {
      const result = await scanFolder(selected, true);
      setScanProgress(
        `完了: ${result.scannedCount} 件 (画像 ${result.imageCount}, エラー ${result.errorCount})`,
      );
      await setViewMode("ai-library");
    } catch (e) {
      setScanProgress(String(e));
    } finally {
      setScanning(false);
    }
  }

  const isDesktop = isDesktopPlatform(platformName);
  const isAndroid = isAndroidPlatform(platformName);

  return (
    <header className="flex h-12 items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3">
      {isDesktop && (
        <>
          <button type="button" onClick={() => void goBack()} className="toolbar-btn">
            ←
          </button>
          <button type="button" onClick={() => void goForward()} className="toolbar-btn">
            →
          </button>
          <button type="button" onClick={() => void goUp()} className="toolbar-btn">
            ↑
          </button>
          <button type="button" onClick={() => void handleOpenFolder()} className="toolbar-btn">
            開く
          </button>
        </>
      )}
      <input
        id="search-input"
        type="search"
        placeholder="検索…"
        className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const value = (e.target as HTMLInputElement).value.trim();
            if (value) void runSearch(value);
          }
        }}
      />
      {isDesktop && (
        <button
          type="button"
          disabled={scanning}
          onClick={() => void handleScan()}
          className="toolbar-btn whitespace-nowrap"
        >
          {scanning ? "スキャン中" : "スキャン"}
        </button>
      )}
      {isAndroid && (
        <button
          type="button"
          disabled={scanning}
          onClick={() => void handleAndroidImport()}
          className="toolbar-btn whitespace-nowrap"
        >
          画像を追加
        </button>
      )}
      <button type="button" onClick={() => void refresh()} className="toolbar-btn">
        ↻
      </button>
      {scanProgress && (
        <span className="hidden truncate text-xs text-neutral-500 lg:block">{scanProgress}</span>
      )}
    </header>
  );
}
