import { invoke } from "@tauri-apps/api/core";
import type { AIGenerationMetadata, UpdateMetadataPayload } from "@/features/metadata/types";
import type { Tag } from "@/features/tags/types";
import type {
  BackfillResult,
  BatchAssignResult,
  CharacterSuggestion,
  Collection,
  DanbooruIndexStatus,
  FileEntry,
  ImportProgress,
  ImportResult,
  ScanResult,
  SearchFilters,
  SmartAssignmentDiagnosis,
  DanbooruCacheProgress,
  PromptTagSettings,
  PromptTagMode,
  TagApplyResult,
  BatchTagApplyResult,
  SpecialPaths,
  RebuildDanbooruCacheResult,
} from "@/features/files/types";

export type FileRef = {
  fileId: string;
  absolutePath: string;
};

export async function listDirectory(path: string, imagesOnly = false): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { path, imagesOnly });
}

export async function getSpecialPaths(): Promise<SpecialPaths> {
  return invoke<SpecialPaths>("get_special_paths");
}

export async function scanFolder(path: string, recursive: boolean): Promise<ScanResult> {
  return invoke<ScanResult>("scan_folder", { path, recursive });
}

export async function listAiLibrary(): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_ai_library");
}

export async function importPaths(
  paths: string[],
  options?: { novelaiOnly?: boolean },
): Promise<ImportResult> {
  return invoke<ImportResult>("import_paths", {
    paths,
    novelaiOnly: options?.novelaiOnly ?? false,
  });
}

export async function scanPhotoLibraryNovelai(
  incremental = true,
  options?: { pngOnly?: boolean },
): Promise<ImportResult> {
  return invoke<ImportResult>("scan_photo_library_novelai", {
    incremental,
    pngOnly: options?.pngOnly ?? true,
  });
}

export async function cancelPhotoLibraryScan(): Promise<void> {
  return invoke("cancel_photo_library_scan");
}

export type { ImportProgress };

export async function pickImportFolder(): Promise<string | null> {
  return invoke<string | null>("pick_import_folder");
}

export async function pickImportItems(): Promise<string[]> {
  return invoke<string[]>("pick_import_items");
}

export async function pickImportPhotos(): Promise<string[]> {
  return invoke<string[]>("pick_import_photos");
}

export async function importFromSaf(uri: string): Promise<FileEntry> {
  return invoke<FileEntry>("import_from_saf", { uri });
}

export async function extractMetadata(path: string): Promise<AIGenerationMetadata | null> {
  return invoke<AIGenerationMetadata | null>("extract_metadata", { path });
}

export async function getMetadata(fileId: string): Promise<AIGenerationMetadata | null> {
  return invoke<AIGenerationMetadata | null>("get_metadata", { fileId });
}

export async function updateMetadata(
  fileId: string,
  payload: UpdateMetadataPayload,
): Promise<void> {
  return invoke("update_metadata", { fileId, payload });
}

export async function generateThumbnail(path: string, size: number): Promise<string> {
  return invoke<string>("generate_thumbnail", { path, size });
}

export async function getThumbnail(fileId: string, size: number): Promise<string | null> {
  return invoke<string | null>("get_thumbnail", { fileId, size });
}

export async function listTags(): Promise<Tag[]> {
  return invoke<Tag[]>("list_tags");
}

export async function createTag(name: string, color?: string | null): Promise<Tag> {
  return invoke<Tag>("create_tag", { name, color: color ?? null });
}

export async function addTagToFile(
  fileId: string,
  tagId: string,
  absolutePath?: string | null,
): Promise<void> {
  return invoke("add_tag_to_file", {
    fileId,
    tagId,
    absolutePath: absolutePath ?? null,
  });
}

export async function removeTagFromFile(fileId: string, tagId: string): Promise<void> {
  return invoke("remove_tag_from_file", { fileId, tagId });
}

export async function getFileTags(fileId: string): Promise<Tag[]> {
  return invoke<Tag[]>("get_file_tags", { fileId });
}

export async function setFavorite(
  fileId: string,
  isFavorite: boolean,
  absolutePath?: string | null,
): Promise<void> {
  return invoke("set_favorite", {
    fileId,
    isFavorite,
    absolutePath: absolutePath ?? null,
  });
}

export async function listFavorites(): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_favorites");
}

export async function searchFiles(
  query: string,
  filters?: SearchFilters,
): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("search_files", { query, filters: filters ?? null });
}

export async function renameFile(path: string, newName: string): Promise<FileEntry> {
  return invoke<FileEntry>("rename_file", { path, newName });
}

export async function trashFile(path: string): Promise<void> {
  return invoke("trash_file", { path });
}

export async function revealInFileManager(path: string): Promise<void> {
  return invoke("reveal_in_file_manager", { path });
}

export async function removeFromLibrary(fileId: string): Promise<void> {
  return invoke("remove_from_library", { fileId });
}

export async function copyFile(source: string, destDir: string): Promise<FileEntry> {
  return invoke<FileEntry>("copy_file", { source, destDir });
}

export async function moveFile(source: string, destDir: string): Promise<FileEntry> {
  return invoke<FileEntry>("move_file", { source, destDir });
}

export async function batchSetFavorite(
  files: FileRef[],
  isFavorite: boolean,
): Promise<void> {
  return invoke("batch_set_favorite", { files, isFavorite });
}

export async function batchAddTag(files: FileRef[], tagId: string): Promise<void> {
  return invoke("batch_add_tag", { files, tagId });
}

export async function batchTrash(paths: string[]): Promise<void> {
  return invoke("batch_trash", { paths });
}

export async function batchRemoveFromLibrary(fileIds: string[]): Promise<void> {
  return invoke("batch_remove_from_library", { fileIds });
}

export async function shareFileNative(path: string): Promise<void> {
  return invoke("share_file", { path });
}

export type StorageDiagnostics = {
  appDataPath: string;
  aiLibraryPath: string;
  databasePath: string;
  databaseBytes: number;
  diskFileCount: number;
  dbTotalCount: number;
  dbLibraryCount: number;
  dbFavoriteCount: number;
  processedPhotoCount: number;
  missingDbFileCount: number;
};

export type ReconcileResult = {
  diskFileCount: number;
  dbLibraryCount: number;
  restoredCount: number;
  prunedCount: number;
};

export type ImageLoadingSample = {
  fileId: string;
  absolutePath: string;
  fileExists: boolean;
  thumbnailPath?: string | null;
  thumbnailExists: boolean;
  extension?: string | null;
  assetUrlSample: string;
};

export type ImageLoadingDiagnosis = {
  totalLibraryCount: number;
  missingFileCount: number;
  samples: ImageLoadingSample[];
};

export async function diagnoseImageLoading(sampleLimit = 20): Promise<ImageLoadingDiagnosis> {
  return invoke<ImageLoadingDiagnosis>("diagnose_image_loading", { sampleLimit });
}

export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  return invoke<StorageDiagnostics>("get_storage_diagnostics");
}

export async function reconcileAiLibrary(): Promise<ReconcileResult> {
  return invoke<ReconcileResult>("reconcile_ai_library");
}

export async function listCollections(): Promise<Collection[]> {
  return invoke<Collection[]>("list_collections");
}

export async function createCollection(name: string, description?: string): Promise<Collection> {
  return invoke<Collection>("create_collection", { payload: { name, description: description ?? null } });
}

export async function createSmartCollection(
  name: string,
  matchKeywords: string[],
  description?: string,
): Promise<Collection> {
  return invoke<Collection>("create_smart_collection", {
    payload: { name, description: description ?? null, matchKeywords },
  });
}

export async function updateCollectionKeywords(
  collectionId: string,
  matchKeywords: string[],
): Promise<void> {
  return invoke("update_collection_keywords", {
    payload: { collectionId, matchKeywords },
  });
}

export async function batchAssignSmartCollections(): Promise<BatchAssignResult> {
  return invoke<BatchAssignResult>("batch_assign_smart_collections");
}

export async function diagnoseSmartAssignment(fileId?: string): Promise<SmartAssignmentDiagnosis> {
  return invoke<SmartAssignmentDiagnosis>("diagnose_smart_assignment", { fileId: fileId ?? null });
}

export async function listCharacterSuggestions(limit = 50): Promise<CharacterSuggestion[]> {
  return invoke<CharacterSuggestion[]>("list_character_suggestions", { limit });
}

export async function dismissCharacterSuggestion(tag: string): Promise<void> {
  return invoke("dismiss_character_suggestion", { tag });
}

export async function getDanbooruIndexStatus(): Promise<DanbooruIndexStatus> {
  return invoke<DanbooruIndexStatus>("get_danbooru_index_status");
}

export async function setDanbooruDbPath(path: string): Promise<void> {
  return invoke("set_danbooru_db_path", { path });
}

export async function rebuildDanbooruCharacterCache(): Promise<RebuildDanbooruCacheResult> {
  return invoke<RebuildDanbooruCacheResult>("rebuild_danbooru_character_cache");
}

export async function importDanbooruDbFile(sourcePath: string): Promise<RebuildDanbooruCacheResult> {
  return invoke<RebuildDanbooruCacheResult>("import_danbooru_db_file", { sourcePath });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  return invoke("delete_collection", { collectionId });
}

export async function listCollectionFiles(collectionId: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_collection_files", { collectionId });
}

export async function addFileToCollection(collectionId: string, fileId: string): Promise<void> {
  return invoke("add_file_to_collection", { collectionId, fileId });
}

export async function removeFileFromCollection(collectionId: string, fileId: string): Promise<void> {
  return invoke("remove_file_from_collection", { collectionId, fileId });
}

export async function listDuplicateFiles(): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_duplicate_files");
}

export async function backfillContentHashes(): Promise<BackfillResult> {
  return invoke<BackfillResult>("backfill_content_hashes");
}

export async function backupDatabase(): Promise<string> {
  return invoke<string>("backup_database");
}

export async function getPromptTagSettings(): Promise<PromptTagSettings> {
  return invoke<PromptTagSettings>("get_prompt_tag_settings");
}

export async function setPromptTagSettings(
  mode: PromptTagMode,
  autoTagOnImport: boolean,
): Promise<void> {
  return invoke("set_prompt_tag_settings", { mode, autoTagOnImport });
}

export async function applyPromptTagsForFile(
  fileId: string,
  absolutePath: string,
  mode?: PromptTagMode,
): Promise<TagApplyResult> {
  return invoke<TagApplyResult>("apply_prompt_tags_for_file", {
    fileId,
    absolutePath,
    mode: mode ?? null,
  });
}

export async function batchApplyPromptTags(
  mode?: PromptTagMode,
  fileIds?: string[],
): Promise<BatchTagApplyResult> {
  return invoke<BatchTagApplyResult>("batch_apply_prompt_tags", {
    mode: mode ?? null,
    fileIds: fileIds ?? null,
  });
}

export type { Collection, SearchFilters, BackfillResult, CharacterSuggestion, BatchAssignResult, DanbooruIndexStatus, RebuildDanbooruCacheResult, SmartAssignmentDiagnosis, DanbooruCacheProgress, PromptTagSettings, PromptTagMode, TagApplyResult, BatchTagApplyResult };
