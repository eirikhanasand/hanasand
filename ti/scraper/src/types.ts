export type SourceType =
  | "rss"
  | "static_web"
  | "dynamic_web"
  | "telegram_public"
  | "tor_metadata"
  | "i2p_metadata"
  | "freenet_metadata"
  | "api"
  | "pdf";

export type AccessMethod =
  | "public_http"
  | "official_api"
  | "approved_proxy"
  | "manual_seed"
  | "disabled";

export type SourceRisk = "low" | "medium" | "high" | "restricted";

export type SourceStatus =
  | "candidate"
  | "needs_review"
  | "approved"
  | "active"
  | "probation"
  | "degraded"
  | "quarantined"
  | "paused"
  | "disabled"
  | "retired"
  | "rejected";

export type SourceApprovalState = "not_required" | "pending" | "approved" | "rejected" | "expired";

export type SourceHealthStatus = "unknown" | "healthy" | "degraded" | "failing" | "disabled";

export type SourceLifecycleReason =
  | "seeded"
  | "operator_request"
  | "policy_review"
  | "health_check"
  | "crawl_result"
  | "compliance"
  | "retention"
  | "duplicate"
  | "other";

export interface SourceGovernance {
  approvalState: SourceApprovalState;
  approvalRequired: boolean;
  metadataOnly: boolean;
  approvedAt?: string;
  approvedBy?: string;
  approvalExpiresAt?: string;
  reviewTicket?: string;
  policyVersion?: string;
  riskJustification?: string;
  legalContact?: string;
}

export interface SourceHealth {
  status: SourceHealthStatus;
  checkedAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  consecutiveFailures: number;
  errorRate: number;
  medianLatencyMs?: number;
  lastError?: string;
}

export interface SourceScoringInputs {
  reliability: number;
  freshness: number;
  relevance: number;
  uniqueness: number;
  parseability: number;
  policyRiskPenalty: number;
  operatorBoost: number;
}

export interface SourceCrawlState {
  lastScheduledAt?: string;
  nextEligibleAt?: string;
  lastCollectedAt?: string;
  etag?: string;
  lastModified?: string;
  cursor?: string;
  backoffUntil?: string;
  retryCount: number;
}

export interface SourceLifecycleEvent {
  at: string;
  from?: SourceStatus;
  to: SourceStatus;
  reason: SourceLifecycleReason;
  actorId?: string;
  note?: string;
}

export type SourceReviewAction = "approve" | "reject" | "expire" | "quarantine" | "restore";

export interface SourceReviewDecision {
  id: string;
  sourceId: string;
  tenantId?: string;
  action: SourceReviewAction;
  decidedAt: string;
  decidedBy: string;
  reason: string;
  reviewTicket?: string;
  approvalExpiresAt?: string;
  restoreStatus?: Extract<SourceStatus, "active" | "probation" | "degraded" | "needs_review">;
  riskJustification?: string;
  legalContact?: string;
  metadataOnly?: boolean;
  policyVersion?: string;
}

export type SourceTier = "tier_1" | "tier_2" | "tier_3" | "watchlist";

export type SourceApprovalScope =
  | "safe_public_auto"
  | "public_requires_review"
  | "metadata_only"
  | "restricted_protocol"
  | "disabled";

export type SourceActivationStatus =
  | "active"
  | "approved_idle"
  | "candidate_only"
  | "blocked_by_policy"
  | "missing_legal_notes"
  | "stale"
  | "duplicate"
  | "adapter_incompatible";

export interface SourcePublisherIdentity {
  name: string;
  country?: string;
  homepage?: string;
  trustBasis: "government" | "vendor" | "community" | "standards_body" | "research" | "unknown";
}

export interface SourceCoverageMetadata {
  topics: string[];
  actors: string[];
  aliases: string[];
  industries: string[];
  regions: string[];
  countries: string[];
  languages: string[];
  queryPatterns: string[];
}

export interface SourceCollectionSla {
  freshnessTargetSeconds: number;
  collectionSlaSeconds: number;
  budgetClass: "low" | "normal" | "high" | "urgent";
  crawlCadenceSeconds: number;
}

export interface SourceRollbackState {
  lastQuarantineReason?: string;
  rollbackReason?: string;
  rollbackAt?: string;
  rollbackBy?: string;
}

export interface SourceCatalogMetadata {
  canonicalId: string;
  publisher: SourcePublisherIdentity;
  tier: SourceTier;
  approvalScope: SourceApprovalScope;
  license: string;
  legalBasis: string;
  reliability: number;
  intelligenceValue: number;
  retentionClass: RetentionClass;
  analystOwner?: string;
  coverage: SourceCoverageMetadata;
  collection: SourceCollectionSla;
  adapterCompatibility: SourceType[];
  rollback?: SourceRollbackState;
}

export interface SourceCoverageExplanation {
  sourceId: string;
  sourceName: string;
  status: SourceActivationStatus;
  score: number;
  reasons: string[];
  matchedTopics: string[];
  matchedActors: string[];
  matchedIndustries: string[];
  matchedRegions: string[];
}

export type ApiVersion = "v1";

export type RetentionClass =
  | "public_raw"
  | "public_report"
  | "public_chat_text"
  | "darknet_metadata"
  | "discovery_snippet"
  | "live_search_snapshot"
  | "evidence_delta"
  | "screenshot_hash"
  | "sensitive_metadata"
  | "standard"
  | "short"
  | "restricted_metadata"
  | "legal_hold";

export type SensitivityFlag =
  | "public"
  | "sensitive_source"
  | "leak_metadata"
  | "contains_pii"
  | "credential_material"
  | "restricted_protocol";

export interface ContentHashes {
  contentHash: string;
  normalizedTextHash?: string;
  screenshotHash?: string;
  objectHash?: string;
}

export interface ObjectStoreRef {
  bucket: string;
  key: string;
  versionId?: string;
  sizeBytes: number;
  sha256: string;
}

export interface RedactionDecision {
  applied: boolean;
  policy: "none" | "metadata_only" | "safe_excerpt" | "pii_removed";
  reason: string;
  safeExcerpt?: string;
}

export interface CaptureProvenance {
  sourceId: string;
  captureId: string;
  url: string;
  collectedAt: string;
  contentHash: string;
  extractorVersion: string;
  taskId?: string;
  tenantId?: string;
  policyDecisionId?: string;
  adapterVersion?: string;
}

export interface CaptureDedupeKey {
  sourceId: string;
  canonicalUrl: string;
  normalizedTextHash?: string;
  publishedAt?: string;
}

export interface CaptureWriteResult {
  capture: RawCapture;
  status: "inserted" | "duplicate";
  duplicateOf?: string;
  dedupeKey: CaptureDedupeKey;
}

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  roles: string[];
}

export interface AuditEvent {
  id: string;
  tenantId?: string;
  actorId?: string;
  action: string;
  subjectType: string;
  subjectId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface SourceRecord {
  id: string;
  tenantId?: string;
  name: string;
  type: SourceType;
  url: string;
  accessMethod: AccessMethod;
  status: SourceStatus;
  risk: SourceRisk;
  trustScore: number;
  language?: string;
  crawlFrequencySeconds: number;
  legalNotes: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
  approvalRequired?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  governance?: SourceGovernance;
  health?: SourceHealth;
  scoring?: SourceScoringInputs;
  crawlState?: SourceCrawlState;
  lifecycle?: SourceLifecycleEvent[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  catalog?: SourceCatalogMetadata;
}

export interface CollectionTask {
  id: string;
  tenantId?: string;
  sourceId: string;
  targetUrl: string;
  sourceType: SourceType;
  queuedAt: string;
  priority: number;
  reason: string;
  parentUrl?: string;
  retryCount: number;
  intelRequestId?: string;
  runId?: string;
  deadlineAt?: string;
  maxBytes?: number;
  availableAt?: string;
  attemptDeadlineAt?: string;
  crawlBudgetKey?: string;
  maxRetries?: number;
  sourceConcurrencyKey?: string;
  fairnessKey?: string;
  scoreBreakdown?: FrontierScore;
  planning?: TaskPlanningMetadata;
}

export type FrontierStrategy =
  | "precision"
  | "recall"
  | "balanced"
  | "efficiency"
  | "link_only"
  | "parent_only"
  | "destination_only"
  | "link_parent"
  | "link_destination"
  | "parent_destination"
  | "hybrid_dynamic";

export type PlanningBudgetClass =
  | "interactive_live_search"
  | "interactive_search"
  | "analyst_deep_dive"
  | "background_refresh"
  | "broad_daily_sweep"
  | "source_health_probe"
  | "restricted_darknet_metadata_sweep";

export type PlannerDecisionStatus =
  | "selected"
  | "skipped"
  | "delayed"
  | "blocked-by-policy"
  | "blocked-by-approval"
  | "stale-cache-used"
  | "duplicate-suppressed"
  | "waiting-for-backoff";

export interface PlannerDecision {
  sourceId: string;
  status: PlannerDecisionStatus;
  reason: string;
  targetUrl?: string;
  taskId?: string;
  priority?: number;
  availableAt?: string;
  budgetClass?: PlanningBudgetClass;
  queryTerms?: string[];
}

export type LiveSearchZeroTaskReason =
  | "none"
  | "no_approved_sources"
  | "all_sources_stale_or_backoff"
  | "all_sources_blocked_by_risk"
  | "adapter_disabled"
  | "tenant_budget_exhausted"
  | "duplicate_run_already_active"
  | "query_too_broad";

export type LiveSearchBackpressureState =
  | "accepted"
  | "attached_to_active_run"
  | "deferred_by_budget"
  | "deferred_by_queue_pressure"
  | "deferred_by_source_backoff"
  | "blocked_by_policy"
  | "needs_source_activation";

export interface LiveSearchPlannerDto {
  mode: "interactive_live_search";
  planId: string;
  reuseKey: string;
  activeRunId?: string;
  attachedToActiveRun: boolean;
  backpressureState: LiveSearchBackpressureState;
  backpressureReason?: string;
  retryAfterSeconds?: number;
  queuedTaskCount: number;
  reviewTaskCount: number;
  blockedSourceCount: number;
  skippedTaskCount: number;
  nextPollSeconds: number;
  zeroTaskReason: LiveSearchZeroTaskReason;
  coverageGaps: string[];
  recommendedSourceActivations: Array<{
    sourceId: string;
    reason: string;
    requiredAction: "approve" | "restore" | "add_source" | "enable_adapter";
    priority: number;
    coverageGap?: string;
    demandCount: number;
  }>;
  decisions: PlannerDecision[];
  queryTerms: string[];
}

export interface TaskPlanningMetadata {
  budgetClass: PlanningBudgetClass;
  decision: PlannerDecisionStatus;
  reason: string;
  queryTerms: string[];
  freshness: number;
  freshnessTargetSeconds?: number;
  maxCost?: {
    tasks: number;
    bytes: number;
  };
  safetyEnvelope?: {
    allowClearWeb: boolean;
    allowPublicChannel: boolean;
    allowRestrictedMetadata: boolean;
    metadataOnlyRestricted: boolean;
    forbiddenOperations: string[];
  };
  idempotencyKey?: string;
  sourceTrust: number;
  selectedFor: "interactive" | "background" | "probe" | "metadata";
}

export type IntelEntityType =
  | "actor"
  | "alias"
  | "victim"
  | "malware"
  | "cve"
  | "campaign"
  | "indicator"
  | "sector"
  | "country"
  | "infrastructure"
  | "free_text"
  | "saved_topic";

export interface IntelligenceRequest {
  id?: string;
  tenantId?: string;
  query: string;
  entityType: IntelEntityType;
  includeClearWeb?: boolean;
  includeTelegram?: boolean;
  includeDarknetMetadata?: boolean;
  maxTasks?: number;
  createdAt?: string;
  requesterId?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  reason?: string;
  budgetClass?: PlanningBudgetClass;
}

export interface CollectionPlan {
  id: string;
  tenantId?: string;
  request: Required<Omit<IntelligenceRequest, "id" | "createdAt" | "tenantId" | "requesterId" | "reason" | "budgetClass">> & {
    id: string;
    createdAt: string;
    tenantId?: string;
    requesterId?: string;
    reason?: string;
    budgetClass?: PlanningBudgetClass;
  };
  tasks: CollectionTask[];
  reviewRequired: CollectionTask[];
  rejected: Array<{ sourceId: string; reason: string }>;
  explanations?: PlannerDecision[];
  budget?: {
    class: PlanningBudgetClass;
    maxTasks: number;
    immediateTaskLimit: number;
    maxBytesPerTask: number;
    deadlineAt: string;
    backgroundAvailableAt?: string;
  };
  queryTerms?: string[];
  audit: AuditEvent[];
}

export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface CollectionRun {
  id: string;
  tenantId?: string;
  planId: string;
  requestId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  idempotencyKey?: string;
  requestHash?: string;
  taskCount: number;
  reviewTaskCount: number;
  rejectedSourceCount: number;
  captureCount: number;
  incidentCount: number;
  error?: string;
}

export type AnalystLoopResultState =
  | "queued"
  | "metadata_review"
  | "blocked_unsafe_target"
  | "needs_source_activation"
  | "ready";

export type AnalystMetadataReviewStatus =
  | "open"
  | "duplicate"
  | "approval_requested"
  | "escalated"
  | "notified"
  | "closed";

export type AnalystReviewAction =
  | "notify_company"
  | "mark_duplicate"
  | "request_approval"
  | "escalate";

export type AnalystSourceActivationAction =
  | "dry_run_packet"
  | "request_operator_approval"
  | "request_legal_approval"
  | "restore_metadata_only_source"
  | "keep_blocked";

export type AnalystSourceActivationExecution =
  | "dry_run_only"
  | "approval_required"
  | "blocked";

export interface AnalystMetadataReviewTask {
  id: string;
  tenantId?: string;
  planId: string;
  runId?: string;
  taskId?: string;
  sourceId: string;
  captureId?: string;
  status: AnalystMetadataReviewStatus;
  resultState: Extract<AnalystLoopResultState, "metadata_review">;
  company?: string;
  victim?: string;
  affectedAccounts?: string;
  affectedAccountsCount?: number;
  accountSubjects: string[];
  datasetSize?: string;
  datasetSizeBytes?: number;
  actorStatement?: string;
  claimedAt?: string;
  observedAt: string;
  sourceUrl?: string;
  sourceHash: string;
  provenance: Record<string, unknown>;
  allowedActions: AnalystReviewAction[];
  confidence: number;
  unsafeMaterialAccessed: false;
  whatWasNotAccessed: string[];
  duplicateOf?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalystSourceActivationPacket {
  id: string;
  tenantId?: string;
  planId: string;
  runId?: string;
  sourceId?: string;
  action: AnalystSourceActivationAction;
  execution: AnalystSourceActivationExecution;
  reason: string;
  expectedEffect: string;
  rollback: string;
  dryRun: true;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface AnalystVictimNotificationPacket {
  id: string;
  tenantId?: string;
  reviewTaskId: string;
  status: "draft" | "approved" | "sent" | "cancelled";
  company: string;
  victim?: string;
  claimSummary: string;
  affectedAccounts?: string;
  datasetSize?: string;
  actorStatement?: string;
  claimedAt?: string;
  observedAt: string;
  sourceHash: string;
  confidence: number;
  provenance: Record<string, unknown>;
  redactions: string[];
  whatWasNotAccessed: string[];
  safeToSend: boolean;
  approvedBy?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalystClaimLedgerEntry {
  id: string;
  tenantId?: string;
  normalizedQuery: string;
  reviewTaskId?: string;
  captureId?: string;
  sourceId: string;
  claimKind: "leak_claim" | "victim_claim" | "dataset_size_claim" | "affected_accounts_claim" | "actor_statement_claim";
  company?: string;
  victim?: string;
  claimTextSummary: string;
  sourceHash: string;
  confidence: number;
  ledgerStatus: "metadata_review" | "trusted" | "duplicate" | "notified" | "blocked" | "closed";
  observedAt: string;
  provenance: Record<string, unknown>;
  createdAt: string;
}

export interface AnalystLoopSnapshot {
  id: string;
  tenantId?: string;
  planId: string;
  runId?: string;
  normalizedQuery: string;
  resultState: AnalystLoopResultState;
  headline: string;
  queuedTasks: number;
  reviewTasks: number;
  rejectedSources: number;
  blockedUnsafeTargets: number;
  meaningfulWorkCount: number;
  nextSteps: Array<{
    state: AnalystLoopResultState;
    label: string;
    detail: string;
    tone: "ok" | "watch" | "bad";
  }>;
  reviewTaskIds: string[];
  activationPacketIds: string[];
  victimNotificationPacketId?: string;
  capturedAt: string;
}

export interface ApiCaptureDto {
  id: string;
  tenantId?: string;
  sourceId: string;
  taskId?: string;
  url: string;
  canonicalUrl?: string;
  collectedAt: string;
  publishedAt?: string;
  contentHash: string;
  normalizedTextHash?: string;
  mediaType: string;
  storageKind: RawCapture["storageKind"];
  metadata: Record<string, unknown>;
  sensitive: boolean;
  sensitivityFlags?: SensitivityFlag[];
  redaction?: RedactionDecision;
  provenance?: CaptureProvenance;
  retentionClass?: RetentionClass;
  body?: string;
  bodyRedacted: boolean;
}

export type RunResultsInclude = "captures" | "incidents" | "indicators" | "entities" | "relationships";

export interface RunResultsResponse {
  run: CollectionRun;
  results: Partial<Record<RunResultsInclude, unknown>>;
}

export interface ApiPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface ApiErrorBody {
  error: string;
  message?: string;
}

export interface HealthResponse {
  ok: boolean;
  service: "ti-scraper";
  version: ApiVersion;
}

export interface MetricsResponse {
  service: "ti-scraper";
  generatedAt: string;
  sources: {
    total: number;
    active: number;
    degraded: number;
    needsReview: number;
  };
  frontier: {
    queued: number;
    maxPriority: number;
  };
  runs: Record<RunStatus, number>;
  captures: {
    total: number;
    sensitive: number;
  };
  incidents: {
    total: number;
    needsReview: number;
  };
}

export interface FrontierCandidate {
  source: SourceRecord;
  url: string;
  discoveredAt: string;
  tenantId?: string;
  intelRequestId?: string;
  anchorText?: string;
  surroundingText?: string;
  parentTitle?: string;
  parentText?: string;
  destinationTitle?: string;
  destinationText?: string;
  parentUrl?: string;
  parentRelevance?: number;
  destinationRelevance?: number;
  novelty?: number;
  freshness?: number;
  safetyRisk?: number;
  depth?: number;
  budgetKey?: string;
  fairnessKey?: string;
  maxBytes?: number;
}

export interface FrontierScore {
  total: number;
  linkContext: number;
  parentRelevance: number;
  destinationRelevance: number;
  sourceReputation: number;
  novelty: number;
  freshness: number;
  safetyPenalty: number;
  agingBoost: number;
  strategy: FrontierStrategy;
  decision: "enqueue" | "review" | "drop";
  reason: string;
  classifier?: {
    strategy: FrontierStrategy;
    selectedStrategy: string;
    link: {
      score: number;
      confidence: number;
      matchedTerms: string[];
    };
    parent: {
      score: number;
      confidence: number;
      matchedTerms: string[];
    };
    destination: {
      score: number;
      confidence: number;
      matchedTerms: string[];
    };
    weights: {
      link: number;
      parent: number;
      destination: number;
      sourceReputation: number;
      novelty: number;
      freshness: number;
      agingBoost: number;
      safetyPenalty: number;
    };
    coverage: {
      hasLinkContext: boolean;
      hasParentPage: boolean;
      hasDestinationPage: boolean;
    };
    tradeoff: "precision" | "recall" | "balanced" | "efficiency";
  };
}

export interface RawCapture {
  id: string;
  tenantId?: string;
  sourceId: string;
  taskId?: string;
  url: string;
  canonicalUrl?: string;
  collectedAt: string;
  publishedAt?: string;
  contentHash: string;
  normalizedTextHash?: string;
  mediaType: string;
  language?: string;
  storageKind: "inline_text" | "inline_html" | "metadata_only" | "external_object";
  body?: string;
  objectRef?: ObjectStoreRef;
  metadata: Record<string, unknown>;
  sensitive: boolean;
  sensitivityFlags?: SensitivityFlag[];
  redaction?: RedactionDecision;
  provenance?: CaptureProvenance;
  retentionClass?: RetentionClass;
  legalHold?: boolean;
}

export interface CollectedItem {
  sourceId: string;
  taskId?: string;
  url: string;
  collectedAt: string;
  publishedAt?: string;
  title?: string;
  rawText: string;
  html?: string;
  contentHash: string;
  language?: string;
  links: string[];
  metadata: Record<string, unknown>;
  sensitive: boolean;
}

export interface AdapterRunResult {
  items: CollectedItem[];
  discovered: FrontierCandidate[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export interface Indicator {
  type: "ipv4" | "ipv6" | "domain" | "url" | "sha256" | "sha1" | "md5" | "cve";
  value: string;
  rawValue?: string;
  normalizedValue?: string;
  confidence: number;
  provenance?: ExtractionProvenance[];
  reviewReasons?: string[];
}

export interface ExtractedEntity {
  type: "actor" | "victim" | "malware" | "sector" | "country" | "ttp" | "ransomware_family" | "cve";
  value: string;
  rawValue?: string;
  normalizedValue?: string;
  confidence: number;
  provenance?: ExtractionProvenance[];
  reviewReasons?: string[];
  aliases?: string[];
}

export interface ExtractionProvenance {
  sourceId: string;
  captureId: string;
  url: string;
  collectedAt: string;
  contentHash: string;
  extractorVersion: string;
  startOffset?: number;
  endOffset?: number;
  evidenceText?: string;
  ledgerIds?: string[];
}

export type AttackTactic =
  | "reconnaissance"
  | "resource-development"
  | "initial-access"
  | "execution"
  | "persistence"
  | "privilege-escalation"
  | "defense-evasion"
  | "credential-access"
  | "discovery"
  | "lateral-movement"
  | "collection"
  | "command-and-control"
  | "exfiltration"
  | "impact"
  | "unknown";

export interface AttackTechniqueCandidate {
  id: string;
  attackId?: string;
  name: string;
  tactic: AttackTactic;
  confidence: number;
  provenance: ExtractionProvenance[];
  reviewReasons: string[];
}

export type IntelligenceNodeType =
  | "actor"
  | "victim"
  | "malware"
  | "tool"
  | "campaign"
  | "attack-pattern"
  | "indicator"
  | "infrastructure"
  | "vulnerability"
  | "sector"
  | "country"
  | "region"
  | "incident"
  | "source"
  | "capture"
  | "report"
  | "sighting";

export interface IntelligenceGraphNode {
  id: string;
  type: IntelligenceNodeType;
  value: string;
  confidence: number;
  provenance: ExtractionProvenance[];
  properties?: Record<string, unknown>;
}

export type IntelligenceRelationshipType =
  | "alias-of"
  | "attributed-to"
  | "targets"
  | "uses"
  | "indicates"
  | "exploits"
  | "communicates-with"
  | "derived-from"
  | "mentions"
  | "located-in"
  | "active-in"
  | "observed-in"
  | "sighted"
  | "related-to";

export interface IntelligenceRelationship {
  id: string;
  sourceRef: string;
  targetRef: string;
  type: IntelligenceRelationshipType;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  provenance: ExtractionProvenance[];
  properties?: Record<string, unknown>;
}

export interface RelationshipGraph {
  nodes: IntelligenceGraphNode[];
  relationships: IntelligenceRelationship[];
}

export type ActorResultRankKind =
  | "recent-activity"
  | "supported-target"
  | "confident-ttp"
  | "target-sector"
  | "target-region"
  | "malware-tooling"
  | "cve"
  | "emerging-infrastructure"
  | "stale-context"
  | "contested-claim";

export interface ActorResultRankItem {
  kind: ActorResultRankKind;
  nodeId?: string;
  relationshipIds: string[];
  label: string;
  confidence: number;
  supportCount: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  provenanceCount: number;
  stale: boolean;
  contested: boolean;
  reason: string;
}

export interface ActorResultDto {
  actor: IntelligenceGraphNode;
  aliases: string[];
  graph: RelationshipGraph;
  rankings: Record<ActorResultRankKind, ActorResultRankItem[]>;
  generatedAt: string;
  coordination: {
    agent07Grounding: string;
    agent09ApiDto: string;
  };
}

export type ProgressiveEvidenceStage = "discovery" | "captured" | "extracted" | "reviewed" | "promoted";

export type RelationshipDeltaKind = "added" | "updated" | "downgraded" | "contradicted" | "stale" | "promoted";

export type GraphRelationshipReviewState =
  | "unreviewed"
  | "needs_review"
  | "accepted"
  | "rejected"
  | "superseded"
  | "contradicted"
  | "expired";

export type GraphReviewDecisionAction =
  | "request_review"
  | "accept"
  | "reject"
  | "supersede"
  | "mark_contradicted"
  | "resolve_contradiction"
  | "expire"
  | "request_evidence";

export type AnalystGraphWorkflowState =
  | "proposed"
  | "accepted"
  | "rejected"
  | "downgraded"
  | "superseded"
  | "stale"
  | "contradiction"
  | "needs-human-review";

export type GraphCursorRelationshipKind =
  | "actor-target"
  | "actor-ttp"
  | "actor-tool"
  | "actor-malware"
  | "actor-vulnerability"
  | "victim-sector"
  | "victim-country"
  | "incident-source"
  | "indicator-infrastructure"
  | "evidence-provenance";

export interface GraphReviewDecision {
  id: string;
  relationshipId: string;
  action: GraphReviewDecisionAction;
  reviewerId: string;
  reason: string;
  decidedAt: string;
  sourceIds: string[];
  evidenceIds: string[];
  supersedesRelationshipId?: string;
}

export interface GraphReviewAuditEntry {
  decisionId: string;
  relationshipId: string;
  fromState: GraphRelationshipReviewState;
  toState: GraphRelationshipReviewState;
  action: GraphReviewDecisionAction;
  reviewerId: string;
  reason: string;
  decidedAt: string;
  sourceIds: string[];
  evidenceIds: string[];
  supersedesRelationshipId?: string;
}

export interface RelationshipReviewActionAvailability {
  canAccept: boolean;
  canReject: boolean;
  canSupersede: boolean;
  canResolveContradiction: boolean;
  canExpire: boolean;
}

export interface ProgressiveGraphEvidenceNode {
  type: IntelligenceNodeType;
  value: string;
  confidence: number;
  aliases?: string[];
  properties?: Record<string, unknown>;
}

export interface ProgressiveGraphEvidenceRelationship {
  source: ProgressiveGraphEvidenceNode;
  target: ProgressiveGraphEvidenceNode;
  type: IntelligenceRelationshipType;
  confidence: number;
  contradicted?: boolean;
  properties?: Record<string, unknown>;
}

export interface ProgressiveGraphEvidence {
  id: string;
  stage: ProgressiveEvidenceStage;
  observedAt: string;
  sourceId: string;
  captureId?: string;
  ledgerIds?: string[];
  url: string;
  contentHash: string;
  extractorVersion: string;
  relationships: ProgressiveGraphEvidenceRelationship[];
}

export interface RelationshipDelta {
  kind: RelationshipDeltaKind;
  relationship: IntelligenceRelationship;
  previous?: IntelligenceRelationship;
  reason: string;
}

export interface RelationshipStixEligibility {
  discoveryOnly: boolean;
  captureBacked: boolean;
  extracted: boolean;
  reviewed: boolean;
  promoted: boolean;
  accepted: boolean;
  includedByDefault: boolean;
}

export interface RelationshipDeltaDto {
  relationshipId: string;
  kind: RelationshipDeltaKind;
  stage: ProgressiveEvidenceStage;
  confidenceBefore?: number;
  confidenceAfter: number;
  sourceIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  requiresAnalystReview: boolean;
  reviewReasons: string[];
  reviewState: GraphRelationshipReviewState;
  reviewReason?: string;
  reviewActionAvailability: RelationshipReviewActionAvailability;
  stixEligibility: RelationshipStixEligibility;
  rank: number;
  sourceRef: string;
  targetRef: string;
  relationshipType: IntelligenceRelationshipType;
  reason: string;
}

export interface ProgressiveGraphDto {
  stage: ProgressiveEvidenceStage;
  graph: RelationshipGraph;
  deltas: RelationshipDelta[];
  relationshipDeltas: RelationshipDeltaDto[];
  generatedAt: string;
}

export interface GraphEvidenceSupportRecord {
  relationshipId: string;
  sourceId: string;
  captureId: string;
  ledgerIds: string[];
  url: string;
  collectedAt: string;
  contentHash: string;
  extractorVersion: string;
  evidenceText?: string;
}

export interface GraphConfidenceHistoryEntry {
  relationshipId: string;
  confidence: number;
  recordedAt: string;
  reason: string;
}

export interface PersistedGraphNode {
  id: string;
  type: IntelligenceNodeType;
  value: string;
  confidence: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  provenanceCount: number;
  properties?: Record<string, unknown>;
}

export interface PersistedGraphRelationship {
  id: string;
  sourceRef: string;
  targetRef: string;
  type: IntelligenceRelationshipType;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  reviewState: GraphRelationshipReviewState;
  evidenceSupportIds: string[];
  reviewAudit: GraphReviewAuditEntry[];
  confidenceHistory: GraphConfidenceHistoryEntry[];
  exportEligibility: RelationshipStixEligibility;
  properties?: Record<string, unknown>;
}

export interface PersistedGraphSnapshot {
  nodes: PersistedGraphNode[];
  relationships: PersistedGraphRelationship[];
  evidenceSupport: GraphEvidenceSupportRecord[];
  generatedAt: string;
}

export interface GraphNodeViewDto extends PersistedGraphNode {
  degree: number;
}

export interface GraphRelationshipViewDto extends PersistedGraphRelationship {
  source: Pick<PersistedGraphNode, "id" | "type" | "value">;
  target: Pick<PersistedGraphNode, "id" | "type" | "value">;
  workflowState: AnalystGraphWorkflowState;
}

export interface GraphCursorRelationshipDeltaDto {
  cursor: string;
  relationshipId: string;
  relationshipKind: GraphCursorRelationshipKind;
  deltaKind: RelationshipDeltaKind;
  workflowState: AnalystGraphWorkflowState;
  reviewState: GraphRelationshipReviewState;
  confidenceBefore?: number;
  confidenceAfter: number;
  sourceRef: string;
  targetRef: string;
  sourceLabel: string;
  targetLabel: string;
  sourceIds: string[];
  evidenceIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  exportEligible: boolean;
  changedAt: string;
}

export interface GraphNeighborhoodViewDto {
  centerNodeId: string;
  nodes: GraphNodeViewDto[];
  relationships: GraphRelationshipViewDto[];
  generatedAt: string;
}

export interface SourceProvenancePanelDto {
  relationshipId: string;
  support: GraphEvidenceSupportRecord[];
  reviewAudit: GraphReviewAuditEntry[];
}

export interface StixExportPreviewItemDto {
  relationshipId: string;
  relationshipKind: GraphCursorRelationshipKind;
  sourceLabel: string;
  targetLabel: string;
  confidence: number;
  workflowState: AnalystGraphWorkflowState;
  included: boolean;
  reason: string;
}

export interface StixExportPreviewDto {
  generatedAt: string;
  includedCount: number;
  excludedCount: number;
  items: StixExportPreviewItemDto[];
}

export interface CorrelationGraphNodeDto {
  nodeId: string;
  type: IntelligenceNodeType;
  value: string;
  confidence: number;
  degree: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface CorrelationGraphRelationshipDto {
  relationshipId: string;
  relationshipKind: GraphCursorRelationshipKind;
  type: IntelligenceRelationshipType;
  source: Pick<CorrelationGraphNodeDto, "nodeId" | "type" | "value">;
  target: Pick<CorrelationGraphNodeDto, "nodeId" | "type" | "value">;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  provenanceIds: string[];
  sourceIds: string[];
  captureIds: string[];
  contentHashes: string[];
  ledgerIds: string[];
  evidenceIds: string[];
  reviewState: GraphRelationshipReviewState;
  workflowState: AnalystGraphWorkflowState;
  contradiction: boolean;
  sourceFamilyBias: boolean;
  evidenceGapCodes: GraphIntegrityFindingCode[];
  answerCaveats: GraphIntegrityFindingCode[];
  exportReady: boolean;
  exportBlockers: GraphIntegrityFindingCode[];
  exportEligibility: RelationshipStixEligibility;
}

export interface GraphQueryReadinessFacetDto {
  name:
    | "actor_profile"
    | "victim_profile"
    | "campaign_timeline"
    | "attack_matrix"
    | "infrastructure_pivots"
    | "source_family_bias"
    | "evidence_gaps"
    | "stix_bundle"
    | "taxii_collection";
  ready: boolean;
  relationshipIds: string[];
  nodeIds: string[];
  blockerCodes: GraphIntegrityFindingCode[];
  warningCodes: GraphIntegrityFindingCode[];
  summary: string;
}

export type GraphExportCertificationScenarioName =
  | "apt29_actor_profile"
  | "scattered_spider_actor_profile"
  | "akira_victim_profile"
  | "turla_actor_profile"
  | "cve_exploitation"
  | "weak_co_mention"
  | "restricted_only_evidence"
  | "missing_ledger_id"
  | "schema_risk_export"
  | "missing_provenance"
  | "contradicted_relationship"
  | "stale_relationship"
  | "analyst_reviewed_promotion";

export interface GraphExportCertificationScenarioDto {
  name: GraphExportCertificationScenarioName;
  status: "pass" | "warning" | "hold" | "rollback" | "not_applicable";
  query: string;
  relationshipIds: string[];
  nodeIds: string[];
  blockerCodes: GraphIntegrityFindingCode[];
  caveatCodes: GraphIntegrityFindingCode[];
  proofRoutes: Array<"/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "/v1/intel/search.graph" | "/v1/contracts">;
  summary: string;
}

export interface GraphReleaseCandidateGateDto {
  gate: "graph_stix_release_candidate";
  decision: "pass" | "hold" | "rollback";
  requiredScenarios: GraphExportCertificationScenarioName[];
  coveredScenarios: GraphExportCertificationScenarioName[];
  missingScenarios: GraphExportCertificationScenarioName[];
  holdScenarios: GraphExportCertificationScenarioName[];
  rollbackScenarios: GraphExportCertificationScenarioName[];
  publicApiImpact: "allow_graph_answers" | "hold_graph_answers";
  stixImpact: "allow_stix_bundle" | "hold_stix_bundle" | "rollback_stix_bundle";
  taxiiBoundary: "descriptor_only_no_server";
  agent10ReleaseTrain: {
    field: "graphStixReleaseCandidateGate";
    proofRoutes: Array<"/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "/v1/contracts">;
    proofCommands: string[];
    rollbackPath: string;
  };
}

export type GraphLiveSearchUpdateScenarioName =
  | "apt29_clear_web"
  | "apt42_clear_web"
  | "turla_clear_web"
  | "volt_typhoon_public_channel"
  | "scattered_spider_clear_web"
  | "akira_restricted_held"
  | "cve_exploitation"
  | "random_actor_weak_discovery"
  | "weak_co_mention"
  | "public_channel_only_hint"
  | "restricted_held_evidence"
  | "missing_ledger_id"
  | "stale_relationship"
  | "contradicted_relationship"
  | "missing_provenance"
  | "accepted_promotion"
  | "stix_export_eligible";

export interface GraphLiveSearchUpdateScenarioDto {
  name: GraphLiveSearchUpdateScenarioName;
  status: "covered" | "missing" | "held" | "blocked";
  relationshipIds: string[];
  deltaKinds: RelationshipDeltaKind[];
  caveatCodes: GraphIntegrityFindingCode[];
  exportEligibleCount: number;
  summary: string;
}

export type GraphDeltaStreamFixtureName =
  | "clear_web_capture_promotion"
  | "public_channel_hint"
  | "restricted_metadata_held"
  | "claim_ledger_hold"
  | "missing_ledger_id"
  | "weak_co_mention_pivot"
  | "actor_alias_collision"
  | "contradicted_attribution"
  | "stale_ttp"
  | "new_victim_claim"
  | "new_cve_exploitation_claim"
  | "malware_tool_relation"
  | "infrastructure_relation"
  | "analyst_accepted_promotion"
  | "analyst_rejected_relation"
  | "graph_rollback"
  | "stix_export_eligibility_change";

export type GraphDeltaStreamQueryKind =
  | "actor"
  | "random_actor"
  | "made_up_actor"
  | "cve"
  | "malware_tool"
  | "victim_ransomware"
  | "country"
  | "sector";

export interface GraphDeltaStreamFixtureDto {
  name: GraphDeltaStreamFixtureName;
  status: "emitted" | "held" | "blocked" | "eligible" | "missing";
  queryKinds: GraphDeltaStreamQueryKind[];
  relationshipIds: string[];
  deltaKinds: RelationshipDeltaKind[];
  workflowStates: AnalystGraphWorkflowState[];
  reviewStates: GraphRelationshipReviewState[];
  caveatCodes: GraphIntegrityFindingCode[];
  evidenceIds: string[];
  ledgerIds: string[];
  sourceIds: string[];
  exportEligibleCount: number;
  reviewHold: boolean;
  stixImpact: "eligible" | "held" | "blocked";
  publicAnswerImpact: "fact" | "pivot" | "caveat" | "hidden";
  agent06LedgerGate: "complete" | "hold_missing_ledger" | "not_required";
  agent07Caveat: "none" | "weak_discovery" | "public_channel_hint" | "restricted_held" | "stale" | "contradicted" | "missing_provenance" | "rejected";
  agent09CursorState: "pollable";
  agent10ReleaseGate: "pass" | "hold" | "rollback";
  summary: string;
}

export interface GraphDeltaStreamContractDto {
  mode: "real_time_answer_graph_delta_stream";
  responsePolicy: "seconds_level_polling";
  nextPollSeconds: 3;
  cursorField: "graph.deltas[].cursor";
  fixtureCount: number;
  fixtures: GraphDeltaStreamFixtureDto[];
  queryCoverage: GraphDeltaStreamQueryKind[];
  reviewHoldPolicy: "hold_unreviewed_public_channel_restricted_weak_missing_ledger_stale_contradicted_rejected";
  stixEligibilityPolicy: "reviewed_or_promoted_with_provenance_and_ledger";
  rollbackPolicy: "contradicted_rejected_missing_provenance_or_schema_risk_blocks_export";
  taxiiBoundary: "descriptor_only_no_server";
  routeBindings: Array<"/v1/intel/search.graph" | "/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "/v1/contracts">;
}

export interface GraphLiveSearchUpdateDto {
  endpoint: "/v1/intel/search.graph" | "/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "/v1/contracts";
  generatedAt: string;
  mode: "incremental_live_search_graph";
  responsePolicy: "seconds_level_polling";
  nextPollSeconds: 3;
  cursorField: "graph.deltas[].cursor";
  relationshipCount: number;
  deltaCounts: Record<RelationshipDeltaKind, number>;
  scenarioCoverage: GraphLiveSearchUpdateScenarioDto[];
  deltaStream: GraphDeltaStreamContractDto;
  weakDiscoveryPolicy: "pivots_and_caveats_only";
  publicChannelPolicy: "hint_until_corroborated_or_reviewed";
  restrictedEvidencePolicy: "held_context_no_public_fact";
  stixPolicy: "export_only_reviewed_or_promoted_relationships";
  taxiiBoundary: "descriptor_only_no_server";
  agentHandoffs: {
    agent06ClaimLedger: "ledger_ids_required_for_promotion";
    agent07AnswerCaveats: "surface_weak_public_restricted_stale_contradicted_and_missing_provenance";
    agent09ContractIndex: "expose_graph_live_update";
    agent10ReleaseGate: "graph_live_incremental_gate";
  };
  proofRoutes: Array<"/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "/v1/intel/search.graph" | "/v1/contracts">;
}

export interface GraphExportCertificationDto {
  endpoint: "/v1/intel/search.graph" | "/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "/v1/contracts" | "agent10_release_packet";
  generatedAt: string;
  status: "pass" | "warning" | "hold" | "rollback";
  scenarioCount: number;
  passCount: number;
  holdCount: number;
  rollbackCount: number;
  scenarios: GraphExportCertificationScenarioDto[];
  rcGate: GraphReleaseCandidateGateDto;
  noUnsupportedTaxiiServerClaims: boolean;
  releasePacket: {
    owner: "Agent 08";
    proofCommands: [
      "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts src/tests/export.test.ts",
      "bun run check:graph-review-mounted",
      "bun run check:route-inventory"
    ];
    status: "pass" | "warning" | "blocker";
    rollbackPath: string;
  };
}

export type GraphInvestigationWorkspaceReviewAction =
  | "promote"
  | "hold"
  | "reject"
  | "mark_stale"
  | "merge_duplicate"
  | "split_alias_collision"
  | "attach_contradiction"
  | "mark_export_ready";

export interface GraphInvestigationWorkspaceNodeDto {
  nodeId: string;
  type: IntelligenceNodeType;
  value: string;
  confidence: number;
  relationshipIds: string[];
  evidenceIds: string[];
  ledgerIds: string[];
  reviewStates: GraphRelationshipReviewState[];
  exportReadyRelationshipCount: number;
  heldRelationshipCount: number;
}

export interface RelationshipConfidenceLedgerEntryDto {
  relationshipId: string;
  relationshipKind: GraphCursorRelationshipKind;
  type: IntelligenceRelationshipType;
  source: Pick<CorrelationGraphNodeDto, "nodeId" | "type" | "value">;
  target: Pick<CorrelationGraphNodeDto, "nodeId" | "type" | "value">;
  confidence: number;
  confidenceBand: "high" | "medium" | "low";
  whyExists: string[];
  supportingEvidenceIds: string[];
  supportingLedgerIds: string[];
  supportingCaptureIds: string[];
  supportingSourceIds: string[];
  disagreeingSourceIds: string[];
  stale: boolean;
  contradiction: boolean;
  reviewBlocked: boolean;
  reviewState: GraphRelationshipReviewState;
  workflowState: AnalystGraphWorkflowState;
  allowedActions: GraphInvestigationWorkspaceReviewAction[];
  exportEligible: boolean;
  exportBlockers: GraphIntegrityFindingCode[];
  provenanceComplete: boolean;
}

export interface GraphInvestigationWorkspaceDto {
  endpoint: "/v1/graph/query";
  mode: "read_only_investigation_workspace";
  generatedAt: string;
  query: string;
  focusNodeId?: string;
  nodeGroups: Array<{
    type: IntelligenceNodeType;
    nodeIds: string[];
    relationshipIds: string[];
    exportReadyRelationshipCount: number;
    heldRelationshipCount: number;
  }>;
  nodes: GraphInvestigationWorkspaceNodeDto[];
  relationshipConfidenceLedger: RelationshipConfidenceLedgerEntryDto[];
  reviewActions: Array<{
    action: GraphInvestigationWorkspaceReviewAction;
    relationshipIds: string[];
    requiresHumanApproval: boolean;
    reason: string;
  }>;
  deltaPolling: {
    cursorField: "graph.deltas[].cursor";
    nextPollSeconds: 3;
    relationshipDeltaCount: number;
  };
  safety: {
    restrictedMaterialPolicy: "metadata_only_review_hold";
    rawRestrictedMaterialIncluded: false;
    taxiiBoundary: "descriptor_only_no_server";
  };
}

export interface GraphAttackTechniqueTimelineEventDto {
  techniqueNodeId: string;
  attackId?: string;
  techniqueName: string;
  tactic: AttackTactic;
  relationshipIds: string[];
  campaignIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  confidence: number;
  confidenceTrend: "new" | "rising" | "stable" | "falling" | "stale" | "contradicted";
  reviewState: GraphRelationshipReviewState;
  workflowState: AnalystGraphWorkflowState;
  sourceIds: string[];
  evidenceIds: string[];
  ledgerIds: string[];
  exportEligible: boolean;
  exportBlockers: GraphIntegrityFindingCode[];
}

export interface GraphCampaignGraphNodeDto {
  nodeId: string;
  type: Extract<IntelligenceNodeType, "actor" | "campaign" | "attack-pattern" | "malware" | "tool" | "victim" | "infrastructure" | "vulnerability">;
  value: string;
  confidence: number;
  relationshipIds: string[];
  reviewStates: GraphRelationshipReviewState[];
  exportReadyRelationshipCount: number;
  heldRelationshipCount: number;
}

export interface GraphCampaignGraphEdgeDto {
  relationshipId: string;
  type: IntelligenceRelationshipType;
  sourceRef: string;
  targetRef: string;
  confidence: number;
  reviewState: GraphRelationshipReviewState;
  workflowState: AnalystGraphWorkflowState;
  sourceIds: string[];
  ledgerIds: string[];
  exportEligible: boolean;
  exportBlockers: GraphIntegrityFindingCode[];
}

export interface GraphAttackCampaignWorkspaceDto {
  endpoint: "/v1/graph/query";
  mode: "attack_technique_timeline_campaign_graph";
  generatedAt: string;
  query: string;
  focusNodeId?: string;
  techniqueTimeline: GraphAttackTechniqueTimelineEventDto[];
  campaignGraph: {
    nodes: GraphCampaignGraphNodeDto[];
    edges: GraphCampaignGraphEdgeDto[];
    campaignNodeIds: string[];
    actorNodeIds: string[];
    techniqueNodeIds: string[];
  };
  reviewHolds: Array<{
    relationshipId: string;
    reasonCodes: GraphIntegrityFindingCode[];
    allowedActions: GraphInvestigationWorkspaceReviewAction[];
  }>;
  exportEligibility: {
    readyRelationshipIds: string[];
    heldRelationshipIds: string[];
    policy: "reviewed_or_promoted_ttp_campaign_edges_only";
  };
  deltaPolling: {
    cursorField: "graph.deltas[].cursor";
    nextPollSeconds: 3;
    relationshipDeltaCount: number;
  };
  safety: {
    restrictedMaterialPolicy: "metadata_only_review_hold";
    rawRestrictedMaterialIncluded: false;
    taxiiBoundary: "descriptor_only_no_server";
  };
}

export interface CorrelationGraphQueryDto {
  endpoint: "/v1/graph/query";
  generatedAt: string;
  query: string;
  focusNodeId?: string;
  nodes: CorrelationGraphNodeDto[];
  relationships: CorrelationGraphRelationshipDto[];
  investigationWorkspace: GraphInvestigationWorkspaceDto;
  attackCampaignWorkspace: GraphAttackCampaignWorkspaceDto;
  neighborhoods: CorrelationGraphNeighborhoodDto[];
  readinessFacets: GraphQueryReadinessFacetDto[];
  attackMatrix: AttackMatrixCellDto[];
  deltas: GraphCursorRelationshipDeltaDto[];
  exportReadiness: StixExportReadinessReportDto;
  reviewQueue: GraphReviewQueueSummaryDto;
  runtime: GraphRuntimeApiDto;
  certification: GraphExportCertificationDto;
  liveUpdate: GraphLiveSearchUpdateDto;
  provenancePanels: SourceProvenancePanelDto[];
}

export interface CorrelationTimelineEventDto {
  relationshipId: string;
  at: string;
  relationshipKind: GraphCursorRelationshipKind;
  label: string;
  sourceLabel: string;
  targetLabel: string;
  confidence: number;
  reviewState: GraphRelationshipReviewState;
  workflowState: AnalystGraphWorkflowState;
  sourceIds: string[];
  captureIds: string[];
  contentHashes: string[];
  ledgerIds: string[];
  evidenceIds: string[];
  exportReady: boolean;
  exportBlockers: GraphIntegrityFindingCode[];
  exportEligibility: RelationshipStixEligibility;
}

export interface CorrelationGraphNeighborhoodDto {
  name:
    | "actor"
    | "victim"
    | "campaign"
    | "ttp"
    | "malware_tool"
    | "cve"
    | "infrastructure"
    | "sector"
    | "region"
    | "source";
  nodeTypes: IntelligenceNodeType[];
  nodeIds: string[];
  relationshipIds: string[];
  maxConfidence: number;
  reviewStates: GraphRelationshipReviewState[];
  freshness: "current" | "stale" | "mixed" | "unknown";
  exportReadyCount: number;
  exportHoldCount: number;
}

export interface GraphRuntimeRelationshipDto {
  relationshipId: string;
  relationshipKind: GraphCursorRelationshipKind;
  confidence: number;
  ledgerIds: string[];
  reviewState: GraphRelationshipReviewState;
  freshness: "current" | "stale" | "unknown";
  exportReady: boolean;
  exportHolds: GraphIntegrityFindingCode[];
}

export type GraphRepositoryBackendKind = "memory_snapshot" | "postgres_graph_tables" | "neo4j";

export type GraphRepositoryOperationKind =
  | "upsert_node"
  | "upsert_relationship"
  | "append_provenance"
  | "append_review_decision"
  | "append_confidence_history"
  | "record_cursor_delta"
  | "update_export_eligibility";

export interface GraphRepositoryOperationDto {
  kind: GraphRepositoryOperationKind;
  tableOrLabel: string;
  idField: string;
  requiredFields: string[];
  tenantScoped: boolean;
  appendOnly: boolean;
  summary: string;
}

export interface GraphRepositoryReviewWorkflowDto {
  acceptedRelationshipIds: string[];
  rejectedRelationshipIds: string[];
  staleRelationshipIds: string[];
  contradictedRelationshipIds: string[];
  pendingReviewRelationshipIds: string[];
  decisionActions: GraphReviewDecisionAction[];
  auditPersistence: "append_only_review_audit";
}

export interface GraphBackendRepositoryContractDto {
  mode: "backend_neutral_graph_repository_contract";
  backendCandidates: GraphRepositoryBackendKind[];
  tenantScope: "tenant_id_required_on_nodes_edges_provenance_reviews_and_deltas";
  generatedAt: string;
  nodeCount: number;
  relationshipCount: number;
  provenanceCount: number;
  cursorDeltaCount: number;
  operations: GraphRepositoryOperationDto[];
  reviewWorkflow: GraphRepositoryReviewWorkflowDto;
  exportEligibility: {
    readyRelationshipIds: string[];
    heldRelationshipIds: string[];
    policy: "persist_readiness_flags_and_recompute_before_stix_export";
  };
  cursorDeltas: {
    cursorField: "graph.deltas[].cursor";
    relationshipIds: string[];
    latestChangedAt?: string;
  };
  handoffs: {
    agent06ClaimLedger: "persist_ledger_ids_with_provenance_support";
    agent07EntityResolution: "preserve_stable_node_ids_aliases_and_review_states";
    agent09Api: "serve_same_dtos_from_repository_without_route_shape_changes";
    agent10DeploymentGate: "verify_repository_replay_before_graph_export_promotion";
  };
}

export type GraphBackendCutoverRecordKind =
  | IntelligenceNodeType
  | "relationship"
  | "evidence_support"
  | "review_decision"
  | "confidence_history"
  | "cursor_delta"
  | "export_eligibility";

export interface GraphBackendMigrationSchemaDto {
  backend: GraphRepositoryBackendKind;
  schemaName: string;
  recordKinds: GraphBackendCutoverRecordKind[];
  tablesOrLabels: string[];
  requiredIndexes: string[];
  tenantIsolation: "tenant_id_partition_or_label_property_required";
  rollbackUnit: "snapshot_generation";
  summary: string;
}

export interface GraphBackendReplayImportDto {
  source: "agent06_evidence_claim_ledger";
  importOrder: Array<"nodes" | "relationships" | "evidence_support" | "review_audit" | "confidence_history" | "cursor_deltas" | "export_eligibility">;
  replayableRelationshipIds: string[];
  staleRelationshipIds: string[];
  contradictedRelationshipIds: string[];
  reviewHeldRelationshipIds: string[];
  missingLedgerRelationshipIds: string[];
  cursorField: "graph.deltas[].cursor";
  cursorDeltaCount: number;
  latestCursor?: string;
  ledgerCompleteness: "complete" | "hold_missing_ledger_ids";
  restrictedMaterialPolicy: "metadata_only_review_hold";
}

export interface GraphBackendCutoverRehearsalDto {
  mode: "graph_backend_cutover_rehearsal";
  generatedAt: string;
  targetBackends: GraphRepositoryBackendKind[];
  repositoryContract: GraphBackendRepositoryContractDto;
  migrationSchemas: GraphBackendMigrationSchemaDto[];
  replayImport: GraphBackendReplayImportDto;
  verification: {
    tenantScopedRows: boolean;
    cursorContinuity: boolean;
    provenanceComplete: boolean;
    reviewAuditAppendOnly: boolean;
    confidenceHistoryAppendOnly: boolean;
    exportEligibilityRecomputed: boolean;
    noRawRestrictedMaterialSerialized: boolean;
  };
  backupRestore: {
    snapshotId: string;
    backupManifestTables: string[];
    restoreVerification: "replay_snapshot_then_compare_counts_cursors_and_export_eligibility";
    rollbackPath: "restore_last_verified_snapshot_and_hold_graph_exports";
  };
  exportEligibility: {
    readyRelationshipIds: string[];
    heldRelationshipIds: string[];
    weakDiscoveryHeldIds: string[];
    restrictedHeldIds: string[];
    publicChannelHintHeldIds: string[];
    policy: "weak_public_channel_and_restricted_edges_remain_pivots_or_review_holds_until_promoted";
  };
  releasePacket: {
    owner: "Agent 08";
    status: "pass" | "hold" | "rollback";
    proofCommand: "bun test src/tests/graphViews.test.ts";
    agent10Field: "graphBackendCutoverRehearsal";
    rollbackPath: string;
  };
}

export type GraphExportSlaState = "pass" | "warning" | "hold" | "rollback";

export type GraphExportSlaBucket =
  | "export_ready"
  | "held"
  | "review_required"
  | "stale"
  | "contradicted"
  | "missing_provenance"
  | "restricted_only"
  | "weak_co_mention"
  | "source_biased"
  | "unreviewed_victim"
  | "unreviewed_cve"
  | "unreviewed_ttp";

export interface GraphExportSlaBucketDto {
  bucket: GraphExportSlaBucket;
  count: number;
  relationshipIds: string[];
  state: GraphExportSlaState;
}

export interface GraphExportSlaDto {
  endpoint: "/v1/intel/search.graph" | "/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "agent10_release_packet";
  generatedAt: string;
  state: GraphExportSlaState;
  relationshipCount: number;
  readyCount: number;
  heldCount: number;
  reviewRequiredCount: number;
  buckets: GraphExportSlaBucketDto[];
  publicAnswerImpact: "allow_graph_facts" | "hold_graph_facts";
  stixImpact: "publish_ready_relationships" | "hold_blocked_relationships" | "block_export";
  releasePacket: {
    owner: "Agent 08";
    proofCommand: "bun run check:graph-review-mounted";
    status: "pass" | "warning" | "blocker";
    rollbackPath: string;
  };
}

export type GraphExportEnforcementState = "pass" | "warning" | "hold" | "rollback";

export interface GraphExportEnforcementItemDto {
  code: GraphIntegrityFindingCode;
  state: GraphExportEnforcementState;
  relationshipIds: string[];
  dryRunAction: GraphReviewApplyAction;
  publicAnswerEffect: "allow" | "caveat" | "hold" | "remove";
  stixEffect: "allow" | "hold" | "exclude";
  message: string;
}

export interface GraphExportEnforcementDto {
  endpoint: "/v1/intel/search.graph" | "/v1/graph/query" | "/v1/graph/review-plan" | "/v1/exports/stix" | "agent10_release_packet";
  generatedAt: string;
  state: GraphExportEnforcementState;
  holdCount: number;
  warningCount: number;
  rollbackCount: number;
  items: GraphExportEnforcementItemDto[];
  answerCaveats: string[];
  releaseGate: {
    publicAnswers: "allow" | "hold";
    stixPromotion: "allow" | "hold" | "rollback";
    schemaSafe: boolean;
    ledgerComplete: boolean;
  };
  releasePacket: {
    owner: "Agent 08";
    proofCommand: "bun run check:graph-review-mounted";
    status: "pass" | "warning" | "blocker";
    rollbackPath: string;
  };
}

export interface GraphRuntimeApiDto {
  endpoint: "/v1/intel/search.graph" | "/v1/graph/query" | "/v1/exports/stix";
  generatedAt: string;
  relationshipCount: number;
  readyCount: number;
  blockedCount: number;
  publicFactPolicy: GraphReviewQueueSummaryDto["publicFactPolicy"];
  exportSla: GraphExportSlaDto;
  enforcement: GraphExportEnforcementDto;
  certification: GraphExportCertificationDto;
  liveUpdate: GraphLiveSearchUpdateDto;
  backendContract: GraphBackendRepositoryContractDto;
  backendCutover: GraphBackendCutoverRehearsalDto;
  relationships: GraphRuntimeRelationshipDto[];
  reviewQueue: GraphReviewQueueSummaryDto;
}

export interface CorrelationTimelineDto {
  endpoint: "/v1/graph/timeline";
  generatedAt: string;
  query: string;
  events: CorrelationTimelineEventDto[];
}

export interface GraphQueryApiContractDto {
  endpoint: "/v1/graph/query" | "/v1/graph/timeline";
  method: "GET";
  mode: "read_only";
  query: Array<{ name: string; type: string; required: boolean }>;
  sections: Array<{
    name:
      | "actor_neighborhood"
      | "victim_neighborhood"
      | "campaign_neighborhood"
      | "ttp_neighborhood"
      | "malware_tool_neighborhood"
      | "cve_neighborhood"
      | "infrastructure_neighborhood"
      | "sector_neighborhood"
      | "region_neighborhood"
      | "source_neighborhood"
      | "victim_profile"
      | "incident_timeline"
      | "attack_matrix"
      | "relationship_deltas"
      | "export_readiness"
      | "graph_readiness_facets"
      | "stix_preview";
    responsePath: string;
    fields: string[];
  }>;
  edgeFields: string[];
  stixMapping: Stix21MappingContractDto;
}

export interface Stix21MappingContractDto {
  specVersion: "2.1";
  objects: Array<{
    graphType: IntelligenceNodeType | "relationship" | "marking";
    stixType: string;
    idBasis: string;
    fields: string[];
  }>;
  relationships: Array<{
    graphRelationship: IntelligenceRelationshipType;
    stixRelationship: string;
    factGate: string;
  }>;
  markings: Array<{
    name: string;
    usage: string;
  }>;
  externalReferences: string[];
  customProvenanceFields: string[];
  weakEdgePolicy: string;
  confidenceMapping?: {
    inputRange: "0_to_1_graph_confidence";
    stixRange: "0_to_100_integer";
    rounding: "nearest_integer_clamped";
    reviewHoldThreshold: number;
  };
  attackTechniqueHandling?: {
    mitreExternalIdPattern: "T####_optional_subtechnique";
    revokedOrDeprecatedPolicy: "export_only_as_review_metadata_until_replaced";
    requiredExternalReferenceFields: ["source_name", "external_id", "url"];
  };
  hardeningFixtures?: Array<{
    name: string;
    graphRelationship: IntelligenceRelationshipType;
    sourceObject: string;
    targetObject: string;
    expectedStixRelationship: string;
    exportGate: string;
  }>;
  taxiiBoundary?: "descriptor_only_no_server";
}

export type GraphIntegritySeverity = "info" | "warning" | "critical";

export type GraphIntegrityFindingCode =
  | "unsupported_edge"
  | "unsupported_restricted_metadata"
  | "restricted_only_claim"
  | "unreviewed_victim_claim"
  | "unreviewed_cve_exploitation"
  | "unreviewed_ttp_mapping"
  | "missing_ledger_ids"
  | "export_schema_risk"
  | "source_bias_cluster"
  | "weak_discovery_only_edge"
  | "contradicted_edge"
  | "stale_accepted_edge"
  | "orphan_relationship"
  | "missing_provenance"
  | "export_blocking_issue";

export interface GraphIntegrityFindingDto {
  code: GraphIntegrityFindingCode;
  severity: GraphIntegritySeverity;
  relationshipId: string;
  message: string;
  recommendedAction: GraphReviewDecisionAction;
  exportBlocked: boolean;
}

export interface GraphIntegrityReportDto {
  generatedAt: string;
  findings: GraphIntegrityFindingDto[];
  blockingCount: number;
  warningCount: number;
}

export type GraphReviewBatchAction =
  | "accept"
  | "reject"
  | "downgrade"
  | "supersede"
  | "request_evidence"
  | "mark_stale";

export interface GraphReviewBatchItemDto {
  relationshipId: string;
  action: GraphReviewBatchAction;
  priority: number;
  reason: string;
  findingCodes: GraphIntegrityFindingCode[];
  sourceIds: string[];
  evidenceIds: string[];
  confidence: number;
  workflowState: AnalystGraphWorkflowState;
}

export interface GraphReviewBatchDto {
  generatedAt: string;
  items: GraphReviewBatchItemDto[];
}

export interface GraphReviewQueueSummaryDto {
  generatedAt: string;
  total: number;
  exportHoldCount: number;
  humanReviewCount: number;
  automationCandidateCount: number;
  byCode: Array<{ code: GraphIntegrityFindingCode | "unreviewed"; count: number }>;
  byWorkflowState: Array<{ workflowState: AnalystGraphWorkflowState; count: number }>;
  topRelationshipIds: string[];
  publicFactPolicy: "hold_weak_edges" | "ready";
}

export interface StixExportReadinessOptions {
  includeDiscoveryOnly?: boolean;
  minConfidence?: number;
  requireAccepted?: boolean;
}

export interface StixExportReadinessRelationshipDto {
  relationshipId: string;
  ready: boolean;
  blockers: GraphIntegrityFindingCode[];
  confidence: number;
  reviewState: GraphRelationshipReviewState;
  discoveryOnly: boolean;
  provenanceComplete: boolean;
}

export interface StixExportReadinessReportDto {
  generatedAt: string;
  ready: boolean;
  readyCount: number;
  blockedCount: number;
  relationships: StixExportReadinessRelationshipDto[];
  reviewQueue: GraphReviewQueueSummaryDto;
}

export type GraphExportBlockingReasonCode =
  | GraphIntegrityFindingCode
  | "review_queue_open"
  | "no_export_ready_relationships"
  | "provenance_incomplete"
  | "contradictory_or_stale_edges";

export interface GraphCutoverPromotionBlockerDto {
  code: GraphExportBlockingReasonCode;
  severity: GraphIntegritySeverity;
  count: number;
  message: string;
}

export interface GraphReadinessSectionDto {
  name:
    | "actor_profile"
    | "victim_profile"
    | "incident_timeline"
    | "attack_matrix"
    | "graph_neighborhood"
    | "provenance_panel"
    | "stix_export_preview";
  ready: boolean;
  itemCount: number;
  blockerCodes: GraphExportBlockingReasonCode[];
}

export interface GraphCutoverReportDto {
  generatedAt: string;
  ready: boolean;
  integrity: GraphIntegrityReportDto;
  exportReadiness: StixExportReadinessReportDto;
  reviewBatch: GraphReviewBatchDto;
  stixExportPreview: StixExportPreviewDto;
  sections: GraphReadinessSectionDto[];
  promotionBlockers: GraphCutoverPromotionBlockerDto[];
  counts: {
    relationships: number;
    exportReady: number;
    reviewQueue: number;
    contradicted: number;
    stale: number;
    weakDiscoveryOnly: number;
    sourceBiasClusters: number;
    unsupportedRestrictedMetadata: number;
    provenanceIncomplete: number;
  };
}

export type GraphReviewApplyAction =
  | "accept_edge"
  | "reject_edge"
  | "downgrade_edge"
  | "supersede_edge"
  | "request_evidence"
  | "mark_stale"
  | "expire_edge"
  | "hold_edge"
  | "block_export";

export type GraphReviewApplySafety = "automation_safe" | "human_approval_required" | "blocked" | "rollback_only";

export interface GraphReviewApplyPlanItemDto {
  relationshipId: string;
  action: GraphReviewApplyAction;
  safety: GraphReviewApplySafety;
  preconditions: string[];
  evidenceIds: string[];
  confidenceImpact: {
    before: number;
    after: number;
    reason: string;
  };
  exportImpact: {
    beforeEligible: boolean;
    afterEligible: boolean;
    blockedReasonCodes: GraphExportBlockingReasonCode[];
  };
  auditNotes: string[];
  rollbackNotes: string[];
  source: "graph_integrity" | "search_quality" | "api_request" | "system_cutover";
}

export interface GraphReviewApplyPlanDto {
  generatedAt: string;
  dryRun: true;
  items: GraphReviewApplyPlanItemDto[];
  automationSafeCount: number;
  humanApprovalRequiredCount: number;
  blockedCount: number;
}

export interface GraphReviewPlanApiDto {
  endpoint: "/v1/graph/review-plan";
  generatedAt: string;
  dryRun: true;
  status: "ready" | "needs_review" | "blocked";
  summary: {
    total: number;
    automationSafe: number;
    humanApprovalRequired: number;
    blocked: number;
  };
  reviewQueue: GraphReviewQueueSummaryDto;
  exportSla: GraphExportSlaDto;
  enforcement: GraphExportEnforcementDto;
  certification: GraphExportCertificationDto;
  actions: GraphReviewApplyPlanItemDto[];
}

export interface GraphCutoverReportApiDto {
  endpoint: "/v1/graph/cutover-report";
  generatedAt: string;
  ready: boolean;
  sections: GraphReadinessSectionDto[];
  promotionBlockers: GraphCutoverPromotionBlockerDto[];
  counts: GraphCutoverReportDto["counts"];
}

export interface StixExportReadinessApiDto {
  endpoint: "/v1/exports/stix";
  generatedAt: string;
  ready: boolean;
  readyCount: number;
  blockedCount: number;
  relationships: StixExportReadinessRelationshipDto[];
  reviewQueue: GraphReviewQueueSummaryDto;
  reviewActions: GraphReviewApplyPlanItemDto[];
  runtime: GraphRuntimeApiDto;
  exportSla: GraphExportSlaDto;
  enforcement: GraphExportEnforcementDto;
  certification: GraphExportCertificationDto;
  preview: StixExportPreviewDto;
  taxiiCollections: TaxiiCollectionDescriptor[];
}

export interface GraphReviewApiExamplesDto {
  reviewPlan: GraphReviewPlanApiDto;
  cutoverReport: GraphCutoverReportApiDto;
  stixReadiness: StixExportReadinessApiDto;
  actionExamples: Record<GraphReviewApplyAction | "discovery_only_manual_review_required", GraphReviewApplyPlanItemDto>;
}

export interface AttackMatrixCellDto {
  tactic: AttackTactic;
  techniques: Array<{
    nodeId: string;
    name: string;
    relationshipIds: string[];
    confidence: number;
    reviewState: GraphRelationshipReviewState;
  }>;
}

export interface ActorProfileGraphViewDto {
  actor: GraphNodeViewDto;
  aliases: string[];
  neighborhood: GraphNeighborhoodViewDto;
  attackMatrix: AttackMatrixCellDto[];
  provenancePanels: SourceProvenancePanelDto[];
  generatedAt: string;
}

export interface VictimProfileGraphViewDto {
  victim: GraphNodeViewDto;
  targetedBy: GraphRelationshipViewDto[];
  sectors: GraphRelationshipViewDto[];
  regions: GraphRelationshipViewDto[];
  provenancePanels: SourceProvenancePanelDto[];
  generatedAt: string;
}

export interface IncidentTimelineEventDto {
  relationshipId: string;
  at: string;
  label: string;
  confidence: number;
  reviewState: GraphRelationshipReviewState;
  sourceIds: string[];
}

export interface IncidentTimelineViewDto {
  events: IncidentTimelineEventDto[];
  generatedAt: string;
}

export interface StixExternalReference {
  source_name: string;
  url?: string;
  external_id?: string;
  description?: string;
  hashes?: Record<string, string>;
}

export interface StixObject {
  type: string;
  spec_version?: "2.1";
  id: string;
  created?: string;
  modified?: string;
  name?: string;
  description?: string;
  confidence?: number;
  labels?: string[];
  aliases?: string[];
  external_references?: StixExternalReference[];
  object_marking_refs?: string[];
  object_refs?: string[];
  definition_type?: string;
  definition?: Record<string, unknown>;
  source_ref?: string;
  target_ref?: string;
  relationship_type?: string;
  pattern?: string;
  pattern_type?: string;
  valid_from?: string;
  first_seen?: string;
  last_seen?: string;
  first_observed?: string;
  last_observed?: string;
  number_observed?: number;
  revoked?: boolean;
  x_ti_provenance?: ExtractionProvenance[];
  x_ti_review_reasons?: string[];
  [key: `x_${string}`]: unknown;
}

export interface StixBundle {
  type: "bundle";
  id: string;
  objects: StixObject[];
}

export interface StixExportOptions {
  producerName: string;
  generatedAt: string;
  tenantId?: string;
  includeDiscoveryEvidence?: boolean;
  includeUnreviewedDiscoveryContext?: boolean;
}

export interface TaxiiCollectionDescriptor {
  id: string;
  title: string;
  description?: string;
  canRead: boolean;
  canWrite: boolean;
  mediaTypes: string[];
  readiness?: {
    status: "ready" | "hold" | "rollback";
    readyCount: number;
    blockedCount: number;
    nextCursor?: string;
    note: string;
  };
}

export interface TaxiiExportRequest {
  collectionId: string;
  addedAfter?: string;
  limit?: number;
  next?: string;
}

export interface TaxiiExportPage {
  collectionId: string;
  objects: StixObject[];
  more: boolean;
  next?: string;
}

export interface IncidentCandidate {
  id: string;
  sourceId: string;
  captureId?: string;
  extractorVersion: string;
  title: string;
  summary: string;
  firstSeenAt: string;
  confidence: number;
  entities: ExtractedEntity[];
  indicators: Indicator[];
  reviewReasons: string[];
  reviewReasonDetails?: ExtractionReviewReason[];
}

export interface ExtractionReviewReason {
  reason: string;
  extractorVersion: string;
  provenance?: ExtractionProvenance[];
}

export interface PipelineResult {
  capture: RawCapture;
  incident?: IncidentCandidate;
  indicators: Indicator[];
  entities: ExtractedEntity[];
}

export interface ReplayPipelineInput {
  captureId: string;
  sourceId: string;
  url: string;
  collectedAt: string;
  mediaType: string;
  storageKind: RawCapture["storageKind"];
  body?: string;
  objectRef?: ObjectStoreRef;
  metadata: Record<string, unknown>;
  contentHash: string;
  normalizedTextHash?: string;
  extractorVersion: string;
}

export type DiscoveryEvidenceProvider =
  | "search_provider"
  | "public_channel"
  | "darknet_metadata"
  | "api_proxy"
  | "scraper";

export type DiscoveryEvidenceType =
  | "search_snippet"
  | "public_channel_snippet"
  | "metadata_only_leak_claim"
  | "source_activation_gap"
  | "cached_result";

export interface DiscoveryEvidence {
  id: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  provider: DiscoveryEvidenceProvider;
  evidenceType: DiscoveryEvidenceType;
  resultId: string;
  observedAt: string;
  title?: string;
  snippet: string;
  url?: string;
  sourceId?: string;
  rank?: number;
  confidence: number;
  metadata: Record<string, unknown>;
  retentionClass: RetentionClass;
  staleAt?: string;
  promotedToTaskId?: string;
  promotedToCaptureId?: string;
  promotedToIncidentId?: string;
}

export interface DiscoveryPromotion {
  discoveryEvidenceId: string;
  taskId?: string;
  captureId?: string;
  incidentId?: string;
  promotedAt: string;
  promotedBy: "planner" | "collector" | "pipeline" | "manual";
}

export interface LiveSearchSnapshot {
  id: string;
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  runId?: string;
  status: "searching" | "partial" | "ready" | "degraded" | "blocked" | "disabled";
  capturedAt: string;
  discoveryEvidenceIds: string[];
  captureIds: string[];
  incidentIds: string[];
  newEvidenceIds: string[];
  deltaCursors?: string[];
  staleAt?: string;
  metadata: Record<string, unknown>;
  retentionClass: RetentionClass;
}

export type EvidenceDeltaKind =
  | "added"
  | "updated"
  | "promoted"
  | "redacted"
  | "expired"
  | "blocked"
  | "downgraded"
  | "contradicted";

export type EvidenceDeltaSubjectType =
  | "live_snapshot"
  | "discovery_evidence"
  | "capture"
  | "extraction"
  | "relationship"
  | "policy_event";

export interface EvidenceDeltaCursor {
  cursor: string;
  observedAt: string;
  deltaId: string;
}

export interface EvidenceDelta {
  id: string;
  tenantId?: string;
  query?: string;
  normalizedQuery?: string;
  runId?: string;
  cursor: string;
  kind: EvidenceDeltaKind;
  subjectType: EvidenceDeltaSubjectType;
  subjectId: string;
  observedAt: string;
  sourceId?: string;
  discoveryEvidenceIds: string[];
  captureIds: string[];
  incidentIds: string[];
  relationshipIds: string[];
  policyEventIds: string[];
  retentionClass: RetentionClass;
  staleAt?: string;
  metadata: Record<string, unknown>;
}

export interface EvidenceBackupIntegrityReport {
  tenantId?: string;
  generatedAt: string;
  expectedObjectCount: number;
  verifiedObjectCount: number;
  missingObjectIds: string[];
  hashMismatches: Array<{
    captureId: string;
    expectedSha256: string;
    actualSha256?: string;
  }>;
  orphanRows: Array<{
    table: string;
    id: string;
    reason: string;
  }>;
  retentionExpiryCounts: Partial<Record<RetentionClass, number>>;
  rollbackNotes: string[];
}

export type EvidenceCutoverGateStatus = "ready" | "hold" | "blocked";

export interface EvidenceReplayProofStep {
  stage: "discovery" | "capture" | "extraction" | "relationship_delta" | "api_cursor";
  id: string;
  cursor?: string;
  ok: boolean;
  detail: string;
}

export interface EvidenceReplayProof {
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  runId?: string;
  startedCursor?: string;
  nextCursor?: string;
  steps: EvidenceReplayProofStep[];
  replayable: boolean;
}

export interface EvidenceCutoverRehearsalReport {
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  generatedAt: string;
  readiness: {
    agent09: EvidenceCutoverGateStatus;
    agent10: EvidenceCutoverGateStatus;
    overall: EvidenceCutoverGateStatus;
  };
  counts: {
    discoveryEvidence: number;
    captures: number;
    snapshots: number;
    deltas: number;
    missingObjects: number;
    orphanRows: number;
    redactedCaptures: number;
    expiredDeltas: number;
    exportBlockers: number;
    staleSnapshots: number;
  };
  reconciliation: {
    promotedDiscovery: number;
    unpromotedDiscovery: number;
    capturesWithoutDiscovery: string[];
    relationshipDeltaIds: string[];
  };
  objectIntegrity: EvidenceBackupIntegrityReport;
  cursorReplay: EvidenceReplayProof;
  retentionState: {
    expiryCounts: Partial<Record<RetentionClass, number>>;
    legalHoldCount: number;
    expiredDeltaIds: string[];
  };
  redactionState: {
    metadataOnlyCaptureIds: string[];
    restrictedCaptureIds: string[];
    unsafeBodyCaptureIds: string[];
  };
  exportBlockers: Array<{
    id: string;
    reason: string;
  }>;
  promotionGate: {
    gate: EvidenceCutoverGateStatus;
    blockers: string[];
    agent09Fields: {
      cursorReplayReady: boolean;
      nextCursor?: string;
      staleSnapshots: number;
      newEvidenceCount: number;
    };
    agent10Fields: {
      objectIntegrityReady: boolean;
      backupVerifiedObjects: number;
      missingObjectCount: number;
      rollbackNotes: string[];
    };
  };
}

export type EvidenceTrustStatus = "trusted" | "degraded" | "blocked";

export interface EvidenceTrustLedgerClaim {
  claimId: string;
  ledgerIds: string[];
  captureId: string;
  sourceId: string;
  url: string;
  collectedAt: string;
  contentHash: string;
  extractorVersion?: string;
  evidenceStage?: string;
  confidence: number;
  graphRelationshipIds: string[];
  reviewState?: string;
  retentionClass?: RetentionClass;
  redaction: {
    policy?: RedactionDecision["policy"];
    applied: boolean;
    metadataOnly: boolean;
    legalHold: boolean;
  };
  trustStatus: EvidenceTrustStatus;
  blockers: string[];
  claimValues: string[];
  replay: {
    replayable: boolean;
    nextCursor?: string;
  };
  provenance: {
    sourcePresent: boolean;
    capturePresent: boolean;
    contentHashPresent: boolean;
    extractorVersionPresent: boolean;
    confidencePresent: boolean;
  };
}

export interface EvidenceTrustLedgerReport {
  tenantId?: string;
  query: string;
  normalizedQuery: string;
  generatedAt: string;
  readiness: EvidenceCutoverRehearsalReport["readiness"];
  trustGate: EvidenceCutoverGateStatus;
  blockers: string[];
  counts: {
    claims: number;
    trusted: number;
    degraded: number;
    blocked: number;
    metadataOnlyClaims: number;
    duplicateClaimsSuppressed: number;
    replayable: boolean;
  };
  changesSinceCursor: {
    sinceCursor?: string;
    nextCursor?: string;
    added: number;
    promoted: number;
    downgraded: number;
    expired: number;
    redacted: number;
    blocked: number;
    contradicted: number;
    reviewRequired: number;
    missingObjectCaptureIds: string[];
    graphExportHeldRelationshipIds: string[];
  };
  claims: EvidenceTrustLedgerClaim[];
  cutover: {
    promotionGate: EvidenceCutoverRehearsalReport["promotionGate"];
    objectIntegrity: EvidenceBackupIntegrityReport;
    redactionState: EvidenceCutoverRehearsalReport["redactionState"];
  };
  safeOutput: {
    sensitiveBodiesExposed: false;
    objectKeysExposed: false;
    unsafeRestrictedMetadataExposed: false;
  };
}

export type CaptureReplayStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";

export interface CaptureReplayJob {
  id: string;
  tenantId?: string;
  captureId: string;
  sourceId: string;
  requestedAt: string;
  fromExtractorVersion?: string;
  toExtractorVersion: string;
  status: CaptureReplayStatus;
  startedAt?: string;
  completedAt?: string;
  incidentId?: string;
  indicatorCount?: number;
  entityCount?: number;
  runId?: string;
  diffSummary?: ReplayDiffSummary;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface ReplayDiffSummary {
  incidentChanged: boolean;
  indicatorDelta: number;
  entityDelta: number;
  newReviewReasons: string[];
}

export type RetentionAction = "retain" | "delete_body" | "delete_object" | "delete_capture_metadata" | "legal_hold";

export interface RetentionPolicy {
  retentionClass: RetentionClass;
  ttlDays?: number;
  action: RetentionAction;
  preserveMetadata: boolean;
  preserveHashes: boolean;
}

export interface RetentionJob {
  id: string;
  tenantId?: string;
  retentionClass: RetentionClass;
  action: RetentionAction;
  scheduledAt: string;
  cutoffCollectedAt?: string;
  status: "queued" | "running" | "completed" | "failed";
  affectedCaptureIds: string[];
  completedAt?: string;
  error?: string;
}

export interface SafeCaptureDto {
  id: string;
  tenantId?: string;
  sourceId: string;
  taskId?: string;
  url: string;
  canonicalUrl?: string;
  collectedAt: string;
  publishedAt?: string;
  contentHash: string;
  normalizedTextHash?: string;
  mediaType: string;
  storageKind: RawCapture["storageKind"];
  metadata: Record<string, unknown>;
  sensitive: boolean;
  sensitivityFlags: SensitivityFlag[];
  redaction?: RedactionDecision;
  retentionClass: RetentionClass;
  provenance?: CaptureProvenance;
  objectRef?: Omit<ObjectStoreRef, "key"> & { keyRedacted: true };
  body?: string;
  bodyRedacted: boolean;
  redactionReason?: string;
}

export interface EvidenceQueryScope {
  tenantId?: string;
  actor?: string;
  sourceId?: string;
  captureId?: string;
  claimId?: string;
  limit?: number;
}

export interface EvidenceQueryHelpers {
  latestCaptures(scope: EvidenceQueryScope): RawCapture[];
  provenanceForClaim(scope: EvidenceQueryScope): EvidenceProvenanceChain[];
  provenanceChainByResultId(resultId: string, scope?: EvidenceQueryScope): EvidenceProvenanceChain[];
  dedupeGroups(scope?: EvidenceQueryScope): EvidenceDedupeGroup[];
  replayStatus(scope?: EvidenceQueryScope): CaptureReplayJob[];
  sourceFreshness(scope?: EvidenceQueryScope): SourceFreshnessSummary[];
  redactionSummaries(scope?: EvidenceQueryScope): EvidenceRedactionSummary[];
  captureCounts(scope?: EvidenceQueryScope): EvidenceCaptureCounts;
  extractionVersions(scope?: EvidenceQueryScope): EvidenceExtractorVersionSummary[];
  liveSnapshotsByQuery(query: string, scope?: EvidenceQueryScope): LiveSearchSnapshot[];
  getSearchDeltas(query: string, sinceCursor?: string, scope?: EvidenceQueryScope): EvidenceDelta[];
  activeRunEvidence(runId: string, scope?: EvidenceQueryScope): LiveSearchEvidenceView;
  getActiveRunEvidence(runId: string, sinceCursor?: string, scope?: EvidenceQueryScope): LiveSearchEvidenceView;
  newlyAvailableEvidenceSince(since: string, scope?: EvidenceQueryScope): LiveSearchEvidenceView;
  getEvidenceTimeline(query: string, scope?: EvidenceQueryScope): EvidenceDelta[];
  pruneStaleSnapshots(now: string, scope?: EvidenceQueryScope): LiveSearchSnapshot[];
}

export interface EvidenceProvenanceChain {
  tenantId?: string;
  sourceId: string;
  taskId?: string;
  captureId: string;
  incidentId?: string;
  extractorVersion?: string;
  collectedAt: string;
  contentHash: string;
  url: string;
  confidence?: number;
  claimValues: string[];
}

export interface EvidenceDedupeGroup {
  key: string;
  captureIds: string[];
  sourceIds: string[];
  canonicalUrls: string[];
  contentHashes: string[];
  normalizedTextHash?: string;
  tenantId?: string;
}

export interface SourceFreshnessSummary {
  sourceId: string;
  tenantId?: string;
  latestCollectedAt?: string;
  captureCount: number;
  latestCaptureId?: string;
}

export interface EvidenceRedactionSummary {
  captureId: string;
  tenantId?: string;
  sourceId: string;
  sensitive: boolean;
  storageKind: RawCapture["storageKind"];
  retentionClass: RetentionClass;
  legalHold: boolean;
  bodyAvailableToApi: boolean;
  redactionPolicy?: RedactionDecision["policy"];
  reason?: string;
}

export interface EvidenceCaptureCounts {
  total: number;
  byRetentionClass: Record<string, number>;
  sensitive: number;
  legalHold: number;
}

export interface EvidenceExtractorVersionSummary {
  extractorVersion: string;
  captureCount: number;
  incidentCount: number;
  latestCollectedAt?: string;
}

export interface LiveSearchEvidenceView {
  discoveryEvidence: DiscoveryEvidence[];
  captures: RawCapture[];
  incidents: IncidentCandidate[];
  snapshots: LiveSearchSnapshot[];
  deltas?: EvidenceDelta[];
  nextCursor?: string;
}
