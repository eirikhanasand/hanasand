import { round } from "./adapterRepairTriageUtils.ts";

export function scoreFor(candidate: any, impact: any, signals: any) {
  const actionWeight = { escalate_release_hold: 34, disable_or_pause_source: 30, fix_parser: 24, reduce_cadence: 14, suppress_duplicate: 12, certify_adapter: -20 }[candidate.action] ?? 0;
  const repairWeight = candidate.repair?.priority === "high" ? 30 : candidate.repair?.priority === "medium" ? 18 : candidate.repair ? 8 : 0;
  return round(actionWeight + repairWeight + impact.customerVisibleSearchImpact * 24 + impact.sourceFamilyCoverage * 18 + signals.certificationGap * 4 + Math.min(10, signals.freshnessDebtHours / 24) + signals.duplicateRate * 8 + signals.unsupportedMimeCount * 6 + signals.timeoutCount * 5 + signals.rateLimitedCount * 3 + signals.languageDriftCount * 4);
}

export function actionForRepair(repair: any) {
  return repair.category === "scheduler_backoff" ? "reduce_cadence" : repair.category === "evidence_duplicate_suppression" ? "suppress_duplicate" : ["unsupported_mime_repair", "dynamic_render_failure"].includes(repair.category) ? "disable_or_pause_source" : "fix_parser";
}

export function handoffs(candidate: any, hold: boolean) {
  return { agent01Activation: candidate.action === "certify_adapter" ? "allow_certification" : hold ? "hold_activation" : "disable_or_review_source", agent02Cadence: candidate.action === "reduce_cadence" ? "backoff" : candidate.action === "suppress_duplicate" ? "reduce_duplicate_pressure" : candidate.action === "disable_or_pause_source" || hold ? "pause" : "normal", agent04Coverage: candidate.action === "certify_adapter" ? "count_as_covered" : candidate.action === "suppress_duplicate" ? "deprioritize_duplicate" : "mark_gap", agent06EvidenceReplay: candidate.action === "suppress_duplicate" ? "suppress_duplicate" : hold ? "hold_replay" : candidate.action === "certify_adapter" ? "none" : "hash_only_replay", agent07QualityGate: candidate.action === "certify_adapter" ? "pass" : hold ? "hold" : "repair", agent09WarningField: candidate.action === "certify_adapter" ? "none" : `adapter_triage.${candidate.action}`, agent10ReleaseGate: hold ? "hold" : candidate.action === "certify_adapter" ? "none" : "watch" };
}

export function priorityFor(score: number, hold: boolean, repairPriority?: string) {
  return hold && score >= 70 || repairPriority === "high" && score >= 62 ? "p0" : score >= 52 || hold ? "p1" : score >= 28 ? "p2" : "p3";
}
