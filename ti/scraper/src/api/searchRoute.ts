import type { ApiServerOptions } from "./serverTypes.ts";
import { error, json, numberQuery, readJson } from "./http.ts";
import { nowIso, stableId } from "../utils.ts";
import { findActorSearchCaptures, findSearchCaptures } from "./searchCaptureIndex.ts";
import { cleanSearchText, isMetadataOnlyCapture, rowFromCapture } from "./searchRows.ts";
import { resolveTenantScope } from "./tenantScope.ts";
import { sanitizeDwmApiPayload } from "../product/dwmCustomerDisplay.ts";
import { createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { buildPublicChannelStatusRouteResponse } from "./publicChannelRoutes.ts";
import { searchDarkwebIndex } from "../adapters/darkwebIndex.ts";
import { ACTOR_ALIAS_RECORDS } from "../pipeline/actorAliases.ts";
import { termRegex } from "./searchTerm.ts";
import { hasIncidentEvidence } from "../pipeline/incidentCandidate.ts";
import { resolveMitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
import { evidenceIndependence } from "../storage/memoryStore.ts";

type SearchEntityType = "actor" | "domain" | "cve" | "indicator" | "organization" | "free_text";

export async function searchResponse(request: Request, options: ApiServerOptions, url: URL): Promise<Response> {
  const body: any = request.method === "POST" ? await readJson(request) : {};
  const scope = resolveTenantScope(request, url, body.tenantId);
  if (scope.error) return scope.error;
  const query = String(body.q ?? body.query ?? url.searchParams.get("q") ?? "").trim();
  if (!query || query.length > 300) return error("invalid_search_query", "Search query must contain 1-300 characters", 400);

  const generatedAt = nowIso();
  const entityType = searchEntityType(query, body.entityType ?? url.searchParams.get("entityType"), options.store, scope.tenantId);
  const sourcesInScope = options.store.listSources().filter((source: any) => !source.tenantId || source.tenantId === scope.tenantId);
  const liveSearch = createLiveSearchPlan({
    request: { query, entityType, tenantId: scope.tenantId, createdAt: generatedAt },
    actorIdentities: options.store.listActorIdentities?.() ?? [],
    sources: sourcesInScope,
    frontier: options.frontier,
    activeRuns: options.store.listRuns?.() ?? [],
    activePlans: options.store.listPlans?.() ?? [],
    queuePressureLimit: Number(options.liveSearchQueuePressureLimit ?? 50),
  });
  scheduleLiveSearch(liveSearch, options, generatedAt);
  const publicChannelResult = buildPublicChannelStatusRouteResponse(
    { query, entityType, tenantId: scope.tenantId },
    { store: options.store, publicTelegramSourcePacks: options.publicTelegramSourcePacks as any, generatedAt },
  );
  const limit = Math.max(1, Math.min(numberQuery(url.searchParams.get("limit")) ?? 50, 100));
  const identity = actorIdentity(options.store, scope.tenantId, query);
  const captures = searchCaptures(options.store, query, entityType, identity, limit * 3, scope.tenantId);
  const rows = dedupeRows(captures.map((capture: any) => rowFromCapture(capture, scopedSource(options.store.getSource?.(capture.sourceId), scope.tenantId)))).slice(0, limit);
  const captureIds = new Set(rows.map((row) => row.id));
  const sourceIds = new Set(rows.map((row) => row.sourceId));
  const records = searchRecords(options.store, scope.tenantId, captureIds, sourceIds);
  const assessment = assess(rows, records);
  const eventRows = rows.filter(isIncidentRow);
  const activityRows = entityType === "actor" ? eventRows : rows;
  const lastSeen = latest(activityRows.map((row) => row.publishedAt));
  const profile = actorProfileForQuery(records, identity);
  const aliases = actorAliases(records, rows, profile, identity);
  const recentActivity = activityRows.map((row) => activity(row, records, assessment.confidence));
  const victimActivity = recentActivity.filter((item) => item.victimName);
  const victimTargetSectors = unique(victimActivity.flatMap((item) => item.affectedSectors));
  const victimGeographies = unique(victimActivity.flatMap((item) => item.countries));
  const targets = uniqueBy(recentActivity
    .filter((item) => item.victimName && item.affectedSectors.length && item.countries.length)
    .map((item) => ({
      sector: item.affectedSectors.join(", "),
      regions: item.countries,
      rationale: `Victim-linked fields from captured source ${item.sourceIds[0]}; analyst confirmation is required.`,
      confidence: item.confidence
    })), (target) => `${target.sector}:${target.regions.join(",")}`);
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
    reportDate: row.publishedAt,
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
  const actor = profile?.canonicalName
    ?? records.entities.find((entity) => ["actor", "ransomware_family"].includes(entity.type) && identity.normalizedTerms.has(normalizeActorName(entity.value)))?.value
    ?? rows.find((row) => row.actor && identity.normalizedTerms.has(normalizeActorName(row.actor)))?.actor
    ?? (identity.catalogCandidates.length === 1 && identity.catalogCandidates[0].matchKinds.includes("canonical") ? identity.catalogCandidates[0].canonicalName : undefined);
  const eventCaptureIds = new Set(eventRows.map((row) => row.id));
  const publicIncidents = records.incidents.filter((incident) => eventCaptureIds.has(incident.captureId));
  const campaigns = unique(publicIncidents.map((incident) => safeText(incident.title ?? incident.summary, 180)));
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
  const businessModel = businessModelAssessment(records.businessEntities, records.businessClaims, records.businessClaimEvidence);
  const attributionEvidence = actor ? actorAttribution(rows, unique([actor, ...aliases, ...identity.terms])) : undefined;
  const attribution = attributionEvidence?.statement;
  const actorIntelligence = {
    actorClass: profile?.actorType ?? (rows.length && actor ? "observed_threat_actor" : identity.catalogCandidates.length ? "cataloged_threat_group" : "unclassified_query"),
    attribution,
    firstSeen: earliest(activityRows.map((row) => row.publishedAt)),
    lastSeen,
    motivation: entityValues(records.entities, "motivation"),
    malwareTools,
    campaigns,
    infrastructure,
    indicators,
    targetSectors: victimTargetSectors,
    geographies: victimGeographies,
    confidence: assessment.confidence,
    confidenceReasoning: assessment.reasons,
    sourceProvenance: sources.map((source) => source.provenance),
    structuredProvenance,
    businessModel,
    attributionEvidence: attributionEvidence ? {
      sourceId: attributionEvidence.row.sourceId,
      sourceName: attributionEvidence.row.sourceName,
      provenance: attributionEvidence.row.url ?? attributionEvidence.row.sourceName,
      reportDate: attributionEvidence.row.publishedAt,
      captureId: attributionEvidence.row.id,
    } : undefined,
    missingFields: missing
  };
  const claims = records.claims.map((claim) => ({
    id: claim.id,
    claimType: claim.claimType,
    value: safeClaimValue(claim.value),
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
  const incidents = publicIncidents.map((incident) => ({
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
  const status = rows.length ? assessment.ready ? "ready" : "partial" : identity.catalogCandidates.length ? "partial" : "searching";
  const restricted = searchDarkwebIndex({ query, sources: sourcesInScope, captures: options.store.listCaptures(), limit: 20 });
  const restrictedSourceCount = sourcesInScope.filter((source: any) => String(source.type).endsWith("_metadata")).length;
  const restrictedDisabled = Number((options.config as any)?.limits?.maxConcurrentDarknetMetadataTasks) === 0;
  const response = {
    query,
    queryKind: entityType,
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
    targets,
    ttps,
    datasets: entityValues(records.entities, "dataset").map((name) => ({ name, type: "advertised_dataset", coverage: `${records.sourceCount} source(s)`, status: assessment.ready ? "reviewed_or_corroborated" : "needs_review" })),
    sources,
    notes: [...assessment.reasons, ...missing.map((field) => `Missing: ${field}.`)],
    rows: rows.map((row) => ({ ...row, confidence: rowConfidence(row.id, records, assessment.confidence), assertions: assertionsFor(row.id, records), reviewState: reviewStateFor(row.id, records) })),
    results: rows.map((row) => ({ ...row, confidence: rowConfidence(row.id, records, assessment.confidence), assertions: assertionsFor(row.id, records), reviewState: reviewStateFor(row.id, records) })),
    claims,
    incidents,
    actorProfile: { query, actor, aliases, datasets: { evidenceStageCounts: stageCounts(records.claims), sourceCount: records.sourceCount }, provenance: structuredProvenance },
    actorIdentity: {
      catalogMatched: identity.catalogCandidates.length > 0,
      ambiguous: identity.catalogAmbiguous,
      candidates: identity.catalogCandidates,
      activityEvidenceAvailable: rows.length > 0
    },
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

function scheduleLiveSearch(liveSearch: any, options: ApiServerOptions, generatedAt: string) {
  if (!options.runExecutor || liveSearch.dto.activeRunId) return;
  const tasks = liveSearch.plan.tasks.filter((task: any) => !task.availableAt || !task.deadlineAt || Date.parse(task.availableAt) <= Date.parse(task.deadlineAt));
  if (!tasks.length) return;
  const plan = { ...liveSearch.plan, tasks };
  const runId = stableId("run", plan.id);
  options.store.savePlan?.(plan);
  options.store.saveRun?.({ id: runId, tenantId: plan.tenantId, planId: plan.id, requestId: plan.request.id, requestHash: liveSearch.dto.reuseKey, status: "queued", createdAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, reviewTaskCount: plan.reviewRequired.length, rejectedSourceCount: plan.rejected.length, captureCount: 0, incidentCount: 0 });
  liveSearch.dto.activeRunId = runId;
  liveSearch.dto.queuedTaskCount = tasks.length;
  options.runExecutor(runId);
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
  const allEntities = scoped("listExtractedEntities");
  const entities = allEntities.filter((record: any) => safeCapture(record.captureId));
  const businessEntityCandidates = allEntities.filter((record: any) => captureIds.has(record.captureId) && isSafeBusinessMechanism(record));
  const businessEntityIds = new Set(businessEntityCandidates.map((record: any) => record.id));
  const indicators = scoped("listIndicators").filter((record: any) => safeCapture(record.captureId));
  const incidents = scoped("listIncidents").filter((record: any) => safeCapture(record.captureId));
  const allClaims = scoped("listIntelligenceClaims");
  const businessClaimEvidence = scoped("listClaimEvidence").filter((record: any) => captureIds.has(record.captureId) && record.subjectType === "entity" && businessEntityIds.has(record.subjectId));
  const businessClaimIds = new Set(businessClaimEvidence.map((record: any) => record.claimId));
  const businessEntitiesById = new Map<string, any>(businessEntityCandidates.map((record: any) => [record.id, record]));
  const actorBusinessClaims = new Map(allClaims.filter((record: any) => businessClaimIds.has(record.id)).map((record: any) => {
    const evidence = businessClaimEvidence.filter((item: any) => item.claimId === record.id);
    const exactAssociation = evidence.some((item: any) => item.subjectId === record.subjectId);
    const actorSourceIds = unique(evidence.map((item: any) => item.sourceId).filter(Boolean));
    const actorCaptureIds = unique(evidence.map((item: any) => item.captureId).filter(Boolean));
    const sourceIndependence = evidenceIndependence(store, actorCaptureIds);
    const observedAt = evidence.map((item: any) => validIso(item.createdAt)).filter(Boolean);
    const reviewState = exactAssociation ? record.reviewState : "needs_review";
    return [record.id, {
      ...record,
      sourceIds: actorSourceIds,
      captureIds: actorCaptureIds,
      sourceCount: sourceIndependence.groupCount,
      sourceIndependence,
      evidenceCount: evidence.length,
      confidence: Math.max(...evidence.map((item: any) => confidence(item.confidence)), 0),
      evidenceStage: evidence.map((item: any) => item.evidenceStage).find(Boolean),
      extractorVersion: evidence.map((item: any) => item.extractorVersion).find(Boolean) ?? record.extractorVersion,
      reviewState,
      corroborationState: exactAssociation && record.corroborationState === "contradicted" ? "contradicted" : sourceIndependence.groupCount > 1 ? "corroborated" : "single_source",
      firstSeenAt: earliest(observedAt),
      lastSeenAt: latest(observedAt),
      reviewedBy: exactAssociation ? record.reviewedBy : undefined,
      reviewedAt: exactAssociation ? record.reviewedAt : undefined,
      uncertaintyReasons: exactAssociation ? record.uncertaintyReasons : unique(evidence.flatMap((item: any) => businessEntitiesById.get(item.subjectId)?.reviewReasons ?? [])),
    }];
  }));
  const claims = allClaims.filter((record: any) => businessClaimIds.has(record.id) || safeAggregate(record.captureIds)).map((record: any) => {
    const actorBusinessClaim = actorBusinessClaims.get(record.id);
    if (actorBusinessClaim) return actorBusinessClaim;
    const visibleSourceIds = unique([...(record.sourceIds ?? []), record.sourceId].filter((sourceId) => sourceIds.has(sourceId)));
    return { ...record, sourceIds: visibleSourceIds, sourceCount: visibleSourceIds.length, corroborationState: record.corroborationState === "corroborated" && visibleSourceIds.length < 2 ? "single_source" : record.corroborationState };
  });
  const businessClaims = [...actorBusinessClaims.values()];
  const evidencedBusinessEntityIds = new Set(businessClaimEvidence.map((record: any) => record.subjectId));
  const businessEntities = businessEntityCandidates.filter((record: any) => evidencedBusinessEntityIds.has(record.id));
  const profiles = scoped("listActorProfiles").filter((record: any) => safeAggregate(record.captureIds));
  const profileIds = new Set(profiles.map((profile: any) => profile.id));
  const aliases = scoped("listActorAliases").filter((record: any) => profileIds.has(record.actorProfileId));
  const validations = scoped("listValidationRecords").filter((record: any) => captureIds.has(record.captureId) || incidents.some((incident: any) => incident.id === record.incidentId));
  return { entities, businessEntities, businessClaims, businessClaimEvidence, indicators, incidents, claims, profiles, aliases, validations, sourceCount: sourceIds.size };
}

const SOURCE_BACKED_BUSINESS_TYPES = new Set([
  "extortion_model", "extortion_type", "advertised_product", "advertised_data", "dataset",
  "pricing_claim", "payment_claim", "revenue_claim", "revenue_share_claim", "publication_strategy", "publicity_tactic",
  "publicity_event", "victim_pressure_tactic", "communication_channel", "buyer_seller_communication",
  "intermediary_communication", "monetization_path", "profitability_signal",
]);

function isSafeBusinessMechanism(entity: any) {
  if (!SOURCE_BACKED_BUSINESS_TYPES.has(entity.type) || entity.extractionMethod !== "source_specific" || entity.assertionKind === "inferred") return false;
  const fieldEcho = `${safeText(entity.sourceField, 80)}: ${safeText(entity.value, 160)}`.trim().toLowerCase();
  return Array.isArray(entity.provenance) && entity.provenance.some((record: any) => {
    const excerpt = safeText(record?.evidenceText, 240).toLowerCase();
    return excerpt && excerpt !== fieldEcho;
  });
}

function businessModelAssessment(entities: any[], claims: any[], claimEvidence: any[]) {
  const claimsById = new Map(claims.map((claim: any) => [claim.id, claim]));
  const observations = entities.reduce((items: any[], entity) => {
    const value = safeText(entity.value, 160);
    if (!value) return items;
    const evidenceLinks = claimEvidence.filter((record: any) => record.subjectId === entity.id && record.captureId === entity.captureId);
    const linkedClaims = evidenceLinks.map((record: any) => claimsById.get(record.claimId)).filter(Boolean) as any[];
    const claim = linkedClaims[0];
    const provenance = (Array.isArray(entity.provenance) ? entity.provenance : []).map((record: any) => ({
      sourceId: safeText(record.sourceId ?? entity.sourceId, 160),
      captureId: safeText(record.captureId ?? entity.captureId, 160),
      url: safeUrl(record.url),
      collectedAt: validIso(record.collectedAt),
      excerpt: safeText(record.evidenceText, 240),
    })).filter((record: any) => record.sourceId && record.captureId && record.excerpt);
    const reviewReasons = unique([
      ...(entity.reviewReasons ?? []).map((reason: unknown) => safeText(reason, 200)),
      ...(claim?.uncertaintyReasons ?? []).map((reason: unknown) => safeText(reason, 200)),
    ].filter(Boolean));
    const sourceIds = unique([
      ...provenance.map((record: any) => record.sourceId),
      ...evidenceLinks.map((record: any) => record.sourceId),
      entity.sourceId,
    ].filter(Boolean));
    const captureIds = unique([
      ...provenance.map((record: any) => record.captureId),
      ...evidenceLinks.map((record: any) => record.captureId),
      entity.captureId,
    ].filter(Boolean));
    const observedAt = unique([
      ...provenance.map((record: any) => record.collectedAt),
      ...evidenceLinks.map((record: any) => validIso(record.createdAt)),
    ].filter(Boolean));
    const reviewState = claim?.reviewState ?? (reviewReasons.length ? "needs_review" : "unreviewed");
    const observation = {
      type: entity.type,
      value,
      assertionKind: entity.assertionKind ?? "observed",
      evidenceKind: evidenceKind(entity.assertionKind),
      confidence: confidence(claim?.confidence ?? entity.confidence),
      sourceIds: claim?.sourceIds ?? sourceIds,
      captureIds: claim?.captureIds ?? captureIds,
      sourceCount: claim?.sourceCount ?? sourceIds.length,
      evidenceCount: claim?.evidenceCount ?? provenance.length,
      claimIds: claim ? [claim.id] : unique(evidenceLinks.map((record: any) => record.claimId).filter(Boolean)),
      reviewState,
      reviewReasons,
      corroborationState: claim?.corroborationState ?? (sourceIds.length > 1 ? "corroborated" : "single_source"),
      firstSeenAt: claim?.firstSeenAt ?? earliest(observedAt),
      lastSeenAt: claim?.lastSeenAt ?? latest(observedAt),
      evidenceStages: unique(evidenceLinks.map((record: any) => record.evidenceStage ?? claim?.evidenceStage).filter(Boolean)),
      extractionMethods: unique([entity.extractionMethod, claim?.extractionMethod].filter(Boolean)),
      extractorVersions: unique([entity.extractorVersion, ...evidenceLinks.map((record: any) => record.extractorVersion)].filter(Boolean)),
      evidence: provenance,
    };
    const existing = items.find((item) => item.type === entity.type && item.value.toLowerCase() === value.toLowerCase());
    if (existing) {
      existing.sourceIds = unique([...existing.sourceIds, ...observation.sourceIds]);
      existing.captureIds = unique([...existing.captureIds, ...observation.captureIds]);
      existing.claimIds = unique([...existing.claimIds, ...observation.claimIds]);
      existing.confidence = Math.max(existing.confidence, observation.confidence);
      existing.reviewReasons = unique([...existing.reviewReasons, ...observation.reviewReasons]);
      existing.sourceCount = Math.max(existing.sourceCount, observation.sourceCount);
      existing.evidenceCount = Math.max(existing.evidenceCount, observation.evidenceCount);
      existing.firstSeenAt = earliest([existing.firstSeenAt, observation.firstSeenAt]);
      existing.lastSeenAt = latest([existing.lastSeenAt, observation.lastSeenAt]);
      existing.evidenceStages = unique([...existing.evidenceStages, ...observation.evidenceStages]);
      existing.extractionMethods = unique([...existing.extractionMethods, ...observation.extractionMethods]);
      existing.extractorVersions = unique([...existing.extractorVersions, ...observation.extractorVersions]);
      existing.evidence = uniqueBy([...existing.evidence, ...observation.evidence], (record: any) => `${record.sourceId}:${record.captureId}:${record.excerpt}`);
      return items;
    }
    items.push(observation);
    return items;
  }, []);
  const byType = (...types: string[]) => observations.filter((item) => types.includes(item.type)).map(({ type: _type, ...item }) => item);
  const extortionModels = byType("extortion_model", "extortion_type");
  const advertisedProducts = byType("advertised_product");
  const advertisedData = byType("advertised_data", "dataset");
  const pricingClaims = byType("pricing_claim");
  const paymentClaims = byType("payment_claim");
  const revenueClaims = byType("revenue_claim");
  const revenueShareClaims = byType("revenue_share_claim");
  const publicationStrategies = byType("publication_strategy");
  const publicityTactics = byType("publicity_tactic");
  const publicityEvents = byType("publicity_event");
  const pressureTactics = byType("victim_pressure_tactic");
  const communicationChannels = byType("communication_channel");
  const buyerSellerCommunications = byType("buyer_seller_communication");
  const intermediaryCommunications = byType("intermediary_communication");
  const monetizationPaths = byType("monetization_path");
  const profitabilitySignals = byType("profitability_signal");
  return {
    schemaVersion: "ti.actor.business_model.v2",
    evidenceState: observations.length ? "observed_mechanisms" : "not_observed",
    extortionModels,
    advertisedProducts,
    advertisedData,
    pricingClaims,
    paymentClaims,
    revenueClaims,
    revenueShareClaims,
    publicationStrategies,
    publicityTactics,
    publicityEvents,
    pressureTactics,
    communicationChannels,
    buyerSellerCommunications,
    intermediaryCommunications,
    monetizationPaths,
    profitabilitySignals,
    profitabilityConclusion: {
      status: profitabilitySignals.length ? "profitability_reported" : revenueClaims.length ? "revenue_reported" : "unknown",
      summary: profitabilitySignals.length
        ? "A third-party profitability statement was captured, but realized revenue and profit remain unverified."
        : revenueClaims.length
          ? "A third-party revenue or payment outcome was captured, but costs and realized profit remain unknown."
        : "Profitability is unknown because no captured financial evidence establishes revenue or profit.",
      claimIds: unique([...profitabilitySignals, ...revenueClaims].flatMap((row: any) => row.claimIds)),
      sourceIds: unique([...profitabilitySignals, ...revenueClaims].flatMap((row: any) => row.sourceIds)),
      captureIds: unique([...profitabilitySignals, ...revenueClaims].flatMap((row: any) => row.captureIds)),
    },
    missingEvidence: [
      ...(!buyerSellerCommunications.length ? ["buyer and seller conversations"] : []),
      ...(!intermediaryCommunications.length ? ["intermediary conversations"] : []),
      ...(!pricingClaims.length ? ["pricing or ransom demands"] : []),
      ...(!paymentClaims.length ? ["payment demands or methods"] : []),
      "independently verified revenue",
      "independently verified profitability",
    ],
    evidenceBoundary: "Public observations and reports can describe operating mechanisms, demands, or communication channels. They do not prove private conversations, completed payments, conversion, revenue, or profit.",
  };
}

function evidenceKind(assertionKind: unknown) {
  if (assertionKind === "source_claim") return "actor_claim";
  if (assertionKind === "third_party_report") return "third_party_report";
  if (assertionKind === "inferred") return "analytical_inference";
  return "observed";
}

function validIso(value: unknown): string | undefined {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function assess(rows: any[], records: ReturnType<typeof searchRecords>) {
  const contradicted = records.claims.filter((claim: any) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted").length;
  const confirmed = records.claims.filter((claim: any) => claim.reviewState === "confirmed").length;
  const corroborated = records.claims.filter((claim: any) => claim.corroborationState === "corroborated" && supportsActivityCorroboration(claim)).length;
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
    !rows.length ? "No matching public capture is available for review." : rows.every((row) => row.metadataOnly) ? "All matching captures are metadata-only and require review." : "At least one matching public capture has reviewable content.",
    confirmed ? `${confirmed} claim(s) are analyst-confirmed.` : "No claim is analyst-confirmed.",
    corroborated ? `${corroborated} activity or victim claim(s) are corroborated across sources.` : "No activity or victim claim is cross-source corroborated.",
    validated ? `${validated} independent validation record(s) support the evidence.` : "No supporting validation record is attached.",
    contradicted ? `${contradicted} contradicted claim(s) prevent promotion.` : "No stored contradiction is attached."
  ]);
  return { ready, confidence: Number(score.toFixed(3)), sourceCount: records.sourceCount, captureCount: rows.length, confirmedClaimCount: confirmed, corroboratedClaimCount: corroborated, validationCount: validated, contradictedClaimCount: contradicted, metadataOnly: rows.length > 0 && rows.every((row) => row.metadataOnly), reasons };
}

function activity(row: any, records: ReturnType<typeof searchRecords>, fallbackConfidence: number) {
  const rowClaims = records.claims.filter((claim: any) => claim.captureIds?.includes(row.id));
  const activityClaims = rowClaims.filter(supportsActivityCorroboration);
  const corroboratingSourceIds = unique(activityClaims
    .flatMap((claim: any) => claim.sourceIds ?? [])
    .filter((sourceId) => sourceId !== row.sourceId));
  const contradictingSourceIds = unique(activityClaims.flatMap((claim: any) => claim.contradictingSourceIds ?? []));
  return {
    date: row.publishedAt,
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
    lastReportedAt: row.publishedAt,
    publisherCount: 1 + corroboratingSourceIds.length,
    corroboratingSourceIds,
    contradictingSourceIds,
    assertionKind: "source_claim",
    reviewState: reviewStateFor(row.id, records),
    corroborationState: activityClaims.some((claim: any) => claim.corroborationState === "contradicted")
      ? "contradicted"
      : activityClaims.some((claim: any) => claim.corroborationState === "corroborated")
        ? "corroborated"
        : "single_source",
    observationSummary: `A captured source record matched the query. This confirms the source mention, not the underlying activity.`
  };
}

function isIncidentRow(row: any) {
  return hasIncidentEvidence({
    title: row.title,
    text: row.summary,
    actorNames: [row.actor],
    victimNames: [row.victimName],
  });
}

function supportsActivityCorroboration(claim: any) {
  return claim.claimType === "incident" || claim.claimType === "victim";
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

function actorAliases(records: ReturnType<typeof searchRecords>, rows: any[], profile: any, identity: ReturnType<typeof actorIdentity>) {
  const profileAliases = profile
    ? records.aliases.filter((alias: any) => alias.actorProfileId === profile.id).map((alias: any) => alias.alias)
    : [];
  return unique([
    profile?.canonicalName,
    ...(profile?.aliases ?? []),
    ...profileAliases,
    ...records.entities.filter((entity: any) => ["actor", "ransomware_family"].includes(entity.type) && identity.normalizedTerms.has(normalizeActorName(entity.value))).map((entity: any) => entity.value),
    ...rows.filter((row) => row.actor && identity.normalizedTerms.has(normalizeActorName(row.actor))).map((row) => row.actor)
  ]);
}

function searchEntityType(query: string, requested: unknown, store: any, tenantId?: string): SearchEntityType {
  const explicit = String(requested ?? "").trim();
  if (["actor", "domain", "cve", "indicator", "organization", "free_text"].includes(explicit)) return explicit as SearchEntityType;
  if (/^cve-\d{4}-\d{4,}$/i.test(query)) return "cve";
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(query)) return "domain";
  if (/^(?:https?:\/\/|(?:\d{1,3}\.){3}\d{1,3}$|[a-f0-9]{32,128}$)/i.test(query)) return "indicator";
  if (/^apt\d+$/i.test(query) || actorIdentity(store, tenantId, query).matched) return "actor";
  return query.includes(" ") ? "organization" : "free_text";
}

function searchCaptures(store: any, query: string, entityType: SearchEntityType, identity: ReturnType<typeof actorIdentity>, limit: number, tenantId?: string) {
  if (entityType !== "actor") return findSearchCaptures(store, query, limit, tenantId);
  const candidates = findActorSearchCaptures(store, identity.terms, limit, tenantId)
    .sort((a: any, b: any) => String(b.collectedAt ?? "").localeCompare(String(a.collectedAt ?? "")));
  const entitiesByCapture = new Map<string, any[]>();
  for (const entity of store.listExtractedEntities?.() ?? []) {
    if ((entity.tenantId || undefined) !== tenantId || !["actor", "ransomware_family"].includes(entity.type)) continue;
    const rows = entitiesByCapture.get(entity.captureId) ?? [];
    rows.push(entity);
    entitiesByCapture.set(entity.captureId, rows);
  }
  return candidates.filter((capture: any) => actorCaptureMatches(capture, entitiesByCapture.get(capture.id) ?? [], identity.normalizedTerms)).slice(0, limit);
}

function actorIdentity(store: any, tenantId: string | undefined, query: string) {
  const normalizedQuery = normalizeActorName(query);
  const registeredIdentities = store.listActorIdentities?.() ?? [];
  const catalogResolution = resolveMitreActorIdentity(query, registeredIdentities);
  const catalogConfigured = (store.listSources?.() ?? []).some((source: any) => ["mitre_actor_catalog", "ransomware_operation_catalog"].includes(source.metadata?.extractionProfile));
  const dictionary = registeredIdentities.length || catalogConfigured ? undefined : ACTOR_ALIAS_RECORDS.find((record) => [record.canonical, ...record.aliases].some((value) => normalizeActorName(value) === normalizedQuery));
  const profiles = (store.listActorProfiles?.() ?? []).filter((profile: any) => (profile.tenantId || undefined) === tenantId);
  const aliases = (store.listActorAliases?.() ?? []).filter((alias: any) => (alias.tenantId || undefined) === tenantId);
  const matchedProfileIds = new Set([
    ...profiles.filter((profile: any) => [profile.canonicalName, ...(profile.aliases ?? [])].some((value) => normalizeActorName(value) === normalizedQuery)).map((profile: any) => profile.id),
    ...aliases.filter((alias: any) => normalizeActorName(alias.normalizedAlias ?? alias.alias) === normalizedQuery).map((alias: any) => alias.actorProfileId)
  ]);
  const matchedProfiles = profiles.filter((profile: any) => matchedProfileIds.has(profile.id));
  const terms = unique([
    query,
    dictionary?.canonical,
    ...(dictionary?.aliases ?? []),
    ...(catalogResolution.ambiguous ? [] : catalogResolution.candidates.flatMap((candidate) => candidate.matchKinds.includes("canonical") ? [candidate.identity.canonicalName] : [])),
    ...matchedProfiles.flatMap((profile: any) => [profile.canonicalName, ...(profile.aliases ?? [])]),
    ...aliases.filter((alias: any) => matchedProfileIds.has(alias.actorProfileId)).map((alias: any) => alias.alias)
  ]);
  const catalogCandidates = catalogResolution.candidates.map((candidate) => ({
    catalogId: candidate.identity.catalogId,
    externalId: candidate.identity.externalId,
    canonicalName: candidate.identity.canonicalName,
    associatedNames: candidate.identity.associatedNames,
    matchKinds: candidate.matchKinds,
    status: candidate.identity.status,
    aptNumberDesignationPresent: candidate.identity.aptNumberDesignationPresent,
    sourceUrl: candidate.identity.sourceUrl,
    catalogVersion: candidate.identity.catalogVersion,
    catalogModifiedAt: candidate.identity.catalogModifiedAt,
    captureId: (candidate.identity as any).captureId
  }));
  return { matched: Boolean(catalogCandidates.length || dictionary || matchedProfiles.length), terms, normalizedTerms: new Set(terms.map(normalizeActorName)), catalogCandidates, catalogAmbiguous: catalogResolution.ambiguous };
}

function actorCaptureMatches(capture: any, entities: any[], normalizedTerms: Set<string>) {
  const metadataNames = unique([
    capture.metadata?.leakSite?.actorName,
    capture.metadata?.ransomwareGroup?.actorName,
    capture.metadata?.actorName,
    capture.metadata?.actor
  ]);
  const assertedNames = entities.filter((entity) => entity.assertionKind !== "mention").map((entity) => entity.value);
  if ([...metadataNames, ...assertedNames].some((name) => normalizedTerms.has(normalizeActorName(name)))) return true;
  const title = normalizeActorName(capture.title ?? capture.metadata?.title);
  if (capture.searchTitleSource === "legacy_incident") {
    if (normalizedTerms.has(title)) return false;
    const inferredActor = String(capture.title).split(/\s+\/\s+/, 1)[0];
    if (inferredActor !== capture.title && normalizedTerms.has(normalizeActorName(inferredActor))) return false;
  }
  return [...normalizedTerms].some((term) => termRegex(term).test(title));
}

function actorProfileForQuery(records: ReturnType<typeof searchRecords>, identity: ReturnType<typeof actorIdentity>) {
  const aliasProfileIds = new Set(records.aliases.filter((alias: any) => identity.normalizedTerms.has(normalizeActorName(alias.alias))).map((alias: any) => alias.actorProfileId));
  return records.profiles.find((profile: any) => identity.normalizedTerms.has(normalizeActorName(profile.canonicalName)) || aliasProfileIds.has(profile.id));
}

function actorAttribution(rows: any[], names: string[]) {
  const namePattern = new RegExp(`\\b(?:${names.map((name) => escapeRegex(name)).sort((a, b) => b.length - a.length).join("|")})\\b`, "i");
  const direct = /\b(?:attribut(?:ed|ion)|linked|associated|operated|sponsored|connected)\b/i;
  const origin = /\b(?:russia(?:n)?|svr|china|chinese|iran(?:ian)?|north korea(?:n)?|dprk|united states|u\.s\.|american)\b/i;
  for (const row of rows) {
    for (const sentence of unique([row.title, row.summary]).flatMap((value) => String(value).split(/(?<=[.!?])\s+|\n+/))) {
      if (namePattern.test(sentence) && direct.test(sentence) && origin.test(sentence)) {
        return { statement: safeText(sentence, 320), row };
      }
    }
  }
}

function normalizeActorName(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    || records.businessEntities.some((record: any) => record.captureId === captureId)
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
  return cleanSearchText(value, maxLength);
}

function safeClaimValue(value: unknown): unknown {
  const safe = sanitizeDwmApiPayload(value);
  if (typeof safe === "string") return cleanSearchText(safe);
  if (Array.isArray(safe)) return safe.map(safeClaimValue);
  if (safe && typeof safe === "object") return Object.fromEntries(Object.entries(safe).map(([key, nested]) => [key, safeClaimValue(nested)]));
  return safe;
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
