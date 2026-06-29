import { parseTelegramTarget, validateTelegramPublicSourceCompliance } from "../adapters/telegramPublic.ts";
import { evaluateTelegramPublicCompliance } from "../policy/telegramCollectionPolicy.ts";
import { evaluateMetadataOnlySource } from "../policy/metadataCollectionPolicy.ts";
import { buildDwmProductSnapshot } from "../product/dwmProduct.ts";
import { applyDwmSeedCatalog, sourceDedupeKey } from "../product/dwmSourceInventory.ts";
import {
  InMemoryDwmSourcePackActiveSourceAdapter,
  InMemoryDwmSourcePackCollectionReceiptAdapter,
  InMemoryDwmSourcePackRegistryAdapter,
  InMemoryDwmSourcePackValidationQueueAdapter,
  InMemoryDwmSourcePackWorkerRunAdapter,
  applyDwmSourcePackValidationResults,
  buildDwmSourcePackCollectionJobHandoff,
  enqueueDwmSourcePackCollectionTasks,
  enqueueDwmSourcePackValidationJobs,
  persistDwmSourcePackActiveSources,
  persistDwmSourcePackSourceRecords,
  planDwmSourcePackValidationBatch,
  runDwmSourcePackValidationJob,
  sourcePackHealthRollup,
  sourcePackWorkerReadinessCounters,
  type DwmSourceCandidateValidationResult,
  type DwmSourcePackActiveSourceAdapter,
  type DwmSourcePackCandidateRecord,
  type DwmSourcePackCollectionQueueReceiptRecord,
  type DwmSourcePackCollectionReceiptAdapter,
  type DwmSourcePackFamily,
  type DwmSourcePackListQuery,
  type DwmSourcePackRecord,
  type DwmSourcePackRegistryAdapter,
  type DwmSourcePackValidationQueueAdapter,
  type DwmSourcePackValidationQueueRecord,
  type DwmSourcePackWorkerRunAdapter,
  type DwmSourcePackWorkerRunRecord
} from "../storage/dwmSourcePackRegistry.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import type { SourceRecord } from "../types.ts";

type DwmSourceRequestBody = {
  target?: string;
  query?: string;
  type?: "telegram_channel" | "restricted_metadata" | "public_url";
  tenantId?: string;
  scope?: string;
  activate?: boolean;
  approveMetadataOnly?: boolean;
  approvedBy?: string;
  dryRun?: boolean;
  limit?: number;
  targets?: string[];
  candidates?: DwmSourcePackCandidate[];
  sourcePackLabel?: string;
  sourcePackId?: string;
  cursor?: string;
  createdFrom?: string;
  createdTo?: string;
  generatedAt?: string;
  family?: SourceGrowthFamily;
  decision?: string;
  activationState?: string;
  parserStatus?: string;
  lastFailure?: string;
  requestId?: string;
  seedPackIds?: string[];
  priority?: "critical" | "high" | "medium";
  action?: "inspect" | "validate" | "test" | "activate" | "promote" | "reject" | "retry" | "suppress" | "record_capture" | "collection_failed" | "pack_status" | "pack_review" | "pack_list" | "pack_worker_run" | "pack_customer_config" | "actor_enrichment_readiness";
  packAction?: "approve" | "promote" | "reject" | "retry" | "suppress";
  orgId?: string;
  customerId?: string;
  configMode?: "read" | "prepare";
  configOperation?: "create" | "update" | "disable" | "enable" | "test" | "retry" | "suppress";
  operatorRole?: "source_operator" | "source_admin" | "policy_admin" | "viewer";
  ownerLane?: "source_ops" | "policy" | "customer_admin";
  idempotencyKey?: string;
  auditReason?: string;
  chunkSize?: number;
  maxAttempts?: number;
  backoffSeconds?: number;
  perFamilyConcurrency?: Partial<Record<SourceGrowthFamily, number>>;
  perFamilyCaps?: Partial<Record<SourceGrowthFamily, number>>;
  sourceId?: string;
  candidateId?: string;
  sourceIds?: string[];
  candidateIds?: string[];
  collectionTaskId?: string;
  captureText?: string;
  captureUrl?: string;
  errorCode?: string;
  reason?: string;
  decidedBy?: string;
  requestedBy?: string;
};

type DwmSourcePackCandidate = {
  target?: string;
  type?: "telegram_channel" | "restricted_metadata" | "public_url";
  family?: SourceGrowthFamily;
  refLabel?: string;
  parserExpectation?: string;
  scope?: string;
  requestedBy?: string;
  priority?: "critical" | "high" | "medium";
  suppress?: boolean;
  reason?: string;
};

type SourceGrowthFamily = DwmSourcePackFamily;
type SourcePackRegistry = DwmSourcePackRecord;
type SourcePackRegistryCandidate = DwmSourcePackCandidateRecord;

const sourcePackRegistries = new WeakMap<object, InMemoryDwmSourcePackRegistryAdapter>();
const sourcePackValidationQueues = new WeakMap<object, InMemoryDwmSourcePackValidationQueueAdapter>();
const sourcePackActiveSources = new WeakMap<object, InMemoryDwmSourcePackActiveSourceAdapter>();
const sourcePackWorkerRuns = new WeakMap<object, InMemoryDwmSourcePackWorkerRunAdapter>();
const sourcePackCollectionReceipts = new WeakMap<object, InMemoryDwmSourcePackCollectionReceiptAdapter>();

export async function createDwmSourceRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<DwmSourceRequestBody>(request);
  if (body.action) return handleSourceLifecycleAction(body, options);

  if (Array.isArray(body.candidates) && body.candidates.length > 0) {
    return json(createSourceCandidatePack(body, options), 201);
  }

  if (Array.isArray(body.seedPackIds) && body.seedPackIds.length > 0) {
    const result = applyDwmSeedCatalog({
      store: options.store,
      tenantId: body.tenantId,
      watchlist: body.scope ? body.scope.split(/[,\n]/).map((term) => term.trim()).filter(Boolean) : undefined,
      seedPackIds: body.seedPackIds,
      activate: body.activate,
      approveMetadataOnly: body.approveMetadataOnly,
      approvedBy: body.approvedBy,
      dryRun: body.dryRun,
      limit: body.limit
    });
    return json({
      request: {
        id: stableId("dwm_source_pack_request", `${result.summary.requestedPackIds.join(",")}:${result.generatedAt}`),
        type: "seed_catalog",
        approvalState: body.dryRun ? "dry_run" : "queued",
        nextAction: body.activate
          ? "Canary-ready public sources were queued; restricted metadata candidates still require analyst approval."
          : "Review generated source candidates, then activate selected public channels into canary polling."
      },
      createdCandidates: result.createdSources.map((source) => sourceCandidate(source)),
      ...result
    }, body.dryRun ? 200 : 201);
  }

  if (Array.isArray(body.targets) && body.targets.length > 0) {
    const created: SourceRecord[] = [];
    const rejected: Array<{ target: string; code: string; message: string }> = [];
    const duplicates: Array<{ target: string; duplicateOf: string }> = [];
    for (const target of body.targets.slice(0, Math.max(1, Math.min(body.limit ?? 100, 100)))) {
      const result = createTelegramSourceFromTarget(target, body, options);
      if (result.kind === "error") rejected.push({ target, code: result.code, message: result.message });
      if (result.kind === "duplicate") duplicates.push({ target, duplicateOf: result.duplicateOf });
      if (result.kind === "created") created.push(result.source);
    }
    return json({
      request: {
        id: stableId("dwm_bulk_source_request", `${created.map((source) => source.id).join(",")}:${rejected.length}:${duplicates.length}`),
        type: "bulk_targets",
        approvalState: "queued",
        nextAction: "Review rejected and duplicate targets; created public Telegram sources are bounded to safe preview collection."
      },
      createdSources: created,
      createdCandidates: created.map((source) => sourceCandidate(source)),
      rejected,
      duplicates,
      summary: { createdCount: created.length, rejectedCount: rejected.length, duplicateCount: duplicates.length }
    }, created.length ? 201 : 400);
  }

  if (body.type === "restricted_metadata") {
    const created = createRestrictedMetadataSourceFromTarget(String(body.target ?? "").trim(), body, options);
    if (created.kind === "error") return json({ error: { code: created.code, message: created.message } }, 400);
    if (created.kind === "duplicate") return json({
      request: {
        id: stableId("dwm_source_request", `${body.target ?? "restricted"}:duplicate`),
        target: body.target ?? "",
        type: "restricted_metadata",
        approvalState: "duplicate",
        nextAction: "Use the existing metadata-only source or update its approval scope rather than adding a duplicate."
      },
      duplicateOf: created.duplicateOf
    }, 200);
    return json({
      source: created.source,
      candidate: sourceCandidate(created.source),
      lifecycle: sourceLifecycle(created.source),
      policy: sourcePolicyPosture(created.source),
      request: {
        id: stableId("dwm_source_request", `${created.source.id}:${created.source.url}`),
        target: created.source.url,
        type: "restricted_metadata",
        approvalState: "queued",
        nextAction: "Inspect policy metadata, then approve metadata-only monitoring or reject the source candidate."
      }
    }, 202);
  }

  const target = String(body.target ?? "").trim();
  const created = createTelegramSourceFromTarget(target, body, options);
  if (created.kind === "error") return json({ error: { code: created.code, message: created.message } }, 400);
  if (created.kind === "duplicate") return json({
    request: {
      id: stableId("dwm_source_request", `${target}:duplicate`),
      target,
      type: "telegram_channel",
      approvalState: "duplicate",
      nextAction: "Use the existing source or update its scope rather than adding a duplicate."
    },
    duplicateOf: created.duplicateOf
  }, 200);
  const saved = created.source;
  return json({
    source: saved,
    candidate: sourceCandidate(saved),
    lifecycle: sourceLifecycle(saved),
    policy: sourcePolicyPosture(saved),
    request: {
      id: stableId("dwm_source_request", `${saved.id}:${saved.url}`),
      target: saved.url,
      type: "telegram_channel",
      approvalState: saved.status === "active" ? "approved_public" : "queued",
      nextAction: saved.status === "active"
        ? "Source is active for bounded public preview polling on the next canary cycle."
        : "Review the public channel, then activate bounded polling."
    }
  }, 201);
}

export function buildDwmSourcePackWorkerReadinessSnapshot(
  options: ApiServerOptions,
  input: { generatedAt?: string; staleAfterMinutes?: number; tenantId?: string; orgId?: string; customerId?: string; scope?: string } = {}
) {
  const generatedAt = input.generatedAt ?? nowIso();
  const staleAfterMinutes = Math.max(1, input.staleAfterMinutes ?? 120);
  const packs = sourcePackStore(options).list({ limit: 500 }).items;
  const workerState = sourcePackWorkerStateForPacks(packs, options);
  const growth = sourcePackGrowthCounters(packs, options);
  const lastRun = workerState.lastRun;
  const lastRunTime = lastRun?.completedAt ?? lastRun?.startedAt;
  const ageMinutes = lastRunTime ? Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(lastRunTime)) / 60000)) : undefined;
  const freshness = !lastRun
    ? "missing"
    : ageMinutes !== undefined && ageMinutes > staleAfterMinutes
      ? "stale"
      : "fresh";
  const sourceHealth = buildDwmSourceHealthOperationsSnapshot(packs, options, { freshness, staleAfterMinutes, generatedAt });
  const sourceCustomerConfig = buildDwmSourcePackCustomerConfigReadiness(packs, options, {
    generatedAt,
    freshness,
    staleAfterMinutes,
    tenantId: input.tenantId,
    orgId: input.orgId,
    customerId: input.customerId,
    scope: input.scope
  });
  const sourceReadinessArtifact = buildDwmSourceReadinessArtifact(sourceCustomerConfig, {
    generatedAt,
    scope: input.scope,
    tenantId: input.tenantId,
    orgId: input.orgId,
    customerId: input.customerId
  });
  const snapshot = {
    schemaVersion: "dwm.source_pack_worker_readiness.v1",
    generatedAt,
    freshness,
    staleAfterMinutes,
    lastRun: lastRun ? {
      id: lastRun.id,
      status: lastRun.status,
      startedAt: lastRun.startedAt,
      completedAt: lastRun.completedAt,
      ageMinutes
    } : undefined,
    counters: {
      totalCandidates: growth.totalCandidates,
      accepted: growth.accepted,
      rejected: growth.rejected,
      queued: growth.queued,
      duplicate: growth.duplicateOrUpserted,
      metadataOnly: growth.metadataOnly,
      restrictedBlocked: growth.restrictedBlocked,
      activeSourceRows: growth.activeSourceRows,
      queuedCollectionTasks: growth.queuedCollectionTasks,
      collectionReadyRows: workerState.readiness.collectionReadyRows
    },
    workerReadiness: workerState.readiness,
    sourceHealth,
    sourceOperationsReadiness: buildDwmSourceOperationsReadinessSnapshot(packs, options, { freshness, staleAfterMinutes, generatedAt, sourceHealth }),
    sourceCustomerConfig,
    sourceReadinessArtifact,
    parserSourceFamilyCounts: growth.parserSourceFamilyCounts,
    sourceFamilyCounts: growth.sourceFamilyCounts,
    redactedSourcePackIds: packs.map((pack) => ({
      id: pack.id,
      label: pack.label,
      candidateCount: pack.candidates.length,
      safeRef: stableId("dwm_source_pack_ref", pack.id),
      rawTargetsExposed: false
    })),
    rejectedCandidates: packs.flatMap((pack) => pack.candidates
      .filter((candidate) => ["rejected", "failed", "disabled", "duplicate", "suppressed", "approval_required"].includes(candidate.status) || candidate.failure)
      .map((candidate) => ({
        sourcePackId: pack.id,
        candidateId: candidate.id,
        family: candidate.declaredFamily,
        status: candidate.status,
        reason: candidate.reason ?? String(candidate.failure?.message ?? candidate.failure?.code ?? candidate.decision ?? "blocked"),
        retryHint: candidate.retryHint,
        targetRef: candidate.targetRef
      }))),
    readiness: {
      state: freshness === "fresh" && (workerState.readiness.collectionReadyRows > 0 || workerState.readiness.activeSourceRows > 0)
        ? "ready"
        : freshness,
      blockers: [
        ...(!lastRun ? ["source-pack worker has not run"] : []),
        ...(freshness === "stale" ? [`source-pack worker last run is older than ${staleAfterMinutes} minutes`] : []),
        ...(workerState.readiness.collectionReadyRows === 0 && workerState.readiness.activeSourceRows === 0 ? ["no active or collection-ready source-pack rows"] : [])
      ]
    },
    safeOutput: {
      rawUnsafeRowsStored: false,
      rawTargetsExposed: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false
    }
  };
  return {
    ...snapshot,
    proxyVerification: buildDwmSourcePackWorkerProxyVerification(snapshot)
  };
}

function buildDwmSourcePackWorkerProxyVerification(snapshot: {
  schemaVersion: string;
  freshness: string;
  lastRun?: { id: string; status: string; startedAt: string; completedAt: string; ageMinutes?: number };
  counters: Record<string, number>;
  workerReadiness: Record<string, any>;
  sourceHealth: Record<string, any>;
  sourceOperationsReadiness: Record<string, any>;
  sourceCustomerConfig: Record<string, any>;
  sourceReadinessArtifact: Record<string, any>;
  parserSourceFamilyCounts: Record<string, Record<string, number>>;
  sourceFamilyCounts: Record<string, unknown>;
  redactedSourcePackIds: Array<{ id: string; safeRef: string; rawTargetsExposed: boolean }>;
  rejectedCandidates: Array<{ targetRef?: { rawStored?: boolean }; reason?: string }>;
  readiness: { state: string; blockers: string[] };
  safeOutput: Record<string, boolean>;
}) {
  const checks = [
    verificationCheck("schema_present", snapshot.schemaVersion === "dwm.source_pack_worker_readiness.v1", snapshot.schemaVersion),
    verificationCheck("freshness_known", ["fresh", "stale", "missing"].includes(snapshot.freshness), snapshot.freshness),
    verificationCheck("worker_run_present_when_ready", snapshot.readiness.state !== "ready" || Boolean(snapshot.lastRun?.id), snapshot.lastRun?.id ?? "missing"),
    verificationCheck(
      "active_or_collection_rows_when_ready",
      snapshot.readiness.state !== "ready" || Number(snapshot.workerReadiness.activeSourceRows ?? 0) + Number(snapshot.workerReadiness.collectionReadyRows ?? 0) > 0,
      { activeSourceRows: snapshot.workerReadiness.activeSourceRows ?? 0, collectionReadyRows: snapshot.workerReadiness.collectionReadyRows ?? 0 }
    ),
    verificationCheck("candidate_counters_present", Number.isFinite(snapshot.counters.totalCandidates), snapshot.counters.totalCandidates ?? "missing"),
    verificationCheck("queue_counters_present", Number.isFinite(snapshot.counters.queuedCollectionTasks), snapshot.counters.queuedCollectionTasks ?? "missing"),
    verificationCheck("source_health_present", snapshot.sourceHealth.schemaVersion === "dwm.source_health_operations.v1", snapshot.sourceHealth.schemaVersion),
    verificationCheck("source_health_blockers_typed", Array.isArray(snapshot.sourceHealth.typedBlockers), snapshot.sourceHealth.typedBlockers?.length ?? "missing"),
    verificationCheck("source_operations_readiness_present", snapshot.sourceOperationsReadiness.schemaVersion === "dwm.source_operations_readiness.v1", snapshot.sourceOperationsReadiness.schemaVersion),
    verificationCheck("source_operations_next_actions_present", Array.isArray(snapshot.sourceOperationsReadiness.nextOperatorActions), snapshot.sourceOperationsReadiness.nextOperatorActions?.length ?? "missing"),
    verificationCheck("source_customer_config_present", snapshot.sourceCustomerConfig.schemaVersion === "dwm.source_pack_customer_config.v1", snapshot.sourceCustomerConfig.schemaVersion),
    verificationCheck("source_customer_config_redacted", snapshot.sourceCustomerConfig.safeOutput?.rawTargetsExposed === false && snapshot.sourceCustomerConfig.safeOutput?.privateTelegramContentExposed === false, snapshot.sourceCustomerConfig.safeOutput),
    verificationCheck("source_readiness_artifact_present", snapshot.sourceReadinessArtifact.schemaVersion === "dwm.source_readiness_artifact.v1", snapshot.sourceReadinessArtifact.schemaVersion),
    verificationCheck("source_readiness_ledger_present", Array.isArray(snapshot.sourceReadinessArtifact.readinessLedgerRows), snapshot.sourceReadinessArtifact.readinessLedgerRows?.length ?? "missing"),
    verificationCheck("source_readiness_trust_present", Boolean(snapshot.sourceReadinessArtifact.sharedWatchlistAlertability?.sourceTrust), snapshot.sourceReadinessArtifact.sharedWatchlistAlertability?.sourceTrust ?? "missing"),
    verificationCheck("parser_family_counts_present", Object.keys(snapshot.parserSourceFamilyCounts).length > 0, Object.keys(snapshot.parserSourceFamilyCounts)),
    verificationCheck("source_family_counts_present", Object.keys(snapshot.sourceFamilyCounts).length > 0, Object.keys(snapshot.sourceFamilyCounts)),
    verificationCheck("pack_ids_redacted", snapshot.redactedSourcePackIds.every((pack) => pack.safeRef && pack.rawTargetsExposed === false), snapshot.redactedSourcePackIds.length),
    verificationCheck("rejected_candidates_redacted", snapshot.rejectedCandidates.every((candidate) => candidate.targetRef?.rawStored === false), snapshot.rejectedCandidates.length),
    verificationCheck("safe_output_no_raw_rows", snapshot.safeOutput.rawUnsafeRowsStored === false && snapshot.safeOutput.rawTargetsExposed === false, snapshot.safeOutput),
    verificationCheck("safe_output_no_private_telegram", snapshot.safeOutput.privateTelegramContentExposed === false, snapshot.safeOutput.privateTelegramContentExposed),
    verificationCheck("safe_output_no_restricted_metadata_leak", snapshot.safeOutput.restrictedMetadataLeaked === false, snapshot.safeOutput.restrictedMetadataLeaked),
    verificationCheck("safe_output_no_live_network", snapshot.safeOutput.liveNetworkScrapeStarted === false, snapshot.safeOutput.liveNetworkScrapeStarted)
  ];
  const failed = checks.filter((check) => check.status === "fail");
  return {
    schemaVersion: "dwm.source_pack_worker_proxy_verification.v1",
    state: failed.length > 0
      ? "blocked"
      : snapshot.readiness.state === "ready"
        ? "ready"
        : snapshot.freshness,
    checks,
    requiredJsonPaths: [
      "sourceInventory.sourcePackWorker.schemaVersion",
      "sourceInventory.sourcePackWorker.freshness",
      "sourceInventory.sourcePackWorker.lastRun.id",
      "sourceInventory.sourcePackWorker.counters.totalCandidates",
      "sourceInventory.sourcePackWorker.counters.queuedCollectionTasks",
      "sourceInventory.sourcePackWorker.workerReadiness.activeSourceRows",
      "sourceInventory.sourcePackWorker.workerReadiness.collectionReadyRows",
      "sourceInventory.sourcePackWorker.sourceHealth.family.telegram",
      "sourceInventory.sourcePackWorker.sourceHealth.typedBlockers[].code",
      "sourceInventory.sourcePackWorker.sourceHealth.lastWorkerReceipt",
      "sourceInventory.sourcePackWorker.sourceOperationsReadiness.actionability.canRetry",
      "sourceInventory.sourcePackWorker.sourceOperationsReadiness.nextOperatorActions[].action",
      "sourceInventory.sourcePackWorker.sourceOperationsReadiness.lastActionIds[]",
      "sourceInventory.sourcePackWorker.sourceCustomerConfig.schemaVersion",
      "sourceInventory.sourcePackWorker.sourceCustomerConfig.sourceConfigs[].redactedIdentity.rawStored",
      "sourceInventory.sourcePackWorker.sourceCustomerConfig.allowedOperatorActions[].action",
      "sourceInventory.sourcePackWorker.sourceReadinessArtifact.actorCoverage[].watchlistTerm",
      "sourceInventory.sourcePackWorker.sourceReadinessArtifact.actorCoverage[].actorSections.overview.covered",
      "sourceInventory.sourcePackWorker.sourceReadinessArtifact.sharedWatchlistAlertability.activeSourceFamilies[]",
      "sourceInventory.sourcePackWorker.sourceReadinessArtifact.sharedWatchlistAlertability.sourceTrust.averageScore",
      "sourceInventory.sourcePackWorker.sourceReadinessArtifact.readinessLedgerRows[].state",
      "sourceInventory.sourcePackWorker.parserSourceFamilyCounts",
      "sourceInventory.sourcePackWorker.sourceFamilyCounts",
      "sourceInventory.sourcePackWorker.rejectedCandidates[].targetRef.rawStored",
      "sourceInventory.sourcePackWorker.redactedSourcePackIds[].safeRef",
      "sourceInventory.sourcePackWorker.safeOutput.liveNetworkScrapeStarted",
      "sourcePacks.workerReadiness.activeSourceRows",
      "sourcePacks.sourceHealth.typedBlockers",
      "sourcePacks.sourceOperationsReadiness.summary.candidateCount",
      "sourcePacks.sourceCustomerConfig.summary.configurableCount",
      "sourcePacks.sourceReadinessArtifact.sharedWatchlistAlertability.matchableFields[]",
      "sourcePacks.sourceReadinessArtifact.readinessLedgerRows[].privacyBoundary.liveNetworkRequiredForProof",
      "sourcePacks.readiness.state",
      "sourcePacks.proxyVerification.state"
    ],
    worker3JsonAssertions: [
      ".sourceInventory.sourcePackWorker.schemaVersion == \"dwm.source_pack_worker_readiness.v1\"",
      ".sourceInventory.sourcePackWorker.proxyVerification.schemaVersion == \"dwm.source_pack_worker_proxy_verification.v1\"",
      ".sourceInventory.sourcePackWorker.safeOutput.liveNetworkScrapeStarted == false",
      ".sourceInventory.sourcePackWorker.safeOutput.privateTelegramContentExposed == false",
      ".sourceInventory.sourcePackWorker.safeOutput.restrictedMetadataLeaked == false",
      ".sourceInventory.sourcePackWorker.redactedSourcePackIds | all(.rawTargetsExposed == false)",
      ".sourceInventory.sourcePackWorker.rejectedCandidates | all(.targetRef.rawStored == false)",
      ".sourceInventory.sourcePackWorker.sourceHealth.safeOutput.liveNetworkScrapeStarted == false",
      ".sourceInventory.sourcePackWorker.sourceHealth.typedBlockers | all(has(\"code\") and has(\"severity\"))",
      ".sourceInventory.sourcePackWorker.sourceOperationsReadiness.schemaVersion == \"dwm.source_operations_readiness.v1\"",
      ".sourceInventory.sourcePackWorker.sourceOperationsReadiness.nextOperatorActions | all(has(\"action\") and has(\"reason\"))",
      ".sourceInventory.sourcePackWorker.sourceCustomerConfig.schemaVersion == \"dwm.source_pack_customer_config.v1\"",
      ".sourceInventory.sourcePackWorker.sourceCustomerConfig.sourceConfigs | all(.redactedIdentity.rawStored == false)",
      ".sourceInventory.sourcePackWorker.sourceCustomerConfig.safeOutput.liveNetworkScrapeStarted == false",
      ".sourceInventory.sourcePackWorker.sourceReadinessArtifact.schemaVersion == \"dwm.source_readiness_artifact.v1\"",
      ".sourceInventory.sourcePackWorker.sourceReadinessArtifact.safeOutput.liveNetworkScrapeStarted == false",
      ".sourceInventory.sourcePackWorker.sourceReadinessArtifact.readinessLedgerRows | all(.safeOutput.liveNetworkScrapeStarted == false)",
      ".sourceInventory.sourcePackWorker.sourceReadinessArtifact.actorCoverage | all(.actorSections.overview.covered != null)",
      ".sourcePacks.proxyVerification.checks | any(.id == \"safe_output_no_live_network\" and .status == \"pass\")"
    ],
    blockers: snapshot.readiness.blockers,
    safeOutput: snapshot.safeOutput
  };
}

function verificationCheck(id: string, passed: boolean, observed: unknown) {
  return { id, status: passed ? "pass" : "fail", observed };
}

function buildDwmSourceHealthOperationsSnapshot(
  packs: SourcePackRegistry[],
  options: ApiServerOptions,
  input: { freshness: string; staleAfterMinutes: number; generatedAt: string }
) {
  const packIds = new Set(packs.map((pack) => pack.id));
  const activeRows = sourcePackActiveSourceStore(options).list().filter((row) => packIds.has(row.packId));
  const receipts = sourcePackCollectionReceiptStore(options).list().filter((receipt) => packIds.has(receipt.packId));
  const queueRecords = sourcePackValidationQueue(options).list().filter((record) => record.packIds.some((packId) => packIds.has(packId)));
  const activeCandidateIds = new Set(activeRows.map((row) => row.candidateId));
  const receiptByCandidateId = new Map(receipts.map((receipt) => [receipt.candidateId, receipt]));
  const candidateRows = packs.flatMap((pack) => pack.candidates.map((candidate) => ({
    pack,
    candidate,
    activeRow: activeRows.find((row) => row.candidateId === candidate.id),
    receipt: receiptByCandidateId.get(candidate.id)
  })));
  const family = SOURCE_GROWTH_FAMILIES.reduce<Record<SourceGrowthFamily, Record<string, unknown>>>((acc, currentFamily) => {
    const rows = candidateRows.filter((row) => row.candidate.declaredFamily === currentFamily);
    const parserStatusCounts = rows.reduce<Record<string, number>>((counts, row) => {
      const status = row.candidate.parserStatus ?? row.activeRow?.parserStatus ?? "not_scheduled";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const operationalStateCounts = rows.reduce<Record<string, number>>((counts, row) => {
      const state = sourceHealthOperationalState(row.candidate, row.activeRow, row.receipt);
      counts[state] = (counts[state] ?? 0) + 1;
      return counts;
    }, { canary: 0, active: 0, paused: 0, failed: 0, blocked: 0 });
    const rejectionReasons = rows
      .filter((row) => isBlockedSourcePackCandidate(row.candidate))
      .map((row) => ({
        sourcePackId: row.pack.id,
        candidateId: row.candidate.id,
        status: row.candidate.status,
        reason: row.candidate.reason ?? String(row.candidate.failure?.message ?? row.candidate.failure?.code ?? row.candidate.decision ?? "blocked"),
        retryable: isRetryableSourcePackCandidate(row.candidate)
      }));
    const latestReceipt = receipts
      .filter((receipt) => receipt.family === currentFamily)
      .at(-1);
    acc[currentFamily] = {
      candidateCount: rows.length,
      activeCount: rows.filter((row) => activeCandidateIds.has(row.candidate.id) || row.candidate.status === "active" || row.candidate.decision === "approved").length,
      acceptedCount: rows.filter((row) => !isBlockedSourcePackCandidate(row.candidate)).length,
      rejectedCount: rows.filter((row) => isRejectedPolicySourcePackCandidate(row.candidate)).length,
      duplicateCount: rows.filter((row) => isDuplicateSourcePackCandidate(row.candidate)).length,
      retryableCount: rows.filter((row) => isRetryableSourcePackCandidate(row.candidate)).length,
      unretryableCount: rows.filter((row) => isUnretryableSourcePackCandidate(row.candidate)).length,
      parserStatusCounts,
      operationalStateCounts,
      rejectionReasons,
      lastWorkerReceipt: latestReceipt ? redactedWorkerReceipt(latestReceipt) : undefined,
      alertGradeEvidenceEligible: rows.some((row) => row.activeRow?.alertGradeEvidenceEligible === true)
    };
    return acc;
  }, {} as Record<SourceGrowthFamily, Record<string, unknown>>);
  const lastWorkerReceipt = receipts.at(-1);
  const typedBlockers = buildDwmSourceHealthTypedBlockers({
    packs,
    candidateRows,
    family,
    receipts,
    queueRecords,
    activeRows,
    freshness: input.freshness,
    staleAfterMinutes: input.staleAfterMinutes
  });
  return {
    schemaVersion: "dwm.source_health_operations.v1",
    generatedAt: input.generatedAt,
    family,
    candidateStates: {
      accepted: candidateRows.filter((row) => !isBlockedSourcePackCandidate(row.candidate)).length,
      rejected: candidateRows.filter((row) => isRejectedPolicySourcePackCandidate(row.candidate)).length,
      duplicate: candidateRows.filter((row) => isDuplicateSourcePackCandidate(row.candidate)).length,
      retryable: candidateRows.filter((row) => isRetryableSourcePackCandidate(row.candidate)).length,
      unretryable: candidateRows.filter((row) => isUnretryableSourcePackCandidate(row.candidate)).length,
      operationalStates: candidateRows.reduce<Record<string, number>>((counts, row) => {
        const state = sourceHealthOperationalState(row.candidate, row.activeRow, row.receipt);
        counts[state] = (counts[state] ?? 0) + 1;
        return counts;
      }, { canary: 0, active: 0, paused: 0, failed: 0, blocked: 0 })
    },
    sourcePackGrowthDeltas: {
      packCount: packs.length,
      candidateCount: candidateRows.length,
      activeSourceRows: activeRows.length,
      queuedCollectionReceipts: receipts.filter((receipt) => receipt.status === "queued").length,
      duplicateCollectionReceipts: receipts.filter((receipt) => receipt.status === "duplicate").length,
      retryScheduledJobs: queueRecords.filter((record) => record.status === "retry_scheduled").length
    },
    lastWorkerReceipt: lastWorkerReceipt ? redactedWorkerReceipt(lastWorkerReceipt) : undefined,
    packHealthRollups: packs.map((pack) => ({
      sourcePackId: pack.id,
      safeRef: stableId("dwm_source_pack_ref", pack.id),
      ...sourcePackHealthRollup(pack, { generatedAt: input.generatedAt })
    })),
    typedBlockers,
    safeOutput: {
      rawUnsafeRowsStored: false,
      rawTargetsExposed: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function buildDwmSourceOperationsReadinessSnapshot(
  packs: SourcePackRegistry[],
  options: ApiServerOptions,
  input: { freshness: string; staleAfterMinutes: number; generatedAt: string; sourceHealth: Record<string, any> }
) {
  const packIds = new Set(packs.map((pack) => pack.id));
  const activeRows = sourcePackActiveSourceStore(options).list().filter((row) => packIds.has(row.packId));
  const receipts = sourcePackCollectionReceiptStore(options).list().filter((receipt) => packIds.has(receipt.packId));
  const sources = options.store.listSources().filter((source) => packIds.has(String(sourceCandidate(source).sourcePackId ?? source.metadata?.sourcePack?.packId ?? "")));
  const candidateRows = packs.flatMap((pack) => pack.candidates.map((candidate) => ({
    pack,
    candidate,
    source: candidate.sourceId ? sources.find((source) => source.id === candidate.sourceId) : undefined,
    receipt: receipts.find((receipt) => receipt.candidateId === candidate.id)
  })));
  const duplicateRows = candidateRows.filter((row) => isDuplicateSourcePackCandidate(row.candidate));
  const suppressedDuplicateRows = duplicateRows.filter((row) => row.candidate.status === "suppressed" || row.candidate.decision === "suppressed_duplicate");
  const policyRejectedRows = candidateRows.filter((row) => isRejectedPolicySourcePackCandidate(row.candidate));
  const retryableRows = candidateRows.filter((row) => isRetryableSourcePackCandidate(row.candidate) || Boolean(row.source?.metadata?.lastCollectionOutcome?.retryAfter));
  const activationReadyRows = candidateRows.filter((row) => row.source && !isDuplicateSourcePackCandidate(row.candidate) && !isRejectedPolicySourcePackCandidate(row.candidate) && row.source.status !== "active");
  const parserFailureRows = candidateRows.filter((row) => row.candidate.failure || String(row.candidate.parserStatus ?? "").includes("failed") || String(row.candidate.parserStatus ?? "").includes("blocked") || String(row.candidate.parserStatus ?? "").includes("retry"));
  const latestAudit = packs
    .flatMap((pack) => pack.audit.map((event) => ({ pack, event })))
    .sort((a, b) => String(b.event.at ?? "").localeCompare(String(a.event.at ?? "")))
    .slice(0, 12);
  const lastActionIds = latestAudit.map(({ pack, event }) => stableId("dwm_source_pack_action_event", `${pack.id}:${String(event.at ?? "")}:${String(event.action ?? "")}:${String(event.candidateId ?? "")}`));
  const nextOperatorActions = buildDwmSourceOperationsNextActions({ candidateRows, freshness: input.freshness, staleAfterMinutes: input.staleAfterMinutes });
  const typedBlockers = buildDwmSourceOperationsTypedBlockers({ packs, candidateRows, sourceHealth: input.sourceHealth, freshness: input.freshness, staleAfterMinutes: input.staleAfterMinutes });
  const byFamily = SOURCE_GROWTH_FAMILIES.reduce<Record<SourceGrowthFamily, Record<string, unknown>>>((acc, family) => {
    const rows = candidateRows.filter((row) => row.candidate.declaredFamily === family);
    acc[family] = {
      candidateCount: rows.length,
      activeSourceCount: rows.filter((row) => row.source?.status === "active" || row.candidate.status === "active" || row.candidate.decision === "approved").length,
      retryableCount: rows.filter((row) => isRetryableSourcePackCandidate(row.candidate) || Boolean(row.source?.metadata?.lastCollectionOutcome?.retryAfter)).length,
      suppressedDuplicateCount: rows.filter((row) => isDuplicateSourcePackCandidate(row.candidate) && (row.candidate.status === "suppressed" || row.candidate.decision === "suppressed_duplicate")).length,
      policyRejectedCount: rows.filter((row) => isRejectedPolicySourcePackCandidate(row.candidate)).length,
      parserFailureCount: rows.filter((row) => row.candidate.failure || String(row.candidate.parserStatus ?? "").includes("failed") || String(row.candidate.parserStatus ?? "").includes("blocked") || String(row.candidate.parserStatus ?? "").includes("retry")).length,
      actionability: {
        canActivate: rows.some((row) => row.source && row.source.status !== "active" && !isDuplicateSourcePackCandidate(row.candidate) && !isRejectedPolicySourcePackCandidate(row.candidate)),
        canRetry: rows.some((row) => isRetryableSourcePackCandidate(row.candidate) || Boolean(row.source?.metadata?.lastCollectionOutcome?.retryAfter)),
        canSuppressDuplicate: rows.some((row) => isDuplicateSourcePackCandidate(row.candidate) && row.candidate.status !== "suppressed" && row.candidate.decision !== "suppressed_duplicate")
      }
    };
    return acc;
  }, {} as Record<SourceGrowthFamily, Record<string, unknown>>);

  return {
    schemaVersion: "dwm.source_operations_readiness.v1",
    generatedAt: input.generatedAt,
    summary: {
      packCount: packs.length,
      candidateCount: candidateRows.length,
      activeSourceCount: activeRows.length,
      parserFailureCount: parserFailureRows.length,
      retryableCount: retryableRows.length,
      suppressedDuplicateCount: suppressedDuplicateRows.length,
      duplicateCount: duplicateRows.length,
      policyRejectedCount: policyRejectedRows.length,
      staleWorker: input.freshness === "stale",
      missingWorker: input.freshness === "missing",
      lastWorkerReceiptPresent: receipts.length > 0
    },
    byFamily,
    actionability: {
      canGrowSources: activationReadyRows.length > 0 || activeRows.length > 0,
      canActivate: activationReadyRows.length > 0,
      canRetry: retryableRows.length > 0,
      canSuppressDuplicates: duplicateRows.length > suppressedDuplicateRows.length,
      canResolvePolicyRejected: policyRejectedRows.length > 0,
      staleWorkerBlocksActions: input.freshness === "stale"
    },
    parserHealth: {
      failureCount: parserFailureRows.length,
      retryableParserFailures: retryableRows.length,
      byFamily: Object.fromEntries(SOURCE_GROWTH_FAMILIES.map((family) => [family, input.sourceHealth.family?.[family]?.parserStatusCounts ?? {}]))
    },
    lastActionIds,
    lastActions: latestAudit.map(({ pack, event }, index) => ({
      id: lastActionIds[index],
      sourcePackId: pack.id,
      safeRef: stableId("dwm_source_pack_ref", pack.id),
      action: String(event.action ?? "unknown"),
      at: event.at,
      candidateId: event.candidateId,
      sourceId: event.sourceId,
      actor: event.actor,
      reason: event.reason
    })),
    nextOperatorActions,
    typedBlockers,
    sourcePackCrudGaps: [
      "org/customer-scoped durable source-pack ownership",
      "bulk source-pack update and archive contracts",
      "operator assignment and approval queue persistence",
      "source-pack import provenance signatures",
      "cross-tenant source dedupe review workflow"
    ],
    safeOutput: {
      rawUnsafeRowsStored: false,
      rawTargetsExposed: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function buildDwmSourcePackCustomerConfigReadiness(
  packs: SourcePackRegistry[],
  options: ApiServerOptions,
  input: {
    generatedAt: string;
    freshness?: string;
    staleAfterMinutes?: number;
    tenantId?: string;
    orgId?: string;
    customerId?: string;
    scope?: string;
    family?: string;
    mode?: "read" | "prepare";
    operation?: DwmSourceRequestBody["configOperation"];
    target?: string;
    operatorRole?: DwmSourceRequestBody["operatorRole"];
    ownerLane?: DwmSourceRequestBody["ownerLane"];
    idempotencyKey?: string;
    auditReason?: string;
  }
) {
  const requestedFamily = input.family?.trim();
  const supportedFamily = !requestedFamily || SOURCE_GROWTH_FAMILIES.includes(requestedFamily as SourceGrowthFamily);
  const filteredPacks = packs;
  const selectedPacks = supportedFamily && requestedFamily
    ? filteredPacks.map((pack) => ({
      ...pack,
      candidates: pack.candidates.filter((candidate) => candidate.declaredFamily === requestedFamily)
    })).filter((pack) => pack.candidates.length > 0)
    : filteredPacks;
  const packIds = new Set(selectedPacks.map((pack) => pack.id));
  const activeRows = sourcePackActiveSourceStore(options).list().filter((row) => packIds.has(row.packId));
  const receipts = sourcePackCollectionReceiptStore(options).list().filter((receipt) => packIds.has(receipt.packId));
  const sources = options.store.listSources().filter((source) => packIds.has(String(sourceCandidate(source).sourcePackId ?? source.metadata?.sourcePack?.packId ?? "")));
  const sourceByCandidateId = new Map(sources.map((source) => [sourceCandidate(source).id, source]));
  const receiptByCandidateId = new Map(receipts.map((receipt) => [receipt.candidateId, receipt]));
  const activeByCandidateId = new Map(activeRows.map((row) => [row.candidateId, row]));
  const latestActionByCandidateId = new Map<string, string>();
  for (const pack of selectedPacks) {
    for (const event of pack.audit) {
      if (!event.candidateId) continue;
      latestActionByCandidateId.set(String(event.candidateId), stableId("dwm_source_pack_action_event", `${pack.id}:${String(event.at ?? "")}:${String(event.action ?? "")}:${String(event.candidateId ?? "")}`));
    }
  }
  const rows = selectedPacks.flatMap((pack) => pack.candidates.map((candidate) => {
    const source = candidate.sourceId ? sources.find((item) => item.id === candidate.sourceId) : sourceByCandidateId.get(candidate.id);
    const configBlockers = sourcePackCustomerConfigBlockers({
      pack,
      candidate,
      source,
      options,
      freshness: input.freshness ?? "missing",
      staleAfterMinutes: input.staleAfterMinutes ?? 120,
      tenantId: input.tenantId,
      orgId: input.orgId,
      customerId: input.customerId,
      scope: input.scope,
      requestedFamily,
      supportedFamily,
      target: input.target,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      auditReason: input.auditReason
    });
    const activeRow = activeByCandidateId.get(candidate.id);
    const receipt = receiptByCandidateId.get(candidate.id);
    const retryable = isRetryableSourcePackCandidate(candidate) || Boolean(source?.metadata?.lastCollectionOutcome?.retryAfter);
    const duplicate = isDuplicateSourcePackCandidate(candidate);
    const policyRejected = isRejectedPolicySourcePackCandidate(candidate);
    const restricted = candidate.declaredFamily === "darkweb_onion" || candidate.declaredFamily === "darkweb_metadata";
    return {
      sourcePackId: pack.id,
      sourcePackLabel: pack.label,
      safeSourcePackRef: stableId("dwm_source_pack_ref", pack.id),
      candidateId: candidate.id,
      sourceId: source?.id ?? candidate.sourceId,
      tenantId: input.tenantId ?? pack.tenantId,
      orgId: input.orgId,
      customerId: input.customerId,
      scope: input.scope ?? pack.scope,
      family: candidate.declaredFamily,
      sourceType: source?.type ?? candidate.type,
      redactedIdentity: candidate.targetRef ?? (source ? safeTargetRef(source.url, sourceGrowthFamilyForSource(source)) : safeTargetRef(candidate.id, candidate.declaredFamily)),
      candidatePolicy: {
        boundary: candidate.policyBoundary,
        validationResult: candidate.validationResult,
        metadataOnly: candidate.policyBoundary?.metadataOnly === true,
        restrictedSource: restricted,
        safeOutput: {
          rawPayloadStored: false,
          rawTargetStored: false,
          privateTelegramContentExposed: false,
          restrictedMetadataLeaked: false
        }
      },
      activationState: source ? activationStateForSource(source) : candidate.activationState ?? candidate.decision ?? candidate.status,
      parserHealth: {
        status: candidate.parserStatus ?? source?.metadata?.sourceCandidate?.parserStatus ?? (source ? parserStatusForSource(source) : "not_scheduled"),
        healthStatus: candidate.healthStatus ?? source?.metadata?.healthStatus ?? "not_tested",
        lastFailure: candidate.failure ? { code: candidate.failure.code, message: candidate.failure.message } : undefined,
        alertGradeEvidenceEligible: activeRow?.alertGradeEvidenceEligible === true
      },
      retryState: {
        retryable,
        retryHint: candidate.retryHint ?? source?.metadata?.lastCollectionOutcome?.retryAfter,
        lastCollectionReceipt: receipt ? redactedWorkerReceipt(receipt) : undefined,
        activationRetryReadiness: sourceActivationRetryReadiness({ candidate, source, receipt, generatedAt: input.generatedAt })
      },
      activationProof: sourceActivationProof({
        pack,
        candidate,
        source,
        receipt,
        activeRow,
        scope: input.scope ?? pack.scope,
        freshness: input.freshness ?? "missing",
        generatedAt: input.generatedAt,
        blockers: configBlockers
      }),
      suppressionState: {
        duplicate,
        suppressed: candidate.status === "suppressed" || candidate.decision === "suppressed_duplicate",
        duplicateOf: candidate.duplicateOf
      },
      auditActionIds: latestActionByCandidateId.get(candidate.id) ? [latestActionByCandidateId.get(candidate.id)] : [],
      crudWorkflow: sourcePackCustomerCrudWorkflow({
        pack,
        candidate,
        source,
        operation: input.operation,
        configBlockers,
        tenantId: input.tenantId,
        orgId: input.orgId,
        customerId: input.customerId,
        scope: input.scope ?? pack.scope,
        target: input.target,
        requestedFamily,
        operatorRole: input.operatorRole,
        ownerLane: input.ownerLane,
        idempotencyKey: input.idempotencyKey,
        auditReason: input.auditReason,
        generatedAt: input.generatedAt
      }),
      allowedOperatorActions: sourcePackCustomerConfigAllowedActions({ pack, candidate, source, configBlockers, retryable, duplicate, policyRejected }),
      typedBlockers: configBlockers
    };
  }));
  const globalBlockers = [
    ...(!input.tenantId && !input.orgId && !input.customerId && !input.scope ? [{ code: "missing_org_scope", severity: "blocking", message: "tenantId, orgId, customerId, or scope is required before durable customer source configuration can mutate", retryable: true }] : []),
    ...(!supportedFamily ? [{ code: "unsupported_source_family", severity: "blocking", family: requestedFamily, message: "requested source family is not supported by source-pack configuration", retryable: false }] : []),
    ...(input.freshness === "stale" ? [{ code: "stale_worker", severity: "blocking", message: `source-pack worker older than ${input.staleAfterMinutes ?? 120} minutes`, retryable: true }] : [])
  ];
  const rowBlockers = rows.flatMap((row) => row.typedBlockers);
  const summary = {
    packCount: selectedPacks.length,
    candidateCount: rows.length,
    configurableCount: rows.filter((row) => !row.typedBlockers.some((blocker: any) => blocker.severity === "blocking")).length,
    activeSourceCount: rows.filter((row) => row.sourceId && (String(row.activationState).includes("active") || row.activationState === "metadata_only_approved")).length,
    retryableCount: rows.filter((row) => row.retryState.retryable).length,
    duplicateCount: rows.filter((row) => row.suppressionState.duplicate).length,
    suppressedDuplicateCount: rows.filter((row) => row.suppressionState.suppressed).length,
    policyRejectedCount: rows.filter((row) => row.typedBlockers.some((blocker: any) => blocker.code === "rejected_policy")).length,
    restrictedSourceCount: rows.filter((row) => row.candidatePolicy.restrictedSource).length,
    cleanupRequiredCount: rows.filter((row) => row.typedBlockers.some((blocker: any) => blocker.code === "cleanup_required")).length,
    staleWorker: input.freshness === "stale",
    mutationReady: false
  };
  const allowedOperatorActions = Array.from(new Set(rows.flatMap((row) => row.allowedOperatorActions.map((action: any) => action.action))));
  return {
    schemaVersion: "dwm.source_pack_customer_config.v1",
    generatedAt: input.generatedAt,
    mode: input.mode ?? "read",
    tenantId: input.tenantId,
    orgId: input.orgId,
    customerId: input.customerId,
    scope: input.scope,
    requestedFamily,
    requestedOperation: input.operation,
    summary,
    readiness: {
      state: globalBlockers.some((blocker) => blocker.severity === "blocking")
        ? "blocked"
        : rows.length === 0
          ? "missing"
          : rowBlockers.some((blocker: any) => blocker.severity === "blocking")
            ? "needs_action"
            : "ready",
      blockers: dedupeBlockers([...globalBlockers, ...rowBlockers])
    },
    allowedOperatorActions: allowedOperatorActions.map((action) => ({ action, route: "/v1/dwm/source-requests", dryRunSupported: true })),
    sourceConfigs: rows,
    futureMutationRoutes: {
      prepare: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: { action: "pack_customer_config", configOperation: input.operation ?? "create|update|disable|enable|test|retry|suppress", dryRun: true, tenantId: input.tenantId ?? "<tenant-id>", orgId: input.orgId ?? "<org-id>", sourcePackId: "<source-pack-id>", family: requestedFamily ?? "<source-family>", target: input.target ?? "<redacted-source-ref>" }
      },
      applyCandidateAction: {
        status: "use_existing_pack_review_until_customer_config_mutation_exists",
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: { action: "pack_review", packAction: "approve|retry|suppress|reject", tenantId: input.tenantId ?? "<tenant-id>", candidateIds: ["<candidate-id>"], decidedBy: "<operator-id>", reason: "<change-ticket>" }
      },
      futureCrud: {
        status: "not_implemented",
        method: "PATCH",
        path: "/v1/dwm/customer-source-packs/<org-id>/<source-pack-id>",
        body: { activationState: "active|disabled|suppressed", parserPolicy: "<parser-mode>", retryPolicy: "<backoff-window>", auditReason: "<change-ticket>" }
      }
    },
    safeOutput: {
      rawUnsafeRowsStored: false,
      rawTargetsExposed: false,
      rawRejectedTargetsStored: false,
      rawDuplicateTargetsStored: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function buildDwmSourceReadinessArtifact(
  sourceCustomerConfig: Record<string, any>,
  input: { generatedAt: string; scope?: string; tenantId?: string; orgId?: string; customerId?: string }
) {
  const sourceConfigs = Array.isArray(sourceCustomerConfig.sourceConfigs) ? sourceCustomerConfig.sourceConfigs : [];
  const activationProofs = sourceConfigs
    .map((row: any) => row.activationProof)
    .filter(Boolean);
  const scopeTerms = String(input.scope ?? sourceCustomerConfig.scope ?? "")
    .split(/[,\n]/)
    .map((term) => term.trim())
    .filter(Boolean);
  const watchlistTerms = uniqueSourceReadinessStrings([
    ...scopeTerms,
    ...activationProofs.flatMap((proof: any) => proof.alertability?.watchlistTerms ?? []),
    ...activationProofs.flatMap((proof: any) => proof.actorEnrichment?.watchlistTerms ?? [])
  ]);
  const activeProofs = activationProofs.filter((proof: any) => proof.state === "active" || proof.state === "canary");
  const alertCapableProofs = activeProofs.filter((proof: any) => proof.alertability?.canProduceAlert === true);
  const enrichmentCapableProofs = activeProofs.filter((proof: any) => proof.actorEnrichment?.canEnrichActor === true);
  const sourceFamilyReadiness = SOURCE_GROWTH_FAMILIES.map((family) => {
    const familyConfigs = sourceConfigs.filter((row: any) => row.family === family);
    const familyProofs = activationProofs.filter((proof: any) => proof.family === family);
    const blockers = uniqueSourceReadinessBlockers(familyProofs.flatMap((proof: any) => [
      ...(proof.activationBlockers ?? []),
      ...(proof.actorEnrichment?.blockers ?? [])
    ]));
    const latestCaptureAtForFamily = latestIso(familyProofs.flatMap((proof: any) => [
      proof.retryReadiness?.lastRun?.status === "capture_observed" ? proof.retryReadiness?.lastRun?.at : undefined,
      proof.retryReadiness?.lastRun?.status === "completed" ? proof.retryReadiness?.lastRun?.at : undefined
    ]));
    const canEnrichActor = familyProofs.some((proof: any) => proof.actorEnrichment?.canEnrichActor === true);
    const canProduceAlert = familyProofs.some((proof: any) => proof.alertability?.canProduceAlert === true);
    return {
      family,
      candidateIds: uniqueSourceReadinessStrings(familyProofs.map((proof: any) => proof.candidateId).filter(Boolean)),
      sourceIds: uniqueSourceReadinessStrings(familyProofs.map((proof: any) => proof.sourceId).filter(Boolean)),
      candidateCount: familyProofs.length,
      active: familyProofs.filter((proof: any) => proof.state === "active").length,
      canary: familyProofs.filter((proof: any) => proof.state === "canary").length,
      paused: familyProofs.filter((proof: any) => proof.state === "paused").length,
      failed: familyProofs.filter((proof: any) => proof.state === "failed").length,
      blocked: familyProofs.filter((proof: any) => proof.state === "blocked").length,
      policyBlocked: familyProofs.filter((proof: any) => proof.policyResult?.allowed === false || proof.state === "blocked").length,
      operationalStates: sourceReadinessStateCounts(familyProofs),
      canEnrichActor,
      canProduceAlert,
      matchableFields: uniqueSourceReadinessStrings(familyProofs.flatMap((proof: any) => proof.actorEnrichment?.watchlistMatchFields ?? [])),
      alertableFields: uniqueSourceReadinessStrings(familyProofs.flatMap((proof: any) => proof.alertability?.alertableFields ?? [])),
      actorSignals: uniqueSourceReadinessStrings(familyProofs.flatMap((proof: any) => proof.actorEnrichment?.actorSignals ?? [])),
      parserStatuses: uniqueSourceReadinessStrings(familyProofs.map((proof: any) => proof.parserAvailability?.status).filter(Boolean)),
      expectedCaptureTypes: uniqueSourceReadinessStrings(familyProofs.map((proof: any) => proof.expectedCapture?.type).filter(Boolean)),
      lastCaptureAt: latestCaptureAtForFamily,
      lastEnrichmentAt: canEnrichActor ? input.generatedAt : undefined,
      retryBackoff: sourceReadinessRetryBackoff(familyConfigs),
      privacyBoundary: sourceReadinessPrivacyBoundary(familyProofs),
      sourceTrust: sourceTrustForFamily(family, familyProofs),
      blockers
    };
  });
  const activeSourceFamilies = uniqueSourceReadinessStrings(alertCapableProofs.map((proof: any) => proof.family));
  const enrichableSourceFamilies = uniqueSourceReadinessStrings(enrichmentCapableProofs.map((proof: any) => proof.family));
  const pausedSourceFamilies = uniqueSourceReadinessStrings(activationProofs.filter((proof: any) => proof.state === "paused").map((proof: any) => proof.family));
  const failedSourceFamilies = uniqueSourceReadinessStrings(activationProofs.filter((proof: any) => proof.state === "failed").map((proof: any) => proof.family));
  const blockedSourceFamilies = uniqueSourceReadinessStrings(activationProofs.filter((proof: any) => proof.state === "blocked").map((proof: any) => proof.family));
  const missingCoverage = sourceFamilyReadiness
    .filter((row) => row.candidateCount === 0 || (!row.canEnrichActor && !row.canProduceAlert))
    .map((row) => ({
      family: row.family,
      reason: row.candidateCount === 0 ? "no_candidate_or_source" : "source_not_alert_or_enrichment_ready",
      blockers: row.blockers
    }));
  const latestCaptureAt = latestIso(activationProofs.flatMap((proof: any) => [
    proof.retryReadiness?.lastRun?.status === "capture_observed" ? proof.retryReadiness?.lastRun?.at : undefined,
    proof.retryReadiness?.lastRun?.status === "completed" ? proof.retryReadiness?.lastRun?.at : undefined
  ]));
  const actorCoverage = (watchlistTerms.length > 0 ? watchlistTerms : ["default_watchlist_scope"]).map((watchlistTerm) => ({
    watchlistTerm,
    enrichableSourceFamilies,
    activeSourceFamilies,
    missingCoverage,
    actorSections: sourceReadinessActorSections(enrichmentCapableProofs),
    actorSignals: uniqueSourceReadinessStrings(enrichmentCapableProofs.flatMap((proof: any) => proof.actorEnrichment?.actorSignals ?? [])),
    watchlistMatchFields: uniqueSourceReadinessStrings(enrichmentCapableProofs.flatMap((proof: any) => proof.actorEnrichment?.watchlistMatchFields ?? [])),
    alertableFields: uniqueSourceReadinessStrings(alertCapableProofs.flatMap((proof: any) => proof.alertability?.alertableFields ?? [])),
    lastSuccessfulCaptureAt: latestCaptureAt,
    lastSuccessfulEnrichmentAt: enrichmentCapableProofs.length > 0 ? input.generatedAt : undefined,
    blockers: uniqueSourceReadinessBlockers(activationProofs.flatMap((proof: any) => [
      ...(proof.activationBlockers ?? []),
      ...(proof.actorEnrichment?.blockers ?? [])
    ]))
  }));
  return {
    schemaVersion: "dwm.source_readiness_artifact.v1",
    generatedAt: input.generatedAt,
    tenantId: input.tenantId ?? sourceCustomerConfig.tenantId,
    orgId: input.orgId ?? sourceCustomerConfig.orgId,
    customerId: input.customerId ?? sourceCustomerConfig.customerId,
    scope: input.scope ?? sourceCustomerConfig.scope,
    sourceFamilyReadiness,
    actorCoverage,
    sharedWatchlistAlertability: {
      activeSourceFamilies,
      enrichableSourceFamilies,
      pausedSourceFamilies,
      failedSourceFamilies,
      blockedSourceFamilies,
      matchableFields: uniqueSourceReadinessStrings([
        ...alertCapableProofs.flatMap((proof: any) => proof.alertability?.alertableFields ?? []),
        ...enrichmentCapableProofs.flatMap((proof: any) => proof.actorEnrichment?.watchlistMatchFields ?? [])
      ]),
      watchlistTerms,
      sourceTrust: sourceReadinessTrustRollup(sourceFamilyReadiness),
      blockers: uniqueSourceReadinessBlockers(sourceFamilyReadiness.flatMap((row) => row.blockers)),
      blockerReasons: uniqueSourceReadinessStrings(sourceFamilyReadiness.flatMap((row) => row.blockers.map((blocker) => blocker.code))),
      sourcePolicyLimits: sourceReadinessPolicyLimits(activationProofs)
    },
    readinessLedgerRows: sourceReadinessLedgerRows({
      generatedAt: input.generatedAt,
      scope: input.scope ?? sourceCustomerConfig.scope,
      watchlistTerms,
      sourceFamilyReadiness
    }),
    lastHealthProof: {
      sourceConfigCount: sourceConfigs.length,
      canaryCount: activationProofs.filter((proof: any) => proof.state === "canary").length,
      activeCount: activationProofs.filter((proof: any) => proof.state === "active").length,
      pausedCount: pausedSourceFamilies.length,
      failedCount: failedSourceFamilies.length,
      blockedCount: blockedSourceFamilies.length,
      sourceCustomerConfigReadiness: sourceCustomerConfig.readiness?.state,
      generatedAt: input.generatedAt
    },
    safeOutput: {
      rawTargetsExposed: false,
      rawUnsafeRowsStored: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function sourceReadinessStateCounts(activationProofs: Array<Record<string, any>>) {
  return activationProofs.reduce<Record<string, number>>((acc, proof) => {
    const state = String(proof.state ?? "unknown");
    acc[state] = (acc[state] ?? 0) + 1;
    return acc;
  }, { active: 0, canary: 0, paused: 0, failed: 0, blocked: 0 });
}

function sourceReadinessRetryBackoff(sourceConfigs: Array<Record<string, any>>) {
  const retryStates = sourceConfigs
    .map((row) => row.retryState?.activationRetryReadiness ?? row.retryState)
    .filter(Boolean);
  const retryable = retryStates.some((state) => state.retryable === true);
  const nextRetryAt = latestIso(retryStates.map((state) => state.nextRetryAt ?? state.retryHint));
  const failureCategories = uniqueSourceReadinessStrings(retryStates.map((state) => state.failureCategory).filter(Boolean));
  return {
    retryable,
    nextRetryAt,
    failureCategories,
    backoffSeconds: retryStates.map((state) => state.backoffSeconds).find((value) => Number.isFinite(value)),
    lastRunStatuses: uniqueSourceReadinessStrings(retryStates.map((state) => state.lastRun?.status).filter(Boolean))
  };
}

function sourceReadinessPrivacyBoundary(activationProofs: Array<Record<string, any>>) {
  return {
    publicOnly: activationProofs.every((proof) => proof.policyResult?.publicOnly === true || proof.policyResult?.metadataOnly === true),
    metadataOnly: activationProofs.some((proof) => proof.policyResult?.metadataOnly === true),
    restrictedSource: activationProofs.some((proof) => proof.policyResult?.category === "restricted_metadata_only" || proof.policyResult?.category === "policy_rejected"),
    noPrivateTelegram: activationProofs.every((proof) => proof.credentialBoundary?.noPrivateAccess !== false),
    noAutoJoin: activationProofs.every((proof) => proof.credentialBoundary?.noAutoJoin !== false),
    noCredentials: activationProofs.every((proof) => proof.credentialBoundary?.noCredentialCollection !== false),
    noRepliesReactionsOrMediaDownloads: true,
    restrictedPayloadStored: false,
    liveNetworkRequiredForProof: false
  };
}

function sourceTrustForFamily(family: SourceGrowthFamily, activationProofs: Array<Record<string, any>>) {
  const policyBlocked = activationProofs.some((proof) => proof.policyResult?.allowed === false || proof.state === "blocked");
  const parserFailed = activationProofs.some((proof) => proof.state === "failed" || proof.parserAvailability?.available === false);
  const activeOrCanary = activationProofs.some((proof) => proof.state === "active" || proof.state === "canary");
  const tier = policyBlocked
    ? "blocked"
    : parserFailed
      ? "degraded"
      : family === "public_advisory" || family === "actor_page"
        ? "high"
        : activeOrCanary
          ? "medium"
          : "pending";
  return {
    tier,
    score: tier === "high" ? 0.9 : tier === "medium" ? 0.72 : tier === "degraded" ? 0.42 : tier === "pending" ? 0.25 : 0,
    reason: tier === "blocked"
      ? "policy blocked"
      : tier === "degraded"
        ? "parser or collection retry required"
        : tier === "high"
          ? "public attribution or actor metadata source"
          : activeOrCanary
            ? "active bounded source with safe policy boundary"
            : "candidate exists but is not active"
  };
}

function sourceReadinessActorSections(activationProofs: Array<Record<string, any>>) {
  const sections = ["overview", "infrastructure", "targeting", "evidence", "freshness"];
  const familiesBySection = Object.fromEntries(sections.map((section) => [section, [] as string[]])) as Record<string, string[]>;
  for (const proof of activationProofs) {
    for (const section of actorSectionsForFamily(proof.family)) {
      familiesBySection[section] = uniqueSourceReadinessStrings([...(familiesBySection[section] ?? []), proof.family]);
    }
  }
  return Object.fromEntries(sections.map((section) => [section, {
    covered: (familiesBySection[section] ?? []).length > 0,
    sourceFamilies: familiesBySection[section] ?? [],
    blockers: (familiesBySection[section] ?? []).length > 0 ? [] : [{ code: "missing_source_family", severity: "warning", section, retryable: true }]
  }]));
}

function actorSectionsForFamily(family: string): string[] {
  if (family === "telegram") return ["overview", "evidence", "freshness"];
  if (family === "darkweb_onion" || family === "darkweb_metadata") return ["infrastructure", "targeting", "evidence", "freshness"];
  if (family === "public_advisory") return ["overview", "infrastructure", "targeting", "evidence", "freshness"];
  if (family === "actor_page") return ["overview", "infrastructure", "targeting", "freshness"];
  if (family === "clear_web") return ["overview", "evidence", "freshness"];
  return [];
}

function sourceReadinessTrustRollup(sourceFamilyReadiness: Array<Record<string, any>>) {
  const byFamily = Object.fromEntries(sourceFamilyReadiness.map((row) => [row.family, row.sourceTrust]));
  const activeScores = sourceFamilyReadiness
    .filter((row) => row.canProduceAlert || row.canEnrichActor)
    .map((row) => Number(row.sourceTrust?.score ?? 0))
    .filter((score) => Number.isFinite(score));
  const averageScore = activeScores.length > 0
    ? Math.round((activeScores.reduce((sum, score) => sum + score, 0) / activeScores.length) * 100) / 100
    : 0;
  return { averageScore, byFamily };
}

function sourceReadinessLedgerRows(input: {
  generatedAt: string;
  scope?: string;
  watchlistTerms: string[];
  sourceFamilyReadiness: Array<Record<string, any>>;
}) {
  return input.sourceFamilyReadiness.map((row) => ({
    id: stableId("dwm_source_readiness_ledger", `${input.scope ?? "global"}:${row.family}:${input.generatedAt}`),
    generatedAt: input.generatedAt,
    scope: input.scope,
    watchlistTerms: input.watchlistTerms,
    family: row.family,
    candidateIds: row.candidateIds ?? [],
    sourceIds: row.sourceIds ?? [],
    state: row.active > 0 ? "active" : row.canary > 0 ? "canary" : row.failed > 0 ? "failed" : row.blocked > 0 ? "policy_blocked" : row.paused > 0 ? "paused" : "missing",
    canEnrichActor: row.canEnrichActor,
    canProduceAlert: row.canProduceAlert,
    matchableFields: row.matchableFields,
    alertableFields: row.alertableFields,
    lastCaptureAt: row.lastCaptureAt,
    lastEnrichmentAt: row.lastEnrichmentAt,
    retryBackoff: row.retryBackoff,
    privacyBoundary: row.privacyBoundary,
    sourceTrust: row.sourceTrust,
    blockerCodes: uniqueSourceReadinessStrings(row.blockers.map((blocker: any) => blocker.code)),
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  }));
}

function uniqueSourceReadinessStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function uniqueSourceReadinessObjects<T>(values: T[], keyFor: (value: T) => string): T[] {
  return Array.from(new Map(values.map((value) => [keyFor(value), value])).values());
}

function uniqueSourceReadinessBlockers(blockers: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return dedupeBlockers(blockers.map((blocker) => ({
    code: blocker.code ?? "unknown_blocker",
    severity: blocker.severity ?? "warning",
    family: blocker.family,
    retryable: blocker.retryable
  })));
}

function latestIso(values: unknown[]): string | undefined {
  return values
    .map((value) => String(value ?? ""))
    .filter(Boolean)
    .sort()
    .at(-1);
}

function sourceReadinessPolicyLimits(activationProofs: Array<Record<string, any>>) {
  return uniqueSourceReadinessBlockers(activationProofs.map((proof) => {
    const family = String(proof.family ?? "unknown");
    if (family === "telegram") {
      return { code: "public_telegram_only", severity: "info", family, retryable: false };
    }
    if (family === "darkweb_onion" || family === "darkweb_metadata") {
      return { code: "metadata_only_restricted_source", severity: "warning", family, retryable: false };
    }
    return { code: "public_metadata_only", severity: "info", family, retryable: false };
  }));
}

function sourcePackCustomerConfigBlockers(input: {
  pack: SourcePackRegistry;
  candidate: SourcePackRegistryCandidate;
  source?: SourceRecord;
  options: ApiServerOptions;
  freshness: string;
  staleAfterMinutes: number;
  tenantId?: string;
  orgId?: string;
  customerId?: string;
  scope?: string;
  requestedFamily?: string;
  supportedFamily: boolean;
  target?: string;
  operation?: DwmSourceRequestBody["configOperation"];
  idempotencyKey?: string;
  auditReason?: string;
}) {
  const blockers: Array<Record<string, unknown>> = [];
  if (!input.tenantId && !input.orgId && !input.customerId && !input.scope) blockers.push({ code: "missing_org_scope", severity: "blocking", retryable: true });
  if (!input.supportedFamily) blockers.push({ code: "unsupported_source_family", severity: "blocking", family: input.requestedFamily, retryable: false });
  if (!SOURCE_GROWTH_FAMILIES.includes(input.candidate.declaredFamily)) blockers.push({ code: "unsupported_source_family", severity: "blocking", family: input.candidate.declaredFamily, retryable: false });
  if (input.target && sourcePackCustomerTargetInvalid(input.target, input.requestedFamily ?? input.candidate.declaredFamily)) blockers.push({ code: "invalid_source_ref", severity: "blocking", family: input.requestedFamily ?? input.candidate.declaredFamily, retryable: false });
  if (input.freshness === "stale") blockers.push({ code: "stale_worker", severity: "blocking", retryable: true });
  if (isDuplicateSourcePackCandidate(input.candidate)) {
    blockers.push({ code: "duplicate_source", severity: "blocking", duplicateOf: input.candidate.duplicateOf, retryable: false });
    blockers.push({ code: "idempotency_duplicate", severity: "warning", idempotencyKey: stableId("dwm_customer_source_config", `${input.pack.id}:${input.candidate.id}:${input.operation ?? "prepare"}`), retryable: false });
  }
  if (input.source?.status === "active" && (input.operation === "create" || input.operation === "enable")) blockers.push({ code: "duplicate_active_source", severity: "blocking", sourceId: input.source.id, retryable: false });
  if (isRejectedPolicySourcePackCandidate(input.candidate)) blockers.push({ code: "rejected_policy", severity: "blocking", reason: input.candidate.reason ?? input.candidate.failure?.message, retryable: false });
  if (input.candidate.failure || String(input.candidate.parserStatus ?? "").includes("failed") || String(input.candidate.parserStatus ?? "").includes("blocked")) {
    blockers.push({ code: "parser_failure", severity: isRetryableSourcePackCandidate(input.candidate) ? "warning" : "blocking", parserStatus: input.candidate.parserStatus, retryable: isRetryableSourcePackCandidate(input.candidate) });
  }
  if ((input.candidate.declaredFamily === "darkweb_onion" || input.candidate.declaredFamily === "darkweb_metadata") && input.candidate.policyBoundary?.metadataOnly !== true) {
    blockers.push({ code: "restricted_source", severity: "blocking", message: "restricted/onion source can only be configured as governed metadata-only", retryable: false });
  }
  if (input.candidate.declaredFamily === "darkweb_onion" || input.candidate.declaredFamily === "darkweb_metadata") {
    blockers.push({ code: "restricted_source", severity: input.candidate.policyBoundary?.metadataOnly === true ? "warning" : "blocking", message: "restricted source remains metadata-only and cannot trigger live scraping", retryable: false });
  }
  if (!input.source && !isDuplicateSourcePackCandidate(input.candidate) && !isRejectedPolicySourcePackCandidate(input.candidate) && input.candidate.status !== "retry_scheduled") {
    blockers.push({ code: "activation_disabled", severity: "warning", retryable: true });
  }
  if ((isRetryableSourcePackCandidate(input.candidate) || input.source?.metadata?.lastCollectionOutcome?.retryAfter) && !input.source && input.candidate.status !== "retry_scheduled") {
    blockers.push({ code: "no_retry_eligibility", severity: "blocking", retryable: false });
  }
  if ((input.operation === "test" || input.operation === "enable" || input.operation === "disable") && !input.source) blockers.push({ code: "activation_disabled", severity: "blocking", message: "operation requires a persisted source row", retryable: false });
  if (!input.auditReason) blockers.push({ code: "audit_unavailable", severity: "warning", message: "durable customer CRUD will require an audit reason or change ticket", retryable: true });
  const coverage = sourceFamilyCoverage({ sources: sourcesForPack(input.pack.id, input.options), registry: input.pack });
  const familyCoverage = coverage[input.candidate.declaredFamily];
  if (familyCoverage?.total > 0 && familyCoverage.active === 0) blockers.push({ code: "source_family_inactive", severity: "warning", family: input.candidate.declaredFamily, retryable: true });
  if ((isDuplicateSourcePackCandidate(input.candidate) && input.candidate.status !== "suppressed") || isRejectedPolicySourcePackCandidate(input.candidate)) {
    blockers.push({ code: "cleanup_required", severity: "warning", message: "candidate requires suppression, rejection review, or cleanup before customer config can apply", retryable: true });
  }
  return dedupeBlockers(blockers);
}

function sourcePackCustomerTargetInvalid(target: string, family: string): boolean {
  const trimmed = target.trim();
  if (!trimmed) return true;
  if (family === "telegram") return !parseTelegramTarget(trimmed).channel;
  if (family === "darkweb_onion" || family === "darkweb_metadata") return !trimmed.startsWith("metadata://");
  if (family === "clear_web" || family === "public_advisory" || family === "actor_page") return !/^https?:\/\//i.test(trimmed);
  return true;
}

function sourceActivationProof(input: {
  pack: SourcePackRegistry;
  candidate: SourcePackRegistryCandidate;
  source?: SourceRecord;
  receipt?: DwmSourcePackCollectionQueueReceiptRecord;
  activeRow?: { alertGradeEvidenceEligible?: boolean; parserStatus?: string };
  scope?: string;
  freshness: string;
  generatedAt: string;
  blockers: Array<Record<string, unknown>>;
}) {
  const family = input.candidate.declaredFamily;
  const state = sourceOperationalState(input.source, input.candidate, input.receipt);
  const policy = sourceActivationPolicyResult(input.candidate, input.source);
  const sourceCandidateMetadata = input.source ? sourceCandidate(input.source) : undefined;
  const parserStatus = sourceCandidateMetadata?.parserStatus
    ?? input.source?.metadata?.parserStatus
    ?? input.candidate.parserStatus
    ?? input.activeRow?.parserStatus
    ?? (input.source ? parserStatusForSource(input.source) : "not_scheduled");
  const parserAvailable = !String(parserStatus).includes("blocked") && !String(parserStatus).includes("failed") && !String(parserStatus).includes("retry") && !isRejectedPolicySourcePackCandidate(input.candidate);
  const captureType = expectedCaptureTypeForFamily(family);
  const alertableFields = alertableFieldsForFamily(family);
  const watchlistTerms = String(input.scope ?? "").split(/[,\n]/).map((term) => term.trim()).filter(Boolean);
  const blocking = input.blockers.filter((blocker) => blocker.severity === "blocking");
  const canProduceCapture = Boolean(input.source) && parserAvailable && policy.allowed && state !== "blocked" && state !== "failed" && state !== "paused";
  const canProduceAlert = canProduceCapture && alertableFields.length > 0 && (input.activeRow?.alertGradeEvidenceEligible === true || input.source?.status === "active");
  const actorEnrichment = sourceActorEnrichmentReadiness({ family, watchlistTerms, state, parserAvailable, policyAllowed: policy.allowed, blockers: blocking });
  return {
    schemaVersion: "dwm.source_activation_proof.v1",
    generatedAt: input.generatedAt,
    sourcePackId: input.pack.id,
    candidateId: input.candidate.id,
    sourceId: input.source?.id ?? input.candidate.sourceId,
    family,
    state,
    policyResult: policy,
    credentialBoundary: input.candidate.policyBoundary ?? (family === "telegram" ? publicTelegramBoundary() : family === "darkweb_onion" || family === "darkweb_metadata" ? restrictedMetadataBoundary() : publicWebMetadataBoundary()),
    parserAvailability: {
      available: parserAvailable,
      status: parserStatus,
      profile: parserProfileForFamily(family),
      freshness: input.freshness
    },
    expectedCapture: {
      type: captureType,
      storage: family === "telegram" ? "inline_text_metadata" : "metadata_only",
      liveNetworkRequiredForProof: false,
      restrictedPayloadStored: false
    },
    alertability: {
      canProduceCapture,
      canProduceAlert,
      alertableFields,
      watchlistTerms,
      requiresCaptureBeforeAlert: true,
      bridge: {
        schemaVersion: "dwm.source_alertability_bridge.v1",
        activeSourceId: input.source?.status === "active" ? input.source.id : undefined,
        sourcePackId: input.pack.id,
        candidateId: input.candidate.id,
        satisfiedByFields: alertableFields,
        watchlistTerms,
        alertGenerationPath: "/v1/dwm/source-requests?action=record_capture -> /v1/dwm/alerts/rebuild"
      }
    },
    actorEnrichment,
    activationBlockers: blocking,
    retryReadiness: sourceActivationRetryReadiness({ candidate: input.candidate, source: input.source, receipt: input.receipt, generatedAt: input.generatedAt }),
    safeOutput: {
      rawTargetsExposed: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function sourceActivationPolicyResult(candidate: SourcePackRegistryCandidate, source?: SourceRecord) {
  if (isRejectedPolicySourcePackCandidate(candidate)) {
    return { allowed: false, category: "policy_rejected", reason: candidate.reason ?? candidate.failure?.message ?? "candidate rejected by policy", publicOnly: false, metadataOnly: candidate.policyBoundary?.metadataOnly === true };
  }
  if (candidate.declaredFamily === "darkweb_onion" || candidate.declaredFamily === "darkweb_metadata" || (source ? isRestrictedMetadataSource(source) : false)) {
    return { allowed: candidate.policyBoundary?.metadataOnly === true, category: "restricted_metadata_only", reason: "restricted source is metadata-only and cannot trigger unsafe scraping", publicOnly: false, metadataOnly: true };
  }
  if (candidate.declaredFamily === "telegram") {
    return { allowed: true, category: "public_telegram_only", reason: "public Telegram preview boundary; no private access, auto-join, credentials, replies, reactions, or media downloads", publicOnly: true, metadataOnly: false };
  }
  return { allowed: true, category: "public_ti_metadata", reason: "public TI/blog/advisory metadata-only boundary", publicOnly: true, metadataOnly: true };
}

function sourceOperationalState(source: SourceRecord | undefined, candidate: SourcePackRegistryCandidate, receipt?: DwmSourcePackCollectionQueueReceiptRecord): "canary" | "active" | "paused" | "failed" | "blocked" {
  const sourceCandidateMetadata = source ? sourceCandidate(source) : undefined;
  const parserStatus = sourceCandidateMetadata?.parserStatus ?? source?.metadata?.parserStatus ?? candidate.parserStatus;
  const lastCollectionOutcome = sourceCandidateMetadata?.lastCollectionOutcome ?? source?.metadata?.lastCollectionOutcome;
  if (isRejectedPolicySourcePackCandidate(candidate) || candidate.status === "disabled") return "blocked";
  if (candidate.failure || lastCollectionOutcome?.status === "failed" || String(parserStatus ?? "").includes("failed") || String(parserStatus ?? "").includes("retry") || receipt?.status === "blocked") return "failed";
  if (source?.status === "active" && source.metadata?.canaryPortfolio === true) return "canary";
  if (source?.status === "active") return "active";
  if (source?.status === "suppressed" || candidate.status === "suppressed") return "paused";
  if (candidate.status === "retry_scheduled") return "failed";
  return "paused";
}

function sourceHealthOperationalState(
  candidate: SourcePackRegistryCandidate,
  activeRow?: { alertGradeEvidenceEligible?: boolean; parserStatus?: string },
  receipt?: DwmSourcePackCollectionQueueReceiptRecord
): "canary" | "active" | "paused" | "failed" | "blocked" {
  if (isRejectedPolicySourcePackCandidate(candidate) || candidate.status === "disabled") return "blocked";
  if (candidate.failure || (candidate as any).lastCollectionOutcome?.status === "failed" || receipt?.status === "blocked" || String(candidate.parserStatus ?? "").includes("failed") || String(candidate.parserStatus ?? "").includes("retry")) return "failed";
  if (activeRow && candidate.status === "active") return "canary";
  if (activeRow) return "active";
  if (candidate.status === "retry_scheduled" || String(candidate.parserStatus ?? "").includes("retry")) return "failed";
  return "paused";
}

function expectedCaptureTypeForFamily(family: SourceGrowthFamily): string {
  if (family === "telegram") return "telegram_public_message_preview";
  if (family === "darkweb_onion") return "darkweb_onion_metadata_observation";
  if (family === "darkweb_metadata") return "darkweb_metadata_observation";
  if (family === "actor_page") return "actor_page_metadata";
  if (family === "public_advisory") return "public_advisory_metadata";
  return "clear_web_metadata";
}

function alertableFieldsForFamily(family: SourceGrowthFamily): string[] {
  if (family === "telegram") return ["text", "channel", "publishedAt", "urls", "actorHints", "victimHints"];
  if (family === "darkweb_onion" || family === "darkweb_metadata") return ["title", "actorHandle", "marketplace", "publishedAt", "victimHints", "claimType"];
  if (family === "actor_page") return ["title", "actorName", "aliases", "ttps", "targetSectors"];
  if (family === "public_advisory") return ["title", "vendor", "cve", "publishedAt", "ttps", "affectedProducts"];
  return ["title", "url", "publishedAt", "extractedTerms"];
}

function sourceActorEnrichmentReadiness(input: {
  family: SourceGrowthFamily;
  watchlistTerms: string[];
  state: "canary" | "active" | "paused" | "failed" | "blocked";
  parserAvailable: boolean;
  policyAllowed: boolean;
  blockers: Array<Record<string, unknown>>;
}) {
  const enrichmentFields = actorEnrichmentFieldsForFamily(input.family);
  const canEnrichActor = input.policyAllowed
    && input.parserAvailable
    && input.state !== "paused"
    && input.state !== "failed"
    && input.state !== "blocked"
    && enrichmentFields.length > 0;
  return {
    schemaVersion: "dwm.actor_source_enrichment_readiness.v1",
    canEnrichActor,
    sourceFamily: input.family,
    actorSignals: enrichmentFields,
    watchlistMatchFields: watchlistMatchFieldsForFamily(input.family),
    watchlistTerms: input.watchlistTerms,
    enrichmentPath: "/v1/dwm/source-requests?action=record_capture -> actor overview/product snapshot",
    blockers: [
      ...(input.state === "paused" ? [{ code: "paused_source", severity: "blocking", retryable: true }] : []),
      ...(input.state === "failed" ? [{ code: "parser_or_collection_failed", severity: "blocking", retryable: true }] : []),
      ...(input.state === "blocked" ? [{ code: "policy_blocked_source", severity: "blocking", retryable: false }] : []),
      ...input.blockers
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function actorEnrichmentFieldsForFamily(family: SourceGrowthFamily): string[] {
  if (family === "telegram") return ["actorHints", "aliases", "campaignNames", "linkedUrls"];
  if (family === "darkweb_onion" || family === "darkweb_metadata") return ["actorHandle", "claimTitle", "victimName", "firstSeen", "mirrorState"];
  if (family === "actor_page") return ["actorName", "aliases", "ttps", "targetSectors", "relatedMalware"];
  if (family === "public_advisory") return ["actorName", "cves", "ttps", "affectedProducts", "vendorAttribution"];
  return ["titleTerms", "extractedEntities", "linkedUrls"];
}

function watchlistMatchFieldsForFamily(family: SourceGrowthFamily): string[] {
  if (family === "telegram") return ["text", "channel", "urls"];
  if (family === "darkweb_onion" || family === "darkweb_metadata") return ["victimName", "actorHandle", "claimTitle"];
  if (family === "actor_page") return ["actorName", "aliases", "ttps"];
  if (family === "public_advisory") return ["title", "cve", "vendor", "affectedProducts"];
  return ["title", "url", "extractedTerms"];
}

function sourceActivationRetryReadiness(input: {
  candidate: SourcePackRegistryCandidate;
  source?: SourceRecord;
  receipt?: DwmSourcePackCollectionQueueReceiptRecord;
  generatedAt: string;
}) {
  const outcome = input.source ? (input.source.metadata?.lastCollectionOutcome ?? sourceCandidate(input.source).lastCollectionOutcome) : undefined;
  const failureCategory = input.candidate.failure?.code
    ?? outcome?.errorCode
    ?? (String(input.candidate.parserStatus ?? "").includes("retry") ? "parser_retry_scheduled" : undefined);
  const retryable = isRetryableSourcePackCandidate(input.candidate) || Boolean(outcome?.retryAfter);
  const nextRetryAt = outcome?.retryAfter ?? (retryable ? input.candidate.retryHint : undefined);
  return {
    retryable,
    lastRun: {
      at: outcome?.at ?? input.receipt?.queuedAt,
      status: outcome?.status ?? input.receipt?.status ?? input.candidate.status,
      receiptId: input.receipt?.taskId,
      parserStatus: input.candidate.parserStatus
    },
    nextRetryAt,
    backoffSeconds: outcome?.backoffSeconds,
    failureCategory,
    remediation: sourceActivationRemediation(failureCategory, input.candidate),
    checkedAt: input.generatedAt,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActivationRemediation(failureCategory: unknown, candidate: SourcePackRegistryCandidate): string {
  const category = String(failureCategory ?? "");
  if (category.includes("restricted_policy")) return "Keep the source metadata-only, remove payload/download/credential intent, and resubmit for policy review.";
  if (category.includes("duplicate")) return "Suppress or link the duplicate before attempting activation.";
  if (category.includes("parser")) return "Retry the parser fixture after backoff; no live network probe is required for readiness.";
  if (isRejectedPolicySourcePackCandidate(candidate)) return "Resolve policy rejection before activation.";
  return "Review parser health and retry only through the source-pack worker contract.";
}

function sourcePackCustomerCrudWorkflow(input: {
  pack: SourcePackRegistry;
  candidate: SourcePackRegistryCandidate;
  source?: SourceRecord;
  operation?: DwmSourceRequestBody["configOperation"];
  configBlockers: Array<Record<string, unknown>>;
  tenantId?: string;
  orgId?: string;
  customerId?: string;
  scope?: string;
  target?: string;
  requestedFamily?: string;
  operatorRole?: DwmSourceRequestBody["operatorRole"];
  ownerLane?: DwmSourceRequestBody["ownerLane"];
  idempotencyKey?: string;
  auditReason?: string;
  generatedAt: string;
}) {
  const operation = input.operation ?? (input.source ? "update" : "create");
  const proposedIdempotencyKey = stableId("dwm_customer_source_config", [
    input.tenantId ?? "missing_tenant",
    input.orgId ?? input.customerId ?? input.scope ?? "missing_org_scope",
    input.pack.id,
    input.candidate.id,
    operation,
    input.target ? safeTargetRef(input.target, input.requestedFamily ?? input.candidate.declaredFamily).hash : input.candidate.targetRef.hash
  ].join(":"));
  const blockers = dedupeBlockers([
    ...input.configBlockers,
    ...(input.idempotencyKey && input.idempotencyKey === proposedIdempotencyKey ? [{ code: "idempotency_duplicate", severity: "warning", idempotencyKey: proposedIdempotencyKey, retryable: false }] : []),
    ...(!input.operatorRole || input.operatorRole === "viewer" ? [{ code: "activation_disabled", severity: "blocking", message: "source customer config changes require source_operator, source_admin, or policy_admin role", retryable: false }] : []),
    ...((operation === "create" || operation === "enable") && input.ownerLane === "policy" && input.candidate.declaredFamily === "telegram" ? [{ code: "activation_disabled", severity: "warning", message: "public Telegram activation should be owned by source_ops or customer_admin", retryable: true }] : [])
  ]);
  const blocking = blockers.some((blocker) => blocker.severity === "blocking");
  const redactedIdentity = input.candidate.targetRef ?? (input.source ? safeTargetRef(input.source.url, sourceGrowthFamilyForSource(input.source)) : input.target ? safeTargetRef(input.target, input.requestedFamily ?? input.candidate.declaredFamily) : safeTargetRef(input.candidate.id, input.candidate.declaredFamily));
  return {
    schemaVersion: "dwm.customer_source_crud_workflow.v1",
    mode: "dry_run_prepare",
    operation,
    executeReady: false,
    reason: blocking ? "blocked_until_operator_or_policy_cleanup" : "prepare_only_until_durable_customer_crud_storage_exists",
    proposedStateTransition: sourcePackCustomerCrudTransition(operation, input.source),
    tenantId: input.tenantId,
    orgId: input.orgId,
    customerId: input.customerId,
    scope: input.scope,
    ownerLane: input.ownerLane ?? "source_ops",
    allowedRoles: ["source_operator", "source_admin", "policy_admin"],
    operatorRole: input.operatorRole,
    audit: {
      required: true,
      available: Boolean(input.auditReason),
      reason: input.auditReason,
      proposedAuditId: stableId("dwm_customer_source_config_audit", `${input.pack.id}:${input.candidate.id}:${operation}:${input.generatedAt}`)
    },
    idempotency: {
      providedKey: input.idempotencyKey,
      proposedKey: proposedIdempotencyKey,
      duplicate: input.idempotencyKey === proposedIdempotencyKey || input.configBlockers.some((blocker) => blocker.code === "idempotency_duplicate")
    },
    redactedIdentity,
    parserHealth: {
      status: input.candidate.parserStatus ?? (input.source ? parserStatusForSource(input.source) : "not_scheduled"),
      healthStatus: input.candidate.healthStatus ?? input.source?.metadata?.healthStatus ?? "not_tested",
      workerSafe: true
    },
    policyBoundary: input.candidate.policyBoundary,
    routeContract: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: {
        action: "pack_customer_config",
        configOperation: operation,
        dryRun: true,
        tenantId: input.tenantId ?? "<tenant-id>",
        orgId: input.orgId ?? "<org-id>",
        sourcePackId: input.pack.id,
        candidateId: input.candidate.id,
        idempotencyKey: proposedIdempotencyKey,
        auditReason: input.auditReason ?? "<change-ticket>"
      }
    },
    blockers,
    safeOutput: {
      rawTargetsExposed: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function sourcePackCustomerCrudTransition(operation: NonNullable<DwmSourceRequestBody["configOperation"]>, source?: SourceRecord) {
  const currentState = source?.status ?? "candidate";
  const targetState = operation === "disable"
    ? "disabled"
    : operation === "suppress"
      ? "suppressed"
      : operation === "enable" || operation === "create"
        ? "active_or_metadata_only"
        : operation === "test"
          ? currentState
          : operation === "retry"
            ? "retry_scheduled"
            : currentState;
  return { currentState, targetState, collectionQueued: false, liveNetworkFetch: false };
}

function sourcePackCustomerConfigAllowedActions(input: {
  pack: SourcePackRegistry;
  candidate: SourcePackRegistryCandidate;
  source?: SourceRecord;
  configBlockers: Array<Record<string, unknown>>;
  retryable: boolean;
  duplicate: boolean;
  policyRejected: boolean;
}) {
  const blockingCodes = new Set(input.configBlockers.filter((blocker) => blocker.severity === "blocking").map((blocker) => String(blocker.code)));
  const actions: Array<Record<string, unknown>> = [
    { action: "inspect", allowed: true, route: "/v1/dwm/source-requests", dryRunSupported: true },
    { action: "prepare_customer_config", allowed: true, route: "/v1/dwm/source-requests", dryRunSupported: true }
  ];
  actions.push({
    action: "activate",
    allowed: Boolean(input.source) && !blockingCodes.has("duplicate_source") && !blockingCodes.has("rejected_policy") && !blockingCodes.has("restricted_source") && !blockingCodes.has("stale_worker"),
    route: "/v1/dwm/source-requests",
    dryRunSupported: true
  });
  actions.push({
    action: "retry",
    allowed: input.retryable && !blockingCodes.has("duplicate_source") && !blockingCodes.has("rejected_policy") && !blockingCodes.has("stale_worker"),
    route: "/v1/dwm/source-requests",
    dryRunSupported: true
  });
  actions.push({
    action: "suppress",
    allowed: input.duplicate || input.policyRejected,
    route: "/v1/dwm/source-requests",
    dryRunSupported: true
  });
  actions.push({
    action: "review_policy",
    allowed: input.policyRejected || blockingCodes.has("restricted_source"),
    route: "/v1/dwm/source-requests",
    dryRunSupported: true
  });
  return actions;
}

function dedupeBlockers(blockers: Array<Record<string, unknown>>) {
  return blockers.filter((blocker, index, all) => index === all.findIndex((item) => JSON.stringify(item) === JSON.stringify(blocker)));
}

function buildDwmSourceOperationsNextActions(input: {
  candidateRows: Array<{ pack: SourcePackRegistry; candidate: SourcePackRegistryCandidate; source?: SourceRecord; receipt?: DwmSourcePackCollectionQueueReceiptRecord }>;
  freshness: string;
  staleAfterMinutes: number;
}) {
  const actions: Array<Record<string, unknown>> = [];
  if (input.freshness === "stale") actions.push({ action: "run_source_pack_worker", reason: `source-pack worker older than ${input.staleAfterMinutes} minutes`, priority: "high" });
  if (input.freshness === "missing") actions.push({ action: "run_source_pack_worker", reason: "source-pack worker has not produced readiness state", priority: "high" });
  for (const row of input.candidateRows) {
    const safeRef = stableId("dwm_source_pack_ref", row.pack.id);
    if (isDuplicateSourcePackCandidate(row.candidate) && row.candidate.status !== "suppressed" && row.candidate.decision !== "suppressed_duplicate") {
      actions.push({ action: "suppress_duplicate", sourcePackId: row.pack.id, safeRef, candidateId: row.candidate.id, reason: "duplicate source candidate should be suppressed or linked", priority: "medium" });
    }
    if (isRetryableSourcePackCandidate(row.candidate) || row.source?.metadata?.lastCollectionOutcome?.retryAfter) {
      actions.push({ action: "retry_candidate", sourcePackId: row.pack.id, safeRef, candidateId: row.candidate.id, sourceId: row.source?.id, reason: "retryable parser or collection failure", priority: "high" });
    }
    if (isRejectedPolicySourcePackCandidate(row.candidate)) {
      actions.push({ action: "review_policy_rejection", sourcePackId: row.pack.id, safeRef, candidateId: row.candidate.id, reason: String(row.candidate.failure?.message ?? row.candidate.reason ?? "policy rejected"), priority: "medium" });
    }
    if (row.source && row.source.status !== "active" && !isDuplicateSourcePackCandidate(row.candidate) && !isRejectedPolicySourcePackCandidate(row.candidate)) {
      actions.push({ action: "activate_candidate", sourcePackId: row.pack.id, safeRef, candidateId: row.candidate.id, sourceId: row.source.id, reason: "candidate has source row and is eligible for activation review", priority: "high" });
    }
  }
  return actions.slice(0, 50);
}

function buildDwmSourceOperationsTypedBlockers(input: {
  packs: SourcePackRegistry[];
  candidateRows: Array<{ pack: SourcePackRegistry; candidate: SourcePackRegistryCandidate; source?: SourceRecord; receipt?: DwmSourcePackCollectionQueueReceiptRecord }>;
  sourceHealth: Record<string, any>;
  freshness: string;
  staleAfterMinutes: number;
}) {
  const blockers: Array<Record<string, unknown>> = [...(Array.isArray(input.sourceHealth.typedBlockers) ? input.sourceHealth.typedBlockers : [])];
  if (input.packs.length === 0) blockers.push({ code: "missing_source_pack", severity: "blocking", message: "no source packs are registered", retryable: true });
  if (input.freshness === "stale") blockers.push({ code: "stale_worker", severity: "blocking", message: `source-pack worker older than ${input.staleAfterMinutes} minutes`, retryable: true });
  for (const row of input.candidateRows) {
    if ((isRetryableSourcePackCandidate(row.candidate) || row.source?.metadata?.lastCollectionOutcome?.retryAfter) && !row.source && row.candidate.status !== "retry_scheduled") {
      blockers.push({ code: "no_retry_eligibility", severity: "blocking", sourcePackId: row.pack.id, candidateId: row.candidate.id, retryable: false });
    }
    if (!row.source && !isDuplicateSourcePackCandidate(row.candidate) && !isRejectedPolicySourcePackCandidate(row.candidate) && row.candidate.status !== "retry_scheduled") {
      blockers.push({ code: "activation_disabled", severity: "warning", sourcePackId: row.pack.id, candidateId: row.candidate.id, retryable: true });
    }
    const familyHealth = input.sourceHealth.family?.[row.candidate.declaredFamily];
    if (familyHealth && Number(familyHealth.candidateCount ?? 0) > 0 && Number(familyHealth.activeCount ?? 0) === 0) {
      blockers.push({ code: "source_family_inactive", severity: "warning", family: row.candidate.declaredFamily, sourcePackId: row.pack.id, retryable: true });
    }
  }
  return blockers.filter((blocker, index, all) => index === all.findIndex((item) => JSON.stringify(item) === JSON.stringify(blocker)));
}

function buildDwmSourceHealthTypedBlockers(input: {
  packs: SourcePackRegistry[];
  candidateRows: Array<{
    pack: SourcePackRegistry;
    candidate: SourcePackRegistryCandidate;
    activeRow?: { candidateId: string };
    receipt?: DwmSourcePackCollectionQueueReceiptRecord;
  }>;
  family: Record<SourceGrowthFamily, Record<string, unknown>>;
  receipts: DwmSourcePackCollectionQueueReceiptRecord[];
  queueRecords: DwmSourcePackValidationQueueRecord[];
  activeRows: Array<{ candidateId: string }>;
  freshness: string;
  staleAfterMinutes: number;
}) {
  const blockers: Array<Record<string, unknown>> = [];
  if (input.freshness === "missing") blockers.push({ code: "missing_receipt", severity: "blocking", message: "source-pack worker has not produced a durable run or collection receipt", retryable: true });
  if (input.freshness === "stale") blockers.push({ code: "stale_worker", severity: "warning", message: `source-pack worker last run is older than ${input.staleAfterMinutes} minutes`, retryable: true });
  for (const row of input.candidateRows) {
    const parserStatus = row.candidate.parserStatus ?? "not_scheduled";
    if (row.candidate.failure || parserStatus.includes("failed") || parserStatus.includes("retry") || parserStatus.includes("blocked")) {
      blockers.push({
        code: "parser_failure",
        severity: isRetryableSourcePackCandidate(row.candidate) ? "warning" : "blocking",
        sourcePackId: row.pack.id,
        candidateId: row.candidate.id,
        family: row.candidate.declaredFamily,
        parserStatus,
        reason: row.candidate.reason ?? row.candidate.failure?.message ?? row.candidate.failure?.code,
        retryable: isRetryableSourcePackCandidate(row.candidate)
      });
    }
    if (isRejectedPolicySourcePackCandidate(row.candidate)) {
      blockers.push({
        code: "rejected_policy",
        severity: "blocking",
        sourcePackId: row.pack.id,
        candidateId: row.candidate.id,
        family: row.candidate.declaredFamily,
        reason: row.candidate.reason ?? row.candidate.failure?.message ?? "candidate rejected by intake policy",
        retryable: false
      });
    }
    if (isDuplicateSourcePackCandidate(row.candidate)) {
      blockers.push({
        code: "duplicate_source",
        severity: "info",
        sourcePackId: row.pack.id,
        candidateId: row.candidate.id,
        family: row.candidate.declaredFamily,
        duplicateOf: row.candidate.duplicateOf,
        retryable: false
      });
    }
    if ((row.activeRow || row.candidate.status === "active" || row.candidate.decision === "approved") && !row.receipt) {
      blockers.push({
        code: "missing_receipt",
        severity: "warning",
        sourcePackId: row.pack.id,
        candidateId: row.candidate.id,
        family: row.candidate.declaredFamily,
        message: "active source has no durable collection queue receipt",
        retryable: true
      });
    }
  }
  for (const family of SOURCE_GROWTH_FAMILIES) {
    const row = input.family[family] ?? {};
    if (Number(row.candidateCount ?? 0) > 0 && Number(row.activeCount ?? 0) === 0) {
      blockers.push({ code: "no_active_source_family", severity: "warning", family, candidateCount: row.candidateCount, retryable: true });
    }
  }
  for (const pack of input.packs) {
    const promotable = pack.candidates.some((candidate) => !isBlockedSourcePackCandidate(candidate) || isRetryableSourcePackCandidate(candidate));
    if (!promotable) blockers.push({ code: "source_pack_not_promotable", severity: "blocking", sourcePackId: pack.id, safeRef: stableId("dwm_source_pack_ref", pack.id), retryable: false });
  }
  return blockers;
}

function isBlockedSourcePackCandidate(candidate: SourcePackRegistryCandidate): boolean {
  return ["rejected", "failed", "disabled", "duplicate", "suppressed", "approval_required"].includes(candidate.status) || Boolean(candidate.failure);
}

function isRetryableSourcePackCandidate(candidate: SourcePackRegistryCandidate): boolean {
  if (isDuplicateSourcePackCandidate(candidate) || isRejectedPolicySourcePackCandidate(candidate)) return false;
  return candidate.status === "retry_scheduled" || Boolean(candidate.retryHint) || String(candidate.parserStatus ?? "").includes("retry");
}

function isUnretryableSourcePackCandidate(candidate: SourcePackRegistryCandidate): boolean {
  return isBlockedSourcePackCandidate(candidate) && !isRetryableSourcePackCandidate(candidate);
}

function isDuplicateSourcePackCandidate(candidate: SourcePackRegistryCandidate): boolean {
  return candidate.status === "duplicate" || candidate.decision === "duplicate_skipped" || candidate.failure?.code === "duplicate_candidate";
}

function isRejectedPolicySourcePackCandidate(candidate: SourcePackRegistryCandidate): boolean {
  return candidate.status === "rejected"
    || candidate.status === "failed"
    || candidate.decision === "rejected_at_intake"
    || candidate.failure?.code === "restricted_policy_blocked"
    || candidate.failure?.code === "telegram_policy_blocked";
}

function redactedWorkerReceipt(receipt: DwmSourcePackCollectionQueueReceiptRecord) {
  return {
    status: receipt.status,
    taskId: receipt.taskId,
    sourceId: receipt.sourceId,
    candidateId: receipt.candidateId,
    sourcePackId: receipt.packId,
    requestId: receipt.requestId,
    family: receipt.family,
    queuedAt: receipt.queuedAt,
    parserStatus: receipt.parserStatus,
    validationJobKey: receipt.validationJobKey,
    targetRawStored: false
  };
}

function createSourceCandidatePack(body: DwmSourceRequestBody, options: ApiServerOptions) {
  const generatedAt = nowIso();
  const limit = Math.max(1, Math.min(body.limit ?? 100, 100));
  const sourcePackId = body.sourcePackId ?? stableId("dwm_source_pack", `${body.tenantId ?? "global"}:${body.sourcePackLabel ?? "ad-hoc"}:${generatedAt}`);
  const sourcePackLabel = body.sourcePackLabel ?? "Ad hoc source candidate pack";
  const accepted: Array<Record<string, unknown>> = [];
  const rejected: Array<Record<string, unknown>> = [];
  const duplicates: Array<Record<string, unknown>> = [];
  const registryCandidates: SourcePackRegistryCandidate[] = [];
  const requestId = stableId("dwm_candidate_pack_request", `${sourcePackId}:${generatedAt}`);

  for (const [index, input] of (body.candidates ?? []).slice(0, limit).entries()) {
    const target = String(input.target ?? "").trim();
    const type = input.type ?? body.type ?? "telegram_channel";
    const declaredFamily = sourceGrowthFamilyFromCandidate({ target, type, family: input.family });
    const parserExpectation = input.parserExpectation ?? parserExpectationForFamily(declaredFamily);
    const requestBody: DwmSourceRequestBody = {
      ...body,
      target,
      type,
      scope: input.scope ?? body.scope,
      requestedBy: input.requestedBy ?? body.requestedBy,
      priority: input.priority ?? body.priority,
      activate: false
    };
    const result = type === "restricted_metadata"
      ? createRestrictedMetadataSourceFromTarget(target, requestBody, options)
      : type === "public_url"
        ? createPublicUrlSourceFromTarget(target, requestBody, options, declaredFamily)
        : createTelegramSourceFromTarget(target, requestBody, options);

    if (result.kind === "error") {
      const failure = {
        code: result.code,
        message: result.message,
        retryHint: type === "telegram_channel" ? "submit a public @handle or https://t.me/<channel> URL" : "submit a metadata-only target without payload, credential, or download intent"
      };
      rejected.push({
        sourcePackId,
        sourcePackLabel,
        index,
        target,
        type,
        ...failure
      });
      registryCandidates.push(sourcePackRegistryCandidate({
        sourcePackId,
        index,
        target,
        type,
        declaredFamily,
        refLabel: input.refLabel,
        parserExpectation,
        requestedBy: input.requestedBy ?? body.requestedBy ?? "source-pack",
        requestedAt: generatedAt,
        status: "rejected",
        intakeStatus: "rejected",
        decision: "rejected_at_intake",
        reason: result.message,
        failure
      }));
      continue;
    }
    if (result.kind === "duplicate") {
      duplicates.push({
        sourcePackId,
        sourcePackLabel,
        index,
        target,
        type,
        duplicateOf: result.duplicateOf,
        nextAction: "Use the existing source or change the source scope; duplicate candidates are not queued."
      });
      registryCandidates.push(sourcePackRegistryCandidate({
        sourcePackId,
        index,
        target,
        type,
        declaredFamily,
        refLabel: input.refLabel,
        parserExpectation,
        requestedBy: input.requestedBy ?? body.requestedBy ?? "source-pack",
        requestedAt: generatedAt,
        status: "duplicate",
        intakeStatus: "duplicate",
        decision: "duplicate_skipped",
        duplicateOf: result.duplicateOf,
        reason: "Duplicate candidate skipped during intake"
      }));
      continue;
    }

    const packedSource = saveSourcePackMetadata(result.source, options, {
      sourcePackId,
      sourcePackLabel,
      packIndex: index,
      packRequestedAt: generatedAt,
      declaredFamily,
      refLabel: input.refLabel,
      parserExpectation
    });
    const source = input.suppress === true
      ? saveLifecyclePatch(packedSource, options, {
        action: "suppress",
        actor: input.requestedBy ?? body.requestedBy ?? "source-pack",
        reason: input.reason ?? "source-pack candidate suppressed during intake",
        status: "suppressed",
        healthStatus: "suppressed",
        parserStatus: "not_scheduled",
        activationState: "suppressed"
      })
      : packedSource;
    accepted.push(sourcePackCandidateItem(source, input.suppress === true ? "suppressed" : "accepted"));
    registryCandidates.push(sourcePackRegistryCandidate({
      sourcePackId,
      index,
      target,
      type,
      declaredFamily,
      refLabel: input.refLabel,
      parserExpectation,
      requestedBy: input.requestedBy ?? body.requestedBy ?? "source-pack",
      requestedAt: generatedAt,
      status: source.status === "suppressed" ? "suppressed" : sourceCandidate(source).status,
      intakeStatus: input.suppress === true ? "suppressed" : "accepted",
      decision: input.suppress === true ? "suppressed_at_intake" : "queued_for_review",
      reason: input.suppress === true ? input.reason ?? "source-pack candidate suppressed during intake" : undefined,
      source
    }));
  }

  const registry = upsertSourcePackRegistry(options, {
    id: sourcePackId,
    label: sourcePackLabel,
    tenantId: body.tenantId,
    scope: body.scope,
    requestedBy: body.requestedBy ?? "source-pack",
    requestedAt: generatedAt,
    updatedAt: generatedAt,
    requestId,
    safeOutput: sourcePackSafeOutput(),
    candidates: registryCandidates,
    audit: [{
      at: generatedAt,
      action: "pack_intake",
      actor: body.requestedBy ?? "source-pack",
      reason: "source candidate pack submitted",
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      duplicateCount: duplicates.length
    }]
  });

  const packStatus = sourcePackRollup({
    sourcePackId,
    sourcePackLabel,
    sources: sourcesForPack(sourcePackId, options),
    registry
  });

  return {
    request: {
      id: requestId,
      type: "candidate_pack",
      sourcePackId,
      label: sourcePackLabel,
      approvalState: "queued",
      generatedAt,
      nextAction: "Review accepted public candidates for promotion; restricted metadata candidates require metadata-only approval before collection."
    },
    acceptedCandidates: accepted,
    rejected,
    duplicates,
    summary: {
      evaluatedCount: Math.min(body.candidates?.length ?? 0, limit),
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      duplicateCount: duplicates.length,
      telegramPublicCount: accepted.filter((item) => item.family === "telegram_public").length,
      restrictedMetadataCount: accepted.filter((item) => item.family === "darkweb_metadata").length,
      suppressedCount: accepted.filter((item) => item.status === "suppressed").length,
      queuedForCollectionCount: accepted.filter((item) => (item.operationalNextStep as any)?.collectionTrigger?.queued === true).length
    },
    packStatus,
    packRegistry: sourcePackRegistryStatus(registry, options),
    safeOutput: sourcePackSafeOutput()
  };
}

function sourcePackCandidateItem(source: SourceRecord, intakeStatus: "accepted" | "suppressed") {
  const candidate = sourceCandidate(source);
  const collectionTrigger = source.status === "suppressed"
    ? skippedCollectionTrigger(source, "source_suppressed")
    : skippedCollectionTrigger(source, isRestrictedMetadataSource(source) ? "metadata_only_approval_required" : "awaiting_operator_promotion");
  const alertRebuild = skippedAlertRebuild(source, "captures_required_before_alert_rebuild");
  return {
    id: candidate.id,
    sourcePackId: candidate.sourcePackId,
    sourcePackLabel: candidate.sourcePackLabel,
    sourceId: source.id,
    family: candidate.family,
    target: candidate.target,
    status: source.status === "suppressed" ? "suppressed" : candidate.status,
    intakeStatus,
    requestedBy: candidate.requestedBy,
    provenance: {
      route: "/v1/dwm/source-requests",
      sourceCandidateId: candidate.id,
      sourceId: source.id,
      sourceType: source.type
    },
    policyBoundary: candidate.policyBoundary,
    validationResult: candidate.validationResult,
    parser: {
      status: source.status === "suppressed" ? "not_scheduled" : candidate.parserStatus,
      mode: isRestrictedMetadataSource(source) ? "restricted_metadata" : "public_channel_handoff"
    },
    approvalTicket: candidate.approvalTicket,
    operationalNextStep: {
      nextAction: source.status === "suppressed"
        ? "Candidate suppressed during intake. It will not queue collection."
        : isRestrictedMetadataSource(source)
          ? "Open metadata-only approval before any collection worker can run."
          : "Promote candidate to active source when ready; promotion queues bounded frontier collection.",
      collectionTrigger,
      alertRebuild,
      retryHint: source.status === "suppressed" ? "request a new candidate if scope changes" : undefined
    }
  };
}

function saveSourcePackMetadata(source: SourceRecord, options: ApiServerOptions, input: {
  sourcePackId: string;
  sourcePackLabel: string;
  packIndex: number;
  packRequestedAt: string;
  declaredFamily?: SourceGrowthFamily;
  refLabel?: string;
  parserExpectation?: string;
}): SourceRecord {
  const candidate = sourceCandidate(source);
  const declaredFamily = input.declaredFamily ?? sourceGrowthFamilyForSource(source);
  return options.store.saveSource({
    ...source,
    metadata: {
      ...(source.metadata ?? {}),
      sourcePackId: input.sourcePackId,
      sourcePackLabel: input.sourcePackLabel,
      sourcePackIndex: input.packIndex,
      sourcePackRequestedAt: input.packRequestedAt,
      sourceGrowthFamily: declaredFamily,
      sourceRefLabel: input.refLabel,
      parserExpectation: input.parserExpectation ?? parserExpectationForFamily(declaredFamily),
      sourceCandidate: {
        ...candidate,
        sourcePackId: input.sourcePackId,
        sourcePackLabel: input.sourcePackLabel,
        sourcePackIndex: input.packIndex,
        sourcePackRequestedAt: input.packRequestedAt,
        sourceGrowthFamily: declaredFamily,
        refLabel: input.refLabel,
        parserExpectation: input.parserExpectation ?? parserExpectationForFamily(declaredFamily)
      }
    }
  } as SourceRecord);
}

function sourcePackStore(options: ApiServerOptions): DwmSourcePackRegistryAdapter {
  const configured = options.sourcePackRegistry as DwmSourcePackRegistryAdapter | undefined;
  if (configured && typeof configured.save === "function" && typeof configured.get === "function" && typeof configured.list === "function") return configured;
  const key = options.store as object;
  let registry = sourcePackRegistries.get(key);
  if (!registry) {
    registry = new InMemoryDwmSourcePackRegistryAdapter();
    sourcePackRegistries.set(key, registry);
  }
  return registry;
}

function sourcePackValidationQueue(options: ApiServerOptions): DwmSourcePackValidationQueueAdapter {
  const configured = options.sourcePackValidationQueue as DwmSourcePackValidationQueueAdapter | undefined;
  if (configured && typeof configured.enqueue === "function" && typeof configured.transition === "function" && typeof configured.list === "function") return configured;
  const key = options.store as object;
  let queue = sourcePackValidationQueues.get(key);
  if (!queue) {
    queue = new InMemoryDwmSourcePackValidationQueueAdapter();
    sourcePackValidationQueues.set(key, queue);
  }
  return queue;
}

function sourcePackActiveSourceStore(options: ApiServerOptions): DwmSourcePackActiveSourceAdapter {
  const configured = options.sourcePackActiveSourceStore as DwmSourcePackActiveSourceAdapter | undefined;
  if (configured && typeof configured.upsert === "function" && typeof configured.get === "function" && typeof configured.list === "function") return configured;
  const key = options.store as object;
  let activeSources = sourcePackActiveSources.get(key);
  if (!activeSources) {
    activeSources = new InMemoryDwmSourcePackActiveSourceAdapter();
    sourcePackActiveSources.set(key, activeSources);
  }
  return activeSources;
}

function sourcePackWorkerRunStore(options: ApiServerOptions): DwmSourcePackWorkerRunAdapter {
  const configured = options.sourcePackWorkerRunStore as DwmSourcePackWorkerRunAdapter | undefined;
  if (configured && typeof configured.save === "function" && typeof configured.list === "function") return configured;
  const key = options.store as object;
  let adapter = sourcePackWorkerRuns.get(key);
  if (!adapter) {
    adapter = new InMemoryDwmSourcePackWorkerRunAdapter();
    sourcePackWorkerRuns.set(key, adapter);
  }
  return adapter;
}

function sourcePackCollectionReceiptStore(options: ApiServerOptions): DwmSourcePackCollectionReceiptAdapter {
  const configured = options.sourcePackCollectionReceiptStore as DwmSourcePackCollectionReceiptAdapter | undefined;
  if (configured && typeof configured.upsert === "function" && typeof configured.list === "function") return configured;
  const key = options.store as object;
  let adapter = sourcePackCollectionReceipts.get(key);
  if (!adapter) {
    adapter = new InMemoryDwmSourcePackCollectionReceiptAdapter();
    sourcePackCollectionReceipts.set(key, adapter);
  }
  return adapter;
}

function upsertSourcePackRegistry(options: ApiServerOptions, pack: SourcePackRegistry): SourcePackRegistry {
  return sourcePackStore(options).save(sourcePackWithRollups(pack, options));
}

function updateSourcePackRegistryDecision(options: ApiServerOptions, source: SourceRecord, input: {
  action: string;
  actor: string;
  reason?: string;
  at: string;
}) {
  const candidate = sourceCandidate(source);
  const sourcePackId = String(candidate.sourcePackId ?? "").trim();
  if (!sourcePackId) return;
  const registry = sourcePackStore(options);
  const pack = registry.get(sourcePackId);
  if (!pack) return;
  registry.save(sourcePackWithRollups({
    ...pack,
    updatedAt: input.at,
    candidates: pack.candidates.map((item) => item.id === candidate.id ? {
      ...item,
      status: candidate.status,
      decision: input.action,
      decidedBy: input.actor,
      decidedAt: input.at,
      reason: input.reason,
      sourceId: source.id,
      policyBoundary: candidate.policyBoundary,
      validationResult: candidate.validationResult,
      parserStatus: candidate.parserStatus,
      healthStatus: candidate.healthStatus
    } : item),
    audit: [
      ...pack.audit,
      { at: input.at, action: input.action, actor: input.actor, reason: input.reason, candidateId: candidate.id, sourceId: source.id }
    ]
  }, options));
}

function sourcePackWithRollups(pack: SourcePackRegistry, options: ApiServerOptions): SourcePackRegistry {
  const sources = sourcesForPack(pack.id, options);
  const rollup = sourcePackRollup({ sourcePackId: pack.id, sourcePackLabel: pack.label, sources, registry: pack });
  return {
    ...pack,
    familyCoverage: rollup.familyCoverage,
    healthRollup: {
      totalCandidateCount: rollup.totalCandidateCount,
      activeCount: rollup.activeCount,
      approvalRequiredCount: rollup.approvalRequiredCount,
      rejectedCount: rollup.rejectedCount,
      duplicateCount: rollup.duplicateCount,
      suppressedCount: rollup.suppressedCount,
      queuedJobIds: rollup.queuedJobIds,
      queuedForCollectionCount: rollup.queuedForCollectionCount,
      capturesObservedCount: rollup.capturesObservedCount,
      alertRebuild: rollup.alertRebuild,
      retryBackoff: rollup.retryBackoff,
      failureReasons: rollup.failureReasons
    }
  };
}

function sourcePackRegistryCandidate(input: {
  sourcePackId: string;
  index: number;
  target: string;
  type: string;
  declaredFamily: SourceGrowthFamily;
  refLabel?: string;
  parserExpectation: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  intakeStatus: string;
  source?: SourceRecord;
  decision?: string;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
  duplicateOf?: string;
  failure?: Record<string, unknown>;
  retryHint?: string;
}): SourcePackRegistryCandidate {
  const candidate = input.source ? sourceCandidate(input.source) : undefined;
  const family = candidate?.family ?? (input.type === "restricted_metadata" ? "darkweb_metadata" : "telegram_public");
  return {
    id: candidate?.id ?? stableId("dwm_source_pack_candidate", `${input.sourcePackId}:${input.index}:${input.type}:${input.target}`),
    sourceId: input.source?.id,
    family,
    declaredFamily: input.declaredFamily,
    type: input.type,
    refLabel: input.refLabel,
    parserExpectation: input.parserExpectation,
    index: input.index,
    targetRef: safeTargetRef(input.target, family),
    requestedBy: input.requestedBy,
    requestedAt: input.requestedAt,
    status: input.status,
    intakeStatus: input.intakeStatus,
    decision: input.decision,
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt,
    reason: input.reason,
    duplicateOf: input.duplicateOf,
    failure: input.failure,
    policyBoundary: candidate?.policyBoundary ?? (family === "darkweb_metadata" ? restrictedMetadataBoundary() : publicTelegramBoundary()),
    validationResult: candidate?.validationResult ?? (input.failure ? { allowed: false, reason: input.reason ?? input.failure?.message, checkedAt: input.requestedAt } : undefined),
    parserStatus: candidate?.parserStatus,
    healthStatus: candidate?.healthStatus,
    activationState: candidate?.activationDecision,
    lastTestOutcome: candidate?.lastTestedAt ? { status: candidate.healthStatus, testedAt: candidate.lastTestedAt } : undefined,
    retryHint: input.retryHint ?? (input.failure?.retryHint ? String(input.failure.retryHint) : undefined)
  };
}

function safeTargetRef(target: string, family: string) {
  return {
    hash: hashContent(target),
    preview: `${family}:${hashContent(target).slice(0, 12)}`,
    family,
    rawStored: false as const
  };
}

function sourcePackSafeOutput() {
  return {
    rawUnsafeRowsStored: false,
    rawRejectedTargetsStored: false,
    rawDuplicateTargetsStored: false,
    liveNetworkScrapeStarted: false,
    restrictedPayloadDownloadAllowed: false
  };
}

function handleSourcePackReview(body: DwmSourceRequestBody, options: ApiServerOptions): Response {
  const packAction = body.packAction ?? "approve";
  const sources = lookupSourcePackReviewSources(body, options);
  const registryCandidates = lookupSourcePackRegistryReviewCandidates(body, options)
    .filter((item) => !sources.some((source) => sourceCandidate(source).id === item.candidate.id));
  if (!sources.length && !registryCandidates.length) {
    return json({
      error: {
        code: "source_pack_candidates_not_found",
        message: "Provide sourcePackId, sourceId/sourceIds, or candidateId/candidateIds for pack review."
      },
      packStatus: sourcePackStatusResponse(body, options)
    }, 404);
  }

  const reviewedAt = nowIso();
  const actor = body.decidedBy ?? body.approvedBy ?? body.requestedBy ?? "operator";
  const sourceResults = sources.map((source) => applySourcePackReviewAction(source, body, options, { packAction, actor, reviewedAt }));
  const registryResults = registryCandidates.map((item) => applySourcePackRegistryReviewAction(item.pack, item.candidate, body, options, { packAction, actor, reviewedAt }));
  const results = [...sourceResults, ...registryResults];
  const firstCandidate = sources[0] ? sourceCandidate(sources[0]) : registryCandidates[0]?.candidate;
  const sourcePackId = String(body.sourcePackId ?? (firstCandidate as any)?.sourcePackId ?? registryCandidates[0]?.pack.id ?? "").trim();
  const sourcePackLabel = String((firstCandidate as any)?.sourcePackLabel ?? registryCandidates[0]?.pack.label ?? (sourcePackId || "source pack"));
  const currentRegistry = sourcePackId ? sourcePackStore(options).get(sourcePackId) : undefined;
  return json({
    action: "pack_review",
    packAction,
    sourcePackId: sourcePackId || undefined,
    sourcePackLabel,
    reviewedAt,
    actor,
    reason: body.reason,
    results,
    packStatus: sourcePackRollup({
      sourcePackId: sourcePackId || undefined,
      sourcePackLabel,
      sources: sourcePackId ? sourcesForPack(sourcePackId, options) : results.map((item: any) => item.source).filter(Boolean) as SourceRecord[],
      registry: currentRegistry
    }),
    registry: currentRegistry ? sourcePackRegistryStatus(currentRegistry, options) : undefined,
    safeOutput: {
      rawUnsafeRowsStored: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  }, 200);
}

function handleSourcePackWorkerRun(body: DwmSourceRequestBody, options: ApiServerOptions): Response {
  const registry = findSourcePackRegistry(body, options);
  if (!registry) {
    return json({
      error: {
        code: "source_pack_not_found",
        message: "Provide sourcePackId or sourcePackLabel for source-pack worker processing."
      },
      safeOutput: sourcePackSafeOutput()
    }, 404);
  }

  const startedAt = nowIso();
  const actor = body.decidedBy ?? body.approvedBy ?? body.requestedBy ?? "source-pack-worker";
  const queue = sourcePackValidationQueue(options);
  const activeSourceStore = sourcePackActiveSourceStore(options);
  const plan = planDwmSourcePackValidationBatch([registry], {
    chunkSize: body.chunkSize ?? body.limit ?? 250,
    maxAttempts: body.maxAttempts ?? 3,
    backoffSeconds: body.backoffSeconds ?? 300,
    perFamilyConcurrency: body.perFamilyConcurrency ?? defaultSourcePackWorkerConcurrency(),
    generatedAt: startedAt
  });
  const queuedValidation = enqueueDwmSourcePackValidationJobs(queue, [registry], plan, { generatedAt: startedAt });

  let workingPack = registry;
  const finalQueueRecords: DwmSourcePackValidationQueueRecord[] = [];
  const activations: ReturnType<typeof applyDwmSourcePackValidationResults>[] = [];
  const validationRuns: Array<Record<string, unknown>> = [];

  for (const receipt of queuedValidation.receipts) {
    const validationStarted = queue.transition(receipt.jobKey, "validating", {
      job: { ...receipt.record.job, status: "validating", updatedAt: startedAt },
      updatedAt: startedAt
    });
    const run = runDwmSourcePackValidationJob(validationStarted.job, workingPack, validateSourcePackCandidateForWorker, { generatedAt: startedAt });
    const finalRecord = queue.transition(receipt.jobKey, run.job.status, {
      job: run.job,
      retry: run.job.retry,
      updatedAt: startedAt
    });
    const activation = applyDwmSourcePackValidationResults(workingPack, finalRecord, run.results, {
      generatedAt: startedAt,
      actor
    });
    workingPack = activation.pack;
    finalQueueRecords.push(finalRecord);
    activations.push(activation);
    validationRuns.push({
      jobKey: receipt.jobKey,
      enqueueStatus: receipt.status,
      status: run.job.status,
      parserStatus: run.job.parserStatus,
      retry: run.job.retry,
      results: run.results
    });
  }

  const mergedActivation = mergeSourcePackActivations(workingPack, activations);
  const activePersistence = persistDwmSourcePackActiveSources(activeSourceStore, mergedActivation, {
    perFamilyCaps: body.perFamilyCaps
  });
  const activeRows = activePersistence.receipts
    .map((receipt) => receipt.row)
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const sourceWrite = persistDwmSourcePackSourceRecords(options.store, activeRows, {
    tenantId: body.tenantId ?? registry.tenantId,
    generatedAt: startedAt,
    approvedBy: actor,
    updateExisting: true
  });
  const handoff = buildDwmSourcePackCollectionJobHandoff(activeRows, { generatedAt: startedAt });
  const persistedCollectionReceipts = persistedCollectionReceiptsForPack(registry.id, options);
  const persistedTaskIds = new Set(persistedCollectionReceipts.map((receipt) => receipt.taskId));
  const duplicatePersistedReceipts = handoff.jobs
    .filter((job) => persistedTaskIds.has(job.id))
    .map((job) => ({
      status: "duplicate" as const,
      taskId: job.id,
      sourceId: job.sourceId,
      candidateId: job.candidateId,
      reason: "persisted_collection_receipt"
    }));
  const jobsToQueue = handoff.jobs.filter((job) => !persistedTaskIds.has(job.id));
  const queuedCollection = enqueueDwmSourcePackCollectionTasks(options.frontier, jobsToQueue, options.store.listSources(), {
    tenantId: body.tenantId ?? registry.tenantId
  });
  const collectionQueue = {
    ...queuedCollection,
    receipts: [...duplicatePersistedReceipts, ...queuedCollection.receipts],
    summary: {
      queuedCount: queuedCollection.summary.queuedCount,
      duplicateCount: queuedCollection.summary.duplicateCount + duplicatePersistedReceipts.length,
      blockedCount: queuedCollection.summary.blockedCount,
      taskCount: new Set([
        ...(options.frontier.snapshot?.() ?? []).map((item: any) => String(item.task?.id ?? item.id)),
        ...persistedTaskIds,
        ...queuedCollection.receipts.filter((receipt) => receipt.status !== "blocked").map((receipt) => receipt.taskId)
      ].filter(Boolean)).size
    }
  };
  persistSourcePackWorkerCollectionReceipts(handoff.jobs, collectionQueue.receipts, options);
  persistSourcePackWorkerCollectionState(sourceWrite.sources, collectionQueue.receipts, options, startedAt);

  const completedAt = nowIso();
  const savedPack = upsertSourcePackRegistry(options, {
    ...workingPack,
    updatedAt: completedAt,
    audit: [
      ...workingPack.audit,
      {
        at: completedAt,
        action: "source_pack_worker_run",
        actor,
        validationJobKeys: finalQueueRecords.map((record) => record.jobKey),
        activeSourceCount: activeRows.length,
        queuedCollectionCount: collectionQueue.summary.queuedCount
      }
    ]
  });
  const runRecord: DwmSourcePackWorkerRunRecord = {
    id: stableId("dwm_source_pack_worker_run", `${savedPack.id}:${startedAt}`),
    sourcePackId: savedPack.id,
    sourcePackLabel: savedPack.label,
    startedAt,
    completedAt,
    status: mergedActivation.summary.activeSourceCount > 0 && mergedActivation.summary.blockedCandidateCount > 0 ? "partially_active" : finalQueueRecords.at(-1)?.status ?? "completed",
    actor,
    validationJobKeys: finalQueueRecords.map((record) => record.jobKey),
    sourceRecordSummary: {
      ...sourceWrite.summary,
      upsertedCount: sourceWrite.summary.insertedCount + sourceWrite.summary.duplicateCount
    },
    collectionQueueSummary: collectionQueue.summary
  };
  sourcePackWorkerRunStore(options).save(runRecord);

  return json({
    action: "pack_worker_run",
    sourcePackId: savedPack.id,
    sourcePackLabel: savedPack.label,
    run: runRecord,
    validationPlan: plan,
    validationQueue: {
      ...queuedValidation,
      finalRecords: finalQueueRecords
    },
    validationRuns,
    activation: mergedActivation,
    activeSourcePersistence: activePersistence,
    sourceRecordWrite: sourceWrite,
    collectionJobs: handoff,
    collectionQueue,
    sourceGrowthCounters: sourcePackGrowthCounters([savedPack], options),
    workerReadiness: sourcePackWorkerStateForPacks([savedPack], options).readiness,
    packRegistry: sourcePackRegistryStatus(savedPack, options),
    safeOutput: sourcePackSafeOutput()
  }, 200);
}

function mergeSourcePackActivations(
  pack: SourcePackRegistry,
  activations: ReturnType<typeof applyDwmSourcePackValidationResults>[]
) {
  return {
    pack,
    activeSources: activations.flatMap((activation) => activation.activeSources),
    blockedCandidates: activations.flatMap((activation) => activation.blockedCandidates),
    summary: {
      activeSourceCount: activations.reduce((total, activation) => total + activation.summary.activeSourceCount, 0),
      blockedCandidateCount: activations.reduce((total, activation) => total + activation.summary.blockedCandidateCount, 0),
      retryScheduledCount: activations.reduce((total, activation) => total + activation.summary.retryScheduledCount, 0),
      failedCount: activations.reduce((total, activation) => total + activation.summary.failedCount, 0),
      disabledCount: activations.reduce((total, activation) => total + activation.summary.disabledCount, 0)
    },
    safeOutput: sourcePackSafeOutput()
  };
}

function validateSourcePackCandidateForWorker(candidate: SourcePackRegistryCandidate): DwmSourceCandidateValidationResult {
  if (candidate.status === "duplicate") {
    return {
      candidateId: candidate.id,
      state: "disabled",
      parserStatus: "duplicate_skipped",
      validationScore: 0,
      failure: { code: "duplicate_candidate", message: "Duplicate source-pack candidate retained without activation." }
    };
  }
  if (candidate.status === "rejected" || candidate.status === "suppressed" || candidate.decision === "suppressed") {
    return {
      candidateId: candidate.id,
      state: "disabled",
      parserStatus: "intake_blocked",
      validationScore: 0,
      failure: { code: String(candidate.failure?.code ?? "intake_blocked"), message: String(candidate.failure?.message ?? candidate.reason ?? "Candidate was blocked before validation.") }
    };
  }
  if ((candidate.declaredFamily === "darkweb_onion" || candidate.declaredFamily === "darkweb_metadata") && candidate.policyBoundary?.metadataOnly !== true) {
    return {
      candidateId: candidate.id,
      state: "failed",
      parserStatus: "metadata_policy_blocked",
      validationScore: 0,
      failure: { code: "metadata_only_policy_required", message: "Restricted darkweb candidates require metadataOnly governance before activation." }
    };
  }
  if (candidate.parserExpectation.includes("retry_fixture") || candidate.retryHint) {
    return {
      candidateId: candidate.id,
      state: "retry_scheduled",
      parserStatus: "parser_retry_scheduled",
      validationScore: 0.45,
      failure: { code: "parser_retry_scheduled", message: candidate.retryHint ?? "Parser validation retry scheduled." }
    };
  }
  return {
    candidateId: candidate.id,
    state: "active",
    parserStatus: workerParserStatusForFamily(candidate.declaredFamily),
    validationScore: candidate.declaredFamily === "telegram" ? 0.92 : candidate.policyBoundary?.metadataOnly === true ? 0.78 : 0.7
  };
}

function workerParserStatusForFamily(family: SourceGrowthFamily): string {
  if (family === "telegram") return "telegram_public_parser_ready";
  if (family === "darkweb_onion" || family === "darkweb_metadata") return "restricted_metadata_parser_ready";
  return `${family}_parser_ready`;
}

function defaultSourcePackWorkerConcurrency(): Partial<Record<SourceGrowthFamily, number>> {
  return {
    telegram: 25,
    darkweb_metadata: 8,
    darkweb_onion: 2,
    actor_page: 4,
    public_advisory: 8,
    clear_web: 8
  };
}

function persistSourcePackWorkerCollectionState(
  sources: SourceRecord[],
  receipts: Array<{ status: string; taskId: string; sourceId: string; candidateId: string; reason?: string }>,
  options: ApiServerOptions,
  at: string
) {
  const receiptBySourceId = new Map(receipts.map((receipt) => [receipt.sourceId, receipt]));
  for (const source of sources) {
    const receipt = receiptBySourceId.get(source.id);
    if (!receipt) continue;
    const candidate = sourceCandidate(source);
    const collectionTrigger = {
      id: stableId("dwm_collection_trigger", `${candidate.id}:${source.id}:source_pack_worker`),
      type: "frontier_collection",
      queued: receipt.status !== "blocked",
      unsafeJobQueued: false,
      queue: "frontier",
      jobId: receipt.taskId,
      taskId: receipt.taskId,
      candidateId: candidate.id,
      sourceId: source.id,
      activeSourceId: source.id,
      reason: receipt.reason,
      queuedAt: at,
      policyBoundary: candidate.policyBoundary ?? source.metadata?.policyBoundary,
      parserStatus: sourceParserStatus(source).status
    };
    const alertRebuild = skippedAlertRebuild(source, "captures_required_before_alert_rebuild");
    options.store.saveSource({
      ...source,
      metadata: {
        ...(source.metadata ?? {}),
        sourceCandidate: {
          ...candidate,
          collectionTrigger,
          alertRebuild,
          collectionStatus: collectionTrigger.queued ? "queued" : "not_queued",
          lastCollectionOutcome: collectionTrigger.queued
            ? { status: "queued", at, taskId: receipt.taskId, triggerId: collectionTrigger.id }
            : { status: "skipped", at, reason: receipt.reason ?? "collection_not_queued" }
        },
        collectionTrigger,
        alertRebuild,
        collectionStatus: collectionTrigger.queued ? "queued" : "not_queued",
        lastCollectionOutcome: collectionTrigger.queued
          ? { status: "queued", at, taskId: receipt.taskId, triggerId: collectionTrigger.id }
          : { status: "skipped", at, reason: receipt.reason ?? "collection_not_queued" }
      },
      updatedAt: at
    } as SourceRecord);
  }
}

function persistedCollectionReceiptsForPack(sourcePackId: string, options: ApiServerOptions): DwmSourcePackCollectionQueueReceiptRecord[] {
  return sourcePackCollectionReceiptStore(options).list().filter((receipt) => receipt.packId === sourcePackId);
}

function persistSourcePackWorkerCollectionReceipts(
  jobs: ReturnType<typeof buildDwmSourcePackCollectionJobHandoff>["jobs"],
  receipts: Array<{ status: string; taskId: string; sourceId: string; candidateId: string; reason?: string }>,
  options: ApiServerOptions
) {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const receiptStore = sourcePackCollectionReceiptStore(options);
  for (const receipt of receipts) {
    const job = jobById.get(receipt.taskId);
    if (!job) continue;
    receiptStore.upsert({
      status: receipt.status === "blocked" ? "blocked" : receipt.status === "duplicate" ? "duplicate" : "queued",
      taskId: receipt.taskId,
      sourceId: receipt.sourceId,
      candidateId: receipt.candidateId,
      reason: receipt.reason,
      packId: job.packId,
      requestId: job.requestId,
      family: job.family,
      queuedAt: job.queuedAt,
      parserStatus: job.parserStatus,
      validationJobKey: job.validationJobKey,
      targetRawStored: false
    });
  }
}

function applySourcePackReviewAction(source: SourceRecord, body: DwmSourceRequestBody, options: ApiServerOptions, input: {
  packAction: NonNullable<DwmSourceRequestBody["packAction"]>;
  actor: string;
  reviewedAt: string;
}) {
  const contract = sourcePackActionContract({
    pack: sourcePackStore(options).get(String(sourceCandidate(source).sourcePackId ?? "")),
    candidate: sourceCandidate(source),
    source,
    packAction: input.packAction,
    body,
    options
  });
  if (body.dryRun === true || !contract.allowed) {
    return sourcePackReviewResult(source, contract.allowed ? "prepared" : "blocked", {
      reviewedAt: input.reviewedAt,
      actor: input.actor,
      reason: body.reason,
      collectionTrigger: sourceCandidate(source).collectionTrigger ?? skippedCollectionTrigger(source, contract.allowed ? "dry_run_prepare" : String(contract.blockers[0]?.code ?? "action_blocked")),
      alertRebuild: sourceCandidate(source).alertRebuild ?? skippedAlertRebuild(source, "captures_required_before_alert_rebuild"),
      actionContract: contract,
      error: contract.allowed ? undefined : { code: String(contract.blockers[0]?.code ?? "action_blocked"), message: String(contract.blockers[0]?.message ?? "Source-pack action blocked.") }
    });
  }

  if (input.packAction === "approve" || input.packAction === "promote") {
    if (isRestrictedMetadataSource(source) && body.approveMetadataOnly !== true) {
      return sourcePackReviewResult(source, "approval_blocked", {
        reviewedAt: input.reviewedAt,
        actor: input.actor,
        reason: body.reason ?? "metadata-only approval required before restricted source activation",
        collectionTrigger: skippedCollectionTrigger(source, "metadata_only_approval_required"),
        alertRebuild: skippedAlertRebuild(source, "metadata_only_approval_required"),
        error: {
          code: "metadata_only_approval_required",
          message: "Restricted metadata pack candidates require approveMetadataOnly=true before activation."
        },
        actionContract: sourcePackActionContract({
          pack: sourcePackStore(options).get(String(sourceCandidate(source).sourcePackId ?? "")),
          candidate: sourceCandidate(source),
          source,
          packAction: input.packAction,
          body,
          options,
          extraBlockers: [{ code: "activation_disabled", severity: "blocking", message: "metadata-only approval required", retryable: true }]
        })
      });
    }
    const activated = saveLifecyclePatch(source, options, {
      action: "promote",
      actor: input.actor,
      reason: body.reason ?? (isRestrictedMetadataSource(source) ? "source-pack metadata-only approval" : "source-pack public source approved"),
      status: "active",
      healthStatus: "ready",
      parserStatus: parserStatusForSource(source),
      activationState: isRestrictedMetadataSource(source) ? "metadata_only_approved" : "active_canary",
      approveMetadataOnly: isRestrictedMetadataSource(source)
    });
    const operations = persistOperationalNextStep(activated, options, "pack_review");
    updateSourcePackRegistryDecision(options, operations.source, {
      action: "approved",
      actor: input.actor,
      reason: body.reason,
      at: input.reviewedAt
    });
    return sourcePackReviewResult(operations.source, "approved", {
      reviewedAt: input.reviewedAt,
      actor: input.actor,
      reason: body.reason,
      collectionTrigger: operations.collectionTrigger,
      alertRebuild: operations.alertRebuild,
      actionContract: contract
    });
  }

  if (input.packAction === "reject") {
    const rejected = saveLifecyclePatch(source, options, {
      action: "reject",
      actor: input.actor,
      reason: body.reason ?? "source-pack candidate rejected",
      status: "rejected",
      healthStatus: "blocked",
      parserStatus: "not_scheduled",
      activationState: "rejected"
    });
    updateSourcePackRegistryDecision(options, rejected, {
      action: "rejected",
      actor: input.actor,
      reason: body.reason,
      at: input.reviewedAt
    });
    return sourcePackReviewResult(rejected, "rejected", { reviewedAt: input.reviewedAt, actor: input.actor, reason: body.reason, actionContract: contract });
  }

  if (input.packAction === "suppress") {
    const suppressed = saveLifecyclePatch(source, options, {
      action: "suppress",
      actor: input.actor,
      reason: body.reason ?? "source-pack candidate suppressed",
      status: "suppressed",
      healthStatus: "suppressed",
      parserStatus: "not_scheduled",
      activationState: "suppressed"
    });
    updateSourcePackRegistryDecision(options, suppressed, {
      action: "suppressed",
      actor: input.actor,
      reason: body.reason,
      at: input.reviewedAt
    });
    return sourcePackReviewResult(suppressed, "suppressed", { reviewedAt: input.reviewedAt, actor: input.actor, reason: body.reason, actionContract: contract });
  }

  const retried = saveLifecyclePatch(source, options, {
    action: "retry",
    actor: input.actor,
    reason: body.reason ?? "operator requested source-pack retry",
    status: source.status,
    healthStatus: "retry_scheduled",
    parserStatus: parserStatusForSource(source),
    activationState: activationStateForSource(source)
  });
  const failed = recordCollectionFailure(retried, {
    ...body,
    collectionTaskId: body.collectionTaskId ?? String(retried.metadata?.sourceCandidate?.collectionTrigger?.taskId ?? retried.metadata?.sourceCandidate?.collectionTrigger?.jobId ?? ""),
    errorCode: body.errorCode ?? "pack_retry_requested",
    reason: body.reason ?? "operator requested source-pack retry"
  }, options);
  updateSourcePackRegistryDecision(options, failed.source, {
    action: "retry_scheduled",
    actor: input.actor,
    reason: body.reason,
    at: input.reviewedAt
  });
  return sourcePackReviewResult(failed.source, "retry_scheduled", {
    reviewedAt: input.reviewedAt,
    actor: input.actor,
    reason: body.reason,
    collectionTrigger: failed.collectionTrigger,
    alertRebuild: failed.alertRebuild,
    actionContract: contract
  });
}

function applySourcePackRegistryReviewAction(pack: SourcePackRegistry, candidate: SourcePackRegistryCandidate, body: DwmSourceRequestBody, options: ApiServerOptions, input: {
  packAction: NonNullable<DwmSourceRequestBody["packAction"]>;
  actor: string;
  reviewedAt: string;
}) {
  const contract = sourcePackActionContract({ pack, candidate, packAction: input.packAction, body, options });
  if (body.dryRun === true || !contract.allowed) {
    return sourcePackRegistryReviewResult(pack, candidate, contract.allowed ? "prepared" : "blocked", input, {
      actionContract: contract,
      error: contract.allowed ? undefined : { code: String(contract.blockers[0]?.code ?? "action_blocked"), message: String(contract.blockers[0]?.message ?? "Source-pack action blocked.") }
    });
  }

  if (input.packAction === "suppress") {
    const updated = saveSourcePackRegistryCandidateDecision(pack, candidate.id, options, {
      status: "suppressed",
      decision: isDuplicateSourcePackCandidate(candidate) ? "suppressed_duplicate" : "suppressed",
      actor: input.actor,
      at: input.reviewedAt,
      reason: body.reason ?? "source-pack registry candidate suppressed"
    });
    return sourcePackRegistryReviewResult(updated.pack, updated.candidate, "suppressed", input, { actionContract: contract });
  }

  if (input.packAction === "retry") {
    const updated = saveSourcePackRegistryCandidateDecision(pack, candidate.id, options, {
      status: "retry_scheduled",
      decision: "retry_scheduled",
      actor: input.actor,
      at: input.reviewedAt,
      reason: body.reason ?? "source-pack registry retry requested",
      parserStatus: "parser_retry_scheduled",
      healthStatus: "retry_scheduled",
      retryHint: `retry requested at ${input.reviewedAt}`
    });
    return sourcePackRegistryReviewResult(updated.pack, updated.candidate, "retry_scheduled", input, { actionContract: contract });
  }

  return sourcePackRegistryReviewResult(pack, candidate, "blocked", input, {
    actionContract: contract,
    error: { code: "activation_disabled", message: "Registry-only candidates require a source row or worker validation before activation." }
  });
}

function sourcePackReviewResult(source: SourceRecord | undefined, reviewStatus: string, input: {
  reviewedAt: string;
  actor: string;
  reason?: string;
  collectionTrigger?: Record<string, unknown>;
  alertRebuild?: Record<string, unknown>;
  actionContract?: Record<string, unknown>;
  error?: Record<string, unknown>;
}) {
  if (!source) return { reviewStatus, error: input.error };
  const candidate = sourceCandidate(source);
  return {
    reviewStatus,
    reviewedAt: input.reviewedAt,
    actor: input.actor,
    reason: input.reason,
    source,
    candidate,
    health: sourceHealthStatus(source),
    parser: sourceParserStatus(source),
    lifecycle: sourceLifecycle(source),
    policy: sourcePolicyPosture(source),
    collectionTrigger: input.collectionTrigger ?? candidate.collectionTrigger ?? skippedCollectionTrigger(source, reviewStatus),
    alertRebuild: input.alertRebuild ?? candidate.alertRebuild ?? skippedAlertRebuild(source, "captures_required_before_alert_rebuild"),
    actionContract: input.actionContract,
    nextAction: nextSourceAction(source),
    error: input.error
  };
}

function sourcePackRegistryReviewResult(pack: SourcePackRegistry, candidate: SourcePackRegistryCandidate, reviewStatus: string, input: {
  packAction: NonNullable<DwmSourceRequestBody["packAction"]>;
  actor: string;
  reviewedAt: string;
}, output: { actionContract: Record<string, unknown>; error?: Record<string, unknown> }) {
  return {
    reviewStatus,
    reviewedAt: input.reviewedAt,
    actor: input.actor,
    sourcePackId: pack.id,
    sourcePackLabel: pack.label,
    candidate: {
      id: candidate.id,
      sourcePackId: pack.id,
      sourcePackLabel: pack.label,
      family: candidate.family,
      declaredFamily: candidate.declaredFamily,
      status: candidate.status,
      decision: candidate.decision,
      targetRef: candidate.targetRef,
      retryHint: candidate.retryHint,
      failure: candidate.failure
    },
    health: registryOnlySourceHealth(candidate),
    parser: {
      status: candidate.parserStatus ?? "not_scheduled",
      profile: parserProfileForFamily(candidate.declaredFamily),
      expectation: candidate.parserExpectation,
      warnings: candidate.failure?.message ? [String(candidate.failure.message)] : []
    },
    lifecycle: {
      status: candidate.status,
      activationState: candidate.decision ?? candidate.status,
      parserStatus: candidate.parserStatus ?? "not_scheduled",
      healthStatus: candidate.healthStatus ?? (candidate.status === "duplicate" ? "duplicate_skipped" : "blocked"),
      persisted: true,
      registryOnly: true
    },
    collectionTrigger: {
      id: stableId("dwm_collection_trigger", `${candidate.id}:registry_action`),
      type: "frontier_collection",
      queued: false,
      unsafeJobQueued: false,
      reason: reviewStatus,
      candidateId: candidate.id,
      policyBoundary: candidate.policyBoundary,
      parserStatus: candidate.parserStatus ?? "not_scheduled"
    },
    alertRebuild: {
      id: stableId("dwm_alert_rebuild_trigger", `${candidate.id}:registry_action`),
      candidateId: candidate.id,
      queued: false,
      skipped: true,
      reason: "no_capture_for_registry_only_candidate"
    },
    actionContract: output.actionContract,
    error: output.error
  };
}

function sourcePackStatusResponse(body: DwmSourceRequestBody, options: ApiServerOptions) {
  const registry = findSourcePackRegistry(body, options);
  const sources = registry ? sourcesForPack(registry.id, options) : lookupSourcePackReviewSources(body, options);
  const sourcePackId = String(registry?.id ?? body.sourcePackId ?? (sources[0] ? sourceCandidate(sources[0]).sourcePackId : "") ?? "").trim();
  const sourcePackLabel = String(registry?.label ?? (sources[0] ? sourceCandidate(sources[0]).sourcePackLabel : undefined) ?? (sourcePackId || "source pack"));
  const registryStatus = registry ? sourcePackRegistryStatus(registry, options) : undefined;
  return {
    action: "pack_status",
    sourcePackId: sourcePackId || undefined,
    sourcePackLabel,
    candidates: registryStatus?.candidates ?? sources.map((source) => sourcePackStatusItem(source)),
    packStatus: sourcePackRollup({ sourcePackId: sourcePackId || undefined, sourcePackLabel, sources, registry }),
    registry: registryStatus,
    safeOutput: sourcePackSafeOutput()
  };
}

function sourcePackCustomerConfigResponse(body: DwmSourceRequestBody, options: ApiServerOptions) {
  const registry = findSourcePackRegistry(body, options);
  const packs = registry ? [registry] : sourcePackStore(options).list({ limit: body.limit ?? 500 }).items;
  const generatedAt = body.generatedAt ?? nowIso();
  const workerState = sourcePackWorkerStateForPacks(packs, options);
  const lastRunTime = workerState.lastRun?.completedAt ?? workerState.lastRun?.startedAt;
  const staleAfterMinutes = 120;
  const ageMinutes = lastRunTime ? Math.max(0, Math.floor((Date.parse(generatedAt) - Date.parse(lastRunTime)) / 60000)) : undefined;
  const freshness = !workerState.lastRun
    ? "missing"
    : ageMinutes !== undefined && ageMinutes > staleAfterMinutes
      ? "stale"
      : "fresh";
  const sourceCustomerConfig = buildDwmSourcePackCustomerConfigReadiness(packs, options, {
    generatedAt,
    freshness,
    staleAfterMinutes,
    tenantId: body.tenantId,
    orgId: body.orgId,
    customerId: body.customerId,
    scope: body.scope,
    family: body.family,
    mode: body.configMode ?? (body.dryRun === true ? "prepare" : "read"),
    operation: body.configOperation,
    target: body.target,
    operatorRole: body.operatorRole,
    ownerLane: body.ownerLane,
    idempotencyKey: body.idempotencyKey,
    auditReason: body.auditReason ?? body.reason
  });
  return {
    action: "pack_customer_config",
    sourcePackId: registry?.id ?? body.sourcePackId,
    sourcePackLabel: registry?.label,
    ...sourceCustomerConfig,
    sourceReadinessArtifact: buildDwmSourceReadinessArtifact(sourceCustomerConfig, {
      generatedAt,
      tenantId: body.tenantId,
      orgId: body.orgId,
      customerId: body.customerId,
      scope: body.scope
    })
  };
}

function sourceActorEnrichmentReadinessResponse(body: DwmSourceRequestBody, options: ApiServerOptions) {
  const query = String(body.query ?? body.scope ?? body.target ?? "").split(",")[0]?.trim() || "unknown_actor";
  const config = sourcePackCustomerConfigResponse({
    ...body,
    action: "pack_customer_config",
    scope: body.scope ?? query
  }, options) as Record<string, any>;
  const actorReadiness = buildActorPageSourceReadiness(query, config.sourceReadinessArtifact);
  return {
    action: "actor_enrichment_readiness",
    schemaVersion: "dwm.actor_page_source_readiness.v1",
    generatedAt: config.generatedAt,
    query,
    sourcePackId: config.sourcePackId,
    sourcePackLabel: config.sourcePackLabel,
    actorReadiness,
    sourceReadinessArtifact: config.sourceReadinessArtifact,
    candidateIntakeContract: sourceActorCandidateIntakeContract(query, actorReadiness),
    proofArtifacts: sourceActorReadinessProofArtifacts(query, actorReadiness),
    safeOutput: {
      rawTargetsExposed: false,
      rawUnsafeRowsStored: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function sourceActorReadinessProofArtifacts(query: string, actorReadiness: Record<string, any>) {
  const publicTiQueryAdapter = sourceActorPublicTiQueryAdapter(query, actorReadiness);
  const dashboardSourceOperationsAdapter = sourceActorDashboardSourceOperationsAdapter({
    query,
    actorReadiness,
    publicTiQueryAdapter
  });
  return {
    schemaVersion: "dwm.actor_source_readiness_proof_artifacts.v1",
    proofId: actorReadiness.proofId,
    query,
    publicTiQueryAdapter,
    publicTiActorPage: {
      schemaVersion: "ti.public_actor.source_readiness.v1",
      proofId: actorReadiness.proofId,
      query,
      queryAdapter: publicTiQueryAdapter,
      actorMetadata: actorReadiness.actorMetadata,
      state: actorReadiness.state,
      sections: actorReadiness.actorSections,
      provenance: actorReadiness.provenance,
      evidenceReadiness: actorReadiness.evidenceReadiness,
      parserHealthReadiness: actorReadiness.parserHealthReadiness,
      freshness: actorReadiness.freshness,
      sourceCoverage: actorReadiness.sourceCoverage,
      sourceReadinessLedgerRows: actorReadiness.sourceReadinessLedgerRows,
      captureReadiness: actorReadiness.captureReadiness,
      alertGenerationReadiness: actorReadiness.alertGenerationReadiness,
      sourceOperationsQueue: actorReadiness.sourceOperationsQueue,
      sourceFamilyHealth: actorReadiness.sourceFamilyHealth,
      sourceConsumerBridge: actorReadiness.sourceConsumerBridge,
      sourceSectionReadiness: actorReadiness.sourceSectionReadiness,
      missingDataGaps: actorReadiness.candidateGaps,
      sourcePackActionReadiness: actorReadiness.sourcePackActionReadiness,
      alertCaseHandoffReadiness: actorReadiness.alertCaseHandoffReadiness
    },
    dashboardSourceReadiness: {
      schemaVersion: "dwm.dashboard.source_readiness_row.v1",
      proofId: actorReadiness.proofId,
      query,
      activeSourceFamilies: actorReadiness.alertability.activeSourceFamilies,
      evidenceReadiness: actorReadiness.evidenceReadiness,
      parserHealthReadiness: actorReadiness.parserHealthReadiness,
      sourceCoverage: actorReadiness.sourceCoverage,
      sourceReadinessLedgerRows: actorReadiness.sourceReadinessLedgerRows,
      captureReadiness: actorReadiness.captureReadiness,
      alertGenerationReadiness: actorReadiness.alertGenerationReadiness,
      sourceOperationsQueue: actorReadiness.sourceOperationsQueue,
      sourceFamilyHealth: actorReadiness.sourceFamilyHealth,
      sourceConsumerBridge: actorReadiness.sourceConsumerBridge,
      sourceSectionReadiness: actorReadiness.sourceSectionReadiness,
      sourcePackActionReadiness: actorReadiness.sourcePackActionReadiness,
      sourceOperationsAdapter: dashboardSourceOperationsAdapter,
      matchableFields: actorReadiness.alertability.matchableFields,
      retryBlockers: actorReadiness.retryBlockers,
      blockerCount: [
        ...(actorReadiness.candidateGaps ?? []),
        ...(actorReadiness.retryBlockers ?? []),
        ...(actorReadiness.missingSections ?? [])
      ].length,
      freshnessState: actorReadiness.freshness?.captureFreshness?.state,
      alertReady: actorReadiness.alertCaseHandoffReadiness?.alertReady === true,
      caseReady: actorReadiness.alertCaseHandoffReadiness?.caseReady === true
    },
    worker3Assertions: [
      ".schemaVersion == \"dwm.actor_page_source_readiness.v1\"",
      ".actorReadiness.proofId | length > 0",
      ".actorReadiness.safeOutput.liveNetworkScrapeStarted == false",
      ".actorReadiness.freshness.captureFreshness.state | IN(\"fresh\",\"needs_capture\",\"stale\")",
      ".actorReadiness.evidenceReadiness.schemaVersion == \"dwm.actor_evidence_readiness.v1\"",
      ".actorReadiness.parserHealthReadiness.schemaVersion == \"dwm.actor_parser_health_readiness.v1\"",
      ".actorReadiness.alertCaseHandoffReadiness.schemaVersion == \"dwm.actor_alert_case_handoff_readiness.v1\"",
      ".actorReadiness.sourcePackActionReadiness.schemaVersion == \"dwm.actor_source_pack_action_readiness.v1\"",
      ".actorReadiness.sourceReadinessLedgerRows | all(has(\"proofId\") and has(\"family\") and has(\"state\") and .safeOutput.liveNetworkScrapeStarted == false)",
      ".actorReadiness.captureReadiness.schemaVersion == \"dwm.actor_capture_readiness.v1\"",
      ".actorReadiness.alertGenerationReadiness.schemaVersion == \"dwm.actor_alert_generation_readiness.v1\"",
      ".actorReadiness.alertGenerationReadiness.watchlistMatchReadiness.schemaVersion == \"dwm.actor_watchlist_match_readiness.v1\"",
      ".actorReadiness.sourceOperationsQueue.schemaVersion == \"dwm.actor_source_operations_queue.v1\"",
      ".actorReadiness.sourceOperationsQueue.queueItems | all(.route.path | length > 0 and .liveNetworkFetch == false and .safeOutput.liveNetworkScrapeStarted == false)",
      ".actorReadiness.sourceFamilyHealth.schemaVersion == \"dwm.actor_source_family_health.v1\"",
      ".actorReadiness.sourceFamilyHealth.rows | all(has(\"family\") and has(\"parserState\") and has(\"timestamps\") and has(\"confidence\") and .safeOutput.liveNetworkScrapeStarted == false)",
      ".actorReadiness.sourceConsumerBridge.schemaVersion == \"dwm.actor_source_consumer_bridge.v1\"",
      ".actorReadiness.sourceConsumerBridge.consumers | all(has(\"consumer\") and has(\"ready\") and has(\"sourceFamilies\") and .safeOutput.liveNetworkScrapeStarted == false)",
      ".actorReadiness.sourceSectionReadiness.schemaVersion == \"dwm.actor_source_section_readiness.v1\"",
      ".actorReadiness.sourceSectionReadiness.sections | all(has(\"section\") and has(\"state\") and has(\"sourceFamilies\") and .safeOutput.liveNetworkScrapeStarted == false)",
      ".proofArtifacts.publicTiQueryAdapter.schemaVersion == \"ti.public_actor.query_adapter.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.sections | all(has(\"section\") and has(\"state\") and has(\"provenance\") and .safeOutput.liveNetworkScrapeStarted == false)",
      ".proofArtifacts.publicTiQueryAdapter.alertEvidenceHandoff.schemaVersion == \"ti.public_actor.alert_evidence_handoff.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.parserStatusLedger.schemaVersion == \"ti.public_actor.parser_status_ledger.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.sourcePackIntakeHandoff.schemaVersion == \"ti.public_actor.source_pack_intake_handoff.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.alertGenerationConsumerHandoff.schemaVersion == \"ti.public_actor.alert_generation_consumer_handoff.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.consumerProofLedger.schemaVersion == \"ti.public_actor.consumer_proof_ledger.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.sourceOperationsHandoff.schemaVersion == \"ti.public_actor.source_operations_handoff.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.downstreamFixtureExport.schemaVersion == \"ti.public_actor.downstream_fixture_export.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.sourceFamilyCoverageMatrix.schemaVersion == \"ti.public_actor.source_family_coverage_matrix.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.sourcePackActivationPreview.schemaVersion == \"ti.public_actor.source_pack_activation_preview.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger.schemaVersion == \"ti.public_actor.source_enrichment_freshness_ledger.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.alertEnrichmentHandoff.schemaVersion == \"ti.public_actor.alert_enrichment_handoff.v1\"",
      ".proofArtifacts.publicTiQueryAdapter.watchlistAlertabilityBridge.schemaVersion == \"ti.public_actor.watchlist_alertability_bridge.v1\"",
      ".candidateIntakeContract.policyValidation.liveNetworkFetch == false",
      ".proofArtifacts.publicTiActorPage.provenance | all(.safeOutput.liveNetworkScrapeStarted == false)",
      ".proofArtifacts.dashboardSourceReadiness.sourceOperationsAdapter.schemaVersion == \"dwm.dashboard.source_operations_adapter.v1\"",
      ".proofArtifacts.dashboardSourceReadiness.alertReady != null"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function buildActorPageSourceReadiness(query: string, readinessArtifact: Record<string, any>) {
  const coverage = (readinessArtifact.actorCoverage ?? []).find((row: any) => String(row.watchlistTerm).toLowerCase() === query.toLowerCase())
    ?? readinessArtifact.actorCoverage?.[0]
    ?? {};
  const ledgerRows = Array.isArray(readinessArtifact.readinessLedgerRows) ? readinessArtifact.readinessLedgerRows : [];
  const familyRows = Array.isArray(readinessArtifact.sourceFamilyReadiness) ? readinessArtifact.sourceFamilyReadiness : [];
  const candidateGaps = familyRows
    .filter((row: any) => Number(row.candidateCount ?? 0) === 0 || row.failed > 0 || row.blocked > 0 || row.policyBlocked > 0 || (!row.canEnrichActor && !row.canProduceAlert))
    .map((row: any) => ({
      family: row.family,
      state: Number(row.candidateCount ?? 0) === 0 ? "missing" : row.failed > 0 ? "failed" : row.blocked > 0 || row.policyBlocked > 0 ? "policy_blocked" : "not_ready",
      parserStatuses: row.parserStatuses ?? [],
      retryBackoff: row.retryBackoff,
      blockers: row.blockers ?? [],
      intakeRecommendation: sourceActorIntakeRecommendation(query, row.family)
    }));
  const provenance = ledgerRows
    .filter((row: any) => row.canEnrichActor || row.canProduceAlert || row.lastCaptureAt)
    .map((row: any) => ({
      family: row.family,
      candidateIds: row.candidateIds ?? [],
      sourceIds: row.sourceIds ?? [],
      state: row.state,
      lastCaptureAt: row.lastCaptureAt,
      lastEnrichmentAt: row.lastEnrichmentAt,
      matchableFields: row.matchableFields ?? [],
      alertableFields: row.alertableFields ?? [],
      privacyBoundary: row.privacyBoundary,
      sourceTrust: row.sourceTrust,
      safeOutput: row.safeOutput
    }));
  const actorSections = coverage.actorSections ?? {};
  const missingSections = Object.entries(actorSections)
    .filter(([, value]: [string, any]) => value?.covered !== true)
    .map(([section, value]: [string, any]) => ({
      section,
      blockers: value?.blockers ?? [{ code: "missing_source_family", severity: "warning", retryable: true }]
    }));
  const freshnessRows = ledgerRows.filter((row: any) => row.lastCaptureAt || row.lastEnrichmentAt);
  const latestCaptureAt = latestIso(freshnessRows.map((row: any) => row.lastCaptureAt));
  const latestEnrichmentAt = latestIso(freshnessRows.map((row: any) => row.lastEnrichmentAt));
  const captureFreshness = sourceActorCaptureFreshness(latestCaptureAt, readinessArtifact.generatedAt);
  const freshness = {
    lastSuccessfulCaptureAt: latestCaptureAt,
    lastSuccessfulEnrichmentAt: latestEnrichmentAt,
    stale: captureFreshness.state !== "fresh",
    captureFreshness,
    checkedAt: readinessArtifact.generatedAt
  };
  const sourceCoverage = sourceActorCoverageRows(familyRows);
  const alertability = {
    activeSourceFamilies: readinessArtifact.sharedWatchlistAlertability?.activeSourceFamilies ?? [],
    matchableFields: readinessArtifact.sharedWatchlistAlertability?.matchableFields ?? [],
    watchlistTerms: readinessArtifact.sharedWatchlistAlertability?.watchlistTerms ?? [],
    sourceTrust: readinessArtifact.sharedWatchlistAlertability?.sourceTrust,
    blockerReasons: readinessArtifact.sharedWatchlistAlertability?.blockerReasons ?? [],
    sourcePolicyLimits: readinessArtifact.sharedWatchlistAlertability?.sourcePolicyLimits ?? []
  };
  const retryBlockers = ledgerRows
    .filter((row: any) => row.retryBackoff?.retryable || (row.blockerCodes ?? []).length > 0)
    .map((row: any) => ({
      family: row.family,
      retryBackoff: row.retryBackoff,
      blockerCodes: row.blockerCodes ?? []
    }));
  const sourcePackActionReadiness = sourceActorPackActionReadiness({
    query,
    sourceCoverage,
    retryBlockers,
    candidateGaps
  });
  const sourceReadinessLedgerRows = sourceActorDownstreamReadinessRows({
    query,
    sourceCoverage,
    candidateGaps,
    retryBlockers,
    sourcePackActionReadiness,
    freshness
  });
  const evidenceReadiness = sourceActorEvidenceReadiness({
    query,
    provenance,
    sourceReadinessLedgerRows,
    candidateGaps,
    freshness
  });
  const parserHealthReadiness = sourceActorParserHealthReadiness({
    query,
    sourceReadinessLedgerRows,
    sourceCoverage,
    sourcePackActionReadiness,
    freshness
  });
  const captureReadiness = sourceActorCaptureReadiness({
    query,
    sourceReadinessLedgerRows,
    freshness,
    candidateGaps,
    retryBlockers
  });
  const alertGenerationReadiness = sourceActorAlertGenerationReadiness({
    query,
    alertability,
    sourceReadinessLedgerRows,
    latestCaptureAt,
    candidateGaps,
    retryBlockers,
    missingSections
  });
  const sourceOperationsQueue = sourceActorOperationsQueue({
    query,
    parserHealthReadiness,
    captureReadiness,
    alertGenerationReadiness,
    sourcePackActionReadiness
  });
  const sourceFamilyHealth = sourceActorFamilyHealth({
    query,
    sourceCoverage,
    parserHealthReadiness,
    evidenceReadiness,
    captureReadiness,
    alertGenerationReadiness,
    sourceOperationsQueue,
    freshness
  });
  const sourceConsumerBridge = sourceActorConsumerBridge({
    query,
    sourceFamilyHealth,
    evidenceReadiness,
    alertGenerationReadiness,
    alertCaseHandoffReadiness: sourceActorAlertCaseHandoffReadiness({
      query,
      alertability,
      latestCaptureAt,
      candidateGaps,
      retryBlockers,
      missingSections
    }),
    sourceOperationsQueue,
    candidateGaps,
    freshness
  });
  const sourceSectionReadiness = sourceActorSectionReadiness({
    query,
    actorSections,
    sourceFamilyHealth,
    sourceOperationsQueue,
    candidateGaps
  });
  return {
    proofId: stableId("dwm_actor_source_readiness", `${query}:${readinessArtifact.generatedAt}:${latestCaptureAt ?? "no_capture"}:${latestEnrichmentAt ?? "no_enrichment"}`),
    query,
    actorMetadata: sourceActorMetadata(query, provenance, coverage),
    state: candidateGaps.some((gap: any) => gap.state === "policy_blocked")
      ? "blocked"
      : missingSections.length > 0
        ? "partial"
        : provenance.length > 0
          ? "ready"
          : "missing",
    sourceFamilies: {
      active: readinessArtifact.sharedWatchlistAlertability?.activeSourceFamilies ?? [],
      enrichable: readinessArtifact.sharedWatchlistAlertability?.enrichableSourceFamilies ?? [],
      paused: readinessArtifact.sharedWatchlistAlertability?.pausedSourceFamilies ?? [],
      failed: readinessArtifact.sharedWatchlistAlertability?.failedSourceFamilies ?? [],
      blocked: readinessArtifact.sharedWatchlistAlertability?.blockedSourceFamilies ?? []
    },
    sourceCoverage,
    parserStatusByFamily: Object.fromEntries(familyRows.map((row: any) => [row.family, row.parserStatuses ?? []])),
    actorSections,
    missingSections,
    provenance,
    evidenceReadiness,
    parserHealthReadiness,
    freshness,
    candidateGaps,
    retryBlockers,
    sourcePackActionReadiness,
    sourceReadinessLedgerRows,
    captureReadiness,
    alertGenerationReadiness,
    sourceOperationsQueue,
    sourceFamilyHealth,
    sourceConsumerBridge,
    sourceSectionReadiness,
    alertability,
    alertCaseHandoffReadiness: sourceConsumerBridge.alertCaseHandoffReadiness,
    safeOutput: {
      rawTargetsExposed: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function sourceActorDashboardSourceOperationsAdapter(input: {
  query: string;
  actorReadiness: Record<string, any>;
  publicTiQueryAdapter: Record<string, any>;
}) {
  const operationsByFamily = new Map<string, Array<Record<string, any>>>();
  const freshnessRows = input.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger?.rows ?? [];
  for (const operation of input.publicTiQueryAdapter.sourceOperationsHandoff?.operations ?? []) {
    const families = String(operation.family) === "all_active"
      ? freshnessRows.map((row: any) => String(row.sourceFamily))
      : [String(operation.family)];
    for (const family of families) operationsByFamily.set(family, [...(operationsByFamily.get(family) ?? []), operation]);
  }
  const alertRowsByFamily = new Map<string, Array<Record<string, any>>>();
  for (const row of input.publicTiQueryAdapter.alertEnrichmentHandoff?.rows ?? []) {
    const family = String(row.sourceFamily);
    alertRowsByFamily.set(family, [...(alertRowsByFamily.get(family) ?? []), row]);
  }
  const rows = freshnessRows.map((row: any) => {
    const family = String(row.sourceFamily);
    const operations = operationsByFamily.get(family) ?? [];
    const alertRows = alertRowsByFamily.get(family) ?? [];
    return {
      schemaVersion: "dwm.dashboard.source_operations_adapter_row.v1",
      proofId: stableId("dwm_dashboard_source_operations_adapter_row", `${input.query}:${family}:${row.state}:${row.parserStatus?.state}:${row.freshnessState}`),
      query: input.query,
      sourceFamily: family,
      state: row.state,
      freshnessState: row.freshnessState,
      parserStatus: row.parserStatus,
      confidence: row.confidence,
      confidenceTier: row.confidenceTier,
      timestamps: row.timestamps,
      provenance: row.provenance,
      gap: row.gap,
      alertability: row.alertability,
      operations: operations.map((operation) => ({
        operationId: operation.operationId,
        type: operation.type,
        priority: operation.priority,
        reasonCode: operation.reasonCode,
        route: operation.route,
        blockers: operation.blockers ?? [],
        liveNetworkFetch: false
      })),
      nextActions: [
        ...(row.nextActions ?? []),
        ...operations.map((operation) => ({
          action: operation.type,
          route: operation.route,
          reasonCode: operation.reasonCode,
          priority: operation.priority,
          liveNetworkFetch: false
        }))
      ],
      alertEnrichment: {
        readyRows: alertRows.filter((alert: any) => alert.state === "ready").length,
        blockedRows: alertRows.filter((alert: any) => alert.state !== "ready").length,
        watchlistTerms: uniqueSourceReadinessStrings(alertRows.map((alert: any) => alert.watchlistTerm)),
        enrichmentProofIds: uniqueSourceReadinessStrings(alertRows.flatMap((alert: any) => alert.provenance?.enrichmentProofIds ?? [])),
        webhookConsumable: alertRows.some((alert: any) => alert.webhookPayload?.canConsume === true)
      },
      blockers: dedupeBlockers([
        ...(row.blockers ?? []),
        ...operations.flatMap((operation) => operation.blockers ?? []),
        ...alertRows.flatMap((alert) => alert.blockers ?? [])
      ]),
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "dwm.dashboard.source_operations_adapter.v1",
    proofId: stableId("dwm_dashboard_source_operations_adapter", `${input.query}:${rows.map((row: any) => `${row.sourceFamily}:${row.state}:${row.parserStatus?.state}`).join(",")}`),
    query: input.query,
    rows,
    summary: {
      totalFamilies: rows.length,
      activeSourceFamilies: input.actorReadiness.alertability?.activeSourceFamilies ?? [],
      publicTiReady: input.actorReadiness.sourceConsumerBridge?.summary?.publicTiReady === true,
      alertReady: input.actorReadiness.alertCaseHandoffReadiness?.alertReady === true,
      caseReady: input.actorReadiness.alertCaseHandoffReadiness?.caseReady === true,
      freshFamilies: input.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger?.summary?.freshFamilies ?? [],
      gapFamilies: input.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger?.summary?.gapFamilies ?? [],
      retryFamilies: input.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger?.summary?.retryFamilies ?? [],
      alertableFamilies: input.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger?.summary?.alertableFamilies ?? [],
      nextActionTypes: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.nextActions.map((action: any) => action.action))),
      parserStates: uniqueSourceReadinessStrings(rows.map((row: any) => row.parserStatus?.state).filter(Boolean)),
      latestCaptureAt: input.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger?.summary?.latestCaptureAt,
      latestEnrichmentAt: input.publicTiQueryAdapter.sourceEnrichmentFreshnessLedger?.summary?.latestEnrichmentAt
    },
    policyBoundary: {
      liveNetworkFetch: false,
      publicTelegramOnly: true,
      metadataOnlyRestrictedSources: true,
      rawRestrictedPayloadStorage: false
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiQueryAdapter(query: string, actorReadiness: Record<string, any>) {
  const evidenceByFamily = new Map<string, Record<string, any>>((actorReadiness.evidenceReadiness?.rows ?? []).map((row: any) => [String(row.family), row]));
  const evidenceRows = (actorReadiness.evidenceReadiness?.rows ?? []).map((row: any) => ({
    family: row.family,
    proofId: row.proofId,
    state: row.state,
    confidence: row.confidence,
    confidenceTier: row.confidenceTier,
    timestamps: row.timestamps,
    evidenceFields: row.evidenceFields ?? [],
    sourceIds: row.sourceIds ?? [],
    candidateIds: row.candidateIds ?? [],
    gap: row.gap,
    safeOutput: row.safeOutput
  }));
  const sourceHealthRows = (actorReadiness.sourceFamilyHealth?.rows ?? []).map((row: any) => ({
    family: row.family,
    proofId: row.proofId,
    state: row.state,
    parserState: row.parserState,
    captureState: row.captureState,
    freshnessState: row.freshnessState,
    confidence: row.confidence,
    confidenceTier: row.confidenceTier,
    timestamps: row.timestamps,
    sourceIds: row.sourceIds ?? [],
    candidateIds: row.candidateIds ?? [],
    privacyBoundary: row.privacyBoundary,
    retryBackoff: row.retryBackoff,
    blockers: row.blockers ?? [],
    nextActions: row.nextActions ?? [],
    safeOutput: row.safeOutput
  }));
  const sectionRows = (actorReadiness.sourceSectionReadiness?.sections ?? []).map((section: any) => {
    const families = section.sourceFamilies ?? [];
    return {
      schemaVersion: "ti.public_actor.query_adapter_section.v1",
      proofId: stableId("ti_public_actor_query_adapter_section", `${query}:${section.section}:${section.state}:${families.join(",")}`),
      query,
      section: section.section,
      state: section.state,
      sourceFamilies: families,
      provenance: (section.provenance ?? []).map((row: any) => ({
        family: row.family,
        sourceIds: row.sourceIds ?? [],
        candidateIds: row.candidateIds ?? [],
        timestamps: row.timestamps,
        privacyBoundary: row.privacyBoundary,
        sourceTrust: row.sourceTrust,
        evidenceProofId: evidenceByFamily.get(String(row.family))?.proofId
      })),
      timestamps: section.timestamps,
      confidence: section.confidence,
      matchableFields: section.matchableFields ?? [],
      alertableFields: section.alertableFields ?? [],
      gaps: (section.missingFamilies ?? []).map((family: string) => ({
        family,
        intakeRecommendation: (actorReadiness.candidateGaps ?? []).find((gap: any) => gap.family === family)?.intakeRecommendation,
        state: "missing_source"
      })),
      blockers: section.blockers ?? [],
      nextActions: (section.nextActions ?? []).map((action: any) => ({
        type: action.type,
        priority: action.priority,
        reasonCode: action.reasonCode,
        route: action.route,
        liveNetworkFetch: false
      })),
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  const parserStatusLedger = sourceActorPublicTiParserStatusLedger({
    query,
    actorReadiness,
    sourceHealthRows
  });
  const sourcePackIntakeHandoff = sourceActorPublicTiSourcePackIntakeHandoff({
    query,
    actorReadiness
  });
  const alertEvidenceHandoff = sourceActorPublicTiAlertEvidenceHandoff({
    query,
    actorReadiness,
    sectionRows,
    evidenceRows,
    sourceHealthRows
  });
  const alertGenerationConsumerHandoff = sourceActorAlertGenerationConsumerHandoff({
    query,
    actorReadiness,
    alertEvidenceHandoff,
    sourceHealthRows
  });
  const consumerProofLedger = sourceActorPublicTiConsumerProofLedger({
    query,
    actorReadiness,
    evidenceRows,
    sourceHealthRows,
    parserStatusLedger,
    sourcePackIntakeHandoff,
    alertEvidenceHandoff,
    alertGenerationConsumerHandoff
  });
  const sourceOperationsHandoff = sourceActorPublicTiSourceOperationsHandoff({
    query,
    actorReadiness,
    consumerProofLedger
  });
  const downstreamFixtureExport = sourceActorPublicTiDownstreamFixtureExport({
    query,
    actorReadiness,
    consumerProofLedger,
    alertGenerationConsumerHandoff,
    sourceOperationsHandoff
  });
  const sourceFamilyCoverageMatrix = sourceActorPublicTiSourceFamilyCoverageMatrix({
    query,
    downstreamFixtureExport
  });
  const sourcePackActivationPreview = sourceActorPublicTiSourcePackActivationPreview({
    query,
    actorReadiness,
    sourceFamilyCoverageMatrix
  });
  const watchlistAlertabilityBridge = sourceActorPublicTiWatchlistAlertabilityBridge({
    query,
    alertGenerationConsumerHandoff,
    sourceFamilyCoverageMatrix
  });
  const sourceEnrichmentFreshnessLedger = sourceActorPublicTiSourceEnrichmentFreshnessLedger({
    query,
    consumerProofLedger,
    sourceFamilyCoverageMatrix,
    sourcePackActivationPreview,
    watchlistAlertabilityBridge
  });
  const alertEnrichmentHandoff = sourceActorPublicTiAlertEnrichmentHandoff({
    query,
    alertGenerationConsumerHandoff,
    sourceEnrichmentFreshnessLedger,
    watchlistAlertabilityBridge
  });
  return {
    schemaVersion: "ti.public_actor.query_adapter.v1",
    proofId: stableId("ti_public_actor_query_adapter", `${query}:${actorReadiness.proofId}:${sectionRows.map((row: any) => `${row.section}:${row.state}`).join(",")}`),
    query,
    route: {
      method: "GET",
      path: `/ti/${encodeURIComponent(query.toLowerCase())}`,
      liveNetworkFetch: false
    },
    actor: {
      actorId: actorReadiness.actorMetadata?.actorId,
      displayName: actorReadiness.actorMetadata?.displayName ?? query,
      aliases: actorReadiness.actorMetadata?.aliases ?? [],
      noSyntheticActorClaims: true
    },
    readiness: {
      state: actorReadiness.state,
      publicTiReady: actorReadiness.sourceConsumerBridge?.summary?.publicTiReady === true,
      alertReady: actorReadiness.sourceConsumerBridge?.summary?.alertReady === true,
      watchlistMatchReady: actorReadiness.sourceConsumerBridge?.summary?.watchlistMatchReady === true,
      freshnessState: actorReadiness.freshness?.captureFreshness?.state,
      lastSuccessfulCaptureAt: actorReadiness.freshness?.lastSuccessfulCaptureAt,
      lastSuccessfulEnrichmentAt: actorReadiness.freshness?.lastSuccessfulEnrichmentAt
    },
    sections: sectionRows,
    evidence: evidenceRows,
    sourceHealth: sourceHealthRows,
    parserStatusLedger,
    sourcePackIntakeHandoff,
    alertability: {
      matchableFields: actorReadiness.alertability?.matchableFields ?? [],
      activeSourceFamilies: actorReadiness.alertability?.activeSourceFamilies ?? [],
      watchlistMatchReadiness: actorReadiness.alertGenerationReadiness?.watchlistMatchReadiness,
      alertCaseHandoffReadiness: actorReadiness.alertCaseHandoffReadiness
    },
    alertEvidenceHandoff,
    alertGenerationConsumerHandoff,
    consumerProofLedger,
    sourceOperationsHandoff,
    downstreamFixtureExport,
    sourceFamilyCoverageMatrix,
    sourcePackActivationPreview,
    sourceEnrichmentFreshnessLedger,
    alertEnrichmentHandoff,
    watchlistAlertabilityBridge,
    gaps: actorReadiness.candidateGaps ?? [],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiSourcePackActivationPreview(input: {
  query: string;
  actorReadiness: Record<string, any>;
  sourceFamilyCoverageMatrix: Record<string, any>;
}) {
  const coverageByFamily = new Map<string, Record<string, any>>((input.sourceFamilyCoverageMatrix.rows ?? []).map((row: any) => [String(row.sourceFamily), row]));
  const sourcePackActionReadiness = input.actorReadiness.sourcePackActionReadiness ?? {};
  const actions = [
    ...(sourcePackActionReadiness.retryActions ?? []).map((action: any) => sourceActorPublicTiActivationPreviewAction({
      query: input.query,
      actionType: "retry",
      action,
      coverageByFamily
    })),
    ...(sourcePackActionReadiness.activationActions ?? []).map((action: any) => sourceActorPublicTiActivationPreviewAction({
      query: input.query,
      actionType: "activate",
      action,
      coverageByFamily
    })),
    ...(sourcePackActionReadiness.intakeActions ?? []).map((action: any) => sourceActorPublicTiActivationPreviewAction({
      query: input.query,
      actionType: "request_candidate",
      action,
      coverageByFamily
    }))
  ];
  const readyActions = actions.filter((action: any) => action.blockers.length === 0 || action.blockers.every((blocker: any) => blocker.retryable !== false));
  return {
    schemaVersion: "ti.public_actor.source_pack_activation_preview.v1",
    proofId: stableId("ti_public_actor_source_pack_activation_preview", `${input.query}:${actions.map((action: any) => `${action.action}:${action.family}:${action.parserStatus?.state}:${action.gap?.state}`).join(",")}`),
    query: input.query,
    mode: "prepare_no_network",
    ready: readyActions.length > 0,
    actions,
    summary: {
      total: actions.length,
      ready: readyActions.length,
      retryFamilies: uniqueSourceReadinessStrings(actions.filter((action: any) => action.action === "retry").map((action: any) => action.family)),
      activationFamilies: uniqueSourceReadinessStrings(actions.filter((action: any) => action.action === "activate").map((action: any) => action.family)),
      intakeFamilies: uniqueSourceReadinessStrings(actions.filter((action: any) => action.action === "request_candidate").map((action: any) => action.family)),
      actionTypes: uniqueSourceReadinessStrings(actions.map((action: any) => action.action)),
      parserStates: uniqueSourceReadinessStrings(actions.map((action: any) => action.parserStatus?.state).filter(Boolean)),
      latestCaptureAt: latestIso(actions.map((action: any) => action.timestamps?.lastCaptureAt)),
      latestEnrichmentAt: latestIso(actions.map((action: any) => action.timestamps?.lastEnrichmentAt))
    },
    policyBoundary: {
      publicTelegramOnly: true,
      metadataOnlyRestrictedSources: true,
      rawRestrictedPayloadStorage: false,
      noAutoJoin: true,
      noCredentials: true,
      noRepliesOrReactions: true,
      noMediaDownloads: true,
      liveNetworkFetch: false
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiActivationPreviewAction(input: {
  query: string;
  actionType: "retry" | "activate" | "request_candidate";
  action: Record<string, any>;
  coverageByFamily: Map<string, Record<string, any>>;
}) {
  const family = String(input.action.family ?? "unknown");
  const coverage = input.coverageByFamily.get(family);
  const route = {
    method: input.action.route?.method ?? "POST",
    path: input.action.route?.path ?? "/v1/dwm/source-requests",
    body: {
      ...(input.action.route?.body ?? {}),
      dryRun: true
    },
    dryRunSupported: input.action.dryRunSupported !== false && input.action.route?.dryRunSupported !== false,
    liveNetworkFetch: false
  };
  const blockers = dedupeBlockers([
    ...((coverage?.blockerCodes ?? []).map((code: string) => ({
      code,
      family,
      severity: String(code).includes("policy") ? "blocking" : "warning",
      retryable: !String(code).includes("policy")
    }))),
    ...(input.action.blockers ?? [])
  ]);
  return {
    schemaVersion: "ti.public_actor.source_pack_activation_preview_action.v1",
    proofId: stableId("ti_public_actor_source_pack_activation_preview_action", `${input.query}:${input.actionType}:${family}:${input.action.idempotencyKey ?? ""}`),
    query: input.query,
    action: input.action.action ?? input.actionType,
    family,
    sourceIds: input.action.sourceIds ?? coverage?.provenance?.sourceIds ?? [],
    candidateIds: input.action.candidateIds ?? coverage?.provenance?.candidateIds ?? [],
    idempotencyKey: input.action.idempotencyKey ?? stableId("ti_public_actor_source_pack_activation_idempotency", `${input.query}:${input.actionType}:${family}`),
    route,
    parserStatus: {
      state: coverage?.parserState ?? (input.actionType === "request_candidate" ? "missing_source" : "not_scheduled"),
      captureState: coverage?.captureState,
      retryBackoff: coverage?.retryBackoff
    },
    gap: {
      state: coverage?.gapState ?? (input.actionType === "request_candidate" ? "missing" : undefined),
      operationTypes: coverage?.operationTypes ?? []
    },
    confidence: coverage?.confidence ?? 0,
    timestamps: {
      lastCaptureAt: coverage?.lastCaptureAt,
      lastEnrichmentAt: coverage?.lastEnrichmentAt
    },
    provenance: {
      coverageProofId: coverage?.proofId,
      evidenceProofId: coverage?.provenance?.evidenceProofId,
      sourceHealthProofId: coverage?.provenance?.sourceHealthProofId,
      parserProofId: coverage?.provenance?.parserProofId,
      sourceIds: input.action.sourceIds ?? coverage?.provenance?.sourceIds ?? [],
      candidateIds: input.action.candidateIds ?? coverage?.provenance?.candidateIds ?? []
    },
    blockers,
    policyBoundary: {
      publicTelegramOnly: true,
      metadataOnlyRestrictedSources: true,
      liveNetworkFetch: false
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiSourceEnrichmentFreshnessLedger(input: {
  query: string;
  consumerProofLedger: Record<string, any>;
  sourceFamilyCoverageMatrix: Record<string, any>;
  sourcePackActivationPreview: Record<string, any>;
  watchlistAlertabilityBridge: Record<string, any>;
}) {
  const coverageByFamily = new Map<string, Record<string, any>>((input.sourceFamilyCoverageMatrix.rows ?? []).map((row: any) => [String(row.sourceFamily), row]));
  const actionsByFamily = new Map<string, Array<Record<string, any>>>();
  for (const action of input.sourcePackActivationPreview.actions ?? []) {
    const family = String(action.family);
    actionsByFamily.set(family, [...(actionsByFamily.get(family) ?? []), action]);
  }
  const watchlistRowsByFamily = new Map<string, Array<Record<string, any>>>();
  for (const row of input.watchlistAlertabilityBridge.rows ?? []) {
    const family = String(row.sourceFamily);
    watchlistRowsByFamily.set(family, [...(watchlistRowsByFamily.get(family) ?? []), row]);
  }
  const families = uniqueSourceReadinessStrings([
    ...(input.consumerProofLedger.rows ?? []).map((row: any) => String(row.family)),
    ...(input.sourceFamilyCoverageMatrix.rows ?? []).map((row: any) => String(row.sourceFamily)),
    ...(input.sourcePackActivationPreview.actions ?? []).map((row: any) => String(row.family)),
    ...(input.watchlistAlertabilityBridge.rows ?? []).map((row: any) => String(row.sourceFamily))
  ]);
  const rows = families.map((family) => {
    const consumer = (input.consumerProofLedger.rows ?? []).find((row: any) => String(row.family) === family);
    const coverage = coverageByFamily.get(family);
    const actions = actionsByFamily.get(family) ?? [];
    const watchlistRows = watchlistRowsByFamily.get(family) ?? [];
    const timestamps = {
      lastCaptureAt: consumer?.timestamps?.lastCaptureAt ?? coverage?.lastCaptureAt,
      lastEnrichmentAt: consumer?.timestamps?.lastEnrichmentAt ?? coverage?.lastEnrichmentAt,
      checkedAt: consumer?.timestamps?.checkedAt
    };
    const gap = consumer?.gap ?? (coverage?.gapState ? { state: coverage.gapState } : undefined);
    const freshnessState = coverage?.captureState === "capture_observed" || timestamps.lastCaptureAt
      ? "fresh"
      : coverage?.captureState === "capture_required"
        ? "needs_capture"
        : gap?.state ?? "unknown";
    return {
      schemaVersion: "ti.public_actor.source_enrichment_freshness_row.v1",
      proofId: stableId("ti_public_actor_source_enrichment_freshness_row", `${input.query}:${family}:${freshnessState}:${consumer?.parserStatus?.state ?? coverage?.parserState}`),
      query: input.query,
      sourceFamily: family,
      state: consumer?.state ?? coverage?.state ?? gap?.state ?? "missing",
      freshnessState,
      parserStatus: {
        state: consumer?.parserStatus?.state ?? coverage?.parserState,
        captureState: consumer?.parserStatus?.captureState ?? coverage?.captureState,
        retryBackoff: consumer?.parserStatus?.retryBackoff,
        blockers: consumer?.parserStatus?.blockers ?? []
      },
      confidence: consumer?.confidence ?? coverage?.confidence ?? 0,
      confidenceTier: consumer?.confidenceTier ?? coverage?.confidenceTier ?? "missing",
      timestamps,
      provenance: {
        evidenceProofId: consumer?.provenance?.evidenceProofId ?? coverage?.provenance?.evidenceProofId,
        sourceHealthProofId: consumer?.provenance?.sourceHealthProofId ?? coverage?.provenance?.sourceHealthProofId,
        parserProofId: consumer?.provenance?.parserProofId ?? coverage?.provenance?.parserProofId,
        coverageProofId: coverage?.proofId,
        sourceIds: uniqueSourceReadinessStrings([
          ...(consumer?.provenance?.sourceIds ?? []),
          ...(coverage?.provenance?.sourceIds ?? [])
        ]),
        candidateIds: uniqueSourceReadinessStrings([
          ...(consumer?.provenance?.candidateIds ?? []),
          ...(coverage?.provenance?.candidateIds ?? [])
        ]),
        privacyBoundary: consumer?.provenance?.privacyBoundary
      },
      gap,
      alertability: {
        publicTiReady: consumer?.consumers?.publicTi?.ready === true,
        alertGenerationReady: consumer?.consumers?.alertGeneration?.ready === true,
        watchlistAlertable: watchlistRows.some((row: any) => row.state === "alertable"),
        watchlistTerms: uniqueSourceReadinessStrings(watchlistRows.map((row: any) => row.watchlistTerm)),
        matchableFields: uniqueSourceReadinessStrings(watchlistRows.flatMap((row: any) => row.matchableFields ?? [])),
        alertableFields: uniqueSourceReadinessStrings(watchlistRows.flatMap((row: any) => row.alertableFields ?? []))
      },
      nextActions: actions.map((action) => ({
        action: action.action,
        route: action.route,
        idempotencyKey: action.idempotencyKey,
        blockers: action.blockers ?? [],
        liveNetworkFetch: false
      })),
      blockers: dedupeBlockers([
        ...(consumer?.blockers ?? []),
        ...(actions.flatMap((action) => action.blockers ?? [])),
        ...(watchlistRows.flatMap((row) => row.blockers ?? []))
      ]),
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "ti.public_actor.source_enrichment_freshness_ledger.v1",
    proofId: stableId("ti_public_actor_source_enrichment_freshness_ledger", `${input.query}:${rows.map((row: any) => `${row.sourceFamily}:${row.freshnessState}:${row.parserStatus?.state}`).join(",")}`),
    query: input.query,
    rows,
    summary: {
      freshFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.freshnessState === "fresh").map((row: any) => row.sourceFamily)),
      captureRequiredFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.parserStatus?.captureState === "capture_required").map((row: any) => row.sourceFamily)),
      retryFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.parserStatus?.retryBackoff?.retryable === true || row.nextActions.some((action: any) => action.action === "retry")).map((row: any) => row.sourceFamily)),
      gapFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.gap).map((row: any) => row.sourceFamily)),
      alertableFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.alertability.watchlistAlertable).map((row: any) => row.sourceFamily)),
      nextActionTypes: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.nextActions.map((action: any) => action.action))),
      latestCaptureAt: latestIso(rows.map((row: any) => row.timestamps?.lastCaptureAt)),
      latestEnrichmentAt: latestIso(rows.map((row: any) => row.timestamps?.lastEnrichmentAt))
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiAlertEnrichmentHandoff(input: {
  query: string;
  alertGenerationConsumerHandoff: Record<string, any>;
  sourceEnrichmentFreshnessLedger: Record<string, any>;
  watchlistAlertabilityBridge: Record<string, any>;
}) {
  const freshnessByFamily = new Map<string, Record<string, any>>((input.sourceEnrichmentFreshnessLedger.rows ?? []).map((row: any) => [String(row.sourceFamily), row]));
  const watchlistByFamily = new Map<string, Array<Record<string, any>>>();
  for (const row of input.watchlistAlertabilityBridge.rows ?? []) {
    const family = String(row.sourceFamily);
    watchlistByFamily.set(family, [...(watchlistByFamily.get(family) ?? []), row]);
  }
  const rows = (input.alertGenerationConsumerHandoff.rows ?? []).map((row: any) => {
    const family = String(row.family);
    const freshness = freshnessByFamily.get(family);
    const watchlistRows = watchlistByFamily.get(family) ?? [];
    const captureIds = uniqueSourceReadinessStrings([
      ...(row.provenance?.captureIds ?? []),
      ...(freshness?.provenance?.captureIds ?? [])
    ]);
    const sourceIds = uniqueSourceReadinessStrings([
      ...(row.sourceIds ?? []),
      ...(row.provenance?.sourceIds ?? []),
      ...(freshness?.provenance?.sourceIds ?? [])
    ]);
    const candidateIds = uniqueSourceReadinessStrings([
      ...(row.candidateIds ?? []),
      ...(row.provenance?.candidateIds ?? []),
      ...(freshness?.provenance?.candidateIds ?? [])
    ]);
    const enrichmentProofIds = uniqueSourceReadinessStrings([
      row.evidenceProofId,
      row.provenance?.alertEvidenceProofId,
      row.provenance?.sourceHealthProofId,
      freshness?.proofId,
      freshness?.provenance?.coverageProofId,
      freshness?.provenance?.parserProofId
    ].filter(Boolean).map(String));
    return {
      schemaVersion: "ti.public_actor.alert_enrichment_handoff_row.v1",
      proofId: stableId("ti_public_actor_alert_enrichment_handoff_row", `${input.query}:${row.watchlistTerm}:${family}:${row.state}:${enrichmentProofIds.join(",")}`),
      query: input.query,
      watchlistTerm: row.watchlistTerm,
      sourceFamily: family,
      state: row.state === "ready_for_rebuild" ? "ready" : "blocked",
      alertState: row.state,
      confidence: row.confidence ?? freshness?.confidence ?? 0,
      confidenceTier: row.confidenceTier ?? freshness?.confidenceTier,
      parserStatus: {
        state: row.parserStatus?.state ?? freshness?.parserStatus?.state,
        captureState: row.parserStatus?.captureState ?? freshness?.parserStatus?.captureState,
        retryBackoff: row.parserStatus?.retryBackoff ?? freshness?.parserStatus?.retryBackoff
      },
      freshness: {
        state: freshness?.freshnessState,
        lastCaptureAt: row.timestamps?.lastCaptureAt ?? freshness?.timestamps?.lastCaptureAt,
        lastEnrichmentAt: row.timestamps?.lastEnrichmentAt ?? freshness?.timestamps?.lastEnrichmentAt,
        checkedAt: row.timestamps?.checkedAt ?? freshness?.timestamps?.checkedAt
      },
      matchContext: {
        matchBasis: "watchlist_enrichment_evidence",
        matchableFields: uniqueSourceReadinessStrings([
          ...(row.matchableFields ?? []),
          ...(freshness?.alertability?.matchableFields ?? []),
          ...watchlistRows.flatMap((item) => item.matchableFields ?? [])
        ]),
        alertableFields: uniqueSourceReadinessStrings([
          ...(row.alertableFields ?? []),
          ...(freshness?.alertability?.alertableFields ?? []),
          ...watchlistRows.flatMap((item) => item.alertableFields ?? [])
        ])
      },
      provenance: {
        evidenceProofId: row.evidenceProofId ?? freshness?.provenance?.evidenceProofId,
        alertEvidenceProofId: row.provenance?.alertEvidenceProofId,
        sourceHealthProofId: row.provenance?.sourceHealthProofId ?? freshness?.provenance?.sourceHealthProofId,
        parserProofId: freshness?.provenance?.parserProofId,
        freshnessProofId: freshness?.proofId,
        coverageProofId: freshness?.provenance?.coverageProofId,
        enrichmentProofIds,
        captureIds,
        sourceIds,
        candidateIds,
        privacyBoundary: row.provenance?.privacyBoundary ?? freshness?.provenance?.privacyBoundary,
        sourceTrust: row.provenance?.sourceTrust
      },
      webhookPayload: {
        canConsume: row.state === "ready_for_rebuild",
        requiredFields: ["alertId", "dedupeKey", "watchlistTerm", "sourceFamily", "provenance.enrichmentProofIds", "provenance.sourceIds", "freshness.lastCaptureAt"],
        payloadKeys: ["watchlistTerm", "sourceFamily", "confidence", "parserStatus", "freshness", "matchContext", "provenance", "safeOutput"],
        deliveryContext: {
          liveNetworkFetch: false,
          metadataOnlyRestrictedSources: true,
          restrictedPayloadStored: false
        }
      },
      blockers: dedupeBlockers([
        ...(row.blockers ?? []),
        ...(freshness?.blockers ?? []),
        ...watchlistRows.flatMap((item) => item.blockers ?? [])
      ]),
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  const readyRows = rows.filter((row: any) => row.state === "ready");
  return {
    schemaVersion: "ti.public_actor.alert_enrichment_handoff.v1",
    proofId: stableId("ti_public_actor_alert_enrichment_handoff", `${input.query}:${rows.map((row: any) => `${row.watchlistTerm}:${row.sourceFamily}:${row.state}`).join(",")}`),
    query: input.query,
    ready: readyRows.length > 0 && input.alertGenerationConsumerHandoff.ready === true,
    route: input.alertGenerationConsumerHandoff.route,
    rows,
    summary: {
      readyRows: readyRows.length,
      blockedRows: rows.length - readyRows.length,
      sourceFamilies: uniqueSourceReadinessStrings(rows.map((row: any) => row.sourceFamily)),
      watchlistTerms: uniqueSourceReadinessStrings(rows.map((row: any) => row.watchlistTerm)),
      alertableFields: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.matchContext.alertableFields)),
      matchableFields: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.matchContext.matchableFields)),
      enrichmentProofIds: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.provenance.enrichmentProofIds)),
      latestCaptureAt: latestIso(rows.map((row: any) => row.freshness?.lastCaptureAt)),
      latestEnrichmentAt: latestIso(rows.map((row: any) => row.freshness?.lastEnrichmentAt))
    },
    blockers: dedupeBlockers([
      ...(input.alertGenerationConsumerHandoff.blockers ?? []),
      ...rows.flatMap((row: any) => row.blockers ?? [])
    ]),
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiWatchlistAlertabilityBridge(input: {
  query: string;
  alertGenerationConsumerHandoff: Record<string, any>;
  sourceFamilyCoverageMatrix: Record<string, any>;
}) {
  const coverageByFamily = new Map<string, Record<string, any>>((input.sourceFamilyCoverageMatrix.rows ?? []).map((row: any) => [String(row.sourceFamily), row]));
  const rows = (input.alertGenerationConsumerHandoff.rows ?? []).map((row: any) => {
    const coverage = coverageByFamily.get(String(row.family));
    return {
      schemaVersion: "ti.public_actor.watchlist_alertability_row.v1",
      proofId: stableId("ti_public_actor_watchlist_alertability_row", `${input.query}:${row.watchlistTerm}:${row.family}:${row.state}`),
      query: input.query,
      watchlistTerm: row.watchlistTerm,
      sourceFamily: row.family,
      state: row.state === "ready_for_rebuild" ? "alertable" : "blocked",
      parserState: row.parserStatus?.state ?? coverage?.parserState,
      captureState: row.parserStatus?.captureState ?? coverage?.captureState,
      confidence: row.confidence ?? coverage?.confidence ?? 0,
      confidenceTier: row.confidenceTier ?? coverage?.confidenceTier,
      matchableFields: row.matchableFields ?? [],
      alertableFields: row.alertableFields ?? [],
      timestamps: {
        lastCaptureAt: row.timestamps?.lastCaptureAt ?? coverage?.lastCaptureAt,
        lastEnrichmentAt: row.timestamps?.lastEnrichmentAt ?? coverage?.lastEnrichmentAt,
        checkedAt: row.timestamps?.checkedAt
      },
      provenance: {
        alertEvidenceProofId: row.provenance?.alertEvidenceProofId,
        evidenceProofId: row.evidenceProofId ?? coverage?.provenance?.evidenceProofId,
        sourceHealthProofId: row.provenance?.sourceHealthProofId ?? coverage?.provenance?.sourceHealthProofId,
        parserProofId: coverage?.provenance?.parserProofId,
        sourceIds: row.sourceIds ?? coverage?.provenance?.sourceIds ?? [],
        candidateIds: row.candidateIds ?? coverage?.provenance?.candidateIds ?? [],
        privacyBoundary: row.provenance?.privacyBoundary
      },
      route: input.alertGenerationConsumerHandoff.route,
      blockers: row.blockers ?? [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  const alertableRows = rows.filter((row: any) => row.state === "alertable");
  const blockedRows = rows.filter((row: any) => row.state !== "alertable");
  return {
    schemaVersion: "ti.public_actor.watchlist_alertability_bridge.v1",
    proofId: stableId("ti_public_actor_watchlist_alertability_bridge", `${input.query}:${rows.map((row: any) => `${row.watchlistTerm}:${row.sourceFamily}:${row.state}`).join(",")}`),
    query: input.query,
    ready: input.alertGenerationConsumerHandoff.ready === true && alertableRows.length > 0,
    route: input.alertGenerationConsumerHandoff.route,
    rows,
    summary: {
      watchlistTerms: uniqueSourceReadinessStrings(rows.map((row: any) => row.watchlistTerm)),
      alertableFamilies: uniqueSourceReadinessStrings(alertableRows.map((row: any) => row.sourceFamily)),
      blockedFamilies: uniqueSourceReadinessStrings(blockedRows.map((row: any) => row.sourceFamily)),
      gapFamilies: input.sourceFamilyCoverageMatrix.summary?.gapFamilies ?? [],
      retryFamilies: input.sourceFamilyCoverageMatrix.summary?.retryFamilies ?? [],
      readyRows: alertableRows.length,
      blockedRows: blockedRows.length,
      latestCaptureAt: latestIso(rows.map((row: any) => row.timestamps?.lastCaptureAt))
    },
    blockers: dedupeBlockers([
      ...(input.alertGenerationConsumerHandoff.blockers ?? []),
      ...blockedRows.flatMap((row: any) => row.blockers ?? [])
    ]),
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiSourceFamilyCoverageMatrix(input: {
  query: string;
  downstreamFixtureExport: Record<string, any>;
}) {
  const operationTypesByFamily = new Map<string, string[]>();
  for (const operation of input.downstreamFixtureExport.operations ?? []) {
    const family = String(operation.family ?? "unknown");
    operationTypesByFamily.set(family, uniqueSourceReadinessStrings([...(operationTypesByFamily.get(family) ?? []), operation.type]));
  }
  const rows = (input.downstreamFixtureExport.rows ?? []).map((row: any) => ({
    schemaVersion: "ti.public_actor.source_family_coverage_row.v1",
    proofId: stableId("ti_public_actor_source_family_coverage_row", `${input.query}:${row.sourceFamily}:${row.state}:${row.parserStatus?.state}:${row.consumers?.publicTi?.ready === true}:${row.consumers?.alertGeneration?.ready === true}`),
    query: input.query,
    sourceFamily: row.sourceFamily,
    state: row.state,
    parserState: row.parserStatus?.state,
    captureState: row.parserStatus?.captureState,
    confidence: row.confidence,
    confidenceTier: row.confidenceTier,
    lastCaptureAt: row.timestamps?.lastCaptureAt,
    lastEnrichmentAt: row.timestamps?.lastEnrichmentAt,
    publicTiReady: row.consumers?.publicTi?.ready === true,
    alertGenerationReady: row.consumers?.alertGeneration?.ready === true,
    operationTypes: operationTypesByFamily.get(String(row.sourceFamily)) ?? [],
    gapState: row.gap?.state,
    blockerCodes: uniqueSourceReadinessStrings((row.blockers ?? []).map((blocker: any) => blocker.code).filter(Boolean)),
    provenance: {
      evidenceProofId: row.provenance?.evidenceProofId,
      sourceHealthProofId: row.provenance?.sourceHealthProofId,
      parserProofId: row.provenance?.parserProofId,
      sourceIds: row.provenance?.sourceIds ?? [],
      candidateIds: row.provenance?.candidateIds ?? []
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  }));
  return {
    schemaVersion: "ti.public_actor.source_family_coverage_matrix.v1",
    proofId: stableId("ti_public_actor_source_family_coverage_matrix", `${input.query}:${rows.map((row: any) => `${row.sourceFamily}:${row.state}:${row.parserState}`).join(",")}`),
    query: input.query,
    rows,
    summary: {
      totalFamilies: rows.length,
      publicTiReadyFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.publicTiReady).map((row: any) => row.sourceFamily)),
      alertReadyFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.alertGenerationReady).map((row: any) => row.sourceFamily)),
      gapFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.gapState).map((row: any) => row.sourceFamily)),
      retryFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.operationTypes.some((type: string) => String(type).startsWith("retry"))).map((row: any) => row.sourceFamily)),
      operationTypes: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.operationTypes)),
      latestCaptureAt: latestIso(rows.map((row: any) => row.lastCaptureAt)),
      latestEnrichmentAt: latestIso(rows.map((row: any) => row.lastEnrichmentAt))
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiDownstreamFixtureExport(input: {
  query: string;
  actorReadiness: Record<string, any>;
  consumerProofLedger: Record<string, any>;
  alertGenerationConsumerHandoff: Record<string, any>;
  sourceOperationsHandoff: Record<string, any>;
}) {
  const rows = (input.consumerProofLedger.rows ?? []).map((row: any) => ({
    schemaVersion: "ti.public_actor.downstream_fixture_row.v1",
    proofId: stableId("ti_public_actor_downstream_fixture_row", `${input.query}:${row.family}:${row.state}:${row.parserStatus?.state}:${row.consumers?.alertGeneration?.ready === true}`),
    query: input.query,
    sourceFamily: row.family,
    state: row.state,
    parserStatus: row.parserStatus,
    confidence: row.confidence,
    confidenceTier: row.confidenceTier,
    timestamps: row.timestamps,
    provenance: {
      evidenceProofId: row.provenance?.evidenceProofId,
      sourceHealthProofId: row.provenance?.sourceHealthProofId,
      parserProofId: row.provenance?.parserProofId,
      intakeProofId: row.provenance?.intakeProofId,
      sourceIds: row.provenance?.sourceIds ?? [],
      candidateIds: row.provenance?.candidateIds ?? [],
      privacyBoundary: row.provenance?.privacyBoundary
    },
    consumers: {
      publicTi: row.consumers?.publicTi,
      alertGeneration: row.consumers?.alertGeneration
    },
    gap: row.gap,
    blockers: row.blockers ?? [],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  }));
  return {
    schemaVersion: "ti.public_actor.downstream_fixture_export.v1",
    proofId: stableId("ti_public_actor_downstream_fixture_export", `${input.query}:${rows.map((row: any) => `${row.sourceFamily}:${row.state}:${row.parserStatus?.state}`).join(",")}`),
    query: input.query,
    mode: "no_network_fixture",
    generatedFrom: {
      actorReadinessProofId: input.actorReadiness.proofId,
      consumerProofLedgerId: input.consumerProofLedger.proofId,
      alertGenerationHandoffId: input.alertGenerationConsumerHandoff.proofId,
      sourceOperationsHandoffId: input.sourceOperationsHandoff.proofId
    },
    publicTiContract: {
      path: `/ti/${encodeURIComponent(input.query.toLowerCase())}`,
      requiredFields: ["sourceFamily", "parserStatus", "confidence", "timestamps", "provenance", "gap", "safeOutput"]
    },
    alertGenerationContract: {
      path: "/v1/dwm/alerts/rebuild",
      requiredFields: ["sourceFamily", "consumers.alertGeneration", "provenance.evidenceProofId", "parserStatus", "blockers"]
    },
    rows,
    operations: (input.sourceOperationsHandoff.operations ?? []).map((operation: any) => ({
      operationId: operation.operationId,
      type: operation.type,
      family: operation.family,
      priority: operation.priority,
      route: operation.route,
      blockers: operation.blockers ?? [],
      safeOutput: operation.safeOutput
    })),
    summary: {
      rowCount: rows.length,
      publicTiReadyFamilies: input.consumerProofLedger.summary?.publicTiReadyFamilies ?? [],
      alertReadyFamilies: input.consumerProofLedger.summary?.alertReadyFamilies ?? [],
      gapFamilies: input.consumerProofLedger.summary?.gapFamilies ?? [],
      retryFamilies: input.consumerProofLedger.summary?.retryFamilies ?? [],
      operationTypes: input.sourceOperationsHandoff.summary?.actionTypes ?? [],
      latestCaptureAt: input.consumerProofLedger.summary?.latestCaptureAt,
      latestEnrichmentAt: input.consumerProofLedger.summary?.latestEnrichmentAt
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiSourceOperationsHandoff(input: {
  query: string;
  actorReadiness: Record<string, any>;
  consumerProofLedger: Record<string, any>;
}) {
  const proofByFamily = new Map<string, Record<string, any>>((input.consumerProofLedger.rows ?? []).map((row: any) => [String(row.family), row]));
  const operations = (input.actorReadiness.sourceOperationsQueue?.queueItems ?? []).map((item: any) => {
    const proof = proofByFamily.get(String(item.family));
    const relatedFamilies = item.family === "all_active"
      ? input.consumerProofLedger.summary?.alertReadyFamilies ?? []
      : [item.family].filter(Boolean);
    return {
      schemaVersion: "ti.public_actor.source_operation.v1",
      operationId: item.id,
      query: input.query,
      type: item.type,
      priority: item.priority,
      family: item.family,
      relatedFamilies,
      reasonCode: item.reasonCode,
      route: {
        method: item.route?.method ?? "POST",
        path: item.route?.path ?? "/v1/dwm/source-requests",
        body: item.route?.body ?? {},
        dryRunSupported: item.route?.dryRunSupported !== false,
        liveNetworkFetch: false
      },
      parserStatus: proof?.parserStatus,
      confidence: proof?.confidence ?? 0,
      timestamps: proof?.timestamps ?? {},
      provenance: {
        consumerProofId: proof?.proofId,
        sourceIds: proof?.provenance?.sourceIds ?? item.sourceIds ?? [],
        candidateIds: proof?.provenance?.candidateIds ?? item.candidateIds ?? [],
        sourceFamily: item.family,
        privacyBoundary: proof?.provenance?.privacyBoundary
      },
      blockers: item.blockers ?? [],
      gap: proof?.gap,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "ti.public_actor.source_operations_handoff.v1",
    proofId: stableId("ti_public_actor_source_operations_handoff", `${input.query}:${operations.map((item: any) => `${item.type}:${item.family}:${item.priority}:${item.reasonCode}`).join(",")}`),
    query: input.query,
    operations,
    summary: {
      total: operations.length,
      critical: operations.filter((item: any) => item.priority === "critical").length,
      high: operations.filter((item: any) => item.priority === "high").length,
      actionTypes: uniqueSourceReadinessStrings(operations.map((item: any) => item.type)),
      families: uniqueSourceReadinessStrings(operations.flatMap((item: any) => item.relatedFamilies.length ? item.relatedFamilies : [item.family])),
      alertRebuildReady: operations.some((item: any) => item.type === "rebuild_alerts"),
      retryReady: operations.some((item: any) => String(item.type).startsWith("retry")),
      captureRecordReady: operations.some((item: any) => item.type === "record_capture")
    },
    policyBoundary: {
      liveNetworkFetch: false,
      publicTelegramOnly: true,
      metadataOnlyRestrictedSources: true,
      restrictedPayloadStored: false
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiConsumerProofLedger(input: {
  query: string;
  actorReadiness: Record<string, any>;
  evidenceRows: Array<Record<string, any>>;
  sourceHealthRows: Array<Record<string, any>>;
  parserStatusLedger: Record<string, any>;
  sourcePackIntakeHandoff: Record<string, any>;
  alertEvidenceHandoff: Record<string, any>;
  alertGenerationConsumerHandoff: Record<string, any>;
}) {
  const evidenceByFamily = new Map<string, Record<string, any>>(input.evidenceRows.map((row) => [String(row.family), row]));
  const parserByFamily = new Map<string, Record<string, any>>((input.parserStatusLedger.rows ?? []).map((row: any) => [String(row.family), row]));
  const intakeByFamily = new Map<string, Record<string, any>>((input.sourcePackIntakeHandoff.candidates ?? []).map((row: any) => [String(row.family), row]));
  const alertRowsByFamily = new Map<string, Array<Record<string, any>>>();
  for (const row of input.alertGenerationConsumerHandoff.rows ?? []) {
    const family = String(row.family);
    alertRowsByFamily.set(family, [...(alertRowsByFamily.get(family) ?? []), row]);
  }
  const gapByFamily = new Map<string, Record<string, any>>((input.actorReadiness.candidateGaps ?? []).map((gap: any) => [String(gap.family), gap]));
  const families = uniqueSourceReadinessStrings([
    ...input.sourceHealthRows.map((row) => String(row.family)),
    ...input.evidenceRows.map((row) => String(row.family)),
    ...(input.sourcePackIntakeHandoff.candidates ?? []).map((row: any) => String(row.family)),
    ...(input.alertGenerationConsumerHandoff.rows ?? []).map((row: any) => String(row.family)),
    ...(input.actorReadiness.candidateGaps ?? []).map((gap: any) => String(gap.family))
  ]);
  const rows = families.map((family) => {
    const health = input.sourceHealthRows.find((row) => String(row.family) === family);
    const evidence = evidenceByFamily.get(family);
    const parser = parserByFamily.get(family);
    const intake = intakeByFamily.get(family);
    const alertRows = alertRowsByFamily.get(family) ?? [];
    const gap = gapByFamily.get(family);
    const alertReady = alertRows.some((row) => row.state === "ready_for_rebuild");
    const publicTiReady = evidence?.provenance != null || health?.alertability?.canEnrichActor === true;
    return {
      schemaVersion: "ti.public_actor.consumer_proof_ledger_row.v1",
      proofId: stableId("ti_public_actor_consumer_proof_ledger_row", `${input.query}:${family}:${health?.state ?? evidence?.state ?? gap?.state ?? "unknown"}:${parser?.parserState ?? "unknown"}`),
      query: input.query,
      family,
      state: health?.state ?? evidence?.state ?? gap?.state ?? "missing",
      confidence: evidence?.confidence ?? health?.confidence ?? intake?.alertability?.confidence ?? 0,
      confidenceTier: evidence?.confidenceTier ?? health?.confidenceTier ?? "missing",
      parserStatus: {
        state: parser?.parserState ?? health?.parserState,
        captureState: parser?.captureState ?? health?.captureState,
        statuses: parser?.parserStatuses ?? health?.parserStatuses ?? [],
        retryBackoff: parser?.retryBackoff ?? health?.retryBackoff,
        blockers: parser?.blockers ?? health?.blockers ?? []
      },
      timestamps: {
        lastCaptureAt: evidence?.timestamps?.lastCaptureAt ?? health?.timestamps?.lastCaptureAt ?? parser?.timestamps?.lastCaptureAt,
        lastEnrichmentAt: evidence?.timestamps?.lastEnrichmentAt ?? health?.timestamps?.lastEnrichmentAt ?? parser?.timestamps?.lastEnrichmentAt,
        checkedAt: evidence?.timestamps?.checkedAt ?? health?.timestamps?.checkedAt ?? parser?.timestamps?.checkedAt
      },
      provenance: {
        evidenceProofId: evidence?.proofId,
        sourceHealthProofId: health?.proofId,
        parserProofId: parser?.proofId,
        intakeProofId: intake?.proofId,
        sourceIds: uniqueSourceReadinessStrings([
          ...(evidence?.sourceIds ?? []),
          ...(health?.sourceIds ?? []),
          ...(parser?.sourceIds ?? [])
        ]),
        candidateIds: uniqueSourceReadinessStrings([
          ...(evidence?.candidateIds ?? []),
          ...(health?.candidateIds ?? []),
          ...(parser?.candidateIds ?? [])
        ]),
        privacyBoundary: evidence?.provenance?.privacyBoundary ?? health?.privacyBoundary ?? intake?.policyResult,
        sourceTrust: evidence?.provenance?.sourceTrust ?? health?.sourceTrust
      },
      consumers: {
        publicTi: {
          ready: publicTiReady,
          evidenceProofId: evidence?.proofId,
          sections: (input.actorReadiness.sourceSectionReadiness?.sections ?? [])
            .filter((section: any) => (section.sourceFamilies ?? []).includes(family) || (section.missingFamilies ?? []).includes(family))
            .map((section: any) => section.section)
        },
        alertGeneration: {
          ready: alertReady,
          rows: alertRows.map((row) => ({
            proofId: row.proofId,
            watchlistTerm: row.watchlistTerm,
            state: row.state,
            evidenceProofId: row.evidenceProofId
          })),
          route: input.alertGenerationConsumerHandoff.route
        }
      },
      gap: gap ? {
        state: gap.state,
        blockers: gap.blockers ?? [],
        intakeRecommendation: gap.intakeRecommendation
      } : undefined,
      blockers: dedupeBlockers([
        ...(health?.blockers ?? []),
        ...(parser?.blockers ?? []),
        ...(gap?.blockers ?? []),
        ...alertRows.flatMap((row) => row.blockers ?? [])
      ]),
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "ti.public_actor.consumer_proof_ledger.v1",
    proofId: stableId("ti_public_actor_consumer_proof_ledger", `${input.query}:${rows.map((row: any) => `${row.family}:${row.state}:${row.parserStatus?.state}:${row.consumers.alertGeneration.ready}`).join(",")}`),
    query: input.query,
    rows,
    summary: {
      publicTiReadyFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.consumers.publicTi.ready).map((row: any) => row.family)),
      alertReadyFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.consumers.alertGeneration.ready).map((row: any) => row.family)),
      gapFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.gap).map((row: any) => row.family)),
      retryFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.parserStatus?.retryBackoff?.retryable === true).map((row: any) => row.family)),
      latestCaptureAt: latestIso(rows.map((row: any) => row.timestamps?.lastCaptureAt)),
      latestEnrichmentAt: latestIso(rows.map((row: any) => row.timestamps?.lastEnrichmentAt))
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorAlertGenerationConsumerHandoff(input: {
  query: string;
  actorReadiness: Record<string, any>;
  alertEvidenceHandoff: Record<string, any>;
  sourceHealthRows: Array<Record<string, any>>;
}) {
  const healthByFamily = new Map<string, Record<string, any>>(input.sourceHealthRows.map((row) => [String(row.family), row]));
  const rows = (input.alertEvidenceHandoff.rows ?? []).map((row: any) => {
    const health = healthByFamily.get(String(row.family));
    const state = row.state === "ready" ? "ready_for_rebuild" : "blocked";
    return {
      schemaVersion: "ti.public_actor.alert_generation_consumer_row.v1",
      proofId: stableId("ti_public_actor_alert_generation_consumer_row", `${input.query}:${row.watchlistTerm}:${row.family}:${state}`),
      query: input.query,
      watchlistTerm: row.watchlistTerm,
      family: row.family,
      state,
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      evidenceProofId: row.evidenceProofId,
      parserStatus: {
        state: row.parserState ?? health?.parserState,
        captureState: row.captureState ?? health?.captureState,
        retryBackoff: health?.retryBackoff,
        blockers: health?.blockers ?? []
      },
      confidence: row.confidence ?? health?.confidence ?? 0,
      confidenceTier: row.confidenceTier ?? health?.confidenceTier,
      matchableFields: row.matchableFields ?? [],
      alertableFields: row.alertableFields ?? [],
      timestamps: {
        lastCaptureAt: row.timestamps?.lastCaptureAt ?? health?.timestamps?.lastCaptureAt,
        lastEnrichmentAt: row.timestamps?.lastEnrichmentAt ?? health?.timestamps?.lastEnrichmentAt,
        checkedAt: row.timestamps?.checkedAt ?? health?.timestamps?.checkedAt
      },
      provenance: {
        sourceFamily: row.family,
        sourceIds: row.sourceIds ?? [],
        candidateIds: row.candidateIds ?? [],
        privacyBoundary: row.privacyBoundary ?? health?.privacyBoundary,
        sourceTrust: health?.sourceTrust,
        sourceHealthProofId: health?.proofId,
        alertEvidenceProofId: row.proofId
      },
      blockers: row.blockers ?? [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  const readyRows = rows.filter((row: any) => row.state === "ready_for_rebuild");
  const blockedRows = rows.filter((row: any) => row.state !== "ready_for_rebuild");
  return {
    schemaVersion: "ti.public_actor.alert_generation_consumer_handoff.v1",
    proofId: stableId("ti_public_actor_alert_generation_consumer_handoff", `${input.query}:${rows.map((row: any) => `${row.watchlistTerm}:${row.family}:${row.state}`).join(",")}`),
    query: input.query,
    ready: input.actorReadiness.alertGenerationReadiness?.alertReady === true && readyRows.length > 0,
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: input.query,
        sourceFamilies: uniqueSourceReadinessStrings(readyRows.map((row: any) => row.family)),
        watchlistTerms: uniqueSourceReadinessStrings(readyRows.map((row: any) => row.watchlistTerm)),
        evidenceProofIds: readyRows.map((row: any) => row.evidenceProofId).filter(Boolean),
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    rows,
    summary: {
      readyRows: readyRows.length,
      blockedRows: blockedRows.length,
      sourceFamilies: uniqueSourceReadinessStrings(rows.map((row: any) => row.family)),
      watchlistTerms: uniqueSourceReadinessStrings(rows.map((row: any) => row.watchlistTerm)),
      parserStates: uniqueSourceReadinessStrings(rows.map((row: any) => row.parserStatus?.state).filter(Boolean)),
      matchableFields: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.matchableFields ?? [])),
      alertableFields: uniqueSourceReadinessStrings(rows.flatMap((row: any) => row.alertableFields ?? [])),
      latestCaptureAt: latestIso(rows.map((row: any) => row.timestamps?.lastCaptureAt))
    },
    blockers: dedupeBlockers([
      ...(input.alertEvidenceHandoff.blockers ?? []),
      ...blockedRows.flatMap((row: any) => row.blockers ?? [])
    ]),
    gaps: input.actorReadiness.candidateGaps ?? [],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiSourcePackIntakeHandoff(input: {
  query: string;
  actorReadiness: Record<string, any>;
}) {
  const intake = sourceActorCandidateIntakeContract(input.query, input.actorReadiness);
  const previews = intake.candidatePreviews ?? [];
  return {
    schemaVersion: "ti.public_actor.source_pack_intake_handoff.v1",
    proofId: stableId("ti_public_actor_source_pack_intake_handoff", `${input.query}:${previews.map((preview: any) => `${preview.family}:${preview.policyResult?.boundary}`).join(",")}`),
    query: input.query,
    ready: previews.length > 0,
    sourcePackWorkflow: intake.sourcePackWorkflow,
    route: intake.route,
    validationSummary: intake.validationSummary,
    policyValidation: intake.policyValidation,
    fixtureManifest: intake.fixtureManifest,
    candidates: previews.map((preview: any) => ({
      schemaVersion: "ti.public_actor.source_pack_intake_candidate.v1",
      proofId: preview.proofId,
      family: preview.family,
      candidate: preview.candidate,
      policyResult: preview.policyResult,
      parserExpectation: preview.parserExpectation,
      activationReadiness: preview.activationReadiness,
      alertability: preview.alertability,
      blockers: preview.blockers ?? [],
      provenance: {
        gapState: (input.actorReadiness.candidateGaps ?? []).find((gap: any) => gap.family === preview.family)?.state,
        sourceFamily: preview.family,
        query: input.query
      },
      safeOutput: preview.safeOutput
    })),
    gaps: input.actorReadiness.candidateGaps ?? [],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiParserStatusLedger(input: {
  query: string;
  actorReadiness: Record<string, any>;
  sourceHealthRows: Array<Record<string, any>>;
}) {
  const gapByFamily = new Map<string, Record<string, any>>((input.actorReadiness.candidateGaps ?? []).map((gap: any) => [String(gap.family), gap]));
  const rows = input.sourceHealthRows.map((row) => {
    const gap = gapByFamily.get(String(row.family));
    return {
      schemaVersion: "ti.public_actor.parser_status_ledger_row.v1",
      proofId: stableId("ti_public_actor_parser_status_ledger_row", `${input.query}:${row.family}:${row.state}:${row.parserState}:${row.captureState}`),
      query: input.query,
      family: row.family,
      state: row.state,
      parserState: row.parserState,
      captureState: row.captureState,
      freshnessState: row.freshnessState,
      confidence: row.confidence,
      confidenceTier: row.confidenceTier,
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      timestamps: row.timestamps,
      retryBackoff: row.retryBackoff,
      blockers: row.blockers ?? [],
      gap: gap ? {
        state: gap.state,
        intakeRecommendation: gap.intakeRecommendation
      } : undefined,
      nextActions: (row.nextActions ?? []).map((action: any) => ({
        type: action.type,
        priority: action.priority,
        reasonCode: action.reasonCode,
        route: action.route,
        liveNetworkFetch: false
      })),
      privacyBoundary: row.privacyBoundary,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "ti.public_actor.parser_status_ledger.v1",
    proofId: stableId("ti_public_actor_parser_status_ledger", `${input.query}:${rows.map((row: any) => `${row.family}:${row.parserState}:${row.captureState}`).join(",")}`),
    query: input.query,
    rows,
    summary: {
      readyFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.parserState === "ready").map((row: any) => row.family)),
      retryFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.parserState === "retry_required").map((row: any) => row.family)),
      missingFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.parserState === "missing_source").map((row: any) => row.family)),
      captureRequiredFamilies: uniqueSourceReadinessStrings(rows.filter((row: any) => row.captureState === "capture_required").map((row: any) => row.family)),
      latestCaptureAt: latestIso(rows.map((row: any) => row.timestamps?.lastCaptureAt)),
      latestEnrichmentAt: latestIso(rows.map((row: any) => row.timestamps?.lastEnrichmentAt)),
      nextActionTypes: uniqueSourceReadinessStrings(rows.flatMap((row: any) => (row.nextActions ?? []).map((action: any) => action.type)))
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorPublicTiAlertEvidenceHandoff(input: {
  query: string;
  actorReadiness: Record<string, any>;
  sectionRows: Array<Record<string, any>>;
  evidenceRows: Array<Record<string, any>>;
  sourceHealthRows: Array<Record<string, any>>;
}) {
  const watchlistRows = input.actorReadiness.alertGenerationReadiness?.watchlistMatchReadiness?.rows ?? [];
  const evidenceByFamily = new Map<string, Record<string, any>>(input.evidenceRows.map((row) => [String(row.family), row]));
  const healthByFamily = new Map<string, Record<string, any>>(input.sourceHealthRows.map((row) => [String(row.family), row]));
  const alertRows = watchlistRows.map((row: any) => {
    const evidence = evidenceByFamily.get(String(row.family));
    const health = healthByFamily.get(String(row.family));
    return {
      schemaVersion: "ti.public_actor.alert_evidence_row.v1",
      proofId: stableId("ti_public_actor_alert_evidence_row", `${input.query}:${row.watchlistTerm}:${row.family}:${row.state}`),
      query: input.query,
      watchlistTerm: row.watchlistTerm,
      family: row.family,
      state: row.state,
      sourceIds: row.sourceIds ?? evidence?.sourceIds ?? [],
      candidateIds: row.candidateIds ?? evidence?.candidateIds ?? [],
      evidenceProofId: evidence?.proofId,
      parserState: health?.parserState,
      captureState: health?.captureState,
      confidence: row.confidence ?? evidence?.confidence ?? health?.confidence ?? 0,
      confidenceTier: evidence?.confidenceTier ?? health?.confidenceTier,
      matchableFields: row.matchableFields ?? [],
      alertableFields: row.alertableFields ?? [],
      timestamps: {
        lastCaptureAt: row.latestCaptureAt ?? health?.timestamps?.lastCaptureAt ?? evidence?.timestamps?.lastCaptureAt,
        lastEnrichmentAt: health?.timestamps?.lastEnrichmentAt ?? evidence?.timestamps?.lastEnrichmentAt,
        checkedAt: evidence?.timestamps?.checkedAt
      },
      privacyBoundary: row.privacyBoundary ?? health?.privacyBoundary,
      blockers: row.blockers ?? [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  const readyRows = alertRows.filter((row: any) => row.state === "ready");
  const blockingRows = alertRows.filter((row: any) => row.state !== "ready");
  return {
    schemaVersion: "ti.public_actor.alert_evidence_handoff.v1",
    proofId: stableId("ti_public_actor_alert_evidence_handoff", `${input.query}:${alertRows.map((row: any) => `${row.watchlistTerm}:${row.family}:${row.state}`).join(",")}`),
    query: input.query,
    ready: input.actorReadiness.alertGenerationReadiness?.alertReady === true && readyRows.length > 0,
    alertRebuildPlan: input.actorReadiness.alertGenerationReadiness?.rebuildPlan,
    caseHandoffReadiness: input.actorReadiness.alertCaseHandoffReadiness,
    watchlistTerms: input.actorReadiness.alertGenerationReadiness?.watchlistMatchReadiness?.watchlistTerms ?? [],
    rows: alertRows,
    sourceSections: input.sectionRows
      .filter((row) => row.state === "covered" || (row.nextActions ?? []).length > 0)
      .map((row) => ({
        section: row.section,
        state: row.state,
        proofId: row.proofId,
        sourceFamilies: row.sourceFamilies ?? [],
        confidence: row.confidence,
        nextActions: row.nextActions ?? []
      })),
    blockers: dedupeBlockers([
      ...(input.actorReadiness.alertGenerationReadiness?.blockers ?? []),
      ...blockingRows.flatMap((row: any) => row.blockers ?? [])
    ]),
    summary: {
      readyRows: readyRows.length,
      blockedRows: blockingRows.length,
      sourceFamilies: uniqueSourceReadinessStrings(alertRows.map((row: any) => row.family)),
      matchableFields: uniqueSourceReadinessStrings(alertRows.flatMap((row: any) => row.matchableFields ?? [])),
      latestCaptureAt: latestIso(alertRows.map((row: any) => row.timestamps?.lastCaptureAt))
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorDownstreamReadinessRows(input: {
  query: string;
  sourceCoverage: Array<Record<string, any>>;
  candidateGaps: Array<Record<string, any>>;
  retryBlockers: Array<Record<string, any>>;
  sourcePackActionReadiness: Record<string, any>;
  freshness: Record<string, any>;
}) {
  const candidateGapByFamily = new Map(input.candidateGaps.map((gap) => [String(gap.family), gap]));
  const retryBlockerByFamily = new Map(input.retryBlockers.map((row) => [String(row.family), row]));
  const retryActionFamilies = new Set((input.sourcePackActionReadiness.retryActions ?? []).map((action: any) => String(action.family)));
  const activationActionFamilies = new Set((input.sourcePackActionReadiness.activationActions ?? []).map((action: any) => String(action.family)));
  const intakeActionFamilies = new Set((input.sourcePackActionReadiness.intakeActions ?? []).map((action: any) => String(action.family)));
  return input.sourceCoverage.map((row) => {
    const family = String(row.family);
    const candidateGap = candidateGapByFamily.get(family);
    const retryBlocker = retryBlockerByFamily.get(family);
    const nextActions = [
      ...(retryActionFamilies.has(family) ? ["retry"] : []),
      ...(activationActionFamilies.has(family) ? ["activate"] : []),
      ...(intakeActionFamilies.has(family) ? ["request_candidate"] : [])
    ];
    return {
      schemaVersion: "dwm.actor_source_readiness_ledger_row.v1",
      proofId: stableId("dwm_actor_source_readiness_ledger", `${input.query}:${family}:${row.state}:${row.lastCaptureAt ?? "no_capture"}:${row.lastEnrichmentAt ?? "no_enrichment"}`),
      query: input.query,
      family,
      state: row.state,
      candidateIds: row.candidateIds ?? [],
      sourceIds: row.sourceIds ?? [],
      parserStatuses: row.parserStatuses ?? [],
      lastCaptureAt: row.lastCaptureAt,
      lastEnrichmentAt: row.lastEnrichmentAt,
      freshnessState: row.lastCaptureAt ? sourceActorCaptureFreshness(row.lastCaptureAt, input.freshness.checkedAt).state : "needs_capture",
      retryBackoff: row.retryBackoff,
      candidateGap: candidateGap ? {
        state: candidateGap.state,
        intakeRecommendation: candidateGap.intakeRecommendation
      } : undefined,
      blockers: uniqueSourceReadinessBlockers([
        ...(row.blockers ?? []),
        ...(candidateGap?.blockers ?? []),
        ...((retryBlocker?.blockerCodes ?? []).map((code: string) => ({ code, severity: "warning", retryable: true })))
      ]),
      actionability: {
        retryAvailable: retryActionFamilies.has(family),
        activationAvailable: activationActionFamilies.has(family),
        intakeAvailable: intakeActionFamilies.has(family),
        nextActions,
        liveNetworkFetchRequired: false
      },
      downstreamConsumers: {
        publicTiActorPage: row.canEnrichActor === true || Boolean(candidateGap),
        dashboardSourceReadiness: true,
        sharedWatchlistAlerts: row.canProduceAlert === true,
        caseHandoff: row.canProduceAlert === true && Boolean(row.lastCaptureAt)
      },
      alertability: {
        canProduceAlert: row.canProduceAlert === true,
        alertableFields: row.alertableFields ?? [],
        matchableFields: row.matchableFields ?? []
      },
      privacyBoundary: row.privacyBoundary,
      sourceTrust: row.sourceTrust,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
}

function sourceActorParserHealthReadiness(input: {
  query: string;
  sourceReadinessLedgerRows: Array<Record<string, any>>;
  sourceCoverage: Array<Record<string, any>>;
  sourcePackActionReadiness: Record<string, any>;
  freshness: Record<string, any>;
}) {
  const ledgerByFamily = new Map(input.sourceReadinessLedgerRows.map((row) => [String(row.family), row]));
  const retryActionByFamily = new Map((input.sourcePackActionReadiness.retryActions ?? []).map((action: any) => [String(action.family), action]));
  const activationActionByFamily = new Map((input.sourcePackActionReadiness.activationActions ?? []).map((action: any) => [String(action.family), action]));
  const rows = input.sourceCoverage.map((coverage) => {
    const family = String(coverage.family);
    const ledger = ledgerByFamily.get(family);
    const statuses = uniqueSourceReadinessStrings([
      ...(coverage.parserStatuses ?? []),
      ...(ledger?.parserStatuses ?? [])
    ]);
    const retryBackoff = ledger?.retryBackoff ?? coverage.retryBackoff;
    const parserState = statuses.some((status) => /failed|retry|blocked/i.test(String(status))) || retryBackoff?.retryable === true
      ? "retry_required"
      : statuses.length > 0
        ? "ready"
        : Number(coverage.candidateCount ?? 0) > 0
          ? "not_scheduled"
          : "missing_source";
    return {
      schemaVersion: "dwm.actor_parser_health_readiness_row.v1",
      proofId: stableId("dwm_actor_parser_health_readiness_row", `${input.query}:${family}:${parserState}:${statuses.join(",")}`),
      query: input.query,
      family,
      parserState,
      parserStatuses: statuses,
      sourceIds: ledger?.sourceIds ?? coverage.sourceIds ?? [],
      candidateIds: ledger?.candidateIds ?? coverage.candidateIds ?? [],
      lastCaptureAt: ledger?.lastCaptureAt ?? coverage.lastCaptureAt,
      lastEnrichmentAt: ledger?.lastEnrichmentAt ?? coverage.lastEnrichmentAt,
      checkedAt: input.freshness.checkedAt,
      retryBackoff,
      actionability: {
        retryAvailable: retryActionByFamily.has(family),
        activationAvailable: activationActionByFamily.has(family),
        nextActions: [
          ...(retryActionByFamily.has(family) ? ["retry"] : []),
          ...(activationActionByFamily.has(family) ? ["activate"] : [])
        ],
        retryAction: retryActionByFamily.get(family),
        activationAction: activationActionByFamily.get(family),
        liveNetworkFetchRequired: false
      },
      blockers: [
        ...(parserState === "missing_source" ? [{ code: "missing_source_family", severity: "warning", family, retryable: true }] : []),
        ...(parserState === "not_scheduled" ? [{ code: "parser_not_scheduled", severity: "warning", family, retryable: true }] : []),
        ...(parserState === "retry_required" ? [{ code: "parser_retry_required", severity: "warning", family, retryable: true }] : [])
      ],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "dwm.actor_parser_health_readiness.v1",
    proofId: stableId("dwm_actor_parser_health_readiness", `${input.query}:${rows.map((row) => `${row.family}:${row.parserState}`).join(",")}`),
    query: input.query,
    parserReady: rows.some((row) => row.parserState === "ready") && rows.every((row) => row.parserState !== "retry_required"),
    rows,
    summary: {
      readyFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.parserState === "ready").map((row) => row.family)),
      retryFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.parserState === "retry_required").map((row) => row.family)),
      missingFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.parserState === "missing_source").map((row) => row.family)),
      notScheduledFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.parserState === "not_scheduled").map((row) => row.family))
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorEvidenceReadiness(input: {
  query: string;
  provenance: Array<Record<string, any>>;
  sourceReadinessLedgerRows: Array<Record<string, any>>;
  candidateGaps: Array<Record<string, any>>;
  freshness: Record<string, any>;
}) {
  const provenanceByFamily = new Map(input.provenance.map((row) => [String(row.family), row]));
  const evidenceRows = input.sourceReadinessLedgerRows
    .filter((row) => row.downstreamConsumers?.publicTiActorPage === true || row.downstreamConsumers?.sharedWatchlistAlerts === true || row.candidateGap)
    .map((row) => {
      const provenance = provenanceByFamily.get(String(row.family));
      const confidence = Number(row.sourceTrust?.score ?? provenance?.sourceTrust?.score ?? 0);
      return {
        schemaVersion: "dwm.actor_evidence_readiness_row.v1",
        proofId: stableId("dwm_actor_evidence_readiness_row", `${input.query}:${row.family}:${row.state}:${row.lastCaptureAt ?? "no_capture"}:${row.lastEnrichmentAt ?? "no_enrichment"}`),
        query: input.query,
        family: row.family,
        state: row.state,
        sourceIds: row.sourceIds ?? [],
        candidateIds: row.candidateIds ?? [],
        confidence,
        confidenceTier: confidence >= 0.85 ? "high" : confidence >= 0.6 ? "medium" : confidence > 0 ? "low" : "missing",
        timestamps: {
          lastCaptureAt: row.lastCaptureAt,
          lastEnrichmentAt: row.lastEnrichmentAt,
          checkedAt: input.freshness.checkedAt
        },
        evidenceFields: uniqueSourceReadinessStrings([
          ...(row.alertability?.alertableFields ?? []),
          ...(row.alertability?.matchableFields ?? []),
          ...(provenance?.alertableFields ?? []),
          ...(provenance?.matchableFields ?? [])
        ]),
        provenance: provenance ? {
          family: provenance.family,
          state: provenance.state,
          lastCaptureAt: provenance.lastCaptureAt,
          lastEnrichmentAt: provenance.lastEnrichmentAt,
          privacyBoundary: provenance.privacyBoundary,
          sourceTrust: provenance.sourceTrust,
          safeOutput: provenance.safeOutput
        } : undefined,
        gap: row.candidateGap ? {
          state: row.candidateGap.state,
          intakeRecommendation: row.candidateGap.intakeRecommendation
        } : undefined,
        blockers: row.blockers ?? [],
        safeOutput: {
          rawTargetsExposed: false,
          restrictedMetadataLeaked: false,
          privateTelegramContentExposed: false,
          liveNetworkScrapeStarted: false
        }
      };
    });
  const evidenceReadyRows = evidenceRows.filter((row) => row.provenance && row.confidence > 0);
  return {
    schemaVersion: "dwm.actor_evidence_readiness.v1",
    proofId: stableId("dwm_actor_evidence_readiness", `${input.query}:${evidenceRows.map((row) => `${row.family}:${row.state}:${row.confidenceTier}`).join(",")}`),
    query: input.query,
    evidenceReady: evidenceReadyRows.length > 0,
    rows: evidenceRows,
    summary: {
      readyFamilies: uniqueSourceReadinessStrings(evidenceReadyRows.map((row) => row.family)),
      gapFamilies: uniqueSourceReadinessStrings(input.candidateGaps.map((gap) => gap.family)),
      averageConfidence: evidenceReadyRows.length > 0
        ? Math.round((evidenceReadyRows.reduce((sum, row) => sum + row.confidence, 0) / evidenceReadyRows.length) * 100) / 100
        : 0,
      lastEvidenceAt: latestIso(evidenceReadyRows.flatMap((row) => [row.timestamps.lastCaptureAt, row.timestamps.lastEnrichmentAt]))
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorCaptureReadiness(input: {
  query: string;
  sourceReadinessLedgerRows: Array<Record<string, any>>;
  freshness: Record<string, any>;
  candidateGaps: Array<Record<string, any>>;
  retryBlockers: Array<Record<string, any>>;
}) {
  const captureCapableRows = input.sourceReadinessLedgerRows.filter((row) => row.downstreamConsumers?.sharedWatchlistAlerts === true || row.alertability?.canProduceAlert === true || row.retryBackoff?.retryable === true);
  const retryFamilies = new Set(input.retryBlockers.map((row) => String(row.family)));
  const rows = captureCapableRows.map((row) => {
    const hasCapture = Boolean(row.lastCaptureAt);
    return {
      schemaVersion: "dwm.actor_capture_readiness_row.v1",
      proofId: stableId("dwm_actor_capture_readiness_row", `${input.query}:${row.family}:${row.lastCaptureAt ?? "no_capture"}:${row.state}`),
      query: input.query,
      family: row.family,
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      state: hasCapture ? "capture_observed" : retryFamilies.has(String(row.family)) ? "retry_required" : "capture_required",
      parserStatuses: row.parserStatuses ?? [],
      lastCaptureAt: row.lastCaptureAt,
      freshnessState: row.freshnessState,
      expectedCapture: {
        type: expectedCaptureTypeForFamily(row.family as SourceGrowthFamily),
        liveNetworkRequiredForProof: false,
        restrictedPayloadStored: false
      },
      recordCapturePlan: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          action: "record_capture",
          sourceId: (row.sourceIds ?? [])[0],
          candidateId: (row.candidateIds ?? [])[0],
          captureText: `${input.query} ${row.family} metadata capture fixture`,
          captureUrl: `fixture://dwm/${input.query.toLowerCase()}/${row.family}/capture`
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      },
      blockers: [
        ...(hasCapture ? [] : [{ code: "capture_required", severity: "blocking", retryable: true }]),
        ...(retryFamilies.has(String(row.family)) ? [{ code: "retry_required", severity: "warning", family: row.family, retryable: true }] : [])
      ],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  const missingFamilies = uniqueSourceReadinessStrings(input.candidateGaps.map((gap) => gap.family));
  const blockers = dedupeBlockers([
    ...rows.flatMap((row) => row.blockers),
    ...input.candidateGaps.map((gap) => ({ code: "candidate_required_before_capture", severity: "warning", family: gap.family, retryable: true }))
  ]);
  return {
    schemaVersion: "dwm.actor_capture_readiness.v1",
    proofId: stableId("dwm_actor_capture_readiness", `${input.query}:${input.freshness.lastSuccessfulCaptureAt ?? "no_capture"}:${rows.map((row) => `${row.family}:${row.state}`).join(",")}`),
    query: input.query,
    captureReady: Boolean(input.freshness.lastSuccessfulCaptureAt),
    latestCaptureAt: input.freshness.lastSuccessfulCaptureAt,
    captureRows: rows,
    missingFamilies,
    blockers,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorAlertGenerationReadiness(input: {
  query: string;
  alertability: Record<string, any>;
  sourceReadinessLedgerRows: Array<Record<string, any>>;
  latestCaptureAt?: string;
  candidateGaps: Array<Record<string, any>>;
  retryBlockers: Array<Record<string, any>>;
  missingSections: Array<Record<string, any>>;
}) {
  const alertCapableRows = input.sourceReadinessLedgerRows.filter((row) => row.alertability?.canProduceAlert === true);
  const blockers = dedupeBlockers([
    ...(!input.latestCaptureAt ? [{ code: "capture_required", severity: "blocking", retryable: true }] : []),
    ...(alertCapableRows.length === 0 ? [{ code: "no_alert_capable_source", severity: "blocking", retryable: true }] : []),
    ...(input.alertability.matchableFields.length === 0 ? [{ code: "no_matchable_fields", severity: "blocking", retryable: true }] : []),
    ...input.candidateGaps.filter((gap) => gap.state === "policy_blocked").map((gap) => ({ code: "policy_blocked_source", severity: "blocking", family: gap.family, retryable: false })),
    ...input.retryBlockers.map((row) => ({ code: "retry_required", severity: "warning", family: row.family, retryable: true })),
    ...input.missingSections.map((row) => ({ code: "missing_actor_section_source", severity: "warning", section: row.section, retryable: true }))
  ]);
  const blocking = blockers.some((blocker) => blocker.severity === "blocking");
  return {
    schemaVersion: "dwm.actor_alert_generation_readiness.v1",
    proofId: stableId("dwm_actor_alert_generation_readiness", `${input.query}:${input.latestCaptureAt ?? "no_capture"}:${alertCapableRows.map((row) => row.family).join(",")}:${input.alertability.matchableFields.join(",")}`),
    query: input.query,
    alertReady: !blocking,
    canRebuildAlerts: !blocking,
    sourceFamilies: {
      active: input.alertability.activeSourceFamilies,
      alertCapable: uniqueSourceReadinessStrings(alertCapableRows.map((row) => row.family)),
      blocked: uniqueSourceReadinessStrings(input.sourceReadinessLedgerRows.filter((row) => row.state === "policy_blocked" || row.state === "failed").map((row) => row.family)),
      missing: uniqueSourceReadinessStrings(input.candidateGaps.map((gap) => gap.family))
    },
    matchableFields: input.alertability.matchableFields,
    sourceTrust: input.alertability.sourceTrust,
    latestCaptureAt: input.latestCaptureAt,
    sourceRows: alertCapableRows.map((row) => ({
      family: row.family,
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      freshnessState: row.freshnessState,
      alertableFields: row.alertability?.alertableFields ?? [],
      matchableFields: row.alertability?.matchableFields ?? [],
      privacyBoundary: row.privacyBoundary,
      safeOutput: row.safeOutput
    })),
    watchlistMatchReadiness: sourceActorWatchlistMatchReadiness({
      query: input.query,
      watchlistTerms: input.alertability.watchlistTerms ?? [],
      alertCapableRows,
      matchableFields: input.alertability.matchableFields,
      sourceTrust: input.alertability.sourceTrust,
      latestCaptureAt: input.latestCaptureAt,
      blockers
    }),
    rebuildPlan: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: input.query,
        sourceFamilies: uniqueSourceReadinessStrings(alertCapableRows.map((row) => row.family)),
        matchableFields: input.alertability.matchableFields,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    blockers,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorWatchlistMatchReadiness(input: {
  query: string;
  watchlistTerms: string[];
  alertCapableRows: Array<Record<string, any>>;
  matchableFields: string[];
  sourceTrust: Record<string, any>;
  latestCaptureAt?: string;
  blockers: Array<Record<string, any>>;
}) {
  const watchlistTerms = input.watchlistTerms.length > 0 ? input.watchlistTerms : [input.query];
  const blocking = input.blockers.some((blocker) => blocker.severity === "blocking");
  const rows = watchlistTerms.flatMap((term) => input.alertCapableRows.map((row) => {
    const fields = uniqueSourceReadinessStrings([
      ...(row.alertability?.matchableFields ?? []),
      ...(row.alertability?.alertableFields ?? [])
    ]);
    const missingFields = fields.length === 0;
    const state = blocking
      ? !input.latestCaptureAt
        ? "capture_required"
        : missingFields
          ? "no_matchable_fields"
          : "blocked"
      : "ready";
    return {
      schemaVersion: "dwm.actor_watchlist_match_readiness_row.v1",
      proofId: stableId("dwm_actor_watchlist_match_readiness_row", `${input.query}:${term}:${row.family}:${state}:${fields.join(",")}`),
      query: input.query,
      watchlistTerm: term,
      family: row.family,
      state,
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      matchableFields: fields,
      alertableFields: row.alertability?.alertableFields ?? [],
      freshnessState: row.freshnessState,
      latestCaptureAt: input.latestCaptureAt,
      confidence: Number(input.sourceTrust?.byFamily?.[row.family]?.score ?? 0),
      sourceTrust: input.sourceTrust?.byFamily?.[row.family],
      blockers: dedupeBlockers([
        ...(!input.latestCaptureAt ? [{ code: "capture_required", severity: "blocking", retryable: true }] : []),
        ...(missingFields ? [{ code: "no_matchable_fields", severity: "blocking", family: row.family, retryable: true }] : []),
        ...input.blockers.filter((blocker) => blocker.family === row.family || !blocker.family)
      ]),
      privacyBoundary: row.privacyBoundary,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  }));
  return {
    schemaVersion: "dwm.actor_watchlist_match_readiness.v1",
    proofId: stableId("dwm_actor_watchlist_match_readiness", `${input.query}:${watchlistTerms.join(",")}:${rows.map((row) => `${row.family}:${row.state}`).join(",")}`),
    query: input.query,
    watchlistTerms,
    rows,
    summary: {
      ready: rows.length > 0 && rows.every((row) => row.state === "ready"),
      readyTerms: uniqueSourceReadinessStrings(rows.filter((row) => row.state === "ready").map((row) => row.watchlistTerm)),
      blockedTerms: uniqueSourceReadinessStrings(rows.filter((row) => row.state !== "ready").map((row) => row.watchlistTerm)),
      sourceFamilies: uniqueSourceReadinessStrings(rows.map((row) => row.family)),
      matchableFields: uniqueSourceReadinessStrings([
        ...input.matchableFields,
        ...rows.flatMap((row) => row.matchableFields)
      ]),
      latestCaptureAt: input.latestCaptureAt
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorOperationsQueue(input: {
  query: string;
  parserHealthReadiness: Record<string, any>;
  captureReadiness: Record<string, any>;
  alertGenerationReadiness: Record<string, any>;
  sourcePackActionReadiness: Record<string, any>;
}) {
  const queueItems = [
    ...(input.parserHealthReadiness.rows ?? [])
      .filter((row: any) => row.parserState === "retry_required" && row.actionability?.retryAction?.route)
      .map((row: any) => sourceActorOperationsQueueItem({
        query: input.query,
        type: "retry_parser",
        priority: "critical",
        family: row.family,
        sourceIds: row.sourceIds ?? [],
        candidateIds: row.candidateIds ?? [],
        route: row.actionability.retryAction.route,
        blockers: row.blockers ?? [],
        reasonCode: "parser_retry_required"
      })),
    ...(input.captureReadiness.captureRows ?? [])
      .filter((row: any) => row.state !== "capture_observed" && row.recordCapturePlan?.path)
      .map((row: any) => sourceActorOperationsQueueItem({
        query: input.query,
        type: row.state === "retry_required" ? "retry_capture" : "record_capture",
        priority: row.state === "retry_required" ? "critical" : "high",
        family: row.family,
        sourceIds: row.sourceIds ?? [],
        candidateIds: row.candidateIds ?? [],
        route: row.recordCapturePlan,
        blockers: row.blockers ?? [],
        reasonCode: row.state === "retry_required" ? "capture_retry_required" : "capture_required"
      })),
    ...(input.sourcePackActionReadiness.intakeActions ?? []).map((action: any) => sourceActorOperationsQueueItem({
      query: input.query,
      type: "request_candidate",
      priority: "medium",
      family: action.family,
      sourceIds: action.sourceIds ?? [],
      candidateIds: action.candidateIds ?? [],
      route: action.route,
      blockers: [{ code: "candidate_required", severity: "warning", family: action.family, retryable: true }],
      reasonCode: "candidate_required"
    })),
    ...(input.alertGenerationReadiness.canRebuildAlerts === true ? [sourceActorOperationsQueueItem({
      query: input.query,
      type: "rebuild_alerts",
      priority: "high",
      family: "all_active",
      sourceIds: [],
      candidateIds: [],
      route: input.alertGenerationReadiness.rebuildPlan,
      blockers: [],
      reasonCode: "alert_rebuild_ready"
    })] : [])
  ];
  const deduped = Array.from(new Map(queueItems.map((item) => [item.id, item])).values());
  return {
    schemaVersion: "dwm.actor_source_operations_queue.v1",
    proofId: stableId("dwm_actor_source_operations_queue", `${input.query}:${deduped.map((item) => `${item.type}:${item.family}:${item.priority}`).join(",")}`),
    query: input.query,
    queueItems: deduped,
    summary: {
      total: deduped.length,
      critical: deduped.filter((item) => item.priority === "critical").length,
      high: deduped.filter((item) => item.priority === "high").length,
      medium: deduped.filter((item) => item.priority === "medium").length,
      families: uniqueSourceReadinessStrings(deduped.map((item) => item.family)),
      actionTypes: uniqueSourceReadinessStrings(deduped.map((item) => item.type)),
      alertRebuildReady: input.alertGenerationReadiness.canRebuildAlerts === true
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorOperationsQueueItem(input: {
  query: string;
  type: string;
  priority: "critical" | "high" | "medium";
  family: string;
  sourceIds: string[];
  candidateIds: string[];
  route: Record<string, any>;
  blockers: Array<Record<string, any>>;
  reasonCode: string;
}) {
  const route = {
    method: input.route?.method ?? "POST",
    path: input.route?.path ?? "/v1/dwm/source-requests",
    body: input.route?.body ?? {},
    dryRunSupported: input.route?.dryRunSupported !== false,
    liveNetworkFetch: false
  };
  return {
    id: stableId("dwm_actor_source_operations_queue_item", `${input.query}:${input.type}:${input.family}:${(input.sourceIds ?? []).join(",")}:${(input.candidateIds ?? []).join(",")}:${input.reasonCode}`),
    type: input.type,
    priority: input.priority,
    family: input.family,
    reasonCode: input.reasonCode,
    sourceIds: input.sourceIds ?? [],
    candidateIds: input.candidateIds ?? [],
    route,
    blockers: dedupeBlockers(input.blockers ?? []),
    dryRunSupported: route.dryRunSupported,
    liveNetworkFetch: false,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorFamilyHealth(input: {
  query: string;
  sourceCoverage: Array<Record<string, any>>;
  parserHealthReadiness: Record<string, any>;
  evidenceReadiness: Record<string, any>;
  captureReadiness: Record<string, any>;
  alertGenerationReadiness: Record<string, any>;
  sourceOperationsQueue: Record<string, any>;
  freshness: Record<string, any>;
}) {
  const parserByFamily = new Map<string, Record<string, any>>((input.parserHealthReadiness.rows ?? []).map((row: any) => [String(row.family), row]));
  const evidenceByFamily = new Map<string, Record<string, any>>((input.evidenceReadiness.rows ?? []).map((row: any) => [String(row.family), row]));
  const captureByFamily = new Map<string, Record<string, any>>((input.captureReadiness.captureRows ?? []).map((row: any) => [String(row.family), row]));
  const alertFamilySet = new Set(input.alertGenerationReadiness.sourceFamilies?.alertCapable ?? []);
  const queueByFamily = new Map<string, Array<Record<string, any>>>();
  for (const item of input.sourceOperationsQueue.queueItems ?? []) {
    const families = item.family === "all_active" ? input.sourceCoverage.map((row) => String(row.family)) : [String(item.family)];
    for (const family of families) queueByFamily.set(family, [...(queueByFamily.get(family) ?? []), item]);
  }
  const rows = input.sourceCoverage.map((coverage) => {
    const family = String(coverage.family);
    const parser = parserByFamily.get(family);
    const evidence = evidenceByFamily.get(family);
    const capture = captureByFamily.get(family);
    const queueItems = queueByFamily.get(family) ?? [];
    const hasSourceRecord = (coverage.sourceIds ?? []).length > 0 || (parser?.sourceIds ?? []).length > 0 || (evidence?.sourceIds ?? []).length > 0;
    const isMissingFamily = coverage.state === "missing" || parser?.parserState === "missing_source";
    const confidence = isMissingFamily ? 0 : Number(evidence?.confidence ?? (hasSourceRecord ? coverage.sourceTrust?.score : 0) ?? 0);
    const blockers = dedupeBlockers([
      ...(coverage.blockers ?? []),
      ...(parser?.blockers ?? []),
      ...(capture?.blockers ?? []),
      ...(evidence?.blockers ?? []),
      ...(evidence?.gap ? [{ code: "candidate_gap", severity: "warning", family, retryable: true }] : [])
    ]);
    return {
      schemaVersion: "dwm.actor_source_family_health_row.v1",
      proofId: stableId("dwm_actor_source_family_health_row", `${input.query}:${family}:${coverage.state}:${parser?.parserState ?? "unknown"}:${capture?.state ?? "no_capture_row"}:${confidence}`),
      query: input.query,
      family,
      state: coverage.state,
      parserState: parser?.parserState ?? "unknown",
      parserStatuses: uniqueSourceReadinessStrings([...(coverage.parserStatuses ?? []), ...(parser?.parserStatuses ?? [])]),
      sourceIds: coverage.sourceIds ?? parser?.sourceIds ?? evidence?.sourceIds ?? [],
      candidateIds: coverage.candidateIds ?? parser?.candidateIds ?? evidence?.candidateIds ?? [],
      timestamps: {
        lastCaptureAt: capture?.lastCaptureAt ?? coverage.lastCaptureAt ?? evidence?.timestamps?.lastCaptureAt,
        lastEnrichmentAt: coverage.lastEnrichmentAt ?? evidence?.timestamps?.lastEnrichmentAt,
        checkedAt: input.freshness.checkedAt
      },
      freshnessState: capture?.freshnessState ?? (coverage.lastCaptureAt ? sourceActorCaptureFreshness(coverage.lastCaptureAt, input.freshness.checkedAt).state : "needs_capture"),
      confidence,
      confidenceTier: isMissingFamily ? "missing" : evidence?.confidenceTier ?? (confidence >= 0.85 ? "high" : confidence >= 0.6 ? "medium" : confidence > 0 ? "low" : "missing"),
      alertability: {
        canEnrichActor: coverage.canEnrichActor === true,
        canProduceAlert: coverage.canProduceAlert === true,
        alertReady: input.alertGenerationReadiness.alertReady === true && alertFamilySet.has(family),
        matchableFields: coverage.matchableFields ?? evidence?.evidenceFields ?? [],
        alertableFields: coverage.alertableFields ?? []
      },
      captureState: capture?.state ?? (coverage.lastCaptureAt ? "capture_observed" : "capture_required"),
      gap: evidence?.gap,
      retryBackoff: coverage.retryBackoff ?? parser?.retryBackoff,
      blockers,
      nextActions: queueItems.map((item) => ({
        id: item.id,
        type: item.type,
        priority: item.priority,
        reasonCode: item.reasonCode,
        route: item.route,
        liveNetworkFetch: false
      })),
      privacyBoundary: coverage.privacyBoundary,
      sourceTrust: coverage.sourceTrust,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  const confidenceRows = rows.filter((row) => row.confidence > 0);
  return {
    schemaVersion: "dwm.actor_source_family_health.v1",
    proofId: stableId("dwm_actor_source_family_health", `${input.query}:${rows.map((row) => `${row.family}:${row.state}:${row.parserState}:${row.confidenceTier}`).join(",")}`),
    query: input.query,
    rows,
    summary: {
      activeFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.state === "active" || row.state === "canary").map((row) => row.family)),
      pausedFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.state === "paused").map((row) => row.family)),
      failedFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.state === "failed" || row.parserState === "retry_required").map((row) => row.family)),
      blockedFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.state === "policy_blocked").map((row) => row.family)),
      missingFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.state === "missing" || row.parserState === "missing_source").map((row) => row.family)),
      alertReadyFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.alertability.alertReady === true).map((row) => row.family)),
      gapFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.gap).map((row) => row.family)),
      retryFamilies: uniqueSourceReadinessStrings(rows.filter((row) => row.retryBackoff?.retryable === true || row.nextActions.some((action: any) => String(action.type).startsWith("retry"))).map((row) => row.family)),
      lastCaptureAt: latestIso(rows.map((row) => row.timestamps.lastCaptureAt)),
      lastEnrichmentAt: latestIso(rows.map((row) => row.timestamps.lastEnrichmentAt)),
      averageConfidence: confidenceRows.length > 0
        ? Math.round((confidenceRows.reduce((sum, row) => sum + row.confidence, 0) / confidenceRows.length) * 100) / 100
        : 0
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorConsumerBridge(input: {
  query: string;
  sourceFamilyHealth: Record<string, any>;
  evidenceReadiness: Record<string, any>;
  alertGenerationReadiness: Record<string, any>;
  alertCaseHandoffReadiness: Record<string, any>;
  sourceOperationsQueue: Record<string, any>;
  candidateGaps: Array<Record<string, any>>;
  freshness: Record<string, any>;
}) {
  const familyRows = input.sourceFamilyHealth.rows ?? [];
  const evidenceFieldsByFamily = new Map((input.evidenceReadiness.rows ?? []).map((row: any) => [String(row.family), row.evidenceFields ?? []]));
  const nextActionsByFamily = new Map<string, Array<Record<string, any>>>();
  for (const item of input.sourceOperationsQueue.queueItems ?? []) {
    const families = item.family === "all_active" ? familyRows.map((row: any) => String(row.family)) : [String(item.family)];
    for (const family of families) nextActionsByFamily.set(family, [...(nextActionsByFamily.get(family) ?? []), {
      id: item.id,
      type: item.type,
      priority: item.priority,
      reasonCode: item.reasonCode,
      route: item.route,
      liveNetworkFetch: false
    }]);
  }
  const consumerRows = familyRows.map((row: any) => ({
    schemaVersion: "dwm.actor_source_consumer_bridge_row.v1",
    proofId: stableId("dwm_actor_source_consumer_bridge_row", `${input.query}:${row.family}:${row.state}:${row.parserState}:${row.captureState}:${row.alertability?.alertReady === true}`),
    query: input.query,
    family: row.family,
    state: row.state,
    parserState: row.parserState,
    captureState: row.captureState,
    confidence: row.confidence,
    confidenceTier: row.confidenceTier,
    timestamps: row.timestamps,
    freshnessState: row.freshnessState,
    provenance: {
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      privacyBoundary: row.privacyBoundary,
      sourceTrust: row.sourceTrust
    },
    consumers: {
      publicTiActorPage: row.alertability?.canEnrichActor === true || Boolean(row.gap),
      sharedWatchlistAlerts: row.alertability?.canProduceAlert === true,
      caseHandoff: row.alertability?.alertReady === true && Boolean(row.timestamps?.lastCaptureAt)
    },
    fields: {
      evidence: evidenceFieldsByFamily.get(String(row.family)) ?? [],
      matchable: row.alertability?.matchableFields ?? [],
      alertable: row.alertability?.alertableFields ?? []
    },
    blockers: row.blockers ?? [],
    gap: row.gap,
    retryBackoff: row.retryBackoff,
    nextActions: nextActionsByFamily.get(String(row.family)) ?? [],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  }));
  const consumerReadiness = (consumer: "publicTiActorPage" | "sharedWatchlistAlerts" | "caseHandoff", ready: boolean) => {
    const usableRows = consumerRows.filter((row) => row.consumers[consumer] === true);
    const blockerRows = consumer === "publicTiActorPage"
      ? input.candidateGaps
      : consumer === "sharedWatchlistAlerts"
        ? input.alertGenerationReadiness.blockers ?? []
        : input.alertCaseHandoffReadiness.blockers ?? [];
    return {
      consumer,
      ready,
      sourceFamilies: uniqueSourceReadinessStrings(usableRows.map((row) => row.family)),
      proofRows: usableRows.map((row) => row.proofId),
      matchableFields: uniqueSourceReadinessStrings(usableRows.flatMap((row) => row.fields.matchable)),
      alertableFields: uniqueSourceReadinessStrings(usableRows.flatMap((row) => row.fields.alertable)),
      blockers: dedupeBlockers(blockerRows),
      nextActions: uniqueSourceReadinessStrings(consumerRows.flatMap((row) => row.nextActions.map((action: any) => action.type))),
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  };
  return {
    schemaVersion: "dwm.actor_source_consumer_bridge.v1",
    proofId: stableId("dwm_actor_source_consumer_bridge", `${input.query}:${consumerRows.map((row) => `${row.family}:${row.state}:${row.parserState}:${row.confidenceTier}`).join(",")}`),
    query: input.query,
    rows: consumerRows,
    consumers: [
      consumerReadiness("publicTiActorPage", input.evidenceReadiness.evidenceReady === true),
      consumerReadiness("sharedWatchlistAlerts", input.alertGenerationReadiness.alertReady === true),
      consumerReadiness("caseHandoff", input.alertCaseHandoffReadiness.caseReady === true)
    ],
    summary: {
      publicTiReady: input.evidenceReadiness.evidenceReady === true,
      alertReady: input.alertGenerationReadiness.alertReady === true,
      caseReady: input.alertCaseHandoffReadiness.caseReady === true,
      watchlistMatchReady: input.alertGenerationReadiness.watchlistMatchReadiness?.summary?.ready === true,
      watchlistTerms: input.alertGenerationReadiness.watchlistMatchReadiness?.watchlistTerms ?? [],
      sourceFamilies: uniqueSourceReadinessStrings(consumerRows.map((row) => row.family)),
      alertableFamilies: uniqueSourceReadinessStrings(consumerRows.filter((row) => row.consumers.sharedWatchlistAlerts === true).map((row) => row.family)),
      gapFamilies: uniqueSourceReadinessStrings(input.candidateGaps.map((gap) => gap.family)),
      retryFamilies: input.sourceFamilyHealth.summary?.retryFamilies ?? [],
      lastProofAt: latestIso(consumerRows.flatMap((row) => [row.timestamps?.lastCaptureAt, row.timestamps?.lastEnrichmentAt])) ?? input.freshness.checkedAt
    },
    alertCaseHandoffReadiness: input.alertCaseHandoffReadiness,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorSectionReadiness(input: {
  query: string;
  actorSections: Record<string, any>;
  sourceFamilyHealth: Record<string, any>;
  sourceOperationsQueue: Record<string, any>;
  candidateGaps: Array<Record<string, any>>;
}) {
  const familyRows = input.sourceFamilyHealth.rows ?? [];
  const familyByName = new Map(familyRows.map((row: any) => [String(row.family), row]));
  const actionsByFamily = new Map<string, Array<Record<string, any>>>();
  for (const item of input.sourceOperationsQueue.queueItems ?? []) {
    const families = item.family === "all_active" ? familyRows.map((row: any) => String(row.family)) : [String(item.family)];
    for (const family of families) actionsByFamily.set(family, [...(actionsByFamily.get(family) ?? []), {
      id: item.id,
      type: item.type,
      priority: item.priority,
      reasonCode: item.reasonCode,
      route: item.route,
      liveNetworkFetch: false
    }]);
  }
  const gapByFamily = new Map(input.candidateGaps.map((gap) => [String(gap.family), gap]));
  const sections = Object.entries(input.actorSections).map(([section, raw]: [string, any]) => {
    const sourceFamilies = uniqueSourceReadinessStrings(raw?.sourceFamilies ?? []);
    const supportingRows = sourceFamilies.map((family) => familyByName.get(family)).filter(Boolean) as Array<Record<string, any>>;
    const missingFamilies = SOURCE_GROWTH_FAMILIES
      .filter((family) => actorSectionsForFamily(family).includes(section))
      .filter((family) => !sourceFamilies.includes(family) && gapByFamily.has(family));
    const blockers = dedupeBlockers([
      ...(raw?.blockers ?? []),
      ...missingFamilies.map((family) => ({ code: "missing_source_family", severity: "warning", section, family, retryable: true })),
      ...supportingRows.flatMap((row) => row.blockers ?? [])
    ]);
    const confidenceRows = supportingRows.filter((row) => Number(row.confidence ?? 0) > 0);
    const nextActions = uniqueSourceReadinessObjects([
      ...supportingRows.flatMap((row) => actionsByFamily.get(String(row.family)) ?? []),
      ...missingFamilies.flatMap((family) => actionsByFamily.get(family) ?? [])
    ], (item) => `${item.type}:${item.reasonCode}:${item.route?.path}:${JSON.stringify(item.route?.body ?? {})}`);
    return {
      schemaVersion: "dwm.actor_source_section_readiness_row.v1",
      proofId: stableId("dwm_actor_source_section_readiness_row", `${input.query}:${section}:${sourceFamilies.join(",")}:${blockers.map((blocker) => blocker.code).join(",")}`),
      query: input.query,
      section,
      state: raw?.covered === true ? "covered" : "missing_source",
      covered: raw?.covered === true,
      sourceFamilies,
      missingFamilies,
      provenance: supportingRows.map((row) => ({
        family: row.family,
        sourceIds: row.sourceIds ?? [],
        candidateIds: row.candidateIds ?? [],
        timestamps: row.timestamps,
        privacyBoundary: row.privacyBoundary,
        sourceTrust: row.sourceTrust
      })),
      timestamps: {
        lastCaptureAt: latestIso(supportingRows.map((row) => row.timestamps?.lastCaptureAt)),
        lastEnrichmentAt: latestIso(supportingRows.map((row) => row.timestamps?.lastEnrichmentAt))
      },
      confidence: confidenceRows.length > 0
        ? Math.round((confidenceRows.reduce((sum, row) => sum + Number(row.confidence ?? 0), 0) / confidenceRows.length) * 100) / 100
        : 0,
      matchableFields: uniqueSourceReadinessStrings(supportingRows.flatMap((row) => row.alertability?.matchableFields ?? [])),
      alertableFields: uniqueSourceReadinessStrings(supportingRows.flatMap((row) => row.alertability?.alertableFields ?? [])),
      blockers,
      nextActions,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "dwm.actor_source_section_readiness.v1",
    proofId: stableId("dwm_actor_source_section_readiness", `${input.query}:${sections.map((row) => `${row.section}:${row.state}:${row.sourceFamilies.join(",")}`).join("|")}`),
    query: input.query,
    sections,
    summary: {
      coveredSections: uniqueSourceReadinessStrings(sections.filter((row) => row.covered).map((row) => row.section)),
      missingSections: uniqueSourceReadinessStrings(sections.filter((row) => !row.covered).map((row) => row.section)),
      sourceFamilies: uniqueSourceReadinessStrings(sections.flatMap((row) => row.sourceFamilies)),
      gapFamilies: uniqueSourceReadinessStrings(sections.flatMap((row) => row.missingFamilies)),
      nextActionTypes: uniqueSourceReadinessStrings(sections.flatMap((row) => row.nextActions.map((action: any) => action.type))),
      averageConfidence: sections.length > 0
        ? Math.round((sections.reduce((sum, row) => sum + Number(row.confidence ?? 0), 0) / sections.length) * 100) / 100
        : 0
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorMetadata(query: string, provenance: Array<Record<string, any>>, coverage: Record<string, any>) {
  const normalized = query.trim();
  return {
    query: normalized,
    actorId: stableId("ti_actor", normalized.toLowerCase()),
    displayName: normalized,
    aliases: uniqueSourceReadinessStrings(provenance.flatMap((row) => row.matchableFields?.includes("aliases") ? [normalized] : [])),
    backedBySourceFamilies: uniqueSourceReadinessStrings(provenance.map((row) => row.family)),
    sectionCoverageState: Object.fromEntries(Object.entries(coverage.actorSections ?? {}).map(([section, value]: [string, any]) => [section, value?.covered === true ? "covered" : "missing_source"])),
    noSyntheticActorClaims: true
  };
}

function sourceActorCoverageRows(familyRows: Array<Record<string, any>>) {
  return familyRows.map((row) => ({
    family: row.family,
    candidateIds: row.candidateIds ?? [],
    sourceIds: row.sourceIds ?? [],
    state: row.active > 0 ? "active" : row.canary > 0 ? "canary" : row.failed > 0 ? "failed" : row.blocked > 0 || row.policyBlocked > 0 ? "policy_blocked" : row.paused > 0 ? "paused" : "missing",
    candidateCount: row.candidateCount ?? 0,
    parserStatuses: row.parserStatuses ?? [],
    lastCaptureAt: row.lastCaptureAt,
    lastEnrichmentAt: row.lastEnrichmentAt,
    retryBackoff: row.retryBackoff,
    alertableFields: row.alertableFields ?? [],
    matchableFields: row.matchableFields ?? [],
    canEnrichActor: row.canEnrichActor === true,
    canProduceAlert: row.canProduceAlert === true,
    privacyBoundary: row.privacyBoundary,
    sourceTrust: row.sourceTrust,
    blockers: row.blockers ?? []
  }));
}

function sourceActorPackActionReadiness(input: {
  query: string;
  sourceCoverage: Array<Record<string, any>>;
  retryBlockers: Array<Record<string, any>>;
  candidateGaps: Array<Record<string, any>>;
}) {
  const retryFamilies = new Set(input.retryBlockers.map((row) => String(row.family)));
  const retryActions = input.sourceCoverage
    .filter((row) => retryFamilies.has(String(row.family)) && ((row.sourceIds ?? []).length > 0 || (row.candidateIds ?? []).length > 0))
    .map((row) => ({
      action: "retry",
      family: row.family,
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      idempotencyKey: stableId("dwm_actor_source_retry", `${input.query}:${row.family}:${(row.sourceIds ?? []).join(",")}:${(row.candidateIds ?? []).join(",")}`),
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          action: "pack_review",
          packAction: "retry",
          sourceIds: row.sourceIds ?? [],
          candidateIds: row.candidateIds ?? [],
          reason: `retry ${input.query} ${row.family} parser or collection readiness`
        }
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }));
  const activationActions = input.sourceCoverage
    .filter((row) => ["paused", "failed"].includes(String(row.state)) && !retryFamilies.has(String(row.family)) && ((row.sourceIds ?? []).length > 0 || (row.candidateIds ?? []).length > 0))
    .map((row) => ({
      action: "activate",
      family: row.family,
      sourceIds: row.sourceIds ?? [],
      candidateIds: row.candidateIds ?? [],
      idempotencyKey: stableId("dwm_actor_source_activate", `${input.query}:${row.family}:${(row.sourceIds ?? []).join(",")}:${(row.candidateIds ?? []).join(",")}`),
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          action: "pack_review",
          packAction: "approve",
          sourceIds: row.sourceIds ?? [],
          candidateIds: row.candidateIds ?? [],
          approveMetadataOnly: row.privacyBoundary?.restrictedSource === true ? true : undefined,
          reason: `activate ${input.query} ${row.family} source readiness`
        }
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }));
  const intakeActions = input.candidateGaps.map((gap) => ({
    action: "request_candidate",
    family: gap.family,
    idempotencyKey: stableId("dwm_actor_source_candidate_request", `${input.query}:${gap.family}:${gap.state}`),
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackLabel: `${input.query} ${gap.family} enrichment source`,
        scope: input.query,
        candidates: [gap.intakeRecommendation]
      }
    },
    dryRunSupported: true,
    liveNetworkFetch: false
  }));
  return {
    schemaVersion: "dwm.actor_source_pack_action_readiness.v1",
    query: input.query,
    retryActions,
    activationActions,
    intakeActions,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorCaptureFreshness(latestCaptureAt: string | undefined, generatedAt: string | undefined) {
  if (!latestCaptureAt) return { state: "needs_capture", staleAfterHours: 24, ageHours: undefined };
  const ageMs = Math.max(0, Date.parse(String(generatedAt ?? nowIso())) - Date.parse(latestCaptureAt));
  const ageHours = Math.round((ageMs / 3600000) * 10) / 10;
  return {
    state: ageHours > 24 ? "stale" : "fresh",
    staleAfterHours: 24,
    ageHours,
    latestCaptureAt
  };
}

function sourceActorAlertCaseHandoffReadiness(input: {
  query: string;
  alertability: Record<string, any>;
  latestCaptureAt?: string;
  candidateGaps: Array<Record<string, any>>;
  retryBlockers: Array<Record<string, any>>;
  missingSections: Array<Record<string, any>>;
}) {
  const blockers = [
    ...(!input.latestCaptureAt ? [{ code: "capture_required", severity: "blocking", retryable: true }] : []),
    ...(input.alertability.activeSourceFamilies.length === 0 ? [{ code: "no_active_source_family", severity: "blocking", retryable: true }] : []),
    ...(input.alertability.matchableFields.length === 0 ? [{ code: "no_matchable_fields", severity: "blocking", retryable: true }] : []),
    ...input.candidateGaps.filter((gap) => gap.state === "policy_blocked").map((gap) => ({ code: "policy_blocked_source", severity: "blocking", family: gap.family, retryable: false })),
    ...input.retryBlockers.map((row) => ({ code: "retry_required", severity: "warning", family: row.family, retryable: true })),
    ...input.missingSections.map((row) => ({ code: "missing_actor_section_source", severity: "warning", section: row.section, retryable: true }))
  ];
  const blocking = blockers.some((blocker) => blocker.severity === "blocking");
  return {
    schemaVersion: "dwm.actor_alert_case_handoff_readiness.v1",
    query: input.query,
    alertReady: !blocking,
    caseReady: !blocking && Boolean(input.latestCaptureAt),
    requiresWatchlist: true,
    canOpenCase: !blocking,
    routes: {
      alertRebuild: "/v1/dwm/alerts/rebuild",
      caseHandoff: "/v1/cases",
      sourceRetry: "/v1/dwm/source-requests"
    },
    blockers: dedupeBlockers(blockers),
    proof: {
      latestCaptureAt: input.latestCaptureAt,
      activeSourceFamilies: input.alertability.activeSourceFamilies,
      matchableFields: input.alertability.matchableFields,
      sourcePolicyLimits: input.alertability.sourcePolicyLimits
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorIntakeRecommendation(query: string, family: string) {
  const normalized = query.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "actor";
  if (family === "telegram") return { type: "telegram_channel", family, targetTemplate: `@${normalized}_public_updates`, policyBoundary: "public_telegram_only" };
  if (family === "darkweb_onion") return { type: "restricted_metadata", family, targetTemplate: `metadata://darkweb/onion/${normalized}-index`, policyBoundary: "metadata_only_restricted_source" };
  if (family === "darkweb_metadata") return { type: "restricted_metadata", family, targetTemplate: `metadata://darkweb/${normalized}/claims`, policyBoundary: "metadata_only_restricted_source" };
  if (family === "public_advisory") return { type: "public_url", family, targetTemplate: `https://example.com/security/advisory/${normalized}`, policyBoundary: "public_metadata_only" };
  if (family === "actor_page") return { type: "public_url", family, targetTemplate: `https://example.com/threat-actors/${normalized}`, policyBoundary: "public_metadata_only" };
  return { type: "public_url", family, targetTemplate: `https://example.com/blog/${normalized}-analysis`, policyBoundary: "public_metadata_only" };
}

function sourceActorCandidateIntakeContract(query: string, actorReadiness: Record<string, any>) {
  const candidatePreviews = actorReadiness.candidateGaps.map((gap: any) => sourceActorCandidateIntakePreview(query, gap));
  const sourcePackId = stableId("dwm_actor_source_pack", query.toLowerCase());
  return {
    schemaVersion: "dwm.actor_source_candidate_intake.v1",
    mode: "prepare_no_network",
    query,
    sourcePackWorkflow: sourceActorCandidateIntakeWorkflow(query, sourcePackId, candidatePreviews),
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackId,
        sourcePackLabel: `${query} enrichment source pack`,
        scope: query,
        candidates: actorReadiness.candidateGaps.map((gap: any) => gap.intakeRecommendation)
      }
    },
    acceptedFamilies: SOURCE_GROWTH_FAMILIES,
    policyValidation: {
      publicTelegramOnly: true,
      darkwebMetadataOnly: true,
      publicWebMetadataOnly: true,
      liveNetworkFetch: false,
      rawRestrictedPayloadStorage: false
    },
    validationSummary: {
      totalCandidates: candidatePreviews.length,
      accepted: candidatePreviews.filter((preview: any) => preview.policyResult.allowed === true).length,
      blocked: candidatePreviews.filter((preview: any) => preview.policyResult.allowed !== true).length,
      metadataOnly: candidatePreviews.filter((preview: any) => preview.policyResult.metadataOnly === true).length,
      publicOnly: candidatePreviews.filter((preview: any) => preview.policyResult.publicOnly === true).length
    },
    fixtureManifest: sourceActorCandidateFixtureManifest(query, sourcePackId, candidatePreviews),
    candidatePreviews,
    candidateGaps: actorReadiness.candidateGaps,
    safeOutput: actorReadiness.safeOutput
  };
}

function sourceActorCandidateFixtureManifest(query: string, sourcePackId: string, candidatePreviews: Array<Record<string, any>>) {
  const fixtures = candidatePreviews.map((preview) => {
    const family = preview.family as SourceGrowthFamily;
    return {
      schemaVersion: "dwm.actor_source_candidate_fixture.v1",
      fixtureId: stableId("dwm_actor_source_candidate_fixture", `${query}:${sourcePackId}:${family}:${preview.proofId}`),
      sourcePackId,
      query,
      family,
      candidateProofId: preview.proofId,
      fixtureKey: sourceActorCandidateFixtureKey(query, family),
      parserProfile: preview.parserExpectation?.profile ?? parserProfileForFamily(family),
      parserExpectation: preview.parserExpectation,
      expectedCaptureType: preview.parserExpectation?.expectedCaptureType ?? expectedCaptureTypeForFamily(family),
      policyBoundary: preview.policyResult?.boundary,
      metadataOnly: preview.policyResult?.metadataOnly === true,
      publicOnly: preview.policyResult?.publicOnly === true,
      alertableFields: preview.alertability?.alertableFields ?? [],
      loadPlan: {
        mode: "no_network_fixture",
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          action: "pack_worker_run",
          sourcePackId,
          candidateProofId: preview.proofId,
          fixtureKey: sourceActorCandidateFixtureKey(query, family),
          dryRun: true
        },
        liveNetworkFetch: false
      },
      validationChecks: [
        "policy_boundary_present",
        "parser_profile_present",
        "expected_capture_type_present",
        "raw_restricted_payload_not_stored",
        "live_network_fetch_disabled"
      ],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    };
  });
  return {
    schemaVersion: "dwm.actor_source_candidate_fixture_manifest.v1",
    proofId: stableId("dwm_actor_source_candidate_fixture_manifest", `${query}:${sourcePackId}:${fixtures.map((fixture) => `${fixture.family}:${fixture.fixtureKey}`).join(",")}`),
    query,
    sourcePackId,
    mode: "no_network_fixture",
    fixtures,
    summary: {
      totalFixtures: fixtures.length,
      families: uniqueSourceReadinessStrings(fixtures.map((fixture) => fixture.family)),
      metadataOnlyFamilies: uniqueSourceReadinessStrings(fixtures.filter((fixture) => fixture.metadataOnly).map((fixture) => fixture.family)),
      publicOnlyFamilies: uniqueSourceReadinessStrings(fixtures.filter((fixture) => fixture.publicOnly).map((fixture) => fixture.family)),
      parserProfiles: uniqueSourceReadinessStrings(fixtures.map((fixture) => fixture.parserProfile)),
      expectedCaptureTypes: uniqueSourceReadinessStrings(fixtures.map((fixture) => fixture.expectedCaptureType))
    },
    policyBoundary: {
      liveNetworkFetch: false,
      rawRestrictedPayloadStorage: false,
      metadataOnlyRestrictedSources: true,
      publicTelegramOnly: true
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorCandidateFixtureKey(query: string, family: SourceGrowthFamily) {
  const normalized = query.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "actor";
  return `fixture://ti-source-pack/${normalized}/${family}/${parserProfileForFamily(family)}`;
}

function sourceActorCandidateIntakeWorkflow(query: string, sourcePackId: string, candidatePreviews: Array<Record<string, any>>) {
  const safeCandidatePreviews = candidatePreviews.filter((preview) => preview.policyResult?.allowed === true);
  return {
    schemaVersion: "dwm.actor_source_candidate_intake_workflow.v1",
    query,
    sourcePackId,
    mode: "prepare_no_network",
    idempotencyKey: stableId("dwm_actor_source_pack_workflow", `${query}:${sourcePackId}:${safeCandidatePreviews.map((preview) => preview.proofId).join(",")}`),
    steps: [
      {
        step: "create_source_pack",
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          sourcePackId,
          sourcePackLabel: `${query} enrichment source pack`,
          scope: query,
          candidates: safeCandidatePreviews.map((preview) => preview.candidate)
        },
        idempotencyKey: stableId("dwm_actor_source_pack_create", sourcePackId),
        liveNetworkFetch: false
      },
      {
        step: "validate_candidates",
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          action: "pack_worker_run",
          sourcePackId,
          chunkSize: Math.max(1, Math.min(25, safeCandidatePreviews.length || 1)),
          dryRun: true
        },
        idempotencyKey: stableId("dwm_actor_source_pack_validate", sourcePackId),
        liveNetworkFetch: false
      },
      {
        step: "review_activation",
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          action: "pack_review",
          sourcePackId,
          packAction: "approve",
          approveMetadataOnly: safeCandidatePreviews.some((preview) => preview.policyResult?.metadataOnly === true),
          reason: `${query} source enrichment candidate approval`
        },
        idempotencyKey: stableId("dwm_actor_source_pack_review", sourcePackId),
        requiresOperatorApproval: true,
        liveNetworkFetch: false
      }
    ],
    expectedStateTransitions: ["candidate_requested", "validation_ready", "operator_review_required", "activation_queued"],
    blockedCandidates: candidatePreviews
      .filter((preview) => preview.policyResult?.allowed !== true)
      .map((preview) => ({
        family: preview.family,
        proofId: preview.proofId,
        blockers: preview.blockers
      })),
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceActorCandidateIntakePreview(query: string, gap: Record<string, any>) {
  const recommendation = gap.intakeRecommendation ?? sourceActorIntakeRecommendation(query, gap.family);
  const family = recommendation.family as SourceGrowthFamily;
  const metadataOnly = family === "darkweb_onion" || family === "darkweb_metadata" || recommendation.policyBoundary === "metadata_only_restricted_source";
  const publicOnly = family === "telegram" || recommendation.policyBoundary === "public_metadata_only";
  const policyAllowed = family === "telegram"
    ? recommendation.policyBoundary === "public_telegram_only"
    : metadataOnly || publicOnly;
  const blockers = [
    ...(policyAllowed ? [] : [{ code: "policy_rejected", severity: "blocking", retryable: false }]),
    ...(metadataOnly ? [{ code: "metadata_only_restricted_source", severity: "info", retryable: false }] : []),
    ...(family === "telegram" && recommendation.policyBoundary !== "public_telegram_only" ? [{ code: "private_telegram_not_allowed", severity: "blocking", retryable: false }] : [])
  ];
  return {
    schemaVersion: "dwm.actor_source_candidate_intake_preview.v1",
    proofId: stableId("dwm_actor_source_candidate_intake_preview", `${query}:${family}:${recommendation.targetTemplate}:${recommendation.policyBoundary}`),
    query,
    family,
    candidate: recommendation,
    policyResult: {
      allowed: policyAllowed,
      publicOnly,
      metadataOnly,
      boundary: recommendation.policyBoundary,
      liveNetworkFetch: false,
      rawRestrictedPayloadStorage: false
    },
    parserExpectation: {
      profile: parserProfileForFamily(family),
      status: policyAllowed ? "parser_contract_ready" : "blocked_by_policy",
      expectedCaptureType: expectedCaptureTypeForFamily(family),
      liveNetworkRequiredForProof: false
    },
    activationReadiness: {
      canCreateCandidate: policyAllowed,
      canAutoActivate: false,
      requiresOperatorApproval: true,
      requiresMetadataOnlyApproval: metadataOnly,
      idempotencyKey: stableId("dwm_actor_source_candidate_create", `${query}:${family}:${recommendation.targetTemplate}`)
    },
    alertability: {
      canEventuallyProduceAlert: policyAllowed && alertableFieldsForFamily(family).length > 0,
      alertableFields: alertableFieldsForFamily(family),
      requiresCaptureBeforeAlert: true
    },
    blockers,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourcePackActionContract(input: {
  pack?: SourcePackRegistry;
  candidate: any;
  source?: SourceRecord;
  packAction: NonNullable<DwmSourceRequestBody["packAction"]>;
  body: DwmSourceRequestBody;
  options: ApiServerOptions;
  extraBlockers?: Array<Record<string, unknown>>;
}) {
  const blockers = sourcePackActionBlockers(input);
  const action = input.packAction === "approve" ? "activate" : input.packAction;
  const idempotencyKey = stableId("dwm_source_pack_action", [
    input.pack?.id ?? input.candidate.sourcePackId ?? "missing_pack",
    input.candidate.id,
    action,
    input.body.reason ?? "",
    input.body.approveMetadataOnly === true ? "metadata_only_approved" : "default"
  ].join(":"));
  return {
    schemaVersion: "dwm.source_pack_action_contract.v1",
    mode: input.body.dryRun === true ? "prepare" : "execute",
    action,
    requestedAction: input.packAction,
    allowed: blockers.filter((blocker) => blocker.severity === "blocking").length === 0,
    idempotencyKey,
    sourcePackId: input.pack?.id ?? input.candidate.sourcePackId,
    candidateId: input.candidate.id,
    sourceId: input.source?.id ?? input.candidate.sourceId,
    family: sourcePackActionCandidateFamily(input.candidate, input.source),
    activationState: input.source ? activationStateForSource(input.source) : input.candidate.activationState ?? input.candidate.decision ?? input.candidate.status,
    retryEligibility: {
      retryable: Boolean(input.source) || isRetryableSourcePackCandidate(input.candidate) || Boolean(input.source?.metadata?.lastCollectionOutcome?.retryAfter),
      reason: retryEligibilityReason(input.candidate, input.source)
    },
    blockers,
    safeOutput: {
      rawUnsafeRowsStored: false,
      rawTargetsExposed: false,
      privateTelegramContentExposed: false,
      restrictedMetadataLeaked: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function sourcePackActionBlockers(input: {
  pack?: SourcePackRegistry;
  candidate: any;
  source?: SourceRecord;
  packAction: NonNullable<DwmSourceRequestBody["packAction"]>;
  body: DwmSourceRequestBody;
  options: ApiServerOptions;
  extraBlockers?: Array<Record<string, unknown>>;
}) {
  const blockers: Array<Record<string, unknown>> = [];
  if (!input.pack) blockers.push({ code: "missing_source_pack", severity: "blocking", message: "source pack registry row is required for candidate action", retryable: false });
  const readiness = buildDwmSourcePackWorkerReadinessSnapshot(input.options, { generatedAt: input.body.generatedAt });
  if (readiness.freshness === "stale") blockers.push({ code: "stale_worker", severity: "blocking", message: `source-pack worker is older than ${readiness.staleAfterMinutes} minutes`, retryable: true });
  if (isDuplicateSourcePackCandidate(input.candidate) && input.packAction !== "suppress") blockers.push({ code: "duplicate_source", severity: "blocking", message: "duplicate candidates can only be suppressed or inspected", retryable: false });
  if (isRejectedPolicySourcePackCandidate(input.candidate) && input.packAction !== "suppress") blockers.push({ code: "rejected_policy", severity: "blocking", message: String(input.candidate.failure?.message ?? input.candidate.reason ?? "candidate rejected by policy"), retryable: false });
  if (input.packAction !== "suppress" && (input.candidate.failure || String(input.candidate.parserStatus ?? "").includes("failed") || String(input.candidate.parserStatus ?? "").includes("blocked"))) {
    blockers.push({
      code: "parser_failure",
      severity: isRetryableSourcePackCandidate(input.candidate) && input.packAction === "retry" ? "warning" : "blocking",
      message: String(input.candidate.failure?.message ?? input.candidate.parserStatus ?? "parser failure"),
      retryable: isRetryableSourcePackCandidate(input.candidate)
    });
  }
  if (input.packAction === "retry" && !input.source && !isRetryableSourcePackCandidate(input.candidate)) {
    blockers.push({ code: "no_retry_eligibility", severity: "blocking", message: "candidate has no retryable parser or collection failure", retryable: false });
  }
  if ((input.packAction === "approve" || input.packAction === "promote") && !input.source) {
    blockers.push({ code: "activation_disabled", severity: "blocking", message: "candidate has no persisted source row to activate", retryable: false });
  }
  if ((input.packAction === "approve" || input.packAction === "promote") && input.source && isRestrictedMetadataSource(input.source) && input.body.approveMetadataOnly !== true) {
    blockers.push({ code: "activation_disabled", severity: "blocking", message: "restricted metadata activation requires approveMetadataOnly=true", retryable: true });
  }
  if (input.pack) {
    const coverage = sourceFamilyCoverage({ sources: sourcesForPack(input.pack.id, input.options), registry: input.pack });
    const candidateFamily = sourcePackActionCandidateFamily(input.candidate, input.source);
    const family = coverage[candidateFamily];
    if (family.total > 0 && family.active === 0 && input.packAction === "retry") {
      blockers.push({ code: "source_family_inactive", severity: "warning", family: candidateFamily, retryable: true });
    }
    const promotable = input.pack.candidates.some((candidate) => !isBlockedSourcePackCandidate(candidate) || isRetryableSourcePackCandidate(candidate));
    if (!promotable && (input.packAction === "approve" || input.packAction === "promote" || input.packAction === "retry")) {
      blockers.push({ code: "source_pack_not_promotable", severity: "blocking", message: "source pack has no promotable or retryable candidates", retryable: false });
    }
  }
  return [...blockers, ...(input.extraBlockers ?? [])];
}

function retryEligibilityReason(candidate: any, source?: SourceRecord): string {
  if (source) return "persisted source row can schedule an operator parser retry";
  if (isRetryableSourcePackCandidate(candidate)) return "candidate has retryable parser or validation state";
  if (source?.metadata?.lastCollectionOutcome?.retryAfter) return "source has collection retry backoff";
  if (isDuplicateSourcePackCandidate(candidate)) return "duplicate candidates are not retryable";
  if (isRejectedPolicySourcePackCandidate(candidate)) return "policy-rejected candidates are not retryable";
  return "no retryable failure is recorded";
}

function sourcePackActionCandidateFamily(candidate: any, source?: SourceRecord): SourceGrowthFamily {
  return candidate.declaredFamily ?? candidate.sourceGrowthFamily ?? (source ? sourceGrowthFamilyForSource(source) : "telegram");
}

function lookupSourcePackRegistryReviewCandidates(body: DwmSourceRequestBody, options: ApiServerOptions): Array<{ pack: SourcePackRegistry; candidate: SourcePackRegistryCandidate }> {
  const candidateIds = new Set([body.candidateId, ...(body.candidateIds ?? [])].filter(Boolean).map(String));
  const pack = findSourcePackRegistry(body, options);
  const packs = pack ? [pack] : sourcePackStore(options).list({ limit: 500 }).items;
  return packs.flatMap((item) => item.candidates
    .filter((candidate) => (candidateIds.size === 0 && item.id === body.sourcePackId) || candidateIds.has(candidate.id))
    .map((candidate) => ({ pack: item, candidate })));
}

function saveSourcePackRegistryCandidateDecision(pack: SourcePackRegistry, candidateId: string, options: ApiServerOptions, input: {
  status: string;
  decision: string;
  actor: string;
  at: string;
  reason?: string;
  parserStatus?: string;
  healthStatus?: string;
  retryHint?: string;
}) {
  let updatedCandidate = pack.candidates.find((candidate) => candidate.id === candidateId);
  const updatedPack = upsertSourcePackRegistry(options, {
    ...pack,
    updatedAt: input.at,
    candidates: pack.candidates.map((candidate) => {
      if (candidate.id !== candidateId) return candidate;
      updatedCandidate = {
        ...candidate,
        status: input.status,
        decision: input.decision,
        decidedBy: input.actor,
        decidedAt: input.at,
        reason: input.reason,
        parserStatus: input.parserStatus ?? candidate.parserStatus,
        healthStatus: input.healthStatus ?? candidate.healthStatus,
        retryHint: input.retryHint ?? candidate.retryHint
      };
      return updatedCandidate;
    }),
    audit: [
      ...pack.audit,
      { at: input.at, action: input.decision, actor: input.actor, reason: input.reason, candidateId }
    ]
  });
  return {
    pack: updatedPack,
    candidate: updatedPack.candidates.find((candidate) => candidate.id === candidateId) ?? updatedCandidate ?? pack.candidates.find((candidate) => candidate.id === candidateId)!
  };
}

function sourcePackListResponse(body: DwmSourceRequestBody, options: ApiServerOptions) {
  const query = sourcePackListQuery(body);
  const listed = sourcePackStore(options).list(query);
  const packs = listed.items
    .filter((pack) => !body.tenantId || pack.tenantId === body.tenantId)
    .map((pack) => sourcePackRegistryStatus(pack, options));
  return {
    action: "pack_list",
    packs,
    nextCursor: listed.nextCursor,
    summary: {
      packCount: packs.length,
      totalMatchedPacks: listed.total,
      totalCandidates: packs.reduce((sum, pack) => sum + pack.packStatus.totalCandidateCount, 0),
      activeCount: packs.reduce((sum, pack) => sum + pack.packStatus.activeCount, 0),
      rejectedCount: packs.reduce((sum, pack) => sum + pack.packStatus.rejectedCount, 0),
      duplicateCount: packs.reduce((sum, pack) => sum + pack.packStatus.duplicateCount, 0),
      queuedForCollectionCount: packs.reduce((sum, pack) => sum + pack.packStatus.queuedForCollectionCount, 0)
    },
    safeOutput: sourcePackSafeOutput()
  };
}

function sourcePackWorkerStateForPacks(packs: SourcePackRegistry[], options: ApiServerOptions) {
  const packIds = new Set(packs.map((pack) => pack.id));
  const queueRecords = sourcePackValidationQueue(options).list().filter((record) => record.packIds.some((packId) => packIds.has(packId)));
  const activeRows = sourcePackActiveSourceStore(options).list().filter((row) => packIds.has(row.packId));
  const runs = sourcePackWorkerRunStore(options).list().filter((run) => packIds.has(run.sourcePackId));
  return {
    readiness: sourcePackWorkerReadinessCounters(packs, queueRecords, activeRows),
    lastRun: runs.at(-1)
  };
}

function sourcePackGrowthCounters(packs: SourcePackRegistry[], options: ApiServerOptions) {
  const packIds = new Set(packs.map((pack) => pack.id));
  const candidates = packs.flatMap((pack) => pack.candidates);
  const sources = options.store.listSources().filter((source) => {
    const candidate = sourceCandidate(source);
    return packIds.has(String(candidate.sourcePackId ?? source.metadata?.sourcePack?.packId ?? ""));
  });
  const queueRecords = sourcePackValidationQueue(options).list().filter((record) => record.packIds.some((packId) => packIds.has(packId)));
  const activeRows = sourcePackActiveSourceStore(options).list().filter((row) => packIds.has(row.packId));
  const frontierTasks = options.frontier.snapshot().map((item: any) => item.task ?? item).filter((task: any) => packIds.has(String(task.planning?.sourcePack?.packId ?? "")));
  const persistedQueueReceipts = sourcePackCollectionReceiptStore(options).list().filter((receipt) => packIds.has(receipt.packId) && receipt.status !== "blocked");
  const queuedTaskIds = new Set([
    ...frontierTasks.map((task: any) => String(task.id)),
    ...persistedQueueReceipts.map((receipt) => receipt.taskId)
  ]);
  const lastRun = sourcePackWorkerRunStore(options).list().filter((run) => packIds.has(run.sourcePackId)).at(-1);
  const parserSourceFamilyCounts = SOURCE_GROWTH_FAMILIES.reduce<Record<SourceGrowthFamily, Record<string, number>>>((acc, family) => {
    acc[family] = {};
    return acc;
  }, {} as Record<SourceGrowthFamily, Record<string, number>>);
  for (const candidate of candidates) {
    const parserStatus = candidate.parserStatus ?? "not_scheduled";
    parserSourceFamilyCounts[candidate.declaredFamily][parserStatus] = (parserSourceFamilyCounts[candidate.declaredFamily][parserStatus] ?? 0) + 1;
  }

  return {
    totalCandidates: candidates.length,
    accepted: candidates.filter((candidate) => !["rejected", "duplicate", "suppressed", "disabled", "failed"].includes(candidate.status)).length,
    rejected: candidates.filter((candidate) => candidate.status === "rejected" || candidate.status === "failed").length,
    queued: queueRecords.filter((record) => record.status === "queued" || record.status === "validating").length + queuedTaskIds.size,
    duplicateOrUpserted: candidates.filter((candidate) => candidate.status === "duplicate").length + Number(lastRun?.sourceRecordSummary?.upsertedCount ?? 0),
    metadataOnly: candidates.filter((candidate) => candidate.policyBoundary?.metadataOnly === true).length,
    restrictedBlocked: candidates.filter((candidate) => (
      (candidate.declaredFamily === "darkweb_onion" || candidate.declaredFamily === "darkweb_metadata")
      && (
        candidate.policyBoundary?.metadataOnly !== true
        || ["approval_required", "failed", "rejected", "disabled"].includes(candidate.status)
        || Boolean(candidate.failure)
      )
    )).length,
    lastRunId: lastRun?.id,
    lastRunTime: lastRun?.completedAt,
    lastRunStatus: lastRun?.status,
    parserSourceFamilyCounts,
    sourceFamilyCounts: sourceFamilyCoverage({ sources, registry: packs[0] }),
    activeSourceRows: activeRows.length,
    queuedCollectionTasks: queuedTaskIds.size,
    safeOutput: sourcePackSafeOutput()
  };
}

function sourcePackListQuery(body: DwmSourceRequestBody): DwmSourcePackListQuery {
  return {
    family: body.family,
    decision: body.decision,
    activationState: body.activationState,
    parserStatus: body.parserStatus,
    lastFailure: body.lastFailure,
    requestId: body.requestId,
    label: body.sourcePackLabel,
    createdFrom: body.createdFrom,
    createdTo: body.createdTo,
    cursor: body.cursor,
    limit: body.limit
  };
}

function sourcePackStatusItem(source: SourceRecord) {
  const candidate = sourceCandidate(source);
  const family = sourceGrowthFamilyForSource(source);
  return {
    id: candidate.id,
    sourcePackId: candidate.sourcePackId,
    sourcePackLabel: candidate.sourcePackLabel,
    sourceId: source.id,
    family: candidate.family,
    sourceGrowthFamily: family,
    refLabel: candidate.refLabel ?? source.metadata?.sourceRefLabel,
    parserExpectation: candidate.parserExpectation ?? source.metadata?.parserExpectation ?? parserExpectationForFamily(family),
    target: candidate.target,
    status: candidate.status,
    health: sourceHealthStatus(source),
    parser: sourceParserStatus(source),
    sourceHealth: sourceControlRoomHealth(source),
    evidenceReadiness: sourceEvidenceReadiness(source),
    lifecycle: sourceLifecycle(source),
    policyBoundary: candidate.policyBoundary,
    collectionTrigger: candidate.collectionTrigger ?? skippedCollectionTrigger(source, "not_queued"),
    alertRebuild: candidate.alertRebuild ?? skippedAlertRebuild(source, "captures_required_before_alert_rebuild"),
    lastCollectionOutcome: candidate.lastCollectionOutcome,
    operationalNextStep: nextSourceAction(source)
  };
}

function sourcePackRegistryStatus(pack: SourcePackRegistry, options: ApiServerOptions) {
  const sources = sourcesForPack(pack.id, options);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const workerState = sourcePackWorkerStateForPacks([pack], options);
  const candidates = pack.candidates.map((candidate) => {
    const source = candidate.sourceId ? sourceById.get(candidate.sourceId) : undefined;
    if (source) {
      return {
        ...sourcePackStatusItem(source),
        index: candidate.index,
        intakeStatus: candidate.intakeStatus,
        declaredFamily: candidate.declaredFamily,
        decision: candidate.decision,
        decidedBy: candidate.decidedBy,
        decidedAt: candidate.decidedAt,
        reason: candidate.reason,
        targetRef: candidate.targetRef
      };
    }
    return {
      id: candidate.id,
      sourcePackId: pack.id,
      sourcePackLabel: pack.label,
      sourceId: candidate.sourceId,
      index: candidate.index,
      family: candidate.family,
      declaredFamily: candidate.declaredFamily,
      sourceGrowthFamily: candidate.declaredFamily,
      type: candidate.type,
      refLabel: candidate.refLabel,
      parserExpectation: candidate.parserExpectation,
      targetRef: candidate.targetRef,
      status: candidate.status,
      intakeStatus: candidate.intakeStatus,
      decision: candidate.decision,
      decidedBy: candidate.decidedBy,
      decidedAt: candidate.decidedAt,
      reason: candidate.reason,
      duplicateOf: candidate.duplicateOf,
      failure: candidate.failure,
      retryHint: candidate.retryHint,
      health: {
        status: candidate.status === "duplicate" ? "duplicate_skipped" : candidate.status === "rejected" ? "blocked" : candidate.healthStatus ?? "not_tested",
        lastError: candidate.failure?.code,
        lastCollectionOutcome: undefined
      },
      parser: {
        status: "not_scheduled",
        profile: parserProfileForFamily(candidate.declaredFamily),
        expectation: candidate.parserExpectation,
        warnings: candidate.failure?.message ? [String(candidate.failure.message)] : []
      },
      sourceHealth: registryOnlySourceHealth(candidate),
      evidenceReadiness: { canProduceAlertGradeEvidence: false, reason: candidate.status === "duplicate" ? "duplicate source candidate was not activated" : "candidate failed intake validation" },
      lifecycle: {
        status: candidate.status,
        activationState: candidate.decision ?? candidate.status,
        parserStatus: "not_scheduled",
        healthStatus: candidate.status === "duplicate" ? "duplicate_skipped" : "blocked",
        persisted: true,
        registryOnly: true
      },
      policyBoundary: candidate.policyBoundary,
      validationResult: candidate.validationResult,
      collectionTrigger: {
        id: stableId("dwm_collection_trigger", `${candidate.id}:registry_only`),
        type: "frontier_collection",
        queued: false,
        unsafeJobQueued: false,
        reason: candidate.status === "duplicate" ? "duplicate_skipped" : "intake_rejected",
        candidateId: candidate.id,
        policyBoundary: candidate.policyBoundary,
        parserStatus: "not_scheduled"
      },
      alertRebuild: {
        id: stableId("dwm_alert_rebuild_trigger", `${candidate.id}:registry_only`),
        candidateId: candidate.id,
        queued: false,
        skipped: true,
        reason: "no_capture_for_registry_only_candidate"
      },
      operationalNextStep: candidate.status === "duplicate"
        ? "Use the existing source referenced by duplicateOf; no collection is queued for this row."
        : "Fix the candidate target or policy boundary, then resubmit it in a new pack."
    };
  });
  return {
    id: pack.id,
    label: pack.label,
    tenantId: pack.tenantId,
    scope: pack.scope,
    requestedBy: pack.requestedBy,
    requestedAt: pack.requestedAt,
    updatedAt: pack.updatedAt,
    requestId: pack.requestId,
    candidates,
    candidateIds: candidates.map((candidate) => candidate.id),
    sourceIds: candidates.map((candidate) => candidate.sourceId).filter(Boolean),
    packStatus: sourcePackRollup({ sourcePackId: pack.id, sourcePackLabel: pack.label, sources, registry: pack }),
    familyCoverage: sourceFamilyCoverage({ sources, registry: pack }),
    sourceGrowthCounters: sourcePackGrowthCounters([pack], options),
    workerReadiness: workerState.readiness,
    lastWorkerRun: workerState.lastRun,
    audit: pack.audit,
    safeOutput: pack.safeOutput
  };
}

function findSourcePackRegistry(body: DwmSourceRequestBody, options: ApiServerOptions): SourcePackRegistry | undefined {
  const registry = sourcePackStore(options);
  const sourcePackId = String(body.sourcePackId ?? "").trim();
  if (sourcePackId) return registry.get(sourcePackId);
  const label = String(body.sourcePackLabel ?? "").trim();
  if (label) return registry.list({ label, limit: 1 }).items[0];
  return undefined;
}

function lookupSourcePackReviewSources(body: DwmSourceRequestBody, options: ApiServerOptions): SourceRecord[] {
  const sourcePackId = String(body.sourcePackId ?? findSourcePackRegistry(body, options)?.id ?? "").trim();
  const sourceIds = new Set([body.sourceId, ...(body.sourceIds ?? [])].filter(Boolean).map(String));
  const candidateIds = new Set([body.candidateId, ...(body.candidateIds ?? [])].filter(Boolean).map(String));
  return options.store.listSources().filter((source) => {
    const candidate = sourceCandidate(source);
    return (sourcePackId && candidate.sourcePackId === sourcePackId)
      || sourceIds.has(source.id)
      || candidateIds.has(candidate.id);
  });
}

function sourcesForPack(sourcePackId: string, options: ApiServerOptions): SourceRecord[] {
  return options.store.listSources().filter((source) => sourceCandidate(source).sourcePackId === sourcePackId);
}

function sourcePackRollup(input: {
  sourcePackId?: string;
  sourcePackLabel?: string;
  sources: SourceRecord[];
  registry?: SourcePackRegistry;
  rejected?: Array<Record<string, unknown>>;
  duplicates?: Array<Record<string, unknown>>;
}) {
  const candidates = input.sources.map((source) => ({ source, candidate: sourceCandidate(source) }));
  const currentSourceIds = new Set(input.sources.map((source) => source.id));
  const registryOnly = (input.registry?.candidates ?? []).filter((item) => !item.sourceId || !currentSourceIds.has(item.sourceId));
  const registryRejectedCount = registryOnly.filter((item) => item.status === "rejected").length;
  const registryDuplicateCount = registryOnly.filter((item) => item.status === "duplicate").length;
  const queuedJobIds = candidates
    .map(({ candidate }) => candidate.collectionTrigger?.jobId ?? candidate.collectionTrigger?.taskId)
    .filter(Boolean);
  const lastCaptureOutcomes = candidates
    .map(({ candidate }) => candidate.lastCollectionOutcome)
    .filter(Boolean);
  const retryBackoff = candidates
    .filter(({ candidate }) => candidate.lastCollectionOutcome?.retryAfter)
    .map(({ candidate, source }) => ({
      candidateId: candidate.id,
      sourceId: source.id,
      retryAfter: candidate.lastCollectionOutcome.retryAfter,
      backoffSeconds: candidate.lastCollectionOutcome.backoffSeconds,
      errorCode: candidate.lastCollectionOutcome.errorCode
    }));
  const alertRebuild = candidates
    .map(({ candidate }) => candidate.alertRebuild)
    .filter(Boolean);
  const byStatus = [
    ...candidates.map(({ candidate }) => String(candidate.status ?? "unknown")),
    ...registryOnly.map((candidate) => candidate.status)
  ].reduce<Record<string, number>>((acc, status) => {
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const byFamily = [
    ...candidates.map(({ candidate }) => String(candidate.family ?? "unknown")),
    ...registryOnly.map((candidate) => candidate.family)
  ].reduce<Record<string, number>>((acc, family) => {
    acc[family] = (acc[family] ?? 0) + 1;
    return acc;
  }, {});
  const policyBoundaries = [
    ...candidates.map(({ candidate }) => ({
      candidateId: candidate.id,
      family: candidate.family,
      policyBoundary: candidate.policyBoundary
    })),
    ...registryOnly.map((candidate) => ({
      candidateId: candidate.id,
      family: candidate.family,
      policyBoundary: candidate.policyBoundary
    }))
  ];
  return {
    sourcePackId: input.sourcePackId,
    sourcePackLabel: input.sourcePackLabel,
    totalCandidateCount: input.registry?.candidates.length ?? candidates.length + (input.rejected?.length ?? 0) + (input.duplicates?.length ?? 0),
    persistedCandidateCount: candidates.length,
    registryOnlyCandidateCount: registryOnly.length,
    acceptedCount: candidates.filter(({ source }) => !["rejected", "suppressed"].includes(String(source.status))).length,
    activeCount: candidates.filter(({ source }) => source.status === "active").length,
    approvalRequiredCount: candidates.filter(({ candidate }) => candidate.status === "approval_required").length,
    rejectedCount: candidates.filter(({ source }) => source.status === "rejected").length + registryRejectedCount + (input.registry ? 0 : input.rejected?.length ?? 0),
    duplicateCount: registryDuplicateCount + (input.registry ? 0 : input.duplicates?.length ?? 0),
    suppressedCount: candidates.filter(({ source }) => source.status === "suppressed").length,
    queuedJobIds,
    queuedForCollectionCount: queuedJobIds.length,
    capturesObservedCount: candidates.filter(({ candidate }) => candidate.lastCollectionOutcome?.status === "capture_observed").length,
    alertRebuild: {
      completedCount: alertRebuild.filter((item) => item.status === "completed").length,
      failedCount: alertRebuild.filter((item) => item.status === "failed").length,
      skippedCount: alertRebuild.filter((item) => item.skipped === true || item.status === "skipped").length,
      items: alertRebuild
    },
    lastCaptureOutcomes,
    retryBackoff,
    failureReasons: [
      ...registryOnly.map((item) => ({ candidateId: item.id, code: item.failure?.code, message: item.failure?.message, retryHint: item.retryHint })),
      ...candidates
        .filter(({ candidate }) => candidate.lastCollectionOutcome?.status === "failed")
        .map(({ candidate }) => ({
          candidateId: candidate.id,
          code: candidate.lastCollectionOutcome.errorCode,
          message: candidate.lastCollectionOutcome.reason,
          retryHint: candidate.lastCollectionOutcome.retryAfter ? `retry after ${candidate.lastCollectionOutcome.retryAfter}` : undefined
        }))
    ].filter((item) => item.code || item.message),
    byStatus,
    byFamily,
    familyCoverage: sourceFamilyCoverage(input),
    policyBoundaries,
    safeOutput: {
      rawUnsafeRowsStored: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function createTelegramSourceFromTarget(target: string, body: DwmSourceRequestBody, options: ApiServerOptions):
  | { kind: "created"; source: SourceRecord }
  | { kind: "duplicate"; duplicateOf: string }
  | { kind: "error"; code: string; message: string } {
  if (/t\.me\/(?:\+|joinchat|c\/)|telegram\.me\/(?:\+|joinchat|c\/)|^tg:\/\/join/i.test(target)) {
    return { kind: "error", code: "telegram_policy_blocked", message: "Private invite, joinchat, and private-channel Telegram URLs are blocked." };
  }
  const channel = parseTelegramTarget(target).channel;
  if (!channel) return { kind: "error", code: "invalid_target", message: "A public t.me channel URL or @handle is required." };

  const source = telegramSourceFromRequest({ target, channel, body });
  const duplicate = options.store.listSources().find((existing) => sourceDedupeKey(existing) === sourceDedupeKey(source));
  if (duplicate) return { kind: "duplicate", duplicateOf: String(duplicate.id) };
  const policy = evaluateTelegramPublicCompliance(source);
  const compliance = validateTelegramPublicSourceCompliance(source);
  if (!policy.allowed) return { kind: "error", code: "telegram_policy_blocked", message: policy.reason };
  if (!compliance.allowed) return { kind: "error", code: "telegram_compliance_blocked", message: compliance.reason ?? "Telegram public source compliance check failed." };

  const saved = options.store.saveSource(source);
  return { kind: "created", source: saved };
}

function createPublicUrlSourceFromTarget(target: string, body: DwmSourceRequestBody, options: ApiServerOptions, family: SourceGrowthFamily):
  | { kind: "created"; source: SourceRecord }
  | { kind: "duplicate"; duplicateOf: string }
  | { kind: "error"; code: string; message: string } {
  if (!/^https?:\/\//i.test(target)) return { kind: "error", code: "invalid_target", message: "A public http(s) TI/blog/advisory URL is required." };
  if (/(?:credential|password|dump|leak|payload|download)=/i.test(target)) return { kind: "error", code: "public_url_policy_blocked", message: "Public URL source cannot request payload, credential, dump, or download paths." };
  const source = publicUrlSourceFromRequest({ target, body, family });
  const duplicate = options.store.listSources().find((existing) => sourceDedupeKey(existing) === sourceDedupeKey(source));
  if (duplicate) return { kind: "duplicate", duplicateOf: String(duplicate.id) };
  const saved = options.store.saveSource(source);
  return { kind: "created", source: saved };
}

function publicUrlSourceFromRequest(input: { target: string; body: DwmSourceRequestBody; family: SourceGrowthFamily }): SourceRecord {
  const generatedAt = nowIso();
  const normalizedUrl = input.target.trim();
  const family = input.family === "telegram" || input.family === "darkweb_onion" || input.family === "darkweb_metadata" ? "public_advisory" : input.family;
  return {
    id: stableId("src_dwm_public_url", normalizedUrl),
    name: `DWM Public TI ${new URL(normalizedUrl).hostname}`,
    type: family,
    url: normalizedUrl,
    accessMethod: "public_http_metadata",
    status: input.body.activate === false ? "candidate" : "active",
    risk: input.body.priority === "critical" ? "medium" : "low",
    trustScore: input.body.priority === "critical" ? 0.68 : 0.58,
    crawlFrequencySeconds: input.body.priority === "critical" ? 1800 : 3600,
    legalNotes: "Public web metadata collection only. No credentialed crawling, form submission, downloads, or bypass.",
    language: "en",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    metadata: {
      tenantId: input.body.tenantId,
      dwmSourceRequest: true,
      canaryPortfolio: true,
      sourceGrowthFamily: family,
      sourceFamily: family,
      scope: input.body.scope,
      collectionBoundary: publicWebMetadataBoundary(),
      sourceCandidate: initialSourceCandidate({
        source: { id: stableId("src_dwm_public_url", normalizedUrl), type: family, url: normalizedUrl, tenantId: input.body.tenantId },
        generatedAt,
        target: input.target,
        requestedBy: input.body.requestedBy ?? input.body.approvedBy ?? "api",
        scope: input.body.scope,
        policyBoundary: publicWebMetadataBoundary(),
        validationResult: { allowed: true, reason: "public TI/blog source URL passed metadata-only validation", checkedAt: generatedAt },
        parserStatus: `${family}_parser_ready`,
        healthStatus: "not_tested",
        status: input.body.activate === false ? "queued" : "active",
        activationDecision: input.body.activate === false ? "pending_operator_review" : "auto_activated_public_metadata"
      })
    }
  } as SourceRecord;
}

function telegramSourceFromRequest(input: { target: string; channel: string; body: DwmSourceRequestBody }): SourceRecord {
  const generatedAt = nowIso();
  const normalizedUrl = `https://t.me/${input.channel}`;
  return {
    id: stableId("src_dwm_tg", normalizedUrl),
    name: `DWM Telegram ${input.channel}`,
    type: "telegram_public",
    url: normalizedUrl,
    accessMethod: "public_http",
    status: input.body.activate === false ? "candidate" : "active",
    risk: input.body.priority === "critical" ? "high" : "medium",
    trustScore: input.body.priority === "critical" ? 0.72 : 0.62,
    crawlFrequencySeconds: input.body.priority === "critical" ? 300 : 900,
    legalNotes: "Public Telegram preview collection only. No private invite access, auto-join, session credentials, or media downloads.",
    language: "en",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    metadata: {
      tenantId: input.body.tenantId,
      dwmSourceRequest: true,
      canaryPortfolio: true,
      sourceFamily: "telegram_public",
      scope: input.body.scope,
      maxItemsPerFetch: 40,
      mediaPolicy: "metadata_only_no_download",
      collectionBoundary: publicTelegramBoundary(),
      sourceCandidate: initialSourceCandidate({
        source: { id: stableId("src_dwm_tg", normalizedUrl), type: "telegram_public", url: normalizedUrl, tenantId: input.body.tenantId },
        generatedAt,
        target: input.target,
        requestedBy: input.body.requestedBy ?? input.body.approvedBy ?? "api",
        scope: input.body.scope,
        policyBoundary: publicTelegramBoundary(),
        validationResult: { allowed: true, reason: "public Telegram target passed policy validation", checkedAt: generatedAt },
        parserStatus: "telegram_public_parser_ready",
        healthStatus: "not_tested",
        status: input.body.activate === false ? "queued" : "active",
        activationDecision: input.body.activate === false ? "pending_operator_review" : "auto_activated_public_preview"
      })
    }
  } as SourceRecord;
}

function handleSourceLifecycleAction(body: DwmSourceRequestBody, options: ApiServerOptions): Response {
  if (body.action === "pack_list") return json(sourcePackListResponse(body, options), 200);
  if (body.action === "pack_status") return json(sourcePackStatusResponse(body, options), 200);
  if (body.action === "pack_customer_config") return json(sourcePackCustomerConfigResponse(body, options), 200);
  if (body.action === "actor_enrichment_readiness") return json(sourceActorEnrichmentReadinessResponse(body, options), 200);
  if (body.action === "pack_review") return handleSourcePackReview(body, options);
  if (body.action === "pack_worker_run") return handleSourcePackWorkerRun(body, options);

  const sourceId = String(body.sourceId ?? "").trim();
  const candidateId = String(body.candidateId ?? "").trim();
  const source = lookupLifecycleSource({ sourceId, candidateId }, options);
  if (!source) return json({ error: { code: "source_not_found", message: "A persisted sourceId or candidateId is required for lifecycle actions." } }, 404);

  if (body.action === "inspect") return json(lifecycleResponse(source, "inspect"), 200);
  if (body.action === "validate") {
    const validated = saveLifecyclePatch(source, options, {
      action: "validate",
      actor: body.decidedBy ?? body.approvedBy ?? "operator",
      reason: body.reason ?? "operator requested source policy validation",
      status: source.status,
      healthStatus: source.metadata?.healthStatus ?? "not_tested",
      parserStatus: parserStatusForSource(source),
      activationState: activationStateForSource(source)
    });
    return json(lifecycleResponse(validated, "validate"), 200);
  }
  if (body.action === "test") {
    const tested = saveLifecyclePatch(source, options, {
      action: "test",
      actor: body.decidedBy ?? body.approvedBy ?? "operator",
      reason: body.reason ?? "operator source validation",
      status: source.status,
      healthStatus: testHealthStatus(source),
      parserStatus: parserStatusForSource(source),
      activationState: activationStateForSource(source)
    });
    return json(lifecycleResponse(tested, "test"), 200);
  }
  if (body.action === "retry") {
    const retried = saveLifecyclePatch(source, options, {
      action: "retry",
      actor: body.decidedBy ?? body.approvedBy ?? "operator",
      reason: body.reason ?? "operator requested validation retry",
      status: source.status,
      healthStatus: "retry_scheduled",
      parserStatus: parserStatusForSource(source),
      activationState: activationStateForSource(source)
    });
    return json(lifecycleResponse(retried, "retry"), 200);
  }
  if (body.action === "reject") {
    const rejected = saveLifecyclePatch(source, options, {
      action: "reject",
      actor: body.decidedBy ?? body.approvedBy ?? "operator",
      reason: body.reason ?? "operator rejected source candidate",
      status: "rejected",
      healthStatus: "blocked",
      parserStatus: "not_scheduled",
      activationState: "rejected"
    });
    return json(lifecycleResponse(rejected, "reject"), 200);
  }
  if (body.action === "suppress") {
    const suppressed = saveLifecyclePatch(source, options, {
      action: "suppress",
      actor: body.decidedBy ?? body.approvedBy ?? "operator",
      reason: body.reason ?? "operator suppressed source candidate",
      status: "suppressed",
      healthStatus: "suppressed",
      parserStatus: "not_scheduled",
      activationState: "suppressed"
    });
    return json(lifecycleResponse(suppressed, "suppress"), 200);
  }
  if (body.action === "record_capture") return json(recordCollectionCapture(source, body, options), 200);
  if (body.action === "collection_failed") return json(recordCollectionFailure(source, body, options), 200);
  if (body.action === "activate" || body.action === "promote") {
    if (isRestrictedMetadataSource(source) && body.approveMetadataOnly !== true) {
      return json({
        error: {
          code: "metadata_only_approval_required",
          message: "Restricted metadata activation requires approveMetadataOnly=true and an approving operator."
        },
        source,
        candidate: sourceCandidate(source),
        lifecycle: sourceLifecycle(source),
        policy: sourcePolicyPosture(source),
        parser: sourceParserStatus(source),
        collectionTrigger: skippedCollectionTrigger(source, "metadata_only_approval_required"),
        alertRebuild: skippedAlertRebuild(source, "metadata_only_approval_required")
      }, 409);
    }
    const activated = saveLifecyclePatch(source, options, {
      action: body.action,
      actor: body.approvedBy ?? body.decidedBy ?? "operator",
      reason: body.reason ?? (isRestrictedMetadataSource(source) ? "metadata-only monitoring approved" : "bounded public source canary approved"),
      status: isRestrictedMetadataSource(source) ? "active" : "active",
      healthStatus: "ready",
      parserStatus: parserStatusForSource(source),
      activationState: isRestrictedMetadataSource(source) ? "metadata_only_approved" : "active_canary",
      approveMetadataOnly: isRestrictedMetadataSource(source)
    });
    const operations = persistOperationalNextStep(activated, options, body.action);
    return json(lifecycleResponse(operations.source, "activate", operations), 200);
  }
  return json({ error: { code: "unsupported_action", message: `Unsupported source lifecycle action: ${body.action}` } }, 400);
}

function createRestrictedMetadataSourceFromTarget(target: string, body: DwmSourceRequestBody, options: ApiServerOptions):
  | { kind: "created"; source: SourceRecord }
  | { kind: "duplicate"; duplicateOf: string }
  | { kind: "error"; code: string; message: string } {
  if (!target) return { kind: "error", code: "invalid_target", message: "A metadata source target is required." };
  if (/credential|password|session|payload|download|dump/i.test(target)) {
    return { kind: "error", code: "restricted_policy_blocked", message: "Restricted metadata targets cannot request credentials, payloads, dumps, or download paths." };
  }
  const source = restrictedMetadataSourceFromRequest({ target, body });
  const duplicate = options.store.listSources().find((existing) => sourceDedupeKey(existing) === sourceDedupeKey(source));
  if (duplicate) return { kind: "duplicate", duplicateOf: String(duplicate.id) };
  return { kind: "created", source: options.store.saveSource(source) };
}

function restrictedMetadataSourceFromRequest(input: { target: string; body: DwmSourceRequestBody }): SourceRecord {
  const generatedAt = nowIso();
  const network = input.target.includes(".i2p") ? "i2p" : input.target.startsWith("freenet:") ? "freenet" : "tor";
  const normalizedUrl = input.target.match(/^https?:\/\/|^metadata:\/\/|^freenet:/i)
    ? input.target
    : `metadata://darkweb/${input.target.replace(/[^a-z0-9_.-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "candidate"}`;
  return {
    id: stableId("src_dwm_restricted", normalizedUrl),
    name: `Restricted metadata ${network} candidate`,
    type: `${network}_metadata`,
    url: normalizedUrl,
    accessMethod: "restricted_metadata",
    status: "candidate",
    risk: "restricted",
    trustScore: input.body.priority === "critical" ? 0.66 : 0.54,
    crawlFrequencySeconds: 1800,
    legalNotes: "Restricted source metadata only. No credential bypass, actor interaction, transactions, payload paths, or stolen-data downloads.",
    language: "multi",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    tenantId: input.body.tenantId,
    governance: {
      approvalRequired: true,
      approvalState: "pending",
      metadataOnly: true,
      policyVersion: "dwm-metadata-only:v1",
      riskJustification: "Candidate is limited to metadata-only review. Collection cannot activate until an operator approves the metadata-only boundary."
    },
    metadata: {
      tenantId: input.body.tenantId,
      dwmSourceRequest: true,
      sourceFamily: "darkweb_metadata",
      scope: input.body.scope,
      network,
      metadataOnly: true,
      reviewState: "pending_metadata_only_approval",
      parserStatus: "metadata_parser_pending",
      healthStatus: "awaiting_policy_review",
      collectionBoundary: restrictedMetadataBoundary(),
      sourceCandidate: initialSourceCandidate({
        source: { id: stableId("src_dwm_restricted", normalizedUrl), type: `${network}_metadata`, url: normalizedUrl, tenantId: input.body.tenantId },
        generatedAt,
        target: input.target,
        requestedBy: input.body.requestedBy ?? input.body.approvedBy ?? "api",
        scope: input.body.scope,
        validationResult: {
          allowed: false,
          reason: "metadata-only approval ticket required before collection activation",
          checkedAt: generatedAt,
          policyGated: true
        },
        parserStatus: "metadata_parser_pending",
        healthStatus: "awaiting_policy_review",
        status: "approval_required",
        activationDecision: "pending_metadata_only_approval",
        approvalTicket: {
          id: stableId("dwm_metadata_approval_ticket", `${normalizedUrl}:${generatedAt}`),
          status: "open",
          requiredApproval: "metadata_only",
          unsafeScrapingAllowed: false
        }
      })
    }
  } as SourceRecord;
}

function lifecycleResponse(source: SourceRecord, action: string, operations?: OperationalNextStep) {
  const candidate = sourceCandidate(source);
  return {
    action,
    source,
    candidate,
    lifecycle: sourceLifecycle(source),
    policy: sourcePolicyPosture(source),
    health: sourceHealthStatus(source),
    parser: sourceParserStatus(source),
    collectionTrigger: operations?.collectionTrigger ?? source.metadata?.sourceCandidate?.collectionTrigger ?? skippedCollectionTrigger(source, action === "promote" || action === "activate" ? "not_queued" : "not_a_promotion_action"),
    alertRebuild: operations?.alertRebuild ?? source.metadata?.sourceCandidate?.alertRebuild ?? skippedAlertRebuild(source, "captures_required_before_alert_rebuild"),
    nextAction: nextSourceAction(source)
  };
}

function saveLifecyclePatch(source: SourceRecord, options: ApiServerOptions, input: {
  action: string;
  actor: string;
  reason: string;
  status: string;
  healthStatus: string;
  parserStatus: string;
  activationState: string;
  approveMetadataOnly?: boolean;
}): SourceRecord {
  const at = nowIso();
  const restricted = isRestrictedMetadataSource(source);
  const previousEvents = Array.isArray(source.metadata?.sourceRequestAudit) ? source.metadata.sourceRequestAudit : [];
  const policy = sourcePolicyPosture(source);
  const previousCandidate = sourceCandidate(source);
  const validationResult = {
    allowed: policy.allowed,
    reason: policy.reason,
    checkedAt: at,
    policyGated: restricted && input.action !== "activate" && input.action !== "promote"
  };
  const next: SourceRecord = {
    ...source,
    status: input.status,
    accessMethod: restricted && (input.action === "activate" || input.action === "promote") ? "approved_proxy" : source.accessMethod,
    approvedAt: input.action === "activate" || input.action === "promote" ? at : source.approvedAt,
    approvedBy: input.action === "activate" || input.action === "promote" ? input.actor : source.approvedBy,
    updatedAt: at,
    governance: restricted ? {
      ...(source.governance ?? {}),
      approvalRequired: true,
      approvalState: input.action === "activate" || input.action === "promote" ? "approved" : input.action === "reject" ? "rejected" : source.governance?.approvalState ?? "pending",
      metadataOnly: true,
      approvedAt: input.action === "activate" || input.action === "promote" ? at : source.governance?.approvedAt,
      approvedBy: input.action === "activate" || input.action === "promote" ? input.actor : source.governance?.approvedBy,
      policyVersion: source.governance?.policyVersion ?? "dwm-metadata-only:v1",
      riskJustification: source.governance?.riskJustification ?? "Metadata-only boundary required for restricted dark-web monitoring."
    } : source.governance,
    metadata: {
      ...(source.metadata ?? {}),
      reviewState: input.activationState,
      parserStatus: input.parserStatus,
      healthStatus: input.healthStatus,
      lastLifecycleAction: input.action,
      lastLifecycleReason: input.reason,
      lastLifecycleActor: input.actor,
      lastLifecycleAt: at,
      lastTestedAt: input.action === "test" ? at : source.metadata?.lastTestedAt,
      validationResult,
      metadataOnlyApproved: restricted && (input.action === "activate" || input.action === "promote") ? true : source.metadata?.metadataOnlyApproved,
      collectionBoundary: restricted ? restrictedMetadataBoundary() : source.metadata?.collectionBoundary,
      sourceCandidate: {
        ...previousCandidate,
        status: candidateStatusForAction(input.action, input.activationState),
        validationResult,
        parserStatus: input.parserStatus,
        healthStatus: input.healthStatus,
        lastTestedAt: input.action === "test" ? at : previousCandidate.lastTestedAt,
        activationDecision: activationDecisionForAction(input.action, input.activationState),
        decidedBy: ["activate", "promote", "reject", "suppress"].includes(input.action) ? input.actor : previousCandidate.decidedBy,
        decidedAt: ["activate", "promote", "reject", "suppress"].includes(input.action) ? at : previousCandidate.decidedAt,
        approvalTicket: restricted && (input.action === "activate" || input.action === "promote")
          ? { ...(previousCandidate.approvalTicket ?? {}), status: "approved", approvedAt: at, approvedBy: input.actor, unsafeScrapingAllowed: false }
          : previousCandidate.approvalTicket
      },
      sourceRequestAudit: [
        ...previousEvents,
        { at, action: input.action, actor: input.actor, reason: input.reason, fromStatus: source.status, toStatus: input.status }
      ]
    }
  } as SourceRecord;
  return options.store.saveSource(next);
}

function sourceLifecycle(source: SourceRecord) {
  return {
    status: source.status,
    activationState: activationStateForSource(source),
    parserStatus: parserStatusForSource(source),
    healthStatus: source.metadata?.healthStatus ?? "untested",
    collectionStatus: source.metadata?.collectionStatus ?? sourceCandidate(source).collectionStatus,
    lastCollectionOutcome: source.metadata?.lastCollectionOutcome ?? sourceCandidate(source).lastCollectionOutcome,
    validationResult: source.metadata?.validationResult ?? sourceCandidate(source).validationResult,
    lastTestedAt: source.metadata?.lastTestedAt ?? sourceCandidate(source).lastTestedAt,
    activationDecision: sourceCandidate(source).activationDecision,
    audit: Array.isArray(source.metadata?.sourceRequestAudit) ? source.metadata.sourceRequestAudit : [],
    persisted: true
  };
}

function sourcePolicyPosture(source: SourceRecord) {
  const restricted = isRestrictedMetadataSource(source);
  const policy = restricted ? evaluateMetadataOnlySource(source) : evaluateTelegramPublicCompliance(source);
  const policyReason = "reason" in policy ? policy.reason : "source policy passed";
  const compliance = restricted ? { allowed: policy.allowed, reason: policyReason } : validateTelegramPublicSourceCompliance(source);
  const complianceReason = "reason" in compliance ? compliance.reason : "source compliance passed";
  return {
    family: restricted ? "darkweb_metadata" : source.type,
    allowed: policy.allowed && compliance.allowed,
    collectionMode: restricted ? "metadata_only" : "public_preview",
    reason: !policy.allowed ? policyReason : compliance.allowed ? policyReason : complianceReason,
    boundary: restricted ? restrictedMetadataBoundary() : source.metadata?.collectionBoundary,
    approval: source.governance ?? {
      approvalRequired: source.status !== "active",
      approvalState: source.status === "active" ? "approved_public" : "queued"
    }
  };
}

function nextSourceAction(source: SourceRecord): string {
  if (source.status === "rejected") return "Candidate is rejected. Retry only if the target or policy boundary changes.";
  if (source.status === "suppressed") return "Candidate is suppressed. Unsuppress is not automated yet; request a new candidate if the scope changes.";
  if (isRestrictedMetadataSource(source)) {
    return source.governance?.approvalState === "approved"
      ? "Run metadata-only health checks and schedule restricted metadata collection through approved proxy boundaries."
      : "Approve metadata-only monitoring or reject the candidate with a policy reason.";
  }
  if (source.status === "active") return "Source is active for bounded public preview polling on the next canary cycle.";
  return "Test parser and source health, then activate bounded public polling or reject the candidate.";
}

function lookupLifecycleSource(input: { sourceId: string; candidateId: string }, options: ApiServerOptions): SourceRecord | undefined {
  if (input.sourceId) return options.store.getSource?.(input.sourceId) ?? options.store.listSources().find((item) => item.id === input.sourceId);
  if (input.candidateId) return options.store.listSources().find((item) => item.metadata?.sourceCandidate?.id === input.candidateId);
  return undefined;
}

function isRestrictedMetadataSource(source: SourceRecord): boolean {
  return String(source.type ?? "").endsWith("_metadata") || source.metadata?.sourceFamily === "darkweb_metadata";
}

function parserStatusForSource(source: SourceRecord): string {
  if (isRestrictedMetadataSource(source)) return "metadata_parser_ready";
  if (source.type === "telegram_public") return "telegram_public_parser_ready";
  return "parser_ready";
}

function testHealthStatus(source: SourceRecord): string {
  if (source.status === "rejected") return "blocked";
  return isRestrictedMetadataSource(source) ? "metadata_boundary_pass" : "public_preview_pass";
}

function activationStateForSource(source: SourceRecord): string {
  if (source.status === "rejected") return "rejected";
  if (source.status === "suppressed") return "suppressed";
  if (isRestrictedMetadataSource(source)) {
    return source.governance?.approvalState === "approved" ? "metadata_only_approved" : "pending_metadata_only_approval";
  }
  if (source.status === "active") return "active_canary";
  return "candidate_review";
}

function sourceCandidate(source: SourceRecord) {
  const existing = source.metadata?.sourceCandidate ?? {};
  const generatedAt = source.createdAt ?? nowIso();
  return {
    id: existing.id ?? stableId("dwm_source_candidate", `${source.tenantId ?? source.metadata?.tenantId ?? "global"}:${source.type}:${source.url}`),
    sourcePackId: existing.sourcePackId ?? source.metadata?.sourcePackId,
    sourcePackLabel: existing.sourcePackLabel ?? source.metadata?.sourcePackLabel,
    sourcePackIndex: existing.sourcePackIndex ?? source.metadata?.sourcePackIndex,
    sourcePackRequestedAt: existing.sourcePackRequestedAt ?? source.metadata?.sourcePackRequestedAt,
    sourceGrowthFamily: existing.sourceGrowthFamily ?? source.metadata?.sourceGrowthFamily,
    refLabel: existing.refLabel ?? source.metadata?.sourceRefLabel,
    parserExpectation: existing.parserExpectation ?? source.metadata?.parserExpectation,
    sourceId: source.id,
    family: sourceFamily(source),
    target: existing.target ?? source.url,
    tenantId: source.tenantId ?? source.metadata?.tenantId,
    scope: existing.scope ?? source.metadata?.scope,
    requestedBy: existing.requestedBy ?? source.approvedBy ?? "unknown",
    requestedAt: existing.requestedAt ?? generatedAt,
    policyBoundary: existing.policyBoundary ?? (isRestrictedMetadataSource(source) ? restrictedMetadataBoundary() : source.metadata?.collectionBoundary),
    status: existing.status ?? candidateStatusForSource(source),
    validationResult: existing.validationResult ?? {
      allowed: sourcePolicyPosture(source).allowed,
      reason: sourcePolicyPosture(source).reason,
      checkedAt: source.updatedAt ?? generatedAt
    },
    parserStatus: existing.parserStatus ?? parserStatusForSource(source),
    healthStatus: existing.healthStatus ?? source.metadata?.healthStatus ?? "not_tested",
    collectionStatus: existing.collectionStatus ?? source.metadata?.collectionStatus,
    lastCollectionOutcome: existing.lastCollectionOutcome ?? source.metadata?.lastCollectionOutcome,
    lastCaptureId: existing.lastCaptureId ?? source.metadata?.lastCaptureId,
    lastCaptureAt: existing.lastCaptureAt ?? source.metadata?.lastCaptureAt,
    lastTestedAt: existing.lastTestedAt ?? source.metadata?.lastTestedAt,
    activationDecision: existing.activationDecision ?? activationStateForSource(source),
    decidedBy: existing.decidedBy,
    decidedAt: existing.decidedAt,
    approvalTicket: existing.approvalTicket,
    collectionTrigger: existing.collectionTrigger ?? source.metadata?.collectionTrigger,
    alertRebuild: existing.alertRebuild ?? source.metadata?.alertRebuild
  };
}

function initialSourceCandidate(input: {
  source: Pick<SourceRecord, "id" | "type" | "url" | "tenantId">;
  generatedAt: string;
  target: string;
  requestedBy: string;
  scope?: string;
  validationResult: Record<string, unknown>;
  parserStatus: string;
  healthStatus: string;
  status: string;
  activationDecision: string;
  approvalTicket?: Record<string, unknown>;
  policyBoundary?: Record<string, unknown>;
}) {
  return {
    id: stableId("dwm_source_candidate", `${input.source.tenantId ?? "global"}:${input.source.type}:${input.source.url}`),
    sourceId: input.source.id,
    family: sourceFamily(input.source),
    target: input.target,
    tenantId: input.source.tenantId,
    scope: input.scope,
    requestedBy: input.requestedBy,
    requestedAt: input.generatedAt,
    policyBoundary: input.policyBoundary ?? (String(input.source.type).endsWith("_metadata") ? restrictedMetadataBoundary() : undefined),
    status: input.status,
    validationResult: input.validationResult,
    parserStatus: input.parserStatus,
    healthStatus: input.healthStatus,
    activationDecision: input.activationDecision,
    approvalTicket: input.approvalTicket
  };
}

function sourceHealthStatus(source: SourceRecord) {
  return {
    status: source.health?.status ?? source.metadata?.healthStatus ?? sourceCandidate(source).healthStatus ?? "not_tested",
    checkedAt: source.health?.checkedAt ?? source.metadata?.lastLifecycleAt,
    consecutiveFailures: source.health?.consecutiveFailures ?? 0,
    errorRate: source.health?.errorRate ?? 0,
    lastError: source.health?.lastError ?? source.metadata?.lastCollectionOutcome?.errorCode,
    lastCollectionOutcome: source.metadata?.lastCollectionOutcome ?? sourceCandidate(source).lastCollectionOutcome
  };
}

function sourceParserStatus(source: SourceRecord) {
  return {
    status: source.metadata?.parserStatus ?? sourceCandidate(source).parserStatus ?? parserStatusForSource(source),
    profile: isRestrictedMetadataSource(source) ? "restricted_metadata" : source.type === "telegram_public" ? "public_channel_handoff" : "default",
    expectation: sourceCandidate(source).parserExpectation ?? source.metadata?.parserExpectation ?? parserExpectationForFamily(sourceGrowthFamilyForSource(source)),
    lastValidatedAt: source.metadata?.validationResult?.checkedAt ?? sourceCandidate(source).validationResult?.checkedAt,
    lastCollectionOutcome: source.metadata?.lastCollectionOutcome ?? sourceCandidate(source).lastCollectionOutcome,
    retryAfter: source.metadata?.lastCollectionOutcome?.retryAfter,
    warnings: source.metadata?.lastCollectionOutcome?.status === "failed" ? [source.metadata.lastCollectionOutcome.reason ?? "collection failed"] : []
  };
}

function sourceControlRoomHealth(source: SourceRecord) {
  const candidate = sourceCandidate(source);
  const lastCollectionOutcome = candidate.lastCollectionOutcome ?? source.metadata?.lastCollectionOutcome;
  const collectionTrigger = candidate.collectionTrigger ?? source.metadata?.collectionTrigger;
  const lastFailure = lastCollectionOutcome?.status === "failed" ? {
    at: lastCollectionOutcome.at,
    errorCode: lastCollectionOutcome.errorCode,
    reason: lastCollectionOutcome.reason,
    retryCount: lastCollectionOutcome.retryCount
  } : undefined;
  return {
    parserStatus: sourceParserStatus(source),
    lastCaptureAt: candidate.lastCaptureAt ?? source.metadata?.lastCaptureAt,
    lastFailure,
    retryWindow: lastCollectionOutcome?.retryAfter ? {
      retryAfter: lastCollectionOutcome.retryAfter,
      backoffSeconds: lastCollectionOutcome.backoffSeconds,
      retryCount: lastCollectionOutcome.retryCount
    } : undefined,
    queuedActivationJobs: collectionTrigger?.queued === true ? [collectionTrigger.jobId ?? collectionTrigger.taskId].filter(Boolean) : [],
    queuedTestJobs: source.status === "candidate" && source.metadata?.healthStatus === "retry_scheduled"
      ? [stableId("dwm_source_test_job", `${candidate.id}:retry`)]
      : [],
    canProduceAlertGradeEvidence: sourceEvidenceReadiness(source).canProduceAlertGradeEvidence
  };
}

function registryOnlySourceHealth(candidate: SourcePackRegistryCandidate) {
  return {
    parserStatus: {
      status: "not_scheduled",
      profile: parserProfileForFamily(candidate.declaredFamily),
      expectation: candidate.parserExpectation,
      warnings: candidate.failure?.message ? [String(candidate.failure.message)] : []
    },
    lastCaptureAt: undefined,
    lastFailure: candidate.failure ? { errorCode: candidate.failure.code, reason: candidate.failure.message } : undefined,
    retryWindow: undefined,
    queuedActivationJobs: [],
    queuedTestJobs: [],
    canProduceAlertGradeEvidence: false
  };
}

function sourceEvidenceReadiness(source: SourceRecord) {
  const candidate = sourceCandidate(source);
  if (source.status === "rejected" || source.status === "suppressed") {
    return { canProduceAlertGradeEvidence: false, reason: `source_${source.status}` };
  }
  if (candidate.lastCaptureId || source.metadata?.lastCaptureId) {
    return {
      canProduceAlertGradeEvidence: true,
      reason: "capture_observed",
      lastCaptureId: candidate.lastCaptureId ?? source.metadata?.lastCaptureId,
      lastCaptureAt: candidate.lastCaptureAt ?? source.metadata?.lastCaptureAt,
      alertRebuild: candidate.alertRebuild ?? source.metadata?.alertRebuild
    };
  }
  if (source.status === "active" && source.type === "telegram_public") {
    return { canProduceAlertGradeEvidence: true, reason: "active_public_source_waiting_for_capture" };
  }
  if (isRestrictedMetadataSource(source) && source.governance?.approvalState === "approved") {
    return { canProduceAlertGradeEvidence: true, reason: "metadata_only_capture_contract_available" };
  }
  return { canProduceAlertGradeEvidence: false, reason: "activation_or_capture_required" };
}

type OperationalNextStep = {
  source: SourceRecord;
  collectionTrigger: Record<string, unknown>;
  alertRebuild: Record<string, unknown>;
};

function persistOperationalNextStep(source: SourceRecord, options: ApiServerOptions, action: string): OperationalNextStep {
  const collectionTrigger: Record<string, any> = buildCollectionTrigger(source, options, action);
  const alertRebuild = buildAlertRebuildTrigger(source, collectionTrigger);
  const candidate = sourceCandidate(source);
  const next = options.store.saveSource({
    ...source,
    metadata: {
      ...(source.metadata ?? {}),
      sourceCandidate: {
        ...candidate,
        collectionTrigger,
        alertRebuild,
        collectionStatus: collectionTrigger.queued === true ? "queued" : "not_queued",
        lastCollectionOutcome: collectionTrigger.queued === true
          ? { status: "queued", at: collectionTrigger.queuedAt, taskId: collectionTrigger.taskId, triggerId: collectionTrigger.id }
          : { status: "skipped", at: nowIso(), reason: collectionTrigger.reason }
      },
      collectionTrigger,
      alertRebuild,
      collectionStatus: collectionTrigger.queued === true ? "queued" : "not_queued",
      lastCollectionOutcome: collectionTrigger.queued === true
        ? { status: "queued", at: collectionTrigger.queuedAt, taskId: collectionTrigger.taskId, triggerId: collectionTrigger.id }
        : { status: "skipped", at: nowIso(), reason: collectionTrigger.reason }
    }
  } as SourceRecord);
  return { source: next, collectionTrigger, alertRebuild };
}

function buildCollectionTrigger(source: SourceRecord, options: ApiServerOptions, action: string) {
  const candidate = sourceCandidate(source);
  const triggerId = stableId("dwm_collection_trigger", `${candidate.id}:${source.id}:${action}`);
  if (source.status !== "active") return skippedCollectionTrigger(source, "source_not_active", triggerId);
  if (isRestrictedMetadataSource(source)) {
    return {
      ...skippedCollectionTrigger(source, "restricted_metadata_requires_metadata_worker_contract", triggerId),
      metadataOnly: true,
      unsafeJobQueued: false,
      approvalTicketId: candidate.approvalTicket?.id
    };
  }
  if (source.type !== "telegram_public") return skippedCollectionTrigger(source, "unsupported_source_family", triggerId);

  const discoveredAt = nowIso();
  const scope = String(candidate.scope ?? source.metadata?.scope ?? "public threat intelligence").trim();
  const intelRequestId = stableId("dwm_source_candidate_collection", `${candidate.id}:${source.id}`);
  const score = options.frontier.add({
    source,
    tenantId: source.tenantId ?? candidate.tenantId,
    intelRequestId,
    url: source.url,
    discoveredAt,
    anchorText: `${scope} public Telegram CTI collection candidate`,
    surroundingText: `${scope} ransomware malware exploit credential broker threat intelligence public channel`,
    parentTitle: source.name,
    parentText: source.legalNotes,
    parentRelevance: 0.92,
    destinationTitle: source.name,
    destinationText: `${scope} public Telegram source approved for bounded preview collection`,
    destinationRelevance: 0.9,
    novelty: 0.8,
    freshness: 0.85,
    fairnessKey: `source-candidate:${candidate.id}`,
    budgetKey: "public_channel_window",
    planning: {
      budgetClass: "source_health_probe",
      sourceCandidateId: candidate.id,
      triggerId
    },
    maxBytes: 64_000
  });
  const task = options.frontier.snapshot().map((item: any) => item.task ?? item).find((item: any) => item.intelRequestId === intelRequestId && item.sourceId === source.id);
  return {
    id: triggerId,
    type: "frontier_collection",
    queued: score.decision === "enqueue",
    unsafeJobQueued: false,
    queue: "frontier",
    jobId: task?.id,
    taskId: task?.id,
    candidateId: candidate.id,
    sourceId: source.id,
    activeSourceId: source.id,
    scoreDecision: score.decision,
    scoreReason: score.reason,
    queuedAt: discoveredAt,
    policyBoundary: candidate.policyBoundary,
    parserStatus: parserStatusForSource(source)
  };
}

function recordCollectionCapture(source: SourceRecord, body: DwmSourceRequestBody, options: ApiServerOptions) {
  if (source.status === "rejected" || source.status === "suppressed") {
    const response = lifecycleResponse(source, "record_capture");
    return {
      ...response,
      collectionTrigger: skippedCollectionTrigger(source, `source_${source.status}`),
      alertRebuild: skippedAlertRebuild(source, `source_${source.status}`)
    };
  }
  if (source.status !== "active") {
    const response = lifecycleResponse(source, "record_capture");
    return {
      ...response,
      collectionTrigger: skippedCollectionTrigger(source, "source_not_active"),
      alertRebuild: skippedAlertRebuild(source, "source_not_active")
    };
  }
  const candidate = sourceCandidate(source);
  const collectionTrigger = source.metadata?.sourceCandidate?.collectionTrigger ?? skippedCollectionTrigger(source, "capture_without_prior_trigger");
  const taskId = body.collectionTaskId ?? String(collectionTrigger.taskId ?? collectionTrigger.jobId ?? stableId("task", `${source.id}:${nowIso()}`));
  const capturedAt = nowIso();
  const metadataOnly = isRestrictedMetadataSource(source);
  const text = safeCaptureText(source, body.captureText, candidate);
  const captureUrl = body.captureUrl ?? captureUrlForSource(source, capturedAt);
  const capture = options.store.saveCapture({
    id: stableId("dwm_capture", `${candidate.id}:${source.id}:${taskId}:${capturedAt}`),
    tenantId: source.tenantId ?? candidate.tenantId,
    sourceId: source.id,
    taskId,
    url: captureUrl,
    collectedAt: capturedAt,
    publishedAt: capturedAt,
    mediaType: "text/plain",
    storageKind: metadataOnly ? "metadata_only" : "inline_text",
    body: metadataOnly ? undefined : text,
    rawText: metadataOnly ? undefined : text,
    contentHash: hashContent(`${source.id}:${captureUrl}:${text}`),
    sensitive: metadataOnly,
    sensitivityFlags: metadataOnly ? ["restricted_protocol", "leak_metadata"] : ["public"],
    metadata: metadataOnly ? {
      adapter: "restricted_metadata",
      sourceCandidateId: candidate.id,
      collectionTriggerId: collectionTrigger.id,
      title: `${candidate.scope ?? "DWM"} metadata-only source observation`,
      description: "Metadata-only restricted source observation. Raw leak material was not fetched or stored.",
      safeEntityHints: { terms: [candidate.scope, source.tenantId].filter(Boolean) },
      leakSite: {
        actorName: "Unknown",
        victimName: candidate.scope ?? "watchlist candidate",
        postStatus: "metadata_observed",
        sourceTimestamp: capturedAt,
        confidence: 0.62,
        urlHash: hashContent(captureUrl)
      },
      provenance: captureProvenance(candidate, source, taskId, collectionTrigger.id)
    } : {
      adapter: "telegram_public",
      sourceCandidateId: candidate.id,
      collectionTriggerId: collectionTrigger.id,
      channel: parseTelegramTarget(source.url).channel,
      messageId: Number.parseInt(hashContent(captureUrl).slice(0, 6), 16),
      title: `${candidate.scope ?? "DWM"} public Telegram source observation`,
      description: text,
      provenance: captureProvenance(candidate, source, taskId, collectionTrigger.id)
    },
    provenance: {
      sourceId: source.id,
      captureId: stableId("dwm_capture", `${candidate.id}:${source.id}:${taskId}:${capturedAt}`),
      url: captureUrl,
      collectedAt: capturedAt,
      contentHash: hashContent(`${source.id}:${captureUrl}:${text}`),
      extractorVersion: metadataOnly ? "dwm-restricted-metadata-fixture:v1" : "dwm-telegram-fixture:v1",
      taskId,
      tenantId: source.tenantId ?? candidate.tenantId
    },
    retentionClass: metadataOnly ? "restricted_metadata" : "public_channel_preview"
  } as any);

  const alertRebuild = runAlertRebuildAdapter({ source, captureIds: [capture.id], options, generatedAt: capturedAt });
  const lastCollectionOutcome = {
    status: "capture_observed",
    at: capturedAt,
    taskId,
    captureId: capture.id,
    captureUrl,
    metadataOnly,
    alertRebuildId: alertRebuild.id
  };
  const next = options.store.saveSource({
    ...source,
    updatedAt: capturedAt,
    metadata: {
      ...(source.metadata ?? {}),
      healthStatus: "capture_observed",
      parserStatus: parserStatusForSource(source),
      collectionStatus: "capture_observed",
      lastCollectionOutcome,
      lastCaptureId: capture.id,
      lastCaptureAt: capturedAt,
      sourceCandidate: {
        ...candidate,
        healthStatus: "capture_observed",
        parserStatus: parserStatusForSource(source),
        collectionStatus: "capture_observed",
        lastCollectionOutcome,
        lastCaptureId: capture.id,
        lastCaptureAt: capturedAt,
        collectionTrigger,
        alertRebuild
      },
      alertRebuild
    }
  } as SourceRecord);
  return { ...lifecycleResponse(next, "record_capture", { source: next, collectionTrigger, alertRebuild }), capture };
}

function recordCollectionFailure(source: SourceRecord, body: DwmSourceRequestBody, options: ApiServerOptions) {
  const candidate = sourceCandidate(source);
  const at = nowIso();
  const previous = source.metadata?.lastCollectionOutcome ?? {};
  const retryCount = Number(previous.retryCount ?? 0) + 1;
  const backoffSeconds = Math.min(3600, 30 * 2 ** Math.min(retryCount - 1, 6));
  const lastCollectionOutcome = {
    status: "failed",
    at,
    taskId: body.collectionTaskId ?? source.metadata?.sourceCandidate?.collectionTrigger?.taskId,
    errorCode: body.errorCode ?? "collection_failed",
    reason: body.reason ?? "collection worker reported failure",
    retryCount,
    retryAfter: new Date(Date.parse(at) + backoffSeconds * 1000).toISOString(),
    backoffSeconds
  };
  const next = options.store.saveSource({
    ...source,
    updatedAt: at,
    metadata: {
      ...(source.metadata ?? {}),
      healthStatus: "collection_failed",
      parserStatus: "parser_retry_scheduled",
      collectionStatus: "failed",
      lastCollectionOutcome,
      sourceCandidate: {
        ...candidate,
        healthStatus: "collection_failed",
        parserStatus: "parser_retry_scheduled",
        collectionStatus: "failed",
        lastCollectionOutcome
      }
    }
  } as SourceRecord);
  return lifecycleResponse(next, "collection_failed");
}

function runAlertRebuildAdapter(input: { source: SourceRecord; captureIds: string[]; options: ApiServerOptions; generatedAt: string }) {
  const store = input.options.store as any;
  const source = input.source;
  const candidate = sourceCandidate(source);
  const watchlists = typeof store.listDwmWatchlists === "function"
    ? store.listDwmWatchlists().filter((watchlist: any) => watchlist.status !== "paused" && (!source.tenantId || watchlist.tenantId === source.tenantId))
    : [];
  const terms = watchlists.flatMap((watchlist: any) => Array.isArray(watchlist.terms) ? watchlist.terms : []);
  const id = stableId("dwm_alert_rebuild_trigger", `${candidate.id}:${input.captureIds.join(",")}:${input.generatedAt}`);
  if (!terms.length) {
    return {
      id,
      candidateId: candidate.id,
      sourceId: source.id,
      captureIds: input.captureIds,
      requested: true,
      queued: false,
      skipped: true,
      status: "skipped",
      reason: "missing_active_watchlist",
      contract: alertRebuildContract()
    };
  }
  try {
    const snapshot = buildDwmProductSnapshot({
      tenantId: source.tenantId ?? candidate.tenantId,
      watchlist: terms,
      sources: input.options.store.listSources(),
      captures: input.options.store.listCaptures(),
      generatedAt: input.generatedAt,
      includeDemoIfEmpty: false
    });
    const savedAlerts = snapshot.alerts.map((alert) => store.saveDwmAlert ? store.saveDwmAlert({
      ...alert,
      tenantId: source.tenantId ?? candidate.tenantId,
      watchlistIds: watchlists.map((watchlist: any) => watchlist.id),
      deliveryState: "pending_review",
      savedAt: input.generatedAt,
      updatedAt: input.generatedAt,
      workflowEvents: []
    }) : alert);
    return {
      id,
      candidateId: candidate.id,
      sourceId: source.id,
      captureIds: input.captureIds,
      requested: true,
      queued: false,
      skipped: false,
      status: "completed",
      rebuiltAt: input.generatedAt,
      alertCount: savedAlerts.length,
      alertIds: savedAlerts.map((alert: any) => alert.id),
      watchlistIds: watchlists.map((watchlist: any) => watchlist.id),
      contract: alertRebuildContract()
    };
  } catch (error) {
    return {
      id,
      candidateId: candidate.id,
      sourceId: source.id,
      captureIds: input.captureIds,
      requested: true,
      queued: false,
      skipped: false,
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      contract: alertRebuildContract()
    };
  }
}

function captureProvenance(candidate: Record<string, any>, source: SourceRecord, taskId: string, collectionTriggerId: unknown) {
  return {
    candidateId: candidate.id,
    sourceId: source.id,
    sourceType: source.type,
    taskId,
    collectionTriggerId,
    confidence: isRestrictedMetadataSource(source) ? 0.62 : 0.72,
    metadataOnly: isRestrictedMetadataSource(source),
    policyBoundary: candidate.policyBoundary
  };
}

function safeCaptureText(source: SourceRecord, value: string | undefined, candidate: Record<string, any>) {
  const scope = String(candidate.scope ?? source.tenantId ?? "customer watchlist").trim();
  if (value?.trim()) return value.trim();
  return `${scope} mentioned in bounded ${source.type} collection. APT29 ransomware malware credential exposure context for watchlist matching.`;
}

function captureUrlForSource(source: SourceRecord, at: string) {
  if (source.type === "telegram_public") return `${source.url}/${hashContent(at).slice(0, 12)}`;
  if (isRestrictedMetadataSource(source)) return `${source.url.replace(/\/$/, "")}#metadata-${hashContent(at).slice(0, 12)}`;
  return source.url;
}

function alertRebuildContract() {
  return {
    endpoint: "/v1/dwm/alerts/rebuild",
    requiredAfter: "capture_persisted",
    requiredFields: ["tenantId", "watchlistIds", "captureIds"],
    orgScope: "use existing DWM watchlist/org resolution lane"
  };
}

function buildAlertRebuildTrigger(source: SourceRecord, collectionTrigger: Record<string, unknown>) {
  const candidate = sourceCandidate(source);
  return {
    id: stableId("dwm_alert_rebuild_trigger", `${candidate.id}:${source.id}`),
    candidateId: candidate.id,
    sourceId: source.id,
    queued: false,
    skipped: true,
    reason: collectionTrigger.queued === true
      ? "collection_queued_alert_rebuild_waits_for_new_captures"
      : "collection_not_queued",
    contract: alertRebuildContract()
  };
}

function skippedCollectionTrigger(source: SourceRecord, reason: string, id?: string) {
  const candidate = sourceCandidate(source);
  return {
    id: id ?? stableId("dwm_collection_trigger", `${candidate.id}:${source.id}:${reason}`),
    type: "frontier_collection",
    queued: false,
    unsafeJobQueued: false,
    reason,
    candidateId: candidate.id,
    sourceId: source.id,
    activeSourceId: source.status === "active" ? source.id : undefined,
    policyBoundary: candidate.policyBoundary,
    parserStatus: parserStatusForSource(source)
  };
}

function skippedAlertRebuild(source: SourceRecord, reason: string) {
  const candidate = sourceCandidate(source);
  return {
    id: stableId("dwm_alert_rebuild_trigger", `${candidate.id}:${source.id}:${reason}`),
    candidateId: candidate.id,
    sourceId: source.id,
    queued: false,
    skipped: true,
    reason
  };
}

function candidateStatusForSource(source: SourceRecord): string {
  if (source.status === "active") return "active";
  if (source.status === "rejected") return "rejected";
  if (source.status === "suppressed") return "suppressed";
  if (isRestrictedMetadataSource(source)) return "approval_required";
  return "queued";
}

function candidateStatusForAction(action: string, activationState: string): string {
  if (action === "validate") return "validated";
  if (action === "test") return "tested";
  if (action === "activate" || action === "promote") return "active";
  if (action === "reject") return "rejected";
  if (action === "suppress") return "suppressed";
  if (action === "retry") return "retry_scheduled";
  return activationState;
}

function activationDecisionForAction(action: string, activationState: string): string {
  if (action === "validate") return "validated_pending_operator_decision";
  if (action === "test") return "test_passed_pending_operator_decision";
  if (action === "activate" || action === "promote") return activationState;
  if (action === "reject") return "rejected_by_operator";
  if (action === "suppress") return "suppressed_by_operator";
  if (action === "retry") return "retry_scheduled";
  return activationState;
}

function sourceFamily(source: Pick<SourceRecord, "type" | "url">): string {
  if (String(source.type).includes("telegram") || String(source.url).includes("t.me/")) return "telegram_public";
  if (String(source.type).endsWith("_metadata") || String(source.url).includes(".onion") || String(source.url).startsWith("metadata://darkweb/")) return "darkweb_metadata";
  return String(source.type ?? "unknown");
}

const SOURCE_GROWTH_FAMILIES: SourceGrowthFamily[] = ["telegram", "darkweb_onion", "darkweb_metadata", "actor_page", "public_advisory", "clear_web"];

function sourceGrowthFamilyFromCandidate(input: { target: string; type: string; family?: SourceGrowthFamily }): SourceGrowthFamily {
  if (input.family) return input.family;
  const target = input.target.toLowerCase();
  if (input.type === "telegram_channel" || target.includes("t.me/") || target.startsWith("@")) return "telegram";
  if (target.includes(".onion")) return "darkweb_onion";
  if (input.type === "restricted_metadata" || target.startsWith("metadata://darkweb/")) return "darkweb_metadata";
  if (/advisory|cisa|cert|vendor/i.test(input.target)) return "public_advisory";
  if (/actor|apt|threat/i.test(input.target)) return "actor_page";
  return "clear_web";
}

function sourceGrowthFamilyForSource(source: SourceRecord): SourceGrowthFamily {
  const existing = source.metadata?.sourceGrowthFamily;
  if (SOURCE_GROWTH_FAMILIES.includes(existing)) return existing;
  return sourceGrowthFamilyFromCandidate({ target: source.url, type: source.type });
}

function parserExpectationForFamily(family: SourceGrowthFamily): string {
  if (family === "telegram") return "telegram_public_metadata_and_text_fixture";
  if (family === "darkweb_onion") return "restricted_onion_metadata_fixture";
  if (family === "darkweb_metadata") return "restricted_metadata_fixture";
  if (family === "actor_page") return "actor_profile_page_metadata_fixture";
  if (family === "public_advisory") return "public_advisory_metadata_fixture";
  return "clear_web_metadata_fixture";
}

function parserProfileForFamily(family: SourceGrowthFamily): string {
  if (family === "telegram") return "public_channel_handoff";
  if (family === "darkweb_onion" || family === "darkweb_metadata") return "restricted_metadata";
  if (family === "actor_page") return "actor_page_metadata";
  if (family === "public_advisory") return "public_advisory";
  return "clear_web";
}

function sourceFamilyCoverage(input: { sources: SourceRecord[]; registry?: SourcePackRegistry }) {
  const byFamily = Object.fromEntries(SOURCE_GROWTH_FAMILIES.map((family) => [family, {
    total: 0,
    active: 0,
    tested: 0,
    failed: 0,
    pending: 0,
    blocked: 0,
    blockers: [] as Array<Record<string, unknown>>
  }])) as Record<SourceGrowthFamily, {
    total: number;
    active: number;
    tested: number;
    failed: number;
    pending: number;
    blocked: number;
    blockers: Array<Record<string, unknown>>;
  }>;
  const sourceIds = new Set(input.sources.map((source) => source.id));
  for (const source of input.sources) {
    const family = sourceGrowthFamilyForSource(source);
    const bucket = byFamily[family];
    const candidate = sourceCandidate(source);
    bucket.total += 1;
    if (source.status === "active") bucket.active += 1;
    if (candidate.lastTestedAt || ["tested", "active"].includes(String(candidate.status))) bucket.tested += 1;
    if (candidate.lastCollectionOutcome?.status === "failed" || source.metadata?.lastCollectionOutcome?.status === "failed") bucket.failed += 1;
    if (["candidate", "needs_review"].includes(String(source.status)) || ["queued", "approval_required", "retry_scheduled"].includes(String(candidate.status))) bucket.pending += 1;
    if (["rejected", "suppressed", "quarantined"].includes(String(source.status))) {
      bucket.blocked += 1;
      bucket.blockers.push({ candidateId: candidate.id, sourceId: source.id, status: source.status, reason: source.metadata?.lastLifecycleReason ?? candidate.lastCollectionOutcome?.reason });
    }
  }
  for (const candidate of input.registry?.candidates ?? []) {
    if (candidate.sourceId && sourceIds.has(candidate.sourceId)) continue;
    const bucket = byFamily[candidate.declaredFamily];
    bucket.total += 1;
    if (candidate.status === "rejected" || candidate.status === "duplicate" || candidate.status === "suppressed") {
      bucket.blocked += 1;
      bucket.blockers.push({
        candidateId: candidate.id,
        status: candidate.status,
        reason: candidate.reason ?? candidate.failure?.message,
        duplicateOf: candidate.duplicateOf
      });
    } else {
      bucket.pending += 1;
    }
  }
  return byFamily;
}

function publicTelegramBoundary() {
  return {
    publicOnly: true,
    noPrivateAccess: true,
    noAutoJoin: true,
    noCredentialCollection: true,
    noMediaDownload: true
  };
}

function publicWebMetadataBoundary() {
  return {
    publicOnly: true,
    metadataOnly: true,
    noCredentialCollection: true,
    noFormSubmission: true,
    noDownloads: true,
    noBypass: true
  };
}

function restrictedMetadataBoundary() {
  return {
    metadataOnly: true,
    noCredentialBypass: true,
    noDownloads: true,
    noActorInteraction: true,
    noTransactions: true,
    payloadPathsBlocked: true,
    rawLeakContentBlocked: true
  };
}
