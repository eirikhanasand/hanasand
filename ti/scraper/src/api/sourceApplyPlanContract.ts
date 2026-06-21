import type { SourceApplyPlanAction } from "../registry/sourceApplyPlan.ts";
import type { SourceApplyPlanApiContractDto } from "./sourceApplyPlanTypes.ts";

export const APPLY_ACTIONS: SourceApplyPlanAction[] = ["approve", "activate", "quarantine", "restore", "retire", "request_legal_notes", "leave_unchanged"];

export function sourceApplyPlanApiContract(): SourceApplyPlanApiContractDto {
  return {
    endpoint: "/v1/sources/apply-plan",
    method: "POST",
    mode: "dry_run",
    request: { contentType: "application/json", fields: requestFields() },
    response: {
      fields: ["contract", "applyPlan"],
      itemFields: ["itemId", "sourceId", "sourceName", "action", "automation", "approvalRequired", "blocked", "prerequisiteFailures", "expectedDiffCount", "policyImpact", "collectionImpact", "rollback", "reason"],
      forbiddenMutationFields: ["updatedSource", "reviewDecisionApplied", "startedCrawl", "leasedTask", "rawPayload", "dbTransaction", "restrictedActivation"],
      actions: APPLY_ACTIONS,
      automation: ["automation_safe", "human_approval_required", "blocked", "rollback_only"]
    },
    examples: [
      { name: "happy_path", description: "Dry-run source plan with no registry mutation." },
      { name: "human_approval_required", description: "Safe-public candidate approval remains human-reviewed." },
      { name: "blocked_restricted_source", description: "Restricted source cannot be auto-activated." },
      { name: "duplicate_source", description: "Duplicate source is exposed as reviewable retire or legal action." },
      { name: "stale_legal_notes", description: "Legal notes refresh request is represented without mutation." },
      { name: "rollback_only_quarantine", description: "Degraded source quarantine is rollback-only." }
    ]
  };
}

function requestFields() {
  return [
    { name: "dryRun", type: "true", required: false, description: "Must remain true or omitted; route never mutates registry state." },
    { name: "tenantId", type: "string", required: false, description: "Tenant scope for source lookup and plan generation." },
    { name: "queryScope.queries", type: "string[]", required: true, description: "Actor, CVE, sector, or other query families covered by the plan." },
    { name: "queryScope.entityTypes", type: "string[]", required: false, description: "Optional entity type hints matching /v1/intel/search terms." },
    { name: "sourcePackIds", type: "string[]", required: false, description: "Safe public source-pack ids/names to include in dry-run install planning." },
    { name: "selectedActions", type: "SourceApplyPlanAction[]", required: false, description: "Optional action filter for compact API responses." },
    { name: "includeExecutionPreview", type: "boolean", required: false, description: "Includes a dry-run preview that explicitly reports executed:false." }
  ];
}
