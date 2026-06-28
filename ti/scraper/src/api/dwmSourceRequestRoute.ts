import { parseTelegramTarget, validateTelegramPublicSourceCompliance } from "../adapters/telegramPublic.ts";
import { evaluateTelegramPublicCompliance } from "../policy/telegramCollectionPolicy.ts";
import { evaluateMetadataOnlySource } from "../policy/metadataCollectionPolicy.ts";
import { applyDwmSeedCatalog, sourceDedupeKey } from "../product/dwmSourceInventory.ts";
import { nowIso, stableId } from "../utils.ts";
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
  seedPackIds?: string[];
  priority?: "critical" | "high" | "medium";
  action?: "inspect" | "test" | "activate" | "reject" | "retry";
  sourceId?: string;
  reason?: string;
  decidedBy?: string;
};

export async function createDwmSourceRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<DwmSourceRequestBody>(request);
  if (body.action) return handleSourceLifecycleAction(body, options);

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
      collectionBoundary: {
        publicOnly: true,
        noPrivateAccess: true,
        noAutoJoin: true,
        noCredentialCollection: true,
        noMediaDownload: true
      }
    }
  } as SourceRecord;
}

function handleSourceLifecycleAction(body: DwmSourceRequestBody, options: ApiServerOptions): Response {
  const sourceId = String(body.sourceId ?? "").trim();
  const source = sourceId ? options.store.getSource?.(sourceId) ?? options.store.listSources().find((item) => item.id === sourceId) : undefined;
  if (!source) return json({ error: { code: "source_not_found", message: "A persisted sourceId is required for lifecycle actions." } }, 404);

  if (body.action === "inspect") return json(lifecycleResponse(source, "inspect"), 200);
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
  if (body.action === "activate") {
    if (isRestrictedMetadataSource(source) && body.approveMetadataOnly !== true) {
      return json({
        error: {
          code: "metadata_only_approval_required",
          message: "Restricted metadata activation requires approveMetadataOnly=true and an approving operator."
        },
        source,
        lifecycle: sourceLifecycle(source),
        policy: sourcePolicyPosture(source)
      }, 409);
    }
    const activated = saveLifecyclePatch(source, options, {
      action: "activate",
      actor: body.approvedBy ?? body.decidedBy ?? "operator",
      reason: body.reason ?? (isRestrictedMetadataSource(source) ? "metadata-only monitoring approved" : "bounded public source canary approved"),
      status: isRestrictedMetadataSource(source) ? "active" : "active",
      healthStatus: "ready",
      parserStatus: parserStatusForSource(source),
      activationState: isRestrictedMetadataSource(source) ? "metadata_only_approved" : "active_canary",
      approveMetadataOnly: isRestrictedMetadataSource(source)
    });
    return json(lifecycleResponse(activated, "activate"), 200);
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
      collectionBoundary: restrictedMetadataBoundary()
    }
  } as SourceRecord;
}

function lifecycleResponse(source: SourceRecord, action: string) {
  return {
    action,
    source,
    lifecycle: sourceLifecycle(source),
    policy: sourcePolicyPosture(source),
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
  const next: SourceRecord = {
    ...source,
    status: input.status,
    accessMethod: restricted && input.action === "activate" ? "approved_proxy" : source.accessMethod,
    approvedAt: input.action === "activate" ? at : source.approvedAt,
    approvedBy: input.action === "activate" ? input.actor : source.approvedBy,
    updatedAt: at,
    governance: restricted ? {
      ...(source.governance ?? {}),
      approvalRequired: true,
      approvalState: input.action === "activate" ? "approved" : input.action === "reject" ? "rejected" : source.governance?.approvalState ?? "pending",
      metadataOnly: true,
      approvedAt: input.action === "activate" ? at : source.governance?.approvedAt,
      approvedBy: input.action === "activate" ? input.actor : source.governance?.approvedBy,
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
      metadataOnlyApproved: restricted && input.action === "activate" ? true : source.metadata?.metadataOnlyApproved,
      collectionBoundary: restricted ? restrictedMetadataBoundary() : source.metadata?.collectionBoundary,
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
  if (isRestrictedMetadataSource(source)) {
    return source.governance?.approvalState === "approved"
      ? "Run metadata-only health checks and schedule restricted metadata collection through approved proxy boundaries."
      : "Approve metadata-only monitoring or reject the candidate with a policy reason.";
  }
  if (source.status === "active") return "Source is active for bounded public preview polling on the next canary cycle.";
  return "Test parser and source health, then activate bounded public polling or reject the candidate.";
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
  if (isRestrictedMetadataSource(source)) {
    return source.governance?.approvalState === "approved" ? "metadata_only_approved" : "pending_metadata_only_approval";
  }
  if (source.status === "active") return "active_canary";
  return "candidate_review";
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
