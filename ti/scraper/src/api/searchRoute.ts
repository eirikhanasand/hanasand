import type { ApiServerOptions } from "./serverTypes.ts";
import { error, json, numberQuery, readJson } from "./http.ts";
import { nowIso, stableId } from "../utils.ts";
import { findActorSearchCaptures, findSearchCaptures } from "./searchCaptureIndex.ts";
import { cleanSearchText, isMetadataOnlyCapture, rowFromCapture, safePublicSearchUrl } from "./searchRows.ts";
import { resolveTenantScope } from "./tenantScope.ts";
import { sanitizeDwmApiPayload } from "../product/dwmCustomerDisplay.ts";
import { createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { buildPublicChannelStatusRouteResponse } from "./publicChannelRoutes.ts";
import { searchDarkwebIndex } from "../adapters/darkwebIndex.ts";
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
  const actorQuery = entityType === "actor";
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
  const assessment = assess(rows, records, generatedAt);
  const eventRows = rows.filter(isIncidentRow);
  const activityRows = entityType === "actor" ? eventRows : rows;
  const lastSeen = latest(activityRows.map((row) => row.publishedAt));
  const profile = actorQuery ? actorProfileForQuery(records, identity) : undefined;
  const aliases = actorQuery ? actorAliases(records, rows, profile, identity) : [];
  const recentActivity = activityRows.map((row) => activity(row, records, assessment.confidence, generatedAt));
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
    confidence: rowConfidence(row.id, records, assessment.confidence, generatedAt),
    shownBecause: `${row.sourceName} contains captured evidence matching ${query}.`
  }));
  const sectors = entityValues(characterizationEntities(records, "sector", generatedAt), "sector");
  const countries = entityValues(characterizationEntities(records, "country", generatedAt), "country");
  const victims = unique([...entityValues(records.entities, "victim"), ...rows.map((row) => row.victimName)]);
  const actor = !actorQuery ? undefined : profile?.canonicalName
    ?? records.entities.find((entity) => ["actor", "ransomware_family"].includes(entity.type) && identity.normalizedTerms.has(normalizeActorName(entity.value)))?.value
    ?? rows.find((row) => row.actor && identity.normalizedTerms.has(normalizeActorName(row.actor)))?.actor
    ?? (identity.catalogCandidates.length === 1 && identity.catalogCandidates[0].matchKinds.includes("canonical") ? identity.catalogCandidates[0].canonicalName : undefined);
  const eventCaptureIds = new Set(eventRows.map((row) => row.id));
  const publicIncidents = records.incidents.filter((incident) => eventCaptureIds.has(incident.captureId));
  const campaigns = unique(publicIncidents.map((incident) => safeText(incident.title ?? incident.summary, 180)));
  const malwareTools = entityValues(characterizationEntities(records, "malware", generatedAt), "malware");
  const indicators = safeIndicators(records.indicators);
  const infrastructure = safeIndicators(records.indicators.filter((indicator) => ["domain", "hostname", "ipv4", "ipv6", "url"].includes(indicator.type)));
  const ttps = characterizationEntities(records, "ttp", generatedAt).map((entity) => ({
    name: safeText(entity.value, 160),
    attackId: typeof entity.attackId === "string" ? entity.attackId : undefined,
    tactic: safeText(entity.tactic, 80) || "Unmapped",
    detail: `Extracted ${entity.assertionKind ?? "mention"} from capture ${entity.captureId}.`,
    confidence: confidence(entity.confidence),
    sourceIds: [entity.sourceId].filter(Boolean),
    captureIds: [entity.captureId].filter(Boolean),
    reviewState: entity.reviewReasons?.length || entity.extractionMethod === "deterministic_fallback" ? "needs_review" : "unreviewed",
    extractionMethod: entity.extractionMethod,
    extractorVersion: entity.extractorVersion
  }));
  const summary = searchSummary(query, rows.length, assessment);
  const watchlistCandidates = uniqueBy([
    ...queryWatchlistCandidates(query, entityType),
    ...unique([...victims, ...records.indicators.filter((indicator) => indicator.type === "domain").map((indicator) => indicator.value)]).map((value) => ({
    kind: /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(value) ? "domain" : "company",
    value,
    reason: "Extracted from captured public-intelligence evidence; analyst confirmation is required before alerting.",
    confidence: Math.min(assessment.confidence, 0.69)
    }))
  ], (candidate) => `${candidate.kind}:${candidate.value.toLowerCase()}`);
  const missing = missingFields({ query, entityType, actor, victims, sectors, countries, ttps, records, generatedAt });
  const actorBusinessEvidence = actorQuery ? actorBusinessEvidenceCatalog(options.store, scope.tenantId, query, generatedAt) : undefined;
  const businessModel = actorQuery ? businessModelAssessment(options.store, actorBusinessEvidence?.reviewedFindings ?? [], actorBusinessEvidence?.pendingFindings ?? []) : undefined;
  const actorCaseStudies = actorBusinessEvidence?.catalog;
  const attributionEvidence = actor ? actorAttribution(rows, unique([actor, ...aliases, ...identity.terms])) : undefined;
  const attribution = attributionEvidence?.statement;
  const actorIntelligence = actorQuery ? {
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
  } : undefined;
  const claims = records.claims.map((claim) => {
    const eligible = eligibleSupportClaim(claim, generatedAt);
    return {
      id: claim.id,
      claimType: claim.claimType,
      value: safeClaimValue(claim.value),
      summary: safeText(claim.summary, 500),
      confidence: confidence(claim.confidence),
      reviewState: staleAt(claim, generatedAt) ? "stale" : claim.reviewState ?? "unreviewed",
      corroborationState: claim.corroborationState === "contradicted" ? "contradicted" : eligible ? claim.corroborationState ?? "single_source" : "single_source",
      sourceCount: Number(claim.sourceCount ?? claim.sourceIds?.length ?? 0),
      evidenceCount: Number(claim.evidenceCount ?? claim.captureIds?.length ?? 0),
      evidenceStage: claim.evidenceStage,
      extractionMethod: claim.extractionMethod,
      extractorVersion: claim.extractorVersion,
      firstSeenAt: claim.firstSeenAt,
      lastSeenAt: claim.lastSeenAt,
      uncertaintyReasons: claim.uncertaintyReasons ?? []
    };
  });
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
    rows: rows.map((row) => ({ ...row, confidence: rowConfidence(row.id, records, assessment.confidence, generatedAt), assertions: assertionsFor(row.id, records), reviewState: reviewStateFor(row.id, records, generatedAt) })),
    results: rows.map((row) => ({ ...row, confidence: rowConfidence(row.id, records, assessment.confidence, generatedAt), assertions: assertionsFor(row.id, records), reviewState: reviewStateFor(row.id, records, generatedAt) })),
    claims,
    incidents,
    actorProfile: actorQuery ? { query, actor, aliases, datasets: { evidenceStageCounts: stageCounts(records.claims), sourceCount: records.sourceCount }, provenance: structuredProvenance } : undefined,
    actorIdentity: actorQuery ? {
      catalogMatched: identity.catalogCandidates.length > 0,
      ambiguous: identity.catalogAmbiguous,
      candidates: identity.catalogCandidates,
      activityEvidenceAvailable: rows.length > 0
    } : undefined,
    actorIntelligence,
    actorCaseStudies,
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
    evidenceAssessment: { ...assessment, claimCounts: claimCounts(records.claims, generatedAt), missingFields: missing },
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
    const visibleCaptureIds = (record.captureIds ?? []).filter((captureId: string) => captureIds.has(captureId));
    const sourceIndependence = evidenceIndependence(store, visibleCaptureIds);
    return { ...record, sourceIds: visibleSourceIds, sourceCount: sourceIndependence.groupCount, sourceIndependence, corroborationState: record.corroborationState === "corroborated" && sourceIndependence.groupCount < 2 ? "single_source" : record.corroborationState };
  });
  const businessClaims = [...actorBusinessClaims.values()];
  const evidencedBusinessEntityIds = new Set(businessClaimEvidence.map((record: any) => record.subjectId));
  const businessEntities = businessEntityCandidates.filter((record: any) => evidencedBusinessEntityIds.has(record.id));
  const profiles = scoped("listActorProfiles").filter((record: any) => safeAggregate(record.captureIds));
  const profileIds = new Set(profiles.map((profile: any) => profile.id));
  const aliases = scoped("listActorAliases").filter((record: any) => profileIds.has(record.actorProfileId));
  const validations = scoped("listValidationRecords").filter((record: any) => captureIds.has(record.captureId) || incidents.some((incident: any) => incident.id === record.incidentId));
  const sourceIndependence = evidenceIndependence(store, [...captureIds]);
  return { entities, businessEntities, businessClaims, businessClaimEvidence, indicators, incidents, claims, profiles, aliases, validations, sourceCount: captureIds.size ? sourceIndependence.groupCount : 0, sourceIndependence };
}

const SOURCE_BACKED_BUSINESS_TYPES = new Set([
  "extortion_model", "extortion_type", "advertised_product", "advertised_data", "dataset",
  "pricing_claim", "negotiation_claim", "payment_claim", "revenue_claim", "revenue_share_claim", "publication_strategy", "publicity_tactic",
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

function businessModelAssessment(store: any, reviewedFindings: any[], pendingFindings: any[]) {
  const observations = businessObservations(store, reviewedFindings, true);
  const pending = businessObservations(store, pendingFindings, false);
  const byType = (...types: string[]) => observations.filter((item) => types.includes(item.type)).map(({ type: _type, ...item }) => item);
  const extortionModels = byType("extortion_model", "extortion_type");
  const advertisedProducts = byType("advertised_product");
  const advertisedData = byType("advertised_data", "dataset");
  const pricingClaims = byType("pricing_claim");
  const negotiationClaims = observations
    .filter((item) => item.type === "negotiation_claim" || (item.type === "communication_channel" && /\bnegotiat/i.test(item.value)))
    .map(({ type: _type, ...item }) => item);
  const paymentClaims = byType("payment_claim");
  const revenueClaims = byType("revenue_claim");
  const revenueShareClaims = byType("revenue_share_claim");
  const publicationStrategies = byType("publication_strategy");
  const publicityTactics = byType("publicity_tactic");
  const publicityEvents = byType("publicity_event");
  const pressureTactics = byType("victim_pressure_tactic");
  const communicationChannels = observations
    .filter((item) => item.type === "communication_channel" && !/\bnegotiat/i.test(item.value))
    .map(({ type: _type, ...item }) => item);
  const buyerSellerCommunications = byType("buyer_seller_communication");
  const intermediaryCommunications = byType("intermediary_communication");
  const monetizationPaths = byType("monetization_path");
  const profitabilitySignals = byType("profitability_signal");
  return {
    schemaVersion: "ti.actor.business_model.v3",
    evidenceState: observations.length ? "reviewed_mechanisms" : pending.length ? "pending_review" : "not_observed",
    extortionModels,
    advertisedProducts,
    advertisedData,
    pricingClaims,
    negotiationClaims,
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
    pendingFindings: pending,
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
      ...(!pricingClaims.length ? ["reviewed pricing or ransom demands"] : []),
      ...(!negotiationClaims.length ? ["negotiation process or channel"] : []),
      ...(!paymentClaims.length ? ["reviewed payment demands or methods"] : []),
      "independently verified revenue",
      "independently verified profitability",
    ],
    evidenceBoundary: "Positive findings require a current confirmed review over an exact retained claim, evidence, entity, capture, and active-source chain. Pending findings are not case-study evidence. Public reporting does not prove private conversations, completed payments, conversion, revenue, or profit.",
  };
}

function businessObservations(store: any, findings: any[], reviewed: boolean) {
  const grouped = new Map<string, any[]>();
  for (const finding of findings) {
    const key = `${finding.type}:${finding.value.toLowerCase()}`;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }
  return [...grouped.values()].map((rows) => {
    const sourceIds = unique(rows.map((row) => row.sourceId));
    const captureIds = unique(rows.map((row) => row.captureId));
    const independence = reviewed ? evidenceIndependence(store, captureIds) : undefined;
    return {
      type: rows[0].type,
      value: rows[0].value,
      assertionKind: rows[0].assertionKind,
      evidenceKind: evidenceKind(rows[0].assertionKind),
      confidence: Math.max(...rows.map((row) => row.confidence)),
      sourceIds,
      captureIds,
      claimIds: unique(rows.map((row) => row.claimId)),
      claimEvidenceIds: unique(rows.map((row) => row.claimEvidenceId)),
      entityIds: unique(rows.map((row) => row.entityId)),
      reviewState: reviewed ? "confirmed" : rows[0].reviewState,
      reviewReasons: unique(rows.flatMap((row) => row.reviewReasons ?? [])),
      corroborationState: reviewed && independence && independence.groupCount > 1 ? "corroborated" : "single_source",
      ...(reviewed ? { sourceCount: independence?.groupCount } : {}),
      evidenceCount: rows.length,
      firstPublishedAt: earliest(rows.map((row) => row.publishedAt)),
      lastPublishedAt: latest(rows.map((row) => row.publishedAt)),
      firstCollectedAt: earliest(rows.map((row) => row.collectedAt)),
      lastCollectedAt: latest(rows.map((row) => row.collectedAt)),
      evidenceStages: unique(rows.map((row) => row.evidenceStage)),
      extractionMethods: unique(rows.map((row) => row.extractionMethod)),
      extractorVersions: unique(rows.map((row) => row.extractorVersion)),
      evidence: rows.map((row) => ({
        sourceId: row.sourceId,
        captureId: row.captureId,
        claimId: row.claimId,
        claimEvidenceId: row.claimEvidenceId,
        entityId: row.entityId,
        contentHash: row.contentHash,
        url: row.url,
        publishedAt: row.publishedAt,
        collectedAt: row.collectedAt,
        excerpt: row.excerpt,
      })),
    };
  });
}

function actorBusinessEvidenceCatalog(store: any, tenantId: string | undefined, query: string, generatedAt: string) {
  const inScope = (record: any) => Boolean(record) && (!record.tenantId || (record.tenantId || undefined) === tenantId);
  const sourceById = uniqueMap((store.listSources?.() ?? []).filter((source: any) => inScope(source) && source.status === "active"));
  const captureById = uniqueMap((store.listCaptures?.() ?? []).filter(inScope));
  const entities = (store.listExtractedEntities?.() ?? []).filter(inScope);
  const entityById = uniqueMap(entities);
  const actorEntitiesByCapture = new Map<string, any[]>();
  for (const entity of entities) {
    if (!["actor", "ransomware_family"].includes(entity.type) || ["mention", "inferred"].includes(entity.assertionKind)) continue;
    actorEntitiesByCapture.set(entity.captureId, [...(actorEntitiesByCapture.get(entity.captureId) ?? []), entity]);
  }
  const claimEvidence = (store.listClaimEvidence?.() ?? []).filter(inScope);
  const claimsById = uniqueMap((store.listIntelligenceClaims?.() ?? []).filter(inScope));
  const reviewsByClaim = new Map<string, any[]>();
  for (const review of (store.listClaimReviews?.() ?? []).filter(inScope)) {
    reviewsByClaim.set(review.claimId, [...(reviewsByClaim.get(review.claimId) ?? []), review]);
  }
  const identities = (store.listActorIdentities?.() ?? []).filter((identity: any) => identity.status === "current");
  const identityById = uniqueMap(identities);
  const profiles = (store.listActorProfiles?.() ?? []).filter(inScope);
  const aliases = (store.listActorAliases?.() ?? []).filter(inScope);
  const findings: any[] = [];

  for (const evidence of claimEvidence) {
    const entity: any = entityById.get(evidence.subjectId);
    const claim: any = claimsById.get(evidence.claimId);
    const capture: any = captureById.get(evidence.captureId);
    const source: any = sourceById.get(evidence.sourceId);
    if (!exactBusinessEvidenceChain({ entity, claim, evidence, capture, source, sourceById, captureById })) continue;
    const sourceActor = explicitBusinessActor(capture, actorEntitiesByCapture.get(entity.captureId) ?? []);
    if (!sourceActor) continue;
    const actorIdentity = resolveBusinessActor(sourceActor, identities, identityById, profiles, aliases);
    if (!actorIdentity) continue;
    const currentReview = currentClaimReview(reviewsByClaim.get(claim.id) ?? []);
    const disposition = claimReviewDisposition(claim, currentReview, generatedAt);
    if (disposition === "excluded") continue;
    const provenance = entity.provenance.find((record: any) => exactProvenance(record, source.id, capture.id, capture.contentHash));
    const actor = safeText(actorIdentity.identity.canonicalName, 120);
    const value = safeText(entity.value, 160);
    const excerpt = cleanSearchText(provenance?.evidenceText, 240);
    if (!actor || !value || !excerpt) continue;
    findings.push({
      actorId: actorIdentity.identity.id,
      actor,
      actorClass: capture.metadata?.ransomwareGroup?.actorName || capture.metadata?.leakSite?.actorName || actorIdentity.profile?.actorType === "ransomware"
        ? "ransomware_or_extortion"
        : actorIdentity.identity.catalogId === "mitre-attack-enterprise" || actorIdentity.profile?.actorType === "apt" ? "apt_or_intrusion_set" : "threat_actor",
      category: actorBusinessCategory(entity),
      type: entity.type,
      value,
      assertionKind: entity.assertionKind ?? "observed",
      confidence: confidence(claim.confidence ?? entity.confidence),
      claimId: claim.id,
      claimEvidenceId: evidence.id,
      entityId: entity.id,
      captureId: capture.id,
      sourceId: source.id,
      relationship: evidence.relationship,
      evidenceStage: evidence.evidenceStage,
      reviewState: claim.reviewState,
      reviewedAt: disposition === "reviewed" ? validIso(currentReview?.reviewedAt) : undefined,
      reviewedBy: disposition === "reviewed" ? safeText(currentReview?.reviewerId, 160) : undefined,
      reviewReasons: unique([...(claim.uncertaintyReasons ?? []), ...(entity.reviewReasons ?? [])].map((reason: unknown) => safeText(reason, 200)).filter(Boolean)),
      extractionMethod: entity.extractionMethod,
      extractorVersion: evidence.extractorVersion ?? entity.extractorVersion,
      contentHash: capture.contentHash,
      publishedAt: validIso(capture.publishedAt),
      collectedAt: validIso(capture.collectedAt),
      url: safePublicSearchUrl(capture.url, capture.metadata),
      excerpt,
      disposition,
    });
  }

  const reviewed = findings.filter((finding) => finding.disposition === "reviewed");
  const pending = findings.filter((finding) => finding.disposition === "pending");
  const grouped = new Map<string, any[]>();
  for (const finding of reviewed) grouped.set(finding.actorId, [...(grouped.get(finding.actorId) ?? []), finding]);
  const supported = [...grouped.values()].map((actorFindings) => {
    const first = actorFindings[0];
    const categories = unique(actorFindings.map((finding) => finding.category)).sort();
    const captureIds = unique(actorFindings.map((finding) => finding.captureId));
    const independence = evidenceIndependence(store, captureIds);
    return {
      actorId: first.actorId,
      actor: first.actor,
      actorClass: first.actorClass,
      categories,
      findingCount: new Set(actorFindings.map((finding) => `${finding.type}:${finding.value.toLowerCase()}`)).size,
      evidenceCount: actorFindings.length,
      captureCount: captureIds.length,
      sourceCount: independence.groupCount,
      firstPublishedAt: earliest(actorFindings.map((finding) => finding.publishedAt)),
      lastPublishedAt: latest(actorFindings.map((finding) => finding.publishedAt)),
      firstCollectedAt: earliest(actorFindings.map((finding) => finding.collectedAt)),
      lastCollectedAt: latest(actorFindings.map((finding) => finding.collectedAt)),
      reviewStates: ["confirmed"],
      findings: actorFindings.map(withoutDisposition),
    };
  });
  const categoryCounts = Object.fromEntries([...new Set(supported.flatMap((entry) => entry.categories))].sort().map((category) => [
    category,
    supported.filter((entry) => entry.categories.includes(category)).length,
  ]));
  const allCases = rankBusinessCases(supported.filter((entry) => entry.categories.length >= 2));
  const ransomwareOrExtortionCount = supported.filter((entry) => entry.actorClass === "ransomware_or_extortion").length;
  const aptOrIntrusionSetCount = supported.filter((entry) => entry.actorClass === "apt_or_intrusion_set").length;
  const queryIdentity = resolveBusinessActor(query, identities, identityById, profiles, aliases)?.identity.id;
  const queryReviewed = queryIdentity ? reviewed.filter((finding) => finding.actorId === queryIdentity).map(withoutDisposition) : [];
  const queryPending = queryIdentity ? pending.filter((finding) => finding.actorId === queryIdentity).map(withoutDisposition) : [];
  return {
    reviewedFindings: queryReviewed,
    pendingFindings: queryPending,
    catalog: {
      schemaVersion: "ti.actor.case_studies.v2",
      supportedActorCount: supported.length,
      caseStudyCount: allCases.length,
      pendingActorCount: new Set(pending.map((finding) => finding.actorId)).size,
      pendingFindingCount: pending.length,
      qualification: "A reviewed case requires current confirmed review authority and an exact retained claim, claim-evidence, entity, capture, and active-source chain in at least two separately represented categories.",
      actorClassCounts: {
        ransomwareOrExtortion: ransomwareOrExtortionCount,
        aptOrIntrusionSet: aptOrIntrusionSetCount,
        otherThreatActor: supported.length - ransomwareOrExtortionCount - aptOrIntrusionSetCount,
      },
      categoryCounts,
      cases: queryIdentity ? allCases.filter((entry) => entry.actorId === queryIdentity) : [],
      reviewedFindings: queryReviewed,
      pendingFindings: queryPending,
      missingContexts: aptOrIntrusionSetCount ? [] : ["reviewed state/APT business-model evidence"],
    },
  };
}

function exactBusinessEvidenceChain({ entity, claim, evidence, capture, source, sourceById, captureById }: any) {
  if (!entity || !claim || !capture || !source || !isSafeBusinessMechanism(entity)) return false;
  if (evidence.subjectType !== "entity" || evidence.relationship !== "supports") return false;
  if (!["captured_page", "metadata_only_claim", "reviewed_promoted"].includes(evidence.evidenceStage)) return false;
  if (capture.sourceId !== entity.sourceId || entity.sourceId !== evidence.sourceId) return false;
  if (capture.id !== entity.captureId || entity.captureId !== evidence.captureId) return false;
  if (claim.subjectType !== "entity" || claim.subjectId !== entity.id || evidence.claimId !== claim.id) return false;
  if (claim.claimType !== entity.type || normalizeActorName(claim.value?.value) !== normalizeActorName(entity.value)) return false;
  if (claim.evidenceStage !== evidence.evidenceStage) return false;
  if (!capture.contentHash || !exactProvenance(capture.provenance, source.id, capture.id, capture.contentHash)) return false;
  if (!Array.isArray(entity.provenance) || !entity.provenance.some((record: any) => exactProvenance(record, source.id, capture.id, capture.contentHash))) return false;
  if (!exactProvenance(evidence.provenance, source.id, capture.id, capture.contentHash)) return false;
  const sourceIds = unique([...(claim.sourceIds ?? []), claim.sourceId].filter(Boolean));
  const captureIds = unique([...(claim.captureIds ?? []), claim.captureId].filter(Boolean));
  return sourceIds.length > 0 && captureIds.length > 0
    && sourceIds.includes(evidence.sourceId)
    && captureIds.includes(evidence.captureId)
    && sourceIds.every((id) => sourceById.has(id))
    && captureIds.every((id) => {
      const linkedCapture: any = captureById.get(id);
      return linkedCapture && sourceById.has(linkedCapture.sourceId) && linkedCapture.contentHash && exactProvenance(linkedCapture.provenance, linkedCapture.sourceId, linkedCapture.id, linkedCapture.contentHash);
    });
}

function exactProvenance(record: any, sourceId: string, captureId: string, contentHash: string) {
  if (Array.isArray(record)) return record.some((item) => exactProvenance(item, sourceId, captureId, contentHash));
  return Boolean(record && record.sourceId === sourceId && record.captureId === captureId && record.contentHash === contentHash);
}

function currentClaimReview(reviews: any[]) {
  const stateActions = new Set(["confirm", "reject", "correct", "mark_needs_review", "mark_contradicted", "reset"]);
  const candidates = reviews.flatMap((review) => {
    const reviewedAt = validIso(review.reviewedAt);
    return stateActions.has(review.action) && reviewedAt ? [{ ...review, reviewedAt }] : [];
  });
  const latestAt = latest(candidates.map((review) => review.reviewedAt));
  const latestReviews = candidates.filter((review) => review.reviewedAt === latestAt);
  return latestReviews.length === 1 ? latestReviews[0] : latestReviews.length > 1 ? { ambiguous: true } : undefined;
}

function claimReviewDisposition(claim: any, current: any, generatedAt: string): "reviewed" | "pending" | "excluded" {
  if (claim.legalHold || staleAt(claim, generatedAt) || claim.reviewState === "rejected" || claim.reviewState === "contradicted" || claim.corroborationState === "contradicted") return "excluded";
  if (current?.ambiguous) return "excluded";
  if (claim.reviewState === "confirmed") {
    if (!current || current.action !== "confirm") return "excluded";
    if (String(current.reviewerId ?? "").startsWith("hanasand-ai:") && current.automaticDecision?.claimValidity !== "supported") return "excluded";
    return "reviewed";
  }
  if (!["unreviewed", "needs_review"].includes(claim.reviewState)) return "excluded";
  if (current && !["mark_needs_review", "reset"].includes(current.action)) return "excluded";
  return "pending";
}

function resolveBusinessActor(sourceActor: string, identities: any[], identityById: Map<string, any>, profiles: any[], aliases: any[]) {
  const direct = resolveMitreActorIdentity(sourceActor, identities);
  if (direct.ambiguous || direct.candidates.length > 1) return undefined;
  if (direct.candidates.length === 1) return { identity: direct.candidates[0].identity };
  const normalized = normalizeActorName(sourceActor);
  const aliasProfileIds = new Set(aliases.filter((alias: any) => normalizeActorName(alias.normalizedAlias ?? alias.alias) === normalized).map((alias: any) => alias.actorProfileId));
  const matchingProfiles = profiles.filter((profile: any) => {
    if (profile.identityResolutionState !== "canonical") return false;
    const labels = [profile.canonicalName, ...(profile.aliases ?? [])].map(normalizeActorName);
    return labels.includes(normalized) || aliasProfileIds.has(profile.id);
  });
  if (matchingProfiles.length !== 1) return undefined;
  const profile = matchingProfiles[0];
  const identityIds = unique(profile.actorIdentityIds ?? []);
  if (identityIds.length !== 1) return undefined;
  const identity = identityById.get(identityIds[0]);
  return identity ? { identity, profile } : undefined;
}

function uniqueMap(records: any[]) {
  const map = new Map<string, any>();
  const duplicates = new Set<string>();
  for (const record of records) {
    if (!record?.id || map.has(record.id)) duplicates.add(record?.id);
    else map.set(record.id, record);
  }
  for (const id of duplicates) map.delete(id);
  return map;
}

function withoutDisposition({ disposition: _disposition, ...finding }: any) {
  return finding;
}

function explicitBusinessActor(capture: any, actorEntities: any[]) {
  const metadataActor = [
    capture.metadata?.ransomwareGroup?.actorName,
    capture.metadata?.leakSite?.actorName,
    capture.metadata?.actorName,
    capture.metadata?.actor,
  ].map((value) => safeText(value, 120)).find(Boolean);
  if (metadataActor) return metadataActor;
  const asserted = unique(actorEntities.map((entity) => safeText(entity.value, 120)).filter(Boolean));
  return asserted.length === 1 ? asserted[0] : undefined;
}

function actorBusinessCategory(entity: any) {
  if (entity.type === "pricing_claim") return "pricing";
  if (entity.type === "negotiation_claim" || (entity.type === "communication_channel" && /\bnegotiat/i.test(entity.value))) return "negotiation";
  if (entity.type === "payment_claim") return "payment";
  if (["revenue_claim", "profitability_signal"].includes(entity.type)) return "economic_outcome";
  if (["publication_strategy", "publicity_tactic", "publicity_event", "victim_pressure_tactic"].includes(entity.type)) return "publicity";
  if (entity.type === "buyer_seller_communication") return "buyer_victim_communication";
  if (entity.type === "intermediary_communication") return "intermediary_communication";
  if (entity.type === "communication_channel") return "communication_channel";
  if (["advertised_product", "advertised_data", "dataset"].includes(entity.type)) return "advertised_offering";
  return "operating_model";
}

function rankBusinessCases(cases: any[]) {
  const remaining = [...cases];
  const uncovered = new Set(remaining.flatMap((entry) => entry.categories));
  const ranked: any[] = [];
  while (remaining.length) {
    remaining.sort((left, right) => {
      const uncoveredDifference = right.categories.filter((category: string) => uncovered.has(category)).length
        - left.categories.filter((category: string) => uncovered.has(category)).length;
      return uncoveredDifference
        || right.categories.length - left.categories.length
        || right.findingCount - left.findingCount
        || left.actor.localeCompare(right.actor);
    });
    const selected = remaining.shift();
    ranked.push(selected);
    for (const category of selected.categories) uncovered.delete(category);
  }
  return ranked;
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

function assess(rows: any[], records: ReturnType<typeof searchRecords>, generatedAt: string) {
  const contradicted = records.claims.filter((claim: any) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted").length;
  const rejected = records.claims.filter((claim: any) => claim.reviewState === "rejected").length;
  const stale = records.claims.filter((claim: any) => staleAt(claim, generatedAt)).length;
  const eligibleClaims = records.claims.filter((claim: any) => eligibleSupportClaim(claim, generatedAt));
  const confirmed = eligibleClaims.filter((claim: any) => claim.reviewState === "confirmed").length;
  const corroborated = eligibleClaims.filter((claim: any) => claim.corroborationState === "corroborated" && supportsActivityCorroboration(claim)).length;
  const validated = records.validations.filter((record: any) => ["supported", "confirmed", "validated"].includes(record.status)).length;
  const signals = [...eligibleClaims, ...records.entities, ...records.indicators].map((record: any) => confidence(record.confidence)).filter((value) => value > 0);
  let score = signals.length ? signals.reduce((sum, value) => sum + value, 0) / signals.length : rows.length ? 0.35 : 0;
  if (records.sourceCount < 2) score = Math.min(score, 0.69);
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
    contradicted ? `${contradicted} contradicted claim(s) prevent promotion.` : "No stored contradiction is attached.",
    rejected ? `${rejected} claim(s) were rejected by review and are not used as support.` : "",
    stale ? `${stale} claim(s) passed their stored stale-after timestamp.` : ""
  ]);
  return { ready, confidence: Number(score.toFixed(3)), sourceCount: records.sourceCount, captureCount: rows.length, confirmedClaimCount: confirmed, corroboratedClaimCount: corroborated, validationCount: validated, contradictedClaimCount: contradicted, rejectedClaimCount: rejected, staleClaimCount: stale, metadataOnly: rows.length > 0 && rows.every((row) => row.metadataOnly), reasons };
}

function activity(row: any, records: ReturnType<typeof searchRecords>, fallbackConfidence: number, generatedAt: string) {
  const rowClaims = records.claims.filter((claim: any) => claim.captureIds?.includes(row.id));
  const activityClaims = rowClaims.filter(supportsActivityCorroboration);
  const eligibleActivityClaims = activityClaims.filter((claim: any) => eligibleSupportClaim(claim, generatedAt));
  const independence = eligibleActivityClaims.map((claim: any) => claim.sourceIndependence).filter(Boolean).sort((left: any, right: any) => right.groupCount - left.groupCount)[0];
  const independentGroups = independence?.groups ?? [];
  const corroboratingSourceIds = independentGroups.filter((group: any) => !group.sourceIds.includes(row.sourceId)).map((group: any) => group.sourceIds[0]).filter(Boolean);
  const contradictingSourceIds = unique(activityClaims.flatMap((claim: any) => claim.contradictingSourceIds ?? []));
  return {
    date: row.publishedAt,
    title: row.title,
    detail: row.summary,
    confidence: rowConfidence(row.id, records, fallbackConfidence, generatedAt),
    sourceIds: [row.sourceId],
    url: row.url,
    claimType: row.victimName ? "victim_claim" : row.tags?.some((tag: string) => /cve|exploit/i.test(tag)) ? "vulnerability_exploitation" : row.tags?.some((tag: string) => /malware|ransomware/i.test(tag)) ? "malware_activity" : "general_activity",
    victimName: row.victimName,
    affectedSectors: entityValues(characterizationEntities(records, "sector", generatedAt).filter((entity: any) => entity.captureId === row.id), "sector"),
    countries: entityValues(characterizationEntities(records, "country", generatedAt).filter((entity: any) => entity.captureId === row.id), "country"),
    impact: entityValues(characterizationEntities(records, "impact", generatedAt).filter((entity: any) => entity.captureId === row.id), "impact").join(", ") || undefined,
    firstReportedAt: row.publishedAt,
    lastReportedAt: row.publishedAt,
    publisherCount: Math.max(1, independentGroups.length),
    corroboratingSourceIds,
    contradictingSourceIds,
    assertionKind: "source_claim",
    reviewState: reviewStateFor(row.id, records, generatedAt),
    corroborationState: activityClaims.some((claim: any) => claim.corroborationState === "contradicted")
      ? "contradicted"
      : eligibleActivityClaims.some((claim: any) => claim.corroborationState === "corroborated")
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

function eligibleSupportClaim(claim: any, generatedAt: string) {
  return !["rejected", "contradicted", "needs_review"].includes(claim.reviewState)
    && claim.corroborationState !== "contradicted"
    && !staleAt(claim, generatedAt);
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
      assessment.contradictedClaimCount && "contradicted",
      assessment.rejectedClaimCount && "rejected",
      assessment.staleClaimCount && "stale"
    ]),
    analystActions: rows.length ? [{ kind: "review_claims", label: "Review claims", manualOnly: true, evidenceIds: rows.map((row) => row.id) }] : [{ kind: "request_more_capture_evidence", label: "Collect evidence", manualOnly: false, evidenceIds: [] }]
  };
}

function assertionsFor(captureId: string, records: ReturnType<typeof searchRecords>) {
  return records.entities.filter((entity: any) => entity.captureId === captureId).map((entity: any) => ({ id: entity.id, type: entity.type, value: safeText(entity.value, 240), confidence: confidence(entity.confidence), assertionKind: entity.assertionKind ?? "extracted", extractionMethod: entity.extractionMethod, extractorVersion: entity.extractorVersion, reviewReasons: entity.reviewReasons ?? [] }));
}

function reviewStateFor(captureId: string, records: ReturnType<typeof searchRecords>, generatedAt: string) {
  const claims = records.claims.filter((claim: any) => claim.captureIds?.includes(captureId));
  if (claims.some((claim: any) => claim.reviewState === "contradicted")) return "contradicted";
  if (claims.some((claim: any) => claim.reviewState === "rejected")) return "rejected";
  if (claims.some((claim: any) => staleAt(claim, generatedAt))) return "stale";
  if (claims.some((claim: any) => claim.reviewState === "confirmed")) return "confirmed";
  if (claims.some((claim: any) => claim.reviewState === "needs_review")) return "needs_review";
  return "unreviewed";
}

function rowConfidence(captureId: string, records: ReturnType<typeof searchRecords>, fallback: number, generatedAt: string) {
  const values = [...records.entities, ...records.indicators, ...records.claims]
    .filter((record: any) => record.captureId === captureId || record.captureIds?.includes(captureId))
    .filter((record: any) => !record.reviewState || eligibleSupportClaim(record, generatedAt))
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
  if ((store.listExtractedEntities?.() ?? []).some((entity: any) => (entity.tenantId || undefined) === tenantId && entity.type === "victim" && normalizeActorName(entity.value) === normalizeActorName(query))) return "organization";
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
  const profiles = (store.listActorProfiles?.() ?? []).filter((profile: any) => (profile.tenantId || undefined) === tenantId);
  const aliases = (store.listActorAliases?.() ?? []).filter((alias: any) => (alias.tenantId || undefined) === tenantId);
  const observedActorMatched = (store.listExtractedEntities?.() ?? []).some((entity: any) =>
    (entity.tenantId || undefined) === tenantId
    && ["actor", "ransomware_family"].includes(entity.type)
    && !["mention", "inferred"].includes(entity.assertionKind)
    && entity.extractionMethod === "source_specific"
    && normalizeActorName(entity.value) === normalizedQuery
  );
  const matchedProfileIds = new Set([
    ...profiles.filter((profile: any) => [profile.canonicalName, ...(profile.aliases ?? [])].some((value) => normalizeActorName(value) === normalizedQuery)).map((profile: any) => profile.id),
    ...aliases.filter((alias: any) => normalizeActorName(alias.normalizedAlias ?? alias.alias) === normalizedQuery).map((alias: any) => alias.actorProfileId)
  ]);
  const matchedProfiles = profiles.filter((profile: any) => matchedProfileIds.has(profile.id));
  const terms = unique([
    query,
    ...(catalogResolution.ambiguous ? [] : catalogResolution.candidates.flatMap((candidate) => [candidate.identity.canonicalName, ...candidate.identity.associatedNames])),
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
  return { matched: Boolean(catalogCandidates.length || matchedProfiles.length || observedActorMatched), terms, normalizedTerms: new Set(terms.map(normalizeActorName)), catalogCandidates, catalogAmbiguous: catalogResolution.ambiguous };
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

function missingFields(input: { query: string; entityType: SearchEntityType; actor?: string; victims: string[]; sectors: string[]; countries: string[]; ttps: any[]; records: ReturnType<typeof searchRecords>; generatedAt: string }) {
  const normalizedQuery = normalizeActorName(input.query);
  const common = [
    input.records.sourceCount >= 2 ? "" : "independent corroborating source",
    input.records.claims.some((claim: any) => claim.reviewState === "confirmed" && eligibleSupportClaim(claim, input.generatedAt)) ? "" : "analyst-confirmed claim",
    input.records.validations.length ? "" : "independent validation"
  ];
  if (input.entityType !== "actor") {
    const typedMatch = input.entityType === "organization"
      ? input.victims.some((victim) => normalizeActorName(victim) === normalizedQuery)
      : input.entityType === "domain" || input.entityType === "indicator" || input.entityType === "cve"
        ? input.records.indicators.some((indicator: any) => normalizeActorName(indicator.value) === normalizedQuery)
          || input.records.entities.some((entity: any) => normalizeActorName(entity.value) === normalizedQuery)
        : true;
    return [typedMatch ? "" : `${input.entityType} evidence`, ...common].filter(Boolean);
  }
  return [
    input.actor ? "" : "actor",
    input.victims.length ? "" : "victim",
    input.sectors.length ? "" : "sector",
    input.countries.length ? "" : "country",
    input.ttps.length ? "" : "TTP",
    ...common
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

function claimCounts(claims: any[], generatedAt: string) {
  return { total: claims.length, confirmed: claims.filter((claim) => claim.reviewState === "confirmed" && eligibleSupportClaim(claim, generatedAt)).length, needsReview: claims.filter((claim) => ["unreviewed", "needs_review"].includes(claim.reviewState)).length, rejected: claims.filter((claim) => claim.reviewState === "rejected").length, stale: claims.filter((claim) => staleAt(claim, generatedAt)).length, contradicted: claims.filter((claim) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted").length, corroborated: claims.filter((claim) => claim.corroborationState === "corroborated" && eligibleSupportClaim(claim, generatedAt)).length };
}

function characterizationEntities(records: ReturnType<typeof searchRecords>, type: string, generatedAt: string) {
  const confirmedEntityIds = new Set(records.claims.filter((claim: any) => claim.subjectType === "entity" && claim.reviewState === "confirmed" && eligibleSupportClaim(claim, generatedAt)).map((claim: any) => claim.subjectId));
  return records.entities.filter((entity: any) => entity.type === type && (entity.extractionMethod !== "deterministic_fallback" || confirmedEntityIds.has(entity.id)));
}

function queryWatchlistCandidates(query: string, entityType: SearchEntityType): Array<{ kind: "domain" | "company"; value: string; reason: string; confidence: number }> {
  if (entityType === "domain") return [{ kind: "domain", value: query.toLowerCase(), reason: "Exact domain supplied by the user; no activity is inferred from the query itself.", confidence: 1 }];
  if (entityType === "organization") return [{ kind: "company", value: query, reason: "Exact organization supplied by the user; no activity is inferred from the query itself.", confidence: 1 }];
  return [];
}

function staleAt(claim: any, generatedAt: string) {
  const staleAfter = Date.parse(String(claim.staleAfter ?? ""));
  return Number.isFinite(staleAfter) && staleAfter <= Date.parse(generatedAt);
}

function safeIndicators(indicators: any[]) {
  return unique(indicators
    .filter((indicator) => !indicator.reviewReasons?.length && !/\.onion\b|\[restricted/i.test(String(indicator.value)))
    .map((indicator) => indicator.type === "url" ? safePublicSearchUrl(indicator.value) : safeText(indicator.value, 240))
    .filter(Boolean));
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
