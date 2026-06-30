import { contractIndex } from "../src/api/contractsRoute.ts";
import {
  buildProductReadinessIntegrationGateFixtures,
  productReadinessConsumerProofMetadataGuard,
  productReadinessSchemaLookupMetadataGuard
} from "../src/product/productReadinessIntegrationGateFixtures.ts";

const contract = contractIndex();
const gate = contract.productReadinessIntegrationGate;
const consumerProofMetadata = productReadinessConsumerProofMetadataGuard(contract);
const schemaLookupMetadata = productReadinessSchemaLookupMetadataGuard(contract);
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
const fixtures = buildProductReadinessIntegrationGateFixtures();
const fixtureChecks = fixtures.map((fixture) => ({
  kind: fixture.kind,
  passed: fixture.passed,
  expectedBlockerCodes: fixture.expectedBlockerCodes,
  actualBlockerCodes: fixture.actualBlockerCodes,
  gateDecision: fixture.gate.decision,
  consumerProofMetadataOk: fixture.consumerProofMetadata.ok,
  schemaLookupMetadataOk: fixture.schemaLookupMetadata.ok
}));
const fixturesOk = fixtureChecks.every((fixture) => fixture.passed);
const ok = gate.ok && consumerProofMetadata.ok && schemaLookupMetadata.ok && fixturesOk;

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
  fixtureSchemaVersion: fixtures[0]?.schemaVersion,
  fixtureChecks,
  safeOutput: gate.safeOutput
}, null, 2));

if (!ok) process.exitCode = 1;
