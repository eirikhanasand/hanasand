// @ts-nocheck
import type { LiveSearchSoakSample } from "./liveSearchTypes.ts";
import { check } from "./liveSearchCheck.ts";

export function evaluateLiveSearchSoak(sample: LiveSearchSoakSample) {
  const checks = [
    check("public_query", sample.publicProofOk !== false, "public query returns"),
    check("api_wrapper", sample.apiWrapperProofOk !== false, "API wrapper returns"),
    check("source_coverage", (sample.sourceCoveragePercent ?? 100) >= 80, "source coverage is sufficient"),
    check("fresh_latency", (sample.partialLatencyP95Ms ?? 0) <= 8_000, "partial result latency is acceptable")
  ];
  const ok = checks.every((item) => item.ok);
  return {
    ok,
    scenario: sample.scenario ?? "success",
    status: ok ? "promote" : "hold",
    checks,
    summary: sample,
    rollbackReasons: checks.filter((item) => !item.ok).map((item) => item.name),
    statusReport: ok ? "live search is usable" : "live search has blockers"
  };
}

export function assertLiveSearchSoakPromotion(report: any): void {
  if (!report.ok) throw new Error(`live search soak failed: ${report.rollbackReasons?.join(", ")}`);
}
