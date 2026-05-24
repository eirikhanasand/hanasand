import type {
  EvidenceCaptureCounts,
  EvidenceDelta,
  EvidenceDedupeGroup,
  EvidenceExtractorVersionSummary,
  EvidenceProvenanceChain,
  EvidenceQueryHelpers,
  EvidenceQueryScope,
  EvidenceRedactionSummary,
  DiscoveryEvidence,
  IncidentCandidate,
  LiveSearchEvidenceView,
  LiveSearchSnapshot,
  RawCapture,
  SourceFreshnessSummary,
  CaptureReplayJob
} from "../types.ts";

export interface EvidenceQueryData {
  captures: RawCapture[];
  incidents: IncidentCandidate[];
  replayJobs: CaptureReplayJob[];
  discoveryEvidence: DiscoveryEvidence[];
  liveSearchSnapshots: LiveSearchSnapshot[];
  evidenceDeltas: EvidenceDelta[];
}

export class InMemoryEvidenceQueries implements EvidenceQueryHelpers {
  constructor(private readonly data: () => EvidenceQueryData) {}

  latestCaptures(scope: EvidenceQueryScope): RawCapture[] {
    return applyLimit(this.scopedCaptures(scope), scope.limit)
      .sort((left, right) => right.collectedAt.localeCompare(left.collectedAt));
  }

  provenanceForClaim(scope: EvidenceQueryScope): EvidenceProvenanceChain[] {
    const captures = new Map(this.scopedCaptures(scope).map((capture) => [capture.id, capture]));
    const incidents = this.scopedIncidents(scope)
      .filter((incident) => !scope.captureId || incident.captureId === scope.captureId)
      .filter((incident) => !scope.claimId || incident.id === scope.claimId)
      .filter((incident) => matchesActor(incident, scope.actor));

    const chains = incidents.flatMap((incident): EvidenceProvenanceChain[] => {
      const capture = incident.captureId ? captures.get(incident.captureId) : undefined;
      if (!capture) return [];
      return [{
        tenantId: capture.tenantId,
        sourceId: capture.sourceId,
        taskId: capture.taskId,
        captureId: capture.id,
        incidentId: incident.id,
        extractorVersion: incident.extractorVersion ?? capture.provenance?.extractorVersion,
        collectedAt: capture.collectedAt,
        contentHash: capture.contentHash,
        url: capture.url,
        confidence: incident.confidence,
        claimValues: [
          incident.title,
          ...incident.entities.map((entity) => entity.value),
          ...incident.indicators.map((indicator) => indicator.value)
        ]
      }];
    });

    return applyLimit(chains.sort((left, right) => right.collectedAt.localeCompare(left.collectedAt)), scope.limit);
  }

  provenanceChainByResultId(resultId: string, scope: EvidenceQueryScope = {}): EvidenceProvenanceChain[] {
    const discovery = this.scopedDiscovery(scope).find((item) => item.resultId === resultId || item.id === resultId);
    if (discovery?.promotedToIncidentId) {
      return this.provenanceForClaim({ ...scope, claimId: discovery.promotedToIncidentId });
    }
    if (discovery?.promotedToCaptureId) {
      return this.provenanceForClaim({ ...scope, captureId: discovery.promotedToCaptureId });
    }
    if (discovery) {
      return [{
        tenantId: discovery.tenantId,
        sourceId: discovery.sourceId ?? discovery.provider,
        captureId: discovery.promotedToCaptureId ?? discovery.id,
        incidentId: discovery.promotedToIncidentId,
        extractorVersion: "discovery-evidence:v1",
        collectedAt: discovery.observedAt,
        contentHash: discovery.id,
        url: discovery.url ?? "",
        confidence: discovery.confidence,
        claimValues: [discovery.title, discovery.snippet].filter((value): value is string => Boolean(value))
      }];
    }
    return this.provenanceForClaim({ ...scope, claimId: resultId });
  }

  dedupeGroups(scope: EvidenceQueryScope = {}): EvidenceDedupeGroup[] {
    const groups = new Map<string, RawCapture[]>();
    for (const capture of this.scopedCaptures(scope)) {
      const key = dedupeGroupKey(capture);
      groups.set(key, [...(groups.get(key) ?? []), capture]);
    }

    return [...groups.entries()]
      .filter(([, captures]) => captures.length > 1)
      .map(([key, captures]) => ({
        key,
        captureIds: captures.map((capture) => capture.id),
        sourceIds: unique(captures.map((capture) => capture.sourceId)),
        canonicalUrls: unique(captures.map((capture) => capture.canonicalUrl ?? capture.url)),
        contentHashes: unique(captures.map((capture) => capture.contentHash)),
        normalizedTextHash: captures.find((capture) => capture.normalizedTextHash)?.normalizedTextHash,
        tenantId: captures.find((capture) => capture.tenantId)?.tenantId
      }));
  }

  replayStatus(scope: EvidenceQueryScope = {}): CaptureReplayJob[] {
    const captureIds = new Set(this.scopedCaptures(scope).map((capture) => capture.id));
    return applyLimit(this.data().replayJobs
      .filter((job) => (!scope.tenantId || job.tenantId === scope.tenantId))
      .filter((job) => !scope.captureId || job.captureId === scope.captureId)
      .filter((job) => captureIds.size === 0 || captureIds.has(job.captureId))
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)), scope.limit);
  }

  sourceFreshness(scope: EvidenceQueryScope = {}): SourceFreshnessSummary[] {
    const bySource = new Map<string, RawCapture[]>();
    for (const capture of this.scopedCaptures(scope)) {
      bySource.set(capture.sourceId, [...(bySource.get(capture.sourceId) ?? []), capture]);
    }

    return [...bySource.entries()].map(([sourceId, captures]) => {
      const sorted = captures.sort((left, right) => right.collectedAt.localeCompare(left.collectedAt));
      return {
        sourceId,
        tenantId: sorted.find((capture) => capture.tenantId)?.tenantId,
        latestCollectedAt: sorted[0]?.collectedAt,
        captureCount: sorted.length,
        latestCaptureId: sorted[0]?.id
      };
    });
  }

  redactionSummaries(scope: EvidenceQueryScope = {}): EvidenceRedactionSummary[] {
    return applyLimit(this.scopedCaptures(scope).map((capture) => ({
      captureId: capture.id,
      tenantId: capture.tenantId,
      sourceId: capture.sourceId,
      sensitive: capture.sensitive,
      storageKind: capture.storageKind,
      retentionClass: capture.retentionClass ?? (capture.sensitive ? "restricted_metadata" : "standard"),
      legalHold: Boolean(capture.legalHold || capture.retentionClass === "legal_hold"),
      bodyAvailableToApi: Boolean(capture.body && !capture.sensitive && capture.storageKind !== "metadata_only"),
      redactionPolicy: capture.redaction?.policy,
      reason: capture.redaction?.reason
    })), scope.limit);
  }

  captureCounts(scope: EvidenceQueryScope = {}): EvidenceCaptureCounts {
    const captures = this.scopedCaptures(scope);
    const byRetentionClass: Record<string, number> = {};
    for (const capture of captures) {
      const retentionClass = capture.retentionClass ?? (capture.sensitive ? "restricted_metadata" : "standard");
      byRetentionClass[retentionClass] = (byRetentionClass[retentionClass] ?? 0) + 1;
    }

    return {
      total: captures.length,
      byRetentionClass,
      sensitive: captures.filter((capture) => capture.sensitive).length,
      legalHold: captures.filter((capture) => capture.legalHold || capture.retentionClass === "legal_hold").length
    };
  }

  extractionVersions(scope: EvidenceQueryScope = {}): EvidenceExtractorVersionSummary[] {
    const captures = new Map(this.scopedCaptures(scope).map((capture) => [capture.id, capture]));
    const versions = new Map<string, EvidenceExtractorVersionSummary & { captureIds: Set<string> }>();
    for (const incident of this.scopedIncidents(scope)) {
      const capture = incident.captureId ? captures.get(incident.captureId) : undefined;
      if (!capture) continue;
      const version = incident.extractorVersion ?? capture.provenance?.extractorVersion ?? "unknown";
      const previous = versions.get(version) ?? {
        extractorVersion: version,
        captureCount: 0,
        incidentCount: 0,
        captureIds: new Set<string>()
      };
      previous.incidentCount += 1;
      previous.captureIds.add(capture.id);
      previous.captureCount = previous.captureIds.size;
      previous.latestCollectedAt = maxIso(previous.latestCollectedAt, capture.collectedAt);
      versions.set(version, previous);
    }

    for (const capture of captures.values()) {
      const version = capture.provenance?.extractorVersion ?? "unknown";
      const previous = versions.get(version) ?? {
        extractorVersion: version,
        captureCount: 0,
        incidentCount: 0,
        captureIds: new Set<string>()
      };
      previous.captureIds.add(capture.id);
      previous.captureCount = previous.captureIds.size;
      previous.latestCollectedAt = maxIso(previous.latestCollectedAt, capture.collectedAt);
      versions.set(version, previous);
    }

    return [...versions.values()].map(({ captureIds: _captureIds, ...summary }) => summary);
  }

  liveSnapshotsByQuery(query: string, scope: EvidenceQueryScope = {}): LiveSearchSnapshot[] {
    const normalized = normalizeQuery(query);
    return applyLimit(this.scopedSnapshots(scope)
      .filter((snapshot) => snapshot.normalizedQuery === normalized)
      .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt)), scope.limit);
  }

  getSearchDeltas(query: string, sinceCursor?: string, scope: EvidenceQueryScope = {}): EvidenceDelta[] {
    const normalized = normalizeQuery(query);
    return applyLimit(this.scopedDeltas(scope)
      .filter((delta) => delta.normalizedQuery === normalized)
      .filter((delta) => afterCursor(delta, sinceCursor))
      .sort(compareDeltaAscending), scope.limit);
  }

  activeRunEvidence(runId: string, scope: EvidenceQueryScope = {}): LiveSearchEvidenceView {
    return this.getActiveRunEvidence(runId, undefined, scope);
  }

  getActiveRunEvidence(runId: string, sinceCursor?: string, scope: EvidenceQueryScope = {}): LiveSearchEvidenceView {
    const snapshots = this.scopedSnapshots(scope).filter((snapshot) => snapshot.runId === runId);
    const deltas = this.scopedDeltas(scope)
      .filter((delta) => delta.runId === runId)
      .filter((delta) => afterCursor(delta, sinceCursor))
      .sort(compareDeltaAscending);
    return this.evidenceView(snapshots, scope, deltas);
  }

  newlyAvailableEvidenceSince(since: string, scope: EvidenceQueryScope = {}): LiveSearchEvidenceView {
    const snapshots = this.scopedSnapshots(scope).filter((snapshot) => snapshot.capturedAt > since);
    const discoveryEvidence = this.scopedDiscovery(scope).filter((item) => item.observedAt > since);
    const captures = this.scopedCaptures(scope).filter((capture) => capture.collectedAt > since);
    const captureIds = new Set(captures.map((capture) => capture.id));
    const incidents = this.scopedIncidents(scope).filter((incident) => {
      if (incident.firstSeenAt > since) return true;
      return Boolean(incident.captureId && captureIds.has(incident.captureId));
    });
    const deltas = this.scopedDeltas(scope).filter((delta) => delta.observedAt > since).sort(compareDeltaAscending);
    return { discoveryEvidence, captures, incidents, snapshots, deltas, nextCursor: latestCursor(deltas) };
  }

  getEvidenceTimeline(query: string, scope: EvidenceQueryScope = {}): EvidenceDelta[] {
    const normalized = normalizeQuery(query);
    return applyLimit(this.scopedDeltas(scope)
      .filter((delta) => delta.normalizedQuery === normalized)
      .sort(compareDeltaAscending), scope.limit);
  }

  pruneStaleSnapshots(now: string, scope: EvidenceQueryScope = {}): LiveSearchSnapshot[] {
    return this.scopedSnapshots(scope).filter((snapshot) => Boolean(snapshot.staleAt && snapshot.staleAt <= now));
  }

  private scopedCaptures(scope: EvidenceQueryScope = {}): RawCapture[] {
    return this.data().captures
      .filter((capture) => !scope.tenantId || capture.tenantId === scope.tenantId)
      .filter((capture) => !scope.sourceId || capture.sourceId === scope.sourceId)
      .filter((capture) => !scope.captureId || capture.id === scope.captureId);
  }

  private scopedIncidents(scope: EvidenceQueryScope = {}): IncidentCandidate[] {
    const captureIds = new Set(this.scopedCaptures(scope).map((capture) => capture.id));
    return this.data().incidents
      .filter((incident) => !scope.sourceId || incident.sourceId === scope.sourceId)
      .filter((incident) => !scope.claimId || incident.id === scope.claimId)
      .filter((incident) => !incident.captureId || captureIds.has(incident.captureId));
  }

  private scopedDiscovery(scope: EvidenceQueryScope = {}): DiscoveryEvidence[] {
    return this.data().discoveryEvidence
      .filter((item) => !scope.tenantId || item.tenantId === scope.tenantId)
      .filter((item) => !scope.sourceId || item.sourceId === scope.sourceId)
      .filter((item) => !scope.actor || item.normalizedQuery === normalizeQuery(scope.actor) || item.snippet.toLowerCase().includes(scope.actor.toLowerCase()));
  }

  private scopedSnapshots(scope: EvidenceQueryScope = {}): LiveSearchSnapshot[] {
    return this.data().liveSearchSnapshots
      .filter((snapshot) => !scope.tenantId || snapshot.tenantId === scope.tenantId)
      .filter((snapshot) => !scope.actor || snapshot.normalizedQuery === normalizeQuery(scope.actor));
  }

  private scopedDeltas(scope: EvidenceQueryScope = {}): EvidenceDelta[] {
    return this.data().evidenceDeltas
      .filter((delta) => !scope.tenantId || delta.tenantId === scope.tenantId)
      .filter((delta) => !scope.sourceId || delta.sourceId === scope.sourceId)
      .filter((delta) => !scope.captureId || delta.captureIds.includes(scope.captureId) || (delta.subjectType === "capture" && delta.subjectId === scope.captureId))
      .filter((delta) => !scope.claimId || delta.incidentIds.includes(scope.claimId) || (delta.subjectType === "extraction" && delta.subjectId === scope.claimId));
  }

  private evidenceView(snapshots: LiveSearchSnapshot[], scope: EvidenceQueryScope, deltas: EvidenceDelta[] = []): LiveSearchEvidenceView {
    const discoveryIds = new Set([
      ...snapshots.flatMap((snapshot) => snapshot.discoveryEvidenceIds),
      ...deltas.flatMap((delta) => delta.discoveryEvidenceIds)
    ]);
    const captureIds = new Set([
      ...snapshots.flatMap((snapshot) => snapshot.captureIds),
      ...deltas.flatMap((delta) => delta.captureIds)
    ]);
    const incidentIds = new Set([
      ...snapshots.flatMap((snapshot) => snapshot.incidentIds),
      ...deltas.flatMap((delta) => delta.incidentIds)
    ]);
    return {
      discoveryEvidence: this.scopedDiscovery(scope).filter((item) => discoveryIds.has(item.id)),
      captures: this.scopedCaptures(scope).filter((capture) => captureIds.has(capture.id)),
      incidents: this.scopedIncidents(scope).filter((incident) => incidentIds.has(incident.id)),
      snapshots,
      deltas,
      nextCursor: latestCursor(deltas)
    };
  }
}

function dedupeGroupKey(capture: RawCapture): string {
  return `${capture.tenantId ?? "global"}:${capture.sourceId}:${capture.normalizedTextHash ?? capture.canonicalUrl ?? capture.url}:${capture.publishedAt ?? ""}`;
}

function matchesActor(incident: IncidentCandidate, actor: string | undefined): boolean {
  if (!actor) return true;
  const normalized = actor.toLowerCase();
  return incident.entities.some((entity) =>
    (entity.type === "actor" || entity.type === "ransomware_family") &&
    [entity.value, entity.normalizedValue, ...(entity.aliases ?? [])].some((value) => value?.toLowerCase() === normalized)
  );
}

function applyLimit<T>(items: T[], limit: number | undefined): T[] {
  return limit === undefined ? items : items.slice(0, Math.max(0, limit));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function maxIso(left: string | undefined, right: string): string {
  return !left || right.localeCompare(left) > 0 ? right : left;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function afterCursor(delta: EvidenceDelta, sinceCursor: string | undefined): boolean {
  return !sinceCursor || delta.cursor > sinceCursor;
}

function compareDeltaAscending(left: EvidenceDelta, right: EvidenceDelta): number {
  return left.cursor.localeCompare(right.cursor);
}

function latestCursor(deltas: EvidenceDelta[]): string | undefined {
  return deltas.at(-1)?.cursor;
}
