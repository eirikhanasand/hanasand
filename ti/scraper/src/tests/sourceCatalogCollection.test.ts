import { expect, test } from "bun:test";
import {
  AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
  runAutomaticReviewCycle
} from "../api/automaticReviewRoutes.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { runCanaryCollectionCycle } from "../ops/canaryCollection.ts";
import { runRestrictedMetadataCollectionCycle } from "../ops/restrictedMetadataCollection.ts";
import { bootstrapRuntimeSources } from "../runtime/sourceBootstrap.ts";
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
  const groups = operationNames.map((name, index) => ({
    name,
    locations: [{
      enabled: true,
      available: true,
      lastscrape: "2026-07-23T10:00:00.000Z",
      fqdn: `${String.fromCharCode(97 + index).repeat(56)}.onion`,
      http: { status: 200 }
    }]
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

  expect(cycle).toMatchObject({ completedTaskCount: 1, failedTaskCount: 0, insertedCaptureCount: 27, discoveredRestrictedSourceCount: 25 });
  expect(store.listActorIdentities()).toHaveLength(25);
  expect(store.listActorProfiles()).toHaveLength(0);
  expect(store.listCaptures().filter((capture: any) => capture.metadata?.extractionProfile === "ransomware_group_metadata")).toHaveLength(25);
  expect(store.listCaptures().filter((capture: any) => capture.metadata?.catalogEvidenceOnly === true)).toHaveLength(26);
  expect(store.listActorIdentityCatalogs()[0].evidenceCaptureIds).toHaveLength(2);
  expect(store.listCaptures().some((capture: any) => capture.metadata?.restrictedMetadataCandidates)).toBe(false);
  expect(store.listSources().filter((row: any) => row.metadata?.torMetadataAuthorityDiscovery)).toHaveLength(25);
  expect(store.listSources().filter((row: any) => row.metadata?.torMetadataAuthorityDiscovery).every((row: any) =>
    row.status === "candidate" && row.countsAsCoverage === false && row.metadata.productionCollection === false)).toBe(true);

  const activityAt = "2026-07-23T11:00:00.000Z";
  const victimSeedPath = new URL("../../seeds/public_cti_starter_pack.json", import.meta.url).pathname;
  bootstrapRuntimeSources(store, { seedPaths: [victimSeedPath], generatedAt: activityAt });
  const activitySource = store.getSource("src_seed_ransomwarelive_victims");
  expect(activitySource).toMatchObject({ status: "active", metadata: { productionCollection: true, extractionProfile: "ransomware_victim_blog" } });
  const activityCycle = await runCanaryCollectionCycle({
    store,
    frontier: new FocusedFrontier(),
    sourceIds: [activitySource!.id],
    maxSources: 1,
    maxTasks: 1,
    now: () => activityAt,
    fetch: async () => new Response(
      `<rss><channel><item><title>Akira has just published a new victim: Northwind Health</title><link>https://www.ransomware.live/id/akira-northwind</link><description>Public victim claim metadata with governed publisher timestamp and no leaked payload.</description><pubDate>${activityAt}</pubDate></item></channel></rss>`,
      { headers: { "content-type": "application/rss+xml" } }
    )
  } as any);

  expect(activityCycle).toMatchObject({ completedTaskCount: 1, failedTaskCount: 0, insertedCaptureCount: 1, exposureClaimCount: 1 });
  const activityEvidence = store.listCaptures().find((capture: any) => capture.metadata?.exposureClaim === true);
  expect(activityEvidence).toMatchObject({
    tenantId: "default",
    sourceId: activitySource!.id,
    publishedAt: activityAt,
    metadata: { leakSite: { actorName: "Akira", victimName: "Northwind Health" } }
  });
  expect(store.listActorProfiles()).toHaveLength(1);
  expect(store.listActorProfiles()[0]).toMatchObject({ tenantId: "default", canonicalName: "Akira", lastSeenAt: activityAt, evidenceCount: 1, captureIds: [activityEvidence.id] });

  let revision = "One";
  const boundary = {
    id: "tor-approved-metadata-proxy",
    config: { maxConcurrency: 2, maxMetadataBytes: 64_000, timeoutClass: "bounded" },
    fetchMetadata: async (request: any) => ({
      title: `${request.actorName} notices`,
      description: `${request.actorName} published a new victim notice for ${request.actorName} Victim ${revision}.`,
      actorName: request.actorName,
      victimName: `${request.actorName} Victim ${revision}`,
      victimNames: [`${request.actorName} Victim ${revision}`],
      links: []
    })
  };
  const firstRestricted = await runRestrictedMetadataCollectionCycle({
    store,
    boundary,
    maxSources: 25,
    now: () => "2026-07-23T12:01:00.000Z"
  });
  expect(firstRestricted).toMatchObject({ completedSourceCount: 25, failedSourceCount: 0, captureCount: 25 });
  expect(store.listSources().filter((row: any) => row.metadata?.torMetadataAuthorityDiscovery).every((row: any) =>
    row.status === "candidate" && row.metadata.sourcePortfolioVerification?.outcome === "content_parsed")).toBe(true);

  const sourceReviewFetcher = async (_input: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    const evidenceId = request.evidence[0].id;
    return Response.json({
      status: "completed",
      provider: "hanasand-ai",
      model: "hanasand-inspur",
      conversationId: `source-review-${request.subject.id}`,
      decision: {
        schemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
        promptVersion: request.promptVersion,
        modelVersion: request.requestedModelVersion,
        subject: request.subject,
        action: "confirm",
        claimValidity: "supported",
        actorAttribution: { canonicalName: null, aliases: [] },
        supportingEvidenceIds: [evidenceId],
        contradictoryEvidenceIds: [],
        uncertainty: [],
        falsePositiveReasons: [],
        rationale: "The retained parser output is coherent operational threat intelligence.",
        confidence: 0.9,
        calibrationContext: { sourceCount: 1, evidenceAssessment: "relevant" }
      }
    });
  };
  const review = await runAutomaticReviewCycle({ store } as any, {
    now: "2026-07-23T12:02:00.000Z",
    allTenants: true,
    limit: 100,
    concurrency: 2,
    modelVersion: "hanasand",
    aiBase: "http://ai.test",
    clock: () => "2026-07-23T12:02:00.000Z",
    fetcher: sourceReviewFetcher
  });
  const remainingReview = await runAutomaticReviewCycle({ store } as any, {
    now: "2026-07-23T12:02:01.000Z",
    allTenants: true,
    limit: 100,
    concurrency: 2,
    modelVersion: "hanasand",
    aiBase: "http://ai.test",
    clock: () => "2026-07-23T12:02:01.000Z",
    fetcher: sourceReviewFetcher
  });
  expect(review.attempted + remainingReview.attempted).toBeGreaterThanOrEqual(25);
  expect([...new Set(store.listSources()
    .filter((row: any) => row.metadata?.torMetadataAuthorityDiscovery)
    .map((row: any) => `${row.status}:${row.metadata.automaticSourceReview?.state}`))]).toEqual(["candidate:approved"]);

  revision = "Two";
  const secondRestricted = await runRestrictedMetadataCollectionCycle({
    store,
    boundary,
    maxSources: 25,
    now: () => "2026-07-23T13:01:00.000Z"
  });
  expect(secondRestricted).toMatchObject({ completedSourceCount: 25, failedSourceCount: 0, captureCount: 25 });
  expect(store.listSources().filter((row: any) => row.metadata?.torMetadataAuthorityDiscovery).every((row: any) =>
    row.status === "active" && row.countsAsCoverage === true && row.metadata.productionCollection === true)).toBe(true);
  expect(JSON.stringify(store.listCaptures().filter((capture: any) => capture.metadata?.adapter === "darknet_metadata"))).not.toContain(".onion");
});
