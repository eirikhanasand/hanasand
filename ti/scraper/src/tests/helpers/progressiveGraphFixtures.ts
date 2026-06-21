import type { ProgressiveGraphEvidence } from "../../types.ts";

export const actor = { type: "actor" as const, value: "Scattered Spider", confidence: 0.78, aliases: ["UNC3944", "Octo Tempest"] };
export const alias = { type: "actor" as const, value: "UNC3944", confidence: 0.72, aliases: ["Scattered Spider"] };
export const tool = { type: "tool" as const, value: "SIM swapping", confidence: 0.7 };
export const victim = { type: "victim" as const, value: "Contoso Telecom", confidence: 0.66 };
export const apt29 = { type: "actor" as const, value: "APT29", confidence: 0.86, aliases: ["Cozy Bear", "Nobelium"] };
export const phishing = { type: "attack-pattern" as const, value: "T1566 Phishing", confidence: 0.74 };
export const embassy = { type: "victim" as const, value: "Example Embassy", confidence: 0.7 };

export function evidence(input: Partial<ProgressiveGraphEvidence>): ProgressiveGraphEvidence {
  return {
    id: input.id ?? "evidence",
    stage: input.stage ?? "discovery",
    observedAt: input.observedAt ?? "2026-05-24T00:00:00.000Z",
    sourceId: input.sourceId ?? "src_live",
    captureId: input.captureId,
    url: input.url ?? "https://example.test/live",
    contentHash: input.contentHash ?? input.id ?? "hash",
    extractorVersion: input.extractorVersion ?? "progressive-test",
    relationships: input.relationships ?? [{
      source: actor,
      target: victim,
      type: "targets",
      confidence: 0.7
    }]
  };
}
