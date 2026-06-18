const GRID_PINCH_HINT_KEY = "ai-fm-grid-pinch-hint-shown";

export function shouldShowGridPinchHint(): boolean {
  try {
    return localStorage.getItem(GRID_PINCH_HINT_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markGridPinchHintShown(): void {
  try {
    localStorage.setItem(GRID_PINCH_HINT_KEY, "1");
  } catch {
    // ignore
  }
}
