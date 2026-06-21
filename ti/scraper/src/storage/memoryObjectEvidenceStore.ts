// @ts-nocheck
import type { ObjectStoreRef } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import type { ObjectEvidenceRecord, ObjectEvidenceStore, ObjectEvidenceWrite } from "./evidenceStore.ts";

const objectKey = (ref: ObjectStoreRef) => `${ref.bucket}:${ref.key}:${ref.versionId ?? ""}`;

export class InMemoryObjectEvidenceStore implements ObjectEvidenceStore {
  private objects = new Map<string, ObjectEvidenceRecord>();

  putObject(input: ObjectEvidenceWrite) {
    const sizeBytes = typeof input.body === "string" ? new TextEncoder().encode(input.body).byteLength : input.body.byteLength;
    const key = `${input.tenantId ?? "global"}/${input.sourceId}/${input.captureId}/${input.contentHash}`;
    const ref = { bucket: "memory-evidence", key, versionId: stableId("objv", `${key}:${sizeBytes}`), sizeBytes, sha256: input.contentHash };
    const record = { ref, tenantId: input.tenantId, sourceId: input.sourceId, captureId: input.captureId, mediaType: input.mediaType, contentHash: input.contentHash, retentionClass: input.retentionClass, createdAt: nowIso(), metadata: input.metadata ?? {} };
    this.objects.set(objectKey(ref), record);
    return record;
  }

  getObject(ref: ObjectStoreRef) {
    return this.objects.get(objectKey(ref));
  }

  deleteObject(ref: ObjectStoreRef, _reason: string) {
    return this.objects.delete(objectKey(ref));
  }
}
