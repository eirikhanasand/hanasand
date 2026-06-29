import { hashContent, nowIso, stableId, uniqueStrings } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";
import { buildDwmSourceInventory, sourceInventoryDigest, type DwmSourceInventorySnapshot } from "./dwmSourceInventory.ts";

export type DwmSourceFamily = "telegram_public" | "darkweb_metadata" | "actor_page" | "public_advisory" | "clear_web" | "unknown";
export type DwmSeverity = "critical" | "high" | "medium" | "low";
export type DwmReviewState = "needs_review" | "validate_identity" | "route_to_customer" | "watching" | "false_positive_candidate";
export type DwmArtifactType = "telegram_mention" | "ransomware_claim" | "infostealer_hint" | "session_or_token_hint" | "nhi_exposure_hint" | "vendor_claim" | "public_report" | "metadata_match";
export type DwmCaptureMode = "public_message" | "metadata_only" | "public_report" | "unknown";
export type DwmRecommendedRoute = "identity_response" | "vendor_risk" | "incident_response" | "brand_protection" | "analyst_review";

export interface DwmWatchTerm {
  value: string;
  kind: "company" | "domain" | "vendor" | "brand" | "vip" | "product" | "unknown";
}

export interface DwmEvidenceRef {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceFamily: DwmSourceFamily;
  url?: string;
  firstSeenAt: string;
  observedAt: string;
  captureMode: DwmCaptureMode;
  redactionState: "redacted" | "metadata_only" | "public_safe";
  contentHash: string;
  excerpt: string;
  provenance: {
    captureId: string;
    sourceId: string;
    sourceType?: string;
    collector?: string;
    captureMode: DwmCaptureMode;
    retentionClass?: string;
    storageKind?: string;
    metadataOnly: boolean;
  };
}

export interface DwmAlert {
  id: string;
  eventType: "darkweb.monitoring.match";
  severity: DwmSeverity;
  confidence: number;
  matchedTerm: DwmWatchTerm;
  company: string;
  actor?: string;
  artifactType: DwmArtifactType;
  sourceFamily: DwmSourceFamily;
  sourceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  claimSummary: string;
  matchContext: {
    normalizedTerm: string;
    termKind: DwmWatchTerm["kind"];
    matchType: "bounded_text_or_metadata";
    matchedFieldHints: string[];
  };
  evidenceSummary: {
    evidenceCount: number;
    sourceFamilyCounts: Record<string, number>;
    metadataOnlyCount: number;
    publicSafeCount: number;
    firstObservedAt: string;
    lastObservedAt: string;
  };
  routingContext: {
    queue: "identity_response" | "vendor_risk" | "incident_response" | "brand_protection" | "analyst_review";
    urgency: "immediate" | "same_day" | "watch";
    customerVisibleEvidence: "metadata_only" | "redacted_excerpt";
    reason: string;
  };
  confidenceReasoning: string[];
  provenance: {
    generatedAt: string;
    matchBasis: "watchlist_capture_text";
    matchedEvidenceIds: string[];
    sourceFamilies: DwmSourceFamily[];
    captureIds: string[];
    sourceIds: string[];
    extractorVersions: string[];
    metadataOnly: boolean;
  };
  dedupeKey: string;
  reviewState: DwmReviewState;
  recommendedAction: string;
  recommendedRoute: DwmRecommendedRoute;
  evidence: DwmEvidenceRef[];
  webhookDelivery: {
    recommendedRoute: DwmRecommendedRoute;
    payloadHash: string;
    dedupeKey: string;
  };
}

export interface DwmSourceCoverage {
  family: DwmSourceFamily;
  label: string;
  sourceCount: number;
  activeCount: number;
  approvalState: "active" | "canary" | "approval_required" | "missing";
  health: "healthy" | "partial" | "missing";
  detail: string;
}

export interface DwmActorOverview {
  actor: string;
  aliases: string[];
  sourceFamilies: DwmSourceFamily[];
  sourceCount: number;
  captureCount: number;
  latestSeenAt: string;
  confidence: number;
  watchState: "active_monitoring" | "metadata_only" | "needs_more_sources";
  summary: string;
}

export interface DwmOnDemandRequest {
  id: string;
  target: string;
  type: "telegram_channel" | "restricted_metadata" | "actor_scope" | "sector_scope" | "language_scope";
  priority: "critical" | "high" | "medium";
  scope: string;
  approvalState: "draft" | "queued" | "approved_metadata_only" | "blocked";
  nextAction: string;
}

export interface DwmProductSnapshot {
  schemaVersion: "dwm.product.v1";
  generatedAt: string;
  tenantId: string;
  watchlist: DwmWatchTerm[];
  alerts: DwmAlert[];
  sourceCoverage: DwmSourceCoverage[];
  actorOverviews: DwmActorOverview[];
  onDemandQueue: DwmOnDemandRequest[];
  sourceInventory: {
    schemaVersion: DwmSourceInventorySnapshot["schemaVersion"];
    counts: DwmSourceInventorySnapshot["counts"];
    packs: DwmSourceInventorySnapshot["packs"];
    reviewQueuePreview: DwmSourceInventorySnapshot["reviewQueue"];
    reportingHooks: DwmSourceInventorySnapshot["reportingHooks"];
    digest: string;
  };
  readiness: {
    decision: "production_ready_with_live_sources" | "demo_ready_needs_live_sources" | "blocked_missing_watchlist";
    blockers: string[];
    advantages: string[];
    nextWorkItem: string;
  };
}

export interface BuildDwmProductSnapshotInput {
  tenantId?: string;
  watchlist?: Array<string | Partial<DwmWatchTerm>>;
  sources?: SourceRecord[];
  captures?: RawCapture[];
  generatedAt?: string;
  includeDemoIfEmpty?: boolean;
}

const sourceFamilyLabels: Record<DwmSourceFamily, string> = {
  telegram_public: "Public Telegram",
  darkweb_metadata: "Dark web metadata",
  actor_page: "Actor-page metadata",
  public_advisory: "Public advisories",
  clear_web: "Clear-web corroboration",
  unknown: "Unknown source"
};

export function buildDwmProductSnapshot(input: BuildDwmProductSnapshotInput = {}): DwmProductSnapshot {
  const generatedAt = input.generatedAt ?? nowIso();
  const watchlist = normalizeWatchlist(input.watchlist ?? []);
  const sources = input.sources ?? [];
  const captures = input.captures ?? [];
  const alerts = buildAlerts({ watchlist, sources, captures, generatedAt });
  const demoAlerts = alerts.length === 0 && input.includeDemoIfEmpty !== false && watchlist.length > 0
    ? buildDemoAlerts(watchlist, generatedAt)
    : [];
  const sourceCoverage = buildSourceCoverage(sources);
  const actorOverviews = buildActorOverviews({ sources, captures, alerts: [...alerts, ...demoAlerts], generatedAt });
  const onDemandQueue = buildOnDemandQueue(watchlist, generatedAt);
  const sourceInventory = buildDwmSourceInventory({
    tenantId: input.tenantId,
    watchlist: watchlist.map((term) => term.value),
    sources,
    captures,
    generatedAt,
    includeCandidates: false
  });
  const blockers = readinessBlockers(watchlist, sources);

  return {
    schemaVersion: "dwm.product.v1",
    generatedAt,
    tenantId: input.tenantId ?? "default",
    watchlist,
    alerts: [...alerts, ...demoAlerts],
    sourceCoverage,
    actorOverviews,
    onDemandQueue,
    sourceInventory: {
      schemaVersion: sourceInventory.schemaVersion,
      counts: sourceInventory.counts,
      packs: sourceInventory.packs,
      reviewQueuePreview: sourceInventory.reviewQueue.slice(0, 25),
      reportingHooks: sourceInventory.reportingHooks,
      digest: sourceInventoryDigest(sourceInventory)
    },
    readiness: {
      decision: watchlist.length === 0 ? "blocked_missing_watchlist" : blockers.length ? "demo_ready_needs_live_sources" : "production_ready_with_live_sources",
      blockers,
      advantages: [
        "Telegram is modeled as a first-class source family with source health, parser state, and webhook routing.",
        "Restricted dark web collection is metadata-only by default: source timing, hashes, screenshots, and redaction state without stolen-file bloat.",
        "Alerts are customer-workflow objects, not scraped rows: matched term, confidence, evidence refs, review state, and recommended action.",
        "On-demand customer source requests become approval packets before they become continuous collection."
      ],
      nextWorkItem: nextWorkItemFor(sourceInventory)
    }
  };
}

function nextWorkItemFor(sourceInventory: DwmSourceInventorySnapshot): string {
  if (sourceInventory.counts.registeredDarkwebMetadata < sourceInventory.counts.catalogDarkwebMetadata) {
    return "Approve the remaining dark-web metadata sources, then run metadata-only actor and market refreshes.";
  }
  if (sourceInventory.counts.netNewCandidates > 0) {
    return "Review remaining source candidates and promote useful ones without enabling payload downloads or private access.";
  }
  return "Add self-serve webhook subscriptions and testable customer watchlist onboarding so new buyers can get alerts without manual setup.";
}

export function normalizeWatchlist(values: Array<string | Partial<DwmWatchTerm>>): DwmWatchTerm[] {
  return uniqueStrings(values.map((item) => typeof item === "string" ? item.trim() : String(item.value ?? "").trim()))
    .map((value) => ({ value, kind: inferWatchTermKind(value) }));
}

export function classifySourceFamily(source: SourceRecord | undefined, capture?: RawCapture): DwmSourceFamily {
  const type = String((source as any)?.type ?? (capture?.metadata as any)?.adapter ?? "").toLowerCase();
  const url = String((source as any)?.url ?? capture?.url ?? "").toLowerCase();
  const name = String((source as any)?.name ?? "").toLowerCase();
  if (type.includes("telegram") || url.includes("t.me/")) return "telegram_public";
  if (type.includes("actor_page") || type.includes("actor-page") || name.includes("actor-page") || name.includes("actor page")) return "actor_page";
  if (type.includes("tor") || type.includes("i2p") || type.includes("darknet") || type.includes("darkweb") || url.includes(".onion") || url.includes(".i2p")) return "darkweb_metadata";
  if (type.includes("advisory") || type.includes("cert") || type.includes("cve") || name.includes("cert") || name.includes("advisory") || url.includes("advisor")) return "public_advisory";
  if (type.includes("rss") || type.includes("static") || type.includes("dynamic") || url.startsWith("https://")) return "clear_web";
  return "unknown";
}

function buildAlerts(input: { watchlist: DwmWatchTerm[]; sources: SourceRecord[]; captures: RawCapture[]; generatedAt: string }): DwmAlert[] {
  const sourceById = new Map(input.sources.map((source) => [String((source as any).id), source]));
  const matches: DwmAlert[] = [];

  for (const capture of input.captures) {
    const text = captureText(capture);
    const matchedTerm = input.watchlist.find((term) => includesTerm(text, term.value));
    if (!matchedTerm) continue;

    const source = sourceById.get(String((capture as any).sourceId));
    const sourceFamily = classifySourceFamily(source, capture);
    const artifactType = inferArtifactType(text, sourceFamily);
    const evidence = buildEvidenceRef(capture, source, sourceFamily);
    const severity = inferSeverity(text, artifactType, sourceFamily);
    const actor = inferActor(capture, text);
    const confidence = inferConfidence({ text, source, sourceFamily, artifactType });
    const confidenceReasoning = confidenceReasoningFor({ text, source, sourceFamily, artifactType, confidence });
    const dedupeSeed = alertDedupeSeed(matchedTerm, artifactType, sourceFamily);
    const delivery = deliveryFor(matchedTerm, artifactType, sourceFamily, dedupeSeed);

    matches.push({
      id: stableId("dwm_alert", dedupeSeed),
      eventType: "darkweb.monitoring.match",
      severity,
      confidence,
      matchedTerm,
      company: displayCompany(matchedTerm.value),
      actor,
      artifactType,
      sourceFamily,
      sourceCount: 1,
      firstSeenAt: String((capture as any).collectedAt ?? input.generatedAt),
      lastSeenAt: String((capture as any).collectedAt ?? input.generatedAt),
      claimSummary: summarizeClaim({ matchedTerm, text, artifactType, sourceFamily, actor }),
      matchContext: matchContextFor(matchedTerm, capture),
      evidenceSummary: evidenceSummaryFor([evidence]),
      routingContext: routingContextFor(artifactType, sourceFamily, matchedTerm),
      confidenceReasoning,
      provenance: provenanceForAlert(input.generatedAt, [evidence]),
      dedupeKey: delivery.dedupeKey,
      reviewState: reviewStateFor(artifactType, sourceFamily),
      recommendedAction: recommendedActionFor(artifactType, sourceFamily, matchedTerm),
      recommendedRoute: delivery.recommendedRoute,
      evidence: [evidence],
      webhookDelivery: delivery
    });
  }

  return mergeDuplicateAlerts(matches);
}

function buildEvidenceRef(capture: RawCapture, source: SourceRecord | undefined, sourceFamily: DwmSourceFamily): DwmEvidenceRef {
  const text = captureText(capture);
  const captureMode = sourceFamily === "telegram_public" ? "public_message" : sourceFamily === "darkweb_metadata" ? "metadata_only" : sourceFamily === "public_advisory" ? "public_report" : "unknown";
  const collectedAt = String((capture as any).collectedAt ?? nowIso());
  return {
    id: String((capture as any).id),
    sourceId: String((capture as any).sourceId ?? (source as any)?.id ?? "unknown"),
    sourceName: String((source as any)?.name ?? sourceFamilyLabels[sourceFamily]),
    sourceFamily,
    url: String((capture as any).url ?? (source as any)?.url ?? "") || undefined,
    firstSeenAt: collectedAt,
    observedAt: collectedAt,
    captureMode,
    redactionState: captureMode === "metadata_only" ? "metadata_only" : "redacted",
    contentHash: String((capture as any).contentHash ?? hashContent(text)),
    excerpt: safeExcerpt(text),
    provenance: {
      captureId: String((capture as any).id),
      sourceId: String((capture as any).sourceId ?? (source as any)?.id ?? "unknown"),
      sourceType: String((source as any)?.type ?? (capture.metadata as any)?.adapter ?? "") || undefined,
      collector: String((capture.metadata as any)?.adapter ?? (capture.metadata as any)?.collector ?? "") || undefined,
      captureMode,
      retentionClass: String((capture as any).retentionClass ?? (capture.metadata as any)?.retentionClass ?? "") || undefined,
      storageKind: String((capture as any).storageKind ?? "") || undefined,
      metadataOnly: captureMode === "metadata_only" || (capture as any).storageKind === "metadata_only"
    }
  };
}

function buildSourceCoverage(sources: SourceRecord[]): DwmSourceCoverage[] {
  const families: DwmSourceFamily[] = ["telegram_public", "darkweb_metadata", "actor_page", "public_advisory", "clear_web"];
  return families.map((family) => {
    const familySources = sourceCoverageMembers(sources, family);
    const activeCount = familySources.filter((source) => ["active", "canary", "approved"].includes(String((source as any).status ?? "").toLowerCase())).length;
    const sourceCount = familySources.length;
    return {
      family,
      label: sourceFamilyLabels[family],
      sourceCount,
      activeCount,
      approvalState: sourceCount === 0 ? "missing" : activeCount > 0 ? "active" : "approval_required",
      health: sourceCount === 0 ? "missing" : activeCount === sourceCount ? "healthy" : "partial",
      detail: coverageDetail(family, sourceCount, activeCount)
    };
  });
}

function sourceCoverageMembers(sources: SourceRecord[], family: DwmSourceFamily): SourceRecord[] {
  if (family === "actor_page") {
    const explicit = sources.filter((source) => classifySourceFamily(source) === "actor_page");
    if (explicit.length) return explicit;
    return sources.filter((source) => classifySourceFamily(source) === "darkweb_metadata");
  }
  if (family === "public_advisory") {
    const explicit = sources.filter((source) => classifySourceFamily(source) === "public_advisory");
    if (explicit.length) return explicit;
    return sources.filter((source) => {
      const text = `${String((source as any).name ?? "")} ${String((source as any).type ?? "")} ${String((source as any).url ?? "")}`.toLowerCase();
      return classifySourceFamily(source) === "clear_web" && /\b(cert|advisory|security|threat|intel|research|blog|rss|cve)\b/.test(text);
    });
  }
  return sources.filter((source) => classifySourceFamily(source) === family);
}

function buildActorOverviews(input: { sources: SourceRecord[]; captures: RawCapture[]; alerts: DwmAlert[]; generatedAt: string }): DwmActorOverview[] {
  const sourceById = new Map(input.sources.map((source) => [String((source as any).id), source]));
  const groups = new Map<string, {
    actor: string;
    aliases: Set<string>;
    sourceIds: Set<string>;
    families: Set<DwmSourceFamily>;
    captureCount: number;
    latestSeenAt: string;
    confidence: number;
  }>();

  const touch = (actor: string | undefined, seed: {
    alias?: string;
    sourceId?: string;
    family?: DwmSourceFamily;
    latestSeenAt?: string;
    confidence?: number;
    capture?: boolean;
  }) => {
    const normalized = actor?.trim();
    if (!normalized || normalized.toLowerCase() === "unknown") return;
    const key = normalized.toLowerCase();
    const current = groups.get(key) ?? {
      actor: normalized,
      aliases: new Set<string>(),
      sourceIds: new Set<string>(),
      families: new Set<DwmSourceFamily>(),
      captureCount: 0,
      latestSeenAt: seed.latestSeenAt ?? input.generatedAt,
      confidence: 55
    };
    if (seed.alias && seed.alias !== normalized) current.aliases.add(seed.alias);
    if (seed.sourceId) current.sourceIds.add(seed.sourceId);
    if (seed.family) current.families.add(seed.family);
    if (seed.capture) current.captureCount += 1;
    if (seed.latestSeenAt && seed.latestSeenAt > current.latestSeenAt) current.latestSeenAt = seed.latestSeenAt;
    current.confidence = Math.max(current.confidence, seed.confidence ?? current.confidence);
    groups.set(key, current);
  };

  for (const source of input.sources) {
    touch(inferActorFromSource(source), {
      sourceId: String((source as any).id ?? ""),
      family: classifySourceFamily(source),
      confidence: Number((source as any).trustScore ?? 0) > 0 ? 65 + Math.round(Number((source as any).trustScore) * 20) : 62
    });
  }

  for (const capture of input.captures) {
    const source = sourceById.get(String((capture as any).sourceId));
    const text = captureText(capture);
    const family = classifySourceFamily(source, capture);
    const artifactType = inferArtifactType(text, family);
    touch(inferActor(capture, text) ?? inferActorFromSource(source), {
      sourceId: String((capture as any).sourceId ?? ""),
      family,
      latestSeenAt: String((capture as any).collectedAt ?? input.generatedAt),
      confidence: inferConfidence({ text, source, sourceFamily: family, artifactType }),
      capture: true
    });
  }

  for (const alert of input.alerts) {
    touch(alert.actor, {
      family: alert.sourceFamily,
      latestSeenAt: alert.lastSeenAt,
      confidence: alert.confidence
    });
  }

  return [...groups.values()]
    .map((group): DwmActorOverview => {
      const sourceFamilies = [...group.families].sort();
      const watchState = sourceFamilies.includes("darkweb_metadata")
        ? "metadata_only"
        : group.sourceIds.size > 1 || group.captureCount > 0
          ? "active_monitoring"
          : "needs_more_sources";
      const familyLabel = sourceFamilies.map((family) => sourceFamilyLabels[family] ?? family).join(", ") || "unknown sources";
      return {
        actor: group.actor,
        aliases: [...group.aliases].slice(0, 4),
        sourceFamilies,
        sourceCount: group.sourceIds.size,
        captureCount: group.captureCount,
        latestSeenAt: group.latestSeenAt,
        confidence: Math.min(99, group.confidence + Math.min(8, group.captureCount * 2)),
        watchState,
        summary: `${group.actor} is tracked across ${group.sourceIds.size} source(s), ${familyLabel}, with ${group.captureCount} recent capture(s).`
      };
    })
    .sort((a, b) => b.confidence - a.confidence || b.captureCount - a.captureCount || b.latestSeenAt.localeCompare(a.latestSeenAt))
    .slice(0, 8);
}

function buildOnDemandQueue(watchlist: DwmWatchTerm[], generatedAt: string): DwmOnDemandRequest[] {
  const primary = watchlist[0]?.value ?? "customer watchlist";
  return [
    {
      id: stableId("dwm_req", `${primary}:telegram:${generatedAt.slice(0, 10)}`),
      target: `public Telegram broker rooms for ${primary}`,
      type: "telegram_channel",
      priority: "high",
      scope: `${primary} plus subsidiaries, domains, and brand variants`,
      approvalState: "queued",
      nextAction: "Discover candidate public channels, run compliance checks, and promote approved sources to continuous polling."
    },
    {
      id: stableId("dwm_req", `${primary}:restricted:${generatedAt.slice(0, 10)}`),
      target: `actor-page and leak-site metadata for ${primary}`,
      type: "restricted_metadata",
      priority: "high",
      scope: "metadata-only first seen, actor, victim, claimed data, mirrors, screenshot state, and hash",
      approvalState: "approved_metadata_only",
      nextAction: "Keep payload/download paths blocked and capture only safe metadata fields."
    }
  ];
}

function buildDemoAlerts(watchlist: DwmWatchTerm[], generatedAt: string): DwmAlert[] {
  const matchedTerm = watchlist[0];
  const seed = `${matchedTerm.value}:demo:telegram_stealer_log_hint`;
  return [{
    id: stableId("dwm_alert_demo", seed),
    eventType: "darkweb.monitoring.match",
    severity: "critical",
    confidence: 86,
    matchedTerm,
    company: displayCompany(matchedTerm.value),
    actor: "Lumma C2",
    artifactType: "infostealer_hint",
    sourceFamily: "telegram_public",
    sourceCount: 3,
    firstSeenAt: generatedAt,
    lastSeenAt: generatedAt,
    claimSummary: `Public Telegram broker-room metadata claims ${matchedTerm.value} appears in a stealer-log bundle with corporate URLs and session artifacts.`,
    matchContext: {
      normalizedTerm: normalizeMatchValue(matchedTerm.value),
      termKind: matchedTerm.kind,
      matchType: "bounded_text_or_metadata",
      matchedFieldHints: ["demo_public_message"]
    },
    evidenceSummary: evidenceSummaryFor([{
      id: stableId("dwm_ev_demo", seed),
      sourceId: "demo_telegram_public",
      sourceName: "Public Telegram broker-room coverage",
      sourceFamily: "telegram_public",
      firstSeenAt: generatedAt,
      observedAt: generatedAt,
      captureMode: "public_message",
      redactionState: "redacted",
      contentHash: hashContent(seed),
      excerpt: `${matchedTerm.value} matched in a redacted public Telegram stealer-log listing.`,
      provenance: {
        captureId: stableId("dwm_ev_demo", seed),
        sourceId: "demo_telegram_public",
        sourceType: "telegram_public",
        collector: "demo",
        captureMode: "public_message",
        metadataOnly: false
      }
    }]),
    routingContext: routingContextFor("infostealer_hint", "telegram_public", matchedTerm),
    confidenceReasoning: ["Demo alert uses seeded public Telegram broker-room metadata.", "Identity response route is selected because the demo artifact references sessions."],
    provenance: {
      generatedAt,
      matchBasis: "watchlist_capture_text",
      matchedEvidenceIds: [stableId("dwm_ev_demo", seed)],
      sourceFamilies: ["telegram_public"],
      captureIds: [stableId("dwm_ev_demo", seed)],
      sourceIds: ["demo_telegram_public"],
      extractorVersions: ["demo"],
      metadataOnly: false
    },
    dedupeKey: deliveryFor(matchedTerm, "infostealer_hint", "telegram_public", seed).dedupeKey,
    reviewState: "validate_identity",
    recommendedAction: "Validate the identity match, rotate sessions and keys if confirmed, and route to incident response without storing raw stolen material.",
    recommendedRoute: "identity_response",
    evidence: [{
      id: stableId("dwm_ev_demo", seed),
      sourceId: "demo_telegram_public",
      sourceName: "Public Telegram broker-room coverage",
      sourceFamily: "telegram_public",
      firstSeenAt: generatedAt,
      observedAt: generatedAt,
      captureMode: "public_message",
      redactionState: "redacted",
      contentHash: hashContent(seed),
      excerpt: `${matchedTerm.value} matched in a redacted public Telegram stealer-log listing.`,
      provenance: {
        captureId: stableId("dwm_ev_demo", seed),
        sourceId: "demo_telegram_public",
        sourceType: "telegram_public",
        collector: "demo",
        captureMode: "public_message",
        metadataOnly: false
      }
    }],
    webhookDelivery: deliveryFor(matchedTerm, "infostealer_hint", "telegram_public", seed)
  }];
}

function mergeDuplicateAlerts(alerts: DwmAlert[]): DwmAlert[] {
  const merged = new Map<string, DwmAlert>();
  for (const alert of alerts) {
    const key = alert.dedupeKey;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, alert);
      continue;
    }
    current.evidence = mergeEvidenceRefs([...current.evidence, ...alert.evidence]);
    current.sourceCount = current.evidence.length;
    current.confidence = Math.min(99, Math.max(current.confidence, alert.confidence) + 3);
    current.confidenceReasoning = uniqueStrings([...current.confidenceReasoning, ...alert.confidenceReasoning, "Multiple recent captures support the same watchlist alert."]);
    current.firstSeenAt = current.firstSeenAt < alert.firstSeenAt ? current.firstSeenAt : alert.firstSeenAt;
    current.lastSeenAt = current.lastSeenAt > alert.lastSeenAt ? current.lastSeenAt : alert.lastSeenAt;
    current.provenance = provenanceForAlert(current.provenance.generatedAt, current.evidence);
    current.evidenceSummary = evidenceSummaryFor(current.evidence);
    current.webhookDelivery = {
      ...current.webhookDelivery,
      payloadHash: hashContent(`${current.dedupeKey}:${current.evidenceSummary.evidenceCount}:${current.lastSeenAt}`)
    };
  }
  return [...merged.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.confidence - a.confidence);
}

function readinessBlockers(watchlist: DwmWatchTerm[], sources: SourceRecord[]): string[] {
  const blockers: string[] = [];
  const isLiveSource = (source: SourceRecord) => ["active", "canary", "approved"].includes(String((source as any).status ?? "").toLowerCase());
  if (watchlist.length === 0) blockers.push("Add at least one company, domain, vendor, brand, or product watch term.");
  if (!sources.some((source) => classifySourceFamily(source) === "telegram_public" && isLiveSource(source))) blockers.push("No live public Telegram source is registered for this tenant.");
  if (!sources.some((source) => classifySourceFamily(source) === "darkweb_metadata" && isLiveSource(source))) blockers.push("No approved metadata-only dark web source is active for this tenant.");
  return blockers;
}

function mergeEvidenceRefs(evidence: DwmEvidenceRef[]): DwmEvidenceRef[] {
  const byIdentity = new Map<string, DwmEvidenceRef>();
  for (const item of evidence) {
    const identity = evidenceIdentity(item);
    const current = byIdentity.get(identity);
    if (!current) {
      byIdentity.set(identity, item);
      continue;
    }
    byIdentity.set(identity, {
      ...current,
      firstSeenAt: current.firstSeenAt < item.firstSeenAt ? current.firstSeenAt : item.firstSeenAt,
      observedAt: current.observedAt > item.observedAt ? current.observedAt : item.observedAt,
      redactionState: current.redactionState === "metadata_only" || item.redactionState === "metadata_only" ? "metadata_only" : current.redactionState,
      excerpt: current.excerpt.length >= item.excerpt.length ? current.excerpt : item.excerpt
    });
  }
  return [...byIdentity.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
}

function evidenceIdentity(item: DwmEvidenceRef): string {
  const hash = item.contentHash || item.provenance.captureId || item.id;
  return `${item.sourceFamily}:${item.sourceId}:${hash}`;
}

function inferWatchTermKind(value: string): DwmWatchTerm["kind"] {
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return "domain";
  if (/@/.test(value)) return "vip";
  if (/\b(inc|as|ab|ltd|llc|corp|bank|payments|health|energy)\b/i.test(value)) return "company";
  return "unknown";
}

function inferArtifactType(text: string, sourceFamily: DwmSourceFamily): DwmArtifactType {
  const lower = text.toLowerCase();
  if (/\b(session|cookie|oauth|token|api key|iam|service account|nhi)\b/.test(lower)) return lower.includes("service account") || lower.includes("nhi") || lower.includes("iam") ? "nhi_exposure_hint" : "session_or_token_hint";
  if (/\b(lumma|stealer|redline|raccoon|vidar|browser dump|autofill)\b/.test(lower)) return "infostealer_hint";
  if (/\b(ransom|leak site|victim|countdown|claim)\b/.test(lower)) return "ransomware_claim";
  if (/\b(vendor|supplier|third party|partner)\b/.test(lower)) return "vendor_claim";
  if (sourceFamily === "telegram_public") return "telegram_mention";
  if (sourceFamily === "public_advisory") return "public_report";
  return "metadata_match";
}

function inferSeverity(text: string, artifactType: DwmArtifactType, sourceFamily: DwmSourceFamily): DwmSeverity {
  const lower = text.toLowerCase();
  if (artifactType === "session_or_token_hint" || artifactType === "nhi_exposure_hint" || /\b(admin|mfa|live cookie|aws|okta|entra)\b/.test(lower)) return "critical";
  if (artifactType === "infostealer_hint" || artifactType === "ransomware_claim") return "high";
  if (sourceFamily === "telegram_public" || sourceFamily === "darkweb_metadata") return "medium";
  return "low";
}

function inferConfidence(input: { text: string; source?: SourceRecord; sourceFamily: DwmSourceFamily; artifactType: DwmArtifactType }): number {
  let confidence = 55;
  if (input.sourceFamily === "telegram_public") confidence += 12;
  if (input.sourceFamily === "darkweb_metadata") confidence += 10;
  if (input.artifactType === "session_or_token_hint" || input.artifactType === "nhi_exposure_hint") confidence += 15;
  if (input.artifactType === "infostealer_hint" || input.artifactType === "ransomware_claim") confidence += 10;
  const trustScore = Number((input.source as any)?.trustScore ?? 0);
  if (Number.isFinite(trustScore) && trustScore > 0) confidence += Math.round(trustScore * 12);
  if (/\b(sample|rumor|unverified)\b/i.test(input.text)) confidence -= 8;
  return Math.max(1, Math.min(99, confidence));
}

function confidenceReasoningFor(input: { text: string; source?: SourceRecord; sourceFamily: DwmSourceFamily; artifactType: DwmArtifactType; confidence: number }): string[] {
  const reasons = [`Watchlist term matched captured ${sourceFamilyLabels[input.sourceFamily].toLowerCase()} text or metadata.`];
  if (input.sourceFamily === "telegram_public") reasons.push("Public Telegram source family adds confidence for broker-room and public-channel monitoring.");
  if (input.sourceFamily === "darkweb_metadata") reasons.push("Dark web metadata source family is handled metadata-only and requires analyst confirmation before customer routing.");
  if (input.artifactType === "session_or_token_hint" || input.artifactType === "nhi_exposure_hint") reasons.push("Credential, session, token, API key, or IAM wording raises identity-response urgency.");
  if (input.artifactType === "infostealer_hint" || input.artifactType === "ransomware_claim") reasons.push(`${input.artifactType.replaceAll("_", " ")} wording raises severity.`);
  const trustScore = Number((input.source as any)?.trustScore ?? 0);
  if (Number.isFinite(trustScore) && trustScore > 0) reasons.push(`Source trust score contributed ${Math.round(trustScore * 12)} confidence points.`);
  if (/\b(sample|rumor|unverified)\b/i.test(input.text)) reasons.push("Unverified or rumor wording reduces confidence.");
  reasons.push(`Final confidence ${input.confidence}/99.`);
  return reasons;
}

function inferActor(capture: RawCapture, text: string): string | undefined {
  const metadata = (capture.metadata ?? {}) as any;
  const named = metadata.actorName ?? metadata.actor ?? metadata.leakSite?.actorName ?? metadata.channel;
  if (named) return formatActorName(String(named));
  const match = text.match(/\b(Akira|LockBit|BlackCat|RansomHouse|Lumma C2|RedLine|Vidar)\b/i);
  return match?.[1] ? formatActorName(match[1]) : undefined;
}

function inferActorFromSource(source: SourceRecord | undefined): string | undefined {
  const metadata = ((source as any)?.metadata ?? {}) as any;
  const named = metadata.actorName ?? metadata.actor ?? metadata.group ?? metadata.threatActor;
  if (named) return formatActorName(String(named));
  const text = `${String((source as any)?.name ?? "")} ${String((source as any)?.url ?? "")}`;
  const match = text.match(/\b(Akira|LockBit|BlackCat|BlackCat\/ALPHV|ALPHV|RansomHouse|Lumma C2|RedLine|Vidar|Scattered Spider|APT29|APT28)\b/i);
  if (!match) return undefined;
  return formatActorName(match[1]);
}

function formatActorName(value: string): string {
  const normalized = value.trim().replace(/[_-]+/g, " ");
  const lower = normalized.toLowerCase();
  const known: Record<string, string> = {
    akira: "Akira",
    lockbit: "LockBit",
    "blackcat": "BlackCat/ALPHV",
    "blackcat/alphv": "BlackCat/ALPHV",
    alphv: "BlackCat/ALPHV",
    ransomhouse: "RansomHouse",
    "lumma c2": "Lumma C2",
    redline: "RedLine",
    vidar: "Vidar",
    "scattered spider": "Scattered Spider",
    apt29: "APT29",
    apt28: "APT28"
  };
  return known[lower] ?? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function recommendedActionFor(artifactType: DwmArtifactType, sourceFamily: DwmSourceFamily, term: DwmWatchTerm): string {
  if (artifactType === "session_or_token_hint") return "Validate the match, revoke live sessions, rotate affected tokens, and route to identity response.";
  if (artifactType === "nhi_exposure_hint") return "Validate service-account ownership, rotate API/IAM keys, and open a non-human identity incident.";
  if (artifactType === "infostealer_hint") return "Confirm the host or account match, rotate saved credentials and sessions, and check recent IdP sign-ins.";
  if (artifactType === "ransomware_claim") return "Corroborate actor-page metadata, notify incident response, and watch mirrors every 30 minutes.";
  if (artifactType === "vendor_claim" || term.kind === "vendor") return "Route to vendor-risk workflow and request confirmation from the supplier owner.";
  if (sourceFamily === "telegram_public") return "Review the public Telegram context, confirm the customer match, and keep the source on elevated polling.";
  return "Review source metadata, corroborate with public reporting, and keep the term on continuous watch.";
}

function reviewStateFor(artifactType: DwmArtifactType, sourceFamily: DwmSourceFamily): DwmReviewState {
  if (artifactType === "session_or_token_hint" || artifactType === "nhi_exposure_hint" || artifactType === "infostealer_hint") return "validate_identity";
  if (sourceFamily === "darkweb_metadata") return "needs_review";
  return "route_to_customer";
}

function deliveryFor(term: DwmWatchTerm, artifactType: DwmArtifactType, sourceFamily: DwmSourceFamily, seed: string): DwmAlert["webhookDelivery"] {
  const recommendedRoute = artifactType === "session_or_token_hint" || artifactType === "nhi_exposure_hint" || artifactType === "infostealer_hint"
    ? "identity_response"
    : artifactType === "vendor_claim" || term.kind === "vendor"
      ? "vendor_risk"
      : sourceFamily === "darkweb_metadata"
        ? "incident_response"
        : "analyst_review";
  return {
    recommendedRoute,
    payloadHash: hashContent(seed),
    dedupeKey: stableId("dwm_dedupe", `${term.value}:${artifactType}:${sourceFamily}`)
  };
}

function matchContextFor(term: DwmWatchTerm, capture: RawCapture): DwmAlert["matchContext"] {
  return {
    normalizedTerm: normalizeMatchValue(term.value),
    termKind: term.kind,
    matchType: "bounded_text_or_metadata",
    matchedFieldHints: matchedFieldHints(capture, term.value)
  };
}

function normalizeMatchValue(value: string): string {
  return value.trim().toLowerCase();
}

function matchedFieldHints(capture: RawCapture, term: string): string[] {
  const normalized = term.toLowerCase();
  const metadata = (capture.metadata ?? {}) as any;
  const fields: Array<[string, unknown]> = [
    ["body", (capture as any).body],
    ["rawText", (capture as any).rawText],
    ["url", (capture as any).url],
    ["metadata.title", metadata.title],
    ["metadata.description", metadata.description],
    ["metadata.leakSite", metadata.leakSite ? JSON.stringify(metadata.leakSite) : undefined]
  ];
  return fields
    .filter(([, value]) => includesTerm(String(value ?? ""), normalized))
    .map(([field]) => field);
}

function evidenceSummaryFor(evidence: DwmEvidenceRef[]): DwmAlert["evidenceSummary"] {
  const observed = evidence.map((item) => item.observedAt || item.firstSeenAt).sort();
  const sourceFamilyCounts = evidence.reduce<Record<string, number>>((counts, item) => {
    counts[item.sourceFamily] = (counts[item.sourceFamily] ?? 0) + 1;
    return counts;
  }, {});
  return {
    evidenceCount: evidence.length,
    sourceFamilyCounts,
    metadataOnlyCount: evidence.filter((item) => item.redactionState === "metadata_only" || item.provenance.metadataOnly).length,
    publicSafeCount: evidence.filter((item) => item.redactionState === "redacted" || item.redactionState === "public_safe").length,
    firstObservedAt: observed[0] ?? nowIso(),
    lastObservedAt: observed[observed.length - 1] ?? nowIso()
  };
}

function routingContextFor(artifactType: DwmArtifactType, sourceFamily: DwmSourceFamily, term: DwmWatchTerm): DwmAlert["routingContext"] {
  const queue = deliveryFor(term, artifactType, sourceFamily, `${term.value}:${artifactType}:${sourceFamily}`).recommendedRoute;
  const urgency = artifactType === "session_or_token_hint" || artifactType === "nhi_exposure_hint"
    ? "immediate"
    : artifactType === "infostealer_hint" || artifactType === "ransomware_claim" || sourceFamily === "darkweb_metadata"
      ? "same_day"
      : "watch";
  const customerVisibleEvidence = sourceFamily === "darkweb_metadata" ? "metadata_only" : "redacted_excerpt";
  return {
    queue,
    urgency,
    customerVisibleEvidence,
    reason: routingReason(artifactType, sourceFamily, term)
  };
}

function routingReason(artifactType: DwmArtifactType, sourceFamily: DwmSourceFamily, term: DwmWatchTerm): string {
  if (artifactType === "session_or_token_hint" || artifactType === "nhi_exposure_hint") return "Identity or non-human identity wording requires immediate validation and rotation workflow.";
  if (artifactType === "infostealer_hint") return "Infostealer wording should route to identity response with redacted evidence only.";
  if (artifactType === "ransomware_claim" || sourceFamily === "darkweb_metadata") return "Dark web metadata needs analyst confirmation before customer notification.";
  if (term.kind === "vendor" || artifactType === "vendor_claim") return "Matched supplier or vendor term should route through vendor risk.";
  return "General monitored-term match should stay in analyst review until corroborated.";
}

function alertDedupeSeed(term: DwmWatchTerm, artifactType: DwmArtifactType, sourceFamily: DwmSourceFamily): string {
  return `${term.value.toLowerCase()}:${artifactType}:${sourceFamily}`;
}

function provenanceForAlert(generatedAt: string, evidence: DwmEvidenceRef[]): DwmAlert["provenance"] {
  return {
    generatedAt,
    matchBasis: "watchlist_capture_text",
    matchedEvidenceIds: uniqueStrings(evidence.map((item) => item.id)),
    sourceFamilies: uniqueStrings(evidence.map((item) => item.sourceFamily)) as DwmSourceFamily[],
    captureIds: uniqueStrings(evidence.map((item) => item.provenance.captureId)),
    sourceIds: uniqueStrings(evidence.map((item) => item.sourceId)),
    extractorVersions: uniqueStrings(evidence.map((item) => item.provenance.collector ?? "").filter(Boolean)),
    metadataOnly: evidence.every((item) => item.provenance.metadataOnly || item.redactionState === "metadata_only")
  };
}

function coverageDetail(family: DwmSourceFamily, sourceCount: number, activeCount: number): string {
  if (sourceCount === 0) return `${sourceFamilyLabels[family]} is not registered yet. Add sources or queue an on-demand approval packet.`;
  if (activeCount === 0) return `${sourceFamilyLabels[family]} has ${sourceCount} registered source(s), but none are active.`;
  return `${activeCount}/${sourceCount} ${sourceFamilyLabels[family].toLowerCase()} source(s) are active and available for matching.`;
}

function captureText(capture: RawCapture): string {
  const body = String((capture as any).body ?? "");
  const rawText = String((capture as any).rawText ?? "");
  const title = String((capture.metadata as any)?.title ?? "");
  const description = String((capture.metadata as any)?.description ?? "");
  const leakSite = (capture.metadata as any)?.leakSite ? JSON.stringify((capture.metadata as any).leakSite) : "";
  return [body, rawText, title, description, leakSite, capture.url].filter(Boolean).join(" ");
}

function includesTerm(text: string, term: string): boolean {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const domainLike = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedTerm);
  const boundary = domainLike ? "a-z0-9.-" : "a-z0-9";
  return new RegExp(`(^|[^${boundary}])${escaped}(?=$|[^${boundary}])`, "i").test(text);
}

function safeExcerpt(text: string): string {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").replace(/\b\d{8,}\b/g, "[number]").slice(0, 220);
}

function summarizeClaim(input: { matchedTerm: DwmWatchTerm; text: string; artifactType: DwmArtifactType; sourceFamily: DwmSourceFamily; actor?: string }): string {
  const actorPrefix = input.actor ? `${input.actor} context from ` : "";
  return `${actorPrefix}${sourceFamilyLabels[input.sourceFamily]} matched ${input.matchedTerm.value} as ${input.artifactType.replaceAll("_", " ")}. ${safeExcerpt(input.text)}`;
}

function displayCompany(value: string): string {
  return value.includes(".") ? value.split(".")[0].replace(/[-_]/g, " ") : value;
}

function severityRank(severity: DwmSeverity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity];
}
