import { useState } from "react";
import { useFileStore } from "@/features/files/store";
import {
  batchAddTag,
  batchApplyPromptTags,
  batchRemoveFromLibrary,
  batchSetFavorite,
  batchTrash,
  copyFile,
  moveFile,
} from "@/lib/tauri";
import { isDesktopPlatform, isMobilePlatform } from "@/lib/platform";
import { open } from "@tauri-apps/plugin-dialog";
import { confirmAction } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import { formatBatchTagApplyResult } from "@/lib/smartAssign";
import { IconStar } from "@/components/ui/Icons";

export function SelectionBar() {
  const selectedFileIds = useFileStore((s) => s.selectedFileIds);
  const files = useFileStore((s) => s.files);
  const allTags = useFileStore((s) => s.allTags);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const platformName = useFileStore((s) => s.platformName);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const setBatchProgress = useFileStore((s) => s.setBatchProgress);
  const refresh = useFileStore((s) => s.refresh);
  const removeFilesFromList = useFileStore((s) => s.removeFilesFromList);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);

  if (!selectionMode || selectedFileIds.length === 0) return null;

  const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));
  const isDesktop = isDesktopPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);

  async function runBatch(label: string, action: () => Promise<void>) {
    setBatchProgress(`${label}中… (${selectedFileIds.length} 件)`);
    try {
      await action();
      setBatchProgress(`${label}完了 (${selectedFileIds.length} 件)`);
      clearSelection();
      await refresh();
    } catch (e) {
      setBatchProgress(String(e));
    }
  }

  async function handleFavorite(isFavorite: boolean) {
    await runBatch(isFavorite ? "お気に入り追加" : "お気に入り解除", async () => {
      await batchSetFavorite(
        selectedFiles.map((f) => ({ fileId: f.id, absolutePath: f.absolutePath })),
        isFavorite,
      );
    });
  }

  async function handleApplyPromptTags() {
    await runBatch("プロンプトからタグ付け", async () => {
      const result = await batchApplyPromptTags(undefined, selectedFileIds);
      toast(formatBatchTagApplyResult(result), result.skipReason ? "error" : "success");
    });
  }

  async function handleAddTag(tagId: string) {
    setTagMenuOpen(false);
    await runBatch("タグ付け", async () => {
      await batchAddTag(
        selectedFiles.map((f) => ({ fileId: f.id, absolutePath: f.absolutePath })),
        tagId,
      );
    });
  }

  async function handleDelete() {
    const ok = await confirmAction({
      title: "削除の確認",
      message: `${selectedFiles.length} 件を削除しますか？`,
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    if (isDesktop) {
      await runBatch("ゴミ箱へ移動", async () => {
        await batchTrash(selectedFiles.map((f) => f.absolutePath));
        removeFilesFromList(selectedFileIds);
      });
    } else if (isMobile) {
      await runBatch("ライブラリから削除", async () => {
        await batchRemoveFromLibrary(selectedFileIds);
        removeFilesFromList(selectedFileIds);
      });
    }
  }

  async function handleCopy() {
    const dest = await open({ directory: true, multiple: false });
    if (typeof dest !== "string") return;
    await runBatch("コピー", async () => {
      for (const file of selectedFiles) {
        if (!file.isDirectory) await copyFile(file.absolutePath, dest);
      }
    });
  }

  async function handleMove() {
    const dest = await open({ directory: true, multiple: false });
    if (typeof dest !== "string") return;
    await runBatch("移動", async () => {
      for (const file of selectedFiles) {
        if (!file.isDirectory) await moveFile(file.absolutePath, dest);
      }
      removeFilesFromList(selectedFileIds);
    });
  }

  async function handleExportJson() {
    const payload = selectedFiles.map((f) => ({
      id: f.id,
      displayName: f.displayName,
      absolutePath: f.absolutePath,
      aiModel: f.aiModel,
      aiSteps: f.aiSteps,
      promptPreview: f.promptPreview,
      contentHash: f.contentHash,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${selectedFiles.length} 件を JSON でエクスポートしました`, "success");
  }

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-blue-900/50 bg-blue-950/30 px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:px-4 sm:py-2 [&::-webkit-scrollbar]:hidden">
      <span className="text-sm text-blue-300">{selectedFileIds.length} 件選択中</span>
      <button type="button" onClick={() => void handleFavorite(true)} className="action-btn flex items-center gap-1">
        <IconStar className="h-3.5 w-3.5" filled />
        お気に入り
      </button>
      <button type="button" onClick={() => void handleFavorite(false)} className="action-btn">
        お気に入り解除
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setTagMenuOpen((v) => !v)}
          className="action-btn"
        >
          タグ
        </button>
        {tagMenuOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 max-h-40 min-w-[140px] overflow-auto rounded border border-neutral-700 bg-neutral-900 py-1 shadow-lg">
            {allTags.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-500">タグがありません</div>
            ) : (
              allTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => void handleAddTag(tag.id)}
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-800"
                >
                  {tag.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={() => void handleApplyPromptTags()} className="action-btn">
        プロンプトからタグ付け
      </button>
      {isDesktop && (
        <>
          <button type="button" onClick={() => void handleCopy()} className="action-btn">
            コピー
          </button>
          <button type="button" onClick={() => void handleMove()} className="action-btn">
            移動
          </button>
        </>
      )}
      <button type="button" onClick={() => void handleExportJson()} className="action-btn">
        JSON出力
      </button>
      <button type="button" onClick={() => void handleDelete()} className="action-btn-danger">
        削除
      </button>
      <button type="button" onClick={clearSelection} className="ml-auto action-btn">
        選択解除
      </button>
    </div>
  );
}
