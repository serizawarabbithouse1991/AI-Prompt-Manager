import { CollectionsPanel } from "@/components/collections/CollectionsPanel";
import { FileBrowser } from "@/components/file/FileBrowser";
import { IOSNavBar } from "@/components/ios/IOSNavBar";
import { useFileStore } from "@/features/files/store";

export function IOSCollectionsView() {
  const selectedCollectionId = useFileStore((s) => s.selectedCollectionId);
  const collections = useFileStore((s) => s.collections);
  const setSelectedCollectionId = useFileStore((s) => s.setSelectedCollectionId);

  const selected = collections.find((c) => c.id === selectedCollectionId);

  if (selectedCollectionId && selected) {
    return (
      <div className="ios-tab-content flex min-h-0 flex-1 flex-col">
        <IOSNavBar
          title={selected.name}
          largeTitle={false}
          onBack={() => setSelectedCollectionId(null)}
          backLabel="コレクション"
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          <FileBrowser />
        </div>
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
