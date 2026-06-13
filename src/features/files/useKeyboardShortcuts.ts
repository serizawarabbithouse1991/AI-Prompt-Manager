import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";

export function useKeyboardShortcuts() {
  const goBack = useFileStore((s) => s.goBack);
  const goForward = useFileStore((s) => s.goForward);
  const refresh = useFileStore((s) => s.refresh);
  const selectedFile = useFileStore((s) => s.selectedFile);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const lightboxFileId = useFileStore((s) => s.lightboxFileId);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const viewMode = useFileStore((s) => s.viewMode);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
        return;
      }

      if (e.key === "ArrowLeft" && (e.metaKey || e.altKey)) {
        e.preventDefault();
        void goBack();
        return;
      }

      if (e.key === "ArrowRight" && (e.metaKey || e.altKey)) {
        e.preventDefault();
        void goForward();
        return;
      }

      if (e.key === "F5" || ((e.metaKey || e.ctrlKey) && e.key === "r")) {
        e.preventDefault();
        void refresh();
        return;
      }

      if (e.key === "Escape") {
        if (lightboxFileId) setLightboxFileId(null);
        else if (selectionMode) clearSelection();
        return;
      }

      if (e.key === " " && selectedFile && !selectedFile.isDirectory && viewMode !== "settings") {
        e.preventDefault();
        if (selectedFile.fileKind === "image") {
          setLightboxFileId(selectedFile.id);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    goBack,
    goForward,
    refresh,
    selectedFile,
    setLightboxFileId,
    lightboxFileId,
    clearSelection,
    selectionMode,
    viewMode,
  ]);
}
