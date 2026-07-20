import { nowIso, stableId } from "../utils.ts";
import { sanitizeDwmApiPayload, sanitizeDwmCustomerText } from "../product/dwmCustomerDisplay.ts";
import { toSafeCaptureDto } from "./captureDtos.ts";
import { booleanQuery, error, json, numberQuery, readJson } from "./http.ts";
import { toSafeSourceDto } from "./sourceRoutes.ts";
import { buildSourceOperationsSnapshot } from "./sourceOperations.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";
import { buildEvaluationMetrics } from "../pipeline/evaluationMetrics.ts";
import { authenticateRequest } from "./requestAuthentication.ts";

const listRoutes = {
  "/v1/intel/sources": ["sources", "listSources"],
  "/v1/intel/captures": ["captures", "listCaptures"],
  "/v1/intel/entities": ["entities", "listExtractedEntities"],
  "/v1/intel/indicators": ["indicators", "listIndicators"],
  "/v1/intel/incidents": ["incidents", "listIncidents"],
  "/v1/intel/actor-profiles": ["actorProfiles", "listActorProfiles"],
  "/v1/intel/actor-aliases": ["actorAliases", "listActorAliases"],
  "/v1/intel/evidence-links": ["evidenceLinks", "listEvidenceLinks"],
  "/v1/intel/validation-records": ["validationRecords", "listValidationRecords"],
  "/v1/intel/evaluation-labels": ["evaluationLabels", "listEvaluationLabels"],
  "/v1/intel/collection-runs": ["collectionRuns", "listRuns"],
  "/v1/intel/source-health": ["sourceHealth", "listSourceHealthObservations"],
  "/v1/intel/timeliness": ["timeliness", "listTimelinessRecords"],
  "/v1/intel/claims": ["claims", "listIntelligenceClaims"],
  "/v1/intel/claim-evidence": ["claimEvidence", "listClaimEvidence"],
  "/v1/intel/claim-reviews": ["claimReviews", "listClaimReviews"],
  "/v1/intel/alerts": ["alerts", "listDwmAlerts"]
} as const;

export async function handleStructuredIntelRequest(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname === "/v1/intel/source-operations" && request.method === "GET") {
    const scope = resolveTenantScope(request, url);
    return scope.error ?? json(buildSourceOperationsSnapshot(options.store, { tenantId: scope.tenantId }));
  }
  if (url.pathname === "/v1/intel/evaluation" && request.method === "GET") {
    const scope = resolveTenantScope(request, url);
    if (scope.error) return scope.error;
    const datasetSplit = url.searchParams.get("datasetSplit") ?? undefined;
    if (datasetSplit && !["train", "validation", "test", "unassigned"].includes(datasetSplit)) return error("invalid_dataset_split", "Unsupported evaluation dataset split", 400);
    return json(buildEvaluationMetrics(options.store, { tenantId: scope.tenantId, datasetSplit }));
  }
  if (url.pathname === "/v1/intel/governance-actions" && request.method === "POST") return applyGovernanceAction(request, options);
  if (url.pathname === "/v1/intel/validation-records" && request.method === "POST") return createValidationRecord(request, options);
  if (url.pathname === "/v1/intel/evaluation-labels" && request.method === "POST") return createEvaluationLabel(request, options);
  if (/^\/v1\/intel\/claims\/[^/]+\/reviews$/.test(url.pathname) && request.method === "POST") return createClaimReview(request, options, url.pathname.split("/")[4]);
  if ((url.pathname === "/v1/evidence/claim-ledger" || url.pathname === "/v1/analyst/claim-ledger") && request.method === "GET") return claimLedger(request, url, options, url.pathname.startsWith("/v1/analyst"));
  if (/^\/v1\/analyst\/claim-ledger\/[^/]+\/actions$/.test(url.pathname) && request.method === "POST") return analystClaimAction(request, options, url.pathname.split("/")[4]);
  const route = listRoutes[url.pathname as keyof typeof listRoutes];
  if (!route || request.method !== "GET") return undefined;
  const scope = resolveTenantScope(request, url);
  if (scope.error) return scope.error;

  const [responseKey, memoryMethod] = route;
  const limit = Math.max(1, Math.min(500, numberQuery(url.searchParams.get("limit")) ?? 50));
  const offset = Math.max(0, numberQuery(url.searchParams.get("cursor")) ?? 0);
  const query = url.searchParams.get("q")?.trim().toLowerCase();
  const tenantId = scope.tenantId;
  const databaseQuery = (options.store as any).queryStructuredRecords;
  if (typeof databaseQuery === "function") {
    const result = await databaseQuery.call(options.store, responseKey, { tenantId, query, limit, offset });
    return json({ [responseKey]: result.records.map((record: any) => apiRecord(responseKey, record, url, tenantId)), total: result.total, nextCursor: result.nextCursor });
  }

  const records = typeof (options.store as any)[memoryMethod] === "function" ? (options.store as any)[memoryMethod]() : [];
  const filtered = records
    .filter((record: any) => inTenantScope(record, tenantId))
    .map((record: any) => apiRecord(responseKey, record, url, tenantId))
    .filter((record: any) => !query || JSON.stringify(record).toLowerCase().includes(query));
  return json({ [responseKey]: filtered.slice(offset, offset + limit), total: filtered.length, nextCursor: offset + limit < filtered.length ? String(offset + limit) : undefined });
}

async function applyGovernanceAction(request: Request, options: ApiServerOptions): Promise<Response> {
  const authentication = await authenticateRequest(request, options);
  if (authentication.error) return authentication.error;
  const body = await readJson<any>(request);
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const action = String(body.action ?? "");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const actor = authentication.identity!;
  if (!reason || reason.length < 8 || containsForbiddenMaterial(body)) return error("invalid_governance_action", "Governance actions require a specific safe reason", 400);
  const at = validIso(body.appliedAt) ?? nowIso();
  const id = stableId("governance-action", `${scope.tenantId ?? "global"}:${action}:${body.sourceId ?? body.captureId ?? body.claimId}:${actor.id}:${reason}`);

  if (action === "correct_claim") {
    if (!actor.roles.some((role) => ["owner", "admin", "analyst"].includes(role))) return error("governance_action_forbidden", "Claim correction requires an analyst role", 403);
    const claim = (options.store as any).getIntelligenceClaim?.(body.claimId);
    if (!claim || !inTenantScope(claim, scope.tenantId)) return error("claim_not_found", "Intelligence claim not found", 404);
    if (!safeEvaluationValue(body.correctedValue)) return error("invalid_governance_action", "A bounded correctedValue is required", 400);
    const stored = (options.store as any).saveClaimReview({ id, tenantId: claim.tenantId, claimId: claim.id, action: "correct", reviewerId: actor.id, reason: reason.slice(0, 1_000), correctedValue: body.correctedValue, reviewedAt: at });
    return json({ governanceAction: { id, action, targetId: claim.id, appliedAt: at, appliedBy: actor.id }, ...stored }, 201);
  }

  if (!actor.roles.some((role) => ["owner", "admin"].includes(role))) return error("governance_action_forbidden", "Evidence redaction and source takedown require an administrator role", 403);
  if (action === "takedown_source") {
    const source = (options.store as any).getSource?.(body.sourceId);
    if (!source || !inTenantScope(source, scope.tenantId)) return error("source_not_found", "Source not found", 404);
    const audit = { id, action, reason: reason.slice(0, 1_000), appliedAt: at, appliedBy: actor.id };
    const saved = (options.store as any).saveSource({ ...source, status: "disabled", governance: { ...(source.governance ?? {}), takedown: audit, audit: [...(source.governance?.audit ?? []).filter((entry: any) => entry.id !== id), audit] }, updatedAt: at });
    return json({ governanceAction: audit, source: toSafeSourceDto(saved) }, 201);
  }
  if (action === "redact_capture") {
    const capture = (options.store as any).getCapture?.(body.captureId);
    if (!capture || !inTenantScope(capture, scope.tenantId)) return error("capture_not_found", "Capture not found", 404);
    if (capture.legalHold || capture.retentionClass === "legal_hold") return error("capture_on_legal_hold", "Release the legal hold before redaction", 409);
    const audit = { id, action, reason: reason.slice(0, 1_000), appliedAt: at, appliedBy: actor.id };
    if (capture.objectRef) (options.objectStore as any)?.deleteObject?.(capture.objectRef, `governance:${id}`);
    const saved = (options.store as any).replaceCaptureForRetention({ ...capture, body: undefined, objectRef: undefined, storageKind: "metadata_only", metadata: { ...(capture.metadata ?? {}), governanceAudit: [...(capture.metadata?.governanceAudit ?? []).filter((entry: any) => entry.id !== id), audit] } });
    return json({ governanceAction: audit, capture: toSafeCaptureDto(saved, { tenantId: scope.tenantId }) }, 201);
  }
  return error("invalid_governance_action", "Use action correct_claim, takedown_source, or redact_capture", 400);
}

async function createValidationRecord(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const capture = body.captureId ? (options.store as any).getCapture?.(body.captureId) : undefined;
  const incident = body.incidentId ? (options.store as any).getIncident?.(body.incidentId) : undefined;
  const claim = body.claimId ? (options.store as any).getIntelligenceClaim?.(body.claimId) : undefined;
  const referenced = [capture, incident, claim].filter(Boolean);
  if ((!body.captureId && !body.incidentId && !body.claimId) || (body.captureId && !capture) || (body.incidentId && !incident) || (body.claimId && !claim) || referenced.some((record) => !inTenantScope(record, scope.tenantId))) {
    return error("invalid_validation_subject", "Validation records must reference stored captures, incidents, or claims", 400);
  }
  if (!["supported", "partially_supported", "unconfirmed", "contradicted"].includes(body.status)) {
    return error("invalid_validation_status", "Unsupported validation status", 400);
  }
  if (!isPublicReferenceUrl(body.referenceUrl) || typeof body.validationType !== "string" || !body.validationType.trim()) {
    return error("invalid_validation_reference", "A public HTTP(S) reference and validationType are required", 400);
  }
  if (body.id !== undefined && !cleanId(body.id) || body.matchedAt !== undefined && !validIso(body.matchedAt) || body.referencePublishedAt !== undefined && !validIso(body.referencePublishedAt)) {
    return error("invalid_validation_fields", "Validation ids and timestamps must use supported formats", 400);
  }
  const matchedAt = validIso(body.matchedAt) ?? nowIso();
  const record = {
    ...body,
    id: cleanId(body.id) ?? stableId("validation", `${body.captureId ?? body.incidentId ?? body.claimId}:${body.referenceUrl}:${matchedAt}`),
    validationType: body.validationType.trim(),
    matchedAt,
    referencePublishedAt: validIso(body.referencePublishedAt),
    tenantId: scope.tenantId,
    updatedAt: nowIso()
  };
  return json({ validationRecord: (options.store as any).saveValidationRecord(record) }, 201);
}

async function createEvaluationLabel(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const subjects = [
    ["captureId", "getCapture"],
    ["incidentId", "getIncident"],
    ["entityId", "getExtractedEntity"],
    ["indicatorId", "getIndicator"],
    ["claimId", "getIntelligenceClaim"]
  ] as const;
  const supplied = subjects.filter(([field]) => cleanId(body[field]));
  const subjectRecords = supplied.map(([field, getter]) => (options.store as any)[getter]?.(body[field]));
  if (supplied.length !== 1 || subjectRecords.some((record) => !record || !inTenantScope(record, scope.tenantId))) {
    return error("invalid_evaluation_subject", "Evaluation labels must reference exactly one stored intelligence record", 400);
  }
  if (!["true_positive", "false_positive", "false_negative", "true_negative", "correct", "incorrect", "needs_review"].includes(body.outcome)) {
    return error("invalid_evaluation_outcome", "Unsupported evaluation outcome", 400);
  }
  if (!["train", "validation", "test", "unassigned"].includes(body.datasetSplit ?? "unassigned")) {
    return error("invalid_dataset_split", "Unsupported evaluation dataset split", 400);
  }
  if (!validEvaluationLabelType(body.labelType) || !cleanId(body.labeledBy) || !safeEvaluationValue(body.expectedValue) || !safeEvaluationValue(body.observedValue) || containsForbiddenMaterial(body)) {
    return error("invalid_evaluation_label", "Evaluation labels require labelType and labeledBy and cannot contain raw sensitive material", 400);
  }
  if (body.id !== undefined && !cleanId(body.id) || body.labeledAt !== undefined && !validIso(body.labeledAt)) {
    return error("invalid_evaluation_fields", "Evaluation ids and timestamps must use supported formats", 400);
  }
  const labeledAt = validIso(body.labeledAt) ?? nowIso();
  const [subjectField] = supplied[0];
  const record = {
    id: cleanId(body.id) ?? stableId("evaluation-label", `${body[subjectField]}:${body.labelType}:${labeledAt}`),
    [subjectField]: body[subjectField],
    labelType: body.labelType.trim(),
    expectedValue: body.expectedValue,
    observedValue: body.observedValue,
    outcome: body.outcome,
    labeledBy: body.labeledBy.trim(),
    labeledAt,
    datasetSplit: body.datasetSplit ?? "unassigned",
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2_000) : undefined,
    tenantId: scope.tenantId,
    updatedAt: nowIso()
  };
  return json({ evaluationLabel: (options.store as any).saveEvaluationLabel(record) }, 201);
}

async function createClaimReview(request: Request, options: ApiServerOptions, claimId: string, compatibilityAction?: string): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const claim = (options.store as any).getIntelligenceClaim?.(claimId);
  if (!claim || !inTenantScope(claim, scope.tenantId)) return error("claim_not_found", "Intelligence claim not found", 404);
  const action = compatibilityAction ?? body.action;
  const allowed = new Set(["confirm", "reject", "mark_needs_review", "mark_contradicted", "reset", "attach_legal_hold", "release_legal_hold"]);
  if (!allowed.has(action)) return error("invalid_claim_review_action", "Unsupported claim review action", 400);
  const reviewerId = cleanId(body.reviewerId ?? request.headers.get("x-actor-id"));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reviewerId || reason.length < 8 || containsForbiddenMaterial(body)) return error("invalid_claim_review", "Claim reviews require a reviewer and a specific safe reason", 400);
  const reviewedAt = validIso(body.reviewedAt) ?? nowIso();
  const review = {
    id: cleanId(body.id) ?? stableId("claim-review", `${claimId}:${action}:${reviewerId}:${reviewedAt}`),
    tenantId: claim.tenantId,
    claimId,
    action,
    reviewerId,
    reason: reason.slice(0, 1_000),
    reviewedAt
  };
  if (body.dryRun === true) return json({ persisted: false, review, claim });
  const stored = (options.store as any).saveClaimReview(review);
  return json({ persisted: true, ...stored }, 201);
}

function claimLedger(request: Request, url: URL, options: ApiServerOptions, analystCompatibility: boolean): Response {
  const scope = resolveTenantScope(request, url);
  if (scope.error) return scope.error;
  const query = url.searchParams.get("q")?.trim().toLowerCase();
  const tenantId = scope.tenantId;
  const claims = ((options.store as any).listIntelligenceClaims?.() ?? [])
    .filter((claim: any) => inTenantScope(claim, tenantId))
    .filter((claim: any) => !query || JSON.stringify(claim).toLowerCase().includes(query));
  const counts = {
    total: claims.length,
    confirmed: claims.filter((claim: any) => claim.reviewState === "confirmed").length,
    corroborated: claims.filter((claim: any) => claim.corroborationState === "corroborated").length,
    needsReview: claims.filter((claim: any) => ["unreviewed", "needs_review"].includes(claim.reviewState)).length,
    contradicted: claims.filter((claim: any) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted").length,
    metadataOnly: claims.filter((claim: any) => claim.evidenceStage === "metadata_only_claim").length
  };
  const trustGate = counts.total === 0 || counts.contradicted > 0 ? "hold" : counts.needsReview > 0 ? "review" : "ready";
  if (!analystCompatibility) return json({ schemaVersion: "ti.claim_ledger.v1", trustGate, counts, claims, safeOutput: { rawEvidenceExposed: false, restrictedPayloadsExposed: false, objectKeysExposed: false } });
  const legacy = ((options.store as any).listAnalystClaimLedgerEntries?.() ?? [])
    .filter((entry: any) => inTenantScope(entry, tenantId))
    .filter((entry: any) => !query || JSON.stringify(entry).toLowerCase().includes(query))
    .map(analystEntryDto);
  return json({
    contract: { endpoint: "/v1/analyst/claim-ledger", metadataOnly: true, safeForApi: true, rawLeakMaterialAccessed: false, objectKeysExposed: false },
    runStatusClarity: { totalClaims: claims.length, reviewRequired: counts.needsReview, graphEligible: claims.filter(exportEligible).length, stixEligible: claims.filter(exportEligible).length },
    trustGate,
    counts,
    entries: legacy,
    claims
  });
}

async function analystClaimAction(request: Request, options: ApiServerOptions, claimId: string): Promise<Response> {
  const body = await request.clone().json().catch(() => ({})) as any;
  const actionMap: Record<string, string> = { promote: "confirm", reject: "reject", mark_needs_review: "mark_needs_review", mark_contradicted: "mark_contradicted", attach_legal_hold: "attach_legal_hold", release_legal_hold: "release_legal_hold", reset: "reset" };
  const mapped = actionMap[body.action];
  if (!mapped) return error("invalid_claim_review_action", "Unsupported analyst claim action", 400);
  const response = await createClaimReview(request, options, claimId, mapped);
  if (response.status >= 400 || body.dryRun === true) return response;
  const payload = await response.json() as any;
  const existing = ((options.store as any).listAnalystClaimLedgerEntries?.() ?? []).find((entry: any) => entry.id === claimId);
  if (!existing) return json(payload, response.status);
  const ledgerStatus = mapped === "confirm" ? "trusted" : mapped === "reject" ? "rejected" : mapped === "mark_contradicted" ? "contradicted" : existing.ledgerStatus;
  const entry = (options.store as any).saveAnalystClaimLedgerEntry({ ...existing, confidence: typeof body.confidence === "number" ? Math.max(0, Math.min(1, body.confidence)) : existing.confidence, ledgerStatus, reviewedBy: payload.review.reviewerId, reviewedAt: payload.review.reviewedAt, legalHold: mapped === "attach_legal_hold" ? true : mapped === "release_legal_hold" ? false : existing.legalHold, retentionClass: mapped === "attach_legal_hold" ? "legal_hold" : mapped === "release_legal_hold" && existing.retentionClass === "legal_hold" ? "standard" : existing.retentionClass, graphEligible: mapped === "confirm", stixEligible: mapped === "confirm", updatedAt: payload.review.reviewedAt });
  return json({ contract: { metadataOnly: true, graphPromotionAutomatic: false, stixPromotionAutomatic: false }, result: { persisted: true, nextStatus: ledgerStatus, graphEligible: Boolean(entry.graphEligible && !entry.legalHold), stixEligible: Boolean(entry.stixEligible && !entry.legalHold) }, entry: analystEntryDto(entry), claim: (options.store as any).getIntelligenceClaim(claimId), review: payload.review }, 201);
}

function analystEntryDto(entry: any) {
  const eligibilityBlockers = [entry.ledgerStatus !== "trusted" && "claim_not_trusted", entry.legalHold && "legal_hold"].filter(Boolean);
  return { ...entry, graphEligible: Boolean(entry.graphEligible && !entry.legalHold), stixEligible: Boolean(entry.stixEligible && !entry.legalHold), eligibilityBlockers };
}
function exportEligible(claim: any) { return claim.reviewState === "confirmed" && claim.corroborationState !== "contradicted" && !claim.legalHold; }

function apiRecord(collection: string, record: any, url: URL, tenantId?: string): any {
  if (collection === "sources") return toSafeSourceDto(record);
  if (collection === "captures") return toSafeCaptureDto(record, { tenantId, includeBody: booleanQuery(url.searchParams.get("includeBody")) === true });
  if (collection === "alerts") return safeAlertDto(record);
  return sanitizeDwmApiPayload(record);
}

function safeAlertDto(alert: any) {
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  const captureIds = unique([
    alert.captureId,
    ...(alert.captureIds ?? []),
    ...(alert.provenance?.captureIds ?? []),
    ...(alert.workflowContext?.captureIds ?? []),
    ...evidence.map((item: any) => item.captureId ?? item.provenance?.captureId)
  ]);
  const sourceIds = unique([
    alert.sourceId,
    ...(alert.sourceIds ?? []),
    ...(alert.provenance?.sourceIds ?? []),
    ...evidence.map((item: any) => item.sourceId ?? item.provenance?.sourceId)
  ]);
  const confidence = Number(alert.confidence);
  return sanitizeDwmApiPayload({
    id: alert.id,
    tenantId: alert.tenantId,
    organizationId: alert.organizationId,
    incidentId: alert.incidentId,
    actor: sanitizeDwmCustomerText(alert.actor, undefined, 160),
    victim: sanitizeDwmCustomerText(alert.company ?? alert.victimName, undefined, 160),
    summary: sanitizeDwmCustomerText(alert.claimSummary ?? alert.summary),
    severity: alert.severityOverride ?? alert.severity,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence)) : undefined,
    reviewState: alert.reviewState ?? "unreviewed",
    workflowState: alert.workflowStatus,
    deliveryState: alert.deliveryState,
    sourceFamily: alert.sourceFamily,
    firstSeenAt: alert.firstSeenAt,
    lastSeenAt: alert.lastSeenAt,
    alertedAt: alert.alertedAt ?? alert.savedAt,
    deliveredAt: alert.deliveredAt,
    evidence: {
      captureIds,
      sourceIds,
      evidenceCount: evidence.length || captureIds.length,
      sourceCount: sourceIds.length,
      metadataOnly: evidence.some((item: any) => item.captureMode === "metadata_only" || item.redactionState === "metadata_only")
    }
  });
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.flat().filter(Boolean).map(String))];
}

function cleanId(value: unknown): string | undefined { return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(value) ? value : undefined; }
function validIso(value: unknown): string | undefined { if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined; return new Date(value).toISOString(); }
function isPublicReferenceUrl(value: unknown): boolean { try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol) && !url.hostname.endsWith(".onion"); } catch { return false; } }
function containsForbiddenMaterial(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const forbidden = new Set(["rawBody", "rawPayload", "leakedRows", "credentialValues", "downloadedDataset"]);
  return Object.entries(value).some(([key, nested]) => forbidden.has(key) || containsForbiddenMaterial(nested));
}

function validEvaluationLabelType(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^(?:actor|victim|date|source|ttp|impact|dataset|leak_type|indicator|incident|cve|vendor|product|malware|ransomware_family|country|sector|publication_strategy|publicity_tactic|channel_type|victim_pressure_tactic|extortion_type|monetization_path|buyer_seller_communication|intermediary_communication|profitability_signal)(?:_extraction)?$/.test(value.trim());
}
function safeEvaluationValue(value: unknown): boolean {
  if (value === undefined) return true;
  if (containsForbiddenMaterial(value)) return false;
  try { return JSON.stringify(value).length <= 10_000; } catch { return false; }
}
