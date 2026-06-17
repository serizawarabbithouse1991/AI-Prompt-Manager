import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { IOSNavBar } from "@/components/ios/IOSNavBar";

export function IOSSettingsView() {
  return (
    <div className="ios-tab-content flex min-h-0 flex-1 flex-col">
      <IOSNavBar title="設定" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <SettingsPanel variant="ios" />
      </div>
    </div>
  );
}
