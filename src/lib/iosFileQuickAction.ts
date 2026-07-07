import { create } from "zustand";
import type { FileEntry } from "@/features/files/types";

type IOSFileQuickActionState = {
  file: FileEntry | null;
  openFile: (file: FileEntry) => void;
  close: () => void;
};

export const useIOSFileQuickAction = create<IOSFileQuickActionState>((set) => ({
  file: null,
  openFile: (file) => set({ file }),
  close: () => set({ file: null }),
}));
