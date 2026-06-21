// @ts-nocheck
import { clampScore } from "../utils.ts";

const cti = ["apt", "actor", "campaign", "cve", "exploit", "indicator", "ioc", "malware", "ransomware", "threat", "ttp", "victim", "vulnerability"];
const actors = ["apt29", "cozy bear", "nobelium", "scattered spider", "akira", "lockbit", "turla", "volt typhoon"];
const actions = ["breach", "compromise", "exfiltration", "intrusion", "phishing", "backdoor", "credential", "initial access", "zero-day"];
const noise = ["weekly roundup", "sponsored", "press release", "webinar", "marketing", "job opening", "product launch"];
export const workRank: any = { background_refresh: 0, analyst_deep_dive: 1, source_health_probe: 2, interactive_live_search: 3 };
export const threshold = (strategy: string) => strategy === "precision" || strategy === "destination_only" ? 0.58 : strategy === "recall" ? 0.36 : 0.45;
export const textOf = (c: any, _: string) => `${c.anchorText ?? ""} ${c.surroundingText ?? ""} ${c.url ?? ""}`;
export const taskToCandidate = (task: any) => ({ source: { id: task.sourceId, type: task.sourceType, status: "active", trustScore: 0.5 }, url: task.targetUrl, discoveredAt: task.queuedAt, anchorText: task.reason });
export const fallbackScore = (task: any, strategy: string) => ({ total: task.priority ?? 0.5, decision: "enqueue", reason: task.reason, strategy });
export const countBy = (items: any[], fn: (x: any) => string) => items.reduce((a, x) => ({ ...a, [fn(x)]: (a[fn(x)] ?? 0) + 1 }), {});
export const bucket = (t: any) => t.priority >= 0.45 ? "critical" : t.priority >= 0.35 ? "high" : t.priority >= 0.2 ? "normal" : "low";
export const ageBucket = (t: any, now: Date) => (+now - Date.parse(t.queuedAt ?? now.toISOString())) < 300_000 ? "lt_5m" : "gte_5m";
export const rate = (n: number, d: number) => d ? n / d : 0;

export function classifierFor(c: any, strategy: string) {
  const link = classify(textOf(c, "link")), parent = classify(`${c.parentTitle ?? ""} ${c.parentText ?? c.surroundingText ?? ""}`), destination = classify(`${c.destinationTitle ?? ""} ${c.destinationText ?? ""}`);
  const weights = weightsFor(strategy, Boolean(c.destinationText || c.destinationTitle));
  const relevance = clampScore(link.score * weights.link + parent.score * weights.parent + destination.score * weights.destination);
  return { selectedStrategy: strategy === "hybrid_dynamic" ? "hybrid_dynamic_classifier" : strategy, tradeoff: ["precision", "recall", "efficiency"].includes(strategy) ? strategy : "balanced", weights, link, parent, destination, relevance, coverage: { hasLinkContext: Boolean(c.anchorText || c.surroundingText), hasParentPage: Boolean(c.parentTitle || c.parentText || c.parentRelevance), hasDestinationPage: Boolean(c.destinationTitle || c.destinationText || c.destinationRelevance) } };
}

export function totalScore(c: any, strategy: string) {
  const cls = classifierFor(c, strategy), sourceTrust = c.source?.trustScore ?? 0.5;
  return clampScore(cls.relevance * 0.55 + (c.parentRelevance ?? c.destinationRelevance ?? 0.5) * 0.15 + (c.novelty ?? 0.5) * 0.12 + (c.freshness ?? 0.5) * 0.12 + sourceTrust * 0.06);
}

export function classify(text: string) {
  const lower = text.toLowerCase(), terms = [...cti, ...actors, ...actions, ...(lower.match(/cve-\d{4}-\d+/g) ?? [])].filter((term, i, a) => lower.includes(term) && a.indexOf(term) === i);
  const penalty = noise.some((term) => lower.includes(term)) ? 0.2 : 0;
  return { score: clampScore(terms.length / 8 - penalty), matchedTerms: terms };
}

function weightsFor(strategy: string, hasDestination: boolean) {
  const m: any = { link_only: [0.8, 0.1, 0.1], parent_only: [0.1, 0.8, 0.1], destination_only: [0.1, 0.1, 0.8], link_parent: [0.45, 0.45, 0.1], link_destination: [0.45, 0.1, 0.45], parent_destination: [0.1, 0.45, 0.45], precision: [0.25, 0.25, 0.5], recall: [0.45, 0.35, 0.2], efficiency: [0.65, 0.25, 0.1], hybrid_dynamic: hasDestination ? [0.33, 0.27, 0.4] : [0.52, 0.38, 0.1] };
  const [link, parent, destination] = m[strategy] ?? [0.34, 0.33, 0.33];
  return { link, parent, destination };
}
