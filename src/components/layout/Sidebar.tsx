import { useState } from "react";
import { useFileStore } from "@/features/files/store";
import { isDesktopPlatform } from "@/lib/platform";

const DESKTOP_ITEMS = [
  { id: "home", label: "Home", pathKey: "home" as const },
  { id: "desktop", label: "Desktop", pathKey: "desktop" as const },
  { id: "downloads", label: "Downloads", pathKey: "downloads" as const },
  { id: "pictures", label: "Pictures", pathKey: "pictures" as const },
];

const COMMON_ITEMS = [
  { id: "ai-library", label: "AI Library", mode: "ai-library" as const },
  { id: "favorites", label: "Favorites", mode: "favorites" as const },
  { id: "settings", label: "Settings", mode: "settings" as const },
];

export function Sidebar() {
  const specialPaths = useFileStore((s) => s.specialPaths);
  const currentPath = useFileStore((s) => s.currentPath);
  const navigateTo = useFileStore((s) => s.navigateTo);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const viewMode = useFileStore((s) => s.viewMode);
  const platformName = useFileStore((s) => s.platformName);
  const bookmarks = useFileStore((s) => s.bookmarks);
  const recentFolders = useFileStore((s) => s.recentFolders);
  const addBookmark = useFileStore((s) => s.addBookmark);
  const removeBookmark = useFileStore((s) => s.removeBookmark);
  const [bookmarkLabel, setBookmarkLabel] = useState("");
  const isDesktop = isDesktopPlatform(platformName);

  return (
    <aside className="hidden h-full overflow-auto border-r border-neutral-800 bg-neutral-950 p-3 lg:block">
      <nav className="space-y-1">
        {isDesktop &&
          DESKTOP_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!specialPaths}
              onClick={() => {
                const path = specialPaths?.[item.pathKey];
                if (path) void navigateTo(path);
              }}
              className="sidebar-btn"
            >
              {item.label}
            </button>
          ))}
        {isDesktop && specialPaths?.novelAi && (
          <button
            type="button"
            onClick={() => void navigateTo(specialPaths.novelAi!)}
            className="sidebar-btn"
          >
            NovelAI (iCloud)
          </button>
        )}
        {COMMON_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void setViewMode(item.mode)}
            className={[
              "sidebar-btn",
              viewMode === item.mode ? "bg-neutral-800 text-white" : "",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {isDesktop && recentFolders.length > 0 && (
        <div className="mt-4 space-y-1 border-t border-neutral-800 pt-3">
          <h3 className="px-3 text-xs font-medium text-neutral-500">最近のフォルダ</h3>
          {recentFolders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              onClick={() => void navigateTo(folder.path)}
              className="sidebar-btn truncate"
              title={folder.path}
            >
              {folder.label}
            </button>
          ))}
        </div>
      )}

      {isDesktop && currentPath && viewMode === "browse" && (
        <div className="mt-4 space-y-2 border-t border-neutral-800 pt-3">
          <h3 className="px-3 text-xs font-medium text-neutral-500">ブックマーク</h3>
          <div className="flex gap-1 px-1">
            <input
              value={bookmarkLabel}
              onChange={(e) => setBookmarkLabel(e.target.value)}
              placeholder="ラベル"
              className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                const label = bookmarkLabel.trim() || currentPath.split(/[/\\]/).pop() || "Folder";
                addBookmark(label, currentPath);
                setBookmarkLabel("");
              }}
              className="action-btn"
            >
              追加
            </button>
          </div>
          {bookmarks.map((bookmark) => (
            <div key={bookmark.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void navigateTo(bookmark.path)}
                className="sidebar-btn flex-1 truncate"
              >
                {bookmark.label}
              </button>
              <button
                type="button"
                onClick={() => removeBookmark(bookmark.id)}
                className="px-2 text-xs text-neutral-500 hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function BottomNav() {
  const setViewMode = useFileStore((s) => s.setViewMode);
  const viewMode = useFileStore((s) => s.viewMode);

  const items = [
    { id: "ai-library", label: "Library", mode: "ai-library" as const },
    { id: "favorites", label: "Fav", mode: "favorites" as const },
    { id: "settings", label: "設定", mode: "settings" as const },
  ];

  return (
    <nav className="flex border-t border-neutral-800 bg-neutral-950 lg:hidden">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => void setViewMode(item.mode)}
          className={[
            "flex-1 py-3 text-center text-xs",
            viewMode === item.mode ? "text-blue-400" : "text-neutral-500",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
