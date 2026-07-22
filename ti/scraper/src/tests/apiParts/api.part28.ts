import { api, body, describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, test } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("does not invent query-specific recommendations for production Telegram sources", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Volt%20Typhoon&entityType=actor"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack],
    })) as Record<string, any>;
    expect(response.publicChannel).toMatchObject({ status: "pending_channel_search", queuedTasks: 0, evidence: [] });
    expect(response.publicChannel.sourcePackRecommendations).toEqual([]);
    expect(response.publicChannel.activationRecommendations).toEqual([]);
  });
});
