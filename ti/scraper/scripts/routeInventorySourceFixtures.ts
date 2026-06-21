import { processCollectedItem } from "../src/pipeline/pipeline.ts";
import type { RawCapture, SourceRecord } from "../src/types.ts";
import { hashContent } from "../src/utils.ts";

export function source(id: string, type: SourceRecord["type"], url: string, risk: SourceRecord["risk"] = "low", accessMethod: SourceRecord["accessMethod"] = type === "telegram_public" ? "official_api" : "public_http"): SourceRecord {
  return {
    id,
    name: id,
    type,
    url,
    accessMethod,
    status: "active",
    risk,
    trustScore: 0.9,
    crawlFrequencySeconds: 3600,
    legalNotes: "Route inventory proof fixture.",
    approvedAt: "2026-05-24T00:00:00.000Z",
    approvedBy: "agent10",
    governance: risk === "restricted" ? { approvalState: "approved", approvedAt: "2026-05-24T00:00:00.000Z", approvedBy: "agent10", metadataOnly: true } : undefined,
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z"
  };
}

export function captureFor(input: { id: string; sourceId: string; taskId: string; url: string; body: string; collectedAt: string; metadata: Record<string, unknown> }): RawCapture {
  return {
    id: input.id,
    sourceId: input.sourceId,
    taskId: input.taskId,
    url: input.url,
    collectedAt: input.collectedAt,
    contentHash: hashContent(input.body),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: input.body,
    metadata: input.metadata,
    sensitive: false
  };
}

export function pipelineResultFromCapture(capture: RawCapture) {
  return processCollectedItem({
    sourceId: capture.sourceId,
    taskId: capture.taskId,
    url: capture.url,
    collectedAt: capture.collectedAt,
    title: String(capture.metadata.title),
    rawText: capture.body ?? "",
    contentHash: capture.contentHash,
    links: [],
    metadata: capture.metadata,
    sensitive: false
  });
}
