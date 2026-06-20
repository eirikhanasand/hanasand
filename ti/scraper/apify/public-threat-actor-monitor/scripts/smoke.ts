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
const allowedPaidGraphPackQueryTypes = new Set(["actor", "victim", "sector", "country", "ttp", "tool", "campaign", "ransomware_group", "unknown", "alias_collision"]);
const allowedPaidGraphPackCorroboration = new Set(["corroborated", "single_source", "metadata_only", "unverified"]);
const allowedPaidGraphPackCaveats = new Set(["none", "caveated", "contradicted", "held"]);
const allowedPaidGraphPackExport = new Set(["eligible", "review_required", "not_exportable"]);
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
