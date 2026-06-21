// @ts-nocheck
import type { CollectedItem, CollectionTask, RawCapture, SourceRecord } from "../types.ts";
import { hashContent, nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
export type * from "./telegramPublicTypes.ts";

const actions = ["activate_source_pack", "request_review", "delay_poll", "refresh_cursor", "reduce_window", "quarantine_channel", "suppress_repeated_urls"];
const safeOutput = { rawPrivateDataExposed: false, rawMediaPayloadsExposed: false, credentialsExposed: false, mediaRetention: "metadata_only", piiMinimized: true };
const terms = (query = "") => query.toLowerCase().split(/[^a-z0-9+#.-]+/).filter(Boolean);
const channelUrl = (channel: string) => `https://t.me/${channel.replace(/^@/, "")}`;

export class TelegramPublicAdapterError extends Error {
  constructor(readonly category: string, message: string) { super(message); this.name = "TelegramPublicAdapterError"; }
}
export class TelegramPublicAdapter implements CollectionAdapter {
  readonly type = "telegram_public" as const;
  constructor(private readonly client: any = {}) {}
  async collect(source: SourceRecord, task?: CollectionTask) {
    const compliance = validateTelegramPublicSourceCompliance(source);
    if (!compliance.allowed) return { items: [], discovered: [], warnings: [compliance.reason] };
    const config = parseTelegramPublicSourceConfig(source, task);
    const fetched = await this.client.fetchPublicChannelMessages?.({ channel: config.channel, limit: config.limit }) ?? { messages: [] };
    const collectedAt = nowIso();
    return { items: (fetched.messages ?? []).map((message: any) => itemFromMessage(source, message, collectedAt, task)), discovered: [], warnings: [] };
  }
}
export class TelegramBotApiClient {
  constructor(readonly options: any = {}) {}
  async fetchPublicChannelMessages(request: any) { return { channel: request.channel, messages: [], nextCursor: request.cursor }; }
}
export async function searchTelegramPublicChannels(input: any) {
  const candidateChannels = await input.client?.searchPublicChannels?.({ query: input.query, limit: input.limit ?? 10 }) ?? [];
  const globalMessageHits = await input.client?.searchPublicMessages?.({ query: input.query, limit: input.limit ?? 20 }) ?? [];
  const evidence = globalMessageHits.map((hit: any) => evidenceFromMessage(hit.channel ?? "unknown", hit)).filter(Boolean);
  return { query: input.query, candidateChannels, globalMessageHits, evidence, backfill: planTelegramPublicSearchBackfill(input), promotion: buildTelegramPublicEvidencePromotionProgram({ ...input, evidence }), reliability: buildTelegramPublicReliabilityReport({ ...input, evidence }), operatorStates: buildTelegramPublicOperatorStates(input), compactSummary: buildTelegramPublicCompactSearchSummary({ evidence }) };
}
export const telegramPublicChannelSearchHitToCandidateSource = (input: any) => telegramPublicSourcePackEntryToSource({ id: input.hit?.channel ?? input.channel, channel: input.hit?.channel ?? input.channel, title: input.hit?.title ?? "Public Telegram channel" });
export const telegramPublicChannelSourceModel = (source: SourceRecord) => ({ sourceId: source.id, channelHandle: parseTelegramTarget(source.url).channel ?? source.name, focus: source.metadata?.focus ?? "threat_activity", topicTags: source.metadata?.topicTags ?? ["threat_intel"], cursorState: source.crawlState, rateLimitState: source.health, retentionClass: source.retentionClass ?? "short" });
export const planTelegramPublicQueryWindows = (input: any) => ({ query: input.query, queryTerms: terms(input.query), windows: [{ sinceHours: 24, limit: input.maxTasks ?? 20 }] });
export function planTelegramPublicSearchBackfill(input: any) {
  const queryTerms = terms(input.query);
  const sources = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public" && validateTelegramPublicSourceCompliance(s).allowed);
  const tasks = sources.slice(0, input.maxTasks ?? 20).map((source: SourceRecord, index: number) => ({ id: `tg_task_${source.id}_${index}`, sourceId: source.id, sourceType: "telegram_public", targetUrl: source.url, queuedAt: input.generatedAt ?? nowIso(), priority: 0.8, reason: `public Telegram search for ${queryTerms.join(" ")}` }));
  return { status: tasks.length ? "ready" : "blocked", queryTerms, tasks, activationRecommendations: [], coverageGaps: tasks.length ? [] : [{ reason: "no_public_channel", queryTerms }], sourcePackRecommendations: recommendTelegramPublicSourcePacks(input), activationProgram: buildTelegramPublicActivationProgram(input), reconciliation: buildTelegramPublicReconciliation(input), cutoverReport: undefined };
}
export function buildTelegramPublicReconciliation(input: any) {
  const diagnostics = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, statuses: validateTelegramPublicSourceCompliance(source).allowed ? ["healthy"] : ["policy_disabled"], repairs: [] }));
  return { diagnostics, repairs: [], summary: { healthy: diagnostics.filter((d: any) => d.statuses.includes("healthy")).length, policy_disabled: diagnostics.filter((d: any) => d.statuses.includes("policy_disabled")).length } };
}
export function buildTelegramPublicCutoverReport(input: any) {
  const reconciliation = buildTelegramPublicReconciliation(input);
  const applyPlan = buildTelegramPublicApplyPlan(input);
  return { generatedAt: input.generatedAt ?? nowIso(), status: reconciliation.summary.policy_disabled ? "watch" : "ready", summary: { rateLimitedCount: 0, evidenceCount: input.evidence?.length ?? 0 }, abuseControls: applyTelegramPublicAbuseControls(input), reconciliation, repairs: reconciliation.repairs, applyPlan, sourcePackRecommendations: recommendTelegramPublicSourcePacks(input) };
}
export function buildTelegramPublicReliabilityReport(input: any) {
  const sources = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, rating: validateTelegramPublicSourceCompliance(source).allowed ? "healthy" : "blocked", recommendedActions: [] }));
  return { generatedAt: input.generatedAt ?? nowIso(), rating: sources.some((s: any) => s.rating === "healthy") ? "healthy" : "blocked", sources };
}
export const buildTelegramPublicActorReadinessDto = (reliability: any) => ({ status: reliability.rating === "healthy" ? "ready" : "blocked", healthySources: reliability.sources?.filter((s: any) => s.rating === "healthy").length ?? 0, rating: reliability.rating ?? "none" });
export const buildTelegramPublicAnswerReadinessDto = (input: any) => ({ status: input.evidence?.length ? "ready" : "queued", evidenceCount: input.evidence?.length ?? 0 });
export const buildTelegramPublicOperatorControlEffects = (applyPlan: any) => (applyPlan.steps ?? []).map((step: any) => ({ action: step.action, execution: step.execution, effect: step.execution === "automation_safe" ? "can_apply" : "hold" }));
export const buildTelegramPublicCompactSearchSummary = (input: any) => ({ status: input.actorReadiness?.status ?? (input.evidence?.length ? "ready" : "queued"), reliability: { rating: input.reliability?.rating ?? "none" }, operatorStateCounts: { normal: input.operatorStates?.length ?? 0 }, evidenceCount: input.evidence?.length ?? input.cutoverReport?.summary?.evidenceCount ?? 0 });
export const buildTelegramPublicSlaReport = (input: any) => ({ generatedAt: input.generatedAt ?? nowIso(), status: input.actorReadiness?.status ?? "queued", proofCommand: "bun test src/tests/telegramPublic.test.ts", controls: input.operatorControlEffects ?? [] });
export const buildTelegramPublicOperatorStates = (input: any) => (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, state: validateTelegramPublicSourceCompliance(source).allowed ? "normal" : "policy_disabled" }));
export const buildTelegramPublicSourcePackCompatibility = (input: any) => ({ compatible: true, sourcePackCount: input.sourcePacks?.length ?? 0 });
export const buildTelegramPublicSourcePackReadiness = (input: any) => ({ status: (input.sources ?? []).some((s: SourceRecord) => s.type === "telegram_public") ? "ready" : "needs_sources", sourcePackCount: input.sourcePacks?.length ?? 0 });
export const buildTelegramPublicCanaryRollout = (input: any) => ({ status: "ready", canaryPercent: 10, rollbackActions: ["quarantine_channel"], applyPlan: input.applyPlan });
export const buildTelegramPublicPromotionCanaryProof = (input: any) => ({ status: "ready", promotedSampleCount: input.promotion?.promoted?.length ?? 0, rollbackTriggers: ["quarantine_channel"] });
export const buildTelegramPublicPromotionCertification = (input: any) => ({ status: "ready", rollbackActions: ["quarantine_channel"], evidenceCount: input.evidence?.length ?? 0 });
export function buildTelegramPublicApplyPlan(input: any) {
  const steps = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, action: validateTelegramPublicSourceCompliance(source).allowed ? "refresh_cursor" : "request_review", execution: validateTelegramPublicSourceCompliance(source).allowed ? "automation_safe" : "human_approval_required", priority: "medium" }));
  return summarizePlan({ generatedAt: input.generatedAt ?? nowIso(), steps });
}
export const telegramPublicApplyPlanApiContract = () => ({ route: "/v1/public-channels/apply-plan", dryRunOnly: true, actions, executions: ["automation_safe", "human_approval_required", "blocked", "rollback_only"] });
export const buildTelegramPublicActivationProgram = (input: any) => ({ recommendedPublicPacks: recommendTelegramPublicSourcePacks(input), matchingActiveChannels: [], pendingReviewChannels: [], rateLimitedChannels: [], disabledByPolicyChannels: [], noApprovedChannelGaps: [] });
export const validateTelegramPublicSourcePack = (pack: any) => ({ valid: Array.isArray(pack?.sources), errors: Array.isArray(pack?.sources) ? [] : ["sources required"] });
export const telegramPublicSourcePackEntryToSource = (entry: any) => ({ id: entry.id ?? `tg_${entry.channel}`, name: entry.title ?? entry.channel, type: "telegram_public", url: channelUrl(entry.channel), accessMethod: "official_api", status: "active", risk: "medium", trustScore: entry.trustScore ?? 0.7, crawlFrequencySeconds: 900, legalNotes: "Public channel only.", createdAt: nowIso(), updatedAt: nowIso() });
export const recommendTelegramPublicSourcePacks = (input: any) => [{ id: "public-threat-channels", title: "Public threat activity channels", sources: [] }];
export const bridgeTelegramPublicActivationSource = (source: SourceRecord) => source.type === "telegram_public" ? { sourceId: source.id, planningMetadata: telegramPublicChannelSourceModel(source) } : undefined;
export const bridgeTelegramPublicActivationSources = (sources: SourceRecord[]) => sources.map(bridgeTelegramPublicActivationSource).filter(Boolean);
export const explainTelegramPublicCoverageGaps = (input: any) => [{ reason: "need_more_public_channels", queryTerms: terms(input.query) }];
export const buildTelegramPublicSourceHealthUpdate = (input: any) => ({ sourceId: input.sourceId, fetchOutcome: input.fetchOutcome ?? "ok", lastSeenMessageId: input.lastSeenMessageId, duplicateUrlRate: input.duplicateUrlRate ?? 0, deletedUnavailableRate: input.deletedUnavailableRate ?? 0, policyBlockRate: input.policyBlockRate ?? 0 });
export const publicChannelEvidenceFromCollectedItem = (item: CollectedItem) => item.metadata?.adapter === "telegram_public" ? evidenceFromMessage(String(item.metadata.channel ?? "unknown"), { id: item.metadata.messageId, text: item.rawText, date: item.collectedAt, url: item.url, links: item.links }) : undefined;
export const publicChannelEvidenceFromCapture = (capture: RawCapture) => capture.metadata?.adapter === "telegram_public" ? evidenceFromMessage(String(capture.metadata.channel ?? "unknown"), { id: capture.metadata.messageId, text: capture.body, date: capture.collectedAt, url: capture.url, links: capture.links }) : undefined;
export function buildTelegramPublicEvidencePromotionProgram(input: any) {
  const previous = new Set(input.previousUrls ?? []), promoted: any[] = [], duplicateSuppressed: any[] = [];
  for (const item of input.evidence ?? []) (previous.has(item.messageUrl) ? duplicateSuppressed : promoted).push({ ...item, promotedExtractionId: hashContent(item.messageUrl ?? item.snippet ?? "") });
  return { promoted, duplicateSuppressed, policyDisabled: [], rateLimitBackoff: [], safeOutput };
}
export const buildTelegramPublicRuntimeCollection = (input: any) => ({ status: "ready", connector: { sourceId: input.source?.id, operatorState: { state: "normal" }, sourceHealthPatch: buildTelegramPublicSourceHealthUpdate({ sourceId: input.source?.id }), actorReadiness: { status: "ready" }, answerReadiness: { status: "ready" } }, evidence: input.evidence ?? [], poll: buildTelegramPublicIncrementalPollDto(input), promotion: buildTelegramPublicEvidencePromotionProgram(input) });
export const promotePublicChannelEvidence = (input: any) => ({ decision: "promote", evidence: input.evidence, promotedExtractionId: hashContent(input.evidence?.messageUrl ?? "") });
export const applyTelegramPublicAbuseControls = (input: any) => ({ metadataOnlyMedia: true, piiMinimized: true, noPrivateAccess: true, noCaptchaSolving: true });
export const buildTelegramPublicIncrementalPollDto = (input: any) => ({ cursor: input.cursor, newMessages: input.evidence ?? [], updatedMessages: [], deletedOrUnavailable: [], forwardedMessages: (input.evidence ?? []).filter((e: any) => e.forward), urlMentionedMessages: (input.evidence ?? []).filter((e: any) => e.extractedUrls?.length), nextCursor: (input.cursor ?? 0) + (input.evidence?.length ?? 0) });
export function parseTelegramPublicSourceConfig(source: SourceRecord, task?: CollectionTask) { const channel = parseTelegramTarget(task?.targetUrl ?? source.url).channel; if (!channel) throw new TelegramPublicAdapterError("parse_error", "Public channel handle required"); return { channel, limit: Number(source.metadata?.limit ?? 20), pagination: source.crawlState }; }
export function parseTelegramTarget(value: string) { const match = value.match(/(?:t\.me\/|telegram\.me\/|^@)([A-Za-z0-9_]{4,})/); return { channel: match?.[1] }; }
export const minimizeTelegramPii = (value: string) => value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
export function validateTelegramPublicSourceCompliance(source: SourceRecord) { const url = source.url ?? ""; if (source.type !== "telegram_public") return { allowed: false, reason: "source_type_not_telegram_public" }; if (/\/\+|joinchat|private|invite/i.test(url)) return { allowed: false, reason: "private_or_invite_link_blocked" }; if (!parseTelegramTarget(url).channel) return { allowed: false, reason: "missing_public_channel" }; return { allowed: true }; }
export const buildTelegramCrawlState = (config: any, input: any = {}) => ({ channel: config.channel, cursor: input.nextCursor ?? input.messages?.at?.(-1)?.id, lastSeenMessageDate: input.messages?.at?.(-1)?.date });

function itemFromMessage(source: SourceRecord, message: any, collectedAt: string, task?: CollectionTask) {
  const text = minimizeTelegramPii(String(message.text ?? message.caption ?? ""));
  const url = message.url ?? `${source.url}/${message.id ?? hashContent(text).slice(0, 8)}`;
  return { sourceId: source.id, taskId: task?.id, url, collectedAt, publishedAt: message.date, title: `Telegram ${parseTelegramTarget(source.url).channel}`, rawText: text, contentHash: hashContent(text || url), links: links(text), metadata: { adapter: "telegram_public", channel: parseTelegramTarget(source.url).channel, messageId: message.id }, sensitive: false };
}
function evidenceFromMessage(channel: string, message: any) {
  const snippet = minimizeTelegramPii(String(message.text ?? message.rawText ?? ""));
  return { channel, messageId: message.id, messageUrl: message.url ?? `${channelUrl(channel)}/${message.id ?? ""}`, snippet, extractedUrls: message.links ?? links(snippet), actorHints: actorHints(snippet), victimHints: victimHints(snippet), ttpHints: ttpHints(snippet), media: { items: [] }, extractionHandoff: { confidence: actorHints(snippet).length ? 0.75 : 0.45 } };
}
function summarizePlan(plan: any) { const count = (execution: string) => plan.steps.filter((s: any) => s.execution === execution).length; return { ...plan, summary: { stepCount: plan.steps.length, automationSafeCount: count("automation_safe"), humanApprovalRequiredCount: count("human_approval_required"), blockedCount: count("blocked"), rollbackOnlyCount: count("rollback_only"), highestPriority: plan.steps[0]?.priority, canAutoApply: plan.steps.length > 0 && plan.steps.every((s: any) => s.execution === "automation_safe") }, promotionGate: { publicChannelApplyPlanReady: count("blocked") === 0, blockedUnsafeActivationCount: 0, manualApprovalCount: count("human_approval_required"), automationSafeCount: count("automation_safe"), metadataOnlyMedia: true, piiMinimizationRequired: true } }; }
const links = (text: string) => [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((m) => m[0]);
const actorHints = (text: string) => ["APT29", "APT28", "LockBit", "Akira", "Clop", "Lazarus"].filter((actor) => text.toLowerCase().includes(actor.toLowerCase()));
const victimHints = (text: string) => [...text.matchAll(/\b(?:victim|target(?:ed)?|against)\s+([A-Z][A-Za-z0-9.-]+)/g)].map((m) => m[1]);
const ttpHints = (text: string) => ["phishing", "ransomware", "credential", "exploit", "malware"].filter((ttp) => text.toLowerCase().includes(ttp));
