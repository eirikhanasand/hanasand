import { processCollectedItem } from "../../src/pipeline/pipeline.ts";
import type { InMemoryScraperStore } from "../../src/storage/memoryStore.ts";
import type { CollectionRun, SourceRecord } from "../../src/types.ts";
import { hashContent } from "../../src/utils.ts";

export function seedRun(store: InMemoryScraperStore, name: string, metadata: Record<string, unknown>): CollectionRun {
  const run = runRecord(name);
  const taskId = `task_graph_mounted_${name}`;
  store.savePlan({
    id: run.planId,
    tenantId: run.tenantId,
    request: { id: run.requestId, query: "APT29", entityType: "actor", tenantId: run.tenantId },
    tasks: [task(run, taskId, name)],
    reviewRequired: [],
    rejected: [],
    createdAt: run.createdAt
  });
  store.saveRun(run);
  store.savePipelineResult({
    ...pipelineResult(taskId, name, metadata),
    capture: { ...pipelineResult(taskId, name, metadata).capture, tenantId: run.tenantId }
  });
  return run;
}

export function source(): SourceRecord {
  return {
    id: "src_graph_mounted",
    name: "Graph Mounted Proof RSS",
    type: "rss",
    url: "https://graph-mounted.example.test/feed.xml",
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.9,
    crawlFrequencySeconds: 3600,
    legalNotes: "Mounted graph review endpoint proof fixture.",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function runRecord(name: string): CollectionRun {
  return {
    id: `run_graph_mounted_${name}`,
    tenantId: "tenant_graph_mounted",
    planId: `plan_graph_mounted_${name}`,
    requestId: `request_graph_mounted_${name}`,
    status: "completed",
    createdAt: "2026-05-24T04:00:00.000Z",
    updatedAt: "2026-05-24T04:01:00.000Z",
    taskCount: 1,
    reviewTaskCount: 0,
    rejectedSourceCount: 0,
    captureCount: 1,
    incidentCount: 1
  };
}

function task(run: CollectionRun, taskId: string, name: string) {
  return { id: taskId, runId: run.id, sourceId: "src_graph_mounted", sourceType: "rss" as const, url: `https://graph-mounted.example.test/${name}`, priority: 100, status: "completed" as const, createdAt: run.createdAt, updatedAt: run.updatedAt };
}

function pipelineResult(taskId: string, name: string, metadata: Record<string, unknown>) {
  const rawText = `APT29 used phishing and Cobalt Strike against Northwind Health in healthcare from https://evil.example.com/${name} and exploited CVE-2025-12345.`;
  return processCollectedItem({
    sourceId: "src_graph_mounted",
    taskId,
    url: `https://graph-mounted.example.test/${name}`,
    collectedAt: "2026-05-24T04:02:00.000Z",
    title: `APT29 graph mounted ${name}`,
    rawText,
    contentHash: hashContent(`${name}:${rawText}`),
    links: [],
    metadata,
    sensitive: false
  });
}
