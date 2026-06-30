import { contractIndex } from "../src/api/contractsRoute.ts";

const contract = contractIndex();
const gate = contract.productReadinessIntegrationGate;

console.log(JSON.stringify({
  ok: gate.ok,
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
  safeOutput: gate.safeOutput
}, null, 2));

if (!gate.ok) process.exitCode = 1;
