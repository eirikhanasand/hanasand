import {
  activatePublicCanarySources,
  api,
  apiRestrictedMetadataApplyPlanSources,
  body,
  buildCanaryOperatorSummary,
  describe,
  expect,
  FileBackedScraperStore,
  fixtureCapture,
  fixtureDelta,
  FocusedFrontier,
  handleApiRequest,
  hashContent,
  InMemoryObjectEvidenceStore,
  InMemoryScraperStore,
  join,
  loadRuntimeConfig,
  mkdtempSync,
  processCollectedItem,
  restrictedMetadataApplyPlanSources,
  rmSync,
  runCanaryCollectionCycle,
  seedEvidenceReplayFixture,
  source,
  startApiServer,
  startCanaryCollectionLoop,
  telegramCapture,
  test,
  tmpdir,
} from "../apiTestHarness.ts";
import type {
  AnalystClaimLedgerEntry,
  CanaryOperatorResponseForTest,
  CanaryReadinessResponseForTest,
  CanarySoakResponseForTest,
  RawCapture,
  SourceRecord,
} from "../apiTestHarness.ts";

describe("api v1", () => {
  test("reviews claim ledger entries through metadata-only API actions", async () => {
    const store = new InMemoryScraperStore();
    const now = "2026-05-24T12:30:00.000Z";
    const entry: AnalystClaimLedgerEntry = {
      id: "claim_fjord_accounts",
      tenantId: "tenant_claims",
      normalizedQuery: "fjord energy as akira",
      reviewTaskId: "review_fjord",
      captureId: "capture_fjord_metadata",
      sourceId: "src_restricted_metadata",
      claimKind: "affected_accounts_claim",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      claimTextSummary:
        "Akira listed Fjord Energy AS with 18,432 affected accounts and 42 GB dataset size.",
      sourceHash: "hash_fjord_claim",
      confidence: 0.72,
      ledgerStatus: "metadata_review",
      observedAt: now,
      provenance: {
        sourceFamily: "restricted_metadata",
        rawLeakMaterialAccessed: false,
      },
      createdAt: now,
    };
    store.saveAnalystClaimLedgerEntry(entry);
    store.saveIntelligenceClaim({
      id: entry.id,
      tenantId: entry.tenantId,
      sourceIds: [entry.sourceId],
      captureIds: [entry.captureId],
      claimType: entry.claimKind,
      summary: entry.claimTextSummary,
      confidence: entry.confidence,
      reviewState: "needs_review",
      corroborationState: "uncorroborated",
    });
    const options = {
      store,
      frontier: new FocusedFrontier(),
      authApiBase: "http://auth.test/api",
      authFetch: async (input: string | URL | Request) => {
        const id = new URL(String(input)).pathname.split("/").pop();
        return Response.json({ id, roles: [{ id: id === "legal-1" ? "admin" : "analyst" }] });
      }
    } as any;
    const ledger = await body(
      await handleApiRequest(
        api("/v1/analyst/claim-ledger?q=Fjord&tenantId=tenant_claims"),
        options,
      ),
    );
    expect(ledger).toMatchObject({
      contract: {
        endpoint: "/v1/analyst/claim-ledger",
        metadataOnly: true,
        safeForApi: true,
        rawLeakMaterialAccessed: false,
        objectKeysExposed: false,
      },
      runStatusClarity: {
        totalClaims: 1,
        reviewRequired: 1,
        graphEligible: 0,
        stixEligible: 0,
      },
      entries: [expect.objectContaining({
        id: "claim_fjord_accounts",
        claimKind: "affected_accounts_claim",
        company: "Fjord Energy AS",
        sourceHash: "hash_fjord_claim",
        ledgerStatus: "metadata_review",
        eligibilityBlockers: expect.arrayContaining(["claim_not_trusted"]),
      })],
    });
    const promote = await body(
      await handleApiRequest(
        api("/v1/analyst/claim-ledger/claim_fjord_accounts/actions?tenantId=tenant_claims", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer test",
            id: "analyst-6",
          },
          body: JSON.stringify({
            action: "promote",
            dryRun: false,
            reason: "Validated against public notice and safe metadata.",
            confidence: 0.88,
          }),
        }),
        options,
      ),
    );
    expect(promote).toMatchObject({
      contract: {
        metadataOnly: true,
        graphPromotionAutomatic: false,
        stixPromotionAutomatic: false,
      },
      result: {
        persisted: true,
        nextStatus: "trusted",
        graphEligible: true,
        stixEligible: true,
      },
      entry: {
        ledgerStatus: "trusted",
        confidence: 0.88,
        reviewedBy: "analyst-6",
      },
    });
    expect(store.listAnalystClaimLedgerEntries()[0]).toMatchObject({
      ledgerStatus: "trusted",
      graphEligible: true,
      stixEligible: true,
      reviewedBy: "analyst-6",
    });
    const legalHold = await body(
      await handleApiRequest(
        api("/v1/analyst/claim-ledger/claim_fjord_accounts/actions?tenantId=tenant_claims", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer test",
            id: "legal-1",
          },
          body: JSON.stringify({
            action: "attach_legal_hold",
            dryRun: false,
            reason:
              "Preserve claim while counsel reviews notification wording.",
          }),
        }),
        options,
      ),
    );
    expect(legalHold).toMatchObject({
      result: {
        persisted: true,
        nextStatus: "trusted",
        graphEligible: false,
        stixEligible: false,
      },
      entry: {
        legalHold: true,
        retentionClass: "legal_hold",
        eligibilityBlockers: expect.arrayContaining(["legal_hold"]),
      },
    });
    expect(JSON.stringify(ledger)).not.toContain("customer-dump");
    expect(JSON.stringify(promote)).not.toContain("password");
    expect(JSON.stringify(legalHold)).not.toContain("object/key");
  });
});
