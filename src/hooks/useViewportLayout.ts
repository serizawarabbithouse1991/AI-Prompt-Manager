import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { isIOSPlatform, isLikelyIOSDevice } from "@/lib/platform";
import { applyViewportLayout } from "@/lib/viewportLayout";

function measureViewport(): { width: number; height: number } {
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

/** Keeps CSS variables / data attributes in sync with the current device viewport. */
export function useViewportLayout(): void {
  const platformName = useFileStore((s) => s.platformName);
  const isIOS = isIOSPlatform(platformName) || isLikelyIOSDevice();

  useEffect(() => {
    function update() {
      const { width, height } = measureViewport();
      applyViewportLayout(width, height, isIOS);
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [isIOS]);
}
