import type { ApplyPlanPayload, ProofResult } from "./types.ts";

const forbiddenOperations = [
  "credential_bypass",
  "captcha_solving",
  "threat_actor_interaction",
  "stolen_file_download",
  "unapproved_proxy",
  "non_metadata_capture"
];

export async function runScenario(port: number, scenario: ProofResult["scenario"], endpoint: ProofResult["endpoint"], requestBody: Record<string, unknown>): Promise<ProofResult> {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  const payload = await response.json() as ApplyPlanPayload;
  const actions = payload.applyPlan?.actions ?? [];
  const serialized = JSON.stringify(payload);
  const redactionProof = {
    noUnsafeUrls: !serialized.includes("http://") && !serialized.includes(".onion"),
    noCredentials: !serialized.includes("user:pass") && !serialized.includes("secret="),
    noRawLeakContent: !serialized.includes("customer-dump") && !serialized.includes("raw leak"),
    metadataOnly: actions.every((action) => action.metadataOnly),
    forbiddenOperationsPreserved: actions.every((action) => forbiddenOperations.every((operation) => action.forbiddenAlternatives.includes(operation)))
  };
  const actionNames = actions.map((action) => action.action);
  const behaviorOk = scenario === "invalid_action"
    ? response.status === 400 && payload.error?.code === "invalid_action"
    : response.status === 200
      && payload.applyPlan?.metadataOnly === true
      && Object.values(redactionProof).every(Boolean)
      && (scenario === "nested_ready"
        ? actionNames.length === 1 && actionNames[0] === "enable_metadata_only_queue"
        : actionNames.includes("enable_metadata_only_queue") && actionNames.includes("keep_source_blocked") && payload.cutoverReport?.status === "ready_metadata_only");

  return {
    scenario,
    ok: behaviorOk,
    status: response.status,
    endpoint,
    expectedOutput: scenario === "invalid_action"
      ? "HTTP 400 invalid_action and no unsafe response fields"
      : "HTTP 200 metadata-only dry-run actions with prohibited operations and redacted targets",
    actions: actionNames,
    cutoverStatus: payload.cutoverReport?.status,
    redactionProof,
    errorCode: payload.error?.code
  };
}
