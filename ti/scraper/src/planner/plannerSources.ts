// @ts-nocheck
import { clampScore } from "../utils.ts";

export function allowedSource(source) {
  if (["paused", "disabled", "quarantined", "candidate", "needs_review"].includes(source.status)) return { ok: false, reason: source.status === "needs_review" || source.status === "candidate" ? "source needs approval or review" : `source is ${source.status}` };
  if (source.accessMethod === "disabled") return { ok: false, reason: "adapter disabled" };
  if (source.risk !== "low" && source.governance?.approvalState !== "approved") return { ok: false, reason: "restricted source requires approval" };
  return { ok: true };
}

export function rankedSources(sources, terms, at) {
  return [...sources].sort((a, b) => sourceScore(b, terms, at) - sourceScore(a, terms, at) || a.id.localeCompare(b.id));
}

export function sourceMatchesScope(source, request) {
  return source.type === "telegram_public" ? request.includeTelegram : source.type?.endsWith("_metadata") ? request.includeDarknetMetadata : request.includeClearWeb;
}

export function target(source, query) {
  return source.url.includes("{query}") ? source.url.replaceAll("{query}", encodeURIComponent(query)) : source.url;
}

export function sourceFreshness(source, at) {
  const ref = source.crawlState?.lastCollectedAt ?? source.lastSeenAt ?? source.health?.lastSuccessAt;
  if (!ref) return 0.55;
  const age = Math.max(0, Date.parse(at) - Date.parse(ref));
  return Number.isFinite(age) ? clampScore(1 - age / 1_209_600_000) : 0.55;
}

export function novelty(source) {
  return !source.crawlState?.lastCollectedAt && !source.lastSeenAt ? 0.75 : source.health?.status === "failing" ? 0.2 : 0.55;
}

function sourceScore(source, terms, at) {
  const text = `${source.name} ${source.url} ${(source.tags ?? []).join(" ")} ${JSON.stringify(source.metadata ?? {})}`.toLowerCase();
  return clampScore(source.trustScore * 0.45 + sourceFreshness(source, at) * 0.3 + novelty(source) * 0.15 + (terms.some((t) => text.includes(t.toLowerCase())) ? 0.2 : 0) + (source.type === "api" ? 0.08 : source.type === "rss" ? 0.06 : source.type === "telegram_public" ? 0.04 : 0));
}
