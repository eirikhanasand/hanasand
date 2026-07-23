import { describe, expect, test } from "bun:test";
import { qualifySourcePortfolio } from "../ops/sourcePortfolioQualification.ts";
import { validateSourcePortfolioBatch } from "../registry/sourcePortfolioBatch.ts";

const generatedAt = "2026-07-23T12:00:00.000Z";

describe("source portfolio qualification", () => {
  test("counts only distinct executable feeds with sustained new retained captures", () => {
    const sources = [
      publicSource("clear", "rss", "https://example.test/feed.xml"),
      publicSource("duplicate", "json_api", "https://EXAMPLE.test/feed.xml#copy"),
      publicSource("telegram", "telegram_public", "https://t.me/PublicIntel", { collectionMode: "public_web_preview" }),
      {
        ...publicSource("tor", "tor_metadata", `http://${"a".repeat(56)}.onion`),
        accessMethod: "approved_proxy",
        risk: "high",
        governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: generatedAt, approvedBy: "reviewer" },
        metadata: { productionCollection: true, captureMode: "metadata_only" }
      },
      publicSource("static", "static_web", "https://example.test/home")
    ];
    const observations = ["clear", "duplicate", "telegram", "tor", "static"].flatMap((sourceId) => [
      observation(sourceId, "2026-07-22T12:00:00.000Z", 1),
      observation(sourceId, "2026-07-23T11:00:00.000Z", 1)
    ]);
    const captures = ["clear", "duplicate", "telegram", "tor", "static"].flatMap((sourceId) => [
      capture(sourceId, `${sourceId}-1`, "2026-07-22T11:00:00.000Z", "run-2026-07-22T12:00:00.000Z"),
      capture(sourceId, `${sourceId}-2`, "2026-07-23T10:00:00.000Z", "run-2026-07-23T11:00:00.000Z")
    ]);

    const result = qualifySourcePortfolio({ sources, observations, captures, generatedAt });

    expect(result.counts).toEqual({ clearWeb: 1, lawfulDarkWeb: 1, publicTelegram: 1, total: 3 });
    expect(result.baselineMet).toBe(false);
    expect(result.sources.find((row) => row.sourceId === "clear")).toMatchObject({
      qualifies: true,
      productiveCheckCount: 2,
      lastContentAt: "2026-07-23T10:00:00.000Z",
      lastUsefulAt: "2026-07-23T11:00:00.000Z"
    });
    expect(result.sources.find((row) => row.sourceId === "duplicate")?.reasons).toContain("duplicate_feed");
    expect(result.sources.find((row) => row.sourceId === "static")?.reasons).toContain("not_an_intelligence_feed");
  });

  test("does not treat legacy useful flags or duplicate-only cycles as production", () => {
    const result = qualifySourcePortfolio({
      sources: [publicSource("legacy", "rss", "https://example.test/legacy.xml")],
      observations: [
        { ...observation("legacy", "2026-07-22T12:00:00.000Z", 0), useful: true, duplicateCount: 1 },
        { ...observation("legacy", "2026-07-23T11:00:00.000Z", 0), useful: true, duplicateCount: 1 }
      ],
      captures: [capture("legacy", "old", "2026-07-22T10:00:00.000Z")],
      generatedAt
    });

    expect(result.counts.total).toBe(0);
    expect(result.sources[0]).toMatchObject({ usefulCheckCount: 0, latestCheckUseful: false });
    expect(result.sources[0].reasons).toContain("insufficient_productive_cycles");
  });

  test("requires two productive scheduled cycles inside the current activity window", () => {
    const result = qualifySourcePortfolio({
      sources: [publicSource("windowed", "rss", "https://example.test/windowed.xml")],
      observations: [
        observation("windowed", "2020-07-23T11:00:00.000Z", 1),
        observation("windowed", "2026-07-23T11:00:00.000Z", 1)
      ],
      captures: [
        capture("windowed", "old", "2020-07-23T10:00:00.000Z", "run-2020-07-23T11:00:00.000Z"),
        capture("windowed", "current", "2026-07-23T10:00:00.000Z", "run-2026-07-23T11:00:00.000Z")
      ],
      generatedAt
    });

    expect(result.counts.total).toBe(0);
    expect(result.sources[0]).toMatchObject({ scheduledCheckCount: 1, productiveCheckCount: 1 });
    expect(result.sources[0].reasons).toContain("insufficient_productive_cycles");
  });

  test("requires immutable batch verification and rejects seeded runtime timestamps", () => {
    const source = publicSource("batch", "rss", "https://example.test/batch.xml", {
      productionCollection: true,
      sourcePortfolioVerification: {
        verifiedAt: "2026-07-23T10:00:00.000Z",
        legalBasisVerifiedAt: "2026-07-23T09:00:00.000Z",
        outcome: "content_parsed",
        observedItemCount: 2
      }
    });
    const valid = validateSourcePortfolioBatch({ schemaVersion: "ti.source_portfolio_batch.v1", family: "clear_web", sources: [source] }, generatedAt);
    const invalid = validateSourcePortfolioBatch({ schemaVersion: "ti.source_portfolio_batch.v1", family: "clear_web", sources: [{ ...source, lastSeenAt: generatedAt }] }, generatedAt);

    expect(valid).toMatchObject({ recognized: true, valid: true, errors: [] });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors[0].message).toBe("runtime collection timestamps must not be seeded");
  });

  test("uses endpoint identity across adapter types while keeping distinct publisher endpoints", () => {
    const first = publicSource("first", "rss", "https://publisher.example/feed");
    const sameEndpoint = publicSource("second", "api", "https://PUBLISHER.example/feed/");
    const distinctEndpoint = publicSource("third", "api", "https://publisher.example/advisories.json");
    const verification = {
      verifiedAt: "2026-07-23T10:00:00.000Z",
      legalBasisVerifiedAt: "2026-07-23T09:00:00.000Z",
      outcome: "content_parsed",
      observedItemCount: 2
    };
    const result = validateSourcePortfolioBatch({
      schemaVersion: "ti.source_portfolio_batch.v1",
      family: "clear_web",
      sources: [
        { ...first, metadata: { ...first.metadata, sourcePortfolioVerification: verification } },
        { ...sameEndpoint, metadata: { ...sameEndpoint.metadata, sourcePortfolioVerification: verification } },
        { ...distinctEndpoint, metadata: { ...distinctEndpoint.metadata, sourcePortfolioVerification: verification } }
      ]
    }, generatedAt);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ sourceId: "second", message: "source portfolio endpoint must be present and unique" });
    expect(result.errors.some((error) => error.sourceId === "third")).toBe(false);
  });
});

function publicSource(id: string, type: string, url: string, metadata: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    type,
    url,
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.8,
    crawlFrequencySeconds: 3_600,
    legalNotes: "Lawful public defensive intelligence collection.",
    governance: { approvalRequired: false, approvalState: "approved", approvedAt: generatedAt, approvedBy: "reviewer" },
    metadata: { productionCollection: true, ...metadata }
  };
}

function observation(sourceId: string, checkedAt: string, captureCount: number) {
  return { id: `${sourceId}-${checkedAt}`, sourceId, collectionRunId: `run-${checkedAt}`, checkedAt, status: "healthy", success: true, useful: captureCount > 0, captureCount };
}

function capture(sourceId: string, id: string, publishedAt: string, runId?: string) {
  return { id, sourceId, publishedAt, collectedAt: publishedAt, metadata: runId ? { runId } : undefined };
}
