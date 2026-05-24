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

const checks = [
  response.status === 200,
  record.endpoint === "/v1/contracts",
  routeTruthAudit.schemaVersion === "ti.route_truth_audit.v1",
  routeTruthAudit.expectedRouteInventoryCount === routes.length,
  routes.some((route) => route.method === "POST" && route.path === "/v1/sources/coverage-closeout"),
  routes.some((route) => route.method === "POST" && route.path === "/v1/sources/activation-batches"),
  auditFixtures.some((fixture) => fixture.name === "route_inventory_drift"),
  auditFixtures.some((fixture) => fixture.name === "missing_schema_examples"),
  auditFixtures.some((fixture) => fixture.name === "public_post_compatibility"),
  auditFixtures.some((fixture) => fixture.name === "restricted_emergency_stop"),
  auditFixtures.some((fixture) => fixture.name === "canary_rc_decision"),
  auditFixtures.every((fixture) => fixture.publicPostCompatible === true && fixture.noLeakRequired === true),
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
  expectedOutput: "ok=true; /v1/contracts indexes route truth audit, source activation, and evidence persistence certification without unsafe leaks"
}, null, 2));

if (!ok) process.exit(1);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
