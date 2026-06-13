import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { removeFromLibrary, trashFile } from "@/lib/tauri";
import { isDesktopPlatform, isMobilePlatform } from "@/lib/platform";

export function useKeyboardShortcuts() {
  const goBack = useFileStore((s) => s.goBack);
  const goForward = useFileStore((s) => s.goForward);
  const refresh = useFileStore((s) => s.refresh);
  const selectedFile = useFileStore((s) => s.selectedFile);
  const selectedFileIds = useFileStore((s) => s.selectedFileIds);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const lightboxFileId = useFileStore((s) => s.lightboxFileId);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const selectFile = useFileStore((s) => s.selectFile);
  const viewMode = useFileStore((s) => s.viewMode);
  const platformName = useFileStore((s) => s.platformName);
  const files = useFileStore((s) => s.files);

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
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const isDesktop = isDesktopPlatform(platformName);
        const isMobile = isMobilePlatform(platformName);
        const targets =
          selectionMode && selectedFileIds.length > 0
            ? files.filter((f) => selectedFileIds.includes(f.id))
            : selectedFile
              ? [selectedFile]
              : [];

        if (targets.length === 0 || targets.some((f) => f.isDirectory)) return;
        if (!confirm(`${targets.length} 件を削除しますか？`)) return;

        e.preventDefault();
        void (async () => {
          if (isDesktop) {
            for (const file of targets) {
              await trashFile(file.absolutePath);
            }
          } else if (isMobile) {
            for (const file of targets) {
              await removeFromLibrary(file.id);
            }
          }
          selectFile(null);
          clearSelection();
          await refresh();
        })();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    goBack,
    goForward,
    refresh,
    selectedFile,
    selectedFileIds,
    selectionMode,
    files,
    setLightboxFileId,
    lightboxFileId,
    clearSelection,
    selectFile,
    viewMode,
    platformName,
  ]);
}
