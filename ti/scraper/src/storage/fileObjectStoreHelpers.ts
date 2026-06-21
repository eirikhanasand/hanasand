import { join } from "node:path";
import type { ObjectStoreRef } from "../types.ts";
import { nowIso } from "../utils.ts";
import type { ObjectEvidenceRecord, ObjectEvidenceWrite } from "./evidenceStore.ts";

export function fileObjectRecordFor(ref: ObjectStoreRef, input: ObjectEvidenceWrite): ObjectEvidenceRecord {
  return {
    ref,
    tenantId: input.tenantId,
    sourceId: input.sourceId,
    captureId: input.captureId,
    mediaType: input.mediaType,
    contentHash: input.contentHash,
    retentionClass: input.retentionClass,
    createdAt: nowIso(),
    metadata: {
      ...input.metadata,
      durableObjectBoundary: "file_object_store",
      rawBodyPersistedInMetadata: false
    }
  };
}

export function fileObjectPathForKey(rootDir: string, key: string): string {
  const safeKey = key.split("/").map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "_")).join("/");
  return join(rootDir, safeKey);
}
