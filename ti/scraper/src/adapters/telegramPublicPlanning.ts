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
  const sources = (input.sources ?? []).filter(collectable);
  const tasks = sources.slice(0, input.maxTasks ?? 20).map((source: SourceRecord, index: number) => ({ id: `tg_task_${source.id}_${index}`, sourceId: source.id, sourceType: "telegram_public", targetUrl: source.url, queuedAt: input.generatedAt ?? nowIso(), priority: 0.8, reason: `public Telegram search for ${queryTerms.join(" ")}` }));
  return { status: tasks.length ? "ready" : "blocked", queryTerms, tasks, activationRecommendations: [], coverageGaps: tasks.length ? [] : [{ reason: "no_public_channel", queryTerms }], sourcePackRecommendations: recommendTelegramPublicSourcePacks(input), activationProgram: buildTelegramPublicActivationProgram(input), reconciliation: buildTelegramPublicReconciliation(input), cutoverReport: undefined };
}

export function buildTelegramPublicApplyPlan(input: any) {
  const steps = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, action: collectable(source) ? "refresh_cursor" : "request_review", execution: collectable(source) ? "automation_safe" : "human_approval_required", priority: "medium" }));
  return summarizePlan({ generatedAt: input.generatedAt ?? nowIso(), steps });
}

export const buildTelegramPublicActivationProgram = (input: any) => {
  const sources = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public");
  const healthy = sources.filter(collectable);
  return {
    generatedAt: input.generatedAt ?? nowIso(),
    recommendedPublicPacks: recommendTelegramPublicSourcePacks(input),
    matchingActiveChannels: healthy.map(telegramPublicChannelSourceModel),
    pendingReviewChannels: sources.filter((source: SourceRecord) => !validateTelegramPublicSourceCompliance(source).allowed).map(telegramPublicChannelSourceModel),
    rateLimitedChannels: sources.filter((source: SourceRecord) => (source as any).health?.state === "rate_limited").map(telegramPublicChannelSourceModel),
    disabledByPolicyChannels: sources.filter((source: SourceRecord) => !validateTelegramPublicSourceCompliance(source).allowed).map((source: SourceRecord) => ({ sourceId: source.id, reason: validateTelegramPublicSourceCompliance(source).reason })),
    noApprovedChannelGaps: healthy.length ? [] : [{ reason: "no_approved_public_telegram_sources", nextAction: "Run discovery packs, review public-only candidates, and activate bounded polling for approved channels." }],
  };
};
const collectable = (source: SourceRecord) => source.type === "telegram_public" && source.status === "active" && (!source.governance?.approvalRequired || source.governance.approvalState === "approved") && validateTelegramPublicSourceCompliance(source).allowed;
export const validateTelegramPublicSourcePack = (pack: any) => ({ valid: Array.isArray(pack?.sources), errors: Array.isArray(pack?.sources) ? [] : ["sources required"] });
export const telegramPublicSourcePackEntryToSource = (entry: any) => ({ id: entry.id ?? `tg_${entry.channel}`, name: entry.title ?? entry.channel, type: "telegram_public", url: channelUrl(entry.channel), accessMethod: "public_http", status: entry.status ?? "candidate", risk: entry.risk ?? "medium", trustScore: entry.trustScore ?? 0.7, crawlFrequencySeconds: entry.crawlFrequencySeconds ?? 900, legalNotes: "Public channel only. No private invite access, auto-join, credential use, or media download.", createdAt: nowIso(), updatedAt: nowIso(), metadata: { sourceFamily: "telegram_public", sourcePackId: entry.packId, topicTags: entry.topicTags ?? [], discoveryQuery: entry.discoveryQuery, maxItemsPerFetch: entry.maxItemsPerFetch ?? 40, mediaPolicy: "metadata_only_no_download" } });
export const recommendTelegramPublicSourcePacks = (input: any) => {
  const queryTerms = terms(input.query ?? "");
  const baseQueries = queryTerms.length ? queryTerms : ["stealer logs", "ransomware victim", "initial access broker", "phishing kit", "combo list", "session cookies"];
  const packs = [
    { id: "telegram-stealer-markets", title: "Stealer-log and session resale channels", candidateTarget: 750, topicTags: ["infostealer", "session", "credentials"], discoveryQueries: baseQueries.map((term: string) => `${term} telegram public stealer logs`) },
    { id: "telegram-ransomware-mirrors", title: "Ransomware mirror and victim-claim channels", candidateTarget: 650, topicTags: ["ransomware", "victim_claims", "actor_mirrors"], discoveryQueries: baseQueries.map((term: string) => `${term} telegram ransomware mirror victim`) },
    { id: "telegram-initial-access", title: "Initial-access broker and access-sale channels", candidateTarget: 600, topicTags: ["iab", "vpn", "rdp", "access_sale"], discoveryQueries: baseQueries.map((term: string) => `${term} telegram initial access broker`) },
    { id: "telegram-phishing-kits", title: "Phishing-kit and AiTM operation channels", candidateTarget: 500, topicTags: ["phishing", "aitm", "brand_abuse"], discoveryQueries: baseQueries.map((term: string) => `${term} telegram phishing kit aitm`) },
    { id: "telegram-regional-threats", title: "Regional-language public threat channels", candidateTarget: 500, topicTags: ["regional", "multilingual", "threat_activity"], discoveryQueries: ["russian cybercrime telegram public", "spanish ransomware telegram public", "arabic cybercrime telegram public", "portuguese fraud telegram public", "french ransomware telegram public"] },
  ];
  return packs.map((pack) => ({
    ...pack,
    sourceFamily: "telegram_public",
    activationState: "candidate_discovery",
    approvalRequired: true,
    safetyBoundary: { publicOnly: true, noPrivateAccess: true, noAutoJoin: true, noCredentialCollection: true, noMediaDownload: true },
    sources: [],
  }));
};
export const bridgeTelegramPublicActivationSource = (source: SourceRecord) => source.type === "telegram_public" ? { sourceId: source.id, planningMetadata: telegramPublicChannelSourceModel(source) } : undefined;
export const bridgeTelegramPublicActivationSources = (sources: SourceRecord[]) => sources.map(bridgeTelegramPublicActivationSource).filter(Boolean);
export const explainTelegramPublicCoverageGaps = (input: any) => [{ reason: "need_more_public_channels", queryTerms: terms(input.query) }];
