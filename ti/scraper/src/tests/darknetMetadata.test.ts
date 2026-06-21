import { describe, expect, test } from "bun:test";
import {
  buildLeakSiteMetadata,
  buildRestrictedMetadataApplyPlan,
  buildRestrictedMetadataOperationsStatus,
  createDarknetMetadataSourceSeed,
  DARKNET_METADATA_NETWORK_CONFIGS,
  DarknetMetadataAdapter,
  darknetMetadataResultFromCapture,
  evaluateDarknetMetadataPolicy,
  isSensitivePayloadTarget,
  isUnsafeInteractionTarget,
  planDarknetMetadataLiveSearch,
  restrictedMetadataProductionBoundaryContracts
} from "../adapters/darknetMetadata.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source = (overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  id: "src-tor",
  name: "Example leak metadata",
  type: "tor_metadata",
  url: "http://exampleonion.onion",
  accessMethod: "approved_proxy",
  trustScore: 0.7,
  language: "en",
  crawlFrequencyMinutes: 60,
  status: "active",
  legalNotes: "Metadata-only collection from public source landing pages.",
  approvedAt: "2026-06-20T00:00:00.000Z",
  approvedBy: "test",
  metadata: {},
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
  ...overrides
} as SourceRecord);

const boundary = {
  id: "tor-approved-metadata-proxy",
  network: "tor",
  accessMethod: "approved_proxy",
  async fetchMetadata() {
    return {
      title: "Example actor names Example Victim",
      description: "Actor claimed a victim in healthcare.",
      actorName: "ExampleActor",
      victimName: "Example Victim",
      claimedSector: "healthcare",
      claimedCountry: "NO",
      sourceTimestamp: "2026-06-20T01:00:00.000Z",
      links: ["http://exampleonion.onion/post"]
    };
  }
};

describe("darknet metadata adapter", () => {
  test("collects metadata-only rows through an approved boundary", async () => {
    const result = await new DarknetMetadataAdapter("tor_metadata", boundary).collect(source());
    expect(result.items).toHaveLength(1);
    expect(result.items[0].metadata.captureMode).toBe("metadata_only");
    expect((result.items[0].metadata as any).leakSite.victimName).toBe("Example Victim");
  });

  test("blocks payload and interaction targets before collection", () => {
    expect(isSensitivePayloadTarget("http://x.onion/download/archive.zip")).toBe(true);
    expect(isUnsafeInteractionTarget("http://x.onion/login")).toBe(true);
    expect(evaluateDarknetMetadataPolicy(source(), "http://x.onion/files.zip", boundary).allowed).toBe(false);
  });

  test("plans live metadata search from approved sources", () => {
    const plan = planDarknetMetadataLiveSearch({ query: "ExampleActor", sources: [source()], captures: [], maxTasks: 4 });
    expect(plan.status).toBe("queued_metadata_only");
    expect(plan.tasks[0].sourceId).toBe("src-tor");
  });

  test("summarizes operations with apply actions", () => {
    const status = buildRestrictedMetadataOperationsStatus({ sources: [source(), source({ id: "disabled", status: "disabled" })], captures: [] });
    expect(status.sourceCount).toBe(2);
    expect(status.applyPlan.summary.automation_safe).toBe(1);
    expect(status.applyPlan.summary.rollback_only).toBe(1);
  });

  test("keeps public contracts compact and metadata only", () => {
    expect(DARKNET_METADATA_NETWORK_CONFIGS.tor.maxConcurrency).toBe(2);
    expect(restrictedMetadataProductionBoundaryContracts()).toHaveLength(3);
    expect(buildRestrictedMetadataApplyPlan({ sources: [source()] }).actions[0].metadataOnly).toBe(true);
  });

  test("builds safe source seeds and capture results", () => {
    const seed = createDarknetMetadataSourceSeed({ network: "i2p", url: "http://example.i2p" });
    expect(seed.type).toBe("i2p_metadata");
    const capture = { id: "cap", sourceId: "src", url: "http://x.onion", collectedAt: "2026-06-20T00:00:00.000Z", contentHash: "hash", mediaType: "text/plain", storageKind: "inline_text", sensitive: true, metadata: { leakSite: buildLeakSiteMetadata("http://x.onion", { victimName: "Victim" }) } } as unknown as RawCapture;
    expect(darknetMetadataResultFromCapture(capture)?.victimName).toBe("Victim");
  });
});
