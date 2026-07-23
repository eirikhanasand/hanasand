import { expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

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
  const activitySource = {
    id: "src_real_victim_activity",
    name: "Real public victim activity",
    type: "rss",
    url: "https://evidence.example.test/victims.xml",
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.9,
    crawlFrequencySeconds: 3600,
    legalNotes: "Public victim activity evidence collected without authentication.",
    metadata: { productionCollection: true, extractionProfile: "ransomware_victim_blog", reporterRole: "actor", reporterRoleVerified: true }
  };
  store.saveSource(activitySource as any);
  const activityCycle = await runCanaryCollectionCycle({
    store,
    frontier: new FocusedFrontier(),
    sourceIds: [activitySource.id],
    maxSources: 1,
    maxTasks: 1,
    now: () => activityAt,
    fetch: async () => new Response(
      `<rss><channel><item><title>Akira has just published a new victim: Northwind Health</title><link>https://evidence.example.test/victims/akira-northwind</link><description>Public victim claim metadata.</description><pubDate>${activityAt}</pubDate></item></channel></rss>`,
      { headers: { "content-type": "application/rss+xml" } }
    )
  } as any);

  expect(activityCycle).toMatchObject({ completedTaskCount: 1, failedTaskCount: 0, insertedCaptureCount: 1, exposureClaimCount: 1 });
  const activityEvidence = store.listCaptures().find((capture: any) => capture.metadata?.exposureClaim === true);
  expect(activityEvidence).toMatchObject({
    tenantId: "default",
    sourceId: activitySource.id,
    publishedAt: activityAt,
    metadata: { leakSite: { actorName: "Akira", victimName: "Northwind Health" } }
  });
  expect(store.listActorProfiles()).toHaveLength(1);
  expect(store.listActorProfiles()[0]).toMatchObject({ tenantId: "default", canonicalName: "Akira", lastSeenAt: activityAt, evidenceCount: 1, captureIds: [activityEvidence.id] });
});
