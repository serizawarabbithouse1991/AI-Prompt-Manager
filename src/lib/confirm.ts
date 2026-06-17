import { create } from "zustand";

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: ((ok: boolean) => void) | null;
};

type ConfirmStore = ConfirmState & {
  ask: (options: {
    title?: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  close: (ok: boolean) => void;
};

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  open: false,
  title: "確認",
  message: "",
  confirmLabel: "OK",
  danger: false,
  resolve: null,
  ask: ({ title = "確認", message, confirmLabel = "OK", danger = false }) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, title, message, confirmLabel, danger, resolve });
    }),
  close: (ok) => {
    const { resolve } = get();
    resolve?.(ok);
    set({ open: false, resolve: null });
  },
}));

export function confirmAction(options: {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return useConfirmStore.getState().ask(options);
}
