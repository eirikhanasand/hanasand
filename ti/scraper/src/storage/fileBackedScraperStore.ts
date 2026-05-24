import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket,
  CaptureReplayJob,
  CaptureWriteResult,
  CollectionPlan,
  CollectionRun,
  DiscoveryEvidence,
  DiscoveryPromotion,
  EvidenceDelta,
  IncidentCandidate,
  LiveSearchSnapshot,
  PipelineResult,
  RawCapture,
  SourceRecord
} from "../types.ts";
import { InMemoryScraperStore } from "./memoryStore.ts";

export interface FileBackedScraperStoreOptions {
  snapshotPath: string;
}

interface FileBackedScraperSnapshot {
  schemaVersion: "ti.file_backed_scraper_store.v1";
  savedAt: string;
  sources: SourceRecord[];
  captures: RawCapture[];
  incidents: IncidentCandidate[];
  plans: CollectionPlan[];
  runs: CollectionRun[];
  discoveryEvidence: DiscoveryEvidence[];
  liveSearchSnapshots: LiveSearchSnapshot[];
  evidenceDeltas: EvidenceDelta[];
  replayJobs: CaptureReplayJob[];
  analystMetadataReviewTasks: AnalystMetadataReviewTask[];
  analystSourceActivationPackets: AnalystSourceActivationPacket[];
  analystVictimNotificationPackets: AnalystVictimNotificationPacket[];
  analystClaimLedgerEntries: AnalystClaimLedgerEntry[];
  analystLoopSnapshots: AnalystLoopSnapshot[];
}

export class FileBackedScraperStore extends InMemoryScraperStore {
  private readonly snapshotPath: string;
  private hydrating = false;

  constructor(options: FileBackedScraperStoreOptions) {
    super();
    this.snapshotPath = options.snapshotPath;
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    this.hydrate();
  }

  override saveCapture(capture: RawCapture): RawCapture {
    const saved = super.saveCapture(capture);
    this.persist();
    return saved;
  }

  override saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult {
    const saved = super.saveCaptureWithDedupe(capture);
    this.persist();
    return saved;
  }

  override savePipelineResult(result: PipelineResult): PipelineResult {
    const saved = super.savePipelineResult(result);
    this.persist();
    return saved;
  }

  override saveIncident(candidate: IncidentCandidate): IncidentCandidate {
    const saved = super.saveIncident(candidate);
    this.persist();
    return saved;
  }

  override saveSource(source: SourceRecord): SourceRecord {
    const saved = super.saveSource(source);
    this.persist();
    return saved;
  }

  override savePlan(plan: CollectionPlan): CollectionPlan {
    const saved = super.savePlan(plan);
    this.persist();
    return saved;
  }

  override saveRun(run: CollectionRun): CollectionRun {
    const saved = super.saveRun(run);
    this.persist();
    return saved;
  }

  override createReplayJob(input: Parameters<InMemoryScraperStore["createReplayJob"]>[0]): CaptureReplayJob {
    const saved = super.createReplayJob(input);
    this.persist();
    return saved;
  }

  override recordReplayResult(jobId: string, result: PipelineResult): CaptureReplayJob {
    const saved = super.recordReplayResult(jobId, result);
    this.persist();
    return saved;
  }

  override saveReplayJob(job: CaptureReplayJob): CaptureReplayJob {
    const saved = super.saveReplayJob(job);
    this.persist();
    return saved;
  }

  override saveDiscoveryEvidence(evidence: DiscoveryEvidence): DiscoveryEvidence {
    const saved = super.saveDiscoveryEvidence(evidence);
    this.persist();
    return saved;
  }

  override promoteDiscoveryEvidence(promotion: DiscoveryPromotion): DiscoveryEvidence {
    const saved = super.promoteDiscoveryEvidence(promotion);
    this.persist();
    return saved;
  }

  override saveLiveSearchSnapshot(snapshot: LiveSearchSnapshot): LiveSearchSnapshot {
    const saved = super.saveLiveSearchSnapshot(snapshot);
    this.persist();
    return saved;
  }

  override saveEvidenceDelta(delta: EvidenceDelta): EvidenceDelta {
    const saved = super.saveEvidenceDelta(delta);
    this.persist();
    return saved;
  }

  override saveAnalystMetadataReviewTask(task: AnalystMetadataReviewTask): AnalystMetadataReviewTask {
    const saved = super.saveAnalystMetadataReviewTask(task);
    this.persist();
    return saved;
  }

  override saveAnalystSourceActivationPacket(packet: AnalystSourceActivationPacket): AnalystSourceActivationPacket {
    const saved = super.saveAnalystSourceActivationPacket(packet);
    this.persist();
    return saved;
  }

  override saveAnalystVictimNotificationPacket(packet: AnalystVictimNotificationPacket): AnalystVictimNotificationPacket {
    const saved = super.saveAnalystVictimNotificationPacket(packet);
    this.persist();
    return saved;
  }

  override saveAnalystClaimLedgerEntry(entry: AnalystClaimLedgerEntry): AnalystClaimLedgerEntry {
    const saved = super.saveAnalystClaimLedgerEntry(entry);
    this.persist();
    return saved;
  }

  override saveAnalystLoopSnapshot(snapshot: AnalystLoopSnapshot): AnalystLoopSnapshot {
    const saved = super.saveAnalystLoopSnapshot(snapshot);
    this.persist();
    return saved;
  }

  private hydrate(): void {
    if (!existsSync(this.snapshotPath)) return;
    this.hydrating = true;
    try {
      const snapshot = JSON.parse(readFileSync(this.snapshotPath, "utf8")) as Partial<FileBackedScraperSnapshot>;
      for (const source of snapshot.sources ?? []) super.saveSource(source);
      for (const capture of snapshot.captures ?? []) super.saveCapture(capture);
      for (const incident of snapshot.incidents ?? []) super.saveIncident(incident);
      for (const plan of snapshot.plans ?? []) super.savePlan(plan);
      for (const run of snapshot.runs ?? []) super.saveRun(run);
      for (const evidence of snapshot.discoveryEvidence ?? []) super.saveDiscoveryEvidence(evidence);
      for (const snapshotRow of snapshot.liveSearchSnapshots ?? []) super.saveLiveSearchSnapshot(snapshotRow);
      for (const delta of snapshot.evidenceDeltas ?? []) super.saveEvidenceDelta(delta);
      for (const job of snapshot.replayJobs ?? []) super.saveReplayJob(job);
      for (const task of snapshot.analystMetadataReviewTasks ?? []) super.saveAnalystMetadataReviewTask(task);
      for (const packet of snapshot.analystSourceActivationPackets ?? []) super.saveAnalystSourceActivationPacket(packet);
      for (const packet of snapshot.analystVictimNotificationPackets ?? []) super.saveAnalystVictimNotificationPacket(packet);
      for (const entry of snapshot.analystClaimLedgerEntries ?? []) super.saveAnalystClaimLedgerEntry(entry);
      for (const loopSnapshot of snapshot.analystLoopSnapshots ?? []) super.saveAnalystLoopSnapshot(loopSnapshot);
    } finally {
      this.hydrating = false;
    }
  }

  private persist(): void {
    if (this.hydrating) return;
    const snapshot: FileBackedScraperSnapshot = {
      schemaVersion: "ti.file_backed_scraper_store.v1",
      savedAt: new Date().toISOString(),
      sources: this.listSources(),
      captures: this.listCaptures(),
      incidents: this.listIncidents(),
      plans: this.listPlans(),
      runs: this.listRuns(),
      discoveryEvidence: this.listDiscoveryEvidence(),
      liveSearchSnapshots: this.listLiveSearchSnapshots(),
      evidenceDeltas: this.listEvidenceDeltas(),
      replayJobs: this.listReplayJobs(),
      analystMetadataReviewTasks: this.listAnalystMetadataReviewTasks(),
      analystSourceActivationPackets: this.listAnalystSourceActivationPackets(),
      analystVictimNotificationPackets: this.listAnalystVictimNotificationPackets(),
      analystClaimLedgerEntries: this.listAnalystClaimLedgerEntries(),
      analystLoopSnapshots: this.listAnalystLoopSnapshots()
    };
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2));
  }
}
