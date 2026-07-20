// @ts-nocheck
import { createHash } from "node:crypto";
import type { CaptureReplayJob, DiscoveryEvidence, EvidenceDelta, IncidentCandidate, LiveSearchSnapshot, PipelineResult, RawCapture, ReplayPipelineInput, SourceRecord } from "../types.ts";
import type { CaptureMetadataStore } from "./evidenceStore.ts";
import { InMemoryEvidenceQueries } from "./evidenceQueries.ts";
import { installMemoryStoreDiscoveryMethods } from "./memoryStoreDiscoveryMethods.ts";
import { InMemoryObjectEvidenceStore } from "./memoryObjectEvidenceStore.ts";
import { installMemoryStoreReplayMethods } from "./memoryStoreReplayMethods.ts";
import { canonicalizeUrl, captureDedupeKey, dedupeIndexKeys, enforceSensitiveMetadataOnly, prepareCapture } from "./memoryStoreHelpers.ts";
import { nowIso, stableId } from "../utils.ts";
export interface RawEvidenceStore extends CaptureMetadataStore {} export interface ScraperStore extends CaptureMetadataStore {}
const mapValues = <T>(map: Map<string, T>) => [...map.values()];
const put = <T extends { id: string }>(map: Map<string, T>, item: T) => (map.set(item.id, item), item);
export class InMemoryScraperStore implements ScraperStore {
  private captures = new Map<string, RawCapture>(); private dedupe = new Map<string, string>(); private incidents = new Map<string, IncidentCandidate>(); private sources = new Map<string, SourceRecord>(); private plans = new Map<string, any>(); private runs = new Map<string, any>();
  private extractedEntities = new Map<string, any>(); private indicators = new Map<string, any>(); private actorProfiles = new Map<string, any>(); private actorAliases = new Map<string, any>(); private evidenceLinks = new Map<string, any>(); private validationRecords = new Map<string, any>(); private evaluationLabels = new Map<string, any>();
  private sourceHealthObservations = new Map<string, any>(); private timelinessRecords = new Map<string, any>();
  private intelligenceClaims = new Map<string, any>(); private claimEvidence = new Map<string, any>(); private claimReviews = new Map<string, any>();
  private analystMetadataReviewTasks = new Map<string, any>(); private analystSourceActivationPackets = new Map<string, any>(); private analystVictimNotificationPackets = new Map<string, any>(); private analystClaimLedgerEntries = new Map<string, any>(); private analystLoopSnapshots = new Map<string, any>();
  private organizations = new Map<string, any>(); private organizationMembers = new Map<string, any>(); private organizationInvites = new Map<string, any>(); private webhookDestinations = new Map<string, any>();
  private cases = new Map<string, any>();
  private dwmWatchlists = new Map<string, any>(); private dwmAlerts = new Map<string, any>(); private dwmWebhookDeliveries = new Map<string, any>();
  private actorOrgRelevanceReviews = new Map<string, any>();
  private replayJobs = new Map<string, CaptureReplayJob>(); private discoveryEvidence = new Map<string, DiscoveryEvidence>(); private liveSearchSnapshots = new Map<string, LiveSearchSnapshot>(); private evidenceDeltas = new Map<string, EvidenceDelta>(); private cursorOwners = new Map<string, string>(); private sequence = 0;
  private evidenceQueries = new InMemoryEvidenceQueries(() => ({ captures: this.listCaptures(), incidents: this.listIncidents(), replayJobs: this.listReplayJobs(), discoveryEvidence: this.listDiscoveryEvidence(), liveSearchSnapshots: this.listLiveSearchSnapshots(), evidenceDeltas: this.listEvidenceDeltas() }));
  saveCapture(capture: RawCapture): RawCapture { return this.saveCaptureWithDedupe(capture).capture; }
  protected hydrateCaptureSnapshot(capture: RawCapture): RawCapture { return this.insertCapture(prepareCapture(capture), false); }
  saveCaptureWithDedupe(capture: RawCapture) {
    const prepared = prepareCapture(capture); enforceSensitiveMetadataOnly(prepared);
    const previous = this.captures.get(capture.id);
    if (previous) { if (previous.contentHash !== prepared.contentHash) throw new Error(`Capture is immutable: ${capture.id}`); return { capture: previous, status: "duplicate", duplicateOf: previous.id, dedupeKey: captureDedupeKey(previous) }; }
    const duplicate = this.findDuplicateCapture(prepared);
    if (duplicate) return { capture: duplicate, status: "duplicate", duplicateOf: duplicate.id, dedupeKey: captureDedupeKey(prepared) };
    return { capture: this.insertCapture(prepared, true), status: "inserted", dedupeKey: captureDedupeKey(prepared) };
  }
  private insertCapture(capture: RawCapture, delta: boolean) { this.captures.set(capture.id, capture); for (const key of dedupeIndexKeys(capture)) this.dedupe.set(key, capture.id); if (delta) this.recordCaptureDelta("added", capture); return capture; }
  getCapture(id: string) { return this.captures.get(id); }
  updateCaptureMetadata(id: string, update: (metadata: any) => any) { const previous = this.mustCapture(id); const next = { ...previous, metadata: update(previous.metadata ?? {}) }; this.captures.set(id, next); return next; }
  replaceCaptureForRetention(capture: RawCapture) { const previous = this.mustCapture(capture.id); if (previous.contentHash !== capture.contentHash || previous.sourceId !== capture.sourceId) throw new Error(`Retention cannot change capture identity: ${capture.id}`); this.captures.set(capture.id, capture); return capture; }
  findDuplicateCapture(capture: RawCapture) { const prepared = prepareCapture(capture); for (const key of dedupeIndexKeys(prepared)) { const id = this.dedupe.get(key); if (id) return this.captures.get(id); } }
  listCaptures() { return mapValues(this.captures); }
  savePipelineResult(result: PipelineResult): PipelineResult {
    const firstVisibleAt = result.capture.firstVisibleAt ?? nowIso();
    const capture = this.saveCapture({ ...result.capture, processedAt: result.capture.processedAt ?? firstVisibleAt, firstVisibleAt });
    const previousIncident = result.incident ? this.getIncident(result.incident.id) : undefined;
    const incident = result.incident ? this.saveIncident({
      ...result.incident,
      tenantId: capture.tenantId,
      sourceId: capture.sourceId,
      captureId: capture.id,
      reportedAt: result.incident.reportedAt ?? reportedAt(result.capture.metadata),
      publishedAt: result.incident.publishedAt ?? capture.publishedAt,
      collectedAt: result.incident.collectedAt ?? capture.collectedAt,
      processedAt: result.incident.processedAt ?? capture.processedAt,
      firstVisibleAt: previousIncident?.firstVisibleAt ?? capture.firstVisibleAt ?? firstVisibleAt
    }) : undefined;
    const extractorVersion = incident?.extractorVersion ?? capture.provenance?.extractorVersion ?? "unknown";
    const entities = (result.entities ?? []).map((entity: any) => ({ ...entity, id: entity.id ?? stableId("entity", `${capture.id}:${entity.type}:${normalized(entity)}`), tenantId: capture.tenantId, sourceId: capture.sourceId, captureId: capture.id, incidentId: incident?.id, extractorVersion: entity.extractorVersion ?? extractorVersion }));
    const indicators = (result.indicators ?? []).map((indicator: any) => ({ ...indicator, id: indicator.id ?? stableId("indicator", `${capture.id}:${indicator.type}:${normalized(indicator)}`), tenantId: capture.tenantId, sourceId: capture.sourceId, captureId: capture.id, incidentId: incident?.id, extractorVersion: indicator.extractorVersion ?? extractorVersion }));
    for (const entity of entities) this.saveExtractedEntity(entity);
    for (const indicator of indicators) this.saveIndicator(indicator);
    if (incident) {
      this.saveEvidenceLink(link(capture, "incident", incident.id, "supports", incident.confidence, extractorVersion));
      this.recordExtractionDelta("added", capture, incident.id);
    }
    for (const entity of entities) {
      this.saveEvidenceLink(link(capture, "entity", entity.id, "mentions", entity.confidence, extractorVersion));
      if (entity.type === "actor" || entity.type === "ransomware_family") {
        const profile = mergeActorProfile(this.getActorProfile(actorProfileId(capture, entity)), capture, entity);
        this.saveActorProfile(profile);
        this.saveEvidenceLink(link(capture, "actor_profile", profile.id, "characterizes", entity.confidence, extractorVersion));
      }
    }
    for (const indicator of indicators) this.saveEvidenceLink(link(capture, "indicator", indicator.id, "observes", indicator.confidence, extractorVersion));
    if (incident) recordClaim(this, capture, "incident", incident);
    for (const entity of entities) recordClaim(this, capture, "entity", entity);
    for (const indicator of indicators) recordClaim(this, capture, "indicator", indicator);
    if (incident) this.saveTimelinessRecord(timelinessRecord(capture, incident, this.getTimelinessRecord(incident.id)));
    return { ...result, capture, incident };
  }
  replayInput(captureId: string, extractorVersion: string): ReplayPipelineInput | undefined { const c = this.captures.get(captureId); return c && { captureId: c.id, sourceId: c.sourceId, url: c.url, collectedAt: c.collectedAt, mediaType: c.mediaType, storageKind: c.storageKind, body: c.body, objectRef: c.objectRef, metadata: c.metadata, contentHash: c.contentHash, normalizedTextHash: c.normalizedTextHash, extractorVersion }; }
  createReplayJob(input: any): CaptureReplayJob { throw new Error("prototype not installed"); }
  saveReplayJob(job: CaptureReplayJob): CaptureReplayJob { throw new Error("prototype not installed"); }
  recordReplayResult(jobId: string, result: PipelineResult): CaptureReplayJob { throw new Error("prototype not installed"); }
  getReplayJob(id: string) { return this.replayJobs.get(id); } listReplayJobs() { return mapValues(this.replayJobs); }
  private mustCapture(id: string) { const capture = this.getCapture(id); if (!capture) throw new Error(`Unknown capture for replay: ${id}`); return capture; }
  saveDiscoveryEvidence(evidence: DiscoveryEvidence): any { throw new Error("prototype not installed"); }
  protected hydrateDiscoveryEvidenceSnapshot(evidence: DiscoveryEvidence) { return put(this.discoveryEvidence, evidence); }
  getDiscoveryEvidence(id: string) { return this.discoveryEvidence.get(id); } listDiscoveryEvidence() { return mapValues(this.discoveryEvidence); }
  promoteDiscoveryEvidence(promotion: any): any { throw new Error("prototype not installed"); }
  saveLiveSearchSnapshot(snapshot: LiveSearchSnapshot): any { throw new Error("prototype not installed"); }
  protected hydrateLiveSearchSnapshotSnapshot(snapshot: LiveSearchSnapshot) { return put(this.liveSearchSnapshots, snapshot); }
  listLiveSearchSnapshots() { return mapValues(this.liveSearchSnapshots); }
  saveEvidenceDelta(delta: EvidenceDelta): any { throw new Error("prototype not installed"); }
  protected hydrateEvidenceDeltaSnapshot(delta: EvidenceDelta) { return (this as any).storeDelta(delta, false); }
  listEvidenceDeltas() { return mapValues(this.evidenceDeltas); }
  queries() { return this.evidenceQueries; }
  saveIncident(candidate: IncidentCandidate) { return put(this.incidents, candidate); } getIncident(id: string) { return this.incidents.get(id); } listIncidents() { return mapValues(this.incidents); }
  saveExtractedEntity(entity: any) { return put(this.extractedEntities, entity); } getExtractedEntity(id: string) { return this.extractedEntities.get(id); } listExtractedEntities() { return mapValues(this.extractedEntities); }
  saveIndicator(indicator: any) { return put(this.indicators, indicator); } getIndicator(id: string) { return this.indicators.get(id); } listIndicators() { return mapValues(this.indicators); }
  saveActorProfile(profile: any) {
    const stored = put(this.actorProfiles, profile);
    const aliases = unique([...(profile.aliases ?? []), profile.canonicalName]);
    const active = new Set(aliases.map((alias) => alias.toLowerCase()));
    for (const [id, record] of this.actorAliases) if (record.actorProfileId === profile.id && !active.has(record.normalizedAlias)) this.actorAliases.delete(id);
    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase();
      const id = stableId("actor-alias", `${profile.id}:${normalizedAlias}`);
      put(this.actorAliases, {
        id,
        tenantId: profile.tenantId,
        actorProfileId: profile.id,
        alias,
        normalizedAlias,
        confidence: profile.confidence ?? 0,
        firstSeenAt: profile.firstSeenAt,
        lastSeenAt: profile.lastSeenAt,
        evidenceCount: profile.evidenceCount ?? 1,
        sourceIds: profile.sourceIds ?? [],
        captureIds: profile.captureIds ?? [],
        updatedAt: profile.updatedAt ?? profile.lastSeenAt
      });
    }
    return stored;
  }
  getActorProfile(id: string) { return this.actorProfiles.get(id); } listActorProfiles() { return mapValues(this.actorProfiles); }
  getActorAlias(id: string) { return this.actorAliases.get(id); } listActorAliases() { return mapValues(this.actorAliases); }
  saveEvidenceLink(linkRecord: any) { return put(this.evidenceLinks, linkRecord); } getEvidenceLink(id: string) { return this.evidenceLinks.get(id); } listEvidenceLinks() { return mapValues(this.evidenceLinks); }
  saveValidationRecord(record: any) { return put(this.validationRecords, record); } getValidationRecord(id: string) { return this.validationRecords.get(id); } listValidationRecords() { return mapValues(this.validationRecords); }
  saveEvaluationLabel(label: any) { const previous = this.evaluationLabels.get(label.id); if (previous && canonicalJson(previous) !== canonicalJson(label)) throw new Error(`Evaluation label is immutable: ${label.id}`); return previous ?? put(this.evaluationLabels, label); } getEvaluationLabel(id: string) { return this.evaluationLabels.get(id); } listEvaluationLabels() { return mapValues(this.evaluationLabels); }
  saveIntelligenceClaim(claim: any) { return put(this.intelligenceClaims, claim); } getIntelligenceClaim(id: string) { return this.intelligenceClaims.get(id); } listIntelligenceClaims() { return mapValues(this.intelligenceClaims); }
  saveClaimEvidence(evidence: any) { return put(this.claimEvidence, evidence); } getClaimEvidence(id: string) { return this.claimEvidence.get(id); } listClaimEvidence() { return mapValues(this.claimEvidence); }
  saveClaimReview(review: any) {
    const claim = this.getIntelligenceClaim(review.claimId);
    if (!claim) throw new Error(`Unknown intelligence claim: ${review.claimId}`);
    const nextState = claimStateForReview(review.action, claim.reviewState);
    const storedReview = put(this.claimReviews, { ...review, previousState: claim.reviewState, nextState });
    const legalHold = review.action === "attach_legal_hold" ? true : review.action === "release_legal_hold" ? false : claim.legalHold ?? false;
    const updated = this.saveIntelligenceClaim({
      ...claim,
      reviewState: nextState,
      corroborationState: nextState === "contradicted" ? "contradicted" : claim.corroborationState === "contradicted" ? "single_source" : claim.corroborationState,
      reviewedBy: review.reviewerId,
      reviewedAt: review.reviewedAt,
      contradictionReason: nextState === "contradicted" ? review.reason : nextState === "confirmed" ? undefined : claim.contradictionReason,
      legalHold,
      retentionClass: legalHold ? "legal_hold" : claim.retentionClass === "legal_hold" ? "standard" : claim.retentionClass ?? "standard",
      updatedAt: review.reviewedAt
    });
    return { review: storedReview, claim: updated };
  }
  getClaimReview(id: string) { return this.claimReviews.get(id); } listClaimReviews() { return mapValues(this.claimReviews); }
  saveSourceHealthObservation(observation: any) { return put(this.sourceHealthObservations, observation); } getSourceHealthObservation(id: string) { return this.sourceHealthObservations.get(id); } listSourceHealthObservations() { return mapValues(this.sourceHealthObservations); }
  saveTimelinessRecord(record: any) { return put(this.timelinessRecords, record); } getTimelinessRecord(id: string) { return this.timelinessRecords.get(id); } listTimelinessRecords() { return mapValues(this.timelinessRecords); }
  saveSource(source: SourceRecord) { return put(this.sources, source); } getSource(id: string) { return this.sources.get(id); } listSources() { return mapValues(this.sources); }
  savePlan(plan: any) { return put(this.plans, plan); } getPlan(id: string) { return this.plans.get(id); } listPlans() { return mapValues(this.plans); }
  saveRun(run: any) { return put(this.runs, run); } getRun(id: string) { return this.runs.get(id); } findRunByIdempotencyKey(tenantId: string | undefined, key: string) { return mapValues(this.runs).find((run) => run.tenantId === tenantId && run.idempotencyKey === key); } listRuns() { return mapValues(this.runs); }
  saveAnalystMetadataReviewTask(task: any) { if (task.unsafeMaterialAccessed !== false) throw new Error(`Analyst metadata review task must not record unsafe material access: ${task.id}`); return put(this.analystMetadataReviewTasks, task); } getAnalystMetadataReviewTask(id: string) { return this.analystMetadataReviewTasks.get(id); } listAnalystMetadataReviewTasks() { return mapValues(this.analystMetadataReviewTasks); }
  saveAnalystSourceActivationPacket(packet: any) { if (packet.dryRun !== true) throw new Error(`Analyst source activation packet must be dry-run only: ${packet.id}`); return put(this.analystSourceActivationPackets, packet); } listAnalystSourceActivationPackets() { return mapValues(this.analystSourceActivationPackets); }
  saveAnalystVictimNotificationPacket(packet: any) { return put(this.analystVictimNotificationPackets, packet); } listAnalystVictimNotificationPackets() { return mapValues(this.analystVictimNotificationPackets); }
  saveAnalystClaimLedgerEntry(entry: any) {
    const safeEntry = stripForbiddenClaimMaterial(entry);
    const stored = put(this.analystClaimLedgerEntries, safeEntry);
    this.saveIntelligenceClaim(claimFromAnalystEntry(safeEntry, this.getIntelligenceClaim(safeEntry.id)));
    const capture = safeEntry.captureId ? this.getCapture(safeEntry.captureId) : undefined;
    if (capture) recordAnalystClaimEvidence(this, capture, safeEntry);
    return stored;
  }
  listAnalystClaimLedgerEntries() { return mapValues(this.analystClaimLedgerEntries); }
  saveAnalystLoopSnapshot(snapshot: any) { return put(this.analystLoopSnapshots, snapshot); } listAnalystLoopSnapshots() { return mapValues(this.analystLoopSnapshots); }
  saveOrganization(organization: any) { return put(this.organizations, organization); } getOrganization(id: string) { return this.organizations.get(id); } listOrganizations() { return mapValues(this.organizations); }
  saveOrganizationMember(member: any) { return put(this.organizationMembers, member); } getOrganizationMember(id: string) { return this.organizationMembers.get(id); } listOrganizationMembers() { return mapValues(this.organizationMembers); }
  saveOrganizationInvite(invite: any) { return put(this.organizationInvites, invite); } getOrganizationInvite(id: string) { return this.organizationInvites.get(id); } listOrganizationInvites() { return mapValues(this.organizationInvites); }
  saveWebhookDestination(destination: any) { return put(this.webhookDestinations, destination); } getWebhookDestination(id: string) { return this.webhookDestinations.get(id); } listWebhookDestinations() { return mapValues(this.webhookDestinations); }
  saveCase(caseRecord: any) { return put(this.cases, caseRecord); } getCase(id: string) { return this.cases.get(id); } listCases() { return mapValues(this.cases); }
  saveDwmWatchlist(watchlist: any) { return put(this.dwmWatchlists, watchlist); } getDwmWatchlist(id: string) { return this.dwmWatchlists.get(id); } listDwmWatchlists() { return mapValues(this.dwmWatchlists); }
  saveDwmAlert(alert: any) {
    const stored = put(this.dwmAlerts, alert);
    const alertedAt = alert.alertedAt ?? alert.deliveredAt ?? (alert.deliveryState === "delivered" ? alert.updatedAt : undefined);
    const timeliness = alert.incidentId ? this.getTimelinessRecord(alert.incidentId) : undefined;
    if (timeliness && alertedAt) this.saveTimelinessRecord(withAlertedAt(timeliness, alertedAt));
    return stored;
  }
  getDwmAlert(id: string) { return this.dwmAlerts.get(id); } listDwmAlerts() { return mapValues(this.dwmAlerts); }
  saveDwmWebhookDelivery(delivery: any) { return put(this.dwmWebhookDeliveries, delivery); } getDwmWebhookDelivery(id: string) { return this.dwmWebhookDeliveries.get(id); } listDwmWebhookDeliveries() { return mapValues(this.dwmWebhookDeliveries); }
  saveActorOrgRelevanceReview(review: any) { return put(this.actorOrgRelevanceReviews, review); } getActorOrgRelevanceReview(id: string) { return this.actorOrgRelevanceReviews.get(id); } listActorOrgRelevanceReviews() { return mapValues(this.actorOrgRelevanceReviews); }
}
installMemoryStoreReplayMethods(InMemoryScraperStore); installMemoryStoreDiscoveryMethods(InMemoryScraperStore);
export { canonicalizeUrl, captureDedupeKey, InMemoryObjectEvidenceStore };

function normalized(record: any): string { return String(record.normalizedValue ?? record.value ?? "").trim().toLowerCase(); }
function actorProfileId(capture: any, entity: any): string { return stableId("actor", `${capture.tenantId ?? "global"}:${actorType(entity)}:${normalized(entity)}`); }
function actorType(entity: any): string { return entity.type === "ransomware_family" ? "ransomware" : /^apt\d+$/i.test(String(entity.value)) ? "apt" : "threat_actor"; }
function mergeActorProfile(previous: any, capture: any, entity: any): any {
  const observedAt = capture.publishedAt ?? capture.collectedAt;
  const captureIds = unique([...(previous?.captureIds ?? []), capture.id]);
  return {
    ...(previous ?? {}),
    id: actorProfileId(capture, entity),
    tenantId: capture.tenantId,
    canonicalName: entity.value,
    normalizedName: normalized(entity),
    actorType: actorType(entity),
    aliases: unique([...(previous?.aliases ?? []), ...(entity.aliases ?? []), entity.rawValue, entity.value]),
    confidence: Math.max(previous?.confidence ?? 0, entity.confidence ?? 0),
    firstSeenAt: earlier(previous?.firstSeenAt, observedAt),
    lastSeenAt: later(previous?.lastSeenAt, observedAt),
    evidenceCount: captureIds.length,
    sourceIds: unique([...(previous?.sourceIds ?? []), capture.sourceId]),
    captureIds,
    updatedAt: capture.collectedAt
  };
}
function link(capture: any, subjectType: string, subjectId: string, relationship: string, confidence: number, extractorVersion: string): any {
  return { id: stableId("evidence-link", `${capture.id}:${subjectType}:${subjectId}:${relationship}`), tenantId: capture.tenantId, captureId: capture.id, subjectType, subjectId, relationship, confidence, extractorVersion, createdAt: capture.collectedAt };
}
function recordClaim(store: any, capture: any, subjectType: "incident" | "entity" | "indicator", subject: any): void {
  const claimType = subjectType === "incident" ? "incident" : String(subject.type ?? subjectType);
  const normalizedValue = subjectType === "incident" ? String(subject.title ?? subject.id).trim().toLowerCase() : normalized(subject);
  if (!normalizedValue) return;
  const id = portableClaimId(`${capture.tenantId ?? "global"}:${claimType}:${normalizedValue}`);
  const evidenceId = stableId("claim-evidence", `${id}:${capture.id}:${subjectType}:${subject.id}`);
  const previous = store.getIntelligenceClaim(id);
  const previousEvidence = store.getClaimEvidence(evidenceId);
  const sourceIds = unique([...(previous?.sourceIds ?? []), capture.sourceId]);
  const captureIds = unique([...(previous?.captureIds ?? []), capture.id]);
  const observedAt = capture.publishedAt ?? capture.collectedAt;
  const stage = evidenceStage(capture);
  const uncertaintyReasons = unique([...(previous?.uncertaintyReasons ?? []), ...(subject.reviewReasons ?? []), ...(stage === "metadata_only_claim" ? ["metadata-only evidence requires review"] : [])]);
  const defaultReviewState = subject.confidence < 0.65 || uncertaintyReasons.length ? "needs_review" : "unreviewed";
  const reviewState = previous?.reviewState && !["unreviewed", "needs_review"].includes(previous.reviewState) ? previous.reviewState : previous?.reviewState === "needs_review" || defaultReviewState === "needs_review" ? "needs_review" : "unreviewed";
  const corroborationState = reviewState === "contradicted" ? "contradicted" : sourceIds.length >= 2 ? "corroborated" : "single_source";
  const value = subjectType === "incident"
    ? { title: subject.title, summary: subject.summary }
    : { type: subject.type, value: subject.value, normalizedValue: subject.normalizedValue ?? subject.value };
  const claim = store.saveIntelligenceClaim({
    ...(previous ?? {}),
    id,
    tenantId: capture.tenantId,
    claimType,
    subjectType: previous?.subjectType ?? subjectType,
    subjectId: previous?.subjectId ?? subject.id,
    value,
    summary: subjectType === "incident" ? String(subject.title ?? subject.id).slice(0, 500) : `${claimType}: ${String(subject.value ?? "")}`.slice(0, 500),
    confidence: Math.max(previous?.confidence ?? 0, subject.confidence ?? 0),
    evidenceStage: strongerEvidenceStage(previous?.evidenceStage, stage),
    extractionMethod: capture.metadata?.extractionMethod ?? "deterministic_extraction",
    extractorVersion: subject.extractorVersion ?? capture.provenance?.extractorVersion,
    reviewState,
    corroborationState,
    sourceCount: sourceIds.length,
    evidenceCount: (previous?.evidenceCount ?? 0) + (previousEvidence ? 0 : 1),
    firstSeenAt: earlier(previous?.firstSeenAt, observedAt),
    lastSeenAt: later(previous?.lastSeenAt, observedAt),
    sourceIds,
    captureIds,
    uncertaintyReasons,
    legalHold: previous?.legalHold ?? false,
    retentionClass: previous?.retentionClass ?? "standard",
    createdAt: previous?.createdAt ?? capture.collectedAt,
    updatedAt: capture.collectedAt
  });
  const claimEvidence = {
    id: evidenceId,
    tenantId: capture.tenantId,
    claimId: claim.id,
    captureId: capture.id,
    sourceId: capture.sourceId,
    subjectType,
    subjectId: subject.id,
    relationship: "supports",
    evidenceStage: stage,
    confidence: subject.confidence ?? 0,
    extractorVersion: subject.extractorVersion ?? capture.provenance?.extractorVersion,
    provenance: subject.provenance ?? capture.provenance ?? {},
    createdAt: capture.collectedAt
  };
  store.saveClaimEvidence(claimEvidence);
  store.saveEvidenceLink(link(capture, "claim", claim.id, "supports", claimEvidence.confidence, claimEvidence.extractorVersion ?? "unknown"));
}
function claimFromAnalystEntry(entry: any, previous?: any): any {
  const observedAt = validIso(entry.observedAt) ?? validIso(entry.createdAt) ?? nowIso();
  const sourceIds = unique([...(previous?.sourceIds ?? []), entry.sourceId]);
  const captureIds = unique([...(previous?.captureIds ?? []), entry.captureId]);
  const reviewState = entry.ledgerStatus === "trusted" ? "confirmed" : entry.ledgerStatus === "rejected" ? "rejected" : entry.ledgerStatus === "contradicted" ? "contradicted" : previous?.reviewState ?? "needs_review";
  return {
    ...(previous ?? {}),
    id: entry.id,
    tenantId: entry.tenantId,
    claimType: entry.claimKind ?? "analyst_claim",
    subjectType: "analyst",
    subjectId: entry.id,
    value: Object.fromEntries(Object.entries({ company: entry.company, victim: entry.victim, datasetType: entry.datasetType }).filter(([, value]) => value !== undefined)),
    summary: String(entry.claimTextSummary ?? "Analyst claim").slice(0, 500),
    confidence: Math.max(0, Math.min(1, Number(entry.confidence ?? previous?.confidence ?? 0))),
    evidenceStage: entry.provenance?.sourceFamily === "restricted_metadata" ? "metadata_only_claim" : "analyst_assertion",
    extractionMethod: "analyst",
    reviewState,
    corroborationState: reviewState === "contradicted" ? "contradicted" : sourceIds.length >= 2 ? "corroborated" : "single_source",
    sourceCount: Math.max(1, sourceIds.length),
    evidenceCount: Math.max(1, captureIds.length),
    firstSeenAt: earlier(previous?.firstSeenAt, observedAt),
    lastSeenAt: later(previous?.lastSeenAt, observedAt),
    reviewedBy: entry.reviewedBy ?? previous?.reviewedBy,
    reviewedAt: validIso(entry.reviewedAt) ?? previous?.reviewedAt,
    sourceIds,
    captureIds,
    legalHold: entry.legalHold ?? previous?.legalHold ?? false,
    retentionClass: entry.legalHold ? "legal_hold" : entry.retentionClass ?? previous?.retentionClass ?? "standard",
    createdAt: previous?.createdAt ?? entry.createdAt ?? observedAt,
    updatedAt: entry.updatedAt ?? entry.reviewedAt ?? observedAt
  };
}
function recordAnalystClaimEvidence(store: any, capture: any, entry: any): void {
  const id = stableId("claim-evidence", `${entry.id}:${capture.id}:analyst:${entry.id}`);
  store.saveClaimEvidence({ id, tenantId: entry.tenantId ?? capture.tenantId, claimId: entry.id, captureId: capture.id, sourceId: entry.sourceId ?? capture.sourceId, subjectType: "analyst", subjectId: entry.id, relationship: "supports", evidenceStage: entry.provenance?.sourceFamily === "restricted_metadata" ? "metadata_only_claim" : evidenceStage(capture), confidence: entry.confidence ?? 0, extractorVersion: "analyst", provenance: entry.provenance ?? {}, createdAt: entry.observedAt ?? capture.collectedAt });
  store.saveEvidenceLink(link(capture, "claim", entry.id, "supports", entry.confidence ?? 0, "analyst"));
}
function evidenceStage(capture: any): string { return capture.storageKind === "metadata_only" || capture.sensitive ? "metadata_only_claim" : capture.metadata?.evidenceStage ?? "captured_page"; }
function portableClaimId(key: string): string { return `claim_${createHash("md5").update(key).digest("hex")}`; }
function strongerEvidenceStage(previous: string | undefined, next: string): string { const rank: Record<string, number> = { metadata_only_claim: 1, live_snippet: 1, analyst_assertion: 2, captured_page: 3, reviewed_promoted: 4 }; return !previous || (rank[next] ?? 0) > (rank[previous] ?? 0) ? next : previous; }
function claimStateForReview(action: string, previous: string): string {
  if (action === "confirm") return "confirmed";
  if (action === "reject") return "rejected";
  if (action === "mark_needs_review") return "needs_review";
  if (action === "mark_contradicted") return "contradicted";
  if (action === "reset") return "unreviewed";
  if (action === "attach_legal_hold" || action === "release_legal_hold") return previous;
  throw new Error(`Unsupported claim review action: ${action}`);
}
function stripForbiddenClaimMaterial(value: any): any {
  if (Array.isArray(value)) return value.map(stripForbiddenClaimMaterial);
  if (!value || typeof value !== "object") return value;
  const forbidden = new Set(["rawbody", "rawpayload", "leakedrows", "credentialvalues", "downloadeddataset", "password", "cookie", "authorization"]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.has(key.toLowerCase())).map(([key, nested]) => [key, stripForbiddenClaimMaterial(nested)]));
}
function reportedAt(metadata: any): string | undefined { return validIso(metadata?.reportedAt) ?? validIso(metadata?.incidentDate); }
function timelinessRecord(capture: any, incident: any, previous?: any): any {
  const record = {
    id: incident.id,
    tenantId: incident.tenantId ?? capture.tenantId,
    sourceId: incident.sourceId ?? capture.sourceId,
    captureId: capture.id,
    incidentId: incident.id,
    reportedAt: incident.reportedAt,
    publishedAt: incident.publishedAt ?? capture.publishedAt,
    collectedAt: incident.collectedAt ?? capture.collectedAt,
    processedAt: incident.processedAt ?? capture.processedAt,
    firstVisibleAt: previous?.firstVisibleAt ?? incident.firstVisibleAt ?? capture.firstVisibleAt,
    alertedAt: previous?.alertedAt,
    updatedAt: incident.updatedAt ?? capture.firstVisibleAt ?? nowIso()
  };
  return { ...record, latencies: latencyFields(record), timestampAnomalies: timestampAnomalies(record) };
}
function withAlertedAt(record: any, alertedAt: string): any {
  const next = { ...record, alertedAt: earlier(record.alertedAt, alertedAt), updatedAt: alertedAt };
  return { ...next, latencies: latencyFields(next), timestampAnomalies: timestampAnomalies(next) };
}
function latencyFields(record: any) {
  return {
    reportToPublicationSeconds: elapsed(record.reportedAt, record.publishedAt),
    publicationToCollectionSeconds: elapsed(record.publishedAt, record.collectedAt),
    collectionToProcessingSeconds: elapsed(record.collectedAt, record.processedAt),
    processingToVisibilitySeconds: elapsed(record.processedAt, record.firstVisibleAt),
    visibilityToAlertSeconds: elapsed(record.firstVisibleAt, record.alertedAt),
    reportToVisibilitySeconds: elapsed(record.reportedAt ?? record.publishedAt, record.firstVisibleAt),
    reportToAlertSeconds: elapsed(record.reportedAt ?? record.publishedAt, record.alertedAt)
  };
}
function timestampAnomalies(record: any): string[] {
  return [
    negative("reported_after_publication", record.reportedAt, record.publishedAt),
    negative("published_after_collection", record.publishedAt, record.collectedAt),
    negative("collected_after_processing", record.collectedAt, record.processedAt),
    negative("processed_after_visibility", record.processedAt, record.firstVisibleAt),
    negative("visible_after_alert", record.firstVisibleAt, record.alertedAt)
  ].filter(Boolean) as string[];
}
function elapsed(from: unknown, to: unknown): number | undefined { const start = Date.parse(String(from ?? "")), end = Date.parse(String(to ?? "")); return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 1000) : undefined; }
function negative(code: string, from: unknown, to: unknown): string | undefined { const value = elapsed(from, to); return value !== undefined && value < 0 ? code : undefined; }
function validIso(value: unknown): string | undefined { const time = Date.parse(String(value ?? "")); return Number.isFinite(time) ? new Date(time).toISOString() : undefined; }
function canonicalJson(value: any): string { return JSON.stringify(canonicalValue(value)); }
function canonicalValue(value: any): any { if (Array.isArray(value)) return value.map(canonicalValue); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonicalValue(value[key])])); return value; }
function unique(values: any[]): string[] { return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]; }
function earlier(a: string | undefined, b: string): string { return !a || Date.parse(b) < Date.parse(a) ? b : a; }
function later(a: string | undefined, b: string): string { return !a || Date.parse(b) > Date.parse(a) ? b : a; }
