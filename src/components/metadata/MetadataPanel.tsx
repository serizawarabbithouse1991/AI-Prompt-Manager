import type { AIGenerationMetadata } from "@/features/metadata/types";

type MetadataPanelProps = {
  metadata: AIGenerationMetadata | null;
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

export function MetadataPanel({ metadata }: MetadataPanelProps) {
  if (!metadata) return null;

  return (
    <div className="space-y-2 border-t border-neutral-800 pt-3">
      <h3 className="text-sm font-medium text-neutral-300">Generation</h3>
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
    </div>
  );
}
