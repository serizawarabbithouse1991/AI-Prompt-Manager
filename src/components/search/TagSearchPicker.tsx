import { useMemo, useState } from "react";
import type { Tag } from "@/features/tags/types";
import { filterTagsByQuery } from "@/lib/tagPicker";
import { IOSListRow } from "@/components/ios/IOSGroupedList";

type TagSearchPickerProps = {
  allTags: Tag[];
  selectedTagId: string | null;
  onSelect: (tagId: string | null) => void;
  variant: "desktop" | "ios";
  showAllOption?: boolean;
};

export function TagSearchPicker({
  allTags,
  selectedTagId,
  onSelect,
  variant,
  showAllOption = true,
}: TagSearchPickerProps) {
  const [filter, setFilter] = useState("");

  const filteredTags = useMemo(
    () => filterTagsByQuery(allTags, filter),
    [allTags, filter],
  );

  if (variant === "desktop") {
    return (
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="タグ名で絞り込み"
          className="min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 sm:max-w-[140px]"
        />
        <select
          value={selectedTagId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          className="min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        >
          {showAllOption && (
            <option value="">
              {filteredTags.length === 0 && filter ? "一致するタグなし" : "すべて"}
            </option>
          )}
          {filteredTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="タグ名で絞り込み"
        className="w-full rounded-[var(--ios-radius-md)] border border-neutral-700 bg-[var(--ios-bg-grouped)] px-4 py-3 text-base text-neutral-100"
      />
      <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
        {showAllOption && (
          <IOSListRow
            label="すべて"
            onPress={() => onSelect(null)}
            trailing={!selectedTagId ? <span className="text-blue-400">✓</span> : null}
          />
        )}
        {filteredTags.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-neutral-500">
            {filter ? "一致するタグがありません" : "タグがありません"}
          </p>
        ) : (
          filteredTags.map((tag) => (
            <IOSListRow
              key={tag.id}
              label={tag.name}
              onPress={() => onSelect(tag.id)}
              trailing={selectedTagId === tag.id ? <span className="text-blue-400">✓</span> : null}
            />
          ))
        )}
      </div>
    </div>
  );
}
