import { describe, expect, test } from "bun:test";
import { qualifySourcePortfolio } from "../ops/sourcePortfolioQualification.ts";
import { validateSourcePortfolioBatch } from "../registry/sourcePortfolioBatch.ts";
import { sourceAutomaticReviewEvidenceBindings } from "../api/automaticReviewRoutes.ts";
import { SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION, SOURCE_AUTOMATIC_REVIEW_SCHEMA, automaticReviewModelVersion, automaticSourceReviewIdentity } from "../policy/sourceAutomaticReview.ts";
import { hashContent } from "../utils.ts";

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

  test("does not qualify retained captures from explicitly non-useful cycles", () => {
    const result = qualifySourcePortfolio({
      sources: [publicSource("not-useful", "rss", "https://example.test/not-useful.xml")],
      observations: [
        { ...observation("not-useful", "2026-07-22T12:00:00.000Z", 1), useful: false },
        { ...observation("not-useful", "2026-07-23T11:00:00.000Z", 1), useful: false }
      ],
      captures: [
        capture("not-useful", "first", "2026-07-22T10:00:00.000Z", "run-2026-07-22T12:00:00.000Z"),
        capture("not-useful", "second", "2026-07-23T10:00:00.000Z", "run-2026-07-23T11:00:00.000Z")
      ],
      generatedAt
    });

    expect(result.counts.total).toBe(0);
    expect(result.sources[0]).toMatchObject({
      qualifies: false,
      usefulCheckCount: 0,
      productiveCheckCount: 0,
      latestCheckUseful: false
    });
    expect(result.sources[0].reasons).toContain("insufficient_productive_cycles");
  });

  test("keeps a useful result when a later report shares the same run", () => {
    const firstAt = "2026-07-22T12:00:00.000Z";
    const secondAt = "2026-07-23T11:00:00.000Z";
    const result = qualifySourcePortfolio({
      sources: [publicSource("multi-report", "rss", "https://example.test/multi-report.xml")],
      observations: [firstAt, secondAt].flatMap((checkedAt) => [
        observation("multi-report", checkedAt, 1),
        { ...observation("multi-report", checkedAt, 0), id: `later-${checkedAt}`, checkedAt: new Date(Date.parse(checkedAt) + 1_000).toISOString(), success: false }
      ]),
      captures: [
        capture("multi-report", "first", "2026-07-22T10:00:00.000Z", `run-${firstAt}`),
        capture("multi-report", "second", "2026-07-23T10:00:00.000Z", `run-${secondAt}`)
      ],
      generatedAt
    });

    expect(result.counts.total).toBe(1);
    expect(result.sources[0]).toMatchObject({
      qualifies: true,
      usefulCheckCount: 2,
      productiveCheckCount: 2,
      latestCheckUseful: true,
      lastSuccessAt: secondAt,
      lastUsefulAt: secondAt
    });
  });

  test("does not combine useful truth and capture count from separate reports", () => {
    const firstAt = "2026-07-22T12:00:00.000Z";
    const secondAt = "2026-07-23T11:00:00.000Z";
    const result = qualifySourcePortfolio({
      sources: [publicSource("split-report", "rss", "https://example.test/split-report.xml")],
      observations: [firstAt, secondAt].flatMap((checkedAt) => [
        { ...observation("split-report", checkedAt, 0), useful: true },
        { ...observation("split-report", checkedAt, 1), id: `capture-only-${checkedAt}`, useful: false }
      ]),
      captures: [
        capture("split-report", "first", "2026-07-22T10:00:00.000Z", `run-${firstAt}`),
        capture("split-report", "second", "2026-07-23T10:00:00.000Z", `run-${secondAt}`)
      ],
      generatedAt
    });

    expect(result.counts.total).toBe(0);
    expect(result.sources[0]).toMatchObject({ qualifies: false, usefulCheckCount: 0, productiveCheckCount: 0, latestCheckUseful: false });
    expect(result.sources[0].reasons).toContain("insufficient_productive_cycles");
  });

  test("does not combine a failed useful report with a successful empty report", () => {
    const firstAt = "2026-07-22T12:00:00.000Z";
    const secondAt = "2026-07-23T11:00:00.000Z";
    const result = qualifySourcePortfolio({
      sources: [publicSource("split-success", "rss", "https://example.test/split-success.xml")],
      observations: [firstAt, secondAt].flatMap((checkedAt) => [
        { ...observation("split-success", checkedAt, 0), useful: false },
        { ...observation("split-success", checkedAt, 1), id: `failed-useful-${checkedAt}`, success: false, useful: true }
      ]),
      captures: [
        capture("split-success", "first", "2026-07-22T10:00:00.000Z", `run-${firstAt}`),
        capture("split-success", "second", "2026-07-23T10:00:00.000Z", `run-${secondAt}`)
      ],
      generatedAt
    });

    expect(result.counts.total).toBe(0);
    expect(result.sources[0]).toMatchObject({ successfulCheckCount: 2, productiveCheckCount: 0, latestCheckUseful: false });
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

  test("keeps historical retained usefulness separate from current qualification", () => {
    const result = qualifySourcePortfolio({
      sources: [publicSource("historical", "rss", "https://example.test/historical.xml")],
      observations: [observation("historical", "2020-07-23T11:00:00.000Z", 1)],
      captures: [capture("historical", "old", "2020-07-23T10:00:00.000Z", "run-2020-07-23T11:00:00.000Z")],
      generatedAt
    });

    expect(result.sources[0]).toMatchObject({
      qualifies: false,
      usefulCheckCount: 0,
      latestCheckUseful: false,
      lastUsefulAt: "2020-07-23T11:00:00.000Z"
    });
  });

  test("uses every health check for freshness while requiring scheduled productive cycles", () => {
    const source = publicSource("unscheduled-freshness", "rss", "https://example.test/unscheduled-freshness.xml");
    const result = qualifySourcePortfolio({
      sources: [source],
      observations: [
        observation(source.id, "2026-07-22T10:00:00.000Z", 1),
        observation(source.id, "2026-07-22T11:00:00.000Z", 1),
        {
          ...observation(source.id, "2026-07-23T11:30:00.000Z", 0),
          id: "health-unscheduled",
          collectionRunId: undefined,
          useful: false
        }
      ],
      captures: [
        capture(source.id, "first", "2026-07-22T09:00:00.000Z", "run-2026-07-22T10:00:00.000Z"),
        capture(source.id, "second", "2026-07-22T10:30:00.000Z", "run-2026-07-22T11:00:00.000Z")
      ],
      generatedAt
    });

    expect(result.counts.total).toBe(1);
    expect(result.sources[0]).toMatchObject({
      qualifies: true,
      scheduledCheckCount: 2,
      productiveCheckCount: 2,
      lastCheckedAt: "2026-07-23T11:30:00.000Z",
      lastSuccessAt: "2026-07-23T11:30:00.000Z",
      lastUsefulAt: "2026-07-22T11:00:00.000Z"
    });
  });

  test("requires the exact reviewed capture, tenant, content, and evidence identity", () => {
    const base = publicSource("bound-review", "rss", "https://example.test/bound.xml", {
      productionCollection: true,
      sourcePortfolioVerification: { outcome: "content_parsed" }
    });
    const captures = [
      reviewedCapture(base.id, "bound-1", "2026-07-22T10:00:00.000Z", "run-2026-07-22T12:00:00.000Z"),
      reviewedCapture(base.id, "bound-2", "2026-07-23T10:00:00.000Z", "run-2026-07-23T11:00:00.000Z")
    ];
    const selectedEvidenceProvenance = sourceAutomaticReviewEvidenceBindings(base, captures).slice(0, 1);
    const reviewed = {
      ...base,
      countsAsCoverage: true,
      metadata: {
        ...base.metadata,
        countsAsCoverage: true,
        automaticSourceReview: {
          schemaVersion: SOURCE_AUTOMATIC_REVIEW_SCHEMA,
          state: "approved",
          promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION,
          configuredModelVersion: automaticReviewModelVersion(),
          sourceIdentity: automaticSourceReviewIdentity(base),
          requestSha256: "a".repeat(64),
          selectedEvidenceIds: selectedEvidenceProvenance.map((item) => item.evidenceId),
          selectedEvidenceProvenance,
          runtimeIdentity: { status: "completed", conversationId: "bound-review" },
          decision: { subject: { type: "source", id: base.id }, action: "confirm", claimValidity: "supported" }
        }
      }
    };
    const observations = [
      observation(base.id, "2026-07-22T12:00:00.000Z", 1),
      observation(base.id, "2026-07-23T11:00:00.000Z", 1)
    ];
    const count = (source: any, rows: any[]) => qualifySourcePortfolio({ sources: [source], observations, captures: rows, generatedAt }).counts.total;

    expect(count(reviewed, captures)).toBe(1);
    expect(count({ ...reviewed, countsAsCoverage: false }, captures)).toBe(0);
    expect(count({ ...reviewed, metadata: { ...reviewed.metadata, productionCollection: false } }, captures)).toBe(0);
    expect(count(reviewed, captures.map((item) => item.id === selectedEvidenceProvenance[0].captureId ? { ...item, contentHash: hashContent("changed") } : item))).toBe(0);
    expect(count(reviewed, captures.map((item) => item.id === selectedEvidenceProvenance[0].captureId ? { ...item, tenantId: "other" } : item))).toBe(0);
    expect(count(reviewed, captures.map((item) => item.id === selectedEvidenceProvenance[0].captureId ? { ...item, sourceId: "other" } : item))).toBe(0);
    expect(count({
      ...reviewed,
      metadata: {
        ...reviewed.metadata,
        automaticSourceReview: {
          ...reviewed.metadata.automaticSourceReview,
          selectedEvidenceProvenance: selectedEvidenceProvenance.map((item) => ({ ...item, captureStateSha256: "b".repeat(64) }))
        }
      }
    }, captures)).toBe(0);
    expect(count({
      ...reviewed,
      metadata: {
        ...reviewed.metadata,
        automaticSourceReview: {
          ...reviewed.metadata.automaticSourceReview,
          selectedEvidenceIds: ["forged-evidence"],
          selectedEvidenceProvenance: selectedEvidenceProvenance.map((item) => ({ ...item, evidenceId: "forged-evidence" }))
        }
      }
    }, captures)).toBe(0);
    expect(count({
      ...reviewed,
      metadata: {
        ...reviewed.metadata,
        automaticSourceReview: {
          ...reviewed.metadata.automaticSourceReview,
          selectedEvidenceProvenance: selectedEvidenceProvenance.map((item) => ({ ...item, tenantKey: "other" }))
        }
      }
    }, captures)).toBe(0);
    expect(count({
      ...reviewed,
      metadata: {
        ...reviewed.metadata,
        automaticSourceReview: { ...reviewed.metadata.automaticSourceReview, selectedEvidenceIds: ["other-evidence"] }
      }
    }, captures)).toBe(0);
    const bothBindings = sourceAutomaticReviewEvidenceBindings(base, captures);
    expect(count({
      ...reviewed,
      metadata: {
        ...reviewed.metadata,
        automaticSourceReview: {
          ...reviewed.metadata.automaticSourceReview,
          selectedEvidenceIds: bothBindings.map((item) => item.evidenceId),
          selectedEvidenceProvenance: [bothBindings[0], bothBindings[0]]
        }
      }
    }, captures)).toBe(0);
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

function reviewedCapture(sourceId: string, id: string, publishedAt: string, runId: string) {
  const body = `CVE-2026-${id.endsWith("1") ? "1001" : "1002"} is a critical remote code execution advisory.`;
  return { ...capture(sourceId, id, publishedAt, runId), url: `https://example.test/${id}`, contentHash: hashContent(body), body, sensitive: false, storageKind: "inline_text" };
}
