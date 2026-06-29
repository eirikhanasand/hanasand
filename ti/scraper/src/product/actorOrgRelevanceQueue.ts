import {
  buildActorOrgRelevanceReadinessReport,
  publicTiOrgRelevanceToAnalystHandoff,
  type ActorOrgRelevanceReadinessRow,
  type ActorOrgRelevanceHandoffValue,
  type AnalystHandoffAdapterResult,
  type PublicTiOrgRelevanceProofLike
} from "./analystHandoff.ts";
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
  eventType: "submitted" | "blocked" | "ready" | "assigned" | "reviewing" | "escalated" | "suppressed" | "closed" | "note_added";
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
