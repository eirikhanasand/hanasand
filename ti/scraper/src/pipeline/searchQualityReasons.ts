import type { SearchQualityStatus } from "./searchQualityTypes.ts";

export const unique = <T extends string>(v: T[]) => [...new Set(v.filter(Boolean))];
export const ratio = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100) / 100;

export const reason = (s: SearchQualityStatus) => ({
  ready: "evidence is sufficiently captured and confident for ranked intelligence",
  partial: "result includes partial or caveated evidence",
  "weak-evidence": "evidence volume or confidence is weak",
  "needs-review": "analyst review is required before promotion",
  contradicted: "contradicted attribution or relationship signal is present",
  stale: "stale source or graph state is present",
  "source-biased": "source family coverage is narrow or biased",
  "insufficient-capture": "captured-page or reviewed evidence is insufficient"
}[s]);
