export type FileKind =
  | "directory"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "pdf"
  | "archive"
  | "unknown";

export type FileEntry = {
  id: string;
  parentId?: string | null;
  absolutePath: string;
  displayName: string;
  extension?: string | null;
  mimeType?: string | null;
  fileKind: FileKind;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  createdAt?: string | null;
  modifiedAt?: string | null;
  indexedAt?: string | null;
  contentHash?: string | null;
  isDirectory: boolean;
  isHidden: boolean;
  isFavorite: boolean;
  isDeleted: boolean;
  thumbnailPath?: string | null;
  tagIds?: string[];
};

export type SpecialPaths = {
  home: string;
  desktop: string;
  downloads: string;
  pictures: string;
  aiLibrary: string;
  novelAi?: string | null;
};

export type ScanResult = {
  scannedCount: number;
  imageCount: number;
  errorCount: number;
};

export type ImportResult = {
  importedCount: number;
  imageCount: number;
  zipCount: number;
  errorCount: number;
};

export type ViewMode = "browse" | "search" | "favorites" | "ai-library" | "settings";

export type SortField = "name" | "modified" | "size" | "kind";
export type SortOrder = "asc" | "desc";
export type FileFilter = "all" | "images" | "favorites" | "tag";
export type LayoutMode = "grid" | "list";
export type SearchScope = "global" | "folder";

export type Bookmark = {
  id: string;
  label: string;
  path: string;
};

export type RecentFolder = {
  path: string;
  label: string;
  visitedAt: string;
};
