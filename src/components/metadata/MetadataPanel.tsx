import { useState } from "react";
import type { AIGenerationMetadata, UpdateMetadataPayload } from "@/features/metadata/types";
import { updateMetadata } from "@/lib/tauri";
import { useFileStore } from "@/features/files/store";

type MetadataPanelProps = {
  metadata: AIGenerationMetadata | null;
  fileId: string;
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate text-neutral-200">{value}</span>
    </div>
  );
}

export function MetadataPanel({ metadata, fileId }: MetadataPanelProps) {
  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState("");
  const [positivePrompt, setPositivePrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const setMetadata = useFileStore((s) => s.setMetadata);

  if (!metadata) return null;

  function startEdit() {
    setModel(metadata?.model ?? "");
    setPositivePrompt(metadata?.positivePrompt ?? "");
    setNegativePrompt(metadata?.negativePrompt ?? "");
    setEditing(true);
  }

  async function handleSave() {
    const payload: UpdateMetadataPayload = {
      model: model || null,
      positivePrompt: positivePrompt || null,
      negativePrompt: negativePrompt || null,
    };
    await updateMetadata(fileId, payload);
    setMetadata({
      ...metadata!,
      model: payload.model ?? null,
      positivePrompt: payload.positivePrompt ?? null,
      negativePrompt: payload.negativePrompt ?? null,
    });
    setEditing(false);
  }

  return (
    <div className="space-y-2 border-t border-neutral-800 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">Generation</h3>
        {!editing ? (
          <button type="button" onClick={startEdit} className="action-btn">
            編集
          </button>
        ) : (
          <div className="flex gap-1">
            <button type="button" onClick={() => void handleSave()} className="action-btn">
              保存
            </button>
            <button type="button" onClick={() => setEditing(false)} className="action-btn">
              取消
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <label className="block text-xs text-neutral-500">
            Model
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-neutral-500">
            Positive Prompt
            <textarea
              value={positivePrompt}
              onChange={(e) => setPositivePrompt(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs text-neutral-500">
            Negative Prompt
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            />
          </label>
        </div>
      ) : (
        <>
          <Row label="Source" value={metadata.sourceApp} />
          <Row label="Model" value={metadata.model} />
          <Row label="Sampler" value={metadata.sampler} />
          <Row label="Scheduler" value={metadata.scheduler} />
          <Row label="Seed" value={metadata.seed} />
          <Row label="Steps" value={metadata.steps} />
          <Row label="CFG" value={metadata.cfgScale} />
          <Row
            label="Size"
            value={
              metadata.generationWidth && metadata.generationHeight
                ? `${metadata.generationWidth}×${metadata.generationHeight}`
                : null
            }
          />
        </>
      )}

      {metadata.workflowJson && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setWorkflowOpen((v) => !v)}
            className="text-xs text-blue-400 hover:underline"
          >
            {workflowOpen ? "ComfyUI Workflow を隠す" : "ComfyUI Workflow を表示"}
          </button>
          {workflowOpen && (
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-neutral-900 p-2 text-xs text-neutral-400">
              {metadata.workflowJson}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
