import type { ImportResult } from "@/features/files/types";
import { scanPhotoLibraryNovelai } from "@/lib/tauri";

function formatNovelAiImportSummary(result: ImportResult): string {
  const novelai = result.novelaiCount ?? result.importedCount;
  const skipped = result.skippedCount ?? 0;
  const duplicates = result.duplicateCount ?? 0;
  const errors = result.errorCount;

  if (novelai === 0 && skipped === 0 && duplicates === 0 && errors === 0) {
    return "新しい NovelAI 画像はありませんでした";
  }

  const extras: string[] = [];
  if (skipped > 0) extras.push(`スキップ ${skipped}`);
  if (duplicates > 0) extras.push(`重複 ${duplicates}`);
  if (errors > 0) extras.push(`エラー ${errors}`);

  const suffix = extras.length > 0 ? `（${extras.join("、")} 件）` : "";
  return `NovelAI ${novelai} 件を取り込みました${suffix}${formatAssignSuffix(result)}`;
}

export function formatPhotoScanResult(result: ImportResult): string {
  return formatNovelAiImportSummary(result);
}

export function formatNovelAiImportResult(result: ImportResult): string {
  return formatNovelAiImportSummary(result);
}

export function formatAssignSuffix(result: ImportResult): string {
  const assigned = result.assignedCollectionCount ?? 0;
  if (assigned <= 0) return "";
  return `、${assigned} 件をコレクションに振り分け`;
}

export async function runPhotoLibraryScan(
  incremental = true,
  options?: { pngOnly?: boolean },
): Promise<ImportResult> {
  return scanPhotoLibraryNovelai(incremental, options);
}
