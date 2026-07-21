export function buildEndpoint(baseUrl: string): URL {
  return new URL("/v1/ops/product-slo", normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
