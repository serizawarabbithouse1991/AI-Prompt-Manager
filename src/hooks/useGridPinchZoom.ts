import { useEffect, useRef, type RefObject } from "react";
import { useFileStore } from "@/features/files/store";
import { getGridColumnBounds } from "@/lib/gridUtils";
import { markGridPinchHintShown, shouldShowGridPinchHint } from "@/lib/gridPinchHint";
import { isMobilePlatform } from "@/lib/platform";
import { toast } from "@/lib/toast";

const PINCH_THRESHOLD_PX = 30;

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

/** Pinch in/out on grid to change column count (iOS Photos style). */
export function useGridPinchZoom(containerRef: RefObject<HTMLElement | null>) {
  const setGridColumns = useFileStore((s) => s.setGridColumns);
  const gridColumns = useFileStore((s) => s.gridColumns);
  const platformName = useFileStore((s) => s.platformName);
  const startDistanceRef = useRef(0);
  const appliedRef = useRef(false);
  const pinchingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function setPinchMode(active: boolean) {
      pinchingRef.current = active;
      el!.style.touchAction = active ? "none" : "";
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        startDistanceRef.current = touchDistance(e.touches);
        appliedRef.current = false;
        setPinchMode(true);
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2) return;

      if (!pinchingRef.current) {
        setPinchMode(true);
        startDistanceRef.current = touchDistance(e.touches);
      }

      if (appliedRef.current) return;

      e.preventDefault();

      const current = touchDistance(e.touches);
      const delta = current - startDistanceRef.current;

      if (Math.abs(delta) < PINCH_THRESHOLD_PX) return;

      const isMobile = isMobilePlatform(platformName);
      const { min, max } = getGridColumnBounds(isMobile);
      // Pinch in (fingers closer) -> more columns; pinch out -> fewer columns.
      const next = delta < 0 ? gridColumns + 1 : gridColumns - 1;
      const clamped = Math.min(max, Math.max(min, next));

      if (clamped !== gridColumns) {
        appliedRef.current = true;
        if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
          setGridColumns(clamped);
          if (shouldShowGridPinchHint()) {
            markGridPinchHintShown();
            toast("ピンチでも列数を変更できます", "info");
          }
        }, 150);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        setPinchMode(false);
        startDistanceRef.current = 0;
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.style.touchAction = "";
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [containerRef, gridColumns, platformName, setGridColumns]);
}
