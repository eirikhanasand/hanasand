import {
  buildActorOrgRelevanceReadinessReport,
  publicTiOrgRelevanceToAnalystHandoff,
  type ActorOrgRelevanceReadinessRow,
  type ActorOrgRelevanceHandoffValue,
  type AnalystHandoffAdapterResult,
  type PublicTiOrgRelevanceProofLike
} from "./analystHandoff.ts";
import type { DwmWatchTerm } from "./dwmProduct.ts";
import { nowIso, stableId, uniqueStrings } from "../utils.ts";

export const ACTOR_ORG_RELEVANCE_REVIEW_SCHEMA_VERSION = "hanasand.actor_org_relevance.review.v1" as const;
export const ACTOR_ORG_RELEVANCE_QUEUE_SCHEMA_VERSION = "hanasand.actor_org_relevance.queue.v1" as const;

export type ActorOrgRelevanceReviewRecord = {
  schemaVersion: typeof ACTOR_ORG_RELEVANCE_REVIEW_SCHEMA_VERSION;
  id: string;
  tenantId: string;
  organizationId: string;
  actorId: string;
  query: string;
  state: "ready" | "blocked";
  requestedByUserId?: string;
  submittedAt: string;
  updatedAt: string;
  orgRelevance: PublicTiOrgRelevanceProofLike;
  readiness: ActorOrgRelevanceReadinessRow;
  handoff?: ActorOrgRelevanceHandoffValue;
  partialHandoff?: Partial<ActorOrgRelevanceHandoffValue>;
  workflow: ActorOrgRelevanceWorkflowState;
  notes: ActorOrgRelevanceNote[];
  alertGenerationReceipts: ActorOrgRelevanceAlertGenerationReceipt[];
  caseHandoffReceipts: ActorOrgRelevanceCaseHandoffReceipt[];
  webhookTriggerReceipts: ActorOrgRelevanceWebhookTriggerReceipt[];
  nextActions: ActorOrgRelevanceNextAction[];
  timeline: ActorOrgRelevanceTimelineEvent[];
};

export type ActorOrgRelevanceReviewSummary = {
  id: string;
  tenantId: string;
  organizationId: string;
  actorId: string;
  query: string;
  state: ActorOrgRelevanceReviewRecord["state"];
  requestedByUserId?: string;
  submittedAt: string;
  updatedAt: string;
  affected: {
    vendors: string[];
    domains: string[];
    regions: string[];
  };
  sourceEvidenceCount: number;
  provenance: ActorOrgRelevanceReadinessRow["provenance"];
  handoffs: ActorOrgRelevanceReadinessRow["handoffs"];
  blockerCodes: string[];
  workflow: ActorOrgRelevanceWorkflowState;
  latestAlertGeneration?: ActorOrgRelevanceAlertGenerationReceipt;
  latestCaseHandoff?: ActorOrgRelevanceCaseHandoffReceipt;
  latestWebhookTrigger?: ActorOrgRelevanceWebhookTriggerReceipt;
  nextActions: ActorOrgRelevanceNextAction[];
  routes: {
    publicTi: string;
    watchlist?: string;
    alert?: string;
    case?: string;
    webhook?: string;
  };
};

export type ActorOrgRelevanceNextAction = {
  code: string;
  ownerLane: string;
  label: string;
  route?: string;
  recoverable: boolean;
};

export type ActorOrgRelevanceTimelineEvent = {
  id: string;
  occurredAt: string;
  actorId?: string;
  eventType: "submitted" | "blocked" | "ready" | "assigned" | "reviewing" | "escalated" | "suppressed" | "closed" | "note_added" | "watchlist_materialized" | "alert_generation_requested" | "case_handoff_requested" | "webhook_trigger_prepared";
  summary: string;
  blockerCodes: string[];
};

export type ActorOrgRelevanceWorkflowStatus = "new" | "reviewing" | "escalated" | "suppressed" | "closed";

export type ActorOrgRelevanceWorkflowDecision =
  | "true_positive"
  | "false_positive"
  | "needs_collection"
  | "duplicate"
  | "customer_notified";

export type ActorOrgRelevanceWorkflowState = {
  status: ActorOrgRelevanceWorkflowStatus;
  assignedTo?: string;
  decision?: ActorOrgRelevanceWorkflowDecision;
  rationale?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type ActorOrgRelevanceNote = {
  id: string;
  authorId?: string;
  createdAt: string;
  body: string;
};

export type ActorOrgRelevanceWorkflowUpdateInput = {
  action: "assign" | "review" | "escalate" | "suppress" | "close" | "reopen" | "note";
  actorId?: string;
  assignedTo?: string;
  decision?: ActorOrgRelevanceWorkflowDecision;
  rationale?: string;
  note?: string;
  generatedAt?: string;
};

export type ActorOrgRelevanceWorkflowUpdateResult =
  | { ok: true; record: ActorOrgRelevanceReviewRecord }
  | { ok: false; code: string; message: string };

export type ActorOrgRelevanceMaterializedWatchlist = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  terms: DwmWatchTerm[];
  webhookDestinationId?: string;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
  source: "public_ti_actor_org_relevance";
  actorOrgRelevanceReviewId: string;
  actorId: string;
  query: string;
  provenance: Array<{
    sourceId?: string;
    sourceName: string;
    captureId?: string;
    provenance: string;
    confidence?: number;
  }>;
  publicTiHandoffId?: string;
};

export type ActorOrgRelevanceMaterializeWatchlistInput = {
  actorId?: string;
  watchlistId?: string;
  webhookDestinationId?: string;
  generatedAt?: string;
};

export type ActorOrgRelevanceMaterializeWatchlistResult =
  | { ok: true; record: ActorOrgRelevanceReviewRecord; watchlist: ActorOrgRelevanceMaterializedWatchlist; created: boolean; changed: boolean }
  | { ok: false; code: string; message: string };

export type ActorOrgRelevanceAlertGenerationReceipt = {
  schemaVersion: "hanasand.actor_org_relevance.alert_generation_receipt.v1";
  id: string;
  tenantId: string;
  organizationId: string;
  reviewId: string;
  actorId: string;
  query: string;
  createdAt: string;
  createdBy?: string;
  idempotencyKey: string;
  request: {
    method: "POST";
    path: "/v1/dwm/alerts/rebuild";
    body: {
      tenantId: string;
      organizationId?: string;
      watchlistId: string;
      watchlistItemIds: string[];
      publicTiHandoffId?: string;
      actorOrgRelevanceReviewId: string;
    };
  };
  watchlist: {
    id: string;
    terms: DwmWatchTerm[];
    provenanceCount: number;
  };
  downstream: {
    casePath?: string;
    webhookDestinationIds: string[];
    captureIds: string[];
    sourceIds: string[];
  };
  provenance: ActorOrgRelevanceMaterializedWatchlist["provenance"];
};

export type ActorOrgRelevanceAlertGenerationRequestInput = {
  actorId?: string;
  generatedAt?: string;
};

export type ActorOrgRelevanceAlertGenerationRequestResult =
  | { ok: true; record: ActorOrgRelevanceReviewRecord; receipt: ActorOrgRelevanceAlertGenerationReceipt; created: boolean }
  | { ok: false; code: string; message: string };

export type ActorOrgRelevanceCaseHandoffReceipt = {
  schemaVersion: "hanasand.actor_org_relevance.case_handoff_receipt.v1";
  id: string;
  tenantId: string;
  organizationId: string;
  reviewId: string;
  actorId: string;
  query: string;
  createdAt: string;
  createdBy?: string;
  alertGenerationReceiptId: string;
  idempotencyKey: string;
  request: {
    method: "POST";
    path: "/v1/cases";
    body: ActorOrgRelevanceHandoffValue["caseHandoff"]["request"]["body"] & {
      actorOrgRelevanceReviewId: string;
      alertGenerationReceiptId: string;
    };
  };
  routing: {
    casePath: string;
    alertId: string;
    recommendedRoute: string;
    priority: string;
  };
  provenance: {
    captureIds: string[];
    sourceIds: string[];
    sourceFamilies: string[];
    evidenceCount: number;
  };
};

export type ActorOrgRelevanceCaseHandoffRequestInput = {
  actorId?: string;
  generatedAt?: string;
};

export type ActorOrgRelevanceCaseHandoffRequestResult =
  | { ok: true; record: ActorOrgRelevanceReviewRecord; receipt: ActorOrgRelevanceCaseHandoffReceipt; created: boolean }
  | { ok: false; code: string; message: string };

export type ActorOrgRelevanceWebhookTriggerReceipt = {
  schemaVersion: "hanasand.actor_org_relevance.webhook_trigger_receipt.v1";
  id: string;
  tenantId: string;
  organizationId: string;
  reviewId: string;
  actorId: string;
  query: string;
  createdAt: string;
  createdBy?: string;
  caseHandoffReceiptId: string;
  idempotencyKey: string;
  request: {
    method: "POST";
    path: "/v1/dwm/webhooks/deliver";
    body: ActorOrgRelevanceHandoffValue["webhookTrigger"]["request"]["body"] & {
      actorOrgRelevanceReviewId: string;
      caseHandoffReceiptId: string;
    };
  };
  destination: {
    webhookDestinationIds: string[];
    dryRun: boolean;
  };
  provenance: {
    alertId: string;
    dedupeKey: string;
    captureIds: string[];
    evidenceCount: number;
    casePath?: string;
    sourceIds: string[];
    sourceFamilies: string[];
  };
};

export type ActorOrgRelevanceWebhookTriggerRequestInput = {
  actorId?: string;
  dryRun?: boolean;
  generatedAt?: string;
};

export type ActorOrgRelevanceWebhookTriggerRequestResult =
  | { ok: true; record: ActorOrgRelevanceReviewRecord; receipt: ActorOrgRelevanceWebhookTriggerReceipt; created: boolean }
  | { ok: false; code: string; message: string };

export type ActorOrgRelevanceQueue = {
  schemaVersion: typeof ACTOR_ORG_RELEVANCE_QUEUE_SCHEMA_VERSION;
  generatedAt: string;
  tenantId: string;
  organizationId: string;
  counts: {
    total: number;
    ready: number;
    blocked: number;
    assigned: number;
    reviewing: number;
    escalated: number;
    suppressed: number;
    closed: number;
  };
  records: ActorOrgRelevanceReviewSummary[];
};

export function buildActorOrgRelevanceReviewRecord(input: {
  tenantId?: string;
  organizationId?: string;
  requestedByUserId?: string;
  orgRelevance: PublicTiOrgRelevanceProofLike;
  staleEvidenceBefore?: string;
  generatedAt?: string;
  existing?: ActorOrgRelevanceReviewRecord;
}): ActorOrgRelevanceReviewRecord {
  const generatedAt = input.generatedAt || nowIso();
  const tenantId = input.tenantId || orgTenantId(input.orgRelevance);
  const organizationId = input.organizationId || orgOrganizationId(input.orgRelevance);
  const handoff = publicTiOrgRelevanceToAnalystHandoff({
    tenantId,
    organizationId,
    requestedByUserId: input.requestedByUserId,
    orgRelevance: input.orgRelevance,
    staleEvidenceBefore: input.staleEvidenceBefore
  });
  const readiness = buildActorOrgRelevanceReadinessReport({
    checkedAt: generatedAt,
    staleEvidenceBefore: input.staleEvidenceBefore,
    results: [{
      orgRelevance: input.orgRelevance,
      tenantId,
      organizationId,
      requestedByUserId: input.requestedByUserId
    }]
  }).rows[0];
  const state = handoff.ok ? "ready" : "blocked";
  const id = stableId("actor_org_relevance_review", `${tenantId}:${organizationId}:${input.orgRelevance.actorId}:${input.orgRelevance.query}`);
  const timelineEvent = buildTimelineEvent({
    id,
    generatedAt,
    requestedByUserId: input.requestedByUserId,
    state,
    blockerCodes: readiness.blockers.map((blocker) => blocker.code)
  });

  return {
    schemaVersion: ACTOR_ORG_RELEVANCE_REVIEW_SCHEMA_VERSION,
    id,
    tenantId,
    organizationId,
    actorId: input.orgRelevance.actorId,
    query: input.orgRelevance.query,
    state,
    requestedByUserId: input.requestedByUserId || input.existing?.requestedByUserId,
    submittedAt: input.existing?.submittedAt || generatedAt,
    updatedAt: generatedAt,
    orgRelevance: input.orgRelevance,
    readiness,
    handoff: handoff.ok ? handoff.value : undefined,
    partialHandoff: handoff.ok ? undefined : partialHandoff(handoff),
    workflow: input.existing?.workflow ?? { status: "new", updatedAt: generatedAt },
    notes: input.existing?.notes ?? [],
    alertGenerationReceipts: input.existing?.alertGenerationReceipts ?? [],
    caseHandoffReceipts: input.existing?.caseHandoffReceipts ?? [],
    webhookTriggerReceipts: input.existing?.webhookTriggerReceipts ?? [],
    nextActions: nextActionsForReadiness(readiness),
    timeline: [...(input.existing?.timeline ?? []), timelineEvent]
  };
}

export function summarizeActorOrgRelevanceReview(record: ActorOrgRelevanceReviewRecord): ActorOrgRelevanceReviewSummary {
  return {
    id: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    actorId: record.actorId,
    query: record.query,
    state: record.state,
    requestedByUserId: record.requestedByUserId,
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
    affected: {
      vendors: affectedValues(record.orgRelevance.affectedEntities?.vendors),
      domains: affectedValues(record.orgRelevance.affectedEntities?.domains),
      regions: affectedValues(record.orgRelevance.affectedEntities?.regions)
    },
    sourceEvidenceCount: record.readiness.coverage.sourceEvidence,
    provenance: record.readiness.provenance,
    handoffs: record.readiness.handoffs,
    blockerCodes: uniqueStrings(record.readiness.blockers.map((blocker) => blocker.code)),
    workflow: record.workflow,
    latestAlertGeneration: record.alertGenerationReceipts.at(-1),
    latestCaseHandoff: record.caseHandoffReceipts.at(-1),
    latestWebhookTrigger: record.webhookTriggerReceipts.at(-1),
    nextActions: record.nextActions,
    routes: {
      publicTi: `/ti/${encodeURIComponent(record.query)}`,
      watchlist: record.handoff?.watchlist.request.path,
      alert: record.handoff?.alertGeneration.request.path,
      case: record.handoff?.caseHandoff.request.body.casePath,
      webhook: record.handoff?.webhookTrigger.request.path
    }
  };
}

export function buildActorOrgRelevanceQueue(input: {
  tenantId: string;
  organizationId: string;
  records: ActorOrgRelevanceReviewRecord[];
  generatedAt?: string;
  state?: "ready" | "blocked";
  workflowStatus?: ActorOrgRelevanceWorkflowStatus;
  query?: string;
}): ActorOrgRelevanceQueue {
  const normalizedQuery = input.query?.trim().toLowerCase();
  const scoped = input.records
    .filter((record) => record.tenantId === input.tenantId && record.organizationId === input.organizationId)
    .filter((record) => !input.state || record.state === input.state)
    .filter((record) => !input.workflowStatus || record.workflow.status === input.workflowStatus)
    .filter((record) => !normalizedQuery || record.query.toLowerCase().includes(normalizedQuery) || record.actorId.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    schemaVersion: ACTOR_ORG_RELEVANCE_QUEUE_SCHEMA_VERSION,
    generatedAt: input.generatedAt || nowIso(),
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    counts: {
      total: scoped.length,
      ready: scoped.filter((record) => record.state === "ready").length,
      blocked: scoped.filter((record) => record.state === "blocked").length,
      assigned: scoped.filter((record) => Boolean(record.workflow.assignedTo)).length,
      reviewing: scoped.filter((record) => record.workflow.status === "reviewing").length,
      escalated: scoped.filter((record) => record.workflow.status === "escalated").length,
      suppressed: scoped.filter((record) => record.workflow.status === "suppressed").length,
      closed: scoped.filter((record) => record.workflow.status === "closed").length
    },
    records: scoped.map(summarizeActorOrgRelevanceReview)
  };
}

export function actorOrgRelevanceRecordBelongsTo(record: ActorOrgRelevanceReviewRecord | undefined, input: { tenantId?: string; organizationId?: string }) {
  return Boolean(record && (!input.tenantId || record.tenantId === input.tenantId) && (!input.organizationId || record.organizationId === input.organizationId));
}

export function updateActorOrgRelevanceReviewWorkflow(
  record: ActorOrgRelevanceReviewRecord,
  input: ActorOrgRelevanceWorkflowUpdateInput
): ActorOrgRelevanceWorkflowUpdateResult {
  const generatedAt = input.generatedAt || nowIso();
  const actorId = input.actorId?.trim() || undefined;
  const note = cleanNote(input.note);
  const assignedTo = input.assignedTo?.trim() || undefined;
  const rationale = cleanNote(input.rationale);
  const nextWorkflow: ActorOrgRelevanceWorkflowState = { ...record.workflow };
  const notes = [...(record.notes ?? [])];

  if (!["assign", "review", "escalate", "suppress", "close", "reopen", "note"].includes(input.action)) {
    return { ok: false, code: "invalid_action", message: "Unsupported actor relevance workflow action." };
  }
  if (input.action === "assign" && !assignedTo) return { ok: false, code: "missing_assignee", message: "Assign requires assignedTo." };
  if ((input.action === "suppress" || input.action === "close") && !rationale && !note) return { ok: false, code: "missing_rationale", message: "Suppress and close require rationale or note." };

  if (input.action === "assign") {
    nextWorkflow.assignedTo = assignedTo;
  } else if (input.action === "review") {
    nextWorkflow.status = "reviewing";
  } else if (input.action === "escalate") {
    nextWorkflow.status = "escalated";
  } else if (input.action === "suppress") {
    nextWorkflow.status = "suppressed";
    nextWorkflow.decision = input.decision || "false_positive";
  } else if (input.action === "close") {
    nextWorkflow.status = "closed";
    nextWorkflow.decision = input.decision || "true_positive";
  } else if (input.action === "reopen") {
    nextWorkflow.status = "reviewing";
    nextWorkflow.decision = undefined;
  }

  if (rationale) nextWorkflow.rationale = rationale;
  nextWorkflow.updatedBy = actorId;
  nextWorkflow.updatedAt = generatedAt;

  if (note) {
    notes.push({
      id: stableId("actor_org_relevance_note", `${record.id}:${generatedAt}:${actorId || ""}:${note}`),
      authorId: actorId,
      createdAt: generatedAt,
      body: note
    });
  }

  const eventType = input.action === "assign"
    ? "assigned"
    : input.action === "note"
      ? "note_added"
      : input.action === "review"
        ? "reviewing"
        : input.action === "reopen"
          ? "reviewing"
          : input.action === "close"
            ? "closed"
            : input.action === "suppress"
              ? "suppressed"
              : "escalated";

  return {
    ok: true,
    record: {
      ...record,
      updatedAt: generatedAt,
      workflow: nextWorkflow,
      notes,
      timeline: [...record.timeline, {
        id: stableId("actor_org_relevance_timeline", `${record.id}:${generatedAt}:${eventType}:${actorId || ""}:${assignedTo || ""}:${rationale || note}`),
        occurredAt: generatedAt,
        actorId,
        eventType,
        summary: workflowSummary(input.action, nextWorkflow, assignedTo, Boolean(note)),
        blockerCodes: uniqueStrings(record.readiness.blockers.map((blocker) => blocker.code))
      }]
    }
  };
}

export function materializeActorOrgRelevanceWatchlist(input: {
  record: ActorOrgRelevanceReviewRecord;
  existing?: ActorOrgRelevanceMaterializedWatchlist;
  materialize?: ActorOrgRelevanceMaterializeWatchlistInput;
}): ActorOrgRelevanceMaterializeWatchlistResult {
  const record = input.record;
  if (record.state !== "ready" || !record.handoff) {
    return { ok: false, code: "review_not_ready", message: "Actor relevance review must be ready before creating a watchlist." };
  }
  const request = record.handoff.watchlist.request.body;
  const generatedAt = input.materialize?.generatedAt || nowIso();
  const id = input.materialize?.watchlistId
    || record.handoff.alertGeneration.request.body.watchlistId
    || stableId("dwm_watchlist", `${record.tenantId}:${request.terms.map((term) => term.value).join("|")}`);
  if (input.existing && (input.existing.tenantId !== record.tenantId || input.existing.organizationId !== record.organizationId)) {
    return { ok: false, code: "watchlist_scope_mismatch", message: "Existing watchlist belongs to another organization scope." };
  }
  const webhookDestinationId = input.materialize?.webhookDestinationId
    || record.handoff.webhookTrigger.request.body.webhookDestinationIds[0]
    || input.existing?.webhookDestinationId;
  const provenance = record.readiness.provenance.map((row) => ({
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    captureId: row.captureId,
    provenance: row.provenance,
    confidence: row.confidence
  }));
  const publicTiHandoffId = record.handoff.watchlist.handoff.handoffId;
  const watchlist: ActorOrgRelevanceMaterializedWatchlist = {
    ...input.existing,
    id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    name: input.existing?.name || request.name,
    terms: request.terms,
    webhookDestinationId,
    status: "active",
    createdAt: input.existing?.createdAt || generatedAt,
    updatedAt: generatedAt,
    source: "public_ti_actor_org_relevance",
    actorOrgRelevanceReviewId: record.id,
    actorId: record.actorId,
    query: record.query,
    provenance,
    publicTiHandoffId
  };
  const existingWatchlist = input.existing;
  const changed = !existingWatchlist || !sameMaterializedWatchlist(existingWatchlist, watchlist);
  if (!changed) {
    return {
      ok: true,
      created: false,
      changed: false,
      watchlist: existingWatchlist,
      record
    };
  }
  const timelineEvent: ActorOrgRelevanceTimelineEvent = {
    id: stableId("actor_org_relevance_timeline", `${record.id}:${generatedAt}:watchlist_materialized:${watchlist.id}`),
    occurredAt: generatedAt,
    actorId: input.materialize?.actorId,
    eventType: "watchlist_materialized",
    summary: `Created or updated DWM watchlist ${watchlist.id}.`,
    blockerCodes: uniqueStrings(record.readiness.blockers.map((blocker) => blocker.code))
  };
  return {
    ok: true,
    created: !input.existing,
    changed,
    watchlist,
    record: {
      ...record,
      updatedAt: generatedAt,
      workflow: {
        ...record.workflow,
        status: record.workflow.status === "new" ? "reviewing" : record.workflow.status,
        updatedBy: input.materialize?.actorId || record.workflow.updatedBy,
        updatedAt: generatedAt
      },
      timeline: [...record.timeline, timelineEvent]
    }
  };
}

function sameMaterializedWatchlist(left: ActorOrgRelevanceMaterializedWatchlist, right: ActorOrgRelevanceMaterializedWatchlist) {
  return left.id === right.id
    && left.tenantId === right.tenantId
    && left.organizationId === right.organizationId
    && left.name === right.name
    && left.webhookDestinationId === right.webhookDestinationId
    && left.status === right.status
    && left.source === right.source
    && left.actorOrgRelevanceReviewId === right.actorOrgRelevanceReviewId
    && left.actorId === right.actorId
    && left.query === right.query
    && left.publicTiHandoffId === right.publicTiHandoffId
    && JSON.stringify(left.terms) === JSON.stringify(right.terms)
    && JSON.stringify(left.provenance) === JSON.stringify(right.provenance);
}

export function createActorOrgRelevanceAlertGenerationRequest(input: {
  record: ActorOrgRelevanceReviewRecord;
  watchlist?: ActorOrgRelevanceMaterializedWatchlist;
  request?: ActorOrgRelevanceAlertGenerationRequestInput;
}): ActorOrgRelevanceAlertGenerationRequestResult {
  const record = input.record;
  if (record.state !== "ready" || !record.handoff) {
    return { ok: false, code: "review_not_ready", message: "Actor relevance review must be ready before requesting alert generation." };
  }
  const expectedWatchlistId = record.handoff.alertGeneration.request.body.watchlistId;
  if (!input.watchlist || input.watchlist.id !== expectedWatchlistId) {
    return { ok: false, code: "missing_watchlist_materialization", message: "Create the actor relevance watchlist before requesting alert generation." };
  }
  if (input.watchlist.tenantId !== record.tenantId || input.watchlist.organizationId !== record.organizationId) {
    return { ok: false, code: "watchlist_scope_mismatch", message: "Materialized watchlist belongs to another organization scope." };
  }
  const generatedAt = input.request?.generatedAt || nowIso();
  const body = {
    ...record.handoff.alertGeneration.request.body,
    actorOrgRelevanceReviewId: record.id
  };
  const idempotencyKey = stableId("actor_org_relevance_alert_generation_idempotency", `${record.tenantId}:${record.organizationId}:${record.id}:${expectedWatchlistId}`);
  const existingReceipt = record.alertGenerationReceipts.find((receipt) => receipt.idempotencyKey === idempotencyKey);
  if (existingReceipt) {
    return { ok: true, created: false, receipt: existingReceipt, record };
  }
  const receipt: ActorOrgRelevanceAlertGenerationReceipt = {
    schemaVersion: "hanasand.actor_org_relevance.alert_generation_receipt.v1",
    id: stableId("actor_org_relevance_alert_generation", `${record.id}:${expectedWatchlistId}:${generatedAt}`),
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    reviewId: record.id,
    actorId: record.actorId,
    query: record.query,
    createdAt: generatedAt,
    createdBy: input.request?.actorId,
    idempotencyKey,
    request: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body
    },
    watchlist: {
      id: input.watchlist.id,
      terms: input.watchlist.terms,
      provenanceCount: input.watchlist.provenance.length
    },
    downstream: {
      casePath: record.handoff.caseHandoff.request.body.casePath,
      webhookDestinationIds: record.handoff.webhookTrigger.request.body.webhookDestinationIds,
      captureIds: record.handoff.webhookTrigger.request.body.captureIds,
      sourceIds: uniqueStrings(input.watchlist.provenance.map((row) => row.sourceId).filter((value): value is string => Boolean(value)))
    },
    provenance: input.watchlist.provenance
  };
  return {
    ok: true,
    created: true,
    receipt,
    record: {
      ...record,
      updatedAt: generatedAt,
      workflow: {
        ...record.workflow,
        status: record.workflow.status === "new" ? "reviewing" : record.workflow.status,
        updatedBy: input.request?.actorId || record.workflow.updatedBy,
        updatedAt: generatedAt
      },
      alertGenerationReceipts: [...record.alertGenerationReceipts, receipt],
      timeline: [...record.timeline, {
        id: stableId("actor_org_relevance_timeline", `${record.id}:${generatedAt}:alert_generation_requested:${expectedWatchlistId}`),
        occurredAt: generatedAt,
        actorId: input.request?.actorId,
        eventType: "alert_generation_requested",
        summary: `Prepared alert rebuild request for watchlist ${expectedWatchlistId}.`,
        blockerCodes: uniqueStrings(record.readiness.blockers.map((blocker) => blocker.code))
      }]
    }
  };
}

export function createActorOrgRelevanceCaseHandoffRequest(input: {
  record: ActorOrgRelevanceReviewRecord;
  request?: ActorOrgRelevanceCaseHandoffRequestInput;
}): ActorOrgRelevanceCaseHandoffRequestResult {
  const record = input.record;
  if (record.state !== "ready" || !record.handoff) {
    return { ok: false, code: "review_not_ready", message: "Actor relevance review must be ready before requesting case handoff." };
  }
  const alertGenerationReceipt = record.alertGenerationReceipts.at(-1);
  if (!alertGenerationReceipt) {
    return { ok: false, code: "missing_alert_generation_receipt", message: "Prepare the alert generation request before creating a case handoff." };
  }
  const generatedAt = input.request?.generatedAt || nowIso();
  const caseBody = {
    ...record.handoff.caseHandoff.request.body,
    actorOrgRelevanceReviewId: record.id,
    alertGenerationReceiptId: alertGenerationReceipt.id
  };
  const sourceIds = uniqueStrings(alertGenerationReceipt.downstream.sourceIds);
  const idempotencyKey = stableId("actor_org_relevance_case_handoff_idempotency", `${record.tenantId}:${record.organizationId}:${record.id}:${alertGenerationReceipt.id}`);
  const existingReceipt = record.caseHandoffReceipts.find((receipt) => receipt.idempotencyKey === idempotencyKey);
  if (existingReceipt) {
    return { ok: true, created: false, receipt: existingReceipt, record };
  }
  const receipt: ActorOrgRelevanceCaseHandoffReceipt = {
    schemaVersion: "hanasand.actor_org_relevance.case_handoff_receipt.v1",
    id: stableId("actor_org_relevance_case_handoff", `${record.id}:${alertGenerationReceipt.id}:${generatedAt}`),
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    reviewId: record.id,
    actorId: record.actorId,
    query: record.query,
    createdAt: generatedAt,
    createdBy: input.request?.actorId,
    alertGenerationReceiptId: alertGenerationReceipt.id,
    idempotencyKey,
    request: {
      method: "POST",
      path: "/v1/cases",
      body: caseBody
    },
    routing: {
      casePath: record.handoff.caseHandoff.request.body.casePath,
      alertId: record.handoff.caseHandoff.request.body.alertId,
      recommendedRoute: record.handoff.caseHandoff.request.body.recommendedRoute,
      priority: record.handoff.caseHandoff.request.body.priority
    },
    provenance: {
      captureIds: record.handoff.caseHandoff.request.body.captureIds,
      sourceIds,
      sourceFamilies: uniqueStrings(record.handoff.caseHandoff.handoff.identity.sourceFamily ? [record.handoff.caseHandoff.handoff.identity.sourceFamily] : []),
      evidenceCount: record.handoff.webhookTrigger.request.body.evidenceCount
    }
  };
  return {
    ok: true,
    created: true,
    receipt,
    record: {
      ...record,
      updatedAt: generatedAt,
      workflow: {
        ...record.workflow,
        status: record.workflow.status === "new" ? "reviewing" : record.workflow.status,
        updatedBy: input.request?.actorId || record.workflow.updatedBy,
        updatedAt: generatedAt
      },
      caseHandoffReceipts: [...record.caseHandoffReceipts, receipt],
      timeline: [...record.timeline, {
        id: stableId("actor_org_relevance_timeline", `${record.id}:${generatedAt}:case_handoff_requested:${alertGenerationReceipt.id}`),
        occurredAt: generatedAt,
        actorId: input.request?.actorId,
        eventType: "case_handoff_requested",
        summary: `Prepared case handoff for ${receipt.routing.casePath}.`,
        blockerCodes: uniqueStrings(record.readiness.blockers.map((blocker) => blocker.code))
      }]
    }
  };
}

export function createActorOrgRelevanceWebhookTriggerRequest(input: {
  record: ActorOrgRelevanceReviewRecord;
  request?: ActorOrgRelevanceWebhookTriggerRequestInput;
}): ActorOrgRelevanceWebhookTriggerRequestResult {
  const record = input.record;
  if (record.state !== "ready" || !record.handoff) {
    return { ok: false, code: "review_not_ready", message: "Actor relevance review must be ready before preparing webhook delivery." };
  }
  const caseHandoffReceipt = record.caseHandoffReceipts.at(-1);
  if (!caseHandoffReceipt) {
    return { ok: false, code: "missing_case_handoff_receipt", message: "Prepare the case handoff before preparing webhook delivery." };
  }
  const generatedAt = input.request?.generatedAt || nowIso();
  const dryRun = input.request?.dryRun ?? true;
  const body = {
    ...record.handoff.webhookTrigger.request.body,
    dryRun,
    actorOrgRelevanceReviewId: record.id,
    caseHandoffReceiptId: caseHandoffReceipt.id
  };
  const idempotencyKey = stableId("actor_org_relevance_webhook_trigger_idempotency", `${record.tenantId}:${record.organizationId}:${record.id}:${caseHandoffReceipt.id}:${dryRun ? "dry_run" : "live"}`);
  const existingReceipt = record.webhookTriggerReceipts.find((receipt) => receipt.idempotencyKey === idempotencyKey);
  if (existingReceipt) {
    return { ok: true, created: false, receipt: existingReceipt, record };
  }
  const receipt: ActorOrgRelevanceWebhookTriggerReceipt = {
    schemaVersion: "hanasand.actor_org_relevance.webhook_trigger_receipt.v1",
    id: stableId("actor_org_relevance_webhook_trigger", `${record.id}:${caseHandoffReceipt.id}:${generatedAt}:${dryRun ? "dry_run" : "live"}`),
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    reviewId: record.id,
    actorId: record.actorId,
    query: record.query,
    createdAt: generatedAt,
    createdBy: input.request?.actorId,
    caseHandoffReceiptId: caseHandoffReceipt.id,
    idempotencyKey,
    request: {
      method: "POST",
      path: "/v1/dwm/webhooks/deliver",
      body
    },
    destination: {
      webhookDestinationIds: record.handoff.webhookTrigger.request.body.webhookDestinationIds,
      dryRun
    },
    provenance: {
      alertId: record.handoff.webhookTrigger.request.body.alertId,
      dedupeKey: record.handoff.webhookTrigger.request.body.dedupeKey,
      captureIds: record.handoff.webhookTrigger.request.body.captureIds,
      evidenceCount: record.handoff.webhookTrigger.request.body.evidenceCount,
      casePath: caseHandoffReceipt.routing.casePath,
      sourceIds: caseHandoffReceipt.provenance.sourceIds,
      sourceFamilies: caseHandoffReceipt.provenance.sourceFamilies
    }
  };
  return {
    ok: true,
    created: true,
    receipt,
    record: {
      ...record,
      updatedAt: generatedAt,
      workflow: {
        ...record.workflow,
        status: record.workflow.status === "new" ? "reviewing" : record.workflow.status,
        updatedBy: input.request?.actorId || record.workflow.updatedBy,
        updatedAt: generatedAt
      },
      webhookTriggerReceipts: [...record.webhookTriggerReceipts, receipt],
      timeline: [...record.timeline, {
        id: stableId("actor_org_relevance_timeline", `${record.id}:${generatedAt}:webhook_trigger_prepared:${caseHandoffReceipt.id}:${dryRun ? "dry_run" : "live"}`),
        occurredAt: generatedAt,
        actorId: input.request?.actorId,
        eventType: "webhook_trigger_prepared",
        summary: `Prepared webhook ${dryRun ? "dry run" : "delivery"} for ${receipt.destination.webhookDestinationIds.join(",")}.`,
        blockerCodes: uniqueStrings(record.readiness.blockers.map((blocker) => blocker.code))
      }]
    }
  };
}

function orgTenantId(orgRelevance: PublicTiOrgRelevanceProofLike) {
  return orgRelevance.organizationRefs?.find((ref) => ref.tenantId)?.tenantId
    || orgRelevance.alertCaseRefs?.find((ref) => ref.tenantId)?.tenantId
    || "default";
}

function orgOrganizationId(orgRelevance: PublicTiOrgRelevanceProofLike) {
  return orgRelevance.organizationRefs?.find((ref) => ref.organizationId)?.organizationId
    || orgRelevance.alertCaseRefs?.find((ref) => ref.organizationId)?.organizationId
    || "";
}

function partialHandoff(handoff: AnalystHandoffAdapterResult<ActorOrgRelevanceHandoffValue>) {
  return handoff.ok ? undefined : handoff.partial;
}

function nextActionsForReadiness(readiness: ActorOrgRelevanceReadinessRow): ActorOrgRelevanceNextAction[] {
  return readiness.blockers.map((blocker) => ({
    code: blocker.code,
    ownerLane: blocker.ownerLane,
    label: blocker.action || blocker.detail,
    route: blocker.route,
    recoverable: blocker.recoverable
  }));
}

function buildTimelineEvent(input: {
  id: string;
  generatedAt: string;
  requestedByUserId?: string;
  state: ActorOrgRelevanceReviewRecord["state"];
  blockerCodes: string[];
}): ActorOrgRelevanceTimelineEvent {
  const eventType = input.state === "ready" ? "ready" : "blocked";
  const blockerCodes = uniqueStrings(input.blockerCodes);
  return {
    id: stableId("actor_org_relevance_timeline", `${input.id}:${input.generatedAt}:${eventType}:${blockerCodes.join(",")}`),
    occurredAt: input.generatedAt,
    actorId: input.requestedByUserId,
    eventType,
    summary: eventType === "ready"
      ? "Actor relevance is ready for watchlist, alert, case, and webhook handoff."
      : `Actor relevance needs ${blockerCodes.length} fix${blockerCodes.length === 1 ? "" : "es"} before handoff.`,
    blockerCodes
  };
}

function affectedValues(rows: Array<{ value: string }> | undefined) {
  return uniqueStrings((rows ?? []).map((row) => row.value));
}

function cleanNote(value: string | undefined) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 2000) : "";
}

function workflowSummary(
  action: ActorOrgRelevanceWorkflowUpdateInput["action"],
  workflow: ActorOrgRelevanceWorkflowState,
  assignedTo: string | undefined,
  hasNote: boolean
) {
  if (action === "assign") return `Assigned to ${assignedTo}.`;
  if (action === "review") return "Review started.";
  if (action === "escalate") return "Escalated for follow-up.";
  if (action === "suppress") return `Suppressed as ${workflow.decision}.`;
  if (action === "close") return `Closed as ${workflow.decision}.`;
  if (action === "reopen") return "Reopened for review.";
  return hasNote ? "Note added." : "Workflow updated.";
}
