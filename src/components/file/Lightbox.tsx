import { useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useDisplayFiles, useFileStore } from "@/features/files/store";

export function Lightbox() {
  const lightboxFileId = useFileStore((s) => s.lightboxFileId);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const displayFiles = useDisplayFiles();

  const images = displayFiles.filter((f) => f.fileKind === "image" && !f.isDirectory);
  const currentIndex = images.findIndex((f) => f.id === lightboxFileId);
  const current = currentIndex >= 0 ? images[currentIndex] : null;

  useEffect(() => {
    if (!lightboxFileId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxFileId(null);
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setLightboxFileId(images[currentIndex - 1].id);
      }
      if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
        setLightboxFileId(images[currentIndex + 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxFileId, currentIndex, images, setLightboxFileId]);

  if (!lightboxFileId || !current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={() => setLightboxFileId(null)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLightboxFileId(null);
        }}
        className="absolute right-4 top-4 rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
      >
        閉じる
      </button>
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxFileId(images[currentIndex - 1].id);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded bg-neutral-800 px-3 py-2 text-xl hover:bg-neutral-700"
        >
          ←
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxFileId(images[currentIndex + 1].id);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded bg-neutral-800 px-3 py-2 text-xl hover:bg-neutral-700"
        >
          →
        </button>
      )}
      <img
        src={convertFileSrc(current.absolutePath)}
        alt={current.displayName}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 truncate text-sm text-neutral-300">
        {current.displayName}
      </div>
    </div>
  );
}
