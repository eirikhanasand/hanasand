import { processCollectedItem } from "../pipeline/pipeline.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { CollectionTask, DiscoveryEvidence, SourceRecord } from "../types.ts";
import { hashContent, stableId } from "../utils.ts";
import { StaticWebAdapter, type StaticWebAdapterOptions } from "./staticWeb.ts";

export type PublicChannelMatchState = "matched" | "not_matched" | "not_configured" | "pending_review" | "blocked";
export type ClearWebPromotionStatus = "captured" | "blocked" | "no_incident" | "duplicate";
export type ClearWebPromotionFailureCategory =
  | "policy_blocked"
  | "robots_blocked"
  | "not_modified"
  | "rate_limited"
  | "not_found"
  | "http_error"
  | "too_large"
  | "unsupported_mime"
  | "duplicate_canonical"
  | "no_incident";

export interface SearchResultHandoff {
  query: string;
  tenantId?: string;
  runId?: string;
  provider: string;
  resultId?: string;
  title: string;
  snippet: string;
  url: string;
  rank: number;
  observedAt: string;
  confidence?: number;
  publicChannelMatchState?: PublicChannelMatchState;
  publicChannelEvidenceIds?: string[];
  publicChannelMessageUrls?: string[];
}

export interface ClearWebCollectedItemProof {
  url: string;
  title?: string;
  contentHash: string;
  rawTextLength: number;
  linkCount: number;
}

export interface ClearWebApiPromotionMetadata {
  agent06: {
    taskId: string;
    discoveryId: string;
    captureId?: string;
    contentHash?: string;
    canonicalUrl?: string;
    evidenceStage: "captured_page" | "blocked" | "duplicate_canonical" | "no_incident";
    persistenceReady: boolean;
  };
  agent07: {
    query: string;
    normalizedQuery: string;
    incidentId?: string;
    parserProfile?: string;
    publicChannelMatchState: PublicChannelMatchState;
    answerState: "answerable" | "partial_support" | "searching" | "blocked";
  };
  agent09: {
    status: ClearWebPromotionStatus;
    failureCategory?: ClearWebPromotionFailureCategory;
    responseStatus?: number;
    retryAfterSeconds?: number;
    publicTiImpact: "promoted" | "partial" | "searching" | "blocked";
  };
}

export interface ClearWebPromotionProof {
  query: string;
  normalizedQuery: string;
  sourceId: string;
  discoveryId: string;
  taskId: string;
  captureId?: string;
  incidentId?: string;
  canonicalUrl?: string;
  contentHash?: string;
  parserProfile?: string;
  evidenceStage: "captured_page" | "blocked" | "duplicate_canonical" | "no_incident";
  publicChannelMatchState: PublicChannelMatchState;
  publicChannelEvidenceIds: string[];
  publicChannelMessageUrls: string[];
  status: ClearWebPromotionStatus;
  failureCategory?: ClearWebPromotionFailureCategory;
  responseStatus?: number;
  retryAfterSeconds?: number;
  collectedItem?: ClearWebCollectedItemProof;
  apiPromotionMetadata: ClearWebApiPromotionMetadata;
  warnings: string[];
}

export interface ClearWebPromotionOptions extends StaticWebAdapterOptions {
  maxBytes?: number;
}

export async function promoteSearchResultToCanonicalCapture(
  store: ScraperStore,
  source: SourceRecord,
  handoff: SearchResultHandoff,
  options: ClearWebPromotionOptions = {}
): Promise<ClearWebPromotionProof> {
  const normalizedQuery = normalizeQuery(handoff.query);
  const resultId = handoff.resultId ?? stableId("result", `${handoff.provider}:${handoff.url}:${handoff.rank}`);
  const discovery = store.saveDiscoveryEvidence(discoveryEvidenceFor(source, handoff, normalizedQuery, resultId));
  const task = captureTaskFor(source, handoff, discovery, options.maxBytes ?? 1_000_000);
  const adapter = new StaticWebAdapter(options);
  const collected = await adapter.collect(source, task);
  const item = collected.items[0];
  const publicChannelMatchState = handoff.publicChannelMatchState ?? "not_configured";
  const failureCategory = metadataString(collected.metadata, "failureCategory") as ClearWebPromotionFailureCategory | undefined;
  const responseStatus = metadataNumber(collected.metadata, "responseStatus");
  const retryAfterSeconds = metadataNumber(collected.metadata, "retryAfterSeconds");

  if (!item) {
    store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      taskId: task.id,
      promotedAt: handoff.observedAt,
      promotedBy: "collector"
    });

    const proofBase = proofSkeleton(source, handoff, normalizedQuery, discovery.id, task.id, publicChannelMatchState);
    return {
      ...proofBase,
      evidenceStage: "blocked",
      status: "blocked",
      failureCategory,
      responseStatus,
      retryAfterSeconds,
      apiPromotionMetadata: apiPromotionMetadataFor({
        proofBase,
        evidenceStage: "blocked",
        status: "blocked",
        failureCategory,
        responseStatus,
        retryAfterSeconds
      }),
      warnings: collected.warnings
    };
  }

  const parserProfile = parserProfileFor(item.url, item.metadata);
  const collectedItem = collectedItemProof(item);
  const pipeline = processCollectedItem({
    ...item,
    metadata: {
      ...item.metadata,
      query: handoff.query,
      normalizedQuery,
      runId: handoff.runId,
      promotedFromDiscoveryId: discovery.id,
      searchProvider: handoff.provider,
      searchRank: handoff.rank,
      discoveryObservedAt: handoff.observedAt,
      evidenceStage: "captured_page",
      parserProfile,
      publicChannelMatchState,
      publicChannelEvidenceIds: handoff.publicChannelEvidenceIds ?? [],
      publicChannelMessageUrls: handoff.publicChannelMessageUrls ?? []
    }
  });
  const duplicate = store.findDuplicateCapture(pipeline.capture);
  const stored = store.savePipelineResult(pipeline);
  const duplicateIncident = duplicate ? store.listIncidents().find((incident) => incident.captureId === duplicate.id) : undefined;
  const incidentId = duplicate ? duplicateIncident?.id : stored.incident?.id;
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    taskId: task.id,
    captureId: stored.capture.id,
    incidentId,
    promotedAt: item.collectedAt,
    promotedBy: "collector"
  });

  const proofBase = proofSkeleton(source, handoff, normalizedQuery, discovery.id, task.id, publicChannelMatchState);
  if (duplicate) {
    return {
      ...proofBase,
      captureId: duplicate.id,
      incidentId,
      canonicalUrl: duplicate.url,
      contentHash: duplicate.contentHash,
      parserProfile: String(duplicate.metadata.parserProfile ?? parserProfile),
      evidenceStage: "duplicate_canonical",
      status: "duplicate",
      failureCategory: "duplicate_canonical",
      responseStatus: metadataNumber(item.metadata, "responseStatus"),
      collectedItem,
      apiPromotionMetadata: apiPromotionMetadataFor({
        proofBase,
        captureId: duplicate.id,
        incidentId,
        canonicalUrl: duplicate.url,
        contentHash: duplicate.contentHash,
        parserProfile: String(duplicate.metadata.parserProfile ?? parserProfile),
        evidenceStage: "duplicate_canonical",
        status: "duplicate",
        failureCategory: "duplicate_canonical",
        publicChannelMatchState
      }),
      warnings: [...collected.warnings, `duplicate canonical capture ${duplicate.id}`]
    };
  }

  const status: ClearWebPromotionStatus = incidentId ? "captured" : "no_incident";
  const evidenceStage = incidentId ? "captured_page" : "no_incident";
  const noIncidentFailure = incidentId ? undefined : "no_incident";
  return {
    ...proofBase,
    captureId: stored.capture.id,
    incidentId,
    canonicalUrl: stored.capture.url,
    contentHash: stored.capture.contentHash,
    parserProfile: String(stored.capture.metadata.parserProfile ?? "generic_static_web"),
    evidenceStage,
    status,
    failureCategory: noIncidentFailure,
    responseStatus: metadataNumber(stored.capture.metadata, "responseStatus"),
    collectedItem,
    apiPromotionMetadata: apiPromotionMetadataFor({
      proofBase,
      captureId: stored.capture.id,
      incidentId,
      canonicalUrl: stored.capture.url,
      contentHash: stored.capture.contentHash,
      parserProfile: String(stored.capture.metadata.parserProfile ?? "generic_static_web"),
      evidenceStage,
      status,
      failureCategory: noIncidentFailure,
      responseStatus: metadataNumber(stored.capture.metadata, "responseStatus"),
      publicChannelMatchState
    }),
    warnings: collected.warnings
  };
}

function discoveryEvidenceFor(
  source: SourceRecord,
  handoff: SearchResultHandoff,
  normalizedQuery: string,
  resultId: string
): DiscoveryEvidence {
  return {
    id: stableId("disc", `${handoff.provider}:${normalizedQuery}:${resultId}`),
    tenantId: handoff.tenantId,
    query: handoff.query,
    normalizedQuery,
    provider: "search_provider",
    evidenceType: "search_snippet",
    resultId,
    observedAt: handoff.observedAt,
    title: handoff.title,
    snippet: handoff.snippet,
    url: handoff.url,
    sourceId: source.id,
    rank: handoff.rank,
    confidence: handoff.confidence ?? 0.62,
    metadata: {
      searchProvider: handoff.provider,
      sourceType: source.type,
      targetUrl: handoff.url,
      snippetHash: hashContent(handoff.snippet),
      promotion: "canonical_capture_required",
      publicChannelMatchState: handoff.publicChannelMatchState ?? "not_configured",
      publicChannelEvidenceIds: handoff.publicChannelEvidenceIds ?? [],
      publicChannelMessageUrls: handoff.publicChannelMessageUrls ?? []
    },
    retentionClass: "discovery_snippet"
  };
}

function proofSkeleton(
  source: SourceRecord,
  handoff: SearchResultHandoff,
  normalizedQuery: string,
  discoveryId: string,
  taskId: string,
  publicChannelMatchState: PublicChannelMatchState
): Pick<
  ClearWebPromotionProof,
  | "query"
  | "normalizedQuery"
  | "sourceId"
  | "discoveryId"
  | "taskId"
  | "publicChannelMatchState"
  | "publicChannelEvidenceIds"
  | "publicChannelMessageUrls"
> {
  return {
    query: handoff.query,
    normalizedQuery,
    sourceId: source.id,
    discoveryId,
    taskId,
    publicChannelMatchState,
    publicChannelEvidenceIds: handoff.publicChannelEvidenceIds ?? [],
    publicChannelMessageUrls: handoff.publicChannelMessageUrls ?? []
  };
}

function apiPromotionMetadataFor(input: {
  proofBase: Pick<ClearWebPromotionProof, "query" | "normalizedQuery" | "taskId" | "discoveryId" | "publicChannelMatchState">;
  captureId?: string;
  incidentId?: string;
  canonicalUrl?: string;
  contentHash?: string;
  parserProfile?: string;
  evidenceStage: ClearWebApiPromotionMetadata["agent06"]["evidenceStage"];
  status: ClearWebPromotionStatus;
  failureCategory?: ClearWebPromotionFailureCategory;
  responseStatus?: number;
  retryAfterSeconds?: number;
  publicChannelMatchState?: PublicChannelMatchState;
}): ClearWebApiPromotionMetadata {
  const matchState = input.publicChannelMatchState ?? input.proofBase.publicChannelMatchState;
  const answerState = answerStateFor(input.status, matchState, input.incidentId);
  const publicTiImpact = publicTiImpactFor(input.status, matchState);
  return {
    agent06: {
      taskId: input.proofBase.taskId,
      discoveryId: input.proofBase.discoveryId,
      captureId: input.captureId,
      contentHash: input.contentHash,
      canonicalUrl: input.canonicalUrl,
      evidenceStage: input.evidenceStage,
      persistenceReady: Boolean(input.captureId && input.contentHash)
    },
    agent07: {
      query: input.proofBase.query,
      normalizedQuery: input.proofBase.normalizedQuery,
      incidentId: input.incidentId,
      parserProfile: input.parserProfile,
      publicChannelMatchState: matchState,
      answerState
    },
    agent09: {
      status: input.status,
      failureCategory: input.failureCategory,
      responseStatus: input.responseStatus,
      retryAfterSeconds: input.retryAfterSeconds,
      publicTiImpact
    }
  };
}

function answerStateFor(
  status: ClearWebPromotionStatus,
  publicChannelMatchState: PublicChannelMatchState,
  incidentId?: string
): ClearWebApiPromotionMetadata["agent07"]["answerState"] {
  if (status === "blocked") return "blocked";
  if (incidentId) return publicChannelMatchState === "matched" ? "partial_support" : "answerable";
  if (status === "duplicate") return "answerable";
  return "searching";
}

function publicTiImpactFor(
  status: ClearWebPromotionStatus,
  publicChannelMatchState: PublicChannelMatchState
): ClearWebApiPromotionMetadata["agent09"]["publicTiImpact"] {
  if (status === "blocked") return "blocked";
  if (status === "captured") return "promoted";
  if (status === "duplicate") return "partial";
  if (publicChannelMatchState === "matched") return "partial";
  return "searching";
}

function collectedItemProof(item: { url: string; title?: string; contentHash: string; rawText: string; links: string[] }): ClearWebCollectedItemProof {
  return {
    url: item.url,
    title: item.title,
    contentHash: item.contentHash,
    rawTextLength: item.rawText.length,
    linkCount: item.links.length
  };
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function metadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function captureTaskFor(
  source: SourceRecord,
  handoff: SearchResultHandoff,
  discovery: DiscoveryEvidence,
  maxBytes: number
): CollectionTask {
  return {
    id: stableId("task", `${discovery.id}:${handoff.url}`),
    tenantId: handoff.tenantId,
    sourceId: source.id,
    targetUrl: handoff.url,
    sourceType: "static_web",
    queuedAt: handoff.observedAt,
    priority: Math.max(0.1, 1 - handoff.rank / 20),
    reason: `promote search result for ${handoff.query}`,
    parentUrl: discovery.url,
    retryCount: 0,
    intelRequestId: handoff.runId,
    runId: handoff.runId,
    maxBytes,
    maxRetries: 2,
    sourceConcurrencyKey: source.id,
    fairnessKey: `${handoff.tenantId ?? "global"}:${normalizeQuery(handoff.query)}:clear_web_capture`,
    planning: {
      budgetClass: "interactive_live_search",
      decision: "selected",
      reason: "search snippet requires canonical captured-page evidence",
      queryTerms: [handoff.query],
      freshness: 1,
      freshnessTargetSeconds: source.crawlFrequencySeconds,
      maxCost: {
        tasks: 1,
        bytes: maxBytes
      },
      safetyEnvelope: {
        allowClearWeb: true,
        allowPublicChannel: false,
        allowRestrictedMetadata: false,
        metadataOnlyRestricted: false,
        forbiddenOperations: ["credential_bypass", "captcha_solving", "private_community_access"]
      },
      sourceTrust: source.trustScore,
      selectedFor: "interactive"
    }
  };
}

function parserProfileFor(url: string, metadata: Record<string, unknown>): string {
  const value = String(metadata.parserProfile ?? "");
  if (value) return value;
  const hostname = safeHostname(url);
  if (hostname.includes("wikipedia.org")) return "public_encyclopedia";
  if (hostname.includes("github.com")) return "github_advisory";
  if (hostname.includes("cisa.gov") || hostname.includes("cert.") || hostname.endsWith(".gov")) return "government_advisory";
  if (/blog|research|threat|security|report/i.test(url)) return "vendor_report";
  return "generic_static_web";
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
