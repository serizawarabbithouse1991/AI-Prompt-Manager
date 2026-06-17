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
  aiModel?: string | null;
  aiSteps?: number | null;
  promptPreview?: string | null;
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
  skippedCount?: number;
  novelaiCount?: number;
  duplicateCount?: number;
  assignedCollectionCount?: number;
};

export type ImportProgress = {
  current: number;
  total: number;
  message: string;
  phase?: "export" | "import";
  novelaiCount?: number;
  skippedCount?: number;
  etaSeconds?: number | null;
};

export type ViewMode =
  | "browse"
  | "search"
  | "favorites"
  | "ai-library"
  | "collections"
  | "duplicates"
  | "settings";

export type SortField = "name" | "modified" | "size" | "kind";
export type SortOrder = "asc" | "desc";
export type FileFilter = "all" | "images" | "favorites" | "tag";
export type LayoutMode = "grid" | "list";
export type SearchScope = "global" | "folder";

/** グリッド密度プリセット（列数は gridUtils で解決） */
export type GridDensity = "xs" | "sm" | "md" | "lg" | "xl";

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

export type Collection = {
  id: string;
  name: string;
  description?: string | null;
  kind: string;
  createdAt?: string | null;
  fileCount: number;
  matchKeywords?: string[];
};

export type SmartCollection = Collection & {
  kind: "smart_character";
  matchKeywords: string[];
};

export type CharacterSuggestion = {
  tag: string;
  hitCount: number;
  lastSeenAt?: string | null;
};

export type BatchAssignResult = {
  filesProcessed: number;
  assignmentsAdded: number;
  suggestionsUpdated: number;
};

export type DanbooruIndexStatus = {
  dbPath?: string | null;
  dbExists: boolean;
  cacheCount: number;
  cacheBuiltAt?: string | null;
  cacheReady: boolean;
};

export type RebuildDanbooruCacheResult = {
  cacheCount: number;
  dbPath: string;
};

export type SearchFilters = {
  sourceApp?: string | null;
  model?: string | null;
  limit?: number;
  offset?: number;
};

export type BackfillResult = {
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
};

/** 将来の同期 API 用（未実装） */
export type RemoteSyncConfig = {
  remoteObjectPath?: string | null;
  enabled?: boolean;
};
