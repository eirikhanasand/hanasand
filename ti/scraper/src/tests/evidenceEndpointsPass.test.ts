import { describe, expect, test } from "bun:test";
import { startApiServer } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
import { json, seedMountedEvidence } from "./helpers/evidenceEndpointFixtures.ts";

describe("mounted evidence endpoints pass path", () => {
  test("serves replay-plan cutover report trust ledger and claim ledger without unsafe fields", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    seedMountedEvidence(store, { query: "APT29", runId: "run_pass" });
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier(), objectStore });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const replay = await json(`${base}/v1/evidence/replay-plan?q=APT29&runId=run_pass`);
      const report = await json(`${base}/v1/evidence/cutover-report?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z`);
      const ledger = await json(`${base}/v1/evidence/trust-ledger?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z`);
      const claimLedger = await json(`${base}/v1/evidence/claim-ledger?q=APT29&runId=run_pass&generatedAt=2026-05-24T22:00:00.000Z`);
      expect(replay.replayPlan).toMatchObject({ endpoint: "/v1/evidence/replay-plan", replayable: true, redaction: { sensitiveBodiesExposed: false, objectKeysExposed: false } });
      expect(report.cutoverReport).toMatchObject({ readiness: { overall: "ready" }, promotionGate: { agent09Fields: { cursorReplayReady: true }, agent10Fields: { objectIntegrityReady: true } } });
      expect(ledger.contract).toMatchObject({ endpoint: "/v1/evidence/trust-ledger", method: "GET", response: expect.arrayContaining(["trustGate", "claims", "cutover", "safeOutput"]) });
      expect(ledger.trustLedger).toMatchObject({ endpoint: "/v1/evidence/trust-ledger", trustGate: "ready", counts: { trusted: 1, blocked: 0 }, claims: [expect.objectContaining({ claimId: "incident_run_pass", ledgerIds: ["ledger_run_pass"], graphRelationshipIds: ["rel_run_pass"], trustStatus: "trusted", replayable: true })], safeOutput: { sensitiveBodiesExposed: false, objectKeysExposed: false, unsafeRestrictedMetadataExposed: false }, enforcement: { state: "pass", releaseAction: "promote", canPromote: true }, certification: { status: "certified", releaseAction: "promote", canCutover: true } });
      expect(claimLedger.contract).toMatchObject({ endpoint: "/v1/evidence/claim-ledger" });
      expect(claimLedger.claimLedger).toMatchObject({ endpoint: "/v1/evidence/claim-ledger", trustGate: "ready", claims: [expect.objectContaining({ ledgerIds: ["ledger_run_pass"], trustStatus: "trusted" })], certification: { status: "certified", releaseAction: "promote" } });
      const serialized = JSON.stringify({ replay, report, ledger, claimLedger }).toLowerCase();
      expect(serialized).not.toContain("raw proof payload");
      expect(serialized).not.toContain("\"body\":");
      expect(serialized).not.toContain("object/key");
    } finally {
      server.stop();
    }
  });
});
