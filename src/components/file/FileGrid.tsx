import { useCallback, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { VirtuosoGrid } from "react-virtuoso";
import { useFileStore, useDisplayFiles } from "@/features/files/store";
import { formatBytes, formatDate } from "@/lib/format";
import { isMobilePlatform } from "@/lib/platform";
import { showFileContextMenu } from "@/components/file/FileContextMenu";
import { EmptyState } from "@/components/file/EmptyState";
import { GridSkeleton } from "@/components/file/GridSkeleton";
import { IconFolder, IconImage, IconStar } from "@/components/ui/Icons";
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (file.fileKind === "image" && !failed) {
    return (
      <img
        src={convertFileSrc(file.thumbnailPath ?? file.absolutePath)}
        alt={file.displayName}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={[
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
    );
  }

  if (file.isDirectory) {
    return (
      <div className="flex h-full w-full items-center justify-center text-neutral-500">
        <IconFolder className="h-8 w-8" />
      </div>
    );
  }

  if (file.fileKind === "image" && failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-500">
        <IconImage className="h-6 w-6" />
        <span className="text-micro">読込失敗</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-caption text-neutral-500">
      {file.extension || "file"}
    </div>
  );
}

function MetadataBadges({ file }: { file: FileEntry }) {
  if (!file.aiModel && !file.aiSteps) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-0.5 bg-gradient-to-t from-black/80 to-transparent p-1">
      {file.aiModel && (
        <span className="max-w-full truncate rounded bg-neutral-900/90 px-1 py-0.5 text-micro text-blue-200">
          {file.aiModel}
        </span>
      )}
      {file.aiSteps != null && file.aiSteps > 0 && (
        <span className="rounded bg-neutral-900/90 px-1 py-0.5 text-micro text-neutral-300">
          {file.aiSteps} steps
        </span>
      )}
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
        "rounded-lg border p-1.5 text-left transition-colors sm:p-2",
        selected
          ? "border-blue-500 bg-blue-500/10"
          : "border-neutral-800 bg-neutral-900 hover:border-neutral-700",
      ].join(" ")}
    >
      <div className="relative mb-2 aspect-square overflow-hidden rounded bg-neutral-800">
        <FileThumbnail file={file} />
        {file.isFavorite && (
          <span className="absolute right-1 top-1 text-yellow-400">
            <IconStar className="h-3.5 w-3.5" filled />
          </span>
        )}
        <MetadataBadges file={file} />
      </div>
      <div className="truncate text-caption">{file.displayName}</div>
    </button>
  );
}

export function FileGrid() {
  const displayFiles = useDisplayFiles();
  const loading = useFileStore((s) => s.loading);
  const error = useFileStore((s) => s.error);
  const viewMode = useFileStore((s) => s.viewMode);
  const searchHasMore = useFileStore((s) => s.searchHasMore);
  const searchLoadingMore = useFileStore((s) => s.searchLoadingMore);
  const loadMoreSearch = useFileStore((s) => s.loadMoreSearch);
  const { isMobile, isSelected, handleClick, handleOpen, handleContextMenu, enterSelectionMode } =
    useFileSelection();

  const renderItem = useCallback(
    (index: number) => {
      const file = displayFiles[index];
      if (!file) return null;
      return (
        <FileGridItem
          file={file}
          selected={isSelected(file.id)}
          isMobile={isMobile}
          onClick={(e) => handleClick(file, file.id, e)}
          onDoubleClick={() => handleOpen(file)}
          onContextMenu={(e) => handleContextMenu(e, file.id)}
          onLongPress={() => enterSelectionMode(file.id)}
        />
      );
    },
    [
      displayFiles,
      isMobile,
      isSelected,
      handleClick,
      handleOpen,
      handleContextMenu,
      enterSelectionMode,
    ],
  );

  if (loading && displayFiles.length === 0) return <GridSkeleton />;
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-red-400">{error}</div>
    );
  }
  if (displayFiles.length === 0) {
    const message =
      viewMode === "search"
        ? "検索結果がありません"
        : viewMode === "duplicates"
          ? "重複ファイルはありません"
          : "ファイルがありません";
    return <EmptyState message={message} showCta={viewMode === "ai-library"} />;
  }

  return (
    <div className="h-full min-h-0 p-2 sm:p-4">
      <VirtuosoGrid
        className="h-full min-h-0"
        totalCount={displayFiles.length}
        listClassName="file-grid"
        itemClassName="min-w-0"
        itemContent={renderItem}
        endReached={() => {
          if (viewMode === "search" && searchHasMore && !searchLoadingMore) {
            void loadMoreSearch();
          }
        }}
        components={{
          Footer: () =>
            searchLoadingMore ? (
              <div className="col-span-full py-4 text-center text-caption text-neutral-500">
                読み込み中…
              </div>
            ) : null,
        }}
      />
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

  if (loading && displayFiles.length === 0) return <GridSkeleton />;
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-red-400">{error}</div>
    );
  }
  if (displayFiles.length === 0) {
    const message =
      viewMode === "search"
        ? "検索結果がありません"
        : viewMode === "duplicates"
          ? "重複ファイルはありません"
          : "ファイルがありません";
    return <EmptyState message={message} showCta={viewMode === "ai-library"} />;
  }

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="sticky top-0 z-10 hidden grid-cols-[48px_1fr_100px_140px] gap-2 border-b border-neutral-800 bg-neutral-950 px-4 py-2 text-caption text-neutral-500 sm:grid">
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
        "grid w-full grid-cols-[40px_1fr] gap-2 border-b border-neutral-800/50 px-2 py-2 text-left text-body transition-colors sm:grid-cols-[48px_1fr_100px_140px] sm:px-4",
        selected ? "bg-blue-500/10" : "hover:bg-neutral-900",
      ].join(" ")}
    >
      <div className="h-10 w-10 overflow-hidden rounded bg-neutral-800">
        <FileThumbnail file={file} />
      </div>
      <span className="flex min-w-0 items-center gap-1 truncate">
        {file.isFavorite && (
          <span className="text-yellow-400">
            <IconStar className="h-3.5 w-3.5" filled />
          </span>
        )}
        {file.displayName}
        {file.aiModel && (
          <span className="ml-1 truncate text-micro text-blue-300/80">{file.aiModel}</span>
        )}
      </span>
      <span className="hidden text-caption text-neutral-500 sm:block">
        {file.isDirectory ? "—" : formatBytes(file.sizeBytes)}
      </span>
      <span className="hidden truncate text-caption text-neutral-500 sm:block">
        {formatDate(file.modifiedAt)}
      </span>
    </button>
  );
}
