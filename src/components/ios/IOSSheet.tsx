import type { ReactNode } from "react";
import { IconChevronLeft, IconClose } from "@/components/ui/Icons";

type IOSSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  tall?: boolean;
};

export function IOSSheet({ open, onClose, title, children, tall = false }: IOSSheetProps) {
  if (!open) return null;

  return (
    <div className="ios-sheet-root fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 animate-fade-in"
        aria-label="閉じる"
        onClick={onClose}
      />
      <div
        className={[
          "ios-sheet-panel relative flex flex-col rounded-t-[var(--ios-radius-lg)] bg-[var(--ios-bg-elevated)] animate-slide-up",
          tall ? "max-h-[92dvh]" : "max-h-[75dvh]",
        ].join(" ")}
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="flex shrink-0 items-center justify-center py-2">
          <div className="h-1 w-10 rounded-full bg-neutral-600" />
        </div>
        {title && (
          <div className="flex shrink-0 flex-col border-b border-[var(--ios-separator)]">
            <div className="px-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-11 items-center gap-0.5 text-base text-blue-400"
              >
                <IconChevronLeft className="h-5 w-5" />
                戻る
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 pb-3">
              <h2 className="ios-large-title min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-400"
                aria-label="閉じる"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
