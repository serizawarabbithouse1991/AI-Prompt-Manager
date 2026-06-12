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

export function isDesktopPlatform(platformName: string): boolean {
  return platformName === "macos" || platformName === "windows" || platformName === "linux";
}
