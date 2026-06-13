import { Toolbar } from "@/components/layout/Toolbar";
import { Sidebar, BottomNav } from "@/components/layout/Sidebar";
import { Inspector } from "@/components/layout/Inspector";
import { FileGrid } from "@/components/file/FileGrid";
import { Breadcrumb } from "@/components/file/Breadcrumb";

export function AppShell() {
  return (
    <div className="grid h-screen grid-rows-[48px_1fr_auto] bg-neutral-950 text-neutral-100 lg:grid-rows-[48px_1fr]">
      <Toolbar />
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[240px_1fr_360px]">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <Breadcrumb />
          <FileGrid />
        </main>
        <div className="hidden min-h-0 h-full overflow-hidden lg:block">
          <Inspector />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
