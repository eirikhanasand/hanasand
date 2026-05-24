import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("api regression sentinel", () => {
  test("freezes route and schema invariants for backward-compatible clients", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as {
      apiRegressionSentinel: {
        schemaVersion: string;
        status: string;
        routeInventoryInvariant: {
          expectedRouteCount: number;
          requiredStableRoutes: string[];
          routeSignatures: string[];
        };
        responseShapeInvariant: {
          requiredTopLevelKeys: string[];
          publicSearchRequiredKeys: string[];
          publicSearchStableFields: string[];
          publicWrapperDeltaStableFields: string[];
        };
        openapiInvariant: {
          version: string;
          requiredSchemas: string[];
          requiredPaths: string[];
        };
        behaviorInvariants: {
          auth: { requiredForwardedHeaders: string[] };
          idempotency: { header: string; requiredOn: string[]; conflictCode: string };
          pagination: { style: string; responseFields: string[] };
          errors: { requiredCodes: string[]; retryableCodes: string[]; failClosedCodes: string[] };
          rateLimits: { responseHeaders: string[]; overloadCodes: string[] };
        };
        sdkInvariant: {
          fixturePackSchemaVersion: string;
          requiredFixtureFiles: string[];
          invariantFields: string[];
          compatibilityCommands: string[];
          clientCompatibilityStatus: string;
        };
        streamingWebhookInvariant: {
          schemaVersion: string;
          status: string;
          deliveryModes: string[];
          eventTypes: string[];
          pollingCompatibilityFields: string[];
          requiredHeaders: string[];
          forbiddenPayloadFields: string[];
          failureBehavior: { maxAttempts: number; fallback: string };
        };
        publicWrapperCutoverInvariant: {
          schemaVersion: string;
          status: string;
          requiredStableFields: string[];
          bannedFallbackCodes: string[];
          deprecationAlias: string;
          rollbackTriggers: string[];
          proofCommands: string[];
        };
        realtimeDeliveryPrototypeInvariant: {
          schemaVersion: string;
          status: string;
          enabledByDefault: boolean;
          pollingPrimary: boolean;
          deliveryModes: string[];
          eventTypes: string[];
          requiredFields: string[];
          forbiddenPayloadFields: string[];
          proofCommands: string[];
        };
        forbiddenChangeClasses: string[];
        noLeakAssertions: string[];
        proofCommands: string[];
      };
      apiGatewayIntegration: { schemaVersion: string; status: string; proofCommands: string[] };
      publicWrapperCutoverReadiness: { schemaVersion: string; status: string };
      realtimeDeliveryPrototype: { schemaVersion: string; status: string };
      routeInventory: { routes: Array<{ method: string; path: string }> };
      openapi: { paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } };
    };

    const sentinel = contract.apiRegressionSentinel;
    const routeSignatures = contract.routeInventory.routes.map((route) => `${route.method} ${route.path}`);

    expect(sentinel).toMatchObject({
      schemaVersion: "ti.api_regression_sentinel.v1",
      status: "active_backward_compatibility_gate"
    });
    expect(contract.apiGatewayIntegration).toMatchObject({
      schemaVersion: "ti.api_gateway_integration.v1",
      status: "deployment_plan_ready"
    });
    expect(contract.apiGatewayIntegration.proofCommands).toContain("bun run check:api-gateway");
    expect(sentinel.routeInventoryInvariant.expectedRouteCount).toBe(contract.routeInventory.routes.length);
    expect(sentinel.routeInventoryInvariant.requiredStableRoutes).toEqual(expect.arrayContaining([
      "GET /v1/contracts",
      "GET /v1/intel/search",
      "POST /v1/intel/runs",
      "GET /v1/intel/runs/{id}",
      "GET /v1/intel/runs/{id}/results",
      "GET /v1/sources",
      "POST /v1/sources",
      "GET /v1/captures",
      "GET /v1/incidents",
      "GET /v1/metrics",
      "POST /api/ti/search"
    ]));
    expect(routeSignatures).toEqual(expect.arrayContaining(
      sentinel.routeInventoryInvariant.requiredStableRoutes.filter((route) => route.startsWith("POST /api/") === false)
    ));
    expect(sentinel.responseShapeInvariant.requiredTopLevelKeys).toEqual(expect.arrayContaining([
      "apiRegressionSentinel",
      "apiGatewayIntegration",
      "publicWrapperCutoverReadiness",
      "realtimeDeliveryPrototype",
      "enterpriseApiSurface",
      "sdkIntegration",
      "clientCompatibilityMatrix",
      "openapi",
      "publicCompatibility",
      "semantics"
    ]));
    expect(sentinel.responseShapeInvariant.publicSearchStableFields).toEqual(expect.arrayContaining(
      sentinel.responseShapeInvariant.publicSearchRequiredKeys
    ));
    expect(sentinel.responseShapeInvariant.publicWrapperDeltaStableFields).toEqual(expect.arrayContaining([
      "status",
      "runId",
      "pollCursor",
      "deltaCursor",
      "refreshAfterSeconds",
      "updated"
    ]));
    expect(Object.keys(contract.openapi.paths)).toEqual(expect.arrayContaining(sentinel.openapiInvariant.requiredPaths));
    expect(Object.keys(contract.openapi.components.schemas)).toEqual(expect.arrayContaining(sentinel.openapiInvariant.requiredSchemas));
    expect(sentinel.behaviorInvariants.auth.requiredForwardedHeaders).toEqual(expect.arrayContaining(["x-tenant-id", "x-actor-id"]));
    expect(sentinel.behaviorInvariants.idempotency).toMatchObject({
      header: "idempotency-key",
      conflictCode: "idempotency_conflict"
    });
    expect(sentinel.behaviorInvariants.idempotency.requiredOn).toContain("POST /v1/intel/runs");
    expect(sentinel.behaviorInvariants.pagination).toMatchObject({ style: "cursor" });
    expect(sentinel.behaviorInvariants.pagination.responseFields).toContain("nextCursor");
    expect(sentinel.behaviorInvariants.errors.requiredCodes).toEqual(expect.arrayContaining([
      "bad_request",
      "not_found",
      "idempotency_conflict",
      "queue_pressure",
      "policy_blocked",
      "duplicate_run_reuse"
    ]));
    expect(sentinel.behaviorInvariants.rateLimits.responseHeaders).toContain("retry-after");
    expect(sentinel.sdkInvariant).toMatchObject({
      fixturePackSchemaVersion: "ti.sdk_fixture_pack.v1",
      clientCompatibilityStatus: "contract_frozen_for_client_generation"
    });
    expect(sentinel.sdkInvariant.requiredFixtureFiles.length).toBeGreaterThanOrEqual(9);
    expect(sentinel.sdkInvariant.compatibilityCommands).toContain("bun run check:sdk-fixtures");
    expect(sentinel.streamingWebhookInvariant).toMatchObject({
      schemaVersion: "ti.streaming_webhook_compatibility.v1",
      status: "contract_only_polling_remains_primary"
    });
    expect(sentinel.streamingWebhookInvariant.deliveryModes).toEqual(expect.arrayContaining(["sse", "webhook"]));
    expect(sentinel.streamingWebhookInvariant.eventTypes).toEqual(expect.arrayContaining([
      "run.status",
      "answer.delta",
      "evidence.promoted",
      "source.gap",
      "graph.review_hold",
      "restricted_metadata.hold",
      "error.retry_hint",
      "run.terminal"
    ]));
    expect(sentinel.streamingWebhookInvariant.pollingCompatibilityFields).toEqual(expect.arrayContaining([
      "runId",
      "status",
      "pollCursor",
      "deltaCursor",
      "refreshAfterSeconds",
      "updated",
      "warningCodes"
    ]));
    expect(sentinel.streamingWebhookInvariant.requiredHeaders).toEqual(expect.arrayContaining(["x-tenant-id", "x-actor-id"]));
    expect(sentinel.streamingWebhookInvariant.forbiddenPayloadFields).toEqual(expect.arrayContaining(["raw_body", "restricted_raw_url", "credential", "object_reference", "webhook_secret"]));
    expect(sentinel.streamingWebhookInvariant.failureBehavior).toMatchObject({ maxAttempts: 6 });
    expect(contract.publicWrapperCutoverReadiness).toMatchObject({
      schemaVersion: "ti.public_wrapper_cutover_readiness.v1",
      status: "watch_ready_polling_compatible"
    });
    expect(sentinel.publicWrapperCutoverInvariant).toMatchObject({
      schemaVersion: "ti.public_wrapper_cutover_readiness.v1",
      status: "watch_ready_polling_compatible",
      deprecationAlias: "POST /api/ti/search"
    });
    expect(sentinel.publicWrapperCutoverInvariant.requiredStableFields).toEqual(expect.arrayContaining([
      "status",
      "runId",
      "pollCursor",
      "deltaCursor",
      "refreshAfterSeconds",
      "updated",
      "publicTiAnswer",
      "publicWrapperDelta"
    ]));
    expect(sentinel.publicWrapperCutoverInvariant.bannedFallbackCodes).toEqual(expect.arrayContaining([
      "default_actor_fallback",
      "demo_copy",
      "stale_cache_copy",
      "unknown_ready_without_evidence"
    ]));
    expect(sentinel.publicWrapperCutoverInvariant.rollbackTriggers).toEqual(expect.arrayContaining([
      "default_actor_detected",
      "demo_copy_detected",
      "rate_limit_header_missing",
      "streaming_contract_drift"
    ]));
    expect(sentinel.publicWrapperCutoverInvariant.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:api-gateway",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(contract.realtimeDeliveryPrototype).toMatchObject({
      schemaVersion: "ti.realtime_delivery_prototype.v1",
      status: "disabled_by_default_polling_primary"
    });
    expect(sentinel.realtimeDeliveryPrototypeInvariant).toMatchObject({
      schemaVersion: "ti.realtime_delivery_prototype.v1",
      status: "disabled_by_default_polling_primary",
      enabledByDefault: false,
      pollingPrimary: true
    });
    expect(sentinel.realtimeDeliveryPrototypeInvariant.deliveryModes).toEqual(expect.arrayContaining(["sse", "webhook"]));
    expect(sentinel.realtimeDeliveryPrototypeInvariant.eventTypes).toEqual(expect.arrayContaining([
      "run.status",
      "answer.delta",
      "evidence.promoted",
      "source.gap",
      "graph.review_hold",
      "restricted_metadata.hold",
      "quality.caveat",
      "error.retry_hint",
      "run.terminal"
    ]));
    expect(sentinel.realtimeDeliveryPrototypeInvariant.requiredFields).toEqual(expect.arrayContaining([
      "eventId",
      "eventType",
      "runId",
      "tenantId",
      "pollCursor",
      "deltaCursor",
      "sequence",
      "createdAt"
    ]));
    expect(sentinel.realtimeDeliveryPrototypeInvariant.forbiddenPayloadFields).toEqual(expect.arrayContaining([
      "raw_body",
      "restricted_raw_url",
      "credential",
      "object_reference",
      "webhook_secret",
      "private_channel_material"
    ]));
    expect(sentinel.realtimeDeliveryPrototypeInvariant.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:api-regression",
      "bun run check:sdk-fixtures"
    ]));
    expect(sentinel.forbiddenChangeClasses).toEqual(expect.arrayContaining([
      "remove_stable_route",
      "rename_required_response_key",
      "change_error_envelope_shape",
      "remove_sdk_fixture",
      "make_streaming_required_for_polling_clients",
      "remove_streaming_replay_cursor",
      "remove_webhook_failure_state",
      "reintroduce_default_actor_fallback",
      "serve_demo_or_stale_cache_copy",
      "mark_unknown_query_ready_without_evidence",
      "add_raw_payload_example"
    ]));
    expect(sentinel.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:api-regression",
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "bun run check:sdk-fixtures"
    ]));
    expect(JSON.stringify(sentinel)).not.toMatch(/authorization:|cookie:|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value/i);
  });
});
