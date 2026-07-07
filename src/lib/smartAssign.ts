import type { BatchAssignResult, BatchTagApplyResult, ImportResult } from "@/features/files/types";

const SKIP_MESSAGES: Record<string, string> = {
  no_prompt: "プロンプトが保存されていません。メタデータ未抽出の画像は振り分けできません。",
  no_character_tags: "プロンプト内にキャラクタータグ（character: またはスマートキーワード）が見つかりませんでした。",
};

export function formatSkipReason(reason?: string | null): string {
  if (!reason) return "";
  return SKIP_MESSAGES[reason] ?? reason;
}

export function formatAssignSuffix(result: ImportResult): string {
  const assigned = result.assignedCollectionCount ?? 0;
  const tagsAdded = result.tagsAddedCount ?? 0;
  const parts: string[] = [];
  if (assigned > 0) {
    parts.push(`${assigned} 件をコレクションに振り分け`);
  }
  if (tagsAdded > 0) {
    parts.push(`${tagsAdded} タグを付与`);
  }
  if (parts.length > 0) {
    return `、${parts.join("、")}`;
  }
  if (result.assignSkipReason) {
    return `（振り分けスキップ: ${formatSkipReason(result.assignSkipReason)}）`;
  }
  return "";
}

export function formatBatchTagApplyResult(result: BatchTagApplyResult): string {
  if (result.skipReason) {
    return formatSkipReason(result.skipReason);
  }
  const parts = [
    `${result.filesProcessed} 件を処理`,
    `${result.tagsAdded} タグを追加`,
  ];
  if ((result.tagsSkipped ?? 0) > 0) {
    parts.push(`既存 ${result.tagsSkipped} タグをスキップ`);
  }
  if ((result.filesWithoutPrompt ?? 0) > 0) {
    parts.push(`プロンプトなし ${result.filesWithoutPrompt} 件`);
  }
  return `タグ付け完了: ${parts.join("、")}`;
}

export function formatBatchAssignResult(result: BatchAssignResult): string {
  if (result.skipReason) {
    return formatSkipReason(result.skipReason);
  }
  const parts = [
    `${result.filesProcessed} 件を処理`,
    `${result.assignmentsAdded} 件を追加`,
  ];
  if ((result.filesWithoutPrompt ?? 0) > 0) {
    parts.push(`プロンプトなし ${result.filesWithoutPrompt} 件`);
  }
  if ((result.filesWithoutCharacterTags ?? 0) > 0) {
    parts.push(`キャラタグなし ${result.filesWithoutCharacterTags} 件`);
  }
  return `振り分け完了: ${parts.join("、")}`;
}
