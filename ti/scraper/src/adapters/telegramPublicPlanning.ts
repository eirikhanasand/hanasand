import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import { actions, channelUrl, terms, validateTelegramPublicSourceCompliance, summarizePlan } from "./telegramPublicHelpers.ts";
import { buildTelegramPublicReconciliation } from "./telegramPublicReconciliation.ts";

export const telegramPublicChannelSearchHitToCandidateSource = (input: any) => telegramPublicSourcePackEntryToSource({ id: input.hit?.channel ?? input.channel, channel: input.hit?.channel ?? input.channel, title: input.hit?.title ?? "Public Telegram channel" });
export const telegramPublicChannelSourceModel = (source: SourceRecord) => ({ sourceId: source.id, channelHandle: source.url, focus: source.metadata?.focus ?? "threat_activity", topicTags: source.metadata?.topicTags ?? ["threat_intel"], cursorState: source.crawlState, rateLimitState: source.health, retentionClass: source.retentionClass ?? "short" });
export const planTelegramPublicQueryWindows = (input: any) => ({ query: input.query, queryTerms: terms(input.query), windows: [{ sinceHours: 24, limit: input.maxTasks ?? 20 }] });
export const telegramPublicApplyPlanApiContract = () => ({ route: "/v1/public-channels/apply-plan", dryRunOnly: true, actions, executions: ["automation_safe", "human_approval_required", "blocked", "rollback_only"] });

export function planTelegramPublicSearchBackfill(input: any) {
  const queryTerms = terms(input.query);
  const sources = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public" && validateTelegramPublicSourceCompliance(s).allowed);
  const tasks = sources.slice(0, input.maxTasks ?? 20).map((source: SourceRecord, index: number) => ({ id: `tg_task_${source.id}_${index}`, sourceId: source.id, sourceType: "telegram_public", targetUrl: source.url, queuedAt: input.generatedAt ?? nowIso(), priority: 0.8, reason: `public Telegram search for ${queryTerms.join(" ")}` }));
  return { status: tasks.length ? "ready" : "blocked", queryTerms, tasks, activationRecommendations: [], coverageGaps: tasks.length ? [] : [{ reason: "no_public_channel", queryTerms }], sourcePackRecommendations: recommendTelegramPublicSourcePacks(input), activationProgram: buildTelegramPublicActivationProgram(input), reconciliation: buildTelegramPublicReconciliation(input), cutoverReport: undefined };
}

export function buildTelegramPublicApplyPlan(input: any) {
  const steps = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, action: validateTelegramPublicSourceCompliance(source).allowed ? "refresh_cursor" : "request_review", execution: validateTelegramPublicSourceCompliance(source).allowed ? "automation_safe" : "human_approval_required", priority: "medium" }));
  return summarizePlan({ generatedAt: input.generatedAt ?? nowIso(), steps });
}

export const buildTelegramPublicActivationProgram = (input: any) => ({ recommendedPublicPacks: recommendTelegramPublicSourcePacks(input), matchingActiveChannels: [], pendingReviewChannels: [], rateLimitedChannels: [], disabledByPolicyChannels: [], noApprovedChannelGaps: [] });
export const validateTelegramPublicSourcePack = (pack: any) => ({ valid: Array.isArray(pack?.sources), errors: Array.isArray(pack?.sources) ? [] : ["sources required"] });
export const telegramPublicSourcePackEntryToSource = (entry: any) => ({ id: entry.id ?? `tg_${entry.channel}`, name: entry.title ?? entry.channel, type: "telegram_public", url: channelUrl(entry.channel), accessMethod: "official_api", status: "active", risk: "medium", trustScore: entry.trustScore ?? 0.7, crawlFrequencySeconds: 900, legalNotes: "Public channel only.", createdAt: nowIso(), updatedAt: nowIso() });
export const recommendTelegramPublicSourcePacks = (_input: any) => [{ id: "public-threat-channels", title: "Public threat activity channels", sources: [] }];
export const bridgeTelegramPublicActivationSource = (source: SourceRecord) => source.type === "telegram_public" ? { sourceId: source.id, planningMetadata: telegramPublicChannelSourceModel(source) } : undefined;
export const bridgeTelegramPublicActivationSources = (sources: SourceRecord[]) => sources.map(bridgeTelegramPublicActivationSource).filter(Boolean);
export const explainTelegramPublicCoverageGaps = (input: any) => [{ reason: "need_more_public_channels", queryTerms: terms(input.query) }];
