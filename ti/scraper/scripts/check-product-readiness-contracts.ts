import { contractIndex } from "../src/api/contractsRoute.ts";
import {
  buildProductReadinessConsumerVerificationLedger,
  buildProductReadinessIntegrationGateFixtures,
  buildProductReadinessLaneSelfValidationExamples,
  buildProductReadinessOwnerLaneReceiptExamples,
  buildProductReadinessWorkflowAcceptanceReceipts,
  productReadinessConsumerProofMetadataGuard,
  productReadinessConsumerVerificationGuard,
  productReadinessLaneSelfValidationGuard,
  productReadinessOwnerLaneReceiptExamplesGuard,
  productReadinessSchemaLookupMetadataGuard,
  productReadinessWorkflowAcceptanceGuard
} from "../src/product/productReadinessIntegrationGateFixtures.ts";

const contract = contractIndex();
const gate = contract.productReadinessIntegrationGate;
const consumerProofMetadata = productReadinessConsumerProofMetadataGuard(contract);
const schemaLookupMetadata = productReadinessSchemaLookupMetadataGuard(contract);
const consumerVerification = productReadinessConsumerVerificationGuard(buildProductReadinessConsumerVerificationLedger(contract));
const workflowAcceptanceReceipts = buildProductReadinessWorkflowAcceptanceReceipts(contract);
const workflowAcceptance = productReadinessWorkflowAcceptanceGuard(workflowAcceptanceReceipts);
const ownerLaneReceiptExampleRows = buildProductReadinessOwnerLaneReceiptExamples(workflowAcceptanceReceipts);
const ownerLaneReceiptExamples = productReadinessOwnerLaneReceiptExamplesGuard(
  ownerLaneReceiptExampleRows
);
const laneSelfValidation = productReadinessLaneSelfValidationGuard(
  buildProductReadinessLaneSelfValidationExamples(ownerLaneReceiptExampleRows)
);
const consumerProofMetadataSummary = {
  schemaVersion: consumerProofMetadata.schemaVersion,
  route: consumerProofMetadata.route,
  ok: consumerProofMetadata.ok,
  rowCount: consumerProofMetadata.rowCount,
  blockerCodes: consumerProofMetadata.blockerCodes,
  failingRows: consumerProofMetadata.rows.filter((row) => !row.ok).map((row) => ({
    capabilityId: row.capabilityId,
    ownerLane: row.ownerLane,
    blockerCodes: row.blockerCodes,
    downstreamConsumerCount: row.downstreamConsumerCount,
    declaredDownstreamOwners: row.declaredDownstreamOwners,
    expectedDownstreamOwners: row.expectedDownstreamOwners
  })),
  safeOutput: consumerProofMetadata.safeOutput
};
const schemaLookupMetadataSummary = {
  schemaVersion: schemaLookupMetadata.schemaVersion,
  route: schemaLookupMetadata.route,
  ok: schemaLookupMetadata.ok,
  rowCount: schemaLookupMetadata.rowCount,
  blockerCodes: schemaLookupMetadata.blockerCodes,
  failingRows: schemaLookupMetadata.rows.filter((row) => !row.ok).map((row) => ({
    schemaId: row.schemaId,
    contractId: row.contractId,
    ownerLane: row.ownerLane,
    blockerCodes: row.blockerCodes,
    downstreamConsumerCount: row.downstreamConsumerCount,
    unsafeFields: row.unsafeFields
  })),
  safeOutput: schemaLookupMetadata.safeOutput
};
const consumerVerificationSummary = {
  schemaVersion: consumerVerification.schemaVersion,
  route: consumerVerification.route,
  ok: consumerVerification.ok,
  rowCount: consumerVerification.rowCount,
  verifiedAt: consumerVerification.verifiedAt,
  staleBefore: consumerVerification.staleBefore,
  proofCommand: consumerVerification.proofCommand,
  blockerCodes: consumerVerification.blockerCodes,
  failingRows: consumerVerification.rows.filter((row) => !row.ok).map((row) => ({
    capabilityId: row.capabilityId,
    ownerLane: row.ownerLane,
    blockerCodes: row.blockerCodes,
    consumerVerificationCount: row.consumerVerificationCount
  })),
  safeOutput: consumerVerification.safeOutput
};
const workflowAcceptanceSummary = {
  schemaVersion: workflowAcceptance.schemaVersion,
  route: workflowAcceptance.route,
  ok: workflowAcceptance.ok,
  rowCount: workflowAcceptance.rowCount,
  requiredWorkflowIds: workflowAcceptance.requiredWorkflowIds,
  missingWorkflowIds: workflowAcceptance.missingWorkflowIds,
  verifiedAt: workflowAcceptance.verifiedAt,
  staleBefore: workflowAcceptance.staleBefore,
  proofCommand: workflowAcceptance.proofCommand,
  blockerCodes: workflowAcceptance.blockerCodes,
  failingRows: workflowAcceptance.rows.filter((row) => !row.ok).map((row) => ({
    workflowId: row.workflowId,
    blockerCodes: row.blockerCodes,
    customerWorkflowIds: row.customerWorkflowIds,
    missingExpectedSchemaLookupContractIds: row.missingExpectedSchemaLookupContractIds,
    schemaLookupRefCount: row.schemaLookupRefCount,
    consumerCount: row.consumerCount
  })),
  safeOutput: workflowAcceptance.safeOutput
};
const ownerLaneReceiptExamplesSummary = {
  schemaVersion: ownerLaneReceiptExamples.schemaVersion,
  route: ownerLaneReceiptExamples.route,
  ok: ownerLaneReceiptExamples.ok,
  rowCount: ownerLaneReceiptExamples.rowCount,
  requiredWorkflowIds: ownerLaneReceiptExamples.requiredWorkflowIds,
  missingWorkflowIds: ownerLaneReceiptExamples.missingWorkflowIds,
  verifiedAt: ownerLaneReceiptExamples.verifiedAt,
  staleBefore: ownerLaneReceiptExamples.staleBefore,
  proofCommand: ownerLaneReceiptExamples.proofCommand,
  blockerCodes: ownerLaneReceiptExamples.blockerCodes,
  failingRows: ownerLaneReceiptExamples.rows.filter((row) => !row.ok).map((row) => ({
    exampleId: row.exampleId,
    workflowId: row.workflowId,
    ownerLane: row.ownerLane,
    blockerCodes: row.blockerCodes,
    missingExpectedSchemaLookupContractIds: row.missingExpectedSchemaLookupContractIds,
    schemaLookupRefCount: row.schemaLookupRefCount,
    consumerOwnerLanes: row.consumerOwnerLanes,
    payloadShapeRequiredFieldCount: row.payloadShapeRequiredFieldCount
  })),
  safeOutput: ownerLaneReceiptExamples.safeOutput
};
const laneSelfValidationSummary = {
  schemaVersion: laneSelfValidation.schemaVersion,
  route: laneSelfValidation.route,
  ok: laneSelfValidation.ok,
  rowCount: laneSelfValidation.rowCount,
  requiredLaneIds: laneSelfValidation.requiredLaneIds,
  missingLaneIds: laneSelfValidation.missingLaneIds,
  verifiedAt: laneSelfValidation.verifiedAt,
  staleBefore: laneSelfValidation.staleBefore,
  proofCommand: laneSelfValidation.proofCommand,
  blockerCodes: laneSelfValidation.blockerCodes,
  failingRows: laneSelfValidation.rows.filter((row) => !row.ok).map((row) => ({
    laneId: row.laneId,
    ownerLane: row.ownerLane,
    blockerCodes: row.blockerCodes,
    workflowIds: row.workflowIds,
    missingExpectedSchemaLookupContractIds: row.missingExpectedSchemaLookupContractIds,
    routeRefs: row.routeRefs,
    payloadShapeRequiredFieldCount: row.payloadShapeRequiredFieldCount
  })),
  safeOutput: laneSelfValidation.safeOutput
};
const fixtures = buildProductReadinessIntegrationGateFixtures();
const fixtureChecks = fixtures.map((fixture) => ({
  kind: fixture.kind,
  passed: fixture.passed,
  expectedBlockerCodes: fixture.expectedBlockerCodes,
  actualBlockerCodes: fixture.actualBlockerCodes,
  gateDecision: fixture.gate.decision,
  consumerProofMetadataOk: fixture.consumerProofMetadata.ok,
  schemaLookupMetadataOk: fixture.schemaLookupMetadata.ok,
  consumerVerificationOk: fixture.consumerVerification.ok,
  workflowAcceptanceOk: fixture.workflowAcceptance.ok,
  ownerLaneReceiptExamplesOk: fixture.ownerLaneReceiptExamples.ok,
  laneSelfValidationOk: fixture.laneSelfValidation.ok
}));
const fixturesOk = fixtureChecks.every((fixture) => fixture.passed);
const ok = gate.ok
  && consumerProofMetadata.ok
  && schemaLookupMetadata.ok
  && consumerVerification.ok
  && workflowAcceptance.ok
  && ownerLaneReceiptExamples.ok
  && laneSelfValidation.ok
  && fixturesOk;

console.log(JSON.stringify({
  ok,
  decision: gate.decision,
  schemaVersion: gate.schemaVersion,
  route: gate.route,
  checkCount: gate.checkCount,
  blockerCodes: gate.blockerCodes,
  checks: gate.checks.map((check) => ({
    id: check.id,
    ownerLane: check.ownerLane,
    route: check.route,
    artifact: check.artifact,
    ok: check.ok,
    blockerCodes: check.blockerCodes,
    evidence: check.evidence
  })),
  consumerProofMetadata: consumerProofMetadataSummary,
  schemaLookupMetadata: schemaLookupMetadataSummary,
  consumerVerification: consumerVerificationSummary,
  workflowAcceptance: workflowAcceptanceSummary,
  ownerLaneReceiptExamples: ownerLaneReceiptExamplesSummary,
  laneSelfValidation: laneSelfValidationSummary,
  fixtureSchemaVersion: fixtures[0]?.schemaVersion,
  fixtureChecks,
  safeOutput: gate.safeOutput
}, null, 2));

if (!ok) process.exitCode = 1;
