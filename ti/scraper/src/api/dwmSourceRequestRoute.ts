import { parseTelegramTarget, validateTelegramPublicSourceCompliance } from "../adapters/telegramPublic.ts";
import { evaluateTelegramPublicCompliance } from "../policy/telegramCollectionPolicy.ts";
import { evaluateMetadataOnlySource } from "../policy/metadataCollectionPolicy.ts";
import { buildDwmProductSnapshot } from "../product/dwmProduct.ts";
import { applyDwmSeedCatalog, sourceDedupeKey } from "../product/dwmSourceInventory.ts";
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
  seedPackIds?: string[];
  priority?: "critical" | "high" | "medium";
  action?: "inspect" | "validate" | "test" | "activate" | "promote" | "reject" | "retry" | "suppress" | "record_capture" | "collection_failed" | "pack_status" | "pack_review";
  packAction?: "approve" | "promote" | "reject" | "retry" | "suppress";
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
  scope?: string;
  requestedBy?: string;
  priority?: "critical" | "high" | "medium";
  suppress?: boolean;
  reason?: string;
};

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

function createSourceCandidatePack(body: DwmSourceRequestBody, options: ApiServerOptions) {
  const generatedAt = nowIso();
  const limit = Math.max(1, Math.min(body.limit ?? 100, 100));
  const sourcePackId = body.sourcePackId ?? stableId("dwm_source_pack", `${body.tenantId ?? "global"}:${body.sourcePackLabel ?? "ad-hoc"}:${generatedAt}`);
  const sourcePackLabel = body.sourcePackLabel ?? "Ad hoc source candidate pack";
  const accepted: Array<Record<string, unknown>> = [];
  const rejected: Array<Record<string, unknown>> = [];
  const duplicates: Array<Record<string, unknown>> = [];

  for (const [index, input] of (body.candidates ?? []).slice(0, limit).entries()) {
    const target = String(input.target ?? "").trim();
    const type = input.type ?? body.type ?? "telegram_channel";
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
      rejected.push({
        sourcePackId,
        sourcePackLabel,
        index,
        target,
        type,
        code: result.code,
        message: result.message,
        retryHint: type === "telegram_channel" ? "submit a public @handle or https://t.me/<channel> URL" : "submit a metadata-only target without payload, credential, or download intent"
      });
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
      continue;
    }

    const packedSource = saveSourcePackMetadata(result.source, options, {
      sourcePackId,
      sourcePackLabel,
      packIndex: index,
      packRequestedAt: generatedAt
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
  }

  const packStatus = sourcePackRollup({
    sourcePackId,
    sourcePackLabel,
    sources: sourcesForPack(sourcePackId, options),
    rejected,
    duplicates
  });

  return {
    request: {
      id: stableId("dwm_candidate_pack_request", `${sourcePackId}:${generatedAt}`),
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
    safeOutput: {
      rawUnsafeRowsStored: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
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
}): SourceRecord {
  const candidate = sourceCandidate(source);
  return options.store.saveSource({
    ...source,
    metadata: {
      ...(source.metadata ?? {}),
      sourcePackId: input.sourcePackId,
      sourcePackLabel: input.sourcePackLabel,
      sourcePackIndex: input.packIndex,
      sourcePackRequestedAt: input.packRequestedAt,
      sourceCandidate: {
        ...candidate,
        sourcePackId: input.sourcePackId,
        sourcePackLabel: input.sourcePackLabel,
        sourcePackIndex: input.packIndex,
        sourcePackRequestedAt: input.packRequestedAt
      }
    }
  } as SourceRecord);
}

function handleSourcePackReview(body: DwmSourceRequestBody, options: ApiServerOptions): Response {
  const packAction = body.packAction ?? "approve";
  const sources = lookupSourcePackReviewSources(body, options);
  if (!sources.length) {
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
  const results = sources.map((source) => applySourcePackReviewAction(source, body, options, { packAction, actor, reviewedAt }));
  const sourcePackId = String(body.sourcePackId ?? sourceCandidate(sources[0]).sourcePackId ?? "").trim();
  const sourcePackLabel = String(sourceCandidate(sources[0]).sourcePackLabel ?? (sourcePackId || "source pack"));
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
      sources: sourcePackId ? sourcesForPack(sourcePackId, options) : results.map((item) => item.source).filter(Boolean) as SourceRecord[]
    }),
    safeOutput: {
      rawUnsafeRowsStored: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  }, 200);
}

function applySourcePackReviewAction(source: SourceRecord, body: DwmSourceRequestBody, options: ApiServerOptions, input: {
  packAction: NonNullable<DwmSourceRequestBody["packAction"]>;
  actor: string;
  reviewedAt: string;
}) {
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
        }
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
    return sourcePackReviewResult(operations.source, "approved", {
      reviewedAt: input.reviewedAt,
      actor: input.actor,
      reason: body.reason,
      collectionTrigger: operations.collectionTrigger,
      alertRebuild: operations.alertRebuild
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
    return sourcePackReviewResult(rejected, "rejected", { reviewedAt: input.reviewedAt, actor: input.actor, reason: body.reason });
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
    return sourcePackReviewResult(suppressed, "suppressed", { reviewedAt: input.reviewedAt, actor: input.actor, reason: body.reason });
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
  return sourcePackReviewResult(failed.source, "retry_scheduled", {
    reviewedAt: input.reviewedAt,
    actor: input.actor,
    reason: body.reason,
    collectionTrigger: failed.collectionTrigger,
    alertRebuild: failed.alertRebuild
  });
}

function sourcePackReviewResult(source: SourceRecord | undefined, reviewStatus: string, input: {
  reviewedAt: string;
  actor: string;
  reason?: string;
  collectionTrigger?: Record<string, unknown>;
  alertRebuild?: Record<string, unknown>;
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
    nextAction: nextSourceAction(source),
    error: input.error
  };
}

function sourcePackStatusResponse(body: DwmSourceRequestBody, options: ApiServerOptions) {
  const sources = lookupSourcePackReviewSources(body, options);
  const sourcePackId = String(body.sourcePackId ?? (sources[0] ? sourceCandidate(sources[0]).sourcePackId : "") ?? "").trim();
  const sourcePackLabel = String((sources[0] ? sourceCandidate(sources[0]).sourcePackLabel : undefined) ?? (sourcePackId || "source pack"));
  return {
    action: "pack_status",
    sourcePackId: sourcePackId || undefined,
    sourcePackLabel,
    candidates: sources.map((source) => sourcePackStatusItem(source)),
    packStatus: sourcePackRollup({ sourcePackId: sourcePackId || undefined, sourcePackLabel, sources }),
    safeOutput: {
      rawUnsafeRowsStored: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    }
  };
}

function sourcePackStatusItem(source: SourceRecord) {
  const candidate = sourceCandidate(source);
  return {
    id: candidate.id,
    sourcePackId: candidate.sourcePackId,
    sourcePackLabel: candidate.sourcePackLabel,
    sourceId: source.id,
    family: candidate.family,
    target: candidate.target,
    status: candidate.status,
    health: sourceHealthStatus(source),
    parser: sourceParserStatus(source),
    lifecycle: sourceLifecycle(source),
    policyBoundary: candidate.policyBoundary,
    collectionTrigger: candidate.collectionTrigger ?? skippedCollectionTrigger(source, "not_queued"),
    alertRebuild: candidate.alertRebuild ?? skippedAlertRebuild(source, "captures_required_before_alert_rebuild"),
    lastCollectionOutcome: candidate.lastCollectionOutcome,
    operationalNextStep: nextSourceAction(source)
  };
}

function lookupSourcePackReviewSources(body: DwmSourceRequestBody, options: ApiServerOptions): SourceRecord[] {
  const sourcePackId = String(body.sourcePackId ?? "").trim();
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
  rejected?: Array<Record<string, unknown>>;
  duplicates?: Array<Record<string, unknown>>;
}) {
  const candidates = input.sources.map((source) => ({ source, candidate: sourceCandidate(source) }));
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
  const byStatus = candidates.reduce<Record<string, number>>((acc, { candidate }) => {
    const status = String(candidate.status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const byFamily = candidates.reduce<Record<string, number>>((acc, { candidate }) => {
    const family = String(candidate.family ?? "unknown");
    acc[family] = (acc[family] ?? 0) + 1;
    return acc;
  }, {});
  const policyBoundaries = candidates.map(({ candidate }) => ({
    candidateId: candidate.id,
    family: candidate.family,
    policyBoundary: candidate.policyBoundary
  }));
  return {
    sourcePackId: input.sourcePackId,
    sourcePackLabel: input.sourcePackLabel,
    persistedCandidateCount: candidates.length,
    acceptedCount: candidates.filter(({ source }) => !["rejected", "suppressed"].includes(String(source.status))).length,
    activeCount: candidates.filter(({ source }) => source.status === "active").length,
    approvalRequiredCount: candidates.filter(({ candidate }) => candidate.status === "approval_required").length,
    rejectedCount: candidates.filter(({ source }) => source.status === "rejected").length + (input.rejected?.length ?? 0),
    duplicateCount: input.duplicates?.length ?? 0,
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
    byStatus,
    byFamily,
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
  if (body.action === "pack_status") return json(sourcePackStatusResponse(body, options), 200);
  if (body.action === "pack_review") return handleSourcePackReview(body, options);

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
    lastValidatedAt: source.metadata?.validationResult?.checkedAt ?? sourceCandidate(source).validationResult?.checkedAt,
    lastCollectionOutcome: source.metadata?.lastCollectionOutcome ?? sourceCandidate(source).lastCollectionOutcome,
    retryAfter: source.metadata?.lastCollectionOutcome?.retryAfter,
    warnings: source.metadata?.lastCollectionOutcome?.status === "failed" ? [source.metadata.lastCollectionOutcome.reason ?? "collection failed"] : []
  };
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
