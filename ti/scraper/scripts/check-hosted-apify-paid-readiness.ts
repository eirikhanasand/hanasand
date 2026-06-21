import { buildHostedApifyPaidReadinessProof } from "../src/contracts/hostedApifyPaidReadiness.ts";

const proof = buildHostedApifyPaidReadinessProof({ hasToken: Boolean(process.env.APIFY_TOKEN) });
const actorId = process.env.TI_APIFY_ACTOR_ID ?? proof.actorId;
const runId = process.env.TI_APIFY_HOSTED_RUN_ID ?? "";
const datasetId = process.env.TI_APIFY_HOSTED_DATASET_ID ?? "";

const payload = {
  ...proof,
  paidPromotionReady: false,
  actorId,
  observedHostedRun: {
    runId: runId || null,
    datasetId: datasetId || null,
    suppliedViaEnvironment: Boolean(runId && datasetId),
    note: runId && datasetId
      ? "Run and dataset ids were supplied, but dataset counts still need observed Apify verification before paid promotion."
      : "No hosted 100-name run id or dataset id supplied."
  }
};

const okForPaidPromotion = payload.status === "paid_floor_hosted_proof"
  && payload.marketplaceConversionInputs.payoutEnabled !== "external_unknown"
  && payload.marketplaceConversionInputs.pricingModel !== "external_unknown";

console.log(JSON.stringify(payload, null, 2));

if (okForPaidPromotion) {
  process.exit(0);
}

console.warn([
  "Hosted Apify paid readiness is not complete.",
  `status=${payload.status}`,
  `tokenState=${payload.tokenState}`,
  "This is expected when APIFY_TOKEN or externally copied hosted metrics are unavailable; do not promote paid traffic from local proof alone."
].join("\n"));
process.exit(0);
