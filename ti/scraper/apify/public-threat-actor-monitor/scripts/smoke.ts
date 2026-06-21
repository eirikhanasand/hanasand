import { assertHostedDefaultParserLift } from "./hostedDefaultParserLiftSmoke.ts";

const root = new URL("..", import.meta.url).pathname;
const storage = `${root}/.apify-smoke-storage`;

await Bun.spawn(["rm", "-rf", storage], { stdout: "inherit", stderr: "inherit" }).exited;
await Bun.spawn(["mkdir", "-p", `${storage}/key_value_stores/default`], { stdout: "inherit", stderr: "inherit" }).exited;
await Bun.write(`${storage}/key_value_stores/default/INPUT.json`, JSON.stringify({
  queries: ["APT42"],
  includeDatasets: true,
  includeCoverageGaps: true,
  includeHeldRows: true,
  maxRowsPerQuery: 20
}, null, 2));

const proc = Bun.spawn({
  cmd: ["bun", "run", "src/main.ts"],
  cwd: root,
  env: {
    ...process.env,
    APIFY_LOCAL_STORAGE_DIR: storage,
    TI_ACTOR_FIXTURE_PATH: `${root}/fixtures/apt42.json`
  },
  stdout: "inherit",
  stderr: "inherit"
});

const code = await proc.exited;
if (code !== 0) process.exit(code);

const outputRecord = await Bun.file(`${storage}/key_value_stores/default/OUTPUT.json`).json() as Record<string, unknown>;
if (outputRecord.outputContract !== "safe_metadata_only.v1") {
  throw new Error("OUTPUT record must expose the safe metadata contract");
}
const output = outputRecord.rows as Array<Record<string, unknown>>;
if (!Array.isArray(output) || output.length < 4) {
  throw new Error(`Expected at least 4 output rows, got ${Array.isArray(output) ? output.length : "non-array"}`);
}
for (const row of output) {
  const publicBuyerText = `${row.buyerSummary ?? ""} ${row.recommendedBuyerAction ?? ""}`;
  if (
    typeof row.buyerSummary !== "string"
    || row.buyerSummary.length < 24
    || typeof row.recommendedBuyerAction !== "string"
    || row.recommendedBuyerAction.length < 12
    || !Array.isArray(row.keyPivots)
    || row.keyPivots.length < 1
    || !row.keyPivots.every((pivot) => typeof pivot === "string" && pivot.length > 0)
  ) {
    throw new Error("OUTPUT rows must expose buyer summaries, recommended actions, and key pivots");
  }
  if (/\b(agent_\d+|proof|blocker|governance|internal)\b/i.test(publicBuyerText)) {
    throw new Error("Buyer-facing row fields must avoid internal proof, blocker, governance, or agent wording");
  }
}
const monetization = outputRecord.monetization as Record<string, unknown> | undefined;
if (
  !monetization
  || monetization.enabled !== false
  || !["missing_actor_run_id", "missing_apify_token"].includes(String(monetization.skippedReason))
  || monetization.pricingModel !== "pay_per_event"
  || monetization.billingMode !== "apify_synthetic_events"
  || monetization.datasetItemCount !== output.length
  || typeof monetization.sellableRowCount !== "number"
  || typeof monetization.caveatedRowCount !== "number"
  || typeof monetization.coverageGapOnlyRowCount !== "number"
  || typeof monetization.holdRowCount !== "number"
  || typeof monetization.suppressedRowCount !== "number"
  || typeof monetization.chargeRecommendedRowCount !== "number"
  || !Array.isArray(monetization.eventNames)
  || !monetization.eventNames.includes("apify-actor-start")
  || !monetization.eventNames.includes("apify-default-dataset-item")
) {
  throw new Error("OUTPUT record must expose Apify synthetic-event monetization readiness");
}
const paidRowQuality = outputRecord.paidRowQuality as Record<string, unknown> | undefined;
if (
  !paidRowQuality
  || typeof paidRowQuality.sellable !== "number"
  || typeof paidRowQuality.included_with_caveat !== "number"
  || typeof paidRowQuality.coverage_gap_only !== "number"
  || typeof paidRowQuality.hold !== "number"
  || typeof paidRowQuality.suppress !== "number"
  || typeof paidRowQuality.averageBuyerValueScore !== "number"
) {
  throw new Error("OUTPUT record must expose paid-row quality counts");
}
const monetizationReadiness = outputRecord.monetizationReadiness as Record<string, unknown> | undefined;
if (
  !monetizationReadiness
  || !["ready_for_paid_traffic", "blocked_for_paid_traffic"].includes(String(monetizationReadiness.status))
  || monetizationReadiness.minimumProductionSellableRows !== 100
  || typeof monetizationReadiness.targetSellableRows !== "number"
  || typeof monetizationReadiness.sellableRows !== "number"
  || typeof monetizationReadiness.usefulForBuyerRows !== "number"
  || typeof monetizationReadiness.averageBuyerValueScore !== "number"
  || !Array.isArray(monetizationReadiness.blockers)
  || typeof monetizationReadiness.nextRevenueAction !== "string"
) {
  throw new Error("OUTPUT record must expose monetization readiness");
}
if (
  (monetizationReadiness.sellableRows as number) < 100
  && (
    monetizationReadiness.status !== "blocked_for_paid_traffic"
    || !(monetizationReadiness.blockers as string[]).includes("sellable_rows_below_100_production_floor")
  )
) {
  throw new Error("Runs below 100 sellable rows must be blocked for paid traffic");
}
const qualityLiftGate = outputRecord.qualityLiftGate as Record<string, unknown> | undefined;
if (
  !qualityLiftGate
  || qualityLiftGate.schemaVersion !== "ti.apify_paid_row_quality_lift_gate.v1"
  || qualityLiftGate.baselineRunId !== "iMQGeezZ8bx7WtlhQ"
  || qualityLiftGate.baselineDatasetId !== "5PLmkE30luBA5Lbgc"
  || qualityLiftGate.dryRun !== true
  || qualityLiftGate.willMutateSources !== false
  || qualityLiftGate.willStartCollection !== false
  || qualityLiftGate.qualityLiftAcceptedCount !== 5
  || qualityLiftGate.qualityLiftRejectedCount !== 5
  || typeof qualityLiftGate.sellableRowsAdded !== "number"
  || typeof qualityLiftGate.freshRowsAdded !== "number"
  || typeof qualityLiftGate.costPerUsefulRowDelta !== "number"
  || typeof qualityLiftGate.projectedRowRevenueDeltaUsd !== "number"
  || !Array.isArray(qualityLiftGate.acceptedExamples)
  || !Array.isArray(qualityLiftGate.rejectedExamples)
  || !Array.isArray(qualityLiftGate.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose the paid-row quality-lift gate");
}
if (qualityLiftGate.sellableRowsAdded < 2 || qualityLiftGate.freshRowsAdded < 5 || qualityLiftGate.costPerUsefulRowDelta >= 0) {
  throw new Error("Quality-lift gate must report buyer-visible sellable/fresh row improvement and lower cost per useful row");
}
for (const row of qualityLiftGate.acceptedExamples as Array<Record<string, unknown>>) {
  if (
    row.outcome !== "accepted"
    || !["included_with_caveat", "sellable"].includes(String(row.afterDecision))
    || typeof row.repairAction !== "string"
    || typeof row.usefulRowsDelta !== "number"
    || row.usefulRowsDelta < 1
    || !Array.isArray(row.proofNotes)
  ) {
    throw new Error("Accepted quality-lift examples must prove useful paid-output improvement");
  }
}
for (const row of qualityLiftGate.rejectedExamples as Array<Record<string, unknown>>) {
  if (
    row.outcome !== "rejected"
    || typeof row.rejectionReason !== "string"
    || Number(row.sellableRowsDelta ?? 0) !== 0
    || Number(row.usefulRowsDelta ?? 0) !== 0
    || !Array.isArray(row.proofNotes)
  ) {
    throw new Error("Rejected quality-lift examples must stay out of payworthy progress metrics");
  }
}
if (!(qualityLiftGate.ownerHandoffs as Array<Record<string, unknown>>).some((row) => row.owner === "agent_03" && Number(row.accepted) >= 1)) {
  throw new Error("Quality-lift gate must route accepted parser repairs to Agent 03");
}
const parserCaptureLiftGate = outputRecord.parserCaptureLiftGate as Record<string, unknown> | undefined;
if (
  !parserCaptureLiftGate
  || parserCaptureLiftGate.schemaVersion !== "ti.apify_parser_capture_lift_gate.v1"
  || parserCaptureLiftGate.owner !== "agent_03"
  || parserCaptureLiftGate.baselineRunId !== "OThlfd0uzSCNnedAO"
  || parserCaptureLiftGate.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || parserCaptureLiftGate.dryRun !== true
  || parserCaptureLiftGate.willMutateSources !== false
  || parserCaptureLiftGate.willStartCollection !== false
  || parserCaptureLiftGate.rejectedRepairsDoNotCount !== true
  || !Array.isArray(parserCaptureLiftGate.acceptedExamples)
  || parserCaptureLiftGate.acceptedExamples.length < 5
  || !Array.isArray(parserCaptureLiftGate.rejectedExamples)
  || parserCaptureLiftGate.rejectedExamples.length < 7
  || typeof parserCaptureLiftGate.measurableLift !== "object"
  || typeof parserCaptureLiftGate.noLeakBoundary !== "object"
) {
  throw new Error("OUTPUT record must expose Agent 03 parser/capture lift proof");
}
const parserCaptureLift = parserCaptureLiftGate.measurableLift as Record<string, unknown>;
if (
  Number(parserCaptureLift.rowsLifted) < 5
  || Number(parserCaptureLift.sellableRowsAdded) < 2
  || Number(parserCaptureLift.usefulRowsAdded) < 5
  || Number(parserCaptureLift.freshRowsAdded) < 5
  || Number(parserCaptureLift.estimatedAverageBuyerValueDelta) <= 0
) {
  throw new Error("Parser/capture lift gate must move sellable, useful, fresh, and buyer-value metrics");
}
for (const sourceFamily of ["rss_security_blog", "vendor_report", "cert_advisory", "github_security_advisory", "public_channel_handoff"]) {
  if (!(parserCaptureLift.sourceFamiliesImproved as string[]).includes(sourceFamily)) {
    throw new Error(`Parser/capture lift gate must improve ${sourceFamily}`);
  }
}
for (const blockerCode of ["generic_summary", "missing_sector_country", "missing_reported_time", "missing_corroboration", "missing_ttp_tool", "thin_apt42_public_channel_coverage"]) {
  if (!(parserCaptureLift.blockerCodesRemoved as string[]).includes(blockerCode)) {
    throw new Error(`Parser/capture lift gate must remove ${blockerCode}`);
  }
}
for (const row of parserCaptureLiftGate.acceptedExamples as Array<Record<string, unknown>>) {
  if (
    row.outcome !== "accepted"
    || row.beforeDecision === row.afterDecision
    || !["included_with_caveat", "sellable"].includes(String(row.afterDecision))
    || typeof row.repairAction !== "string"
    || !Array.isArray(row.buyerVisibleFieldsAdded)
    || row.buyerVisibleFieldsAdded.length < 5
    || !Array.isArray(row.blockerCodesRemoved)
    || Number(row.usefulRowsDelta) < 1
    || Number(row.freshRowsDelta) < 1
    || row.noLeak !== true
  ) {
    throw new Error("Accepted parser/capture repairs must prove buyer-visible useful/fresh row lift without leaks");
  }
}
const rejectedParserCaptureReasons = (parserCaptureLiftGate.rejectedExamples as Array<Record<string, unknown>>).map((row) => row.rejectedReason);
for (const rejectedReason of ["stale_report", "single_source_low_context", "duplicate_syndication", "unsafe_or_restricted_capture", "auth_captcha_private_source", "raw_url_or_body_leak", "credential_or_payload_material"]) {
  if (!rejectedParserCaptureReasons.includes(rejectedReason)) {
    throw new Error(`Parser/capture lift gate must reject ${rejectedReason}`);
  }
}
for (const row of parserCaptureLiftGate.rejectedExamples as Array<Record<string, unknown>>) {
  if (
    row.outcome !== "rejected"
    || typeof row.rejectedReason !== "string"
    || Number(row.sellableRowsDelta) !== 0
    || Number(row.usefulRowsDelta) !== 0
    || Number(row.freshRowsDelta) !== 0
    || row.noLeak !== true
  ) {
    throw new Error("Rejected parser/capture repairs must stay out of paid progress metrics");
  }
}
const parserCaptureNoLeak = parserCaptureLiftGate.noLeakBoundary as Record<string, unknown>;
for (const key of ["rawUrlExposed", "rawBodyExposed", "credentialPayloadMaterialExposed", "privateAuthCaptchaRequired", "restrictedRawMaterialExposed"]) {
  if (parserCaptureNoLeak[key] !== false) throw new Error(`Parser/capture lift gate must keep ${key} false`);
}
const graphLiftBatch2 = outputRecord.graphLiftBatch2 as Record<string, unknown> | undefined;
if (
  !graphLiftBatch2
  || graphLiftBatch2.schemaVersion !== "ti.apify_buyer_visible_graph_lift_batch_2.v1"
  || graphLiftBatch2.baselineRunId !== "OThlfd0uzSCNnedAO"
  || graphLiftBatch2.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || graphLiftBatch2.baselineQuery !== "APT42"
  || graphLiftBatch2.dryRun !== true
  || graphLiftBatch2.willMutateSources !== false
  || graphLiftBatch2.willStartCollection !== false
  || !Array.isArray(graphLiftBatch2.acceptedExamples)
  || !Array.isArray(graphLiftBatch2.rejectedGraphOnlyPromotions)
  || graphLiftBatch2.acceptedExamples.length < 1
  || graphLiftBatch2.rejectedGraphOnlyPromotions.length < 6
  || typeof graphLiftBatch2.measurableLift !== "object"
) {
  throw new Error("OUTPUT record must expose Program BO graph-lift gate");
}
const graphLift = graphLiftBatch2.measurableLift as Record<string, unknown>;
if (Number(graphLift.sellableRowsAdded) < 1 || Number(graphLift.projectedGrossRowRevenueDeltaUsd) <= 0) {
  throw new Error("Program BO graph-lift gate must project sellable row and row-revenue lift");
}
const rejectedGraphReasons = (graphLiftBatch2.rejectedGraphOnlyPromotions as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["stale_graph_context", "single_source_graph_context", "contradicted_graph_context", "restricted_only_graph_context", "missing_ledger_proof", "unrelated_actor_context"]) {
  if (!rejectedGraphReasons.includes(requiredReason)) throw new Error(`Program BO graph-lift batch must reject ${requiredReason}`);
}
for (const row of graphLiftBatch2.acceptedExamples as Array<Record<string, unknown>>) {
  if (
    row.afterDecision !== "sellable"
    || Number(row.sellableRowsDelta) !== 1
    || row.noLeak !== true
    || !Array.isArray(row.graphEvidenceAdds)
    || !row.graphEvidenceAdds.includes("source_corroboration")
    || !row.graphEvidenceAdds.includes("no_leak_provenance")
  ) {
    throw new Error("Accepted Program BO graph-lift rows must prove sellable, corroborated, no-leak lift");
  }
}
for (const row of graphLiftBatch2.rejectedGraphOnlyPromotions as Array<Record<string, unknown>>) {
  if (
    row.noLeak !== true
    || typeof row.blockedReason !== "string"
    || !["hold", "included_with_caveat"].includes(String(row.staysDecision))
    || typeof row.proofNote !== "string"
  ) {
    throw new Error("Rejected Program BO graph-only promotions must remain held or caveated with no-leak proof");
  }
}
const marketplaceGraphSignals = outputRecord.marketplaceGraphSignals as Record<string, unknown> | undefined;
if (
  !marketplaceGraphSignals
  || marketplaceGraphSignals.schemaVersion !== "ti.marketplace_graph_signals_gate.v1"
  || marketplaceGraphSignals.baselineRunId !== "OThlfd0uzSCNnedAO"
  || marketplaceGraphSignals.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || marketplaceGraphSignals.dryRun !== true
  || marketplaceGraphSignals.willMutateSources !== false
  || marketplaceGraphSignals.willStartCollection !== false
  || !Array.isArray(marketplaceGraphSignals.examples)
  || marketplaceGraphSignals.examples.length < 8
  || !Array.isArray(marketplaceGraphSignals.rejectedGraphInflation)
  || marketplaceGraphSignals.rejectedGraphInflation.length < 6
  || !Array.isArray(marketplaceGraphSignals.sourceParserHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BP marketplace graph signal gate");
}
const graphSignalActors = (marketplaceGraphSignals.examples as Array<Record<string, unknown>>).map((row) => row.actor);
for (const actor of ["APT29", "APT42", "Volt Typhoon", "Lazarus Group", "LockBit", "Akira", "Clop", "Scattered Spider"]) {
  if (!graphSignalActors.includes(actor)) throw new Error(`Marketplace graph signal examples must cover ${actor}`);
}
const graphSignalRejectedReasons = (marketplaceGraphSignals.rejectedGraphInflation as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["stale_graph_fact", "single_source_edge", "unrelated_actor_link", "restricted_only_context", "missing_ledger_proof", "no_fresh_change"]) {
  if (!graphSignalRejectedReasons.includes(requiredReason)) throw new Error(`Marketplace graph signals must reject ${requiredReason}`);
}
const graphPivotLiftGate = outputRecord.graphPivotLiftGate as Record<string, unknown> | undefined;
if (
  !graphPivotLiftGate
  || graphPivotLiftGate.schemaVersion !== "ti.apify_graph_pivot_lift_gate.v1"
  || graphPivotLiftGate.baselineRunId !== "OThlfd0uzSCNnedAO"
  || graphPivotLiftGate.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || graphPivotLiftGate.dryRun !== true
  || graphPivotLiftGate.willMutateSources !== false
  || graphPivotLiftGate.willStartCollection !== false
  || Number(graphPivotLiftGate.exampleCount) < 12
  || Number(graphPivotLiftGate.nextSearchPivotCount) <= 0
  || Number(graphPivotLiftGate.usefulPivotRate) <= 0
  || !Array.isArray(graphPivotLiftGate.rejectedBloatPivots)
  || graphPivotLiftGate.rejectedBloatPivots.length < 7
  || !Array.isArray(graphPivotLiftGate.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BQ graph pivot lift gate");
}
const graphPivotRejectedReasons = (graphPivotLiftGate.rejectedBloatPivots as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["generic_pivot", "stale_pivot", "contradicted_pivot", "unrelated_actor_pivot", "restricted_only_pivot", "missing_ledger_pivot", "single_source_without_caveat"]) {
  if (!graphPivotRejectedReasons.includes(requiredReason)) throw new Error(`Program BQ graph pivot gate must reject ${requiredReason}`);
}
const relationshipConfidenceGate = outputRecord.relationshipConfidenceGate as Record<string, unknown> | undefined;
if (
  !relationshipConfidenceGate
  || relationshipConfidenceGate.schemaVersion !== "ti.apify_relationship_confidence_gate.v1"
  || relationshipConfidenceGate.baselineRunId !== "OThlfd0uzSCNnedAO"
  || relationshipConfidenceGate.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || relationshipConfidenceGate.dryRun !== true
  || relationshipConfidenceGate.willMutateSources !== false
  || relationshipConfidenceGate.willStartCollection !== false
  || Number(relationshipConfidenceGate.exampleCount) < 20
  || Number(relationshipConfidenceGate.usefulPivotCount) <= 0
  || Number(relationshipConfidenceGate.actionPivotCount) <= 0
  || Number(relationshipConfidenceGate.corroboratedPivotCount) <= 0
  || Number(relationshipConfidenceGate.rejectedUnsupportedPivotCount) < 8
  || Number(relationshipConfidenceGate.nextSearchCount) <= 0
  || Number(relationshipConfidenceGate.averageBuyerValueDelta) <= 0
  || !Array.isArray(relationshipConfidenceGate.rejectedUnsupportedPivots)
  || relationshipConfidenceGate.rejectedUnsupportedPivots.length < 8
  || !Array.isArray(relationshipConfidenceGate.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BW relationship confidence gate");
}
const relationshipConfidenceRejectedReasons = (relationshipConfidenceGate.rejectedUnsupportedPivots as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["generic_pivot", "stale_pivot", "contradicted_pivot", "unrelated_actor_pivot", "restricted_only_pivot", "missing_ledger_pivot", "single_source_without_caveat", "no_action_pivot"]) {
  if (!relationshipConfidenceRejectedReasons.includes(requiredReason)) throw new Error(`Program BW relationship confidence gate must reject ${requiredReason}`);
}
const paidGraphSearchPackGate = outputRecord.paidGraphSearchPackGate as Record<string, unknown> | undefined;
if (
  !paidGraphSearchPackGate
  || paidGraphSearchPackGate.schemaVersion !== "ti.apify_paid_graph_search_pack_gate.v1"
  || paidGraphSearchPackGate.baselineRunId !== "OThlfd0uzSCNnedAO"
  || paidGraphSearchPackGate.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || paidGraphSearchPackGate.dryRun !== true
  || paidGraphSearchPackGate.willMutateSources !== false
  || paidGraphSearchPackGate.willStartCollection !== false
  || Number(paidGraphSearchPackGate.packCount) < 25
  || Number(paidGraphSearchPackGate.usefulNextSearchCount) <= 0
  || Number(paidGraphSearchPackGate.unsupportedPivotsSuppressed) < 8
  || Number(paidGraphSearchPackGate.rowsPromotedFromGenericToUseful) < 10
  || Number(paidGraphSearchPackGate.marketplaceSampleRowsImproved) < 10
  || Number(paidGraphSearchPackGate.averageBuyerValueDelta) <= 0
  || !Array.isArray(paidGraphSearchPackGate.examples)
  || paidGraphSearchPackGate.examples.length < 25
  || !Array.isArray(paidGraphSearchPackGate.rejectionGates)
  || paidGraphSearchPackGate.rejectionGates.length < 8
  || !Array.isArray(paidGraphSearchPackGate.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BX paid graph search pack gate");
}
const paidGraphPackRejectionReasons = (paidGraphSearchPackGate.rejectionGates as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["stale_only_evidence", "generic_relationship", "missing_provenance", "no_buyer_action", "unsafe_raw_content", "unsupported_alias_expansion", "single_source_without_caveat", "unrelated_pivot"]) {
  if (!paidGraphPackRejectionReasons.includes(requiredReason)) throw new Error(`Program BX paid graph search packs must reject ${requiredReason}`);
}
const hundredSellableRowGraphPivotPlan = outputRecord.hundredSellableRowGraphPivotPlan as Record<string, unknown> | undefined;
if (
  !hundredSellableRowGraphPivotPlan
  || hundredSellableRowGraphPivotPlan.schemaVersion !== "ti.apify_100_sellable_row_graph_pivot_plan.v1"
  || hundredSellableRowGraphPivotPlan.baselineRunId !== "OThlfd0uzSCNnedAO"
  || hundredSellableRowGraphPivotPlan.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || hundredSellableRowGraphPivotPlan.targetSellableRows !== 100
  || hundredSellableRowGraphPivotPlan.dryRun !== true
  || hundredSellableRowGraphPivotPlan.willMutateSources !== false
  || hundredSellableRowGraphPivotPlan.willStartCollection !== false
  || Number(hundredSellableRowGraphPivotPlan.projectedSellableRows) < 100
  || Number(hundredSellableRowGraphPivotPlan.projectedUsefulRows) < 100
  || Number(hundredSellableRowGraphPivotPlan.projectedFreshRows) < 100
  || Number(hundredSellableRowGraphPivotPlan.projectedSourceFamilyDiversity) < 5
  || Number(hundredSellableRowGraphPivotPlan.nextSearchPivotCount) < 60
  || Number(hundredSellableRowGraphPivotPlan.averageBuyerValueDelta) <= 0
  || Number(hundredSellableRowGraphPivotPlan.rowsPreventedFromBilling) < 40
  || !Array.isArray(hundredSellableRowGraphPivotPlan.watchlistPlans)
  || hundredSellableRowGraphPivotPlan.watchlistPlans.length < 20
  || !Array.isArray(hundredSellableRowGraphPivotPlan.rejectionGates)
  || hundredSellableRowGraphPivotPlan.rejectionGates.length < 8
  || !Array.isArray(hundredSellableRowGraphPivotPlan.repairHandoffs)
) {
  throw new Error("OUTPUT record must expose Program CA 100-sellable-row graph pivot plan");
}
const hundredSellableRejectionReasons = (hundredSellableRowGraphPivotPlan.rejectionGates as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["stale_only", "single_source_without_caveat", "contradicted", "unrelated", "missing_provenance", "unsafe_restricted_only", "alias_only", "not_actionable"]) {
  if (!hundredSellableRejectionReasons.includes(requiredReason)) throw new Error(`Program CA graph pivot plan must reject ${requiredReason}`);
}
for (const row of hundredSellableRowGraphPivotPlan.watchlistPlans as Array<Record<string, unknown>>) {
  if (
    typeof row.actor !== "string"
    || !["apt", "ransomware"].includes(String(row.family))
    || Number(row.projectedSellableRows) < 1
    || !Array.isArray(row.sourceFamiliesNeeded)
    || row.sourceFamiliesNeeded.length < 2
    || !Array.isArray(row.graphPivots)
    || row.graphPivots.length < 3
    || !Array.isArray(row.nextSearches)
    || row.nextSearches.length < 3
    || !Array.isArray(row.parserNeeds)
    || !Array.isArray(row.sourceNeeds)
    || row.noLeak !== true
  ) {
    throw new Error("Program CA watchlist plans must include specific pivots, repairs, and no-leak proof");
  }
}
const hundredSellableNoLeak = hundredSellableRowGraphPivotPlan.noLeakBoundary as Record<string, unknown> | undefined;
if (
  !hundredSellableNoLeak
  || hundredSellableNoLeak.rawEvidenceBodies !== false
  || hundredSellableNoLeak.unsafeUrls !== false
  || hundredSellableNoLeak.credentials !== false
  || hundredSellableNoLeak.leakedFiles !== false
  || hundredSellableNoLeak.privateMaterial !== false
  || hundredSellableNoLeak.actorInteraction !== false
) {
  throw new Error("Program CA graph pivot plan must preserve the no-leak boundary");
}
const parserToSellableRepairPacket = outputRecord.parserToSellableRepairPacket as Record<string, unknown> | undefined;
if (
  !parserToSellableRepairPacket
  || parserToSellableRepairPacket.schemaVersion !== "ti.apify_parser_to_100_sellable_rows_packet.v1"
  || parserToSellableRepairPacket.owner !== "agent_03"
  || parserToSellableRepairPacket.baselineRunId !== "OThlfd0uzSCNnedAO"
  || parserToSellableRepairPacket.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || parserToSellableRepairPacket.targetSellableRows !== 100
  || parserToSellableRepairPacket.dryRun !== true
  || parserToSellableRepairPacket.willMutateSources !== false
  || parserToSellableRepairPacket.willStartCollection !== false
  || parserToSellableRepairPacket.productionSellableClaimed !== false
  || parserToSellableRepairPacket.candidateDecision !== "sellable_candidate_after_parser_repair"
  || Number(parserToSellableRepairPacket.projectedCandidateRows) < 20
  || Number(parserToSellableRepairPacket.projectedUsefulRows) < 20
  || Number(parserToSellableRepairPacket.projectedFreshRows) < 20
  || !Array.isArray(parserToSellableRepairPacket.candidates)
  || parserToSellableRepairPacket.candidates.length < 12
  || !Array.isArray(parserToSellableRepairPacket.rejectedRepairs)
  || parserToSellableRepairPacket.rejectedRepairs.length < 7
  || !Array.isArray(parserToSellableRepairPacket.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program CD parser-to-100 sellable repair packet");
}
for (const row of parserToSellableRepairPacket.candidates as Array<Record<string, unknown>>) {
  if (
    row.dryRunDecision !== "sellable_candidate_after_parser_repair"
    || Number(row.projectedRows) < 1
    || !Array.isArray(row.parserFieldsUnlocking)
    || (row.parserFieldsUnlocking as string[]).length < 5
    || !Array.isArray(row.sourceFamilyGaps)
    || !Array.isArray(row.graphPivotGaps)
    || !Array.isArray(row.suppressionChecks)
    || typeof row.provenanceHash !== "string"
    || row.provenanceHash.length === 0
    || !Array.isArray(row.nextBuyerSearches)
    || row.requiresSourceCorroboration !== true
    || row.noLeak !== true
  ) {
    throw new Error("Program CD parser candidates must stay dry-run, source-backed, graph-linked, and no-leak");
  }
}
const parserSellableRejectedReasons = (parserToSellableRepairPacket.rejectedRepairs as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["stale_report", "alias_collision", "unrelated_actor_co_mention", "generic_marketing_page", "raw_body_or_unsafe_url_request", "payload_request", "private_auth_captcha_dependency"]) {
  if (!parserSellableRejectedReasons.includes(requiredReason)) throw new Error(`Program CD parser repair packet must reject ${requiredReason}`);
}
for (const row of parserToSellableRepairPacket.rejectedRepairs as Array<Record<string, unknown>>) {
  if (Number(row.projectedRows) !== 0 || row.doesNotCountToward100Floor !== true || row.noLeak !== true) {
    throw new Error("Program CD rejected parser repairs must not count toward the 100-row floor");
  }
}
const parserSellableNoLeak = parserToSellableRepairPacket.noLeakBoundary as Record<string, unknown> | undefined;
if (
  !parserSellableNoLeak
  || parserSellableNoLeak.rawBodiesExposed !== false
  || parserSellableNoLeak.unsafeUrlsExposed !== false
  || parserSellableNoLeak.payloadsRequested !== false
  || parserSellableNoLeak.privateAuthCaptchaAccess !== false
  || parserSellableNoLeak.restrictedMaterialExposed !== false
  || parserSellableNoLeak.productionSellableClaimed !== false
) {
  throw new Error("Program CD parser repair packet must preserve no-leak and no-production-claim boundaries");
}
const parserRealSellableLift = outputRecord.parserRealSellableLift as Record<string, unknown> | undefined;
if (
  !parserRealSellableLift
  || parserRealSellableLift.schemaVersion !== "ti.apify_parser_real_sellable_lift.v1"
  || parserRealSellableLift.owner !== "agent_03"
  || parserRealSellableLift.baselineRunId !== "OThlfd0uzSCNnedAO"
  || parserRealSellableLift.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || parserRealSellableLift.dryRun !== false
  || parserRealSellableLift.willMutateSources !== false
  || parserRealSellableLift.willStartCollection !== false
  || parserRealSellableLift.productionSellableClaimed !== false
  || Number(parserRealSellableLift.repairedRowCount) < 15
  || Number(parserRealSellableLift.promotedSellableRows) < 20
  || Number(parserRealSellableLift.movedToUsefulCaveatedRows) < 9
  || !Array.isArray(parserRealSellableLift.parserFieldsRequired)
  || !Array.isArray(parserRealSellableLift.repairedRows)
  || !Array.isArray(parserRealSellableLift.rejectionRows)
  || !Array.isArray(parserRealSellableLift.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program CJ real parser sellable lift packet");
}
for (const requiredField of ["actor", "victim", "sector", "country", "dataset_or_impact", "ttp_tool", "first_seen", "last_seen", "source_family_support", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_buyer_search"]) {
  if (!(parserRealSellableLift.parserFieldsRequired as string[]).includes(requiredField)) throw new Error(`Program CJ parser lift must require ${requiredField}`);
}
for (const row of parserRealSellableLift.repairedRows as Array<Record<string, unknown>>) {
  if (
    !["sellable", "included_with_caveat"].includes(String(row.repairedDecision))
    || Number(row.sellableRowsDelta) + Number(row.usefulCaveatedRowsDelta) < 1
    || typeof row.victim !== "string"
    || typeof row.sector !== "string"
    || typeof row.country !== "string"
    || typeof row.datasetOrImpact !== "string"
    || typeof row.ttpOrTool !== "string"
    || typeof row.firstSeen !== "string"
    || typeof row.lastSeen !== "string"
    || !Array.isArray(row.sourceFamilySupport)
    || Number(row.confidence) <= 0
    || typeof row.caveat !== "string"
    || row.contradictionState !== "none"
    || typeof row.provenanceHash !== "string"
    || row.provenanceHash.length === 0
    || typeof row.replayRef !== "string"
    || !row.replayRef.startsWith("replay:")
    || typeof row.nextBuyerSearch !== "string"
    || !Array.isArray(row.graphPivots)
    || row.noLeak !== true
  ) {
    throw new Error("Program CJ repaired parser rows must be source-backed, replayable, buyer-searchable, and no-leak");
  }
}
const parserRealRejectedReasons = (parserRealSellableLift.rejectionRows as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["stale_report", "alias_collision", "unrelated_actor_co_mention", "generic_marketing_page", "unsafe_source_request"]) {
  if (!parserRealRejectedReasons.includes(requiredReason)) throw new Error(`Program CJ parser lift must reject ${requiredReason}`);
}
for (const row of parserRealSellableLift.rejectionRows as Array<Record<string, unknown>>) {
  if (row.countsTowardSellableLift !== false || row.noLeak !== true) {
    throw new Error("Program CJ rejected rows must not count toward real sellable lift");
  }
}
const parserRealNoLeak = parserRealSellableLift.noLeakBoundary as Record<string, unknown> | undefined;
if (
  !parserRealNoLeak
  || parserRealNoLeak.rawBodiesExposed !== false
  || parserRealNoLeak.unsafeUrlsExposed !== false
  || parserRealNoLeak.objectKeysExposed !== false
  || parserRealNoLeak.credentialsExposed !== false
  || parserRealNoLeak.payloadsRequested !== false
  || parserRealNoLeak.privateMaterialUsed !== false
  || parserRealNoLeak.actorInteractionTextUsed !== false
  || parserRealNoLeak.productionSellableClaimed !== false
) {
  throw new Error("Program CJ real parser lift must preserve no-leak and no-production-claim boundaries");
}
const liveSourceAdmissionPacket = parserRealSellableLift.liveSourceAdmissionPacket as Record<string, unknown> | undefined;
if (
  !liveSourceAdmissionPacket
  || liveSourceAdmissionPacket.schemaVersion !== "ti.apify_live_source_parser_admission.v1"
  || liveSourceAdmissionPacket.owner !== "agent_03"
  || liveSourceAdmissionPacket.candidateRowCount !== 40
  || liveSourceAdmissionPacket.movedToSellableRows !== 36
  || liveSourceAdmissionPacket.usefulCaveatedRows !== 8
  || liveSourceAdmissionPacket.suppressedRows !== 10
  || liveSourceAdmissionPacket.rowsStillOneRepairAway !== 18
  || !Array.isArray(liveSourceAdmissionPacket.candidateRows)
  || !Array.isArray(liveSourceAdmissionPacket.suppressedClasses)
  || !Array.isArray(liveSourceAdmissionPacket.ownerHandoffs)
) {
  throw new Error("Program CO live source parser admission packet must expose 40 rich candidate rows");
}
const liveSourceProgress = liveSourceAdmissionPacket.estimatedProgressToward100 as Record<string, unknown> | undefined;
if (
  !liveSourceProgress
  || liveSourceProgress.projectedSellableRowsAfterAdmission !== 52
  || liveSourceProgress.remainingRowsTo100 !== 48
  || liveSourceProgress.progressRatio !== 0.52
  || liveSourceProgress.countsAsProductionClaim !== false
) {
  throw new Error("Program CO admission progress must show honest progress toward 100 without a production claim");
}
const liveSourceRows = liveSourceAdmissionPacket.candidateRows as Array<Record<string, unknown>>;
for (const row of liveSourceRows) {
  const noLeakProof = row.noLeakProof as Record<string, unknown> | undefined;
  if (
    typeof row.actor !== "string"
    || typeof row.actorFamily !== "string"
    || typeof row.victimOrTarget !== "string"
    || typeof row.sector !== "string"
    || typeof row.countryOrRegion !== "string"
    || typeof row.datasetOrImpact !== "string"
    || typeof row.ttpToolOrCve !== "string"
    || typeof row.firstSeen !== "string"
    || typeof row.lastSeen !== "string"
    || typeof row.sourceFamily !== "string"
    || Number(row.confidence) <= 0
    || typeof row.caveat !== "string"
    || typeof row.provenanceHash !== "string"
    || String(row.provenanceHash).length === 0
    || typeof row.nextBuyerSearch !== "string"
    || String(row.nextBuyerSearch).length === 0
    || !noLeakProof
    || Object.values(noLeakProof).some((value) => value !== false)
  ) {
    throw new Error("Program CO admission rows must keep parser fields, provenance, buyer search, and no-leak proof");
  }
}
for (const requiredActor of ["APT29", "APT28", "APT42", "Volt Typhoon", "Lazarus Group", "Turla", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin"]) {
  if (!liveSourceRows.some((row) => row.actor === requiredActor)) throw new Error(`Program CO admission packet must include ${requiredActor}`);
}
if (liveSourceRows.filter((row) => row.admissionDecision === "sellable").length !== 30) throw new Error("Program CO admission packet must include 30 sellable candidate rows");
if (liveSourceRows.filter((row) => row.admissionDecision === "useful_caveated").length !== 6) throw new Error("Program CO admission packet must include 6 useful caveated rows");
if (liveSourceRows.filter((row) => row.admissionDecision === "suppress").length !== 4) throw new Error("Program CO admission packet must include 4 suppression rows");
assertHostedDefaultParserLift(parserRealSellableLift);
const currentAdmissionLedger = parserRealSellableLift.currentAdmissionLedger as Record<string, unknown> | undefined;
if (
  !currentAdmissionLedger
  || currentAdmissionLedger.schemaVersion !== "ti.program_cw_parser_live_source_current_admission.v1"
  || currentAdmissionLedger.owner !== "agent_03"
  || currentAdmissionLedger.baselineCurrentSellableRows !== 4
  || Number(currentAdmissionLedger.rowsAdmittedThisPass) < 4
  || Number(currentAdmissionLedger.currentSellableRowsAfterAdmission) <= 4
  || Number(currentAdmissionLedger.usefulRowsAfterAdmission) < Number(currentAdmissionLedger.currentSellableRowsAfterAdmission)
  || Number(currentAdmissionLedger.buyerValueLift) <= 0
  || !Array.isArray(currentAdmissionLedger.admittedRows)
  || !Array.isArray(currentAdmissionLedger.falsePositiveSuppressions)
  || typeof currentAdmissionLedger.blockedLedger !== "object"
  || typeof currentAdmissionLedger.noLeakBoundary !== "object"
) {
  throw new Error("Program CW current parser admission ledger must show current sellable-row lift");
}
for (const row of currentAdmissionLedger.admittedRows as Array<Record<string, unknown>>) {
  if (
    row.actor !== "APT42"
    || row.rowType !== "activity"
    || Number(row.sourceEvidenceCount) < 4
    || !Array.isArray(row.requiredFieldsPresent)
    || !(row.requiredFieldsPresent as string[]).includes("victim_or_target")
    || !(row.requiredFieldsPresent as string[]).includes("ttp_tool_or_cve")
    || !Array.isArray(row.missingFields)
    || row.missingFields.length !== 0
    || typeof row.nextBuyerSearch !== "string"
    || String(row.nextBuyerSearch).length === 0
    || typeof row.provenanceHash !== "string"
    || String(row.provenanceHash).length === 0
    || row.countsTowardCurrentSellableRows !== true
    || row.noLeak !== true
  ) {
    throw new Error("Program CW admitted rows must carry complete parser proof and count as current sellable rows");
  }
}
for (const row of currentAdmissionLedger.falsePositiveSuppressions as Array<Record<string, unknown>>) {
  if (row.countsTowardCurrentSellableRows !== false || typeof row.proof !== "string" || String(row.proof).length === 0) {
    throw new Error("Program CW suppression ledger must keep false positives outside current sellable rows");
  }
}
for (const key of ["rawBodiesExposed", "unsafeUrlsExposed", "restrictedPayloadsExposed", "credentialsExposed", "privateMaterialUsed", "actorInteractionTextUsed"]) {
  if ((currentAdmissionLedger.noLeakBoundary as Record<string, unknown>)[key] !== false) throw new Error(`Program CW no-leak boundary must keep ${key} false`);
}
if (Number(paidRowQuality.sellable) < Number(currentAdmissionLedger.currentSellableRowsAfterAdmission)) {
  throw new Error("Program CW ledger must agree with paid-row quality sellable count");
}
const findingAdmissionLedger = parserRealSellableLift.findingAdmissionLedger as Record<string, unknown> | undefined;
if (
  !findingAdmissionLedger
  || findingAdmissionLedger.schemaVersion !== "ti.program_cx_100_name_activity_parser_lift.v1"
  || findingAdmissionLedger.owner !== "agent_03"
  || findingAdmissionLedger.baseline100NameRows !== 607
  || findingAdmissionLedger.baselineSellableRows !== 187
  || findingAdmissionLedger.baselineSellableSourceProvenanceRows !== 135
  || findingAdmissionLedger.baselineSellableFindingRows !== 52
  || Number(findingAdmissionLedger.currentSellableRows) !== Number(paidRowQuality.sellable)
  || Number(findingAdmissionLedger.currentSellableFindingRows) < 7
  || Number(findingAdmissionLedger.currentSellableSourceProvenanceRows) < 4
  || Number(findingAdmissionLedger.activityTargetTtpRowsAdmittedThisPass) < 4
  || !Array.isArray(findingAdmissionLedger.admittedFindingRows)
  || !Array.isArray(findingAdmissionLedger.perQueryAdmission)
  || !Array.isArray(findingAdmissionLedger.heldFindingRows)
  || !Array.isArray(findingAdmissionLedger.rejectionReasonCounts)
  || !Array.isArray(findingAdmissionLedger.remainingBlockers)
) {
  throw new Error("Program CX finding admission ledger must separate sellable findings from source-provenance rows");
}
for (const row of findingAdmissionLedger.admittedFindingRows as Array<Record<string, unknown>>) {
  if (typeof row.query !== "string" || !["activity", "target", "ttp"].includes(String(row.rowType)) || Number(row.sourceEvidenceCount) < 4 || row.noLeak !== true) {
    throw new Error("Program CX admitted finding rows must be activity/target/TTP findings with public proof");
  }
}
for (const reason of ["source_provenance_only", "generic_actor_profile", "stale_without_recent_corroboration", "alias_only", "graph_only", "restricted_without_public_support", "duplicate_claim"]) {
  if (!(findingAdmissionLedger.rejectionReasonCounts as Array<Record<string, unknown>>).some((row) => row.reason === reason && row.countsTowardSellableFindingFloor === false)) {
    throw new Error(`Program CY finding density ledger must expose ${reason} rejection counts`);
  }
  if (!(findingAdmissionLedger.tier1000Gate as Record<string, unknown> | undefined)?.requiredRejectionReasons || !((findingAdmissionLedger.tier1000Gate as Record<string, unknown>).requiredRejectionReasons as string[]).includes(reason)) {
    throw new Error(`Program CY 1,000-row gate must require ${reason}`);
  }
}
if (
  (findingAdmissionLedger.deterministic100NameProof as Record<string, unknown> | undefined)?.proofRows !== 1000
  || (findingAdmissionLedger.deterministic100NameProof as Record<string, unknown>).sellableRowsPreserved !== 187
  || (findingAdmissionLedger.deterministic100NameProof as Record<string, unknown>).sellableFindingsBaseline !== 52
  || (findingAdmissionLedger.deterministic100NameProof as Record<string, unknown>).sellableSourceProvenanceRows !== 135
  || (findingAdmissionLedger.deterministic100NameProof as Record<string, unknown>).sourceProvenanceRowsCountTowardFindingFloor !== false
  || Number((findingAdmissionLedger.deterministic100NameProof as Record<string, unknown>).projectedFindingRowsAfterCurrentParserBatch) < 52
  || (findingAdmissionLedger.tier1000Gate as Record<string, unknown> | undefined)?.schemaVersion !== "ti.program_cy_1000_row_finding_density_gate.v1"
  || Number((findingAdmissionLedger.tier1000Gate as Record<string, unknown>).minimumRows) !== 1000
  || (findingAdmissionLedger.tier1000Gate as Record<string, unknown>).countsProjectedRowsAsPaid !== false
) {
  throw new Error("Program CY finding density ledger must preserve 100-name proof and expose 1,000-row gate");
}
const publicSupportCandidateAdmission = findingAdmissionLedger.publicSupportCandidateAdmission as Record<string, unknown> | undefined;
if (
  !publicSupportCandidateAdmission
  || publicSupportCandidateAdmission.schemaVersion !== "ti.program_cz_public_support_candidate_admission.v1"
  || publicSupportCandidateAdmission.owner !== "agent_03"
  || !Array.isArray(publicSupportCandidateAdmission.sourcePackets)
  || !(publicSupportCandidateAdmission.sourcePackets as string[]).includes("darkMetadataPublicSupportLift4000.publicSupportSellable250")
  || !(publicSupportCandidateAdmission.sourcePackets as string[]).includes("graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff")
  || Number(publicSupportCandidateAdmission.acceptedCount) < 25
  || Number(publicSupportCandidateAdmission.acceptedCount) !== 63
  || Number(publicSupportCandidateAdmission.rejectedCount) !== 116
  || !Array.isArray(publicSupportCandidateAdmission.acceptedRows)
  || !Array.isArray(publicSupportCandidateAdmission.rejectionReasons)
  || !Array.isArray(publicSupportCandidateAdmission.sourceFamilies)
) {
  throw new Error("Program CZ public support admission must expose accepted/rejected parser candidates");
}
const publicSupportAcceptedRows = publicSupportCandidateAdmission.acceptedRows as Array<Record<string, unknown>>;
if (
  publicSupportAcceptedRows.length !== 63
  || publicSupportAcceptedRows.filter((row) => row.sourcePacket === "publicSupportSellable250").length !== 38
  || publicSupportAcceptedRows.filter((row) => row.sourcePacket === "graphPublicParserAdmissionHandoff").length !== 25
) {
  throw new Error("Program CZ public support admission must convert Agent 05 and Agent 08 handoffs into parser-admission rows");
}
for (const row of publicSupportAcceptedRows) {
  if (
    typeof row.actor !== "string"
    || typeof row.victimOrTarget !== "string"
    || typeof row.sector !== "string"
    || typeof row.country !== "string"
    || typeof row.ttpOrTool !== "string"
    || typeof row.datasetClaim !== "string"
    || typeof row.safePublicSourceId !== "string"
    || typeof row.provenanceHash !== "string"
    || row.countsTowardSellableRowsNow !== false
    || row.countsAfterParserAdmission !== true
    || row.noLeak !== true
  ) {
    throw new Error("Program CZ accepted rows must preserve buyer fields, provenance, and no-leak proof without current paid credit");
  }
}
for (const reason of ["needs_public_support", "stale_public_support", "duplicate_claim", "unsafe_restricted_only", "generic_source_only", "contradicted_public_proof", "graph_only_without_public_source"]) {
  if (!(publicSupportCandidateAdmission.rejectionReasons as Array<Record<string, unknown>>).some((row) => row.reason === reason && row.countsTowardSellableRows === false)) {
    throw new Error(`Program CZ public support admission must reject ${reason} with buyer-trust reason`);
  }
}
const publicSupportTierEffect = publicSupportCandidateAdmission.projected300RowTierEffect as Record<string, unknown> | undefined;
if (
  !publicSupportTierEffect
  || Number(publicSupportTierEffect.currentSellableRows) !== 187
  || Number(publicSupportTierEffect.projectedSellableRowsAfterAdmission) !== 250
  || Number(publicSupportTierEffect.projectedSellableFindingsAfterAdmission) !== 115
  || Number(publicSupportTierEffect.remainingSellableGap) !== 50
  || Number(publicSupportTierEffect.remainingFindingGap) !== 5
  || Number(publicSupportTierEffect.sourceProvenanceShareAfterAdmission) !== 0.54
  || Number(publicSupportTierEffect.projectedAtTargetSellableRows) !== 300
  || Number(publicSupportTierEffect.projectedAtTargetSellableFindings) !== 165
  || publicSupportTierEffect.countsProjectedRowsAsPaid !== false
) {
  throw new Error("Program CZ public support admission must show the deterministic path from 187 toward the 300-row tier");
}
if (
  (publicSupportCandidateAdmission.noLeakBoundary as Record<string, unknown> | undefined)?.productionSellableClaimed !== false
  || (publicSupportCandidateAdmission.noLeakBoundary as Record<string, unknown>).restrictedPayloadsExposed !== false
) {
  throw new Error("Program CZ public support admission must keep projections out of paid claims and expose no restricted payloads");
}
const currentSellableAdmissionLift = findingAdmissionLedger.currentSellableAdmissionLift as Record<string, unknown> | undefined;
if (
  !currentSellableAdmissionLift
  || currentSellableAdmissionLift.schemaVersion !== "ti.program_da_current_sellable_admission_lift.v1"
  || currentSellableAdmissionLift.owner !== "agent_03"
  || Number(currentSellableAdmissionLift.acceptedCurrentRowsCount) !== 63
  || Number(currentSellableAdmissionLift.sourceProvenanceRowsConvertedToFindings) !== 23
  || Number(currentSellableAdmissionLift.rejectedRowsCount) !== 235
  || Number(currentSellableAdmissionLift.currentSellableRowsAfterAdmission) !== 250
  || Number(currentSellableAdmissionLift.currentSellableFindingsAfterAdmission) !== 138
  || Number(currentSellableAdmissionLift.currentSellableSourceProvenanceRowsAfterAdmission) !== 112
  || Number(currentSellableAdmissionLift.sourceProvenanceShareAfterAdmission) !== 0.448
  || currentSellableAdmissionLift.countsTowardLocalCurrentPaidPreset !== true
  || currentSellableAdmissionLift.countsTowardHostedPaidProof !== false
  || !Array.isArray(currentSellableAdmissionLift.acceptedRows)
  || !Array.isArray(currentSellableAdmissionLift.convertedSourceProvenanceRows)
  || !Array.isArray(currentSellableAdmissionLift.rejectedRows)
) {
  throw new Error("Program DA current sellable admission lift must expose 250-row local current proof");
}
const currentAcceptedRows = currentSellableAdmissionLift.acceptedRows as Array<Record<string, unknown>>;
if (
  currentAcceptedRows.length !== 63
  || currentAcceptedRows.filter((row) => row.sourcePacket === "agent05_current_chargeable100").length !== 38
  || currentAcceptedRows.filter((row) => row.sourcePacket === "agent08_parser_handoff").length !== 17
  || currentAcceptedRows.filter((row) => row.sourcePacket === "existing_public_source_row").length !== 8
) {
  throw new Error("Program DA current sellable admission lift must draw from Agent 05, Agent 08, and existing public source rows");
}
for (const row of currentAcceptedRows) {
  if (
    typeof row.actor !== "string"
    || typeof row.victimOrTarget !== "string"
    || typeof row.sector !== "string"
    || typeof row.country !== "string"
    || typeof row.ttpOrTool !== "string"
    || typeof row.firstSeen !== "string"
    || typeof row.lastSeen !== "string"
    || Number(row.confidence) < 0.82
    || typeof row.provenanceHash !== "string"
    || typeof row.buyerReason !== "string"
    || row.countsTowardCurrentSellableRows !== true
    || row.countsTowardHostedPaidProof !== false
    || row.noLeak !== true
  ) {
    throw new Error("Program DA accepted rows must be current, specific, public-supported, provenance-backed, and local-only");
  }
}
for (const row of currentSellableAdmissionLift.convertedSourceProvenanceRows as Array<Record<string, unknown>>) {
  if (row.countsTowardSellableFindingFloor !== true || row.noLeak !== true) {
    throw new Error("Program DA converted source-provenance rows must become true findings without leaks");
  }
}
for (const reason of ["projection_only", "graph_only", "restricted_only", "generic_actor_or_source_page", "stale_latest_error", "duplicate_claim", "contradicted_public_proof", "missing_required_fields"]) {
  if (!(currentSellableAdmissionLift.rejectedRows as Array<Record<string, unknown>>).some((row) => row.reason === reason && row.countsTowardCurrentSellableRows === false)) {
    throw new Error(`Program DA current sellable admission lift must reject ${reason}`);
  }
}
const currentLiftProgress = currentSellableAdmissionLift.targetProgress as Record<string, unknown> | undefined;
if (
  !currentLiftProgress
  || Number(currentLiftProgress.targetCurrentSellableRows) !== 250
  || Number(currentLiftProgress.remainingGapTo250) !== 0
  || Number(currentLiftProgress.targetCurrentSellableFindings) !== 95
  || Number(currentLiftProgress.remainingFindingGapTo95) !== 0
  || Number(currentLiftProgress.maximumSourceProvenanceShare) !== 0.45
  || Number(currentLiftProgress.remainingGapTo300) !== 50
) {
  throw new Error("Program DA current sellable admission lift must show the 250-row gate pass and 300-row gap");
}
if (
  (currentSellableAdmissionLift.noLeakBoundary as Record<string, unknown> | undefined)?.hostedPaidProofClaimed !== false
  || (currentSellableAdmissionLift.noLeakBoundary as Record<string, unknown>).restrictedPayloadsExposed !== false
) {
  throw new Error("Program DA current sellable admission lift must not claim hosted proof or expose restricted payloads");
}
const currentSellable300Lift = findingAdmissionLedger.currentSellable300Lift as Record<string, unknown> | undefined;
if (
  !currentSellable300Lift
  || currentSellable300Lift.schemaVersion !== "ti.program_db_current_sellable_300_lift.v1"
  || currentSellable300Lift.owner !== "agent_03"
  || Number(currentSellable300Lift.acceptedCurrentRowsCount) !== 50
  || Number(currentSellable300Lift.sourceProvenanceRowsConvertedToFindings) !== 5
  || Number(currentSellable300Lift.rejectedRowsCount) !== 187
  || Number(currentSellable300Lift.currentSellableRowsAfterAdmission) !== 300
  || Number(currentSellable300Lift.currentSellableFindingsAfterAdmission) !== 193
  || Number(currentSellable300Lift.currentSellableSourceProvenanceRowsAfterAdmission) !== 107
  || Number(currentSellable300Lift.sourceProvenanceShareAfterAdmission) !== 0.357
  || currentSellable300Lift.countsTowardLocalCurrentPaidPreset !== true
  || currentSellable300Lift.countsTowardHostedPaidProof !== false
  || !Array.isArray(currentSellable300Lift.acceptedRows)
  || !Array.isArray(currentSellable300Lift.convertedSourceProvenanceRows)
  || !Array.isArray(currentSellable300Lift.rejectedRows)
) {
  throw new Error("Program DB current sellable 300 lift must expose 300-row local current proof");
}
const current300AcceptedRows = currentSellable300Lift.acceptedRows as Array<Record<string, unknown>>;
if (
  current300AcceptedRows.length !== 50
  || current300AcceptedRows.filter((row) => row.sourcePacket === "agent05_current_chargeable150").length !== 30
  || current300AcceptedRows.filter((row) => row.sourcePacket === "agent08_parser_ready_public_proof").length !== 15
  || current300AcceptedRows.filter((row) => row.sourcePacket === "existing_public_source_row").length !== 5
) {
  throw new Error("Program DB current sellable 300 lift must draw from Agent 05 current 150, Agent 08 public proof, and existing public source rows");
}
for (const row of current300AcceptedRows) {
  if (
    typeof row.actor !== "string"
    || typeof row.victimOrTarget !== "string"
    || typeof row.sector !== "string"
    || typeof row.country !== "string"
    || typeof row.ttpOrTool !== "string"
    || typeof row.firstSeen !== "string"
    || typeof row.lastSeen !== "string"
    || Number(row.confidence) < 0.84
    || typeof row.provenanceHash !== "string"
    || typeof row.buyerReason !== "string"
    || row.countsTowardCurrentSellableRows !== true
    || row.countsTowardHostedPaidProof !== false
    || row.noLeak !== true
  ) {
    throw new Error("Program DB accepted rows must be current, specific, public-supported, provenance-backed, and local-only");
  }
}
for (const row of currentSellable300Lift.convertedSourceProvenanceRows as Array<Record<string, unknown>>) {
  if (row.countsTowardSellableFindingFloor !== true || row.noLeak !== true) {
    throw new Error("Program DB converted source-provenance rows must become true findings without leaks");
  }
}
for (const reason of ["projection_only", "graph_only", "restricted_only", "generic_actor_or_source_page", "stale_latest_error", "duplicate_claim", "contradicted_public_proof", "missing_required_fields"]) {
  if (!(currentSellable300Lift.rejectedRows as Array<Record<string, unknown>>).some((row) => row.reason === reason && row.countsTowardCurrentSellableRows === false)) {
    throw new Error(`Program DB current sellable 300 lift must reject ${reason}`);
  }
}
const current300LiftProgress = currentSellable300Lift.targetProgress as Record<string, unknown> | undefined;
if (
  !current300LiftProgress
  || Number(current300LiftProgress.targetCurrentSellableRows) !== 300
  || Number(current300LiftProgress.remainingGapTo300) !== 0
  || Number(current300LiftProgress.targetCurrentSellableFindings) !== 150
  || Number(current300LiftProgress.remainingFindingGapTo150) !== 0
  || Number(current300LiftProgress.maximumSourceProvenanceShare) !== 0.45
  || Number(current300LiftProgress.nextTargetCurrentSellableRows) !== 1000
  || Number(current300LiftProgress.remainingGapTo1000) !== 700
) {
  throw new Error("Program DB current sellable 300 lift must show the 300-row gate pass and 1,000-row gap");
}
if (
  (currentSellable300Lift.noLeakBoundary as Record<string, unknown> | undefined)?.hostedPaidProofClaimed !== false
  || (currentSellable300Lift.noLeakBoundary as Record<string, unknown>).restrictedPayloadsExposed !== false
) {
  throw new Error("Program DB current sellable 300 lift must not claim hosted proof or expose restricted payloads");
}
const currentSellable500Lift = findingAdmissionLedger.currentSellable500Lift as Record<string, unknown> | undefined;
if (
  !currentSellable500Lift
  || currentSellable500Lift.schemaVersion !== "ti.program_dc_current_sellable_500_lift.v1"
  || currentSellable500Lift.owner !== "agent_03"
  || Number(currentSellable500Lift.acceptedCurrentRowsCount) !== 200
  || Number(currentSellable500Lift.sourceProvenanceRowsConvertedToFindings) !== 10
  || Number(currentSellable500Lift.rejectedRowsCount) !== 282
  || Number(currentSellable500Lift.currentSellableRowsAfterAdmission) !== 500
  || Number(currentSellable500Lift.currentSellableFindingsAfterAdmission) !== 403
  || Number(currentSellable500Lift.currentSellableSourceProvenanceRowsAfterAdmission) !== 97
  || Number(currentSellable500Lift.sourceProvenanceShareAfterAdmission) !== 0.194
  || Number(currentSellable500Lift.trueFindingShareAfterAdmission) !== 0.806
  || currentSellable500Lift.countsTowardLocalCurrentPaidPreset !== true
  || currentSellable500Lift.countsTowardHostedPaidProof !== false
  || !Array.isArray(currentSellable500Lift.acceptedRows)
  || !Array.isArray(currentSellable500Lift.convertedSourceProvenanceRows)
  || !Array.isArray(currentSellable500Lift.rejectedRows)
) {
  throw new Error("Program DC current sellable 500 lift must expose a local-countable 500-row packet");
}
const current500AcceptedRows = currentSellable500Lift.acceptedRows as Array<Record<string, unknown>>;
if (
  current500AcceptedRows.length !== 200
  || current500AcceptedRows.filter((row) => row.sourcePacket === "agent05_current_chargeable250").length !== 100
  || current500AcceptedRows.filter((row) => row.sourcePacket === "agent08_parser_ready_public_proof").length !== 60
  || current500AcceptedRows.filter((row) => row.sourcePacket === "agent04_high_value_public_source_replacement").length !== 25
  || current500AcceptedRows.filter((row) => row.sourcePacket === "existing_public_source_row").length !== 15
) {
  throw new Error("Program DC current sellable 500 lift must draw from Agent 05, Agent 08, Agent 04, and existing public rows");
}
for (const row of current500AcceptedRows) {
  if (
    typeof row.actor !== "string"
    || typeof row.victimOrTarget !== "string"
    || typeof row.sector !== "string"
    || typeof row.countryOrRegion !== "string"
    || typeof row.ttpToolOrCampaign !== "string"
    || typeof row.datasetOrImpactClaim !== "string"
    || typeof row.firstSeen !== "string"
    || typeof row.lastSeen !== "string"
    || Number(row.confidence) < 0.835
    || typeof row.freshnessState !== "string"
    || typeof row.provenanceHash !== "string"
    || typeof row.whyWorthPayingFor !== "string"
    || row.countsTowardCurrentSellableRows !== true
    || row.countsTowardHostedPaidProof !== false
    || row.noLeakProof !== "hash_only_no_raw_locator_no_payload_no_credentials"
    || row.noLeak !== true
  ) {
    throw new Error("Program DC accepted rows must be current, buyer-actionable, provenance-backed, and local-only");
  }
}
for (const reason of ["low_value", "stale", "generic", "source_provenance_only_risk", "graph_only", "restricted_only", "contradicted", "duplicate", "missing_victim_or_context", "missing_source_family", "missing_buyer_action"]) {
  if (!(currentSellable500Lift.rejectedRows as Array<Record<string, unknown>>).some((row) => row.reason === reason && row.countsTowardCurrentSellableRows === false)) {
    throw new Error(`Program DC current sellable 500 lift must reject ${reason}`);
  }
}
const current500LiftProgress = currentSellable500Lift.targetProgress as Record<string, unknown> | undefined;
const current500Next750 = current500LiftProgress?.next750Plan as Record<string, unknown> | undefined;
if (
  !current500LiftProgress
  || Number(current500LiftProgress.remainingGapTo500) !== 0
  || Number(current500LiftProgress.minimumTrueFindingShare) !== 0.55
  || Number(current500LiftProgress.remainingFindingGapTo55Percent) !== 0
  || Number(current500LiftProgress.maximumSourceProvenanceShare) !== 0.4
  || Number(current500LiftProgress.remainingGapTo750) !== 250
  || !current500Next750
  || Number(current500Next750.additionalRowsNeeded) !== 250
  || current500Next750.projectedRowsCountTowardCurrent !== false
) {
  throw new Error("Program DC current sellable 500 lift must pass 500 and carry a gated 750 plan");
}
for (const row of findingAdmissionLedger.remainingBlockers as Array<Record<string, unknown>>) {
  if (row.countsTowardCurrentSellableRows !== false) throw new Error("Program CX remaining blockers must not count toward sellable rows");
}
const hundredRowConversionProof = outputRecord.hundredRowConversionProof as Record<string, unknown> | undefined;
if (
  !hundredRowConversionProof
  || hundredRowConversionProof.schemaVersion !== "ti.apify_100_row_conversion_proof.v1"
  || !Array.isArray(hundredRowConversionProof.routeVisibleOn)
  || !hundredRowConversionProof.routeVisibleOn.includes("/v1/contracts#apifyStoreReadiness")
) {
  throw new Error("OUTPUT record must expose Program CF 100-row conversion proof");
}
const hundredRowCurrentRun = hundredRowConversionProof.currentRun as Record<string, unknown> | undefined;
const hundredRowProjection = hundredRowConversionProof.acceptedRepairProjection as Record<string, unknown> | undefined;
const firstPaidTrafficExperiment = hundredRowConversionProof.firstPaidTrafficExperiment as Record<string, unknown> | undefined;
const noFakeRevenueClaims = hundredRowConversionProof.noFakeRevenueClaims as Record<string, unknown> | undefined;
if (
  !hundredRowCurrentRun
  || hundredRowCurrentRun.proofRunId !== "OThlfd0uzSCNnedAO"
  || hundredRowCurrentRun.proofDatasetId !== "LSen2fYtwFTtOr7vK"
  || hundredRowCurrentRun.proofDecision !== "shape_safety_proof"
  || hundredRowCurrentRun.productionPaidTrafficReady !== false
  || Number(hundredRowCurrentRun.currentSellableRows) >= 100
  || hundredRowCurrentRun.targetSellableRows !== 100
  || Number(hundredRowCurrentRun.remainingSellableRows) <= 0
  || !Array.isArray(hundredRowCurrentRun.exactBlockers)
  || !hundredRowCurrentRun.exactBlockers.includes("sellable_rows_below_100_production_floor")
) {
  throw new Error("Program CF current-run proof must keep proof-sized runs blocked below the 100-row floor");
}
if (
  !hundredRowProjection
  || Number(hundredRowProjection.projectedSellableRowsFromAcceptedRepairs) <= 0
  || Number(hundredRowProjection.projectedSellableRowsAfterAcceptedRepairs) < 100
  || Number(hundredRowProjection.oneRepairAwayRows) <= 0
  || Number(hundredRowProjection.caveatedUsefulRows) < 0
  || Number(hundredRowProjection.blockedRows) <= 0
  || hundredRowProjection.graphOnlyRowsCountTowardProductionFloor !== false
  || hundredRowProjection.proofSizedRunsCountTowardProductionReadiness !== false
  || hundredRowProjection.caveatOnlyRunsCountTowardProductionReadiness !== false
) {
  throw new Error("Program CF accepted-repair projection must distinguish projected progress from production readiness");
}
if (
  !firstPaidTrafficExperiment
  || firstPaidTrafficExperiment.status !== "blocked_until_100_sellable_rows"
  || typeof firstPaidTrafficExperiment.targetBuyer !== "string"
  || typeof firstPaidTrafficExperiment.successMetric !== "string"
  || typeof firstPaidTrafficExperiment.stopLossMetric !== "string"
  || !Array.isArray(firstPaidTrafficExperiment.requiredApifyAnalyticsFields)
  || !firstPaidTrafficExperiment.requiredApifyAnalyticsFields.includes("paidRuns")
  || !firstPaidTrafficExperiment.requiredApifyAnalyticsFields.includes("runtimeSeconds")
) {
  throw new Error("Program CF first paid traffic experiment must stay blocked and name required Apify analytics");
}
if (
  !noFakeRevenueClaims
  || noFakeRevenueClaims.payout !== null
  || noFakeRevenueClaims.storeViews !== null
  || noFakeRevenueClaims.users !== null
  || noFakeRevenueClaims.paidRuns !== null
  || noFakeRevenueClaims.revenue !== null
  || noFakeRevenueClaims.runtime !== null
  || noFakeRevenueClaims.platformUsage !== null
  || noFakeRevenueClaims.conversionRate !== null
) {
  throw new Error("Program CF proof must keep payout, traffic, revenue, runtime, usage, and conversion claims external");
}
const qualityConversionGate = outputRecord.qualityConversionGate as Record<string, unknown> | undefined;
if (
  !qualityConversionGate
  || qualityConversionGate.schemaVersion !== "ti.apify_paid_row_quality_conversion_gate.v1"
  || qualityConversionGate.baselineRunId !== "OThlfd0uzSCNnedAO"
  || qualityConversionGate.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || qualityConversionGate.dryRun !== true
  || qualityConversionGate.willMutateSources !== false
  || qualityConversionGate.willStartCollection !== false
  || !Array.isArray(qualityConversionGate.examples)
  || qualityConversionGate.examples.length < 12
  || !Array.isArray(qualityConversionGate.rejectedBloatCases)
  || qualityConversionGate.rejectedBloatCases.length < 7
  || Number(qualityConversionGate.sellableRowLift) < 6
  || Number(qualityConversionGate.bloatBlocked) < 7
  || !Array.isArray(qualityConversionGate.sourceParserHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BQ paid-row quality conversion gate");
}
const qualityConversionActors = (qualityConversionGate.examples as Array<Record<string, unknown>>).map((row) => row.actor);
for (const requiredActor of ["APT29", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta"]) {
  if (!qualityConversionActors.includes(requiredActor)) throw new Error(`Program BQ conversion gate must include ${requiredActor}`);
}
const rejectedBloatReasons = (qualityConversionGate.rejectedBloatCases as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["alias_only_cleanup", "stale_old_report_reuse", "duplicate_source_expansion", "generic_marketing_summary", "uncorroborated_public_channel_snippet", "unsafe_metadata", "no_actionability"]) {
  if (!rejectedBloatReasons.includes(requiredReason)) throw new Error(`Program BQ conversion gate must reject ${requiredReason}`);
}
const liveFreshnessQualityGate = outputRecord.liveFreshnessQualityGate as Record<string, unknown> | undefined;
if (
  !liveFreshnessQualityGate
  || liveFreshnessQualityGate.schemaVersion !== "ti.apify_live_freshness_quality_gate.v1"
  || liveFreshnessQualityGate.dryRun !== true
  || liveFreshnessQualityGate.willMutateSources !== false
  || liveFreshnessQualityGate.willStartCollection !== false
  || !Array.isArray(liveFreshnessQualityGate.examples)
  || liveFreshnessQualityGate.examples.length < 12
  || !Array.isArray(liveFreshnessQualityGate.blockedLatestClaimCases)
  || liveFreshnessQualityGate.blockedLatestClaimCases.length < 7
  || Number(liveFreshnessQualityGate.freshRowsPromoted) < 6
  || Number(liveFreshnessQualityGate.staleLatestClaimsBlocked) < 4
  || !Array.isArray(liveFreshnessQualityGate.sourceParserHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BR live freshness quality gate");
}
const freshnessActors = (liveFreshnessQualityGate.examples as Array<Record<string, unknown>>).map((row) => row.actor);
for (const requiredActor of ["APT29", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta"]) {
  if (!freshnessActors.includes(requiredActor)) throw new Error(`Program BR freshness gate must include ${requiredActor}`);
}
const blockedLatestReasons = (liveFreshnessQualityGate.blockedLatestClaimCases as Array<Record<string, unknown>>).map((row) => row.blockedReason);
for (const requiredReason of ["old_evidence", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"]) {
  if (!blockedLatestReasons.includes(requiredReason)) throw new Error(`Program BR freshness gate must block ${requiredReason}`);
}
if (!(liveFreshnessQualityGate.examples as Array<Record<string, unknown>>).some((row) => row.blocksLatestClaim === true && ["held", "suppressed"].includes(String(row.decision)))) {
  throw new Error("Program BR freshness gate must block stale latest-activity rows from paid promotion");
}
const freshnessRepairLoop = outputRecord.freshnessRepairLoop as Record<string, unknown> | undefined;
if (
  !freshnessRepairLoop
  || freshnessRepairLoop.schemaVersion !== "ti.apify_paid_row_freshness_repair_loop.v1"
  || freshnessRepairLoop.dryRun !== true
  || freshnessRepairLoop.willMutateSources !== false
  || freshnessRepairLoop.willStartCollection !== false
  || !Array.isArray(freshnessRepairLoop.repairQueue)
  || freshnessRepairLoop.repairQueue.length < 20
  || !freshnessRepairLoop.lift
  || !Array.isArray(freshnessRepairLoop.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BS paid-row freshness repair loop");
}
const freshnessRepairRows = freshnessRepairLoop.repairQueue as Array<Record<string, unknown>>;
const repairActors = freshnessRepairRows.map((row) => row.actor);
for (const requiredActor of ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta"]) {
  if (!repairActors.includes(requiredActor)) throw new Error(`Program BS repair loop must include ${requiredActor}`);
}
const repairBlockers = freshnessRepairRows.map((row) => row.blocker);
for (const requiredBlocker of ["stale_latest_activity", "generic_summary", "single_source", "alias_only", "unrelated_actor", "contradicted", "metadata_only_without_public_support"]) {
  if (!repairBlockers.includes(requiredBlocker)) throw new Error(`Program BS repair loop must include ${requiredBlocker}`);
}
if (!freshnessRepairRows.every((row) => Array.isArray(row.proofNeeded) && row.proofNeeded.length > 0 && Array.isArray(row.expectedBuyerVisibleLift) && row.expectedBuyerVisibleLift.length > 0 && row.noLeak === true)) {
  throw new Error("Program BS repair loop rows must preserve proof, lift, and no-leak state");
}
const freshnessRepairLift = freshnessRepairLoop.lift as Record<string, unknown>;
if (
  Number(freshnessRepairLift.staleRowsBlocked) < 4
  || Number(freshnessRepairLift.genericRowsRepaired) < 4
  || Number(freshnessRepairLift.aliasOrUnrelatedRowsSuppressed) < 4
  || Number(freshnessRepairLift.sellableRowsGained) < 6
  || Number(freshnessRepairLift.usefulRowsGained) < 6
  || Number(freshnessRepairLift.averageBuyerValueDelta) < 0.1
) {
  throw new Error("Program BS repair loop must expose measurable paid-row lift");
}
const freshnessRepairOwners = (freshnessRepairLoop.ownerHandoffs as Array<Record<string, unknown>>).map((row) => row.owner);
for (const owner of ["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]) {
  if (!freshnessRepairOwners.includes(owner)) throw new Error(`Program BS repair loop must include ${owner} handoff`);
}
const entitySpecificityLift = outputRecord.entitySpecificityLift as Record<string, unknown> | undefined;
if (
  !entitySpecificityLift
  || entitySpecificityLift.schemaVersion !== "ti.apify_paid_row_entity_specificity_lift.v1"
  || entitySpecificityLift.dryRun !== true
  || entitySpecificityLift.willMutateSources !== false
  || entitySpecificityLift.willStartCollection !== false
  || !Array.isArray(entitySpecificityLift.fixtures)
  || entitySpecificityLift.fixtures.length < 20
  || !entitySpecificityLift.lift
  || !Array.isArray(entitySpecificityLift.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BV paid-row entity specificity lift");
}
const entitySpecificityFixtures = entitySpecificityLift.fixtures as Array<Record<string, unknown>>;
const entitySpecificityActors = entitySpecificityFixtures.map((row) => row.actor);
for (const requiredActor of ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "Unknown Actor Query"]) {
  if (!entitySpecificityActors.includes(requiredActor)) throw new Error(`Program BV entity specificity lift must include ${requiredActor}`);
}
const entitySpecificityFields = entitySpecificityFixtures.flatMap((row) => Array.isArray(row.missingFields) ? row.missingFields : []);
for (const field of ["victim", "sector", "country", "dataset_or_impact", "ttp_or_tool", "first_seen", "last_seen", "confidence", "caveat", "contradiction_state", "provenance_hash", "next_action"]) {
  if (!entitySpecificityFields.includes(field)) throw new Error(`Program BV entity specificity lift must cover missing field ${field}`);
}
const entitySpecificityBlockers = entitySpecificityFixtures.flatMap((row) => Array.isArray(row.blockerCodesRemoved) ? row.blockerCodesRemoved : []);
for (const blocker of ["old", "alias_only", "single_source_without_caveat", "unrelated_actor", "contradicted", "metadata_only_without_public_support", "no_useful_buyer_action", "generic_entity_fields"]) {
  if (!entitySpecificityBlockers.includes(blocker)) throw new Error(`Program BV entity specificity lift must cover blocker ${blocker}`);
}
if (!entitySpecificityFixtures.every((row) => Array.isArray(row.proofNeeded) && row.proofNeeded.length > 0 && Array.isArray(row.expectedBuyerVisibleLift) && row.expectedBuyerVisibleLift.length > 0 && typeof row.whyWorthPayingFor === "string" && typeof row.repairAction === "string" && row.noLeak === true)) {
  throw new Error("Program BV fixtures must preserve proof, repair action, buyer value, and no-leak state");
}
const entitySpecificityMetrics = entitySpecificityLift.lift as Record<string, unknown>;
if (
  Number(entitySpecificityMetrics.rowsLifted) < 8
  || Number(entitySpecificityMetrics.rowsSuppressed) < 4
  || Number(entitySpecificityMetrics.rowsHeldWithRepairAction) < 2
  || Number(entitySpecificityMetrics.blockerCodesRemoved) < 20
  || Number(entitySpecificityMetrics.averageBuyerValueDelta) < 0.12
) {
  throw new Error("Program BV entity specificity lift must expose measurable buyer-value improvement");
}
const entitySpecificityOwners = (entitySpecificityLift.ownerHandoffs as Array<Record<string, unknown>>).map((row) => row.owner);
for (const owner of ["agent_01", "agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]) {
  if (!entitySpecificityOwners.includes(owner)) throw new Error(`Program BV entity specificity lift must include ${owner} handoff`);
}
const falsePositiveSuppressionGate = outputRecord.falsePositiveSuppressionGate as Record<string, unknown> | undefined;
if (
  !falsePositiveSuppressionGate
  || falsePositiveSuppressionGate.schemaVersion !== "ti.apify_paid_row_false_positive_suppression_gate.v1"
  || falsePositiveSuppressionGate.dryRun !== true
  || falsePositiveSuppressionGate.willMutateSources !== false
  || falsePositiveSuppressionGate.willStartCollection !== false
  || !Array.isArray(falsePositiveSuppressionGate.fixtures)
  || falsePositiveSuppressionGate.fixtures.length < 25
  || !falsePositiveSuppressionGate.lift
  || !Array.isArray(falsePositiveSuppressionGate.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program BZ paid-row false-positive suppression gate");
}
const falsePositiveFixtures = falsePositiveSuppressionGate.fixtures as Array<Record<string, unknown>>;
const falsePositiveScenarios = falsePositiveFixtures.map((row) => row.scenario);
for (const scenario of ["alias_collision", "common_victim_name", "unrelated_actor_co_mention", "stale_repost_as_current", "single_source_requires_caveat", "metadata_only_without_public_support", "contradicted_claim", "unknown_search_suppressed", "true_positive_preserved"]) {
  if (!falsePositiveScenarios.includes(scenario)) throw new Error(`Program BZ false-positive gate must include scenario ${scenario}`);
}
const falsePositiveReasonCodes = falsePositiveFixtures.map((row) => row.reasonCode);
for (const reasonCode of ["alias_collision", "ambiguous_victim_name", "unrelated_actor_co_mention", "stale_repost_as_current", "single_source_without_caveat", "metadata_only_without_public_support", "contradicted_claim", "unknown_query_searching", "true_positive_sellable"]) {
  if (!falsePositiveReasonCodes.includes(reasonCode)) throw new Error(`Program BZ false-positive gate must include reason ${reasonCode}`);
}
if (!falsePositiveFixtures.every((row) => typeof row.buyerVisibleEffect === "string" && typeof row.nextRepairAction === "string" && row.noLeak === true)) {
  throw new Error("Program BZ fixtures must expose buyer effect, repair action, and no-leak proof");
}
const falsePositiveLift = falsePositiveSuppressionGate.lift as Record<string, unknown>;
if (
  Number(falsePositiveLift.falsePositivesSuppressed) < 10
  || Number(falsePositiveLift.contradictedRowsHeld) < 2
  || Number(falsePositiveLift.staleRepostsBlocked) < 3
  || Number(falsePositiveLift.singleSourceRowsCaveated) < 3
  || Number(falsePositiveLift.truePositivesPreserved) < 8
  || Number(falsePositiveLift.sellableRowsProtected) < 8
  || Number(falsePositiveLift.rowsPreventedFromBilling) < 10
  || Number(falsePositiveLift.buyerTrustDelta) < 0.2
) {
  throw new Error("Program BZ false-positive gate must expose measurable suppression and buyer-trust lift");
}
const falsePositiveOwners = (falsePositiveSuppressionGate.ownerHandoffs as Array<Record<string, unknown>>).map((row) => row.owner);
for (const owner of ["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]) {
  if (!falsePositiveOwners.includes(owner)) throw new Error(`Program BZ false-positive gate must include ${owner} handoff`);
}
const programCpHardening = falsePositiveSuppressionGate.programCpHardening as Record<string, unknown> | undefined;
if (
  !programCpHardening
  || programCpHardening.schemaVersion !== "ti.apify_program_cp_paid_row_false_positive_freshness_hardening.v1"
  || programCpHardening.activeCandidatePoolRowsAudited !== 100
  || programCpHardening.apifySmokeRowsAudited !== 12
  || Number(programCpHardening.rowCountInflationBlocked) < 80
  || Number(programCpHardening.staleLatestActivityRowsBlocked) < 18
  || Number(programCpHardening.aliasCollisionRowsBlocked) < 4
  || Number(programCpHardening.wrongActorRowsBlocked) < 5
  || Number(programCpHardening.graphOnlyRowsBlocked) < 4
  || Number(programCpHardening.restrictedOnlyRowsHeld) < 11
  || !Array.isArray(programCpHardening.suppressionProof)
  || !Array.isArray(programCpHardening.preservedTruePositiveProof)
  || !Array.isArray(programCpHardening.fastestRepairsTo100)
) {
  throw new Error("OUTPUT record must expose Program CP paid-row false-positive and freshness hardening");
}
const programCpSuppression = programCpHardening.suppressionProof as Array<Record<string, unknown>>;
for (const suppressedClass of ["stale_latest_activity", "alias_collision", "wrong_actor", "generic_source_page", "unrelated_co_mention", "graph_only", "restricted_only", "synthetic_proof_only", "low_buyer_value", "caveated_only"]) {
  if (!programCpSuppression.some((row) => row.class === suppressedClass && row.countsTowardSellable === false)) {
    throw new Error(`Program CP must keep ${suppressedClass} out of sellable paid rows`);
  }
}
const programCpTruePositiveProof = programCpHardening.preservedTruePositiveProof as Array<Record<string, unknown>>;
if (!programCpTruePositiveProof.every((row) =>
  row.countsTowardSellable === true &&
  row.noLeak === true &&
  typeof row.provenanceHash === "string" &&
  row.provenanceHash.length > 0 &&
  Array.isArray(row.requiredSignals) &&
  row.requiredSignals.includes("current_public_support") &&
  row.requiredSignals.includes("actor_specific") &&
  row.requiredSignals.includes("buyer_action")
)) {
  throw new Error("Program CP must preserve true positives with public support, actor specificity, provenance, buyer action, and no-leak proof");
}
const programCpRepairOwners = (programCpHardening.fastestRepairsTo100 as Array<Record<string, unknown>>).map((row) => row.owner);
for (const owner of ["agent_03", "agent_04", "agent_05", "agent_06", "agent_07", "agent_08", "agent_09", "agent_10"]) {
  if (!programCpRepairOwners.includes(owner)) throw new Error(`Program CP fastest repairs must include ${owner} handoff`);
}
if (!(programCpHardening.fastestRepairsTo100 as Array<Record<string, unknown>>).every((row) => row.countsTowardPaidFloorNow === false && typeof row.nextAction === "string" && row.nextAction.length > 0)) {
  throw new Error("Program CP repair rows must remain excluded from paid floor until repaired");
}
const programCpSecondBatchAudit = programCpHardening.secondBatchAudit as Record<string, unknown> | undefined;
if (
  !programCpSecondBatchAudit
  || programCpSecondBatchAudit.schemaVersion !== "ti.apify_program_cp_second_batch_candidate_audit.v1"
  || !["smoke_fixture", "100_name_paid_preset"].includes(String(programCpSecondBatchAudit.auditedPreset))
  || Number(programCpSecondBatchAudit.localProofRows) !== output.length
  || Number(programCpSecondBatchAudit.currentSellableRows) !== Number(paidRowQuality.sellable)
  || Number(programCpSecondBatchAudit.sellableFindingRows) < 1
  || Number(programCpSecondBatchAudit.sellableSourceProvenanceRows) < 1
  || programCpSecondBatchAudit.sourceProvenanceRowsCountTowardFindingFloor !== false
  || programCpSecondBatchAudit.hostedProofRequired !== true
  || programCpSecondBatchAudit.hostedProofCountsTowardPaidPromotion !== false
  || programCpSecondBatchAudit.externalMarketplaceVerificationRequired !== true
  || Number(programCpSecondBatchAudit.staleLatestActivitySellableRows) !== 0
  || Number(programCpSecondBatchAudit.aliasOrWrongActorSellableRows) !== 0
  || Number(programCpSecondBatchAudit.genericSourcePageSellableRows) !== 0
  || Number(programCpSecondBatchAudit.graphOnlySellableRows) !== 0
  || Number(programCpSecondBatchAudit.restrictedOnlySellableRows) !== 0
  || programCpSecondBatchAudit.caveatedRowsCountTowardChargeable !== false
  || !Array.isArray(programCpSecondBatchAudit.findingAdmissionRequiredSignals)
  || !Array.isArray(programCpSecondBatchAudit.rowInflationGuards)
) {
  throw new Error("Program CP second-batch audit must separate real sellable findings from source-provenance padding and keep hosted promotion blocked");
}
for (const signal of ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"]) {
  if (!(programCpSecondBatchAudit.findingAdmissionRequiredSignals as string[]).includes(signal)) {
    throw new Error(`Program CP second-batch audit must require ${signal}`);
  }
}
for (const guard of ["source_provenance_padding", "stale_latest_activity", "alias_or_wrong_actor", "generic_source_page", "graph_only", "restricted_only", "caveated_as_chargeable"]) {
  if (!(programCpSecondBatchAudit.rowInflationGuards as Array<Record<string, unknown>>).some((row) => row.guard === guard && row.countsTowardPaidPromotion === false && typeof row.proof === "string" && row.proof.length > 0)) {
    throw new Error(`Program CP second-batch audit must block ${guard} inflation`);
  }
}
for (const key of ["rawEvidenceExposed", "unsafeUrlsExposed", "restrictedPayloadsExposed", "objectKeysExposed", "privateMaterialExposed", "accountMaterialExposed", "actorInteractionContentExposed"]) {
  if ((programCpSecondBatchAudit.noLeakProof as Record<string, unknown> | undefined)?.[key] !== false) {
    throw new Error(`Program CP second-batch no-leak proof must keep ${key} false`);
  }
}
const paidRowAudit100 = outputRecord.paidRowAudit100 as Record<string, unknown> | undefined;
if (
  !paidRowAudit100
  || paidRowAudit100.schemaVersion !== "ti.apify_paid_row_audit_100.v1"
  || paidRowAudit100.dryRun !== true
  || paidRowAudit100.willMutateSources !== false
  || paidRowAudit100.willStartCollection !== false
  || paidRowAudit100.targetSellableRows !== 100
  || !Array.isArray(paidRowAudit100.classifications)
  || paidRowAudit100.classifications.length < 15
  || !paidRowAudit100.metrics
  || !Array.isArray(paidRowAudit100.exclusionProof)
) {
  throw new Error("OUTPUT record must expose Program CH paid-row audit to 100 rows");
}
const paidRowAuditClasses = (paidRowAudit100.classifications as Array<Record<string, unknown>>).map((row) => row.rowClass);
for (const rowClass of ["sellable", "useful_caveated", "needs_public_support", "stale_or_duplicate", "wrong_actor_or_alias_collision", "restricted_only", "not_payworthy"]) {
  if (!paidRowAuditClasses.includes(rowClass)) throw new Error(`Program CH audit must include ${rowClass}`);
}
if (!(paidRowAudit100.classifications as Array<Record<string, unknown>>).every((row) =>
  typeof row.repairAction === "string"
  && row.noLeak === true
  && (row.rowClass === "sellable" || row.countsTowardProductionSellableRows === false)
)) {
  throw new Error("Program CH audit rows must include repair action, no-leak proof, and floor exclusion for non-sellable rows");
}
const paidRowAuditMetrics = paidRowAudit100.metrics as Record<string, unknown>;
if (
  Number(paidRowAuditMetrics.currentSellableRows) !== 5
  || Number(paidRowAuditMetrics.protectedSellableRows) !== 5
  || Number(paidRowAuditMetrics.suppressedFalsePositives) < 7
  || Number(paidRowAuditMetrics.rowsOneRepairAway) < 9
  || Number(paidRowAuditMetrics.expectedSellableLiftAfterParserSourceRepairs) < 20
  || Number(paidRowAuditMetrics.rowsPreventedFromBilling) < 30
  || Number(paidRowAuditMetrics.productionSellableFloorGap) < 90
) {
  throw new Error("Program CH audit metrics must keep the 100-row production floor honest");
}
const paidRowAuditExclusions = (paidRowAudit100.exclusionProof as Array<Record<string, unknown>>).map((row) => row.class);
for (const excludedClass of ["graph_only_projection", "synthetic_row", "stale_or_duplicate", "restricted_only", "caveat_only"]) {
  if (!paidRowAuditExclusions.includes(excludedClass)) throw new Error(`Program CH audit must exclude ${excludedClass}`);
}
const first100AdmissionQuality = outputRecord.first100AdmissionQuality as Record<string, unknown> | undefined;
if (
  !first100AdmissionQuality
  || first100AdmissionQuality.schemaVersion !== "ti.apify_first_100_paid_row_admission_quality.v1"
  || first100AdmissionQuality.dryRun !== true
  || first100AdmissionQuality.willMutateSources !== false
  || first100AdmissionQuality.willStartCollection !== false
  || first100AdmissionQuality.productionSellableFloor !== 100
  || Number(first100AdmissionQuality.fixtureCount) < 40
  || !first100AdmissionQuality.admissionRules
  || !first100AdmissionQuality.classificationCounts
  || !first100AdmissionQuality.metrics
  || !Array.isArray(first100AdmissionQuality.sampleRows)
  || !Array.isArray(first100AdmissionQuality.nonSellableExclusionProof)
  || !Array.isArray(first100AdmissionQuality.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program CN first-100 paid-row admission quality");
}
const first100Counts = first100AdmissionQuality.classificationCounts as Record<string, unknown>;
for (const rowClass of ["accepted_sellable", "caveated_useful", "needs_public_support", "stale_duplicate", "alias_collision", "wrong_actor", "restricted_only", "graph_only", "synthetic_proof_only", "generic_market_source_page", "low_buyer_value"]) {
  if (Number(first100Counts[rowClass]) <= 0) throw new Error(`Program CN admission quality must cover ${rowClass}`);
}
const first100Metrics = first100AdmissionQuality.metrics as Record<string, unknown>;
if (
  Number(first100Metrics.rowsAdmittedToProductionFloor) !== 8
  || Number(first100Metrics.rowsDowngradedToCaveatedContext) < 8
  || Number(first100Metrics.rowsSuppressed) < 20
  || Number(first100Metrics.rowsNeedingParserRepair) < 4
  || Number(first100Metrics.rowsNeedingSourceSupport) < 8
  || Number(first100Metrics.rowsNeedingDarkMetadataPublicSupport) < 4
  || Number(first100Metrics.estimatedBuyerValueDelta) <= 0
  || Number(first100Metrics.rowCountInflationBlocked) < 40
) {
  throw new Error("Program CN admission metrics must protect the first 100 paid rows");
}
if (!(first100AdmissionQuality.sampleRows as Array<Record<string, unknown>>).every((row) =>
  typeof row.whyBuyerShouldCare === "string"
  && typeof row.nextSearchOrPivot === "string"
  && typeof row.provenanceHash === "string"
  && row.noLeak === true
  && (row.countsTowardProductionSellableRows === true || row.admissionDecision !== "admit_sellable")
)) {
  throw new Error("Program CN sample rows must explain buyer value, pivots, provenance, and non-sellable exclusion");
}
const first100Exclusions = (first100AdmissionQuality.nonSellableExclusionProof as Array<Record<string, unknown>>).map((row) => row.class);
for (const excludedClass of ["graph_only", "synthetic_proof_only", "stale_duplicate", "restricted_only", "caveated_useful", "generic_market_source_page", "low_buyer_value", "alias_or_wrong_actor"]) {
  if (!first100Exclusions.includes(excludedClass)) throw new Error(`Program CN admission quality must exclude ${excludedClass}`);
}
const graphSellableSupportPacket = outputRecord.graphSellableSupportPacket as Record<string, unknown> | undefined;
if (
  !graphSellableSupportPacket
  || graphSellableSupportPacket.schemaVersion !== "ti.apify_graph_sellable_support_packet.v1"
  || graphSellableSupportPacket.baselineRunId !== "OThlfd0uzSCNnedAO"
  || graphSellableSupportPacket.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || graphSellableSupportPacket.dryRun !== true
  || graphSellableSupportPacket.willMutateSources !== false
  || graphSellableSupportPacket.willStartCollection !== false
  || graphSellableSupportPacket.productionSellableFloor !== 100
  || Number(graphSellableSupportPacket.supportExampleCount) < 20
  || Number(graphSellableSupportPacket.graphOnlyRowsExcludedFromFloor) < 20
  || Number(graphSellableSupportPacket.graphSupportedRepairCandidates) < 15
  || Number(graphSellableSupportPacket.projectedSellableRowsUnlockedAfterNonGraphRepairs) <= 0
  || Number(graphSellableSupportPacket.nextBuyerSearchCount) < 20
  || Number(graphSellableSupportPacket.averageAnalystConfidenceDelta) <= 0
  || !Array.isArray(graphSellableSupportPacket.examples)
  || graphSellableSupportPacket.examples.length < 20
  || !Array.isArray(graphSellableSupportPacket.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program CI graph sellable support packet");
}
const graphSupportExamples = graphSellableSupportPacket.examples as Array<Record<string, unknown>>;
const graphSupportActors = graphSupportExamples.map((row) => row.actor);
for (const actor of ["APT29", "APT28", "APT42", "Turla", "Volt Typhoon", "Lazarus Group", "Sandworm", "Scattered Spider", "LockBit", "Akira", "Clop", "Black Basta", "RansomHub", "Play", "Qilin", "BlackCat", "BianLian", "Medusa", "FIN7", "MuddyWater"]) {
  if (!graphSupportActors.includes(actor)) throw new Error(`Program CI graph support packet must include ${actor}`);
}
if (!graphSupportExamples.every((row) =>
  typeof row.relationshipSupport === "string"
  && typeof row.supportingSourceFamily === "string"
  && ["proven", "missing_public_support", "metadata_only", "single_source", "none"].includes(String(row.sourceFamilyProofState))
  && ["none", "contradicted", "review_hold"].includes(String(row.contradictionState))
  && typeof row.caveat === "string"
  && typeof row.nextBuyerSearch === "string"
  && typeof row.repairOwner === "string"
  && row.countsTowardProductionSellableRows === false
  && row.noLeak === true
)) {
  throw new Error("Program CI graph examples must expose relationship support, caveats, next search, no-leak proof, and floor exclusion");
}
const graphSupportOwners = (graphSellableSupportPacket.ownerHandoffs as Array<Record<string, unknown>>).map((row) => row.owner);
for (const owner of ["agent_03", "agent_04", "agent_05", "agent_07", "agent_08", "agent_09", "agent_10"]) {
  if (!graphSupportOwners.includes(owner)) throw new Error(`Program CI graph support packet must include ${owner} handoff`);
}
const graphSupportNoLeak = graphSellableSupportPacket.noLeakBoundary as Record<string, unknown> | undefined;
if (
  !graphSupportNoLeak
  || graphSupportNoLeak.rawEvidenceBodies !== false
  || graphSupportNoLeak.unsafeUrls !== false
  || graphSupportNoLeak.objectKeys !== false
  || graphSupportNoLeak.credentials !== false
  || graphSupportNoLeak.payloadLinks !== false
  || graphSupportNoLeak.privateMaterial !== false
  || graphSupportNoLeak.actorInteraction !== false
) {
  throw new Error("Program CI graph support packet must keep no-leak boundaries closed");
}
const graphPublicCorroborationPivotPacket = outputRecord.graphPublicCorroborationPivotPacket as Record<string, unknown> | undefined;
if (
  !graphPublicCorroborationPivotPacket
  || graphPublicCorroborationPivotPacket.schemaVersion !== "ti.apify_graph_public_corroboration_pivot_packet.v1"
  || graphPublicCorroborationPivotPacket.baselineRunId !== "OThlfd0uzSCNnedAO"
  || graphPublicCorroborationPivotPacket.baselineDatasetId !== "LSen2fYtwFTtOr7vK"
  || graphPublicCorroborationPivotPacket.dryRun !== true
  || graphPublicCorroborationPivotPacket.willMutateSources !== false
  || graphPublicCorroborationPivotPacket.willStartCollection !== false
  || graphPublicCorroborationPivotPacket.productionSellableFloor !== 100
  || Number(graphPublicCorroborationPivotPacket.candidateCount) !== 30
  || Number(graphPublicCorroborationPivotPacket.rowUnlockingCandidateCount) !== 24
  || Number(graphPublicCorroborationPivotPacket.contradictionOrAliasHoldCount) !== 6
  || Number(graphPublicCorroborationPivotPacket.graphOnlyRowsExcludedFromFloor) !== 30
  || Number(graphPublicCorroborationPivotPacket.projectedSellableRowsAfterPublicCorroboration) !== 42
  || !graphPublicCorroborationPivotPacket.publicProofMetrics
  || Number((graphPublicCorroborationPivotPacket.publicProofMetrics as Record<string, unknown>).pivotsTested) !== 24
  || Number((graphPublicCorroborationPivotPacket.publicProofMetrics as Record<string, unknown>).publicProofFound) !== 14
  || Number((graphPublicCorroborationPivotPacket.publicProofMetrics as Record<string, unknown>).rowsUnlockedForParserAdmission) !== 25
  || (graphPublicCorroborationPivotPacket.publicProofMetrics as Record<string, unknown>).countsTowardPaidFloorNow !== false
  || !graphPublicCorroborationPivotPacket.paidRowUnlockQueue
  || !Array.isArray(graphPublicCorroborationPivotPacket.candidates)
  || graphPublicCorroborationPivotPacket.candidates.length !== 30
  || !Array.isArray(graphPublicCorroborationPivotPacket.ownerHandoffs)
) {
  throw new Error("OUTPUT record must expose Program CY graph public corroboration pivots");
}
const hostedPublicCorroborationLift = graphPublicCorroborationPivotPacket.hostedDefaultPublicCorroborationLift as Record<string, unknown> | undefined;
const hostedPublicObservedRun = hostedPublicCorroborationLift?.observedHostedRun as Record<string, unknown> | undefined;
const hostedPublicProjected = hostedPublicCorroborationLift?.projectedHostedRerunEffect as Record<string, unknown> | undefined;
const hostedPublicAcceptedRows = Array.isArray(hostedPublicCorroborationLift?.acceptedPublicCorroborationRows)
  ? hostedPublicCorroborationLift.acceptedPublicCorroborationRows as Array<Record<string, unknown>>
  : [];
const hostedPublicRejectedRows = Array.isArray(hostedPublicCorroborationLift?.rejectedPublicCorroborationRows)
  ? hostedPublicCorroborationLift.rejectedPublicCorroborationRows as Array<Record<string, unknown>>
  : [];
if (
  !hostedPublicCorroborationLift
  || hostedPublicCorroborationLift.schemaVersion !== "ti.program_fh_hosted_public_corroboration_lift.v1"
  || hostedPublicCorroborationLift.owner !== "agent_08"
  || hostedPublicObservedRun?.runId !== "THMm2ZzYxW4HVPGJ6"
  || hostedPublicObservedRun?.buildId !== "L7LtCqLsKT6Luq04R"
  || hostedPublicObservedRun?.datasetId !== "xLPoxMVY6cVjGsS4e"
  || hostedPublicObservedRun?.baselineSellableRows !== 46
  || hostedPublicObservedRun?.baselineSellableFindings !== 31
  || hostedPublicObservedRun?.baselineCaveatedRows !== 194
  || hostedPublicObservedRun?.noLeakFailures !== 0
  || hostedPublicProjected?.baselineSellableRows !== 46
  || hostedPublicProjected?.acceptedCorroborationRows !== 54
  || hostedPublicProjected?.expectedSellableRowsAfterParserAdmission !== 100
  || hostedPublicProjected?.baselineSellableFindings !== 31
  || hostedPublicProjected?.expectedFindingRowsAfterParserAdmission !== 52
  || hostedPublicProjected?.hostedPaidProofClaimed !== false
  || hostedPublicAcceptedRows.length < 6
  || hostedPublicRejectedRows.length < 7
) {
  throw new Error("Program FH hosted public corroboration lift must expose the hosted 46-to-100 handoff without claiming paid proof");
}
for (const rowClass of ["single_source", "stale_timestamp", "missing_sector_country", "missing_ttp_tool", "missing_buyer_action", "missing_confidence_reason"]) {
  if (!hostedPublicAcceptedRows.some((row) => row.class === rowClass)) throw new Error(`Program FH hosted public corroboration lift must include ${rowClass}`);
}
if (hostedPublicAcceptedRows.reduce((sum, row) => sum + Number(row.expectedRowsUnlockedAfterParserAdmission ?? 0), 0) !== 54) {
  throw new Error("Program FH hosted public corroboration lift must hand off 54 rows for parser admission");
}
for (const row of hostedPublicAcceptedRows) {
  if (
    row.buyerVisibleMetricImproved === "none"
    || typeof row.parserHandoff !== "string"
    || row.parserHandoff.length === 0
    || typeof row.provenanceHash !== "string"
    || row.provenanceHash.length === 0
    || row.countsTowardPaidPromotionNow !== false
    || row.noLeak !== true
  ) {
    throw new Error("Program FH accepted public corroboration rows must be buyer-visible, provenance-backed, no-leak, and not paid-counted");
  }
}
for (const row of hostedPublicRejectedRows) {
  if (row.buyerVisibleMetricImproved !== "none" || row.countsTowardPaidPromotionNow !== false || row.noLeak !== true) {
    throw new Error("Program FH rejected public corroboration rows must stay outside paid promotion");
  }
}
const hostedPublicNoLeak = hostedPublicCorroborationLift.noLeakBoundary as Record<string, unknown> | undefined;
if (!hostedPublicNoLeak || Object.values(hostedPublicNoLeak).some((value) => value !== false)) {
  throw new Error("Program FH hosted public corroboration lift must keep no-leak boundaries closed");
}
const graphPublicUnlockQueue = graphPublicCorroborationPivotPacket.paidRowUnlockQueue as Record<string, unknown>;
const graphPublicUnlockCounts = graphPublicUnlockQueue.counts as Record<string, unknown> | undefined;
if (
  !graphPublicUnlockCounts
  || Number(graphPublicUnlockCounts.admitted_by_parser) !== 0
  || Number(graphPublicUnlockCounts.ready_for_parser) !== 1000
  || Number(graphPublicUnlockCounts.ready_for_current_admission) !== 1000
  || Number(graphPublicUnlockCounts.ready_for_parser_admission) !== 14
  || Number(graphPublicUnlockCounts.needs_public_source) !== 6
  || Number(graphPublicUnlockCounts.contradicted) !== 6
  || Number(graphPublicUnlockCounts.contradicted_or_alias_hold) !== 6
  || Number(graphPublicUnlockCounts.stale) !== 4
  || Number(graphPublicUnlockCounts.stale_recheck) !== 4
  || Number(graphPublicUnlockCounts.unsafe_or_restricted) !== 0
  || Number(graphPublicUnlockCounts.rowsCountTowardFloorNow) !== 0
  || Number(graphPublicUnlockCounts.rowsReadyAfterParserAdmission) !== 25
  || graphPublicUnlockQueue.graphOnlyCountsTowardPaidFloorNow !== false
  || graphPublicUnlockQueue.noLeak !== true
) {
  throw new Error("Program CY paid row unlock queue must separate parser-ready, source-needed, contradicted, stale, and restricted buckets");
}
const graphPublicReadyUnlocks = graphPublicUnlockQueue.ready_for_parser_admission as Array<Record<string, unknown>> | undefined;
const graphPublicCurrentAdmission = graphPublicUnlockQueue.ready_for_current_admission as Array<Record<string, unknown>> | undefined;
const graphPublicNeedsPublicSource = graphPublicUnlockQueue.needs_public_source as Array<Record<string, unknown>> | undefined;
const graphPublicParserHandoff = graphPublicUnlockQueue.parserAdmissionHandoff as Array<Record<string, unknown>> | undefined;
if (
  !Array.isArray(graphPublicParserHandoff)
  || graphPublicParserHandoff.length !== 1000
  || !Array.isArray(graphPublicCurrentAdmission)
  || graphPublicCurrentAdmission.length !== 1000
  || !graphPublicParserHandoff.every((row) =>
    typeof row.actor === "string"
    && typeof row.victimOrTarget === "string"
    && typeof row.sourceFamily === "string"
    && Number(row.freshnessAgeDays) >= 0
    && typeof row.contradictionState === "string"
    && typeof row.provenanceHash === "string"
    && row.provenanceHash.length > 0
    && typeof row.buyerReason === "string"
    && row.buyerReason.length > 0
    && typeof row.programDbPriority === "object"
    && Number((row.programDbPriority as Record<string, unknown>).gapContribution) > 0
    && (row.programDbPriority as Record<string, unknown>).admissionBlocker === "none"
    && typeof row.programDcPriority === "object"
    && Number((row.programDcPriority as Record<string, unknown>).gapContribution) > 0
    && (row.programDcPriority as Record<string, unknown>).admissionBlocker === "none"
    && Number((row.programDcPriority as Record<string, unknown>).sourceFamilyDiversityLift) > 0
    && typeof (row.programDcPriority as Record<string, unknown>).corroborationStrength === "string"
    && typeof (row.programDcPriority as Record<string, unknown>).freshnessRisk === "string"
    && typeof row.programDdPriority === "object"
    && Number((row.programDdPriority as Record<string, unknown>).gapContribution) > 0
    && (row.programDdPriority as Record<string, unknown>).admissionBlocker === "none"
    && Number((row.programDdPriority as Record<string, unknown>).sourceFamilyDiversityLift) > 0
    && typeof (row.programDdPriority as Record<string, unknown>).corroborationStrength === "string"
    && typeof (row.programDdPriority as Record<string, unknown>).contradictionRisk === "string"
    && typeof (row.programDdPriority as Record<string, unknown>).freshnessRisk === "string"
    && typeof (row.programDdPriority as Record<string, unknown>).buyerVisibleValue === "string"
    && (row.programDdPriority as Record<string, unknown>).noLeakProof === "hash_only_public_or_metadata_reference"
    && typeof (row.programDdPriority as Record<string, unknown>).nextPivot === "string"
    && typeof row.programDePriority === "object"
    && Number((row.programDePriority as Record<string, unknown>).confidenceLift) >= 0
    && Number((row.programDePriority as Record<string, unknown>).freshnessLift) >= 0
    && Number((row.programDePriority as Record<string, unknown>).sourceFamilyLift) >= 0
    && typeof (row.programDePriority as Record<string, unknown>).contradictionRisk === "string"
    && typeof (row.programDePriority as Record<string, unknown>).sourceProvenanceOnlyRisk === "string"
    && typeof (row.programDePriority as Record<string, unknown>).buyerVisibleNextPivot === "string"
    && typeof (row.programDePriority as Record<string, unknown>).gateContribution === "string"
    && (row.programDePriority as Record<string, unknown>).noLeakProof === "hash_only_public_or_metadata_reference"
    && typeof (row.programDePriority as Record<string, unknown>).admissionBlocker === "string"
    && typeof row.programFgPriority === "object"
    && typeof (row.programFgPriority as Record<string, unknown>).whyCorroborationMatters === "string"
    && typeof (row.programFgPriority as Record<string, unknown>).buyerActionEnabled === "string"
    && Number((row.programFgPriority as Record<string, unknown>).confidenceDelta) > 0
    && Number((row.programFgPriority as Record<string, unknown>).freshnessDelta) > 0
    && Number((row.programFgPriority as Record<string, unknown>).sourceFamilyDelta) > 0
    && typeof (row.programFgPriority as Record<string, unknown>).contradictionRisk === "string"
    && typeof (row.programFgPriority as Record<string, unknown>).parserAdmissionReason === "string"
    && typeof (row.programFgPriority as Record<string, unknown>).nextParserSlice === "string"
    && (row.programFgPriority as Record<string, unknown>).noLeakProof === "hash_only_public_or_metadata_reference"
    && (row.programFgPriority as Record<string, unknown>).admissionBlocker === "none"
    && Number(row.expectedPaidRowLiftAfterParserAdmission) > 0
    && row.admissionState === "ready_for_parser"
    && row.countsTowardFloorNow === false
    && row.noLeak === true
  )
  ||
  !Array.isArray(graphPublicReadyUnlocks)
  || graphPublicReadyUnlocks.reduce((sum, row) => sum + Number(row.expectedRowsUnlockedAfterParserAdmission ?? 0), 0) !== 25
  || !graphPublicReadyUnlocks.every((row) => row.countsTowardFloorNow === false && typeof row.proofUrlHash === "string" && row.proofUrlHash.length > 0 && row.noLeak === true)
  || !Array.isArray(graphPublicNeedsPublicSource)
  || !graphPublicNeedsPublicSource.some((row) => row.sourceClass === "restricted_metadata_public_support")
) {
  throw new Error("Program CY paid row unlock queue must expose hash-only parser and public-support handoff rows");
}
const graphPublicProgramDbRejectionBuckets = graphPublicUnlockQueue.programDbRejectionBuckets as Record<string, unknown> | undefined;
const graphPublicProgramDcRejectionBuckets = graphPublicUnlockQueue.programDcRejectionBuckets as Record<string, unknown> | undefined;
const graphPublicProgramDdRejectionBuckets = graphPublicUnlockQueue.programDdRejectionBuckets as Record<string, unknown> | undefined;
const graphPublicProgramDeRejectionBuckets = graphPublicUnlockQueue.programDeRejectionBuckets as Record<string, unknown> | undefined;
if (
  graphPublicParserHandoff.filter((row) => (row.programDdPriority as Record<string, unknown>).findingLikely === true).length < 350
  || graphPublicParserHandoff.filter((row) => (row.programDePriority as Record<string, unknown>).admissionBlocker === "none" && Number((row.programDePriority as Record<string, unknown>).expectedCurrentRowLift) > 0).length < 150
  || graphPublicParserHandoff.filter((row) => (row.programDePriority as Record<string, unknown>).gateContribution === "current750").length < 150
  || graphPublicParserHandoff.filter((row) => (row.programFgPriority as Record<string, unknown>).nextParserSlice === "current1000_alias_victim_ttp").length < 100
  || graphPublicParserHandoff.filter((row) => (row.programFgPriority as Record<string, unknown>).nextParserSlice === "current1000_source_family_freshness").length < 150
  || graphPublicParserHandoff.filter((row) => (row.programFgPriority as Record<string, unknown>).nextParserSlice === "current1000_metadata_public_support").length < 50
  || !graphPublicProgramDbRejectionBuckets
  || Number(graphPublicProgramDbRejectionBuckets.stale) !== 4
  || Number(graphPublicProgramDbRejectionBuckets.alias_conflict) !== 4
  || Number(graphPublicProgramDbRejectionBuckets.contradiction) !== 2
  || Number(graphPublicProgramDbRejectionBuckets.duplicate) !== 0
  || Number(graphPublicProgramDbRejectionBuckets.generic_source_page) !== 0
  || Number(graphPublicProgramDbRejectionBuckets.restricted_only) !== 0
  || Number(graphPublicProgramDbRejectionBuckets.not_enough_source_support) !== 6
  || Number(graphPublicProgramDbRejectionBuckets.rowsCountTowardFloorNow) !== 0
  || graphPublicProgramDbRejectionBuckets.noLeak !== true
  || !graphPublicProgramDcRejectionBuckets
  || Number(graphPublicProgramDcRejectionBuckets.stale) !== 4
  || Number(graphPublicProgramDcRejectionBuckets.alias_conflict) !== 4
  || Number(graphPublicProgramDcRejectionBuckets.contradiction) !== 2
  || Number(graphPublicProgramDcRejectionBuckets.duplicate) !== 0
  || Number(graphPublicProgramDcRejectionBuckets.generic_source_page) !== 0
  || Number(graphPublicProgramDcRejectionBuckets.restricted_only) !== 0
  || Number(graphPublicProgramDcRejectionBuckets.not_enough_source_support) !== 6
  || Number(graphPublicProgramDcRejectionBuckets.missing_buyer_action) !== 0
  || Number(graphPublicProgramDcRejectionBuckets.weak_source_family_diversity) !== 0
  || Number(graphPublicProgramDcRejectionBuckets.rowsCountTowardFloorNow) !== 0
  || graphPublicProgramDcRejectionBuckets.noLeak !== true
  || !graphPublicProgramDdRejectionBuckets
  || Number(graphPublicProgramDdRejectionBuckets.stale) !== 4
  || Number(graphPublicProgramDdRejectionBuckets.alias_conflict) !== 4
  || Number(graphPublicProgramDdRejectionBuckets.contradiction) !== 2
  || Number(graphPublicProgramDdRejectionBuckets.duplicate) !== 0
  || Number(graphPublicProgramDdRejectionBuckets.generic_source_page) !== 0
  || Number(graphPublicProgramDdRejectionBuckets.restricted_only) !== 0
  || Number(graphPublicProgramDdRejectionBuckets.not_enough_source_support) !== 6
  || Number(graphPublicProgramDdRejectionBuckets.missing_buyer_action) !== 0
  || Number(graphPublicProgramDdRejectionBuckets.weak_source_family_diversity) !== 0
  || Number(graphPublicProgramDdRejectionBuckets.graph_only_speculation) !== 0
  || Number(graphPublicProgramDdRejectionBuckets.rowsCountTowardFloorNow) !== 0
  || graphPublicProgramDdRejectionBuckets.noLeak !== true
  || !graphPublicProgramDeRejectionBuckets
  || Number(graphPublicProgramDeRejectionBuckets.stale) !== 4
  || Number(graphPublicProgramDeRejectionBuckets.alias_conflict) !== 4
  || Number(graphPublicProgramDeRejectionBuckets.contradiction) !== 2
  || Number(graphPublicProgramDeRejectionBuckets.duplicate) !== 0
  || Number(graphPublicProgramDeRejectionBuckets.generic_source_page) !== 0
  || Number(graphPublicProgramDeRejectionBuckets.restricted_only) !== 0
  || Number(graphPublicProgramDeRejectionBuckets.not_enough_source_support) !== 6
  || Number(graphPublicProgramDeRejectionBuckets.missing_buyer_action) !== 0
  || Number(graphPublicProgramDeRejectionBuckets.weak_source_family_diversity) !== 0
  || Number(graphPublicProgramDeRejectionBuckets.graph_only_speculation) !== 0
  || Number(graphPublicProgramDeRejectionBuckets.unsupported_relationship_padding) !== 0
  || Number(graphPublicProgramDeRejectionBuckets.rowsCountTowardFloorNow) !== 0
  || graphPublicProgramDeRejectionBuckets.noLeak !== true
) {
  throw new Error("Program DE graph public handoff must expose 750 rows, DE priority, 350-plus finding-likely rows, current750 contribution, and explicit rejection buckets");
}
const graphPublicPivots = graphPublicCorroborationPivotPacket.candidates as Array<Record<string, unknown>>;
if (!graphPublicPivots.every((row) => {
  const pivot = row.nextPublicCorroborationPivot as Record<string, unknown> | undefined;
  return typeof row.relationshipSupport === "string"
    && typeof row.proofUrlHash === "string"
    && typeof row.sourceType === "string"
    && typeof row.parserHandoffReason === "string"
    && typeof row.worthPayingForReason === "string"
    && typeof row.candidateFields === "object"
    && pivot
    && typeof pivot.queryText === "string"
    && typeof pivot.expectedSourceFamily === "string"
    && typeof pivot.repairsRowField === "string"
    && row.graphOnlyCountsTowardSellableRows === false
    && (row.publicProofState !== "public_proof_found" || row.countsTowardProductionSellableRowsAfterParserAdmission === true)
    && row.rowUnlockRequiresNonGraphEvidence === true
    && row.noLeak === true;
})) {
  throw new Error("Program CY graph public pivots must expose hash-only handoff fields, floor exclusion, and no-leak proof");
}
if (!graphPublicPivots
  .filter((row) => row.currentBlockedState === "contradiction_hold" || row.currentBlockedState === "alias_collision_hold")
  .every((row) => {
    const pivot = row.nextPublicCorroborationPivot as Record<string, unknown> | undefined;
    return row.expectedSellableRowsUnlockedAfterPublicProof === 0
      && pivot
      && ["medium", "high"].includes(String(pivot.contradictionRisk))
      && ["medium", "high"].includes(String(pivot.aliasCollisionRisk));
  })) {
  throw new Error("Program CS contradiction and alias pivots must be held with zero sellable projected gain");
}
const graphPublicNoLeak = graphPublicCorroborationPivotPacket.noLeakBoundary as Record<string, unknown> | undefined;
if (
  !graphPublicNoLeak
  || graphPublicNoLeak.rawEvidenceBodies !== false
  || graphPublicNoLeak.unsafeUrls !== false
  || graphPublicNoLeak.objectKeys !== false
  || graphPublicNoLeak.credentials !== false
  || graphPublicNoLeak.payloadLinks !== false
  || graphPublicNoLeak.privateMaterial !== false
  || graphPublicNoLeak.actorInteraction !== false
) {
  throw new Error("Program CS graph public pivots must keep no-leak boundaries closed");
}
const marketplaceConversionRealRowSamplePack = outputRecord.marketplaceConversionRealRowSamplePack as Record<string, unknown> | undefined;
if (
  !marketplaceConversionRealRowSamplePack
  || marketplaceConversionRealRowSamplePack.schemaVersion !== "ti.apify_marketplace_conversion_real_row_sample_pack.v1"
  || marketplaceConversionRealRowSamplePack.source !== "current_safe_output_rows_only"
  || marketplaceConversionRealRowSamplePack.proofRunId !== "OThlfd0uzSCNnedAO"
  || marketplaceConversionRealRowSamplePack.proofDatasetId !== "LSen2fYtwFTtOr7vK"
  || marketplaceConversionRealRowSamplePack.productionPaidTrafficReady !== false
  || Number(marketplaceConversionRealRowSamplePack.currentSellableRows) < 1
  || marketplaceConversionRealRowSamplePack.targetSellableRows !== 100
  || !Array.isArray(marketplaceConversionRealRowSamplePack.sampleRows)
  || !Array.isArray(marketplaceConversionRealRowSamplePack.excludedAsPaidReadinessProof)
  || !Array.isArray(marketplaceConversionRealRowSamplePack.marketplaceTelemetryDescriptors)
) {
  throw new Error("OUTPUT record must expose Program CL real-row marketplace conversion sample pack");
}
for (const row of marketplaceConversionRealRowSamplePack.sampleRows as Array<Record<string, unknown>>) {
  if (
    typeof row.actorOrGroup !== "string"
    || typeof row.claimType !== "string"
    || typeof row.victimOrTargetWhenSafe !== "string"
    || !Array.isArray(row.sectorCountry)
    || !Array.isArray(row.ttpToolCvePivots)
    || !["current", "recent"].includes(String(row.freshness))
    || Number(row.confidence) <= 0
    || row.corroborationState !== "corroborated"
    || row.contradictionState !== "none"
    || !Array.isArray(row.sourceFamilies)
    || !Array.isArray(row.nextBuyerSearchPivots)
    || typeof row.provenanceHash !== "string"
    || typeof row.whyUsefulNow !== "string"
    || row.noLeakProof !== "metadata_only_no_raw_body_no_credentials_no_private_content"
    || row.countsTowardCurrentSellableRows !== true
  ) {
    throw new Error("Program CL sample rows must be current sellable, corroborated, buyer-readable, and no-leak");
  }
}
const marketplaceConversionExcludedClasses = (marketplaceConversionRealRowSamplePack.excludedAsPaidReadinessProof as Array<Record<string, unknown>>).map((row) => row.rowClass);
for (const excludedClass of ["synthetic", "graph_only", "stale", "restricted_only", "caveat_only", "held", "coverage_gap"]) {
  if (!marketplaceConversionExcludedClasses.includes(excludedClass)) throw new Error(`Program CL sample pack must exclude ${excludedClass} from paid readiness proof`);
}
const paidTrafficExperimentReadiness = marketplaceConversionRealRowSamplePack.paidTrafficExperimentReadiness as Record<string, unknown> | undefined;
if (
  !paidTrafficExperimentReadiness
  || paidTrafficExperimentReadiness.status !== "blocked_until_100_real_sellable_rows"
  || !Array.isArray(paidTrafficExperimentReadiness.activatesWhen)
  || !String(paidTrafficExperimentReadiness.stopLossMetric).includes("sellable rows fall below 100")
) {
  throw new Error("Program CL paid-traffic experiment readiness must stay blocked until 100 real sellable rows");
}
for (const descriptor of marketplaceConversionRealRowSamplePack.marketplaceTelemetryDescriptors as Array<Record<string, unknown>>) {
  if (descriptor.currentValue !== "external_unknown" || descriptor.noSyntheticFallback !== true) {
    throw new Error("Program CL marketplace telemetry descriptors must remain external_unknown without synthetic fallback");
  }
}
const marketplaceRealRowNoFakeProof = marketplaceConversionRealRowSamplePack.noFakeProof as Record<string, unknown> | undefined;
if (
  !marketplaceRealRowNoFakeProof
  || marketplaceRealRowNoFakeProof.externalAnalyticsRequired !== true
  || marketplaceRealRowNoFakeProof.valuesRemainExternalUnknownUntilVerified !== true
  || marketplaceRealRowNoFakeProof.noSyntheticRowsUsed !== true
  || marketplaceRealRowNoFakeProof.noGraphOnlyRowsUsed !== true
  || marketplaceRealRowNoFakeProof.noCaveatOnlyRowsUsed !== true
  || marketplaceRealRowNoFakeProof.noRestrictedOnlyRowsUsed !== true
) {
  throw new Error("Program CL no-fake proof must block invented analytics and non-real-row proof");
}
const first100BuyerPreview = marketplaceConversionRealRowSamplePack.first100BuyerPreview as Record<string, unknown> | undefined;
if (
  !first100BuyerPreview
  || first100BuyerPreview.schemaVersion !== "ti.apify_first_100_real_rows_buyer_preview.v1"
  || first100BuyerPreview.status !== "blocked_preview_until_100_real_sellable_rows"
  || Number(first100BuyerPreview.currentSellableRows) < 1
  || Number(first100BuyerPreview.remainingSellableRowsNeeded) <= 0
  || first100BuyerPreview.sampleRowsRequiredBeforePaidTraffic !== 100
  || !Array.isArray(first100BuyerPreview.topBlockerBuckets)
  || !Array.isArray(first100BuyerPreview.requiredBuyerFields)
  || !Array.isArray(first100BuyerPreview.activationGate)
) {
  throw new Error("Program CT first-100 buyer preview must stay blocked until 100 real sellable rows");
}
if (!(first100BuyerPreview.topBlockerBuckets as Array<Record<string, unknown>>).every((bucket) =>
  bucket.countsTowardPaidFloorNow === false
  && typeof bucket.buyerVisibleFix === "string"
  && String(bucket.buyerVisibleFix).length > 0
)) {
  throw new Error("Program CT blocker buckets must explain buyer-visible repairs without counting toward paid floor");
}
for (const requiredField of ["actorOrGroup", "claimType", "victimOrTargetWhenSafe", "sectorCountry", "ttpToolCvePivots", "freshness", "confidence", "provenanceHash", "noLeakProof"]) {
  if (!(first100BuyerPreview.requiredBuyerFields as string[]).includes(requiredField)) {
    throw new Error(`Program CT first-100 preview must require ${requiredField}`);
  }
}
const first100NoLeakProof = first100BuyerPreview.noLeakProof as Record<string, unknown> | undefined;
const first100FreshnessProof = first100BuyerPreview.freshnessProof as Record<string, unknown> | undefined;
if (
  !first100NoLeakProof
  || first100NoLeakProof.rawEvidenceBodies !== false
  || first100NoLeakProof.unsafeUrls !== false
  || first100NoLeakProof.credentials !== false
  || first100NoLeakProof.privateContent !== false
  || first100NoLeakProof.restrictedOnlyRowsPromoted !== false
  || !first100FreshnessProof
  || first100FreshnessProof.staleRowsCountTowardPaidFloor !== false
) {
  throw new Error("Program CT first-100 preview must prove no-leak and stale-row exclusions");
}
const paidReleaseTruthBoard = outputRecord.paidReleaseTruthBoard as Record<string, unknown> | undefined;
if (
  !paidReleaseTruthBoard
  || paidReleaseTruthBoard.schemaVersion !== "ti.program_cq_paid_release_truth_board.v1"
  || paidReleaseTruthBoard.productionSellableFloor !== 100
  || paidReleaseTruthBoard.paidTrafficAllowed !== false
  || !Array.isArray(paidReleaseTruthBoard.routeVisibleOn)
  || !paidReleaseTruthBoard.routeVisibleOn.includes("Apify OUTPUT")
  || !Array.isArray(paidReleaseTruthBoard.blockerBuckets)
  || !Array.isArray(paidReleaseTruthBoard.exclusionProof)
) {
  throw new Error("OUTPUT record must expose Program CQ paid release truth board");
}
const paidReleaseObservedProof = paidReleaseTruthBoard.observedProof as Record<string, unknown> | undefined;
const paidReleaseDelta = paidReleaseTruthBoard.rowDeltaTo100 as Record<string, unknown> | undefined;
if (
  !paidReleaseObservedProof
  || paidReleaseObservedProof.proofDecision !== "shape_safety_proof"
  || paidReleaseObservedProof.apifySmokeRows !== output.length
  || paidReleaseObservedProof.apifySmokeSellableRows !== paidRowQuality.sellable
  || paidReleaseObservedProof.apifySmokeBuyerUsefulRows !== paidRowQuality.usefulForBuyer
  || paidReleaseObservedProof.apifySmokeAverageBuyerValueScore !== paidRowQuality.averageBuyerValueScore
  || paidReleaseObservedProof.remainingRowsFromSmokeProof !== Math.max(0, 100 - Number(paidRowQuality.sellable))
  || !paidReleaseDelta
  || paidReleaseDelta.alreadyChargeableRows !== paidRowQuality.sellable
  || paidReleaseDelta.remainingSellableRowsNeeded !== Math.max(0, 100 - Number(paidRowQuality.sellable))
  || paidReleaseDelta.bucketMathIsAdditive !== true
) {
  throw new Error("Program CQ release board must use observed smoke rows and exact delta to 100");
}
const paidReleaseBuckets = paidReleaseTruthBoard.blockerBuckets as Array<Record<string, unknown>>;
for (const blocker of ["already_chargeable", "missing_public_support", "parser_repair", "freshness", "alias_collision", "source_family_gap", "dark_metadata_public_support", "no_leak_proof", "marketplace_output_gap"]) {
  if (!paidReleaseBuckets.some((bucket) => bucket.blocker === blocker)) throw new Error(`Program CQ release board missing ${blocker}`);
}
const paidReleaseConversionObservability = paidReleaseTruthBoard.conversionObservability as Record<string, unknown> | undefined;
const paidReleaseCurrentSellable = paidReleaseConversionObservability?.current_sellable as Record<string, unknown> | undefined;
const paidReleaseProjectedAfterRepair = paidReleaseConversionObservability?.projected_after_repair as Record<string, unknown> | undefined;
const paidReleaseExternalUnknown = paidReleaseConversionObservability?.external_marketplace_unknown as Record<string, unknown> | undefined;
if (
  !paidReleaseConversionObservability
  || paidReleaseConversionObservability.schemaVersion !== "ti.program_cw_paid_conversion_observability.v1"
  || paidReleaseConversionObservability.releaseTrafficDecision !== "hold_paid_traffic"
  || !paidReleaseCurrentSellable
  || paidReleaseCurrentSellable.currentRows !== paidRowQuality.sellable
  || paidReleaseCurrentSellable.canCountNow !== true
  || !paidReleaseProjectedAfterRepair
  || paidReleaseProjectedAfterRepair.projectedRows !== 159
  || paidReleaseProjectedAfterRepair.canCountNow !== false
  || !paidReleaseExternalUnknown
  || paidReleaseExternalUnknown.state !== "external_unknown"
  || paidReleaseExternalUnknown.observedStoreViews !== null
  || paidReleaseExternalUnknown.observedActorRuns !== null
  || paidReleaseExternalUnknown.observedPaidRuns !== null
  || paidReleaseExternalUnknown.observedConversionRate !== null
) {
  throw new Error("Program CW conversion observability must separate current sellable rows, projected repairs, and external_unknown marketplace metrics");
}
for (const bucket of ["blocked_by_public_support", "blocked_by_parser", "blocked_by_freshness", "blocked_by_suppression", "blocked_by_no_leak"]) {
  const row = paidReleaseConversionObservability[bucket] as Record<string, unknown> | undefined;
  if (!row || typeof row.owner !== "string" || typeof row.nextTask !== "string" || typeof row.expectedRowGain !== "number" || typeof row.proofCommand !== "string" || row.canCountNow !== false) {
    throw new Error(`Program CW conversion observability bucket ${bucket} must expose owner, next task, expected gain, proof command, and non-current count state`);
  }
}
const paidReleaseObservedTelemetry = paidReleaseTruthBoard.observedMarketplaceTelemetry as Record<string, unknown> | undefined;
const paidReleaseObservedTelemetryValues = paidReleaseObservedTelemetry?.currentValues as Record<string, unknown> | undefined;
if (
  !paidReleaseObservedTelemetry
  || paidReleaseObservedTelemetry.schemaVersion !== "ti.program_cx_observed_marketplace_telemetry_contract.v1"
  || paidReleaseObservedTelemetry.ingestionState !== "external_unknown"
  || paidReleaseObservedTelemetry.unknownMeansNoClaim !== true
  || paidReleaseObservedTelemetry.noSyntheticFallback !== true
  || !paidReleaseObservedTelemetryValues
  || paidReleaseObservedTelemetryValues.storeViews !== null
  || paidReleaseObservedTelemetryValues.uniqueUsers !== null
  || paidReleaseObservedTelemetryValues.trialRuns !== null
  || paidReleaseObservedTelemetryValues.paidRuns !== null
  || paidReleaseObservedTelemetryValues.actorStarts !== null
  || paidReleaseObservedTelemetryValues.actorRuns !== null
  || paidReleaseObservedTelemetryValues.datasetRows !== null
  || paidReleaseObservedTelemetryValues.failedRuns !== null
  || paidReleaseObservedTelemetryValues.repeatUsers !== null
  || paidReleaseObservedTelemetryValues.refunds !== null
  || paidReleaseObservedTelemetryValues.platformUsageCostUsd !== null
  || paidReleaseObservedTelemetryValues.estimatedCreatorRevenueUsd !== null
  || paidReleaseObservedTelemetryValues.payoutState !== "external_unknown"
  || paidReleaseObservedTelemetryValues.pricingState !== "external_unknown"
  || !Array.isArray(paidReleaseObservedTelemetry.manualImportPath)
  || !Array.isArray(paidReleaseObservedTelemetry.apiImportPath)
  || !Array.isArray(paidReleaseObservedTelemetry.validationChecks)
  || !(paidReleaseObservedTelemetry.validationChecks as string[]).includes("paidRuns cannot exceed actorRuns when both are observed")
) {
  throw new Error("Program CX observed marketplace telemetry must keep external Apify analytics/billing unknown until imported from real sources");
}
const paidReleaseRunbook = paidReleaseTruthBoard.paidReleaseRunbook as Record<string, unknown> | undefined;
const paidReleaseRunbookGates = paidReleaseRunbook?.gates as Array<Record<string, unknown>> | undefined;
if (
  !paidReleaseRunbook
  || paidReleaseRunbook.schemaVersion !== "ti.program_cx_paid_release_runbook.v1"
  || paidReleaseRunbook.decision !== "hold_paid_traffic"
  || paidReleaseRunbook.paidTrafficAllowedWhenAllGatesPass !== true
  || !Array.isArray(paidReleaseRunbookGates)
  || !paidReleaseRunbookGates.some((gate) => gate.gate === "current_sellable_rows" && gate.observed === paidRowQuality.sellable && gate.state === "hold")
  || !paidReleaseRunbookGates.some((gate) => gate.gate === "refunds" && gate.observed === null && gate.state === "external_unknown")
  || !paidReleaseRunbookGates.some((gate) => gate.gate === "payout_readiness" && gate.observed === "external_unknown" && gate.state === "external_unknown")
  || !Array.isArray(paidReleaseRunbook.holdWhen)
  || !(paidReleaseRunbook.holdWhen as string[]).includes("current sellable rows are below 100")
  || !Array.isArray(paidReleaseRunbook.rollbackWhen)
  || !(paidReleaseRunbook.rollbackWhen as string[]).some((rule) => rule.includes("refund"))
) {
  throw new Error("Program CX paid release runbook must hold paid traffic until row, refund, payout, and no-leak gates pass");
}
const buyerPaidReleaseVerdict = paidReleaseTruthBoard.buyerPaidReleaseVerdict as Record<string, unknown> | undefined;
const buyerPaidReleaseVerdictBlockers = buyerPaidReleaseVerdict?.releaseBlockers as Array<Record<string, unknown>> | undefined;
if (
  !buyerPaidReleaseVerdict
  || buyerPaidReleaseVerdict.schemaVersion !== "ti.program_cu_buyer_paid_release_verdict.v1"
  || buyerPaidReleaseVerdict.decision !== "hold_paid_traffic"
  || buyerPaidReleaseVerdict.buyerReadableStatus !== "useful_sample_ready_paid_release_blocked"
  || buyerPaidReleaseVerdict.publicListingState !== "draft_copy_ready_not_promoted"
  || buyerPaidReleaseVerdict.currentSellableRows !== paidRowQuality.sellable
  || buyerPaidReleaseVerdict.productionSellableFloor !== 100
  || buyerPaidReleaseVerdict.usefulRows !== paidRowQuality.usefulForBuyer
  || buyerPaidReleaseVerdict.averageBuyerValueScore !== paidRowQuality.averageBuyerValueScore
  || !Array.isArray(buyerPaidReleaseVerdictBlockers)
  || !buyerPaidReleaseVerdictBlockers.some((gate) => gate.gate === "current_sellable_rows" && gate.state === "hold" && gate.countsTowardPaidRelease === false)
  || !buyerPaidReleaseVerdictBlockers.some((gate) => gate.gate === "external_marketplace_telemetry" && gate.state === "external_unknown" && gate.observed === "external_unknown")
  || !buyerPaidReleaseVerdictBlockers.some((gate) => gate.gate === "payout_readiness" && gate.state === "external_unknown")
  || !buyerPaidReleaseVerdictBlockers.some((gate) => gate.gate === "pricing_state" && gate.state === "external_unknown")
) {
  throw new Error("Program CU buyer paid-release verdict must hold paid traffic with observed rows and external_unknown marketplace gates");
}
const buyerPaidReleaseSamplePolicy = buyerPaidReleaseVerdict.sampleDatasetPolicy as Record<string, unknown> | undefined;
const buyerPaidReleaseOperatorRule = buyerPaidReleaseVerdict.operatorRecordingRule as Record<string, unknown> | undefined;
const buyerPaidReleaseNoLeakProof = buyerPaidReleaseVerdict.noLeakProof as Record<string, unknown> | undefined;
if (
  !buyerPaidReleaseSamplePolicy
  || buyerPaidReleaseSamplePolicy.caveatedRowsExplained !== true
  || buyerPaidReleaseSamplePolicy.lowValueRowsSuppressed !== true
  || buyerPaidReleaseSamplePolicy.noRawUnsafeMaterial !== true
  || !buyerPaidReleaseOperatorRule
  || buyerPaidReleaseOperatorRule.externalValuesStayUnknownUntilObserved !== true
  || !Array.isArray(buyerPaidReleaseOperatorRule.recordOnlyObservedApifyValues)
  || !(buyerPaidReleaseOperatorRule.recordOnlyObservedApifyValues as string[]).includes("paidRuns")
  || !(buyerPaidReleaseOperatorRule.recordOnlyObservedApifyValues as string[]).includes("payoutState")
  || !buyerPaidReleaseNoLeakProof
  || buyerPaidReleaseNoLeakProof.rawEvidenceBodies !== false
  || buyerPaidReleaseNoLeakProof.unsafeUrls !== false
  || buyerPaidReleaseNoLeakProof.credentials !== false
  || buyerPaidReleaseNoLeakProof.restrictedPayloads !== false
  || buyerPaidReleaseNoLeakProof.privateContent !== false
) {
  throw new Error("Program CU buyer verdict must explain sample policy, observed-only operator recording, and no-leak proof");
}
const hostedPaidReadinessProof = paidReleaseTruthBoard.hostedPaidReadinessProof as Record<string, unknown> | undefined;
const hostedPaidLocalProof = hostedPaidReadinessProof?.localProof as Record<string, unknown> | undefined;
const latestHostedProof = hostedPaidReadinessProof?.latestHostedProof as Record<string, unknown> | undefined;
const hostedMarketplaceInputs = hostedPaidReadinessProof?.marketplaceConversionInputs as Record<string, unknown> | undefined;
const hostedPaidAcceptance = hostedPaidReadinessProof?.paidProofAcceptance as Record<string, unknown> | undefined;
const hostedPaidIntegrityGate = hostedPaidReadinessProof?.paidRowIntegrityGate as Record<string, unknown> | undefined;
const hostedConversionPayoutTruth = hostedPaidReadinessProof?.conversionPayoutTruth as Record<string, Record<string, unknown>> | undefined;
const hostedProgramFgEvidenceBoard = hostedPaidReadinessProof?.programFgObservedEvidenceBoard as Record<string, unknown> | undefined;
const hostedProgramFgRun = hostedProgramFgEvidenceBoard?.observedHostedRun as Record<string, unknown> | undefined;
const hostedProgramFgMarketplace = hostedProgramFgEvidenceBoard?.observedMarketplaceTruth as Record<string, unknown> | undefined;
const hostedProofImportPath = hostedPaidReadinessProof?.hostedProofImportPath as Record<string, unknown> | undefined;
const hostedProofObservedFields = hostedProofImportPath?.observedFields as Record<string, unknown> | undefined;
const hostedProofOperatorChecklist = hostedPaidReadinessProof?.hostedProofOperatorChecklist as Record<string, unknown> | undefined;
if (
  !hostedPaidReadinessProof
  || hostedPaidReadinessProof.schemaVersion !== "ti.hosted_apify_paid_readiness_proof.v1"
  || hostedPaidReadinessProof.status !== "external_token_missing"
  || hostedPaidReadinessProof.command !== "bun run check:hosted-apify-paid-readiness"
  || hostedPaidReadinessProof.paidTrafficAllowed !== false
  || hostedPaidReadinessProof.countsTowardPaidPromotion !== false
  || !hostedPaidLocalProof
  || hostedPaidLocalProof.defaultQueryCount !== 100
  || hostedPaidLocalProof.sellableRows !== 187
  || hostedPaidLocalProof.countsTowardPaidPromotion !== false
  || !latestHostedProof
  || latestHostedProof.historical !== true
  || latestHostedProof.runId !== "OThlfd0uzSCNnedAO"
  || latestHostedProof.querySetCount !== 1
  || latestHostedProof.sellableRows !== 4
  || latestHostedProof.paidFloorProof !== false
  || latestHostedProof.countsTowardPaidPromotion !== false
  || !hostedProofImportPath
  || hostedProofImportPath.schemaVersion !== "ti.hosted_apify_proof_import_path.v1"
  || hostedProofImportPath.mode !== "json_import_or_run_or_verify_with_apify_token"
  || hostedProofImportPath.observedOnly !== true
  || hostedProofImportPath.noSyntheticFallback !== true
  || hostedProofImportPath.oldProofTreatment !== "historical_shape_safety_only"
  || hostedProofImportPath.externalBlocker !== "external_token_missing"
  || (hostedProofImportPath.observedProofImport as Record<string, unknown> | undefined)?.schemaVersion !== "ti.hosted_apify_observed_proof_import_path.v1"
  || (hostedProofImportPath.observedProofImport as Record<string, unknown> | undefined)?.validationState !== "missing"
  || !hostedProofObservedFields
  || hostedProofObservedFields.runId !== null
  || hostedProofObservedFields.buildId !== null
  || hostedProofObservedFields.runStatus !== null
  || hostedProofObservedFields.failureState !== null
  || hostedProofObservedFields.datasetId !== null
  || hostedProofObservedFields.sellableRows !== null
  || hostedProofObservedFields.sellableFindingCount !== null
  || hostedProofObservedFields.chargedEventCount !== null
  || hostedProofObservedFields.chargedDatasetItemEvents !== null
  || hostedProofObservedFields.chargedActorStartEvents !== null
  || hostedProofObservedFields.secondBatchAuditObserved !== false
  || !hostedMarketplaceInputs
  || hostedMarketplaceInputs.storeViews !== null
  || hostedMarketplaceInputs.runs !== null
  || hostedMarketplaceInputs.uniqueUsers !== null
  || hostedMarketplaceInputs.paidUsers !== null
  || hostedMarketplaceInputs.refunds !== null
  || hostedMarketplaceInputs.payoutEnabled !== "external_unknown"
  || hostedMarketplaceInputs.pricingModel !== "external_unknown"
  || hostedMarketplaceInputs.publicListingStatus !== "draft_copy_ready_not_promoted"
  || !hostedPaidAcceptance
  || hostedPaidAcceptance.minimumSellableRows !== 100
  || hostedPaidAcceptance.minimumSellableFindingRows !== 52
  || hostedPaidAcceptance.sourceProvenanceRowsCountTowardFindingFloor !== false
  || hostedPaidAcceptance.falsePositiveInflationFailures !== 0
  || !hostedConversionPayoutTruth
  || hostedConversionPayoutTruth.pricing?.state !== "external_unknown"
  || hostedConversionPayoutTruth.payout?.state !== "external_unknown"
  || hostedConversionPayoutTruth.analytics?.state !== "external_unknown"
  || hostedConversionPayoutTruth.hosted500?.state !== "external_unknown"
  || !hostedPaidIntegrityGate
  || hostedPaidIntegrityGate.schemaVersion !== "ti.program_cp_hosted_paid_row_integrity_gate.v1"
  || hostedPaidIntegrityGate.sourceProofField !== "falsePositiveSuppressionGate.programCpHardening.secondBatchAudit"
  || hostedPaidIntegrityGate.requiredForPaidPromotion !== true
  || hostedPaidIntegrityGate.hostedProofCountsTowardPaidPromotion !== false
  || hostedPaidIntegrityGate.sourceProvenanceRowsCountTowardFindingFloor !== false
  || hostedPaidIntegrityGate.caveatedRowsCountTowardChargeable !== false
) {
  throw new Error("Hosted paid-readiness proof must keep local and single-query hosted proof out of paid promotion until 100-name hosted Apify metrics are observed");
}
if (
  !hostedProgramFgEvidenceBoard
  || hostedProgramFgEvidenceBoard.schemaVersion !== "ti.program_fg_observed_apify_hosted_marketplace_truth.v1"
  || hostedProgramFgEvidenceBoard.importState !== "no_proof_imported"
  || hostedProgramFgEvidenceBoard.hostedProofState !== "missing"
  || hostedProgramFgEvidenceBoard.marketplaceTruthState !== "external_unknown"
  || hostedProgramFgEvidenceBoard.releaseBlockerState !== "no_proof_imported"
  || hostedProgramFgEvidenceBoard.noSyntheticFallback !== true
  || !Array.isArray(hostedProgramFgEvidenceBoard.blockedProofClasses)
  || !(hostedProgramFgEvidenceBoard.blockedProofClasses as string[]).includes("sample")
  || !(hostedProgramFgEvidenceBoard.blockedProofClasses as string[]).includes("historical_shape_safety")
  || !hostedProgramFgRun
  || hostedProgramFgRun.buildId !== null
  || hostedProgramFgRun.failureState !== null
  || hostedProgramFgRun.chargedEventCount !== null
  || !hostedProgramFgMarketplace
  || hostedProgramFgMarketplace.pricingModel !== "external_unknown"
  || hostedProgramFgMarketplace.payoutState !== "external_unknown"
  || hostedProgramFgMarketplace.analyticsVisible !== "external_unknown"
  || hostedProgramFgMarketplace.conversionRate !== null
  || !Array.isArray(hostedProgramFgEvidenceBoard.missingExternalFields)
  || !(hostedProgramFgEvidenceBoard.missingExternalFields as string[]).includes("buildId")
  || !(hostedProgramFgEvidenceBoard.missingExternalFields as string[]).includes("chargedEventCount")
  || !(hostedProgramFgEvidenceBoard.missingExternalFields as string[]).includes("listingVisibility")
  || !Array.isArray(hostedProgramFgEvidenceBoard.nextSafeCommands)
  || !(hostedProgramFgEvidenceBoard.nextSafeCommands as string[]).some((command) => command.includes("TI_APIFY_OBSERVED_PROOF_PATH"))
) {
  throw new Error("Program FG hosted proof evidence board must expose missing observed Apify run, charge, marketplace, and safe import paths");
}
const hostedProofChecklistGateEffects = hostedProofOperatorChecklist?.gateEffects as Record<string, Record<string, unknown>> | undefined;
const hostedProofChecklistExamples = hostedProofOperatorChecklist?.validationExamples as Array<Record<string, unknown>> | undefined;
const hostedProofOperatorActionBoard = hostedProofOperatorChecklist?.operatorActionBoard as Record<string, unknown> | undefined;
if (
  !hostedProofOperatorChecklist
  || hostedProofOperatorChecklist.schemaVersion !== "ti.hosted_apify_proof_operator_checklist.v1"
  || hostedProofOperatorChecklist.status !== "missing_proof"
  || hostedProofOperatorChecklist.sampleOnly !== false
  || hostedProofOperatorChecklist.unlockSummary !== "none"
  || !hostedProofOperatorActionBoard
  || hostedProofOperatorActionBoard.canRunNow !== false
  || hostedProofOperatorActionBoard.canVerifyRunNow !== false
  || hostedProofOperatorActionBoard.canImportObservedProofNow !== false
  || !Array.isArray(hostedProofOperatorActionBoard.missingSecretNames)
  || !(hostedProofOperatorActionBoard.missingSecretNames as string[]).includes("APIFY_TOKEN")
  || typeof hostedProofOperatorActionBoard.nextCommand !== "string"
  || !hostedProofOperatorActionBoard.nextCommand.includes("TI_APIFY_HOSTED_PROOF_MODE=run")
  || hostedProofOperatorActionBoard.expectedUnlock !== "none"
  || !Array.isArray(hostedProofOperatorChecklist.missingFields)
  || !(hostedProofOperatorChecklist.missingFields as string[]).includes("runId")
  || !(hostedProofOperatorChecklist.missingFields as string[]).includes("pricingModel")
  || !hostedProofChecklistGateEffects
  || hostedProofChecklistGateEffects.hosted100?.state !== "hold"
  || hostedProofChecklistGateEffects.hosted100?.unlocks !== false
  || hostedProofChecklistGateEffects.hosted300?.state !== "hold"
  || hostedProofChecklistGateEffects.hosted500?.state !== "hold"
  || hostedProofChecklistGateEffects.marketplacePromotion?.state !== "hold"
  || !hostedProofChecklistExamples?.some((example) => example.name === "sample_proof_rejected_for_promotion" && example.unlockSummary === "none")
  || !hostedProofChecklistExamples.some((example) => example.name === "valid_hosted100_hosted300_hold" && example.unlockSummary === "hosted100")
  || !hostedProofChecklistExamples.some((example) => example.name === "valid_hosted300_hosted500_hold" && example.unlockSummary === "hosted100_hosted300")
  || !hostedProofChecklistExamples.some((example) => example.name === "valid_hosted500_marketplace_hold" && example.unlockSummary === "hosted100_hosted300_hosted500")
  || !hostedProofChecklistExamples.some((example) => example.name === "invalid_unsafe_no_leak_proof" && example.expectedStatus === "rejected")
) {
  throw new Error("Hosted proof operator checklist must explain operator action state, missing fields, sample rejection, hosted100/hosted300/hosted500 gate effects, and unsafe proof rejection");
}
const hostedProofCommandExamples = hostedProofImportPath.commandExamples as string[] | undefined;
if (!hostedProofCommandExamples?.join(" ").includes("TI_APIFY_HOSTED_PROOF_MODE=run") || !hostedProofCommandExamples.join(" ").includes("TI_APIFY_OBSERVED_PROOF_PATH") || !hostedProofCommandExamples.join(" ").includes("hosted-apify-observed-proof.hosted300.template.json") || !hostedProofCommandExamples.join(" ").includes("hosted-apify-observed-proof.hosted500.template.json")) {
  throw new Error("Hosted paid-readiness proof must expose copy/paste hosted run and verify commands");
}
const hostedRequiredZeroCounts = hostedPaidIntegrityGate.requiredZeroCounts as Record<string, unknown> | undefined;
for (const field of [
  "staleLatestActivitySellableRows",
  "aliasOrWrongActorSellableRows",
  "genericSourcePageSellableRows",
  "graphOnlySellableRows",
  "restrictedOnlySellableRows"
]) {
  if (hostedRequiredZeroCounts?.[field] !== 0) throw new Error(`Hosted paid-readiness CP integrity gate must require zero ${field}`);
}
const hostedPaidIntegrityRequiredSignals = hostedPaidIntegrityGate.requiredSignals as string[] | undefined;
for (const signal of ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"]) {
  if (!hostedPaidIntegrityRequiredSignals?.includes(signal)) throw new Error(`Hosted paid-readiness CP integrity gate must require ${signal}`);
}
const hostedPaidIntegrityBlockers = hostedPaidIntegrityGate.blockers as string[] | undefined;
for (const blocker of [
  "hosted_100_name_cp_second_batch_audit_not_yet_observed",
  "source_provenance_rows_do_not_count_as_findings",
  "stale_alias_generic_graph_restricted_rows_must_be_zero"
]) {
  if (!hostedPaidIntegrityBlockers?.includes(blocker)) throw new Error(`Hosted paid-readiness CP integrity gate must block on ${blocker}`);
}
const hostedPaidIntegrityNoLeakProof = hostedPaidIntegrityGate.noLeakProof as Record<string, unknown> | undefined;
for (const field of ["rawEvidenceExposed", "unsafeUrlsExposed", "restrictedPayloadsExposed", "objectKeysExposed", "privateMaterialExposed", "actorInteractionContentExposed"]) {
  if (hostedPaidIntegrityNoLeakProof?.[field] !== false) throw new Error(`Hosted paid-readiness CP integrity gate must prove no leak for ${field}`);
}
if (!((hostedPaidReadinessProof.manualVerificationSteps as string[] | undefined) ?? []).join(" ").includes("secondBatchAudit")) {
  throw new Error("Hosted paid-readiness proof must instruct operators to verify Program CP secondBatchAudit before paid promotion");
}
const programDcReleaseGates = paidReleaseTruthBoard.programDcReleaseGates as Record<string, unknown> | undefined;
const programDcCurrent500Gate = programDcReleaseGates?.current500Gate as Record<string, unknown> | undefined;
const programDcCurrent1000Gate = programDcReleaseGates?.current1000Gate as Record<string, unknown> | undefined;
const programDcHostedGate = programDcReleaseGates?.hostedProofExecutionGate as Record<string, unknown> | undefined;
const programDcMarketplaceGate = programDcReleaseGates?.marketplacePaidTrafficGate as Record<string, unknown> | undefined;
if (
  !programDcReleaseGates
  || programDcReleaseGates.schemaVersion !== "ti.program_dc_paid_release_gates.v1"
  || !programDcCurrent500Gate
  || programDcCurrent500Gate.requiredSellableRows !== 500
  || programDcCurrent500Gate.observedSellableRows !== paidRowQuality.sellable
  || programDcCurrent500Gate.requiredTrueFindingShare !== 0.55
  || programDcCurrent500Gate.maximumSourceProvenanceShare !== 0.4
  || !programDcCurrent1000Gate
  || programDcCurrent1000Gate.state !== "hold"
  || programDcCurrent1000Gate.requiredUsefulRows !== 1000
  || programDcCurrent1000Gate.countsProjectedRowsAsPaid !== false
  || !programDcHostedGate
  || programDcHostedGate.state !== "hold"
  || programDcHostedGate.observedOnly !== true
  || programDcHostedGate.observedProofImportState !== "missing"
  || !programDcMarketplaceGate
  || programDcMarketplaceGate.state !== "hold"
  || programDcMarketplaceGate.paidTrafficAllowedNow !== false
  || programDcMarketplaceGate.noInventedExternalMetrics !== true
) {
  throw new Error("Program DC release gates must expose current500/current1000/hosted/marketplace gates in Actor OUTPUT and keep hosted marketplace traffic held");
}
const programDeReleaseBoard = paidReleaseTruthBoard.programDeReleaseBoard as Record<string, unknown> | undefined;
const programDePrivateGate = programDeReleaseBoard?.privatePaidBetaGate as Record<string, unknown> | undefined;
const programDePublicGate = programDeReleaseBoard?.publicPaidTrafficGate as Record<string, unknown> | undefined;
const programDeActions = programDeReleaseBoard?.topRevenueActions as Array<Record<string, unknown>> | undefined;
const programDeAntiBloatGuard = programDeReleaseBoard?.antiBloatGuard as Record<string, unknown> | undefined;
if (
  !programDeReleaseBoard
  || programDeReleaseBoard.schemaVersion !== "ti.program_de_paid_beta_release_truth.v1"
  || programDeReleaseBoard.decision !== "hold_paid_release"
  || programDeReleaseBoard.privatePaidBetaAllowedNow !== false
  || programDeReleaseBoard.publicPaidTrafficAllowedNow !== false
  || programDeReleaseBoard.localProgressIsNotHostedRevenue !== true
  || !programDePrivateGate
  || programDePrivateGate.state !== "hold"
  || !Array.isArray(programDePrivateGate.blockers)
  || !programDePrivateGate.blockers.includes("current750_sellable_rows")
  || !programDePrivateGate.blockers.includes("hosted100_observed_proof")
  || !programDePublicGate
  || programDePublicGate.state !== "hold"
  || !Array.isArray(programDeActions)
  || programDeActions.length !== 5
  || programDeActions[0]?.owner !== "agent_09"
  || programDeActions[2]?.action !== "observe_current1000_useful_density_and_cost"
  || !programDeAntiBloatGuard
  || programDeAntiBloatGuard.dtoOnlyCountsTowardRelease !== false
  || programDeAntiBloatGuard.requiresBuyerVisibleRowsOrObservedHostedRevenueProof !== true
) {
  throw new Error("Program DE release board must expose private beta/public paid traffic thresholds, ranked revenue actions, and anti-bloat guards");
}
const programFgPrivateBetaDecision = paidReleaseTruthBoard.programFgPrivateBetaDecision as Record<string, unknown> | undefined;
const programFgDecisionSeparation = programFgPrivateBetaDecision?.decisionSeparation as Record<string, unknown> | undefined;
const programFgCostGuard = programFgPrivateBetaDecision?.costPerUsefulRowGuard as Record<string, unknown> | undefined;
const programFgObservedEvidence = programFgPrivateBetaDecision?.observedEvidence as Record<string, unknown> | undefined;
const programFgPrivateGate = programFgPrivateBetaDecision?.privateBetaGate as Record<string, unknown> | undefined;
const programFgPublicGate = programFgPrivateBetaDecision?.publicPaidTrafficGate as Record<string, unknown> | undefined;
const programFgBlockers = programFgPrivateBetaDecision?.orderedRevenueBlockers as Array<Record<string, unknown>> | undefined;
const programFgAntiBloat = programFgPrivateBetaDecision?.antiBloatGuard as Record<string, unknown> | undefined;
if (
  !programFgPrivateBetaDecision
  || programFgPrivateBetaDecision.schemaVersion !== "ti.program_fg_private_beta_release_decision.v1"
  || programFgPrivateBetaDecision.decision !== "hold_paid_release"
  || programFgPrivateBetaDecision.privatePaidBetaAllowedNow !== false
  || programFgPrivateBetaDecision.publicPaidTrafficAllowedNow !== false
  || !programFgDecisionSeparation
  || programFgDecisionSeparation.local1000RowsAloneCannotUnlockHostedRelease !== true
  || programFgDecisionSeparation.publicPaidTrafficRequiresPrivateBetaPlusConversionAndRefundEvidence !== true
  || !programFgCostGuard
  || programFgCostGuard.state !== "unknown"
  || programFgCostGuard.observedCostPerUsefulRowUsd !== null
  || programFgCostGuard.localCostEstimateCounts !== false
  || !programFgObservedEvidence
  || programFgObservedEvidence.importState !== "no_proof_imported"
  || programFgObservedEvidence.hostedProofState !== "missing"
  || !programFgPrivateGate
  || programFgPrivateGate.state !== "hold"
  || !Array.isArray(programFgPrivateGate.blockers)
  || !programFgPrivateGate.blockers.includes("current1000_local_sellable_rows")
  || !programFgPrivateGate.blockers.includes("hosted100_observed_proof")
  || !programFgPrivateGate.blockers.includes("no_leak_proof_missing")
  || !programFgPublicGate
  || programFgPublicGate.state !== "hold"
  || !Array.isArray(programFgPublicGate.blockers)
  || !programFgPublicGate.blockers.includes("private_paid_beta_not_ready")
  || !programFgPublicGate.blockers.includes("hosted500_observed_proof")
  || !Array.isArray(programFgBlockers)
  || programFgBlockers.map((row) => row.blocker).join(",") !== "current1000_local_sellable_rows,current1000_useful_rows,hosted100_300_500_observed_proof,pricing_payout_analytics,conversion_refunds,no_leak_and_stale_latest_proof,dirty_tree_and_test_hygiene"
  || !programFgAntiBloat
  || programFgAntiBloat.localOnlyProofCountsTowardHostedRelease !== false
  || programFgAntiBloat.requiresBuyerVisibleRowsOrObservedHostedRevenueProof !== true
) {
  throw new Error("Program FG private beta decision must separate private beta from public paid traffic, block local-only proof, and expose observed-only cost/no-leak gates");
}
if (!paidReleaseBuckets.every((bucket) =>
  typeof bucket.owner === "string"
  && typeof bucket.rowDeltaTo100 === "number"
  && typeof bucket.expectedRowGain === "number"
  && typeof bucket.fastestNextTask === "string"
  && typeof bucket.coordinationFile === "string"
  && (bucket.blocker === "already_chargeable" ? bucket.countsTowardPaidFloorNow === true : bucket.countsTowardPaidFloorNow === false)
)) {
  throw new Error("Program CQ release board buckets must expose owner, row delta, task, and paid-floor truth");
}
const paidReleaseFakeMetricGuard = paidReleaseTruthBoard.fakeMetricGuard as Record<string, unknown> | undefined;
if (
  !paidReleaseFakeMetricGuard
  || paidReleaseFakeMetricGuard.apifyStoreViews !== "external_unknown"
  || paidReleaseFakeMetricGuard.apifyActorRuns !== "external_unknown"
  || paidReleaseFakeMetricGuard.apifyPaidRuns !== "external_unknown"
  || paidReleaseFakeMetricGuard.apifyRevenueUsd !== null
  || paidReleaseFakeMetricGuard.apifyPayoutState !== "external_unknown"
  || paidReleaseFakeMetricGuard.conversionRate !== null
  || paidReleaseFakeMetricGuard.noSyntheticFallback !== true
) {
  throw new Error("Program CQ release board must not invent Apify analytics, revenue, payout, or conversion");
}
const paidReleaseExclusions = (paidReleaseTruthBoard.exclusionProof as Array<Record<string, unknown>>).map((row) => row.class);
for (const excludedClass of ["synthetic_rows", "graph_only_rows", "restricted_only_metadata", "caveated_rows", "stale_rows", "generic_source_pages", "projected_rows"]) {
  if (!paidReleaseExclusions.includes(excludedClass)) throw new Error(`Program CQ release board must exclude ${excludedClass}`);
}
const revenueConversionChecklist = outputRecord.revenueConversionChecklist as Record<string, unknown> | undefined;
if (
  !revenueConversionChecklist
  || revenueConversionChecklist.schemaVersion !== "ti.apify_revenue_conversion_checklist.v1"
  || revenueConversionChecklist.listingCopyState !== "ready"
  || revenueConversionChecklist.pricingState !== "ready"
  || revenueConversionChecklist.telemetryState !== "missing"
  || revenueConversionChecklist.payoutState !== "unknown"
  || typeof revenueConversionChecklist.nextManualVerificationStep !== "string"
  || !revenueConversionChecklist.nextManualVerificationStep.includes("Apify Store analytics")
  || !Array.isArray(revenueConversionChecklist.checks)
) {
  throw new Error("OUTPUT record must expose Program BT revenue conversion checklist with missing external telemetry");
}
const checklistIds = (revenueConversionChecklist.checks as Array<Record<string, unknown>>).map((row) => row.id);
for (const requiredCheck of ["listing_copy", "sample_rows", "pricing_shape", "marketplace_telemetry", "payout_setup", "fake_traction_guards", "no_leak_sample_proof"]) {
  if (!checklistIds.includes(requiredCheck)) throw new Error(`Program BT checklist must include ${requiredCheck}`);
}
const fakeTractionGuards = outputRecord.fakeTractionGuards as string[] | undefined;
if (
  !Array.isArray(fakeTractionGuards)
  || !fakeTractionGuards.some((guard) => guard.includes("local sample runs and owner proof runs never count"))
  || !fakeTractionGuards.some((guard) => guard.includes("synthetic proof rows never count"))
  || !fakeTractionGuards.some((guard) => guard.includes("payout readiness is unknown or blocked unless externally verified"))
) {
  throw new Error("OUTPUT record must expose fake-traction guards for local, owner, synthetic, and payout claims");
}
const pricingProof = outputRecord.pricingProof as Record<string, unknown> | undefined;
if (
  !pricingProof
  || pricingProof.schemaVersion !== "ti.apify_pricing_proof.v1"
  || !pricingProof.starterTrialShape
  || !pricingProof.paidDailyMonitoringShape
  || !pricingProof.usageCostGuard
  || !pricingProof.payoutRevenueSeparation
  || pricingProof.noLeakRequired !== true
) {
  throw new Error("OUTPUT record must expose Program BT pricing proof");
}
const usageCostGuard = pricingProof.usageCostGuard as Record<string, unknown>;
const payoutRevenueSeparation = pricingProof.payoutRevenueSeparation as Record<string, unknown>;
if (
  Number(usageCostGuard.rowPriceUsdPerThousand) !== 3
  || usageCostGuard.platformUsageCostUsd !== null
  || usageCostGuard.estimatedCreatorRevenueUsd !== null
  || Number(usageCostGuard.maxCostPerUsefulRowUsd) !== 0.01
  || payoutRevenueSeparation.paymentMethodState !== "unknown"
  || payoutRevenueSeparation.beneficiaryState !== "unknown"
  || payoutRevenueSeparation.withdrawalReadiness !== "unknown"
  || payoutRevenueSeparation.externallyVerifiedRevenueUsd !== null
) {
  throw new Error("Program BT pricing proof must keep usage, revenue, and payout claims unknown until externally verified");
}
const buyerSampleRows = outputRecord.buyerSampleRows as Array<Record<string, unknown>> | undefined;
if (!Array.isArray(buyerSampleRows) || buyerSampleRows.length < 12) {
  throw new Error("OUTPUT record must expose at least 12 Program BT buyer sample rows");
}
if (!buyerSampleRows.every((row) => {
  const fields = row.buyerVisibleFields as Record<string, unknown> | undefined;
  return fields
    && typeof fields.actorSummary === "string"
    && typeof fields.freshClaimOrActivity === "string"
    && Array.isArray(fields.nextAnalystPivots)
    && fields.nextAnalystPivots.length > 0
    && fields.noLeakProof === "metadata_only_no_raw_body_no_credentials_no_private_content";
})) {
  throw new Error("Program BT buyer sample rows must expose buyer fields and no-leak proof");
}
if (
  paidRowQuality.sellable === 0
  && (
    monetizationReadiness.status !== "blocked_for_paid_traffic"
    || !monetizationReadiness.blockers.includes("sellable_rows_below_paid_traffic_floor")
  )
) {
  throw new Error("Runs with zero sellable rows must be blocked for paid traffic");
}
for (const row of output) {
  if (row.rawContentIncluded !== false) throw new Error("rawContentIncluded must be false");
  const marketplaceSignals = row.marketplaceGraphSignals as Record<string, unknown> | undefined;
  if (
    !marketplaceSignals
    || marketplaceSignals.schemaVersion !== "ti.marketplace_graph_signals.v1"
    || marketplaceSignals.noLeak !== true
    || !["buyer_ready", "needs_corroboration", "held"].includes(String(marketplaceSignals.signalState))
    || !Array.isArray(marketplaceSignals.relationshipLinks)
    || !Array.isArray(marketplaceSignals.nextBuyerPivots)
    || typeof marketplaceSignals.buyerAction !== "string"
  ) {
    throw new Error("Every marketplace row must expose safe marketplace graph signals");
  }
  const safety = row.safety as Record<string, unknown> | undefined;
  if (
    !safety
    || safety.metadataOnly !== true
    || safety.credentialsIncluded !== false
    || safety.stolenFilesIncluded !== false
    || safety.privateContentIncluded !== false
    || safety.actorInteraction !== false
  ) {
    throw new Error("Every row must expose the safe-metadata-only safety contract");
  }
  if (JSON.stringify(row).toLowerCase().includes("password")) throw new Error("Output contains forbidden password text");
  if (!Array.isArray(row.reviewReasons) || row.reviewReasons.length === 0) {
    throw new Error("Every row must expose reviewReasons for analyst quality triage");
  }
  if (!Array.isArray(row.analysisFacets) || !row.analysisFacets.includes(`row:${row.rowType}`) || !row.analysisFacets.includes("safety:metadata_only")) {
    throw new Error("Every row must expose stable analysisFacets for marketplace filtering");
  }
  if (
    typeof row.relationshipSummary !== "string"
    || row.relationshipSummary.length === 0
    || !Array.isArray(row.relationshipPivotTypes)
    || !Array.isArray(row.relationshipPivots)
    || !Array.isArray(row.whyActionable)
    || row.whyActionable.length === 0
    || !Array.isArray(row.nextSearchPivots)
    || typeof row.freshnessDelta !== "string"
    || typeof row.confidenceDelta !== "string"
    || !Array.isArray(row.contradictionHints)
    || typeof row.corroborationState !== "string"
  ) {
    throw new Error("Every row must expose compact buyer-visible relationship insight fields");
  }
  if (typeof row.coverageStatus !== "string" || typeof row.recommendedCollectionAction !== "string") {
    throw new Error("Every row must expose coverage status and recommended collection action");
  }
  if (
    !["sellable", "included_with_caveat", "coverage_gap_only", "hold", "suppress"].includes(String(row.paidRowDecision))
    || typeof row.paidRowReason !== "string"
    || !Array.isArray(row.paidRowReasonCodes)
    || row.paidRowReasonCodes.length === 0
    || !Array.isArray(row.paidRowRemediationActions)
    || typeof row.whyWorthPayingFor !== "string"
    || row.whyWorthPayingFor.length < 16
    || row.whyWorthPayingFor.length > 120
    || typeof row.buyerValueScore !== "number"
    || !["charge", "include_as_context", "do_not_charge_if_metered"].includes(String(row.billingGuidance))
  ) {
    throw new Error("Every row must expose paid-row decision, buyer value reason, score, and billing guidance");
  }
  const graphQualityLiftEvidence = row.graphQualityLiftEvidence as Record<string, unknown> | undefined;
  if (
    !["accepted_sellable_lift", "rejected_hold", "rejected_caveat", "not_applicable"].includes(String(row.graphQualityLift))
    || !Array.isArray(row.graphQualityLiftReasonCodes)
    || row.graphQualityLiftReasonCodes.length === 0
    || !graphQualityLiftEvidence
    || typeof graphQualityLiftEvidence.relationshipReady !== "boolean"
    || typeof graphQualityLiftEvidence.sourceFamilyCorroborated !== "boolean"
    || typeof graphQualityLiftEvidence.contradictionHeld !== "boolean"
    || typeof graphQualityLiftEvidence.freshnessLift !== "boolean"
    || typeof graphQualityLiftEvidence.exportEligible !== "boolean"
    || graphQualityLiftEvidence.noLeak !== true
  ) {
    throw new Error("Every row must expose graph quality-lift evidence and no-leak export eligibility");
  }
  const marketplaceGraphSignals = row.marketplaceGraphSignals as Record<string, unknown> | undefined;
  if (
    !marketplaceGraphSignals
    || marketplaceGraphSignals.schemaVersion !== "ti.marketplace_graph_signals.v1"
    || !["buyer_ready", "needs_corroboration", "held"].includes(String(marketplaceGraphSignals.signalState))
    || !Array.isArray(marketplaceGraphSignals.relationshipLinks)
    || marketplaceGraphSignals.relationshipLinks.length === 0
    || !Array.isArray(marketplaceGraphSignals.freshnessChangeHints)
    || marketplaceGraphSignals.freshnessChangeHints.length === 0
    || !["stronger", "stable", "weaker", "unknown"].includes(String(marketplaceGraphSignals.confidenceTrend))
    || !["none", "contradicted", "review_hold"].includes(String(marketplaceGraphSignals.contradictionState))
    || !Array.isArray(marketplaceGraphSignals.nextBuyerPivots)
    || typeof marketplaceGraphSignals.pivotUtility !== "object"
    || typeof marketplaceGraphSignals.relationshipConfidence !== "object"
    || !Array.isArray(marketplaceGraphSignals.rejectedPivotReasons)
    || typeof marketplaceGraphSignals.buyerAction !== "string"
    || !Array.isArray(marketplaceGraphSignals.sourceBlockers)
    || marketplaceGraphSignals.noLeak !== true
  ) {
    throw new Error("Every row must expose buyer-visible marketplace graph signals");
  }
  const pivotUtility = marketplaceGraphSignals.pivotUtility as Record<string, unknown>;
  const relationshipConfidence = marketplaceGraphSignals.relationshipConfidence as Record<string, unknown>;
  if (
    Number(pivotUtility.usefulPivotCount) <= 0
    || Number(pivotUtility.actionPivotCount) < 0
    || Number(pivotUtility.corroboratedPivotCount) < 0
    || pivotUtility.noLeak !== true
  ) {
    throw new Error("Every row must expose useful no-leak graph pivot utility metrics");
  }
  if (
    Number(relationshipConfidence.usefulPivotCount) <= 0
    || Number(relationshipConfidence.actionPivotCount) < 0
    || Number(relationshipConfidence.corroboratedPivotCount) < 0
    || Number(relationshipConfidence.rejectedUnsupportedPivotCount) < 0
    || !["stronger", "stable", "weaker", "unknown"].includes(String(relationshipConfidence.confidenceTrend))
    || !["none", "contradicted", "review_hold"].includes(String(relationshipConfidence.contradictionState))
    || Number(relationshipConfidence.nextSearchCount) < 0
    || relationshipConfidence.noLeak !== true
  ) {
    throw new Error("Every row must expose useful no-leak relationship confidence metrics");
  }
  if (row.paidRowDecision === "sellable" && marketplaceGraphSignals.signalState !== "buyer_ready") {
    throw new Error("Sellable rows must expose buyer-ready marketplace graph signals");
  }
  if (row.paidRowDecision === "coverage_gap_only" && !marketplaceGraphSignals.sourceBlockers.includes("missing_public_channel")) {
    throw new Error("Coverage-gap rows must expose missing public-channel source blockers");
  }
  if (row.nextPollSeconds !== 3 || row.retryAfterSeconds !== 3 || row.duplicateRunReuse !== true) {
    throw new Error("Every row must expose scheduler polling and duplicate-run reuse state");
  }
  if (!Array.isArray(row.schedulerBadges) || !row.schedulerBadges.includes("active_run_reuse")) {
    throw new Error("Every row must expose scheduler UI badges");
  }
  if (!Array.isArray(row.sourceCoverageGaps) || !row.sourceCoverageGaps.includes("missing_public_channel_evidence")) {
    throw new Error("Every row must expose source coverage gaps");
  }
  if (
    row.freshnessExpectation !== "daily"
    || row.highestValueMissingFamily !== "public_channel"
    || row.nextBestSourceAction !== "activate_public_channel"
    || row.expectedTimeToUsefulSignal !== "1_3_days"
    || typeof row.buyerCaveat !== "string"
    || !row.buyerCaveat.includes("public-channel coverage")
  ) {
    throw new Error("Every row must expose actor source coverage matrix product fields");
  }
}
const profile = output.find((row) => row.rowType === "profile");
if (profile?.sourceCount !== 4 || profile?.sourceFamilyCount !== 1 || profile?.evidenceGrade !== "corroborated") {
  throw new Error("Internal status sources must not increase source-family coverage, while public evidence sources should raise evidence grade");
}
if (
  profile?.paidRowDecision !== "sellable"
  || profile?.billingGuidance !== "charge"
  || !Array.isArray(profile.paidRowReasonCodes)
  || !profile.paidRowReasonCodes.includes("multi_source_public")
  || !profile.paidRowReasonCodes.includes("source_family_gap_visible")
  || profile.graphQualityLift !== "accepted_sellable_lift"
  || !Array.isArray(profile.graphQualityLiftReasonCodes)
  || !profile.graphQualityLiftReasonCodes.includes("review_export_candidate")
) {
  throw new Error("Fresh multi-source public profile rows must be sellable and graph-export-reviewable while keeping source-family gaps visible");
}
if (output.some((row) => row.rowType === "source" && row.sourceType === "system")) {
  throw new Error("Internal status rows must not be included in marketplace evidence output");
}
if (output.some((row) => Array.isArray(row.warningCodes) && row.warningCodes.includes("darknet_metadata_only"))) {
  throw new Error("Coverage capability alone must not produce a darknet evidence warning");
}
const activity = output.find((row) => row.rowType === "activity");
if (activity?.claimType !== "campaign" || activity?.publisherCount !== 4) {
  throw new Error("Activity rows must preserve claim classification and corroborated publisher count");
}
if (!Array.isArray(activity?.reviewReasons) || !activity.reviewReasons.includes("evidence:corroborated")) {
  throw new Error("Activity rows must explain corroborated public support state");
}
const allowedPaidGraphPackQueryTypes = new Set(["actor", "victim", "sector", "country", "ttp", "tool", "campaign", "ransomware_group", "unknown", "alias_collision"]);
const allowedPaidGraphPackCorroboration = new Set(["corroborated", "single_source", "metadata_only", "unverified"]);
const allowedPaidGraphPackCaveats = new Set(["none", "caveated", "contradicted", "held"]);
const allowedPaidGraphPackExport = new Set(["eligible", "review_required", "not_exportable"]);
const allowedGraphSupportProofStates = new Set(["proven", "missing_public_support", "metadata_only", "single_source", "none"]);
const allowedGraphSupportContradictions = new Set(["none", "contradicted", "review_hold"]);
for (const row of output) {
  const pack = row.paidGraphSearchPack as Record<string, unknown> | undefined;
  if (
    !pack
    || pack.schemaVersion !== "ti.apify_paid_graph_search_pack.v1"
    || !allowedPaidGraphPackQueryTypes.has(String(pack.queryType))
    || typeof pack.buyerIntent !== "string"
    || typeof pack.primaryEntity !== "string"
    || !Array.isArray(pack.normalizedAliases)
    || !Array.isArray(pack.usefulNextSearches)
    || pack.usefulNextSearches.length < 1
    || !allowedPaidGraphPackCorroboration.has(String(pack.sourceFamilyCorroboration))
    || !allowedPaidGraphPackCaveats.has(String(pack.contradictionCaveatState))
    || !Array.isArray(pack.suppressedNoisyPivots)
    || !allowedPaidGraphPackExport.has(String(pack.exportEligibility))
    || typeof pack.whyWorthPayingForOrHeld !== "string"
    || pack.noLeak !== true
  ) {
    throw new Error("Every marketplace row must expose a buyer-useful no-leak paid graph search pack");
  }
  const graphSupport = row.graphSellableSupport as Record<string, unknown> | undefined;
  if (
    !graphSupport
    || graphSupport.schemaVersion !== "ti.apify_graph_sellable_support.v1"
    || typeof graphSupport.relationshipSupport !== "string"
    || typeof graphSupport.supportingSourceFamily !== "string"
    || !allowedGraphSupportProofStates.has(String(graphSupport.sourceFamilyProofState))
    || !allowedGraphSupportContradictions.has(String(graphSupport.contradictionState))
    || typeof graphSupport.caveat !== "string"
    || typeof graphSupport.nextBuyerSearch !== "string"
    || typeof graphSupport.repairOwner !== "string"
    || !["sellable", "included_with_caveat", "coverage_gap_only", "hold", "suppress"].includes(String(graphSupport.supportsPaidDecision))
    || graphSupport.countsTowardProductionSellableRows !== false
    || graphSupport.noLeak !== true
  ) {
    throw new Error("Every marketplace row must expose Program CI graph sellable support without counting graph-only rows");
  }
}
if (activity?.paidRowDecision !== "sellable" || activity?.billingGuidance !== "charge") {
  throw new Error("Corroborated parser-admitted activity rows must become chargeable");
}
if (activity?.graphQualityLift !== "accepted_sellable_lift") {
  throw new Error("Corroborated parser-admitted activity graph lift must become buyer-ready");
}
if (!Array.isArray(activity?.analysisFacets) || !activity.analysisFacets.includes("claim:campaign") || !activity.analysisFacets.includes("evidence:corroborated") || !activity.analysisFacets.includes("entity:attack_technique")) {
  throw new Error("Activity rows must expose claim, corroborated evidence, and extracted TTP analysis facets");
}
if (!activity.analysisFacets.includes("paid:sellable") || !activity.analysisFacets.includes("billing:charge") || !activity.analysisFacets.includes("parser_admission:sellable")) {
  throw new Error("Activity rows must expose paid-row analysis facets");
}
if (
  typeof activity.relationshipSummary !== "string"
  || !activity.relationshipSummary.includes("campaign")
  || !Array.isArray(activity.relationshipPivots)
  || !activity.relationshipPivots.includes("claim:campaign")
  || !activity.relationshipPivots.includes("ttp:Phishing")
  || !activity.relationshipPivots.includes("attack:T1566")
  || !Array.isArray(activity.nextSearchPivots)
  || !activity.nextSearchPivots.includes("APT42 public channel")
) {
  throw new Error("Activity rows must expose graph-style relationship pivots and next searches");
}
const activityParserProof = activity.parserAdmissionRuntimeProof as Record<string, unknown> | undefined;
if (
  !activityParserProof
  || activityParserProof.schemaVersion !== "ti.apify_parser_admission_runtime_proof.v1"
  || activityParserProof.owner !== "agent_03"
  || activityParserProof.admissionDecision !== "sellable"
  || activityParserProof.countsTowardCurrentSellableRows !== true
  || activityParserProof.sourceEvidenceCount !== 4
  || !Array.isArray(activityParserProof.requiredFieldsPresent)
  || !Array.isArray(activityParserProof.missingFields)
  || (activityParserProof.missingFields as string[]).length !== 0
  || !(activityParserProof.requiredFieldsPresent as string[]).includes("ttp_tool_or_cve")
  || !(activityParserProof.requiredFieldsPresent as string[]).includes("source_family_support")
  || activityParserProof.contradictionState !== "none"
  || typeof activityParserProof.provenanceHash !== "string"
  || typeof activityParserProof.nextBuyerSearch !== "string"
  || activityParserProof.repairOwner !== "agent_03"
) {
  throw new Error("Activity rows must expose complete Agent 03 parser runtime admission proof");
}
const activityNoLeak = activityParserProof.noLeakProof as Record<string, unknown> | undefined;
if (!activityNoLeak || Object.values(activityNoLeak).some((value) => value !== false)) {
  throw new Error("Parser runtime admission proof must preserve no-leak boundaries");
}
if (activity?.pollingHint !== "source_gap_review" || activity?.schedulerDecision !== "reuse_active_run") {
  throw new Error("Activity rows must expose scheduler decision and polling hint");
}
if (activity?.firstReportedAt !== "2026-06-20T01:00:00.000Z" || activity?.lastReportedAt !== "2026-06-20T02:00:00.000Z") {
  throw new Error("Activity rows must preserve the public reporting window");
}
const coverageGap = output.find((row) => row.rowType === "coverage_gap");
if (coverageGap?.recommendedCollectionAction !== "add_public_channel_sources" || coverageGap?.collectionPriority !== "medium") {
  throw new Error("Coverage gap rows must guide scheduler/source follow-up");
}
if (coverageGap?.paidRowDecision !== "coverage_gap_only" || coverageGap?.billingGuidance !== "do_not_charge_if_metered") {
  throw new Error("Coverage gap rows must be marked as remediation context rather than sellable findings");
}
if (!Array.isArray(coverageGap?.paidRowRemediationActions) || !coverageGap.paidRowRemediationActions.some((action) => action.owner === "agent_04")) {
  throw new Error("Coverage gap rows must expose owner-specific remediation actions");
}
const suppressed = output.find((row) => row.paidRowDecision === "suppress");
if (!suppressed || suppressed.billingGuidance !== "do_not_charge_if_metered" || suppressed.buyerValueScore !== 0.05) {
  throw new Error("Capability-only rows must be suppressed and excluded from metered paid findings");
}
if (!Array.isArray(suppressed.paidRowReasonCodes) || !suppressed.paidRowReasonCodes.includes("capability_without_evidence")) {
  throw new Error("Suppressed rows must explain the evidence gap with stable reason codes");
}
if (!Array.isArray(suppressed.paidRowRemediationActions) || !suppressed.paidRowRemediationActions.some((action) => action.owner === "agent_05")) {
  throw new Error("Suppressed rows must route remediation to the source/metadata owner");
}
const suppressedProof = suppressed.parserAdmissionRuntimeProof as Record<string, unknown> | undefined;
if (
  !suppressedProof
  || suppressedProof.admissionDecision !== "suppress"
  || suppressedProof.countsTowardCurrentSellableRows !== false
  || suppressedProof.blockedReason !== "restricted_only_without_public_support"
) {
  throw new Error("Restricted-only metadata rows must carry parser suppression proof");
}
const sourceProofs = output
  .filter((row) => row.rowType === "source")
  .map((row) => row.parserAdmissionRuntimeProof as Record<string, unknown> | undefined);
if (sourceProofs.length < 1 || !sourceProofs.every((proof) =>
  proof
  && proof.admissionDecision === "suppress"
  && proof.countsTowardCurrentSellableRows === false
  && proof.blockedReason === "generic_source_page"
)) {
  throw new Error("Generic source-page rows must not become parser-admitted sellable rows");
}

console.log(JSON.stringify({
  ok: true,
  rowCount: output.length,
  paidRowQuality,
  monetizationReadiness,
  qualityLiftGate
}, null, 2));
