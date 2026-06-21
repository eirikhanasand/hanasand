import { isStale, latestItemDate, notesFor } from "./sourceFreshnessHelpers.ts";
import type { SourceFreshnessFinding, SourceFreshnessRegressionInput, SourceFreshnessRegressionResult } from "./sourceFreshnessTypes.ts";
export type { SourceFreshnessFinding, SourceFreshnessRegressionInput, SourceFreshnessRegressionResult } from "./sourceFreshnessTypes.ts";

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
