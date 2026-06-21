import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { source } from "./helpers/frontierFixtures.ts";

describe("focused frontier lifecycle", () => {
  test("schedules deterministically with per-source concurrency and retry backoff", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 1, baseBackoffMs: 1_000, crawlBudgets: { request_1: 2 } });
    const candidate = { source, discoveredAt: now.toISOString(), parentRelevance: 0.9, novelty: 0.8, freshness: 0.8, budgetKey: "request_1" };
    frontier.add({ ...candidate, url: "https://example.test/apt29-ransomware", anchorText: "APT29 ransomware campaign" });
    frontier.add({ ...candidate, url: "https://example.test/apt29-cve", anchorText: "APT29 CVE exploit" });
    const first = frontier.next(now);
    expect(first?.targetUrl).toBe("https://example.test/apt29-ransomware");
    expect(frontier.next(now)).toBeUndefined();
    expect((first ? frontier.fail(first, now) : undefined)?.retryCount).toBe(1);
    expect(frontier.next(now)).toBeUndefined();
  });

  test("acknowledges complete, fail, cancel, and expired lease requeue", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const later = new Date("2026-01-01T00:00:02.000Z");
    const frontier = new FocusedFrontier({ now: () => start, taskLeaseMs: 1_000, baseBackoffMs: 1_000, defaultPerSourceConcurrency: 2 });
    frontier.add({ source, url: "https://example.test/apt29-complete", discoveredAt: start.toISOString(), anchorText: "APT29 ransomware campaign", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    const completed = frontier.next(start);
    expect(completed ? frontier.complete(completed).status : "missing").toBe("completed");
    expect(frontier.leasedSnapshot()).toHaveLength(0);

    frontier.add({ source, url: "https://example.test/apt29-fail", discoveredAt: start.toISOString(), anchorText: "APT29 malware campaign", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    const failed = frontier.next(start);
    expect(failed ? frontier.fail(failed, start, "adapter timeout") : undefined).toMatchObject({ status: "retry_scheduled", retry: { retryCount: 1 } });

    frontier.add({ source: { ...source, id: "src_cancel" }, url: "https://example.test/apt29-cancel", discoveredAt: start.toISOString(), anchorText: "APT29 exploit campaign", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    const queuedCancel = frontier.snapshot().find((task) => task.targetUrl.includes("cancel"));
    expect(queuedCancel ? frontier.cancel(queuedCancel, "operator cancelled").status : "missing").toBe("cancelled");

    frontier.add({ source: { ...source, id: "src_expire" }, url: "https://example.test/apt29-expire", discoveredAt: start.toISOString(), anchorText: "APT29 CVE exploit", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    const leased = frontier.next(start);
    expect(frontier.requeueExpiredLeases(later)).toHaveLength(1);
    expect(frontier.leasedSnapshot()).toHaveLength(0);
    expect(frontier.snapshot().some((task) => task.id === leased?.id)).toBe(true);
  });
});
