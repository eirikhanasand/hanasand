import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("publishes auth integration boundary without accepting secrets in scraper", async () => {
    const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() };
    const response = await body(await handleApiRequest(api("/v1/auth/integration-notes"), options));
    expect(response).toMatchObject({
      version: "v1",
      authBoundary: {
        schemaVersion: "ti.enterprise_auth_boundary.v2",
        mode: "hanasand_session_validation",
        enforcedHere: true,
        tenantContract: {
          header: "x-tenant-id",
          requiredForTenantScopedRoutes: true
        },
        identityContract: {
          header: "id",
          bearerHeader: "authorization",
          requiredForProtectedRoutes: true
        },
        secretHandling: {
          scraperDoesNotStoreSecrets: true,
          bearerTokensAcceptedForValidation: true
        }
      },
      notes: expect.arrayContaining([
        expect.stringContaining("validate the Hanasand session")
      ])
    });
    expect(JSON.stringify(response).toLowerCase()).not.toContain("authorization:");
    expect(JSON.stringify(response).toLowerCase()).not.toContain("cookie=");
  });
});
