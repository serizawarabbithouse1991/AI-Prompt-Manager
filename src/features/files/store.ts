import { create } from "zustand";
import type {
  Bookmark,
  FileEntry,
  FileFilter,
  LayoutMode,
  SortField,
  SortOrder,
  SpecialPaths,
  ViewMode,
} from "@/features/files/types";
import type { AIGenerationMetadata } from "@/features/metadata/types";
import type { Tag } from "@/features/tags/types";
import { getDisplayFiles } from "@/features/files/viewUtils";
import {
  getSpecialPaths,
  listAiLibrary,
  listDirectory,
  listFavorites,
  listTags,
  searchFiles,
} from "@/lib/tauri";
import { getPlatform, isMobilePlatform } from "@/lib/platform";

const BOOKMARKS_KEY = "ai-fm-bookmarks";

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
  bookmarks: Bookmark[];
  setPlatformName: (name: string) => void;
  setInspectorOpen: (open: boolean) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  setFileFilter: (filter: FileFilter) => void;
  setFilterTagId: (tagId: string | null) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setLightboxFileId: (fileId: string | null) => void;
  getDisplayFiles: () => FileEntry[];
  initialize: () => Promise<void>;
  loadDirectory: (path: string) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  goUp: () => Promise<void>;
  selectFile: (fileId: string | null, additive?: boolean) => void;
  toggleFileSelection: (fileId: string) => void;
  clearSelection: () => void;
  enterSelectionMode: (fileId: string) => void;
  exitSelectionMode: () => void;
  setViewMode: (mode: ViewMode) => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  setScanProgress: (message: string | null) => void;
  setBatchProgress: (message: string | null) => void;
  setScanning: (scanning: boolean) => void;
  refresh: () => Promise<void>;
  setMetadata: (metadata: AIGenerationMetadata | null) => void;
  setTags: (tags: Tag[]) => void;
  setAllTags: (tags: Tag[]) => void;
  updateFileThumbnail: (fileId: string, thumbnailPath: string) => void;
  updateFileInList: (file: FileEntry) => void;
  removeFilesFromList: (fileIds: string[]) => void;
  addBookmark: (label: string, path: string) => void;
  removeBookmark: (id: string) => void;
};

function findFile(files: FileEntry[], id: string | null): FileEntry | null {
  if (!id) return null;
  return files.find((f) => f.id === id) ?? null;
}

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
  metadata: null,
  tags: [],
  allTags: [],
  inspectorOpen: false,
  platformName: "unknown",
  sortField: "name",
  sortOrder: "asc",
  fileFilter: "all",
  filterTagId: null,
  layoutMode: "grid",
  lightboxFileId: null,
  bookmarks: loadBookmarks(),
  setPlatformName: (name) => set({ platformName: name }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setSortField: (field) => set({ sortField: field }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setFileFilter: (filter) => set({ fileFilter: filter }),
  setFilterTagId: (tagId) => set({ filterTagId: tagId }),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setLightboxFileId: (fileId) => set({ lightboxFileId: fileId }),
  setScanProgress: (message) => set({ scanProgress: message }),
  setBatchProgress: (message) => set({ batchProgress: message }),
  setScanning: (scanning) => set({ scanning }),
  setMetadata: (metadata) => set({ metadata }),
  setTags: (tags) => set({ tags }),
  setAllTags: (tags) => set({ allTags: tags }),

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
        await get().navigateTo(specialPaths.home);
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadDirectory: async (path: string) => {
    const { selectedFileId, metadata, tags, inspectorOpen } = get();
    set({ loading: true, error: null });
    try {
      const files = await listDirectory(path);
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
    const { history, historyIndex } = get();
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(path);
    set({
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
      viewMode: "browse",
      searchQuery: "",
      selectedFileIds: [],
      selectionMode: false,
    });
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

  selectFile: (fileId, additive = false) => {
    if (additive && fileId) {
      get().toggleFileSelection(fileId);
      return;
    }
    const file = findFile(get().files, fileId);
    set({
      selectedFileId: fileId,
      selectedFileIds: fileId ? [fileId] : [],
      selectionMode: false,
      selectedFile: file,
      metadata: null,
      tags: [],
      inspectorOpen: fileId !== null,
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
    const { selectedFileId, metadata, tags, inspectorOpen } = get();
    set({ viewMode: mode, loading: true, error: null, selectedFileIds: [], selectionMode: false });
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
          inspectorOpen: selectedFile ? inspectorOpen : false,
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
          inspectorOpen: selectedFile ? inspectorOpen : false,
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
    set({ loading: true, error: null, searchQuery: query, viewMode: "search", selectedFileIds: [], selectionMode: false });
    try {
      const files = await searchFiles(query);
      set({
        files,
        loading: false,
        selectedFileId: null,
        selectedFile: null,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  refresh: async () => {
    const { viewMode, searchQuery, currentPath, selectedFileId, metadata, tags, inspectorOpen } =
      get();
    if (viewMode === "search" && searchQuery) {
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
