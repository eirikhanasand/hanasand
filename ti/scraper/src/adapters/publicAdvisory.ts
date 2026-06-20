import type { AdapterRunResult, CollectionTask, CollectedItem, SourceRecord } from "../types.ts";
import { hashContent, normalizeWhitespace, nowIso, uniqueStrings } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import {
  canonicalizeUrl,
  createConditionalHeaders,
  rememberValidators,
  type AdapterHttpCache
} from "./staticWeb.ts";
import { parseRssItems } from "./rss.ts";
import { productionEvidenceReplayRef } from "./productionAdapterRuntime.ts";
import type { PublicAdvisorySignalRecord, PublicSignalMatchedEntities } from "./publicSignalFusion.ts";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type PublicAdvisorySourceFamily =
  | "github_advisory"
  | "cert_government"
  | "vendor_report"
  | "malware_report_feed"
  | "public_report_index";

export type PublicAdvisoryRecordState =
  | "active"
  | "edited"
  | "stale"
  | "duplicate_suppressed"
  | "unavailable"
  | "policy_disabled";

export interface PublicAdvisoryAdapterOptions {
  fetcher?: Fetcher;
  cache?: AdapterHttpCache;
}

export interface PublicAdvisoryRecord {
  id: string;
  sourceId: string;
  family: PublicAdvisorySourceFamily;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  observedAt?: string;
  updatedAt?: string;
  language?: string;
  state: PublicAdvisoryRecordState;
  confidence: number;
  reliabilityScore: number;
  tags: string[];
  matchedEntities: {
    actors: string[];
    cves: string[];
    malware: string[];
    tools: string[];
    campaigns: string[];
    sectors: string[];
    countries: string[];
    victims: string[];
  };
  extractionWarnings: string[];
}

export interface PublicAdvisorySafeDelta {
  schemaVersion: "ti.public_advisory_signal_delta.v1";
  id: string;
  sourceId: string;
  family: PublicAdvisorySourceFamily;
  state: PublicAdvisoryRecordState;
  title: string;
  canonicalUrlHash: string;
  contentHash: string;
  publishedAt?: string;
  observedAt: string;
  parserConfidence: number;
  reliabilityScore: number;
  tags: string[];
  matchedEntities: PublicAdvisoryRecord["matchedEntities"];
  dedupeKey: string;
  evidenceReplayRef: string;
  provenance: {
    sourceId: string;
    connectorFamily: PublicAdvisorySourceFamily;
    collectedAt: string;
    extractorVersion: "public-advisory-adapter-v1";
    publicOnly: true;
    officialOrPublicHttp: true;
  };
  forbiddenFields: string[];
}

export interface PublicAdvisorySearchHit {
  item: CollectedItem;
  score: number;
  matchedFields: string[];
}

export interface PublicAdvisorySignalBridgeOptions {
  sourceById?: Map<string, SourceRecord> | Record<string, SourceRecord>;
  includeNonAdvisoryItems?: boolean;
}

export class PublicAdvisoryAdapter implements CollectionAdapter {
  readonly type = "api" as const;
  private readonly fetcher: Fetcher;
  private readonly cache: AdapterHttpCache;

  constructor(options: PublicAdvisoryAdapterOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.cache = options.cache ?? new Map();
  }

  async collect(source: SourceRecord, task?: CollectionTask): Promise<AdapterRunResult> {
    const policy = task
      ? evaluateTaskForCollection(source, task)
      : { allowed: true, metadataOnly: false, reason: "manual run" };
    const targetUrl = task?.targetUrl ?? source.url;
    const collectedAt = nowIso();

    if (!policy.allowed) {
      return emptyAdvisoryResult(targetUrl, [policy.reason], "policy_blocked", collectedAt);
    }

    const sourceGuard = unsafePublicAdvisoryUrlReason(targetUrl);
    if (sourceGuard) {
      return emptyAdvisoryResult(targetUrl, [`public advisory target blocked: ${sourceGuard}`], "policy_blocked", collectedAt, {
        unsafeTargetHash: unsafeUrlHash(targetUrl)
      });
    }

    if (source.accessMethod !== "official_api" && source.accessMethod !== "public_http") {
      return emptyAdvisoryResult(targetUrl, ["public advisory collection requires official_api or public_http access"], "policy_blocked", collectedAt);
    }

    const headers = createConditionalHeaders(targetUrl, this.cache);
    const response = await this.fetcher(targetUrl, { headers });
    if (response.status === 304) {
      return emptyAdvisoryResult(targetUrl, [`Public advisory feed not modified for ${targetUrl}`], "not_modified", collectedAt, {
        responseStatus: response.status,
        statusClass: statusClass(response.status)
      });
    }
    if (!response.ok) {
      return emptyAdvisoryResult(targetUrl, [`Public advisory fetch returned ${response.status} for ${targetUrl}`], httpFailureCategory(response.status), collectedAt, {
        responseStatus: response.status,
        statusClass: statusClass(response.status),
        retryAfterSeconds: retryAfterSeconds(response)
      });
    }

    const finalUrl = canonicalizeUrl(response.url || targetUrl);
    rememberValidators(finalUrl, response, this.cache);
    const body = await response.text();
    const family = inferAdvisoryFamily(source, finalUrl);
    const parsed = parsePublicAdvisoryRecords({
      body,
      contentType: response.headers.get("content-type") ?? undefined,
      source,
      family,
      feedUrl: finalUrl,
      collectedAt
    });

    const items: CollectedItem[] = [];
    const suppressed: Array<{ id: string; reason: string; unsafeUrlHash?: string; title: string; family: PublicAdvisorySourceFamily }> = [];
    const seen = new Set<string>();
    for (const record of parsed.records) {
      const unsafeReason = unsafePublicAdvisoryUrlReason(record.url);
      if (unsafeReason) {
        suppressed.push({
          id: record.id,
          reason: unsafeReason,
          unsafeUrlHash: unsafeUrlHash(record.url),
          title: record.title,
          family: record.family
        });
        continue;
      }

      const item = publicAdvisoryRecordToCollectedItem({ record, source, task, collectedAt });
      const dedupeKey = String(item.metadata.dedupeKey);
      if (seen.has(dedupeKey)) {
        suppressed.push({
          id: record.id,
          reason: "duplicate_advisory_record",
          title: record.title,
          family: record.family
        });
        continue;
      }
      seen.add(dedupeKey);
      items.push(item);
    }

    const warnings = [
      ...parsed.warnings,
      ...(suppressed.length ? [`suppressed ${suppressed.length} advisory records before capture`] : [])
    ];

    return {
      items,
      discovered: [],
      warnings,
      metadata: {
        adapter: "public_advisory",
        requestedUrl: targetUrl,
        finalUrl,
        responseStatus: response.status,
        statusClass: statusClass(response.status),
        contentType: response.headers.get("content-type") ?? undefined,
        family,
        parsedRecords: parsed.records.length,
        capturedRecords: items.length,
        suppressedRecords: suppressed,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
        guardrails: advisoryGuardrails()
      }
    };
  }
}

export function parsePublicAdvisoryRecords(input: {
  body: string;
  contentType?: string;
  source: SourceRecord;
  family?: PublicAdvisorySourceFamily;
  feedUrl: string;
  collectedAt: string;
}): { records: PublicAdvisoryRecord[]; warnings: string[] } {
  const contentType = input.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (contentType.includes("json") || looksLikeJson(input.body)) {
    return parseJsonAdvisories(input);
  }

  const entries = parseRssItems(input.body, input.feedUrl);
  return {
    records: entries.map((entry, index) => normalizeAdvisoryRecord({
      source: input.source,
      family: input.family ?? inferAdvisoryFamily(input.source, input.feedUrl),
      idSeed: `${input.source.id}:rss:${index}:${entry.link || entry.title}`,
      title: entry.title,
      url: entry.link || input.feedUrl || input.source.url,
      summary: entry.description,
      publishedAt: normalizeIsoDate(entry.publishedAt ?? ""),
      observedAt: input.collectedAt,
      language: input.source.language,
      state: "active",
      confidence: 0.74,
      reliabilityScore: input.source.trustScore
    })),
    warnings: []
  };
}

export function publicAdvisoryRecordToCollectedItem(input: {
  record: PublicAdvisoryRecord;
  source: SourceRecord;
  task?: CollectionTask;
  collectedAt: string;
}): CollectedItem {
  const canonicalUrl = canonicalizeUrl(input.record.url);
  const rawText = normalizeWhitespace([
    input.record.title,
    input.record.summary,
    ...input.record.tags,
    ...Object.values(input.record.matchedEntities).flat()
  ].join(" "));
  const contentHash = hashContent(rawText || canonicalUrl);
  const canonicalUrlHash = publicAdvisoryUrlHash(canonicalUrl);
  const evidenceReplayRef = productionEvidenceReplayRef({
    sourceId: input.source.id,
    canonicalUrlHash,
    contentHash,
    fetchedAt: input.collectedAt
  });
  const safeDelta = publicAdvisorySafeDelta({
    record: input.record,
    canonicalUrlHash,
    contentHash,
    collectedAt: input.collectedAt,
    evidenceReplayRef
  });

  return {
    sourceId: input.source.id,
    taskId: input.task?.id,
    url: canonicalUrl,
    collectedAt: input.collectedAt,
    publishedAt: input.record.publishedAt,
    title: input.record.title,
    rawText,
    contentHash,
    language: input.record.language ?? input.source.language,
    links: [canonicalUrl],
    metadata: {
      adapter: "public_advisory",
      sourceType: input.source.type,
      connectorFamily: input.record.family,
      state: input.record.state,
      canonicalUrlHash,
      parserProfile: "advisory_signal",
      parserConfidence: input.record.confidence,
      reliabilityScore: input.record.reliabilityScore,
      extractionWarnings: input.record.extractionWarnings,
      matchedEntities: input.record.matchedEntities,
      tags: input.record.tags,
      dedupeKey: safeDelta.dedupeKey,
      evidenceReplayRef,
      publicSignalDelta: safeDelta,
      guardrails: advisoryGuardrails(),
      provenance: {
        sourceId: input.source.id,
        taskId: input.task?.id,
        collectedAt: input.collectedAt,
        connectorFamily: input.record.family,
        extractorVersion: "public-advisory-adapter-v1",
        contentHash,
        confidence: input.record.confidence,
        publicOnly: true
      }
    },
    sensitive: false
  };
}

export function publicAdvisorySafeDelta(input: {
  record: PublicAdvisoryRecord;
  canonicalUrlHash: string;
  contentHash: string;
  collectedAt: string;
  evidenceReplayRef: string;
}): PublicAdvisorySafeDelta {
  return {
    schemaVersion: "ti.public_advisory_signal_delta.v1",
    id: `public_advisory_delta_${hashContent(`${input.record.id}:${input.canonicalUrlHash}:${input.contentHash}`).slice(0, 16)}`,
    sourceId: input.record.sourceId,
    family: input.record.family,
    state: input.record.state,
    title: input.record.title,
    canonicalUrlHash: input.canonicalUrlHash,
    contentHash: input.contentHash,
    publishedAt: input.record.publishedAt,
    observedAt: input.record.observedAt ?? input.collectedAt,
    parserConfidence: input.record.confidence,
    reliabilityScore: input.record.reliabilityScore,
    tags: input.record.tags,
    matchedEntities: input.record.matchedEntities,
    dedupeKey: advisoryDedupeKey(input.record, input.canonicalUrlHash),
    evidenceReplayRef: input.evidenceReplayRef,
    provenance: {
      sourceId: input.record.sourceId,
      connectorFamily: input.record.family,
      collectedAt: input.collectedAt,
      extractorVersion: "public-advisory-adapter-v1",
      publicOnly: true,
      officialOrPublicHttp: true
    },
    forbiddenFields: advisoryForbiddenFields()
  };
}

export function searchPublicAdvisoryItems(items: CollectedItem[], query: string, limit = 10): PublicAdvisorySearchHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  return items
    .map((item) => scorePublicAdvisoryItem(item, terms))
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score || (right.item.publishedAt ?? "").localeCompare(left.item.publishedAt ?? ""))
    .slice(0, limit);
}

export function publicAdvisoryItemsToSignalRecords(
  items: CollectedItem[],
  options: PublicAdvisorySignalBridgeOptions = {}
): PublicAdvisorySignalRecord[] {
  return items.flatMap((item) => {
    const metadata = item.metadata;
    const safeDelta = isRecord(metadata.publicSignalDelta) ? metadata.publicSignalDelta : undefined;
    const isAdvisory = metadata.adapter === "public_advisory" || safeDelta?.schemaVersion === "ti.public_advisory_signal_delta.v1";
    if (!isAdvisory && !options.includeNonAdvisoryItems) return [];

    const source = advisoryBridgeSource(options.sourceById, item.sourceId);
    const connectorFamily = stringValue(metadata.connectorFamily) || stringValue(safeDelta?.family);
    const family = bridgePublicAdvisoryFamily(connectorFamily);
    const matchedEntities = normalizeBridgeEntities(
      isRecord(metadata.matchedEntities) ? metadata.matchedEntities : isRecord(safeDelta?.matchedEntities) ? safeDelta.matchedEntities : undefined
    );
    const unsafeReason = unsafePublicAdvisoryUrlReason(item.url);
    const guardrails = isRecord(metadata.guardrails) ? metadata.guardrails : {};
    const extractionWarnings = arrayStrings(metadata.extractionWarnings);
    const policyDisabled = String(metadata.state) === "policy_disabled";
    const state = bridgePublicAdvisoryState(stringValue(metadata.state) || stringValue(safeDelta?.state), extractionWarnings);

    return [{
      id: `advisory_signal_${hashContent(`${item.sourceId}:${item.contentHash}:${item.url}`).slice(0, 16)}`,
      sourceId: item.sourceId,
      family,
      title: item.title ?? "Public advisory signal",
      url: item.url,
      canonicalUrl: item.url,
      summary: safeBridgeSummary(item.rawText, item.title),
      publishedAt: item.publishedAt,
      observedAt: stringValue(safeDelta?.observedAt) || item.collectedAt,
      updatedAt: stringValue(metadata.updatedAt),
      language: item.language,
      region: arrayStrings(source?.metadata?.regions)[0] ?? arrayStrings(source?.catalog?.coverage.regions)[0],
      tags: uniqueStrings([
        ...arrayStrings(metadata.tags),
        ...arrayStrings(safeDelta?.tags),
        ...extractionWarnings.map((warning) => `parser:${warning}`)
      ]).slice(0, 24),
      matchedEntities,
      confidence: numberValue(metadata.parserConfidence) ?? numberValue(safeDelta?.parserConfidence) ?? 0.6,
      reliabilityScore: numberValue(metadata.reliabilityScore) ?? numberValue(safeDelta?.reliabilityScore) ?? source?.trustScore,
      sourceTrust: source?.trustScore,
      state,
      access: source?.accessMethod === "official_api" ? "official_api" : source?.accessMethod === "manual_seed" ? "manual_seed" : "public_http",
      policy: {
        publicOnly: !unsafeReason && guardrails.publicOnly !== false && !policyDisabled,
        authRequired: /auth|login|credential|private/i.test(`${item.url} ${source?.legalNotes ?? ""}`),
        privateRepo: unsafeReason === "private_repo_advisory_path",
        captchaRequired: /captcha/i.test(`${source?.legalNotes ?? ""}`),
        exploitPayloadDownload: unsafeReason === "payload_or_download_affordance",
        leakedDataRedistribution: /leaked data|stolen data|dump/i.test(`${item.rawText} ${source?.legalNotes ?? ""}`),
        termsBypass: /terms bypass|bypass required/i.test(`${source?.legalNotes ?? ""}`)
      },
      provenance: {
        connector: bridgeAdvisoryConnectorForFamily(family),
        collectedAt: item.collectedAt,
        parserVersion: "public-advisory-item-bridge-v1"
      }
    }];
  });
}

export function inferAdvisoryFamily(source: SourceRecord, url = source.url): PublicAdvisorySourceFamily {
  const hint = String(source.metadata?.sourceFamily ?? source.metadata?.connectorFamily ?? source.tags?.join(" ") ?? source.name ?? "");
  const value = `${hint} ${url}`.toLowerCase();
  if (/github|ghsa|osv/.test(value)) return "github_advisory";
  if (/cisa|kev|cert|csirt|ncsc|\.gov|government/.test(value)) return "cert_government";
  if (/malware|threatfox|ioc|tool/.test(value)) return "malware_report_feed";
  if (/index|catalog|report-list|reports/.test(value)) return "public_report_index";
  return "vendor_report";
}

export function publicAdvisoryUrlHash(url: string): string {
  return `urlhash:${hashContent(canonicalizeUrl(url)).slice(0, 16)}`;
}

function parseJsonAdvisories(input: {
  body: string;
  source: SourceRecord;
  family?: PublicAdvisorySourceFamily;
  feedUrl: string;
  collectedAt: string;
}): { records: PublicAdvisoryRecord[]; warnings: string[] } {
  try {
    const json = JSON.parse(input.body) as unknown;
    const rows = extractJsonRows(json);
    return {
      records: rows.map((row, index) => recordFromJsonRow({
        row,
        index,
        source: input.source,
        family: input.family ?? inferAdvisoryFamily(input.source, input.feedUrl),
        feedUrl: input.feedUrl,
        collectedAt: input.collectedAt
      })),
      warnings: rows.length ? [] : ["public advisory JSON contained no records"]
    };
  } catch (error) {
    return {
      records: [],
      warnings: [`public advisory JSON parse failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

function recordFromJsonRow(input: {
  row: Record<string, unknown>;
  index: number;
  source: SourceRecord;
  family: PublicAdvisorySourceFamily;
  feedUrl: string;
  collectedAt: string;
}): PublicAdvisoryRecord {
  const cves = uniqueStrings([
    ...arrayStrings(input.row.cve_ids),
    ...arrayStrings(input.row.cves),
    ...arrayStrings(input.row.cve),
    stringValue(input.row.cve_id),
    stringValue(input.row.cveID),
    ...extractCves(JSON.stringify(input.row))
  ]).map((value) => value.toUpperCase());
  const ghsaId = stringValue(input.row.ghsa_id) || stringValue(input.row.ghsaId) || extractGhsa(JSON.stringify(input.row))[0] || "";
  const title = firstNonEmpty(
    stringValue(input.row.summary),
    stringValue(input.row.title),
    stringValue(input.row.vulnerabilityName),
    stringValue(input.row.name),
    ghsaId,
    cves[0],
    `Public advisory ${input.index + 1}`
  );
  const summary = firstNonEmpty(
    stringValue(input.row.description),
    stringValue(input.row.details),
    stringValue(input.row.notes),
    stringValue(input.row.shortDescription),
    stringValue(input.row.requiredAction)
  );
  const url = firstNonEmpty(
    stringValue(input.row.html_url),
    stringValue(input.row.url),
    stringValue(input.row.link),
    stringValue(input.row.references),
    input.feedUrl
  );
  const matchedFromText = matchedEntitiesFromText(`${title} ${summary} ${JSON.stringify(input.row)}`, input.source.tags ?? []);
  const packageNames = extractPackageNames(input.row);

  return normalizeAdvisoryRecord({
    source: input.source,
    family: input.family,
    idSeed: `${input.source.id}:json:${input.index}:${ghsaId}:${cves.join(",")}:${title}`,
    title,
    url,
    summary,
    publishedAt: normalizeIsoDate(firstNonEmpty(
      stringValue(input.row.published_at),
      stringValue(input.row.publishedAt),
      stringValue(input.row.dateAdded),
      stringValue(input.row.created_at)
    )),
    updatedAt: normalizeIsoDate(firstNonEmpty(
      stringValue(input.row.updated_at),
      stringValue(input.row.updatedAt),
      stringValue(input.row.lastModified),
      stringValue(input.row.dueDate)
    )),
    observedAt: input.collectedAt,
    language: input.source.language,
    state: normalizeState(stringValue(input.row.state)),
    confidence: confidenceFor(input.family, title, summary, cves),
    reliabilityScore: input.source.trustScore,
    tags: uniqueStrings([
      ...arrayStrings(input.row.tags),
      ...arrayStrings(input.row.keywords),
      ...arrayStrings(input.row.cwes),
      ...cves,
      ghsaId,
      ...packageNames,
      input.family
    ]),
    matchedEntities: {
      ...matchedFromText,
      cves: uniqueStrings([...matchedFromText.cves, ...cves]),
      tools: uniqueStrings([...matchedFromText.tools, ...packageNames])
    }
  });
}

function normalizeAdvisoryRecord(input: {
  source: SourceRecord;
  family: PublicAdvisorySourceFamily;
  idSeed: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  observedAt?: string;
  updatedAt?: string;
  language?: string;
  state?: PublicAdvisoryRecordState;
  confidence: number;
  reliabilityScore: number;
  tags?: string[];
  matchedEntities?: Partial<PublicAdvisoryRecord["matchedEntities"]>;
}): PublicAdvisoryRecord {
  const textEntities = matchedEntitiesFromText(`${input.title} ${input.summary ?? ""}`, input.source.tags ?? []);
  return {
    id: `advisory_record_${hashContent(input.idSeed).slice(0, 16)}`,
    sourceId: input.source.id,
    family: input.family,
    title: normalizeWhitespace(input.title),
    url: input.url,
    summary: input.summary ? normalizeWhitespace(input.summary) : undefined,
    publishedAt: input.publishedAt,
    observedAt: input.observedAt,
    updatedAt: input.updatedAt,
    language: input.language,
    state: input.state ?? "active",
    confidence: clamp(input.confidence),
    reliabilityScore: clamp(input.reliabilityScore),
    tags: uniqueStrings([...(input.tags ?? []), ...textEntities.cves, input.family]),
    matchedEntities: {
      actors: uniqueStrings([...(input.matchedEntities?.actors ?? []), ...textEntities.actors]),
      cves: uniqueStrings([...(input.matchedEntities?.cves ?? []), ...textEntities.cves]),
      malware: uniqueStrings([...(input.matchedEntities?.malware ?? []), ...textEntities.malware]),
      tools: uniqueStrings([...(input.matchedEntities?.tools ?? []), ...textEntities.tools]),
      campaigns: uniqueStrings([...(input.matchedEntities?.campaigns ?? []), ...textEntities.campaigns]),
      sectors: uniqueStrings([...(input.matchedEntities?.sectors ?? []), ...textEntities.sectors]),
      countries: uniqueStrings([...(input.matchedEntities?.countries ?? []), ...textEntities.countries]),
      victims: uniqueStrings([...(input.matchedEntities?.victims ?? []), ...textEntities.victims])
    },
    extractionWarnings: extractionWarningsFor(input)
  };
}

function scorePublicAdvisoryItem(item: CollectedItem, terms: string[]): PublicAdvisorySearchHit {
  const metadata = item.metadata;
  const matchedEntities = metadata.matchedEntities as PublicAdvisoryRecord["matchedEntities"] | undefined;
  const tags = arrayStrings(metadata.tags);
  const cves = arrayStrings(matchedEntities?.cves);
  const actors = arrayStrings(matchedEntities?.actors);
  const malware = arrayStrings(matchedEntities?.malware);
  const tools = arrayStrings(matchedEntities?.tools);
  const campaigns = arrayStrings(matchedEntities?.campaigns);
  const victims = arrayStrings(matchedEntities?.victims);
  const sectors = arrayStrings(matchedEntities?.sectors);
  const countries = arrayStrings(matchedEntities?.countries);
  const fields: Array<[string, string, number]> = [
    ["title", item.title ?? "", 0.38],
    ["rawText", item.rawText, 0.2],
    ["tags", tags.join(" "), 0.16],
    ["cves", cves.join(" "), 0.25],
    ["actors", actors.join(" "), 0.22],
    ["malware", [...malware, ...tools].join(" "), 0.18],
    ["campaigns", campaigns.join(" "), 0.16],
    ["victims", victims.join(" "), 0.14],
    ["sectors", sectors.join(" "), 0.1],
    ["countries", countries.join(" "), 0.1]
  ];
  let score = 0;
  const matchedFields: string[] = [];
  for (const [field, value, weight] of fields) {
    const normalized = value.toLowerCase();
    const hits = terms.filter((term) => normalized.includes(term));
    if (hits.length > 0) {
      score += weight * hits.length;
      matchedFields.push(field);
    }
  }

  const confidence = numberValue(metadata.parserConfidence) ?? 0.5;
  const reliability = numberValue(metadata.reliabilityScore) ?? 0.5;
  return {
    item,
    score: clamp(score * (0.65 + confidence * 0.2 + reliability * 0.15)),
    matchedFields: uniqueStrings(matchedFields)
  };
}

function emptyAdvisoryResult(
  requestedUrl: string,
  warnings: string[],
  failureCategory: string,
  collectedAt: string,
  metadata: Record<string, unknown> = {}
): AdapterRunResult {
  return {
    items: [],
    discovered: [],
    warnings,
    metadata: {
      adapter: "public_advisory",
      requestedUrl,
      failureCategory,
      collectedAt,
      guardrails: advisoryGuardrails(),
      ...metadata
    }
  };
}

function extractJsonRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter(isRecord);
  if (!isRecord(json)) return [];
  for (const key of ["advisories", "vulnerabilities", "items", "results", "data", "catalog", "knownExploitedVulnerabilities"]) {
    const value = json[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [json];
}

function matchedEntitiesFromText(text: string, sourceTags: string[]): PublicAdvisoryRecord["matchedEntities"] {
  const combined = `${text} ${sourceTags.join(" ")}`;
  const actors = knownMatches(combined, ["APT29", "APT42", "Volt Typhoon", "Sandworm", "Lazarus", "Turla", "Akira", "LockBit", "FIN7", "Scattered Spider"]);
  const malware = knownMatches(combined, ["Snake", "Cobalt Strike", "PlugX", "Emotet", "QakBot", "Nobelium", "Mimikatz"]);
  const sectors = knownMatches(combined, ["government", "energy", "healthcare", "finance", "telecom", "education", "critical infrastructure"]);
  const countries = knownMatches(combined, ["US", "United States", "Norway", "Ukraine", "UK", "United Kingdom", "Germany", "France", "China", "Russia"]);
  const victims = [...combined.matchAll(/\b([A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+){1,4}\s+(?:AS|ASA|Inc|LLC|Ltd|PLC|GmbH|Corp|Corporation|Company))\b/g)]
    .map((match) => match[1] ?? "");
  const campaigns = [...combined.matchAll(/\b([A-Z][A-Za-z0-9 -]{3,60}\s+campaign)\b/gi)].map((match) => normalizeWhitespace(match[1] ?? ""));

  return {
    actors,
    cves: extractCves(combined),
    malware,
    tools: malware,
    campaigns: uniqueStrings(campaigns),
    sectors,
    countries,
    victims: uniqueStrings(victims)
  };
}

function extractCves(value: string): string[] {
  return uniqueStrings([...value.matchAll(/\bCVE-\d{4}-\d{4,}\b/gi)].map((match) => match[0].toUpperCase()));
}

function extractGhsa(value: string): string[] {
  return uniqueStrings([...value.matchAll(/\bGHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}\b/gi)].map((match) => match[0]));
}

function extractPackageNames(row: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const key of ["package", "package_name", "product", "vendorProject", "ecosystem"]) {
    const value = row[key];
    if (typeof value === "string") values.push(value);
    if (isRecord(value)) values.push(...arrayStrings(value.name), stringValue(value.ecosystem));
  }
  const vulnerabilities = row.vulnerabilities;
  if (Array.isArray(vulnerabilities)) {
    for (const vulnerability of vulnerabilities.filter(isRecord)) {
      const pkg = vulnerability.package;
      if (isRecord(pkg)) values.push(stringValue(pkg.name), stringValue(pkg.ecosystem));
    }
  }
  return uniqueStrings(values.map(normalizeWhitespace));
}

function extractionWarningsFor(input: { title: string; summary?: string; publishedAt?: string; matchedEntities?: Partial<PublicAdvisoryRecord["matchedEntities"]> }): string[] {
  return [
    ...(!input.publishedAt ? ["missing_published_at"] : []),
    ...(normalizeWhitespace(`${input.title} ${input.summary ?? ""}`).length < 80 ? ["thin_advisory_text"] : []),
    ...((input.matchedEntities?.cves?.length ?? 0) === 0 && !/\bCVE-\d{4}-\d{4,}\b/i.test(`${input.title} ${input.summary ?? ""}`) ? ["no_cve_detected"] : [])
  ];
}

function confidenceFor(family: PublicAdvisorySourceFamily, title: string, summary: string, cves: string[]): number {
  const base = family === "github_advisory" || family === "cert_government" ? 0.82 : 0.74;
  const text = `${title} ${summary}`;
  return clamp(base + (cves.length ? 0.08 : 0) + (text.length > 240 ? 0.04 : 0));
}

function advisoryDedupeKey(record: PublicAdvisoryRecord, canonicalUrlHash: string): string {
  const entities = uniqueStrings([
    ...record.matchedEntities.cves,
    ...record.matchedEntities.actors,
    ...record.matchedEntities.malware,
    ...record.matchedEntities.tools,
    ...record.matchedEntities.campaigns,
    ...record.matchedEntities.victims
  ]).sort((left, right) => left.localeCompare(right));
  return `public_advisory:${record.family}:${canonicalUrlHash}:${entities.join("|") || hashContent(record.title).slice(0, 12)}`;
}

function unsafePublicAdvisoryUrlReason(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "malformed_url";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "non_http_scheme";
  const normalized = url.toString().toLowerCase();
  if (url.hostname.endsWith(".onion")) return "onion_link_forbidden";
  if (/[?&](?:token|secret|password|pass|session|auth|apikey|api_key|access_key)=/i.test(url.search)) return "secret_bearing_url";
  if (/\/(?:download|payload|exploit|poc|proof-of-concept)(?:\/|$|[?#])/i.test(url.pathname)) return "payload_or_download_affordance";
  if (/github\.com\/[^/]+\/[^/]+\/security\/advisories\/ghsa-/i.test(normalized)) return "private_repo_advisory_path";
  if (/\b(?:private|auth|login|signin|joinchat|invite)\b/i.test(normalized)) return "private_or_auth_gated_path";
  return undefined;
}

function unsafeUrlHash(value: string): string {
  return `unsafe_url_hash:${hashContent(value).slice(0, 16)}`;
}

function advisoryForbiddenFields(): string[] {
  return ["url", "canonicalUrl", "requestedUrl", "finalUrl", "rawText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "downloadUrl", "objectKey"];
}

function advisoryGuardrails() {
  return {
    publicOnly: true,
    officialApisOnlyForGithub: true,
    noPrivateRepoAccess: true,
    noAuthBypass: true,
    noCaptchaSolving: true,
    noAccountAutomation: true,
    noExploitPayloadDownload: true,
    noLeakedDataRedistribution: true,
    unsafeUrlsExposed: false
  };
}

function queryTerms(query: string): string[] {
  return uniqueStrings(query.toLowerCase().split(/[^a-z0-9.-]+/).filter((term) => term.length >= 2));
}

function normalizeState(value: string): PublicAdvisoryRecordState {
  const normalized = value.toLowerCase();
  if (normalized === "edited" || normalized === "updated") return "edited";
  if (normalized === "stale") return "stale";
  if (normalized === "duplicate" || normalized === "duplicate_suppressed") return "duplicate_suppressed";
  if (normalized === "unavailable" || normalized === "deleted") return "unavailable";
  if (normalized === "policy_disabled" || normalized === "disabled") return "policy_disabled";
  return "active";
}

function normalizeIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? new Date(date).toISOString() : undefined;
}

function knownMatches(text: string, values: string[]): string[] {
  return uniqueStrings(values.filter((value) => new RegExp(`\\b${escapeRegExp(value)}\\b`, "i").test(text)));
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return normalizeWhitespace(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function arrayStrings(value: unknown): string[] {
  if (typeof value === "string") return [normalizeWhitespace(value)].filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => typeof entry === "string" ? [normalizeWhitespace(entry)] : isRecord(entry) ? Object.values(entry).flatMap(arrayStrings) : []).filter(Boolean);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function firstNonEmpty(...values: string[]): string {
  return values.find((value) => value.trim().length > 0) ?? "";
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

function httpFailureCategory(status: number): string {
  if (status === 429) return "rate_limited";
  if (status === 404) return "not_found";
  return "http_error";
}

function retryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds)) return seconds;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function advisoryBridgeSource(sourceById: PublicAdvisorySignalBridgeOptions["sourceById"], sourceId: string): SourceRecord | undefined {
  if (!sourceById) return undefined;
  if (sourceById instanceof Map) return sourceById.get(sourceId);
  return sourceById[sourceId];
}

function bridgePublicAdvisoryFamily(value: string): PublicAdvisorySignalRecord["family"] {
  if (value === "github_advisory" || value === "cert_government" || value === "vendor_report" || value === "malware_report_feed") return value;
  if (value === "public_report_index") return "public_research_feed";
  return "vendor_report";
}

function bridgePublicAdvisoryState(value: string, extractionWarnings: string[]): NonNullable<PublicAdvisorySignalRecord["state"]> {
  const normalized = value.toLowerCase();
  if (normalized === "edited") return "edited";
  if (normalized === "unavailable") return "unavailable";
  if (normalized === "policy_disabled") return "policy_disabled";
  if (normalized === "stale" || extractionWarnings.includes("missing_published_at")) return "stale";
  return "active";
}

function bridgeAdvisoryConnectorForFamily(family: PublicAdvisorySignalRecord["family"]): NonNullable<PublicAdvisorySignalRecord["provenance"]>["connector"] {
  if (family === "github_advisory") return "github_security_advisory";
  if (family === "cert_government") return "cert_advisory";
  if (family === "malware_report_feed") return "malware_feed";
  if (family === "public_research_feed" || family === "clear_web") return "public_report_index";
  return "vendor_report";
}

function normalizeBridgeEntities(input: Record<string, unknown> | undefined): PublicSignalMatchedEntities {
  return {
    actors: uniqueStrings(arrayStrings(input?.actors)),
    malware: uniqueStrings(arrayStrings(input?.malware)),
    tools: uniqueStrings(arrayStrings(input?.tools)),
    cves: uniqueStrings(arrayStrings(input?.cves)).map((value) => /^cve-/i.test(value) ? value.toUpperCase() : value),
    campaigns: uniqueStrings(arrayStrings(input?.campaigns)),
    sectors: uniqueStrings(arrayStrings(input?.sectors)),
    countries: uniqueStrings(arrayStrings(input?.countries)),
    victims: uniqueStrings(arrayStrings(input?.victims))
  };
}

function safeBridgeSummary(rawText: string, title?: string): string | undefined {
  const normalized = normalizeWhitespace(rawText);
  const withoutTitle = title ? normalizeWhitespace(normalized.replace(title, "")) : normalized;
  if (!withoutTitle) return undefined;
  return withoutTitle.length <= 320 ? withoutTitle : `${withoutTitle.slice(0, 317)}...`;
}
