import { api, body, describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, test } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("reports public-channel source-pack recommendations for uncovered queries", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Volt%20Typhoon&entityType=actor"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack],
    })) as Record<string, any>;
    expect(response.publicChannel).toMatchObject({ status: "pending_channel_search", queuedTasks: 0, evidence: [] });
    expect(response.publicChannel.sourcePackRecommendations).toEqual(expect.arrayContaining([
      { sourcePackId: "public-telegram-cti-candidates", sourceId: "tg_candidate_actor_identity", requiredAction: "review" },
    ]));
    expect(response.publicChannel.activationRecommendations).toEqual(expect.arrayContaining([
      { sourcePackId: "public-telegram-cti-candidates", sourceId: "tg_candidate_actor_identity", requiredAction: "review" },
    ]));
  });
});
