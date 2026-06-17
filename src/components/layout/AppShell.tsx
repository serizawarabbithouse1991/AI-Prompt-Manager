import { useFileStore } from "@/features/files/store";
import { isIOSPlatform } from "@/lib/platform";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { IOSShell } from "@/components/ios/IOSShell";

export function AppShell() {
  const platformName = useFileStore((s) => s.platformName);

  if (isIOSPlatform(platformName)) {
    return <IOSShell />;
  }

  return <DesktopShell />;
}
