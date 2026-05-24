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
  advisorySignals?: PublicAdvisorySignalRecord[];
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
  title?: string;
  url: string;
  canonicalUrl?: string;
  contentHash: string;
  mergeTarget: "clear_web_capture_evidence" | "public_channel_partial_evidence";
  state: "new" | "edited" | "deleted_or_unavailable" | "duplicate_suppressed";
  confidence: number;
  reliabilityScore?: number;
  language?: string;
  region?: string;
  tags?: string[];
  matchedEntities?: PublicSignalMatchedEntities;
  dedupeKey?: string;
  evidenceUrl?: string;
  collectedAt?: string;
  publishedAt?: string;
  observedAt?: string;
  provenance: {
    sourceId: string;
    publicOnly: true;
    evidenceBacked: boolean;
    safeUrl: boolean;
  };
}

export interface PublicSignalMatchedEntities {
  actors: string[];
  malware: string[];
  tools: string[];
  cves: string[];
  campaigns: string[];
  sectors: string[];
  countries: string[];
  victims: string[];
}

export interface PublicAdvisorySignalRecord {
  id: string;
  sourceId: string;
  family: Exclude<PublicSignalSourceFamily, "public_channel" | "public_social" | "clear_web"> | "clear_web";
  title: string;
  url: string;
  canonicalUrl?: string;
  summary?: string;
  publishedAt?: string;
  observedAt?: string;
  updatedAt?: string;
  language?: string;
  region?: string;
  tags?: string[];
  matchedEntities?: Partial<PublicSignalMatchedEntities>;
  confidence?: number;
  reliabilityScore?: number;
  state?: "active" | "edited" | "unavailable" | "policy_disabled" | "stale";
  sourceTrust?: number;
  access?: "public_http" | "official_api" | "manual_seed";
  policy?: {
    publicOnly: boolean;
    authRequired?: boolean;
    privateRepo?: boolean;
    captchaRequired?: boolean;
    exploitPayloadDownload?: boolean;
    leakedDataRedistribution?: boolean;
    termsBypass?: boolean;
  };
  provenance?: {
    connector: "github_security_advisory" | "cisa_kev" | "cert_advisory" | "vendor_report" | "malware_feed" | "public_report_index";
    collectedAt?: string;
    parserVersion?: string;
  };
}

export interface PublicAdvisorySignalConnectorInput {
  query: string;
  entityType?: string;
  sources: SourceRecord[];
  signals: PublicAdvisorySignalRecord[];
  generatedAt?: string;
  tenantId?: string;
  maxSignals?: number;
}

export interface PublicAdvisorySignalConnectorDto {
  generatedAt: string;
  query: string;
  queryTerms: string[];
  status: "ready" | "partial" | "needs_source_activation" | "blocked";
  rankedSignals: Array<PublicSignalDeltaDto & {
    rank: number;
    rankingScore: number;
    sourceFamily: PublicSignalSourceFamily;
    stale: boolean;
    policyAllowed: boolean;
    queryMatched: boolean;
    suppressionReason?: string;
  }>;
  suppressed: {
    duplicateDedupeKeys: string[];
    unsafeUrls: string[];
    unavailableSignalIds: string[];
    policyDisabledSignalIds: string[];
    staleSignalIds: string[];
  };
  sourceFamilySummary: Record<PublicSignalSourceFamily, {
    candidateCount: number;
    selectedCount: number;
    topScore: number;
  }>;
  fastInitialSummary: {
    queryClass: string;
    topTitles: string[];
    topFamilies: PublicSignalSourceFamily[];
    usefulSignalCount: number;
    canAnswerImmediately: boolean;
  };
  guardrails: {
    publicOnly: true;
    noAuthBypass: true;
    noPrivateRepoAccess: true;
    noCaptchaSolving: true;
    noTermsBypass: true;
    noExploitPayloadDownload: true;
    noLeakedDataRedistribution: true;
    unsafeUrlsExposed: false;
  };
}

export type AnalystPublicSourceDecisionReason =
  | "trusted"
  | "suppressed"
  | "merged"
  | "stale"
  | "duplicate"
  | "unavailable"
  | "edited_deleted"
  | "policy_disabled"
  | "parser_gap"
  | "legal_robots_hold"
  | "low_yield";

export type AnalystPublicSourceAction =
  | "approve_source"
  | "disable_source"
  | "lower_trust"
  | "raise_trust"
  | "raise_cadence"
  | "lower_cadence"
  | "mark_duplicate"
  | "request_parser_repair"
  | "request_legal_robots_review"
  | "promote_source_pack_candidate";

export interface AnalystPublicSourceWorkbenchInput {
  query: string;
  generatedAt?: string;
  sources: SourceRecord[];
  selectedSources?: PublicSignalSourceSelectionDto[];
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  suppressed?: PublicSignalFusionDto["suppressed"];
  missingFamilies?: PublicSignalSourceFamily[];
  tenantId?: string;
}

export interface AnalystPublicSourceDecisionDto {
  id: string;
  sourceId: string;
  sourceName: string;
  family: PublicSignalSourceFamily;
  decision: AnalystPublicSourceDecisionReason;
  reason: string;
  severity: "info" | "watch" | "review" | "hold";
  trustScore: number;
  reliability: number;
  freshness: number;
  evidenceYield: number;
  parserSupport: "ready" | "needs_repair" | "unknown";
  publicOnly: true;
  safeUrl: boolean;
  mergeTarget?: "clear_web_capture_evidence" | "public_channel_partial_evidence";
  dedupeKey?: string;
  relatedSignalIds: string[];
  handoff: {
    agent01Governance: "none" | "approval_review" | "legal_robots_review" | "source_pack_promotion";
    agent02Scheduler: "none" | "raise_cadence" | "lower_cadence" | "pause_or_disable";
    agent06EvidenceYield: "none" | "monitor_low_yield" | "merge_duplicate_evidence";
    agent07QualityGate: "none" | "review_stale_or_edited" | "hold_policy_disabled" | "parser_gap";
    agent09ApiField: "analystSourceWorkbench";
    agent10SloDashboard: "none" | "source_health_watch" | "release_hold";
  };
  provenance: {
    sourceId: string;
    publicOnly: true;
    unsafeUrlExposed: false;
    decisionAt: string;
  };
}

export interface AnalystPublicSourceWorkbenchDto {
  schemaVersion: "ti.public_source_workbench.v1";
  generatedAt: string;
  query: string;
  status: "ready" | "needs_review" | "hold";
  decisions: AnalystPublicSourceDecisionDto[];
  dryRunActions: Array<{
    id: string;
    sourceId: string;
    action: AnalystPublicSourceAction;
    reason: string;
    decisionIds: string[];
    execution: "dry_run_only" | "human_approval_required" | "blocked";
    willMutate: false;
    willStartCrawling: false;
    publicOnly: true;
    unsafeUrlExposed: false;
    handoff: AnalystPublicSourceDecisionDto["handoff"];
  }>;
  summary: {
    trusted: number;
    review: number;
    hold: number;
    stale: number;
    duplicate: number;
    parserGap: number;
    legalRobotsHold: number;
    lowYield: number;
  };
  handoffs: {
    agent01Governance: string[];
    agent02Scheduler: string[];
    agent06EvidenceYield: string[];
    agent07QualityGates: string[];
    agent09ApiFields: string[];
    agent10SloDashboard: string[];
  };
  guardrails: {
    publicOnly: true;
    noAuthBypass: true;
    noPrivateRepoAccess: true;
    noCaptchaSolving: true;
    noExploitPayloadDownload: true;
    noLeakedDataRedistribution: true;
    unsafeUrlsExposed: false;
    dryRunOnly: true;
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
  advisoryConnector?: PublicAdvisorySignalConnectorDto;
  analystSourceWorkbench: AnalystPublicSourceWorkbenchDto;
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
  const advisoryConnector = buildPublicAdvisorySignalConnector({
    query: input.query,
    entityType: input.entityType,
    sources: input.sources,
    signals: input.advisorySignals ?? publicAdvisorySignalsFromSources(input.sources, generatedAt),
    tenantId: input.tenantId,
    generatedAt
  });
  const advisoryDeltas = advisoryConnector.rankedSignals
    .filter((signal) => signal.state !== "duplicate_suppressed" && signal.policyAllowed)
    .map(({ rank: _rank, rankingScore: _rankingScore, sourceFamily: _sourceFamily, stale: _stale, policyAllowed: _policyAllowed, queryMatched: _queryMatched, suppressionReason: _suppressionReason, ...delta }) => delta);
  const publicSignalDeltas = [...evidenceDeltas, ...packDeltas, ...advisoryDeltas].filter((delta) => {
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
  const analystSourceWorkbench = buildAnalystPublicSourceWorkbench({
    query: input.query,
    sources: input.sources,
    selectedSources,
    advisoryConnector,
    suppressed: {
      duplicateUrls: [...duplicateUrls].sort(),
      duplicateContentHashes: [...duplicateContentHashes].sort(),
      unsafeUrls: [...unsafeUrls].sort(),
      unavailableSourceIds
    },
    missingFamilies,
    tenantId: input.tenantId,
    generatedAt
  });
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
    advisoryConnector,
    analystSourceWorkbench,
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

export function buildPublicAdvisorySignalConnector(input: PublicAdvisorySignalConnectorInput): PublicAdvisorySignalConnectorDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query, input.entityType);
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const seenDedupeKeys = new Set<string>();
  const duplicateDedupeKeys = new Set<string>();
  const unsafeUrls = new Set<string>();
  const unavailableSignalIds = new Set<string>();
  const policyDisabledSignalIds = new Set<string>();
  const staleSignalIds = new Set<string>();
  const rankedSignals = input.signals
    .filter((signal) => !input.tenantId || sourceById.get(signal.sourceId)?.tenantId === undefined || sourceById.get(signal.sourceId)?.tenantId === input.tenantId)
    .map((signal) => {
      const source = sourceById.get(signal.sourceId);
      const normalizedEntities = normalizeMatchedEntities(signal.matchedEntities);
      const canonicalUrl = signal.canonicalUrl ?? normalizeSignalUrl(signal.url);
      const dedupeKey = publicAdvisoryDedupeKey(signal, canonicalUrl, normalizedEntities);
      const duplicate = seenDedupeKeys.has(dedupeKey);
      seenDedupeKeys.add(dedupeKey);
      if (duplicate) duplicateDedupeKeys.add(dedupeKey);
      const safeUrl = isSafePublicSignalUrl(signal.url);
      if (!safeUrl) unsafeUrls.add(unsafeSignalUrlRef(signal.url));
      const policyAllowed = publicAdvisoryPolicyAllowed(signal, source);
      if (!policyAllowed) policyDisabledSignalIds.add(signal.id);
      const unavailable = signal.state === "unavailable" || source?.status === "disabled" || source?.status === "retired" || source?.status === "rejected";
      if (unavailable) unavailableSignalIds.add(signal.id);
      const stale = publicAdvisoryStale(signal, generatedAt);
      if (stale) staleSignalIds.add(signal.id);
      const outputUrl = safeUrl ? signal.url : unsafeSignalUrlRef(signal.url);
      const outputCanonicalUrl = safeUrl ? canonicalUrl : unsafeSignalUrlRef(canonicalUrl);
      const queryFit = publicAdvisoryQueryFit(signal, queryTerms, normalizedEntities);
      const familyWeight = signal.family === "cert_government" || signal.family === "github_advisory" ? 0.08 : signal.family === "vendor_report" ? 0.05 : 0.03;
      const reliabilityScore = clamp01(signal.reliabilityScore ?? signal.sourceTrust ?? source?.trustScore ?? source?.catalog?.reliability ?? 0.55);
      const freshness = publicAdvisoryFreshness(signal, generatedAt);
      const confidence = clamp01(signal.confidence ?? queryFit * 0.55 + reliabilityScore * 0.35 + familyWeight);
      const rankingScore = clamp01(
        queryFit * 0.38 +
        reliabilityScore * 0.25 +
        confidence * 0.18 +
        freshness * 0.12 +
        familyWeight -
        (duplicate ? 0.4 : 0) -
        (!safeUrl || !policyAllowed ? 0.55 : 0) -
        (unavailable ? 0.3 : 0) -
        (stale ? 0.12 : 0)
      );
      const state: PublicSignalDeltaDto["state"] = duplicate
        ? "duplicate_suppressed"
        : unavailable
          ? "deleted_or_unavailable"
          : signal.state === "edited"
            ? "edited"
            : "new";
      const suppressionReason = duplicate
        ? "duplicate canonical advisory/entity dedupe key"
        : !safeUrl
          ? "unsafe advisory URL suppressed"
          : !policyAllowed
            ? "signal violates public-only connector policy"
            : unavailable
              ? "signal source or advisory is unavailable"
              : undefined;
      return {
        id: `public_signal_delta_${hashContent(`${signal.id}:${dedupeKey}`).slice(0, 16)}`,
        sourceId: signal.sourceId,
        family: signal.family,
        title: signal.title,
        url: outputUrl,
        canonicalUrl: outputCanonicalUrl,
        contentHash: hashContent(normalizeWhitespace(`${signal.title} ${signal.summary ?? ""} ${canonicalUrl} ${JSON.stringify(normalizedEntities)}`)),
        mergeTarget: "clear_web_capture_evidence" as const,
        state,
        confidence: roundMetric(confidence),
        reliabilityScore: roundMetric(reliabilityScore),
        language: signal.language ?? source?.language,
        region: signal.region ?? stringArray(source?.metadata?.regions)[0] ?? stringArray(source?.catalog?.coverage.regions)[0],
        tags: [...new Set([...(signal.tags ?? []), ...(source?.tags ?? [])])].slice(0, 16),
        matchedEntities: normalizedEntities,
        dedupeKey,
        evidenceUrl: outputCanonicalUrl,
        collectedAt: signal.provenance?.collectedAt ?? generatedAt,
        publishedAt: signal.publishedAt,
        observedAt: signal.observedAt ?? signal.updatedAt ?? signal.publishedAt,
        provenance: {
          sourceId: signal.sourceId,
          publicOnly: true as const,
          evidenceBacked: true,
          safeUrl
        },
        rank: 0,
        rankingScore: roundMetric(rankingScore),
        sourceFamily: signal.family,
        stale,
        policyAllowed,
        queryMatched: queryFit > 0,
        suppressionReason
      };
    })
    .sort((left, right) => right.rankingScore - left.rankingScore)
    .map((signal, index): PublicAdvisorySignalConnectorDto["rankedSignals"][number] => ({ ...signal, rank: index + 1 }))
    .slice(0, input.maxSignals ?? 25);
  const usefulSignals = rankedSignals.filter((signal) =>
    signal.state !== "duplicate_suppressed" &&
    signal.policyAllowed &&
    signal.provenance.safeUrl &&
    !signal.suppressionReason &&
    publicSignalHasQueryMatch(signal) &&
    signal.rankingScore >= 0.35
  );
  const summary = publicAdvisoryFamilySummary(rankedSignals);
  const status: PublicAdvisorySignalConnectorDto["status"] = rankedSignals.length === 0
    ? "needs_source_activation"
    : usefulSignals.length === 0 && policyDisabledSignalIds.size > 0
      ? "blocked"
      : usefulSignals.length >= 2 || new Set(usefulSignals.map((signal) => signal.family)).size >= 2
        ? "ready"
        : "partial";
  return {
    generatedAt,
    query: input.query,
    queryTerms,
    status,
    rankedSignals,
    suppressed: {
      duplicateDedupeKeys: [...duplicateDedupeKeys].sort(),
      unsafeUrls: [...unsafeUrls].sort(),
      unavailableSignalIds: [...unavailableSignalIds].sort(),
      policyDisabledSignalIds: [...policyDisabledSignalIds].sort(),
      staleSignalIds: [...staleSignalIds].filter((id): id is string => typeof id === "string").sort()
    },
    sourceFamilySummary: summary,
    fastInitialSummary: {
      queryClass: input.entityType ?? inferPublicAdvisoryQueryClass(input.query),
      topTitles: usefulSignals.slice(0, 3).flatMap((signal) => signal.title ? [signal.title] : []),
      topFamilies: [...new Set(usefulSignals.map((signal) => signal.family))].slice(0, 4),
      usefulSignalCount: usefulSignals.length,
      canAnswerImmediately: usefulSignals.length > 0
    },
    guardrails: {
      publicOnly: true,
      noAuthBypass: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noTermsBypass: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false
    }
  };
}

export function buildAnalystPublicSourceWorkbench(input: AnalystPublicSourceWorkbenchInput): AnalystPublicSourceWorkbenchDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const queryTerms = expandPublicSignalQueryTerms(input.query);
  const selectedBySourceId = new Map((input.selectedSources ?? []).map((source) => [source.sourceId, source]));
  const advisoryBySourceId = groupAdvisorySignalsBySource(input.advisoryConnector?.rankedSignals ?? []);
  const tenantSources = input.sources.filter((source) => !input.tenantId || source.tenantId === undefined || source.tenantId === input.tenantId);
  const decisions: AnalystPublicSourceDecisionDto[] = [];

  for (const source of tenantSources) {
    const scored = selectedBySourceId.get(source.id) ?? scorePublicSignalSource({
      source,
      queryTerms,
      generatedAt,
      evidence: [],
      previousUrls: new Set<string>()
    });
    const advisorySignals = advisoryBySourceId.get(source.id) ?? [];
    const base = {
      source,
      scored,
      generatedAt,
      advisorySignals,
      duplicate: sourceIsDuplicate(source, input.suppressed, advisorySignals),
      parserGap: sourceHasParserGap(source),
      legalRobotsHold: sourceHasLegalRobotsHold(source, generatedAt),
      lowYield: sourceHasLowYield(source, scored, advisorySignals)
    };

    if (scored.provenance.approvedPublic && scored.reliability >= 0.6 && !scored.availability.unavailable) {
      decisions.push(publicSourceDecision(base, "trusted", "source is approved public, reliable, and eligible for advisory/public-signal use"));
    }
    if (advisorySignals.some((signal) => signal.suppressionReason || !signal.provenance.safeUrl)) {
      decisions.push(publicSourceDecision(base, "suppressed", "one or more advisory signals were suppressed before API exposure"));
    }
    if (advisorySignals.some((signal) => signal.mergeTarget === "clear_web_capture_evidence" && signal.state !== "duplicate_suppressed")) {
      decisions.push(publicSourceDecision(base, "merged", "source has mergeable public advisory signals for clear-web capture evidence"));
    }
    if (scored.freshness < 0.3 || advisorySignals.some((signal) => signal.stale)) {
      decisions.push(publicSourceDecision(base, "stale", "source or advisory signal is stale for the query cadence"));
    }
    if (base.duplicate) {
      decisions.push(publicSourceDecision(base, "duplicate", "source URL, content hash, or advisory dedupe key already exists"));
    }
    if (scored.availability.unavailable || scored.availability.takedownOrRetired || advisorySignals.some((signal) => signal.state === "deleted_or_unavailable")) {
      decisions.push(publicSourceDecision(base, "unavailable", "source or public record is unavailable, retired, takedown, or failing"));
    }
    if (scored.availability.editedPublicMessages > 0 || advisorySignals.some((signal) => signal.state === "edited")) {
      decisions.push(publicSourceDecision(base, "edited_deleted", "source has edited or deleted public records that require caveats"));
    }
    if (!scored.provenance.approvedPublic || advisorySignals.some((signal) => !signal.policyAllowed)) {
      decisions.push(publicSourceDecision(base, "policy_disabled", "source or signal is not approved under public-only policy"));
    }
    if (base.parserGap) {
      decisions.push(publicSourceDecision(base, "parser_gap", "source needs parser or adapter repair before reliable extraction"));
    }
    if (base.legalRobotsHold) {
      decisions.push(publicSourceDecision(base, "legal_robots_hold", "source needs legal or robots review before stronger use"));
    }
    if (base.lowYield) {
      decisions.push(publicSourceDecision(base, "low_yield", "source has low query fit, reliability, extraction yield, or intelligence value"));
    }
  }

  for (const family of (input.missingFamilies ?? []).slice(0, 4)) {
    const sourceId = `family:${family}`;
    decisions.push({
      id: `public_source_decision_${hashContent(`${sourceId}:source_pack:${input.query}`).slice(0, 16)}`,
      sourceId,
      sourceName: `Missing ${family} source family`,
      family,
      decision: "low_yield",
      reason: `no selected ${family} source family is available for this query`,
      severity: "review",
      trustScore: 0,
      reliability: 0,
      freshness: 0,
      evidenceYield: 0,
      parserSupport: "unknown",
      publicOnly: true,
      safeUrl: true,
      relatedSignalIds: [],
      handoff: publicSourceDecisionHandoff("low_yield"),
      provenance: {
        sourceId,
        publicOnly: true,
        unsafeUrlExposed: false,
        decisionAt: generatedAt
      }
    });
  }

  const dryRunActions = buildAnalystPublicSourceDryRunActions(decisions);
  const summary = {
    trusted: decisions.filter((decision) => decision.decision === "trusted").length,
    review: decisions.filter((decision) => decision.severity === "review").length,
    hold: decisions.filter((decision) => decision.severity === "hold").length,
    stale: decisions.filter((decision) => decision.decision === "stale").length,
    duplicate: decisions.filter((decision) => decision.decision === "duplicate").length,
    parserGap: decisions.filter((decision) => decision.decision === "parser_gap").length,
    legalRobotsHold: decisions.filter((decision) => decision.decision === "legal_robots_hold").length,
    lowYield: decisions.filter((decision) => decision.decision === "low_yield").length
  };
  const status: AnalystPublicSourceWorkbenchDto["status"] = summary.hold > 0
    ? "hold"
    : summary.review > 0 || dryRunActions.length > 0
      ? "needs_review"
      : "ready";
  return {
    schemaVersion: "ti.public_source_workbench.v1",
    generatedAt,
    query: input.query,
    status,
    decisions,
    dryRunActions,
    summary,
    handoffs: {
      agent01Governance: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent01Governance).filter((item) => item !== "none")),
      agent02Scheduler: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent02Scheduler).filter((item) => item !== "none")),
      agent06EvidenceYield: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent06EvidenceYield).filter((item) => item !== "none")),
      agent07QualityGates: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent07QualityGate).filter((item) => item !== "none")),
      agent09ApiFields: ["publicSignalFusion.analystSourceWorkbench"],
      agent10SloDashboard: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent10SloDashboard).filter((item) => item !== "none"))
    },
    guardrails: {
      publicOnly: true,
      noAuthBypass: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false,
      dryRunOnly: true
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

function unusedBuildAnalystPublicSourceWorkbenchV2(input: AnalystPublicSourceWorkbenchInput): AnalystPublicSourceWorkbenchDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const selectedSources = input.selectedSources ?? [];
  const suppressed = input.suppressed ?? {
    duplicateUrls: [],
    duplicateContentHashes: [],
    unsafeUrls: [],
    unavailableSourceIds: []
  };
  const selectedById = new Map(selectedSources.map((source) => [source.sourceId, source]));
  const decisions = selectedSources.map((source) => analystDecisionForSelectedSource(source, generatedAt));
  for (const source of input.sources) {
    if (selectedById.has(source.id)) continue;
    const family = inferPublicSignalFamily(source);
    if (input.missingFamilies?.includes(family)) {
      decisions.push(analystDecisionForUnselectedSource(source, family, generatedAt));
    }
  }
  for (const sourceId of suppressed.unavailableSourceIds) {
    if (decisions.some((decision) => decision.sourceId === sourceId && decision.decision === "unavailable")) continue;
    const source = input.sources.find((candidate) => candidate.id === sourceId);
    if (source) decisions.push(analystDecisionForUnselectedSource(source, inferPublicSignalFamily(source), generatedAt, "unavailable"));
  }
  const dryRunActions = analystDryRunActions(decisions);
  const status: AnalystPublicSourceWorkbenchDto["status"] = decisions.some((decision) => decision.severity === "hold")
    ? "hold"
    : decisions.some((decision) => decision.severity === "review" || decision.severity === "watch")
      ? "needs_review"
      : "ready";
  return {
    schemaVersion: "ti.public_source_workbench.v1",
    generatedAt,
    query: input.query,
    status,
    decisions,
    dryRunActions,
    summary: {
      trusted: decisions.filter((decision) => decision.decision === "trusted").length,
      review: decisions.filter((decision) => decision.severity === "review").length,
      hold: decisions.filter((decision) => decision.severity === "hold").length,
      stale: decisions.filter((decision) => decision.decision === "stale").length,
      duplicate: decisions.filter((decision) => decision.decision === "duplicate").length,
      parserGap: decisions.filter((decision) => decision.decision === "parser_gap").length,
      legalRobotsHold: decisions.filter((decision) => decision.decision === "legal_robots_hold").length,
      lowYield: decisions.filter((decision) => decision.decision === "low_yield").length
    },
    handoffs: {
      agent01Governance: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent01Governance).filter((value) => value !== "none")),
      agent02Scheduler: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent02Scheduler).filter((value) => value !== "none")),
      agent06EvidenceYield: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent06EvidenceYield).filter((value) => value !== "none")),
      agent07QualityGates: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent07QualityGate).filter((value) => value !== "none")),
      agent09ApiFields: ["publicSignalFusion.analystSourceWorkbench"],
      agent10SloDashboard: uniqueCleanStrings(decisions.map((decision) => decision.handoff.agent10SloDashboard).filter((value) => value !== "none"))
    },
    guardrails: {
      publicOnly: true,
      noAuthBypass: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noExploitPayloadDownload: true,
      noLeakedDataRedistribution: true,
      unsafeUrlsExposed: false,
      dryRunOnly: true
    }
  };
}

function analystDecisionForSelectedSource(source: PublicSignalSourceSelectionDto, generatedAt: string): AnalystPublicSourceDecisionDto {
  const unavailable = source.availability.unavailable || source.availability.takedownOrRetired;
  const editedDeleted = source.availability.deletedOrUnavailablePublicMessages > 0 || source.availability.editedPublicMessages > 0;
  const parserGap = source.hints.clearWebPromotion && source.score < 0.45;
  const decision: AnalystPublicSourceDecisionReason = !source.provenance.approvedPublic
    ? "policy_disabled"
    : unavailable
      ? "unavailable"
      : editedDeleted
        ? "edited_deleted"
        : source.freshness < 0.3
          ? "stale"
          : parserGap
            ? "parser_gap"
            : source.score < 0.35
              ? "low_yield"
              : "trusted";
  return analystDecision({
    idSeed: `${source.sourceId}:${decision}`,
    sourceId: source.sourceId,
    sourceName: source.name,
    family: source.family,
    decision,
    reason: reasonForDecision(decision),
    trustScore: source.provenance.approvedPublic ? source.score : 0,
    reliability: source.reliability,
    freshness: source.freshness,
    evidenceYield: source.queryFit,
    parserSupport: parserGap ? "needs_repair" : source.hints.publicChannel || source.hints.githubAdvisory || source.hints.certGovernment || source.hints.vendorReport || source.hints.clearWebPromotion ? "ready" : "unknown",
    safeUrl: isSafePublicSignalUrl(source.url),
    mergeTarget: source.hints.publicChannel ? "public_channel_partial_evidence" : "clear_web_capture_evidence",
    dedupeKey: hashContent(`${source.family}:${normalizeSignalUrl(source.url)}`),
    relatedSignalIds: [],
    generatedAt
  });
}

function analystDecisionForUnselectedSource(
  source: SourceRecord,
  family: PublicSignalSourceFamily,
  generatedAt: string,
  override?: AnalystPublicSourceDecisionReason
): AnalystPublicSourceDecisionDto {
  const approved = isApprovedPublicSignalSource(source);
  const decision: AnalystPublicSourceDecisionReason = override ?? (!approved ? "legal_robots_hold" : "low_yield");
  return analystDecision({
    idSeed: `${source.id}:${decision}`,
    sourceId: source.id,
    sourceName: source.name,
    family,
    decision,
    reason: reasonForDecision(decision),
    trustScore: source.trustScore,
    reliability: source.catalog?.reliability ?? source.trustScore,
    freshness: publicSignalFreshness(source, generatedAt),
    evidenceYield: 0,
    parserSupport: "unknown",
    safeUrl: isSafePublicSignalUrl(source.url),
    relatedSignalIds: [],
    generatedAt
  });
}

function analystDecision(input: {
  idSeed: string;
  sourceId: string;
  sourceName: string;
  family: PublicSignalSourceFamily;
  decision: AnalystPublicSourceDecisionReason;
  reason: string;
  trustScore: number;
  reliability: number;
  freshness: number;
  evidenceYield: number;
  parserSupport: AnalystPublicSourceDecisionDto["parserSupport"];
  safeUrl: boolean;
  mergeTarget?: AnalystPublicSourceDecisionDto["mergeTarget"];
  dedupeKey?: string;
  relatedSignalIds: string[];
  generatedAt: string;
}): AnalystPublicSourceDecisionDto {
  return {
    id: `analyst_public_source_${hashContent(input.idSeed).slice(0, 16)}`,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    family: input.family,
    decision: input.decision,
    reason: input.reason,
    severity: severityForDecision(input.decision),
    trustScore: roundMetric(input.trustScore),
    reliability: roundMetric(input.reliability),
    freshness: roundMetric(input.freshness),
    evidenceYield: roundMetric(input.evidenceYield),
    parserSupport: input.parserSupport,
    publicOnly: true,
    safeUrl: input.safeUrl,
    mergeTarget: input.mergeTarget,
    dedupeKey: input.dedupeKey,
    relatedSignalIds: input.relatedSignalIds,
    handoff: handoffForDecision(input.decision),
    provenance: {
      sourceId: input.sourceId,
      publicOnly: true,
      unsafeUrlExposed: false,
      decisionAt: input.generatedAt
    }
  };
}

function analystDryRunActions(decisions: AnalystPublicSourceDecisionDto[]): AnalystPublicSourceWorkbenchDto["dryRunActions"] {
  return decisions
    .filter((decision) => actionForDecision(decision.decision) !== undefined)
    .map((decision) => {
      const action = actionForDecision(decision.decision)!;
      return {
        id: `analyst_public_source_action_${hashContent(`${decision.id}:${action}`).slice(0, 16)}`,
        sourceId: decision.sourceId,
        action,
        reason: decision.reason,
        decisionIds: [decision.id],
        execution: decision.severity === "hold" ? "human_approval_required" : "dry_run_only",
        willMutate: false,
        willStartCrawling: false,
        publicOnly: true,
        unsafeUrlExposed: false,
        handoff: decision.handoff
      };
    });
}

function reasonForDecision(decision: AnalystPublicSourceDecisionReason): string {
  if (decision === "trusted") return "source is useful, public, and currently supported";
  if (decision === "suppressed") return "source signal was suppressed by safety or quality filters";
  if (decision === "merged") return "source signal can merge into existing public evidence";
  if (decision === "stale") return "source freshness is below the current query target";
  if (decision === "duplicate") return "source is duplicate-heavy for this query";
  if (decision === "unavailable") return "source is unavailable, retired, or currently unreachable";
  if (decision === "edited_deleted") return "public-channel evidence was edited or deleted and needs caveats";
  if (decision === "policy_disabled") return "source is not approved for public-signal promotion";
  if (decision === "parser_gap") return "source needs parser or extraction fixture repair";
  if (decision === "legal_robots_hold") return "legal, robots, or publicness review is required before activation";
  return "source yielded too little useful evidence for this query";
}

function severityForDecision(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["severity"] {
  if (decision === "trusted" || decision === "merged") return "info";
  if (decision === "stale" || decision === "edited_deleted" || decision === "low_yield") return "watch";
  if (decision === "policy_disabled" || decision === "legal_robots_hold") return "hold";
  return "review";
}

function handoffForDecision(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["handoff"] {
  if (decision === "policy_disabled") return {
    agent01Governance: "approval_review",
    agent02Scheduler: "pause_or_disable",
    agent06EvidenceYield: "none",
    agent07QualityGate: "hold_policy_disabled",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "release_hold"
  };
  if (decision === "legal_robots_hold") return {
    agent01Governance: "legal_robots_review",
    agent02Scheduler: "pause_or_disable",
    agent06EvidenceYield: "none",
    agent07QualityGate: "hold_policy_disabled",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "release_hold"
  };
  if (decision === "parser_gap") return {
    agent01Governance: "none",
    agent02Scheduler: "none",
    agent06EvidenceYield: "none",
    agent07QualityGate: "parser_gap",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "source_health_watch"
  };
  if (decision === "duplicate") return {
    agent01Governance: "none",
    agent02Scheduler: "lower_cadence",
    agent06EvidenceYield: "merge_duplicate_evidence",
    agent07QualityGate: "none",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "source_health_watch"
  };
  if (decision === "stale" || decision === "edited_deleted" || decision === "unavailable" || decision === "low_yield") return {
    agent01Governance: "none",
    agent02Scheduler: decision === "unavailable" ? "pause_or_disable" : decision === "stale" ? "raise_cadence" : "none",
    agent06EvidenceYield: decision === "low_yield" ? "monitor_low_yield" : "none",
    agent07QualityGate: "review_stale_or_edited",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "source_health_watch"
  };
  return {
    agent01Governance: "none",
    agent02Scheduler: "none",
    agent06EvidenceYield: "none",
    agent07QualityGate: "none",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: "none"
  };
}

function actionForDecision(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceAction | undefined {
  if (decision === "policy_disabled") return "approve_source";
  if (decision === "legal_robots_hold") return "request_legal_robots_review";
  if (decision === "parser_gap") return "request_parser_repair";
  if (decision === "duplicate") return "mark_duplicate";
  if (decision === "unavailable") return "disable_source";
  if (decision === "stale") return "raise_cadence";
  if (decision === "low_yield") return "lower_trust";
  return undefined;
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

function groupAdvisorySignalsBySource(
  signals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): Map<string, PublicAdvisorySignalConnectorDto["rankedSignals"]> {
  const grouped = new Map<string, PublicAdvisorySignalConnectorDto["rankedSignals"]>();
  for (const signal of signals) {
    const bucket = grouped.get(signal.sourceId) ?? [];
    bucket.push(signal);
    grouped.set(signal.sourceId, bucket);
  }
  return grouped;
}

function publicSourceDecision(input: {
  source: SourceRecord;
  scored: PublicSignalSourceSelectionDto;
  generatedAt: string;
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"];
  duplicate: boolean;
  parserGap: boolean;
  legalRobotsHold: boolean;
  lowYield: boolean;
}, decision: AnalystPublicSourceDecisionReason, reason: string): AnalystPublicSourceDecisionDto {
  const relatedSignalIds = input.advisorySignals.map((signal) => signal.id).slice(0, 8);
  const mergeSignal = input.advisorySignals.find((signal) => signal.mergeTarget);
  return {
    id: `public_source_decision_${hashContent(`${input.source.id}:${decision}:${reason}`).slice(0, 16)}`,
    sourceId: input.source.id,
    sourceName: input.source.name,
    family: input.scored.family,
    decision,
    reason,
    severity: publicSourceDecisionSeverity(decision),
    trustScore: roundMetric(input.source.trustScore),
    reliability: input.scored.reliability,
    freshness: input.scored.freshness,
    evidenceYield: publicSourceEvidenceYield(input.source, input.scored, input.advisorySignals),
    parserSupport: input.parserGap ? "needs_repair" : sourceParserSupportUnknown(input.source) ? "unknown" : "ready",
    publicOnly: true,
    safeUrl: isSafePublicSignalUrl(input.source.url),
    mergeTarget: mergeSignal?.mergeTarget,
    dedupeKey: mergeSignal?.dedupeKey,
    relatedSignalIds,
    handoff: publicSourceDecisionHandoff(decision),
    provenance: {
      sourceId: input.source.id,
      publicOnly: true,
      unsafeUrlExposed: false,
      decisionAt: input.generatedAt
    }
  };
}

function publicSourceDecisionSeverity(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["severity"] {
  if (decision === "policy_disabled" || decision === "unavailable" || decision === "legal_robots_hold") return "hold";
  if (decision === "parser_gap" || decision === "duplicate" || decision === "stale" || decision === "suppressed") return "review";
  if (decision === "low_yield" || decision === "edited_deleted") return "watch";
  return "info";
}

function publicSourceDecisionHandoff(decision: AnalystPublicSourceDecisionReason): AnalystPublicSourceDecisionDto["handoff"] {
  return {
    agent01Governance: decision === "policy_disabled" ? "approval_review" : decision === "legal_robots_hold" ? "legal_robots_review" : decision === "low_yield" ? "source_pack_promotion" : "none",
    agent02Scheduler: decision === "stale" ? "raise_cadence" : decision === "low_yield" ? "lower_cadence" : decision === "unavailable" || decision === "policy_disabled" ? "pause_or_disable" : "none",
    agent06EvidenceYield: decision === "duplicate" || decision === "merged" ? "merge_duplicate_evidence" : decision === "low_yield" ? "monitor_low_yield" : "none",
    agent07QualityGate: decision === "parser_gap" ? "parser_gap" : decision === "policy_disabled" ? "hold_policy_disabled" : decision === "stale" || decision === "edited_deleted" ? "review_stale_or_edited" : "none",
    agent09ApiField: "analystSourceWorkbench",
    agent10SloDashboard: decision === "policy_disabled" || decision === "unavailable" || decision === "legal_robots_hold" ? "release_hold" : decision === "stale" || decision === "low_yield" || decision === "parser_gap" ? "source_health_watch" : "none"
  };
}

function buildAnalystPublicSourceDryRunActions(
  decisions: AnalystPublicSourceDecisionDto[]
): AnalystPublicSourceWorkbenchDto["dryRunActions"] {
  const actions = new Map<string, AnalystPublicSourceWorkbenchDto["dryRunActions"][number]>();
  const add = (decision: AnalystPublicSourceDecisionDto, action: AnalystPublicSourceAction, reason: string, execution: "dry_run_only" | "human_approval_required" | "blocked" = "human_approval_required") => {
    const key = `${decision.sourceId}:${action}`;
    const existing = actions.get(key);
    if (existing) {
      actions.set(key, { ...existing, decisionIds: [...new Set([...existing.decisionIds, decision.id])] });
      return;
    }
    actions.set(key, {
      id: `public_source_action_${hashContent(key).slice(0, 16)}`,
      sourceId: decision.sourceId,
      action,
      reason,
      decisionIds: [decision.id],
      execution,
      willMutate: false,
      willStartCrawling: false,
      publicOnly: true,
      unsafeUrlExposed: false,
      handoff: decision.handoff
    });
  };

  for (const decision of decisions) {
    if (decision.decision === "policy_disabled") add(decision, decision.sourceId.startsWith("family:") ? "promote_source_pack_candidate" : "approve_source", "review whether the public source can be approved for safe-public use", "human_approval_required");
    if (decision.decision === "unavailable") add(decision, "disable_source", "disable or pause unavailable source in the operator plan", "human_approval_required");
    if (decision.decision === "stale") add(decision, "raise_cadence", "raise crawl cadence or freshness target for stale public source", "dry_run_only");
    if (decision.decision === "duplicate") add(decision, "mark_duplicate", "mark duplicate source or advisory dedupe key", "dry_run_only");
    if (decision.decision === "parser_gap") add(decision, "request_parser_repair", "request parser or adapter repair before extraction promotion", "human_approval_required");
    if (decision.decision === "legal_robots_hold") add(decision, "request_legal_robots_review", "request legal or robots review before stronger use", "human_approval_required");
    if (decision.decision === "low_yield") add(decision, decision.sourceId.startsWith("family:") ? "promote_source_pack_candidate" : "lower_cadence", "reduce cadence or promote a better source-pack candidate for low-yield coverage", "dry_run_only");
    if (decision.decision === "trusted" && decision.reliability >= 0.75) add(decision, "raise_trust", "source has strong public provenance and useful signal yield", "dry_run_only");
    if (decision.decision === "suppressed") add(decision, "lower_trust", "lower trust until suppressed public signals are reviewed", "dry_run_only");
  }
  return [...actions.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.action.localeCompare(right.action));
}

function sourceIsDuplicate(
  source: SourceRecord,
  suppressed: PublicSignalFusionDto["suppressed"] | undefined,
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): boolean {
  const normalized = normalizeSignalUrl(source.url);
  return Boolean(
    suppressed?.duplicateUrls.some((url) => normalizeSignalUrl(url) === normalized)
    || advisorySignals.some((signal) => signal.state === "duplicate_suppressed")
    || source.metadata?.duplicateOf
    || source.catalog?.rollback?.lastQuarantineReason === "duplicate"
  );
}

function sourceHasParserGap(source: SourceRecord): boolean {
  const metadata = source.metadata ?? {};
  const parserStatus = stringValue(metadata.parserStatus) ?? stringValue(metadata.parserState);
  const adapterCompatibility = source.catalog?.adapterCompatibility ?? [];
  return Boolean(
    metadata.parserGap === true
    || parserStatus === "needs_repair"
    || parserStatus === "missing"
    || (adapterCompatibility.length > 0 && !adapterCompatibility.includes(source.type))
  );
}

function sourceParserSupportUnknown(source: SourceRecord): boolean {
  return !source.catalog?.adapterCompatibility?.length && source.metadata?.parserStatus === undefined;
}

function sourceHasLegalRobotsHold(source: SourceRecord, generatedAt: string): boolean {
  const legalText = `${source.legalNotes} ${source.governance?.reviewTicket ?? ""}`.toLowerCase();
  const approvalExpired = source.governance?.approvalExpiresAt ? Date.parse(source.governance.approvalExpiresAt) < Date.parse(generatedAt) : false;
  const robotsState = stringValue(source.metadata?.robotsReviewState) ?? stringValue(source.metadata?.robotsState);
  const legalState = stringValue(source.metadata?.legalReviewState) ?? stringValue(source.metadata?.legalState);
  return Boolean(
    !source.legalNotes.trim()
    || source.governance?.approvalState === "pending"
    || source.governance?.approvalState === "expired"
    || approvalExpired
    || robotsState === "missing"
    || robotsState === "stale"
    || legalState === "missing"
    || legalState === "stale"
    || /legal review|robots review|terms review|pending review/.test(legalText)
  );
}

function sourceHasLowYield(
  source: SourceRecord,
  scored: PublicSignalSourceSelectionDto,
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): boolean {
  const evidenceYield = publicSourceEvidenceYield(source, scored, advisorySignals);
  return scored.queryFit < 0.25 || scored.reliability < 0.42 || evidenceYield < 0.25 || (source.catalog?.intelligenceValue !== undefined && source.catalog.intelligenceValue < 0.35);
}

function publicSourceEvidenceYield(
  source: SourceRecord,
  scored: PublicSignalSourceSelectionDto,
  advisorySignals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): number {
  const selectedSignalYield = advisorySignals.filter((signal) =>
    signal.policyAllowed &&
    signal.provenance.safeUrl &&
    signal.state !== "duplicate_suppressed" &&
    signal.queryMatched
  ).length;
  const explicitYield = typeof source.metadata?.evidenceYield === "number" ? source.metadata.evidenceYield : undefined;
  return roundMetric(clamp01(explicitYield ?? selectedSignalYield * 0.25 + scored.queryFit * 0.35 + scored.reliability * 0.25 + (source.scoring?.parseability ?? 0.5) * 0.15));
}

function publicAdvisorySignalsFromSources(sources: SourceRecord[], generatedAt: string): PublicAdvisorySignalRecord[] {
  return sources
    .filter((source) => source.type === "api" || source.type === "rss" || source.type === "static_web" || source.type === "pdf")
    .map((source) => {
      const family = inferPublicSignalFamily(source);
      const metadataEntities = normalizeMatchedEntities({
        actors: stringArray(source.metadata?.actors),
        malware: stringArray(source.metadata?.malware),
        tools: stringArray(source.metadata?.tools),
        cves: stringArray(source.metadata?.cves),
        campaigns: stringArray(source.metadata?.campaigns),
        sectors: stringArray(source.metadata?.sectors),
        countries: stringArray(source.metadata?.countries),
        victims: stringArray(source.metadata?.victims)
      });
      return {
        id: `signal_${source.id}`,
        sourceId: source.id,
        family: family === "public_channel" || family === "public_social" ? "clear_web" : family,
        title: source.name,
        url: source.url,
        canonicalUrl: normalizeSignalUrl(source.url),
        summary: stringValue(source.metadata?.description) ?? source.legalNotes,
        publishedAt: source.lastSeenAt ?? source.crawlState?.lastCollectedAt ?? source.updatedAt,
        observedAt: source.lastSeenAt ?? source.updatedAt,
        updatedAt: source.updatedAt,
        language: source.language,
        region: stringArray(source.metadata?.regions)[0] ?? stringArray(source.catalog?.coverage.regions)[0],
        tags: [...new Set([...(source.tags ?? []), ...stringArray(source.metadata?.topicTags), ...stringArray(source.catalog?.coverage.topics)])],
        matchedEntities: metadataEntities,
        confidence: source.scoring?.relevance ?? source.trustScore,
        reliabilityScore: source.catalog?.reliability ?? source.trustScore,
        sourceTrust: source.trustScore,
        state: source.status === "disabled" || source.status === "rejected" ? "policy_disabled" : source.status === "retired" || source.status === "quarantined" ? "unavailable" : publicSignalFreshness(source, generatedAt) < 0.25 ? "stale" : "active",
        access: source.accessMethod === "official_api" ? "official_api" : source.accessMethod === "manual_seed" ? "manual_seed" : "public_http",
        policy: {
          publicOnly: source.accessMethod === "official_api" || source.accessMethod === "public_http" || source.accessMethod === "manual_seed",
          authRequired: /(?:auth required|requires auth|login required|requires login|token required)/i.test(`${source.url} ${source.legalNotes}`),
          privateRepo: /private repo|private repository/i.test(`${source.url} ${source.legalNotes}`),
          captchaRequired: /(?:captcha required|requires captcha)/i.test(`${source.url} ${source.legalNotes}`),
          exploitPayloadDownload: /payload|exploit download|proof-of-concept download/i.test(`${source.url} ${source.legalNotes}`),
          leakedDataRedistribution: /leaked data|stolen data|dump/i.test(`${source.url} ${source.legalNotes}`),
          termsBypass: /(?:bypass required|scrape behind login|terms bypass)/i.test(`${source.url} ${source.legalNotes}`)
        },
        provenance: {
          connector: publicAdvisoryConnectorForFamily(family),
          collectedAt: generatedAt,
          parserVersion: "public-signal-source-derived:v1"
        }
      } satisfies PublicAdvisorySignalRecord;
    });
}

function normalizeMatchedEntities(input: Partial<PublicSignalMatchedEntities> | undefined): PublicSignalMatchedEntities {
  return {
    actors: uniqueCleanStrings(input?.actors),
    malware: uniqueCleanStrings(input?.malware),
    tools: uniqueCleanStrings(input?.tools),
    cves: uniqueCleanStrings(input?.cves).map((item) => /^cve-/i.test(item) ? item.toUpperCase() : item),
    campaigns: uniqueCleanStrings(input?.campaigns),
    sectors: uniqueCleanStrings(input?.sectors),
    countries: uniqueCleanStrings(input?.countries),
    victims: uniqueCleanStrings(input?.victims)
  };
}

function publicAdvisoryDedupeKey(signal: PublicAdvisorySignalRecord, canonicalUrl: string, entities: PublicSignalMatchedEntities): string {
  const entityKey = [
    ...entities.cves,
    ...entities.actors,
    ...entities.malware,
    ...entities.tools,
    ...entities.campaigns,
    ...entities.victims
  ].map((item) => item.toLowerCase()).sort().join("|");
  return hashContent(`${signal.family}:${canonicalUrl}:${entityKey || normalizeWhitespace(signal.title).toLowerCase()}`);
}

function publicAdvisoryPolicyAllowed(signal: PublicAdvisorySignalRecord, source: SourceRecord | undefined): boolean {
  const policy = signal.policy;
  if (policy && (!policy.publicOnly || policy.authRequired || policy.privateRepo || policy.captchaRequired || policy.exploitPayloadDownload || policy.leakedDataRedistribution || policy.termsBypass)) return false;
  if (signal.state === "policy_disabled") return false;
  if (source && !isApprovedPublicSignalSource(source)) return false;
  return true;
}

function publicAdvisoryQueryFit(signal: PublicAdvisorySignalRecord, queryTerms: string[], entities: PublicSignalMatchedEntities): number {
  const searchable = [
    signal.title,
    signal.summary ?? "",
    ...(signal.tags ?? []),
    ...entities.actors,
    ...entities.malware,
    ...entities.tools,
    ...entities.cves,
    ...entities.campaigns,
    ...entities.sectors,
    ...entities.countries,
    ...entities.victims
  ].join(" ").toLowerCase();
  if (queryTerms.length === 0) return 0.5;
  const hits = queryTerms.filter((term) => searchable.includes(term.toLowerCase())).length;
  if (hits > 0) return clamp01(0.35 + hits / queryTerms.length * 0.65);
  if (queryTerms.some((term) => /^cve-/i.test(term)) && entities.cves.length > 0) return 0.25;
  return 0;
}

function publicAdvisoryFreshness(signal: PublicAdvisorySignalRecord, generatedAt: string): number {
  const latest = signal.updatedAt ?? signal.observedAt ?? signal.publishedAt;
  if (!latest) return 0.45;
  const ageMs = Date.parse(generatedAt) - Date.parse(latest);
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.75;
  const days = ageMs / 86_400_000;
  if (days <= 7) return 1;
  if (days <= 30) return 0.78;
  if (days <= 120) return 0.45;
  return 0.18;
}

function publicAdvisoryStale(signal: PublicAdvisorySignalRecord, generatedAt: string): boolean {
  return signal.state === "stale" || publicAdvisoryFreshness(signal, generatedAt) < 0.3;
}

function publicAdvisoryFamilySummary(
  signals: PublicAdvisorySignalConnectorDto["rankedSignals"]
): PublicAdvisorySignalConnectorDto["sourceFamilySummary"] {
  return Object.fromEntries(PUBLIC_SIGNAL_FAMILIES.map((family) => {
    const familySignals = signals.filter((signal) => signal.family === family);
    const selected = familySignals.filter((signal) => signal.policyAllowed && !signal.suppressionReason && signal.state !== "duplicate_suppressed");
    return [family, {
      candidateCount: familySignals.length,
      selectedCount: selected.length,
      topScore: roundMetric(Math.max(0, ...familySignals.map((signal) => signal.rankingScore)))
    }];
  })) as PublicAdvisorySignalConnectorDto["sourceFamilySummary"];
}

function publicSignalHasQueryMatch(signal: PublicAdvisorySignalConnectorDto["rankedSignals"][number]): boolean {
  return signal.queryMatched;
}

function inferPublicAdvisoryQueryClass(query: string): string {
  if (/\bCVE-\d{4}-\d{4,}\b/i.test(query)) return "cve";
  if (/akira|lockbit|ransom/i.test(query)) return "ransomware";
  if (/snake|cobalt strike|mimikatz|malware|tool/i.test(query)) return "malware_tool";
  if (/campaign|intrusion|operation/i.test(query)) return "campaign";
  if (/energy|finance|health|telecom|sector/i.test(query)) return "sector";
  if (/norway|china|iran|russia|country/i.test(query)) return "country";
  return "actor";
}

function publicAdvisoryConnectorForFamily(family: PublicSignalSourceFamily): NonNullable<PublicAdvisorySignalRecord["provenance"]>["connector"] {
  if (family === "github_advisory") return "github_security_advisory";
  if (family === "cert_government") return "cert_advisory";
  if (family === "vendor_report") return "vendor_report";
  if (family === "malware_report_feed") return "malware_feed";
  return "public_report_index";
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
  return !/(?:private repo|private repository|invite[- ]only|account automation|captcha required|requires captcha|auth required|requires auth|login required|requires login|token required|bypass required|scrape behind login|terms bypass)/i.test(`${source.url} ${source.legalNotes}`);
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

function uniqueCleanStrings(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function uniqueStrings(values: readonly string[] | undefined): string[] {
  return uniqueCleanStrings(values);
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
