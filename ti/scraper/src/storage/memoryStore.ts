// @ts-nocheck
import type { CaptureReplayJob, DiscoveryEvidence, EvidenceDelta, IncidentCandidate, LiveSearchSnapshot, PipelineResult, RawCapture, ReplayPipelineInput, SourceRecord } from "../types.ts";
import type { CaptureMetadataStore } from "./evidenceStore.ts";
import { InMemoryEvidenceQueries } from "./evidenceQueries.ts";
import { installMemoryStoreDiscoveryMethods } from "./memoryStoreDiscoveryMethods.ts";
import { InMemoryObjectEvidenceStore } from "./memoryObjectEvidenceStore.ts";
import { installMemoryStoreReplayMethods } from "./memoryStoreReplayMethods.ts";
import { canonicalizeUrl, captureDedupeKey, dedupeIndexKeys, enforceSensitiveMetadataOnly, prepareCapture } from "./memoryStoreHelpers.ts";
export interface RawEvidenceStore extends CaptureMetadataStore {} export interface ScraperStore extends CaptureMetadataStore {}
const mapValues = <T>(map: Map<string, T>) => [...map.values()];
const put = <T extends { id: string }>(map: Map<string, T>, item: T) => (map.set(item.id, item), item);
export class InMemoryScraperStore implements ScraperStore {
  private captures = new Map<string, RawCapture>(); private dedupe = new Map<string, string>(); private incidents = new Map<string, IncidentCandidate>(); private sources = new Map<string, SourceRecord>(); private plans = new Map<string, any>(); private runs = new Map<string, any>();
  private analystMetadataReviewTasks = new Map<string, any>(); private analystSourceActivationPackets = new Map<string, any>(); private analystVictimNotificationPackets = new Map<string, any>(); private analystClaimLedgerEntries = new Map<string, any>(); private analystLoopSnapshots = new Map<string, any>();
  private dwmWatchlists = new Map<string, any>(); private dwmAlerts = new Map<string, any>(); private dwmWebhookDeliveries = new Map<string, any>();
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
  findDuplicateCapture(capture: RawCapture) { const prepared = prepareCapture(capture); for (const key of dedupeIndexKeys(prepared)) { const id = this.dedupe.get(key); if (id) return this.captures.get(id); } }
  listCaptures() { return mapValues(this.captures); }
  savePipelineResult(result: PipelineResult): PipelineResult { const capture = this.saveCapture(result.capture); if (result.incident) { const incident = this.saveIncident({ ...result.incident, captureId: capture.id }); this.recordExtractionDelta("added", capture, incident.id); } return { ...result, capture }; }
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
  saveIncident(candidate: IncidentCandidate) { return put(this.incidents, candidate); } listIncidents() { return mapValues(this.incidents); }
  saveSource(source: SourceRecord) { return put(this.sources, source); } getSource(id: string) { return this.sources.get(id); } listSources() { return mapValues(this.sources); }
  savePlan(plan: any) { return put(this.plans, plan); } getPlan(id: string) { return this.plans.get(id); } listPlans() { return mapValues(this.plans); }
  saveRun(run: any) { return put(this.runs, run); } getRun(id: string) { return this.runs.get(id); } findRunByIdempotencyKey(tenantId: string | undefined, key: string) { return mapValues(this.runs).find((run) => run.tenantId === tenantId && run.idempotencyKey === key); } listRuns() { return mapValues(this.runs); }
  saveAnalystMetadataReviewTask(task: any) { if (task.unsafeMaterialAccessed !== false) throw new Error(`Analyst metadata review task must not record unsafe material access: ${task.id}`); return put(this.analystMetadataReviewTasks, task); } getAnalystMetadataReviewTask(id: string) { return this.analystMetadataReviewTasks.get(id); } listAnalystMetadataReviewTasks() { return mapValues(this.analystMetadataReviewTasks); }
  saveAnalystSourceActivationPacket(packet: any) { if (packet.dryRun !== true) throw new Error(`Analyst source activation packet must be dry-run only: ${packet.id}`); return put(this.analystSourceActivationPackets, packet); } listAnalystSourceActivationPackets() { return mapValues(this.analystSourceActivationPackets); }
  saveAnalystVictimNotificationPacket(packet: any) { return put(this.analystVictimNotificationPackets, packet); } listAnalystVictimNotificationPackets() { return mapValues(this.analystVictimNotificationPackets); }
  saveAnalystClaimLedgerEntry(entry: any) { return put(this.analystClaimLedgerEntries, entry); } listAnalystClaimLedgerEntries() { return mapValues(this.analystClaimLedgerEntries); }
  saveAnalystLoopSnapshot(snapshot: any) { return put(this.analystLoopSnapshots, snapshot); } listAnalystLoopSnapshots() { return mapValues(this.analystLoopSnapshots); }
  saveDwmWatchlist(watchlist: any) { return put(this.dwmWatchlists, watchlist); } getDwmWatchlist(id: string) { return this.dwmWatchlists.get(id); } listDwmWatchlists() { return mapValues(this.dwmWatchlists); }
  saveDwmAlert(alert: any) { return put(this.dwmAlerts, alert); } getDwmAlert(id: string) { return this.dwmAlerts.get(id); } listDwmAlerts() { return mapValues(this.dwmAlerts); }
  saveDwmWebhookDelivery(delivery: any) { return put(this.dwmWebhookDeliveries, delivery); } getDwmWebhookDelivery(id: string) { return this.dwmWebhookDeliveries.get(id); } listDwmWebhookDeliveries() { return mapValues(this.dwmWebhookDeliveries); }
}
installMemoryStoreReplayMethods(InMemoryScraperStore); installMemoryStoreDiscoveryMethods(InMemoryScraperStore);
export { canonicalizeUrl, captureDedupeKey, InMemoryObjectEvidenceStore };
