import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AnalystClaimLedgerEntry, AnalystLoopSnapshot, AnalystMetadataReviewTask, AnalystSourceActivationPacket, AnalystVictimNotificationPacket, CaptureReplayJob, CaptureWriteResult, CollectionPlan, CollectionRun, DiscoveryEvidence, DiscoveryPromotion, EvidenceDelta, IncidentCandidate, LiveSearchSnapshot, PipelineResult, RawCapture, SourceRecord } from "../types.ts";
import { InMemoryScraperStore } from "./memoryStore.ts";

export type FileBackedScraperStoreOptions = { snapshotPath: string };
type FileBackedScraperSnapshot = any;

export class FileBackedScraperStore extends InMemoryScraperStore {
  private readonly snapshotPath: string; private hydrating = false;
  constructor(options: FileBackedScraperStoreOptions) { super(); this.snapshotPath = options.snapshotPath; mkdirSync(dirname(this.snapshotPath), { recursive: true }); this.hydrate(); }
  override saveCapture(capture: RawCapture): RawCapture { return this.saved(() => super.saveCapture(capture)); }
  override saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult { return this.saved(() => super.saveCaptureWithDedupe(capture)); }
  override savePipelineResult(result: PipelineResult): PipelineResult { return this.saved(() => super.savePipelineResult(result)); }
  override saveIncident(candidate: IncidentCandidate): IncidentCandidate { return this.saved(() => super.saveIncident(candidate)); }
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
  private saved<T>(write: () => T): T { const value = write(); this.persist(); return value; }
  private hydrate(): void { if (!existsSync(this.snapshotPath)) return; this.hydrating = true; try { this.load(JSON.parse(readFileSync(this.snapshotPath, "utf8"))); } finally { this.hydrating = false; } }
  private load(snapshot: Partial<FileBackedScraperSnapshot>): void {
    for (const source of snapshot.sources ?? []) super.saveSource(source);
    for (const capture of snapshot.captures ?? []) this.hydrateCaptureSnapshot(capture);
    for (const incident of snapshot.incidents ?? []) super.saveIncident(incident);
    for (const plan of snapshot.plans ?? []) super.savePlan(plan);
    for (const run of snapshot.runs ?? []) super.saveRun(run);
    for (const evidence of snapshot.discoveryEvidence ?? []) this.hydrateDiscoveryEvidenceSnapshot(evidence);
    for (const row of snapshot.liveSearchSnapshots ?? []) this.hydrateLiveSearchSnapshotSnapshot(row);
    for (const delta of snapshot.evidenceDeltas ?? []) this.hydrateEvidenceDeltaSnapshot(delta);
    for (const [key, save] of Object.entries(extraSaves)) for (const row of snapshot[key] ?? []) save(this, row);
  }
  private persist(): void { if (!this.hydrating) writeFileSync(this.snapshotPath, JSON.stringify(this.snapshot(), null, 2)); }
  private snapshot(): FileBackedScraperSnapshot { return { schemaVersion: "ti.file_backed_scraper_store.v1", savedAt: new Date().toISOString(), sources: this.listSources(), captures: this.listCaptures(), incidents: this.listIncidents(), plans: this.listPlans(), runs: this.listRuns(), discoveryEvidence: this.listDiscoveryEvidence(), liveSearchSnapshots: this.listLiveSearchSnapshots(), evidenceDeltas: this.listEvidenceDeltas(), replayJobs: this.listReplayJobs(), analystMetadataReviewTasks: this.listAnalystMetadataReviewTasks(), analystSourceActivationPackets: this.listAnalystSourceActivationPackets(), analystVictimNotificationPackets: this.listAnalystVictimNotificationPackets(), analystClaimLedgerEntries: this.listAnalystClaimLedgerEntries(), analystLoopSnapshots: this.listAnalystLoopSnapshots() }; }
}

const extraSaves: Record<string, (store: FileBackedScraperStore, row: any) => void> = {
  replayJobs: (s, r) => InMemoryScraperStore.prototype.saveReplayJob.call(s, r),
  analystMetadataReviewTasks: (s, r) => InMemoryScraperStore.prototype.saveAnalystMetadataReviewTask.call(s, r),
  analystSourceActivationPackets: (s, r) => InMemoryScraperStore.prototype.saveAnalystSourceActivationPacket.call(s, r),
  analystVictimNotificationPackets: (s, r) => InMemoryScraperStore.prototype.saveAnalystVictimNotificationPacket.call(s, r),
  analystClaimLedgerEntries: (s, r) => InMemoryScraperStore.prototype.saveAnalystClaimLedgerEntry.call(s, r),
  analystLoopSnapshots: (s, r) => InMemoryScraperStore.prototype.saveAnalystLoopSnapshot.call(s, r)
};
