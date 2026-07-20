export interface ProofResult {
  scenario: "all_statuses" | "nested_ready" | "invalid_action";
  ok: boolean;
  status: number;
  endpoint: "/v1/restricted-metadata/apply-plan" | "/v1/sources/src_restricted_ready/restricted-metadata/apply-plan";
  expectedOutput: string;
  actions?: string[];
  cutoverStatus?: string;
  redactionProof: Record<string, boolean>;
  errorCode?: string;
}

export type ApplyPlanPayload = {
  applyPlan?: {
    metadataOnly: boolean;
    actions: Array<{ action: string; metadataOnly: boolean; forbiddenAlternatives: string[] }>;
  };
  cutoverReport?: { status?: string };
  error?: { code: string };
};
