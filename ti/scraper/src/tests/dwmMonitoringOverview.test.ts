import { expect, test } from "bun:test";
import { buildDwmProductSnapshot } from "../product/dwmProduct.ts";
import { buildDwmOperationsSnapshot } from "../product/dwmOperations.ts";
import type { SourceRecord } from "../types.ts";

const source = (id: string, extra: Partial<SourceRecord> = {}): SourceRecord => ({
  id, name: id, tenantId: "org-one", type: "tor_metadata", status: "active", trustScore: 0.99,
  metadata: { actorName: `Actor ${id}` }, ...extra
} as SourceRecord);

test("returns every scoped actor and source without promoting metadata to captured observations", () => {
  const sources = Array.from({ length: 35 }, (_, i) => source(String(i)));
  sources.push(source("private", { tenantId: "org-two" }));
  const snapshot = buildDwmProductSnapshot({ tenantId: "org-one", sources, captures: [] });
  expect(snapshot.actorOverviews).toHaveLength(35);
  expect(snapshot.actorOverviews.every(actor => actor.captureCount === 0 && !actor.latestSeenAt)).toBe(true);
  expect(snapshot.actorOverviews.some(actor => actor.actor.includes("Private"))).toBe(false);
  const operations = buildDwmOperationsSnapshot({ tenantId: "org-one", sources, captures: [] });
  expect(operations.sourceHealth).toHaveLength(35);
  expect(operations.sourceHealth.every(row => row.collectionStatus === "not_collected" && !row.lastSuccessAt)).toBe(true);
});

test("reports collection success and subsequent failure separately from source configuration", () => {
  const success = "2026-09-07T10:00:00Z";
  const failure = "2026-09-07T11:00:00Z";
  const recovery = "2026-09-07T12:00:00Z";
  const sources = [
    source("failed", { health: { status: "failing", lastSuccessAt: success, lastFailureAt: failure } } as Partial<SourceRecord>),
    source("recovered", { health: { status: "healthy", lastSuccessAt: recovery, lastFailureAt: failure } } as Partial<SourceRecord>),
    source("paused", { status: "paused", crawlState: { lastCollectedAt: success } } as Partial<SourceRecord>),
  ];
  const rows = buildDwmOperationsSnapshot({ tenantId: "org-one", sources, captures: [] }).sourceHealth;
  expect(rows.find(row => row.sourceId === "failed")).toMatchObject({ collectionStatus: "failed", lastSuccessAt: success, lastAttemptAt: failure });
  expect(rows.find(row => row.sourceId === "recovered")).toMatchObject({ collectionStatus: "succeeded", lastSuccessAt: recovery, lastAttemptAt: recovery });
  expect(rows.find(row => row.sourceId === "paused")).toMatchObject({ collectionStatus: "paused", lastSuccessAt: success });
});
