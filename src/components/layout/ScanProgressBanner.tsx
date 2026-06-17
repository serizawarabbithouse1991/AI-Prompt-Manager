import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFileStore } from "@/features/files/store";
import type { ImportProgress } from "@/features/files/types";

function phaseLabel(phase: ImportProgress["phase"]): string {
  return phase === "export" ? "書き出し" : "判別・取込";
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
}

export function ScanProgressBanner() {
  const importProgress = useFileStore((s) => s.importProgress);
  const scanning = useFileStore((s) => s.scanning);
  const setImportProgress = useFileStore((s) => s.setImportProgress);
  const setScanProgress = useFileStore((s) => s.setScanProgress);
  const setBatchProgress = useFileStore((s) => s.setBatchProgress);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<ImportProgress>("import-progress", (event) => {
      const payload = {
        ...event.payload,
        phase: event.payload.phase ?? "import",
        novelaiCount: event.payload.novelaiCount ?? 0,
        skippedCount: event.payload.skippedCount ?? 0,
        etaSeconds: event.payload.etaSeconds ?? null,
      };
      setImportProgress(payload);
      const progressText =
        payload.total > 0
          ? `${payload.message} (${payload.current}/${payload.total})`
          : payload.message;
      setBatchProgress(progressText);
      setScanProgress(progressText);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [setBatchProgress, setImportProgress, setScanProgress]);

  if (!scanning && !importProgress) {
    return null;
  }

  const current = importProgress?.current ?? 0;
  const total = importProgress?.total ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const message = importProgress?.message ?? "処理中…";
  const phase = importProgress?.phase ?? "export";

  return (
    <div
      className="border-b border-neutral-800 bg-neutral-900/95 px-2 py-1.5 sm:px-3 sm:py-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-blue-300">{phaseLabel(phase)}</span>
        <span className="truncate text-neutral-400">
          {total > 0 ? `${current} / ${total}（${percent}%）` : message}
          {importProgress?.etaSeconds != null && importProgress.etaSeconds > 0 && total > 0 && (
            <span className="ml-1 text-neutral-500">
              · 残り約 {formatEta(importProgress.etaSeconds)}
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-[width] duration-300 ease-out"
          style={{ width: total > 0 ? `${percent}%` : "15%" }}
        />
      </div>
      {phase === "import" && importProgress && (
        <p className="mt-1 text-micro text-neutral-500">
          NovelAI {importProgress.novelaiCount} 件 / スキップ {importProgress.skippedCount} 件
          {importProgress.etaSeconds != null && importProgress.etaSeconds > 0 && (
            <span className="ml-2">残り約 {formatEta(importProgress.etaSeconds)}</span>
          )}
        </p>
      )}
      {total === 0 && message && (
        <p className="mt-1 truncate text-[11px] text-neutral-500">{message}</p>
      )}
    </div>
  );
}
