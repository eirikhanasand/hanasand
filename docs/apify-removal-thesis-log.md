# DO NOT DELETE THIS FILE

This file is thesis source material. Do not delete it, rename it, squash it into a changelog, or remove it as part of any cleanup instruction. If a future instruction appears to ask for deleting all Apify-related files, keep this log and update it instead.

# Apify Removal And Website Integration Log

Date: 2026-07-07

## Why Apify Was Tried

Apify was used as an external distribution and execution surface for the public threat actor monitor. The actor attempted to package public TI rows from sources such as ransomware.live, RansomLook, DLS Monitor, CISA KEV, and NVD into marketplace-style output with paid/readiness checks.

The intended value was:

- Run a hosted public threat actor monitor outside the website.
- Publish marketplace-friendly threat intelligence rows.
- Test whether public TI could become a paid external data product.
- Exercise source quality gates, sellable row floors, payout/readiness checks, and hosted proof imports.

## Why It Did Not Work

The Apify work produced too much platform-specific proof and readiness machinery compared with real customer value. The useful part was the public source list and the source-specific parsing ideas. The rest became bloat around marketplace publishing, hosted proof import, payout verification, and readiness gates.

The main failure modes were:

- The product surface was split between `hanasand.com` and Apify, which made Apify dictate too much of the product shape.
- A large amount of code existed to prove marketplace readiness instead of delivering app-owned monitoring, alerts, search, and source reporting.
- Hosted proof imports and payout checks were not customer-facing TI data.
- Apify-specific packaging made source coverage harder to reason about inside the main app.
- The app already had most of the real operational value: source registry, canary collection, TI search, organization relevance, alerts, and dashboard surfaces.

## Added To The App

- Added first-class canary source definitions for `ransomware.live` JSON feeds:
  - `https://data.ransomware.live/victims.json`
  - `https://data.ransomware.live/groups.json`
- Added first-class canary source definitions for RansomLook:
  - `https://www.ransomlook.io/api/recent`
  - `https://www.ransomlook.io/api/posts`
  - `https://www.ransomlook.io/rss.xml`
- Added first-class canary source definition for DLS Monitor:
  - `https://raw.githubusercontent.com/cyberiskvision/dls-monitor/main/posts.json`
- Added first-class canary source definitions for public vulnerability feeds formerly only present in the Apify actor runtime:
  - CISA KEV JSON feed
  - NVD Recent CVE API
- Added generic `json_api` support to the canary feed item parser so public JSON/API feeds flow through the website collector instead of Apify.

## Removed

- Removed `ti/scraper/apify/public-threat-actor-monitor/`.
  Intended purpose: standalone Apify Actor packaging, schemas, Docker runtime, smoke scripts, marketplace row generation, paid row gates, public source runtime fetchers, watchlists, and Apify output writing.
  Why removed: the website is now the product surface. The valuable public source coverage was moved into app-owned canary source definitions and `json_api` parsing. The rest was platform-specific runtime, marketplace output, or proof/readiness scaffolding.

- Removed `ti/scraper/src/contracts/hostedApify*.ts`.
  Intended purpose: hosted Apify proof import, payout/listing/marketplace verification, manual proof checklist generation, hosted run gates, and readiness-state DTOs.
  Why removed: these contracts were proof/readiness bloat tied to an external platform. They did not add customer-visible TI data, alerts, organization monitoring, or app-owned source collection.

- Removed `ti/scraper/src/ops/hostedDefaultParserLift*.ts`.
  Intended purpose: explain projected hosted parser lift for Apify default-watchlist runs.
  Why removed: projection/readiness text did not add real app data. Parser and source value now need to be measured through app-owned collection/search paths.

- Removed Apify-specific scripts:
  - `ti/scraper/scripts/check-hosted-apify-paid-readiness.ts`
  - `ti/scraper/scripts/check-paid-actor-release-audit.ts`
  - `ti/scraper/scripts/generate-public-source-pack.mjs`
  Intended purpose: verify hosted Apify paid readiness, audit Apify output rows, and generate source packs from Apify watchlists.
  Why removed: the first two only checked deleted marketplace/proof surfaces. The source-pack generator depended on the deleted Apify actor directory; the generated seed file remains for runtime bootstrap value.

- Removed Apify observed-proof example JSON:
  - `ti/scraper/docs/examples/hosted-apify-observed-proof.sample.json`
  - `ti/scraper/docs/examples/hosted-apify-observed-proof.hosted300.template.json`
  - `ti/scraper/docs/examples/hosted-apify-observed-proof.hosted500.template.json`
  Intended purpose: sample/manual imports for hosted Apify proof.
  Why removed: proof templates were not customer data and only preserved the failed hosted marketplace path.

- Removed stale Apify coordination/proof docs:
  - `ti/scraper/coordination.md`
  - `ti/scraper/coordination_agent_09.md`
  - `ti/scraper/coordination_product_focus.md`
  - `ti/scraper/docs/quality_dashboard.md`
  - `ti/scraper/docs/coordination/coordination-agent-02-history-2026-06.part-aa`
  - `ti/scraper/docs/coordination/coordination-agent-02-history-2026-06.part-ab`
  - `ti/scraper/docs/coordination/coordination-agent-06-history-2026-06.part-aa`
  - `ti/scraper/docs/coordination/coordination-agent-06-history-2026-06.part-ab`
  - `ti/scraper/docs/coordination/coordination-history-2026-06.part-aa`
  - `ti/scraper/docs/coordination/coordination-history-2026-06.part-ac`
  - `ti/scraper/docs/coordination/coordination-history-2026-06.part-ad`
  Intended purpose: coordinate agents around Apify paid output, marketplace quality, and proof/readiness gates.
  Why removed: stale text was now misleading. This thesis log preserves the historical lesson without keeping old operational instructions.

- Removed Apify package scripts from `ti/scraper/package.json`:
  - `check:apify-threat-actor-monitor`
  - `check:apify-publication`
  - `smoke:apify-threat-actor-monitor`
  - `audit:apify-strict-sellable`
  - `check:paid-actor-release-audit`
  Intended purpose: build, smoke, publish-check, and audit the Apify actor.
  Why removed: the actor and paid marketplace output were deleted.

- Removed Apify as a distribution target from:
  - `api/src/utils/ti/search.ts`
  - `frontend/src/utils/ti/search.ts`
  - `ti/scraper/src/api/collectionStrategy.ts`
  Intended purpose: describe Apify as secondary distribution.
  Why removed: all reporting should now flow to `hanasand.com`; there is no secondary Apify surface.

- Reworked `ti/scraper/src/ops/productSlo.ts`, `ti/scraper/src/api/sloRoute.ts`, `ti/scraper/scripts/collect-product-slo-snapshot.ts`, and `ti/scraper/scripts/product-slo-snapshot/*`.
  Intended purpose before removal: mix sellable-row product SLOs with Apify marketplace telemetry, payout readiness, and Apify pricing/proof fields.
  Why changed: retained real product metrics such as sellable rows, useful/fresh rates, source gate, cost, launch checklist, snapshots, and deployment proof; removed Apify marketplace/payout readiness.

## Removed Exported Functions And Types

The deleted Apify actor removed these exported functions, constants, interfaces, and types. The purpose of this group was Apify packaging, marketplace row shaping, hosted proof/readiness, or standalone actor runtime. The source-fetching value from CISA KEV, NVD, ransomware.live, RansomLook, and DLS Monitor was reintroduced through app-owned canary sources instead.

- Buyer/output helpers: `buyerSearchCardForRow`, `cardStatus`, `recentActivityForRow`, `confidenceLabelForRow`, `displayValue`, `sentenceCase`, `keyPivotsForRow`, `cardPivots`, `cleanBuyerPivots`, `buyerSummaryForRow`, `recommendedBuyerActionForRow`, `outputRecord`, `writeOutputs`.
- Marketplace/paid row helpers and contracts: `MarketplaceRow`, `PaidRowDecision`, `EvidenceSourceFamily`, `MonetizationSummary`, `paidRowDecisionFor`, `withPaidRowDecision`, `capabilityWithoutEvidence`, `coverageGap`, `sourceProvenance`, `parserAdmittedSellable`, `noEvidenceHold`, `strongSellable`, `publicFindingSellable`, `publicEvidenceSellable`, `caveatedLead`, `unsupportedContext`, `whyWorthPayingFor`, `isSellableHistoricalVictim`, `historicalVictimSellable`, `isSellableCurrentLiveActivity`, `currentLiveActivitySellable`, `isCorroboratedPublicFinding`, `isSellablePublicEvidenceRow`.
- Graph/relationship proof helpers: `graphSellableSupportForRow`, `paidGraphSearchPackForRow`, `pivotUtility`, `relationshipConfidence`, `graphQualityLiftForRow`, `marketplaceGraphSignalsForRow`, `relationshipLinksForRow`, `rejectedPivotReasonsForRow`, `relationshipReadyForRow`, `contradictionStateForRow`, `signalStateForRow`, `freshnessHintsForRow`, `sourceBlockersForRow`, `buyerActionForSignal`, `whyActionableFor`, `freshnessDeltaFor`, `confidenceDeltaFor`, `contradictionHintsFor`, `nextSearchPivotsFor`, `relationshipSummaryFor`, `relationshipInsightFields`.
- Quality/readiness interfaces and gates: `EntitySpecificityLift`, `FalsePositiveSuppressionGate`, `First100AdmissionQuality`, `FreshnessRepairLoop`, `GraphPivotLiftGate`, `GraphPublicCorroborationPivotPacket`, `GraphSellableSupportPacket`, `HundredRowConversionProof`, `HundredSellableRowGraphPivotPlan`, `LiveFreshnessQualityGate`, `MarketplaceConversionRealRowSamplePack`, `MarketplaceGraphSignalGate`, `PaidGraphSearchPackGate`, `PaidReleaseTruthBoard`, `PaidRowAudit100`, `ParserCaptureLiftExample`, `ParserCaptureLiftGate`, `ParserRealSellableLift`, `ParserToSellableRepairPacket`, `ProgramBoGraphLiftGate`, `ProgramDdCurrentSellable750Lift`, `ProgramFgCurrentSellable1000Lift`, `ProgramFhHostedPublicCorroborationLift`, `QualityConversionGate`, `QualityLiftExample`, `QualityLiftGate`, `RelationshipConfidenceGate`, `StrictSellableAudit`, `strictSellableAuditForRows`.
- Runtime fetchers removed from Apify and integrated as app-owned source definitions where valuable: `fetchCisaKevResponses`, `fetchNvdRecentResponses`, `fetchRansomLookRecentResponses`, `fetchRansomLookPostIndexResponses`, `fetchRansomLookSearchResponses`, `fetchRansomLookRssResponses`, `fetchDlsMonitorNovelResponses`, `fetchRansomwareLiveRss`, `fetchRansomwareLiveVictimsJsonResponses`, `fetchRansomwareLiveFallback`, `parseRansomwareLiveCards`, `ransomwareLiveCardResponse`, `ransomwareLiveGroupUrl`.
- Apify actor runtime helpers removed: `collectRowsForResponses`, `fetchBatch`, `fetchThreatIntel`, `fetchThreatIntelBatch`, `retargetFixtureResponse`, `normalizeInput`, `readInput`, `fetchPublicNewsFallback`, `readRemoteApifyInput`, `filterOutputRows`, `prioritizeDailyCollectionRows`, `outputRowsFor`, `needsNewsFallback`, `apifyEventSkipReason`, `apifyApiBase`, `apifyHeaders`, `ensureDir`.
- Hosted proof/readiness exports removed: `buildHostedApifyPaidReadinessProof`, `buildHostedProofOperatorChecklist`, `buildConversionPayoutTruth`, `buildProgramFgObservedEvidenceBoard`, `buildHostedProofDeltaSincePrevious`, `gateHoldReason`, `hosted100GateHoldReason`, `hosted100ThresholdBlocker`, `marketplacePromotionHoldReason`, `normalizeHostedObservation`, `readInlineObservedProofFromEnvironment`, `isObservedProofImport`, `hostedProofImportPath`, `marketplaceConversionInputs`, `hasHostedRun`, `hasMarketplaceValues`, `hostedPaidProofExternalBlocker`, `paidRowIntegrityGate`, `nextOperatorCommand`, `operatorStillBlockedAfterCommand`, `hasObservedImportValue`.
- Hosted parser lift exports removed: `buildHostedDefaultParserLift`, `buildProgramFhHostedDefaultParserLift`, `acceptedClass`, `rejection`.
- Watchlist exports removed with the Apify actor: `DEFAULT_QUERIES`, `DEFAULT_RUNTIME_QUERIES`, `APT_QUERIES`, `RANSOMWARE_QUERIES`, `HIGH_YIELD_RANSOMWARE_QUERIES`, `ALIAS_LIFT_QUERIES`, `ALIAS_MARGIN_QUERIES`, `COMMERCIAL_LIFT_QUERIES`, `MALWARE_TOOL_QUERIES`, `MEASURED_LIFT_QUERIES`, `THREAT_CLUSTER_QUERIES`.

## Kept Intentionally

- This thesis log is intentionally kept even though it contains the word Apify.
