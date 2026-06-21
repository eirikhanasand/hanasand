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
