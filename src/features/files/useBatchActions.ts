import { useFileStore } from "@/features/files/store";
import type { FileEntry } from "@/features/files/types";
import {
  batchAddTag,
  batchAddToCollection,
  batchApplyPromptTags,
  batchRemoveFromLibrary,
  batchSetFavorite,
} from "@/lib/tauri";
import { toast } from "@/lib/toast";
import { formatBatchTagApplyResult } from "@/lib/smartAssign";
import { shareFileEntry } from "@/lib/shareFile";

type BatchOptions = {
  clearOnSuccess?: boolean;
  showToast?: boolean;
};

export function useBatchActions(selectedFileIds: string[]) {
  const files = useFileStore((s) => s.files);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const setBatchProgress = useFileStore((s) => s.setBatchProgress);
  const refresh = useFileStore((s) => s.refresh);
  const removeFilesFromList = useFileStore((s) => s.removeFilesFromList);

  const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));

  async function runBatch(
    label: string,
    action: () => Promise<void>,
    options: BatchOptions = {},
  ) {
    const { clearOnSuccess = true, showToast = true } = options;
    if (selectedFileIds.length === 0) return;
    setBatchProgress(`${label}中… (${selectedFileIds.length} 件)`);
    try {
      await action();
      setBatchProgress(null);
      if (showToast) {
        toast(`${label}完了 (${selectedFileIds.length} 件)`, "success");
      }
      if (clearOnSuccess) {
        clearSelection();
      }
      await refresh();
    } catch (e) {
      setBatchProgress(String(e));
      toast(String(e), "error");
    }
  }

  async function favorite(isFavorite: boolean) {
    await runBatch(isFavorite ? "お気に入り追加" : "お気に入り解除", async () => {
      await batchSetFavorite(
        selectedFiles.map((f) => ({ fileId: f.id, absolutePath: f.absolutePath })),
        isFavorite,
      );
    });
  }

  async function addTag(tagId: string) {
    await runBatch("タグ付け", async () => {
      await batchAddTag(
        selectedFiles.map((f) => ({ fileId: f.id, absolutePath: f.absolutePath })),
        tagId,
      );
    });
  }

  async function applyPromptTags() {
    await runBatch("プロンプトからタグ付け", async () => {
      const result = await batchApplyPromptTags(undefined, selectedFileIds);
      toast(formatBatchTagApplyResult(result), result.skipReason ? "error" : "success");
    });
  }

  async function removeFromLibrary() {
    await runBatch("ライブラリから削除", async () => {
      await batchRemoveFromLibrary(selectedFileIds);
      removeFilesFromList(selectedFileIds);
    });
  }

  async function addToCollection(collectionId: string, collectionName: string) {
    if (selectedFileIds.length === 0) return;
    setBatchProgress(`「${collectionName}」に追加中… (${selectedFileIds.length} 件)`);
    try {
      const added = await batchAddToCollection(collectionId, selectedFileIds);
      setBatchProgress(null);
      toast(
        added === 0
          ? "選択したファイルは既にコレクションに含まれています"
          : `「${collectionName}」に ${added} 件追加しました`,
        "success",
      );
      clearSelection();
      await refresh();
    } catch (e) {
      setBatchProgress(String(e));
      toast(String(e), "error");
    }
  }

  async function shareSelected() {
    const targets = selectedFiles.filter((f) => !f.isDirectory);
    if (targets.length === 0) return;
    setBatchProgress(`共有中… (${targets.length} 件)`);
    try {
      let ok = 0;
      for (const file of targets) {
        if (await shareFileEntry(file)) ok += 1;
      }
      setBatchProgress(null);
      toast(ok > 0 ? `${ok} 件を共有しました` : "共有できませんでした", ok > 0 ? "success" : "error");
      clearSelection();
    } catch (e) {
      setBatchProgress(String(e));
      toast(String(e), "error");
    }
  }

  return {
    selectedFiles,
    runBatch,
    favorite,
    addTag,
    applyPromptTags,
    removeFromLibrary,
    addToCollection,
    shareSelected,
  };
}

export function shareSingleFile(file: FileEntry) {
  return shareFileEntry(file);
}
