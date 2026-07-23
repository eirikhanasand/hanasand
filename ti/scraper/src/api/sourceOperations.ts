import { nowIso } from "../utils.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";
import { qualifySourcePortfolio } from "../ops/sourcePortfolioQualification.ts";
import { toSafeSourceDto } from "./sourceRoutes.ts";
import { inTenantScope } from "./tenantScope.ts";

export function buildSourceOperationsSnapshot(store: any, input: { tenantId?: string; generatedAt?: string; limit?: number; cursor?: number } = {}) {
  const generatedAt = input.generatedAt ?? nowIso();
  const inTenant = (record: any) => inTenantScope(record, input.tenantId);
  const sources = records(store, "listSources").filter(inTenant);
  const observations = records(store, "listSourceHealthObservations").filter(inTenant);
  const captures = records(store, "listCaptures").filter(inTenant);
  const entities = records(store, "listExtractedEntities").filter(inTenant);
  const labels = records(store, "listEvaluationLabels").filter(inTenant);
  const sourceIdsByLabel = labelSourceIndex(store, captures, input.tenantId);
  const observationsBySource = groupBySource(observations);
  const capturesBySource = groupBySource(captures);
  const entitiesBySource = groupBySource(entities);
  const labelCountsBySource = new Map<string, { falsePositive: number; classified: number }>();
  for (const label of labels) for (const sourceId of sourceIdsByLabel(label)) {
    const counts = labelCountsBySource.get(sourceId) ?? { falsePositive: 0, classified: 0 };
    if (label.outcome === "false_positive") counts.falsePositive += 1;
    if (["true_positive", "false_positive"].includes(label.outcome)) counts.classified += 1;
    labelCountsBySource.set(sourceId, counts);
  }
  const portfolio = qualifySourcePortfolio({ sources, observations, captures, generatedAt });
  const qualificationBySource = new Map(portfolio.sources.map((source) => [source.sourceId, source]));

  const rows = sources.map((source: any) => {
    const sourceObservations = [...(observationsBySource.get(source.id) ?? [])].sort(byTime("checkedAt"));
    const sourceCaptures = [...(capturesBySource.get(source.id) ?? [])].sort(byTime("collectedAt"));
    const latest = sourceObservations.at(-1);
    const successes = sourceObservations.filter((row: any) => row.success === true);
    const parserAttempts = successes;
    const parserSuccesses = parserAttempts.filter((row: any) => Number(row.parserWarningCount ?? 0) === 0);
    const lastFailure = sourceObservations.filter((row: any) => row.success === false).at(-1);
    const lastCapture = sourceCaptures.at(-1);
    const lastSuccessAt = timeOf(successes.at(-1), "checkedAt");
    const staleAfterSeconds = freshnessTargetSeconds(source);
    const stale = lastSuccessAt ? Date.parse(generatedAt) - Date.parse(lastSuccessAt) > staleAfterSeconds * 1_000 : false;
    const actors = unique((entitiesBySource.get(source.id) ?? [])
      .filter((entity: any) => ["actor", "ransomware_family"].includes(entity.type))
      .map((entity: any) => String(entity.normalizedValue ?? entity.value ?? "").trim())
      .filter(Boolean));
    const labelCounts = labelCountsBySource.get(source.id) ?? { falsePositive: 0, classified: 0 };
    const observedFalsePositiveRates = sourceObservations.map((row: any) => finiteRate(row.falsePositiveRate)).filter((value: number | undefined): value is number => value !== undefined);
    const falsePositiveRate = labelCounts.classified
      ? ratio(labelCounts.falsePositive, labelCounts.classified)
      : observedFalsePositiveRates.length
        ? ratio(observedFalsePositiveRates.reduce((sum: number, value: number) => sum + value, 0), observedFalsePositiveRates.length)
        : null;
    const qualification = qualificationBySource.get(source.id);
    const lastUsefulAt = qualification?.lastUsefulAt;
    const duplicateCount = sum(sourceObservations, "duplicateCount");
    const captureCount = sum(sourceObservations, "captureCount");

    const safeSource = toSafeSourceDto(source);
    return {
      ...safeSource,
      id: source.id,
      name: source.name,
      type: source.type,
      family: sourceFamily(source),
      lifecycleStatus: source.status,
      executable: isExecutableSource(source),
      operatingMode: {
        ...(safeSource as any).operatingMode,
        accessMethod: source.accessMethod,
        legalMode: source.governance?.metadataOnly || source.metadata?.captureMode === "metadata_only" ? "metadata_only" : "public_content",
        approvalState: source.governance?.approvalState ?? (source.approvedAt ? "approved" : "not_recorded"),
        policyVersion: source.governance?.policyVersion,
        risk: source.risk ?? "not_recorded"
      },
      health: {
        state: healthState(latest, stale),
        observationCount: sourceObservations.length,
        invalidTimestampCount: sourceObservations.filter((row: any) => !timeOf(row, "checkedAt")).length,
        lastAttemptAt: timeOf(latest, "checkedAt"),
        lastSuccessAt,
        lastUsefulItemAt: lastUsefulAt,
        lastFailureAt: timeOf(lastFailure, "checkedAt"),
        lastFailureCategory: lastFailure?.adapterFailureCategory,
        lastFailureReason: safeFailureReason(lastFailure?.failureReason),
        consecutiveFailures: consecutiveFailures(sourceObservations),
        collectionSuccessRate: ratio(successes.length, sourceObservations.length),
        usefulYieldRate: ratio(sourceObservations.filter((row: any) => Number(row.captureCount ?? 0) > 0).length, successes.length),
        freshnessLagSeconds: finiteNumber(latest?.freshnessLagSeconds),
        staleAfterSeconds
      },
      parser: {
        status: !parserAttempts.length ? "not_measured" : latest?.parserWarningCount ? "warnings" : "healthy",
        version: source.metadata?.parserVersion ?? lastCapture?.provenance?.extractorVersion,
        attemptCount: parserAttempts.length,
        successRate: ratio(parserSuccesses.length, parserAttempts.length),
        warningCount: sum(sourceObservations, "parserWarningCount")
      },
      quality: {
        falsePositiveRate,
        falsePositiveSampleSize: labelCounts.classified || observedFalsePositiveRates.length,
        falsePositiveBasis: labelCounts.classified ? "evaluation_labels" : observedFalsePositiveRates.length ? "source_observations" : "not_measured",
        duplicateRate: ratio(duplicateCount, captureCount + duplicateCount)
      },
      coverage: {
        observedActorCount: actors.length,
        observedActors: actors.slice(0, 50),
        captureCount: sourceCaptures.length,
        lastContentAt: qualification?.lastContentAt,
        usefulCheckCount: qualification?.usefulCheckCount ?? 0,
        sustainedProductive: (qualification?.usefulCheckCount ?? 0) >= 2 && sourceCaptures.length > 0
      },
      verification: {
        qualificationState: source.metadata?.sourcePortfolioQualificationState ?? source.metadata?.qualificationState,
        countsAsCoverage: source.metadata?.countsAsCoverage === true,
        authorityReportedItemCount: finiteNumber(source.metadata?.reportedVictimCount),
        directlyParsedItemCount: finiteNumber(source.metadata?.observedParsedItemCount),
        parserShape: source.metadata?.parserShape,
        verifiedAt: timeOf(source.metadata?.sourcePortfolioVerification, "verifiedAt")
      },
      qualification
    };
  }).sort((left: any, right: any) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const executableRows = rows.filter((row: any) => row.executable);
  const limit = Math.max(1, Math.min(500, Number(input.limit ?? 100) || 100));
  const cursor = Math.max(0, Number(input.cursor ?? 0) || 0);
  const page = rows.slice(cursor, cursor + limit);

  return {
    schemaVersion: "ti.source_operations.v1",
    generatedAt,
    tenantId: input.tenantId ?? "global",
    total: rows.length,
    nextCursor: cursor + page.length < rows.length ? String(cursor + page.length) : undefined,
    summary: {
      sourceCount: rows.length,
      retainedSourceCount: executableRows.length,
      inactiveSourceCount: rows.length - executableRows.length,
      retiredSourceCount: rows.filter((row: any) => row.lifecycleStatus === "retired").length,
      activeSourceCount: executableRows.length,
      observedSourceCount: executableRows.filter((row: any) => row.health.observationCount > 0).length,
      checkedSourceCount: executableRows.filter((row: any) => row.health.observationCount > 0).length,
      successfulSourceCount: executableRows.filter((row: any) => Boolean(row.health.lastSuccessAt)).length,
      usefulSourceCount: executableRows.filter((row: any) => row.qualification?.latestCheckUseful === true).length,
      latestUsefulSourceCount: executableRows.filter((row: any) => row.qualification?.latestCheckUseful === true).length,
      sustainedUsefulSourceCount: executableRows.filter((row: any) => row.coverage.sustainedProductive).length,
      checkedWithin24hSourceCount: executableRows.filter((row: any) => recent(row.health.lastAttemptAt, generatedAt)).length,
      successfulWithin24hSourceCount: executableRows.filter((row: any) => recent(row.health.lastSuccessAt, generatedAt)).length,
      usefulWithin24hSourceCount: executableRows.filter((row: any) => recent(row.health.lastUsefulItemAt, generatedAt)).length,
      captureProducingSourceCount: executableRows.filter((row: any) => row.coverage.captureCount > 0).length,
      recentlySeenSourceCount: executableRows.filter((row: any) => recent(row.coverage.lastContentAt, generatedAt)).length,
      backoffSourceCount: sources.filter((source: any) => isExecutableSource(source) && Date.parse(String(source.crawlState?.backoffUntil ?? "")) > Date.parse(generatedAt)).length,
      neverObservedSourceCount: executableRows.filter((row: any) => row.health.observationCount === 0).length,
      healthySourceCount: executableRows.filter((row: any) => row.health.state === "healthy").length,
      degradedSourceCount: executableRows.filter((row: any) => ["degraded", "stale"].includes(row.health.state)).length,
      failedSourceCount: executableRows.filter((row: any) => row.health.state === "failed").length,
      unobservedSourceCount: executableRows.filter((row: any) => row.health.state === "not_observed").length,
      falsePositiveMeasuredSourceCount: executableRows.filter((row: any) => row.quality.falsePositiveRate !== null).length
    },
    qualification: {
      schemaVersion: portfolio.schemaVersion,
      baseline: portfolio.baseline,
      counts: portfolio.counts,
      gaps: portfolio.gaps,
      baselineMet: portfolio.baselineMet
    },
    sources: page,
    safeOutput: { sourceUrlsExposed: false, rawCapturesExposed: false, restrictedPayloadsExposed: false }
  };
}

function recent(value: unknown, generatedAt: string) {
  const at = Date.parse(String(value ?? ""));
  return Number.isFinite(at) && Date.parse(generatedAt) - at <= 86_400_000;
}

function groupBySource(records: any[]) {
  const grouped = new Map<string, any[]>();
  for (const record of records) {
    const rows = grouped.get(record.sourceId);
    if (rows) rows.push(record);
    else grouped.set(record.sourceId, [record]);
  }
  return grouped;
}

function labelSourceIndex(store: any, captures: any[], tenantId?: string) {
  const captureById = new Map(captures.map((record: any) => [record.id, record]));
  const indexes = ["listExtractedEntities", "listIndicators", "listIncidents", "listIntelligenceClaims"]
    .flatMap((method) => records(store, method))
    .filter((record: any) => inTenantScope(record, tenantId));
  const subjectById = new Map(indexes.map((record: any) => [record.id, record]));
  return (label: any): string[] => {
    const subjectId = label.captureId ?? label.entityId ?? label.indicatorId ?? label.incidentId ?? label.claimId;
    const subject = captureById.get(subjectId) ?? subjectById.get(subjectId);
    const capture = subject?.captureId ? captureById.get(subject.captureId) : undefined;
    return unique([...(subject?.sourceIds ?? []), subject?.sourceId, capture?.sourceId].filter(Boolean).map(String));
  };
}

function sourceFamily(source: any): string {
  const configured = source.metadata?.sourceFamily ?? source.metadata?.sourceGrowthFamily;
  if (configured) return String(configured);
  if (source.type === "rss") return "rss";
  if (source.type === "telegram_public") return "telegram_public";
  if (["tor_metadata", "i2p_metadata"].includes(source.type)) return "darkweb_metadata";
  if (["static_web", "dynamic_web", "blog"].includes(source.type)) return "web";
  return String(source.type ?? "unknown");
}

function freshnessTargetSeconds(source: any): number {
  const configured = finiteNumber(source.catalog?.collection?.freshnessTargetSeconds);
  const crawl = finiteNumber(source.crawlFrequencySeconds) ?? (finiteNumber(source.crawlFrequencyMinutes) ?? 60) * 60;
  return Math.max(900, configured ?? crawl * 3);
}

function healthState(latest: any, stale: boolean): string {
  if (!latest) return "not_observed";
  if (latest.success === false) return "failed";
  if (stale) return "stale";
  return Number(latest.parserWarningCount ?? 0) > 0 || latest.status === "degraded" ? "degraded" : "healthy";
}

function consecutiveFailures(rows: any[]): number {
  let count = 0;
  for (let index = rows.length - 1; index >= 0 && rows[index]?.success === false; index--) count++;
  return count;
}

function safeFailureReason(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().slice(0, 500)
    .replace(/\b(?:https?|metadata):\/\/\S+/gi, "[redacted-url]")
    .replace(/\b[a-z2-7]{16,56}\.onion\b/gi, "[restricted-host]")
    .replace(/\b(password|token|secret|credential)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]");
}

function records(store: any, method: string): any[] { return typeof store?.[method] === "function" ? store[method]() : []; }
function byTime(field: string) { return (left: any, right: any) => (Date.parse(left?.[field] ?? "") || 0) - (Date.parse(right?.[field] ?? "") || 0); }
function timeOf(record: any, field: string): string | undefined { return record && Number.isFinite(Date.parse(record[field])) ? new Date(record[field]).toISOString() : undefined; }
function latestIso(...values: Array<string | undefined>): string | undefined { return values.filter(Boolean).sort().at(-1); }
function finiteNumber(value: unknown): number | undefined { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : undefined; }
function finiteRate(value: unknown): number | undefined { const number = Number(value); return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined; }
function ratio(numerator: number, denominator: number): number | null { return denominator > 0 ? Math.round(numerator / denominator * 10_000) / 10_000 : null; }
function sum(rows: any[], field: string): number { return rows.reduce((total, row) => total + (finiteNumber(row?.[field]) ?? 0), 0); }
function unique(values: string[]): string[] { return [...new Set(values)]; }
