import type { ApiServerOptions } from "./serverTypes.ts";
import { error, json, numberQuery, readJson } from "./http.ts";
import { nowIso, stableId } from "../utils.ts";
import { findSearchCaptures } from "./searchCaptureIndex.ts";
import { isMetadataOnlyCapture, rowFromCapture } from "./searchRows.ts";
import { resolveTenantScope } from "./tenantScope.ts";
import { sanitizeDwmApiPayload, sanitizeDwmCustomerText } from "../product/dwmCustomerDisplay.ts";
import { createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { buildPublicChannelStatusRouteResponse } from "./publicChannelRoutes.ts";
import { searchDarkwebIndex } from "../adapters/darkwebIndex.ts";

export async function searchResponse(request: Request, options: ApiServerOptions, url: URL): Promise<Response> {
  const body: any = request.method === "POST" ? await readJson(request) : {};
  const scope = resolveTenantScope(request, url, body.tenantId);
  if (scope.error) return scope.error;
  const query = String(body.q ?? body.query ?? url.searchParams.get("q") ?? "").trim();
  if (!query || query.length > 300) return error("invalid_search_query", "Search query must contain 1-300 characters", 400);

  const generatedAt = nowIso();
  const entityType = String(body.entityType ?? url.searchParams.get("entityType") ?? "actor");
  const sourcesInScope = options.store.listSources().filter((source: any) => !source.tenantId || source.tenantId === scope.tenantId);
  const liveSearch = createLiveSearchPlan({
    request: { query, entityType, tenantId: scope.tenantId, createdAt: generatedAt },
    sources: sourcesInScope,
    frontier: options.frontier,
    activeRuns: options.store.listRuns?.() ?? [],
    activePlans: options.store.listPlans?.() ?? [],
    queuePressureLimit: Number(options.liveSearchQueuePressureLimit ?? 50),
  });
  const publicChannelResult = buildPublicChannelStatusRouteResponse(
    { query, entityType, tenantId: scope.tenantId },
    { store: options.store, publicTelegramSourcePacks: options.publicTelegramSourcePacks as any, generatedAt },
  );
  const limit = Math.max(1, Math.min(numberQuery(url.searchParams.get("limit")) ?? 50, 100));
  const captures = findSearchCaptures(options.store, query, limit * 3, scope.tenantId);
  const rows = dedupeRows(captures.map((capture: any) => rowFromCapture(capture, scopedSource(options.store.getSource?.(capture.sourceId), scope.tenantId)))).slice(0, limit);
  const captureIds = new Set(rows.map((row) => row.id));
  const sourceIds = new Set(rows.map((row) => row.sourceId));
  const records = searchRecords(options.store, scope.tenantId, captureIds, sourceIds);
  const assessment = assess(rows, records);
  const lastSeen = latest(rows.map((row) => row.publishedAt ?? row.collectedAt)) ?? generatedAt;
  const aliases = actorAliases(records, rows);
  const recentActivity = rows.map((row) => activity(row, records, assessment.confidence));
  const sources = uniqueBy(rows.map((row) => ({
    id: row.sourceId,
    name: row.sourceName,
    type: row.sourceFamily ?? "source_capture",
    provenance: row.url ?? row.sourceName,
    url: row.url,
    captureId: row.id,
    sourceFamily: row.sourceFamily,
    reportDate: row.publishedAt,
    lastCollectedAt: row.collectedAt
  })), (source) => source.id);
  const structuredProvenance = rows.map((row) => ({
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    provenance: row.url ?? row.sourceName,
    reportDate: row.publishedAt ?? row.collectedAt,
    captureId: row.id,
    sourceFamily: row.sourceFamily ?? "source_capture",
    parserStatus: hasParsedRecord(row.id, records) ? "parsed" : "partial",
    lastCollectedAt: row.collectedAt,
    confidence: rowConfidence(row.id, records, assessment.confidence),
    shownBecause: `${row.sourceName} contains captured evidence matching ${query}.`
  }));
  const sectors = entityValues(records.entities, "sector");
  const countries = entityValues(records.entities, "country");
  const victims = unique([...entityValues(records.entities, "victim"), ...rows.map((row) => row.victimName)]);
  const actor = records.profiles[0]?.canonicalName ?? entityValues(records.entities, "actor")[0] ?? rows.map((row) => row.actor).find(Boolean);
  const campaigns = unique(records.incidents.map((incident) => safeText(incident.title ?? incident.summary, 180)));
  const malwareTools = entityValues(records.entities, "malware");
  const indicators = safeIndicators(records.indicators);
  const infrastructure = safeIndicators(records.indicators.filter((indicator) => ["domain", "hostname", "ipv4", "ipv6", "url"].includes(indicator.type)));
  const ttps = records.entities.filter((entity) => entity.type === "ttp").map((entity) => ({
    name: safeText(entity.value, 160),
    attackId: typeof entity.attackId === "string" ? entity.attackId : undefined,
    tactic: safeText(entity.tactic, 80) || "Unmapped",
    detail: `Extracted ${entity.assertionKind ?? "mention"} from capture ${entity.captureId}.`,
    confidence: confidence(entity.confidence),
    sourceIds: [entity.sourceId].filter(Boolean),
    captureIds: [entity.captureId].filter(Boolean),
    reviewState: entity.reviewReasons?.length ? "needs_review" : "unreviewed"
  }));
  const summary = searchSummary(query, rows.length, assessment);
  const watchlistCandidates = unique([
    ...victims,
    ...records.indicators.filter((indicator) => indicator.type === "domain").map((indicator) => indicator.value)
  ]).map((value) => ({
    kind: /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(value) ? "domain" : "company",
    value,
    reason: "Extracted from captured public-intelligence evidence; analyst confirmation is required before alerting.",
    confidence: Math.min(assessment.confidence, 0.69)
  }));
  const missing = missingFields({ actor, victims, sectors, countries, ttps, records, rows });
  const actorIntelligence = {
    actorClass: records.profiles[0]?.actorType ?? (actor ? "observed_threat_actor" : "unclassified_query"),
    attribution: undefined,
    firstSeen: records.profiles[0]?.firstSeenAt ?? earliest(rows.map((row) => row.publishedAt ?? row.collectedAt)) ?? generatedAt,
    lastSeen,
    motivation: entityValues(records.entities, "motivation"),
    malwareTools,
    campaigns,
    infrastructure,
    indicators,
    targetSectors: sectors,
    geographies: countries,
    confidence: assessment.confidence,
    confidenceReasoning: assessment.reasons,
    sourceProvenance: sources.map((source) => source.provenance),
    structuredProvenance,
    missingFields: missing
  };
  const claims = records.claims.map((claim) => ({
    id: claim.id,
    claimType: claim.claimType,
    value: sanitizeDwmApiPayload(claim.value),
    summary: safeText(claim.summary, 500),
    confidence: confidence(claim.confidence),
    reviewState: claim.reviewState ?? "unreviewed",
    corroborationState: claim.corroborationState ?? "single_source",
    sourceCount: Number(claim.sourceCount ?? claim.sourceIds?.length ?? 0),
    evidenceCount: Number(claim.evidenceCount ?? claim.captureIds?.length ?? 0),
    evidenceStage: claim.evidenceStage,
    extractionMethod: claim.extractionMethod,
    extractorVersion: claim.extractorVersion,
    firstSeenAt: claim.firstSeenAt,
    lastSeenAt: claim.lastSeenAt,
    uncertaintyReasons: claim.uncertaintyReasons ?? []
  }));
  const incidents = records.incidents.map((incident) => ({
    id: incident.id,
    title: safeText(incident.title, 180),
    summary: safeText(incident.summary, 500),
    confidence: confidence(incident.confidence),
    assertionKind: "inferred",
    reviewState: incident.reviewReasons?.length ? "needs_review" : "unreviewed",
    firstSeenAt: incident.firstSeenAt,
    sourceId: incident.sourceId,
    captureId: incident.captureId,
    extractorVersion: incident.extractorVersion,
    reviewReasons: incident.reviewReasons ?? []
  }));
  const status = rows.length ? assessment.ready ? "ready" : "partial" : "searching";
  const restricted = searchDarkwebIndex({ query, sources: sourcesInScope, captures: options.store.listCaptures(), limit: 20 });
  const restrictedSourceCount = sourcesInScope.filter((source: any) => String(source.type).endsWith("_metadata")).length;
  const restrictedDisabled = Number((options.config as any)?.limits?.maxConcurrentDarknetMetadataTasks) === 0;
  const response = {
    query,
    tenantId: scope.tenantId,
    generatedAt,
    mode: "scraper",
    status,
    runId: stableId("search", `${scope.tenantId ?? "global"}:${query}:${generatedAt}`),
    refreshAfterSeconds: rows.length ? 300 : 15,
    summary,
    confidence: assessment.confidence,
    lastSeen,
    aliases,
    recentActivity,
    targets: sectors.map((sector) => ({ sector, regions: countries, rationale: "Co-mentioned in extracted evidence; this is not independently verified targeting.", confidence: assessment.confidence })),
    ttps,
    datasets: entityValues(records.entities, "dataset").map((name) => ({ name, type: "advertised_dataset", coverage: `${records.sourceCount} source(s)`, status: assessment.ready ? "reviewed_or_corroborated" : "needs_review" })),
    sources,
    notes: [...assessment.reasons, ...missing.map((field) => `Missing: ${field}.`)],
    rows: rows.map((row) => ({ ...row, confidence: rowConfidence(row.id, records, assessment.confidence), assertions: assertionsFor(row.id, records), reviewState: reviewStateFor(row.id, records) })),
    results: rows.map((row) => ({ ...row, confidence: rowConfidence(row.id, records, assessment.confidence), assertions: assertionsFor(row.id, records), reviewState: reviewStateFor(row.id, records) })),
    claims,
    incidents,
    actorProfile: { query, actor, aliases, datasets: { evidenceStageCounts: stageCounts(records.claims), sourceCount: records.sourceCount }, provenance: structuredProvenance },
    actorIntelligence,
    actionability: {
      schemaVersion: "ti.query.actionability.v1",
      alertDisposition: watchlistCandidates.length ? "watchlist_required" : "needs_enrichment",
      shouldAlert: false,
      rationale: watchlistCandidates.length ? "Evidence can seed a watchlist, but an organization-specific match and review are required before alerting." : "No supported organization or domain candidate is available for alerting.",
      watchlistCandidates,
      sourceProvenance: structuredProvenance,
      enrichmentGaps: missing.map((field) => ({ id: `missing:${field}`, title: `Missing ${field}`, severity: "medium", detail: `Attach evidence for ${field} before promoting the profile.`, dependency: field })),
      handoffs: { watchlist: { method: "POST", endpoint: "/v1/dwm/watchlists", payloads: watchlistCandidates.map(({ kind, value, reason }) => ({ kind, value, notes: reason })), missing: ["authenticated organization context", "analyst confirmation"] } }
    },
    evidenceAssessment: { ...assessment, claimCounts: claimCounts(records.claims), missingFields: missing },
    publicTiAnswer: {
      route: { canonicalPath: "/api/ti/search", publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" },
      status,
      noResult: rows.length === 0,
      displayState: status,
      query,
      summary: rows,
      safeSummary: rows.length ? [summary] : ["Searching"],
      waitReasons: rows.length ? [] : [{ code: "capture_promotion", message: "Waiting for captured evidence to be promoted." }],
      nextPoll: { pollable: rows.length === 0, nextPollAfterSeconds: liveSearch.dto.nextPollSeconds, cursorRequired: rows.length === 0 },
      claims,
      evidenceLedgerReferences: structuredProvenance,
      ux: { evidenceStageLabels: stageCounts(records.claims) }
    },
    quality: qualityPayload(query, rows, records, assessment),
    graph: { endpoint: "/v1/intel/search.graph", reviewQueue: { total: records.claims.filter((claim) => !["confirmed", "rejected"].includes(claim.reviewState)).length, publicFactPolicy: assessment.ready ? "ready" : "hold_weak_edges" } },
    planner: liveSearch.dto,
    publicChannel: publicChannelResult.ok
      ? compactPublicChannel(publicChannelResult.body, options.publicTelegramSourcePacks as any[] | undefined, query)
      : undefined,
    restrictedMetadata: {
      metadataOnly: true,
      status: restrictedDisabled ? "disabled" : restricted.count ? "partial_metadata" : restrictedSourceCount ? "searching" : "approval_required",
      sourceCount: restrictedSourceCount,
      matchingResultCount: restricted.count,
      results: restricted.rows,
      noLeakSerialization: restricted.noLeakSerialization,
    },
    darknetMetadata: restrictedDisabled
      ? { status: "disabled", queuedTasks: 0, blocked: sourcesInScope.filter((source: any) => String(source.type).endsWith("_metadata")).map((source: any) => ({ sourceId: source.id, state: "disabled" })) }
      : { status: restricted.count ? "partial_metadata" : "searching", queuedTasks: 0 },
  };
  return json(sanitizeDwmApiPayload(response));
}

function compactPublicChannel(status: any, packs: any[] = [], query: string) {
  const pendingSources = (status.operatorStates ?? []).filter((item: any) => item.collectable === false).slice(0, 10);
  const queryTerms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1);
  const sourcePackRecommendations = packs.flatMap((pack) => (pack.sources ?? []).filter((source: any) => {
    const haystack = JSON.stringify([source.name, source.topicTags, source.focus]).toLowerCase();
    return queryTerms.some((term) => haystack.includes(term));
  }).map((source: any) => ({ sourcePackId: pack.id, sourceId: source.id, requiredAction: "review" }))).slice(0, 10);
  const activationRecommendations = [
    ...pendingSources.map((source: any) => ({ sourceId: source.sourceId, requiredAction: "approve" })),
    ...sourcePackRecommendations,
  ];
  const pending = status.queuedTasks === 0 && status.evidence.length === 0;
  return {
    status: pending ? "pending_channel_search" : status.status,
    queuedTasks: status.queuedTasks,
    evidence: status.evidence,
    activationRecommendations,
    sourcePackRecommendations,
    coverageGaps: pendingSources.map((source: any) => ({ reason: "matching_channels_pending_review", sourceId: source.sourceId, requiredAction: "approve" })),
    poll: status.poll,
    sla: { status: status.sla?.status },
    safeOutput: status.safeOutput,
  };
}

function searchRecords(store: any, tenantId: string | undefined, captureIds: Set<string>, sourceIds: Set<string>) {
  const scoped = (method: string) => (typeof store[method] === "function" ? store[method]() : []).filter((record: any) => (record.tenantId || undefined) === tenantId);
  const restrictedCaptureIds = new Set(scoped("listCaptures").filter(isMetadataOnlyCapture).map((record: any) => record.id));
  const safeCapture = (id: string) => captureIds.has(id) && !restrictedCaptureIds.has(id);
  const safeAggregate = (ids: string[] = []) => ids.some(safeCapture) && !ids.some((id) => restrictedCaptureIds.has(id));
  const entities = scoped("listExtractedEntities").filter((record: any) => safeCapture(record.captureId));
  const indicators = scoped("listIndicators").filter((record: any) => safeCapture(record.captureId));
  const incidents = scoped("listIncidents").filter((record: any) => safeCapture(record.captureId));
  const claims = scoped("listIntelligenceClaims").filter((record: any) => safeAggregate(record.captureIds));
  const profiles = scoped("listActorProfiles").filter((record: any) => safeAggregate(record.captureIds));
  const profileIds = new Set(profiles.map((profile: any) => profile.id));
  const aliases = scoped("listActorAliases").filter((record: any) => profileIds.has(record.actorProfileId));
  const validations = scoped("listValidationRecords").filter((record: any) => captureIds.has(record.captureId) || incidents.some((incident: any) => incident.id === record.incidentId));
  return { entities, indicators, incidents, claims, profiles, aliases, validations, sourceCount: sourceIds.size };
}

function assess(rows: any[], records: ReturnType<typeof searchRecords>) {
  const contradicted = records.claims.filter((claim: any) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted").length;
  const confirmed = records.claims.filter((claim: any) => claim.reviewState === "confirmed").length;
  const corroborated = records.claims.filter((claim: any) => claim.corroborationState === "corroborated").length;
  const validated = records.validations.filter((record: any) => ["supported", "confirmed", "validated"].includes(record.status)).length;
  const signals = [...records.claims, ...records.entities, ...records.indicators].map((record: any) => confidence(record.confidence)).filter((value) => value > 0);
  let score = signals.length ? signals.reduce((sum, value) => sum + value, 0) / signals.length : rows.length ? 0.35 : 0;
  if (records.sourceCount < 2 && confirmed === 0 && validated === 0) score = Math.min(score, 0.69);
  if (rows.length && rows.every((row) => row.metadataOnly)) score = Math.min(score, 0.6);
  if (contradicted) score = Math.min(score, 0.35);
  const ready = rows.length > 0 && contradicted === 0 && (confirmed > 0 || corroborated > 0 || validated > 0);
  const reasons = unique([
    `${rows.length} capture(s) from ${records.sourceCount} independent source(s) match the query.`,
    records.sourceCount < 2 ? "Single-source evidence is capped below high confidence." : `${records.sourceCount} independent sources are represented.`,
    rows.length && rows.every((row) => row.metadataOnly) ? "All matching captures are metadata-only and require review." : "At least one matching public capture has reviewable content.",
    confirmed ? `${confirmed} claim(s) are analyst-confirmed.` : "No claim is analyst-confirmed.",
    corroborated ? `${corroborated} claim(s) are corroborated across sources.` : "No claim is cross-source corroborated.",
    validated ? `${validated} independent validation record(s) support the evidence.` : "No supporting validation record is attached.",
    contradicted ? `${contradicted} contradicted claim(s) prevent promotion.` : "No stored contradiction is attached."
  ]);
  return { ready, confidence: Number(score.toFixed(3)), sourceCount: records.sourceCount, captureCount: rows.length, confirmedClaimCount: confirmed, corroboratedClaimCount: corroborated, validationCount: validated, contradictedClaimCount: contradicted, metadataOnly: rows.length > 0 && rows.every((row) => row.metadataOnly), reasons };
}

function activity(row: any, records: ReturnType<typeof searchRecords>, fallbackConfidence: number) {
  const rowClaims = records.claims.filter((claim: any) => claim.captureIds?.includes(row.id));
  const corroboratingSourceIds = unique(rowClaims
    .flatMap((claim: any) => claim.sourceIds ?? [])
    .filter((sourceId) => sourceId !== row.sourceId));
  const contradictingSourceIds = unique(rowClaims.flatMap((claim: any) => claim.contradictingSourceIds ?? []));
  return {
    date: row.publishedAt ?? row.collectedAt,
    title: row.title,
    detail: row.summary,
    confidence: rowConfidence(row.id, records, fallbackConfidence),
    sourceIds: [row.sourceId],
    url: row.url,
    claimType: row.victimName ? "victim_claim" : row.tags?.some((tag: string) => /cve|exploit/i.test(tag)) ? "vulnerability_exploitation" : row.tags?.some((tag: string) => /malware|ransomware/i.test(tag)) ? "malware_activity" : "general_activity",
    victimName: row.victimName,
    affectedSectors: entityValues(records.entities.filter((entity: any) => entity.captureId === row.id), "sector"),
    countries: entityValues(records.entities.filter((entity: any) => entity.captureId === row.id), "country"),
    impact: entityValues(records.entities.filter((entity: any) => entity.captureId === row.id), "impact").join(", ") || undefined,
    firstReportedAt: row.publishedAt,
    lastReportedAt: row.collectedAt,
    publisherCount: 1 + corroboratingSourceIds.length,
    corroboratingSourceIds,
    contradictingSourceIds,
    assertionKind: "source_claim",
    reviewState: reviewStateFor(row.id, records),
    corroborationState: rowClaims.some((claim: any) => claim.corroborationState === "contradicted")
      ? "contradicted"
      : rowClaims.some((claim: any) => claim.corroborationState === "corroborated")
        ? "corroborated"
        : "single_source",
    observationSummary: `A captured source record matched the query. This confirms the source mention, not the underlying activity.`
  };
}

function qualityPayload(query: string, rows: any[], records: ReturnType<typeof searchRecords>, assessment: ReturnType<typeof assess>) {
  return {
    query,
    status: rows.length ? assessment.ready ? "ready" : "partial" : "unmeasured",
    score: rows.length ? assessment.confidence : null,
    canPromoteToReady: assessment.ready,
    publicWarningText: assessment.ready ? [] : assessment.reasons,
    publicWarningCodes: unique([
      !rows.length && "insufficient_capture",
      records.sourceCount < 2 && "single_source",
      assessment.metadataOnly && "metadata_only",
      !assessment.confirmedClaimCount && "unreviewed",
      assessment.contradictedClaimCount && "contradicted"
    ]),
    analystActions: rows.length ? [{ kind: "review_claims", label: "Review claims", manualOnly: true, evidenceIds: rows.map((row) => row.id) }] : [{ kind: "request_more_capture_evidence", label: "Collect evidence", manualOnly: false, evidenceIds: [] }]
  };
}

function assertionsFor(captureId: string, records: ReturnType<typeof searchRecords>) {
  return records.entities.filter((entity: any) => entity.captureId === captureId).map((entity: any) => ({ id: entity.id, type: entity.type, value: safeText(entity.value, 240), confidence: confidence(entity.confidence), assertionKind: entity.assertionKind ?? "extracted", extractionMethod: entity.extractionMethod, extractorVersion: entity.extractorVersion, reviewReasons: entity.reviewReasons ?? [] }));
}

function reviewStateFor(captureId: string, records: ReturnType<typeof searchRecords>) {
  const claims = records.claims.filter((claim: any) => claim.captureIds?.includes(captureId));
  if (claims.some((claim: any) => claim.reviewState === "contradicted")) return "contradicted";
  if (claims.some((claim: any) => claim.reviewState === "confirmed")) return "confirmed";
  if (claims.some((claim: any) => claim.reviewState === "needs_review")) return "needs_review";
  return "unreviewed";
}

function rowConfidence(captureId: string, records: ReturnType<typeof searchRecords>, fallback: number) {
  const values = [...records.entities, ...records.indicators, ...records.claims]
    .filter((record: any) => record.captureId === captureId || record.captureIds?.includes(captureId))
    .map((record: any) => confidence(record.confidence));
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)) : Math.min(fallback, 0.4);
}

function actorAliases(records: ReturnType<typeof searchRecords>, rows: any[]) {
  return unique([...records.profiles.map((profile: any) => profile.canonicalName), ...records.aliases.map((alias: any) => alias.alias), ...entityValues(records.entities, "actor"), ...rows.map((row) => row.actor)]);
}

function missingFields(input: { actor?: string; victims: string[]; sectors: string[]; countries: string[]; ttps: any[]; records: ReturnType<typeof searchRecords>; rows: any[] }) {
  return [
    input.actor ? "" : "actor",
    input.victims.length ? "" : "victim",
    input.sectors.length ? "" : "sector",
    input.countries.length ? "" : "country",
    input.ttps.length ? "" : "TTP",
    input.records.sourceCount >= 2 ? "" : "independent corroborating source",
    input.records.claims.some((claim: any) => claim.reviewState === "confirmed") ? "" : "analyst-confirmed claim",
    input.records.validations.length ? "" : "independent validation"
  ].filter(Boolean);
}

function searchSummary(query: string, rowCount: number, assessment: ReturnType<typeof assess>) {
  if (!rowCount) return `No captured public-intelligence evidence currently matches ${query}. Collection may still be in progress.`;
  const state = assessment.ready ? "reviewed or corroborated evidence is available" : "the evidence remains partial and must not be treated as verified";
  return `${rowCount} captured public-intelligence record(s) match ${query}; ${state}.`;
}

function stageCounts(claims: any[]) {
  return claims.reduce((counts: Record<string, number>, claim: any) => {
    const stage = String(claim.evidenceStage ?? "unknown");
    counts[stage] = (counts[stage] ?? 0) + 1;
    return counts;
  }, {});
}

function claimCounts(claims: any[]) {
  return { total: claims.length, confirmed: claims.filter((claim) => claim.reviewState === "confirmed").length, needsReview: claims.filter((claim) => ["unreviewed", "needs_review"].includes(claim.reviewState)).length, contradicted: claims.filter((claim) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted").length, corroborated: claims.filter((claim) => claim.corroborationState === "corroborated").length };
}

function safeIndicators(indicators: any[]) {
  return unique(indicators.filter((indicator) => !indicator.reviewReasons?.length && !/\.onion\b|\[restricted/i.test(String(indicator.value))).map((indicator) => safeText(indicator.value, 240)));
}

function hasParsedRecord(captureId: string, records: ReturnType<typeof searchRecords>) {
  return records.entities.some((record: any) => record.captureId === captureId)
    || records.indicators.some((record: any) => record.captureId === captureId)
    || records.incidents.some((record: any) => record.captureId === captureId)
    || records.claims.some((record: any) => record.captureIds?.includes(captureId));
}

function entityValues(entities: any[], type: string) {
  return unique(entities.filter((entity) => entity.type === type).map((entity) => safeText(entity.value, 240)));
}

function scopedSource(source: any, tenantId?: string) {
  return source && (source.tenantId || undefined) === tenantId ? source : undefined;
}

function safeText(value: unknown, maxLength: number) {
  return sanitizeDwmCustomerText(value, undefined, maxLength) ?? "";
}

function confidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

function dedupeRows(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = row.url || row.urlHash || `${row.sourceId}:${String(row.title).toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))];
}

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function earliest(values: Array<string | undefined>) { return values.filter((value): value is string => Boolean(value)).sort()[0]; }
function latest(values: Array<string | undefined>) { return values.filter((value): value is string => Boolean(value)).sort().at(-1); }
