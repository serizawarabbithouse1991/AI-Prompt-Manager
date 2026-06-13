import { useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useFileStore, useDisplayFiles } from "@/features/files/store";
import { formatBytes, formatDate } from "@/lib/format";
import { isMobilePlatform } from "@/lib/platform";
import { showFileContextMenu } from "@/components/file/FileContextMenu";
import type { FileEntry } from "@/features/files/types";

function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<number | null>(null);

  function start() {
    timerRef.current = window.setTimeout(onLongPress, 500);
  }

  function cancel() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return { start, cancel };
}

function FileThumbnail({ file }: { file: FileEntry }) {
  if (file.fileKind === "image") {
    return (
      <img
        src={convertFileSrc(file.thumbnailPath ?? file.absolutePath)}
        alt={file.displayName}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
      {file.isDirectory ? "📁" : file.extension || "file"}
    </div>
  );
}

function useFileSelection() {
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const selectedFileIds = useFileStore((s) => s.selectedFileIds);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const selectFile = useFileStore((s) => s.selectFile);
  const enterSelectionMode = useFileStore((s) => s.enterSelectionMode);
  const navigateTo = useFileStore((s) => s.navigateTo);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const platformName = useFileStore((s) => s.platformName);
  const isMobile = isMobilePlatform(platformName);

  function isSelected(fileId: string) {
    return selectionMode ? selectedFileIds.includes(fileId) : selectedFileId === fileId;
  }

  function handleClick(file: FileEntry, fileId: string, e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || selectionMode) {
      selectFile(fileId, true);
      return;
    }
    if (isMobile) {
      if (file.isDirectory) {
        void navigateTo(file.absolutePath);
        return;
      }
      if (file.fileKind === "image") {
        selectFile(fileId);
        setLightboxFileId(fileId);
        return;
      }
    }
    selectFile(fileId);
  }

  function handleOpen(file: FileEntry) {
    if (file.isDirectory) {
      void navigateTo(file.absolutePath);
    } else if (file.fileKind === "image") {
      setLightboxFileId(file.id);
    }
  }

  function handleContextMenu(e: React.MouseEvent, fileId: string) {
    e.preventDefault();
    showFileContextMenu(e.clientX, e.clientY, fileId);
  }

  return {
    isMobile,
    isSelected,
    handleClick,
    handleOpen,
    handleContextMenu,
    enterSelectionMode,
  };
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-neutral-500">{message}</div>
  );
}

function FileGridItem({
  file,
  selected,
  isMobile,
  onClick,
  onDoubleClick,
  onContextMenu,
  onLongPress,
}: {
  file: FileEntry;
  selected: boolean;
  isMobile: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress);

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onTouchStart={() => {
        if (isMobile) longPress.start();
      }}
      onTouchEnd={longPress.cancel}
      onTouchMove={longPress.cancel}
      className={[
        "rounded-lg border p-2 text-left transition-colors",
        selected
          ? "border-blue-500 bg-blue-500/10"
          : "border-neutral-800 bg-neutral-900 hover:border-neutral-700",
      ].join(" ")}
    >
      <div className="relative mb-2 aspect-square overflow-hidden rounded bg-neutral-800">
        <FileThumbnail file={file} />
        {file.isFavorite && (
          <span className="absolute right-1 top-1 text-xs text-yellow-400">★</span>
        )}
      </div>
      <div className="truncate text-xs">{file.displayName}</div>
    </button>
  );
}

export function FileGrid() {
  const displayFiles = useDisplayFiles();
  const loading = useFileStore((s) => s.loading);
  const error = useFileStore((s) => s.error);
  const viewMode = useFileStore((s) => s.viewMode);
  const { isMobile, isSelected, handleClick, handleOpen, handleContextMenu, enterSelectionMode } =
    useFileSelection();

  if (loading && displayFiles.length === 0) return <EmptyState message="読み込み中…" />;
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-red-400">{error}</div>
    );
  }
  if (displayFiles.length === 0) {
    return (
      <EmptyState message={viewMode === "search" ? "検索結果がありません" : "ファイルがありません"} />
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {displayFiles.map((file) => (
          <FileGridItem
            key={file.id}
            file={file}
            selected={isSelected(file.id)}
            isMobile={isMobile}
            onClick={(e) => handleClick(file, file.id, e)}
            onDoubleClick={() => handleOpen(file)}
            onContextMenu={(e) => handleContextMenu(e, file.id)}
            onLongPress={() => enterSelectionMode(file.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function FileList() {
  const displayFiles = useDisplayFiles();
  const loading = useFileStore((s) => s.loading);
  const error = useFileStore((s) => s.error);
  const viewMode = useFileStore((s) => s.viewMode);
  const { isMobile, isSelected, handleClick, handleOpen, handleContextMenu, enterSelectionMode } =
    useFileSelection();

  if (loading && displayFiles.length === 0) return <EmptyState message="読み込み中…" />;
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-red-400">{error}</div>
    );
  }
  if (displayFiles.length === 0) {
    return (
      <EmptyState message={viewMode === "search" ? "検索結果がありません" : "ファイルがありません"} />
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 grid grid-cols-[48px_1fr_100px_140px] gap-2 border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-xs text-neutral-500">
        <span />
        <span>名前</span>
        <span>サイズ</span>
        <span>更新日</span>
      </div>
      {displayFiles.map((file) => (
        <FileListRow
          key={file.id}
          file={file}
          selected={isSelected(file.id)}
          isMobile={isMobile}
          onClick={(e) => handleClick(file, file.id, e)}
          onDoubleClick={() => handleOpen(file)}
          onContextMenu={(e) => handleContextMenu(e, file.id)}
          onLongPress={() => enterSelectionMode(file.id)}
        />
      ))}
    </div>
  );
}

function FileListRow({
  file,
  selected,
  isMobile,
  onClick,
  onDoubleClick,
  onContextMenu,
  onLongPress,
}: {
  file: FileEntry;
  selected: boolean;
  isMobile: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress);

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onTouchStart={() => {
        if (isMobile) longPress.start();
      }}
      onTouchEnd={longPress.cancel}
      onTouchMove={longPress.cancel}
      className={[
        "grid w-full grid-cols-[48px_1fr_100px_140px] gap-2 border-b border-neutral-800/50 px-4 py-2 text-left text-sm transition-colors",
        selected ? "bg-blue-500/10" : "hover:bg-neutral-900",
      ].join(" ")}
    >
      <div className="h-10 w-10 overflow-hidden rounded bg-neutral-800">
        <FileThumbnail file={file} />
      </div>
      <span className="flex min-w-0 items-center gap-1 truncate">
        {file.isFavorite && <span className="text-yellow-400">★</span>}
        {file.displayName}
      </span>
      <span className="text-xs text-neutral-500">
        {file.isDirectory ? "—" : formatBytes(file.sizeBytes)}
      </span>
      <span className="truncate text-xs text-neutral-500">{formatDate(file.modifiedAt)}</span>
    </button>
  );
}
