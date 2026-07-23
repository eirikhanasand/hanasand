// @ts-nocheck
import { nowIso } from "../utils.ts";
import type { CanaryActivationResult, CanaryDeactivationResult } from "./canaryCollectionTypes.ts";
import { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";

const MIN_PRODUCTIVITY_CHECKS = 10;
const CATALOG_PROFILES = new Set(["mitre_actor_catalog", "ransomware_operation_catalog"]);

export function reconcilePublicSourceProductivity(input: any) {
  const generatedAt = input.now ?? nowIso();
  const observations = input.store.listSourceHealthObservations?.() ?? [];
  const bySource = new Map<string, any[]>();
  for (const observation of observations) bySource.set(observation.sourceId, [...(bySource.get(observation.sourceId) ?? []), observation]);
  const retired: Array<{ sourceId: string; attemptCount: number; productiveCheckCount: number }> = [];

  for (const source of input.store.listSources()) {
    if (!["active", "canary", "probation", "degraded"].includes(source.status)
      || source.tenantId && source.tenantId !== "global"
      || source.accessMethod !== "public_http"
      || source.risk !== "low"
      || !(source.metadata?.canaryPortfolio === true || source.metadata?.verifiedSourceId || source.id.startsWith("src_seed_"))
      || source.metadata?.transportCanary === true
      || CATALOG_PROFILES.has(source.metadata?.extractionProfile)) continue;
    const history = [...(bySource.get(source.id) ?? [])].sort((left, right) => Date.parse(left.checkedAt) - Date.parse(right.checkedAt));
    const productiveCheckCount = history.filter((row) => Number(row.captureCount ?? 0) > 0).length;
    const monitoringWindowSeconds = Math.max(
      positiveNumber(source.metadata?.activityWindowSeconds, 30 * 86_400),
      positiveNumber(source.crawlFrequencySeconds, 86_400) * MIN_PRODUCTIVITY_CHECKS
    );
    const firstCheckAt = Date.parse(history[0]?.checkedAt), lastCheckAt = Date.parse(history.at(-1)?.checkedAt);
    const monitoringSpanSeconds = Number.isFinite(firstCheckAt) && Number.isFinite(lastCheckAt) ? Math.max(0, (lastCheckAt - firstCheckAt) / 1_000) : 0;
    // ponytail: one real activity window plus ten checks is the smallest fair retirement proof; explicit source metadata raises the window for slow publishers.
    if (history.length < MIN_PRODUCTIVITY_CHECKS || monitoringSpanSeconds < monitoringWindowSeconds || productiveCheckCount >= 2) continue;
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

export function pausePublicCanarySources(input: any): CanaryDeactivationResult {
  const generatedAt = input.now ?? nowIso(), operatorId = input.operatorId ?? "canary-operator", paused: any[] = [], alreadyInactive: string[] = [];
  for (const source of input.store.listSources().filter((s: any) => s.metadata?.canaryPortfolio)) {
    if (!["active", "degraded", "probation"].includes(source.status)) { alreadyInactive.push(source.id); continue; }
    const updated = { ...source, status: "paused", updatedAt: generatedAt, crawlState: { ...(source.crawlState ?? {}), nextEligibleAt: undefined } };
    input.store.saveSource(updated); paused.push({ sourceId: source.id, sourceName: source.name, from: source.status, to: "paused" });
  }
  return { generatedAt, operatorId, paused, alreadyInactive };
}
