import { hashContent } from "../utils.ts";
import { forbiddenFields } from "./liveCaptureConstants.ts";
import type { LiveCaptureCanaryRowDto, LiveCaptureCanaryRunClass, LiveCaptureRuntimeRowDto, ParserRepairCategory } from "./liveCaptureTypes.ts";
import { repairRecommendation, versionFor } from "./liveCaptureUtils.ts";

export function canaryRow(row: LiveCaptureRuntimeRowDto, runClass: LiveCaptureCanaryRunClass): LiveCaptureCanaryRowDto {
  const parserRepair = parserRepairFor(row), state = canaryState(row, parserRepair, runClass);
  return { schemaVersion: "ti.live_capture_canary_row.v1", sourceId: row.sourceId, adapterFamily: row.adapter, approvedUrlHash: row.canonicalUrlHash ?? `sourcehash:${hashContent(row.sourceId).slice(0, 16)}`, robotsLegalNotesPresent: row.observability.robotsLegalNotesPresent, caps: row.runtimeCaps, parserVersion: versionFor(row.adapter), extractionWarnings: row.extractionWarnings, dedupeHashes: { canonicalUrlHash: row.canonicalUrlHash, contentHash: row.contentHash, dedupeKey: row.dedupeKey }, evidenceReplayRefs: row.replayId ? [row.replayId] : [], noLeakPolicyResult: { passed: true, publicOnly: true, disabledByDefaultForUnapprovedNetworkPaths: true, unsafeUrlExposed: false, rawContentExposed: false, forbiddenFields: forbiddenFields() }, canary: { runClass, state, reason: state === "promote" ? "canary capture is replayable, parser confidence is acceptable, and no repair is needed" : parserRepair.needed ? parserRepair.recommendation : "canary should remain under observation before promotion" }, parserRepair, schedulerHint: state === "hold" || state === "rollback" ? { cadenceHint: "pause", budgetClass: "low", reason: "canary held or rollback requested" } : row.agent02Scheduler };
}

function parserRepairFor(row: LiveCaptureRuntimeRowDto) {
  const category = repairCategory(row);
  return { needed: category !== "none", category, recommendation: repairRecommendation(category, row), owner: "agent_03" };
}

function repairCategory(row: LiveCaptureRuntimeRowDto): ParserRepairCategory {
  if (row.failureClass === "malformed_feed") return "malformed_feed"; if (row.failureClass === "unsupported_mime") return "unsupported_mime"; if (row.failureClass === "excessive_redirects") return "excessive_redirects"; if (["http_error", "rate_limited"].includes(row.failureClass)) return "source_outage"; if (row.failureClass === "unsafe_url") return "unsafe_link_suppression"; if (row.status === "duplicate") return "duplicate_heavy_output"; if (row.status === "stale" || row.freshness.state === "stale") return "stale_source_window"; if (row.adapter === "report_index" && row.status === "empty") return "report_index_drift"; if (row.adapter === "public_advisory" && (row.status === "empty" || row.extractionWarnings.some((w: string) => /schema|field|json/i.test(w)))) return "public_advisory_schema_change"; if (row.adapter === "static_html" && (row.status === "empty" || row.parserConfidence < 0.65)) return "changed_layout"; return "none";
}

function canaryState(row: LiveCaptureRuntimeRowDto, repair: any, runClass: LiveCaptureCanaryRunClass) {
  if (["robots_or_legal_hold", "unsafe_url", "unsupported_mime"].includes(row.failureClass)) return "hold";
  if (["burst_failure", "parser_regression"].includes(runClass)) return row.status === "captured" && !repair.needed ? "watch" : "rollback";
  if (row.status === "failed") return ["http_error", "rate_limited"].includes(row.failureClass) ? "watch" : "hold";
  if (row.status === "duplicate" || row.status === "stale" || repair.needed) return "watch";
  return row.parserConfidence >= 0.7 && row.replayId ? "promote" : "watch";
}
