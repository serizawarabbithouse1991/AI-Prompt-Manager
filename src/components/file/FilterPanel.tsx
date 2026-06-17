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
  const setSearchSourceApp = useFileStore((s) => s.setSearchSourceApp);
  const setSearchModel = useFileStore((s) => s.setSearchModel);
  const searchScope = useFileStore((s) => s.searchScope);
  const viewMode = useFileStore((s) => s.viewMode);

  if (searchScope !== "global" || viewMode === "settings") return null;

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
    </div>
  );
}
