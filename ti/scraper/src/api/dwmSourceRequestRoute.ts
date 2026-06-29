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
  type?: "telegram_channel" | "restricted_metadata";
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
  action?: "inspect" | "validate" | "test" | "activate" | "promote" | "reject" | "retry" | "suppress" | "record_capture" | "collection_failed" | "pack_status" | "pack_review" | "pack_list" | "pack_worker_run" | "pack_customer_config";
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
  type?: "telegram_channel" | "restricted_metadata";
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
      "sourceInventory.sourcePackWorker.parserSourceFamilyCounts",
      "sourceInventory.sourcePackWorker.sourceFamilyCounts",
      "sourceInventory.sourcePackWorker.rejectedCandidates[].targetRef.rawStored",
      "sourceInventory.sourcePackWorker.redactedSourcePackIds[].safeRef",
      "sourceInventory.sourcePackWorker.safeOutput.liveNetworkScrapeStarted",
      "sourcePacks.workerReadiness.activeSourceRows",
      "sourcePacks.sourceHealth.typedBlockers",
      "sourcePacks.sourceOperationsReadiness.summary.candidateCount",
      "sourcePacks.sourceCustomerConfig.summary.configurableCount",
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
      unretryable: candidateRows.filter((row) => isUnretryableSourcePackCandidate(row.candidate)).length
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
        lastCollectionReceipt: receipt ? redactedWorkerReceipt(receipt) : undefined
      },
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
  return {
    action: "pack_customer_config",
    sourcePackId: registry?.id ?? body.sourcePackId,
    sourcePackLabel: registry?.label,
    ...buildDwmSourcePackCustomerConfigReadiness(packs, options, {
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
    })
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
