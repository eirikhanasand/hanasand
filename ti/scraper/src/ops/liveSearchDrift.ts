// @ts-nocheck
import { check } from "./liveSearchCheck.ts";

export function evaluateDeploymentDrift(probe: any) {
  const checks = [
    check("source_hash", probe.localSourceHash === probe.remoteSourceHash, "source hash matches"),
    check("compose_hash", probe.expectedComposeConfigHash === probe.remoteComposeConfigHash, "compose hash matches"),
    check("image", probe.expectedImageId === probe.runningImageId, "image matches"),
    ...((probe.healthEndpoints ?? []).map((item: any) => check(`health_${item.name}`, item.ok ?? item.status < 500, `${item.name} health responds`)))
  ];
  return {
    ok: checks.every((item) => item.ok),
    state: checks.every((item) => item.ok) ? "in_sync" : "drift",
    checks,
    rollbackTarget: probe.rollbackTarget,
    blockedPromotionReasons: checks.filter((item) => !item.ok).map((item) => item.name)
  };
}

export function buildLiveSearchPromotionSummary(soak: any, drift: any) {
  const ok = soak.ok && drift.ok;
  return {
    ok,
    status: ok ? "promote" : "hold",
    deploymentDriftState: drift.state,
    rollbackTarget: drift.rollbackTarget,
    lastKnownGood: drift.rollbackTarget,
    blockedPromotionReasons: [...(soak.rollbackReasons ?? []), ...(drift.blockedPromotionReasons ?? [])]
  };
}

export function assertLiveSearchPromotionSummary(summary: any): void {
  if (!summary.ok) throw new Error(`promotion blocked: ${summary.blockedPromotionReasons?.join(", ")}`);
}
