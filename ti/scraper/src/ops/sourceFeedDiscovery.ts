// @ts-nocheck
import { publicAdvisoryFetcher } from "../api/exposureQueueRoutes.ts";
import { parseRssItems } from "../adapters/rssXml.ts";
import { sourceCollectionLane } from "../policy/collectionPolicy.ts";
import { privateTarget } from "../registry/sourceRegistry.ts";
import { validateSourcePortfolioBatch } from "../registry/sourcePortfolioBatch.ts";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";
import { importSeedBundle, seedDuplicateKey } from "../registry/sourceSeeds.ts";
import { prepareRuntimeSource } from "../runtime/sourceBootstrap.ts";
import { publicSourceReferenceUrl } from "../pipeline/sourceFieldReportTimestamp.ts";
import { nowIso, stableId } from "../utils.ts";
import { feedItems } from "./canaryFeedItems.ts";

const REQUEST_ID = "req_source_feed_discovery";
const DAY_SECONDS = 86_400;
const MAX_RESPONSE_BYTES = 512_000;

export async function runSourceFeedDiscoveryCycle(options: any, generatedAt = options.now?.() ?? nowIso()) {
  if (options.tenantId !== undefined || options.scheduleSourceFeedDiscovery === false) {
    return emptyResult(generatedAt, "disabled_for_tenant_scheduler_lane");
  }
  const store = options.store;
  if (!store?.listSources || !store?.listCaptures || !store?.listSourceHealthObservations || !store?.savePlan) {
    return emptyResult(generatedAt, "store_unavailable");
  }

  const selected = retainedPublisherReferences(store);
  const now = Date.parse(generatedAt);
  const due = selected.references
    .filter((reference: any) => {
      const plan = store.getPlan?.(planId(reference.publisherKey))
        ?? store.listPlans?.().find((row: any) => row.requestId === REQUEST_ID && row.publisherKey === reference.publisherKey);
      const next = Date.parse(String(plan?.nextEligibleAt ?? ""));
      return !plan || !Number.isFinite(next) || next <= now;
    })
    .slice(0, positiveInteger(options.sourceFeedDiscoveryMaxReferences, 8, 50));
  if (!due.length) {
    return {
      ...emptyResult(generatedAt, selected.references.length ? "not_due" : "no_useful_global_references"),
      consideredPublisherCount: selected.references.length,
      rejectedReferenceCount: selected.rejectedReferenceCount,
      deferredPublisherCount: selected.references.length
    };
  }

  const fetcher = publicAdvisoryFetcher(options.sourceFeedDiscoveryFetch ?? options.fetch, positiveInteger(options.sourceFeedDiscoveryTimeoutMs ?? options.timeoutMs, 8_000, 30_000));
  const concurrency = positiveInteger(options.sourceFeedDiscoveryMaxConcurrent, 2, 8);
  const results: any[] = [];
  for (let index = 0; index < due.length; index += concurrency) {
    results.push(...await Promise.all(due.slice(index, index + concurrency).map((reference: any) =>
      processReference({ store, fetcher, reference, generatedAt, maxFeeds: positiveInteger(options.sourceFeedDiscoveryMaxFeedsPerReference, 4, 8) }))));
  }
  return {
    generatedAt,
    status: "completed",
    reason: "due_references_processed",
    consideredPublisherCount: selected.references.length,
    processedPublisherCount: results.length,
    deferredPublisherCount: Math.max(0, selected.references.length - results.length),
    rejectedReferenceCount: selected.rejectedReferenceCount,
    importedSourceCount: sum(results, "importedSourceCount"),
    duplicateSourceCount: sum(results, "duplicateSourceCount"),
    revalidatedSourceCount: sum(results, "revalidatedSourceCount"),
    failedPublisherCount: results.filter((result) => result.outcome === "fetch_failed").length,
    noFeedPublisherCount: results.filter((result) => result.outcome === "no_feed").length,
    workflowPlanIds: results.map((result) => result.planId)
  };
}

async function processReference(input: any) {
  const previous = input.store.getPlan?.(planId(input.reference.publisherKey));
  const attemptCount = Number(previous?.attemptCount ?? 0) + 1;
  try {
    const response = await input.fetcher(input.reference.referenceUrl, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8" } });
    const pageUrl = safePublicReference(response.url || input.reference.referenceUrl);
    if (!response.ok) throw new Error(`Public feed discovery returned HTTP ${response.status}.`);
    const body = await boundedResponseText(response, MAX_RESPONSE_BYTES);
    const direct = feedProof(body, pageUrl, response.headers.get("content-type"), input.generatedAt);
    const advertised = direct ? [direct] : await advertisedFeedProofs(body, pageUrl, input.fetcher, input.generatedAt, input.maxFeeds);
    const admissions = advertised.map((proof: any) => admitFeed(input.store, input.reference, proof, input.generatedAt));
    const result = {
      outcome: advertised.length ? "feeds_proven" : "no_feed",
      importedSourceCount: admissions.filter((row: any) => row.outcome === "imported").length,
      duplicateSourceCount: admissions.filter((row: any) => row.outcome === "duplicate").length,
      revalidatedSourceCount: admissions.filter((row: any) => row.outcome === "revalidated").length,
      feedEndpointKeys: admissions.map((row: any) => row.feedEndpointKey),
      sourceIds: admissions.map((row: any) => row.sourceId).filter(Boolean)
    };
    const nextEligibleAt = addSeconds(input.generatedAt, advertised.length ? 7 * DAY_SECONDS : 30 * DAY_SECONDS);
    const saved = saveAttempt(input.store, input.reference, previous, input.generatedAt, attemptCount, 0, nextEligibleAt, result);
    return { planId: saved.id, ...result };
  } catch (error) {
    const consecutiveFailureCount = Number(previous?.consecutiveFailureCount ?? 0) + 1;
    const backoffSeconds = Math.min(7 * DAY_SECONDS, 3_600 * 2 ** Math.min(7, consecutiveFailureCount - 1));
    const result = { outcome: "fetch_failed", error: boundedError(error) };
    const saved = saveAttempt(input.store, input.reference, previous, input.generatedAt, attemptCount, consecutiveFailureCount, addSeconds(input.generatedAt, backoffSeconds), result);
    return { planId: saved.id, importedSourceCount: 0, duplicateSourceCount: 0, revalidatedSourceCount: 0, ...result };
  }
}

function retainedPublisherReferences(store: any) {
  const sources = new Map(store.listSources()
    .filter((source: any) => tenantAbsent(source.tenantId) && sourceCollectionLane(source) === "public")
    .map((source: any) => [source.id, source]));
  const usefulRuns = new Set(store.listSourceHealthObservations()
    .filter((row: any) => tenantAbsent(row.tenantId)
      && sources.has(row.sourceId)
      && row.success === true
      && row.useful === true
      && Number(row.captureCount ?? 0) > 0
      && String(row.collectionRunId ?? "").trim())
    .map((row: any) => `${row.sourceId}:${row.collectionRunId}`));
  const byPublisher = new Map<string, any>();
  let rejectedReferenceCount = 0;
  for (const capture of [...store.listCaptures()].sort((left: any, right: any) =>
    Date.parse(right.collectedAt ?? "") - Date.parse(left.collectedAt ?? ""))) {
    const runId = String(capture.metadata?.runId ?? "");
    if (!tenantAbsent(capture.tenantId) || capture.sensitive === true || !sources.has(capture.sourceId)
      || !usefulRuns.has(`${capture.sourceId}:${runId}`)) continue;
    const urls = [capture.url, ...(Array.isArray(capture.metadata?.reportTimestamps)
      ? capture.metadata.reportTimestamps.map((row: any) => row?.referenceUrl)
      : [])];
    for (const raw of urls) {
      const referenceUrl = safePublicReference(raw);
      if (!referenceUrl) { if (raw) rejectedReferenceCount++; continue; }
      const publisherKey = publisherOriginKey(referenceUrl);
      if (!byPublisher.has(publisherKey)) byPublisher.set(publisherKey, {
        publisherKey,
        referenceUrl,
        parentSourceId: capture.sourceId,
        captureId: capture.id,
        capturedAt: capture.collectedAt
      });
    }
  }
  return { references: [...byPublisher.values()].sort((left, right) => left.publisherKey.localeCompare(right.publisherKey)), rejectedReferenceCount };
}

async function advertisedFeedProofs(html: string, pageUrl: string, fetcher: typeof fetch, generatedAt: string, maxFeeds: number) {
  const proofs: any[] = [];
  for (const url of alternateFeedUrls(html, pageUrl).slice(0, maxFeeds)) {
    const response = await fetcher(url, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
    if (!response.ok) continue;
    const effectiveUrl = safePublicReference(response.url || url);
    const body = await boundedResponseText(response, MAX_RESPONSE_BYTES);
    const proof = feedProof(body, effectiveUrl, response.headers.get("content-type"), generatedAt);
    if (proof && !proofs.some((row) => row.feedEndpointKey === proof.feedEndpointKey)) proofs.push(proof);
  }
  return proofs;
}

function feedProof(body: string, feedUrl: string, mediaType: string | null, generatedAt: string) {
  const head = body.slice(0, 1_000);
  if (!/(?:rss|atom|rdf|\bxml\b)/i.test(mediaType ?? "") && !/<(?:rss|feed|rdf:RDF)\b/i.test(head)) return undefined;
  const parsed = parseRssItems(body, feedUrl).slice(0, 150);
  if (!parsed.length) return undefined;
  const probe = { id: "source-feed-discovery-probe", name: "Public intelligence feed", type: "rss", url: feedUrl };
  const productionRows = feedItems(probe, { id: "source-feed-discovery-probe", targetUrl: feedUrl }, body, generatedAt, {}, 150)
    .filter((row: any) => !row.metadata?.parserWarnings?.length && currentPublisherTimestamp(row.publishedAt, generatedAt));
  if (!productionRows.length) return undefined;
  return {
    url: feedUrl,
    feedEndpointKey: canonicalFeedKey(feedUrl),
    observedItemCount: productionRows.length,
    parserVersion: productionRows[0].metadata?.parserVersion ?? "rss-adapter-v2"
  };
}

function admitFeed(store: any, reference: any, proof: any, generatedAt: string) {
  const existing = store.listSources().find((source: any) => seedDuplicateKey(source) === proof.feedEndpointKey);
  const verification = {
    outcome: "content_parsed",
    verifiedAt: generatedAt,
    legalBasisVerifiedAt: generatedAt,
    observedItemCount: proof.observedItemCount,
    parserVersion: proof.parserVersion,
    publisherKey: reference.publisherKey,
    publicReferenceUrl: reference.referenceUrl,
    evidenceCaptureId: reference.captureId
  };
  if (existing) {
    if (tenantAbsent(existing.tenantId)
      && existing.status === "candidate"
      && existing.metadata?.sourceFeedDiscovery?.workflow === REQUEST_ID
      && existing.metadata.sourceFeedDiscovery.publisherKey === reference.publisherKey) {
      store.saveSource({
        ...existing,
        updatedAt: generatedAt,
        metadata: {
          ...existing.metadata,
          sourcePortfolioVerification: verification,
          sourceFeedDiscovery: {
            ...existing.metadata.sourceFeedDiscovery,
            parentSourceId: reference.parentSourceId,
            evidenceCaptureId: reference.captureId
          }
        }
      });
      return { outcome: "revalidated", sourceId: existing.id, feedEndpointKey: proof.feedEndpointKey };
    }
    return { outcome: "duplicate", sourceId: existing.id, feedEndpointKey: proof.feedEndpointKey };
  }

  const source = {
    id: stableId("src", proof.feedEndpointKey),
    name: `${new URL(proof.url).hostname} public intelligence feed`,
    type: "rss",
    url: proof.url,
    accessMethod: "public_http",
    status: "candidate",
    risk: "low",
    trustScore: 0.7,
    crawlFrequencySeconds: DAY_SECONDS,
    legalNotes: "Public RSS or Atom feed advertised by a retained useful public publisher reference and fetched without credentials.",
    catalog: {
      approvalScope: "safe_public_auto",
      adapterCompatibility: ["rss"],
      collection: { freshnessTargetSeconds: DAY_SECONDS }
    },
    governance: {
      approvalRequired: false,
      approvalState: "approved",
      metadataOnly: false,
      approvedAt: generatedAt,
      approvedBy: "scheduled-source-feed-discovery",
      policyVersion: "public-feed-discovery:v1"
    },
    metadata: {
      sourceFamily: "clear_web",
      queryClass: "threat-intel",
      activityWindowSeconds: 365 * DAY_SECONDS,
      sourcePortfolioVerification: verification,
      sourceFeedDiscovery: {
        workflow: REQUEST_ID,
        publisherKey: reference.publisherKey,
        parentSourceId: reference.parentSourceId,
        evidenceCaptureId: reference.captureId
      }
    }
  };
  const bundle = { schemaVersion: "ti.source_portfolio_batch.v1", family: "clear_web", generatedAt, sources: [source] };
  const validation = validateSourcePortfolioBatch(bundle, generatedAt);
  if (!validation.valid) throw new Error(validation.errors[0]?.message ?? "Discovered feed failed source portfolio validation.");
  const report = importSeedBundle(bundle, { importedAt: generatedAt, existingSources: store.listSources() });
  if (report.errors?.length || !report.accepted?.[0]) throw new Error(report.errors?.[0]?.message ?? "Discovered feed failed source import.");
  const saved = store.saveSource(prepareRuntimeSource(report.accepted[0], `workflow:${REQUEST_ID}`, generatedAt));
  return { outcome: "imported", sourceId: saved.id, feedEndpointKey: proof.feedEndpointKey };
}

function saveAttempt(store: any, reference: any, previous: any, generatedAt: string, attemptCount: number, consecutiveFailureCount: number, nextEligibleAt: string, result: any) {
  return store.savePlan({
    ...previous,
    id: planId(reference.publisherKey),
    tenantId: undefined,
    requestId: REQUEST_ID,
    publisherKey: reference.publisherKey,
    referenceUrl: reference.referenceUrl,
    parentSourceId: reference.parentSourceId,
    evidenceCaptureId: reference.captureId,
    request: {
      id: REQUEST_ID,
      publisherKey: reference.publisherKey,
      referenceUrl: reference.referenceUrl,
      parentSourceId: reference.parentSourceId,
      evidenceCaptureId: reference.captureId
    },
    tasks: [],
    status: result.outcome === "fetch_failed" ? "failed" : "completed",
    result,
    attemptCount,
    consecutiveFailureCount,
    nextEligibleAt,
    createdAt: previous?.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    audit: [{ at: generatedAt, outcome: result.outcome }]
  });
}

function alternateFeedUrls(html: string, pageUrl: string) {
  const urls: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, "rel");
    const type = attribute(tag, "type");
    const href = attribute(tag, "href");
    if (!/(?:^|\s)alternate(?:\s|$)/i.test(rel ?? "") || !/^application\/(?:rss|atom)\+xml$/i.test(type ?? "") || !href) continue;
    try {
      const safe = safePublicReference(new URL(decodeHtml(href), pageUrl).toString());
      if (safe && !urls.some((url) => canonicalFeedKey(url) === canonicalFeedKey(safe))) urls.push(safe);
    } catch {}
  }
  return urls;
}

async function boundedResponseText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error(`Public feed discovery exceeds maxBytes ${maxBytes}.`);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

function safePublicReference(value: unknown): string | undefined {
  const sanitized = publicSourceReferenceUrl(value);
  if (!sanitized) return undefined;
  try {
    const url = new URL(sanitized);
    if (url.protocol !== "https:" || privateTarget(url.hostname)) return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function publisherOriginKey(referenceUrl: string) {
  const url = new URL(referenceUrl);
  return canonicalFeedKey(`${url.origin}/`);
}

function currentPublisherTimestamp(value: unknown, generatedAt: string) {
  const timestamp = Date.parse(String(value ?? ""));
  const now = Date.parse(generatedAt);
  return Number.isFinite(timestamp) && timestamp <= now + 5 * 60_000 && now - timestamp <= 365 * DAY_SECONDS * 1_000;
}

function planId(publisherKey: string) { return stableId("source-feed-discovery-plan", publisherKey); }
function tenantAbsent(value: unknown) { return value === undefined || value === null || value === ""; }
function attribute(tag: string, name: string) { return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1]; }
function decodeHtml(value: string) { return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'"); }
function addSeconds(value: string, seconds: number) { return new Date(Date.parse(value) + seconds * 1_000).toISOString(); }
function boundedError(error: unknown) { return (error instanceof Error ? error.message : String(error)).slice(0, 500); }
function sum(rows: any[], key: string) { return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0); }
function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(maximum, Math.floor(number)) : fallback;
}
function emptyResult(generatedAt: string, reason: string) {
  return {
    generatedAt,
    status: "skipped",
    reason,
    consideredPublisherCount: 0,
    processedPublisherCount: 0,
    deferredPublisherCount: 0,
    rejectedReferenceCount: 0,
    importedSourceCount: 0,
    duplicateSourceCount: 0,
    revalidatedSourceCount: 0,
    failedPublisherCount: 0,
    noFeedPublisherCount: 0,
    workflowPlanIds: []
  };
}
