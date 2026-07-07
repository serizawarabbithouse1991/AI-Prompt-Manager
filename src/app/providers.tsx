import type { ReactNode } from "react";
import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { isIOSPlatform, isLikelyIOSDevice } from "@/lib/platform";
import { useViewportLayout } from "@/hooks/useViewportLayout";
import { applySafeAreaInsets } from "@/lib/viewportLayout";

export function Providers({ children }: { children: ReactNode }) {
  useViewportLayout();
  const platformName = useFileStore((s) => s.platformName);

  useEffect(() => {
    const root = document.documentElement;
    if (isIOSPlatform(platformName) || isLikelyIOSDevice()) {
      root.dataset.platform = "ios";
      applySafeAreaInsets(true);
    } else if (platformName !== "unknown") {
      delete root.dataset.platform;
      root.dataset.platform = platformName;
      applySafeAreaInsets(false);
    } else {
      delete root.dataset.platform;
    }
  }, [platformName]);

  return children;
}
