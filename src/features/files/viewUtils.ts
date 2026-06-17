import type { FileEntry, FileFilter, LayoutMode, SortField, SortOrder } from "@/features/files/types";

export function filterFilesByQuery(
  files: FileEntry[],
  query: string,
  includeMetadata = false,
): FileEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return files;
  return files.filter(
    (f) =>
      !f.isDirectory &&
      (f.displayName.toLowerCase().includes(q) ||
        (f.extension?.toLowerCase().includes(q) ?? false) ||
        (includeMetadata &&
          ((f.promptPreview?.toLowerCase().includes(q) ?? false) ||
            (f.aiModel?.toLowerCase().includes(q) ?? false)))),
  );
}

export function sortFiles(
  files: FileEntry[],
  field: SortField,
  order: SortOrder,
): FileEntry[] {
  const dirs = files.filter((f) => f.isDirectory);
  const rest = files.filter((f) => !f.isDirectory);

  const compare = (a: FileEntry, b: FileEntry): number => {
    let cmp = 0;
    switch (field) {
      case "name":
        cmp = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
        break;
      case "modified":
        cmp = (a.modifiedAt ?? "").localeCompare(b.modifiedAt ?? "");
        break;
      case "size":
        cmp = a.sizeBytes - b.sizeBytes;
        break;
      case "kind":
        cmp = a.fileKind.localeCompare(b.fileKind);
        break;
    }
    return order === "asc" ? cmp : -cmp;
  };

  dirs.sort(compare);
  rest.sort(compare);
  return [...dirs, ...rest];
}

export function filterFiles(
  files: FileEntry[],
  filter: FileFilter,
  filterTagId: string | null,
): FileEntry[] {
  let result = files;

  if (filter === "images") {
    result = result.filter((f) => f.isDirectory || f.fileKind === "image");
  } else if (filter === "favorites") {
    result = result.filter((f) => f.isDirectory || f.isFavorite);
  } else if (filter === "tag" && filterTagId) {
    result = result.filter(
      (f) => f.isDirectory || (f.tagIds?.includes(filterTagId) ?? false),
    );
  }

  return result;
}

export function getDisplayFiles(
  files: FileEntry[],
  sortField: SortField,
  sortOrder: SortOrder,
  fileFilter: FileFilter,
  filterTagId: string | null,
): FileEntry[] {
  return sortFiles(filterFiles(files, fileFilter, filterTagId), sortField, sortOrder);
}

export function splitPathSegments(path: string): { sep: string; segments: string[] } {
  const normalized = path.replace(/[/\\]+$/, "");
  const sep = normalized.includes("\\") ? "\\" : "/";
  const segments = normalized.split(sep).filter(Boolean);
  return { sep, segments };
}

export function pathFromSegments(segments: string[], sep: string, rootPrefix = ""): string {
  if (segments.length === 0) return rootPrefix || sep;
  const joined = segments.join(sep);
  if (rootPrefix && !joined.startsWith(rootPrefix)) {
    return `${rootPrefix}${sep}${joined}`;
  }
  if (sep === "/" && joined.startsWith("/")) return joined;
  if (sep === "\\" && /^[A-Za-z]:/.test(joined)) return joined;
  return joined;
}

export const SORT_LABELS: Record<SortField, string> = {
  name: "名前",
  modified: "更新日",
  size: "サイズ",
  kind: "種類",
};

export const FILTER_LABELS: Record<FileFilter, string> = {
  all: "すべて",
  images: "画像のみ",
  favorites: "お気に入り",
  tag: "タグ",
};

export const LAYOUT_LABELS: Record<LayoutMode, string> = {
  grid: "グリッド",
  list: "リスト",
};
