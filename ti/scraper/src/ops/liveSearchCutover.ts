// @ts-nocheck
import type { CutoverApplyPlanInput, CutoverPromotionPacketInput, CutoverRehearsalInput } from "./liveSearchTypes.ts";
import { evaluateDeploymentDrift } from "./liveSearchDrift.ts";

export function evaluateCutoverRehearsal(input: CutoverRehearsalInput) {
  const drift = evaluateDeploymentDrift(input.deploymentDrift ?? {});
  return {
    ok: drift.ok,
    decision: drift.ok ? "promote" : "hold-on-blocker",
    blockers: drift.blockedPromotionReasons.map((name: string) => ({ name, severity: "blocker" })),
    resourceBudget: input.resourceBudget ?? {},
    statusReport: drift.ok ? "cutover rehearsal pass" : "cutover rehearsal blocked"
  };
}

export function assertCutoverRehearsalPass(report: any): void {
  if (!report.ok) throw new Error(`cutover rehearsal failed: ${report.blockers?.map((b: any) => b.name).join(", ")}`);
}

export function buildCutoverApplyPlanPacket(input: CutoverApplyPlanInput) {
  const blockers = input.rehearsal?.blockers ?? [];
  return {
    ok: blockers.length === 0,
    decision: blockers.length ? "hold" : "promote",
    classificationCounts: { blocked: blockers.length },
    resourceBudget: input.resourceBudget ?? {},
    blockers,
    dryRunOutput: JSON.stringify({ blockers }, null, 2)
  };
}

export function assertCutoverApplyPlanPass(packet: any): void {
  if (!packet.ok) throw new Error(`cutover apply plan blocked: ${packet.blockers?.map((b: any) => b.name).join(", ")}`);
}

export function buildCutoverPromotionPacket(input: CutoverPromotionPacketInput) {
  const apply = buildCutoverApplyPlanPacket(input);
  return { ...apply, leaderMarkdown: apply.ok ? "Cutover promotion ready." : `Cutover promotion blocked: ${apply.blockers.map((b: any) => b.name).join(", ")}` };
}
