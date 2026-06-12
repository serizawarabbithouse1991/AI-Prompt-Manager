import { useFileStore } from "@/features/files/store";
import { convertFileSrc } from "@tauri-apps/api/core";

export function FileGrid() {
  const files = useFileStore((s) => s.files);
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const selectFile = useFileStore((s) => s.selectFile);
  const navigateTo = useFileStore((s) => s.navigateTo);
  const loading = useFileStore((s) => s.loading);
  const error = useFileStore((s) => s.error);
  const viewMode = useFileStore((s) => s.viewMode);

  if (loading && files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        読み込み中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-red-400">
        {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        {viewMode === "search" ? "検索結果がありません" : "ファイルがありません"}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {files.map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => selectFile(file.id)}
            onDoubleClick={() => {
              if (file.isDirectory) void navigateTo(file.absolutePath);
            }}
            className={[
              "rounded-lg border p-2 text-left transition-colors",
              selectedFileId === file.id
                ? "border-blue-500 bg-blue-500/10"
                : "border-neutral-800 bg-neutral-900 hover:border-neutral-700",
            ].join(" ")}
          >
            <div className="mb-2 aspect-square overflow-hidden rounded bg-neutral-800">
              {file.fileKind === "image" ? (
                <img
                  src={convertFileSrc(file.thumbnailPath ?? file.absolutePath)}
                  alt={file.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                  {file.isDirectory ? "📁" : file.extension || "file"}
                </div>
              )}
            </div>
            <div className="truncate text-xs">{file.displayName}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
