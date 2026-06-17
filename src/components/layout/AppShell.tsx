import { Toolbar } from "@/components/layout/Toolbar";
import { Sidebar, BottomNav } from "@/components/layout/Sidebar";
import { ScanProgressBanner } from "@/components/layout/ScanProgressBanner";
import { StorageBanner } from "@/components/layout/StorageBanner";
import { Inspector } from "@/components/layout/Inspector";
import { SelectionBar } from "@/components/layout/SelectionBar";
import { FileBrowser } from "@/components/file/FileBrowser";
import { Breadcrumb } from "@/components/file/Breadcrumb";
import { ViewControls } from "@/components/file/ViewControls";
import { FilterPanel } from "@/components/file/FilterPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { CollectionsPanel } from "@/components/collections/CollectionsPanel";
import { ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useFileStore } from "@/features/files/store";
import { useKeyboardShortcuts } from "@/features/files/useKeyboardShortcuts";

export function AppShell() {
  const viewMode = useFileStore((s) => s.viewMode);
  const selectedCollectionId = useFileStore((s) => s.selectedCollectionId);
  useKeyboardShortcuts();

  function renderMain() {
    if (viewMode === "settings") return <SettingsPanel />;
    if (viewMode === "collections" && !selectedCollectionId) {
      return <CollectionsPanel />;
    }
    return <FileBrowser />;
  }

  return (
    <div className="app-shell grid grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] bg-neutral-950 text-neutral-100">
      <Toolbar />
      <ScanProgressBanner />
      <StorageBanner />
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[240px_1fr_360px]">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden safe-px">
          <Breadcrumb />
          <ViewControls />
          <FilterPanel />
          <SelectionBar />
          {renderMain()}
        </main>
        <Inspector />
      </div>
      <BottomNav />
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}
