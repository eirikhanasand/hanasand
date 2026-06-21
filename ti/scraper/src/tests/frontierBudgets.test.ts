import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { source } from "./helpers/frontierFixtures.ts";

describe("focused frontier budgets and metrics", () => {
  test("groups queue snapshots and enforces task byte and deadline budgets", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 3, crawlBudgetPolicies: { bytes: { taskLimit: 10, byteLimit: 1_000, deadlineAt: "2026-01-01T01:00:00.000Z" }, expired: { taskLimit: 10, byteLimit: 10_000, deadlineAt: "2025-12-31T23:59:59.000Z" } } });
    for (const [index, budgetKey] of ["bytes", "bytes", "expired"].entries()) {
      frontier.add({ source: { ...source, id: `src_budget_${index}` }, tenantId: index === 2 ? "tenant_expired" : "tenant_budget", intelRequestId: `request_${budgetKey}`, url: `https://budget.example.test/${budgetKey}/${index}`, discoveredAt: now.toISOString(), anchorText: "APT29 ransomware campaign exploit", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8, budgetKey, maxBytes: 600 });
    }
    expect(frontier.next(now)?.crawlBudgetKey).toBe("bytes");
    expect(frontier.next(now)).toBeUndefined();
    const grouped = frontier.groupedSnapshot(now);
    expect(grouped.groups.tenants.tenant_budget).toBe(2);
    expect(grouped.groups.adapterTypes.static_web).toBeGreaterThan(0);
    expect(grouped.groups.priorityBuckets.critical).toBeGreaterThan(0);
    expect(grouped.groups.ageBuckets.lt_5m).toBeGreaterThan(0);
    expect(grouped.budgets.bytes.bytesRemaining).toBe(400);
    expect(grouped.budgets.expired.expired).toBe(true);
  });

  test("tracks scheduling metrics and retry-exhausted dead letters", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultRetryBudget: 0, defaultPerSourceConcurrency: 2 });
    frontier.add({ source, tenantId: "tenant_metrics", url: "https://example.test/apt29-dead-letter", discoveredAt: now.toISOString(), anchorText: "APT29 ransomware campaign exploit", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    const leased = frontier.next(now);
    expect((leased ? frontier.fail(leased, now, "permanent fixture failure") : undefined)?.status).toBe("retry_exhausted");
    expect(frontier.deadLetterSnapshot()).toHaveLength(1);
    const metrics = frontier.metrics(now);
    expect(metrics.throughput.failed).toBe(1);
    expect(metrics.throughput.retryExhausted).toBe(1);
    expect(metrics.queueAgeSeconds.highPriorityMax).toBeGreaterThanOrEqual(0);
    expect(metrics.tenantStarvation).toBe(0);
  });
});
