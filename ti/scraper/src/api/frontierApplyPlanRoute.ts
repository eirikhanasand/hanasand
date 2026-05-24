import {
  buildSchedulerApplyPlan,
  buildSchedulerApplyPlanApiResponse,
  buildSchedulerCutoverRehearsal,
  schedulerApplyPlanApiContract,
  type SchedulerApplyPlanApiRequestDto,
  type SchedulerRepairAction
} from "../frontier/schedulerProduction.ts";
import type { FrontierAck } from "../frontier/frontier.ts";
import type { CollectionRun, CollectionTask, SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

export interface FrontierApplyPlanRouteResult {
  status: number;
  body: FrontierApplyPlanRouteResponse | FrontierApplyPlanRouteError;
}

export interface FrontierApplyPlanRouteResponse {
  contract: ReturnType<typeof schedulerApplyPlanApiContract>;
  applyPlan: ReturnType<typeof buildSchedulerApplyPlanApiResponse>;
}

export interface FrontierApplyPlanRouteError {
  error: {
    code: "invalid_action" | "dry_run_required";
    message: string;
    details?: Record<string, unknown>;
  };
}

const FRONTIER_APPLY_ACTIONS: Exclude<SchedulerRepairAction, "no_action">[] = [
  "release_expired_leases",
  "cancel_abandoned_runs",
  "requeue_transient_failures",
  "delay_low_priority_sweeps",
  "pause_noisy_source_queues",
  "quarantine_permanently_failing_sources",
  "trigger_emergency_brake"
];

export function handleFrontierApplyPlanRoute(input: {
  request: Partial<SchedulerApplyPlanApiRequestDto> & Record<string, unknown>;
  sources: SourceRecord[];
  queued: CollectionTask[];
  leased: CollectionTask[];
  deadLetters: FrontierAck[];
  runs: CollectionRun[];
  generatedAt?: string;
}): FrontierApplyPlanRouteResult {
  const validation = validateFrontierApplyPlanRequest(input.request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : 400, body: validation };

  const generatedAt = input.generatedAt ?? nowIso();
  const request: SchedulerApplyPlanApiRequestDto = {
    dryRun: true,
    scenario: typeof input.request.scenario === "string" ? input.request.scenario : undefined,
    selectedActions: input.request.selectedActions as SchedulerRepairAction[] | undefined,
    includeExecutionPreview: input.request.includeExecutionPreview === true,
    hostMemoryMb: numberOrUndefined(input.request.hostMemoryMb),
    dbConnectionUtilization: numberOrUndefined(input.request.dbConnectionUtilization),
    workerUtilization: numberOrUndefined(input.request.workerUtilization),
    maxApiP95QueueAgeSeconds: numberOrUndefined(input.request.maxApiP95QueueAgeSeconds)
  };
  const now = new Date(generatedAt);
  const rehearsal = buildSchedulerCutoverRehearsal({
    scenario: request.scenario ?? "frontier_apply_plan",
    sources: input.sources,
    queued: input.queued,
    leased: input.leased,
    deadLetters: input.deadLetters,
    runs: input.runs,
    now
  });

  return {
    status: 200,
    body: {
      contract: schedulerApplyPlanApiContract(),
      applyPlan: buildSchedulerApplyPlanApiResponse(buildSchedulerApplyPlan({
        rehearsal,
        tasks: [...input.queued, ...input.leased],
        now,
        hostMemoryMb: request.hostMemoryMb,
        dbConnectionUtilization: request.dbConnectionUtilization,
        workerUtilization: request.workerUtilization,
        maxApiP95QueueAgeSeconds: request.maxApiP95QueueAgeSeconds
      }), request)
    }
  };
}

function validateFrontierApplyPlanRequest(input: Partial<SchedulerApplyPlanApiRequestDto> & Record<string, unknown>): FrontierApplyPlanRouteError | undefined {
  const dryRunValue = (input as Record<string, unknown>)["dryRun"];
  if (dryRunValue === false) {
    return { error: { code: "dry_run_required", message: "/v1/frontier/apply-plan is dry-run only" } };
  }
  if (input.selectedActions !== undefined) {
    if (!Array.isArray(input.selectedActions)) {
      return { error: { code: "invalid_action", message: "selectedActions must be an array" } };
    }
    const invalid = input.selectedActions.filter((action) => !FRONTIER_APPLY_ACTIONS.includes(action as Exclude<SchedulerRepairAction, "no_action">));
    if (invalid.length) {
      return {
        error: {
          code: "invalid_action",
          message: "selectedActions contains unsupported frontier apply actions",
          details: { invalid, allowed: FRONTIER_APPLY_ACTIONS }
        }
      };
    }
  }
  return undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
