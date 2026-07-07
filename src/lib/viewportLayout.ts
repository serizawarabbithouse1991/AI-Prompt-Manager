export type ViewportTier = "compact" | "regular" | "large";

/** Logical width tiers aligned with common iPhone / iPad breakpoints. */
export function getViewportTier(width: number): ViewportTier {
  if (width < 390) return "compact";
  if (width < 768) return "regular";
  return "large";
}

type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function measureEnvSafeArea(): SafeAreaInsets {
  if (typeof document === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);";
  document.documentElement.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets: SafeAreaInsets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

function iosFallbackSafeTop(): number {
  const longest = Math.max(window.screen.height, window.screen.width);
  if (longest >= 852) return 59;
  if (longest >= 812) return 47;
  return 20;
}

function iosFallbackSafeBottom(): number {
  const longest = Math.max(window.screen.height, window.screen.width);
  return longest >= 812 ? 34 : 0;
}

export function applySafeAreaInsets(isIOS: boolean): SafeAreaInsets {
  const measured = measureEnvSafeArea();
  const insets: SafeAreaInsets = { ...measured };

  if (isIOS) {
    if (insets.top === 0) insets.top = iosFallbackSafeTop();
    if (insets.bottom === 0) insets.bottom = iosFallbackSafeBottom();
  }

  const root = document.documentElement;
  root.style.setProperty("--safe-top", `${insets.top}px`);
  root.style.setProperty("--safe-right", `${insets.right}px`);
  root.style.setProperty("--safe-bottom", `${insets.bottom}px`);
  root.style.setProperty("--safe-left", `${insets.left}px`);
  return insets;
}

export function applyViewportLayout(width: number, height: number, isIOS = false): void {
  const root = document.documentElement;
  const tier = getViewportTier(width);

  root.dataset.viewport = tier;
  root.style.setProperty("--app-width", `${width}px`);
  root.style.setProperty("--app-height", `${height}px`);
  applySafeAreaInsets(isIOS);
}
