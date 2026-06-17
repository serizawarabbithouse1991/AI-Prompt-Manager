import { useState } from "react";
import { useFileStore } from "@/features/files/store";
import {
  batchAddTag,
  batchApplyPromptTags,
  batchRemoveFromLibrary,
  batchSetFavorite,
} from "@/lib/tauri";
import { confirmAction } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import { formatBatchTagApplyResult } from "@/lib/smartAssign";
import { IconStar } from "@/components/ui/Icons";
import { IOSSheet } from "@/components/ios/IOSSheet";

export function IOSToolbar() {
  const selectedFileIds = useFileStore((s) => s.selectedFileIds);
  const files = useFileStore((s) => s.files);
  const allTags = useFileStore((s) => s.allTags);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const setBatchProgress = useFileStore((s) => s.setBatchProgress);
  const refresh = useFileStore((s) => s.refresh);
  const removeFilesFromList = useFileStore((s) => s.removeFilesFromList);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);

  if (!selectionMode || selectedFileIds.length === 0) return null;

  const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));

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
    setTagSheetOpen(false);
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
      message: `${selectedFiles.length} 件をライブラリから削除しますか？`,
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    await runBatch("ライブラリから削除", async () => {
      await batchRemoveFromLibrary(selectedFileIds);
      removeFilesFromList(selectedFileIds);
    });
  }

  return (
    <>
      <div
        className="ios-toolbar fixed inset-x-0 z-[54] border-b border-[var(--ios-separator)] bg-[var(--ios-bg-elevated)]/95 backdrop-blur-xl"
        style={{ top: "var(--safe-top)" }}
      >
        <div className="flex min-h-11 items-center justify-between px-4">
          <button type="button" onClick={clearSelection} className="text-base text-blue-400">
            キャンセル
          </button>
          <span className="text-sm font-medium">{selectedFileIds.length} 件選択</span>
          <div className="w-16" />
        </div>
        <div className="flex items-center justify-around border-t border-[var(--ios-separator)] px-2 py-2">
          <button
            type="button"
            onClick={() => void handleFavorite(true)}
            className="flex min-h-[var(--ios-touch-min)] min-w-[var(--ios-touch-min)] flex-col items-center justify-center gap-0.5 text-[10px] text-neutral-300"
          >
            <IconStar className="h-5 w-5" filled />
            お気に入り
          </button>
          <button
            type="button"
            onClick={() => setTagSheetOpen(true)}
            className="flex min-h-[var(--ios-touch-min)] min-w-[var(--ios-touch-min)] flex-col items-center justify-center gap-0.5 text-[10px] text-neutral-300"
          >
            <span className="text-lg">#</span>
            タグ
          </button>
          <button
            type="button"
            onClick={() => void handleApplyPromptTags()}
            className="flex min-h-[var(--ios-touch-min)] min-w-[var(--ios-touch-min)] flex-col items-center justify-center gap-0.5 text-[10px] text-neutral-300"
          >
            <span className="text-lg">✦</span>
            タグ付け
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="flex min-h-[var(--ios-touch-min)] min-w-[var(--ios-touch-min)] flex-col items-center justify-center gap-0.5 text-[10px] text-red-400"
          >
            <span className="text-lg">🗑</span>
            削除
          </button>
        </div>
      </div>
      <IOSSheet open={tagSheetOpen} onClose={() => setTagSheetOpen(false)} title="タグを追加">
        <div className="p-2">
          {allTags.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">タグがありません</p>
          ) : (
            allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void handleAddTag(tag.id)}
                className="ios-list-row flex w-full items-center border-b border-[var(--ios-separator)] px-4 text-left last:border-b-0"
              >
                {tag.name}
              </button>
            ))
          )}
        </div>
      </IOSSheet>
    </>
  );
}
