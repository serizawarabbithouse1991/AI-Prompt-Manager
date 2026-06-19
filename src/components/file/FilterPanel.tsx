import { useEffect } from "react";
import { useFileStore } from "@/features/files/store";

const SOURCE_APPS = [
  { value: "", label: "すべて" },
  { value: "novelai", label: "NovelAI" },
  { value: "automatic1111", label: "A1111" },
  { value: "comfyui", label: "ComfyUI" },
];

export function FilterPanel() {
  const searchSourceApp = useFileStore((s) => s.searchSourceApp);
  const searchModel = useFileStore((s) => s.searchModel);
  const searchTagId = useFileStore((s) => s.searchTagId);
  const allTags = useFileStore((s) => s.allTags);
  const setSearchSourceApp = useFileStore((s) => s.setSearchSourceApp);
  const setSearchModel = useFileStore((s) => s.setSearchModel);
  const setSearchTagId = useFileStore((s) => s.setSearchTagId);
  const refreshAllTags = useFileStore((s) => s.refreshAllTags);
  const searchScope = useFileStore((s) => s.searchScope);
  const viewMode = useFileStore((s) => s.viewMode);

  useEffect(() => {
    if (searchScope === "global" && (viewMode === "search" || searchTagId)) {
      void refreshAllTags();
    }
  }, [searchScope, viewMode, searchTagId, refreshAllTags]);

  if (searchScope !== "global" || viewMode === "settings") return null;
  if (viewMode !== "search" && !searchTagId) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-2 py-1.5 sm:px-4">
      <label className="flex items-center gap-1 text-caption text-neutral-500">
        アプリ
        <select
          value={searchSourceApp}
          onChange={(e) => setSearchSourceApp(e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        >
          {SOURCE_APPS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 items-center gap-1 text-caption text-neutral-500 sm:max-w-xs">
        モデル
        <input
          type="search"
          value={searchModel}
          onChange={(e) => setSearchModel(e.target.value)}
          placeholder="モデル名で絞り込み"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        />
      </label>
      <label className="flex items-center gap-1 text-caption text-neutral-500">
        タグ
        <select
          value={searchTagId ?? ""}
          onChange={(e) => setSearchTagId(e.target.value || null)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        >
          <option value="">{allTags.length === 0 ? "タグがありません" : "すべて"}</option>
          {allTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
