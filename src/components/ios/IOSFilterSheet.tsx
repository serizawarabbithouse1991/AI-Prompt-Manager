import { useEffect, useState } from "react";
import { useFileStore } from "@/features/files/store";
import { SEARCH_SOURCE_APPS } from "@/features/files/searchFilters";
import {
  FILTER_LABELS,
  LAYOUT_LABELS,
  SORT_LABELS,
} from "@/features/files/viewUtils";
import type { FileFilter, LayoutMode, SortField } from "@/features/files/types";
import { IOSSheet } from "@/components/ios/IOSSheet";
import { IOSListRow } from "@/components/ios/IOSGroupedList";
import { GridSizeControl } from "@/components/file/GridSizeControl";
import { filterTagsByQuery } from "@/lib/tagPicker";

type IOSFilterSheetProps = {
  open: boolean;
  onClose: () => void;
};

function TagSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mb-2 w-full rounded-[var(--ios-radius-md)] border border-neutral-700 bg-[var(--ios-bg-grouped)] px-3 py-2 text-sm text-neutral-100"
    />
  );
}

export function IOSFilterSheet({ open, onClose }: IOSFilterSheetProps) {
  const sortField = useFileStore((s) => s.sortField);
  const sortOrder = useFileStore((s) => s.sortOrder);
  const fileFilter = useFileStore((s) => s.fileFilter);
  const filterTagId = useFileStore((s) => s.filterTagId);
  const searchTagId = useFileStore((s) => s.searchTagId);
  const searchSourceApp = useFileStore((s) => s.searchSourceApp);
  const searchModel = useFileStore((s) => s.searchModel);
  const searchQuery = useFileStore((s) => s.searchQuery);
  const viewMode = useFileStore((s) => s.viewMode);
  const layoutMode = useFileStore((s) => s.layoutMode);
  const allTags = useFileStore((s) => s.allTags);
  const setSortField = useFileStore((s) => s.setSortField);
  const setSortOrder = useFileStore((s) => s.setSortOrder);
  const setFileFilter = useFileStore((s) => s.setFileFilter);
  const setFilterTagId = useFileStore((s) => s.setFilterTagId);
  const setSearchTagId = useFileStore((s) => s.setSearchTagId);
  const setSearchSourceApp = useFileStore((s) => s.setSearchSourceApp);
  const setSearchModel = useFileStore((s) => s.setSearchModel);
  const runSearch = useFileStore((s) => s.runSearch);
  const refreshAllTags = useFileStore((s) => s.refreshAllTags);
  const setLayoutMode = useFileStore((s) => s.setLayoutMode);
  const [browseTagQuery, setBrowseTagQuery] = useState("");
  const [searchTagQuery, setSearchTagQuery] = useState("");

  const filteredBrowseTags = filterTagsByQuery(allTags, browseTagQuery);
  const filteredSearchTags = filterTagsByQuery(allTags, searchTagQuery);

  useEffect(() => {
    if (!open) {
      setBrowseTagQuery("");
      setSearchTagQuery("");
      return;
    }
    if (fileFilter === "tag" || viewMode === "search" || searchTagId) {
      void refreshAllTags();
    }
  }, [open, fileFilter, viewMode, searchTagId, refreshAllTags]);

  function handleClose() {
    setBrowseTagQuery("");
    setSearchTagQuery("");
    onClose();
  }

  return (
    <IOSSheet open={open} onClose={handleClose} title="表示オプション" tall>
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
          {fileFilter === "tag" && (
            <div className="mt-2">
              <TagSearchInput
                value={browseTagQuery}
                onChange={setBrowseTagQuery}
                placeholder="タグを検索…"
              />
              {allTags.length === 0 ? (
                <p className="px-1 text-sm text-neutral-500">タグがありません</p>
              ) : (
                <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
                  {filteredBrowseTags.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-neutral-500">一致するタグがありません</p>
                  ) : (
                    filteredBrowseTags.map((tag) => (
                      <IOSListRow
                        key={tag.id}
                        label={tag.name}
                        onPress={() => setFilterTagId(tag.id)}
                        trailing={filterTagId === tag.id ? <span className="text-blue-400">✓</span> : null}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {viewMode === "search" && (
          <>
            <section>
              <h3 className="ios-section-header mb-2 px-1 text-xs uppercase text-neutral-500">
                生成アプリ
              </h3>
              <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
                {SEARCH_SOURCE_APPS.map((opt) => (
                  <IOSListRow
                    key={opt.value || "all"}
                    label={opt.label}
                    onPress={() => setSearchSourceApp(opt.value)}
                    trailing={
                      searchSourceApp === opt.value ? (
                        <span className="text-blue-400">✓</span>
                      ) : null
                    }
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="ios-section-header mb-2 px-1 text-xs uppercase text-neutral-500">
                モデル
              </h3>
              <input
                type="search"
                value={searchModel}
                onChange={(e) => setSearchModel(e.target.value)}
                placeholder="モデル名で絞り込み"
                className="w-full rounded-[var(--ios-radius-md)] border border-neutral-700 bg-[var(--ios-bg-grouped)] px-4 py-3 text-base text-neutral-100"
              />
            </section>

            <section>
              <h3 className="ios-section-header mb-2 px-1 text-xs uppercase text-neutral-500">
                検索タグ
              </h3>
              <TagSearchInput
                value={searchTagQuery}
                onChange={setSearchTagQuery}
                placeholder="タグを検索…"
              />
              {allTags.length === 0 ? (
                <p className="px-1 text-sm text-neutral-500">タグがありません</p>
              ) : (
                <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
                  <IOSListRow
                    label="すべて"
                    onPress={() => {
                      setSearchTagId(null);
                      void runSearch(searchQuery);
                    }}
                    trailing={!searchTagId ? <span className="text-blue-400">✓</span> : null}
                  />
                  {filteredSearchTags.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-neutral-500">一致するタグがありません</p>
                  ) : (
                    filteredSearchTags.map((tag) => (
                      <IOSListRow
                        key={tag.id}
                        label={tag.name}
                        onPress={() => {
                          setSearchTagId(tag.id);
                          void runSearch(searchQuery);
                        }}
                        trailing={searchTagId === tag.id ? <span className="text-blue-400">✓</span> : null}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          </>
        )}

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
