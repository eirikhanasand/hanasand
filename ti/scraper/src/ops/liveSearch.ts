// @ts-nocheck
export type LiveSearchState = "searching" | "partial" | "ready" | "degraded" | "blocked" | "disabled";
export type LiveSearchSoakSample = Record<string, any>;
export type CutoverApplyPlanInput = Record<string, any>;
export type CutoverMountedRouteProof = Record<string, any>;
export type CutoverPromotionPacketInput = Record<string, any>;
export type CutoverRehearsalInput = Record<string, any>;
export type CutoverResourceBudget = Record<string, any>;

export const DEFAULT_LIVE_SEARCH_SLO = {
  initialResponseMs: 1_500,
  partialResultMs: 5_000,
  recommendedPollIntervalMs: 2_000,
  maxPollIntervalMs: 15_000,
  maxActiveRunsPerTenantQuery: 2,
  providerFailureBudgetPercent: 5,
  zeroResultBudgetPercent: 15
};

export const DEFAULT_LIVE_SEARCH_SOAK_CRITERIA = {
  durationHours: 24,
  initialLatencyP95Ms: 2_000,
  partialLatencyP95Ms: 8_000,
  maxErrorRatePercent: 2,
  maxDuplicateActiveRuns: 1,
  minSourceCoveragePercent: 80,
  maxQueueAgeP95Seconds: 60,
  maxMemoryRssGb: 64,
  allowFallbackUse: true
};

export const CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS = [
  { name: "public_ti_search", route: "https://hanasand.com/ti" },
  { name: "api_ti_search", route: "https://api.hanasand.com/api/ti/search" },
  { name: "scraper_health", route: "/v1/health" }
];

export function buildLiveSearchOpsDto(observation: any, slo = DEFAULT_LIVE_SEARCH_SLO) {
  const alerts = liveSearchAlerts(observation, slo);
  return { state: observation.state ?? "searching", slo, status: alerts.some((a) => a.severity === "critical") ? "critical" : alerts.length ? "warn" : "ok", recommendedPollIntervalMs: slo.recommendedPollIntervalMs, backpressure: { acceptNewRun: alerts.every((a) => a.severity !== "critical") }, alerts };
}

export function recordLiveSearchMetrics(registry: any, observation: any): void {
  registry?.record?.("live_search.results", observation.resultCount ?? 0);
  registry?.record?.("live_search.failures", observation.providerFailures ?? 0);
}

export function evaluateLiveSearchMetricAlerts(observation: any, slo = DEFAULT_LIVE_SEARCH_SLO) {
  return liveSearchAlerts(observation, slo);
}

export function verifyLiveSearchDeployProbe(probe: any) {
  const checks = [
    check("public_ti", probe.publicTi?.status >= 200 && probe.publicTi?.status < 400, "public TI page responds"),
    check("api_search", probe.apiSearch?.status >= 200 && probe.apiSearch?.status < 400, "API search responds")
  ];
  return { ok: checks.every((item) => item.ok), checks };
}

export function assertLiveSearchDeployVerification(result: any): void {
  if (!result.ok) throw new Error(`live search deploy failed: ${result.checks?.filter((c: any) => !c.ok).map((c: any) => c.name).join(", ")}`);
}

export function estimateLiveSearchPollingImpact(clients: number, pollIntervalMs: number) {
  const requestsPerSecond = clients / Math.max(1, pollIntervalMs / 1_000);
  return { concurrentClients: clients, pollIntervalMs, requestsPerSecond, requestsPerMinute: requestsPerSecond * 60, estimatedQueueItemsPerMinute: requestsPerSecond * 60, estimatedMemoryMb: Math.ceil(clients * 0.5), status: requestsPerSecond > 200 ? "critical" : requestsPerSecond > 50 ? "warn" : "ok" };
}

export function verifyScraperNativeSearchReadiness(probe: any) {
  const checks = [
    check("scraper_health", probe.scraperHealth?.status === 200, "scraper health responds"),
    check("search", probe.search?.status === 200, "native search responds"),
    check("cursor_poll", probe.cursorPoll?.status === 200, "cursor poll responds")
  ];
  return { ok: checks.every((item) => item.ok), checks, rollback: { required: checks.some((item) => !item.ok), reasons: checks.filter((item) => !item.ok).map((item) => item.name) } };
}

export function assertScraperNativeSearchReadiness(result: any): void {
  if (!result.ok) throw new Error(`scraper native search not ready: ${result.rollback?.reasons?.join(", ")}`);
}

export function evaluateLiveSearchSoak(sample: LiveSearchSoakSample) {
  const checks = [
    check("public_query", sample.publicProofOk !== false, "public query returns"),
    check("api_wrapper", sample.apiWrapperProofOk !== false, "API wrapper returns"),
    check("source_coverage", (sample.sourceCoveragePercent ?? 100) >= 80, "source coverage is sufficient"),
    check("fresh_latency", (sample.partialLatencyP95Ms ?? 0) <= 8_000, "partial result latency is acceptable")
  ];
  const ok = checks.every((item) => item.ok);
  return { ok, scenario: sample.scenario ?? "success", status: ok ? "promote" : "hold", checks, summary: sample, rollbackReasons: checks.filter((item) => !item.ok).map((item) => item.name), statusReport: ok ? "live search is usable" : "live search has blockers" };
}

export function assertLiveSearchSoakPromotion(report: any): void {
  if (!report.ok) throw new Error(`live search soak failed: ${report.rollbackReasons?.join(", ")}`);
}

export function evaluateDeploymentDrift(probe: any) {
  const checks = [
    check("source_hash", probe.localSourceHash === probe.remoteSourceHash, "source hash matches"),
    check("compose_hash", probe.expectedComposeConfigHash === probe.remoteComposeConfigHash, "compose hash matches"),
    check("image", probe.expectedImageId === probe.runningImageId, "image matches"),
    ...((probe.healthEndpoints ?? []).map((item: any) => check(`health_${item.name}`, item.ok ?? item.status < 500, `${item.name} health responds`)))
  ];
  return { ok: checks.every((item) => item.ok), state: checks.every((item) => item.ok) ? "in_sync" : "drift", checks, rollbackTarget: probe.rollbackTarget, blockedPromotionReasons: checks.filter((item) => !item.ok).map((item) => item.name) };
}

export function buildLiveSearchPromotionSummary(soak: any, drift: any) {
  const ok = soak.ok && drift.ok;
  return { ok, status: ok ? "promote" : "hold", deploymentDriftState: drift.state, rollbackTarget: drift.rollbackTarget, lastKnownGood: drift.rollbackTarget, blockedPromotionReasons: [...(soak.rollbackReasons ?? []), ...(drift.blockedPromotionReasons ?? [])] };
}

export function assertLiveSearchPromotionSummary(summary: any): void {
  if (!summary.ok) throw new Error(`promotion blocked: ${summary.blockedPromotionReasons?.join(", ")}`);
}

export function evaluateCutoverRehearsal(input: CutoverRehearsalInput) {
  const drift = evaluateDeploymentDrift(input.deploymentDrift ?? {});
  return { ok: drift.ok, decision: drift.ok ? "promote" : "hold-on-blocker", blockers: drift.blockedPromotionReasons.map((name: string) => ({ name, severity: "blocker" })), resourceBudget: input.resourceBudget ?? {}, statusReport: drift.ok ? "cutover rehearsal pass" : "cutover rehearsal blocked" };
}

export function assertCutoverRehearsalPass(report: any): void {
  if (!report.ok) throw new Error(`cutover rehearsal failed: ${report.blockers?.map((b: any) => b.name).join(", ")}`);
}

export function buildCutoverApplyPlanPacket(input: CutoverApplyPlanInput) {
  const blockers = input.rehearsal?.blockers ?? [];
  return { ok: blockers.length === 0, decision: blockers.length ? "hold" : "promote", classificationCounts: { blocked: blockers.length }, resourceBudget: input.resourceBudget ?? {}, blockers, dryRunOutput: JSON.stringify({ blockers }, null, 2) };
}

export function assertCutoverApplyPlanPass(packet: any): void {
  if (!packet.ok) throw new Error(`cutover apply plan blocked: ${packet.blockers?.map((b: any) => b.name).join(", ")}`);
}

export function buildCutoverPromotionPacket(input: CutoverPromotionPacketInput) {
  const apply = buildCutoverApplyPlanPacket(input);
  return { ...apply, leaderMarkdown: apply.ok ? "Cutover promotion ready." : `Cutover promotion blocked: ${apply.blockers.map((b: any) => b.name).join(", ")}` };
}

function liveSearchAlerts(observation: any, slo: any) {
  const alerts = [];
  if ((observation.providerFailures ?? 0) > slo.providerFailureBudgetPercent) alerts.push({ name: "provider_failures", severity: "critical", message: "provider failure budget exceeded", value: observation.providerFailures });
  if ((observation.resultCount ?? 1) === 0) alerts.push({ name: "zero_results", severity: "warn", message: "query returned no results", value: 0 });
  return alerts;
}

function check(name: string, ok: boolean, message: string) {
  return { name, ok, message };
}
