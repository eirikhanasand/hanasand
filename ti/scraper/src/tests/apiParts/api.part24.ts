import { api, body, describe, expect, FocusedFrontier, handleApiRequest, hashContent, InMemoryScraperStore, source, test } from "../apiTestHarness.ts";
import type { RawCapture } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("reports safe public-channel evidence for live intel search", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_telegram",
      name: "Cybercrime public channel",
      type: "telegram_public",
      url: "https://t.me/cybercrimeintel",
      accessMethod: "official_api",
      status: "active",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false, approvedAt: new Date(0).toISOString(), approvedBy: "reviewer" },
    }));
    const text = "Scattered Spider posted infrastructure at https://evil.example";
    store.saveCapture({
      id: "cap_telegram",
      sourceId: "src_telegram",
      url: "https://t.me/cybercrimeintel/10",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: hashContent(text),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: text,
      metadata: { adapter: "telegram_public", channel: "cybercrimeintel", messageId: 10, provenance: { confidence: 0.95 } },
      sensitive: false,
    } as RawCapture);

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Scattered%20Spider&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
    })) as Record<string, any>;
    expect(response.publicChannel).toMatchObject({ status: "ready", queuedTasks: 1, sla: { status: expect.any(String) } });
    expect(response.publicChannel.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "src_telegram", channel: "cybercrimeintel", messageUrl: "https://t.me/cybercrimeintel/10" }),
    ]));
    expect(response.planner).toMatchObject({ mode: "interactive_live_search", zeroTaskReason: "none" });
    expect(response.planner.queuedTaskCount).toBeGreaterThan(0);
    expect(response.publicChannel.safeOutput).toMatchObject({ rawPrivateDataExposed: false, rawMediaPayloadsExposed: false, credentialsExposed: false });
  });
});
