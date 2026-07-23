// @ts-nocheck
import { nowIso } from "../utils.ts";
import type { CanaryActivationResult, CanaryDeactivationResult } from "./canaryCollectionTypes.ts";
import { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";
import { sourceMonitoringWindowSeconds } from "../policy/sourceActivityWindow.ts";

const MIN_PRODUCTIVITY_CHECKS = 10;
const CATALOG_PROFILES = new Set(["mitre_actor_catalog", "ransomware_operation_catalog"]);

export function reconcilePublicSourceProductivity(input: any) {
  const generatedAt = input.now ?? nowIso();
  const observations = input.store.listSourceHealthObservations?.() ?? [];
  const captures = input.store.listCaptures?.() ?? [];
  const bySource = new Map<string, any[]>();
  for (const observation of observations) bySource.set(observation.sourceId, [...(bySource.get(observation.sourceId) ?? []), observation]);
  const retired: Array<{ sourceId: string; attemptCount: number; productiveCheckCount: number }> = [];

  for (const source of input.store.listSources()) {
    const portfolioCandidate = governedPortfolioCandidate(source);
    if ((!["active", "canary", "probation", "degraded"].includes(source.status) && !portfolioCandidate)
      || !inProductivityScope(source, input.tenantId, input.includeSharedSources)
      || (!isExecutableSource(source) && !portfolioCandidate)
      || source.metadata?.transportCanary === true
      || CATALOG_PROFILES.has(source.metadata?.extractionProfile)) continue;
    const monitoringWindowSeconds = Math.max(
      sourceMonitoringWindowSeconds(source),
      positiveNumber(source.crawlFrequencySeconds, 86_400) * MIN_PRODUCTIVITY_CHECKS
    );
    const now = Date.parse(generatedAt), cadenceSeconds = positiveNumber(source.crawlFrequencySeconds, 86_400);
    const windowStart = now - monitoringWindowSeconds * 1_000;
    const history = summarizeScheduledCycles((bySource.get(source.id) ?? [])
      .filter((row) => {
        const checkedAt = Date.parse(row.checkedAt);
        return row.tenantId === source.tenantId
          && typeof row.collectionRunId === "string" && row.collectionRunId.trim()
          && Number.isFinite(checkedAt) && checkedAt >= windowStart && checkedAt <= now;
      }));
    const retainedRunIds = new Set(captures
      .filter((capture: any) => capture.sourceId === source.id && capture.tenantId === source.tenantId)
      .map((capture: any) => String(capture.metadata?.runId ?? ""))
      .filter(Boolean));
    const productiveCheckCount = history.filter((row) => row.success === true
      && row.useful === true
      && Number(row.captureCount ?? 0) > 0
      && retainedRunIds.has(row.collectionRunId)).length;
    const fullWindowObserved = Date.parse(history[0]?.checkedAt) <= windowStart + cadenceSeconds * 1_000;
    // ponytail: one real activity window plus ten checks is the smallest fair retirement proof; explicit source metadata raises the window for slow publishers.
    if (history.length < MIN_PRODUCTIVITY_CHECKS || !fullWindowObserved || productiveCheckCount >= 2) continue;
    input.store.saveSource({
      ...source,
      status: "retired",
      updatedAt: generatedAt,
      metadata: {
        ...(source.metadata ?? {}),
        sourcePortfolioStatus: "retired_unproductive",
        sourcePortfolioRetiredAt: generatedAt,
        sourcePortfolioAttemptCount: history.length,
        sourcePortfolioProductiveCheckCount: productiveCheckCount,
        sourcePortfolioMonitoringWindowSeconds: monitoringWindowSeconds,
        sourcePortfolioRetirementReason: "fewer than two capture-producing scheduled checks across the publishing activity window"
      },
      crawlState: { ...(source.crawlState ?? {}), nextEligibleAt: undefined, backoffUntil: undefined }
    });
    retired.push({ sourceId: source.id, attemptCount: history.length, productiveCheckCount });
  }
  return { generatedAt, retired };
}

function governedPortfolioCandidate(source: any) {
  return source.status === "candidate"
    && source.metadata?.productionCollection === false
    && source.metadata?.sourcePortfolioExcluded !== true
    && source.metadata?.sourcePortfolioVerification?.outcome === "content_parsed"
    && source.accessMethod === "public_http"
    && source.risk === "low"
    && source.governance?.approvalState === "approved"
    && ["rss", "api", "json_api", "telegram_public"].includes(source.type);
}

function inProductivityScope(source: any, tenantId?: string, includeSharedSources = true) {
  const sourceTenantId = String(source.tenantId ?? "").trim() || undefined;
  const shared = sourceTenantId === undefined || sourceTenantId === "global";
  return tenantId ? sourceTenantId === tenantId || includeSharedSources && shared : shared;
}

export function activatePublicCanarySources(input: any): CanaryActivationResult {
  const generatedAt = input.now ?? nowIso(), operatorId = input.operatorId ?? "canary-operator";
  const activated: any[] = [], alreadyActive: string[] = [], rejected: any[] = [];
  for (const source of input.portfolio ?? PUBLIC_CANARY_SOURCE_PORTFOLIO) {
    const existing = input.store.getSource?.(source.id);
    const canonical = input.store.listSources().find((record: any) => record.id !== source.id && canonicalFeedKey(record.url) === canonicalFeedKey(source.url));
    if (canonical) { alreadyActive.push(canonical.id); continue; }
    if (["retired", "rejected", "disabled"].includes(existing?.status)) { rejected.push({ sourceId: source.id, reason: `source is ${existing.status}` }); continue; }
    const next = { ...(existing ?? source), tenantId: input.tenantId ?? source.tenantId, status: "active", approvedAt: existing?.approvedAt ?? generatedAt, approvedBy: existing?.approvedBy ?? operatorId, updatedAt: generatedAt, metadata: { ...(existing?.metadata ?? source.metadata), canaryPortfolio: true } };
    if (!/^https?:\/\//.test(next.url)) { rejected.push({ sourceId: next.id, reason: "public http(s) only" }); continue; }
    if (existing?.status === "active") { alreadyActive.push(next.id); continue; }
    input.store.saveSource(next);
    activated.push({ sourceId: next.id, sourceName: next.name, from: existing?.status ?? source.status, to: "active" });
  }
  return { generatedAt, operatorId, activated, alreadyActive, rejected };
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function summarizeScheduledCycles(rows: any[]) {
  const byRun = new Map<string, any>();
  for (const row of rows) {
    const previous = byRun.get(row.collectionRunId);
    byRun.set(row.collectionRunId, previous ? {
      ...row,
      checkedAt: Date.parse(row.checkedAt) >= Date.parse(previous.checkedAt) ? row.checkedAt : previous.checkedAt,
      success: previous.success === true || row.success === true,
      useful: previous.useful === true || row.useful === true,
      captureCount: Number(previous.captureCount ?? 0) + Number(row.captureCount ?? 0)
    } : row);
  }
  return [...byRun.values()].sort((left, right) => Date.parse(left.checkedAt) - Date.parse(right.checkedAt));
}

export function pausePublicCanarySources(input: any): CanaryDeactivationResult {
  const generatedAt = input.now ?? nowIso(), operatorId = input.operatorId ?? "canary-operator", paused: any[] = [], alreadyInactive: string[] = [];
  for (const source of input.store.listSources().filter((s: any) => s.metadata?.canaryPortfolio)) {
    if (!["active", "degraded", "probation"].includes(source.status)) { alreadyInactive.push(source.id); continue; }
    const updated = { ...source, status: "paused", updatedAt: generatedAt, crawlState: { ...(source.crawlState ?? {}), nextEligibleAt: undefined } };
    input.store.saveSource(updated); paused.push({ sourceId: source.id, sourceName: source.name, from: source.status, to: "paused" });
  }
  return { generatedAt, operatorId, paused, alreadyInactive };
}
