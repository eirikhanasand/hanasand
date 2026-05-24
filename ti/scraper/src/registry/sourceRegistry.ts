import type {
  SourceCrawlState,
  SourceGovernance,
  SourceHealth,
  SourceLifecycleEvent,
  SourceLifecycleReason,
  SourceRecord,
  SourceReviewDecision,
  SourceScoringInputs,
  SourceStatus
} from "../types.ts";
import { clampScore, nowIso, stableId } from "../utils.ts";

const ACTIVE_STATUSES = new Set<SourceStatus>(["active", "probation", "degraded"]);
const TERMINAL_STATUSES = new Set<SourceStatus>(["retired", "rejected"]);
const REVIEWED_STATUSES = new Set<SourceStatus>(["approved", "active", "probation", "degraded"]);
const HIGH_RISK_TYPES = new Set<SourceRecord["type"]>(["tor_metadata", "i2p_metadata", "freenet_metadata"]);
const HTTP_TYPES = new Set<SourceRecord["type"]>(["rss", "static_web", "dynamic_web", "api", "pdf"]);

export interface SourceRegistry {
  list(): SourceRecord[];
  get(id: string): SourceRecord | undefined;
  upsert(input: Omit<SourceRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): SourceRecord;
  ingestSeedSources(inputs: Array<Omit<SourceRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }>): SourceRecord[];
  setStatus(id: string, status: SourceStatus, options?: LifecycleTransitionOptions): SourceRecord;
  approve(id: string, actorId: string, options?: ApprovalOptions): SourceRecord;
  applyReviewDecision(decision: SourceReviewDecision): SourceRecord;
  recordHealth(id: string, health: Partial<SourceHealth>): SourceRecord;
}

export interface LifecycleTransitionOptions {
  actorId?: string;
  reason?: SourceLifecycleReason;
  note?: string;
}

export interface ApprovalOptions {
  approvedAt?: string;
  expiresAt?: string;
  reviewTicket?: string;
  riskJustification?: string;
  legalContact?: string;
  activate?: boolean;
}

export class InMemorySourceRegistry implements SourceRegistry {
  private readonly sources = new Map<string, SourceRecord>();

  list(): SourceRecord[] {
    return [...this.sources.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): SourceRecord | undefined {
    return this.sources.get(id);
  }

  upsert(input: Omit<SourceRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): SourceRecord {
    const now = nowIso();
    const id = input.id ?? stableId("src", `${input.type}:${input.url}`);
    const previous = this.sources.get(id);
    const base: SourceRecord = {
      ...input,
      id,
      trustScore: clampScore(input.trustScore),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now
    };
    const source = normalizeSource(base, previous, now);

    validateSource(source);
    this.sources.set(id, source);
    return source;
  }

  ingestSeedSources(inputs: Array<Omit<SourceRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }>): SourceRecord[] {
    const seen = new Set<string>();
    return inputs.map((input) => {
      const key = `${input.tenantId ?? "global"}:${input.type}:${input.url}`;
      if (seen.has(key)) throw new Error(`Duplicate seed source: ${key}`);
      seen.add(key);
      return this.upsert({ ...input, status: input.status ?? "candidate" });
    });
  }

  setStatus(id: string, status: SourceStatus, options: LifecycleTransitionOptions = {}): SourceRecord {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Unknown source: ${id}`);

    const now = nowIso();
    const updated = normalizeSource({
      ...source,
      status,
      updatedAt: now,
      lifecycle: [
        ...(source.lifecycle ?? []),
        buildLifecycleEvent(source.status, status, now, options)
      ]
    }, source, now);
    validateLifecycleTransition(source, updated);
    validateSource(updated);
    this.sources.set(id, updated);
    return updated;
  }

  approve(id: string, actorId: string, options: ApprovalOptions = {}): SourceRecord {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Unknown source: ${id}`);
    const approvedAt = options.approvedAt ?? nowIso();
    const status = options.activate ? "active" : "approved";
    const governance: SourceGovernance = {
      ...source.governance,
      approvalRequired: requiresApproval(source),
      approvalState: "approved",
      metadataOnly: requiresMetadataOnly(source),
      approvedAt,
      approvedBy: actorId,
      approvalExpiresAt: options.expiresAt ?? source.governance?.approvalExpiresAt,
      reviewTicket: options.reviewTicket ?? source.governance?.reviewTicket,
      policyVersion: source.governance?.policyVersion ?? "collection-policy:v1",
      riskJustification: options.riskJustification ?? source.governance?.riskJustification,
      legalContact: options.legalContact ?? source.governance?.legalContact
    };

    const updated = normalizeSource({
      ...source,
      governance,
      approvalRequired: governance.approvalRequired,
      approvedAt,
      approvedBy: actorId,
      status,
      updatedAt: approvedAt,
      lifecycle: [
        ...(source.lifecycle ?? []),
        buildLifecycleEvent(source.status, status, approvedAt, {
          actorId,
          reason: "policy_review",
          note: options.reviewTicket
        })
      ]
    }, source, approvedAt);
    validateSource(updated);
    this.sources.set(id, updated);
    return updated;
  }

  applyReviewDecision(decision: SourceReviewDecision): SourceRecord {
    const source = this.sources.get(decision.sourceId);
    if (!source) throw new Error(`Unknown source: ${decision.sourceId}`);
    const updated = applySourceReviewDecision(source, decision);
    validateLifecycleTransition(source, updated);
    validateSource(updated);
    this.sources.set(updated.id, updated);
    return updated;
  }

  recordHealth(id: string, health: Partial<SourceHealth>): SourceRecord {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Unknown source: ${id}`);
    const now = nowIso();
    const nextHealth: SourceHealth = {
      ...defaultHealth(),
      ...source.health,
      ...health,
      checkedAt: health.checkedAt ?? now,
      errorRate: clampScore(health.errorRate ?? source.health?.errorRate ?? 0),
      consecutiveFailures: Math.max(0, health.consecutiveFailures ?? source.health?.consecutiveFailures ?? 0)
    };
    const healthTransition = sourceStatusFromHealth(source, nextHealth);
    const updated = normalizeSource({
      ...source,
      status: healthTransition.status,
      health: nextHealth,
      updatedAt: now
      ,
      lifecycle: healthTransition.status === source.status
        ? source.lifecycle
        : [
          ...(source.lifecycle ?? []),
          buildLifecycleEvent(source.status, healthTransition.status, now, {
            reason: "health_check",
            note: healthTransition.note
          })
        ]
    }, source, now);
    validateLifecycleTransition(source, updated);
    validateSource(updated);
    this.sources.set(id, updated);
    return updated;
  }
}

export function validateSource(source: SourceRecord): void {
  if (!source.name.trim()) throw new Error("Source name is required");
  if (!source.url.trim()) throw new Error("Source URL is required");
  validateUrl(source);
  if (!source.legalNotes.trim()) throw new Error("Source legal notes are required");
  if (source.legalNotes.trim().length < 12) {
    throw new Error("Source legal notes must describe collection basis");
  }
  if (source.crawlFrequencySeconds < 60) {
    throw new Error("Source crawl frequency must be at least 60 seconds");
  }
  if (source.trustScore < 0 || source.trustScore > 1) {
    throw new Error("Source trust score must be between 0 and 1");
  }
  if (source.accessMethod === "disabled" && ACTIVE_STATUSES.has(source.status)) {
    throw new Error("Disabled access method cannot be active");
  }
  if (source.risk === "low" && source.accessMethod === "approved_proxy") {
    throw new Error("Approved proxy access cannot be low risk");
  }
  if (HIGH_RISK_TYPES.has(source.type) && source.accessMethod !== "approved_proxy" && source.accessMethod !== "disabled") {
    throw new Error("Darknet metadata sources require approved proxy or disabled access");
  }
  if (HIGH_RISK_TYPES.has(source.type) && !source.governance?.metadataOnly) {
    throw new Error("Darknet metadata sources must be metadata-only");
  }
  if (source.risk === "restricted" && source.status === "active") {
    throw new Error("Restricted sources cannot become active through registry automation");
  }
  if (requiresApproval(source) && REVIEWED_STATUSES.has(source.status)) {
    validateApproval(source);
  }
  validateScoring(source.scoring);
  validateHealth(source.health);
  validateCrawlState(source.crawlState);
}

export function sourceLifecycleEvent(
  to: SourceStatus,
  options: LifecycleTransitionOptions = {},
  from?: SourceStatus
): SourceLifecycleEvent {
  return buildLifecycleEvent(from, to, nowIso(), options);
}

export function requiresApproval(source: Pick<SourceRecord, "risk" | "type">): boolean {
  return source.risk !== "low" || HIGH_RISK_TYPES.has(source.type);
}

export function requiresMetadataOnly(source: Pick<SourceRecord, "type">): boolean {
  return HIGH_RISK_TYPES.has(source.type);
}

export function effectiveSourceScore(source: SourceRecord): number {
  if (!source.scoring) return clampScore(source.trustScore);

  const scoring = source.scoring;
  const healthPenalty = source.health?.status === "failing"
    ? 0.25
    : source.health?.status === "degraded"
      ? 0.1
      : 0;
  return clampScore(
    0.35 * scoring.reliability +
    0.2 * scoring.freshness +
    0.2 * scoring.relevance +
    0.15 * scoring.uniqueness +
    0.1 * scoring.parseability +
    scoring.operatorBoost -
    scoring.policyRiskPenalty -
    healthPenalty
  );
}

export function applySourceReviewDecision(source: SourceRecord, decision: SourceReviewDecision): SourceRecord {
  if (decision.sourceId !== source.id) throw new Error("Review decision source id mismatch");
  if (!decision.decidedBy.trim()) throw new Error("Review decision requires decidedBy");
  if (!decision.reason.trim()) throw new Error("Review decision requires reason");

  const approvalRequired = requiresApproval(source);
  const existingGovernance = normalizeGovernance(source, approvalRequired);
  const governance: SourceGovernance = {
    ...existingGovernance,
    approvalRequired,
    metadataOnly: decision.metadataOnly ?? existingGovernance.metadataOnly,
    reviewTicket: decision.reviewTicket ?? existingGovernance.reviewTicket,
    policyVersion: decision.policyVersion ?? existingGovernance.policyVersion ?? "collection-policy:v1",
    riskJustification: decision.riskJustification ?? existingGovernance.riskJustification,
    legalContact: decision.legalContact ?? existingGovernance.legalContact
  };
  let status: SourceStatus = source.status;

  if (decision.action === "approve") {
    governance.approvalState = "approved";
    governance.approvedAt = decision.decidedAt;
    governance.approvedBy = decision.decidedBy;
    governance.approvalExpiresAt = decision.approvalExpiresAt;
    status = "approved";
  } else if (decision.action === "reject") {
    governance.approvalState = "rejected";
    status = "rejected";
  } else if (decision.action === "expire") {
    governance.approvalState = "expired";
    governance.approvalExpiresAt = decision.approvalExpiresAt ?? decision.decidedAt;
    status = source.status === "active" || source.status === "probation" || source.status === "degraded"
      ? "needs_review"
      : source.status;
  } else if (decision.action === "quarantine") {
    status = "quarantined";
  } else if (decision.action === "restore") {
    if (source.health && source.health.status !== "healthy" && source.health.status !== "unknown") {
      throw new Error("Source health must recover before restore");
    }
    status = decision.restoreStatus ?? (requiresApproval(source) ? "needs_review" : "active");
  }

  const updated = normalizeSource({
    ...source,
    status,
    governance,
    approvalRequired,
    approvedAt: governance.approvedAt,
    approvedBy: governance.approvedBy,
    updatedAt: decision.decidedAt,
    lifecycle: [
      ...(source.lifecycle ?? []),
      buildLifecycleEvent(source.status, status, decision.decidedAt, {
        actorId: decision.decidedBy,
        reason: decision.action === "quarantine" ? "health_check" : "policy_review",
        note: `${decision.action}: ${decision.reason}`
      })
    ]
  }, source, decision.decidedAt);

  if (decision.action === "approve" && decision.restoreStatus === "active") {
    return { ...updated, status: "active" };
  }
  return updated;
}

function normalizeSource(source: SourceRecord, previous: SourceRecord | undefined, now: string): SourceRecord {
  const approvalRequired = source.approvalRequired ?? source.governance?.approvalRequired ?? requiresApproval(source);
  const governance = normalizeGovernance(source, approvalRequired);
  const health = source.health ? normalizeHealth(source.health) : previous?.health;
  const scoring = source.scoring ? normalizeScoring(source.scoring) : previous?.scoring ?? defaultScoring(source.trustScore, approvalRequired);
  const crawlState = source.crawlState ? normalizeCrawlState(source.crawlState) : previous?.crawlState ?? defaultCrawlState();
  const lifecycle = source.lifecycle?.length
    ? source.lifecycle
    : previous?.lifecycle ?? [buildLifecycleEvent(undefined, source.status, now, { reason: "seeded" })];

  return {
    ...source,
    approvalRequired,
    approvedAt: source.approvedAt ?? governance.approvedAt,
    approvedBy: source.approvedBy ?? governance.approvedBy,
    governance,
    health,
    scoring,
    crawlState,
    lifecycle,
    tags: source.tags?.map((tag) => tag.trim()).filter(Boolean)
  };
}

function normalizeGovernance(source: SourceRecord, approvalRequired: boolean): SourceGovernance {
  return {
    approvalRequired,
    approvalState: source.governance?.approvalState ?? (approvalRequired ? "pending" : "not_required"),
    metadataOnly: source.governance?.metadataOnly ?? requiresMetadataOnly(source),
    approvedAt: source.governance?.approvedAt ?? source.approvedAt,
    approvedBy: source.governance?.approvedBy ?? source.approvedBy,
    approvalExpiresAt: source.governance?.approvalExpiresAt,
    reviewTicket: source.governance?.reviewTicket,
    policyVersion: source.governance?.policyVersion ?? "collection-policy:v1",
    riskJustification: source.governance?.riskJustification,
    legalContact: source.governance?.legalContact
  };
}

function normalizeHealth(health: SourceHealth): SourceHealth {
  return {
    ...health,
    consecutiveFailures: Math.max(0, health.consecutiveFailures),
    errorRate: clampScore(health.errorRate)
  };
}

function normalizeScoring(scoring: SourceScoringInputs): SourceScoringInputs {
  return {
    reliability: clampScore(scoring.reliability),
    freshness: clampScore(scoring.freshness),
    relevance: clampScore(scoring.relevance),
    uniqueness: clampScore(scoring.uniqueness),
    parseability: clampScore(scoring.parseability),
    policyRiskPenalty: clampScore(scoring.policyRiskPenalty),
    operatorBoost: clampScore(scoring.operatorBoost)
  };
}

function normalizeCrawlState(crawlState: SourceCrawlState): SourceCrawlState {
  return {
    ...crawlState,
    retryCount: Math.max(0, crawlState.retryCount)
  };
}

function defaultHealth(): SourceHealth {
  return {
    status: "unknown",
    consecutiveFailures: 0,
    errorRate: 0
  };
}

function defaultScoring(trustScore: number, approvalRequired: boolean): SourceScoringInputs {
  return {
    reliability: clampScore(trustScore),
    freshness: 0.5,
    relevance: 0.5,
    uniqueness: 0.5,
    parseability: 0.5,
    policyRiskPenalty: approvalRequired ? 0.15 : 0,
    operatorBoost: 0
  };
}

function defaultCrawlState(): SourceCrawlState {
  return { retryCount: 0 };
}

function buildLifecycleEvent(
  from: SourceStatus | undefined,
  to: SourceStatus,
  at: string,
  options: LifecycleTransitionOptions
): SourceLifecycleEvent {
  return {
    at,
    from,
    to,
    reason: options.reason ?? "operator_request",
    actorId: options.actorId,
    note: options.note
  };
}

function validateLifecycleTransition(previous: SourceRecord, next: SourceRecord): void {
  if (previous.status === next.status) return;
  if (TERMINAL_STATUSES.has(previous.status)) {
    throw new Error(`Cannot transition source from terminal status ${previous.status}`);
  }
  if (next.status === "active" && requiresApproval(next) && next.governance?.approvalState !== "approved") {
    throw new Error("Source approval is required before activation");
  }
  if (next.status === "approved" && next.governance?.approvalState !== "approved") {
    throw new Error("Source must have approved governance before approved status");
  }
}

function validateApproval(source: SourceRecord): void {
  const governance = source.governance;
  if (!governance) throw new Error("Source governance is required");
  if (governance.approvalState !== "approved") throw new Error("Source approval is required");
  if (!governance.approvedAt || !governance.approvedBy) {
    throw new Error("Source approval must include approver and timestamp");
  }
  if ((source.risk === "high" || source.risk === "restricted") && !governance.riskJustification?.trim()) {
    throw new Error("High-risk source approval requires risk justification");
  }
  if (governance.approvalExpiresAt && Date.parse(governance.approvalExpiresAt) <= Date.now()) {
    throw new Error("Source approval has expired");
  }
}

function validateUrl(source: SourceRecord): void {
  if (source.accessMethod === "manual_seed") return;
  if (source.type === "telegram_public") {
    if (!source.url.startsWith("https://t.me/") && !source.url.startsWith("tg://")) {
      throw new Error("Telegram sources must use https://t.me/ or tg:// URLs");
    }
    return;
  }
  if (source.accessMethod === "approved_proxy" && HIGH_RISK_TYPES.has(source.type)) return;
  if (HTTP_TYPES.has(source.type) || source.accessMethod === "public_http" || source.accessMethod === "official_api") {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Source URL must be HTTP(S)");
      }
    } catch {
      throw new Error("Source URL must be a valid URL");
    }
  }
}

function validateScoring(scoring: SourceScoringInputs | undefined): void {
  if (!scoring) return;
  for (const [key, value] of Object.entries(scoring)) {
    if (value < 0 || value > 1) throw new Error(`Source scoring ${key} must be between 0 and 1`);
  }
}

function validateHealth(health: SourceHealth | undefined): void {
  if (!health) return;
  if (health.consecutiveFailures < 0) throw new Error("Source health failures cannot be negative");
  if (health.errorRate < 0 || health.errorRate > 1) throw new Error("Source health error rate must be between 0 and 1");
}

function validateCrawlState(crawlState: SourceCrawlState | undefined): void {
  if (!crawlState) return;
  if (crawlState.retryCount < 0) throw new Error("Source crawl retry count cannot be negative");
}

function sourceStatusFromHealth(source: SourceRecord, health: SourceHealth): { status: SourceStatus; note?: string } {
  if (health.status === "failing" && health.consecutiveFailures >= 5) {
    return { status: "quarantined", note: `quarantined after ${health.consecutiveFailures} consecutive failures` };
  }
  if (source.status === "quarantined" && health.status === "healthy" && health.consecutiveFailures === 0) {
    return { status: "probation", note: "restored to probation after health recovered" };
  }
  if (source.status === "active" && health.status === "degraded") {
    return { status: "degraded", note: "source health degraded" };
  }
  if (source.status === "degraded" && health.status === "healthy" && health.consecutiveFailures === 0) {
    return { status: "active", note: "source health recovered" };
  }
  return { status: source.status };
}
