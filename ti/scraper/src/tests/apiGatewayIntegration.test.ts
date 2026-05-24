import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("api gateway integration contract", () => {
  test("publishes gateway cutover auth routing rate-limit and rollback invariants", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as {
      apiGatewayIntegration: {
        schemaVersion: string;
        status: string;
        trustedBoundary: {
          gatewayOwnsAuthnAuthz: boolean;
          scraperStoresSecrets: boolean;
          requiredForwardedHeaders: string[];
          optionalForwardedHeaders: string[];
          serviceTokenContextHeader: string;
          requiredScopesByRoute: Array<{ route: string; scopes: string[]; failClosedCode: string }>;
        };
        routeMapping: {
          canonicalPublicWrapper: { external: string; internal: string; methodBoundary: string };
          canonicalVersionedPrefix: string;
          publicRoutes: string[];
          analystRoutes: string[];
          adminRoutes: string[];
          rollbackAlias: { route: string; fallbackBehavior: string };
        };
        tenantPropagation: {
          requiredHeader: string;
          requesterHeader: string;
          requestIdHeader: string;
          traceHeader: string;
          crossTenantFailureCode: string;
          auditFields: string[];
        };
        rateLimitPlan: {
          gatewayEnforced: boolean;
          responseHeaders: string[];
          perRouteHints: Array<{ route: string; policy: string; retryAfterSeconds: number }>;
        };
        cutoverStages: Array<{ name: string; decision: string; requiredProof: string; rollback: string }>;
        rollbackPlan: { triggers: string[]; safeActions: string[]; nonActions: string[] };
        proofCommands: string[];
        noLeakGuarantee: string;
      };
      semantics: { apiGatewayIntegration: unknown };
      validation: { apiGateway: string };
    };
    const gateway = contract.apiGatewayIntegration;

    expect(gateway).toMatchObject({
      schemaVersion: "ti.api_gateway_integration.v1",
      status: "deployment_plan_ready",
      trustedBoundary: {
        gatewayOwnsAuthnAuthz: true,
        scraperStoresSecrets: false,
        serviceTokenContextHeader: "x-service-token-context"
      },
      routeMapping: {
        canonicalPublicWrapper: {
          external: "POST /api/ti/search",
          internal: "GET /v1/intel/search"
        },
        canonicalVersionedPrefix: "/v1"
      },
      tenantPropagation: {
        requiredHeader: "x-tenant-id",
        requesterHeader: "x-actor-id",
        crossTenantFailureCode: "not_found"
      },
      rateLimitPlan: {
        gatewayEnforced: true
      }
    });
    expect(contract.semantics.apiGatewayIntegration).toEqual(gateway);
    expect(contract.validation.apiGateway).toBe("bun run check:api-gateway");
    expect(gateway.trustedBoundary.requiredForwardedHeaders).toEqual(expect.arrayContaining(["x-tenant-id", "x-actor-id"]));
    expect(gateway.trustedBoundary.optionalForwardedHeaders).toEqual(expect.arrayContaining(["x-request-id", "x-trace-id", "x-client-id"]));
    expect(gateway.trustedBoundary.requiredScopesByRoute).toEqual(expect.arrayContaining([
      expect.objectContaining({ route: "GET /v1/intel/search", scopes: expect.arrayContaining(["intel:read"]) }),
      expect.objectContaining({ route: "POST /v1/intel/runs", scopes: expect.arrayContaining(["intel:run"]) }),
      expect.objectContaining({ route: "POST /v1/sources/*", scopes: expect.arrayContaining(["sources:write", "scraper:admin"]) })
    ]));
    expect(gateway.routeMapping.publicRoutes).toEqual(expect.arrayContaining(["POST /api/ti/search", "GET /v1/contracts"]));
    expect(gateway.routeMapping.adminRoutes).toEqual(expect.arrayContaining(["POST /v1/restricted-metadata/apply-plan"]));
    expect(gateway.tenantPropagation.auditFields).toEqual(expect.arrayContaining(["tenantId", "requesterId", "requestId", "traceId", "route", "method", "decision"]));
    expect(gateway.rateLimitPlan.responseHeaders).toEqual(expect.arrayContaining(["retry-after", "x-rate-limit-policy", "x-request-id"]));
    expect(gateway.rateLimitPlan.perRouteHints.map((hint) => hint.route)).toEqual(expect.arrayContaining([
      "GET /v1/intel/search",
      "POST /api/ti/search",
      "POST /v1/intel/runs"
    ]));
    expect(gateway.cutoverStages.map((stage) => stage.name)).toEqual(expect.arrayContaining([
      "shadow_headers",
      "public_wrapper_shadow",
      "canary_public_wrapper",
      "versioned_api_clients"
    ]));
    expect(gateway.rollbackPlan.triggers).toEqual(expect.arrayContaining([
      "missing_forwarded_identity",
      "tenant_boundary_failure",
      "public_wrapper_post_failure",
      "raw_material_leak"
    ]));
    expect(gateway.rollbackPlan.safeActions).toEqual(expect.arrayContaining([
      "preserve last safe public answer",
      "restore compatibility wrapper",
      "hold SDK release"
    ]));
    expect(gateway.rollbackPlan.nonActions).toEqual(expect.arrayContaining([
      "do not bypass tenant checks",
      "do not expose token material",
      "do not serve raw evidence"
    ]));
    expect(gateway.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:api-gateway",
      "bun run check:api-regression",
      "bun run check:contract-index"
    ]));
    expect(JSON.stringify(gateway)).not.toMatch(/authorization:|cookie:|bearer_token_value|raw_body_value|restricted_raw_url_value|object_key_value|leaked_row_value/i);
  });
});
