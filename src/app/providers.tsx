import type { ReactNode } from "react";
import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { isIOSPlatform } from "@/lib/platform";
import { useViewportLayout } from "@/hooks/useViewportLayout";

export function Providers({ children }: { children: ReactNode }) {
  useViewportLayout();
  const platformName = useFileStore((s) => s.platformName);

  useEffect(() => {
    const root = document.documentElement;
    if (isIOSPlatform(platformName)) {
      root.dataset.platform = "ios";
    } else if (platformName !== "unknown") {
      root.dataset.platform = platformName;
    } else {
      delete root.dataset.platform;
    }
  }, [platformName]);

  return children;
}
