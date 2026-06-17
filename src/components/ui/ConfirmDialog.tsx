import { useConfirmStore } from "@/lib/confirm";
import { useFileStore } from "@/features/files/store";
import { isIOSPlatform } from "@/lib/platform";

export function ConfirmDialog() {
  const platformName = useFileStore((s) => s.platformName);
  const open = useConfirmStore((s) => s.open);
  const title = useConfirmStore((s) => s.title);
  const message = useConfirmStore((s) => s.message);
  const confirmLabel = useConfirmStore((s) => s.confirmLabel);
  const danger = useConfirmStore((s) => s.danger);
  const close = useConfirmStore((s) => s.close);

  if (!open || isIOSPlatform(platformName)) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div
        className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-xl animate-slide-up"
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <h2 id="confirm-title" className="text-title text-neutral-100">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-body text-neutral-400">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="action-btn">
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={danger ? "action-btn-danger" : "action-btn"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
