import type { ProgramFhHostedDefaultParserLift } from "./hostedDefaultParserLiftTypes.ts";

export function acceptedClass(
  rowClass: ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number]["class"],
  hostedBaselineDecision: ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number]["hostedBaselineDecision"],
  expectedRows: number,
  buyerAction: string,
  confidenceReason: string
): ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number] {
  return {
    class: rowClass,
    hostedBaselineDecision,
    expectedRows,
    requiredFields: ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"],
    buyerAction,
    confidenceReason,
    noLeak: true
  };
}

export function rejection(
  reason: ProgramFhHostedDefaultParserLift["rejectionBuckets"][number]["reason"],
  rows: number
): ProgramFhHostedDefaultParserLift["rejectionBuckets"][number] {
  return { reason, rows, countsTowardHostedPaidFloor: false, noLeak: true };
}
