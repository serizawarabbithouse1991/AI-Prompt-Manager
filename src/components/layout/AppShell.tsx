import { Toolbar } from "@/components/layout/Toolbar";
import { Sidebar, BottomNav } from "@/components/layout/Sidebar";
import { Inspector } from "@/components/layout/Inspector";
import { SelectionBar } from "@/components/layout/SelectionBar";
import { FileBrowser } from "@/components/file/FileBrowser";
import { Breadcrumb } from "@/components/file/Breadcrumb";
import { ViewControls } from "@/components/file/ViewControls";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useFileStore } from "@/features/files/store";
import { useKeyboardShortcuts } from "@/features/files/useKeyboardShortcuts";

export function AppShell() {
  const viewMode = useFileStore((s) => s.viewMode);
  useKeyboardShortcuts();

  return (
    <div className="grid h-screen grid-rows-[48px_1fr_auto] bg-neutral-950 text-neutral-100 lg:grid-rows-[48px_1fr]">
      <Toolbar />
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[240px_1fr_360px]">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <Breadcrumb />
          <ViewControls />
          <SelectionBar />
          {viewMode === "settings" ? <SettingsPanel /> : <FileBrowser />}
        </main>
        <Inspector />
      </div>
      <BottomNav />
    </div>
  );
}
