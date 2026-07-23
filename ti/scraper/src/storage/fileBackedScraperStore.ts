import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AnalystClaimLedgerEntry, AnalystLoopSnapshot, AnalystMetadataReviewTask, AnalystSourceActivationPacket, AnalystVictimNotificationPacket, CaptureReplayJob, CaptureWriteResult, CollectionPlan, CollectionRun, DiscoveryEvidence, DiscoveryPromotion, EvidenceDelta, IncidentCandidate, LiveSearchSnapshot, PipelineResult, RawCapture, SourceRecord } from "../types.ts";
import { InMemoryScraperStore } from "./memoryStore.ts";

export type FileBackedScraperStoreOptions = { snapshotPath: string };
type FileBackedScraperSnapshot = any;

export class FileBackedScraperStore extends InMemoryScraperStore {
  private readonly snapshotPath: string; private hydrating = false; private batchDepth = 0; private dirty = false;
  constructor(options: FileBackedScraperStoreOptions) { super(); this.snapshotPath = options.snapshotPath; mkdirSync(dirname(this.snapshotPath), { recursive: true }); this.hydrate(); }
  batch<T>(write: () => T): T {
    this.batchDepth++;
    try {
      const value = write();
      if (value && typeof (value as any).then === "function") return ((value as unknown) as Promise<unknown>).finally(() => this.finishBatch()) as T;
      this.finishBatch();
      return value;
    } catch (error) {
      this.finishBatch();
      throw error;
    }
  }
  override saveCapture(capture: RawCapture): RawCapture { return this.saved(() => super.saveCapture(capture)); }
  override updateCaptureMetadata(id: string, update: (metadata: any) => any): RawCapture { return this.saved(() => super.updateCaptureMetadata(id, update)); }
  override replaceCaptureForRetention(capture: RawCapture): RawCapture { return this.saved(() => super.replaceCaptureForRetention(capture)); }
  override saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult { return this.saved(() => super.saveCaptureWithDedupe(capture)); }
  override savePipelineResult(result: PipelineResult): PipelineResult { return this.saved(() => super.savePipelineResult(result)); }
  override saveIncident(candidate: IncidentCandidate): IncidentCandidate { return this.saved(() => super.saveIncident(candidate)); }
  override saveExtractedEntity(entity: any): any { return this.saved(() => super.saveExtractedEntity(entity)); }
  override saveIndicator(indicator: any): any { return this.saved(() => super.saveIndicator(indicator)); }
  override saveActorProfile(profile: any): any { return this.saved(() => super.saveActorProfile(profile)); }
  override saveEvidenceLink(linkRecord: any): any { return this.saved(() => super.saveEvidenceLink(linkRecord)); }
  override saveValidationRecord(record: any): any { return this.saved(() => super.saveValidationRecord(record)); }
  override saveEvaluationLabel(label: any): any { return this.saved(() => super.saveEvaluationLabel(label)); }
  override saveEvaluationBenchmark(record: any): any { return this.saved(() => super.saveEvaluationBenchmark(record)); }
  override saveEvaluationAnnotation(record: any): any { return this.saved(() => super.saveEvaluationAnnotation(record)); }
  override saveEvaluationAdjudication(record: any): any { return this.saved(() => super.saveEvaluationAdjudication(record)); }
  override saveIntelligenceClaim(claim: any): any { return this.saved(() => super.saveIntelligenceClaim(claim)); }
  override saveClaimEvidence(evidence: any): any { return this.saved(() => super.saveClaimEvidence(evidence)); }
  override saveClaimReview(review: any): any { return this.saved(() => super.saveClaimReview(review)); }
  override saveSourceHealthObservation(observation: any): any { return this.saved(() => super.saveSourceHealthObservation(observation)); }
  override saveTimelinessRecord(record: any): any { return this.saved(() => super.saveTimelinessRecord(record)); }
  override saveSource(source: SourceRecord): SourceRecord { return this.saved(() => super.saveSource(source)); }
  override savePlan(plan: CollectionPlan): CollectionPlan { return this.saved(() => super.savePlan(plan)); }
  override saveRun(run: CollectionRun): CollectionRun { return this.saved(() => super.saveRun(run)); }
  override createReplayJob(input: Parameters<InMemoryScraperStore["createReplayJob"]>[0]): CaptureReplayJob { return this.saved(() => super.createReplayJob(input)); }
  override recordReplayResult(jobId: string, result: PipelineResult): CaptureReplayJob { return this.saved(() => super.recordReplayResult(jobId, result)); }
  override saveReplayJob(job: CaptureReplayJob): CaptureReplayJob { return this.saved(() => super.saveReplayJob(job)); }
  override saveDiscoveryEvidence(evidence: DiscoveryEvidence): DiscoveryEvidence { return this.saved(() => super.saveDiscoveryEvidence(evidence)); }
  override promoteDiscoveryEvidence(promotion: DiscoveryPromotion): DiscoveryEvidence { return this.saved(() => super.promoteDiscoveryEvidence(promotion)); }
  override saveLiveSearchSnapshot(snapshot: LiveSearchSnapshot): LiveSearchSnapshot { return this.saved(() => super.saveLiveSearchSnapshot(snapshot)); }
  override saveEvidenceDelta(delta: EvidenceDelta): EvidenceDelta { return this.saved(() => super.saveEvidenceDelta(delta)); }
  override saveAnalystMetadataReviewTask(task: AnalystMetadataReviewTask): AnalystMetadataReviewTask { return this.saved(() => super.saveAnalystMetadataReviewTask(task)); }
  override saveAnalystSourceActivationPacket(packet: AnalystSourceActivationPacket): AnalystSourceActivationPacket { return this.saved(() => super.saveAnalystSourceActivationPacket(packet)); }
  override saveAnalystVictimNotificationPacket(packet: AnalystVictimNotificationPacket): AnalystVictimNotificationPacket { return this.saved(() => super.saveAnalystVictimNotificationPacket(packet)); }
  override saveAnalystClaimLedgerEntry(entry: AnalystClaimLedgerEntry): AnalystClaimLedgerEntry { return this.saved(() => super.saveAnalystClaimLedgerEntry(entry)); }
  override saveAnalystLoopSnapshot(snapshot: AnalystLoopSnapshot): AnalystLoopSnapshot { return this.saved(() => super.saveAnalystLoopSnapshot(snapshot)); }
  override saveOrganization(organization: any): any { return this.saved(() => super.saveOrganization(organization)); }
  override saveOrganizationMember(member: any): any { return this.saved(() => super.saveOrganizationMember(member)); }
  override saveOrganizationInvite(invite: any): any { return this.saved(() => super.saveOrganizationInvite(invite)); }
  override saveWebhookDestination(destination: any): any { return this.saved(() => super.saveWebhookDestination(destination)); }
  override saveCase(caseRecord: any): any { return this.saved(() => super.saveCase(caseRecord)); }
  override saveDwmWatchlist(watchlist: any): any { return this.saved(() => super.saveDwmWatchlist(watchlist)); }
  override deleteWorkflowForRetention(recordType: string, id: string): boolean { return this.saved(() => super.deleteWorkflowForRetention(recordType, id)); }
  override saveDwmAlert(alert: any): any { return this.saved(() => super.saveDwmAlert(alert)); }
  override saveDwmWebhookDelivery(delivery: any): any { return this.saved(() => super.saveDwmWebhookDelivery(delivery)); }
  override saveActorOrgRelevanceReview(review: any): any { return this.saved(() => super.saveActorOrgRelevanceReview(review)); }
  private saved<T>(write: () => T): T { const value = write(); this.batchDepth ? this.dirty = true : this.persist(); return value; }
  private finishBatch(): void { this.batchDepth--; if (!this.batchDepth && this.dirty) this.persist(); }
  private hydrate(): void { if (!existsSync(this.snapshotPath)) return; this.hydrating = true; try { this.hydrateWithoutOrganizationWriteGuard(() => this.load(JSON.parse(readFileSync(this.snapshotPath, "utf8")))); } finally { this.hydrating = false; } }
  private load(snapshot: Partial<FileBackedScraperSnapshot>): void {
    for (const source of snapshot.sources ?? []) super.saveSource(source);
    for (const capture of snapshot.captures ?? []) this.hydrateCaptureSnapshot(capture);
    for (const incident of snapshot.incidents ?? []) super.saveIncident(incident);
    for (const plan of snapshot.plans ?? []) super.savePlan(plan);
    for (const run of snapshot.runs ?? []) super.saveRun(run);
    for (const evidence of snapshot.discoveryEvidence ?? []) this.hydrateDiscoveryEvidenceSnapshot(evidence);
    for (const row of snapshot.liveSearchSnapshots ?? []) this.hydrateLiveSearchSnapshotSnapshot(row);
    for (const delta of snapshot.evidenceDeltas ?? []) this.hydrateEvidenceDeltaSnapshot(delta);
    for (const profile of snapshot.actorProfiles ?? []) super.saveActorProfile(profile);
    for (const alias of snapshot.actorAliases ?? []) this.hydrateActorAliasSnapshot(alias);
    for (const [key, save] of Object.entries(extraSaves)) for (const row of snapshot[key] ?? []) save(this, row);
  }
  private persist(): void { if (!this.hydrating) { this.dirty = false; writeFileSync(this.snapshotPath, JSON.stringify(this.snapshot(), null, 2)); } }
  private snapshot(): FileBackedScraperSnapshot { return { schemaVersion: "ti.file_backed_scraper_store.v3", savedAt: new Date().toISOString(), sources: this.listSources(), captures: this.listCaptures(), incidents: this.listIncidents(), extractedEntities: this.listExtractedEntities(), indicators: this.listIndicators(), actorProfiles: this.actorProfilesForPersistence(), actorAliases: this.actorAliasesForPersistence(), evidenceLinks: this.listEvidenceLinks(), validationRecords: this.listValidationRecords(), evaluationLabels: this.listEvaluationLabels(), evaluationBenchmarks: this.listEvaluationBenchmarks(), evaluationAnnotations: this.listEvaluationAnnotations(), evaluationAdjudications: this.listEvaluationAdjudications(), intelligenceClaims: this.listIntelligenceClaims(), claimEvidence: this.listClaimEvidence(), claimReviews: this.listClaimReviews(), sourceHealthObservations: this.listSourceHealthObservations(), timelinessRecords: this.listTimelinessRecords(), plans: this.listPlans(), runs: this.listRuns(), discoveryEvidence: this.listDiscoveryEvidence(), liveSearchSnapshots: this.listLiveSearchSnapshots(), evidenceDeltas: this.listEvidenceDeltas(), replayJobs: this.listReplayJobs(), analystMetadataReviewTasks: this.listAnalystMetadataReviewTasks(), analystSourceActivationPackets: this.listAnalystSourceActivationPackets(), analystVictimNotificationPackets: this.listAnalystVictimNotificationPackets(), analystClaimLedgerEntries: this.listAnalystClaimLedgerEntries(), analystLoopSnapshots: this.listAnalystLoopSnapshots(), organizations: this.listOrganizations(), organizationMembers: this.listOrganizationMembers(), organizationInvites: this.listOrganizationInvites(), webhookDestinations: this.listWebhookDestinations(), cases: this.listCases(), dwmWatchlists: this.listDwmWatchlists(), dwmAlerts: this.listDwmAlerts(), dwmWebhookDeliveries: this.listDwmWebhookDeliveries(), actorOrgRelevanceReviews: this.listActorOrgRelevanceReviews() }; }
}

const extraSaves: Record<string, (store: FileBackedScraperStore, row: any) => void> = {
  extractedEntities: (s, r) => InMemoryScraperStore.prototype.saveExtractedEntity.call(s, r),
  indicators: (s, r) => InMemoryScraperStore.prototype.saveIndicator.call(s, r),
  evidenceLinks: (s, r) => InMemoryScraperStore.prototype.saveEvidenceLink.call(s, r),
  validationRecords: (s, r) => InMemoryScraperStore.prototype.saveValidationRecord.call(s, r),
  evaluationLabels: (s, r) => InMemoryScraperStore.prototype.saveEvaluationLabel.call(s, r),
  evaluationBenchmarks: (s, r) => InMemoryScraperStore.prototype.saveEvaluationBenchmark.call(s, r),
  evaluationAnnotations: (s, r) => InMemoryScraperStore.prototype.saveEvaluationAnnotation.call(s, r),
  evaluationAdjudications: (s, r) => InMemoryScraperStore.prototype.saveEvaluationAdjudication.call(s, r),
  intelligenceClaims: (s, r) => InMemoryScraperStore.prototype.saveIntelligenceClaim.call(s, r),
  claimEvidence: (s, r) => InMemoryScraperStore.prototype.saveClaimEvidence.call(s, r),
  claimReviews: (s, r) => InMemoryScraperStore.prototype.saveClaimReview.call(s, r),
  sourceHealthObservations: (s, r) => InMemoryScraperStore.prototype.saveSourceHealthObservation.call(s, r),
  timelinessRecords: (s, r) => InMemoryScraperStore.prototype.saveTimelinessRecord.call(s, r),
  replayJobs: (s, r) => InMemoryScraperStore.prototype.saveReplayJob.call(s, r),
  analystMetadataReviewTasks: (s, r) => InMemoryScraperStore.prototype.saveAnalystMetadataReviewTask.call(s, r),
  analystSourceActivationPackets: (s, r) => InMemoryScraperStore.prototype.saveAnalystSourceActivationPacket.call(s, r),
  analystVictimNotificationPackets: (s, r) => InMemoryScraperStore.prototype.saveAnalystVictimNotificationPacket.call(s, r),
  analystClaimLedgerEntries: (s, r) => InMemoryScraperStore.prototype.saveAnalystClaimLedgerEntry.call(s, r),
  analystLoopSnapshots: (s, r) => InMemoryScraperStore.prototype.saveAnalystLoopSnapshot.call(s, r),
  organizations: (s, r) => InMemoryScraperStore.prototype.saveOrganization.call(s, r),
  organizationMembers: (s, r) => InMemoryScraperStore.prototype.saveOrganizationMember.call(s, r),
  organizationInvites: (s, r) => InMemoryScraperStore.prototype.saveOrganizationInvite.call(s, r),
  webhookDestinations: (s, r) => InMemoryScraperStore.prototype.saveWebhookDestination.call(s, r),
  cases: (s, r) => InMemoryScraperStore.prototype.saveCase.call(s, r),
  dwmWatchlists: (s, r) => InMemoryScraperStore.prototype.saveDwmWatchlist.call(s, r),
  dwmAlerts: (s, r) => InMemoryScraperStore.prototype.saveDwmAlert.call(s, r),
  dwmWebhookDeliveries: (s, r) => InMemoryScraperStore.prototype.saveDwmWebhookDelivery.call(s, r),
  actorOrgRelevanceReviews: (s, r) => InMemoryScraperStore.prototype.saveActorOrgRelevanceReview.call(s, r)
};
