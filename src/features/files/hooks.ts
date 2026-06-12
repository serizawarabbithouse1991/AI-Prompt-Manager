import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { getFileTags, getMetadata, getThumbnail } from "@/lib/tauri";

export function useSelectedFileDetails() {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const setMetadata = useFileStore((s) => s.setMetadata);
  const setTags = useFileStore((s) => s.setTags);
  const refresh = useFileStore((s) => s.refresh);

  useEffect(() => {
    if (!selectedFile || selectedFile.isDirectory) {
      setMetadata(null);
      setTags([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [metadata, tags] = await Promise.all([
          getMetadata(selectedFile!.id),
          getFileTags(selectedFile!.id),
        ]);
        if (cancelled) return;
        setMetadata(metadata);
        setTags(tags);

        if (selectedFile!.fileKind === "image" && !selectedFile!.thumbnailPath) {
          await getThumbnail(selectedFile!.id, 512).catch(() => null);
          if (!cancelled) await refresh();
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
  }, [selectedFile, setMetadata, setTags, refresh]);
}

export function useInitializeApp() {
  const initialize = useFileStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);
}
