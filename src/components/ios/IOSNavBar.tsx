import type { ReactNode } from "react";

type IOSNavBarProps = {
  title: string;
  largeTitle?: boolean;
  onBack?: () => void;
  backLabel?: string;
  trailing?: ReactNode;
  children?: ReactNode;
};

export function IOSNavBar({
  title,
  largeTitle = true,
  onBack,
  backLabel = "戻る",
  trailing,
  children,
}: IOSNavBarProps) {
  return (
    <header
      className="ios-nav-bar shrink-0 border-b border-[var(--ios-separator)] bg-[var(--ios-bg)]"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      {!largeTitle && (
        <div className="flex min-h-11 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="flex min-h-11 items-center gap-0.5 pr-2 text-base text-blue-400"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span className="truncate">{backLabel}</span>
              </button>
            ) : (
              <span className="text-base font-semibold">{title}</span>
            )}
            {onBack && <span className="truncate text-base font-semibold">{title}</span>}
          </div>
          {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
        </div>
      )}
      {largeTitle && (
        <div className="px-4 pb-2 pt-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-1 flex min-h-11 items-center gap-0.5 text-base text-blue-400"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {backLabel}
            </button>
          )}
          <div className="flex items-end justify-between gap-2">
            <h1 className="ios-large-title truncate font-bold tracking-tight">{title}</h1>
            {trailing && <div className="mb-1 flex shrink-0 items-center gap-1">{trailing}</div>}
          </div>
        </div>
      )}
      {children}
    </header>
  );
}

export function IOSNavIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full text-blue-400 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
