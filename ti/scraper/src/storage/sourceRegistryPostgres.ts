import type {
  SourceCatalogMetadata,
  SourceCrawlState,
  SourceGovernance,
  SourceHealth,
  SourceLifecycleEvent,
  SourceRecord,
  SourceScoringInputs
} from "../types.ts";
import type {
  TiSourceAtlasExportManifestApiResponse,
  TiSourceAtlasExportManifestRow,
  TiSourceAtlasProductSourceLadderPacket,
  TiSourceAtlasRecord,
  TiSourceAtlasReviewQueueRow
} from "../registry/sourceSeedTypes.ts";

type JsonObject = Record<string, unknown>;

export interface SourceRegistrySourceRow {
  id: string;
  tenant_id?: string;
  name: string;
  type: SourceRecord["type"];
  url: string;
  access_method: SourceRecord["accessMethod"];
  status: SourceRecord["status"];
  risk: SourceRecord["risk"];
  trust_score: number;
  language?: string;
  crawl_frequency_seconds: number;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  metadata: JsonObject;
}

export interface SourceRegistryGovernanceRow {
  source_id: string;
  approval_required: boolean;
  approval_state: SourceGovernance["approvalState"];
  metadata_only: boolean;
  approved_at?: string;
  approved_by?: string;
  approval_expires_at?: string;
  review_ticket?: string;
  policy_version: string;
  risk_justification?: string;
  legal_contact?: string;
  created_at: string;
  updated_at: string;
}

export interface SourceRegistryLegalNoteRow {
  id: string;
  source_id: string;
  note: string;
  note_kind: "collection_basis";
  created_at: string;
  created_by?: string;
  superseded_at?: string;
  superseded_by?: string;
}

export interface SourceRegistryHealthRow {
  source_id: string;
  status: SourceHealth["status"];
  checked_at?: string;
  last_success_at?: string;
  last_failure_at?: string;
  consecutive_failures: number;
  error_rate: number;
  median_latency_ms?: number;
  last_error?: string;
  updated_at: string;
}

export interface SourceRegistryScoringInputsRow {
  source_id: string;
  reliability: number;
  freshness: number;
  relevance: number;
  uniqueness: number;
  parseability: number;
  policy_risk_penalty: number;
  operator_boost: number;
  updated_at: string;
}

export interface SourceRegistryCrawlStateRow {
  source_id: string;
  last_scheduled_at?: string;
  next_eligible_at?: string;
  last_collected_at?: string;
  etag?: string;
  last_modified?: string;
  cursor_value?: string;
  backoff_until?: string;
  retry_count: number;
  updated_at: string;
}

export interface SourceRegistryLifecycleEventRow {
  source_id: string;
  occurred_at: string;
  from_status?: SourceRecord["status"];
  to_status: SourceRecord["status"];
  reason: SourceLifecycleEvent["reason"];
  actor_id?: string;
  note?: string;
}

export interface SourceAtlasRecordRow {
  atlas_source_id: string;
  tenant_id?: string;
  url: string;
  domain: string;
  feed_url?: string;
  source_name: string;
  family: TiSourceAtlasRecord["family"];
  discovery_method: TiSourceAtlasRecord["discoveryMethod"];
  query_class_coverage: TiSourceAtlasRecord["queryClassCoverage"];
  language: string;
  regions: string[];
  sectors: string[];
  reliability: number;
  freshness: number;
  evidence_yield: number;
  uniqueness: number;
  downstream_public_answer_impact: number;
  source_value_score: number;
  parser_profile: TiSourceAtlasRecord["parserCapability"]["profile"];
  parser_certified: boolean;
  parser_certification_required: boolean;
  legal_review: TiSourceAtlasRecord["legalRobotsState"]["legalReview"];
  robots_review: TiSourceAtlasRecord["legalRobotsState"]["robotsReview"];
  legal_robots_notes: string[];
  duplicate_of?: string;
  mirror_of?: string;
  content_similarity: number;
  duplicate_suppressed: boolean;
  scheduler_budget_class: TiSourceAtlasRecord["schedulerEstimate"]["budgetClass"];
  cadence_seconds: number;
  estimated_daily_tasks: number;
  expected_items_per_day: number;
  storage_mb_per_day: number;
  retention_class: SourceCatalogMetadata["retentionClass"];
  activation_state: TiSourceAtlasRecord["activationReadiness"]["state"];
  activation_reasons: string[];
  approval_required: true;
  auto_activation_allowed: false;
  public_only: true;
  private_invite_auth_captcha: false;
  raw_payload_target: false;
  auto_activate: false;
  generated_at: string;
}

export interface SourceAtlasReviewQueuePostgresRow {
  review_id: string;
  atlas_source_id: string;
  tenant_id?: string;
  source_name: string;
  family: TiSourceAtlasReviewQueueRow["family"];
  domain: string;
  source_hash: string;
  decision: TiSourceAtlasReviewQueueRow["decision"];
  reasons: string[];
  approval_route: TiSourceAtlasReviewQueueRow["approvalRoute"];
  parser_owner: TiSourceAtlasReviewQueueRow["parserOwner"];
  scheduler_owner: TiSourceAtlasReviewQueueRow["schedulerOwner"];
  quality_owner: TiSourceAtlasReviewQueueRow["qualityOwner"];
  release_owner: TiSourceAtlasReviewQueueRow["releaseOwner"];
  dry_run: true;
  will_mutate: false;
  will_start_crawling: false;
  generated_at: string;
}

export interface SourceAtlasExportManifestPostgresRow {
  atlas_source_id: string;
  tenant_id?: string;
  source_hash: string;
  source_name: string;
  url: string;
  domain: string;
  family: TiSourceAtlasExportManifestRow["family"];
  query_class_coverage: TiSourceAtlasExportManifestRow["queryClassCoverage"];
  source_value_score: number;
  parser_profile: TiSourceAtlasExportManifestRow["parserProfile"];
  scheduler_cadence_seconds: number;
  expected_items_per_day: number;
  legal_review: TiSourceAtlasExportManifestRow["legalReview"];
  robots_review: TiSourceAtlasExportManifestRow["robotsReview"];
  approval_required: true;
  auto_activation_allowed: false;
  manifest_schema_version: "ti.source_atlas_export.v1";
  requested_plan: TiSourceAtlasExportManifestApiResponse["requestedPlan"];
  generated_at: string;
}

export interface SourceAtlasActivationPacketAuditRow {
  packet_id: string;
  tenant_id?: string;
  priority: TiSourceAtlasPayworthyRepairActivationPacket["priority"];
  approval_mode: TiSourceAtlasPayworthyRepairActivationPacket["approvalMode"];
  action: TiSourceAtlasPayworthyRepairActivationPacket["action"];
  repair_decision: TiSourceAtlasPayworthyRepairActivationPacket["repairDecision"];
  blocker: TiSourceAtlasPayworthyRepairActivationPacket["blocker"];
  atlas_source_ids: string[];
  replacement_candidate_ids: string[];
  source_families: TiSourceAtlasPayworthyRepairActivationPacket["sourceFamilies"];
  expected_payworthy_lift: number;
  expected_fresh_rows_per_day: number;
  expected_row_lift: number;
  buyer_visible_reason: string;
  prerequisites: TiSourceAtlasPayworthyRepairActivationPacket["prerequisites"];
  route_hints: string[];
  forbidden_actions: TiSourceAtlasPayworthyRepairActivationPacket["forbiddenActions"];
  dry_run: true;
  will_mutate: false;
  will_start_crawling: false;
  raw_url_exposed: false;
  raw_payload_exposed: false;
  private_auth_captcha_required: false;
  crawl_started: false;
  source_activation_applied: false;
  generated_at: string;
}

export interface SourceRegistryPostgresRows {
  sources: SourceRegistrySourceRow[];
  source_governance: SourceRegistryGovernanceRow[];
  source_legal_notes: SourceRegistryLegalNoteRow[];
  source_health: SourceRegistryHealthRow[];
  source_scoring_inputs: SourceRegistryScoringInputsRow[];
  source_crawl_state: SourceRegistryCrawlStateRow[];
  source_lifecycle_events: SourceRegistryLifecycleEventRow[];
}

export interface SourceAtlasPostgresRows {
  source_atlas_records: SourceAtlasRecordRow[];
  source_atlas_review_queue: SourceAtlasReviewQueuePostgresRow[];
  source_atlas_export_manifest: SourceAtlasExportManifestPostgresRow[];
  source_atlas_activation_packet_audit: SourceAtlasActivationPacketAuditRow[];
}

type TiSourceAtlasPayworthyRepairActivationPacket =
  TiSourceAtlasProductSourceLadderPacket["paidSourceTierPlan"]["payworthyRepairQueue"]["sourceActivationPacketInputs"]["packets"][number];

export function sourceRecordToPostgresRows(source: SourceRecord): SourceRegistryPostgresRows {
  return {
    sources: [sourceRecordToSourceRow(source)],
    source_governance: [sourceRecordToGovernanceRow(source)],
    source_legal_notes: [sourceRecordToLegalNoteRow(source)],
    source_health: source.health ? [sourceHealthToRow(source.id, source.updatedAt, source.health)] : [],
    source_scoring_inputs: source.scoring ? [sourceScoringInputsToRow(source.id, source.updatedAt, source.scoring)] : [],
    source_crawl_state: source.crawlState ? [sourceCrawlStateToRow(source.id, source.updatedAt, source.crawlState)] : [],
    source_lifecycle_events: (source.lifecycle ?? []).map((event) => sourceLifecycleEventToRow(source.id, event))
  };
}

export function sourceRecordFromPostgresRows(input: {
  source: SourceRegistrySourceRow;
  governance?: SourceRegistryGovernanceRow;
  legalNotes?: SourceRegistryLegalNoteRow[];
  health?: SourceRegistryHealthRow;
  scoring?: SourceRegistryScoringInputsRow;
  crawlState?: SourceRegistryCrawlStateRow;
  lifecycle?: SourceRegistryLifecycleEventRow[];
}): SourceRecord {
  const governance = input.governance ? governanceFromRow(input.governance) : undefined;
  return {
    id: input.source.id,
    tenantId: input.source.tenant_id,
    name: input.source.name,
    type: input.source.type,
    url: input.source.url,
    accessMethod: input.source.access_method,
    status: input.source.status,
    risk: input.source.risk,
    trustScore: clampScore(input.source.trust_score),
    language: input.source.language,
    crawlFrequencySeconds: input.source.crawl_frequency_seconds,
    legalNotes: latestLegalNote(input.legalNotes)?.note ?? "",
    createdAt: input.source.created_at,
    updatedAt: input.source.updated_at,
    lastSeenAt: input.source.last_seen_at,
    approvalRequired: governance?.approvalRequired,
    approvedAt: governance?.approvedAt,
    approvedBy: governance?.approvedBy,
    governance,
    health: input.health ? healthFromRow(input.health) : undefined,
    scoring: input.scoring ? scoringFromRow(input.scoring) : undefined,
    crawlState: input.crawlState ? crawlStateFromRow(input.crawlState) : undefined,
    lifecycle: (input.lifecycle ?? []).map(lifecycleFromRow).sort((left, right) => left.at.localeCompare(right.at)),
    tags: input.source.tags,
    metadata: metadataWithoutCatalog(input.source.metadata),
    catalog: catalogFromMetadata(input.source.metadata)
  };
}

export function buildSourceRegistryPersistenceReadinessPacket(generatedAt: string) {
  return {
    schemaVersion: "ti.source_registry_persistence_readiness.v1",
    generatedAt,
    migration: "migrations/001_source_registry.sql",
    dryRun: true,
    willMutate: false,
    willConnectToDatabase: false,
    workflowTables: [
      { table: "sources", mapper: "sourceRecordToSourceRow", requiredForCutover: true },
      { table: "source_governance", mapper: "sourceRecordToGovernanceRow", requiredForCutover: true },
      { table: "source_legal_notes", mapper: "sourceRecordToLegalNoteRow", requiredForCutover: true },
      { table: "source_health", mapper: "sourceHealthToRow", requiredForCutover: true },
      { table: "source_scoring_inputs", mapper: "sourceScoringInputsToRow", requiredForCutover: true },
      { table: "source_crawl_state", mapper: "sourceCrawlStateToRow", requiredForCutover: true },
      { table: "source_lifecycle_events", mapper: "sourceLifecycleEventToRow", requiredForCutover: true },
      { table: "source_atlas_records", mapper: "tiSourceAtlasRecordToPostgresRow", requiredForCutover: false },
      { table: "source_atlas_review_queue", mapper: "tiSourceAtlasReviewQueueRowToPostgresRow", requiredForCutover: false },
      { table: "source_atlas_export_manifest", mapper: "tiSourceAtlasExportManifestRowToPostgresRow", requiredForCutover: false },
      { table: "source_atlas_activation_packet_audit", mapper: "tiSourceAtlasRepairActivationPacketInputsToPostgresRows", requiredForCutover: false }
    ],
    replayOrder: [
      "sources",
      "source_governance",
      "source_legal_notes",
      "source_health",
      "source_scoring_inputs",
      "source_crawl_state",
      "source_lifecycle_events",
      "source_atlas_records",
      "source_atlas_review_queue",
      "source_atlas_export_manifest",
      "source_atlas_activation_packet_audit"
    ],
    guardrails: [
      "source registry persistence does not lease work or start crawling",
      "restricted and darknet metadata sources keep governance.metadataOnly=true",
      "medium high and restricted active sources require approved governance rows",
      "legal notes and lifecycle events remain audit-visible after restart",
      "source atlas rows are staged dry-run records and do not become active sources without explicit approval",
      "source atlas export manifest rows are audit records only and do not import source packs",
      "source atlas activation packet audit rows are operator/legal inputs only and cannot apply source activation"
    ]
  };
}

export function tiSourceAtlasRecordToPostgresRow(record: TiSourceAtlasRecord, input: { tenantId?: string; generatedAt: string }): SourceAtlasRecordRow {
  return {
    atlas_source_id: record.id,
    tenant_id: input.tenantId,
    url: record.url,
    domain: record.domain,
    feed_url: record.feedUrl,
    source_name: record.sourceName,
    family: record.family,
    discovery_method: record.discoveryMethod,
    query_class_coverage: [...record.queryClassCoverage],
    language: record.language,
    regions: [...record.region],
    sectors: [...record.sector],
    reliability: clampScore(record.reliability),
    freshness: clampScore(record.freshness),
    evidence_yield: clampScore(record.evidenceYield),
    uniqueness: clampScore(record.uniqueness),
    downstream_public_answer_impact: clampScore(record.downstreamPublicAnswerImpact),
    source_value_score: clampScore(record.sourceValueScore),
    parser_profile: record.parserCapability.profile,
    parser_certified: record.parserCapability.certified,
    parser_certification_required: record.parserCapability.certificationRequired,
    legal_review: record.legalRobotsState.legalReview,
    robots_review: record.legalRobotsState.robotsReview,
    legal_robots_notes: [...record.legalRobotsState.notes],
    duplicate_of: record.duplicate.duplicateOf,
    mirror_of: record.duplicate.mirrorOf,
    content_similarity: clampScore(record.duplicate.contentSimilarity),
    duplicate_suppressed: record.duplicate.suppressed,
    scheduler_budget_class: record.schedulerEstimate.budgetClass,
    cadence_seconds: record.schedulerEstimate.cadenceSeconds,
    estimated_daily_tasks: record.schedulerEstimate.estimatedDailyTasks,
    expected_items_per_day: record.evidenceEstimate.expectedItemsPerDay,
    storage_mb_per_day: record.evidenceEstimate.storageMbPerDay,
    retention_class: record.evidenceEstimate.retentionClass,
    activation_state: record.activationReadiness.state,
    activation_reasons: [...record.activationReadiness.reasons],
    approval_required: true,
    auto_activation_allowed: false,
    public_only: true,
    private_invite_auth_captcha: false,
    raw_payload_target: false,
    auto_activate: false,
    generated_at: input.generatedAt
  };
}

export function tiSourceAtlasRecordFromPostgresRow(row: SourceAtlasRecordRow): TiSourceAtlasRecord {
  return {
    id: row.atlas_source_id,
    url: row.url,
    domain: row.domain,
    feedUrl: row.feed_url,
    sourceName: row.source_name,
    family: row.family,
    discoveryMethod: row.discovery_method,
    queryClassCoverage: [...row.query_class_coverage],
    language: row.language,
    region: [...row.regions],
    sector: [...row.sectors],
    reliability: clampScore(row.reliability),
    freshness: clampScore(row.freshness),
    evidenceYield: clampScore(row.evidence_yield),
    uniqueness: clampScore(row.uniqueness),
    downstreamPublicAnswerImpact: clampScore(row.downstream_public_answer_impact),
    sourceValueScore: clampScore(row.source_value_score),
    parserCapability: {
      profile: row.parser_profile,
      owner: "agent_03",
      certified: row.parser_certified,
      certificationRequired: row.parser_certification_required
    },
    legalRobotsState: {
      legalReview: row.legal_review,
      robotsReview: row.robots_review,
      notes: [...row.legal_robots_notes]
    },
    duplicate: {
      duplicateOf: row.duplicate_of,
      mirrorOf: row.mirror_of,
      contentSimilarity: clampScore(row.content_similarity),
      suppressed: row.duplicate_suppressed
    },
    schedulerEstimate: {
      budgetClass: row.scheduler_budget_class,
      cadenceSeconds: row.cadence_seconds,
      estimatedDailyTasks: row.estimated_daily_tasks
    },
    evidenceEstimate: {
      expectedItemsPerDay: row.expected_items_per_day,
      storageMbPerDay: row.storage_mb_per_day,
      retentionClass: row.retention_class
    },
    activationReadiness: {
      state: row.activation_state,
      approvalRequired: true,
      autoActivationAllowed: false,
      reasons: [...row.activation_reasons]
    },
    safety: {
      publicOnly: true,
      privateInviteAuthCaptcha: false,
      rawPayloadTarget: false,
      autoActivate: false
    }
  };
}

export function tiSourceAtlasExportManifestToPostgresRows(packet: TiSourceAtlasExportManifestApiResponse): SourceAtlasPostgresRows {
  return {
    source_atlas_records: [],
    source_atlas_review_queue: packet.reviewQueue.map((row) => tiSourceAtlasReviewQueueRowToPostgresRow(row, packet)),
    source_atlas_export_manifest: packet.exportManifest.rows.map((row) => tiSourceAtlasExportManifestRowToPostgresRow(row, packet)),
    source_atlas_activation_packet_audit: []
  };
}

export function tiSourceAtlasRepairActivationPacketInputsToPostgresRows(
  packetInputs: TiSourceAtlasProductSourceLadderPacket["paidSourceTierPlan"]["payworthyRepairQueue"]["sourceActivationPacketInputs"],
  input: { tenantId?: string; generatedAt: string }
): SourceAtlasActivationPacketAuditRow[] {
  return packetInputs.packets.map((packet) => ({
    packet_id: packet.packetId,
    tenant_id: input.tenantId,
    priority: packet.priority,
    approval_mode: packet.approvalMode,
    action: packet.action,
    repair_decision: packet.repairDecision,
    blocker: packet.blocker,
    atlas_source_ids: [...packet.atlasSourceIds],
    replacement_candidate_ids: [...packet.replacementCandidateIds],
    source_families: [...packet.sourceFamilies],
    expected_payworthy_lift: packet.expectedPayworthyLift,
    expected_fresh_rows_per_day: packet.expectedFreshRowsPerDay,
    expected_row_lift: packet.expectedRowLift,
    buyer_visible_reason: packet.buyerVisibleReason,
    prerequisites: [...packet.prerequisites],
    route_hints: [...packet.routeHints],
    forbidden_actions: [...packet.forbiddenActions],
    dry_run: true,
    will_mutate: false,
    will_start_crawling: false,
    raw_url_exposed: false,
    raw_payload_exposed: false,
    private_auth_captcha_required: false,
    crawl_started: false,
    source_activation_applied: false,
    generated_at: input.generatedAt
  }));
}

export function tiSourceAtlasReviewQueueRowToPostgresRow(row: TiSourceAtlasReviewQueueRow, packet: Pick<TiSourceAtlasExportManifestApiResponse, "tenantId" | "generatedAt">): SourceAtlasReviewQueuePostgresRow {
  return {
    review_id: row.reviewId,
    atlas_source_id: row.atlasSourceId,
    tenant_id: packet.tenantId,
    source_name: row.sourceName,
    family: row.family,
    domain: row.domain,
    source_hash: row.sourceHash,
    decision: row.decision,
    reasons: [...row.reasons],
    approval_route: row.approvalRoute,
    parser_owner: row.parserOwner,
    scheduler_owner: row.schedulerOwner,
    quality_owner: row.qualityOwner,
    release_owner: row.releaseOwner,
    dry_run: true,
    will_mutate: false,
    will_start_crawling: false,
    generated_at: packet.generatedAt
  };
}

export function tiSourceAtlasExportManifestRowToPostgresRow(row: TiSourceAtlasExportManifestRow, packet: Pick<TiSourceAtlasExportManifestApiResponse, "tenantId" | "generatedAt" | "requestedPlan">): SourceAtlasExportManifestPostgresRow {
  return {
    atlas_source_id: row.atlasSourceId,
    tenant_id: packet.tenantId,
    source_hash: row.sourceHash,
    source_name: row.sourceName,
    url: row.url,
    domain: row.domain,
    family: row.family,
    query_class_coverage: [...row.queryClassCoverage],
    source_value_score: clampScore(row.sourceValueScore),
    parser_profile: row.parserProfile,
    scheduler_cadence_seconds: row.schedulerCadenceSeconds,
    expected_items_per_day: row.expectedItemsPerDay,
    legal_review: row.legalReview,
    robots_review: row.robotsReview,
    approval_required: true,
    auto_activation_allowed: false,
    manifest_schema_version: "ti.source_atlas_export.v1",
    requested_plan: packet.requestedPlan,
    generated_at: packet.generatedAt
  };
}

function sourceRecordToSourceRow(source: SourceRecord): SourceRegistrySourceRow {
  return {
    id: source.id,
    tenant_id: source.tenantId,
    name: source.name,
    type: source.type,
    url: source.url,
    access_method: source.accessMethod,
    status: source.status,
    risk: source.risk,
    trust_score: clampScore(source.trustScore),
    language: source.language,
    crawl_frequency_seconds: source.crawlFrequencySeconds,
    last_seen_at: source.lastSeenAt,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
    tags: [...(source.tags ?? [])],
    metadata: sourceMetadata(source)
  };
}

function sourceRecordToGovernanceRow(source: SourceRecord): SourceRegistryGovernanceRow {
  const governance = source.governance;
  const approvalRequired = governance?.approvalRequired ?? source.approvalRequired ?? source.risk !== "low";
  const approvalState = governance?.approvalState ?? (approvalRequired ? "pending" : "not_required");
  return {
    source_id: source.id,
    approval_required: approvalRequired,
    approval_state: approvalState,
    metadata_only: governance?.metadataOnly ?? isRestrictedMetadataSource(source),
    approved_at: governance?.approvedAt ?? source.approvedAt,
    approved_by: governance?.approvedBy ?? source.approvedBy,
    approval_expires_at: governance?.approvalExpiresAt,
    review_ticket: governance?.reviewTicket,
    policy_version: governance?.policyVersion ?? "collection-policy:v1",
    risk_justification: governance?.riskJustification,
    legal_contact: governance?.legalContact,
    created_at: source.createdAt,
    updated_at: source.updatedAt
  };
}

function sourceRecordToLegalNoteRow(source: SourceRecord): SourceRegistryLegalNoteRow {
  return {
    id: `legal-note:${source.id}:${source.createdAt}`,
    source_id: source.id,
    note: source.legalNotes,
    note_kind: "collection_basis",
    created_at: source.createdAt,
    created_by: source.approvedBy
  };
}

function sourceHealthToRow(sourceId: string, updatedAt: string, health: SourceHealth): SourceRegistryHealthRow {
  return {
    source_id: sourceId,
    status: health.status,
    checked_at: health.checkedAt,
    last_success_at: health.lastSuccessAt,
    last_failure_at: health.lastFailureAt,
    consecutive_failures: health.consecutiveFailures,
    error_rate: clampScore(health.errorRate),
    median_latency_ms: health.medianLatencyMs,
    last_error: health.lastError,
    updated_at: updatedAt
  };
}

function sourceScoringInputsToRow(sourceId: string, updatedAt: string, scoring: SourceScoringInputs): SourceRegistryScoringInputsRow {
  return {
    source_id: sourceId,
    reliability: clampScore(scoring.reliability),
    freshness: clampScore(scoring.freshness),
    relevance: clampScore(scoring.relevance),
    uniqueness: clampScore(scoring.uniqueness),
    parseability: clampScore(scoring.parseability),
    policy_risk_penalty: clampScore(scoring.policyRiskPenalty),
    operator_boost: clampScore(scoring.operatorBoost),
    updated_at: updatedAt
  };
}

function sourceCrawlStateToRow(sourceId: string, updatedAt: string, crawlState: SourceCrawlState): SourceRegistryCrawlStateRow {
  return {
    source_id: sourceId,
    last_scheduled_at: crawlState.lastScheduledAt,
    next_eligible_at: crawlState.nextEligibleAt,
    last_collected_at: crawlState.lastCollectedAt,
    etag: crawlState.etag,
    last_modified: crawlState.lastModified,
    cursor_value: crawlState.cursor,
    backoff_until: crawlState.backoffUntil,
    retry_count: crawlState.retryCount,
    updated_at: updatedAt
  };
}

function sourceLifecycleEventToRow(sourceId: string, event: SourceLifecycleEvent): SourceRegistryLifecycleEventRow {
  return {
    source_id: sourceId,
    occurred_at: event.at,
    from_status: event.from,
    to_status: event.to,
    reason: event.reason,
    actor_id: event.actorId,
    note: event.note
  };
}

function governanceFromRow(row: SourceRegistryGovernanceRow): SourceGovernance {
  return {
    approvalRequired: row.approval_required,
    approvalState: row.approval_state,
    metadataOnly: row.metadata_only,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    approvalExpiresAt: row.approval_expires_at,
    reviewTicket: row.review_ticket,
    policyVersion: row.policy_version,
    riskJustification: row.risk_justification,
    legalContact: row.legal_contact
  };
}

function healthFromRow(row: SourceRegistryHealthRow): SourceHealth {
  return {
    status: row.status,
    checkedAt: row.checked_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    consecutiveFailures: row.consecutive_failures,
    errorRate: row.error_rate,
    medianLatencyMs: row.median_latency_ms,
    lastError: row.last_error
  };
}

function scoringFromRow(row: SourceRegistryScoringInputsRow): SourceScoringInputs {
  return {
    reliability: row.reliability,
    freshness: row.freshness,
    relevance: row.relevance,
    uniqueness: row.uniqueness,
    parseability: row.parseability,
    policyRiskPenalty: row.policy_risk_penalty,
    operatorBoost: row.operator_boost
  };
}

function crawlStateFromRow(row: SourceRegistryCrawlStateRow): SourceCrawlState {
  return {
    lastScheduledAt: row.last_scheduled_at,
    nextEligibleAt: row.next_eligible_at,
    lastCollectedAt: row.last_collected_at,
    etag: row.etag,
    lastModified: row.last_modified,
    cursor: row.cursor_value,
    backoffUntil: row.backoff_until,
    retryCount: row.retry_count
  };
}

function lifecycleFromRow(row: SourceRegistryLifecycleEventRow): SourceLifecycleEvent {
  return {
    at: row.occurred_at,
    from: row.from_status,
    to: row.to_status,
    reason: row.reason,
    actorId: row.actor_id,
    note: row.note
  };
}

function latestLegalNote(rows: SourceRegistryLegalNoteRow[] | undefined): SourceRegistryLegalNoteRow | undefined {
  return [...(rows ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
}

function sourceMetadata(source: SourceRecord): JsonObject {
  const metadata: JsonObject = { ...(source.metadata ?? {}) };
  if (source.catalog) {
    metadata.catalog = source.catalog as unknown as JsonObject;
  }
  return metadata;
}

function catalogFromMetadata(metadata: JsonObject): SourceCatalogMetadata | undefined {
  const catalog = metadata.catalog;
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return undefined;
  return catalog as SourceCatalogMetadata;
}

function metadataWithoutCatalog(metadata: JsonObject): JsonObject {
  const { catalog: _catalog, ...rest } = metadata;
  return rest;
}

function isRestrictedMetadataSource(source: SourceRecord): boolean {
  return source.type === "tor_metadata" || source.type === "i2p_metadata" || source.type === "freenet_metadata" || source.risk === "restricted";
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
