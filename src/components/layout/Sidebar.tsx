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
  const navigateTo = useFileStore((s) => s.navigateTo);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const viewMode = useFileStore((s) => s.viewMode);
  const platformName = useFileStore((s) => s.platformName);
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
