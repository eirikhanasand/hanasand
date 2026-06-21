export const commandExamples = [
  "TI_APIFY_OBSERVED_PROOF_JSON='<json>' bun run check:hosted-apify-paid-readiness",
  "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.sample.json bun run check:hosted-apify-paid-readiness",
  "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.hosted300.template.json bun run check:hosted-apify-paid-readiness",
  "TI_APIFY_OBSERVED_PROOF_PATH=docs/examples/hosted-apify-observed-proof.hosted500.template.json bun run check:hosted-apify-paid-readiness",
  "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=run bun run check:hosted-apify-paid-readiness",
  "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_RUN_ID=<run id> bun run check:hosted-apify-paid-readiness",
  "APIFY_TOKEN=<token> TI_APIFY_HOSTED_PROOF_MODE=verify TI_APIFY_HOSTED_DATASET_ID=<dataset id> bun run check:hosted-apify-paid-readiness"
];

export const requiredHostedMetrics = ["runId", "buildId", "runStatus", "failureState", "datasetId", "datasetItemCount", "sellableRows", "sellableFindingCount", "caveatedRows", "averageBuyerValueScore", "runtimeSeconds", "memoryMbytes", "usageUsd", "costUsd", "chargedEventCount", "chargedDatasetItemEvents", "chargedActorStartEvents"];

export const manualVerificationSteps = [
  "Publish or rebuild eirikhanasand/public-threat-actor-monitor from the current Actor package.",
  "Start a hosted Apify run with the default 100-name input: no custom query list, maxRowsPerQuery=25, includeCoverageGaps=false, includeHeldRows=false, includeDatasets=false.",
  "After success, record run id, build id, run status, failure state, default dataset id, dataset item count, sellable rows, sellable finding count, caveated rows, average buyer value, runtime, memory, usage cost, charged events, and no-leak result.",
  "Paste the complete observed proof once through TI_APIFY_OBSERVED_PROOF_JSON or TI_APIFY_OBSERVED_PROOF_PATH; partial marketplace or hosted proof imports are rejected.",
  "Compare hosted OUTPUT falsePositiveSuppressionGate.programCpHardening.secondBatchAudit against the paid-row integrity gate.",
  "Open Apify Store analytics and record analytics visibility, store views, runs, unique users, paid users, refunds, and conversion rate.",
  "Open Apify billing/payouts and Store pricing/listing, then record payout state, pricing model, listing visibility, public listing status, and last verified timestamp.",
  "Promote paid traffic only when hosted sellable rows are at least 500, hosted finding rows are at least 275, and payout, pricing, telemetry, listing state, refunds, and no-leak proof are observed."
];
