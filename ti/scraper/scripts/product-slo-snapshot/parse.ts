import type { LiveProductSloDashboard } from "../../src/ops/productSlo.ts";

export function parseDashboard(bodyText: string): LiveProductSloDashboard {
  let value: unknown;
  try {
    value = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`Product SLO response was not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isDashboard(value)) throw new Error("Product SLO response did not match ti.live_product_slo.compact.v3");
  return value;
}

function isDashboard(value: unknown): value is LiveProductSloDashboard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const snapshot = record.dailySnapshot as Record<string, unknown> | undefined;
  return record.schemaVersion === "ti.live_product_slo.compact.v3"
    && Boolean(snapshot)
    && typeof snapshot?.snapshotId === "string"
    && snapshot?.appendOnly === true
    && Boolean(record.productLaunch)
    && Boolean(record.monetizationReadiness)
    && Boolean(record.sourceMonetizationGate)
    && Boolean(record.nonMonetizingWorkDetector)
    && Boolean(record.scaleStepGates)
    && Boolean(record.revenueBlockerBoard);
}
