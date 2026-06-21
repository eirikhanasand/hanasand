import { describe, expect, test } from "bun:test";
import { registry, seedSource } from "./helpers/registryFixtures.ts";

describe("source registry lifecycle", () => {
  test("expires approval and moves active reviewed sources back to review", () => {
    const store = registry();
    const source = store.upsert(seedSource({ status: "needs_review", risk: "medium" }));
    const approved = store.applyReviewDecision({
      id: "review_approve",
      sourceId: source.id,
      action: "approve",
      decidedAt: "2026-05-24T00:00:00.000Z",
      decidedBy: "analyst_1",
      reason: "Public source approved for defensive collection.",
      approvalExpiresAt: "2999-01-01T00:00:00.000Z",
      reviewTicket: "SRC-1"
    });

    store.setStatus(approved.id, "active", { actorId: "analyst_1", reason: "policy_review" });
    const expired = store.applyReviewDecision({
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
    const store = registry();
    const source = store.upsert(seedSource({ id: "recoverable" }));

    const quarantined = store.recordHealth(source.id, {
      status: "failing",
      consecutiveFailures: 5,
      errorRate: 1,
      lastFailureAt: "2026-05-24T00:05:00.000Z"
    });
    expect(quarantined.status).toBe("quarantined");
    expect(quarantined.lifecycle?.at(-1)?.reason).toBe("health_check");

    const restored = store.recordHealth(source.id, {
      status: "healthy",
      consecutiveFailures: 0,
      errorRate: 0,
      lastSuccessAt: "2026-05-24T00:10:00.000Z"
    });
    expect(restored.status).toBe("probation");
  });
});
