import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../src/types.ts";

interface StatusProofResult {
  scenario: "status_route" | "intel_search_actor" | "intel_search_unknown";
  ok: boolean;
  status: number;
  endpoint: "/v1/restricted-metadata/status" | "/v1/intel/search";
  expectedOutput: string;
  partialState?: string;
  matchingResultCount?: number;
  observedRuntimeProofs: string[];
  remediationActions: string[];
  slaStatus?: string;
  releaseDecision?: string;
  enforcementLevel?: string;
  emergencyStopState?: string;
  auditReplayScenarios: string[];
  certificationScenarios: string[];
  killSwitchDrillScenarios: string[];
  emergencyStopCertificationScenarios: string[];
  redactionProof: {
    noUnsafeUrls: boolean;
    noCredentials: boolean;
    noRawLeakContent: boolean;
    runtimeProofsMetadataOnly: boolean;
    slaMetadataOnly: boolean;
    auditMetadataOnly: boolean;
    releasePacketMetadataOnly: boolean;
    enforcementMetadataOnly: boolean;
    governanceMetadataOnly: boolean;
    auditReplayMetadataOnly: boolean;
    certificationMetadataOnly: boolean;
    killSwitchDrillsMetadataOnly: boolean;
    emergencyStopCertificationMetadataOnly: boolean;
  };
}

type EmergencyStopCertificationProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  dryRunOnly: boolean;
  observedScenarios: string[];
  noLeakSerialization: { passed: boolean };
  packets: Array<{
    metadataOnly: boolean;
    safeForApi: boolean;
    dryRunOnly: boolean;
    rcGate: string;
    controls: { canHold: boolean; canPauseWorkers: boolean; canRollback: boolean; canEmergencyStop: boolean; publicApiBlockedState: boolean };
    proof: { noUnsafeAccess: boolean; noDataExposure: boolean; noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean; noRawPayloads: boolean; noRawUrls: boolean; hashOnlyEvidence: boolean };
    noLeakSerialization: { passed: boolean };
  }>;
};

const store = new InMemoryScraperStore();
for (const source of restrictedMetadataSources()) store.saveSource(source);
for (const capture of restrictedMetadataCaptures()) store.saveCapture(capture);

const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
const results: StatusProofResult[] = [];

try {
  results.push(await runStatusRoute());
  results.push(await runIntelSearch("intel_search_actor", "Akira", "actor", "partial_metadata", 1));
  results.push(await runIntelSearch("intel_search_unknown", "unknown restricted actor", "actor", "approval_required", 0));
} finally {
  server.stop();
}

const ok = results.every((result) => result.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:restricted-metadata-status",
  endpoints: ["/v1/restricted-metadata/status", "/v1/intel/search.restrictedMetadata"],
  scenarios: results,
  expectedOutput: "ok=true; status route and intel search expose runtime proofs, dry-run remediations, and metadata-only redaction without unsafe URLs/credentials/raw leak content"
}, null, 2));

if (!ok) process.exit(1);

async function runStatusRoute(): Promise<StatusProofResult> {
  const response = await fetch(`http://127.0.0.1:${server.port}/v1/restricted-metadata/status`);
  const payload = await response.json() as {
    status: {
      runtimeProofs: Array<{ kind: string; observed: boolean; metadataOnly: boolean; safeForApi: boolean }>;
      remediationPlan: Array<{ action: string; metadataOnly: boolean; dryRunOnly: boolean }>;
      operationalSla: { status: string; metadataOnly: boolean; safeForApi: boolean; metrics: { metadataOnlyEvidenceYield: number; forbiddenActionAttemptCount: number } };
      enforcement: { level: string; metadataOnly: boolean; safeForApi: boolean; agent09WarningCodes: string[]; emergencyStop: { state: string; dryRunOnly: boolean; workerAction: string }; activeRules: Array<{ rule: string; metadataOnly: boolean; safeForApi: boolean }> };
      auditTrail: { metadataOnly: boolean; safeForApi: boolean; unsafeFieldsExposed: boolean; rejectedFields: string[] };
      governancePackets: Array<{ metadataOnly: boolean; safeForApi: boolean; proof: { noStolenFilesStored: boolean; noRawPayloadsStored: boolean }; redactionPolicy: { rawUrlRedacted: boolean; payloadReferenceRedacted: boolean } }>;
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ metadataOnly: boolean; safeForApi: boolean; scenario: string }> };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; killSwitchPropagation: { publicApiState: string }; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: EmergencyStopCertificationProof;
      agent10ReleasePacket: { decision: string; metadataOnly: boolean; safeForApi: boolean; runtimeProofName: string; emergencyStopState: string; agent09WarningCodes: string[]; governancePacketIds: string[]; auditReplayScenarios: string[]; certificationPacketIds: string[]; certificationScenarios: string[]; killSwitchDrillPacketIds: string[]; killSwitchDrillScenarios: string[]; emergencyStopCertificationPacketIds: string[]; emergencyStopCertificationScenarios: string[] };
    };
  };
  return proofResult("status_route", "/v1/restricted-metadata/status", response.status, payload.status, undefined, undefined);
}

async function runIntelSearch(
  scenario: Extract<StatusProofResult["scenario"], "intel_search_actor" | "intel_search_unknown">,
  query: string,
  entityType: string,
  expectedPartialState: string,
  expectedMatchingResultCount: number
): Promise<StatusProofResult> {
  const response = await fetch(`http://127.0.0.1:${server.port}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=${entityType}`);
  const payload = await response.json() as {
    restrictedMetadata: {
      query?: { partialState: string; matchingResultCount: number };
      runtimeProofs: Array<{ kind: string; observed: boolean; metadataOnly: boolean; safeForApi: boolean }>;
      remediationPlan: Array<{ action: string; metadataOnly: boolean; dryRunOnly: boolean }>;
      operationalSla: { status: string; metadataOnly: boolean; safeForApi: boolean; metrics: { metadataOnlyEvidenceYield: number; forbiddenActionAttemptCount: number } };
      enforcement: { level: string; metadataOnly: boolean; safeForApi: boolean; agent09WarningCodes: string[]; emergencyStop: { state: string; dryRunOnly: boolean; workerAction: string }; activeRules: Array<{ rule: string; metadataOnly: boolean; safeForApi: boolean }> };
      auditTrail: { metadataOnly: boolean; safeForApi: boolean; unsafeFieldsExposed: boolean; rejectedFields: string[] };
      governancePackets: Array<{ metadataOnly: boolean; safeForApi: boolean; proof: { noStolenFilesStored: boolean; noRawPayloadsStored: boolean }; redactionPolicy: { rawUrlRedacted: boolean; payloadReferenceRedacted: boolean } }>;
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ metadataOnly: boolean; safeForApi: boolean; scenario: string }> };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; killSwitchPropagation: { publicApiState: string }; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: EmergencyStopCertificationProof;
      agent10ReleasePacket: { decision: string; metadataOnly: boolean; safeForApi: boolean; runtimeProofName: string; emergencyStopState: string; agent09WarningCodes: string[]; governancePacketIds: string[]; auditReplayScenarios: string[]; certificationPacketIds: string[]; certificationScenarios: string[]; killSwitchDrillPacketIds: string[]; killSwitchDrillScenarios: string[]; emergencyStopCertificationPacketIds: string[]; emergencyStopCertificationScenarios: string[] };
    };
  };
  return proofResult(
    scenario,
    "/v1/intel/search",
    response.status,
    payload.restrictedMetadata,
    expectedPartialState,
    expectedMatchingResultCount
  );
}

function proofResult(
  scenario: StatusProofResult["scenario"],
  endpoint: StatusProofResult["endpoint"],
  status: number,
  payload: {
    query?: { partialState: string; matchingResultCount: number };
    runtimeProofs: Array<{ kind: string; observed: boolean; metadataOnly: boolean; safeForApi: boolean }>;
    remediationPlan: Array<{ action: string; metadataOnly: boolean; dryRunOnly: boolean }>;
    operationalSla: { status: string; metadataOnly: boolean; safeForApi: boolean; metrics: { metadataOnlyEvidenceYield: number; forbiddenActionAttemptCount: number } };
    enforcement: { level: string; metadataOnly: boolean; safeForApi: boolean; agent09WarningCodes: string[]; emergencyStop: { state: string; dryRunOnly: boolean; workerAction: string }; activeRules: Array<{ rule: string; metadataOnly: boolean; safeForApi: boolean }> };
    auditTrail: { metadataOnly: boolean; safeForApi: boolean; unsafeFieldsExposed: boolean; rejectedFields: string[] };
    governancePackets: Array<{ metadataOnly: boolean; safeForApi: boolean; proof: { noStolenFilesStored: boolean; noRawPayloadsStored: boolean }; redactionPolicy: { rawUrlRedacted: boolean; payloadReferenceRedacted: boolean } }>;
    auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ metadataOnly: boolean; safeForApi: boolean; scenario: string }> };
    connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
    killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; killSwitchPropagation: { publicApiState: string }; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
    emergencyStopCertification: EmergencyStopCertificationProof;
    agent10ReleasePacket: { decision: string; metadataOnly: boolean; safeForApi: boolean; runtimeProofName: string; emergencyStopState: string; agent09WarningCodes: string[]; governancePacketIds: string[]; auditReplayScenarios: string[]; certificationPacketIds: string[]; certificationScenarios: string[]; killSwitchDrillPacketIds: string[]; killSwitchDrillScenarios: string[]; emergencyStopCertificationPacketIds: string[]; emergencyStopCertificationScenarios: string[] };
  },
  expectedPartialState?: string,
  expectedMatchingResultCount?: number
): StatusProofResult {
  const serialized = JSON.stringify(payload);
  const observedRuntimeProofs = payload.runtimeProofs.filter((proof) => proof.observed).map((proof) => proof.kind);
  const remediationActions = payload.remediationPlan.map((item) => item.action);
  const redactionProof = {
    noUnsafeUrls: !serialized.includes("http://") && !serialized.includes(".onion") && !serialized.includes("freenet:"),
    noCredentials: !serialized.includes("user:pass") && !serialized.includes("credentialValue"),
    noRawLeakContent: !serialized.includes("customer-dump") && !serialized.includes("payload body") && !serialized.includes("raw leak"),
    runtimeProofsMetadataOnly: payload.runtimeProofs.every((proof) => proof.metadataOnly && proof.safeForApi),
    slaMetadataOnly: payload.operationalSla.metadataOnly && payload.operationalSla.safeForApi,
    auditMetadataOnly: payload.auditTrail.metadataOnly && payload.auditTrail.safeForApi && payload.auditTrail.unsafeFieldsExposed === false,
    releasePacketMetadataOnly: payload.agent10ReleasePacket.metadataOnly && payload.agent10ReleasePacket.safeForApi,
    enforcementMetadataOnly: payload.enforcement.metadataOnly && payload.enforcement.safeForApi && payload.enforcement.activeRules.every((rule) => rule.metadataOnly && rule.safeForApi),
    governanceMetadataOnly: payload.governancePackets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.proof.noStolenFilesStored && packet.proof.noRawPayloadsStored && packet.redactionPolicy.rawUrlRedacted && packet.redactionPolicy.payloadReferenceRedacted),
    auditReplayMetadataOnly: payload.auditReplay.metadataOnly && payload.auditReplay.safeForApi && payload.auditReplay.scenarios.every((scenario) => scenario.metadataOnly && scenario.safeForApi),
    certificationMetadataOnly: payload.connectorCertification.metadataOnly && payload.connectorCertification.safeForApi && payload.connectorCertification.dryRunOnly && payload.connectorCertification.noLeakSerialization.passed && payload.connectorCertification.packets.every((packet) =>
      packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload && packet.guarantees.noCredentialBypass && packet.guarantees.noCaptchaSolving && packet.guarantees.noStealth
    ),
    killSwitchDrillsMetadataOnly: payload.killSwitchDrills.metadataOnly && payload.killSwitchDrills.safeForApi && payload.killSwitchDrills.dryRunOnly && payload.killSwitchDrills.operatorVisible && payload.killSwitchDrills.noLeakSerialization.passed && payload.killSwitchDrills.packets.every((packet) =>
      packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.operatorVisible && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload && packet.guarantees.noCredentialBypass && packet.guarantees.noCaptchaSolving && packet.guarantees.noStealth
    ),
    emergencyStopCertificationMetadataOnly: payload.emergencyStopCertification.metadataOnly && payload.emergencyStopCertification.safeForApi && payload.emergencyStopCertification.dryRunOnly && payload.emergencyStopCertification.noLeakSerialization.passed && payload.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" && packet.noLeakSerialization.passed && packet.proof.noUnsafeAccess && packet.proof.noDataExposure && packet.proof.noContact && packet.proof.noDownload && packet.proof.noCredentialBypass && packet.proof.noCaptchaSolving && packet.proof.noStealth && packet.proof.noRawPayloads && packet.proof.noRawUrls && packet.proof.hashOnlyEvidence
    )
  };
  const queryOk = expectedPartialState
    ? payload.query?.partialState === expectedPartialState && payload.query.matchingResultCount === expectedMatchingResultCount
    : true;
  const proofKindsOk = ["approval_expiry", "unsafe_target_rejection", "disabled_source_rollback", "redaction_repair"].every((kind) =>
    payload.runtimeProofs.some((proof) => proof.kind === kind)
  );
  const requiredRemediations = scenario === "status_route"
    ? ["renew_approval", "activate_kill_switch", "rollback_disabled_source"]
    : ["quarantine_proxy", "renew_approval", "rollback_disabled_source"];
  const remediationOk = requiredRemediations.every((action) => remediationActions.includes(action));
  const slaOk = ["pass", "warning", "breach"].includes(payload.operationalSla.status)
    && payload.operationalSla.metrics.metadataOnlyEvidenceYield >= (scenario === "intel_search_unknown" ? 0 : 1)
    && payload.operationalSla.metrics.forbiddenActionAttemptCount >= 1
    && payload.auditTrail.rejectedFields.includes("rawUrl")
    && payload.auditTrail.rejectedFields.includes("fileName")
    && ["pass", "warning", "hold", "emergency_stop"].includes(payload.enforcement.level)
    && payload.enforcement.emergencyStop.dryRunOnly === true
    && payload.enforcement.agent09WarningCodes.includes("restricted_metadata_forbidden_action")
    && payload.agent10ReleasePacket.runtimeProofName === "restricted_metadata_sla"
    && payload.agent10ReleasePacket.emergencyStopState === payload.enforcement.emergencyStop.state
    && payload.agent10ReleasePacket.governancePacketIds.length === payload.governancePackets.length
    && payload.auditReplay.observedScenarios.includes("allowed_metadata_only_record")
    && payload.auditReplay.observedScenarios.includes("unsafe_action_attempt")
    && payload.connectorCertification.observedScenarios.length > 0
    && (scenario !== "status_route" || payload.connectorCertification.observedScenarios.includes("unsafe_link_form_download"))
    && (scenario !== "status_route" || payload.agent10ReleasePacket.certificationScenarios.includes("unsafe_link_form_download"))
    && payload.agent10ReleasePacket.certificationPacketIds.length === payload.connectorCertification.packets.length
    && payload.killSwitchDrills.observedScenarios.includes("public_api_blocked_state")
    && payload.killSwitchDrills.packets.some((packet) => packet.killSwitchPropagation.publicApiState === "blocked")
    && payload.agent10ReleasePacket.killSwitchDrillPacketIds.length === payload.killSwitchDrills.packets.length
    && payload.emergencyStopCertification.observedScenarios.includes("public_api_blocked_state")
    && payload.emergencyStopCertification.packets.some((packet) => packet.controls.publicApiBlockedState)
    && payload.agent10ReleasePacket.emergencyStopCertificationPacketIds.length === payload.emergencyStopCertification.packets.length;
  return {
    scenario,
    ok: status === 200 && queryOk && proofKindsOk && remediationOk && slaOk && Object.values(redactionProof).every(Boolean),
    status,
    endpoint,
    expectedOutput: endpoint === "/v1/intel/search"
      ? "HTTP 200 restrictedMetadata query summary with runtime proofs and no unsafe details"
      : "HTTP 200 restricted metadata status with runtime proofs and no unsafe details",
    partialState: payload.query?.partialState,
    matchingResultCount: payload.query?.matchingResultCount,
    observedRuntimeProofs,
    remediationActions,
    slaStatus: payload.operationalSla.status,
    releaseDecision: payload.agent10ReleasePacket.decision,
    enforcementLevel: payload.enforcement.level,
    emergencyStopState: payload.enforcement.emergencyStop.state,
    auditReplayScenarios: payload.auditReplay.observedScenarios,
    certificationScenarios: payload.connectorCertification.observedScenarios,
    killSwitchDrillScenarios: payload.killSwitchDrills.observedScenarios,
    emergencyStopCertificationScenarios: payload.emergencyStopCertification.observedScenarios,
    redactionProof
  };
}

function restrictedMetadataSources(): SourceRecord[] {
  const approvedGovernance = {
    approvalState: "approved" as const,
    approvalRequired: true,
    metadataOnly: true,
    approvedAt: "2026-05-01T00:00:00.000Z",
    approvedBy: "reviewer",
    policyVersion: "collection-policy:v1"
  };
  return [
    source({ id: "src_status_ready", name: "Status ready metadata", url: "http://readyexample.onion/posts", accessMethod: "approved_proxy", status: "active", governance: approvedGovernance }),
    source({ id: "src_status_pending", name: "Status pending metadata", url: "http://pendingexample.onion/posts", accessMethod: "approved_proxy", status: "needs_review", governance: { approvalState: "pending", approvalRequired: true, metadataOnly: true, policyVersion: "collection-policy:v1" } }),
    source({ id: "src_status_unsafe", name: "Status unsafe metadata", url: "http://user:pass@unsafeexample.onion/download/customer-dump.zip", accessMethod: "approved_proxy", status: "active", governance: approvedGovernance }),
    source({ id: "src_status_disabled", name: "Status disabled metadata", url: "http://disabledexample.onion/posts", accessMethod: "disabled", status: "disabled", governance: approvedGovernance })
  ];
}

function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_status",
    name: input.name ?? "Restricted metadata status fixture",
    type: "tor_metadata",
    url: input.url ?? "http://example.onion/posts",
    accessMethod: input.accessMethod ?? "approved_proxy",
    status: input.status ?? "active",
    risk: "high",
    trustScore: 0.7,
    crawlFrequencySeconds: 3600,
    legalNotes: input.legalNotes ?? "Restricted metadata status proof fixture.",
    approvedAt: "2026-05-01T00:00:00.000Z",
    approvedBy: "reviewer",
    governance: input.governance,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function restrictedMetadataCaptures(): RawCapture[] {
  return [{
    id: "cap_status_akira",
    sourceId: "src_status_ready",
    url: "http://readyexample.onion/posts/akira",
    collectedAt: "2026-05-24T00:00:00.000Z",
    contentHash: "hash_status_akira",
    mediaType: "text/plain",
    storageKind: "metadata_only",
    retentionClass: "restricted_metadata",
    metadata: {
      adapter: "darknet_metadata",
      leakSite: {
        actorName: "Akira",
        victimName: "Fjord Energy AS",
        claimDate: "2026-05-20",
        claimedSector: "Energy",
        claimedCountry: "NO",
        claimedDataCategory: "contracts",
        postStatus: "new",
        sourceTimestamp: "2026-05-23T00:00:00.000Z",
        urlHash: "urlhash_status_akira",
        screenshotHash: "screenhash_status_akira",
        confidence: 0.82
      },
      policyDecision: { id: "policy_status_akira" }
    },
    sensitive: true
  }];
}
