import { invoke } from "@tauri-apps/api/core";
import type { AIGenerationMetadata, UpdateMetadataPayload } from "@/features/metadata/types";
import type { Tag } from "@/features/tags/types";
import type { FileEntry, ImportResult, ScanResult, SpecialPaths } from "@/features/files/types";

export async function listDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { path });
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

export async function importPaths(paths: string[]): Promise<ImportResult> {
  return invoke<ImportResult>("import_paths", { paths });
}

export async function pickImportFolder(): Promise<string | null> {
  return invoke<string | null>("pick_import_folder");
}

export async function pickImportItems(): Promise<string[]> {
  return invoke<string[]>("pick_import_items");
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

export async function addTagToFile(fileId: string, tagId: string): Promise<void> {
  return invoke("add_tag_to_file", { fileId, tagId });
}

export async function removeTagFromFile(fileId: string, tagId: string): Promise<void> {
  return invoke("remove_tag_from_file", { fileId, tagId });
}

export async function getFileTags(fileId: string): Promise<Tag[]> {
  return invoke<Tag[]>("get_file_tags", { fileId });
}

export async function setFavorite(fileId: string, isFavorite: boolean): Promise<void> {
  return invoke("set_favorite", { fileId, isFavorite });
}

export async function listFavorites(): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_favorites");
}

export async function searchFiles(query: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("search_files", { query });
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
