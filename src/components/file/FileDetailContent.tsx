import { useState, useEffect } from "react";
import type { FileEntry } from "@/features/files/types";
import { useFileStore } from "@/features/files/store";
import { useSelectedFileDetails } from "@/features/files/hooks";
import { FilePreview } from "@/components/file/FilePreview";
import { PromptPanel } from "@/components/metadata/PromptPanel";
import { MetadataPanel } from "@/components/metadata/MetadataPanel";
import { TagEditor } from "@/components/metadata/TagEditor";
import { formatBytes, formatDate } from "@/lib/format";
import {
  renameFile,
  removeFromLibrary,
  revealInFileManager,
  setFavorite,
  trashFile,
  copyFile,
  addFileToCollection,
  listCollections,
} from "@/lib/tauri";
import { shareFileEntry } from "@/lib/shareFile";
import { open } from "@tauri-apps/plugin-dialog";
import { isDesktopPlatform, isMobilePlatform } from "@/lib/platform";
import { confirmAction } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import { IconStar } from "@/components/ui/Icons";

type FileDetailContentProps = {
  file: FileEntry;
  showPreview?: boolean;
};

export function FileDetailContent({ file, showPreview = true }: FileDetailContentProps) {
  const metadata = useFileStore((s) => s.metadata);
  const tags = useFileStore((s) => s.tags);
  const allTags = useFileStore((s) => s.allTags);
  const refresh = useFileStore((s) => s.refresh);
  const platformName = useFileStore((s) => s.platformName);
  const collections = useFileStore((s) => s.collections);
  const setCollections = useFileStore((s) => s.setCollections);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const setInspectorOpen = useFileStore((s) => s.setInspectorOpen);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);

  useSelectedFileDetails();

  useEffect(() => {
    if (collections.length === 0) {
      void listCollections().then(setCollections).catch(() => setCollections([]));
    }
  }, [collections.length, setCollections]);

  const isDesktop = isDesktopPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);

  function closeOverlays() {
    setLightboxFileId(null);
    setInspectorOpen(false);
  }

  async function handleFavorite() {
    await setFavorite(file.id, !file.isFavorite, file.absolutePath);
    await refresh();
  }

  async function handleRename() {
    if (!newName.trim()) return;
    await renameFile(file.absolutePath, newName.trim());
    setRenaming(false);
    await refresh();
  }

  async function handleTrash() {
    const ok = await confirmAction({
      title: "ゴミ箱へ移動",
      message: `「${file.displayName}」をゴミ箱へ移動しますか？`,
      confirmLabel: "移動",
      danger: true,
    });
    if (!ok) return;
    await trashFile(file.absolutePath);
    closeOverlays();
    useFileStore.getState().selectFile(null);
    await refresh();
    toast("ゴミ箱へ移動しました", "success");
  }

  async function handleRemoveFromLibrary() {
    const ok = await confirmAction({
      title: "ライブラリから削除",
      message: `「${file.displayName}」をライブラリから削除しますか？`,
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    await removeFromLibrary(file.id);
    closeOverlays();
    useFileStore.getState().selectFile(null);
    await refresh();
    toast("ライブラリから削除しました", "success");
  }

  async function handleAddToCollection(collectionId: string) {
    setCollectionMenuOpen(false);
    try {
      await addFileToCollection(collectionId, file.id);
      toast("コレクションに追加しました", "success");
    } catch (e) {
      toast(String(e), "error");
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {showPreview && <FilePreview file={file} />}
      <div className="space-y-1">
        <h2 className="truncate text-sm font-medium">{file.displayName}</h2>
        <div className="text-xs text-neutral-500">
          {formatBytes(file.sizeBytes)} · {formatDate(file.modifiedAt)}
        </div>
        {file.width && file.height && (
          <div className="text-xs text-neutral-500">
            {file.width} × {file.height}
          </div>
        )}
      </div>

      {!file.isDirectory && (
        <>
          <PromptPanel metadata={metadata} filePath={file.absolutePath} />
          <MetadataPanel metadata={metadata} fileId={file.id} />
          <TagEditor
            fileId={file.id}
            absolutePath={file.absolutePath}
            tags={tags}
            allTags={allTags}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
        <button
          type="button"
          onClick={() => void handleFavorite()}
          className="action-btn flex items-center gap-1"
        >
          <IconStar className="h-3.5 w-3.5" filled={file.isFavorite} />
          {file.isFavorite ? "お気に入り解除" : "お気に入り"}
        </button>
        {!file.isDirectory && collections.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setCollectionMenuOpen((v) => !v)}
              className="action-btn"
            >
              コレクションに追加
            </button>
            {collectionMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 max-h-40 min-w-[160px] overflow-auto rounded border border-neutral-700 bg-neutral-900 py-1 shadow-lg">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void handleAddToCollection(c.id)}
                    className="block w-full px-3 py-1.5 text-left text-caption hover:bg-neutral-800"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {isDesktop && !file.isDirectory && (
          <>
            <button
              type="button"
              onClick={() => {
                setNewName(file.displayName);
                setRenaming(true);
              }}
              className="action-btn"
            >
              リネーム
            </button>
            <button
              type="button"
              onClick={() => void revealInFileManager(file.absolutePath)}
              className="action-btn"
            >
              Finder/Explorer
            </button>
            <button
              type="button"
              onClick={() => void handleTrash()}
              className="action-btn-danger"
            >
              ゴミ箱
            </button>
            <button
              type="button"
              onClick={() =>
                void open({ directory: true, multiple: false }).then((dest) => {
                  if (typeof dest === "string") void copyFile(file.absolutePath, dest);
                })
              }
              className="action-btn"
            >
              エクスポート
            </button>
          </>
        )}
        {isMobile && !file.isDirectory && (
          <>
            <button
              type="button"
              onClick={() => void shareFileEntry(file)}
              className="action-btn"
            >
              共有
            </button>
            <button
              type="button"
              onClick={() => {
                setNewName(file.displayName);
                setRenaming(true);
              }}
              className="action-btn"
            >
              リネーム
            </button>
            <button
              type="button"
              onClick={() => void handleRemoveFromLibrary()}
              className="action-btn-danger"
            >
              削除
            </button>
          </>
        )}
      </div>

      {renaming && (
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          />
          <button type="button" onClick={() => void handleRename()} className="action-btn">
            保存
          </button>
        </div>
      )}
    </div>
  );
}
