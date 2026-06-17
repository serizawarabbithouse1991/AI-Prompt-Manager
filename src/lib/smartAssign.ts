import type { BatchAssignResult, ImportResult } from "@/features/files/types";

const SKIP_MESSAGES: Record<string, string> = {
  cache_not_ready: "辞書が未構築です。設定で danbooru2023.db をインポートし「辞書を更新」してください。",
  no_prompt: "プロンプトが保存されていません。メタデータ未抽出の画像は振り分けできません。",
  no_character_tags: "プロンプト内に Danbooru キャラクタータグが見つかりませんでした。",
};

export function formatSkipReason(reason?: string | null): string {
  if (!reason) return "";
  return SKIP_MESSAGES[reason] ?? reason;
}

export function formatAssignSuffix(result: ImportResult): string {
  const assigned = result.assignedCollectionCount ?? 0;
  if (assigned > 0) {
    return `、${assigned} 件をコレクションに振り分け`;
  }
  if (result.assignSkipReason) {
    return `（振り分けスキップ: ${formatSkipReason(result.assignSkipReason)}）`;
  }
  return "";
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
