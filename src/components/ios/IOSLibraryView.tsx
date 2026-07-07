import { useEffect, useState } from "react";
import { FileBrowser } from "@/components/file/FileBrowser";
import { IOSNavBar, IOSNavIconButton } from "@/components/ios/IOSNavBar";
import { IOSFilterSheet } from "@/components/ios/IOSFilterSheet";
import { IOSSearchTagSheet } from "@/components/ios/IOSSearchTagSheet";
import { IOSNavTrailingWithGrid } from "@/components/ios/IOSGridSizeNavButton";
import { useFileStore } from "@/features/files/store";
import { IconRefresh } from "@/components/ui/Icons";

type IOSLibraryViewProps = {
  title: string;
  showSearch?: boolean;
};

export function IOSLibraryView({ title, showSearch = true }: IOSLibraryViewProps) {
  const refresh = useFileStore((s) => s.refresh);
  const runSearch = useFileStore((s) => s.runSearch);
  const viewMode = useFileStore((s) => s.viewMode);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const searchTagId = useFileStore((s) => s.searchTagId);
  const filterTagId = useFileStore((s) => s.filterTagId);
  const allTags = useFileStore((s) => s.allTags);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const setSearchTagId = useFileStore((s) => s.setSearchTagId);
  const setFilterTagId = useFileStore((s) => s.setFilterTagId);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const startSelectionMode = useFileStore((s) => s.startSelectionMode);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const selectedSearchTag = allTags.find((tag) => tag.id === searchTagId) ?? null;
  const activeFilterTag = allTags.find((tag) => tag.id === filterTagId) ?? null;

  useEffect(() => {
    if (viewMode === "search") {
      setSearchOpen(true);
      setSearchText(searchQuery);
    }
  }, [viewMode, searchQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  function handleSearchSubmit() {
    const value = searchText.trim();
    if (value || searchTagId) void runSearch(value);
    else if (viewMode === "search") void setViewMode("ai-library");
  }

  return (
    <div className="ios-tab-content flex min-h-0 flex-1 flex-col">
      <IOSNavBar
        title={title}
        trailing={
          selectionMode ? undefined : (
            <IOSNavTrailingWithGrid>
              <button
                type="button"
                onClick={startSelectionMode}
                className="px-1 text-base text-blue-400"
              >
                選択
              </button>
              {showSearch && (
                <IOSNavIconButton label="検索" onClick={() => setSearchOpen((v) => !v)}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3-3" />
                  </svg>
                </IOSNavIconButton>
              )}
              {showSearch && (
                <IOSNavIconButton label="タグで検索" onClick={() => setTagSheetOpen(true)}>
                  <span className="text-lg font-semibold">#</span>
                </IOSNavIconButton>
              )}
              <IOSNavIconButton label="フィルタ" onClick={() => setFilterOpen(true)}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
              </IOSNavIconButton>
              <IOSNavIconButton label="更新" onClick={() => void handleRefresh()} disabled={refreshing}>
                <IconRefresh className={["h-5 w-5", refreshing ? "animate-spin" : ""].join(" ")} />
              </IOSNavIconButton>
            </IOSNavTrailingWithGrid>
          )
        }
      />
      {showSearch && searchOpen && (
        <div className="shrink-0 space-y-2 border-b border-[var(--ios-separator)] px-4 py-2">
          <div className="flex gap-2">
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchSubmit();
              }}
              placeholder="プロンプト・ファイル名・#タグで検索…"
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base"
            />
            <button
              type="button"
              onClick={() => setTagSheetOpen(true)}
              className="flex min-h-[var(--ios-touch-min)] min-w-[var(--ios-touch-min)] items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 text-lg font-semibold text-neutral-200"
              aria-label="タグで検索"
            >
              #
            </button>
          </div>
          {selectedSearchTag && (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-3 py-1 text-sm">
                <span className="text-neutral-400">#</span>
                {selectedSearchTag.name}
                <button
                  type="button"
                  onClick={() => setSearchTagId(null)}
                  className="ml-1 text-neutral-500"
                  aria-label="検索タグを解除"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </div>
      )}
      {activeFilterTag && !searchOpen && (
        <div className="shrink-0 border-b border-[var(--ios-separator)] px-4 py-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/60 px-3 py-1 text-sm text-blue-200">
            <span className="text-blue-400">#</span>
            {activeFilterTag.name}
            <button
              type="button"
              onClick={() => setFilterTagId(null)}
              className="ml-1 text-blue-300"
              aria-label="タグフィルタを解除"
            >
              ×
            </button>
          </span>
        </div>
      )}
      <div className="ios-file-area min-h-0 flex-1 overflow-hidden">
        <FileBrowser />
      </div>
      <IOSFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
      {showSearch && (
        <IOSSearchTagSheet
          open={tagSheetOpen}
          onClose={() => setTagSheetOpen(false)}
          onSelected={() => setSearchOpen(true)}
        />
      )}
    </div>
  );
}
