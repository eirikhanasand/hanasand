import type { SourceRecord } from "../types.ts";
import { hashContent, nowIso } from "../utils.ts";
import { evaluateTelegramPublicCompliance } from "../policy/telegramCollectionPolicy.ts";

export const actions = ["activate_source_pack", "request_review", "delay_poll", "refresh_cursor", "reduce_window", "quarantine_channel", "suppress_repeated_urls"];
export const safeOutput = { rawPrivateDataExposed: false, rawMediaPayloadsExposed: false, credentialsExposed: false, mediaRetention: "metadata_only", piiMinimized: true };
export const terms = (query = "") => query.toLowerCase().split(/[^a-z0-9+#.-]+/).filter(Boolean);
export const channelUrl = (channel: string) => `https://t.me/${channel.replace(/^@/, "")}`;
export const links = (text: string) => [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((m) => m[0]);
export const actorHints = (text: string) => ["APT29", "APT28", "LockBit", "Akira", "Clop", "Lazarus"].filter((actor) => text.toLowerCase().includes(actor.toLowerCase()));
export const victimHints = (text: string) => [...text.matchAll(/\b(?:victim|target(?:ed)?|against)\s+([A-Z][A-Za-z0-9.-]+)/g)].map((m) => m[1]);
export const ttpHints = (text: string) => ["phishing", "ransomware", "credential", "exploit", "malware"].filter((ttp) => text.toLowerCase().includes(ttp));
export const minimizeTelegramPii = (value: string) => value
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
  .replace(/\b\d{8,10}:[A-Z0-9_-]{30,}\b/gi, "[credential]")
  .replace(/\b(?:api[_ -]?key|access[_ -]?token|password|passwd|session[_ -]?string)\s*[:=]\s*["']?[A-Z0-9_./+=-]{8,}["']?/gi, "[credential]")
  .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
export const buildTelegramCrawlState = (config: any, input: any = {}) => ({ channel: config.channel, cursor: input.nextCursor ?? input.messages?.at?.(-1)?.id, lastSeenMessageDate: input.messages?.at?.(-1)?.date });

export function parseTelegramTarget(value: string) {
  const match = value.match(/(?:t\.me\/|telegram\.me\/|^@)([A-Za-z0-9_]{4,})/);
  return { channel: match?.[1] };
}

export function validateTelegramPublicSourceCompliance(source: SourceRecord): { allowed: boolean; reason?: string } {
  if (source.type !== "telegram_public") return { allowed: false, reason: "source_type_not_telegram_public" };
  return evaluateTelegramPublicCompliance(source);
}

export function summarizePlan(plan: any) {
  const count = (execution: string) => plan.steps.filter((s: any) => s.execution === execution).length;
  return { ...plan, summary: { stepCount: plan.steps.length, automationSafeCount: count("automation_safe"), humanApprovalRequiredCount: count("human_approval_required"), blockedCount: count("blocked"), rollbackOnlyCount: count("rollback_only"), highestPriority: plan.steps[0]?.priority, canAutoApply: plan.steps.length > 0 && plan.steps.every((s: any) => s.execution === "automation_safe") }, promotionGate: { publicChannelApplyPlanReady: count("blocked") === 0, blockedUnsafeActivationCount: 0, manualApprovalCount: count("human_approval_required"), automationSafeCount: count("automation_safe"), metadataOnlyMedia: true, piiMinimizationRequired: true } };
}

export function evidenceFromMessage(channel: string, message: any) {
  const snippet = minimizeTelegramPii(String(message.text ?? message.rawText ?? ""));
  return { channel, messageId: message.id, messageUrl: message.url ?? `${channelUrl(channel)}/${message.id ?? ""}`, snippet, extractedUrls: message.links ?? links(snippet), actorHints: actorHints(snippet), victimHints: victimHints(snippet), ttpHints: ttpHints(snippet), media: { items: [] }, extractionHandoff: { confidence: actorHints(snippet).length ? 0.75 : 0.45 } };
}

export function itemFromMessage(source: SourceRecord, message: any, collectedAt: string, task?: any) {
  const text = minimizeTelegramPii(String(message.text ?? message.caption ?? ""));
  const url = message.url ?? `${source.url}/${message.id ?? hashContent(text).slice(0, 8)}`;
  return { tenantId: source.tenantId, sourceId: source.id, taskId: task?.id, url, collectedAt, publishedAt: message.date, title: `Telegram ${parseTelegramTarget(source.url).channel}`, rawText: text, contentHash: hashContent(text || url), links: links(text), metadata: { adapter: "telegram_public", channel: parseTelegramTarget(source.url).channel, messageId: message.id }, sensitive: false };
}
