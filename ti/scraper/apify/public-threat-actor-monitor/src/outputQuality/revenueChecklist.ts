import type { MarketplaceRow } from "../types.ts";
import type { paidRowQualitySummary } from "../outputQuality.ts";
import { PRODUCTION_SELLABLE_ROW_FLOOR } from "./readiness.ts";

export function revenueConversionChecklistForRows(rows: MarketplaceRow[], quality: ReturnType<typeof paidRowQualitySummary>) {
  const usefulRate = rows.length ? quality.usefulForBuyer / rows.length : 0;
  const sellableRate = rows.length ? quality.sellable / rows.length : 0;
  const readyForPaidTraffic = quality.sellable >= PRODUCTION_SELLABLE_ROW_FLOOR && sellableRate >= 0.25 && quality.averageBuyerValueScore >= 0.55;
  return {
    schemaVersion: "ti.apify_revenue_conversion_checklist.v1",
    routeVisibleOn: ["Apify OUTPUT", "/v1/contracts#apifyStoreReadiness", "/v1/ops/product-slo"],
    paidTrafficState: readyForPaidTraffic ? "ready" : "blocked",
    listingCopyState: "ready",
    sampleDataQualityState: usefulRate >= 0.4 && readyForPaidTraffic ? "ready" : "blocked",
    pricingState: "ready",
    telemetryState: "missing",
    payoutState: "unknown",
    nextManualVerificationStep: "Open Apify Store analytics and billing, then copy verified views, users, starts, paid runs, refunds, usage cost, creator revenue, beneficiary, payout method, and withdrawal readiness into the product SLO inputs.",
    checks: checks(rows, quality)
  };
}

function checks(rows: MarketplaceRow[], quality: ReturnType<typeof paidRowQualitySummary>) {
  return [
    { id: "listing_copy", state: "ready" },
    { id: "sample_rows", state: rows.length >= 12 ? "ready" : "blocked", blocker: rows.length >= 12 ? undefined : "smoke/default run should expose at least 12 safe buyer examples" },
    { id: "production_sellable_rows", state: quality.sellable >= PRODUCTION_SELLABLE_ROW_FLOOR ? "ready" : "blocked", proofField: "OUTPUT.monetizationReadiness.sellableRows", blocker: quality.sellable >= PRODUCTION_SELLABLE_ROW_FLOOR ? undefined : `production paid traffic requires at least ${PRODUCTION_SELLABLE_ROW_FLOOR} sellable rows` },
    { id: "pricing_shape", state: "ready" },
    { id: "marketplace_telemetry", state: "missing", proofField: "OUTPUT.monetization", blocker: "Apify analytics not externally copied into this run" },
    { id: "payout_setup", state: "missing", blocker: "beneficiary, payout method, and withdrawal readiness require external billing verification" },
    { id: "no_leak_sample_proof", state: "ready" }
  ];
}
