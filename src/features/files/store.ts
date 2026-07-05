import { create } from "zustand";
import type {
  Bookmark,
  Collection,
  FileEntry,
  FileFilter,
  GridDensity,
  LayoutMode,
  ImportProgress,
  RecentFolder,
  SearchScope,
  SortField,
  SortOrder,
  SpecialPaths,
  ViewMode,
} from "@/features/files/types";
import type { AIGenerationMetadata } from "@/features/metadata/types";
import type { Tag } from "@/features/tags/types";
import { parseTagSearchQuery } from "@/features/files/searchQuery";
import { filterFilesByQuery, getDisplayFiles } from "@/features/files/viewUtils";
import {
  getSpecialPaths,
  listAiLibrary,
  listCollectionFiles,
  listDirectory,
  listDuplicateFiles,
  listFavorites,
  listTags,
  searchFiles,
} from "@/lib/tauri";
import { getPlatform, isIOSPlatform, isMobilePlatform } from "@/lib/platform";
import { getDefaultBrowsePath, isNovelAiPath } from "@/lib/browsePaths";
import { loadAutoPhotoScanEnabled } from "@/lib/photoScanPrefs";
import { formatPhotoScanResult, runPhotoLibraryScan } from "@/lib/photoScan";
import {
  applyGridColumnsCss,
  clampGridColumns,
  getDefaultGridColumns,
  GRID_DENSITY_COLUMNS,
} from "@/lib/gridUtils";

const BOOKMARKS_KEY = "ai-fm-bookmarks";
const RECENT_FOLDERS_KEY = "ai-fm-recent-folders";
const VIEW_PREFS_KEY = "ai-fm-view-prefs";

type ViewPrefs = {
  sortField: SortField;
  sortOrder: SortOrder;
  fileFilter: FileFilter;
  filterTagId: string | null;
  layoutMode: LayoutMode;
  searchScope: SearchScope;
  searchTagId: string | null;
  gridColumns: number;
};

function loadViewPrefs(): Partial<ViewPrefs> {
  try {
    const raw = localStorage.getItem(VIEW_PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<ViewPrefs>;
  } catch {
    return {};
  }
}

function saveViewPrefs(prefs: ViewPrefs) {
  localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(prefs));
}

function loadRecentFolders(): RecentFolder[] {
  try {
    const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentFolder[];
  } catch {
    return [];
  }
}

function saveRecentFolders(folders: RecentFolder[]) {
  localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(folders));
}

function pushRecentFolder(path: string, existing: RecentFolder[]): RecentFolder[] {
  const label = path.split(/[/\\]/).filter(Boolean).pop() ?? path;
  const next = [
    { path, label, visitedAt: new Date().toISOString() },
    ...existing.filter((f) => f.path !== path),
  ].slice(0, 8);
  saveRecentFolders(next);
  return next;
}

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Bookmark[];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

type FileStore = {
  specialPaths: SpecialPaths | null;
  currentPath: string;
  files: FileEntry[];
  selectedFileId: string | null;
  selectedFileIds: string[];
  selectionMode: boolean;
  selectedFile: FileEntry | null;
  viewMode: ViewMode;
  searchQuery: string;
  history: string[];
  historyIndex: number;
  loading: boolean;
  error: string | null;
  scanning: boolean;
  scanProgress: string | null;
  batchProgress: string | null;
  importProgress: ImportProgress | null;
  photoScanRunning: boolean;
  metadata: AIGenerationMetadata | null;
  tags: Tag[];
  allTags: Tag[];
  inspectorOpen: boolean;
  platformName: string;
  sortField: SortField;
  sortOrder: SortOrder;
  fileFilter: FileFilter;
  filterTagId: string | null;
  layoutMode: LayoutMode;
  lightboxFileId: string | null;
  searchScope: SearchScope;
  searchSourceApp: string;
  searchModel: string;
  searchTagId: string | null;
  selectedCollectionId: string | null;
  collections: Collection[];
  searchHasMore: boolean;
  searchLoadingMore: boolean;
  bookmarks: Bookmark[];
  recentFolders: RecentFolder[];
  setPlatformName: (name: string) => void;
  setInspectorOpen: (open: boolean) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  setFileFilter: (filter: FileFilter) => void;
  setFilterTagId: (tagId: string | null) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setSearchScope: (scope: SearchScope) => void;
  setSearchSourceApp: (value: string) => void;
  setSearchModel: (value: string) => void;
  setSearchTagId: (tagId: string | null) => void;
  setSelectedCollectionId: (id: string | null) => void;
  setCollections: (collections: Collection[]) => void;
  setLightboxFileId: (fileId: string | null) => void;
  getDisplayFiles: () => FileEntry[];
  initialize: () => Promise<void>;
  loadDirectory: (path: string) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  goUp: () => Promise<void>;
  selectFile: (
    fileId: string | null,
    additive?: boolean,
    options?: { openInspector?: boolean },
  ) => void;
  toggleFileSelection: (fileId: string) => void;
  clearSelection: () => void;
  enterSelectionMode: (fileId: string) => void;
  exitSelectionMode: () => void;
  setViewMode: (mode: ViewMode) => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  loadMoreSearch: () => Promise<void>;
  setScanProgress: (message: string | null) => void;
  setBatchProgress: (message: string | null) => void;
  setImportProgress: (progress: ImportProgress | null) => void;
  setScanning: (scanning: boolean) => void;
  runAutoPhotoScanIfEnabled: () => Promise<void>;
  prependImportedFiles: (incoming: FileEntry[]) => void;
  refreshAiLibraryQuiet: () => Promise<void>;
  refresh: () => Promise<void>;
  setMetadata: (metadata: AIGenerationMetadata | null) => void;
  setTags: (tags: Tag[]) => void;
  setAllTags: (tags: Tag[]) => void;
  refreshAllTags: () => Promise<void>;
  updateFileThumbnail: (fileId: string, thumbnailPath: string) => void;
  updateFileInList: (file: FileEntry) => void;
  removeFilesFromList: (fileIds: string[]) => void;
  addBookmark: (label: string, path: string) => void;
  removeBookmark: (id: string) => void;
  gridColumns: number;
  setGridColumns: (columns: number) => void;
  setGridDensity: (density: GridDensity) => void;
};

function getViewPrefsFromState(s: FileStore): ViewPrefs {
  return {
    sortField: s.sortField,
    sortOrder: s.sortOrder,
    fileFilter: s.fileFilter,
    filterTagId: s.filterTagId,
    layoutMode: s.layoutMode,
    searchScope: s.searchScope,
    searchTagId: s.searchTagId,
    gridColumns: s.gridColumns,
  };
}

function findFile(files: FileEntry[], id: string | null): FileEntry | null {
  if (!id) return null;
  return files.find((f) => f.id === id) ?? null;
}

const initialViewPrefs = loadViewPrefs();
const initialGridColumns = initialViewPrefs.gridColumns ?? getDefaultGridColumns(false);
applyGridColumnsCss(initialGridColumns);

export const useFileStore = create<FileStore>((set, get) => ({
  specialPaths: null,
  currentPath: "",
  files: [],
  selectedFileId: null,
  selectedFileIds: [],
  selectionMode: false,
  selectedFile: null,
  viewMode: "browse",
  searchQuery: "",
  history: [],
  historyIndex: -1,
  loading: false,
  error: null,
  scanning: false,
  scanProgress: null,
  batchProgress: null,
  importProgress: null,
  photoScanRunning: false,
  metadata: null,
  tags: [],
  allTags: [],
  inspectorOpen: false,
  platformName: "unknown",
  sortField: initialViewPrefs.sortField ?? "name",
  sortOrder: initialViewPrefs.sortOrder ?? "asc",
  fileFilter: initialViewPrefs.fileFilter ?? "all",
  filterTagId: initialViewPrefs.filterTagId ?? null,
  layoutMode: initialViewPrefs.layoutMode ?? "grid",
  searchScope: initialViewPrefs.searchScope ?? "global",
  lightboxFileId: null,
  searchSourceApp: "",
  searchModel: "",
  searchTagId: initialViewPrefs.searchTagId ?? null,
  selectedCollectionId: null,
  collections: [],
  searchHasMore: false,
  searchLoadingMore: false,
  bookmarks: loadBookmarks(),
  recentFolders: loadRecentFolders(),
  gridColumns: initialGridColumns,
  setPlatformName: (name) => {
    const isMobile = isMobilePlatform(name);
    const savedCols = loadViewPrefs().gridColumns;
    const base = savedCols != null ? get().gridColumns : getDefaultGridColumns(isMobile);
    const clamped = clampGridColumns(base, isMobile);
    applyGridColumnsCss(clamped);
    set({ platformName: name, gridColumns: clamped });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setSortField: (field) => {
    set({ sortField: field });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setSortOrder: (order) => {
    set({ sortOrder: order });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setFileFilter: (filter) => {
    set({ fileFilter: filter });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setFilterTagId: (tagId) => {
    set({ filterTagId: tagId });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setLayoutMode: (mode) => {
    set({ layoutMode: mode });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setGridColumns: (columns) => {
    const clamped = clampGridColumns(columns, isMobilePlatform(get().platformName));
    applyGridColumnsCss(clamped);
    set({ gridColumns: clamped });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setGridDensity: (density) => {
    const cols = GRID_DENSITY_COLUMNS[density];
    get().setGridColumns(cols);
  },
  setSearchScope: (scope) => {
    set({ searchScope: scope });
    saveViewPrefs(getViewPrefsFromState(get()));
  },
  setSearchSourceApp: (value) => {
    set({ searchSourceApp: value });
    const { viewMode, searchQuery, searchTagId } = get();
    if (viewMode === "search" && (searchQuery || searchTagId)) {
      void get().runSearch(searchQuery);
    }
  },
  setSearchModel: (value) => {
    set({ searchModel: value });
    const { viewMode, searchQuery, searchTagId } = get();
    if (viewMode === "search" && (searchQuery || searchTagId)) {
      void get().runSearch(searchQuery);
    }
  },
  setSearchTagId: (tagId) => {
    set({ searchTagId: tagId });
    saveViewPrefs(getViewPrefsFromState(get()));
    if (tagId) {
      void get().runSearch(get().searchQuery);
      return;
    }
    const { viewMode, searchQuery } = get();
    if (viewMode === "search" && searchQuery.trim()) {
      void get().runSearch(searchQuery);
    } else if (viewMode === "search") {
      void get().setViewMode("browse");
    }
  },
  setSelectedCollectionId: (id) => set({ selectedCollectionId: id }),
  setCollections: (collections) => set({ collections }),
  setLightboxFileId: (fileId) => set({ lightboxFileId: fileId }),
  setScanProgress: (message) => set({ scanProgress: message }),
  setBatchProgress: (message) => set({ batchProgress: message }),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setScanning: (scanning) => set({ scanning }),

  runAutoPhotoScanIfEnabled: async () => {
    const { platformName, photoScanRunning } = get();
    if (!isIOSPlatform(platformName) || !loadAutoPhotoScanEnabled() || photoScanRunning) {
      return;
    }

    set({
      photoScanRunning: true,
      scanning: true,
      scanProgress: "新しい写真を自動スキャン中…",
      batchProgress: "準備中…",
      importProgress: null,
    });

    try {
      const result = await runPhotoLibraryScan(true);
      const message = formatPhotoScanResult(result);
      set({ scanProgress: message, batchProgress: null });
      if ((result.novelaiCount ?? result.importedCount) > 0) {
        const { viewMode } = get();
        if (viewMode !== "ai-library") {
          await get().setViewMode("ai-library");
        }
      }
    } catch (e) {
      set({ scanProgress: String(e) });
    } finally {
      set({ photoScanRunning: false, scanning: false, importProgress: null });
    }
  },

  refreshAiLibraryQuiet: async () => {
    const { viewMode, selectedFileId, metadata, tags, inspectorOpen } = get();
    if (viewMode !== "ai-library") return;
    try {
      const files = await listAiLibrary();
      const selectedFile = findFile(files, selectedFileId);
      set({
        files,
        selectedFileId: selectedFile ? selectedFileId : null,
        selectedFile,
        metadata: selectedFile ? metadata : null,
        tags: selectedFile ? tags : [],
        inspectorOpen: selectedFile ? inspectorOpen : false,
      });
    } catch {
      // バックグラウンドスキャン中の一時エラーは無視
    }
  },

  prependImportedFiles: (incoming) => {
    if (incoming.length === 0) return;
    set((state) => {
      if (state.viewMode !== "ai-library") return state;
      const existingIds = new Set(state.files.map((file) => file.id));
      const fresh = incoming.filter((file) => !existingIds.has(file.id));
      if (fresh.length === 0) return state;
      return { files: [...fresh, ...state.files] };
    });
  },

  setMetadata: (metadata) => set({ metadata }),
  setTags: (tags) => set({ tags }),
  setAllTags: (tags) => set({ allTags: tags }),
  refreshAllTags: async () => {
    try {
      const tags = await listTags();
      set({ allTags: tags });
    } catch {
      set({ allTags: [] });
    }
  },

  getDisplayFiles: () => {
    const { files, sortField, sortOrder, fileFilter, filterTagId } = get();
    return getDisplayFiles(files, sortField, sortOrder, fileFilter, filterTagId);
  },

  updateFileThumbnail: (fileId, thumbnailPath) => {
    set((state) => {
      const files = state.files.map((f) =>
        f.id === fileId ? { ...f, thumbnailPath } : f,
      );
      const selectedFile =
        state.selectedFileId === fileId && state.selectedFile
          ? { ...state.selectedFile, thumbnailPath }
          : state.selectedFile;
      return { files, selectedFile };
    });
  },

  updateFileInList: (file) => {
    set((state) => {
      const files = state.files.map((f) => (f.id === file.id ? file : f));
      const selectedFile = state.selectedFileId === file.id ? file : state.selectedFile;
      return { files, selectedFile };
    });
  },

  removeFilesFromList: (fileIds) => {
    const idSet = new Set(fileIds);
    set((state) => ({
      files: state.files.filter((f) => !idSet.has(f.id)),
      selectedFileId: idSet.has(state.selectedFileId ?? "") ? null : state.selectedFileId,
      selectedFile: idSet.has(state.selectedFileId ?? "") ? null : state.selectedFile,
      selectedFileIds: state.selectedFileIds.filter((id) => !idSet.has(id)),
      selectionMode: state.selectedFileIds.filter((id) => !idSet.has(id)).length > 0,
    }));
  },

  addBookmark: (label, path) => {
    const bookmark: Bookmark = { id: crypto.randomUUID(), label, path };
    const bookmarks = [...get().bookmarks, bookmark];
    saveBookmarks(bookmarks);
    set({ bookmarks });
  },

  removeBookmark: (id) => {
    const bookmarks = get().bookmarks.filter((b) => b.id !== id);
    saveBookmarks(bookmarks);
    set({ bookmarks });
  },

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const [specialPaths, platformName, allTags] = await Promise.all([
        getSpecialPaths(),
        getPlatform(),
        listTags().catch(() => []),
      ]);
      set({ specialPaths, platformName, allTags });
      if (isMobilePlatform(platformName)) {
        await get().setViewMode("ai-library");
      } else {
        const startPath = getDefaultBrowsePath(specialPaths, platformName);
        if (isNovelAiPath(startPath, specialPaths)) {
          set({ fileFilter: "images" });
          saveViewPrefs(getViewPrefsFromState(get()));
        }
        await get().navigateTo(startPath);
      }
      set({ loading: false });
      void get().runAutoPhotoScanIfEnabled();
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadDirectory: async (path: string) => {
    const { selectedFileId, metadata, tags, inspectorOpen, fileFilter, specialPaths } = get();
    set({ loading: true, error: null });
    try {
      const imagesOnly =
        fileFilter === "images" || isNovelAiPath(path, specialPaths);
      const files = await listDirectory(path, imagesOnly);
      const selectedFile = findFile(files, selectedFileId);
      set({
        currentPath: path,
        files,
        loading: false,
        selectedFileId: selectedFile ? selectedFileId : null,
        selectedFile,
        metadata: selectedFile ? metadata : null,
        tags: selectedFile ? tags : [],
        inspectorOpen: selectedFile ? inspectorOpen : false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  navigateTo: async (path: string) => {
    const { history, historyIndex, recentFolders, specialPaths } = get();
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(path);
    const updates: Partial<FileStore> = {
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
      viewMode: "browse",
      searchQuery: "",
      selectedFileIds: [],
      selectionMode: false,
      recentFolders: pushRecentFolder(path, recentFolders),
    };
    if (isNovelAiPath(path, specialPaths)) {
      updates.fileFilter = "images";
    }
    set(updates);
    if (isNovelAiPath(path, specialPaths)) {
      saveViewPrefs(getViewPrefsFromState(get()));
    }
    await get().loadDirectory(path);
  },

  goBack: async () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({ historyIndex: newIndex, viewMode: "browse", searchQuery: "", selectedFileIds: [], selectionMode: false });
    await get().loadDirectory(history[newIndex]);
  },

  goForward: async () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ historyIndex: newIndex, viewMode: "browse", searchQuery: "", selectedFileIds: [], selectionMode: false });
    await get().loadDirectory(history[newIndex]);
  },

  goUp: async () => {
    const { currentPath } = get();
    const normalized = currentPath.replace(/[/\\]+$/, "");
    const sep = normalized.includes("\\") ? "\\" : "/";
    const parts = normalized.split(sep);
    if (parts.length <= 1) return;
    parts.pop();
    const parent = parts.join(sep) || sep;
    await get().navigateTo(parent);
  },

  selectFile: (fileId, additive = false, options) => {
    if (additive && fileId) {
      get().toggleFileSelection(fileId);
      return;
    }
    const file = findFile(get().files, fileId);
    const openInspector = options?.openInspector ?? fileId !== null;
    set({
      selectedFileId: fileId,
      selectedFileIds: fileId ? [fileId] : [],
      selectionMode: false,
      selectedFile: file,
      metadata: null,
      tags: [],
      inspectorOpen: fileId !== null && openInspector,
    });
  },

  toggleFileSelection: (fileId) => {
    set((state) => {
      const ids = state.selectedFileIds.includes(fileId)
        ? state.selectedFileIds.filter((id) => id !== fileId)
        : [...state.selectedFileIds, fileId];
      const primaryId = ids[0] ?? null;
      const selectedFile = findFile(state.files, primaryId);
      return {
        selectedFileIds: ids,
        selectionMode: ids.length > 0,
        selectedFileId: primaryId,
        selectedFile,
        inspectorOpen: ids.length === 1,
        metadata: ids.length === 1 ? null : state.metadata,
        tags: ids.length === 1 ? [] : state.tags,
      };
    });
  },

  clearSelection: () => {
    set({
      selectedFileIds: [],
      selectionMode: false,
      selectedFileId: null,
      selectedFile: null,
      inspectorOpen: false,
      metadata: null,
      tags: [],
    });
  },

  enterSelectionMode: (fileId) => {
    const file = findFile(get().files, fileId);
    set({
      selectedFileIds: [fileId],
      selectionMode: true,
      selectedFileId: fileId,
      selectedFile: file,
      inspectorOpen: false,
      metadata: null,
      tags: [],
    });
  },

  exitSelectionMode: () => {
    get().clearSelection();
  },

  setViewMode: async (mode) => {
    const { selectedFileId, metadata, tags } = get();
    set({
      viewMode: mode,
      loading: true,
      error: null,
      selectedFileIds: [],
      selectionMode: false,
      inspectorOpen: false,
      lightboxFileId: null,
    });
    try {
      if (mode === "favorites") {
        const files = await listFavorites();
        const selectedFile = findFile(files, selectedFileId);
        set({
          files,
          loading: false,
          selectedFileId: selectedFile ? selectedFileId : null,
          selectedFile,
          metadata: selectedFile ? metadata : null,
          tags: selectedFile ? tags : [],
          inspectorOpen: false,
        });
        return;
      }
      if (mode === "ai-library") {
        const files = await listAiLibrary();
        const selectedFile = findFile(files, selectedFileId);
        set({
          files,
          loading: false,
          selectedFileId: selectedFile ? selectedFileId : null,
          selectedFile,
          metadata: selectedFile ? metadata : null,
          tags: selectedFile ? tags : [],
          inspectorOpen: false,
        });
        return;
      }
      if (mode === "collections") {
        const collectionId = get().selectedCollectionId;
        const files = collectionId ? await listCollectionFiles(collectionId) : [];
        set({
          files,
          loading: false,
          selectedFileId: null,
          selectedFile: null,
          metadata: null,
          tags: [],
          inspectorOpen: false,
        });
        return;
      }
      if (mode === "duplicates") {
        const files = await listDuplicateFiles();
        set({
          files,
          loading: false,
          selectedFileId: null,
          selectedFile: null,
          metadata: null,
          tags: [],
          inspectorOpen: false,
        });
        return;
      }
      if (mode === "settings") {
        set({ loading: false, selectedFileId: null, selectedFile: null, inspectorOpen: false });
        return;
      }
      if (mode === "browse") {
        const { currentPath, specialPaths } = get();
        const path = currentPath || specialPaths?.home || "";
        if (path) await get().loadDirectory(path);
        else set({ loading: false });
        return;
      }
      set({ loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  runSearch: async (query: string) => {
    const {
      searchScope,
      viewMode,
      currentPath,
      files,
      searchSourceApp,
      searchModel,
      searchTagId: currentSearchTagId,
      allTags,
    } = get();

    const raw = query.trim();
    const parsed = parseTagSearchQuery(raw, allTags);
    const usesHashSyntax = raw.startsWith("#");
    const effectiveSearchTagId = usesHashSyntax ? parsed.tagId : currentSearchTagId;
    const trimmed = usesHashSyntax
      ? parsed.tagId
        ? parsed.query
        : raw
      : raw;

    if (searchScope === "global" && !trimmed && !effectiveSearchTagId) {
      if (viewMode === "search") {
        await get().setViewMode("browse");
      }
      return;
    }

    if (usesHashSyntax && effectiveSearchTagId !== currentSearchTagId) {
      set({ searchTagId: effectiveSearchTagId });
      saveViewPrefs(getViewPrefsFromState({ ...get(), searchTagId: effectiveSearchTagId }));
    }

    set({
      loading: true,
      error: null,
      searchQuery: trimmed,
      searchTagId: effectiveSearchTagId,
      viewMode: "search",
      selectedFileIds: [],
      selectionMode: false,
      searchHasMore: false,
      searchLoadingMore: false,
    });
    try {
      if (searchScope === "folder") {
        let baseFiles = files;
        if (viewMode === "browse" && currentPath) {
          baseFiles = await listDirectory(currentPath);
        } else if (viewMode === "ai-library") {
          baseFiles = await listAiLibrary();
        } else if (viewMode === "favorites") {
          baseFiles = await listFavorites();
        } else if (viewMode === "collections" && get().selectedCollectionId) {
          baseFiles = await listCollectionFiles(get().selectedCollectionId!);
        }
        let filtered = filterFilesByQuery(baseFiles, trimmed, true, allTags);
        if (effectiveSearchTagId) {
          filtered = filtered.filter((file) => file.tagIds?.includes(effectiveSearchTagId) ?? false);
        }
        set({
          files: filtered,
          loading: false,
          selectedFileId: null,
          selectedFile: null,
        });
        return;
      }

      const results = await searchFiles(trimmed, {
        sourceApp: searchSourceApp || null,
        model: searchModel || null,
        tagId: effectiveSearchTagId || null,
        limit: 50,
        offset: 0,
      });
      set({
        files: results,
        loading: false,
        selectedFileId: null,
        selectedFile: null,
        searchHasMore: results.length >= 50,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadMoreSearch: async () => {
    const {
      searchQuery,
      searchSourceApp,
      searchModel,
      searchTagId,
      files,
      searchHasMore,
      searchLoadingMore,
      searchScope,
    } = get();
    if (searchScope !== "global" || !searchHasMore || searchLoadingMore) return;
    if (!searchQuery && !searchTagId) return;

    set({ searchLoadingMore: true });
    try {
      const results = await searchFiles(searchQuery, {
        sourceApp: searchSourceApp || null,
        model: searchModel || null,
        tagId: searchTagId || null,
        limit: 50,
        offset: files.length,
      });
      set({
        files: [...files, ...results],
        searchHasMore: results.length >= 50,
        searchLoadingMore: false,
      });
    } catch (e) {
      set({ error: String(e), searchLoadingMore: false });
    }
  },

  refresh: async () => {
    const { viewMode, searchQuery, searchTagId, currentPath, selectedFileId, metadata, tags, inspectorOpen } =
      get();
    await get().refreshAllTags();
    if (viewMode === "search" && (searchQuery || searchTagId)) {
      await get().runSearch(searchQuery);
    } else if (viewMode === "favorites") {
      const files = await listFavorites();
      const selectedFile = findFile(files, selectedFileId);
      set({
        files,
        selectedFileId: selectedFile ? selectedFileId : null,
        selectedFile,
        metadata: selectedFile ? metadata : null,
        tags: selectedFile ? tags : [],
        inspectorOpen: selectedFile ? inspectorOpen : false,
      });
    } else if (viewMode === "ai-library") {
      const files = await listAiLibrary();
      const selectedFile = findFile(files, selectedFileId);
      set({
        files,
        selectedFileId: selectedFile ? selectedFileId : null,
        selectedFile,
        metadata: selectedFile ? metadata : null,
        tags: selectedFile ? tags : [],
        inspectorOpen: selectedFile ? inspectorOpen : false,
      });
    } else if (viewMode === "collections" && get().selectedCollectionId) {
      const files = await listCollectionFiles(get().selectedCollectionId!);
      set({ files });
    } else if (viewMode === "duplicates") {
      const files = await listDuplicateFiles();
      set({ files });
    } else if (viewMode === "settings") {
      await get().setViewMode("settings");
    } else if (currentPath) {
      await get().loadDirectory(currentPath);
    }
  },
}));

export function useDisplayFiles(): FileEntry[] {
  const files = useFileStore((s) => s.files);
  const sortField = useFileStore((s) => s.sortField);
  const sortOrder = useFileStore((s) => s.sortOrder);
  const fileFilter = useFileStore((s) => s.fileFilter);
  const filterTagId = useFileStore((s) => s.filterTagId);
  return getDisplayFiles(files, sortField, sortOrder, fileFilter, filterTagId);
}
