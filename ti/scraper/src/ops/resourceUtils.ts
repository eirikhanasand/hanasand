import type { ResourceStatus } from "./resourceTypes.ts";

export function statusForRatio(ratio: number): ResourceStatus {
  if (ratio >= 1) return "critical";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

export function bytesToMb(value: number): number {
  return Math.round(value / 1024 / 1024);
}
