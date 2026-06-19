import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";
import {
  FILTER_LABELS,
  LAYOUT_LABELS,
  SORT_LABELS,
} from "@/features/files/viewUtils";
import type { FileFilter, LayoutMode, SortField, SortOrder } from "@/features/files/types";
import { GridSizeControl } from "@/components/file/GridSizeControl";

export function ViewControls() {
  const sortField = useFileStore((s) => s.sortField);
  const sortOrder = useFileStore((s) => s.sortOrder);
  const fileFilter = useFileStore((s) => s.fileFilter);
  const filterTagId = useFileStore((s) => s.filterTagId);
  const layoutMode = useFileStore((s) => s.layoutMode);
  const allTags = useFileStore((s) => s.allTags);
  const viewMode = useFileStore((s) => s.viewMode);
  const refreshAllTags = useFileStore((s) => s.refreshAllTags);
  const setSortField = useFileStore((s) => s.setSortField);
  const setSortOrder = useFileStore((s) => s.setSortOrder);
  const setFileFilter = useFileStore((s) => s.setFileFilter);
  const setFilterTagId = useFileStore((s) => s.setFilterTagId);
  const setLayoutMode = useFileStore((s) => s.setLayoutMode);

  useEffect(() => {
    if (fileFilter === "tag") {
      void refreshAllTags();
    }
  }, [fileFilter, refreshAllTags]);

  if (viewMode === "settings") return null;

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-neutral-800 px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:px-4 sm:py-2 [&::-webkit-scrollbar]:hidden">
      <label className="flex items-center gap-1 text-caption text-neutral-500">
        並び
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        >
          {(Object.keys(SORT_LABELS) as SortField[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        >
          <option value="asc">昇順</option>
          <option value="desc">降順</option>
        </select>
      </label>

      <label className="flex items-center gap-1 text-caption text-neutral-500">
        表示
        <select
          value={fileFilter}
          onChange={(e) => {
            const value = e.target.value as FileFilter;
            setFileFilter(value);
            if (value !== "tag") setFilterTagId(null);
          }}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        >
          {(Object.keys(FILTER_LABELS) as FileFilter[]).map((key) => (
            <option key={key} value={key}>
              {FILTER_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      {fileFilter === "tag" && (
        <select
          value={filterTagId ?? ""}
          onChange={(e) => setFilterTagId(e.target.value || null)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-caption text-neutral-200"
        >
          <option value="">
            {allTags.length === 0 ? "タグがありません" : "タグを選択"}
          </option>
          {allTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      )}

      {layoutMode === "grid" && <GridSizeControl variant="desktop" />}

      <div className="ml-auto flex shrink-0 gap-1">
        {(Object.keys(LAYOUT_LABELS) as LayoutMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setLayoutMode(mode)}
            className={[
              "rounded border px-2 py-1 text-caption",
              layoutMode === mode
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : "border-neutral-700 text-neutral-400 hover:bg-neutral-800",
            ].join(" ")}
          >
            {LAYOUT_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
