import { expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";

test("catalog registration captures identities without activity profiles while real activity advances one profile", async () => {
  const at = "2026-07-23T12:00:00.000Z";
  const sourceBundle = await Bun.file(new URL("../../seeds/verified_long_lived_sources.json", import.meta.url)).json();
  const source = sourceBundle.sources.find((row: any) => row.id === "src_ransomwarelive_current_operations_catalog");
  const operationNames = [
    "Akira", "Black Basta", "Clop", "Qilin", "SafePay", "Space Bears", "INC Ransom", "Play", "Medusa", "Rhysida",
    "DragonForce", "Hunters International", "RansomHub", "LockBit", "BianLian", "Everest", "KillSec", "Lynx", "Sarcoma",
    "Fog", "Cactus", "Monti", "Trinity", "DarkVault", "Kairos"
  ];
  const groups = operationNames.map((name) => ({
    name,
    locations: [{ enabled: true, available: true, lastscrape: "2026-07-23T10:00:00.000Z", http: { status: 200 } }]
  }));
  const victims = operationNames.map((group_name) => ({ group_name, published: "2026-07-23T09:00:00.000Z" }));
  const store = new InMemoryScraperStore();
  store.saveSource({ ...source, createdAt: at, updatedAt: at });

  const cycle = await runCanaryCollectionCycle({
    store,
    frontier: new FocusedFrontier(),
    sourceIds: [source.id],
    maxSources: 1,
    maxTasks: 1,
    now: () => at,
    fetch: async (url: string | URL | Request) => new Response(
      String(url).endsWith("victims.json") ? JSON.stringify(victims) : JSON.stringify(groups),
      { headers: { "content-type": "application/json" } }
    )
  } as any);

  expect(cycle).toMatchObject({ completedTaskCount: 1, failedTaskCount: 0, insertedCaptureCount: 27 });
  expect(store.listActorIdentities()).toHaveLength(25);
  expect(store.listActorProfiles()).toHaveLength(0);
  expect(store.listCaptures().filter((capture: any) => capture.metadata?.extractionProfile === "ransomware_group_metadata")).toHaveLength(25);
  expect(store.listCaptures().filter((capture: any) => capture.metadata?.catalogEvidenceOnly === true)).toHaveLength(26);
  expect(store.listActorIdentityCatalogs()[0].evidenceCaptureIds).toHaveLength(2);

  const activityAt = "2026-07-23T11:00:00.000Z";
  const activityText = "Akira claimed Northwind Health as a newly published victim.";
  store.savePipelineResult(processCollectedItem({
    sourceId: source.id,
    url: "https://evidence.example.test/operation-0",
    title: "Operation 0 activity",
    rawText: activityText,
    contentHash: hashContent(activityText),
    collectedAt: activityAt,
    publishedAt: activityAt,
    links: [],
    metadata: {
      extractionProfile: "ransomware_victim_blog",
      leakSite: { actorName: "Akira", victimName: "Northwind Health", summary: activityText }
    },
    sensitive: true
  }, { actorIdentities: store.listActorIdentities() }));

  expect(store.listActorProfiles()).toHaveLength(1);
  expect(store.listActorProfiles()[0]).toMatchObject({ canonicalName: "Akira", lastSeenAt: activityAt, evidenceCount: 1 });
});
