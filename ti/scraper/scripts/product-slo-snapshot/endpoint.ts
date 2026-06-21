import type { LiveProductProofMode } from "../../src/ops/productSlo.ts";
import { envParams } from "./envParams.ts";

export function buildEndpoint(
  baseUrl: string,
  proofMode: LiveProductProofMode,
  generatedAt: string,
  snapshotPath: string
): URL {
  const url = new URL("/v1/ops/product-slo", normalizeBaseUrl(baseUrl));
  url.searchParams.set("proofMode", proofMode);
  url.searchParams.set("generatedAt", generatedAt);
  url.searchParams.set("snapshotStoragePath", snapshotPath);
  for (const [param, envKey] of envParams) copyEnvParam(url, param, envKey);
  return url;
}

export function proofModeFromEnv(value: string): LiveProductProofMode {
  if (value === "fixture" || value === "local" || value === "inspur" || value === "public_live") return value;
  throw new Error(`Invalid TI_PRODUCT_SLO_PROOF_MODE: ${value}`);
}

function copyEnvParam(url: URL, param: string, envKey: string): void {
  const value = process.env[envKey]?.trim();
  if (value) url.searchParams.set(param, value);
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
