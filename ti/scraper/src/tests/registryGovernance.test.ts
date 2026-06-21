import { describe, expect, test } from "bun:test";
import type { SourceReviewDecision } from "../types.ts";
import { registry, seedSource } from "./helpers/registryFixtures.ts";

describe("source registry review decisions", () => {
  test("requires approval before high-risk activation", () => {
    const store = registry();
    const source = store.upsert(seedSource({
      type: "tor_metadata",
      url: "http://fixture.onion",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "high"
    }));

    expect(() => store.setStatus(source.id, "active")).toThrow("approval is required");
    const approved = store.approve(source.id, "analyst_1", {
      activate: true,
      riskJustification: "Metadata-only source; no leaked datasets are collected.",
      reviewTicket: "LEGAL-1"
    });

    expect(approved.status).toBe("active");
    expect(approved.governance?.approvalState).toBe("approved");
    expect(approved.governance?.metadataOnly).toBe(true);
  });

  test("applies explicit quarantine and restore review decisions", () => {
    const store = registry();
    const source = store.upsert(seedSource({
      id: "manual_review",
      health: { status: "healthy", consecutiveFailures: 0, errorRate: 0 }
    }));
    const quarantine: SourceReviewDecision = {
      id: "review_quarantine",
      sourceId: source.id,
      action: "quarantine",
      decidedAt: "2026-05-24T00:00:00.000Z",
      decidedBy: "operator",
      reason: "Parser emitted unsafe output."
    };

    expect(store.applyReviewDecision(quarantine).status).toBe("quarantined");
    expect(store.applyReviewDecision({
      id: "review_restore",
      sourceId: source.id,
      action: "restore",
      decidedAt: "2026-05-24T01:00:00.000Z",
      decidedBy: "operator",
      reason: "Parser fixed and health checks recovered.",
      restoreStatus: "active"
    }).status).toBe("active");
  });
});
