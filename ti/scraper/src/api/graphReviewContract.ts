export function graphReviewRouteContract(endpoint: string) {
  return {
    endpoint,
    method: "GET",
    mode: "dry_run",
    responseFields: ["contract", endpoint.includes("review") ? "reviewPlan" : endpoint.includes("cutover") ? "cutoverReport" : "readiness"],
    safeMetadataOnly: true
  };
}
