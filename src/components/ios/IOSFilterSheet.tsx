import { useFileStore } from "@/features/files/store";
import {
  FILTER_LABELS,
  LAYOUT_LABELS,
  SORT_LABELS,
} from "@/features/files/viewUtils";
import type { FileFilter, LayoutMode, SortField } from "@/features/files/types";
import { IOSSheet } from "@/components/ios/IOSSheet";
import { IOSListRow } from "@/components/ios/IOSGroupedList";
import { GridSizeControl } from "@/components/file/GridSizeControl";

type IOSFilterSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function IOSFilterSheet({ open, onClose }: IOSFilterSheetProps) {
  const sortField = useFileStore((s) => s.sortField);
  const sortOrder = useFileStore((s) => s.sortOrder);
  const fileFilter = useFileStore((s) => s.fileFilter);
  const filterTagId = useFileStore((s) => s.filterTagId);
  const layoutMode = useFileStore((s) => s.layoutMode);
  const allTags = useFileStore((s) => s.allTags);
  const setSortField = useFileStore((s) => s.setSortField);
  const setSortOrder = useFileStore((s) => s.setSortOrder);
  const setFileFilter = useFileStore((s) => s.setFileFilter);
  const setFilterTagId = useFileStore((s) => s.setFilterTagId);
  const setLayoutMode = useFileStore((s) => s.setLayoutMode);

  return (
    <IOSSheet open={open} onClose={onClose} title="表示オプション" tall>
      <div className="space-y-6 p-4">
        <section>
          <h3 className="ios-section-header mb-2 px-1 text-xs uppercase text-neutral-500">並び替え</h3>
          <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
            {(Object.keys(SORT_LABELS) as SortField[]).map((key) => (
              <IOSListRow
                key={key}
                label={SORT_LABELS[key]}
                onPress={() => setSortField(key)}
                trailing={sortField === key ? <span className="text-blue-400">✓</span> : null}
              />
            ))}
          </div>
          <div className="mt-2 overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
            <IOSListRow
              label="昇順"
              onPress={() => setSortOrder("asc")}
              trailing={sortOrder === "asc" ? <span className="text-blue-400">✓</span> : null}
            />
            <IOSListRow
              label="降順"
              onPress={() => setSortOrder("desc")}
              trailing={sortOrder === "desc" ? <span className="text-blue-400">✓</span> : null}
            />
          </div>
        </section>

        <section>
          <h3 className="ios-section-header mb-2 px-1 text-xs uppercase text-neutral-500">フィルタ</h3>
          <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
            {(Object.keys(FILTER_LABELS) as FileFilter[]).map((key) => (
              <IOSListRow
                key={key}
                label={FILTER_LABELS[key]}
                onPress={() => {
                  setFileFilter(key);
                  if (key !== "tag") setFilterTagId(null);
                }}
                trailing={fileFilter === key ? <span className="text-blue-400">✓</span> : null}
              />
            ))}
          </div>
          {fileFilter === "tag" && allTags.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
              {allTags.map((tag) => (
                <IOSListRow
                  key={tag.id}
                  label={tag.name}
                  onPress={() => setFilterTagId(tag.id)}
                  trailing={filterTagId === tag.id ? <span className="text-blue-400">✓</span> : null}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="ios-section-header mb-2 px-1 text-xs uppercase text-neutral-500">レイアウト</h3>
          <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
            {(Object.keys(LAYOUT_LABELS) as LayoutMode[]).map((mode) => (
              <IOSListRow
                key={mode}
                label={LAYOUT_LABELS[mode]}
                onPress={() => setLayoutMode(mode)}
                trailing={layoutMode === mode ? <span className="text-blue-400">✓</span> : null}
              />
            ))}
          </div>
        </section>

        {layoutMode === "grid" && (
          <section>
            <h3 className="ios-section-header mb-2 px-1 text-xs uppercase text-neutral-500">グリッド密度</h3>
            <GridSizeControl variant="ios-list" />
          </section>
        )}
      </div>
    </IOSSheet>
  );
}
