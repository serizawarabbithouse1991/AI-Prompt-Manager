import type { AIGenerationMetadata } from "@/features/metadata/types";

type PromptPanelProps = {
  metadata: AIGenerationMetadata | null;
};

export function PromptPanel({ metadata }: PromptPanelProps) {
  if (!metadata) {
    return (
      <div className="text-sm text-neutral-500">AI メタデータはありません</div>
    );
  }

  async function copyPrompt() {
    if (!metadata?.positivePrompt) return;
    await navigator.clipboard.writeText(metadata.positivePrompt);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">Prompt</h3>
        {metadata.positivePrompt && (
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          >
            Copy Prompt
          </button>
        )}
      </div>
      {metadata.positivePrompt && (
        <div>
          <div className="mb-1 text-xs text-neutral-500">Positive</div>
          <p className="whitespace-pre-wrap text-sm text-neutral-200">
            {metadata.positivePrompt}
          </p>
        </div>
      )}
      {metadata.negativePrompt && (
        <div>
          <div className="mb-1 text-xs text-neutral-500">Negative</div>
          <p className="whitespace-pre-wrap text-sm text-neutral-400">
            {metadata.negativePrompt}
          </p>
        </div>
      )}
    </div>
  );
}
