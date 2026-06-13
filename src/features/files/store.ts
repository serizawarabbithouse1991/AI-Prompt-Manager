import { create } from "zustand";
import type { FileEntry, SpecialPaths, ViewMode } from "@/features/files/types";
import type { AIGenerationMetadata } from "@/features/metadata/types";
import type { Tag } from "@/features/tags/types";
import {
  getSpecialPaths,
  listAiLibrary,
  listDirectory,
  listFavorites,
  searchFiles,
} from "@/lib/tauri";
import { getPlatform, isMobilePlatform } from "@/lib/platform";

type FileStore = {
  specialPaths: SpecialPaths | null;
  currentPath: string;
  files: FileEntry[];
  selectedFileId: string | null;
  selectedFile: FileEntry | null;
  viewMode: ViewMode;
  searchQuery: string;
  history: string[];
  historyIndex: number;
  loading: boolean;
  error: string | null;
  scanning: boolean;
  scanProgress: string | null;
  metadata: AIGenerationMetadata | null;
  tags: Tag[];
  allTags: Tag[];
  inspectorOpen: boolean;
  platformName: string;
  setPlatformName: (name: string) => void;
  setInspectorOpen: (open: boolean) => void;
  initialize: () => Promise<void>;
  loadDirectory: (path: string) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  goUp: () => Promise<void>;
  selectFile: (fileId: string | null) => void;
  setViewMode: (mode: ViewMode) => Promise<void>;
  runSearch: (query: string) => Promise<void>;
  setScanProgress: (message: string | null) => void;
  setScanning: (scanning: boolean) => void;
  refresh: () => Promise<void>;
  setMetadata: (metadata: AIGenerationMetadata | null) => void;
  setTags: (tags: Tag[]) => void;
  setAllTags: (tags: Tag[]) => void;
  updateFileThumbnail: (fileId: string, thumbnailPath: string) => void;
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
  selectedFile: null,
  viewMode: "browse",
  searchQuery: "",
  history: [],
  historyIndex: -1,
  loading: false,
  error: null,
  scanning: false,
  scanProgress: null,
  metadata: null,
  tags: [],
  allTags: [],
  inspectorOpen: false,
  platformName: "unknown",
  setPlatformName: (name) => set({ platformName: name }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setScanProgress: (message) => set({ scanProgress: message }),
  setScanning: (scanning) => set({ scanning }),
  setMetadata: (metadata) => set({ metadata }),
  setTags: (tags) => set({ tags }),
  setAllTags: (tags) => set({ allTags: tags }),

  updateFileThumbnail: (fileId, thumbnailPath) => {
    set((state) => {
      const files = state.files.map((f) =>
        f.id === fileId ? { ...f, thumbnailPath } : f,
      );
      const selectedFile =
        state.selectedFileId === fileId ? findFile(files, fileId) : state.selectedFile;
      return { files, selectedFile };
    });
  },

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const [specialPaths, platformName] = await Promise.all([
        getSpecialPaths(),
        getPlatform(),
      ]);
      set({ specialPaths, platformName });
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
    });
    await get().loadDirectory(path);
  },

  goBack: async () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({ historyIndex: newIndex, viewMode: "browse", searchQuery: "" });
    await get().loadDirectory(history[newIndex]);
  },

  goForward: async () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ historyIndex: newIndex, viewMode: "browse", searchQuery: "" });
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

  selectFile: (fileId) => {
    const file = findFile(get().files, fileId);
    set({
      selectedFileId: fileId,
      selectedFile: file,
      metadata: null,
      tags: [],
      inspectorOpen: fileId !== null,
    });
  },

  setViewMode: async (mode) => {
    set({ viewMode: mode, loading: true, error: null });
    try {
      if (mode === "favorites") {
        const files = await listFavorites();
        set({ files, loading: false, selectedFileId: null, selectedFile: null });
        return;
      }
      if (mode === "ai-library") {
        const files = await listAiLibrary();
        set({ files, loading: false, selectedFileId: null, selectedFile: null });
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
    set({ loading: true, error: null, searchQuery: query, viewMode: "search" });
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
    const { viewMode, searchQuery, currentPath } = get();
    if (viewMode === "search" && searchQuery) {
      await get().runSearch(searchQuery);
    } else if (viewMode === "favorites") {
      await get().setViewMode("favorites");
    } else if (viewMode === "ai-library") {
      await get().setViewMode("ai-library");
    } else if (currentPath) {
      await get().loadDirectory(currentPath);
    }
  },
}));
