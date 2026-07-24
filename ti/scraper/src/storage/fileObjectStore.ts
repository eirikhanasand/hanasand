import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ObjectStoreRef } from "../types.ts";
import type { ObjectEvidenceRecord, ObjectEvidenceStore, ObjectEvidenceWrite } from "./evidenceStore.ts";
import { fileObjectRecordFor, fileObjectPathForKey } from "./fileObjectStoreHelpers.ts";

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
    const objectPath = fileObjectPathForKey(this.rootDir, key);
    mkdirSync(dirname(objectPath), { recursive: true });
    writeFileSync(objectPath, bytes);

    const ref: ObjectStoreRef = {
      bucket: this.bucket,
      key,
      versionId: input.contentHash,
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
    const record = fileObjectRecordFor(ref, input);
    writeFileSync(`${objectPath}.json`, JSON.stringify(record, null, 2));
    return record;
  }

  getObject(ref: ObjectStoreRef): ObjectEvidenceRecord | undefined {
    if (ref.bucket !== this.bucket) return undefined;
    const metadataPath = `${fileObjectPathForKey(this.rootDir, ref.key)}.json`;
    if (!existsSync(metadataPath)) return undefined;
    return JSON.parse(readFileSync(metadataPath, "utf8")) as ObjectEvidenceRecord;
  }

  deleteObject(ref: ObjectStoreRef, _reason: string): boolean {
    if (ref.bucket !== this.bucket) throw new Error("Object belongs to a different evidence bucket");
    const objectPath = fileObjectPathForKey(this.rootDir, ref.key);
    for (const path of [objectPath, `${objectPath}.json`]) {
      if (!existsSync(path)) continue;
      unlinkSync(path);
    }
    return true;
  }
}
