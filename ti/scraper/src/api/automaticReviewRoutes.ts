import { error, json, numberQuery, readJson } from "./http.ts";
import { authenticateRequest } from "./requestAuthentication.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";
import { nowIso, stableId } from "../utils.ts";

export const AUTOMATIC_REVIEW_PROMPT_VERSION = "ti.automatic_intelligence_review.prompt.v1";
export const AUTOMATIC_REVIEW_RESPONSE_SCHEMA = "ti.automatic_intelligence_review.response.v1";
const REQUEST_SCHEMA = "ti.automatic_intelligence_review.request.v1";
const TASK_SCHEMA = "ti.automatic_intelligence_review.task.v1";
const TASK_KIND = "automatic_intelligence_review_task";
const EVENT_KIND = "automatic_intelligence_review_event";
const DEFAULT_MAX_ATTEMPTS = 3;

type AutomaticReviewTask = {
  id: string;
  recordKind: typeof TASK_KIND;
  schemaVersion: typeof TASK_SCHEMA;
  tenantId?: string;
  subject: { type: "claim" | "incident"; id: string; claimId?: string; incidentId?: string; summary?: string };
  evidence: GovernedEvidence[];
  evidenceIds: string[];
  state: "queued" | "running" | "retrying" | "dead_letter" | "quarantined" | "terminal";
  outcome?: "decided" | "human_owned";
  attempt: number;
  maxAttempts: number;
  replayCount: number;
  promptVersion: typeof AUTOMATIC_REVIEW_PROMPT_VERSION;
  responseSchemaVersion: typeof AUTOMATIC_REVIEW_RESPONSE_SCHEMA;
  requestedModelVersion: string;
  queuedAt: string;
  nextAttemptAt: string;
  leaseExpiresAt?: string;
  completedAt?: string;
  updatedAt: string;
  lastError?: string;
  decision?: AutomaticReviewDecision;
  unsafeMaterialAccessed: false;
};

type GovernedEvidence = {
  id: string;
  relationship: string;
  evidenceStage: string;
  confidence?: number;
  source: { id: string; name?: string; type?: string; trustScore?: number };
  capture: { id: string; title?: string; safeExcerpt?: string; publishedAt?: string; collectedAt?: string; storageKind?: string };
};

type AutomaticReviewDecision = {
  schemaVersion: typeof AUTOMATIC_REVIEW_RESPONSE_SCHEMA;
  promptVersion: typeof AUTOMATIC_REVIEW_PROMPT_VERSION;
  modelVersion: string;
  subject: { type: "claim" | "incident"; id: string };
  action: "confirm" | "reject" | "mark_contradicted" | "mark_needs_review";
  claimValidity: "supported" | "invalid" | "contradicted" | "uncertain";
  actorAttribution: { canonicalName: string | null; aliases: string[] };
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  uncertainty: string[];
  rationale: string;
  confidence: number;
  calibrationContext: Record<string, unknown>;
};

type CycleInput = {
  now?: string;
  limit?: number;
  tenantId?: string;
  allTenants?: boolean;
  fetcher?: FetchLike;
  aiBase?: string;
  aiPath?: string;
  modelVersion?: string;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function handleAutomaticReviewRequest(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== "/v1/intel/automatic-reviews"
    && url.pathname !== "/v1/intel/automatic-reviews/sync"
    && url.pathname !== "/v1/intel/automatic-reviews/run"
    && !/^\/v1\/intel\/automatic-reviews\/[^/]+\/replay$/.test(url.pathname)) return undefined;

  const authentication = await authenticateRequest(request, options);
  if (authentication.error) return authentication.error;
  if (!authentication.identity!.roles.some((role) => ["owner", "admin", "administrator", "system_admin", "analyst"].includes(role))) {
    return error("automatic_review_forbidden", "Automatic intelligence review requires an analyst role", 403);
  }

  const body = request.method === "GET" ? {} : await readJson<any>(request);
  const scope = resolveTenantScope(request, url, body.tenantId);
  if (scope.error) return scope.error;

  if (url.pathname === "/v1/intel/automatic-reviews" && request.method === "GET") {
    return json(automaticReviewSnapshot(options.store, scope.tenantId, numberQuery(url.searchParams.get("limit"))));
  }
  if (url.pathname === "/v1/intel/automatic-reviews/sync" && request.method === "POST") {
    const queued = syncAutomaticReviewQueue(options, { tenantId: scope.tenantId });
    await (options.store as any).flush?.();
    return json({ queued, ...automaticReviewSnapshot(options.store, scope.tenantId) }, 201);
  }
  if (url.pathname === "/v1/intel/automatic-reviews/run" && request.method === "POST") {
    const limit = boundedInteger(body.limit, 10, 1, 50);
    const cycle = await runAutomaticReviewCycle(options, { limit, tenantId: scope.tenantId });
    return json({ cycle, ...automaticReviewSnapshot(options.store, scope.tenantId) }, 201);
  }
  if (request.method === "POST") {
    const taskId = url.pathname.split("/")[4];
    const replayed = replayAutomaticReview(options, taskId, scope.tenantId);
    if (replayed instanceof Response) return replayed;
    await (options.store as any).flush?.();
    return json({ task: replayed }, 201);
  }
  return error("automatic_review_method_not_allowed", "The automatic review action is not supported", 405);
}

export function syncAutomaticReviewQueue(options: ApiServerOptions, input: { tenantId?: string; allTenants?: boolean; now?: string; modelVersion?: string } = {}) {
  const store = options.store as any;
  const at = validIso(input.now) ?? nowIso();
  const modelVersion = input.modelVersion ?? configuredModelVersion(options);
  const existing = new Set(tasks(store).map((task) => task.id));
  const claims = (store.listIntelligenceClaims?.() ?? []).filter((claim: any) => input.allTenants || inTenantScope(claim, input.tenantId));
  const coveredIncidents = new Set<string>(claims.filter((claim: any) => claim.subjectType === "incident" && claim.subjectId).map((claim: any) => claim.subjectId));
  let queued = 0;

  for (const claim of claims) {
    if (!claimEligible(store, claim, modelVersion)) continue;
    const task = newTask(options, { type: "claim", id: claim.id, claimId: claim.id, incidentId: claim.subjectType === "incident" ? claim.subjectId : undefined, summary: safeText(claim.summary, 500) }, at, modelVersion);
    if (existing.has(task.id)) continue;
    store.saveAnalystMetadataReviewTask(task);
    saveEvent(store, task, "queued", at);
    existing.add(task.id);
    queued++;
  }

  for (const incident of store.listIncidents?.() ?? []) {
    if ((!input.allTenants && !inTenantScope(incident, input.tenantId)) || coveredIncidents.has(incident.id) || !["unreviewed", "needs_review", undefined].includes(incident.reviewState)) continue;
    const task = newTask(options, { type: "incident", id: incident.id, incidentId: incident.id, summary: safeText(incident.title ?? incident.summary, 500) }, at, modelVersion);
    if (existing.has(task.id)) continue;
    store.saveAnalystMetadataReviewTask(task);
    saveEvent(store, task, "queued", at);
    existing.add(task.id);
    queued++;
  }
  return queued;
}

export async function runAutomaticReviewCycle(options: ApiServerOptions, input: CycleInput = {}) {
  const store = options.store as any;
  const at = validIso(input.now) ?? nowIso();
  const modelVersion = input.modelVersion ?? configuredModelVersion(options);
  const queued = syncAutomaticReviewQueue(options, { now: at, modelVersion, tenantId: input.tenantId, allTenants: input.allTenants });
  recoverExpiredLeases(store, at, input);
  const due = tasks(store)
    .filter((task) => input.allTenants || inTenantScope(task, input.tenantId))
    .filter((task) => ["queued", "retrying"].includes(task.state) && Date.parse(task.nextAttemptAt) <= Date.parse(at))
    .sort((left, right) => Date.parse(left.queuedAt) - Date.parse(right.queuedAt))
    .slice(0, Math.max(1, Math.min(50, input.limit ?? 10)));
  const results: Array<Record<string, unknown>> = [];
  for (const task of due) results.push(await processTask(options, task, at, input));
  await store.flush?.();
  return { queued, attempted: due.length, results };
}

export function startAutomaticReviewWorker(options: ApiServerOptions, input: { intervalMs?: number; limit?: number } = {}) {
  const intervalMs = Math.max(30_000, input.intervalMs ?? 60_000);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runAutomaticReviewCycle(options, { limit: input.limit, allTenants: true }); }
    finally { running = false; }
  };
  const run = () => void tick().catch((caught) => console.error("automatic intelligence review worker failed", safeError(caught)));
  run();
  const timer = setInterval(run, intervalMs);
  return { tick, stop: () => clearInterval(timer) };
}

export function automaticReviewSnapshot(store: any, tenantId?: string, requestedLimit = 100) {
  const limit = Math.max(1, Math.min(250, Math.floor(requestedLimit || 100)));
  const allTasks = tasks(store).filter((task) => inTenantScope(task, tenantId)).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const allEvents = events(store).filter((event) => inTenantScope(event, tenantId));
  const visible = allTasks.slice(0, limit).map((task) => ({
    ...task,
    history: allEvents.filter((event) => event.taskId === task.id).sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
  }));
  return {
    schemaVersion: "ti.automatic_intelligence_review.queue.v1",
    counts: Object.fromEntries(["queued", "running", "retrying", "dead_letter", "quarantined", "terminal"].map((state) => [state, allTasks.filter((task) => task.state === state).length])),
    total: allTasks.length,
    tasks: visible
  };
}

function newTask(options: ApiServerOptions, subject: AutomaticReviewTask["subject"], at: string, modelVersion: string): AutomaticReviewTask {
  const evidence = governedEvidence(options.store as any, subject);
  return {
    id: stableId("automatic-review", `${subject.type}:${subject.id}:${subjectTenant(options.store as any, subject) ?? "global"}:${AUTOMATIC_REVIEW_PROMPT_VERSION}:${modelVersion}`),
    recordKind: TASK_KIND,
    schemaVersion: TASK_SCHEMA,
    tenantId: subjectTenant(options.store as any, subject),
    subject,
    evidence,
    evidenceIds: evidence.map((item) => item.id),
    state: "queued",
    attempt: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    replayCount: 0,
    promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION,
    responseSchemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
    requestedModelVersion: modelVersion,
    queuedAt: at,
    nextAttemptAt: at,
    updatedAt: at,
    unsafeMaterialAccessed: false
  };
}

async function processTask(options: ApiServerOptions, original: AutomaticReviewTask, at: string, input: CycleInput) {
  const store = options.store as any;
  let task = store.getAnalystMetadataReviewTask(original.id) as AutomaticReviewTask;
  if (!["queued", "retrying"].includes(task.state)) return { taskId: task.id, state: task.state, outcome: task.outcome };
  if (task.subject.claimId && hasHumanTerminalReview(store, task.subject.claimId)) {
    task = saveTask(store, task, { state: "terminal", outcome: "human_owned", completedAt: at, updatedAt: at, leaseExpiresAt: undefined });
    saveEvent(store, task, "human_owned", at);
    return { taskId: task.id, state: task.state, outcome: task.outcome };
  }

  const reviewId = stableId("automatic-claim-review", task.id);
  const persistedReview = task.subject.claimId ? store.getClaimReview?.(reviewId) : undefined;
  if (persistedReview?.automaticDecision && String(persistedReview.reviewerId ?? "").startsWith("hanasand-ai:automatic:")) {
    task = saveTask(store, task, { state: "terminal", outcome: "decided", decision: persistedReview.automaticDecision, completedAt: persistedReview.reviewedAt, updatedAt: at, leaseExpiresAt: undefined });
    saveEvent(store, task, "restart_reconciled", at, persistedReview.automaticDecision);
    return { taskId: task.id, state: task.state, outcome: task.outcome };
  }

  const refreshedEvidence = governedEvidence(store, task.subject);
  task = saveTask(store, task, {
    state: "running",
    attempt: task.attempt + 1,
    evidence: refreshedEvidence,
    evidenceIds: refreshedEvidence.map((item) => item.id),
    leaseExpiresAt: new Date(Date.parse(at) + 120_000).toISOString(),
    updatedAt: at,
    lastError: undefined
  });
  saveEvent(store, task, "running", at);

  if (!task.evidence.length) {
    const decision = policyQuarantineDecision(task);
    if (task.subject.claimId) persistClaimDecision(store, task, decision, at, "hanasand-ai:policy:governed-evidence-gate", "policy");
    task = saveTask(store, task, { state: "quarantined", decision, completedAt: at, updatedAt: at, leaseExpiresAt: undefined, lastError: "No governed evidence is linked to this subject" });
    saveEvent(store, task, "quarantined", at, decision);
    return { taskId: task.id, state: task.state, error: task.lastError };
  }

  try {
    const decision = await requestModelDecision(options, task, input);
    if (task.subject.claimId && hasHumanTerminalReview(store, task.subject.claimId)) {
      task = saveTask(store, task, { state: "terminal", outcome: "human_owned", completedAt: at, updatedAt: at, leaseExpiresAt: undefined });
      saveEvent(store, task, "human_owned", at);
      return { taskId: task.id, state: task.state, outcome: task.outcome };
    }
    if (task.subject.claimId) persistClaimDecision(store, task, decision, at);
    task = saveTask(store, task, { state: "terminal", outcome: "decided", decision, completedAt: at, updatedAt: at, leaseExpiresAt: undefined });
    saveEvent(store, task, "terminal", at, decision);
    return { taskId: task.id, state: task.state, action: decision.action };
  } catch (caught) {
    const message = safeError(caught);
    if (caught instanceof ModelOutputError) {
      task = saveTask(store, task, { state: "quarantined", completedAt: at, updatedAt: at, leaseExpiresAt: undefined, lastError: message });
      saveEvent(store, task, "quarantined", at);
      return { taskId: task.id, state: task.state, error: message };
    }
    const exhausted = task.attempt >= task.maxAttempts;
    const nextAttemptAt = exhausted ? task.nextAttemptAt : new Date(Date.parse(at) + retryDelayMs(task.attempt)).toISOString();
    task = saveTask(store, task, { state: exhausted ? "dead_letter" : "retrying", completedAt: exhausted ? at : undefined, nextAttemptAt, updatedAt: at, leaseExpiresAt: undefined, lastError: message });
    saveEvent(store, task, task.state, at);
    return { taskId: task.id, state: task.state, error: message };
  }
}

async function requestModelDecision(options: ApiServerOptions, task: AutomaticReviewTask, input: CycleInput): Promise<AutomaticReviewDecision> {
  const base = String(input.aiBase ?? (options as any).automaticReviewApiBase ?? Bun.env.HANASAND_AI_REVIEW_API_BASE ?? "").trim();
  const toolsEndpoint = String(Bun.env.HANASAND_AI_TOOLS_API ?? "http://api:8080/api/tools/ai").trim();
  let target: URL;
  try { target = base ? new URL(input.aiPath ?? Bun.env.HANASAND_AI_REVIEW_PATH ?? "/v1/review/intelligence", base) : new URL(toolsEndpoint); }
  catch { throw new Error("Hanasand AI review endpoint is misconfigured"); }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error("Hanasand AI review endpoint is misconfigured");
  const fetcher: FetchLike = input.fetcher ?? (options as any).automaticReviewFetch ?? fetch;
  const body = {
    schemaVersion: REQUEST_SCHEMA,
    promptVersion: task.promptVersion,
    responseSchemaVersion: task.responseSchemaVersion,
    requestedModelVersion: task.requestedModelVersion,
    subject: task.subject,
    evidence: task.evidence,
    calibrationContext: {
      evidenceCount: task.evidence.length,
      sourceCount: new Set(task.evidence.map((item) => item.source.id)).size,
      evidenceStages: [...new Set(task.evidence.map((item) => item.evidenceStage))]
    }
  };
  let response: Response;
  try {
    response = await fetcher(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(base ? body : {
        prompt: automaticReviewPrompt(body),
        maxTokens: 1_000,
        billingMode: "standard",
        metadata: { source: "ti-automatic-intelligence-review", promptVersion: task.promptVersion, responseSchemaVersion: task.responseSchemaVersion }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
  } catch (caught) {
    throw new Error(`Hanasand AI request failed: ${safeError(caught)}`);
  }
  if (!response.ok) throw new Error(`Hanasand AI returned HTTP ${response.status}`);
  let payload: unknown;
  try {
    const responseBody: any = await response.json();
    payload = base ? responseBody : parseStrictJson(responseBody?.message ?? responseBody?.choices?.[0]?.message?.content);
  }
  catch { throw new ModelOutputError("Hanasand AI returned non-JSON output"); }
  return validateDecision(payload, task);
}

function automaticReviewPrompt(request: unknown) {
  return [
    "Review this threat-intelligence claim or incident using only the supplied governed evidence.",
    "Return one JSON object and no markdown. Do not infer evidence, identifiers, actor aliases, or facts that are absent from the request.",
    `The response must use schemaVersion ${AUTOMATIC_REVIEW_RESPONSE_SCHEMA}, promptVersion ${AUTOMATIC_REVIEW_PROMPT_VERSION}, and the requested modelVersion and subject exactly.`,
    "Required fields: schemaVersion, promptVersion, modelVersion, subject, action, claimValidity, actorAttribution, supportingEvidenceIds, contradictoryEvidenceIds, uncertainty, rationale, confidence, calibrationContext.",
    "claimValidity/action pairs are supported/confirm, invalid/reject, contradicted/mark_contradicted, or uncertain/mark_needs_review.",
    "Actor attribution requires supportingEvidenceIds. Every evidence ID must come from the request.",
    JSON.stringify(request)
  ].join("\n");
}

function parseStrictJson(value: unknown) {
  if (typeof value !== "string") throw new ModelOutputError("Hanasand AI returned no structured message");
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) throw new ModelOutputError("Hanasand AI returned non-JSON output");
  return JSON.parse(trimmed);
}

function validateDecision(payload: unknown, task: AutomaticReviewTask): AutomaticReviewDecision {
  if (!payload || typeof payload !== "object") throw new ModelOutputError("Hanasand AI output is not an object");
  const value = payload as any;
  const allowedIds = new Set(task.evidenceIds);
  const supportingEvidenceIds = idArray(value.supportingEvidenceIds, allowedIds);
  const contradictoryEvidenceIds = idArray(value.contradictoryEvidenceIds, allowedIds);
  const action = value.action;
  const claimValidity = value.claimValidity;
  const expectedAction = { supported: "confirm", invalid: "reject", contradicted: "mark_contradicted", uncertain: "mark_needs_review" }[claimValidity as string];
  const subject = value.subject;
  const attribution = value.actorAttribution;
  const aliases = stringArray(attribution?.aliases, 20, 120);
  const canonicalName = attribution?.canonicalName === null ? null : safeText(attribution?.canonicalName, 120);
  const rationale = safeText(value.rationale, 1_000);
  const uncertainty = stringArray(value.uncertainty, 20, 300);
  if (value.schemaVersion !== AUTOMATIC_REVIEW_RESPONSE_SCHEMA
    || value.promptVersion !== AUTOMATIC_REVIEW_PROMPT_VERSION
    || value.modelVersion !== task.requestedModelVersion
    || subject?.type !== task.subject.type
    || subject?.id !== task.subject.id
    || !expectedAction
    || action !== expectedAction
    || !rationale
    || !Number.isFinite(value.confidence)
    || value.confidence < 0
    || value.confidence > 1
    || !attribution
    || canonicalName === undefined
    || !plainRecord(value.calibrationContext)) {
    throw new ModelOutputError("Hanasand AI output failed the versioned response contract");
  }
  if (claimValidity === "supported" && !supportingEvidenceIds.length) throw new ModelOutputError("A supported decision requires supporting evidence");
  if (["invalid", "contradicted"].includes(claimValidity) && !contradictoryEvidenceIds.length) throw new ModelOutputError("A negative decision requires contradictory evidence");
  if (canonicalName && !supportingEvidenceIds.length) throw new ModelOutputError("Actor attribution requires supporting evidence");
  return {
    schemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
    promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION,
    modelVersion: task.requestedModelVersion,
    subject: { type: task.subject.type, id: task.subject.id },
    action,
    claimValidity,
    actorAttribution: { canonicalName, aliases },
    supportingEvidenceIds,
    contradictoryEvidenceIds,
    uncertainty,
    rationale,
    confidence: value.confidence,
    calibrationContext: sanitizeRecord(value.calibrationContext)
  };
}

function persistClaimDecision(store: any, task: AutomaticReviewTask, decision: AutomaticReviewDecision, at: string, reviewer = `hanasand-ai:automatic:${task.requestedModelVersion}`, idKind = "model") {
  const claimId = task.subject.claimId!;
  const id = idKind === "model" ? stableId("automatic-claim-review", task.id) : stableId("automatic-claim-review", `${task.id}:${idKind}`);
  if (store.getClaimReview?.(id)) return;
  store.saveClaimReview({
    id,
    tenantId: task.tenantId,
    claimId,
    action: decision.action,
    reviewerId: reviewer,
    reason: `${decision.rationale} Evidence: ${[...decision.supportingEvidenceIds, ...decision.contradictoryEvidenceIds].join(", ") || "none"}`.slice(0, 1_000),
    reviewedAt: at,
    modelVersion: decision.modelVersion,
    promptVersion: decision.promptVersion,
    responseSchemaVersion: decision.schemaVersion,
    evidenceIds: task.evidenceIds,
    automaticDecision: decision,
    calibrationContext: decision.calibrationContext
  });
}

function policyQuarantineDecision(task: AutomaticReviewTask): AutomaticReviewDecision {
  return {
    schemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
    promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION,
    modelVersion: task.requestedModelVersion,
    subject: { type: task.subject.type, id: task.subject.id },
    action: "mark_needs_review",
    claimValidity: "uncertain",
    actorAttribution: { canonicalName: null, aliases: [] },
    supportingEvidenceIds: [],
    contradictoryEvidenceIds: [],
    uncertainty: ["No governed evidence is linked to the subject"],
    rationale: "Automatic review was quarantined because no governed evidence was available.",
    confidence: 0,
    calibrationContext: { evidenceCount: 0, policyGate: "missing_governed_evidence" }
  };
}

function governedEvidence(store: any, subject: AutomaticReviewTask["subject"]): GovernedEvidence[] {
  const claim = subject.claimId ? store.getIntelligenceClaim?.(subject.claimId) : undefined;
  const incident = subject.incidentId ? store.getIncident?.(subject.incidentId) : claim?.subjectType === "incident" ? store.getIncident?.(claim.subjectId) : undefined;
  const records = subject.claimId
    ? (store.listClaimEvidence?.() ?? []).filter((item: any) => item.claimId === subject.claimId)
    : incident?.captureId ? [{ id: stableId("incident-evidence", `${incident.id}:${incident.captureId}`), captureId: incident.captureId, sourceId: incident.sourceId, relationship: "supports", evidenceStage: "captured_incident", confidence: incident.confidence }] : [];
  return records.flatMap((record: any) => {
    const capture = store.getCapture?.(record.captureId);
    const source = store.getSource?.(record.sourceId ?? capture?.sourceId);
    if (!capture || !source || (capture.tenantId || undefined) !== (subjectTenant(store, subject) || undefined)) return [];
    const safeExcerpt = safeText(capture.metadata?.safeExcerpt ?? incident?.summary ?? claim?.summary, 600);
    return [{
      id: String(record.id),
      relationship: safeText(record.relationship, 80) ?? "supports",
      evidenceStage: safeText(record.evidenceStage, 80) ?? "unknown",
      confidence: finiteScore(record.confidence),
      source: { id: source.id, name: safeText(source.name, 180), type: safeText(source.type, 80), trustScore: finiteScore(source.trustScore) },
      capture: { id: capture.id, title: safeText(capture.title, 240), safeExcerpt, publishedAt: validIso(capture.publishedAt), collectedAt: validIso(capture.collectedAt), storageKind: safeText(capture.storageKind, 80) }
    }];
  }).slice(0, 50);
}

function replayAutomaticReview(options: ApiServerOptions, taskId: string, tenantId?: string): AutomaticReviewTask | Response {
  const store = options.store as any;
  const current = store.getAnalystMetadataReviewTask?.(taskId) as AutomaticReviewTask | undefined;
  if (!current || current.recordKind !== TASK_KIND || !inTenantScope(current, tenantId)) return error("automatic_review_not_found", "Automatic review task not found", 404);
  if (!["dead_letter", "quarantined"].includes(current.state)) return error("automatic_review_not_replayable", "Only dead-lettered or quarantined tasks may be replayed", 409);
  const at = nowIso();
  const evidence = governedEvidence(store, current.subject);
  const replayed = saveTask(store, current, {
    state: "queued",
    attempt: 0,
    replayCount: current.replayCount + 1,
    evidence,
    evidenceIds: evidence.map((item) => item.id),
    queuedAt: at,
    nextAttemptAt: at,
    updatedAt: at,
    completedAt: undefined,
    leaseExpiresAt: undefined,
    lastError: undefined,
    decision: undefined,
    outcome: undefined
  });
  saveEvent(store, replayed, "replayed", at);
  return replayed;
}

function recoverExpiredLeases(store: any, at: string, input: Pick<CycleInput, "tenantId" | "allTenants">) {
  for (const task of tasks(store)) {
    if ((!input.allTenants && !inTenantScope(task, input.tenantId)) || task.state !== "running" || !task.leaseExpiresAt || Date.parse(task.leaseExpiresAt) > Date.parse(at)) continue;
    const recovered = saveTask(store, task, { state: "retrying", nextAttemptAt: at, leaseExpiresAt: undefined, updatedAt: at, lastError: "Worker lease expired before a terminal decision was persisted" });
    saveEvent(store, recovered, "restart_recovered", at);
  }
}

function claimEligible(store: any, claim: any, modelVersion: string) {
  const reviews = (store.listClaimReviews?.() ?? []).filter((review: any) => review.claimId === claim.id);
  if (reviews.some((review: any) => terminalAction(review.action) && !String(review.reviewerId ?? "").startsWith("hanasand-ai:"))) return false;
  const latestAutomatic = reviews.filter((review: any) => String(review.reviewerId ?? "").startsWith("hanasand-ai:automatic:")).sort((left: any, right: any) => Date.parse(right.reviewedAt) - Date.parse(left.reviewedAt))[0];
  if (latestAutomatic) return latestAutomatic.modelVersion !== modelVersion || latestAutomatic.promptVersion !== AUTOMATIC_REVIEW_PROMPT_VERSION;
  return ["unreviewed", "needs_review", undefined].includes(claim.reviewState);
}

function hasHumanTerminalReview(store: any, claimId: string) {
  return (store.listClaimReviews?.() ?? []).some((review: any) => review.claimId === claimId && terminalAction(review.action) && !String(review.reviewerId ?? "").startsWith("hanasand-ai:"));
}

function terminalAction(action: string) { return ["confirm", "reject", "correct", "mark_contradicted"].includes(action); }
function configuredModelVersion(options: ApiServerOptions) { return cleanModelVersion((options as any).automaticReviewModelVersion) ?? cleanModelVersion(Bun.env.HANASAND_AI_MODEL) ?? "hanasand"; }
function cleanModelVersion(value: unknown) { const text = typeof value === "string" ? value.trim() : ""; return /^[A-Za-z0-9_.:@/-]{1,120}$/.test(text) ? text : undefined; }
function subjectTenant(store: any, subject: AutomaticReviewTask["subject"]) { return (subject.claimId ? store.getIntelligenceClaim?.(subject.claimId) : store.getIncident?.(subject.incidentId))?.tenantId; }
function tasks(store: any): AutomaticReviewTask[] { return (store.listAnalystMetadataReviewTasks?.() ?? []).filter((item: any) => item.recordKind === TASK_KIND); }
function events(store: any): any[] { return (store.listAnalystMetadataReviewTasks?.() ?? []).filter((item: any) => item.recordKind === EVENT_KIND); }
function saveTask(store: any, task: AutomaticReviewTask, changes: Partial<AutomaticReviewTask>): AutomaticReviewTask { return store.saveAnalystMetadataReviewTask({ ...task, ...changes, unsafeMaterialAccessed: false }); }

function saveEvent(store: any, task: AutomaticReviewTask, state: string, occurredAt: string, decision?: AutomaticReviewDecision) {
  const id = stableId("automatic-review-event", `${task.id}:${task.replayCount}:${task.attempt}:${state}`);
  const existing = store.getAnalystMetadataReviewTask?.(id);
  if (existing) return existing;
  return store.saveAnalystMetadataReviewTask({
    id,
    recordKind: EVENT_KIND,
    schemaVersion: "ti.automatic_intelligence_review.event.v1",
    tenantId: task.tenantId,
    taskId: task.id,
    subject: task.subject,
    state,
    attempt: task.attempt,
    replayCount: task.replayCount,
    occurredAt,
    modelVersion: task.requestedModelVersion,
    promptVersion: task.promptVersion,
    responseSchemaVersion: task.responseSchemaVersion,
    evidenceIds: task.evidenceIds,
    decision,
    error: task.lastError,
    unsafeMaterialAccessed: false,
    createdAt: occurredAt,
    updatedAt: occurredAt
  });
}

function idArray(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.has(item))) throw new ModelOutputError("Hanasand AI referenced evidence outside the governed request");
  return [...new Set(value)];
}
function stringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new ModelOutputError("Hanasand AI returned an invalid string list");
  const items = value.map((item) => safeText(item, maxLength));
  if (items.some((item) => item === undefined)) throw new ModelOutputError("Hanasand AI returned unsafe or invalid text");
  return [...new Set(items as string[])];
}
function safeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\0/g, "").replace(/\s+/g, " ").trim();
  if (!text || text.length > maxLength || /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:password|passwd|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*\S+/i.test(text)) return undefined;
  return text;
}
function finiteScore(value: unknown) { const score = Number(value); return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : undefined; }
function validIso(value: unknown) { const parsed = Date.parse(String(value ?? "")); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined; }
function retryDelayMs(attempt: number) { return Math.min(15 * 60_000, 60_000 * (2 ** Math.max(0, attempt - 1))); }
function boundedInteger(value: unknown, fallback: number, min: number, max: number) { const parsed = Number(value); return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
function plainRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function sanitizeRecord(value: Record<string, unknown>) {
  const entries: Array<[string, string | number | boolean | null]> = [];
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(key)) continue;
    if (typeof item === "number" || typeof item === "boolean" || item === null) entries.push([key, item]);
    else {
      const text = safeText(item, 300);
      if (text) entries.push([key, text]);
    }
  }
  return Object.fromEntries(entries);
}
function safeError(value: unknown) { return safeText(value instanceof Error ? value.message : String(value), 300) ?? "Automatic review failed"; }

class ModelOutputError extends Error {}
