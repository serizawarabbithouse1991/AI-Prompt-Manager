import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { getFileTags, getMetadata, getThumbnail, extractMetadata } from "@/lib/tauri";

export function useSelectedFileDetails() {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const setMetadata = useFileStore((s) => s.setMetadata);
  const setTags = useFileStore((s) => s.setTags);
  const updateFileThumbnail = useFileStore((s) => s.updateFileThumbnail);

  useEffect(() => {
    if (!selectedFile || selectedFile.isDirectory) {
      setMetadata(null);
      setTags([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        let metadata = await getMetadata(selectedFile!.id);
        if (!metadata && selectedFile!.fileKind === "image") {
          metadata = await extractMetadata(selectedFile!.absolutePath);
        }
        const tags = await getFileTags(selectedFile!.id);
        if (cancelled) return;
        setMetadata(metadata);
        setTags(tags);

        if (selectedFile!.fileKind === "image" && !selectedFile!.thumbnailPath) {
          const thumb = await getThumbnail(selectedFile!.id, 512).catch(() => null);
          if (!cancelled && thumb) {
            updateFileThumbnail(selectedFile!.id, thumb);
          }
        }
      } catch {
        if (!cancelled) {
          setMetadata(null);
          setTags([]);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedFile, setMetadata, setTags, updateFileThumbnail]);
}

export function useInitializeApp() {
  const initialize = useFileStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);
}
