export function assertHostedDefaultParserLift(parserRealSellableLift: Record<string, unknown>): void {
  const hostedDefaultParserLift = parserRealSellableLift.hostedDefaultParserLift as Record<string, unknown> | undefined;
  const observedRun = hostedDefaultParserLift?.observedHostedRun as Record<string, unknown> | undefined;
  const parserLift = hostedDefaultParserLift?.parserLift as Record<string, unknown> | undefined;
  const projected = hostedDefaultParserLift?.projectedAfterParserLift as Record<string, unknown> | undefined;

  if (
    !hostedDefaultParserLift
    || hostedDefaultParserLift.schemaVersion !== "ti.program_fh_hosted_default_parser_lift.v1"
    || hostedDefaultParserLift.owner !== "agent_03"
    || !Array.isArray(hostedDefaultParserLift.routeVisibleOn)
    || !(hostedDefaultParserLift.routeVisibleOn as string[]).includes("/v1/contracts#apifyStoreReadiness")
    || observedRun?.runId !== "THMm2ZzYxW4HVPGJ6"
    || observedRun?.buildId !== "L7LtCqLsKT6Luq04R"
    || observedRun?.datasetId !== "xLPoxMVY6cVjGsS4e"
    || observedRun?.baselineSellableRows !== 46
    || observedRun?.baselineSellableFindings !== 31
    || observedRun?.baselineCaveatedRows !== 194
    || observedRun?.noLeakFailures !== 0
    || parserLift?.newlyAdmittedSellableRows !== 54
    || parserLift?.newlyAdmittedFindingRows !== 21
    || parserLift?.sourceProvenanceRowsDoNotCountAsFindings !== true
    || projected?.sellableRows !== 100
    || projected?.sellableFindings !== 52
    || projected?.sellableGap !== 0
    || projected?.findingGap !== 0
    || hostedDefaultParserLift.countsTowardPaidPromotionNow !== false
    || hostedDefaultParserLift.countsTowardHostedRerunExpectation !== true
    || !Array.isArray(hostedDefaultParserLift.acceptedRowClasses)
    || !Array.isArray(hostedDefaultParserLift.rejectionBuckets)
  ) {
    throw new Error("Program FH hosted default parser lift must expose the 46-to-100 hosted rerun expectation without unlocking paid promotion");
  }

  for (const row of hostedDefaultParserLift.acceptedRowClasses as Array<Record<string, unknown>>) {
    assertAcceptedClass(row);
  }
  for (const row of hostedDefaultParserLift.rejectionBuckets as Array<Record<string, unknown>>) {
    if (row.countsTowardHostedPaidFloor !== false || row.noLeak !== true) {
      throw new Error("Program FH rejection buckets must remain outside hosted paid floor");
    }
  }
}

function assertAcceptedClass(row: Record<string, unknown>): void {
  const requiredFields = row.requiredFields as string[] | undefined;
  if (
    !Array.isArray(requiredFields)
    || !requiredFields.includes("current_public_support")
    || !requiredFields.includes("actor_specific")
    || !requiredFields.includes("finding_context")
    || !requiredFields.includes("freshness_not_stale")
    || !requiredFields.includes("provenance_hash")
    || !requiredFields.includes("no_leak")
    || !requiredFields.includes("buyer_action")
    || typeof row.buyerAction !== "string"
    || row.buyerAction.length === 0
    || typeof row.confidenceReason !== "string"
    || row.confidenceReason.length === 0
    || row.noLeak !== true
  ) {
    throw new Error("Program FH accepted classes must require public support, specificity, buyer action, confidence, and no-leak proof");
  }
}
