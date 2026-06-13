import { useFileStore } from "@/features/files/store";
import { splitPathSegments, pathFromSegments } from "@/features/files/viewUtils";

export function Breadcrumb() {
  const currentPath = useFileStore((s) => s.currentPath);
  const viewMode = useFileStore((s) => s.viewMode);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const navigateTo = useFileStore((s) => s.navigateTo);
  const specialPaths = useFileStore((s) => s.specialPaths);

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

  if (viewMode === "settings") {
    return <div className="px-4 py-2 text-xs text-neutral-400">設定</div>;
  }

  const { sep, segments } = splitPathSegments(currentPath);
  const rootPrefix =
    sep === "\\" && /^[A-Za-z]:/.test(currentPath)
      ? currentPath.slice(0, 2)
      : currentPath.startsWith("/")
        ? ""
        : "";

  return (
    <nav className="flex flex-wrap items-center gap-1 px-4 py-2 text-xs text-neutral-400">
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
            ? "Home"
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
