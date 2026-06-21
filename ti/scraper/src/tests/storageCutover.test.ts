import { describe, expect, test } from "bun:test";
import { buildEvidenceSearchIndexHandoff } from "../storage/evidenceStore.ts";
import {
  buildEvidenceSearchReadModelBackendWriteSet,
  buildEvidenceSearchReadModelPromotionReplay,
  buildEvidenceSearchableSourceMetadataCatalog,
  buildEvidenceSearchableSourceMetadataPublicSupportQueue,
  createEvidenceSearchReadModelRepository,
  evidenceSearchDocumentToPostgresRow,
  evidenceSearchReadModelReadiness
} from "../storage/evidenceSearchReadModel.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

const capture = {
  id: "cap_apt29",
  sourceId: "src_public",
  taskId: "task_1",
  url: "https://example.test/report",
  collectedAt: "2026-06-21T10:00:00.000Z",
  contentHash: "hash_apt29",
  body: "APT29 targeted healthcare with phishing and a claimed dataset.",
  retentionClass: "public_raw",
  metadata: { actor: "APT29", sector: "healthcare" }
} as any;

describe("compact evidence storage cutover", () => {
  test("builds searchable handoff rows and queries them in memory", () => {
    const handoff = { documents: [{ id: "doc_live", title: "APT29 healthcare claim", summary: "APT29 targeted healthcare", sourceId: "src_public" }] };
    const repo = createEvidenceSearchReadModelRepository({ backend: "embedded_memory" }) as any;
    const write = repo.writeHandoff(handoff);
    const hits = repo.search({ query: "healthcare", limit: 5 });
    expect(write.writtenDocuments).toBeGreaterThan(0);
    expect(hits[0].summary ?? hits[0].title).toBeString();
    expect(repo.stats().documentCount).toBeGreaterThan(0);
  });

  test("keeps backend write sets and public support queues compact", () => {
    const handoff = { documents: [{ id: "doc_1", title: "APT29 dataset claim", summary: "Public metadata row", sourceId: "src_public" }] };
    const writeSet = buildEvidenceSearchReadModelBackendWriteSet(handoff);
    const catalog = buildEvidenceSearchableSourceMetadataCatalog(writeSet);
    const queue = buildEvidenceSearchableSourceMetadataPublicSupportQueue(catalog);
    const replay = buildEvidenceSearchReadModelPromotionReplay(writeSet);
    expect(evidenceSearchDocumentToPostgresRow(handoff.documents[0]).document_id).toBe("doc_1");
    expect(queue.candidates.length).toBe(1);
    expect(replay.promotedDocuments).toBe(1);
    expect(evidenceSearchReadModelReadiness({ backend: "postgres_read_model" }).ready).toBe(false);
  });
});
