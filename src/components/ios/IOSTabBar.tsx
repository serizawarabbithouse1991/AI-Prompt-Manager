import { useFileStore } from "@/features/files/store";
import type { ViewMode } from "@/features/files/types";
import { IconLibrary, IconSettings, IconStar } from "@/components/ui/Icons";

const TABS: { id: string; label: string; mode: ViewMode; Icon: typeof IconLibrary }[] = [
  { id: "library", label: "ライブラリ", mode: "ai-library", Icon: IconLibrary },
  { id: "favorites", label: "お気に入り", mode: "favorites", Icon: IconStar },
  { id: "collections", label: "コレクション", mode: "collections", Icon: IconLibrary },
  { id: "settings", label: "設定", mode: "settings", Icon: IconSettings },
];

export function IOSTabBar() {
  const viewMode = useFileStore((s) => s.viewMode);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const setSelectedCollectionId = useFileStore((s) => s.setSelectedCollectionId);
  const setInspectorOpen = useFileStore((s) => s.setInspectorOpen);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);

  function navigate(mode: ViewMode) {
    setInspectorOpen(false);
    setLightboxFileId(null);
    if (mode === "collections") setSelectedCollectionId(null);
    void setViewMode(mode);
  }

  return (
    <nav
      className={[
        "ios-tab-bar fixed inset-x-0 bottom-0 z-[55] flex border-t border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/90 backdrop-blur-xl transition-opacity",
        selectionMode ? "pointer-events-none opacity-40" : "",
      ].join(" ")}
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-hidden={selectionMode}
    >
      {TABS.map((tab) => {
        const active =
          viewMode === tab.mode || (tab.mode === "ai-library" && viewMode === "search");
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.mode)}
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-h-[var(--ios-touch-min)] flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] transition-colors",
              active ? "text-blue-400" : "text-neutral-500",
            ].join(" ")}
          >
            {tab.id === "favorites" ? (
              <IconStar className="h-6 w-6" filled={active} />
            ) : (
              <tab.Icon className="h-6 w-6" />
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
