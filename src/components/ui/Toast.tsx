import { useToastStore } from "@/lib/toast";
import { useFileStore } from "@/features/files/store";
import { isIOSPlatform } from "@/lib/platform";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const platformName = useFileStore((s) => s.platformName);
  const isIOS = isIOSPlatform(platformName);

  if (toasts.length === 0) return null;

  return (
    <div
      className={[
        "pointer-events-none fixed left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4",
        isIOS
          ? "top-[calc(var(--safe-top)+0.5rem)]"
          : "bottom-[calc(var(--safe-bottom)+4.5rem)] lg:bottom-4",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "pointer-events-auto animate-slide-up rounded-lg border px-4 py-3 text-body shadow-lg",
            t.kind === "success" && "border-green-800 bg-green-950/95 text-green-200",
            t.kind === "error" && "border-red-800 bg-red-950/95 text-red-200",
            t.kind === "info" && "border-neutral-700 bg-neutral-900/95 text-neutral-200",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex items-start justify-between gap-2">
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-caption text-neutral-400 hover:text-neutral-200"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
