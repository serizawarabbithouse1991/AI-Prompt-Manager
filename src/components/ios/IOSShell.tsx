import { useState } from "react";
import { ScanProgressBanner } from "@/components/layout/ScanProgressBanner";
import { StorageBanner } from "@/components/layout/StorageBanner";
import { Inspector } from "@/components/layout/Inspector";
import { IOSActionSheet } from "@/components/ios/IOSActionSheet";
import { IOSFileQuickActionSheet } from "@/components/ios/IOSFileQuickActionSheet";
import { IOSCollectionsView } from "@/components/ios/IOSCollectionsView";
import { IOSFavoritesView } from "@/components/ios/IOSFavoritesView";
import { IOSLibraryView } from "@/components/ios/IOSLibraryView";
import { IOSSettingsView } from "@/components/ios/IOSSettingsView";
import { IOSTabBar } from "@/components/ios/IOSTabBar";
import { IOSToolbar } from "@/components/ios/IOSToolbar";
import { ToastContainer } from "@/components/ui/Toast";
import { useFileStore } from "@/features/files/store";
import { useKeyboardShortcuts } from "@/features/files/useKeyboardShortcuts";
import { IOSOnboarding } from "@/components/ios/IOSOnboarding";
import { isOnboardingComplete } from "@/lib/onboardingPrefs";

export function IOSShell() {
  const viewMode = useFileStore((s) => s.viewMode);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  useKeyboardShortcuts();

  function renderTab() {
    switch (viewMode) {
      case "favorites":
        return <IOSFavoritesView />;
      case "collections":
        return <IOSCollectionsView />;
      case "settings":
        return <IOSSettingsView />;
      case "search":
        return <IOSLibraryView title="検索結果" />;
      default:
        return <IOSLibraryView title="ライブラリ" />;
    }
  }

  return (
    <div
      className="app-shell ios-shell flex flex-col bg-[var(--ios-bg)] text-neutral-100"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      {showOnboarding && <IOSOnboarding onComplete={() => setShowOnboarding(false)} />}
      <ScanProgressBanner />
      <StorageBanner />
      {selectionMode && <IOSToolbar />}
      <main
        className={[
          "ios-main min-h-0 flex-1 overflow-hidden",
          selectionMode ? "pt-[7.5rem]" : "",
        ].join(" ")}
        style={{ paddingBottom: "calc(var(--ios-tab-bar-height) + var(--safe-bottom))" }}
      >
        <div className="ios-tab-fade flex h-full min-h-0 flex-col">{renderTab()}</div>
      </main>
      <IOSTabBar />
      <Inspector />
      <ToastContainer />
      <IOSActionSheet />
      <IOSFileQuickActionSheet />
    </div>
  );
}
