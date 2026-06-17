import { useConfirmStore } from "@/lib/confirm";

export function IOSActionSheet() {
  const open = useConfirmStore((s) => s.open);
  const title = useConfirmStore((s) => s.title);
  const message = useConfirmStore((s) => s.message);
  const confirmLabel = useConfirmStore((s) => s.confirmLabel);
  const danger = useConfirmStore((s) => s.danger);
  const close = useConfirmStore((s) => s.close);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end px-2 pb-[calc(var(--safe-bottom)+0.5rem)]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="キャンセル"
        onClick={() => close(false)}
      />
      <div className="relative space-y-2">
        <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-elevated)]">
          {(title || message) && (
            <div className="border-b border-[var(--ios-separator)] px-4 py-3 text-center">
              {title && <p className="text-sm font-semibold text-neutral-200">{title}</p>}
              {message && <p className="mt-1 text-xs text-neutral-400">{message}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={() => close(true)}
            className={[
              "ios-touch-row w-full border-t border-[var(--ios-separator)] text-center text-base font-medium",
              danger ? "text-red-400" : "text-blue-400",
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
        <button
          type="button"
          onClick={() => close(false)}
          className="ios-touch-row w-full rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-elevated)] text-center text-base font-semibold text-blue-400"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
