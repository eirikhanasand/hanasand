// @ts-nocheck
import type { TelegramPublicRuntimeCollectionDto } from "../adapters/telegramPublic.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import type {
  CollectedItem,
  DiscoveryEvidence,
  EvidenceDelta,
  IncidentCandidate,
  LiveSearchSnapshot,
  PipelineResult,
  RawCapture,
  SourceRecord
} from "../types.ts";
import { hashContent, stableId } from "../utils.ts";
import type { ScraperStore } from "./memoryStore.ts";

export interface RuntimeEvidencePersistenceResult {
  source?: SourceRecord;
  discoveryEvidence: DiscoveryEvidence[];
  captures: RawCapture[];
  incidents: IncidentCandidate[];
  deltas: EvidenceDelta[];
  snapshot: LiveSearchSnapshot;
  nextCursor?: string;
  safeOutput: {
    sensitiveBodiesExposed: false;
    objectKeysExposed: false;
    rawMediaPayloadsExposed: false;
    privateDataExposed: false;
  };
}

export function persistTelegramPublicRuntimeEvidence(
  store: ScraperStore,
  runtime: TelegramPublicRuntimeCollectionDto,
  options: { tenantId?: string; runId?: string; query: string; generatedAt?: string } 
): RuntimeEvidencePersistenceResult {
  const generatedAt = options.generatedAt ?? runtime.generatedAt;
  const normalizedQuery = normalizeQuery(options.query);
  const source = applySourcePatch(store, runtime);
  const discoveryByUrl = new Map<string, DiscoveryEvidence>();
  const discoveryEvidence = runtime.evidence.map((item) => {
    const discovery = discoveryFromTelegramEvidence(runtime, item, {
      tenantId: options.tenantId ?? source?.tenantId,
      query: options.query,
      normalizedQuery,
      generatedAt
    });
    const stored = store.getDiscoveryEvidence(discovery.id) ?? store.saveDiscoveryEvidence(discovery);
    discoveryByUrl.set(item.messageUrl, stored);
    return stored;
  });

  const persisted = runtime.promotedItems.map((item) => persistPromotedItem(store, item, {
    tenantId: options.tenantId ?? source?.tenantId,
    runId: options.runId,
    query: options.query,
    normalizedQuery,
    generatedAt
  }));

  const captures = persisted.map((item) => item.capture);
  const incidents = persisted.map((item) => item.incident).filter((item): item is IncidentCandidate => Boolean(item));
  for (const item of persisted) {
    const discovery = discoveryByUrl.get(item.promotedItem.url);
    if (!discovery) continue;
    if (discovery.promotedToCaptureId === item.capture.id && discovery.promotedToIncidentId === item.incident?.id) continue;
    store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      taskId: item.promotedItem.taskId,
      captureId: item.capture.id,
      incidentId: item.incident?.id,
      promotedAt: generatedAt,
      promotedBy: "collector"
    });
  }

  const runtimeDeltas = [
    ...connectorNewMessageDeltas(runtime, discoveryByUrl, {
      tenantId: options.tenantId ?? source?.tenantId,
      runId: options.runId,
      query: options.query,
      normalizedQuery,
      generatedAt
    }),
    ...runtime.poll.updatedMessages.map((item) => runtimeEvidenceDelta(runtime, item, {
      kind: "updated",
      subjectId: discoveryByUrl.get(item.messageUrl)?.id,
      tenantId: options.tenantId ?? source?.tenantId,
      runId: options.runId,
      query: options.query,
      normalizedQuery,
      generatedAt
    })),
    ...runtime.poll.deletedOrUnavailable.map((item) => runtimeEvidenceDelta(runtime, item, {
      kind: "expired",
      subjectId: discoveryByUrl.get(item.messageUrl)?.id,
      tenantId: options.tenantId ?? source?.tenantId,
      runId: options.runId,
      query: options.query,
      normalizedQuery,
      generatedAt
    })),
    ...persisted.flatMap((item) => item.incident ? [relationshipPromotionDelta({
      capture: item.capture,
      incident: item.incident
    }, {
      tenantId: options.tenantId ?? source?.tenantId,
      runId: options.runId,
      query: options.query,
      normalizedQuery,
      generatedAt
    })] : [])
  ].map((delta) => store.saveEvidenceDelta(delta));

  const snapshot = store.saveLiveSearchSnapshot({
    id: stableId("snapshot", `telegram-runtime:${runtime.sourceId}:${normalizedQuery}:${options.runId ?? ""}:${generatedAt}`),
    tenantId: options.tenantId ?? source?.tenantId,
    query: options.query,
    normalizedQuery,
    runId: options.runId,
    status: liveSnapshotStatus(runtime.status),
    capturedAt: generatedAt,
    discoveryEvidenceIds: discoveryEvidence.map((item) => item.id),
    captureIds: captures.map((item) => item.id),
    incidentIds: incidents.map((item) => item.id),
    newEvidenceIds: [
      ...discoveryEvidence.map((item) => item.id),
      ...captures.map((item) => item.id),
      ...incidents.map((item) => item.id),
      ...runtimeDeltas.map((item) => item.id)
    ],
    deltaCursors: runtimeDeltas.map((item) => item.cursor),
    metadata: {
      adapter: "telegram_public",
      runtimeStatus: runtime.status,
      channelHandle: runtime.channelHandle,
      sourceId: runtime.sourceId,
      collection: runtime.collection,
      schedulerHints: runtime.schedulerHints,
      poll: {
        cursor: runtime.poll.cursor,
        nextCursor: runtime.poll.nextCursor,
        newMessages: runtime.poll.newMessages.length,
        updatedMessages: runtime.poll.updatedMessages.length,
        deletedOrUnavailable: runtime.poll.deletedOrUnavailable.length,
        promotedExtractionIds: runtime.poll.promotedExtractionIds
      },
      connector: connectorMetadata(runtime),
      media: runtime.poll.media
    },
    retentionClass: "live_search_snapshot"
  });

  return {
    source,
    discoveryEvidence: discoveryEvidence.map((item) => store.getDiscoveryEvidence(item.id) ?? item),
    captures,
    incidents,
    deltas: store.listEvidenceDeltas().filter((delta) => snapshot.deltaCursors?.includes(delta.cursor)),
    snapshot,
    nextCursor: snapshot.deltaCursors?.at(-1) ?? runtimeDeltas.at(-1)?.cursor,
    safeOutput: {
      sensitiveBodiesExposed: false,
      objectKeysExposed: false,
      rawMediaPayloadsExposed: false,
      privateDataExposed: false
    }
  };
}

function persistPromotedItem(
  store: ScraperStore,
  item: CollectedItem,
  options: { tenantId?: string; runId?: string; query: string; normalizedQuery: string; generatedAt: string }
): { promotedItem: CollectedItem; result: PipelineResult; capture: RawCapture; incident?: IncidentCandidate } {
  const promotedItem = {
    ...item,
    metadata: {
      ...item.metadata,
      query: options.query,
      normalizedQuery: options.normalizedQuery,
      runId: options.runId,
      runtimePersistedAt: options.generatedAt
    }
  };
  const result = processCollectedItem(promotedItem);
  const saved = store.savePipelineResult({
    ...result,
    capture: {
      ...result.capture,
      tenantId: options.tenantId,
      retentionClass: "public_chat_text",
      metadata: {
        ...result.capture.metadata,
        query: options.query,
        normalizedQuery: options.normalizedQuery,
        runId: options.runId,
        runtimePersistedAt: options.generatedAt
      },
      provenance: {
        ...result.capture.provenance,
        sourceId: result.capture.provenance?.sourceId ?? result.capture.sourceId,
        captureId: result.capture.provenance?.captureId ?? result.capture.id,
        url: result.capture.provenance?.url ?? result.capture.url,
        collectedAt: result.capture.provenance?.collectedAt ?? result.capture.collectedAt,
        contentHash: result.capture.provenance?.contentHash ?? result.capture.contentHash,
        extractorVersion: result.capture.provenance?.extractorVersion ?? "telegram_public_runtime:v1",
        tenantId: options.tenantId,
        adapterVersion: "telegram_public_runtime:v1"
      }
    }
  });
  return { promotedItem, result: saved, capture: saved.capture, incident: saved.incident };
}

function applySourcePatch(store: ScraperStore, runtime: TelegramPublicRuntimeCollectionDto): SourceRecord | undefined {
  const existing = store.getSource(runtime.sourceId);
  if (!existing) return undefined;
  const source = store.saveSource({
    ...existing,
    updatedAt: runtime.sourcePatch.updatedAt,
    crawlState: {
      ...(existing.crawlState ?? { retryCount: 0 }),
      ...runtime.sourcePatch.crawlState
    },
    metadata: {
      ...(existing.metadata ?? {}),
      ...(runtime.sourcePatch.metadata ?? {}),
      telegramPublicConnector: connectorMetadata(runtime)
    }
  });
  return source;
}

function connectorMetadata(runtime: TelegramPublicRuntimeCollectionDto): Record<string, unknown> {
  return {
    generatedAt: runtime.connector.generatedAt,
    sourceId: runtime.connector.sourceId,
    channelHandle: runtime.connector.channelHandle,
    sourceHealthPatch: runtime.connector.sourceHealthPatch,
    publicMessageProvenance: runtime.connector.publicMessageProvenance.map((item) => ({
      sourceId: item.sourceId,
      channel: item.channel,
      messageId: item.messageId,
      messageUrl: item.messageUrl,
      messageTimestamp: item.messageTimestamp,
      contentHash: item.contentHash,
      confidence: item.confidence,
      state: item.state
    })),
    deltas: {
      newMessageIds: runtime.connector.deltas.newMessageIds,
      editedMessageIds: runtime.connector.deltas.editedMessageIds,
      deletedOrUnavailableMessageIds: runtime.connector.deltas.deletedOrUnavailableMessageIds
    },
    promotionHandoff: runtime.connector.promotionHandoff,
    actorReadiness: runtime.connector.actorReadiness,
    safeOutput: runtime.connector.safeOutput
  };
}

function connectorNewMessageDeltas(
  runtime: TelegramPublicRuntimeCollectionDto,
  discoveryByUrl: Map<string, DiscoveryEvidence>,
  options: { tenantId?: string; runId?: string; query: string; normalizedQuery: string; generatedAt: string }
): EvidenceDelta[] {
  const updatedOrDeleted = new Set([
    ...runtime.connector.deltas.editedMessageIds,
    ...runtime.connector.deltas.deletedOrUnavailableMessageIds
  ]);
  return runtime.connector.deltas.newMessageIds
    .filter((messageId) => !updatedOrDeleted.has(messageId))
    .map((messageId) => {
      const provenance = runtime.connector.publicMessageProvenance.find((item) => item.messageId === messageId);
      const subjectId = provenance
        ? discoveryByUrl.get(provenance.messageUrl)?.id ?? stableId("disc", `telegram-runtime:${runtime.sourceId}:${provenance.messageUrl}:${provenance.contentHash ?? messageId}`)
        : stableId("disc", `telegram-runtime:${runtime.sourceId}:${messageId}`);
      return {
        id: stableId("delta", `telegram-runtime:connector-new:${runtime.sourceId}:${messageId}:${options.generatedAt}`),
        tenantId: options.tenantId,
        query: options.query,
        normalizedQuery: options.normalizedQuery,
        runId: options.runId,
        cursor: "",
        kind: "added",
        subjectType: "discovery_evidence",
        subjectId,
        observedAt: provenance?.messageTimestamp ?? options.generatedAt,
        sourceId: runtime.sourceId,
        discoveryEvidenceIds: [subjectId],
        captureIds: [],
        incidentIds: [],
        relationshipIds: [],
        policyEventIds: [],
        retentionClass: "evidence_delta",
        metadata: {
          adapter: "telegram_public",
          connectorDelta: true,
          deltaType: "new_message",
          channel: provenance?.channel ?? runtime.channelHandle,
          messageId,
          messageUrl: provenance?.messageUrl,
          messageState: provenance?.state ?? "available",
          contentHash: provenance?.contentHash,
          confidence: provenance?.confidence,
          mediaRetention: "metadata_only",
          rawMediaPayloadsExposed: false,
          privateDataExposed: false
        }
      };
    });
}

function discoveryFromTelegramEvidence(
  runtime: TelegramPublicRuntimeCollectionDto,
  item: TelegramPublicRuntimeCollectionDto["evidence"][number],
  options: { tenantId?: string; query: string; normalizedQuery: string; generatedAt: string }
): DiscoveryEvidence {
  const messageKey = `${runtime.sourceId}:${item.messageUrl}:${item.contentHash ?? item.messageId ?? item.messageTimestamp ?? options.generatedAt}`;
  return {
    id: stableId("disc", `telegram-runtime:${messageKey}`),
    tenantId: options.tenantId,
    query: options.query,
    normalizedQuery: options.normalizedQuery,
    provider: "public_channel",
    evidenceType: "public_channel_snippet",
    resultId: item.promotedExtractionId ?? stableId("telegram-result", messageKey),
    observedAt: item.messageTimestamp ?? options.generatedAt,
    title: `${item.channel} #${item.messageId ?? "unknown"}`,
    snippet: item.snippet,
    url: item.messageUrl,
    sourceId: runtime.sourceId,
    confidence: item.confidence,
    retentionClass: "public_chat_text",
    metadata: {
      adapter: "telegram_public",
      channel: item.channel,
      messageId: item.messageId,
      messageState: item.messageState ?? "available",
      editedAt: item.editedAt,
      contentHash: item.contentHash,
      media: item.media ? { retention: "metadata_only", rawFetchAllowed: false, count: item.media.items.length } : undefined,
      safeOutput: {
        rawMediaPayloadsExposed: false,
        privateDataExposed: false
      }
    }
  };
}

function runtimeEvidenceDelta(
  runtime: TelegramPublicRuntimeCollectionDto,
  item: TelegramPublicRuntimeCollectionDto["evidence"][number],
  options: {
    kind: "updated" | "expired";
    subjectId?: string;
    tenantId?: string;
    runId?: string;
    query: string;
    normalizedQuery: string;
    generatedAt: string;
  }
): EvidenceDelta {
  const subjectId = options.subjectId ?? stableId("disc", `telegram-runtime:${runtime.sourceId}:${item.messageUrl}:${item.contentHash ?? item.messageId ?? options.generatedAt}`);
  return {
    id: stableId("delta", `telegram-runtime:${options.kind}:${subjectId}:${options.generatedAt}`),
    tenantId: options.tenantId,
    query: options.query,
    normalizedQuery: options.normalizedQuery,
    runId: options.runId,
    cursor: "",
    kind: options.kind,
    subjectType: "discovery_evidence",
    subjectId,
    observedAt: options.kind === "expired" ? options.generatedAt : item.editedAt ?? item.messageTimestamp ?? options.generatedAt,
    sourceId: runtime.sourceId,
    discoveryEvidenceIds: [subjectId],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: {
      adapter: "telegram_public",
      channel: item.channel,
      messageId: item.messageId,
      messageState: item.messageState ?? (options.kind === "expired" ? "unavailable" : "available"),
      contentHash: item.contentHash,
      connectorDelta: true,
      mediaRetention: "metadata_only",
      rawMediaPayloadsExposed: false,
      privateDataExposed: false
    }
  };
}

function relationshipPromotionDelta(
  item: { capture: RawCapture; incident: IncidentCandidate },
  options: { tenantId?: string; runId?: string; query: string; normalizedQuery: string; generatedAt: string }
): EvidenceDelta {
  const relationshipId = stableId("rel", `runtime:${item.incident.id}:${item.capture.id}`);
  return {
    id: stableId("delta", `telegram-runtime:relationship:${relationshipId}:${options.generatedAt}`),
    tenantId: options.tenantId,
    query: options.query,
    normalizedQuery: options.normalizedQuery,
    runId: options.runId,
    cursor: "",
    kind: "promoted",
    subjectType: "relationship",
    subjectId: relationshipId,
    observedAt: options.generatedAt,
    sourceId: item.capture.sourceId,
    discoveryEvidenceIds: readStringArray(item.capture.metadata.discoveryEvidenceId),
    captureIds: [item.capture.id],
    incidentIds: [item.incident.id],
    relationshipIds: [relationshipId],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: {
      adapter: "telegram_public",
      promotion: "runtime_public_channel_relationship",
      captureId: item.capture.id,
      incidentId: item.incident.id,
      contentHash: item.capture.contentHash
    }
  };
}

function liveSnapshotStatus(status: TelegramPublicRuntimeCollectionDto["status"]): LiveSearchSnapshot["status"] {
  if (status === "ready") return "ready";
  if (status === "partial" || status === "high_duplicate" || status === "high_churn") return "partial";
  if (status === "blocked" || status === "policy_disabled") return "blocked";
  if (status === "unavailable" || status === "rate_limited") return "degraded";
  return "partial";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
