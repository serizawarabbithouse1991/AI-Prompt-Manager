import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import { IOSSheet } from "@/components/ios/IOSSheet";
import { TagSearchPicker } from "@/components/search/TagSearchPicker";

type IOSSearchTagSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelected?: () => void;
};

export function IOSSearchTagSheet({ open, onClose, onSelected }: IOSSearchTagSheetProps) {
  const allTags = useFileStore((s) => s.allTags);
  const searchTagId = useFileStore((s) => s.searchTagId);
  const setSearchTagId = useFileStore((s) => s.setSearchTagId);
  const refreshAllTags = useFileStore((s) => s.refreshAllTags);

  useEffect(() => {
    if (open) {
      void refreshAllTags();
    }
  }, [open, refreshAllTags]);

  function handleSelect(tagId: string | null) {
    setSearchTagId(tagId);
    onClose();
    onSelected?.();
  }

  return (
    <IOSSheet open={open} onClose={onClose} title="タグで検索" tall>
      <div className="p-4">
        <TagSearchPicker
          variant="ios"
          allTags={allTags}
          selectedTagId={searchTagId}
          onSelect={handleSelect}
        />
      </div>
    </IOSSheet>
  );
}
