import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("publishes auth integration boundary without accepting secrets in scraper", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() };
    const response = await body(await handleApiRequest(api("/v1/auth/integration-notes"), options));
    expect(response).toMatchObject({
      version: "v1",
      authBoundary: {
        schemaVersion: "ti.enterprise_auth_boundary.v1",
        mode: "trusted_gateway_forwarded_identity",
        enforcedHere: false,
        requiredForwardedHeaders: expect.arrayContaining(["x-tenant-id", "x-actor-id"]),
        tenantContract: {
          header: "x-tenant-id",
          requiredForProduction: true
        },
        requesterContract: {
          header: "x-actor-id",
          requiredForProduction: true,
          auditOnlyHere: true
        },
        secretHandling: {
          scraperDoesNotStoreSecrets: true,
          bearerTokensAcceptedHere: false
        }
      },
      notes: expect.arrayContaining([
        expect.stringContaining("Authenticate at the main CTI app")
      ])
    });
    expect(JSON.stringify(response).toLowerCase()).not.toContain("authorization:");
    expect(JSON.stringify(response).toLowerCase()).not.toContain("cookie=");
  });
});
