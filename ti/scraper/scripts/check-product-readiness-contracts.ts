import { contractIndex } from "../src/api/contractsRoute.ts";
import {
  buildProductReadinessIntegrationGateFixtures,
  productReadinessConsumerProofMetadataGuard
} from "../src/product/productReadinessIntegrationGateFixtures.ts";

const contract = contractIndex();
const gate = contract.productReadinessIntegrationGate;
const consumerProofMetadata = productReadinessConsumerProofMetadataGuard(contract);
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
const fixtures = buildProductReadinessIntegrationGateFixtures();
const fixtureChecks = fixtures.map((fixture) => ({
  kind: fixture.kind,
  passed: fixture.passed,
  expectedBlockerCodes: fixture.expectedBlockerCodes,
  actualBlockerCodes: fixture.actualBlockerCodes,
  gateDecision: fixture.gate.decision,
  consumerProofMetadataOk: fixture.consumerProofMetadata.ok
}));
const fixturesOk = fixtureChecks.every((fixture) => fixture.passed);
const ok = gate.ok && consumerProofMetadata.ok && fixturesOk;

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
  fixtureSchemaVersion: fixtures[0]?.schemaVersion,
  fixtureChecks,
  safeOutput: gate.safeOutput
}, null, 2));

if (!ok) process.exitCode = 1;
