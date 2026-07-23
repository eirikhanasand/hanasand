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
import { canonicalActorIdentity, resolveMitreActorIdentity, type ActorIdentityRecord, type MitreActorCatalogSnapshot, type MitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
export interface RawEvidenceStore extends CaptureMetadataStore {} export interface ScraperStore extends CaptureMetadataStore {}
const mapValues = <T>(map: Map<string, T>) => [...map.values()];
const put = <T extends { id: string }>(map: Map<string, T>, item: T) => (map.set(item.id, item), item);
export class InMemoryScraperStore implements ScraperStore {
  private captures = new Map<string, RawCapture>(); private dedupe = new Map<string, string>(); private incidents = new Map<string, IncidentCandidate>(); private sources = new Map<string, SourceRecord>(); private plans = new Map<string, any>(); private runs = new Map<string, any>();
  private extractedEntities = new Map<string, any>(); private indicators = new Map<string, any>(); private actorProfiles = new Map<string, any>(); private actorAliases = new Map<string, any>(); private actorIdentityCatalogs = new Map<string, any>(); private actorIdentities = new Map<string, any>(); private evidenceLinks = new Map<string, any>(); private validationRecords = new Map<string, any>(); private evaluationLabels = new Map<string, any>();
  private sourceHealthObservations = new Map<string, any>(); private timelinessRecords = new Map<string, any>();
  private evaluationBenchmarks = new Map<string, any>(); private evaluationAnnotations = new Map<string, any>(); private evaluationAdjudications = new Map<string, any>();
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
    const capture = this.saveCaptureWithDedupe({ ...result.capture, processedAt: result.capture.processedAt ?? firstVisibleAt, firstVisibleAt }).capture;
    const linkedIncident = this.listEvidenceLinks()
      .filter((record: any) => record.captureId === capture.id && record.subjectType === "incident" && record.relationship === "supports")
      .map((record: any) => this.getIncident(record.subjectId))
      .find(Boolean);
    const incidentInput = result.incident && linkedIncident ? { ...result.incident, id: linkedIncident.id } : result.incident;
    const previousIncident = incidentInput ? this.getIncident(incidentInput.id) : undefined;
    const reporting = mergeReportTimeline(previousIncident, reportTimeline(capture, this.getSource(capture.sourceId)));
    const incident = incidentInput ? this.saveIncident({
      ...incidentInput,
      tenantId: capture.tenantId,
      sourceId: capture.sourceId,
      captureId: capture.id,
      firstSeenAt: previousIncident?.firstSeenAt ?? validIso(result.incident.firstSeenAt) ?? capture.publishedAt ?? capture.collectedAt,
      ...reporting,
      publishedAt: reporting.publisherReportedAt,
      collectedAt: capture.collectedAt,
      processedAt: capture.processedAt ?? result.incident.processedAt,
      firstVisibleAt: capture.firstVisibleAt ?? firstVisibleAt,
      ...preservedIncidentReview(previousIncident, incidentInput)
    }) : undefined;
    const extractorVersion = incident?.extractorVersion ?? capture.provenance?.extractorVersion ?? "unknown";
    const entities = (result.entities ?? []).map((entity: any) => ({ ...entity, id: entity.id ?? stableId("entity", `${capture.id}:${entity.type}:${normalized(entity)}`), tenantId: capture.tenantId, sourceId: capture.sourceId, captureId: capture.id, incidentId: incident?.id, extractorVersion: entity.extractorVersion ?? extractorVersion }));
    const indicators = (result.indicators ?? []).map((indicator: any) => ({ ...indicator, id: indicator.id ?? stableId("indicator", `${capture.id}:${indicator.type}:${normalized(indicator)}`), tenantId: capture.tenantId, sourceId: capture.sourceId, captureId: capture.id, incidentId: incident?.id, extractorVersion: indicator.extractorVersion ?? extractorVersion }));
    for (const entity of entities) this.saveExtractedEntity(entity);
    for (const indicator of indicators) this.saveIndicator(indicator);
    if (incident) {
      const relationshipExists = this.listEvidenceLinks().some((record: any) => record.captureId === capture.id && record.subjectType === "incident" && record.subjectId === incident.id && record.relationship === "supports");
      this.saveEvidenceLink(link(capture, "incident", incident.id, "supports", incident.confidence, extractorVersion));
      if (!relationshipExists) this.recordExtractionDelta("added", capture, incident.id);
    }
    const actorEntities = entities.filter((entity: any) => entity.type === "actor" || entity.type === "ransomware_family");
    const characterize = new Set(actorEntities.map(normalized)).size === 1;
    for (const entity of entities) {
      this.saveEvidenceLink(link(capture, "entity", entity.id, "mentions", entity.confidence, extractorVersion));
      if (entity.type === "actor" || entity.type === "ransomware_family") {
        const resolution = actorProfileResolution(this, capture, entity);
        if (!resolution) continue;
        const previous = this.getActorProfile(resolution.profileId) ?? mapValues(this.actorProfiles).find((profile: any) => actorProfileMatches(this, profile, resolution));
        const profile = mergeActorProfile(previous, capture, entity, characterize ? entities : [], resolution);
        this.saveActorProfile(profile);
        this.saveEvidenceLink(link(capture, "actor_profile", profile.id, "characterizes", entity.confidence, extractorVersion));
        recordActorProfileDelta(this, previous, profile, capture, incident);
      }
    }
    for (const indicator of indicators) this.saveEvidenceLink(link(capture, "indicator", indicator.id, "observes", indicator.confidence, extractorVersion));
    if (incident) recordClaim(this, capture, "incident", incident);
    for (const entity of entities) recordClaim(this, capture, "entity", entity);
    for (const indicator of indicators) recordClaim(this, capture, "indicator", indicator);
    if (incident) {
      const previousTimeliness = this.getTimelinessRecord(incident.id);
      const timingCapture = this.getCapture(previousTimeliness?.captureId) ?? capture;
      this.saveTimelinessRecord(timelinessRecord(timingCapture, incident, previousTimeliness));
    }
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
  getActorProfile(id: string) { return this.actorProfiles.get(id); } listActorProfiles() { return mapValues(this.actorProfiles).filter(activeActorProfile); }
  getActorAlias(id: string) { return this.actorAliases.get(id); } listActorAliases() { return mapValues(this.actorAliases).filter((alias: any) => activeActorProfile(this.actorProfiles.get(alias.actorProfileId))); }
  protected actorProfilesForPersistence() { return mapValues(this.actorProfiles); }
  protected actorAliasesForPersistence() { return mapValues(this.actorAliases); }
  protected hydrateActorAliasSnapshot(alias: any) { return put(this.actorAliases, alias); }
  async listActorProfilesForOwnership() { return this.actorProfilesForPersistence(); }
  async listActorAliasesForOwnership() { return this.actorAliasesForPersistence(); }
  async listActorProfileIdentityHistoryForOwnership(): Promise<any[]> { return []; }
  async replaceActorProfileIdentityHistoryForRetention(_record: any): Promise<any | undefined> { return undefined; }
  replaceActorIdentityCatalog(snapshot: MitreActorCatalogSnapshot, provenance: { sourceId: string; captureId: string; importedAt?: string }) {
    const incomingIds = new Set(snapshot.identities.map((identity) => identity.id));
    if (incomingIds.size !== snapshot.identities.length || snapshot.counts.totalIdentityCount !== snapshot.identities.length) throw new Error("Actor identity catalog count mismatch.");
    const importedAt = provenance.importedAt ?? snapshot.retrievedAt;
    const previous = this.actorIdentityCatalogs.get(snapshot.catalogId);
    const retired = this.listActorIdentities().filter((identity: any) => identity.catalogId === snapshot.catalogId && !incomingIds.has(identity.id)).map((identity: any) => ({ ...identity, status: "retired", retiredAt: importedAt, updatedAt: importedAt }));
    const identities = snapshot.identities.map((identity: MitreActorIdentity) => ({ ...identity, sourceId: provenance.sourceId, captureId: provenance.captureId, importedAt, updatedAt: importedAt }));
    const { identities: _omitted, ...catalog } = snapshot;
    put(this.actorIdentityCatalogs, {
      ...catalog,
      id: snapshot.catalogId,
      sourceId: provenance.sourceId,
      captureId: provenance.captureId,
      importedAt,
      updatedAt: importedAt,
      previousBundleSha256: previous?.bundleSha256,
      identityIds: identities.map((identity) => identity.id)
    });
    for (const identity of [...identities, ...retired]) put(this.actorIdentities, identity);
    return { catalogId: snapshot.catalogId, currentIdentityCount: snapshot.counts.currentIdentityCount, retainedHistoricalIdentityCount: retired.length, bundleSha256: snapshot.bundleSha256 };
  }
  protected hydrateActorIdentityCatalogSnapshot(catalog: any) { return put(this.actorIdentityCatalogs, catalog); }
  protected hydrateActorIdentitySnapshot(identity: any) { return put(this.actorIdentities, identity); }
  getActorIdentityCatalog(id: string) { return this.actorIdentityCatalogs.get(id); } listActorIdentityCatalogs() { return mapValues(this.actorIdentityCatalogs); }
  getActorIdentity(id: string) { return this.actorIdentities.get(id); } listActorIdentities() { return mapValues(this.actorIdentities); }
  saveEvidenceLink(linkRecord: any) { return put(this.evidenceLinks, linkRecord); } getEvidenceLink(id: string) { return this.evidenceLinks.get(id); } listEvidenceLinks() { return mapValues(this.evidenceLinks); }
  saveValidationRecord(record: any) { return put(this.validationRecords, record); } getValidationRecord(id: string) { return this.validationRecords.get(id); } listValidationRecords() { return mapValues(this.validationRecords); }
  saveEvaluationLabel(label: any) { const previous = this.evaluationLabels.get(label.id); if (previous && canonicalJson(previous) !== canonicalJson(label)) throw new Error(`Evaluation label is immutable: ${label.id}`); return previous ?? put(this.evaluationLabels, label); } getEvaluationLabel(id: string) { return this.evaluationLabels.get(id); } listEvaluationLabels() { return mapValues(this.evaluationLabels); }
  saveEvaluationBenchmark(record: any) { return put(this.evaluationBenchmarks, record); } getEvaluationBenchmark(id: string) { return this.evaluationBenchmarks.get(id); } listEvaluationBenchmarks() { return mapValues(this.evaluationBenchmarks); }
  saveEvaluationAnnotation(record: any) { const previous = this.evaluationAnnotations.get(record.id); if (previous && canonicalJson(previous) !== canonicalJson(record)) throw new Error(`Evaluation annotation is immutable: ${record.id}`); return previous ?? put(this.evaluationAnnotations, record); } getEvaluationAnnotation(id: string) { return this.evaluationAnnotations.get(id); } listEvaluationAnnotations() { return mapValues(this.evaluationAnnotations); }
  saveEvaluationAdjudication(record: any) { const previous = this.evaluationAdjudications.get(record.id); if (previous && canonicalJson(previous) !== canonicalJson(record)) throw new Error(`Evaluation adjudication is immutable: ${record.id}`); return previous ?? put(this.evaluationAdjudications, record); } getEvaluationAdjudication(id: string) { return this.evaluationAdjudications.get(id); } listEvaluationAdjudications() { return mapValues(this.evaluationAdjudications); }
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
    const alertCreated = [["alertCreatedAt", alert.alertCreatedAt], ["createdAt", alert.createdAt], ["savedAt", alert.savedAt]]
      .map(([field, value]) => ({ field, timestamp: validIso(value) }))
      .find((candidate) => candidate.timestamp);
    if (alertCreated?.timestamp) {
      const captureIds = new Set(linkedAlertCaptureIds(alert));
      for (const timeliness of this.listTimelinessRecords()) {
        if (timeliness.incidentId === alert.incidentId || captureIds.has(timeliness.captureId)) this.saveTimelinessRecord(withAlertCreated(timeliness, alertCreated.timestamp, alert.id, `alert.${alertCreated.field}`));
      }
    }
    return stored;
  }
  getDwmAlert(id: string) { return this.dwmAlerts.get(id); } listDwmAlerts() { return mapValues(this.dwmAlerts); }
  saveDwmWebhookDelivery(delivery: any) {
    const deliveredAt = delivery.status === "delivered" ? validIso(delivery.deliveredAt) ?? nowIso() : undefined;
    const stored = put(this.dwmWebhookDeliveries, { ...delivery, deliveredAt, completedAt: delivery.completedAt ?? deliveredAt, updatedAt: delivery.updatedAt ?? deliveredAt ?? delivery.attemptedAt });
    if (!["dry_run", "skipped"].includes(stored.status)) {
      const alert = this.getDwmAlert(stored.alertId);
      if (alert) {
        const captureIds = new Set(linkedAlertCaptureIds(alert));
        for (const timeliness of this.listTimelinessRecords()) {
          if (timeliness.incidentId !== alert.incidentId && !captureIds.has(timeliness.captureId)) continue;
          this.saveTimelinessRecord(withDelivery(timeliness, stored));
        }
      }
    }
    return stored;
  }
  protected hydrateDwmWebhookDeliverySnapshot(delivery: any) { return put(this.dwmWebhookDeliveries, delivery); }
  getDwmWebhookDelivery(id: string) { return this.dwmWebhookDeliveries.get(id); } listDwmWebhookDeliveries() { return mapValues(this.dwmWebhookDeliveries); }
  saveActorOrgRelevanceReview(review: any) { return put(this.actorOrgRelevanceReviews, review); } getActorOrgRelevanceReview(id: string) { return this.actorOrgRelevanceReviews.get(id); } listActorOrgRelevanceReviews() { return mapValues(this.actorOrgRelevanceReviews); }
}

function preservedIncidentReview(previous: any, candidate: any) {
  if (!previous) return {};
  const previousReviewedAt = Date.parse(String(previous.reviewedAt ?? ""));
  const candidateReviewedAt = Date.parse(String(candidate?.reviewedAt ?? ""));
  if (Number.isFinite(candidateReviewedAt) && (!Number.isFinite(previousReviewedAt) || candidateReviewedAt > previousReviewedAt)) return {};
  const humanTerminal = ["confirmed", "rejected", "contradicted"].includes(previous.reviewState)
    && !String(previous.reviewedBy ?? "").startsWith("hanasand-ai:");
  if (!humanTerminal && !previous.automaticReview) return {};
  return {
    reviewState: previous.reviewState,
    reviewedBy: previous.reviewedBy,
    reviewedAt: previous.reviewedAt,
    reviewReasons: ["confirmed", "rejected", "contradicted"].includes(previous.reviewState) ? [] : previous.reviewReasons,
    actorAttribution: previous.actorAttribution,
    actorIdentityId: previous.actorIdentityId,
    actorName: previous.actorName,
    automaticReview: previous.automaticReview
  };
}
installMemoryStoreReplayMethods(InMemoryScraperStore); installMemoryStoreDiscoveryMethods(InMemoryScraperStore);
export { canonicalizeUrl, captureDedupeKey, InMemoryObjectEvidenceStore };

function normalized(record: any): string { return String(record.normalizedValue ?? record.value ?? "").trim().toLowerCase(); }
function activeActorProfile(profile: any): boolean { return Boolean(profile && profile.identityResolutionState !== "archived"); }
type ActorProfileResolution = { profileId: string; tenantId?: string; canonicalName: string; normalizedName: string; aliases: string[]; actorIdentityIds: string[] };
function actorProfileResolution(store: any, capture: any, entity: any): ActorProfileResolution | undefined {
  const identities = (store.listActorIdentities?.() ?? []) as ActorIdentityRecord[];
  const current = identities.filter((identity) => identity.status === "current");
  const explicitIds = unique(entity.actorIdentityIds ?? []);
  let identity: ActorIdentityRecord | undefined;
  if (explicitIds.length) {
    const explicit = explicitIds.map((id) => identities.find((candidate) => candidate.id === id));
    if (explicit.some((candidate) => !candidate || candidate.status !== "current")) return undefined;
    const canonical = uniqueObjects(explicit.map((candidate) => canonicalActorIdentity(candidate!, current)), (candidate) => candidate.id);
    identity = canonical.length === 1 ? canonical[0] : undefined;
  } else {
    const resolved = resolveMitreActorIdentity(String(entity.value ?? ""), identities);
    if (resolved.ambiguous) return undefined;
    identity = resolved.candidates.length === 1 ? resolved.candidates[0].identity : undefined;
  }
  const tenantId = publicActorTenant(capture.tenantId);
  const scope = tenantId ?? "global";
  if (!identity) return undefined;
  const observedAliases = [entity.rawValue, entity.value, ...(entity.aliases ?? [])].filter((label) => actorLabelBelongsTo(label, identity!, identities));
  return {
    profileId: stableId("actor", `${scope}:${identity.id}`),
    tenantId,
    canonicalName: identity.canonicalName,
    normalizedName: identity.normalizedCanonicalName,
    aliases: uniqueActorAliases([identity.canonicalName, ...identity.associatedNames, ...observedAliases]),
    actorIdentityIds: [identity.id]
  };
}
function publicActorTenant(tenantId: unknown): string | undefined { return !tenantId || tenantId === "default" ? undefined : String(tenantId); }
function actorProfileMatches(store: any, profile: any, resolution: ActorProfileResolution): boolean {
  if (publicActorTenant(profile.tenantId) !== resolution.tenantId) return false;
  const identities = (store.listActorIdentities?.() ?? []) as ActorIdentityRecord[];
  const current = identities.filter((identity) => identity.status === "current");
  const explicit = uniqueObjects((profile.actorIdentityIds ?? []).map((id: string) => identities.find((identity) => identity.id === id)).filter((identity: any) => identity?.status === "current").map((identity: any) => canonicalActorIdentity(identity, current)), (identity: any) => identity.id);
  if (explicit.length) return explicit.length === 1 && explicit[0].id === resolution.actorIdentityIds[0];
  if ((profile.actorIdentityIds ?? []).includes(resolution.actorIdentityIds[0])) return true;
  const candidates = uniqueObjects([profile.canonicalName, ...(profile.aliases ?? [])].flatMap((label: string) => {
    const match = resolveMitreActorIdentity(label, identities);
    return match.ambiguous ? [] : match.candidates.map((candidate) => candidate.identity);
  }), (identity: any) => identity.id);
  return candidates.length === 1 && candidates[0].id === resolution.actorIdentityIds[0];
}
function actorLabelBelongsTo(label: unknown, identity: ActorIdentityRecord, identities: ActorIdentityRecord[]): boolean {
  if (typeof label !== "string" || !label.trim()) return false;
  const resolution = resolveMitreActorIdentity(label, identities);
  return !resolution.ambiguous && resolution.candidates.length === 1 && resolution.candidates[0].identity.id === identity.id;
}
function actorType(entity: any): string { return entity.type === "ransomware_family" ? "ransomware" : /^apt\d+$/i.test(String(entity.value)) ? "apt" : "threat_actor"; }
function mergeActorProfile(previous: any, capture: any, entity: any, entities: any[], resolution: ActorProfileResolution): any {
  const observedAt = capture.publishedAt ?? capture.collectedAt;
  const captureIds = unique([...(previous?.captureIds ?? []), capture.id]);
  const incomingType = actorType(entity);
  const keepPreviousIdentity = actorTypeRank(previous?.actorType) >= actorTypeRank(incomingType);
  const canonicalName = resolution.canonicalName;
  const aliases = resolution.aliases;
  const retiredAliases = uniqueActorAliases([...(previous?.retiredAliases ?? []), ...(previous?.aliases ?? []).filter((alias: string) => !aliases.some((active) => active.toLowerCase() === alias.toLowerCase()))]);
  const { identityResolutionReason: _archivedReason, ...preserved } = previous ?? {};
  return {
    ...preserved,
    id: previous?.id ?? resolution.profileId,
    tenantId: resolution.tenantId,
    canonicalName,
    normalizedName: resolution.normalizedName,
    actorType: keepPreviousIdentity ? previous.actorType : incomingType,
    aliases,
    actorIdentityIds: resolution.actorIdentityIds,
    identityResolutionState: "canonical",
    ...(retiredAliases?.length ? { retiredAliases } : {}),
    confidence: Math.max(previous?.confidence ?? 0, entity.confidence ?? 0),
    firstSeenAt: earlier(previous?.firstSeenAt, observedAt),
    lastSeenAt: later(previous?.lastSeenAt, observedAt),
    evidenceCount: captureIds.length,
    sourceIds: unique([...(previous?.sourceIds ?? []), capture.sourceId]),
    captureIds,
    characterization: mergeCharacterization(previous?.characterization, entities, capture, observedAt),
    updatedAt: capture.collectedAt
  };
}
function actorTypeRank(value: unknown): number { return value === "apt" ? 3 : value === "ransomware" ? 2 : value === "threat_actor" ? 1 : 0; }
function uniqueActorAliases(values: unknown[]): string[] {
  const aliases = new Map<string, string>();
  for (const value of values) if (typeof value === "string" && value.trim() && !aliases.has(value.trim().toLowerCase())) aliases.set(value.trim().toLowerCase(), value.trim());
  return [...aliases.values()];
}
const CHARACTERIZATION_FIELDS: Record<string, string> = {
  victim: "victims", sector: "sectors", country: "countries", ttp: "ttps", malware: "malwareTools", impact: "impacts", dataset: "datasets",
  extortion_type: "extortionTypes", monetization_path: "monetizationPaths", publicity_tactic: "publicityTactics", publication_strategy: "publicationStrategies",
  channel_type: "channelTypes", victim_pressure_tactic: "pressureTactics", communication_channel: "communications", buyer_seller_communication: "communications", intermediary_communication: "communications",
  profitability_signal: "profitabilitySignals"
};
function mergeCharacterization(previous: any = {}, entities: any[], capture: any, observedAt: string): any {
  const next = Object.fromEntries(Object.entries(previous).map(([field, rows]: any) => [field, [...rows]]));
  for (const entity of entities) {
    const field = CHARACTERIZATION_FIELDS[entity.type];
    if (!field || !normalized(entity)) continue;
    const rows = next[field] ?? (next[field] = []), index = rows.findIndex((row: any) => row.entityType === entity.type && row.normalizedValue === normalized(entity));
    const prior = rows[index];
    const observation = {
      ...(prior ?? {}), value: entity.value, normalizedValue: normalized(entity), entityType: entity.type,
      confidence: Math.max(prior?.confidence ?? 0, entity.confidence ?? 0), assertionKind: entity.assertionKind ?? prior?.assertionKind ?? "extracted",
      reviewReasons: unique([...(prior?.reviewReasons ?? []), ...(entity.reviewReasons ?? [])]), firstSeenAt: earlier(prior?.firstSeenAt, observedAt), lastSeenAt: later(prior?.lastSeenAt, observedAt),
      sourceIds: unique([...(prior?.sourceIds ?? []), capture.sourceId]), captureIds: unique([...(prior?.captureIds ?? []), capture.id]), entityIds: unique([...(prior?.entityIds ?? []), entity.id])
    };
    if (index < 0) rows.push(observation); else rows[index] = observation;
  }
  return next;
}
function recordActorProfileDelta(store: any, previous: any, profile: any, capture: any, incident: any): void {
  const aliasesAdded = (profile.aliases ?? []).filter((alias: string) => !(previous?.aliases ?? []).some((value: string) => value.toLowerCase() === alias.toLowerCase()));
  const characterization = Object.fromEntries(Object.entries(profile.characterization ?? {}).map(([field, rows]: any) => [field, rows.filter((row: any) => row.captureIds?.includes(capture.id) && !(previous?.characterization?.[field] ?? []).some((prior: any) => prior.entityType === row.entityType && prior.normalizedValue === row.normalizedValue && prior.captureIds?.includes(capture.id)))]).filter(([, rows]: any) => rows.length));
  if (previous && !aliasesAdded.length && !Object.keys(characterization).length) return;
  const metadata = capture.metadata ?? {};
  store.saveEvidenceDelta({
    id: stableId("delta", `actor-profile:${profile.id}:${capture.id}`), tenantId: capture.tenantId, query: metadata.query, normalizedQuery: metadata.normalizedQuery, runId: metadata.runId, cursor: "",
    kind: previous ? "updated" : "added", subjectType: "actor_profile", subjectId: profile.id, observedAt: capture.publishedAt ?? capture.collectedAt, sourceId: capture.sourceId,
    discoveryEvidenceIds: metadata.discoveryEvidenceId ? [metadata.discoveryEvidenceId] : [], captureIds: [capture.id], incidentIds: incident ? [incident.id] : [], relationshipIds: [], policyEventIds: [],
    retentionClass: capture.retentionClass ?? "standard", metadata: { aliasesAdded, characterization, rawContentExposed: false }
  });
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
  const independence = evidenceIndependence(store, captureIds);
  const observedAt = capture.publishedAt ?? capture.collectedAt;
  const stage = evidenceStage(capture);
  const uncertaintyReasons = unique([...(previous?.uncertaintyReasons ?? []), ...(subject.reviewReasons ?? []), ...(stage === "metadata_only_claim" ? ["metadata-only evidence requires review"] : [])]);
  const defaultReviewState = subject.confidence < 0.65 || uncertaintyReasons.length ? "needs_review" : "unreviewed";
  const reviewState = previous?.reviewState && !["unreviewed", "needs_review"].includes(previous.reviewState) ? previous.reviewState : previous?.reviewState === "needs_review" || defaultReviewState === "needs_review" ? "needs_review" : "unreviewed";
  const corroborationState = reviewState === "contradicted" ? "contradicted" : independence.groupCount >= 2 ? "corroborated" : "single_source";
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
    sourceCount: independence.groupCount,
    sourceIndependence: independence,
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

export function evidenceIndependence(store: any, captureIds: string[]) {
  const evidence = captureIds.map((id) => store.getCapture(id)).filter(Boolean).map((capture: any) => ({
    publisher: publisherKey(store.getSource?.(capture.sourceId), capture.sourceId),
    content: capture.normalizedTextHash || capture.contentHash
  }));
  if (!evidence.length) return { groupCount: 1, publisherKeys: [], method: "publisher_or_identical_content" };
  // ponytail: claim evidence sets are small; replace this O(n^2) union scan only if measured corpus size makes it material.
  const parent = evidence.map((_: any, index: number) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  for (let left = 0; left < evidence.length; left++) for (let right = left + 1; right < evidence.length; right++) {
    if (evidence[left].publisher === evidence[right].publisher || evidence[left].content && evidence[left].content === evidence[right].content) parent[find(right)] = find(left);
  }
  return {
    groupCount: new Set(evidence.map((_: any, index: number) => find(index))).size,
    publisherKeys: unique(evidence.map((item: any) => item.publisher)),
    method: "publisher_or_identical_content"
  };
}

function publisherKey(source: any, fallback: string) {
  const value = source?.catalog?.publisher?.homepage || source?.url;
  try { return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return String(source?.catalog?.publisher?.name || fallback).trim().toLowerCase(); }
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
  if (action === "correct") return "rejected";
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
export function linkedAlertCaptureIds(alert: any): string[] {
  return unique([
    alert.captureId,
    ...(alert.captureIds ?? []),
    ...(alert.provenance?.captureIds ?? []),
    ...(alert.workflowContext?.captureIds ?? []),
    ...(alert.workflowContext?.generationEvidenceWindow?.captureIds ?? []),
    ...(alert.sourceProvenanceSummary?.generationEvidenceWindow?.captureIds ?? []),
    ...(alert.deliveryReadinessContext?.generationEvidenceWindow?.captureIds ?? []),
    ...(alert.evidence ?? []).map((item: any) => item.captureId ?? item.provenance?.captureId)
  ]);
}
function reportTimeline(capture: any, source?: any): any {
  const reportTimestamps = (Array.isArray(capture.metadata?.reportTimestamps) ? capture.metadata.reportTimestamps : [])
    .map((evidence: any) => {
      const role = verifiedReportRole(evidence?.role, source);
      const timestamp = validIso(evidence?.timestamp);
      if (!role || !timestamp || evidence?.extractionMethod !== "source_field") return undefined;
      return {
        role,
        timestamp,
        sourceId: capture.sourceId,
        sourceName: source?.name ?? evidence.sourceName,
        captureId: capture.id,
        evidencePath: String(evidence.evidencePath ?? "source.publishedAt"),
        extractionMethod: "source_field",
        parserVersion: evidence.parserVersion
      };
    })
    .filter(Boolean);
  return timelineFromReportEvidence(reportTimestamps);
}
function verifiedReportRole(value: unknown, source?: any): string | undefined {
  const role = String(value ?? "");
  if (role === "publisher") return role;
  const configured = String(source?.metadata?.reporterRole ?? source?.governance?.reporterRole ?? "");
  return ["actor", "victim"].includes(role) && configured === role && source?.metadata?.reporterRoleVerified === true ? role : ["actor", "victim"].includes(role) ? "publisher" : undefined;
}
function mergeReportTimeline(previous: any, incoming: any): any {
  const evidence = uniqueObjects([...(previous?.reportTimestamps ?? []), ...(incoming?.reportTimestamps ?? [])], (item: any) => `${item.role}:${item.timestamp}:${item.sourceId}:${item.captureId}:${item.evidencePath}`);
  return timelineFromReportEvidence(evidence);
}
function timelineFromReportEvidence(reportTimestamps: any[]): any {
  const sorted = [...reportTimestamps].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || reportRoleRank(a.role) - reportRoleRank(b.role));
  const actor = sorted.find((item) => item.role === "actor");
  const victim = sorted.find((item) => item.role === "victim");
  const publisher = sorted.find((item) => item.role === "publisher");
  const first = sorted[0];
  return {
    actorReportedAt: actor?.timestamp,
    victimReportedAt: victim?.timestamp,
    publisherReportedAt: publisher?.timestamp,
    firstReportedAt: first?.timestamp,
    reportedAt: first?.timestamp,
    firstReportedKind: first?.role,
    firstReportedProvenance: first,
    reportTimestamps: sorted
  };
}
function reportRoleRank(role: string): number { return role === "actor" ? 0 : role === "victim" ? 1 : 2; }
function timelinessRecord(capture: any, incident: any, previous?: any): any {
  const reporting = mergeReportTimeline(previous, incident);
  const record = {
    id: incident.id,
    tenantId: previous?.tenantId ?? capture.tenantId ?? incident.tenantId,
    sourceId: capture.sourceId ?? incident.sourceId,
    captureId: capture.id,
    incidentId: incident.id,
    ...reporting,
    publishedAt: reporting.publisherReportedAt,
    collectedAt: capture.collectedAt,
    processedAt: capture.processedAt ?? incident.processedAt,
    firstVisibleAt: capture.firstVisibleAt ?? incident.firstVisibleAt,
    alertCreatedAt: previous?.alertCreatedAt,
    alertCreatedProvenance: previous?.alertCreatedProvenance,
    alertedAt: previous?.alertCreatedAt ?? previous?.alertedAt,
    deliveryAttemptedAt: previous?.deliveryAttemptedAt,
    deliveryAttemptProvenance: previous?.deliveryAttemptProvenance,
    deliveredAt: previous?.deliveredAt,
    deliveredProvenance: previous?.deliveredProvenance,
    updatedAt: incident.updatedAt ?? capture.firstVisibleAt ?? nowIso()
  };
  return enrichTimeliness(record);
}
function withAlertCreated(record: any, alertCreatedAt: string, alertId: string, evidencePath: string): any {
  const keepPrevious = record.alertCreatedAt && Date.parse(record.alertCreatedAt) <= Date.parse(alertCreatedAt);
  const nextAlertCreatedAt = keepPrevious ? record.alertCreatedAt : alertCreatedAt;
  return enrichTimeliness({
    ...record,
    alertCreatedAt: nextAlertCreatedAt,
    alertedAt: nextAlertCreatedAt,
    alertCreatedProvenance: keepPrevious ? record.alertCreatedProvenance : { event: "alert_created", alertId, timestamp: alertCreatedAt, evidencePath },
    updatedAt: later(record.updatedAt, alertCreatedAt)
  });
}
function withDelivery(record: any, delivery: any): any {
  const attemptedAt = validIso(delivery.attemptedAt);
  const deliveredAt = delivery.status === "delivered" ? validIso(delivery.deliveredAt) : undefined;
  const keepAttempt = record.deliveryAttemptedAt && (!attemptedAt || Date.parse(record.deliveryAttemptedAt) <= Date.parse(attemptedAt));
  const keepDelivered = record.deliveredAt && (!deliveredAt || Date.parse(record.deliveredAt) <= Date.parse(deliveredAt));
  const next = {
    ...record,
    deliveryAttemptedAt: keepAttempt ? record.deliveryAttemptedAt : attemptedAt ?? record.deliveryAttemptedAt,
    deliveryAttemptProvenance: keepAttempt ? record.deliveryAttemptProvenance : attemptedAt ? { event: "delivery_attempt", alertId: delivery.alertId, deliveryId: delivery.id, timestamp: attemptedAt, evidencePath: "delivery.attemptedAt", status: delivery.status } : record.deliveryAttemptProvenance,
    deliveredAt: keepDelivered ? record.deliveredAt : deliveredAt ?? record.deliveredAt,
    deliveredProvenance: keepDelivered ? record.deliveredProvenance : deliveredAt ? { event: "delivery_confirmed", alertId: delivery.alertId, deliveryId: delivery.id, timestamp: deliveredAt, evidencePath: "delivery.responseCompletedAt", httpStatus: delivery.httpStatus } : record.deliveredProvenance,
    updatedAt: later(record.updatedAt, deliveredAt ?? attemptedAt ?? record.updatedAt)
  };
  return enrichTimeliness(next);
}
function enrichTimeliness(record: any) {
  const latencies = latencyFields(record);
  return { ...record, latencies, zeroSecondEvidence: zeroSecondEvidence(record, latencies), timestampAnomalies: timestampAnomalies(record, latencies) };
}
function latencyFields(record: any) {
  return {
    reportToPublicationSeconds: elapsed(record.firstReportedAt ?? record.reportedAt, record.publishedAt),
    firstReportToCollectionSeconds: elapsed(record.firstReportedAt ?? record.reportedAt, record.collectedAt),
    publicationToCollectionSeconds: elapsed(record.publishedAt, record.collectedAt),
    collectionToProcessingSeconds: elapsed(record.collectedAt, record.processedAt),
    processingToVisibilitySeconds: elapsed(record.processedAt, record.firstVisibleAt),
    visibilityToAlertSeconds: elapsed(record.firstVisibleAt, record.alertCreatedAt ?? record.alertedAt),
    alertToDeliveryAttemptSeconds: elapsed(record.alertCreatedAt ?? record.alertedAt, record.deliveryAttemptedAt),
    deliveryAttemptToDeliveredSeconds: elapsed(record.deliveryAttemptedAt, record.deliveredAt),
    publicationToAlertSeconds: elapsed(record.publishedAt, record.alertCreatedAt ?? record.alertedAt),
    reportToVisibilitySeconds: elapsed(record.firstReportedAt ?? record.reportedAt, record.firstVisibleAt),
    reportToAlertSeconds: elapsed(record.firstReportedAt ?? record.reportedAt, record.alertCreatedAt ?? record.alertedAt),
    reportToDeliveredSeconds: elapsed(record.firstReportedAt ?? record.reportedAt, record.deliveredAt)
  };
}
function zeroSecondEvidence(record: any, latencies: any) {
  const fields: Record<string, [unknown, unknown, unknown, unknown]> = {
    reportToPublicationSeconds: [record.firstReportedAt ?? record.reportedAt, record.publishedAt, record.firstReportedProvenance, publisherProvenance(record)],
    publicationToCollectionSeconds: [record.publishedAt, record.collectedAt, publisherProvenance(record), { event: "collection", captureId: record.captureId, evidencePath: "capture.collectedAt" }],
    collectionToProcessingSeconds: [record.collectedAt, record.processedAt, { event: "collection", captureId: record.captureId }, { event: "processing", captureId: record.captureId }],
    processingToVisibilitySeconds: [record.processedAt, record.firstVisibleAt, { event: "processing", captureId: record.captureId }, { event: "first_visible", incidentId: record.incidentId }],
    visibilityToAlertSeconds: [record.firstVisibleAt, record.alertCreatedAt ?? record.alertedAt, { event: "first_visible", incidentId: record.incidentId }, record.alertCreatedProvenance],
    alertToDeliveryAttemptSeconds: [record.alertCreatedAt ?? record.alertedAt, record.deliveryAttemptedAt, record.alertCreatedProvenance, record.deliveryAttemptProvenance],
    deliveryAttemptToDeliveredSeconds: [record.deliveryAttemptedAt, record.deliveredAt, record.deliveryAttemptProvenance, record.deliveredProvenance],
    reportToDeliveredSeconds: [record.firstReportedAt ?? record.reportedAt, record.deliveredAt, record.firstReportedProvenance, record.deliveredProvenance]
  };
  return Object.fromEntries(Object.entries(fields).flatMap(([field, [from, to, fromEvidence, toEvidence]]) => latencies[field] === 0 ? [[field, { verified: Boolean(fromEvidence && toEvidence), from, to, fromEvidence, toEvidence }]] : []));
}
function timestampAnomalies(record: any, latencies: any): string[] {
  return unique([
    negative("first_report_after_publication", record.firstReportedAt ?? record.reportedAt, record.publishedAt),
    negative("first_report_after_collection", record.firstReportedAt ?? record.reportedAt, record.collectedAt),
    negative("published_after_collection", record.publishedAt, record.collectedAt),
    negative("collected_after_processing", record.collectedAt, record.processedAt),
    negative("processed_after_visibility", record.processedAt, record.firstVisibleAt),
    negative("visible_after_alert", record.firstVisibleAt, record.alertCreatedAt ?? record.alertedAt),
    negative("delivery_attempt_before_alert", record.alertCreatedAt ?? record.alertedAt, record.deliveryAttemptedAt),
    negative("delivered_before_attempt", record.deliveryAttemptedAt, record.deliveredAt),
    (record.firstReportedAt ?? record.reportedAt) && !record.firstReportedProvenance ? "first_report_provenance_missing" : undefined,
    record.firstReportedKind && record.firstReportedProvenance?.role !== record.firstReportedKind ? "first_report_role_mismatch" : undefined,
    ...Object.entries(zeroSecondEvidence(record, latencies)).flatMap(([field, evidence]: any) => evidence.verified ? [] : [`unverified_zero:${field}`])
  ]);
}
function publisherProvenance(record: any) { return record.reportTimestamps?.find((item: any) => item.role === "publisher" && item.timestamp === record.publisherReportedAt); }
function elapsed(from: unknown, to: unknown): number | undefined { const start = Date.parse(String(from ?? "")), end = Date.parse(String(to ?? "")); return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 1000) : undefined; }
function negative(code: string, from: unknown, to: unknown): string | undefined { const value = elapsed(from, to); return value !== undefined && value < 0 ? code : undefined; }
function validIso(value: unknown): string | undefined { const time = Date.parse(String(value ?? "")); return Number.isFinite(time) ? new Date(time).toISOString() : undefined; }
function canonicalJson(value: any): string { return JSON.stringify(canonicalValue(value)); }
function canonicalValue(value: any): any { if (Array.isArray(value)) return value.map(canonicalValue); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonicalValue(value[key])])); return value; }
function unique(values: any[]): string[] { return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]; }
function uniqueObjects(values: any[], key: (value: any) => string): any[] { const seen = new Set<string>(); return values.filter((value) => value && !seen.has(key(value)) && Boolean(seen.add(key(value)))); }
function earlier(a: string | undefined, b: string): string { return !a || Date.parse(b) < Date.parse(a) ? b : a; }
function later(a: string | undefined, b: string | undefined): string | undefined { return !b ? a : !a || Date.parse(b) > Date.parse(a) ? b : a; }
