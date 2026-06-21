import type { ScraperRuntimeConfig } from "./configTypes.ts";

export function numberEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric env value: ${value}`);
  return parsed;
}

export function integerEnv(value: string | undefined, fallback: number): number {
  return Math.floor(numberEnv(value, fallback));
}

export function booleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

export function parseEnv(value: string | undefined): ScraperRuntimeConfig["env"] {
  return value === "production" || value === "test" ? value : "development";
}

export function parseLogLevel(value: string | undefined): ScraperRuntimeConfig["logLevel"] {
  return value === "debug" || value === "warn" || value === "error" ? value : "info";
}

export function parseDeploymentTarget(value: string | undefined): ScraperRuntimeConfig["deploymentTarget"] {
  return value === "inspur" || value === "other" ? value : "local";
}
