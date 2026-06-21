import type { SourceApplyPlanApiRequestDto, SourceApplyPlanAction } from "../registry/sourceApplyPlan.ts";
import { APPLY_ACTIONS } from "./sourceApplyPlanContract.ts";
import type { SourceApplyPlanRouteError } from "./sourceApplyPlanTypes.ts";

export function validateSourceApplyPlanRequest(
  input: Partial<SourceApplyPlanApiRequestDto> & Record<string, unknown>
): SourceApplyPlanRouteError | undefined {
  const dryRun = (input as Record<string, unknown>).dryRun;
  if (dryRun === false) {
    return { error: { code: "dry_run_required", message: "/v1/sources/apply-plan is dry-run only" } };
  }
  const queryScope = input.queryScope as SourceApplyPlanApiRequestDto["queryScope"] | undefined;
  if (!validQueries(queryScope)) {
    return { error: { code: "bad_request", message: "queryScope.queries must contain at least one query" } };
  }
  if (input.selectedActions !== undefined && !Array.isArray(input.selectedActions)) {
    return { error: { code: "invalid_action", message: "selectedActions must be an array" } };
  }
  const invalid = (input.selectedActions ?? []).filter((action) => !APPLY_ACTIONS.includes(action as SourceApplyPlanAction));
  return invalid.length ? invalidAction(invalid) : undefined;
}

function validQueries(queryScope?: SourceApplyPlanApiRequestDto["queryScope"]): boolean {
  return Boolean(queryScope?.queries?.length && queryScope.queries.every((query) => typeof query === "string" && query.trim()));
}

function invalidAction(invalid: unknown[]): SourceApplyPlanRouteError {
  return {
    error: {
      code: "invalid_action",
      message: "selectedActions contains unsupported source apply actions",
      details: { invalid, allowed: APPLY_ACTIONS }
    }
  };
}
