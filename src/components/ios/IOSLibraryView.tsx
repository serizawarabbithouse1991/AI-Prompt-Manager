import { useState } from "react";
import { FileBrowser } from "@/components/file/FileBrowser";
import { IOSNavBar, IOSNavIconButton } from "@/components/ios/IOSNavBar";
import { IOSFilterSheet } from "@/components/ios/IOSFilterSheet";
import { useFileStore } from "@/features/files/store";
import { IconRefresh } from "@/components/ui/Icons";

type IOSLibraryViewProps = {
  title: string;
};

export function IOSLibraryView({ title }: IOSLibraryViewProps) {
  const refresh = useFileStore((s) => s.refresh);
  const runSearch = useFileStore((s) => s.runSearch);
  const viewMode = useFileStore((s) => s.viewMode);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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
    if (value) void runSearch(value);
    else if (viewMode === "search") void setViewMode("ai-library");
  }

  return (
    <div className="ios-tab-content flex min-h-0 flex-1 flex-col">
      <IOSNavBar
        title={title}
        trailing={
          <>
            <IOSNavIconButton label="検索" onClick={() => setSearchOpen((v) => !v)}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
            </IOSNavIconButton>
            <IOSNavIconButton label="フィルタ" onClick={() => setFilterOpen(true)}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
            </IOSNavIconButton>
            <IOSNavIconButton label="更新" onClick={() => void handleRefresh()} disabled={refreshing}>
              <IconRefresh className={["h-5 w-5", refreshing ? "animate-spin" : ""].join(" ")} />
            </IOSNavIconButton>
          </>
        }
      />
      {searchOpen && (
        <div className="shrink-0 border-b border-[var(--ios-separator)] px-4 py-2">
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchSubmit();
            }}
            placeholder="検索…"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base"
          />
        </div>
      )}
      <div className="ios-file-area min-h-0 flex-1 overflow-hidden">
        <FileBrowser />
      </div>
      <IOSFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
