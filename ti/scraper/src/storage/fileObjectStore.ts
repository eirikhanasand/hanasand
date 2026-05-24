import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ObjectStoreRef } from "../types.ts";
import type { ObjectEvidenceRecord, ObjectEvidenceStore, ObjectEvidenceWrite } from "./evidenceStore.ts";
import { nowIso } from "../utils.ts";

export interface FileObjectEvidenceStoreOptions {
  rootDir: string;
  bucket?: string;
}

export class FileObjectEvidenceStore implements ObjectEvidenceStore {
  private readonly rootDir: string;
  private readonly bucket: string;

  constructor(options: FileObjectEvidenceStoreOptions) {
    this.rootDir = options.rootDir;
    this.bucket = options.bucket ?? "public-canary-evidence";
    mkdirSync(this.rootDir, { recursive: true });
  }

  putObject(input: ObjectEvidenceWrite): ObjectEvidenceRecord {
    const bytes = typeof input.body === "string" ? new TextEncoder().encode(input.body) : input.body;
    const key = `${input.tenantId ?? "global"}/${input.sourceId}/${input.captureId}/${input.contentHash}.bin`;
    const objectPath = this.pathForKey(key);
    mkdirSync(dirname(objectPath), { recursive: true });
    writeFileSync(objectPath, bytes);

    const ref: ObjectStoreRef = {
      bucket: this.bucket,
      key,
      versionId: input.contentHash,
      sizeBytes: bytes.byteLength,
      sha256: input.contentHash
    };
    const record = this.recordFor(ref, input);
    writeFileSync(`${objectPath}.json`, JSON.stringify(record, null, 2));
    return record;
  }

  getObject(ref: ObjectStoreRef): ObjectEvidenceRecord | undefined {
    if (ref.bucket !== this.bucket) return undefined;
    const metadataPath = `${this.pathForKey(ref.key)}.json`;
    if (!existsSync(metadataPath)) return undefined;
    return JSON.parse(readFileSync(metadataPath, "utf8")) as ObjectEvidenceRecord;
  }

  deleteObject(ref: ObjectStoreRef, _reason: string): boolean {
    if (ref.bucket !== this.bucket) return false;
    const objectPath = this.pathForKey(ref.key);
    let deleted = false;
    for (const path of [objectPath, `${objectPath}.json`]) {
      if (!existsSync(path)) continue;
      unlinkSync(path);
      deleted = true;
    }
    return deleted;
  }

  private recordFor(ref: ObjectStoreRef, input: ObjectEvidenceWrite): ObjectEvidenceRecord {
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

  private pathForKey(key: string): string {
    const safeKey = key.split("/").map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "_")).join("/");
    return join(this.rootDir, safeKey);
  }
}
