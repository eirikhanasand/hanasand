import type { SourceRecord, SourceStatus } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import type { SourceCutoverRehearsalReport } from "./sourceCutover.ts";

export type SourceApplyPlanAction =
  | "approve"
  | "activate"
  | "quarantine"
  | "restore"
  | "retire"
  | "request_legal_notes"
  | "leave_unchanged";

export type SourceApplyPlanAutomation = "automation_safe" | "human_approval_required" | "blocked" | "rollback_only";

export interface SourceApplyPlanPrerequisite {
  code: string;
  satisfied: boolean;
  reason: string;
}

export interface SourceApplyPlanExpectedDiff {
  field: string;
  before?: unknown;
  after?: unknown;
}

export interface SourceApplyPlanItem {
  id: string;
  sourceId: string;
  sourceName?: string;
  action: SourceApplyPlanAction;
  automation: SourceApplyPlanAutomation;
  dryRun: true;
  prerequisites: SourceApplyPlanPrerequisite[];
  expectedRegistryDiff: SourceApplyPlanExpectedDiff[];
  rollbackState: {
    canRollback: boolean;
    rollbackToStatus?: SourceStatus;
    quarantineState?: "none" | "recommended" | "required";
    reason: string;
  };
  policyImpact: {
    riskChange: "none" | "low_to_public" | "approval_refresh" | "containment" | "restricted_blocked";
    requiresLegalReview: boolean;
    metadataOnlyRequired: boolean;
  };
  collectionImpact: {
    willStartCrawling: false;
    enablesCollection: boolean;
    disablesCollection: boolean;
    remainsDisabled: string[];
  };
  reason: string;
}

export interface SourceApplyPlanExecutionResult {
  dryRun: true;
  executed: false;
  itemResults: Array<{
    itemId: string;
    sourceId: string;
    action: SourceApplyPlanAction;
    wouldApply: boolean;
    blocked: boolean;
    reason: string;
  }>;
}

export interface SourceApplyPlan {
  id: string;
  generatedAt: string;
  tenantId?: string;
  dryRun: true;
  willMutate: false;
  sourceCount: number;
  items: SourceApplyPlanItem[];
  summary: Record<SourceApplyPlanAction, number>;
  automationSummary: Record<SourceApplyPlanAutomation, number>;
  promotionGate: {
    gate: "source_apply_plan_ready";
    ready: boolean;
    unappliedChangeCount: number;
    humanApprovalRequiredCount: number;
    blockedCount: number;
    willStartCrawling: false;
  };
}

export interface SourceApplyPlanApiRequestDto {
  tenantId?: string;
  queryScope: {
    queries: string[];
    entityTypes?: string[];
  };
  sourcePackIds: string[];
  selectedActions?: SourceApplyPlanAction[];
  dryRun: true;
  includeExecutionPreview?: boolean;
}

export interface SourceApplyPlanApiItemDto {
  itemId: string;
  sourceId: string;
  sourceName?: string;
  action: SourceApplyPlanAction;
  automation: SourceApplyPlanAutomation;
  approvalRequired: boolean;
  blocked: boolean;
  prerequisiteFailures: string[];
  expectedDiffCount: number;
  policyImpact: SourceApplyPlanItem["policyImpact"];
  collectionImpact: SourceApplyPlanItem["collectionImpact"];
  rollback: SourceApplyPlanItem["rollbackState"];
  reason: string;
}

export interface SourceApplyPlanApiResponseDto {
  apiVersion: "v1";
  endpoint: "/v1/sources/apply-plan";
  applyPlanId: string;
  generatedAt: string;
  tenantId?: string;
  dryRun: true;
  willMutate: false;
  willStartCrawling: false;
  request: SourceApplyPlanApiRequestDto;
  summary: SourceApplyPlan["summary"];
  automationSummary: SourceApplyPlan["automationSummary"];
  approvalSummary: {
    approvalsRequired: number;
    legalReviewRequired: number;
    blocked: number;
    rollbackOnly: number;
  };
  items: SourceApplyPlanApiItemDto[];
  executionPreview?: SourceApplyPlanExecutionResult;
  promotionPacketLink: {
    field: "sourceApplyPlanId";
    value: string;
    gate: SourceApplyPlan["promotionGate"]["gate"];
    ready: boolean;
    unappliedChangeCount: number;
  };
  schemaExamples: SourceApplyPlanApiExample[];
}

export interface SourceApplyPlanApiExample {
  name: "happy_path" | "human_approval_required" | "blocked_restricted_source" | "duplicate_source" | "stale_legal_notes" | "rollback_only_quarantine";
  description: string;
  request: SourceApplyPlanApiRequestDto;
  response: Pick<
    SourceApplyPlanApiResponseDto,
    "apiVersion" | "endpoint" | "dryRun" | "willMutate" | "willStartCrawling" | "approvalSummary" | "promotionPacketLink"
  > & {
    exampleItem: SourceApplyPlanApiItemDto;
  };
}

const ACTIONS: SourceApplyPlanAction[] = ["approve", "activate", "quarantine", "restore", "retire", "request_legal_notes", "leave_unchanged"];
const AUTOMATION_STATES: SourceApplyPlanAutomation[] = ["automation_safe", "human_approval_required", "blocked", "rollback_only"];

export function buildSourceApplyPlan(input: {
  rehearsal: SourceCutoverRehearsalReport;
  sources: SourceRecord[];
  generatedAt?: string;
}): SourceApplyPlan {
  const generatedAt = input.generatedAt ?? nowIso();
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const items = dedupeItems([
    ...input.rehearsal.governanceEvidence.flatMap((evidence) =>
      evidence.sourceIds.map((sourceId) => itemFromEvidence(sourceById.get(sourceId), sourceId, evidence.reason, actionForEvidence(evidence.kind, evidence.rollbackState.quarantineRecommended), generatedAt))
    ),
    ...input.rehearsal.reconciliation.reviewPlans.flatMap((plan) =>
      plan.sourceIds.map((sourceId) => itemFromReviewPlan(sourceById.get(sourceId), sourceId, plan.action, plan.reason, generatedAt))
    ),
    ...input.sources
      .filter((source) => !input.rehearsal.governanceEvidence.some((evidence) => evidence.sourceIds.includes(source.id)))
      .map((source) => leaveUnchangedItem(source, generatedAt))
  ]);
  const summary = Object.fromEntries(ACTIONS.map((action) => [action, items.filter((item) => item.action === action).length])) as Record<SourceApplyPlanAction, number>;
  const automationSummary = Object.fromEntries(AUTOMATION_STATES.map((state) => [state, items.filter((item) => item.automation === state).length])) as Record<SourceApplyPlanAutomation, number>;

  return {
    id: stableId("source_apply_plan", `${input.rehearsal.tenantId ?? "global"}:${generatedAt}:${items.map((item) => item.id).join(",")}`),
    generatedAt,
    tenantId: input.rehearsal.tenantId,
    dryRun: true,
    willMutate: false,
    sourceCount: input.sources.length,
    items,
    summary,
    automationSummary,
    promotionGate: {
      gate: "source_apply_plan_ready",
      ready: automationSummary.blocked === 0,
      unappliedChangeCount: items.filter((item) => item.action !== "leave_unchanged").length,
      humanApprovalRequiredCount: automationSummary.human_approval_required,
      blockedCount: automationSummary.blocked,
      willStartCrawling: false
    }
  };
}

export function executeSourceApplyPlanDryRun(plan: SourceApplyPlan): SourceApplyPlanExecutionResult {
  return {
    dryRun: true,
    executed: false,
    itemResults: plan.items.map((item) => ({
      itemId: item.id,
      sourceId: item.sourceId,
      action: item.action,
      wouldApply: item.action !== "leave_unchanged" && item.automation !== "blocked",
      blocked: item.automation === "blocked",
      reason: item.automation === "blocked"
        ? "Apply item is blocked by policy or prerequisites."
        : "Dry-run only; no registry mutation executed."
    }))
  };
}

export function buildSourceApplyPlanApiResponse(
  plan: SourceApplyPlan,
  request: SourceApplyPlanApiRequestDto
): SourceApplyPlanApiResponseDto {
  const selectedActions = new Set(request.selectedActions ?? ACTIONS);
  const items = plan.items
    .filter((item) => selectedActions.has(item.action))
    .map(apiItem);
  const response: SourceApplyPlanApiResponseDto = {
    apiVersion: "v1",
    endpoint: "/v1/sources/apply-plan",
    applyPlanId: plan.id,
    generatedAt: plan.generatedAt,
    tenantId: plan.tenantId,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    request: {
      ...request,
      dryRun: true
    },
    summary: plan.summary,
    automationSummary: plan.automationSummary,
    approvalSummary: approvalSummary(items),
    items,
    executionPreview: request.includeExecutionPreview ? executeSourceApplyPlanDryRun({
      ...plan,
      items: plan.items.filter((item) => selectedActions.has(item.action))
    }) : undefined,
    promotionPacketLink: {
      field: "sourceApplyPlanId",
      value: plan.id,
      gate: plan.promotionGate.gate,
      ready: plan.promotionGate.ready,
      unappliedChangeCount: items.filter((item) => item.action !== "leave_unchanged").length
    },
    schemaExamples: []
  };
  return {
    ...response,
    schemaExamples: buildSourceApplyPlanApiExamples(response)
  };
}

export function buildSourceApplyPlanApiExamples(base: SourceApplyPlanApiResponseDto): SourceApplyPlanApiExample[] {
  const fallback = base.items[0] ?? exampleItem("leave_unchanged", "automation_safe");
  const byAction = (action: SourceApplyPlanAction) => base.items.find((item) => item.action === action) ?? fallback;
  const byAutomation = (automation: SourceApplyPlanAutomation) => base.items.find((item) => item.automation === automation) ?? fallback;
  return [
    example("happy_path", "Dry-run preview with no mutation and no crawling.", base, byAction("leave_unchanged")),
    example("human_approval_required", "Safe-public source change that requires operator approval.", base, byAutomation("human_approval_required")),
    example("blocked_restricted_source", "Restricted source remains blocked from automatic activation.", base, byAutomation("blocked")),
    example("duplicate_source", "Duplicate source is represented as an explicit retire or review action.", base, byAction("retire")),
    example("stale_legal_notes", "Legal notes refresh request is exposed without applying registry changes.", base, byAction("request_legal_notes")),
    example("rollback_only_quarantine", "Degraded source quarantine is rollback-only and dry-run.", base, byAutomation("rollback_only"))
  ];
}

function itemFromEvidence(
  source: SourceRecord | undefined,
  sourceId: string,
  reason: string,
  action: SourceApplyPlanAction,
  generatedAt: string
): SourceApplyPlanItem {
  return buildItem(source, sourceId, action, reason, generatedAt);
}

function itemFromReviewPlan(
  source: SourceRecord | undefined,
  sourceId: string,
  planAction: string,
  reason: string,
  generatedAt: string
): SourceApplyPlanItem {
  const action: SourceApplyPlanAction =
    planAction === "approve_candidates" ? "approve" :
      planAction === "quarantine_degraded_sources" ? "quarantine" :
        planAction === "restore_recovered_sources" ? "restore" :
          planAction === "retire_dead_sources" ? "retire" :
            planAction === "request_legal_notes" ? "request_legal_notes" :
              "leave_unchanged";
  return buildItem(source, sourceId, action, reason, generatedAt);
}

function leaveUnchangedItem(source: SourceRecord, generatedAt: string): SourceApplyPlanItem {
  return buildItem(source, source.id, "leave_unchanged", "No source apply action recommended.", generatedAt);
}

function buildItem(
  source: SourceRecord | undefined,
  sourceId: string,
  action: SourceApplyPlanAction,
  reason: string,
  generatedAt: string
): SourceApplyPlanItem {
  const restricted = source ? isRestricted(source) : false;
  const automation = automationFor(source, action);
  const nextStatus = expectedStatus(source?.status, action);
  return {
    id: stableId("source_apply_item", `${sourceId}:${action}:${generatedAt}`),
    sourceId,
    sourceName: source?.name,
    action,
    automation,
    dryRun: true,
    prerequisites: prerequisitesFor(source, action),
    expectedRegistryDiff: expectedDiff(source, nextStatus, action, generatedAt),
    rollbackState: {
      canRollback: action !== "leave_unchanged" && source !== undefined,
      rollbackToStatus: source?.status,
      quarantineState: action === "quarantine" ? "required" : automation === "rollback_only" ? "recommended" : "none",
      reason: action === "leave_unchanged" ? "No rollback needed for unchanged source." : `Rollback returns source to ${source?.status ?? "unknown"} if apply is later executed.`
    },
    policyImpact: {
      riskChange: restricted ? "restricted_blocked" : action === "approve" || action === "activate" ? "low_to_public" : action === "request_legal_notes" ? "approval_refresh" : action === "quarantine" || action === "retire" ? "containment" : "none",
      requiresLegalReview: action === "request_legal_notes" || restricted,
      metadataOnlyRequired: restricted
    },
    collectionImpact: {
      willStartCrawling: false,
      enablesCollection: action === "activate" && automation !== "blocked",
      disablesCollection: action === "quarantine" || action === "retire",
      remainsDisabled: restricted
        ? ["restricted raw payload collection", "automatic restricted-source activation", "credentialed collection"]
        : ["automatic crawling during apply-plan generation", "restricted raw payload collection"]
    },
    reason
  };
}

function actionForEvidence(kind: string, quarantineRecommended: boolean): SourceApplyPlanAction {
  if (quarantineRecommended) return "quarantine";
  if (kind === "source_pack_install") return "approve";
  if (kind === "activation_recommendation") return "activate";
  if (kind === "reconciliation_drift") return "request_legal_notes";
  return "leave_unchanged";
}

function automationFor(source: SourceRecord | undefined, action: SourceApplyPlanAction): SourceApplyPlanAutomation {
  if (!source) return action === "approve" ? "human_approval_required" : "blocked";
  if (isRestricted(source) && (action === "approve" || action === "activate" || action === "restore")) return "blocked";
  if (action === "leave_unchanged") return "automation_safe";
  if (action === "quarantine" || action === "retire") return "rollback_only";
  if (action === "request_legal_notes" || action === "approve" || action === "activate") return "human_approval_required";
  if (action === "restore") return source.health?.status === "healthy" ? "human_approval_required" : "blocked";
  return "human_approval_required";
}

function prerequisitesFor(source: SourceRecord | undefined, action: SourceApplyPlanAction): SourceApplyPlanPrerequisite[] {
  const exists = Boolean(source);
  const restricted = source ? isRestricted(source) : false;
  return [
    { code: "source_exists", satisfied: exists || action === "approve", reason: exists ? "Source exists in registry." : "Source is missing and must be created through source-pack import before mutation." },
    { code: "dry_run_only", satisfied: true, reason: "Plan generation is dry-run-only and does not mutate registry state." },
    { code: "not_restricted_auto_activation", satisfied: !(restricted && (action === "approve" || action === "activate" || action === "restore")), reason: restricted ? "Restricted sources cannot be auto-approved, activated, or restored." : "Source is not a restricted auto-activation target." },
    { code: "legal_notes_present", satisfied: Boolean(source?.legalNotes.trim()) || action === "request_legal_notes" || action === "approve", reason: source?.legalNotes.trim() ? "Legal notes are present." : "Legal notes must be supplied or refreshed." }
  ];
}

function expectedDiff(source: SourceRecord | undefined, nextStatus: SourceStatus | undefined, action: SourceApplyPlanAction, generatedAt: string): SourceApplyPlanExpectedDiff[] {
  if (!source || action === "leave_unchanged") return [];
  const diff: SourceApplyPlanExpectedDiff[] = [];
  if (nextStatus && nextStatus !== source.status) diff.push({ field: "status", before: source.status, after: nextStatus });
  if (action === "approve") diff.push({ field: "governance.approvalState", before: source.governance?.approvalState, after: "approved" });
  if (action === "request_legal_notes") diff.push({ field: "metadata.legalNotesRequestedAt", before: source.metadata?.legalNotesRequestedAt, after: generatedAt });
  if (action === "quarantine") diff.push({ field: "catalog.rollback.lastQuarantineReason", before: source.catalog?.rollback?.lastQuarantineReason, after: "source apply plan quarantine" });
  return diff;
}

function expectedStatus(status: SourceStatus | undefined, action: SourceApplyPlanAction): SourceStatus | undefined {
  if (!status) return undefined;
  if (action === "approve") return "approved";
  if (action === "activate") return "active";
  if (action === "quarantine") return "quarantined";
  if (action === "restore") return "probation";
  if (action === "retire") return "retired";
  return status;
}

function dedupeItems(items: SourceApplyPlanItem[]): SourceApplyPlanItem[] {
  const rank: Record<SourceApplyPlanAction, number> = {
    quarantine: 7,
    retire: 6,
    request_legal_notes: 5,
    approve: 4,
    activate: 3,
    restore: 2,
    leave_unchanged: 1
  };
  const bySource = new Map<string, SourceApplyPlanItem>();
  for (const item of items) {
    const previous = bySource.get(item.sourceId);
    if (!previous || rank[item.action] > rank[previous.action]) bySource.set(item.sourceId, item);
  }
  return [...bySource.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

function isRestricted(source: SourceRecord): boolean {
  return source.risk === "restricted" ||
    source.risk === "high" ||
    source.type === "tor_metadata" ||
    source.type === "i2p_metadata" ||
    source.type === "freenet_metadata" ||
    source.catalog?.approvalScope === "restricted_protocol";
}

function apiItem(item: SourceApplyPlanItem): SourceApplyPlanApiItemDto {
  return {
    itemId: item.id,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    action: item.action,
    automation: item.automation,
    approvalRequired: item.automation === "human_approval_required" || item.policyImpact.requiresLegalReview,
    blocked: item.automation === "blocked",
    prerequisiteFailures: item.prerequisites.filter((prerequisite) => !prerequisite.satisfied).map((prerequisite) => prerequisite.code),
    expectedDiffCount: item.expectedRegistryDiff.length,
    policyImpact: item.policyImpact,
    collectionImpact: item.collectionImpact,
    rollback: item.rollbackState,
    reason: item.reason
  };
}

function approvalSummary(items: SourceApplyPlanApiItemDto[]): SourceApplyPlanApiResponseDto["approvalSummary"] {
  return {
    approvalsRequired: items.filter((item) => item.approvalRequired).length,
    legalReviewRequired: items.filter((item) => item.policyImpact.requiresLegalReview).length,
    blocked: items.filter((item) => item.blocked).length,
    rollbackOnly: items.filter((item) => item.automation === "rollback_only").length
  };
}

function example(
  name: SourceApplyPlanApiExample["name"],
  description: string,
  base: SourceApplyPlanApiResponseDto,
  exampleItemValue: SourceApplyPlanApiItemDto
): SourceApplyPlanApiExample {
  return {
    name,
    description,
    request: base.request,
    response: {
      apiVersion: base.apiVersion,
      endpoint: base.endpoint,
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      approvalSummary: base.approvalSummary,
      promotionPacketLink: base.promotionPacketLink,
      exampleItem: exampleItemValue
    }
  };
}

function exampleItem(action: SourceApplyPlanAction, automation: SourceApplyPlanAutomation): SourceApplyPlanApiItemDto {
  return {
    itemId: `example_${action}`,
    sourceId: `example_${action}`,
    action,
    automation,
    approvalRequired: automation === "human_approval_required",
    blocked: automation === "blocked",
    prerequisiteFailures: automation === "blocked" ? ["not_restricted_auto_activation"] : [],
    expectedDiffCount: action === "leave_unchanged" ? 0 : 1,
    policyImpact: {
      riskChange: automation === "blocked" ? "restricted_blocked" : "none",
      requiresLegalReview: automation === "blocked",
      metadataOnlyRequired: automation === "blocked"
    },
    collectionImpact: {
      willStartCrawling: false,
      enablesCollection: false,
      disablesCollection: action === "quarantine" || action === "retire",
      remainsDisabled: ["automatic crawling during apply-plan generation", "restricted raw payload collection"]
    },
    rollback: {
      canRollback: action !== "leave_unchanged",
      quarantineState: action === "quarantine" ? "required" : "none",
      reason: "Schema example only; no mutation."
    },
    reason: "Schema example item."
  };
}
