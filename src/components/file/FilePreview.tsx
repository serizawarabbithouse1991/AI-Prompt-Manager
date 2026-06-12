import { convertFileSrc } from "@tauri-apps/api/core";
import type { FileEntry } from "@/features/files/types";

type FilePreviewProps = {
  file: FileEntry;
  size?: "grid" | "inspector";
};

export function FilePreview({ file, size = "inspector" }: FilePreviewProps) {
  if (file.fileKind !== "image") {
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded-lg bg-neutral-800 text-sm text-neutral-500">
        {file.extension?.toUpperCase() || "FILE"}
      </div>
    );
  }

  const src = file.thumbnailPath
    ? convertFileSrc(file.thumbnailPath)
    : convertFileSrc(file.absolutePath);

  return (
    <div
      className={
        size === "inspector"
          ? "overflow-hidden rounded-lg bg-neutral-900"
          : "h-full w-full overflow-hidden rounded bg-neutral-800"
      }
    >
      <img
        src={src}
        alt={file.displayName}
        className={
          size === "inspector"
            ? "max-h-80 w-full object-contain"
            : "h-full w-full object-cover"
        }
      />
    </div>
  );
}
