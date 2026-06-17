import type { SpecialPaths } from "@/features/files/types";
import { isDesktopPlatform } from "@/lib/platform";

export function getDefaultBrowsePath(
  specialPaths: SpecialPaths,
  platformName: string,
): string {
  if (isDesktopPlatform(platformName) && specialPaths.novelAi) {
    return specialPaths.novelAi;
  }
  return specialPaths.home;
}

export function isNovelAiPath(path: string, specialPaths: SpecialPaths | null): boolean {
  if (!specialPaths?.novelAi) return false;
  const normalized = path.replace(/[/\\]+$/, "");
  const novelAi = specialPaths.novelAi.replace(/[/\\]+$/, "");
  return normalized === novelAi || normalized.startsWith(`${novelAi}/`) || normalized.startsWith(`${novelAi}\\`);
}
