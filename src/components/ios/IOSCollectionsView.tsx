import { useState } from "react";
import { CollectionsPanel } from "@/components/collections/CollectionsPanel";
import { FileBrowser } from "@/components/file/FileBrowser";
import { IOSNavBar, IOSNavIconButton } from "@/components/ios/IOSNavBar";
import { IOSNavTrailingWithGrid } from "@/components/ios/IOSGridSizeNavButton";
import { IOSFilterSheet } from "@/components/ios/IOSFilterSheet";
import { useFileStore } from "@/features/files/store";
import { IconRefresh } from "@/components/ui/Icons";

export function IOSCollectionsView() {
  const selectedCollectionId = useFileStore((s) => s.selectedCollectionId);
  const collections = useFileStore((s) => s.collections);
  const setSelectedCollectionId = useFileStore((s) => s.setSelectedCollectionId);
  const refresh = useFileStore((s) => s.refresh);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const startSelectionMode = useFileStore((s) => s.startSelectionMode);
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selected = collections.find((c) => c.id === selectedCollectionId);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (selectedCollectionId && selected) {
    return (
      <div className="ios-tab-content flex min-h-0 flex-1 flex-col">
        <IOSNavBar
          title={selected.name}
          largeTitle={false}
          onBack={() => setSelectedCollectionId(null)}
          backLabel="コレクション"
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
        <div className="min-h-0 flex-1 overflow-hidden">
          <FileBrowser />
        </div>
        <IOSFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
      </div>
    );
  }

  return (
    <div className="ios-tab-content flex min-h-0 flex-1 flex-col">
      <IOSNavBar title="コレクション" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <CollectionsPanel variant="ios" />
      </div>
    </div>
  );
}
