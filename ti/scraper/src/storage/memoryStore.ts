import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket,
  CaptureDedupeKey,
  CaptureReplayJob,
  CaptureWriteResult,
  CollectionPlan,
  CollectionRun,
  DiscoveryEvidence,
  DiscoveryPromotion,
  EvidenceDelta,
  EvidenceDeltaKind,
  EvidenceQueryHelpers,
  IncidentCandidate,
  LiveSearchSnapshot,
  ObjectStoreRef,
  PipelineResult,
  ReplayDiffSummary,
  RawCapture,
  ReplayPipelineInput,
  SourceRecord
} from "../types.ts";
import { hashContent, normalizeWhitespace, nowIso, stableId } from "../utils.ts";
import type { CaptureMetadataStore, ObjectEvidenceRecord, ObjectEvidenceStore, ObjectEvidenceWrite } from "./evidenceStore.ts";
import { InMemoryEvidenceQueries } from "./evidenceQueries.ts";

export interface RawEvidenceStore extends CaptureMetadataStore {
  saveCapture(capture: RawCapture): RawCapture;
  saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult;
  getCapture(id: string): RawCapture | undefined;
  findDuplicateCapture(capture: RawCapture): RawCapture | undefined;
  listCaptures(): RawCapture[];
  replayInput(captureId: string, extractorVersion: string): ReplayPipelineInput | undefined;
}

export interface ScraperStore extends CaptureMetadataStore {
  saveCapture(capture: RawCapture): RawCapture;
  saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult;
  getCapture(id: string): RawCapture | undefined;
  findDuplicateCapture(capture: RawCapture): RawCapture | undefined;
  listCaptures(): RawCapture[];
  savePipelineResult(result: PipelineResult): PipelineResult;
  replayInput(captureId: string, extractorVersion: string): ReplayPipelineInput | undefined;
  saveIncident(candidate: IncidentCandidate): IncidentCandidate;
  listIncidents(): IncidentCandidate[];
  saveSource(source: SourceRecord): SourceRecord;
  getSource(id: string): SourceRecord | undefined;
  listSources(): SourceRecord[];
  savePlan(plan: CollectionPlan): CollectionPlan;
  getPlan(id: string): CollectionPlan | undefined;
  listPlans(): CollectionPlan[];
  saveRun(run: CollectionRun): CollectionRun;
  getRun(id: string): CollectionRun | undefined;
  findRunByIdempotencyKey(tenantId: string | undefined, key: string): CollectionRun | undefined;
  listRuns(): CollectionRun[];
  saveAnalystMetadataReviewTask(task: AnalystMetadataReviewTask): AnalystMetadataReviewTask;
  getAnalystMetadataReviewTask(id: string): AnalystMetadataReviewTask | undefined;
  listAnalystMetadataReviewTasks(): AnalystMetadataReviewTask[];
  saveAnalystSourceActivationPacket(packet: AnalystSourceActivationPacket): AnalystSourceActivationPacket;
  listAnalystSourceActivationPackets(): AnalystSourceActivationPacket[];
  saveAnalystVictimNotificationPacket(packet: AnalystVictimNotificationPacket): AnalystVictimNotificationPacket;
  listAnalystVictimNotificationPackets(): AnalystVictimNotificationPacket[];
  saveAnalystClaimLedgerEntry(entry: AnalystClaimLedgerEntry): AnalystClaimLedgerEntry;
  listAnalystClaimLedgerEntries(): AnalystClaimLedgerEntry[];
  saveAnalystLoopSnapshot(snapshot: AnalystLoopSnapshot): AnalystLoopSnapshot;
  listAnalystLoopSnapshots(): AnalystLoopSnapshot[];
}

function objectKey(ref: ObjectStoreRef): string {
  return `${ref.bucket}:${ref.key}:${ref.versionId ?? ""}`;
}

export class InMemoryScraperStore implements ScraperStore {
  private readonly captures = new Map<string, RawCapture>();
  private readonly captureDedupeIndex = new Map<string, string>();
  private readonly incidents = new Map<string, IncidentCandidate>();
  private readonly sources = new Map<string, SourceRecord>();
  private readonly plans = new Map<string, CollectionPlan>();
  private readonly runs = new Map<string, CollectionRun>();
  private readonly analystMetadataReviewTasks = new Map<string, AnalystMetadataReviewTask>();
  private readonly analystSourceActivationPackets = new Map<string, AnalystSourceActivationPacket>();
  private readonly analystVictimNotificationPackets = new Map<string, AnalystVictimNotificationPacket>();
  private readonly analystClaimLedgerEntries = new Map<string, AnalystClaimLedgerEntry>();
  private readonly analystLoopSnapshots = new Map<string, AnalystLoopSnapshot>();
  private readonly replayJobs = new Map<string, CaptureReplayJob>();
  private readonly discoveryEvidence = new Map<string, DiscoveryEvidence>();
  private readonly liveSearchSnapshots = new Map<string, LiveSearchSnapshot>();
  private readonly evidenceDeltas = new Map<string, EvidenceDelta>();
  private readonly evidenceDeltaCursorIndex = new Map<string, string>();
  private evidenceDeltaSequence = 0;
  private readonly evidenceQueries = new InMemoryEvidenceQueries(() => ({
    captures: this.listCaptures(),
    incidents: this.listIncidents(),
    replayJobs: this.listReplayJobs(),
    discoveryEvidence: this.listDiscoveryEvidence(),
    liveSearchSnapshots: this.listLiveSearchSnapshots(),
    evidenceDeltas: this.listEvidenceDeltas()
  }));

  saveCapture(capture: RawCapture): RawCapture {
    return this.saveCaptureWithDedupe(capture).capture;
  }

  protected hydrateCaptureSnapshot(capture: RawCapture): RawCapture {
    const prepared = prepareCapture(capture);
    this.captures.set(prepared.id, prepared);
    for (const key of dedupeIndexKeys(prepared)) {
      this.captureDedupeIndex.set(key, prepared.id);
    }
    return prepared;
  }

  saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult {
    const prepared = prepareCapture(capture);
    enforceSensitiveMetadataOnly(prepared);

    const previous = this.captures.get(capture.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(prepared)) {
        throw new Error(`Capture is immutable: ${capture.id}`);
      }

      return {
        capture: previous,
        status: "duplicate",
        duplicateOf: previous.id,
        dedupeKey: captureDedupeKey(previous)
      };
    }

    const duplicate = this.findDuplicateCapture(prepared);
    if (duplicate) {
      return {
        capture: duplicate,
        status: "duplicate",
        duplicateOf: duplicate.id,
        dedupeKey: captureDedupeKey(prepared)
      };
    }

    this.captures.set(prepared.id, prepared);
    for (const key of dedupeIndexKeys(prepared)) {
      this.captureDedupeIndex.set(key, prepared.id);
    }
    this.recordCaptureDelta("added", prepared);

    return { capture: prepared, status: "inserted", dedupeKey: captureDedupeKey(prepared) };
  }

  getCapture(id: string): RawCapture | undefined {
    return this.captures.get(id);
  }

  findDuplicateCapture(capture: RawCapture): RawCapture | undefined {
    const prepared = prepareCapture(capture);
    for (const key of dedupeIndexKeys(prepared)) {
      const existingId = this.captureDedupeIndex.get(key);
      if (existingId) return this.captures.get(existingId);
    }

    return undefined;
  }

  listCaptures(): RawCapture[] {
    return [...this.captures.values()];
  }

  savePipelineResult(result: PipelineResult): PipelineResult {
    const capture = this.saveCapture(result.capture);
    if (result.incident) {
      const incident = this.saveIncident({ ...result.incident, captureId: capture.id });
      this.recordExtractionDelta("added", capture, incident.id);
    }
    return { ...result, capture };
  }

  replayInput(captureId: string, extractorVersion: string): ReplayPipelineInput | undefined {
    const capture = this.captures.get(captureId);
    if (!capture) return undefined;

    return {
      captureId: capture.id,
      sourceId: capture.sourceId,
      url: capture.url,
      collectedAt: capture.collectedAt,
      mediaType: capture.mediaType,
      storageKind: capture.storageKind,
      body: capture.body,
      objectRef: capture.objectRef,
      metadata: capture.metadata,
      contentHash: capture.contentHash,
      normalizedTextHash: capture.normalizedTextHash,
      extractorVersion
    };
  }

  createReplayJob(input: Omit<CaptureReplayJob, "id" | "requestedAt" | "status" | "metadata"> & {
    id?: string;
    requestedAt?: string;
    metadata?: Record<string, unknown>;
  }): CaptureReplayJob {
    const capture = this.getCapture(input.captureId);
    if (!capture) throw new Error(`Unknown capture for replay: ${input.captureId}`);
    const requestedAt = input.requestedAt ?? nowIso();
    const job: CaptureReplayJob = {
      ...input,
      id: input.id ?? stableId("replay", `${input.captureId}:${input.toExtractorVersion}:${requestedAt}`),
      tenantId: input.tenantId ?? capture.tenantId,
      sourceId: input.sourceId || capture.sourceId,
      requestedAt,
      status: "queued",
      metadata: input.metadata ?? {}
    };
    this.replayJobs.set(job.id, job);
    return job;
  }

  saveReplayJob(job: CaptureReplayJob): CaptureReplayJob {
    const capture = this.getCapture(job.captureId);
    if (!capture) throw new Error(`Unknown capture for replay: ${job.captureId}`);
    const previous = this.replayJobs.get(job.id);
    if (previous && previous.captureId !== job.captureId) {
      throw new Error(`Replay job capture cannot change: ${job.id}`);
    }
    this.replayJobs.set(job.id, {
      ...job,
      tenantId: job.tenantId ?? capture.tenantId,
      sourceId: job.sourceId || capture.sourceId
    });
    return this.replayJobs.get(job.id)!;
  }

  recordReplayResult(jobId: string, result: PipelineResult): CaptureReplayJob {
    const job = this.replayJobs.get(jobId);
    if (!job) throw new Error(`Unknown replay job: ${jobId}`);
    const capture = this.getCapture(job.captureId);
    if (!capture) throw new Error(`Unknown capture for replay: ${job.captureId}`);
    if (result.capture.id !== capture.id || result.capture.contentHash !== capture.contentHash) {
      throw new Error(`Replay result must reference immutable capture: ${job.captureId}`);
    }

    if (result.incident) this.saveIncident({ ...result.incident, captureId: capture.id });
    const completedAt = nowIso();
    const updated: CaptureReplayJob = {
      ...job,
      status: "succeeded",
      startedAt: job.startedAt ?? completedAt,
      completedAt,
      incidentId: result.incident?.id,
      indicatorCount: result.indicators.length,
      entityCount: result.entities.length,
      diffSummary: replayDiff(job, result),
      metadata: {
        ...job.metadata,
        replayedContentHash: capture.contentHash,
        replayedStorageKind: capture.storageKind,
        rawEvidenceMutated: false
      }
    };
    this.replayJobs.set(updated.id, updated);
    return updated;
  }

  getReplayJob(id: string): CaptureReplayJob | undefined {
    return this.replayJobs.get(id);
  }

  listReplayJobs(): CaptureReplayJob[] {
    return [...this.replayJobs.values()];
  }

  saveDiscoveryEvidence(evidence: DiscoveryEvidence): DiscoveryEvidence {
    const previous = this.discoveryEvidence.get(evidence.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(evidence)) {
      throw new Error(`Discovery evidence is immutable: ${evidence.id}`);
    }
    this.discoveryEvidence.set(evidence.id, evidence);
    if (!previous) this.recordDiscoveryDelta("added", evidence);
    return evidence;
  }

  protected hydrateDiscoveryEvidenceSnapshot(evidence: DiscoveryEvidence): DiscoveryEvidence {
    this.discoveryEvidence.set(evidence.id, evidence);
    return evidence;
  }

  getDiscoveryEvidence(id: string): DiscoveryEvidence | undefined {
    return this.discoveryEvidence.get(id);
  }

  listDiscoveryEvidence(): DiscoveryEvidence[] {
    return [...this.discoveryEvidence.values()];
  }

  promoteDiscoveryEvidence(promotion: DiscoveryPromotion): DiscoveryEvidence {
    const evidence = this.discoveryEvidence.get(promotion.discoveryEvidenceId);
    if (!evidence) throw new Error(`Unknown discovery evidence: ${promotion.discoveryEvidenceId}`);
    if (promotion.captureId && !this.captures.has(promotion.captureId)) {
      throw new Error(`Unknown capture for discovery promotion: ${promotion.captureId}`);
    }
    if (promotion.incidentId && !this.incidents.has(promotion.incidentId)) {
      throw new Error(`Unknown incident for discovery promotion: ${promotion.incidentId}`);
    }
    const promoted = {
      ...evidence,
      promotedToTaskId: promotion.taskId ?? evidence.promotedToTaskId,
      promotedToCaptureId: promotion.captureId ?? evidence.promotedToCaptureId,
      promotedToIncidentId: promotion.incidentId ?? evidence.promotedToIncidentId,
      metadata: {
        ...evidence.metadata,
        promotions: [
          ...readPromotionMetadata(evidence.metadata),
          promotion
        ]
      }
    };
    this.discoveryEvidence.set(promoted.id, promoted);
    this.recordDiscoveryDelta("promoted", promoted, promotion);
    return promoted;
  }

  saveLiveSearchSnapshot(snapshot: LiveSearchSnapshot): LiveSearchSnapshot {
    const previous = this.liveSearchSnapshots.get(snapshot.id);
    const delta = this.saveEvidenceDelta(deltaForSnapshot(previous ? "updated" : "added", snapshot));
    const stored = {
      ...snapshot,
      deltaCursors: [...(snapshot.deltaCursors ?? []), delta.cursor]
    };
    this.liveSearchSnapshots.set(stored.id, stored);
    return stored;
  }

  protected hydrateLiveSearchSnapshotSnapshot(snapshot: LiveSearchSnapshot): LiveSearchSnapshot {
    this.liveSearchSnapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  listLiveSearchSnapshots(): LiveSearchSnapshot[] {
    return [...this.liveSearchSnapshots.values()];
  }

  saveEvidenceDelta(delta: EvidenceDelta): EvidenceDelta {
    const prepared = {
      ...delta,
      cursor: delta.cursor || evidenceCursor(delta.observedAt, ++this.evidenceDeltaSequence, delta.id)
    };
    const previous = this.evidenceDeltas.get(prepared.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(prepared)) {
      throw new Error(`Evidence delta is immutable: ${prepared.id}`);
    }
    const cursorOwner = this.evidenceDeltaCursorIndex.get(prepared.cursor);
    if (cursorOwner && cursorOwner !== prepared.id) {
      throw new Error(`Evidence delta cursor must be unique: ${prepared.cursor}`);
    }
    this.evidenceDeltas.set(prepared.id, prepared);
    this.evidenceDeltaCursorIndex.set(prepared.cursor, prepared.id);
    return prepared;
  }

  protected hydrateEvidenceDeltaSnapshot(delta: EvidenceDelta): EvidenceDelta {
    const prepared = {
      ...delta,
      cursor: delta.cursor || evidenceCursor(delta.observedAt, ++this.evidenceDeltaSequence, delta.id)
    };
    const cursorOwner = this.evidenceDeltaCursorIndex.get(prepared.cursor);
    if (cursorOwner && cursorOwner !== prepared.id) {
      throw new Error(`Evidence delta cursor must be unique: ${prepared.cursor}`);
    }
    this.evidenceDeltas.set(prepared.id, prepared);
    this.evidenceDeltaCursorIndex.set(prepared.cursor, prepared.id);
    return prepared;
  }

  listEvidenceDeltas(): EvidenceDelta[] {
    return [...this.evidenceDeltas.values()];
  }

  queries(): EvidenceQueryHelpers {
    return this.evidenceQueries;
  }

  saveIncident(candidate: IncidentCandidate): IncidentCandidate {
    this.incidents.set(candidate.id, candidate);
    return candidate;
  }

  listIncidents(): IncidentCandidate[] {
    return [...this.incidents.values()];
  }

  saveSource(source: SourceRecord): SourceRecord {
    this.sources.set(source.id, source);
    return source;
  }

  getSource(id: string): SourceRecord | undefined {
    return this.sources.get(id);
  }

  listSources(): SourceRecord[] {
    return [...this.sources.values()];
  }

  savePlan(plan: CollectionPlan): CollectionPlan {
    this.plans.set(plan.id, plan);
    return plan;
  }

  getPlan(id: string): CollectionPlan | undefined {
    return this.plans.get(id);
  }

  listPlans(): CollectionPlan[] {
    return [...this.plans.values()];
  }

  saveRun(run: CollectionRun): CollectionRun {
    this.runs.set(run.id, run);
    return run;
  }

  getRun(id: string): CollectionRun | undefined {
    return this.runs.get(id);
  }

  findRunByIdempotencyKey(tenantId: string | undefined, key: string): CollectionRun | undefined {
    return [...this.runs.values()].find((run) => run.tenantId === tenantId && run.idempotencyKey === key);
  }

  listRuns(): CollectionRun[] {
    return [...this.runs.values()];
  }

  saveAnalystMetadataReviewTask(task: AnalystMetadataReviewTask): AnalystMetadataReviewTask {
    if (task.unsafeMaterialAccessed !== false) {
      throw new Error(`Analyst metadata review task must not record unsafe material access: ${task.id}`);
    }
    this.analystMetadataReviewTasks.set(task.id, task);
    return task;
  }

  getAnalystMetadataReviewTask(id: string): AnalystMetadataReviewTask | undefined {
    return this.analystMetadataReviewTasks.get(id);
  }

  listAnalystMetadataReviewTasks(): AnalystMetadataReviewTask[] {
    return [...this.analystMetadataReviewTasks.values()];
  }

  saveAnalystSourceActivationPacket(packet: AnalystSourceActivationPacket): AnalystSourceActivationPacket {
    if (packet.dryRun !== true) {
      throw new Error(`Analyst source activation packet must be dry-run only: ${packet.id}`);
    }
    this.analystSourceActivationPackets.set(packet.id, packet);
    return packet;
  }

  listAnalystSourceActivationPackets(): AnalystSourceActivationPacket[] {
    return [...this.analystSourceActivationPackets.values()];
  }

  saveAnalystVictimNotificationPacket(packet: AnalystVictimNotificationPacket): AnalystVictimNotificationPacket {
    this.analystVictimNotificationPackets.set(packet.id, packet);
    return packet;
  }

  listAnalystVictimNotificationPackets(): AnalystVictimNotificationPacket[] {
    return [...this.analystVictimNotificationPackets.values()];
  }

  saveAnalystClaimLedgerEntry(entry: AnalystClaimLedgerEntry): AnalystClaimLedgerEntry {
    this.analystClaimLedgerEntries.set(entry.id, entry);
    return entry;
  }

  listAnalystClaimLedgerEntries(): AnalystClaimLedgerEntry[] {
    return [...this.analystClaimLedgerEntries.values()];
  }

  saveAnalystLoopSnapshot(snapshot: AnalystLoopSnapshot): AnalystLoopSnapshot {
    this.analystLoopSnapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  listAnalystLoopSnapshots(): AnalystLoopSnapshot[] {
    return [...this.analystLoopSnapshots.values()];
  }

  private recordDiscoveryDelta(kind: EvidenceDeltaKind, evidence: DiscoveryEvidence, promotion?: DiscoveryPromotion): void {
    this.saveEvidenceDelta({
      id: stableId("delta", `${kind}:discovery:${evidence.id}:${promotion?.promotedAt ?? evidence.observedAt}`),
      tenantId: evidence.tenantId,
      query: evidence.query,
      normalizedQuery: evidence.normalizedQuery,
      cursor: "",
      kind,
      subjectType: "discovery_evidence",
      subjectId: evidence.id,
      observedAt: promotion?.promotedAt ?? evidence.observedAt,
      sourceId: evidence.sourceId,
      discoveryEvidenceIds: [evidence.id],
      captureIds: evidence.promotedToCaptureId ? [evidence.promotedToCaptureId] : [],
      incidentIds: evidence.promotedToIncidentId ? [evidence.promotedToIncidentId] : [],
      relationshipIds: [],
      policyEventIds: [],
      retentionClass: evidence.retentionClass,
      staleAt: evidence.staleAt,
      metadata: {
        resultId: evidence.resultId,
        provider: evidence.provider,
        evidenceType: evidence.evidenceType,
        promotion
      }
    });
  }

  private recordCaptureDelta(kind: EvidenceDeltaKind, capture: RawCapture): void {
    const metadata = evidenceMetadata(capture.metadata);
    this.saveEvidenceDelta({
      id: stableId("delta", `${kind}:capture:${capture.id}:${capture.collectedAt}`),
      tenantId: capture.tenantId,
      query: metadata.query,
      normalizedQuery: metadata.normalizedQuery,
      runId: metadata.runId,
      cursor: "",
      kind: capture.redaction?.applied ? "redacted" : kind,
      subjectType: "capture",
      subjectId: capture.id,
      observedAt: capture.collectedAt,
      sourceId: capture.sourceId,
      discoveryEvidenceIds: metadata.discoveryEvidenceId ? [metadata.discoveryEvidenceId] : [],
      captureIds: [capture.id],
      incidentIds: [],
      relationshipIds: [],
      policyEventIds: [],
      retentionClass: capture.retentionClass ?? "standard",
      metadata: {
        contentHash: capture.contentHash,
        storageKind: capture.storageKind,
        sensitive: capture.sensitive,
        redaction: capture.redaction
      }
    });
  }

  private recordExtractionDelta(kind: EvidenceDeltaKind, capture: RawCapture, incidentId: string): void {
    const metadata = evidenceMetadata(capture.metadata);
    this.saveEvidenceDelta({
      id: stableId("delta", `${kind}:extraction:${incidentId}:${capture.id}`),
      tenantId: capture.tenantId,
      query: metadata.query,
      normalizedQuery: metadata.normalizedQuery,
      runId: metadata.runId,
      cursor: "",
      kind,
      subjectType: "extraction",
      subjectId: incidentId,
      observedAt: capture.collectedAt,
      sourceId: capture.sourceId,
      discoveryEvidenceIds: metadata.discoveryEvidenceId ? [metadata.discoveryEvidenceId] : [],
      captureIds: [capture.id],
      incidentIds: [incidentId],
      relationshipIds: [],
      policyEventIds: [],
      retentionClass: capture.retentionClass ?? "standard",
      metadata: {
        extractorVersion: capture.provenance?.extractorVersion,
        contentHash: capture.contentHash
      }
    });
  }
}

export class InMemoryObjectEvidenceStore implements ObjectEvidenceStore {
  private readonly objects = new Map<string, ObjectEvidenceRecord>();

  putObject(input: ObjectEvidenceWrite): ObjectEvidenceRecord {
    const sizeBytes = typeof input.body === "string" ? new TextEncoder().encode(input.body).byteLength : input.body.byteLength;
    const key = `${input.tenantId ?? "global"}/${input.sourceId}/${input.captureId}/${input.contentHash}`;
    const ref: ObjectStoreRef = {
      bucket: "memory-evidence",
      key,
      versionId: stableId("objv", `${key}:${sizeBytes}`),
      sizeBytes,
      sha256: input.contentHash
    };
    const record: ObjectEvidenceRecord = {
      ref,
      tenantId: input.tenantId,
      sourceId: input.sourceId,
      captureId: input.captureId,
      mediaType: input.mediaType,
      contentHash: input.contentHash,
      retentionClass: input.retentionClass,
      createdAt: nowIso(),
      metadata: input.metadata ?? {}
    };
    this.objects.set(objectKey(ref), record);
    return record;
  }

  getObject(ref: ObjectStoreRef): ObjectEvidenceRecord | undefined {
    return this.objects.get(objectKey(ref));
  }

  deleteObject(ref: ObjectStoreRef, _reason: string): boolean {
    return this.objects.delete(objectKey(ref));
  }
}

export function captureDedupeKey(capture: RawCapture): CaptureDedupeKey {
  const prepared = prepareCapture(capture);
  return {
    sourceId: prepared.sourceId,
    canonicalUrl: prepared.canonicalUrl ?? canonicalizeUrl(prepared.url),
    normalizedTextHash: prepared.normalizedTextHash,
    publishedAt: prepared.publishedAt
  };
}

function deltaForSnapshot(kind: EvidenceDeltaKind, snapshot: LiveSearchSnapshot): EvidenceDelta {
  return {
    id: stableId("delta", `${kind}:snapshot:${snapshot.id}:${snapshot.capturedAt}`),
    tenantId: snapshot.tenantId,
    query: snapshot.query,
    normalizedQuery: snapshot.normalizedQuery,
    runId: snapshot.runId,
    cursor: "",
    kind: snapshot.status === "blocked" || snapshot.status === "disabled" ? "blocked" : kind,
    subjectType: "live_snapshot",
    subjectId: snapshot.id,
    observedAt: snapshot.capturedAt,
    discoveryEvidenceIds: snapshot.discoveryEvidenceIds,
    captureIds: snapshot.captureIds,
    incidentIds: snapshot.incidentIds,
    relationshipIds: readStringArray(snapshot.metadata.relationshipIds),
    policyEventIds: readStringArray(snapshot.metadata.policyEventIds),
    retentionClass: snapshot.retentionClass,
    staleAt: snapshot.staleAt,
    metadata: {
      status: snapshot.status,
      newEvidenceIds: snapshot.newEvidenceIds
    }
  };
}

function evidenceCursor(observedAt: string, sequence: number, deltaId: string): string {
  return `${observedAt}#${String(sequence).padStart(12, "0")}#${deltaId}`;
}

function evidenceMetadata(metadata: Record<string, unknown>): {
  query?: string;
  normalizedQuery?: string;
  runId?: string;
  discoveryEvidenceId?: string;
} {
  const query = typeof metadata.query === "string" ? metadata.query : undefined;
  const normalizedQuery = typeof metadata.normalizedQuery === "string"
    ? metadata.normalizedQuery
    : query?.trim().toLowerCase().replace(/\s+/g, " ");
  return {
    query,
    normalizedQuery,
    runId: typeof metadata.runId === "string" ? metadata.runId : undefined,
    discoveryEvidenceId: typeof metadata.promotedFromDiscoveryId === "string"
      ? metadata.promotedFromDiscoveryId
      : typeof metadata.discoveryEvidenceId === "string"
        ? metadata.discoveryEvidenceId
        : undefined
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = normalizePathname(url.pathname);
    url.search = sortedSearch(url.searchParams);
    return url.toString();
  } catch {
    return value.trim();
  }
}

function prepareCapture(capture: RawCapture): RawCapture {
  const normalizedTextHash = capture.normalizedTextHash ?? normalizedBodyHash(capture.body);
  const sensitivityFlags = capture.sensitivityFlags ?? (capture.sensitive ? ["sensitive_source"] : ["public"]);
  const metadataOnly = capture.sensitive || sensitivityFlags.some(isMetadataOnlyFlag);

  return {
    ...capture,
    canonicalUrl: capture.canonicalUrl ?? canonicalizeUrl(capture.url),
    normalizedTextHash,
    storageKind: metadataOnly ? "metadata_only" : capture.storageKind,
    body: metadataOnly ? undefined : capture.body,
    metadata: metadataOnly ? {
      ...capture.metadata,
      safeEntityHints: capture.metadata.safeEntityHints ?? safeEntityHintsFromBody(capture.body)
    } : capture.metadata,
    sensitivityFlags,
    redaction: capture.redaction ?? {
      applied: metadataOnly,
      policy: metadataOnly ? "metadata_only" : "none",
      reason: metadataOnly ? "Sensitive evidence is persisted as metadata only." : "Raw storage allowed by source policy."
    },
    retentionClass: capture.retentionClass ?? (metadataOnly ? "restricted_metadata" : "standard"),
    provenance: capture.provenance ?? {
      sourceId: capture.sourceId,
      captureId: capture.id,
      url: capture.url,
      collectedAt: capture.collectedAt,
      contentHash: capture.contentHash,
      extractorVersion: "capture-store:v1",
      taskId: capture.taskId,
      tenantId: capture.tenantId
    }
  };
}

function enforceSensitiveMetadataOnly(capture: RawCapture): void {
  if (!capture.sensitive && !capture.sensitivityFlags?.some(isMetadataOnlyFlag)) return;
  if (capture.storageKind !== "metadata_only") {
    throw new Error(`Sensitive capture must be metadata-only: ${capture.id}`);
  }
  if (capture.body) {
    throw new Error(`Sensitive capture cannot persist raw body: ${capture.id}`);
  }
}

function dedupeIndexKeys(capture: RawCapture): string[] {
  const key = captureDedupeKey(capture);
  const published = key.publishedAt ?? "";
  const normalized = key.normalizedTextHash ?? "";
  return [
    `source-url-published:${key.sourceId}:${key.canonicalUrl}:${published}`,
    `source-text-published:${key.sourceId}:${normalized}:${published}`,
    `source-content-published:${capture.sourceId}:${capture.contentHash}:${published}`
  ].filter((value) => !value.includes("::"));
}

function normalizedBodyHash(body: string | undefined): string | undefined {
  return body ? hashContent(normalizeWhitespace(body).toLowerCase()) : undefined;
}

function isMetadataOnlyFlag(flag: string): boolean {
  return flag === "sensitive_source" || flag === "leak_metadata" || flag === "credential_material" || flag === "restricted_protocol";
}

function safeEntityHintsFromBody(body: string | undefined): { victims: string[]; sectors: string[] } | undefined {
  if (!body) return undefined;
  const victims = new Set<string>();
  for (const match of body.matchAll(/\bvictim\s*:?\s+([A-Z][A-Za-z0-9&., -]{2,80})/g)) {
    const victim = match[1]?.replace(/\s+\b(?:on|in|using|with|after|from)\b.*$/i, "").trim();
    if (victim) victims.add(victim);
  }
  const sectors = new Set<string>();
  for (const sector of ["healthcare", "telecommunications", "energy", "government", "finance", "education", "manufacturing"]) {
    if (new RegExp(`\\b${sector}\\b`, "i").test(body)) sectors.add(sector);
  }
  return victims.size || sectors.size ? { victims: [...victims], sectors: [...sectors] } : undefined;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
}

function sortedSearch(params: URLSearchParams): string {
  const entries = [...params.entries()].sort(([left], [right]) => left.localeCompare(right));
  const sorted = new URLSearchParams();
  for (const [key, value] of entries) sorted.append(key, value);
  const text = sorted.toString();
  return text ? `?${text}` : "";
}

function replayDiff(job: CaptureReplayJob, result: PipelineResult): ReplayDiffSummary {
  const previousIndicatorCount = typeof job.metadata.previousIndicatorCount === "number" ? job.metadata.previousIndicatorCount : 0;
  const previousEntityCount = typeof job.metadata.previousEntityCount === "number" ? job.metadata.previousEntityCount : 0;
  const previousIncidentId = typeof job.metadata.previousIncidentId === "string" ? job.metadata.previousIncidentId : undefined;
  return {
    incidentChanged: Boolean(previousIncidentId && previousIncidentId !== result.incident?.id),
    indicatorDelta: result.indicators.length - previousIndicatorCount,
    entityDelta: result.entities.length - previousEntityCount,
    newReviewReasons: result.incident?.reviewReasons ?? []
  };
}

function readPromotionMetadata(metadata: Record<string, unknown>): DiscoveryPromotion[] {
  return Array.isArray(metadata.promotions)
    ? metadata.promotions.filter((item): item is DiscoveryPromotion => Boolean(item && typeof item === "object" && "discoveryEvidenceId" in item))
    : [];
}
