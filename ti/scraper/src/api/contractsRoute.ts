export function contractIndex() {
  const routes = ["/v1/health", "/v1/intel/search", "/api/ti/search", "/v1/intel/runs", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/sources", "/v1/sources/atlas", "/v1/quality/evaluate", "/v1/ops/product-slo", "/v1/contracts"];
  return {
    endpoint: "/v1/contracts",
    schemaVersion: "ti.api_contract_index.compact.v3",
    routeInventory: { count: routes.length, routes: routes.map((path) => ({ method: path.includes("runs") ? "POST" : "GET", path })) },
    semantics: { safeMetadataOnly: true, noCredentialCollection: true, noThreatActorInteraction: true },
    publicCompatibility: { canonicalSearchRoute: "/api/ti/search", unknownQueryCopy: "searching", noDefaultActor: true }
  };
}
