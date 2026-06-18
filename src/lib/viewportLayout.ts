export type ViewportTier = "compact" | "regular" | "large";

/** Logical width tiers aligned with common iPhone / iPad breakpoints. */
export function getViewportTier(width: number): ViewportTier {
  if (width < 390) return "compact";
  if (width < 768) return "regular";
  return "large";
}

export function applyViewportLayout(width: number, height: number): void {
  const root = document.documentElement;
  const tier = getViewportTier(width);

  root.dataset.viewport = tier;
  root.style.setProperty("--app-width", `${width}px`);
  root.style.setProperty("--app-height", `${height}px`);
}
