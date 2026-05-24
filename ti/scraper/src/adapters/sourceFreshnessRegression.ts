import type { ParserProfileDecision } from "./parserProfiles.ts";
import type { AdapterRunResult, SourceRecord } from "../types.ts";

export type SourceFreshnessFinding =
  | "stale_feed"
  | "broken_parser_profile"
  | "empty_capture"
  | "noisy_source"
  | "duplicate_heavy"
  | "policy_disabled";

export interface SourceFreshnessRegressionInput {
  source: SourceRecord;
  result: AdapterRunResult;
  profile: ParserProfileDecision;
  now: string;
  freshnessTargetSeconds: number;
  duplicateRate: number;
  noiseRate: number;
}

export interface SourceFreshnessRegressionResult {
  sourceId: string;
  status: "healthy" | "review" | "disable";
  findings: SourceFreshnessFinding[];
  parserProfile: ParserProfileDecision["profile"];
  extractionConfidenceBand: ParserProfileDecision["extractionConfidenceBand"];
  latestPublishedAt?: string;
  recommendedAction: "keep_active" | "move_to_review" | "disable_source";
  notes: string[];
}

export function evaluateSourceFreshnessRegression(input: SourceFreshnessRegressionInput): SourceFreshnessRegressionResult {
  const findings: SourceFreshnessFinding[] = [];
  const latestPublishedAt = latestItemDate(input.result);
  if (input.source.status === "disabled" || input.source.status === "rejected") findings.push("policy_disabled");
  if (!input.result.items.length) findings.push("empty_capture");
  if (latestPublishedAt && isStale(latestPublishedAt, input.now, input.freshnessTargetSeconds)) findings.push("stale_feed");
  if (input.profile.extractionConfidenceBand === "low" || input.result.warnings.some((warning) => /parser|extract/i.test(warning))) {
    findings.push("broken_parser_profile");
  }
  if (input.noiseRate >= 0.55) findings.push("noisy_source");
  if (input.duplicateRate >= 0.75) findings.push("duplicate_heavy");

  const disable = findings.includes("policy_disabled") || (findings.includes("empty_capture") && findings.includes("duplicate_heavy"));
  const review = !disable && findings.length > 0;
  return {
    sourceId: input.source.id,
    status: disable ? "disable" : review ? "review" : "healthy",
    findings,
    parserProfile: input.profile.profile,
    extractionConfidenceBand: input.profile.extractionConfidenceBand,
    latestPublishedAt,
    recommendedAction: disable ? "disable_source" : review ? "move_to_review" : "keep_active",
    notes: notesFor(findings)
  };
}

function latestItemDate(result: AdapterRunResult): string | undefined {
  return result.items
    .map((item) => item.publishedAt ?? item.collectedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function isStale(publishedAt: string, now: string, freshnessTargetSeconds: number): boolean {
  const ageMs = Date.parse(now) - Date.parse(publishedAt);
  return Number.isFinite(ageMs) && ageMs > freshnessTargetSeconds * 1000;
}

function notesFor(findings: SourceFreshnessFinding[]): string[] {
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
