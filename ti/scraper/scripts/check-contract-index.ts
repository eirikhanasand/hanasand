import { handleApiRequest } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
  store: new InMemoryScraperStore(),
  frontier: new FocusedFrontier()
});
const json = await response.json();
const record = isRecord(json) ? json : {};
const semantics = isRecord(record.semantics) ? record.semantics : {};
const sourceExecution = isRecord(semantics.sourceActivationExecutionReadiness)
  ? semantics.sourceActivationExecutionReadiness
  : {};
const rolloutPromotion = isRecord(semantics.sourceRolloutPromotionPacket)
  ? semantics.sourceRolloutPromotionPacket
  : {};
const evidenceCertification = isRecord(semantics.evidencePersistenceCertification)
  ? semantics.evidencePersistenceCertification
  : {};
const publicCanaryControlPlane = isRecord(semantics.publicCanaryControlPlane)
  ? semantics.publicCanaryControlPlane
  : {};
const apiRegressionSentinel = isRecord(record.apiRegressionSentinel) ? record.apiRegressionSentinel : {};
const apiGatewayIntegration = isRecord(record.apiGatewayIntegration) ? record.apiGatewayIntegration : {};
const regressionRouteInvariant = isRecord(apiRegressionSentinel.routeInventoryInvariant)
  ? apiRegressionSentinel.routeInventoryInvariant
  : {};
const regressionResponseInvariant = isRecord(apiRegressionSentinel.responseShapeInvariant)
  ? apiRegressionSentinel.responseShapeInvariant
  : {};
const surfaces = Array.isArray(record.surfaces) ? record.surfaces.filter(isRecord) : [];
const sourcesSurface = surfaces.find((surface) => surface.name === "sources") ?? {};
const evidenceSurface = surfaces.find((surface) => surface.name === "evidence") ?? {};
const opsSurface = surfaces.find((surface) => surface.name === "ops") ?? {};
const routes = isRecord(record.routeInventory) && Array.isArray(record.routeInventory.routes)
  ? record.routeInventory.routes.filter(isRecord)
  : [];
const routeTruthAudit = isRecord(record.routeTruthAudit) ? record.routeTruthAudit : {};
const auditFixtures = Array.isArray(routeTruthAudit.fixtures) ? routeTruthAudit.fixtures.filter(isRecord) : [];
const responsiveAudit = isRecord(record.publicWrapperResponsiveAudit) ? record.publicWrapperResponsiveAudit : {};
const responsiveFixtures = Array.isArray(responsiveAudit.fixtures) ? responsiveAudit.fixtures.filter(isRecord) : [];
const responsivePublicWrapper = isRecord(responsiveAudit.publicWrapper) ? responsiveAudit.publicWrapper : {};
const responsiveProofCommands = stringArray(responsiveAudit.proofCommands);
const responsiveFixtureNames = responsiveFixtures.map((fixture) => String(fixture.name ?? ""));
const deltaAudit = isRecord(record.publicWrapperDeltaAudit) ? record.publicWrapperDeltaAudit : {};
const deltaFixtures = Array.isArray(deltaAudit.fixtures) ? deltaAudit.fixtures.filter(isRecord) : [];
const deltaFixtureNames = deltaFixtures.map((fixture) => String(fixture.name ?? ""));
const deltaStableFields = stringArray(deltaAudit.stableFields);
const enterpriseApiSurface = isRecord(record.enterpriseApiSurface) ? record.enterpriseApiSurface : {};
const authBoundary = isRecord(enterpriseApiSurface.authBoundary) ? enterpriseApiSurface.authBoundary : {};
const pagination = isRecord(enterpriseApiSurface.pagination) ? enterpriseApiSurface.pagination : {};
const rateLimits = isRecord(enterpriseApiSurface.rateLimits) ? enterpriseApiSurface.rateLimits : {};
const auditFields = isRecord(enterpriseApiSurface.auditFields) ? enterpriseApiSurface.auditFields : {};
const sdkIntegration = isRecord(record.sdkIntegration) ? record.sdkIntegration : {};
const sdkPolling = isRecord(sdkIntegration.polling) ? sdkIntegration.polling : {};
const sdkEmptyDelta = isRecord(sdkPolling.emptyDelta) ? sdkPolling.emptyDelta : {};
const sdkDuplicateRunReuse = isRecord(sdkPolling.duplicateRunReuse) ? sdkPolling.duplicateRunReuse : {};
const sdkEventBoundary = isRecord(sdkIntegration.eventBoundary) ? sdkIntegration.eventBoundary : {};
const sdkOpenapi = isRecord(sdkIntegration.openapi) ? sdkIntegration.openapi : {};
const clientCompatibilityMatrix = isRecord(record.clientCompatibilityMatrix) ? record.clientCompatibilityMatrix : {};
const streamingWebhookCompatibility = isRecord(record.streamingWebhookCompatibility) ? record.streamingWebhookCompatibility : {};
const streamingPollingCompatibility = isRecord(streamingWebhookCompatibility.pollingCompatibility) ? streamingWebhookCompatibility.pollingCompatibility : {};
const streamingEventEnvelope = isRecord(streamingWebhookCompatibility.eventEnvelope) ? streamingWebhookCompatibility.eventEnvelope : {};
const streamingEventTypes = Array.isArray(streamingWebhookCompatibility.eventTypes)
  ? streamingWebhookCompatibility.eventTypes.filter(isRecord)
  : [];
const streamingDeliveryModes = Array.isArray(streamingWebhookCompatibility.deliveryModes)
  ? streamingWebhookCompatibility.deliveryModes.filter(isRecord)
  : [];
const streamingWebhooks = isRecord(streamingWebhookCompatibility.webhooks) ? streamingWebhookCompatibility.webhooks : {};
const streamingWebhookFailure = isRecord(streamingWebhooks.failureBehavior) ? streamingWebhooks.failureBehavior : {};
const streamingNoLeak = isRecord(streamingWebhookCompatibility.noLeak) ? streamingWebhookCompatibility.noLeak : {};
const publicWrapperCutoverReadiness = isRecord(record.publicWrapperCutoverReadiness) ? record.publicWrapperCutoverReadiness : {};
const cutoverStableAgreement = isRecord(publicWrapperCutoverReadiness.stableFieldAgreement) ? publicWrapperCutoverReadiness.stableFieldAgreement : {};
const cutoverFallbackWatch = isRecord(publicWrapperCutoverReadiness.fallbackWatch) ? publicWrapperCutoverReadiness.fallbackWatch : {};
const cutoverDeprecationWatch = isRecord(publicWrapperCutoverReadiness.deprecationWatch) ? publicWrapperCutoverReadiness.deprecationWatch : {};
const cutoverGatewayWatch = isRecord(publicWrapperCutoverReadiness.gatewayWatch) ? publicWrapperCutoverReadiness.gatewayWatch : {};
const realtimeDeliveryPrototype = isRecord(record.realtimeDeliveryPrototype) ? record.realtimeDeliveryPrototype : {};
const realtimeFeatureFlags = isRecord(realtimeDeliveryPrototype.featureFlags) ? realtimeDeliveryPrototype.featureFlags : {};
const realtimeFallback = isRecord(realtimeDeliveryPrototype.fallbackToPolling) ? realtimeDeliveryPrototype.fallbackToPolling : {};
const realtimeEventEnvelope = isRecord(realtimeDeliveryPrototype.eventEnvelope) ? realtimeDeliveryPrototype.eventEnvelope : {};
const realtimeEventPrototypes = Array.isArray(realtimeDeliveryPrototype.eventPrototypes)
  ? realtimeDeliveryPrototype.eventPrototypes.filter(isRecord)
  : [];
const realtimeDeliveryModes = Array.isArray(realtimeDeliveryPrototype.deliveryModes)
  ? realtimeDeliveryPrototype.deliveryModes.filter(isRecord)
  : [];
const realtimeNoLeak = isRecord(realtimeDeliveryPrototype.noLeak) ? realtimeDeliveryPrototype.noLeak : {};
const realtimePublicGuardrails = isRecord(realtimeDeliveryPrototype.publicWrapperGuardrails) ? realtimeDeliveryPrototype.publicWrapperGuardrails : {};
const realtimeDeliverySoak = isRecord(record.realtimeDeliverySoak) ? record.realtimeDeliverySoak : {};
const realtimeSoakScenarios = Array.isArray(realtimeDeliverySoak.soakScenarios)
  ? realtimeDeliverySoak.soakScenarios.filter(isRecord)
  : [];
const realtimeSoakScenarioNames = realtimeSoakScenarios.map((scenario) => String(scenario.name ?? ""));
const realtimeSoakOutbox = isRecord(realtimeDeliverySoak.webhookOutbox) ? realtimeDeliverySoak.webhookOutbox : {};
const realtimeSoakCursorGap = isRecord(realtimeDeliverySoak.cursorGapReplay) ? realtimeDeliverySoak.cursorGapReplay : {};
const realtimeSoakPollingFallback = isRecord(realtimeDeliverySoak.pollingFallback) ? realtimeDeliverySoak.pollingFallback : {};
const realtimeSoakNoLeak = isRecord(realtimeDeliverySoak.noLeak) ? realtimeDeliverySoak.noLeak : {};
const clientGenerationFreeze = isRecord(record.clientGenerationFreeze) ? record.clientGenerationFreeze : {};
const frontendProgressiveUpdateContract = isRecord(record.frontendProgressiveUpdateContract) ? record.frontendProgressiveUpdateContract : {};
const frontendProgressiveRoutes = isRecord(frontendProgressiveUpdateContract.routes) ? frontendProgressiveUpdateContract.routes : {};
const frontendProgressiveMergeSemantics = isRecord(frontendProgressiveUpdateContract.mergeSemantics) ? frontendProgressiveUpdateContract.mergeSemantics : {};
const frontendProgressiveNoLeak = isRecord(frontendProgressiveUpdateContract.noLeak) ? frontendProgressiveUpdateContract.noLeak : {};
const frontendProgressiveProofMatrix = Array.isArray(frontendProgressiveUpdateContract.uiProofMatrix)
  ? frontendProgressiveUpdateContract.uiProofMatrix.filter(isRecord)
  : [];
const frontendProgressiveScenarios = frontendProgressiveProofMatrix.map((fixture) => String(fixture.scenario ?? ""));
const scraperNativeReplacementReadiness = isRecord(record.scraperNativeReplacementReadiness) ? record.scraperNativeReplacementReadiness : {};
const scraperNativeReplacementProofMatrix = Array.isArray(scraperNativeReplacementReadiness.proofMatrix)
  ? scraperNativeReplacementReadiness.proofMatrix.filter(isRecord)
  : [];
const scraperNativeReplacementCases = scraperNativeReplacementProofMatrix.map((row) => String(row.case ?? ""));
const apifyStoreReadiness = isRecord(record.apifyStoreReadiness) ? record.apifyStoreReadiness : {};
const apifyStoreActor = isRecord(apifyStoreReadiness.actor) ? apifyStoreReadiness.actor : {};
const apifyStoreReadinessPacket = isRecord(apifyStoreReadiness.storeReadiness) ? apifyStoreReadiness.storeReadiness : {};
const apifyListingFields = isRecord(apifyStoreReadinessPacket.listingFields) ? apifyStoreReadinessPacket.listingFields : {};
const apifyDefaultInput = isRecord(apifyStoreReadiness.defaultSampleInput) ? apifyStoreReadiness.defaultSampleInput : {};
const apifyProofDtos = Array.isArray(apifyStoreReadiness.publicProofDtos) ? apifyStoreReadiness.publicProofDtos.filter(isRecord) : [];
const apifyProofQueries = apifyProofDtos.map((proof) => String(proof.query ?? ""));
const apifyCompatibility = isRecord(apifyStoreReadiness.frontendApiCompatibility) ? apifyStoreReadiness.frontendApiCompatibility : {};
const apifyCompatibilityStates = Array.isArray(apifyCompatibility.states) ? apifyCompatibility.states.filter(isRecord).map((state) => String(state.state ?? "")) : [];
const apifyGuardrails = isRecord(apifyStoreReadiness.marketplaceGuardrails) ? apifyStoreReadiness.marketplaceGuardrails : {};
const darkwebIndexFrontendContract = isRecord(record.darkwebIndexFrontendContract) ? record.darkwebIndexFrontendContract : {};
const darkwebFrontendApiRoutes = isRecord(darkwebIndexFrontendContract.apiRoutes) ? darkwebIndexFrontendContract.apiRoutes : {};
const darkwebFrontendTable = isRecord(darkwebIndexFrontendContract.table) ? darkwebIndexFrontendContract.table : {};
const darkwebFrontendDrawer = isRecord(darkwebIndexFrontendContract.safeDetailDrawer) ? darkwebIndexFrontendContract.safeDetailDrawer : {};
const darkwebFrontendCopyRules = isRecord(darkwebIndexFrontendContract.copyRules) ? darkwebIndexFrontendContract.copyRules : {};
const darkwebFrontendNoLeak = isRecord(darkwebIndexFrontendContract.noLeak) ? darkwebIndexFrontendContract.noLeak : {};
const darkwebFrontendReleaseGate = isRecord(darkwebIndexFrontendContract.releaseGate) ? darkwebIndexFrontendContract.releaseGate : {};
const sourceAtlasFrontendContract = isRecord(record.sourceAtlasFrontendContract) ? record.sourceAtlasFrontendContract : {};
const sourceAtlasFrontendApiRoutes = isRecord(sourceAtlasFrontendContract.apiRoutes) ? sourceAtlasFrontendContract.apiRoutes : {};
const sourceAtlasFrontendTable = isRecord(sourceAtlasFrontendContract.table) ? sourceAtlasFrontendContract.table : {};
const sourceAtlasFrontendDrawer = isRecord(sourceAtlasFrontendContract.safeDetailDrawer) ? sourceAtlasFrontendContract.safeDetailDrawer : {};
const sourceAtlasFrontendImportPlans = isRecord(sourceAtlasFrontendContract.importPlans) ? sourceAtlasFrontendContract.importPlans : {};
const sourceAtlasFrontendCopyRules = isRecord(sourceAtlasFrontendContract.copyRules) ? sourceAtlasFrontendContract.copyRules : {};
const sourceAtlasFrontendNoLeak = isRecord(sourceAtlasFrontendContract.noLeak) ? sourceAtlasFrontendContract.noLeak : {};
const sourceAtlasFrontendReleaseGate = isRecord(sourceAtlasFrontendContract.releaseGate) ? sourceAtlasFrontendContract.releaseGate : {};
const clientGenerationOpenapiManifest = isRecord(clientGenerationFreeze.openapiManifest) ? clientGenerationFreeze.openapiManifest : {};
const clientGenerationOperationManifest = isRecord(clientGenerationFreeze.operationManifest) ? clientGenerationFreeze.operationManifest : {};
const clientGenerationSchemaManifest = isRecord(clientGenerationFreeze.schemaManifest) ? clientGenerationFreeze.schemaManifest : {};
const clientGenerationFixtureManifest = isRecord(clientGenerationFreeze.fixtureManifest) ? clientGenerationFreeze.fixtureManifest : {};
const clientGenerationChangelogGate = isRecord(clientGenerationFreeze.changelogGate) ? clientGenerationFreeze.changelogGate : {};
const clientGenerationDeprecationPolicy = isRecord(clientGenerationChangelogGate.deprecationPolicy) ? clientGenerationChangelogGate.deprecationPolicy : {};
const clientGenerationFixtureGate = isRecord(clientGenerationChangelogGate.fixtureGate) ? clientGenerationChangelogGate.fixtureGate : {};
const clientGenerationDriftPolicy = isRecord(clientGenerationFreeze.driftPolicy) ? clientGenerationFreeze.driftPolicy : {};
const clientGenerationNoLeak = isRecord(clientGenerationFreeze.noLeak) ? clientGenerationFreeze.noLeak : {};
const clientGenerationClients = Array.isArray(clientGenerationFreeze.generatedClients)
  ? clientGenerationFreeze.generatedClients.filter(isRecord)
  : [];
const clientGenerationTargets = clientGenerationClients.map((client) => String(client.target ?? ""));
const contractFreeze = isRecord(clientCompatibilityMatrix.contractFreeze) ? clientCompatibilityMatrix.contractFreeze : {};
const compatibilityClients = Array.isArray(clientCompatibilityMatrix.clients)
  ? clientCompatibilityMatrix.clients.filter(isRecord)
  : [];
const compatibilityClientNames = compatibilityClients.map((client) => String(client.client ?? ""));
const openapi = isRecord(record.openapi) ? record.openapi : {};
const openapiPaths = isRecord(openapi.paths) ? openapi.paths : {};
const openapiComponents = isRecord(openapi.components) ? openapi.components : {};
const openapiSchemas = isRecord(openapiComponents.schemas) ? openapiComponents.schemas : {};

const checks = [
  response.status === 200,
  record.endpoint === "/v1/contracts",
  routeTruthAudit.schemaVersion === "ti.route_truth_audit.v1",
  apiRegressionSentinel.schemaVersion === "ti.api_regression_sentinel.v1",
  apiGatewayIntegration.schemaVersion === "ti.api_gateway_integration.v1",
  isRecord(semantics.apiGatewayIntegration) && semantics.apiGatewayIntegration.schemaVersion === "ti.api_gateway_integration.v1",
  apiGatewayIntegration.status === "deployment_plan_ready",
  stringArray(apiGatewayIntegration.proofCommands).includes("bun run check:api-gateway"),
  isRecord(semantics.apiRegressionSentinel) && semantics.apiRegressionSentinel.schemaVersion === "ti.api_regression_sentinel.v1",
  apiRegressionSentinel.status === "active_backward_compatibility_gate",
  Number(regressionRouteInvariant.expectedRouteCount ?? 0) === routes.length,
  ["GET /v1/contracts", "GET /v1/intel/search", "POST /v1/intel/runs", "GET /v1/intel/runs/{id}/results", "POST /api/ti/search"]
    .every((route) => stringArray(regressionRouteInvariant.requiredStableRoutes).includes(route)),
  ["endpoint", "routeInventory", "apiRegressionSentinel", "enterpriseApiSurface", "sdkIntegration", "clientCompatibilityMatrix", "streamingWebhookCompatibility", "publicWrapperCutoverReadiness", "realtimeDeliveryPrototype", "realtimeDeliverySoak", "clientGenerationFreeze", "frontendProgressiveUpdateContract", "scraperNativeReplacementReadiness", "apifyStoreReadiness", "darkwebIndexFrontendContract", "sourceAtlasFrontendContract", "openapi", "semantics"]
    .every((key) => stringArray(regressionResponseInvariant.requiredTopLevelKeys).includes(key)),
  ["status", "runId", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated", "publicTiAnswer", "publicWrapperDelta"]
    .every((field) => stringArray(regressionResponseInvariant.publicSearchRequiredKeys).includes(field)),
  stringArray(apiRegressionSentinel.proofCommands).includes("bun run check:api-regression"),
  responsiveAudit.schemaVersion === "ti.public_wrapper_responsive_search.v1",
  isRecord(semantics.publicWrapperResponsiveAudit) && semantics.publicWrapperResponsiveAudit.schemaVersion === "ti.public_wrapper_responsive_search.v1",
  responsivePublicWrapper.canonicalMethod === "POST",
  responsivePublicWrapper.canonicalPath === "/api/ti/search",
  responsivePublicWrapper.noDefaultQuery === true,
  responsivePublicWrapper.pollingSeconds === 3,
  deltaAudit.schemaVersion === "ti.public_wrapper_delta_contract.v1",
  isRecord(semantics.publicWrapperDeltaAudit) && semantics.publicWrapperDeltaAudit.schemaVersion === "ti.public_wrapper_delta_contract.v1",
  ["status", "summary", "runId", "refreshAfterSeconds", "pollCursor", "deltaCursor", "updated", "sources", "publicChannel", "restrictedMetadata", "claimLedger", "graph"]
    .every((field) => deltaStableFields.includes(field)),
  enterpriseApiSurface.schemaVersion === "ti.enterprise_api_surface.v1",
  isRecord(semantics.enterpriseApiSurface) && semantics.enterpriseApiSurface.schemaVersion === "ti.enterprise_api_surface.v1",
  sdkIntegration.schemaVersion === "ti.sdk_integration_contract.v1",
  isRecord(semantics.sdkIntegration) && semantics.sdkIntegration.schemaVersion === "ti.sdk_integration_contract.v1",
  sdkIntegration.status === "contract_only_no_push_delivery",
  streamingWebhookCompatibility.schemaVersion === "ti.streaming_webhook_compatibility.v1",
  isRecord(semantics.streamingWebhookCompatibility) && semantics.streamingWebhookCompatibility.schemaVersion === "ti.streaming_webhook_compatibility.v1",
  streamingWebhookCompatibility.status === "contract_only_polling_remains_primary",
  publicWrapperCutoverReadiness.schemaVersion === "ti.public_wrapper_cutover_readiness.v1",
  isRecord(semantics.publicWrapperCutoverReadiness) && semantics.publicWrapperCutoverReadiness.schemaVersion === "ti.public_wrapper_cutover_readiness.v1",
  publicWrapperCutoverReadiness.status === "watch_ready_polling_compatible",
  realtimeDeliveryPrototype.schemaVersion === "ti.realtime_delivery_prototype.v1",
  isRecord(semantics.realtimeDeliveryPrototype) && semantics.realtimeDeliveryPrototype.schemaVersion === "ti.realtime_delivery_prototype.v1",
  realtimeDeliveryPrototype.status === "disabled_by_default_polling_primary",
  realtimeFeatureFlags.enabledByDefault === false,
  stringArray(realtimeFeatureFlags.sseFlag).length === 0 ? String(realtimeFeatureFlags.sseFlag ?? "").includes("false") : false,
  realtimeFallback.pollingPrimary === true,
  realtimeFallback.intervalSeconds === 3,
  ["sse", "webhook"].every((mode) => realtimeDeliveryModes.some((delivery) => delivery.mode === mode && delivery.enabled === false && delivery.mounted === false)),
  ["run.status", "answer.delta", "evidence.promoted", "source.gap", "graph.review_hold", "restricted_metadata.hold", "quality.caveat", "error.retry_hint", "run.terminal"]
    .every((type) => realtimeEventPrototypes.some((event) => event.type === type && event.enabled === false)),
  ["eventId", "eventType", "runId", "tenantId", "pollCursor", "deltaCursor", "sequence", "createdAt"]
    .every((field) => stringArray(realtimeEventEnvelope.requiredFields).includes(field)),
  realtimePublicGuardrails.noDefaultActor === true,
  realtimePublicGuardrails.noDemoOrStaleCacheCopy === true,
  realtimePublicGuardrails.unknownQueryCopy === "Searching",
  ["raw_body", "restricted_raw_url", "credential", "object_reference", "webhook_secret", "private_channel_material"]
    .every((field) => stringArray(realtimeNoLeak.forbiddenPayloadFields).includes(field)),
  stringArray(realtimeDeliveryPrototype.proofCommands).includes("bun run check:api-regression"),
  stringArray(realtimeDeliveryPrototype.proofCommands).includes("bun run check:sdk-fixtures"),
  realtimeDeliverySoak.schemaVersion === "ti.realtime_delivery_soak.v1",
  isRecord(semantics.realtimeDeliverySoak) && semantics.realtimeDeliverySoak.schemaVersion === "ti.realtime_delivery_soak.v1",
  realtimeDeliverySoak.status === "disabled_soak_contract_ready_polling_primary",
  ["disabled_sse_replay", "webhook_outbox_retry", "cursor_gap_replay", "fallback_to_polling", "unsafe_payload_block"]
    .every((scenario) => realtimeSoakScenarioNames.includes(scenario)),
  realtimeSoakPollingFallback.pollingPrimary === true,
  realtimeSoakPollingFallback.intervalSeconds === 3,
  stringArray(realtimeSoakOutbox.states).includes("retry_scheduled"),
  stringArray(realtimeSoakOutbox.nonActions).includes("do not deliver callbacks"),
  stringArray(realtimeSoakCursorGap.actions).includes("fallback_to_polling"),
  stringArray(realtimeSoakNoLeak.forbiddenPayloadFields).includes("webhook_secret"),
  stringArray(realtimeDeliverySoak.proofCommands).includes("bun run check:contract-index"),
  clientGenerationFreeze.schemaVersion === "ti.client_generation_freeze.v1",
  isRecord(semantics.clientGenerationFreeze) && semantics.clientGenerationFreeze.schemaVersion === "ti.client_generation_freeze.v1",
  clientGenerationFreeze.status === "frozen_contract_ready_for_codegen",
  clientGenerationOpenapiManifest.openapi === "3.1.0",
  Number(clientGenerationOpenapiManifest.routeCount ?? 0) === Object.keys(openapiPaths).length,
  ["contracts_get_v1_contracts", "intel_get_v1_intel_search", "intel_post_v1_intel_runs", "intel_get_v1_intel_runs_id_results"]
    .every((operationId) => stringArray(clientGenerationOperationManifest.requiredOperationIds).includes(operationId)),
  ["ClientGenerationFreeze", "GeneratedClientTarget", "SdkPollingEnvelope", "RealtimeDeliveryPrototype", "WebhookDeliveryAttempt"]
    .every((schema) => stringArray(clientGenerationSchemaManifest.requiredSchemas).includes(schema)),
  ["typescript_fetch_browser", "typescript_node_service", "analyst_automation_types", "future_realtime_types"]
    .every((target) => clientGenerationTargets.includes(target)),
  clientGenerationClients.every((client) => stringArray(client.primaryRoutes).length > 0 && stringArray(client.requiredSchemas).length > 0 && stringArray(client.requiredFixtures).length > 0),
  stringArray(clientGenerationFixtureManifest.requiredFixtures).includes("fixtures/sdk/initial_public_search.json"),
  stringArray(clientGenerationFixtureManifest.invariantFields).includes("pollCursor"),
  clientGenerationChangelogGate.schemaVersion === "ti.generated_client_changelog_gate.v1",
  clientGenerationChangelogGate.status === "ready_for_generated_client_release_gate",
  clientGenerationChangelogGate.releasePolicy === "contract_only_no_artifact_publish",
  Number(clientGenerationDeprecationPolicy.minimumNoticeDays ?? 0) === 90,
  clientGenerationDeprecationPolicy.publicWrapperAlias === "POST /api/ti/search",
  ["operation_id_removed", "required_schema_removed", "cursor_field_removed", "unsafe_payload_field_added"]
    .every((blocker) => stringArray(clientGenerationChangelogGate.breakingChangeBlockers).includes(blocker)),
  ["fixture_added", "deprecation_notice_added", "realtime_type_added_disabled"]
    .every((changeClass) => stringArray(clientGenerationChangelogGate.requiredChangeClasses).includes(changeClass)),
  stringArray(clientGenerationFixtureGate.requiredFiles).includes("fixtures/sdk/initial_public_search.json"),
  stringArray(clientGenerationChangelogGate.generatedClientReleaseChecklist).includes("TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"),
  ["operation_id_drift", "required_schema_missing", "public_wrapper_field_drift", "unsafe_payload_field_detected"]
    .every((check) => stringArray(clientGenerationDriftPolicy.failClosedChecks).includes(check)),
  ["raw_body", "restricted_raw_url", "credential", "webhook_secret", "authorization", "cookie"]
    .every((field) => stringArray(clientGenerationNoLeak.forbiddenPayloadFields).includes(field)),
  stringArray(clientGenerationFreeze.proofCommands).includes("bun run check:sdk-fixtures"),
  stringArray(clientGenerationFreeze.proofCommands).includes("bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts"),
  frontendProgressiveUpdateContract.schemaVersion === "ti.frontend_progressive_update_contract.v1",
  isRecord(semantics.frontendProgressiveUpdateContract) && semantics.frontendProgressiveUpdateContract.schemaVersion === "ti.frontend_progressive_update_contract.v1",
  frontendProgressiveUpdateContract.status === "frozen_ui_polling_contract",
  frontendProgressiveRoutes.publicPost === "POST /api/ti/search",
  frontendProgressiveRoutes.scraperNativeGet === "GET /v1/intel/search",
  ["status", "runId", "pollCursor", "deltaCursor", "publicTiAnswer", "publicWrapperDelta"]
    .every((field) => stringArray(frontendProgressiveUpdateContract.requiredFields).includes(field)),
  ["first_response", "repeated_poll_empty_delta", "new_delta_available", "made_up_actor_searching", "metadata_review_hold", "final_ready"]
    .every((scenario) => frontendProgressiveScenarios.includes(scenario)),
  ["merge by runId and deltaCursor", "preserve previous publicTiAnswer on empty deltas", "never backfill default actor/demo copy"]
    .every((rule) => stringArray(frontendProgressiveMergeSemantics.rules).includes(rule)),
  ["raw_body", "restricted_raw_url", "credential", "webhook_secret"]
    .every((field) => stringArray(frontendProgressiveNoLeak.forbiddenUiPayloadFields).includes(field)),
  stringArray(frontendProgressiveUpdateContract.proofCommands).includes("TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"),
  scraperNativeReplacementReadiness.schemaVersion === "ti.scraper_native_replacement_readiness.v1",
  isRecord(semantics.scraperNativeReplacementReadiness) && semantics.scraperNativeReplacementReadiness.schemaVersion === "ti.scraper_native_replacement_readiness.v1",
  scraperNativeReplacementReadiness.status === "replacement_board_ready_polling_primary",
  scraperNativeReplacementReadiness.decision === "watch_ready",
  ["known_actor", "random_actor", "made_up_actor", "restricted_metadata_hold", "graph_hold", "empty_delta"]
    .every((caseName) => scraperNativeReplacementCases.includes(caseName)),
  stringArray(scraperNativeReplacementReadiness.blockers).includes("default_actor_detected"),
  stringArray(scraperNativeReplacementReadiness.blockers).includes("unknown_ready_without_evidence"),
  stringArray(scraperNativeReplacementReadiness.proofCommands).includes("TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"),
  apifyStoreReadiness.schemaVersion === "ti.apify_store_readiness.v1",
  isRecord(semantics.apifyStoreReadiness) && semantics.apifyStoreReadiness.schemaVersion === "ti.apify_store_readiness.v1",
  apifyStoreReadiness.status === "buyer_ready_with_external_payout_blocker",
  apifyStoreActor.name === "public-threat-actor-monitor",
  apifyStoreActor.outputContract === "safe_metadata_only.v1",
  stringArray(apifyStoreActor.categories).join(",") === "SECURITY,MONITORING",
  stringArray(apifyDefaultInput.queries).length === 20,
  apifyDefaultInput.maxRowsPerQuery === 25,
  apifyDefaultInput.includeDatasets === false,
  apifyDefaultInput.includeCoverageGaps === true,
  ["APT29", "Volt Typhoon", "Scattered Spider", "LockBit"].every((query) => apifyProofQueries.includes(query)),
  ["queued", "searching", "partial", "ready", "empty_delta"].every((state) => apifyCompatibilityStates.includes(state)),
  apifyListingFields.title === "complete",
  apifyListingFields.exampleInput === "complete",
  apifyListingFields.payoutMonetizationStatus === "external_verification_required",
  stringArray(apifyStoreReadinessPacket.knownBlockers).includes("apify_beneficiary_and_payout_method_not_stored_in_repo"),
  apifyGuardrails.noPlaceholderDefaults === true,
  apifyGuardrails.noHelloWorldSampleInput === true,
  apifyGuardrails.noGenericCategories === true,
  stringArray(apifyStoreReadiness.proofCommands).includes("bun run check:apify-publication"),
  darkwebIndexFrontendContract.schemaVersion === "ti.darkweb_index_frontend_contract.v1",
  isRecord(semantics.darkwebIndexFrontendContract) && semantics.darkwebIndexFrontendContract.schemaVersion === "ti.darkweb_index_frontend_contract.v1",
  darkwebIndexFrontendContract.status === "frozen_metadata_only_frontend_contract",
  darkwebIndexFrontendContract.route === "/ti/darkweb/index",
  darkwebIndexFrontendContract.publicRoute === "hanasand.com/ti/darkweb/index",
  darkwebFrontendApiRoutes.status === "/v1/darkweb/status",
  darkwebFrontendApiRoutes.search === "/v1/darkweb/search",
  ["redactedDisplayUrl", "category", "legalTriage", "safeSummary", "lastSeen", "liveness", "provenance", "reviewState"]
    .every((field) => stringArray(darkwebFrontendTable.columns).includes(field)),
  ["q", "category", "legalTriage", "liveness", "network", "reviewState", "cursor", "limit"]
    .every((field) => stringArray(darkwebFrontendTable.filters).includes(field)),
  ["summary", "classification", "whatWasNotAccessed", "sourceProvenance", "refreshHistory", "graphLinks", "reviewState"]
    .every((section) => stringArray(darkwebFrontendDrawer.sections).includes(section)),
  darkwebFrontendCopyRules.legalTriageDisclaimer === "Risk labels are triage labels, not legal advice.",
  darkwebFrontendNoLeak.metadataOnly === true,
  darkwebFrontendNoLeak.rawUnsafeUrlPublicOutputAllowed === false,
  ["rawUnsafeUrl", "fullOnionUrl", "credential", "object_key", "leaked_row", "payload_download"]
    .every((field) => stringArray(darkwebFrontendNoLeak.forbiddenUiPayloadFields).includes(field)),
  stringArray(darkwebFrontendReleaseGate.blockers).includes("what_was_not_accessed_missing"),
  stringArray(darkwebIndexFrontendContract.proofCommands).includes("bun run check:contract-index"),
  sourceAtlasFrontendContract.schemaVersion === "ti.source_atlas_frontend_contract.v1",
  isRecord(semantics.sourceAtlasFrontendContract) && semantics.sourceAtlasFrontendContract.schemaVersion === "ti.source_atlas_frontend_contract.v1",
  sourceAtlasFrontendContract.status === "frozen_dry_run_source_discovery_frontend_contract",
  sourceAtlasFrontendContract.route === "/ti/sources/atlas",
  sourceAtlasFrontendContract.publicRoute === "hanasand.com/ti/sources/atlas",
  sourceAtlasFrontendApiRoutes.atlas === "/v1/sources/atlas",
  sourceAtlasFrontendApiRoutes.export === "/v1/sources/atlas/export",
  ["id", "domain", "family", "queryClassCoverage", "sourceValueScore", "parserCapability", "legalRobotsState", "activationReadiness", "approvalRequired"]
    .every((field) => stringArray(sourceAtlasFrontendTable.columns).includes(field)),
  ["queryClass", "family", "parserState", "legalRobotsState", "activationReadiness", "recordLimit"]
    .every((field) => stringArray(sourceAtlasFrontendTable.filters).includes(field)),
  ["sourceSummary", "coverage", "parserCapability", "legalRobots", "activationReadiness", "approvalPacket", "rollbackPacket", "canaryPlan", "whatWillNotHappen"]
    .every((section) => stringArray(sourceAtlasFrontendDrawer.sections).includes(section)),
  ["first_100", "first_1000", "future_10k"].every((label) => stringArray(sourceAtlasFrontendImportPlans.labels).includes(label)),
  sourceAtlasFrontendCopyRules.dryRunBanner === "Dry run only. No sources are imported or crawled from this view.",
  sourceAtlasFrontendNoLeak.publicOnly === true,
  sourceAtlasFrontendNoLeak.dryRunOnly === true,
  ["rawRestrictedUrl", "privateInviteUrl", "credential", "raw_payload", "object_key", "download_url"]
    .every((field) => stringArray(sourceAtlasFrontendNoLeak.forbiddenUiPayloadFields).includes(field)),
  ["source pack import", "registry mutation", "crawl enqueue", "silent activation", "private/invite/auth/CAPTCHA activation"]
    .every((operation) => stringArray(sourceAtlasFrontendNoLeak.forbiddenOperations).includes(operation)),
  stringArray(sourceAtlasFrontendReleaseGate.blockers).includes("auto_activation_allowed"),
  stringArray(sourceAtlasFrontendReleaseGate.blockers).includes("private_auth_captcha_source_detected"),
  stringArray(sourceAtlasFrontendContract.proofCommands).includes("bun run check:contract-index"),
  cutoverStableAgreement.publicWrapperRoute === "POST /api/ti/search",
  cutoverStableAgreement.scraperNativeRoute === "GET /v1/intel/search",
  cutoverStableAgreement.pollingSeconds === 3,
  ["status", "runId", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated", "publicTiAnswer", "publicWrapperDelta"]
    .every((field) => stringArray(cutoverStableAgreement.requiredFields).includes(field)),
  cutoverFallbackWatch.requiredCopyForNoResult === "Searching",
  ["default_actor_fallback", "demo_copy", "stale_cache_copy", "implicit_apt29_example", "unknown_ready_without_evidence"]
    .every((code) => stringArray(cutoverFallbackWatch.bannedFallbackCodes).includes(code)),
  ["default APT29", "cached demo", "stale local cache"]
    .every((pattern) => stringArray(cutoverFallbackWatch.bannedTextPatterns).includes(pattern)),
  cutoverDeprecationWatch.aliasRoute === "POST /api/ti/search",
  cutoverDeprecationWatch.canonicalRoute === "GET /v1/intel/search",
  cutoverDeprecationWatch.state === "compatibility_wrapper_until_cutover",
  stringArray(cutoverDeprecationWatch.rollbackTriggers).includes("default_actor_detected"),
  stringArray(cutoverDeprecationWatch.rollbackTriggers).includes("rate_limit_header_missing"),
  stringArray(cutoverGatewayWatch.requiredForwardedHeaders).includes("x-tenant-id"),
  stringArray(publicWrapperCutoverReadiness.proofCommands).includes("bun run check:api-gateway"),
  stringArray(publicWrapperCutoverReadiness.proofCommands).includes("TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"),
  streamingPollingCompatibility.pollingPrimary === true,
  streamingPollingCompatibility.intervalSeconds === 3,
  ["runId", "status", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated", "warningCodes"]
    .every((field) => stringArray(streamingPollingCompatibility.sameFields).includes(field)),
  ["sse", "webhook"].every((mode) => streamingDeliveryModes.some((delivery) => delivery.mode === mode)),
  ["run.status", "answer.delta", "evidence.promoted", "source.gap", "graph.review_hold", "restricted_metadata.hold", "error.retry_hint", "run.terminal"]
    .every((type) => streamingEventTypes.some((event) => event.type === type)),
  ["eventId", "eventType", "runId", "tenantId", "pollCursor", "deltaCursor", "sequence", "createdAt"]
    .every((field) => stringArray(streamingEventEnvelope.requiredFields).includes(field)),
  streamingWebhookFailure.maxAttempts === 6,
  Array.isArray(streamingWebhookFailure.retryableStatuses) && streamingWebhookFailure.retryableStatuses.includes(429),
  ["raw_body", "restricted_raw_url", "credential", "object_reference", "webhook_secret"]
    .every((field) => stringArray(streamingNoLeak.forbiddenPayloadFields).includes(field)),
  sdkPolling.intervalSeconds === 3,
  stringArray(sdkPolling.responseFields).includes("pollCursor"),
  stringArray(sdkPolling.responseFields).includes("deltaCursor"),
  stringArray(sdkPolling.retryableStates).includes("metadata_review"),
  sdkEmptyDelta.status === "waiting_for_deltas",
  sdkEmptyDelta.changed === false,
  sdkDuplicateRunReuse.warningCode === "duplicate_run_reuse",
  stringArray(sdkEventBoundary.allowedModes).includes("sse"),
  stringArray(sdkEventBoundary.allowedModes).includes("webhook"),
  stringArray(sdkEventBoundary.eventTypes).includes("delta.available"),
  stringArray(sdkEventBoundary.forbiddenPayloadFields).includes("raw_body"),
  sdkOpenapi.schemaVersion === "ti.sdk_openapi_extension.v1",
  clientCompatibilityMatrix.schemaVersion === "ti.client_compatibility_matrix.v1",
  isRecord(semantics.clientCompatibilityMatrix) && semantics.clientCompatibilityMatrix.schemaVersion === "ti.client_compatibility_matrix.v1",
  clientCompatibilityMatrix.status === "contract_frozen_for_client_generation",
  contractFreeze.schemaVersion === "ti.openapi_contract_freeze.v1",
  contractFreeze.openapi === "3.1.0",
  Number(contractFreeze.routeCount ?? 0) === Object.keys(openapiPaths).length,
  ["ErrorEnvelope", "CursorPage", "IdempotentRunRequest", "PublicSearchResponse", "SdkPollingEnvelope", "SdkSubscriptionRegistration"]
    .every((name) => stringArray(contractFreeze.requiredComponentSchemas).includes(name)),
  ["trusted_gateway_forwarded_identity", "tenant_header_boundary", "stable_error_envelope", "cursor_pagination", "idempotent_run_creation", "retry_after_headers", "public_wrapper_delta_polling", "no_leak_examples"]
    .every((name) => stringArray(contractFreeze.requiredSemantics).includes(name)),
  ["frontend_ti", "cti_backend", "analyst_automation", "future_sdk", "future_sse_webhooks"]
    .every((name) => compatibilityClientNames.includes(name)),
  compatibilityClients.every((client) => stringArray(client.primaryRoutes).length > 0 && stringArray(client.requiredResponseKeys).length > 0 && stringArray(client.states).length > 0),
  authBoundary.schemaVersion === "ti.enterprise_auth_boundary.v1",
  stringArray(authBoundary.requiredForwardedHeaders).includes("x-tenant-id"),
  stringArray(authBoundary.requiredForwardedHeaders).includes("x-actor-id"),
  stringArray(pagination.requestFields).includes("cursor"),
  stringArray(pagination.responseFields).includes("nextCursor"),
  stringArray(rateLimits.overloadCodes).includes("queue_pressure"),
  stringArray(auditFields.requiredOnMutations).includes("idempotencyKey"),
  stringArray(auditFields.redactedAlways).includes("authorization"),
  openapi.schemaVersion === "ti.openapi_ready_contract.v1",
  isRecord(openapiSchemas.ErrorEnvelope),
  isRecord(openapiSchemas.PublicSearchResponse),
  isRecord(openapiSchemas.SdkPollingEnvelope),
  isRecord(openapiSchemas.SdkSubscriptionRegistration),
  routeTruthAudit.expectedRouteInventoryCount === routes.length,
  routes.some((route) => route.method === "POST" && route.path === "/v1/sources/coverage-closeout"),
  routes.some((route) => route.method === "POST" && route.path === "/v1/sources/activation-batches"),
  routes.some((route) => route.method === "GET" && route.path === "/v1/ops/canary/readiness"),
  routes.some((route) => route.method === "GET" && route.path === "/v1/ops/canary/soak"),
  publicCanaryControlPlane.schemaVersion === "ti.public_canary_control_plane.v1",
  stringArray(publicCanaryControlPlane.routes).includes("/v1/ops/canary/readiness"),
  stringArray(publicCanaryControlPlane.routes).includes("/v1/ops/canary/soak"),
  stringArray(publicCanaryControlPlane.proofCommands).includes("bun run check:canary-proof-path"),
  isRecord(publicCanaryControlPlane.activation) && publicCanaryControlPlane.activation.requiresHumanApproval === true,
  isRecord(publicCanaryControlPlane.collection) && publicCanaryControlPlane.collection.continuousLoopAutoActivation === false,
  stringArray(isRecord(publicCanaryControlPlane.collection) ? publicCanaryControlPlane.collection.backgroundEnv : undefined).includes("TI_CANARY_MAX_QUEUE_SIZE"),
  isRecord(isRecord(publicCanaryControlPlane.collection) ? publicCanaryControlPlane.collection.fetchProvenance : undefined)
    && publicCanaryControlPlane.collection.fetchProvenance.liveMode === "native_live_http"
    && stringArray(publicCanaryControlPlane.collection.fetchProvenance.requiredCaptureMetadata).includes("fetchProvenance.finalUrlHash"),
  isRecord(publicCanaryControlPlane.runtimeLoop)
    && publicCanaryControlPlane.runtimeLoop.schemaVersion === "ti.public_canary_loop_runtime.v1"
    && publicCanaryControlPlane.runtimeLoop.routeField === "/v1/ops/canary.operatorView.runtime"
    && stringArray(publicCanaryControlPlane.runtimeLoop.fields).includes("consecutiveErrorCount")
    && stringArray(publicCanaryControlPlane.runtimeLoop.controls).includes("dedupeBeforeWrite"),
  isRecord(publicCanaryControlPlane.readiness) && publicCanaryControlPlane.readiness.schemaVersion === "ti.public_canary_readiness.v1",
  isRecord(publicCanaryControlPlane.soak) && publicCanaryControlPlane.soak.schemaVersion === "ti.public_canary_soak.v1",
  stringArray(isRecord(publicCanaryControlPlane.readiness) ? publicCanaryControlPlane.readiness.optionalProductionGates : undefined).includes("requireNativeLiveHttp=true"),
  stringArray(isRecord(publicCanaryControlPlane.soak) ? publicCanaryControlPlane.soak.optionalProductionGates : undefined).includes("requireNativeLiveHttp=true"),
  stringArray(isRecord(publicCanaryControlPlane.soak) ? publicCanaryControlPlane.soak.controls : undefined).includes("canaryPortfolioOnly"),
  stringArray(isRecord(publicCanaryControlPlane.soak) ? publicCanaryControlPlane.soak.controls : undefined).includes("fetchProvenanceRequired"),
  stringArray(isRecord(publicCanaryControlPlane.soak) ? publicCanaryControlPlane.soak.controls : undefined).includes("nativeLiveHttpRequired"),
  stringArray(isRecord(publicCanaryControlPlane.soak) ? publicCanaryControlPlane.soak.requiredMetrics : undefined).includes("nativeLiveHttpCaptureCount"),
  stringArray(isRecord(publicCanaryControlPlane.readiness) ? publicCanaryControlPlane.readiness.requiredQueries : undefined).includes("APT42"),
  stringArray(isRecord(publicCanaryControlPlane.readiness) ? publicCanaryControlPlane.readiness.requiredQueries : undefined).includes("Turla"),
  stringArray(isRecord(publicCanaryControlPlane.operatorView) ? publicCanaryControlPlane.operatorView.fields : undefined).includes("evidenceStorage.productionEvidenceMode"),
  stringArray(opsSurface.responseKeys).includes("readiness"),
  stringArray(opsSurface.guarantees).includes("public_canary_control_plane"),
  stringArray(opsSurface.guarantees).includes("no_implicit_source_activation"),
  auditFixtures.some((fixture) => fixture.name === "route_inventory_drift"),
  auditFixtures.some((fixture) => fixture.name === "missing_schema_examples"),
  auditFixtures.some((fixture) => fixture.name === "public_post_compatibility"),
  auditFixtures.some((fixture) => fixture.name === "restricted_emergency_stop"),
  auditFixtures.some((fixture) => fixture.name === "canary_rc_decision"),
  auditFixtures.some((fixture) => fixture.name === "delta_polling_contract"),
  auditFixtures.some((fixture) => fixture.name === "empty_delta_poll"),
  auditFixtures.some((fixture) => fixture.name === "public_post_poll_compatibility"),
  auditFixtures.every((fixture) => fixture.publicPostCompatible === true && fixture.noLeakRequired === true),
  [
    "apt29_actor",
    "apt42_actor",
    "turla_actor",
    "volt_typhoon_actor",
    "scattered_spider_actor",
    "akira_ransomware",
    "random_actor",
    "made_up_actor",
    "cve",
    "malware_tool",
    "country",
    "sector",
    "victim",
    "provider_unavailable",
    "scraper_unavailable",
    "queue_pressure",
    "duplicate_run_reuse",
    "policy_block",
    "restricted_hold",
    "public_channel_partial",
    "graph_evidence_promotion"
  ].every((name) => responsiveFixtureNames.includes(name)),
  responsiveFixtures.every((fixture) =>
    fixture.pollSeconds === 3
    && fixture.stableRunId === true
    && fixture.publicPostCompatible === true
    && fixture.noDefaultActor === true
    && fixture.noLeakRequired === true
    && fixture.noStaleCacheCopy === true
  ),
  responsiveProofCommands.includes("TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search"),
  responsiveProofCommands.includes("TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search"),
  responsiveProofCommands.includes("TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"),
  [
    "first_response",
    "repeated_poll_same_run_id",
    "poll_cursor_advancement",
    "empty_delta",
    "new_clear_web_capture_delta",
    "public_channel_hint_delta",
    "restricted_metadata_held_delta",
    "graph_relationship_delta",
    "claim_ledger_hold",
    "contradiction_downgrade",
    "no_result_searching",
    "provider_unavailable",
    "scraper_unavailable",
    "queue_pressure",
    "duplicate_run_reuse",
    "stale_source",
    "low_confidence",
    "policy_block",
    "final_ready"
  ].every((name) => deltaFixtureNames.includes(name)),
  deltaFixtures.every((fixture) =>
    fixture.pollSeconds === 3
    && fixture.stableRunId === true
    && fixture.requiresPollCursor === true
    && fixture.requiresDeltaCursor === true
    && fixture.publicPostCompatible === true
    && fixture.noLeakRequired === true
  ),
  stringArray(sourceExecution.routes).includes("/v1/intel/search"),
  stringArray(sourceExecution.fields).includes("first10Canary"),
  stringArray(sourceExecution.fields).includes("publicRollout50"),
  stringArray(sourceExecution.fields).includes("queueBudgetImpact"),
  stringArray(rolloutPromotion.fields).includes("rolloutPromotion"),
  stringArray(rolloutPromotion.fields).includes("agent06EvidenceCertification"),
  stringArray(rolloutPromotion.fields).includes("agent10CanaryReleaseDecision"),
  stringArray(sourcesSurface.responseKeys).includes("executionReadiness"),
  stringArray(sourcesSurface.responseKeys).includes("rolloutPromotion"),
  stringArray(sourcesSurface.guarantees).includes("source_activation_execution_readiness"),
  stringArray(sourcesSurface.guarantees).includes("source_rollout_promotion_packet"),
  stringArray(evidenceCertification.routes).includes("/v1/evidence/claim-ledger"),
  stringArray(evidenceCertification.scenarios).includes("object_store_write_failure"),
  stringArray(evidenceSurface.responseKeys).includes("certification"),
  stringArray(evidenceSurface.guarantees).includes("persistence_certification"),
  !JSON.stringify(json).toLowerCase().includes("authorization:")
];
const ok = checks.every(Boolean);
const failedCheckIndexes = checks
  .map((passed, index) => passed ? undefined : index)
  .filter((index): index is number => typeof index === "number");

console.log(JSON.stringify({
  ok,
  failedCheckIndexes,
  command: "bun run check:contract-index",
  endpoint: record.endpoint,
  routeCount: routes.length,
  routeTruthAudit: {
    schemaVersion: String(routeTruthAudit.schemaVersion ?? ""),
    expectedRouteInventoryCount: Number(routeTruthAudit.expectedRouteInventoryCount ?? 0),
    fixtureNames: auditFixtures.map((fixture) => String(fixture.name ?? ""))
  },
  publicWrapperResponsiveAudit: {
    schemaVersion: String(responsiveAudit.schemaVersion ?? ""),
    pollingSeconds: Number(responsivePublicWrapper.pollingSeconds ?? 0),
    fixtureNames: responsiveFixtureNames,
    proofCommands: responsiveProofCommands
  },
  publicWrapperDeltaAudit: {
    schemaVersion: String(deltaAudit.schemaVersion ?? ""),
    stableFields: deltaStableFields,
    fixtureNames: deltaFixtureNames
  },
  enterpriseApiSurface: {
    schemaVersion: String(enterpriseApiSurface.schemaVersion ?? ""),
    authHeaders: stringArray(authBoundary.requiredForwardedHeaders),
    paginationFields: stringArray(pagination.responseFields),
    rateLimitCodes: stringArray(rateLimits.overloadCodes),
    openapi: String(openapi.openapi ?? "")
  },
  sdkIntegration: {
    schemaVersion: String(sdkIntegration.schemaVersion ?? ""),
    status: String(sdkIntegration.status ?? ""),
    pollingSeconds: Number(sdkPolling.intervalSeconds ?? 0),
    responseFields: stringArray(sdkPolling.responseFields),
    eventModes: stringArray(sdkEventBoundary.allowedModes)
  },
  sourceAtlasFrontendContract: {
    schemaVersion: String(sourceAtlasFrontendContract.schemaVersion ?? ""),
    status: String(sourceAtlasFrontendContract.status ?? ""),
    route: String(sourceAtlasFrontendContract.route ?? ""),
    tableColumns: stringArray(sourceAtlasFrontendTable.columns),
    filters: stringArray(sourceAtlasFrontendTable.filters),
    importPlanLabels: stringArray(sourceAtlasFrontendImportPlans.labels)
  },
  streamingWebhookCompatibility: {
    schemaVersion: String(streamingWebhookCompatibility.schemaVersion ?? ""),
    status: String(streamingWebhookCompatibility.status ?? ""),
    deliveryModes: streamingDeliveryModes.map((mode) => String(mode.mode ?? "")),
    eventTypes: streamingEventTypes.map((event) => String(event.type ?? "")),
    pollingFields: stringArray(streamingPollingCompatibility.sameFields),
    forbiddenPayloadFields: stringArray(streamingNoLeak.forbiddenPayloadFields)
  },
  publicWrapperCutoverReadiness: {
    schemaVersion: String(publicWrapperCutoverReadiness.schemaVersion ?? ""),
    status: String(publicWrapperCutoverReadiness.status ?? ""),
    publicWrapperRoute: String(cutoverStableAgreement.publicWrapperRoute ?? ""),
    requiredFields: stringArray(cutoverStableAgreement.requiredFields),
    bannedFallbackCodes: stringArray(cutoverFallbackWatch.bannedFallbackCodes),
    rollbackTriggers: stringArray(cutoverDeprecationWatch.rollbackTriggers),
    proofCommands: stringArray(publicWrapperCutoverReadiness.proofCommands)
  },
  realtimeDeliveryPrototype: {
    schemaVersion: String(realtimeDeliveryPrototype.schemaVersion ?? ""),
    status: String(realtimeDeliveryPrototype.status ?? ""),
    enabledByDefault: realtimeFeatureFlags.enabledByDefault === true,
    deliveryModes: realtimeDeliveryModes.map((mode) => String(mode.mode ?? "")),
    eventTypes: realtimeEventPrototypes.map((event) => String(event.type ?? "")),
    pollingPrimary: realtimeFallback.pollingPrimary === true,
    forbiddenPayloadFields: stringArray(realtimeNoLeak.forbiddenPayloadFields)
  },
  realtimeDeliverySoak: {
    schemaVersion: String(realtimeDeliverySoak.schemaVersion ?? ""),
    status: String(realtimeDeliverySoak.status ?? ""),
    scenarios: realtimeSoakScenarioNames,
    outboxStates: stringArray(realtimeSoakOutbox.states),
    cursorGapActions: stringArray(realtimeSoakCursorGap.actions),
    pollingPrimary: realtimeSoakPollingFallback.pollingPrimary === true,
    forbiddenPayloadFields: stringArray(realtimeSoakNoLeak.forbiddenPayloadFields)
  },
  clientGenerationFreeze: {
    schemaVersion: String(clientGenerationFreeze.schemaVersion ?? ""),
    status: String(clientGenerationFreeze.status ?? ""),
    openapi: String(clientGenerationOpenapiManifest.openapi ?? ""),
    generatedTargets: clientGenerationTargets,
    requiredSchemas: stringArray(clientGenerationSchemaManifest.requiredSchemas),
    changelogGateStatus: String(clientGenerationChangelogGate.status ?? ""),
    breakingChangeBlockers: stringArray(clientGenerationChangelogGate.breakingChangeBlockers),
    minimumNoticeDays: Number(clientGenerationDeprecationPolicy.minimumNoticeDays ?? 0),
    failClosedChecks: stringArray(clientGenerationDriftPolicy.failClosedChecks)
  },
  frontendProgressiveUpdateContract: {
    schemaVersion: String(frontendProgressiveUpdateContract.schemaVersion ?? ""),
    status: String(frontendProgressiveUpdateContract.status ?? ""),
    routes: frontendProgressiveRoutes,
    scenarios: frontendProgressiveScenarios,
    mergeRules: stringArray(frontendProgressiveMergeSemantics.rules)
  },
  scraperNativeReplacementReadiness: {
    schemaVersion: String(scraperNativeReplacementReadiness.schemaVersion ?? ""),
    status: String(scraperNativeReplacementReadiness.status ?? ""),
    decision: String(scraperNativeReplacementReadiness.decision ?? ""),
    cases: scraperNativeReplacementCases,
    blockers: stringArray(scraperNativeReplacementReadiness.blockers),
    proofCommands: stringArray(scraperNativeReplacementReadiness.proofCommands)
  },
  apifyStoreReadiness: {
    schemaVersion: String(apifyStoreReadiness.schemaVersion ?? ""),
    status: String(apifyStoreReadiness.status ?? ""),
    actorName: String(apifyStoreActor.name ?? ""),
    defaultQueryCount: stringArray(apifyDefaultInput.queries).length,
    proofQueries: apifyProofQueries,
    compatibilityStates: apifyCompatibilityStates,
    blockers: stringArray(apifyStoreReadinessPacket.knownBlockers)
  },
  darkwebIndexFrontendContract: {
    schemaVersion: String(darkwebIndexFrontendContract.schemaVersion ?? ""),
    status: String(darkwebIndexFrontendContract.status ?? ""),
    route: String(darkwebIndexFrontendContract.route ?? ""),
    columns: stringArray(darkwebFrontendTable.columns),
    filters: stringArray(darkwebFrontendTable.filters),
    drawerSections: stringArray(darkwebFrontendDrawer.sections),
    forbiddenUiPayloadFields: stringArray(darkwebFrontendNoLeak.forbiddenUiPayloadFields)
  },
  clientCompatibilityMatrix: {
    schemaVersion: String(clientCompatibilityMatrix.schemaVersion ?? ""),
    status: String(clientCompatibilityMatrix.status ?? ""),
    contractFreeze: String(contractFreeze.schemaVersion ?? ""),
    clients: compatibilityClientNames
  },
  apiRegressionSentinel: {
    schemaVersion: String(apiRegressionSentinel.schemaVersion ?? ""),
    status: String(apiRegressionSentinel.status ?? ""),
    requiredStableRoutes: stringArray(regressionRouteInvariant.requiredStableRoutes),
    requiredTopLevelKeys: stringArray(regressionResponseInvariant.requiredTopLevelKeys)
  },
  apiGatewayIntegration: {
    schemaVersion: String(apiGatewayIntegration.schemaVersion ?? ""),
    status: String(apiGatewayIntegration.status ?? ""),
    proofCommands: stringArray(apiGatewayIntegration.proofCommands)
  },
  sourceActivationExecutionReadiness: {
    routes: stringArray(sourceExecution.routes),
    fields: stringArray(sourceExecution.fields)
  },
  sourceRolloutPromotionPacket: {
    routes: stringArray(rolloutPromotion.routes),
    fields: stringArray(rolloutPromotion.fields)
  },
  evidencePersistenceCertification: {
    routes: stringArray(evidenceCertification.routes),
    scenarios: stringArray(evidenceCertification.scenarios)
  },
  publicCanaryControlPlane: {
    schemaVersion: String(publicCanaryControlPlane.schemaVersion ?? ""),
    routes: stringArray(publicCanaryControlPlane.routes),
    readinessProductionGates: stringArray(isRecord(publicCanaryControlPlane.readiness) ? publicCanaryControlPlane.readiness.optionalProductionGates : undefined),
    soakControls: stringArray(isRecord(publicCanaryControlPlane.soak) ? publicCanaryControlPlane.soak.controls : undefined),
    operatorFields: stringArray(isRecord(publicCanaryControlPlane.operatorView) ? publicCanaryControlPlane.operatorView.fields : undefined),
    proofCommands: stringArray(publicCanaryControlPlane.proofCommands)
  },
  expectedOutput: "ok=true; /v1/contracts indexes route truth audit, responsive/delta public wrapper fixtures, enterprise API/OpenAPI/SDK integration/client matrix surface, scraper-native replacement readiness, realtime delivery soak, source activation, and evidence persistence certification without unsafe leaks"
}, null, 2));

if (!ok) process.exit(1);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
