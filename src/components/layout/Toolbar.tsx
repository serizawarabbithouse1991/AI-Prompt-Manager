import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useFileStore } from "@/features/files/store";
import { isDesktopPlatform, isMobilePlatform } from "@/lib/platform";
import { scanFolder } from "@/lib/tauri";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconRefresh,
} from "@/components/ui/Icons";

export function Toolbar() {
  const goBack = useFileStore((s) => s.goBack);
  const goForward = useFileStore((s) => s.goForward);
  const goUp = useFileStore((s) => s.goUp);
  const runSearch = useFileStore((s) => s.runSearch);
  const refresh = useFileStore((s) => s.refresh);
  const scanning = useFileStore((s) => s.scanning);
  const scanProgress = useFileStore((s) => s.scanProgress);
  const batchProgress = useFileStore((s) => s.batchProgress);
  const setScanning = useFileStore((s) => s.setScanning);
  const setScanProgress = useFileStore((s) => s.setScanProgress);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const platformName = useFileStore((s) => s.platformName);
  const viewMode = useFileStore((s) => s.viewMode);
  const searchScope = useFileStore((s) => s.searchScope);
  const searchTagId = useFileStore((s) => s.searchTagId);
  const setSearchScope = useFileStore((s) => s.setSearchScope);
  const allTags = useFileStore((s) => s.allTags);
  const setSearchTagId = useFileStore((s) => s.setSearchTagId);

  const selectedSearchTag = allTags.find((tag) => tag.id === searchTagId) ?? null;

  useEffect(() => {
    const input = document.getElementById("search-input") as HTMLInputElement | null;
    if (!input) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const value = target.value.trim();
      if (value) void runSearch(value);
      else if (searchTagId) void runSearch("");
      else if (viewMode === "search") void setViewMode("browse");
    };
    input.addEventListener("change", handler);
    return () => input.removeEventListener("change", handler);
  }, [runSearch, searchTagId, setViewMode, viewMode]);

  async function handleOpenFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await useFileStore.getState().navigateTo(selected);
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
  const isMobile = isMobilePlatform(platformName);

  return (
    <header className="flex min-h-11 shrink-0 items-center gap-1.5 border-b border-neutral-800 bg-neutral-950 px-2 pt-[var(--safe-top)] sm:min-h-12 sm:gap-2 sm:px-3">
      {isDesktop && (
        <>
          <button type="button" onClick={() => void goBack()} className="toolbar-btn" aria-label="戻る">
            <IconChevronLeft />
          </button>
          <button type="button" onClick={() => void goForward()} className="toolbar-btn" aria-label="進む">
            <IconChevronRight />
          </button>
          <button type="button" onClick={() => void goUp()} className="toolbar-btn" aria-label="上へ">
            <IconChevronUp />
          </button>
          <button type="button" onClick={() => void handleOpenFolder()} className="toolbar-btn">
            開く
          </button>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          id="search-input"
          type="search"
          placeholder="検索… (#タグ名 でタグ検索)"
          className="min-w-0 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const value = (e.target as HTMLInputElement).value.trim();
              if (value || searchTagId) void runSearch(value);
            }
          }}
        />
        {selectedSearchTag && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-xs">
            <span className="text-neutral-500">#</span>
            {selectedSearchTag.name}
            <button
              type="button"
              onClick={() => setSearchTagId(null)}
              className="text-neutral-500 hover:text-neutral-300"
              aria-label="検索タグを解除"
            >
              ×
            </button>
          </span>
        )}
      </div>
      <label className="hidden items-center gap-1 text-xs text-neutral-500 md:flex">
        <input
          type="checkbox"
          checked={searchScope === "folder"}
          onChange={(e) => setSearchScope(e.target.checked ? "folder" : "global")}
        />
        フォルダ内
      </label>
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
      {isMobile && viewMode !== "settings" && (
        <button
          type="button"
          onClick={() => void setViewMode("settings")}
          className="toolbar-btn shrink-0 whitespace-nowrap lg:hidden"
        >
          設定
        </button>
      )}
      <button type="button" onClick={() => void refresh()} className="toolbar-btn shrink-0" aria-label="更新">
        <IconRefresh />
      </button>
      {scanProgress && (
        <span className="hidden max-w-[5rem] truncate text-xs text-neutral-500 sm:max-w-[8rem] lg:max-w-xs xl:block">
          {scanProgress}
        </span>
      )}
      {batchProgress && (
        <span className="max-w-[4rem] truncate text-xs text-blue-400 sm:max-w-[6rem] lg:max-w-xs">
          {batchProgress}
        </span>
      )}
    </header>
  );
}
