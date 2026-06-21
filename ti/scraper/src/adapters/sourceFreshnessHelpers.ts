import type { AdapterRunResult } from "../types.ts";
import type { SourceFreshnessFinding } from "./sourceFreshnessTypes.ts";

export function latestItemDate(result: AdapterRunResult): string | undefined {
  return result.items
    .map((item) => item.publishedAt ?? item.collectedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

export function isStale(publishedAt: string, now: string, freshnessTargetSeconds: number): boolean {
  const ageMs = Date.parse(now) - Date.parse(publishedAt);
  return Number.isFinite(ageMs) && ageMs > freshnessTargetSeconds * 1000;
}

export function notesFor(findings: SourceFreshnessFinding[]): string[] {
  if (!findings.length) return ["source remains useful for actor queries"];
  return findings.map((finding) => {
    if (finding === "stale_feed") return "latest item is older than the source freshness target";
    if (finding === "broken_parser_profile") return "parser confidence or warnings require fixture repair";
    if (finding === "empty_capture") return "adapter returned no collected items";
    if (finding === "noisy_source") return "source emits too many weak or off-topic captures";
    if (finding === "duplicate_heavy") return "source is dominated by duplicate canonical captures";
    return "source policy disables collection";
  });
}
