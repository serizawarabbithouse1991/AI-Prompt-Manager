import { useFileStore } from "@/features/files/store";
import { isMobilePlatform } from "@/lib/platform";
import { splitPathSegments, pathFromSegments } from "@/features/files/viewUtils";

export function Breadcrumb() {
  const currentPath = useFileStore((s) => s.currentPath);
  const viewMode = useFileStore((s) => s.viewMode);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const navigateTo = useFileStore((s) => s.navigateTo);
  const specialPaths = useFileStore((s) => s.specialPaths);
  const platformName = useFileStore((s) => s.platformName);
  const selectedCollectionId = useFileStore((s) => s.selectedCollectionId);
  const collections = useFileStore((s) => s.collections);
  const setSelectedCollectionId = useFileStore((s) => s.setSelectedCollectionId);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const isMobile = isMobilePlatform(platformName);

  if (viewMode === "search") {
    return (
      <div className="truncate px-2 py-1.5 text-xs text-neutral-400 sm:px-4 sm:py-2">
        検索: {searchQuery}
      </div>
    );
  }

  if (viewMode === "favorites") {
    return <div className="px-2 py-1.5 text-xs text-neutral-400 sm:px-4 sm:py-2">お気に入り</div>;
  }

  if (viewMode === "ai-library") {
    return <div className="px-2 py-1.5 text-caption text-neutral-400 sm:px-4 sm:py-2">AI Library</div>;
  }

  if (viewMode === "collections") {
    const name = collections.find((c) => c.id === selectedCollectionId)?.name ?? "コレクション";
    if (selectedCollectionId && isMobile) {
      return (
        <div className="flex items-center gap-2 px-2 py-1.5 sm:px-4 sm:py-2">
          <button
            type="button"
            onClick={() => {
              setSelectedCollectionId(null);
              void setViewMode("collections");
            }}
            className="shrink-0 text-sm text-blue-400"
          >
            ← コレクション
          </button>
          <span className="truncate text-caption text-neutral-400">{name}</span>
        </div>
      );
    }
    return (
      <div className="px-2 py-1.5 text-caption text-neutral-400 sm:px-4 sm:py-2">
        {selectedCollectionId ? name : "コレクション"}
      </div>
    );
  }

  if (viewMode === "duplicates") {
    return <div className="px-2 py-1.5 text-caption text-neutral-400 sm:px-4 sm:py-2">重複ファイル</div>;
  }

  if (viewMode === "settings") {
    return <div className="px-2 py-1.5 text-xs text-neutral-400 sm:px-4 sm:py-2">設定</div>;
  }

  const { sep, segments } = splitPathSegments(currentPath);
  const rootPrefix =
    sep === "\\" && /^[A-Za-z]:/.test(currentPath)
      ? currentPath.slice(0, 2)
      : currentPath.startsWith("/")
        ? ""
        : "";

  return (
    <nav className="flex flex-wrap items-center gap-1 px-2 py-1.5 text-xs text-neutral-400 sm:px-4 sm:py-2">
      {segments.map((segment, index) => {
        const pathSegments = segments.slice(0, index + 1);
        let targetPath = pathFromSegments(pathSegments, sep);
        if (sep === "\\" && rootPrefix && !targetPath.startsWith(rootPrefix)) {
          targetPath = `${rootPrefix}${sep}${pathSegments.join(sep)}`;
        }
        if (sep === "/" && currentPath.startsWith("/") && !targetPath.startsWith("/")) {
          targetPath = `/${targetPath}`;
        }

        const isLast = index === segments.length - 1;
        const label =
          specialPaths && targetPath === specialPaths.home
            ? "ホーム"
            : segment;

        return (
          <span key={targetPath} className="inline-flex items-center gap-1">
            {index > 0 && <span className="text-neutral-600">/</span>}
            {isLast ? (
              <span className="text-neutral-200">{label}</span>
            ) : (
              <button
                type="button"
                onClick={() => void navigateTo(targetPath)}
                className="rounded px-1 hover:bg-neutral-800 hover:text-neutral-200"
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
