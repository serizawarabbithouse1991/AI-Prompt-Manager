const AUTO_PHOTO_SCAN_KEY = "ai-fm-auto-photo-scan";

export function loadAutoPhotoScanEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_PHOTO_SCAN_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAutoPhotoScanEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_PHOTO_SCAN_KEY, enabled ? "1" : "0");
}
