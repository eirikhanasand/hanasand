import type { SourceRecord } from "../types.ts";
import { hashContent, normalizeWhitespace, nowIso } from "../utils.ts";
import type { TelegramPublicEvidenceDto, TelegramPublicSourcePack } from "./telegramPublicTypes.ts";

export type PublicSignalSourceFamily =
  | "public_channel"
  | "github_advisory"
  | "cert_government"
  | "vendor_report"
  | "malware_report_feed"
  | "public_research_feed"
  | "public_social"
  | "clear_web";

export interface PublicSignalFusionInput {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  sourcePacks?: TelegramPublicSourcePack[];
  evidence?: TelegramPublicEvidenceDto[];
  previousUrls?: string[];
  tenantId?: string;
  generatedAt?: string;
  maxSelectedSources?: number;
}

export interface PublicSignalSourceSelectionDto {
  sourceId: string;
  name: string;
  url: string;
  family: PublicSignalSourceFamily;
  status: SourceRecord["status"];
  selected: boolean;
  score: number;
  reliability: number;
  freshness: number;
  queryFit: number;
  diversityBoost: number;
  decayReasons: string[];
  matchedTerms: string[];
  language?: string;
  regions: string[];
  rateLimit: {
    delayed: boolean;
    retryAfterSeconds?: number;
    backoffUntil?: string;
  };
  availability: {
    unavailable: boolean;
    takedownOrRetired: boolean;
    deletedOrUnavailablePublicMessages: number;
    editedPublicMessages: number;
  };
  hints: {
    githubAdvisory: boolean;
    certGovernment: boolean;
    vendorReport: boolean;
    malwareReportFeed: boolean;
    publicChannel: boolean;
    publicSocial: boolean;
    clearWebPromotion: boolean;
  };
  provenance: {
    sourceId: string;
    sourceType: SourceRecord["type"];
    accessMethod: SourceRecord["accessMethod"];
    legalNotes: string;
    approvedPublic: boolean;
    metadataOnly: boolean;
  };
}

export interface PublicSignalDeltaDto {
  id: string;
  sourceId: string;
  family: PublicSignalSourceFamily;
  url: string;
  contentHash: string;
  mergeTarget: "clear_web_capture_evidence" | "public_channel_partial_evidence";
  state: "new" | "edited" | "deleted_or_unavailable" | "duplicate_suppressed";
  confidence: number;
  evidenceUrl?: string;
  collectedAt?: string;
  publishedAt?: string;
  provenance: {
    sourceId: string;
    publicOnly: true;
    evidenceBacked: boolean;
    safeUrl: boolean;
  };
}

export interface PublicSignalFusionDto {
  generatedAt: string;
  query: string;
  queryTerms: string[];
  status: "ready" | "partial" | "needs_source_activation" | "blocked";
  selectedSources: PublicSignalSourceSelectionDto[];
  suppressed: {
    duplicateUrls: string[];
    duplicateContentHashes: string[];
    unsafeUrls: string[];
    unavailableSourceIds: string[];
  };
  familyCoverage: {
    familiesCovered: PublicSignalSourceFamily[];
    missingFamilies: PublicSignalSourceFamily[];
    diversityScore: number;
    minimumFamiliesForConfidence: number;
  };
  sourceHints: Record<PublicSignalSourceFamily, PublicSignalSourceSelectionDto[]>;
  publicSignalDeltas: PublicSignalDeltaDto[];
  analystWorkQueue: Array<{
    sourceId: string;
    action: "approve_source" | "review_backoff" | "review_unavailable" | "review_duplicate_pressure" | "add_source_family" | "confirm_public_only_claim";
    reason: string;
    priority: "low" | "medium" | "high";
  }>;
  caveats: string[];
  guardrails: {
    publicOnly: true;
    officialApisOrPublicHttpOnly: true;
    privateJoinsUsed: false;
    accountAutomationUsed: false;
    captchaOrAuthBypassUsed: false;
    inviteOnlyAccessUsed: false;
    rawMediaDownloaded: false;
    unsafeUrlsExposed: false;
    publicChannelOnlyClaimsAreCaveated: true;
    piiMinimized: true;
  };
}

const PUBLIC_SIGNAL_FAMILIES: PublicSignalSourceFamily[] = [
  "public_channel",
  "github_advisory",
  "cert_government",
  "vendor_report",
  "malware_report_feed",
  "public_research_feed",
  "public_social",
  "clear_web"
];

export function buildPublicSignalFusionWorkbench(input: PublicSignalFusionInput): PublicSignalFusionDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query, input.entityType);
  const previousUrls = new Set((input.previousUrls ?? []).map(normalizeSignalUrl).filter(Boolean));
  const seenUrls = new Set<string>();
  const duplicateUrls = new Set<string>();
  const unsafeUrls = new Set<string>();
  const duplicateContentHashes = new Set<string>();
  const seenContentHashes = new Set<string>();
  const evidenceBySource = groupEvidenceBySource(input.evidence ?? []);

  const candidates = input.sources
    .filter((source) => !input.tenantId || source.tenantId === undefined || source.tenantId === input.tenantId)
    .map((source) => scorePublicSignalSource({
      source,
      queryTerms,
      generatedAt,
      evidence: evidenceBySource.get(source.id) ?? [],
      previousUrls
    }))
    .filter((candidate) => {
      const normalizedUrl = normalizeSignalUrl(candidate.url);
      if (!isSafePublicSignalUrl(candidate.url)) {
        unsafeUrls.add(unsafeSignalUrlRef(candidate.url));
        return false;
      }
      if (normalizedUrl && (seenUrls.has(normalizedUrl) || previousUrls.has(normalizedUrl))) {
        duplicateUrls.add(candidate.url);
        return false;
      }
      if (normalizedUrl) seenUrls.add(normalizedUrl);
      return true;
    });

  const selectedSources = selectDiversePublicSignalSources(candidates, input.maxSelectedSources ?? 12);
  for (const item of selectedSources) {
    const hash = hashContent(`${item.family}:${normalizeSignalUrl(item.url)}:${item.matchedTerms.join("|")}`);
    if (seenContentHashes.has(hash)) duplicateContentHashes.add(hash);
    seenContentHashes.add(hash);
  }

  const selectedFamilies = [...new Set(selectedSources.map((source) => source.family))];
  const evidenceDeltas = buildPublicSignalDeltas({
    evidence: input.evidence ?? [],
    selectedFamiliesBySource: new Map(selectedSources.map((source) => [source.sourceId, source.family])),
    seenContentHashes,
    duplicateContentHashes
  });
  const packDeltas = buildPublicSignalPackDeltas(input.sourcePacks ?? [], queryTerms, generatedAt);
  const publicSignalDeltas = [...evidenceDeltas, ...packDeltas].filter((delta) => {
    const normalizedUrl = normalizeSignalUrl(delta.url);
    if (!normalizedUrl || !isSafePublicSignalUrl(delta.url)) {
      unsafeUrls.add(unsafeSignalUrlRef(delta.url));
      return false;
    }
    return true;
  });

  const sourceHints = Object.fromEntries(PUBLIC_SIGNAL_FAMILIES.map((family) => [
    family,
    selectedSources.filter((source) => source.family === family)
  ])) as Record<PublicSignalSourceFamily, PublicSignalSourceSelectionDto[]>;
  const missingFamilies = PUBLIC_SIGNAL_FAMILIES.filter((family) => !selectedFamilies.includes(family));
  const diversityScore = roundMetric(selectedFamilies.length / Math.min(PUBLIC_SIGNAL_FAMILIES.length, 5));
  const unavailableSourceIds = selectedSources
    .filter((source) => source.availability.unavailable || source.availability.takedownOrRetired)
    .map((source) => source.sourceId);
  const analystWorkQueue = buildPublicSignalAnalystWorkQueue(selectedSources, missingFamilies);
  const status: PublicSignalFusionDto["status"] = selectedSources.length === 0
    ? "needs_source_activation"
    : selectedSources.every((source) => source.provenance.approvedPublic === false)
      ? "blocked"
      : diversityScore >= 0.6 && publicSignalDeltas.some((delta) => delta.state !== "duplicate_suppressed")
        ? "ready"
        : "partial";

  return {
    generatedAt,
    query: input.query,
    queryTerms,
    status,
    selectedSources,
    suppressed: {
      duplicateUrls: [...duplicateUrls].sort(),
      duplicateContentHashes: [...duplicateContentHashes].sort(),
      unsafeUrls: [...unsafeUrls].sort(),
      unavailableSourceIds
    },
    familyCoverage: {
      familiesCovered: selectedFamilies,
      missingFamilies,
      diversityScore,
      minimumFamiliesForConfidence: 3
    },
    sourceHints,
    publicSignalDeltas,
    analystWorkQueue,
    caveats: buildPublicSignalCaveats(selectedSources, selectedFamilies, publicSignalDeltas),
    guardrails: {
      publicOnly: true,
      officialApisOrPublicHttpOnly: true,
      privateJoinsUsed: false,
      accountAutomationUsed: false,
      captchaOrAuthBypassUsed: false,
      inviteOnlyAccessUsed: false,
      rawMediaDownloaded: false,
      unsafeUrlsExposed: false,
      publicChannelOnlyClaimsAreCaveated: true,
      piiMinimized: true
    }
  };
}

function scorePublicSignalSource(input: {
  source: SourceRecord;
  queryTerms: string[];
  generatedAt: string;
  evidence: TelegramPublicEvidenceDto[];
  previousUrls: Set<string>;
}): PublicSignalSourceSelectionDto {
  const family = inferPublicSignalFamily(input.source);
  const searchable = sourceSearchableText(input.source);
  const matchedTerms = input.queryTerms.filter((term) => searchable.includes(term.toLowerCase()));
  const queryFit = input.queryTerms.length === 0 ? 0.5 : clamp01(matchedTerms.length / input.queryTerms.length);
  const freshness = publicSignalFreshness(input.source, input.generatedAt);
  const rateLimit = publicSignalRateLimitState(input.source, input.generatedAt);
  const editedPublicMessages = input.evidence.filter((item) => item.editedAt).length;
  const deletedOrUnavailablePublicMessages = input.evidence.filter((item) => item.messageState === "deleted" || item.messageState === "unavailable").length;
  const unavailable = ["disabled", "retired", "rejected", "quarantined"].includes(input.source.status) || input.source.health?.status === "disabled" || input.source.health?.status === "failing";
  const approvedPublic = isApprovedPublicSignalSource(input.source);
  const reliability = clamp01(
    (input.source.trustScore || input.source.catalog?.reliability || 0.5) * 0.35 +
    freshness * 0.2 +
    (input.source.health?.status === "healthy" ? 0.15 : input.source.health?.status === "degraded" ? 0.05 : 0.1) +
    (approvedPublic ? 0.15 : -0.1) +
    (rateLimit.delayed ? -0.12 : 0.05) +
    (unavailable ? -0.25 : 0) +
    (deletedOrUnavailablePublicMessages > 0 ? -0.08 : 0)
  );
  const diversityBoost = family === "public_channel" ? 0.04 : 0.1;
  const score = clamp01(queryFit * 0.34 + reliability * 0.42 + freshness * 0.14 + diversityBoost);

  return {
    sourceId: input.source.id,
    name: input.source.name,
    url: input.source.url,
    family,
    status: input.source.status,
    selected: false,
    score: roundMetric(score),
    reliability: roundMetric(reliability),
    freshness: roundMetric(freshness),
    queryFit: roundMetric(queryFit),
    diversityBoost: roundMetric(diversityBoost),
    decayReasons: [
      ...(freshness < 0.45 ? ["source has stale public-signal freshness"] : []),
      ...(rateLimit.delayed ? ["source is delayed by rate-limit/backoff"] : []),
      ...(unavailable ? ["source is unavailable, retired, quarantined, or failing"] : []),
      ...(deletedOrUnavailablePublicMessages > 0 ? ["public-channel messages include deleted or unavailable states"] : []),
      ...(editedPublicMessages > 0 ? ["public-channel messages include edited states"] : []),
      ...(!approvedPublic ? ["source requires public approval before strong claims"] : []),
      ...(input.previousUrls.has(normalizeSignalUrl(input.source.url)) ? ["source URL was already emitted for this query"] : [])
    ],
    matchedTerms,
    language: input.source.language ?? stringArray(input.source.catalog?.coverage.languages)[0] ?? stringArray(input.source.metadata?.languages)[0],
    regions: [...new Set([...stringArray(input.source.catalog?.coverage.regions), ...stringArray(input.source.metadata?.regions), ...stringArray(input.source.metadata?.countries)])],
    rateLimit,
    availability: {
      unavailable,
      takedownOrRetired: input.source.status === "retired" || Boolean(input.source.metadata?.takedownAt || input.source.metadata?.unavailableAt),
      deletedOrUnavailablePublicMessages,
      editedPublicMessages
    },
    hints: {
      githubAdvisory: family === "github_advisory",
      certGovernment: family === "cert_government",
      vendorReport: family === "vendor_report",
      malwareReportFeed: family === "malware_report_feed",
      publicChannel: family === "public_channel",
      publicSocial: family === "public_social",
      clearWebPromotion: family === "clear_web"
    },
    provenance: {
      sourceId: input.source.id,
      sourceType: input.source.type,
      accessMethod: input.source.accessMethod,
      legalNotes: input.source.legalNotes,
      approvedPublic,
      metadataOnly: input.source.governance?.metadataOnly === true || input.source.catalog?.retentionClass === "restricted_metadata"
    }
  };
}

function selectDiversePublicSignalSources(candidates: PublicSignalSourceSelectionDto[], limit: number): PublicSignalSourceSelectionDto[] {
  const selected: PublicSignalSourceSelectionDto[] = [];
  const byFamily = new Map<PublicSignalSourceFamily, PublicSignalSourceSelectionDto[]>();
  for (const candidate of candidates.filter((item) => item.score > 0.2).sort((left, right) => right.score - left.score)) {
    const family = byFamily.get(candidate.family) ?? [];
    family.push(candidate);
    byFamily.set(candidate.family, family);
  }
  for (const family of PUBLIC_SIGNAL_FAMILIES) {
    const first = byFamily.get(family)?.[0];
    if (first && selected.length < limit) selected.push(first);
  }
  for (const candidate of candidates.sort((left, right) => right.score - left.score)) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.sourceId === candidate.sourceId)) selected.push(candidate);
  }
  return selected.map((source) => ({ ...source, selected: true }));
}

function buildPublicSignalDeltas(input: {
  evidence: TelegramPublicEvidenceDto[];
  selectedFamiliesBySource: Map<string, PublicSignalSourceFamily>;
  seenContentHashes: Set<string>;
  duplicateContentHashes: Set<string>;
}): PublicSignalDeltaDto[] {
  return input.evidence.map((item) => {
    const contentHash = item.contentHash ?? hashContent(normalizeWhitespace(`${item.messageUrl} ${item.snippet}`));
    const duplicate = input.seenContentHashes.has(contentHash);
    input.seenContentHashes.add(contentHash);
    if (duplicate) input.duplicateContentHashes.add(contentHash);
    const state = duplicate
      ? "duplicate_suppressed"
      : item.messageState === "deleted" || item.messageState === "unavailable"
        ? "deleted_or_unavailable"
        : item.editedAt
          ? "edited"
          : "new";
    return {
      id: `public_signal_delta_${hashContent(`${item.sourceId}:${item.messageUrl}:${contentHash}`).slice(0, 16)}`,
      sourceId: item.sourceId,
      family: input.selectedFamiliesBySource.get(item.sourceId) ?? "public_channel",
      url: item.messageUrl,
      contentHash,
      mergeTarget: "public_channel_partial_evidence",
      state,
      confidence: roundMetric(item.confidence),
      evidenceUrl: item.messageUrl,
      collectedAt: item.messageTimestamp,
      publishedAt: item.messageTimestamp,
      provenance: {
        sourceId: item.sourceId,
        publicOnly: true,
        evidenceBacked: true,
        safeUrl: isSafePublicSignalUrl(item.messageUrl)
      }
    };
  });
}

function buildPublicSignalPackDeltas(
  sourcePacks: TelegramPublicSourcePack[],
  queryTerms: string[],
  generatedAt: string
): PublicSignalDeltaDto[] {
  const deltas: PublicSignalDeltaDto[] = [];
  for (const pack of sourcePacks) {
    for (const entry of pack.sources) {
      const searchable = [
        entry.name,
        entry.channelHandle,
        ...entry.topicTags,
        ...entry.focus.actors,
        ...entry.focus.ransomware,
        ...entry.focus.cves,
        ...entry.focus.victims,
        ...entry.focus.sectors,
        ...entry.focus.countries
      ].join(" ").toLowerCase();
      if (queryTerms.length > 0 && !queryTerms.some((term) => searchable.includes(term.toLowerCase()))) continue;
      const contentHash = hashContent(`${pack.id}:${entry.id}:${entry.publicUrl}:${queryTerms.join("|")}`);
      deltas.push({
        id: `public_signal_delta_${hashContent(`${entry.id}:${contentHash}`).slice(0, 16)}`,
        sourceId: entry.id,
        family: "public_channel",
        url: entry.publicUrl,
        contentHash,
        mergeTarget: "clear_web_capture_evidence",
        state: "new",
        confidence: roundMetric(entry.trustScore ?? 0.45),
        collectedAt: generatedAt,
        provenance: {
          sourceId: entry.id,
          publicOnly: true,
          evidenceBacked: false,
          safeUrl: isSafePublicSignalUrl(entry.publicUrl)
        }
      });
    }
  }
  return deltas.slice(0, 12);
}

function buildPublicSignalAnalystWorkQueue(
  selectedSources: PublicSignalSourceSelectionDto[],
  missingFamilies: PublicSignalSourceFamily[]
): PublicSignalFusionDto["analystWorkQueue"] {
  const queue: PublicSignalFusionDto["analystWorkQueue"] = [];
  for (const source of selectedSources) {
    if (!source.provenance.approvedPublic) {
      queue.push({ sourceId: source.sourceId, action: "approve_source", reason: "source is useful but not approved for public-signal claims", priority: "high" });
    }
    if (source.rateLimit.delayed) {
      queue.push({ sourceId: source.sourceId, action: "review_backoff", reason: "source is delayed by rate limit/backoff", priority: "medium" });
    }
    if (source.availability.unavailable || source.availability.takedownOrRetired) {
      queue.push({ sourceId: source.sourceId, action: "review_unavailable", reason: "source is unavailable or takedown/retired", priority: "high" });
    }
    if (source.availability.deletedOrUnavailablePublicMessages > 0 || source.availability.editedPublicMessages > 0) {
      queue.push({ sourceId: source.sourceId, action: "confirm_public_only_claim", reason: "edited/deleted public-channel evidence must remain caveated", priority: "medium" });
    }
  }
  for (const family of missingFamilies.slice(0, 3)) {
    queue.push({ sourceId: `family:${family}`, action: "add_source_family", reason: `no selected ${family} source for this query`, priority: "low" });
  }
  return queue;
}

function buildPublicSignalCaveats(
  selectedSources: PublicSignalSourceSelectionDto[],
  selectedFamilies: PublicSignalSourceFamily[],
  deltas: PublicSignalDeltaDto[]
): string[] {
  return [
    ...(selectedFamilies.length < 3 ? ["fewer than three public source families support this query"] : []),
    ...(selectedFamilies.length === 1 && selectedFamilies[0] === "public_channel" ? ["public-channel-only claims require external corroboration"] : []),
    ...(selectedSources.some((source) => !source.provenance.approvedPublic) ? ["one or more source hints require approval before strong claims"] : []),
    ...(selectedSources.some((source) => source.rateLimit.delayed) ? ["rate-limit/backoff may delay fresh public signals"] : []),
    ...(deltas.some((delta) => delta.state === "edited" || delta.state === "deleted_or_unavailable") ? ["edited or deleted public messages are partial evidence only"] : [])
  ];
}

function inferPublicSignalFamily(source: SourceRecord): PublicSignalSourceFamily {
  const text = sourceSearchableText(source);
  if (source.type === "telegram_public") return "public_channel";
  if (/github|ghsa|security-advisor|security advisory|osv|cve\.org|nvd/i.test(text)) return "github_advisory";
  if (/cert|cisa|ncsc|gov|government|us-cert|cyber\.gc\.ca|enisa|csirt/i.test(text)) return "cert_government";
  if (/malware|abuse\.ch|malpedia|bazaar|urlhaus|virustotal|hybrid-analysis|threatfox/i.test(text)) return "malware_report_feed";
  if (/vendor|microsoft|google|mandiant|crowdstrike|palo alto|unit 42|sentinelone|proofpoint|eset|kaspersky|recorded future|rapid7/i.test(text)) return "vendor_report";
  if (/mastodon|bluesky|twitter|x\.com|social|reddit/i.test(text)) return "public_social";
  if (/research|blog|report|whitepaper|analysis|labs/i.test(text)) return "public_research_feed";
  return "clear_web";
}

function sourceSearchableText(source: SourceRecord): string {
  return [
    source.id,
    source.name,
    source.type,
    source.url,
    source.language ?? "",
    source.legalNotes,
    ...(source.tags ?? []),
    ...stringArray(source.metadata?.topicTags),
    ...stringArray(source.metadata?.actors),
    ...stringArray(source.metadata?.aliases),
    ...stringArray(source.metadata?.ransomware),
    ...stringArray(source.metadata?.cves),
    ...stringArray(source.metadata?.victims),
    ...stringArray(source.metadata?.sectors),
    ...stringArray(source.metadata?.countries),
    ...stringArray(source.metadata?.sourceFamilies),
    ...stringArray(source.catalog?.coverage.topics),
    ...stringArray(source.catalog?.coverage.actors),
    ...stringArray(source.catalog?.coverage.aliases),
    ...stringArray(source.catalog?.coverage.industries),
    ...stringArray(source.catalog?.coverage.regions),
    ...stringArray(source.catalog?.coverage.countries),
    source.catalog?.publisher.name ?? "",
    source.catalog?.publisher.trustBasis ?? ""
  ].join(" ").toLowerCase();
}

function publicSignalFreshness(source: SourceRecord, generatedAt: string): number {
  const latest = source.lastSeenAt ?? source.crawlState?.lastCollectedAt ?? source.health?.lastSuccessAt ?? source.updatedAt;
  const ageMs = Date.parse(generatedAt) - Date.parse(latest);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.7;
  const ageSeconds = ageMs / 1000;
  const cadence = Math.max(300, source.crawlFrequencySeconds || source.catalog?.collection.crawlCadenceSeconds || 3600);
  if (ageSeconds <= cadence * 2) return 1;
  if (ageSeconds <= cadence * 8) return 0.72;
  if (ageSeconds <= cadence * 48) return 0.42;
  return 0.18;
}

function publicSignalRateLimitState(source: SourceRecord, generatedAt: string): PublicSignalSourceSelectionDto["rateLimit"] {
  const backoffUntil = source.crawlState?.backoffUntil ?? stringValue(source.metadata?.rateLimitResetAt) ?? stringValue(source.metadata?.backoffUntil);
  const retryAfterSeconds = backoffUntil ? Math.max(0, Math.ceil((Date.parse(backoffUntil) - Date.parse(generatedAt)) / 1000)) : undefined;
  return {
    delayed: retryAfterSeconds !== undefined && retryAfterSeconds > 0,
    retryAfterSeconds: retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : undefined,
    backoffUntil: retryAfterSeconds && retryAfterSeconds > 0 ? backoffUntil : undefined
  };
}

function isApprovedPublicSignalSource(source: SourceRecord): boolean {
  if (source.accessMethod !== "public_http" && source.accessMethod !== "official_api" && source.accessMethod !== "manual_seed") return false;
  if (["disabled", "rejected", "retired"].includes(source.status)) return false;
  if (source.governance?.approvalRequired && source.governance.approvalState !== "approved") return false;
  if (source.catalog?.approvalScope === "disabled" || source.catalog?.approvalScope === "restricted_protocol") return false;
  return !/private|invite[- ]only|account automation|captcha bypass|auth bypass/i.test(`${source.url} ${source.legalNotes}`);
}

function isSafePublicSignalUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  return !/(?:invite|joinchat|\+[\w-]{8,}|onion|i2p|freenet|credential|password|token=|apikey=)/i.test(url);
}

function unsafeSignalUrlRef(url: string): string {
  return `unsafe_url_hash:${hashContent(normalizeSignalUrl(url)).slice(0, 16)}`;
}

function normalizeSignalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, "").toLowerCase();
  }
}

function groupEvidenceBySource(evidence: TelegramPublicEvidenceDto[]): Map<string, TelegramPublicEvidenceDto[]> {
  const grouped = new Map<string, TelegramPublicEvidenceDto[]>();
  for (const item of evidence) {
    const bucket = grouped.get(item.sourceId) ?? [];
    bucket.push(item);
    grouped.set(item.sourceId, bucket);
  }
  return grouped;
}

function expandPublicSignalQueryTerms(query: string, entityType?: string): string[] {
  const normalized = query.trim();
  const terms = new Set<string>([normalized]);
  const aliasGroups = [
    [/apt29|cozy bear|nobelium|dukes/i, ["APT29", "Cozy Bear", "Nobelium", "The Dukes"]],
    [/apt42|charming kitten|mint sandstorm/i, ["APT42", "Charming Kitten", "Mint Sandstorm"]],
    [/turla|snake|venomous bear/i, ["Turla", "Snake", "Venomous Bear"]],
    [/volt typhoon|vanguard panda/i, ["Volt Typhoon", "Vanguard Panda"]],
    [/scattered spider|octo tempest|unc3944/i, ["Scattered Spider", "Octo Tempest", "UNC3944"]],
    [/\bakira\b/i, ["Akira", "Akira ransomware"]],
    [/fin7|carbanak/i, ["FIN7", "Carbanak"]],
    [/lazarus|hidden cobra/i, ["Lazarus", "Hidden Cobra"]],
    [/sandworm|voodoo bear/i, ["Sandworm", "Voodoo Bear"]]
  ] as const;
  for (const [pattern, aliases] of aliasGroups) {
    if (pattern.test(normalized)) for (const alias of aliases) terms.add(alias);
  }
  for (const cve of normalized.match(/\bCVE-\d{4}-\d{4,}\b/gi) ?? []) terms.add(cve.toUpperCase());
  if (entityType === "cve") terms.add(normalized.toUpperCase());
  if (entityType === "sector" || entityType === "country" || entityType === "malware") terms.add(normalized.toLowerCase());
  return [...terms].map((term) => normalizeWhitespace(term)).filter(Boolean);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function roundMetric(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
