import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  kind: ToastKind;
};

type ToastStore = {
  toasts: Toast[];
  show: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, kind = "info") => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, message, kind }] });
    window.setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export function toast(message: string, kind: ToastKind = "info") {
  useToastStore.getState().show(message, kind);
}
