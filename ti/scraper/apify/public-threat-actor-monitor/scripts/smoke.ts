const root = new URL("..", import.meta.url).pathname;
const storage = `${root}/.apify-smoke-storage`;

await Bun.spawn(["rm", "-rf", storage], { stdout: "inherit", stderr: "inherit" }).exited;
await Bun.spawn(["mkdir", "-p", `${storage}/key_value_stores/default`], { stdout: "inherit", stderr: "inherit" }).exited;
await Bun.write(`${storage}/key_value_stores/default/INPUT.json`, JSON.stringify({
  queries: ["APT42"],
  includeDatasets: true,
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
  || typeof monetizationReadiness.targetSellableRows !== "number"
  || typeof monetizationReadiness.sellableRows !== "number"
  || typeof monetizationReadiness.usefulForBuyerRows !== "number"
  || typeof monetizationReadiness.averageBuyerValueScore !== "number"
  || !Array.isArray(monetizationReadiness.blockers)
  || typeof monetizationReadiness.nextRevenueAction !== "string"
) {
  throw new Error("OUTPUT record must expose monetization readiness");
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
if (activity?.claimType !== "campaign" || activity?.publisherCount !== 1) {
  throw new Error("Activity rows must preserve claim classification and publisher count");
}
if (!Array.isArray(activity?.reviewReasons) || !activity.reviewReasons.includes("review:single_source")) {
  throw new Error("Activity rows must explain single-source review state");
}
if (activity?.paidRowDecision !== "included_with_caveat" || activity?.billingGuidance !== "include_as_context") {
  throw new Error("Single-source activity rows must be caveated instead of treated as fully sellable");
}
if (activity?.graphQualityLift !== "rejected_caveat") {
  throw new Error("Single-source activity graph lift must stay rejected/caveated until corroborated");
}
if (!Array.isArray(activity?.analysisFacets) || !activity.analysisFacets.includes("claim:campaign") || !activity.analysisFacets.includes("evidence:single_source")) {
  throw new Error("Activity rows must expose claim and evidence analysis facets");
}
if (!activity.analysisFacets.includes("paid:included_with_caveat") || !activity.analysisFacets.includes("billing:include_as_context")) {
  throw new Error("Activity rows must expose paid-row analysis facets");
}
if (
  typeof activity.relationshipSummary !== "string"
  || !activity.relationshipSummary.includes("campaign")
  || !Array.isArray(activity.relationshipPivots)
  || !activity.relationshipPivots.includes("claim:campaign")
  || !Array.isArray(activity.nextSearchPivots)
  || !activity.nextSearchPivots.includes("APT42 public channel")
) {
  throw new Error("Activity rows must expose graph-style relationship pivots and next searches");
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

console.log(JSON.stringify({
  ok: true,
  rowCount: output.length,
  paidRowQuality,
  monetizationReadiness,
  qualityLiftGate
}, null, 2));
