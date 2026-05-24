import { describe, expect, test } from "bun:test";
import { InMemorySourceRegistry } from "../registry/sourceRegistry.ts";
import type { SourceReviewDecision } from "../types.ts";

describe("source registry", () => {
  test("requires legal notes", () => {
    const registry = new InMemorySourceRegistry();
    expect(() => registry.upsert({
      name: "Bad source",
      type: "rss",
      url: "https://example.test/feed.xml",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.5,
      crawlFrequencySeconds: 3600,
      legalNotes: ""
    })).toThrow("legal notes");
  });

  test("clamps trust score", () => {
    const registry = new InMemorySourceRegistry();
    const source = registry.upsert({
      name: "Good source",
      type: "rss",
      url: "https://example.test/feed.xml",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 2,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public fixture."
    });

    expect(source.trustScore).toBe(1);
  });

  test("blocks high-risk activation until governance approval", () => {
    const registry = new InMemorySourceRegistry();
    const source = registry.upsert({
      name: "Onion metadata fixture",
      type: "tor_metadata",
      url: "http://fixture.onion",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "high",
      trustScore: 0.6,
      crawlFrequencySeconds: 7200,
      legalNotes: "Metadata-only public onion fixture for policy tests."
    });

    expect(() => registry.setStatus(source.id, "active")).toThrow("approval is required");

    const approved = registry.approve(source.id, "analyst_1", {
      activate: true,
      riskJustification: "Metadata-only source; no leaked datasets are collected.",
      reviewTicket: "LEGAL-1"
    });

    expect(approved.status).toBe("active");
    expect(approved.governance?.approvalState).toBe("approved");
    expect(approved.governance?.metadataOnly).toBe(true);
  });

  test("records bounded health and source scoring inputs", () => {
    const registry = new InMemorySourceRegistry();
    const source = registry.upsert({
      name: "Health source",
      type: "rss",
      url: "https://example.test/feed.xml",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.7,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public RSS fixture for source health tests."
    });

    const updated = registry.recordHealth(source.id, {
      status: "degraded",
      consecutiveFailures: 2,
      errorRate: 2,
      medianLatencyMs: 250
    });

    expect(updated.health?.errorRate).toBe(1);
    expect(updated.health?.consecutiveFailures).toBe(2);
    expect(updated.scoring?.reliability).toBe(0.7);
  });

  test("deduplicates seed source ingestion by tenant, type, and URL", () => {
    const registry = new InMemorySourceRegistry();
    const seed = {
      name: "Seed",
      type: "rss" as const,
      url: "https://example.test/feed.xml",
      accessMethod: "public_http" as const,
      status: "candidate" as const,
      risk: "low" as const,
      trustScore: 0.5,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public seed source fixture."
    };

    expect(() => registry.ingestSeedSources([seed, seed])).toThrow("Duplicate seed source");
  });

  test("expires approval and moves active reviewed sources back to review", () => {
    const registry = new InMemorySourceRegistry();
    const source = registry.upsert({
      name: "Medium source",
      type: "static_web",
      url: "https://example.test/reports",
      accessMethod: "public_http",
      status: "needs_review",
      risk: "medium",
      trustScore: 0.6,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public but medium-risk source requiring explicit review."
    });

    const approved = registry.applyReviewDecision({
      id: "review_approve",
      sourceId: source.id,
      action: "approve",
      decidedAt: "2026-05-24T00:00:00.000Z",
      decidedBy: "analyst_1",
      reason: "Public source approved for defensive collection.",
      approvalExpiresAt: "2999-01-01T00:00:00.000Z",
      reviewTicket: "SRC-1"
    });
    registry.setStatus(approved.id, "active", { actorId: "analyst_1", reason: "policy_review" });

    const expired = registry.applyReviewDecision({
      id: "review_expire",
      sourceId: source.id,
      action: "expire",
      decidedAt: "2026-06-24T00:00:00.000Z",
      decidedBy: "governance",
      reason: "Scheduled approval review expired.",
      approvalExpiresAt: "2026-06-24T00:00:00.000Z"
    });

    expect(expired.status).toBe("needs_review");
    expect(expired.governance?.approvalState).toBe("expired");
  });

  test("quarantines a source after repeated failures and restores after recovery", () => {
    const registry = new InMemorySourceRegistry();
    const source = registry.upsert({
      name: "Recoverable source",
      type: "rss",
      url: "https://example.test/feed.xml",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.7,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public RSS fixture for health lifecycle tests."
    });

    const quarantined = registry.recordHealth(source.id, {
      status: "failing",
      consecutiveFailures: 5,
      errorRate: 1,
      lastFailureAt: "2026-05-24T00:05:00.000Z"
    });

    expect(quarantined.status).toBe("quarantined");
    expect(quarantined.lifecycle?.at(-1)?.reason).toBe("health_check");

    const restored = registry.recordHealth(source.id, {
      status: "healthy",
      consecutiveFailures: 0,
      errorRate: 0,
      lastSuccessAt: "2026-05-24T00:10:00.000Z"
    });

    expect(restored.status).toBe("probation");
    expect(restored.health?.status).toBe("healthy");
  });

  test("applies explicit quarantine and restore review decisions", () => {
    const registry = new InMemorySourceRegistry();
    const source = registry.upsert({
      name: "Manual review source",
      type: "rss",
      url: "https://example.test/review.xml",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.7,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public RSS fixture for review decision tests.",
      health: { status: "healthy", consecutiveFailures: 0, errorRate: 0 }
    });
    const quarantine: SourceReviewDecision = {
      id: "review_quarantine",
      sourceId: source.id,
      action: "quarantine",
      decidedAt: "2026-05-24T00:00:00.000Z",
      decidedBy: "operator",
      reason: "Parser emitted unsafe output."
    };

    const quarantined = registry.applyReviewDecision(quarantine);
    expect(quarantined.status).toBe("quarantined");

    const restored = registry.applyReviewDecision({
      id: "review_restore",
      sourceId: source.id,
      action: "restore",
      decidedAt: "2026-05-24T01:00:00.000Z",
      decidedBy: "operator",
      reason: "Parser fixed and health checks recovered.",
      restoreStatus: "active"
    });

    expect(restored.status).toBe("active");
  });
});
