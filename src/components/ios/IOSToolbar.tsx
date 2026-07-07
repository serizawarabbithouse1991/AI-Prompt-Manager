import { useState } from "react";
import { useFileStore, useDisplayFiles } from "@/features/files/store";
import { useBatchActions } from "@/features/files/useBatchActions";
import { confirmAction } from "@/lib/confirm";
import { IconStar } from "@/components/ui/Icons";
import { IOSSheet } from "@/components/ios/IOSSheet";
import { TagSearchPicker } from "@/components/search/TagSearchPicker";
import { IOSListRow } from "@/components/ios/IOSGroupedList";

export function IOSToolbar() {
  const selectedFileIds = useFileStore((s) => s.selectedFileIds);
  const selectionMode = useFileStore((s) => s.selectionMode);
  const allTags = useFileStore((s) => s.allTags);
  const collections = useFileStore((s) => s.collections);
  const clearSelection = useFileStore((s) => s.clearSelection);
  const selectAllDisplayedFiles = useFileStore((s) => s.selectAllDisplayedFiles);
  const deselectAllFiles = useFileStore((s) => s.deselectAllFiles);
  const displayFiles = useDisplayFiles();

  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false);

  const {
    selectedFiles,
    favorite,
    addTag,
    applyPromptTags,
    removeFromLibrary,
    addToCollection,
    shareSelected,
  } = useBatchActions(selectedFileIds);

  if (!selectionMode) return null;

  const selectableCount = displayFiles.filter((f) => !f.isDirectory).length;
  const allSelected = selectableCount > 0 && selectedFileIds.length >= selectableCount;
  const hasSelection = selectedFileIds.length > 0;

  async function handleDelete() {
    const ok = await confirmAction({
      title: "削除の確認",
      message: `${selectedFiles.length} 件をライブラリから削除しますか？`,
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    await removeFromLibrary();
  }

  function handleSelectAllToggle() {
    if (allSelected) deselectAllFiles();
    else selectAllDisplayedFiles();
  }

  const actions = [
    {
      key: "favorite",
      label: "お気に入り",
      onClick: () => void favorite(true),
      disabled: !hasSelection,
      icon: <IconStar className="h-5 w-5" filled />,
    },
    {
      key: "unfavorite",
      label: "解除",
      onClick: () => void favorite(false),
      disabled: !hasSelection,
      icon: <IconStar className="h-5 w-5" />,
    },
    {
      key: "tag",
      label: "タグ",
      onClick: () => setTagSheetOpen(true),
      disabled: !hasSelection,
      icon: <span className="text-lg">#</span>,
    },
    {
      key: "collection",
      label: "コレクション",
      onClick: () => setCollectionSheetOpen(true),
      disabled: !hasSelection,
      icon: <span className="text-lg">▦</span>,
    },
    {
      key: "share",
      label: "共有",
      onClick: () => void shareSelected(),
      disabled: !hasSelection,
      icon: <span className="text-lg">↗</span>,
    },
    {
      key: "prompt",
      label: "タグ付け",
      onClick: () => void applyPromptTags(),
      disabled: !hasSelection,
      icon: <span className="text-lg">✦</span>,
    },
    {
      key: "delete",
      label: "削除",
      onClick: () => void handleDelete(),
      disabled: !hasSelection,
      icon: <span className="text-lg">🗑</span>,
      danger: true,
    },
  ];

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
          <span className="text-sm font-medium">
            {hasSelection ? `${selectedFileIds.length} 件選択` : "項目を選択"}
          </span>
          <button
            type="button"
            onClick={handleSelectAllToggle}
            className="text-base text-blue-400 disabled:opacity-40"
            disabled={selectableCount === 0}
          >
            {allSelected ? "解除" : "すべて"}
          </button>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto border-t border-[var(--ios-separator)] px-2 py-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className={[
                "flex min-h-[var(--ios-touch-min)] min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px]",
                action.danger ? "text-red-400" : "text-neutral-300",
                action.disabled ? "opacity-40" : "active:bg-neutral-800",
              ].join(" ")}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <IOSSheet open={tagSheetOpen} onClose={() => setTagSheetOpen(false)} title="タグを追加">
        <div className="p-4">
          <TagSearchPicker
            allTags={allTags}
            selectedTagId={null}
            onSelect={(tagId) => {
              if (tagId) void addTag(tagId);
              setTagSheetOpen(false);
            }}
            variant="ios"
            showAllOption={false}
          />
        </div>
      </IOSSheet>
      <IOSSheet open={collectionSheetOpen} onClose={() => setCollectionSheetOpen(false)} title="コレクションに追加">
        <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
          {collections.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">コレクションがありません</p>
          ) : (
            collections.map((collection) => (
              <IOSListRow
                key={collection.id}
                label={collection.name}
                onPress={() => {
                  setCollectionSheetOpen(false);
                  void addToCollection(collection.id, collection.name);
                }}
              />
            ))
          )}
        </div>
      </IOSSheet>
    </>
  );
}
