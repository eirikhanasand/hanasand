import { buildTelegramPublicRuntimeCollection } from "../../adapters/telegramPublic.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../../storage/memoryStore.ts";
import { persistTelegramPublicRuntimeEvidence } from "../../storage/runtimeEvidence.ts";
import type { CollectedItem, CollectionTask, SourceRecord } from "../../types.ts";

export function buildRuntimeEvidenceFixture() {
  const store = new InMemoryScraperStore();
  const objectStore = new InMemoryObjectEvidenceStore();
  const src = source({ id: "src_runtime_q", tenantId: "tenant_q", metadata: { actors: ["APT29"], afterMessageId: 3000, publicQueryWindowLimit: 25 } });
  store.saveSource(src);
  store.saveRun({ id: "run_q", tenantId: "tenant_q", requestId: "req_q", planId: "plan_q", status: "running", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", taskCount: 1, reviewTaskCount: 0, rejectedSourceCount: 0, captureCount: 0, incidentCount: 0 });
  store.savePlan({ id: "plan_q", request: { id: "req_q", query: "APT29", entityType: "actor", tenantId: "tenant_q", includeClearWeb: true, includeTelegram: true, includeDarknetMetadata: false, maxTasks: 10, priority: "normal", createdAt: "2026-01-01T00:00:00.000Z" }, tasks: [task("src_runtime_q", "tenant_q")], reviewRequired: [], rejected: [], audit: [] });
  const runtime = buildTelegramPublicRuntimeCollection({ source: src, task: task("src_runtime_q", "tenant_q"), result: { items: [collectedTelegramItem("src_runtime_q", 3001, "APT29 used CVE-2026-9999 against victim: Fjord Energy AS"), collectedTelegramItem("src_runtime_q", 3002, "APT29 edited public-channel context", { editDate: "2026-01-01T00:04:00.000Z" }), collectedTelegramItem("src_runtime_q", 3003, "", { deleted: true })], discovered: [], warnings: [] }, query: "APT29", generatedAt: "2026-01-01T00:05:00.000Z" });
  const persisted = persistTelegramPublicRuntimeEvidence(store, runtime, { tenantId: "tenant_q", runId: "run_q", query: "APT29", generatedAt: "2026-01-01T00:05:30.000Z" });
  return { store, objectStore, persisted };
}

function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return { id: input.id ?? "src_runtime_q", tenantId: input.tenantId, name: input.name ?? "Public Telegram Runtime Channel", type: "telegram_public", url: input.url ?? "https://t.me/securityalerts", accessMethod: "official_api", status: input.status ?? "active", risk: "medium", trustScore: 0.78, crawlFrequencySeconds: 300, legalNotes: "Public channel reviewed for CTI collection through official Telegram APIs.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer_1", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false, approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer_1", policyVersion: "collection-policy:v1" }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", crawlState: input.crawlState, metadata: input.metadata };
}

function task(sourceId: string, tenantId: string): CollectionTask {
  return { id: "task_runtime_q", tenantId, sourceId, sourceType: "telegram_public", targetUrl: "https://t.me/securityalerts", queuedAt: "2026-01-01T00:00:00.000Z", priority: 0.9, reason: "APT29", retryCount: 0, runId: "run_q" };
}

function collectedTelegramItem(sourceId: string, id: number, text: string, metadata: Record<string, unknown> = {}): CollectedItem {
  const deleted = metadata.deleted === true;
  const unavailable = metadata.unavailable === true;
  return { sourceId, taskId: "task_runtime_q", url: `https://t.me/securityalerts/${id}`, collectedAt: "2026-01-01T00:05:00.000Z", publishedAt: "2026-01-01T00:01:00.000Z", rawText: text, contentHash: `hash-${id}-${metadata.editDate ?? ""}-${deleted}-${unavailable}`, links: text.includes("CVE-2026-9999") ? ["https://reports.example/apt29"] : [], metadata: { adapter: "telegram_public", channel: "securityalerts", messageId: id, messageState: deleted ? "deleted" : unavailable ? "unavailable" : "available", editDate: metadata.editDate, urlMentions: text.includes("CVE-2026-9999") ? ["https://reports.example/apt29"] : [], media: { retention: "metadata_only", items: [] }, extractionHandoff: { messageText: text, actorAliases: text.includes("APT29") ? ["APT29"] : [], cves: text.includes("CVE-2026-9999") ? ["CVE-2026-9999"] : [], victims: text.includes("Fjord Energy AS") ? ["Fjord Energy AS"] : [], uncertaintyMarkers: deleted ? ["message_deleted"] : [] }, provenance: { confidence: 0.82 } }, sensitive: false };
}
