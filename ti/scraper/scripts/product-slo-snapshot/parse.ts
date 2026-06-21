import type { LiveProductSloDashboard } from "../../src/ops/productSlo.ts";

export function parseDashboard(bodyText: string): LiveProductSloDashboard {
  let value: unknown;
  try {
    value = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`Product SLO response was not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isDashboard(value)) {
    throw new Error("Product SLO response did not match ti.live_product_slo_dashboard.v1");
  }
  return value;
}

function isDashboard(value: unknown): value is LiveProductSloDashboard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const snapshot = record.dailySnapshot as Record<string, unknown> | undefined;
  const sourceGate = record.sourceMonetizationGate as Record<string, unknown> | undefined;
  const bloatDetector = record.nonMonetizingWorkDetector as Record<string, unknown> | undefined;
  const scaleGates = record.scaleStepGates as Record<string, unknown> | undefined;
  const blockerBoard = record.revenueBlockerBoard as Record<string, unknown> | undefined;
  const monetization = record.apifyLaunchExperiment && typeof record.apifyLaunchExperiment === "object"
    ? (record.apifyLaunchExperiment as Record<string, unknown>).monetizationReadiness as Record<string, unknown> | undefined
    : undefined;
  return record.schemaVersion === "ti.live_product_slo_dashboard.v1"
    && record.route === "/v1/ops/product-slo"
    && Boolean(snapshot)
    && typeof snapshot?.snapshotId === "string"
    && snapshot?.appendOnly === true
    && sourceGate?.schemaVersion === "ti.live_product_source_monetization_gate.v1"
    && bloatDetector?.schemaVersion === "ti.non_monetizing_work_detector.v1"
    && scaleGates?.schemaVersion === "ti.product_scale_step_gates.v1"
    && blockerBoard?.schemaVersion === "ti.revenue_blocker_board.v1"
    && monetization?.schemaVersion === "ti.live_product_monetization_readiness.v1";
}
