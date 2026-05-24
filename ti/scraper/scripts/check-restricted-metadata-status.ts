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
  nonBlockingScenarios: string[];
  analystOperationScenarios: string[];
  isolationHarnessScenarios: string[];
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
    operatorGovernanceMetadataOnly: boolean;
    darkCanaryMetadataOnly: boolean;
    legalEthicsAuditMetadataOnly: boolean;
    auditReplayMetadataOnly: boolean;
    certificationMetadataOnly: boolean;
    killSwitchDrillsMetadataOnly: boolean;
    emergencyStopCertificationMetadataOnly: boolean;
    nonBlockingSearchMetadataOnly: boolean;
    analystOperationsMetadataOnly: boolean;
    isolationHarnessMetadataOnly: boolean;
  };
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
    controls: { canHold: boolean; canPauseWorkers: boolean; canRollback: boolean; canEmergencyStop: boolean; publicApiBlockedState: boolean };
    proof: { noUnsafeAccess: boolean; noDataExposure: boolean; noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean; noRawPayloads: boolean; noRawUrls: boolean; hashOnlyEvidence: boolean };
    noLeakSerialization: { passed: boolean };
  }>;
};

type NonBlockingSearchProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  nonBlockingPublicSearch: boolean;
  maxPublicSearchAddedLatencyMs: number;
  observedScenarios: string[];
  packets: Array<{
    publicSearchAction: string;
    proof: { doesNotBlockPublicSearch: boolean; doesNotPromoteRestrictedFacts: boolean; noUnsafeAccess: boolean; noDataExposure: boolean; noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean; noRawPayloads: boolean; noRawUrls: boolean; hashOnlyEvidence: boolean };
    noLeakSerialization: { passed: boolean };
  }>;
};

type AnalystOperationsProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  dryRunOnly: boolean;
  observedScenarios: string[];
  victimNotificationPacketCount: number;
  noLeakSerialization: { passed: boolean };
  packets: Array<{
    metadataOnly: boolean;
    safeForApi: boolean;
    dryRunOnly: boolean;
    schedulerIsolation: { directEgressAllowed: boolean };
    proof: {
      noStolenFilesDownloaded: boolean;
      noCredentials: boolean;
      noAuthBypass: boolean;
      noCaptchaSolving: boolean;
      noPrivateAccess: boolean;
      noThreatActorInteraction: boolean;
      noRawUnsafeUrls: boolean;
      metadataOnlyAllowedFields: boolean;
    };
    noLeakSerialization: { passed: boolean };
  }>;
};

type IsolationHarnessProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  dryRunOnly: boolean;
  nonNetworked: boolean;
  observedScenarios: string[];
  legalSecurityEvidencePacketCount: number;
  noLeakSerialization: { passed: boolean };
  packets: Array<{
    nonNetworked: boolean;
    connectorBoundary: { approvedProxyRequired: boolean; directEgressAllowed: boolean; accountStateAllowed: boolean };
    workerIsolation: { isolatedPoolRequired: boolean; killSwitchPropagates: boolean; timeoutAttributed: boolean };
    complianceEvidence: { legalReviewReady: boolean; securityReviewReady: boolean; agent10ReleaseGate: string };
    proof: { noNetworkCalls: boolean; approvedProxyOnly: boolean; directEgressBlocked: boolean; noRawPayloads: boolean; noCredentialStorage: boolean; noPrivateAccess: boolean; noThreatActorInteraction: boolean; noCaptchaSolving: boolean; unsafeTargetsBlocked: boolean };
    noLeakSerialization: { passed: boolean };
  }>;
};

type OperatorGovernanceProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  dryRunOnly: boolean;
  operatorVisible: boolean;
  observedScenarios: string[];
  noLeakSerialization: { passed: boolean };
  packets: Array<{
    metadataOnly: boolean;
    safeForApi: boolean;
    dryRunOnly: boolean;
    operatorVisible: boolean;
    sourceHashOnly: boolean;
    sourceHash: string;
    policyReason: string;
    allowedActions: string[];
    forbiddenActions: string[];
    graphStixApiEffect: { stix: string; publicSearch: string };
    rollbackPath: string[];
    auditId: string;
    proofCommands: string[];
    proof: {
      noRawOnionUrls: boolean;
      noStolenFileNames: boolean;
      noLeakedRows: boolean;
      noCredentials: boolean;
      noScreenshots: boolean;
      noPrivateChannelContent: boolean;
      noActorInteractionText: boolean;
      metadataOnlyEvidence: boolean;
      sourceHashOnly: boolean;
    };
    noLeakSerialization: { passed: boolean };
  }>;
};

type DarkCanaryProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  dryRunOnly: boolean;
  fixtureBacked: boolean;
  observedScenarios: string[];
  noLeakSerialization: { passed: boolean };
  packets: Array<{
    metadataOnly: boolean;
    safeForApi: boolean;
    dryRunOnly: boolean;
    fixtureBacked: boolean;
    sourceHashOnly: boolean;
    safeSourceHash: string;
    urlHash: string;
    policyState: string;
    reviewState: string;
    publicGraphStixEffects: { publicSearch: string; stix: string; api: string };
    proxyIsolationBoundary: {
      approvedProxyRequired: boolean;
      directEgressAllowed: boolean;
      credentialsAllowed: boolean;
      formsAllowed: boolean;
      captchaSolvingAllowed: boolean;
      privateCommunityAccessAllowed: boolean;
      fileDownloadsAllowed: boolean;
      threatActorInteractionAllowed: boolean;
      rawUnsafeUrlExposureAllowed: boolean;
    };
    emergencyStopPropagation: { scheduler: string; evidence: string; graph: string; api: string; releaseGate: string };
    operatorProofPacket: { proofCommands: string[]; forbiddenActions: string[] };
    noLeakProof: {
      noRawOnionUrls: boolean;
      noRawUnsafeUrls: boolean;
      noRawPayloads: boolean;
      noStolenFileDownloads: boolean;
      noCredentialValues: boolean;
      noCaptchaSolving: boolean;
      noPrivateAccess: boolean;
      noThreatActorInteraction: boolean;
    };
    noLeakSerialization: { passed: boolean };
  }>;
};

type LegalEthicsAuditProof = {
  metadataOnly: boolean;
  safeForApi: boolean;
  dryRunOnly: boolean;
  thesisReady: boolean;
  enterpriseReady: boolean;
  observedScenarios: string[];
  summary: {
    packetCount: number;
    blockedOperationCount: number;
    holdCount: number;
    rollbackCount: number;
  };
  noLeakSerialization: { passed: boolean };
  packets: Array<{
    scenario: string;
    metadataOnly: boolean;
    safeForApi: boolean;
    dryRunOnly: boolean;
    thesisReady: boolean;
    enterpriseReady: boolean;
    collected: {
      fields: string[];
      sourceHashIds: string[];
      urlHashIds: string[];
      evidenceType: string;
    };
    blocked: { operations: string[]; reason: string };
    approval: { policyVersion: string; auditTrailIds: string[] };
    whatWasNotAccessed: string[];
    releaseInterpretation: string;
    graphStixApiEffect: { stix: string; api: string; publicSearch: string };
    proofCommands: string[];
    handoffs: { agent09ApiField: string };
    noLeakValidation: Record<string, boolean>;
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
      operatorGovernance: OperatorGovernanceProof;
      darkMetadataCanary: DarkCanaryProof;
      legalEthicsAuditExport: LegalEthicsAuditProof;
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ metadataOnly: boolean; safeForApi: boolean; scenario: string }> };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; killSwitchPropagation: { publicApiState: string }; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: EmergencyStopCertificationProof;
      nonBlockingSearch: NonBlockingSearchProof;
      analystOperations: AnalystOperationsProof;
      isolationHarness: IsolationHarnessProof;
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
      operatorGovernance: OperatorGovernanceProof;
      darkMetadataCanary: DarkCanaryProof;
      legalEthicsAuditExport: LegalEthicsAuditProof;
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ metadataOnly: boolean; safeForApi: boolean; scenario: string }> };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; killSwitchPropagation: { publicApiState: string }; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: EmergencyStopCertificationProof;
      nonBlockingSearch: NonBlockingSearchProof;
      analystOperations: AnalystOperationsProof;
      isolationHarness: IsolationHarnessProof;
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
    operatorGovernance: OperatorGovernanceProof;
    darkMetadataCanary: DarkCanaryProof;
    legalEthicsAuditExport: LegalEthicsAuditProof;
    auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ metadataOnly: boolean; safeForApi: boolean; scenario: string }> };
    connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
    killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; killSwitchPropagation: { publicApiState: string }; guarantees: { noContact: boolean; noDownload: boolean; noCredentialBypass: boolean; noCaptchaSolving: boolean; noStealth: boolean }; noLeakSerialization: { passed: boolean } }> };
    emergencyStopCertification: EmergencyStopCertificationProof;
    nonBlockingSearch: NonBlockingSearchProof;
    analystOperations: AnalystOperationsProof;
    isolationHarness: IsolationHarnessProof;
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
    operatorGovernanceMetadataOnly: payload.operatorGovernance.metadataOnly && payload.operatorGovernance.safeForApi && payload.operatorGovernance.dryRunOnly && payload.operatorGovernance.operatorVisible && payload.operatorGovernance.noLeakSerialization.passed && payload.operatorGovernance.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.sourceHashOnly &&
      packet.sourceHash.length > 0 &&
      packet.policyReason.length > 0 &&
      packet.allowedActions.includes("keep_public_search_non_blocking") &&
      packet.forbiddenActions.includes("download_stolen_files") &&
      packet.graphStixApiEffect.stix === "blocked" &&
      packet.graphStixApiEffect.publicSearch === "non_blocking" &&
      packet.rollbackPath.includes("restore_review_hold") &&
      packet.auditId.startsWith("restricted-governance-audit_") &&
      packet.proofCommands.includes("bun run check:restricted-metadata-status") &&
      packet.proof.noRawOnionUrls &&
      packet.proof.noStolenFileNames &&
      packet.proof.noLeakedRows &&
      packet.proof.noCredentials &&
      packet.proof.noScreenshots &&
      packet.proof.noPrivateChannelContent &&
      packet.proof.noActorInteractionText &&
      packet.proof.metadataOnlyEvidence &&
      packet.proof.sourceHashOnly &&
      packet.noLeakSerialization.passed
    ),
    darkCanaryMetadataOnly: payload.darkMetadataCanary.metadataOnly && payload.darkMetadataCanary.safeForApi && payload.darkMetadataCanary.dryRunOnly && payload.darkMetadataCanary.fixtureBacked && payload.darkMetadataCanary.noLeakSerialization.passed && payload.darkMetadataCanary.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.fixtureBacked &&
      packet.sourceHashOnly &&
      packet.safeSourceHash.length > 0 &&
      packet.urlHash.length > 0 &&
      packet.publicGraphStixEffects.publicSearch === "non_blocking" &&
      packet.publicGraphStixEffects.stix === "blocked" &&
      packet.publicGraphStixEffects.api === "restrictedMetadata.darkMetadataCanary" &&
      packet.proxyIsolationBoundary.approvedProxyRequired &&
      packet.proxyIsolationBoundary.directEgressAllowed === false &&
      packet.proxyIsolationBoundary.credentialsAllowed === false &&
      packet.proxyIsolationBoundary.formsAllowed === false &&
      packet.proxyIsolationBoundary.captchaSolvingAllowed === false &&
      packet.proxyIsolationBoundary.privateCommunityAccessAllowed === false &&
      packet.proxyIsolationBoundary.fileDownloadsAllowed === false &&
      packet.proxyIsolationBoundary.threatActorInteractionAllowed === false &&
      packet.proxyIsolationBoundary.rawUnsafeUrlExposureAllowed === false &&
      packet.emergencyStopPropagation.scheduler === "pause_restricted_partition" &&
      packet.emergencyStopPropagation.evidence === "metadata_only_no_object_download" &&
      packet.emergencyStopPropagation.graph === "hold_restricted_edges" &&
      packet.emergencyStopPropagation.api === "safe_metadata_only" &&
      packet.operatorProofPacket.proofCommands.includes("bun run check:restricted-metadata-status") &&
      packet.operatorProofPacket.forbiddenActions.includes("download_stolen_files") &&
      packet.noLeakProof.noRawOnionUrls &&
      packet.noLeakProof.noRawUnsafeUrls &&
      packet.noLeakProof.noRawPayloads &&
      packet.noLeakProof.noStolenFileDownloads &&
      packet.noLeakProof.noCredentialValues &&
      packet.noLeakProof.noCaptchaSolving &&
      packet.noLeakProof.noPrivateAccess &&
      packet.noLeakProof.noThreatActorInteraction &&
      packet.noLeakSerialization.passed
    ),
    legalEthicsAuditMetadataOnly: payload.legalEthicsAuditExport.metadataOnly && payload.legalEthicsAuditExport.safeForApi && payload.legalEthicsAuditExport.dryRunOnly && payload.legalEthicsAuditExport.thesisReady && payload.legalEthicsAuditExport.enterpriseReady && payload.legalEthicsAuditExport.noLeakSerialization.passed && payload.legalEthicsAuditExport.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.thesisReady &&
      packet.enterpriseReady &&
      packet.collected.evidenceType === "restricted_metadata_hashes_and_claim_fields_only" &&
      packet.collected.fields.includes("actor") &&
      packet.collected.sourceHashIds.length > 0 &&
      packet.collected.urlHashIds.length > 0 &&
      packet.blocked.operations.includes("download_stolen_files") &&
      packet.blocked.operations.includes("interact_with_threat_actor") &&
      packet.approval.policyVersion === "restricted_metadata_policy_v1" &&
      packet.approval.auditTrailIds.length > 0 &&
      packet.whatWasNotAccessed.includes("leaked rows") &&
      packet.whatWasNotAccessed.includes("threat actor communications") &&
      packet.graphStixApiEffect.stix === "blocked" &&
      packet.graphStixApiEffect.api === "metadata_only_audit" &&
      packet.graphStixApiEffect.publicSearch === "non_blocking" &&
      packet.proofCommands.includes("bun run check:restricted-metadata-status") &&
      packet.handoffs.agent09ApiField === "restrictedMetadata.legalEthicsAuditExport" &&
      Object.values(packet.noLeakValidation).every(Boolean) &&
      packet.noLeakSerialization.passed
    ),
    auditReplayMetadataOnly: payload.auditReplay.metadataOnly && payload.auditReplay.safeForApi && payload.auditReplay.scenarios.every((scenario) => scenario.metadataOnly && scenario.safeForApi),
    certificationMetadataOnly: payload.connectorCertification.metadataOnly && payload.connectorCertification.safeForApi && payload.connectorCertification.dryRunOnly && payload.connectorCertification.noLeakSerialization.passed && payload.connectorCertification.packets.every((packet) =>
      packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload && packet.guarantees.noCredentialBypass && packet.guarantees.noCaptchaSolving && packet.guarantees.noStealth
    ),
    killSwitchDrillsMetadataOnly: payload.killSwitchDrills.metadataOnly && payload.killSwitchDrills.safeForApi && payload.killSwitchDrills.dryRunOnly && payload.killSwitchDrills.operatorVisible && payload.killSwitchDrills.noLeakSerialization.passed && payload.killSwitchDrills.packets.every((packet) =>
      packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.operatorVisible && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload && packet.guarantees.noCredentialBypass && packet.guarantees.noCaptchaSolving && packet.guarantees.noStealth
    ),
    emergencyStopCertificationMetadataOnly: payload.emergencyStopCertification.metadataOnly && payload.emergencyStopCertification.safeForApi && payload.emergencyStopCertification.dryRunOnly && payload.emergencyStopCertification.noLeakSerialization.passed && payload.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" && packet.noLeakSerialization.passed && packet.proof.noUnsafeAccess && packet.proof.noDataExposure && packet.proof.noContact && packet.proof.noDownload && packet.proof.noCredentialBypass && packet.proof.noCaptchaSolving && packet.proof.noStealth && packet.proof.noRawPayloads && packet.proof.noRawUrls && packet.proof.hashOnlyEvidence
    ),
    nonBlockingSearchMetadataOnly: payload.nonBlockingSearch.metadataOnly && payload.nonBlockingSearch.safeForApi && payload.nonBlockingSearch.nonBlockingPublicSearch && payload.nonBlockingSearch.maxPublicSearchAddedLatencyMs === 0 && payload.nonBlockingSearch.packets.every((packet) =>
      packet.publicSearchAction === "continue_clear_web_and_public_channel" && packet.noLeakSerialization.passed && packet.proof.doesNotBlockPublicSearch && packet.proof.doesNotPromoteRestrictedFacts && packet.proof.noUnsafeAccess && packet.proof.noDataExposure && packet.proof.noContact && packet.proof.noDownload && packet.proof.noCredentialBypass && packet.proof.noCaptchaSolving && packet.proof.noStealth && packet.proof.noRawPayloads && packet.proof.noRawUrls && packet.proof.hashOnlyEvidence
    ),
    analystOperationsMetadataOnly: payload.analystOperations.metadataOnly && payload.analystOperations.safeForApi && payload.analystOperations.dryRunOnly && payload.analystOperations.victimNotificationPacketCount > 0 && payload.analystOperations.noLeakSerialization.passed && payload.analystOperations.packets.every((packet) =>
      packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.schedulerIsolation.directEgressAllowed === false && packet.noLeakSerialization.passed && packet.proof.noStolenFilesDownloaded && packet.proof.noCredentials && packet.proof.noAuthBypass && packet.proof.noCaptchaSolving && packet.proof.noPrivateAccess && packet.proof.noThreatActorInteraction && packet.proof.noRawUnsafeUrls && packet.proof.metadataOnlyAllowedFields
    ),
    isolationHarnessMetadataOnly: payload.isolationHarness.metadataOnly && payload.isolationHarness.safeForApi && payload.isolationHarness.dryRunOnly && payload.isolationHarness.nonNetworked && payload.isolationHarness.legalSecurityEvidencePacketCount > 0 && payload.isolationHarness.noLeakSerialization.passed && payload.isolationHarness.packets.every((packet) =>
      packet.nonNetworked && packet.connectorBoundary.approvedProxyRequired && packet.connectorBoundary.directEgressAllowed === false && packet.connectorBoundary.accountStateAllowed === false && packet.workerIsolation.isolatedPoolRequired && packet.workerIsolation.killSwitchPropagates && packet.workerIsolation.timeoutAttributed && packet.complianceEvidence.legalReviewReady && packet.complianceEvidence.securityReviewReady && packet.noLeakSerialization.passed && packet.proof.noNetworkCalls && packet.proof.approvedProxyOnly && packet.proof.directEgressBlocked && packet.proof.noRawPayloads && packet.proof.noCredentialStorage && packet.proof.noPrivateAccess && packet.proof.noThreatActorInteraction && packet.proof.noCaptchaSolving && packet.proof.unsafeTargetsBlocked
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
    && payload.operatorGovernance.observedScenarios.includes("ransomware_leak_claim_review_hold")
    && payload.operatorGovernance.observedScenarios.includes("emergency_stop_active")
    && payload.darkMetadataCanary.observedScenarios.includes("tor_metadata_canary")
    && payload.darkMetadataCanary.observedScenarios.includes("i2p_metadata_canary")
    && payload.darkMetadataCanary.observedScenarios.includes("freenet_metadata_canary")
    && payload.darkMetadataCanary.observedScenarios.includes("ransomware_leak_site_claim")
    && payload.darkMetadataCanary.observedScenarios.includes("emergency_stop")
    && payload.darkMetadataCanary.packets.some((packet) => packet.policyState === "blocked" && packet.reviewState === "blocked_unsafe_target")
    && payload.darkMetadataCanary.packets.some((packet) => packet.scenario === "emergency_stop" && packet.emergencyStopPropagation.releaseGate === "rollback")
    && payload.legalEthicsAuditExport.observedScenarios.includes("metadata_only_collection")
    && payload.legalEthicsAuditExport.observedScenarios.includes("unsafe_target_blocked")
    && payload.legalEthicsAuditExport.observedScenarios.includes("emergency_stop_review")
    && payload.legalEthicsAuditExport.observedScenarios.includes("operator_thesis_export")
    && payload.legalEthicsAuditExport.summary.packetCount === payload.legalEthicsAuditExport.packets.length
    && payload.legalEthicsAuditExport.summary.blockedOperationCount >= 1
    && payload.legalEthicsAuditExport.summary.holdCount >= 1
    && payload.legalEthicsAuditExport.summary.rollbackCount >= 1
    && payload.legalEthicsAuditExport.packets.some((packet) => packet.releaseInterpretation === "rollback")
    && payload.legalEthicsAuditExport.packets.some((packet) => packet.releaseInterpretation === "hold")
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
  const nonBlockingOk = payload.nonBlockingSearch.observedScenarios.length > 0
    && (scenario !== "status_route" || payload.nonBlockingSearch.observedScenarios.includes("public_api_blocked_state"))
    && (scenario !== "intel_search_actor" || payload.nonBlockingSearch.observedScenarios.includes("ransomware_query"))
    && (scenario !== "intel_search_unknown" || payload.nonBlockingSearch.observedScenarios.includes("actor_query"));
  const analystOperationsOk = payload.analystOperations.observedScenarios.includes("victim_notification_packet")
    && payload.analystOperations.observedScenarios.includes("raw_payload_blocked")
    && payload.analystOperations.observedScenarios.includes("emergency_stop_rollback")
    && (scenario !== "intel_search_actor" || payload.analystOperations.observedScenarios.includes("actor_leak_site_claim"))
    && (scenario !== "intel_search_unknown" || payload.analystOperations.observedScenarios.includes("made_up_actor_query"));
  const isolationHarnessOk = payload.isolationHarness.observedScenarios.includes("proxy_boundary_proof")
    && payload.isolationHarness.observedScenarios.includes("kill_switch_propagation")
    && payload.isolationHarness.observedScenarios.includes("timeout_attribution")
    && payload.isolationHarness.observedScenarios.includes("raw_payload_denied")
    && payload.isolationHarness.observedScenarios.includes("unsafe_form_contact_detection")
    && payload.isolationHarness.observedScenarios.includes("credential_storage_denied")
    && payload.isolationHarness.observedScenarios.includes("private_access_denied")
    && payload.isolationHarness.observedScenarios.includes("threat_actor_interaction_denied");
  return {
    scenario,
    ok: status === 200 && queryOk && proofKindsOk && remediationOk && slaOk && nonBlockingOk && analystOperationsOk && isolationHarnessOk && Object.values(redactionProof).every(Boolean),
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
    nonBlockingScenarios: payload.nonBlockingSearch.observedScenarios,
    analystOperationScenarios: payload.analystOperations.observedScenarios,
    isolationHarnessScenarios: payload.isolationHarness.observedScenarios,
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
