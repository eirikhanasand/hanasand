import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { SourceRecord } from "../src/types.ts";

interface ProofResult {
  scenario: "all_statuses" | "nested_ready" | "invalid_action";
  ok: boolean;
  status: number;
  endpoint: "/v1/restricted-metadata/apply-plan" | "/v1/sources/src_restricted_ready/restricted-metadata/apply-plan";
  expectedOutput: string;
  actions?: string[];
  statuses?: Record<string, number>;
  agent10Rollback?: string[];
  certificationScenarios?: string[];
  killSwitchDrillScenarios?: string[];
  emergencyStopCertificationScenarios?: string[];
  redactionProof: {
    noUnsafeUrls: boolean;
    noCredentials: boolean;
    noRawLeakContent: boolean;
    prohibitedAlternativesPresent: boolean;
    certificationMetadataOnly: boolean;
    killSwitchDrillsMetadataOnly: boolean;
    emergencyStopCertificationMetadataOnly: boolean;
  };
  errorCode?: string;
}

type EmergencyStopCertificationProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  dryRunOnly: boolean;
  observedScenarios: string[];
  noLeakSerialization: { passed: boolean };
  packets: Array<{
    scenario: string;
    metadataOnly: boolean;
    safeForApi: boolean;
    dryRunOnly: boolean;
    rcGate: string;
    controls: { publicApiBlockedState: boolean };
    proof: { noUnsafeAccess: boolean; noDataExposure: boolean; noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean; noRawPayloads: boolean; noRawUrls: boolean; hashOnlyEvidence: boolean };
    noLeakSerialization: { passed: boolean };
  }>;
};

const store = new InMemoryScraperStore();
for (const source of restrictedMetadataSources()) store.saveSource(source);
const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
const results: ProofResult[] = [];

try {
  results.push(await runScenario("all_statuses", "/v1/restricted-metadata/apply-plan", {
    retentionExpiringWithinDays: 7,
    includeCutover: true
  }));
  results.push(await runScenario("nested_ready", "/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
    actions: ["enable_metadata_only_queue"]
  }));
  results.push(await runScenario("invalid_action", "/v1/restricted-metadata/apply-plan", {
    actions: ["solve_captcha_then_download"]
  }));
} finally {
  server.stop();
}

const ok = results.every((result) => result.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:restricted-metadata-apply-plan",
  endpoints: [
    "/v1/restricted-metadata/apply-plan",
    "/v1/sources/src_restricted_ready/restricted-metadata/apply-plan"
  ],
  scenarios: results,
  expectedOutput: "ok=true; all_statuses covers disabled/pending/ready/blocked/kill-switch/retention/audit-clean, nested_ready returns one automation-safe queue plan, invalid_action returns 400 invalid_action, and all responses redact unsafe URLs/credentials/raw leak content"
}, null, 2));

if (!ok) process.exit(1);

async function runScenario(
  scenario: ProofResult["scenario"],
  endpoint: ProofResult["endpoint"],
  requestBody: Record<string, unknown>
): Promise<ProofResult> {
  const response = await fetch(`http://127.0.0.1:${server.port}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  const payload = await response.json() as {
    applyPlan?: {
      actions: Array<{ action: string; prohibitedAlternatives: string[] }>;
      agent10KillSwitchRollback: string[];
      connectorCertifications: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; noLeakSerialization: { passed: boolean }; guarantees: { noContact: boolean; noDownload: boolean } }>;
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; guarantees: { noContact: boolean; noDownload: boolean }; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: EmergencyStopCertificationProof;
      noLeakSerialization: { passed: boolean };
    };
    cutoverReport?: { agent09: { statuses: Record<string, number> } };
    error?: { code: string };
  };
  const serialized = JSON.stringify(payload);
  const actions = payload.applyPlan?.actions.map((action) => action.action) ?? [];
  const statuses = payload.cutoverReport?.agent09.statuses;
  const redactionProof = {
    noUnsafeUrls: !serialized.includes("http://") && !serialized.includes(".onion"),
    noCredentials: !serialized.includes("user:pass") && !serialized.includes("secret=") && !serialized.includes("credentialValue"),
    noRawLeakContent: !serialized.includes("customer-dump") && !serialized.includes("raw leak") && !serialized.includes("payload body"),
    prohibitedAlternativesPresent: payload.applyPlan?.actions.every((action) =>
      action.prohibitedAlternatives.includes("payload download remains prohibited") &&
      action.prohibitedAlternatives.includes("credential or authentication bypass remains prohibited") &&
      action.prohibitedAlternatives.includes("CAPTCHA solving remains prohibited") &&
      action.prohibitedAlternatives.includes("private community access remains prohibited") &&
      action.prohibitedAlternatives.includes("threat actor interaction remains prohibited")
    ) ?? scenario === "invalid_action",
    certificationMetadataOnly: payload.applyPlan
      ? payload.applyPlan.noLeakSerialization.passed && payload.applyPlan.connectorCertifications.length > 0 && payload.applyPlan.connectorCertifications.every((packet) =>
        packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload
      )
      : scenario === "invalid_action",
    killSwitchDrillsMetadataOnly: payload.applyPlan
      ? payload.applyPlan.killSwitchDrills.metadataOnly && payload.applyPlan.killSwitchDrills.safeForApi && payload.applyPlan.killSwitchDrills.dryRunOnly && payload.applyPlan.killSwitchDrills.operatorVisible && payload.applyPlan.killSwitchDrills.noLeakSerialization.passed && payload.applyPlan.killSwitchDrills.packets.every((packet) =>
        packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.operatorVisible && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload
      )
      : scenario === "invalid_action",
    emergencyStopCertificationMetadataOnly: payload.applyPlan
      ? payload.applyPlan.emergencyStopCertification.metadataOnly && payload.applyPlan.emergencyStopCertification.safeForApi && payload.applyPlan.emergencyStopCertification.dryRunOnly && payload.applyPlan.emergencyStopCertification.noLeakSerialization.passed && payload.applyPlan.emergencyStopCertification.packets.every((packet) =>
        packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" && packet.noLeakSerialization.passed && packet.proof.noUnsafeAccess && packet.proof.noDataExposure && packet.proof.noContact && packet.proof.noDownload && packet.proof.noCredentialBypass && packet.proof.noCaptchaSolving && packet.proof.noStealth && packet.proof.noRawPayloads && packet.proof.noRawUrls && packet.proof.hashOnlyEvidence
      )
      : scenario === "invalid_action"
  };
  const statusOk = scenario === "invalid_action" ? response.status === 400 : response.status === 200;
  const scenarioOk = scenario === "all_statuses"
    ? Boolean(
      statuses?.disabled === 1 &&
      statuses.pending_approval === 1 &&
      statuses.blocked_unsafe_target === 1 &&
      statuses.kill_switch_active === 1 &&
      statuses.retention_expiring === 1 &&
      (statuses.ready_metadata_only ?? 0) >= 1 &&
      (statuses.audit_clean ?? 0) >= 1 &&
      actions.includes("keep_source_blocked") &&
      actions.includes("apply_kill_switch") &&
      actions.includes("shorten_retention") &&
      Boolean(payload.applyPlan?.connectorCertifications.some((packet) => packet.scenario === "unsafe_link_form_download")) &&
      Boolean(payload.applyPlan?.killSwitchDrills.observedScenarios.includes("public_api_blocked_state")) &&
      Boolean(payload.applyPlan?.emergencyStopCertification.observedScenarios.includes("public_api_blocked_state")) &&
      Boolean(payload.applyPlan?.emergencyStopCertification.observedScenarios.includes("unsafe_download_form_contact_target"))
    )
    : scenario === "nested_ready"
      ? actions.length === 1 && actions[0] === "enable_metadata_only_queue" && Boolean(payload.applyPlan?.connectorCertifications.some((packet) => packet.scenario === "low_yield_source" || packet.scenario === "healthy_approved_metadata_source")) && Boolean(payload.applyPlan?.killSwitchDrills.observedScenarios.includes("low_yield_source") || payload.applyPlan?.killSwitchDrills.observedScenarios.includes("healthy_metadata_only_canary")) && Boolean(payload.applyPlan?.emergencyStopCertification.observedScenarios.includes("low_yield_source") || payload.applyPlan?.emergencyStopCertification.observedScenarios.includes("healthy_metadata_only_canary"))
      : payload.error?.code === "invalid_action";
  return {
    scenario,
    ok: statusOk && scenarioOk && Object.values(redactionProof).every(Boolean),
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
    redactionProof,
    errorCode: payload.error?.code
  };
}

function restrictedMetadataSources(): SourceRecord[] {
  const approvedGovernance = {
    approvalState: "approved" as const,
    approvalRequired: true,
    metadataOnly: true,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "reviewer",
    policyVersion: "collection-policy:v1"
  };
  return [
    source({ id: "src_restricted_ready", name: "Ready restricted metadata source", url: "http://readyexample.onion/posts", accessMethod: "approved_proxy", status: "active", legalNotes: "Approved restricted metadata fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_pending", name: "Pending restricted metadata source", url: "http://pendingexample.onion/posts", accessMethod: "approved_proxy", status: "needs_review", legalNotes: "", governance: { approvalState: "pending", approvalRequired: true, metadataOnly: true, policyVersion: "collection-policy:v1" } }),
    source({ id: "src_restricted_unsafe", name: "Unsafe restricted metadata source", url: "http://user:pass@unsafeexample.onion/download/customer-dump.zip", accessMethod: "approved_proxy", status: "active", legalNotes: "Unsafe target fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_disabled", name: "Disabled restricted metadata source", url: "http://disabledexample.onion/posts", accessMethod: "disabled", status: "disabled", legalNotes: "Disabled restricted fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_retention", name: "Retention expiring restricted metadata source", url: "http://retentionexample.onion/posts", accessMethod: "approved_proxy", status: "active", legalNotes: "Retention expiring fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance, metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-27T00:00:00.000Z" } })
  ];
}

function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_restricted",
    name: input.name ?? "Restricted metadata fixture",
    type: "tor_metadata",
    url: input.url ?? "http://example.onion/posts",
    accessMethod: input.accessMethod ?? "approved_proxy",
    status: input.status ?? "active",
    risk: "high",
    trustScore: 0.7,
    crawlFrequencySeconds: 3600,
    legalNotes: input.legalNotes ?? "Restricted metadata proof fixture.",
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    governance: input.governance,
    metadata: input.metadata,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}
