import type { ReactNode } from "react";
import { useViewportLayout } from "@/hooks/useViewportLayout";

export function Providers({ children }: { children: ReactNode }) {
  useViewportLayout();
  return children;
}
