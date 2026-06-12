export type AIGenerationMetadata = {
  id: string;
  fileId: string;
  sourceApp?: string | null;
  positivePrompt?: string | null;
  negativePrompt?: string | null;
  model?: string | null;
  sampler?: string | null;
  scheduler?: string | null;
  seed?: string | null;
  steps?: number | null;
  cfgScale?: number | null;
  generationWidth?: number | null;
  generationHeight?: number | null;
  workflowJson?: string | null;
  rawMetadataJson?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type UpdateMetadataPayload = {
  positivePrompt?: string | null;
  negativePrompt?: string | null;
  model?: string | null;
};
