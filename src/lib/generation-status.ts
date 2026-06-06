export const generationStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
] as const;

export type GenerationStatus = (typeof generationStatuses)[number];

const allowedTransitions: Record<GenerationStatus, GenerationStatus[]> = {
  queued: ["running", "canceled", "failed"],
  running: ["succeeded", "failed", "canceled"],
  succeeded: [],
  failed: [],
  canceled: [],
};

export function canTransitionStatus(
  from: GenerationStatus,
  to: GenerationStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function parseGenerationStatus(value: string): GenerationStatus {
  if (generationStatuses.includes(value as GenerationStatus)) {
    return value as GenerationStatus;
  }
  throw new Error(`Unknown generation status: ${value}`);
}
