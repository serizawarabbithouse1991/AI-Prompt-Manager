import { useFileStore } from "@/features/files/store";

export function Breadcrumb() {
  const currentPath = useFileStore((s) => s.currentPath);
  const viewMode = useFileStore((s) => s.viewMode);
  const searchQuery = useFileStore((s) => s.searchQuery);

  if (viewMode === "search") {
    return (
      <div className="truncate px-4 py-2 text-xs text-neutral-400">
        検索: {searchQuery}
      </div>
    );
  }

  if (viewMode === "favorites") {
    return <div className="px-4 py-2 text-xs text-neutral-400">お気に入り</div>;
  }

  if (viewMode === "ai-library") {
    return <div className="px-4 py-2 text-xs text-neutral-400">AI Library</div>;
  }

  return (
    <div className="truncate px-4 py-2 text-xs text-neutral-400">{currentPath}</div>
  );
}
