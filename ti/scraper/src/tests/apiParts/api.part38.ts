import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("mounted restricted metadata apply-plan endpoints prove all statuses without unsafe leaks", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    const post = async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { response, payload: await response.json() as Record<string, unknown> };
    };

    try {
      const all = await post("/v1/restricted-metadata/apply-plan", {
        retentionExpiringWithinDays: 7,
        includeCutover: true
      });
      expect(all.response.status).toBe(200);
      const allApplyPlan = all.payload.applyPlan as {
        actions: Array<{ action: string; sourceId: string; safety: string; prohibitedAlternatives: string[]; proof: Record<string, unknown> }>;
        agent09PolicyStatusFields: string[];
        agent10KillSwitchRollback: string[];
      };
      const allCutover = all.payload.cutoverReport as {
        agent09: { statuses: Record<string, number> };
      };
      expect(allCutover.agent09.statuses).toMatchObject({
        disabled: 1,
        pending_approval: 1,
        ready_metadata_only: expect.any(Number),
        blocked_unsafe_target: 1,
        kill_switch_active: 1,
        retention_expiring: 1,
        audit_clean: expect.any(Number)
      });
      expect(allApplyPlan.actions.map((item) => item.action)).toEqual(expect.arrayContaining([
        "enable_metadata_only_queue",
        "renew_legal_notes",
        "keep_source_blocked",
        "apply_kill_switch",
        "disable_source",
        "shorten_retention"
      ]));
      expect(allApplyPlan.agent09PolicyStatusFields).toEqual(expect.arrayContaining(["ready_metadata_only", "blocked_unsafe_target", "kill_switch_active"]));
      expect(allApplyPlan.agent10KillSwitchRollback).toEqual(expect.arrayContaining(["pause_restricted_metadata_workers"]));

      const nested = await post("/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
        actions: ["enable_metadata_only_queue"]
      });
      expect(nested.response.status).toBe(200);
      expect(nested.payload.applyPlan).toMatchObject({
        summary: {
          automation_safe: 1,
          human_approval_required: 0,
          blocked: 0,
          rollback_only: 0
        },
        actions: [{
          sourceId: "src_restricted_ready",
          action: "enable_metadata_only_queue",
          safety: "automation_safe"
        }]
      });

      const invalid = await post("/v1/restricted-metadata/apply-plan", {
        actions: ["solve_captcha_then_download"]
      });
      expect(invalid.response.status).toBe(400);
      expect(invalid.payload).toMatchObject({
        error: {
          code: "invalid_action",
          details: { invalidActions: ["solve_captcha_then_download"] }
        }
      });

      for (const action of allApplyPlan.actions) {
        expect(action.prohibitedAlternatives).toEqual(expect.arrayContaining([
          "payload download remains prohibited",
          "credential or authentication bypass remains prohibited",
          "CAPTCHA solving remains prohibited",
          "private community access remains prohibited",
          "threat actor interaction remains prohibited",
          "unsafe restricted URLs remain redacted to hashes"
        ]));
        expect(action.proof).toMatchObject({
          exposesRawUrl: false,
          allowsPayloadDownload: false,
          allowsAuthBypass: false,
          allowsCaptchaSolving: false,
          allowsPrivateCommunityAccess: false,
          allowsThreatActorInteraction: false
        });
      }
      const serialized = JSON.stringify({ all, nested, invalid });
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain(".onion");
      expect(serialized).not.toContain("user:pass");
      expect(serialized).not.toContain("customer-dump");
      expect(serialized).not.toContain("raw leak");
    } finally {
      server.stop();
    }
  });
});
