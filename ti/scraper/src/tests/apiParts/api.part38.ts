import {
  apiRestrictedMetadataApplyPlanSources,
  describe,
  expect,
  FocusedFrontier,
  InMemoryScraperStore,
  startApiServer,
  test,
} from "../apiTestHarness.ts";

describe("api v1", () => {
  test("mounted restricted metadata apply-plan endpoints stay metadata-only", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) {
      store.saveSource(item);
    }
    const server = startApiServer({
      port: 0,
      store,
      frontier: new FocusedFrontier(),
    });
    const post = async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return {
        response,
        payload: await response.json() as Record<string, any>,
      };
    };

    try {
      const all = await post("/v1/restricted-metadata/apply-plan", {
        retentionExpiringWithinDays: 7,
        includeCutover: true,
      });
      expect(all.response.status).toBe(200);
      expect(all.payload.cutoverReport).toMatchObject({
        metadataOnly: true,
        status: "ready_metadata_only",
      });
      expect(all.payload.applyPlan.metadataOnly).toBe(true);
      expect(all.payload.applyPlan.actions.length).toBeGreaterThan(0);
      expect(
        all.payload.applyPlan.actions.every((action: any) =>
          action.metadataOnly && action.forbiddenAlternatives.length > 0
        ),
      ).toBe(true);

      const nested = await post(
        "/v1/sources/src_restricted_ready/restricted-metadata/apply-plan",
        { actions: ["enable_metadata_only_queue"] },
      );
      expect(nested.response.status).toBe(200);
      expect(nested.payload.applyPlan).toMatchObject({
        metadataOnly: true,
        summary: { automation_safe: 1 },
        actions: [{
          sourceId: "src_restricted_ready",
          action: "enable_metadata_only_queue",
          safety: "automation_safe",
          metadataOnly: true,
        }],
      });

      const invalid = await post("/v1/restricted-metadata/apply-plan", {
        actions: ["solve_captcha_then_download"],
      });
      expect(invalid.response.status).toBe(400);
      expect(invalid.payload).toMatchObject({
        error: {
          code: "invalid_action",
          details: { invalidActions: ["solve_captcha_then_download"] },
        },
      });

      const serialized = JSON.stringify({
        all: all.payload,
        nested: nested.payload,
        invalid: invalid.payload,
      });
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain(".onion");
      expect(serialized).not.toContain("user:pass");
      expect(serialized).not.toContain("customer-dump");
    } finally {
      server.stop();
    }
  });
});
