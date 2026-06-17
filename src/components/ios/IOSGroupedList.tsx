import type { ReactNode } from "react";

export function IOSGroupedList({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      {title && (
        <h3 className="ios-section-header px-4 pb-2 text-xs font-normal uppercase tracking-wide text-neutral-500">
          {title}
        </h3>
      )}
      <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
        {children}
      </div>
      {footer && <p className="ios-section-footer px-4 pt-2 text-xs text-neutral-500">{footer}</p>}
    </section>
  );
}

type IOSListRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
};

export function IOSListRow({
  label,
  value,
  onPress,
  destructive = false,
  showChevron = false,
  trailing,
  disabled = false,
}: IOSListRowProps) {
  const content = (
    <>
      <span className={destructive ? "text-red-400" : "text-neutral-100"}>{label}</span>
      <span className="flex items-center gap-2 text-neutral-400">
        {value && <span className="text-sm">{value}</span>}
        {trailing}
        {showChevron && onPress && (
          <svg className="h-4 w-4 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </span>
    </>
  );

  if (!onPress) {
    return (
      <div className="ios-list-row flex items-center justify-between gap-3 border-b border-[var(--ios-separator)] px-4 last:border-b-0">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      className="ios-list-row flex w-full items-center justify-between gap-3 border-b border-[var(--ios-separator)] px-4 text-left last:border-b-0 disabled:opacity-50"
    >
      {content}
    </button>
  );
}

export function IOSSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="ios-list-row flex items-center justify-between gap-3 border-b border-[var(--ios-separator)] px-4 last:border-b-0">
      <span className="text-neutral-100">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-8 w-[51px] shrink-0 rounded-full transition-colors",
          checked ? "bg-green-500" : "bg-neutral-600",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[19px]" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </label>
  );
}
