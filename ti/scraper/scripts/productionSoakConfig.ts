import type { QuerySample } from "./productionSoakTypes.ts";
import { unique } from "./productionSoakUtils.ts";

export function numberEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function querySet(): string[] {
  const base = (process.env.TI_SOAK_QUERIES ?? "APT29,Scattered Spider,Volt Typhoon,Turla,Akira")
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);
  const random = process.env.TI_SOAK_RANDOM_QUERY?.trim();
  return unique(random ? [...base, random] : base);
}

export function delta(previous: QuerySample["status"] | undefined, current: QuerySample["status"]): QuerySample["pollDelta"] {
  if (!previous) return "new";
  if (previous === "partial" && current === "ready") return "partial_to_ready";
  if (previous === "ready" && current === "partial") return "ready_to_partial";
  if (previous !== current) return "changed";
  return "none";
}
