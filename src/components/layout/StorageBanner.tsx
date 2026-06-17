import { useEffect, useState } from "react";
import { useFileStore } from "@/features/files/store";
import { isMobilePlatform } from "@/lib/platform";
import { getStorageDiagnostics, type StorageDiagnostics } from "@/lib/tauri";

export function StorageBanner() {
  const platformName = useFileStore((s) => s.platformName);
  const [diagnostics, setDiagnostics] = useState<StorageDiagnostics | null>(null);

  useEffect(() => {
    if (!isMobilePlatform(platformName)) return;
    void getStorageDiagnostics().then(setDiagnostics).catch(() => setDiagnostics(null));
  }, [platformName]);

  if (!diagnostics) return null;

  const mismatch =
    diagnostics.missingDbFileCount > 0 ||
    (diagnostics.diskFileCount > 0 && diagnostics.dbLibraryCount === 0);

  return (
    <div
      className={[
        "border-b px-2 py-1.5 text-micro sm:px-3",
        mismatch
          ? "border-amber-800 bg-amber-950/40 text-amber-200"
          : "border-neutral-800 bg-neutral-900/60 text-neutral-400",
      ].join(" ")}
    >
      ディスク {diagnostics.diskFileCount} 件 / DB {diagnostics.dbLibraryCount} 件
      {diagnostics.missingDbFileCount > 0 &&
        ` / 実体なし ${diagnostics.missingDbFileCount} 件`}
      {mismatch && " — 設定で再同期してください"}
    </div>
  );
}
