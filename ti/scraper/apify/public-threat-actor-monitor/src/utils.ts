import type { MarketplaceRow, TiSearchResponse } from "./types.ts";

export function apifyEventSkipReason(): string {
  if (!process.env.APIFY_TOKEN) return "missing_apify_token";
  if (!process.env.APIFY_ACTOR_RUN_ID) return "missing_actor_run_id";
  return "not_running_on_apify";
}

export function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(6));
}

export function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

export function roundRatio(numerator: number, denominator: number): number {
  return Number((denominator > 0 ? numerator / denominator : 0).toFixed(3));
}

export function apifyApiBase(): string {
  return (process.env.APIFY_API_BASE_URL ?? "https://api.apify.com").replace(/\/$/, "");
}

export function apifyHeaders(): Record<string, string> {
  const token = process.env.APIFY_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function ensureDir(path: string) {
  await Bun.spawn(["mkdir", "-p", path]).exited;
}

export function sourceType(type: string | undefined): MarketplaceRow["sourceType"] {
  if (!type) return "system";
  if (type.includes("telegram") || type.includes("channel")) return "public_channel";
  if (type.includes("dark") || type.includes("leak")) return "darknet_metadata";
  if (type.includes("web") || type.includes("rss") || type.includes("news") || type.includes("clear")) return "clear_web";
  return "system";
}

export function safePublicUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

export function warningsFor(response: TiSearchResponse): string[] {
  const warnings = ["safe_metadata_only"];
  if (response.status && response.status !== "ready") warnings.push(`status:${response.status}`);
  if (response.sources.some((source) => sourceType(source.type) === "darknet_metadata")) {
    warnings.push("darknet_metadata_only");
  }
  if (response.notes.some((note) => note.toLowerCase().includes("review"))) warnings.push("analyst_review_required");
  return warnings;
}

export function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().replace(/\s+/g, " ").slice(0, 120))
    .filter(Boolean))];
}

export function topStrings(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

export function normalizeFacet(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "unknown";
}

export function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value as number)));
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(record(item)))
    : [];
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function boolFromUnknown(value: unknown): boolean {
  return value === true;
}

export function safeString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : "unknown";
}

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function safeIso(value: string): string | undefined {
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

export function stableHash(input: string): string {
  return new Bun.CryptoHasher("sha256").update(input).digest("hex").slice(0, 24);
}
