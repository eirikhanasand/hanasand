import { nowIso } from "../utils.ts";
import { evidenceFromMessage } from "./telegramPublicHelpers.ts";
import { planTelegramPublicSearchBackfill } from "./telegramPublicPlanning.ts";
import { buildTelegramPublicCompactSearchSummary, buildTelegramPublicOperatorStates, buildTelegramPublicReliabilityReport } from "./telegramPublicStatus.ts";
import { buildTelegramPublicEvidencePromotionProgram } from "./telegramPublicRuntime.ts";

export async function searchTelegramPublicChannels(input: any) {
  const candidateChannels = await input.client?.searchPublicChannels?.({ query: input.query, limit: input.limit ?? 10 }) ?? [];
  const globalMessageHits = await input.client?.searchPublicMessages?.({ query: input.query, limit: input.limit ?? 20 }) ?? [];
  const evidence = globalMessageHits.map((hit: any) => evidenceFromMessage(hit.channel ?? "unknown", hit)).filter(Boolean);
  return {
    query: input.query,
    generatedAt: input.generatedAt ?? nowIso(),
    candidateChannels,
    globalMessageHits,
    evidence,
    backfill: planTelegramPublicSearchBackfill(input),
    promotion: buildTelegramPublicEvidencePromotionProgram({ ...input, evidence }),
    reliability: buildTelegramPublicReliabilityReport({ ...input, evidence }),
    operatorStates: buildTelegramPublicOperatorStates(input),
    compactSummary: buildTelegramPublicCompactSearchSummary({ evidence })
  };
}
