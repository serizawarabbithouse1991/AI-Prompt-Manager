import { useState } from "react";
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
} from "@/lib/tauri";
import { isDesktopPlatform, isMobilePlatform } from "@/lib/platform";

export function Inspector() {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const metadata = useFileStore((s) => s.metadata);
  const tags = useFileStore((s) => s.tags);
  const allTags = useFileStore((s) => s.allTags);
  const refresh = useFileStore((s) => s.refresh);
  const platformName = useFileStore((s) => s.platformName);
  const inspectorOpen = useFileStore((s) => s.inspectorOpen);
  const setInspectorOpen = useFileStore((s) => s.setInspectorOpen);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  useSelectedFileDetails();

  const isDesktop = isDesktopPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);

  if (!selectedFile) {
    return (
      <aside className="hidden h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950 lg:flex">
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-neutral-500">
          ファイルを選択してください
        </div>
      </aside>
    );
  }

  async function handleFavorite() {
    await setFavorite(selectedFile!.id, !selectedFile!.isFavorite);
    await refresh();
  }

  async function handleRename() {
    if (!newName.trim()) return;
    await renameFile(selectedFile!.absolutePath, newName.trim());
    setRenaming(false);
    await refresh();
  }

  async function handleTrash() {
    if (!confirm(`「${selectedFile!.displayName}」をゴミ箱へ移動しますか？`)) return;
    await trashFile(selectedFile!.absolutePath);
    useFileStore.getState().selectFile(null);
    await refresh();
  }

  async function handleRemoveFromLibrary() {
    if (!confirm(`「${selectedFile!.displayName}」をライブラリから削除しますか？`)) return;
    await removeFromLibrary(selectedFile!.id);
    useFileStore.getState().selectFile(null);
    await refresh();
  }

  const content = (
    <div className="space-y-4 p-4">
      <FilePreview file={selectedFile} />
      <div className="space-y-1">
        <h2 className="truncate text-sm font-medium">{selectedFile.displayName}</h2>
        <div className="text-xs text-neutral-500">
          {formatBytes(selectedFile.sizeBytes)} · {formatDate(selectedFile.modifiedAt)}
        </div>
        {selectedFile.width && selectedFile.height && (
          <div className="text-xs text-neutral-500">
            {selectedFile.width} × {selectedFile.height}
          </div>
        )}
      </div>

      {!selectedFile.isDirectory && (
        <>
          <PromptPanel metadata={metadata} />
          <MetadataPanel metadata={metadata} />
          <TagEditor fileId={selectedFile.id} tags={tags} allTags={allTags} />
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
        <button
          type="button"
          onClick={() => void handleFavorite()}
          className="action-btn"
        >
          {selectedFile.isFavorite ? "★ お気に入り解除" : "☆ お気に入り"}
        </button>
        {isDesktop && !selectedFile.isDirectory && (
          <>
            <button
              type="button"
              onClick={() => {
                setNewName(selectedFile.displayName);
                setRenaming(true);
              }}
              className="action-btn"
            >
              リネーム
            </button>
            <button
              type="button"
              onClick={() => void revealInFileManager(selectedFile.absolutePath)}
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
          </>
        )}
        {isMobile && !selectedFile.isDirectory && (
          <button
            type="button"
            onClick={() => void handleRemoveFromLibrary()}
            className="action-btn-danger"
          >
            削除
          </button>
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

  return (
    <>
      <aside className="hidden h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950 lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {content}
        </div>
      </aside>
      {inspectorOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 lg:hidden">
          <div className="flex shrink-0 items-center border-b border-neutral-800 p-3">
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              className="text-sm text-blue-400"
            >
              ← 戻る
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{content}</div>
        </div>
      )}
    </>
  );
}
