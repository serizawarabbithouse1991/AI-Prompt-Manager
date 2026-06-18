import { useState, type ReactNode } from "react";
import { useFileStore } from "@/features/files/store";
import { IOSGridSizeSheet } from "@/components/ios/IOSGridSizeSheet";
import { IOSNavIconButton } from "@/components/ios/IOSNavBar";

export function IOSGridSizeNavButton() {
  const layoutMode = useFileStore((s) => s.layoutMode);
  const [open, setOpen] = useState(false);

  if (layoutMode !== "grid") return null;

  return (
    <>
      <IOSNavIconButton label="グリッドサイズ" onClick={() => setOpen(true)}>
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </IOSNavIconButton>
      <IOSGridSizeSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function IOSNavTrailingWithGrid({ children }: { children?: ReactNode }) {
  return (
    <>
      {children}
      <IOSGridSizeNavButton />
    </>
  );
}
