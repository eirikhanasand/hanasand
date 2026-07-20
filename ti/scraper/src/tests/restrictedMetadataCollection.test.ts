import { describe, expect, test } from "bun:test";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { runRestrictedMetadataCollectionCycle } from "../ops/restrictedMetadataCollection.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("restricted metadata collection", () => {
  test("collects approved onion metadata through the proxy boundary without persisting page content", async () => {
    const store = new InMemoryScraperStore();
    const onion = `${"a".repeat(56)}.onion`;
    let proxy: unknown;
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async (_url, init) => {
        proxy = (init as any).proxy;
        return new Response("<html><head><title>Akira notices</title><meta name=\"description\" content=\"Victim: Northwind Health; Sector: healthcare; Country: NO; Data type: contracts\"></head><body><time datetime=\"2026-07-20T10:00:00Z\"></time>raw page content that must not persist</body></html>", { status: 200, headers: { "content-type": "text/html" } });
      }
    });
    store.saveSource({
      ...source({
        id: "src_restricted_live",
        type: "tor_metadata",
        url: `http://${onion}/posts`,
        accessMethod: "approved_proxy",
        status: "active",
        risk: "restricted",
        legalNotes: "Approved metadata-only ransomware listing research.",
        governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-20T09:00:00.000Z", approvedBy: "reviewer", policyVersion: "collection-policy:v1" },
        metadata: { actorName: "Akira" }
      }),
      tenantId: "tenant_restricted"
    });

    const result = await runRestrictedMetadataCollectionCycle({ store, boundary, now: () => "2026-07-20T10:05:00.000Z" });
    const capture = store.listCaptures()[0];

    expect(result).toMatchObject({ status: "completed", sourceCount: 1, completedSourceCount: 1, failedSourceCount: 0, captureCount: 1, metadataOnly: true });
    expect(proxy).toBe("http://onion-tor:8118/");
    expect(capture).toMatchObject({ sourceId: "src_restricted_live", storageKind: "metadata_only", sensitive: true, body: undefined, metadata: { captureMode: "metadata_only", leakSite: { actorName: "Akira", victimName: "Northwind Health", metadataOnly: true } } });
    expect(JSON.stringify(capture)).not.toContain("raw page content");
    expect(store.listSourceHealthObservations()).toEqual([expect.objectContaining({ sourceId: "src_restricted_live", success: true, useful: true, legalMode: "metadata_only" })]);
    expect(store.listRuns().at(-1)).toMatchObject({ id: result.runId, status: "completed", captureCount: 1 });
  });
});
