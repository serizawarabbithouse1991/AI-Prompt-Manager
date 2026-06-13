import { useState } from "react";
import type { AIGenerationMetadata } from "@/features/metadata/types";
import { extractMetadata } from "@/lib/tauri";
import { useFileStore } from "@/features/files/store";

type PromptPanelProps = {
  metadata: AIGenerationMetadata | null;
  filePath: string;
};

export function PromptPanel({ metadata, filePath }: PromptPanelProps) {
  const setMetadata = useFileStore((s) => s.setMetadata);
  const [extracting, setExtracting] = useState(false);

  async function handleReExtract() {
    setExtracting(true);
    try {
      const result = await extractMetadata(filePath);
      setMetadata(result);
    } finally {
      setExtracting(false);
    }
  }

  async function copyPrompt() {
    if (!metadata?.positivePrompt) return;
    await navigator.clipboard.writeText(metadata.positivePrompt);
  }

  if (!metadata) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-neutral-500">AI メタデータはありません</div>
        <button
          type="button"
          disabled={extracting}
          onClick={() => void handleReExtract()}
          className="action-btn"
        >
          {extracting ? "抽出中…" : "メタデータを再抽出"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">Prompt</h3>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={extracting}
            onClick={() => void handleReExtract()}
            className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:opacity-50"
          >
            {extracting ? "…" : "再抽出"}
          </button>
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
