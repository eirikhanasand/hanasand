import { api, apiRestrictedMetadataApplyPlanSources, body, describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, test } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns a compact metadata-only restricted apply plan", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    const response = await body(await handleApiRequest(api("/v1/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retentionExpiringWithinDays: 7, includeCutover: true }),
    }), { store, frontier: new FocusedFrontier() })) as Record<string, any>;

    expect(response.contract).toMatchObject({ name: "restricted_metadata_apply_plan", metadataOnly: true });
    expect(response.contract.forbiddenOperations).toEqual(expect.arrayContaining(["credential_bypass", "captcha_solving", "stolen_file_download"]));
    expect(response.applyPlan.metadataOnly).toBe(true);
    expect(response.applyPlan.actions.length).toBeGreaterThan(0);
    expect(response.applyPlan.actions.every((action: any) => action.metadataOnly && action.forbiddenAlternatives.length > 0)).toBe(true);
    expect(response.cutoverReport).toMatchObject({ metadataOnly: true, status: "ready_metadata_only" });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
  });
});
