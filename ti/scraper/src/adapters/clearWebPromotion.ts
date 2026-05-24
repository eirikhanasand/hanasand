import { processCollectedItem } from "../pipeline/pipeline.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { CollectionTask, DiscoveryEvidence, SourceRecord } from "../types.ts";
import { hashContent, stableId } from "../utils.ts";
import { StaticWebAdapter, type StaticWebAdapterOptions } from "./staticWeb.ts";

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
  status: "captured" | "blocked" | "no_incident";
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

  if (!item) {
    return {
      query: handoff.query,
      normalizedQuery,
      sourceId: source.id,
      discoveryId: discovery.id,
      taskId: task.id,
      status: "blocked",
      warnings: collected.warnings
    };
  }

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
      parserProfile: parserProfileFor(item.url, item.metadata)
    }
  });
  const stored = store.savePipelineResult(pipeline);
  const incidentId = stored.incident?.id;
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    taskId: task.id,
    captureId: stored.capture.id,
    incidentId,
    promotedAt: item.collectedAt,
    promotedBy: "collector"
  });

  return {
    query: handoff.query,
    normalizedQuery,
    sourceId: source.id,
    discoveryId: discovery.id,
    taskId: task.id,
    captureId: stored.capture.id,
    incidentId,
    canonicalUrl: stored.capture.url,
    contentHash: stored.capture.contentHash,
    parserProfile: String(stored.capture.metadata.parserProfile ?? "generic_static_web"),
    status: incidentId ? "captured" : "no_incident",
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
      promotion: "canonical_capture_required"
    },
    retentionClass: "discovery_snippet"
  };
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
