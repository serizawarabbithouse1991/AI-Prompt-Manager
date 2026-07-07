import { invoke } from "@tauri-apps/api/core";

export async function getPlatform(): Promise<string> {
  try {
    return await invoke<string>("get_platform_name");
  } catch {
    return "unknown";
  }
}

export function isAndroidPlatform(platformName: string): boolean {
  return platformName === "android";
}

export function isIOSPlatform(platformName: string): boolean {
  return platformName === "ios";
}

export function isLikelyIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isMobilePlatform(platformName: string): boolean {
  return isAndroidPlatform(platformName) || isIOSPlatform(platformName);
}

export function isDesktopPlatform(platformName: string): boolean {
  return platformName === "macos" || platformName === "windows" || platformName === "linux";
}
