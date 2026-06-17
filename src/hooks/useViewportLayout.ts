import { useEffect } from "react";
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
  useEffect(() => {
    function update() {
      const { width, height } = measureViewport();
      applyViewportLayout(width, height);
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
  }, []);
}
