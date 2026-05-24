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
const surfaces = Array.isArray(record.surfaces) ? record.surfaces.filter(isRecord) : [];
const sourcesSurface = surfaces.find((surface) => surface.name === "sources") ?? {};
const evidenceSurface = surfaces.find((surface) => surface.name === "evidence") ?? {};
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

console.log(JSON.stringify({
  ok,
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
  clientCompatibilityMatrix: {
    schemaVersion: String(clientCompatibilityMatrix.schemaVersion ?? ""),
    status: String(clientCompatibilityMatrix.status ?? ""),
    contractFreeze: String(contractFreeze.schemaVersion ?? ""),
    clients: compatibilityClientNames
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
  expectedOutput: "ok=true; /v1/contracts indexes route truth audit, responsive/delta public wrapper fixtures, enterprise API/OpenAPI/SDK integration/client matrix surface, source activation, and evidence persistence certification without unsafe leaks"
}, null, 2));

if (!ok) process.exit(1);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
