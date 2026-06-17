import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { FileEntry } from "@/features/files/types";

type FilePreviewProps = {
  file: FileEntry;
  size?: "grid" | "inspector";
};

export function FilePreview({ file, size = "inspector" }: FilePreviewProps) {
  const [useOriginal, setUseOriginal] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUseOriginal(false);
    setFailed(false);
  }, [file.id, file.thumbnailPath, file.absolutePath]);

  if (file.fileKind !== "image") {
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded-lg bg-neutral-800 text-sm text-neutral-500">
        {file.extension?.toUpperCase() || "FILE"}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded-lg bg-neutral-800 text-sm text-neutral-500">
        読込失敗
      </div>
    );
  }

  const src = useOriginal || !file.thumbnailPath ? file.absolutePath : file.thumbnailPath;

  return (
    <div
      className={
        size === "inspector"
          ? "overflow-hidden rounded-lg bg-neutral-900"
          : "h-full w-full overflow-hidden rounded bg-neutral-800"
      }
    >
      <img
        key={`${file.id}:${useOriginal ? "orig" : "thumb"}`}
        src={convertFileSrc(src)}
        alt={file.displayName}
        onError={() => {
          if (!useOriginal && file.thumbnailPath) {
            setUseOriginal(true);
            return;
          }
          setFailed(true);
        }}
        className={
          size === "inspector"
            ? "max-h-[min(16rem,calc(45dvh-var(--safe-top)))] w-full object-contain sm:max-h-80"
            : "h-full w-full object-cover"
        }
      />
    </div>
  );
}
