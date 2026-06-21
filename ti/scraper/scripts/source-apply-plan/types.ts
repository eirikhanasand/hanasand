import type { SourceRecord } from "../../src/types.ts";

export interface ScenarioInput {
  sources: SourceRecord[];
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface ProofResult {
  scenario: "happy_path" | "blocked_restricted_source" | "invalid_action";
  ok: boolean;
  status: number;
  endpoint: "/v1/sources/apply-plan";
  expectedOutput: string;
  actions?: string[];
  automation?: string[];
  dryRun?: boolean;
  willMutate?: boolean;
  willStartCrawling?: boolean;
  errorCode?: string;
  mutationProof: {
    sourcesUnchanged: boolean;
    queueUnchanged: boolean;
    leasesUnchanged: boolean;
  };
  safetyProof: {
    noStartedCrawl: boolean;
    noRegistryMutationFields: boolean;
    noRestrictedActivation: boolean;
  };
}

export interface ApplyPlanPayload {
  applyPlan?: {
    dryRun: boolean;
    willMutate: boolean;
    willStartCrawling: boolean;
    items: Array<{
      action: string;
      automation: string;
      collectionImpact: {
        willStartCrawling: boolean;
        enablesCollection: boolean;
        remainsDisabled: string[];
      };
    }>;
  };
  error?: { code: string };
}
