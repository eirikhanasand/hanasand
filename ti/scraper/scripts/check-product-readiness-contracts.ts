import { contractIndex } from "../src/api/contractsRoute.ts";
import { buildProductReadinessIntegrationGateFixtures } from "../src/product/productReadinessIntegrationGateFixtures.ts";

const contract = contractIndex();
const gate = contract.productReadinessIntegrationGate;
const fixtures = buildProductReadinessIntegrationGateFixtures();
const fixtureChecks = fixtures.map((fixture) => ({
  kind: fixture.kind,
  passed: fixture.passed,
  expectedBlockerCodes: fixture.expectedBlockerCodes,
  actualBlockerCodes: fixture.actualBlockerCodes,
  gateDecision: fixture.gate.decision
}));
const fixturesOk = fixtureChecks.every((fixture) => fixture.passed);
const ok = gate.ok && fixturesOk;

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
  fixtureSchemaVersion: fixtures[0]?.schemaVersion,
  fixtureChecks,
  safeOutput: gate.safeOutput
}, null, 2));

if (!ok) process.exitCode = 1;
