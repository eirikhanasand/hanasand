import type { CollectedItem, RawCapture } from "../types.ts";
import { hashContent, normalizeWhitespace, stableId } from "../utils.ts";
import { detectLanguageHooks, EXTRACTOR_VERSION } from "./extractors.ts";

export function buildRawCapture(item: CollectedItem): RawCapture {
  const captureId = stableId("cap", `${item.sourceId}:${item.url}:${item.contentHash}`);
  const contentHash = item.contentHash || hashContent(item.rawText);

  return {
    id: captureId,
    sourceId: item.sourceId,
    taskId: item.taskId,
    url: item.url,
    collectedAt: item.collectedAt,
    publishedAt: item.publishedAt,
    contentHash,
    normalizedTextHash: hashContent(normalizeWhitespace(item.rawText).toLowerCase()),
    mediaType: item.html ? "text/html" : "text/plain",
    storageKind: item.sensitive ? "metadata_only" : item.html ? "inline_html" : "inline_text",
    body: item.sensitive ? undefined : item.html ?? item.rawText,
    metadata: {
      ...item.metadata,
      extractorVersion: EXTRACTOR_VERSION,
      languageHooks: detectLanguageHooks(item.rawText, item.language)
    },
    sensitive: item.sensitive,
    sensitivityFlags: item.sensitive ? ["sensitive_source", "leak_metadata"] : ["public"],
    redaction: {
      applied: item.sensitive,
      policy: item.sensitive ? "metadata_only" : "none",
      reason: item.sensitive ? "Sensitive collection is stored as metadata only." : "Raw storage allowed."
    },
    provenance: {
      sourceId: item.sourceId,
      captureId,
      url: item.url,
      collectedAt: item.collectedAt,
      contentHash,
      extractorVersion: EXTRACTOR_VERSION,
      taskId: item.taskId
    },
    retentionClass: item.sensitive ? "restricted_metadata" : "standard"
  };
}
