import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { getFileTags, getMetadata, getThumbnail, extractMetadata } from "@/lib/tauri";

export function useSelectedFileDetails() {
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const selectedFile = useFileStore((s) => s.selectedFile);
  const setMetadata = useFileStore((s) => s.setMetadata);
  const setTags = useFileStore((s) => s.setTags);
  const updateFileThumbnail = useFileStore((s) => s.updateFileThumbnail);

  useEffect(() => {
    if (!selectedFileId || !selectedFile || selectedFile.isDirectory) {
      setMetadata(null);
      setTags([]);
      return;
    }

    const fileId = selectedFileId;
    const filePath = selectedFile.absolutePath;
    const fileKind = selectedFile.fileKind;
    let cancelled = false;

    async function loadMetadata() {
      try {
        let metadata = await getMetadata(fileId);
        if (!metadata && fileKind === "image") {
          metadata = await extractMetadata(filePath);
        }
        if (cancelled) return;
        setMetadata(metadata);
        setTags(await getFileTags(fileId));
      } catch {
        if (!cancelled) {
          setMetadata(null);
          setTags([]);
        }
      }
    }

    void loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [
    selectedFileId,
    selectedFile?.absolutePath,
    selectedFile?.fileKind,
    selectedFile?.isDirectory,
    setMetadata,
    setTags,
  ]);

  useEffect(() => {
    if (!selectedFileId || !selectedFile || selectedFile.isDirectory) return;
    if (selectedFile.fileKind !== "image" || selectedFile.thumbnailPath) return;

    let cancelled = false;

    void getThumbnail(selectedFileId, 512)
      .then((thumb) => {
        if (!cancelled && thumb) {
          updateFileThumbnail(selectedFileId, thumb);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    selectedFileId,
    selectedFile?.fileKind,
    selectedFile?.isDirectory,
    selectedFile?.thumbnailPath,
    updateFileThumbnail,
  ]);
}

export function useInitializeApp() {
  const initialize = useFileStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);
}
