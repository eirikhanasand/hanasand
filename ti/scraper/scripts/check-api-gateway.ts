import { handleApiRequest } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const forbiddenPattern = /authorization:|cookie:|bearer_token_value|password_value|raw_body_value|restricted_raw_url_value|object_key_value|credential_value|leaked_row_value/i;

const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
  store: new InMemoryScraperStore(),
  frontier: new FocusedFrontier()
});
const json = await response.json();
const contract = isRecord(json) ? json : {};
const gateway = isRecord(contract.apiGatewayIntegration) ? contract.apiGatewayIntegration : {};
const trustedBoundary = isRecord(gateway.trustedBoundary) ? gateway.trustedBoundary : {};
const routeMapping = isRecord(gateway.routeMapping) ? gateway.routeMapping : {};
const publicWrapper = isRecord(routeMapping.canonicalPublicWrapper) ? routeMapping.canonicalPublicWrapper : {};
const tenantPropagation = isRecord(gateway.tenantPropagation) ? gateway.tenantPropagation : {};
const rateLimitPlan = isRecord(gateway.rateLimitPlan) ? gateway.rateLimitPlan : {};
const rollbackPlan = isRecord(gateway.rollbackPlan) ? gateway.rollbackPlan : {};
const stages = Array.isArray(gateway.cutoverStages) ? gateway.cutoverStages.filter(isRecord) : [];
const failures: string[] = [];

const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

check(response.status === 200, "contracts endpoint must return HTTP 200");
check(gateway.schemaVersion === "ti.api_gateway_integration.v1", "gateway schemaVersion drifted");
check(gateway.status === "deployment_plan_ready", "gateway status drifted");
check(trustedBoundary.gatewayOwnsAuthnAuthz === true, "gateway must own authn/authz");
check(trustedBoundary.scraperStoresSecrets === false, "scraper must not store gateway secrets");
check(stringArray(trustedBoundary.requiredForwardedHeaders).includes("x-tenant-id"), "missing tenant forwarded header");
check(stringArray(trustedBoundary.requiredForwardedHeaders).includes("x-actor-id"), "missing requester forwarded header");
check(trustedBoundary.serviceTokenContextHeader === "x-service-token-context", "service token context header drifted");
check(publicWrapper.external === "POST /api/ti/search", "public wrapper external route drifted");
check(publicWrapper.internal === "GET /v1/intel/search", "public wrapper internal mapping drifted");
check(stringArray(routeMapping.publicRoutes).includes("POST /api/ti/search"), "public wrapper route missing");
check(stringArray(routeMapping.adminRoutes).includes("POST /v1/restricted-metadata/apply-plan"), "restricted admin route missing");
check(tenantPropagation.requiredHeader === "x-tenant-id", "tenant propagation header drifted");
check(tenantPropagation.requesterHeader === "x-actor-id", "requester propagation header drifted");
check(tenantPropagation.crossTenantFailureCode === "not_found", "cross-tenant failure code drifted");
check(rateLimitPlan.gatewayEnforced === true, "rate limits must be gateway-enforced");
check(stringArray(rateLimitPlan.responseHeaders).includes("retry-after"), "gateway retry-after header missing");
check(stringArray(rateLimitPlan.responseHeaders).includes("x-rate-limit-policy"), "gateway rate-limit policy header missing");
for (const stage of ["shadow_headers", "public_wrapper_shadow", "canary_public_wrapper", "versioned_api_clients"]) {
  check(stages.some((entry) => entry.name === stage), `cutover stage missing ${stage}`);
}
for (const trigger of ["missing_forwarded_identity", "tenant_boundary_failure", "public_wrapper_post_failure", "raw_material_leak"]) {
  check(stringArray(rollbackPlan.triggers).includes(trigger), `rollback trigger missing ${trigger}`);
}
check(stringArray(gateway.proofCommands).includes("bun run check:api-gateway"), "gateway proof command missing");
check(stringArray(gateway.proofCommands).includes("bun run check:api-regression"), "api regression proof command missing");
check(!forbiddenPattern.test(JSON.stringify(gateway)), "gateway contract contains unsafe material");

const ok = failures.length === 0;
console.log(JSON.stringify({
  event: "api_gateway_integration.check",
  ok,
  schemaVersion: String(gateway.schemaVersion ?? ""),
  cutoverStageCount: stages.length,
  publicWrapper,
  requiredForwardedHeaders: stringArray(trustedBoundary.requiredForwardedHeaders),
  proofCommands: stringArray(gateway.proofCommands),
  failures
}));

if (!ok) {
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
