import type { ApplyPlanPayload, ProofResult } from "./types.ts";

export async function runScenario(
  port: number,
  scenario: ProofResult["scenario"],
  endpoint: ProofResult["endpoint"],
  requestBody: Record<string, unknown>
): Promise<ProofResult> {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  const payload = await response.json() as ApplyPlanPayload;
  const actions = payload.applyPlan?.actions.map((action) => action.action) ?? [];
  const statuses = payload.cutoverReport?.agent09.statuses;
  const redactionProof = buildRedactionProof(scenario, payload);
  const statusOk = scenario === "invalid_action" ? response.status === 400 : response.status === 200;
  return {
    scenario,
    ok: statusOk && scenarioOk(scenario, actions, statuses, payload) && Object.values(redactionProof).every(Boolean),
    status: response.status,
    endpoint,
    expectedOutput: scenario === "invalid_action"
      ? "HTTP 400 invalid_action and no unsafe response fields"
      : "HTTP 200 dry-run applyPlan with metadata-only proofs and redacted restricted target data",
    actions,
    statuses,
    agent10Rollback: payload.applyPlan?.agent10KillSwitchRollback,
    certificationScenarios: payload.applyPlan?.connectorCertifications.map((packet) => packet.scenario),
    killSwitchDrillScenarios: payload.applyPlan?.killSwitchDrills.observedScenarios,
    emergencyStopCertificationScenarios: payload.applyPlan?.emergencyStopCertification.observedScenarios,
    nonBlockingScenarios: payload.applyPlan?.nonBlockingSearch.observedScenarios,
    analystOperationScenarios: payload.applyPlan?.analystOperations.observedScenarios,
    isolationHarnessScenarios: payload.applyPlan?.isolationHarness.observedScenarios,
    redactionProof,
    errorCode: payload.error?.code
  };
}

function buildRedactionProof(scenario: ProofResult["scenario"], payload: ApplyPlanPayload): Record<string, boolean> {
  const serialized = JSON.stringify(payload);
  const plan = payload.applyPlan;
  return {
    noUnsafeUrls: !serialized.includes("http://") && !serialized.includes(".onion"),
    noCredentials: !serialized.includes("user:pass") && !serialized.includes("secret=") && !serialized.includes("credentialValue"),
    noRawLeakContent: !serialized.includes("customer-dump") && !serialized.includes("raw leak") && !serialized.includes("payload body"),
    prohibitedAlternativesPresent: plan?.actions.every((action) => requiredAlternatives.every((item) => action.prohibitedAlternatives.includes(item))) ?? scenario === "invalid_action",
    certificationMetadataOnly: plan ? plan.noLeakSerialization.passed && plan.connectorCertifications.length > 0 && plan.connectorCertifications.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload) : scenario === "invalid_action",
    killSwitchDrillsMetadataOnly: plan ? plan.killSwitchDrills.metadataOnly && plan.killSwitchDrills.safeForApi && plan.killSwitchDrills.dryRunOnly && plan.killSwitchDrills.operatorVisible && plan.killSwitchDrills.noLeakSerialization.passed && plan.killSwitchDrills.packets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.operatorVisible && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload) : scenario === "invalid_action",
    emergencyStopCertificationMetadataOnly: plan ? plan.emergencyStopCertification.metadataOnly && plan.emergencyStopCertification.safeForApi && plan.emergencyStopCertification.dryRunOnly && plan.emergencyStopCertification.noLeakSerialization.passed && plan.emergencyStopCertification.packets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" && packet.noLeakSerialization.passed && allTrue(packet.proof)) : scenario === "invalid_action",
    nonBlockingSearchMetadataOnly: plan ? plan.nonBlockingSearch.metadataOnly && plan.nonBlockingSearch.safeForApi && plan.nonBlockingSearch.nonBlockingPublicSearch && plan.nonBlockingSearch.maxPublicSearchAddedLatencyMs === 0 && plan.nonBlockingSearch.packets.every((packet) => packet.publicSearchAction === "continue_clear_web_and_public_channel" && packet.noLeakSerialization.passed && allTrue(packet.proof)) : scenario === "invalid_action",
    analystOperationsMetadataOnly: plan ? plan.analystOperations.metadataOnly && plan.analystOperations.safeForApi && plan.analystOperations.dryRunOnly && plan.analystOperations.victimNotificationPacketCount > 0 && plan.analystOperations.noLeakSerialization.passed && plan.analystOperations.packets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.schedulerIsolation.directEgressAllowed === false && packet.noLeakSerialization.passed && allTrue(packet.proof)) : scenario === "invalid_action",
    isolationHarnessMetadataOnly: plan ? plan.isolationHarness.metadataOnly && plan.isolationHarness.safeForApi && plan.isolationHarness.dryRunOnly && plan.isolationHarness.nonNetworked && plan.isolationHarness.legalSecurityEvidencePacketCount > 0 && plan.isolationHarness.noLeakSerialization.passed && plan.isolationHarness.packets.every((packet) => packet.nonNetworked && packet.connectorBoundary.approvedProxyRequired && packet.connectorBoundary.directEgressAllowed === false && packet.connectorBoundary.accountStateAllowed === false && packet.workerIsolation.isolatedPoolRequired && packet.workerIsolation.killSwitchPropagates && packet.workerIsolation.timeoutAttributed && packet.complianceEvidence.legalReviewReady && packet.complianceEvidence.securityReviewReady && packet.noLeakSerialization.passed && allTrue(packet.proof)) : scenario === "invalid_action"
  };
}

function scenarioOk(
  scenario: ProofResult["scenario"],
  actions: string[],
  statuses: Record<string, number> | undefined,
  payload: ApplyPlanPayload
): boolean {
  if (scenario === "invalid_action") return payload.error?.code === "invalid_action";
  if (scenario === "nested_ready") return nestedReady(actions, payload);
  return Boolean(
    statuses?.disabled === 1 &&
    statuses.pending_approval === 1 &&
    statuses.blocked_unsafe_target === 1 &&
    statuses.kill_switch_active === 1 &&
    statuses.retention_expiring === 1 &&
    (statuses.ready_metadata_only ?? 0) >= 1 &&
    (statuses.audit_clean ?? 0) >= 1 &&
    ["keep_source_blocked", "apply_kill_switch", "shorten_retention"].every((action) => actions.includes(action)) &&
    includes(payload.applyPlan?.connectorCertifications, "unsafe_link_form_download") &&
    includes(payload.applyPlan?.killSwitchDrills.observedScenarios, "public_api_blocked_state") &&
    includes(payload.applyPlan?.emergencyStopCertification.observedScenarios, "unsafe_download_form_contact_target") &&
    includes(payload.applyPlan?.nonBlockingSearch.observedScenarios, "unsafe_target") &&
    includes(payload.applyPlan?.analystOperations.observedScenarios, "victim_notification_packet") &&
    includes(payload.applyPlan?.isolationHarness.observedScenarios, "raw_payload_denied")
  );
}

function nestedReady(actions: string[], payload: ApplyPlanPayload): boolean {
  return actions.length === 1 &&
    actions[0] === "enable_metadata_only_queue" &&
    includes(payload.applyPlan?.connectorCertifications, "low_yield_source", "healthy_approved_metadata_source") &&
    includes(payload.applyPlan?.killSwitchDrills.observedScenarios, "low_yield_source", "healthy_metadata_only_canary") &&
    includes(payload.applyPlan?.emergencyStopCertification.observedScenarios, "low_yield_source", "healthy_metadata_only_canary") &&
    includes(payload.applyPlan?.nonBlockingSearch.observedScenarios, "approved_metadata_canary", "low_yield_source") &&
    includes(payload.applyPlan?.analystOperations.observedScenarios, "metadata_only_capture_queued") &&
    includes(payload.applyPlan?.isolationHarness.observedScenarios, "proxy_boundary_proof");
}

const requiredAlternatives = [
  "payload download remains prohibited",
  "credential or authentication bypass remains prohibited",
  "CAPTCHA solving remains prohibited",
  "private community access remains prohibited",
  "threat actor interaction remains prohibited"
];

function includes(values: Array<string | { scenario: string }> | undefined, ...expected: string[]): boolean {
  const names = values?.map((value) => typeof value === "string" ? value : value.scenario) ?? [];
  return expected.some((item) => names.includes(item));
}

function allTrue(value: Record<string, boolean>): boolean {
  return Object.values(value).every(Boolean);
}
