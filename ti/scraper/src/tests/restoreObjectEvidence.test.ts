import { mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  buildObjectLedger,
  formatObjectLedger,
  parseObjectReferences,
  reconcileRestoredObjectEvidence,
} from "../../scripts/verify-restored-database.ts";
import { FileObjectEvidenceStore } from "../storage/fileObjectStore.ts";
import { fileObjectPathForKey } from "../storage/fileObjectStoreHelpers.ts";
import { hashContent } from "../utils.ts";

function fixture(evidenceRoot: string) {
  const body = "retained recovery evidence";
  const contentHash = hashContent(body);
  const objects = new FileObjectEvidenceStore({ rootDir: join(evidenceRoot, "objects") });
  const record = objects.putObject({
    tenantId: "tenant_restore",
    sourceId: "source_restore",
    captureId: "capture_restore",
    body,
    mediaType: "text/plain",
    contentHash,
    retentionClass: "public_report",
  });
  const capture = {
    id: "capture_restore",
    tenantId: "tenant_restore",
    sourceId: "source_restore",
    mediaType: "text/plain",
    retentionClass: "public_report",
    contentHash,
    storageKind: "external_object",
    objectRef: record.ref,
  };
  const references = parseObjectReferences([
    "capture_id\ttenant_id\tsource_id\tmedia_type\tretention_class\tcontent_hash\tbucket\tobject_key\tversion_id\tref_content_hash\tsize_bytes",
    [
      capture.id,
      capture.tenantId,
      capture.sourceId,
      capture.mediaType,
      capture.retentionClass,
      capture.contentHash,
      record.ref.bucket,
      record.ref.key,
      record.ref.versionId,
      record.ref.sha256,
      record.ref.sizeBytes,
    ].join("\t"),
  ].join("\n"));
  return {
    body,
    capture,
    references,
    objectPath: fileObjectPathForKey(join(evidenceRoot, "objects"), record.ref.key),
  };
}

async function withFixture(run: (value: ReturnType<typeof fixture>, evidenceRoot: string) => Promise<void>) {
  const evidenceRoot = mkdtempSync(join(tmpdir(), "ti-restore-objects-"));
  try {
    await run(fixture(evidenceRoot), evidenceRoot);
  } finally {
    rmSync(evidenceRoot, { recursive: true, force: true });
  }
}

describe("restored object evidence reconciliation", () => {
  test("binds restored DB references to the archived bytes and recovery metadata", async () => {
    await withFixture(async ({ capture, references }, evidenceRoot) => {
      const ledger = formatObjectLedger(await buildObjectLedger(references, evidenceRoot));
      expect(await reconcileRestoredObjectEvidence([capture], evidenceRoot, ledger)).toEqual({
        linked: 1,
        resolved: 1,
        missing: 0,
        mismatched: 0,
        metadataRetentionDifferences: 0,
      });
    });
  });

  test("preserves and reports historical database/file retention differences exactly", async () => {
    await withFixture(async ({ capture, references }, evidenceRoot) => {
      const legacyReferences = references.map((row) => ({ ...row, retentionClass: "standard" }));
      const ledger = formatObjectLedger(await buildObjectLedger(legacyReferences, evidenceRoot));
      expect(await reconcileRestoredObjectEvidence(
        [{ ...capture, retentionClass: "standard" }],
        evidenceRoot,
        ledger,
      )).toEqual({
        linked: 1,
        resolved: 1,
        missing: 0,
        mismatched: 0,
        metadataRetentionDifferences: 1,
      });
    });
  });

  test("rejects deletion between the DB snapshot and evidence archive", async () => {
    await withFixture(async ({ objectPath, references }, evidenceRoot) => {
      unlinkSync(objectPath);
      await expect(buildObjectLedger(references, evidenceRoot))
        .rejects.toThrow("linked=1 resolved=0 missing=1 mismatched=0");
    });
  });

  test("rejects a symlink in place of archived object bytes", async () => {
    await withFixture(async ({ body, objectPath, references }, evidenceRoot) => {
      const outside = join(evidenceRoot, "outside.bin");
      writeFileSync(outside, body);
      unlinkSync(objectPath);
      symlinkSync(outside, objectPath);
      await expect(buildObjectLedger(references, evidenceRoot))
        .rejects.toThrow("linked=1 resolved=0 missing=0 mismatched=1");
    });
  });

  test("rejects same-size content swapped after the DB-bound ledger was written", async () => {
    await withFixture(async ({ capture, objectPath, references }, evidenceRoot) => {
      const ledger = formatObjectLedger(await buildObjectLedger(references, evidenceRoot));
      writeFileSync(objectPath, "x".repeat(readFileSync(objectPath).byteLength));
      await expect(reconcileRestoredObjectEvidence([capture], evidenceRoot, ledger))
        .rejects.toThrow("linked=1 resolved=0 missing=0 mismatched=1");
    });
  });

  test("rejects recovery metadata that differs from the DB snapshot", async () => {
    await withFixture(async ({ objectPath, references }, evidenceRoot) => {
      const metadataPath = `${objectPath}.json`;
      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      metadata.mediaType = "application/octet-stream";
      writeFileSync(metadataPath, JSON.stringify(metadata));
      await expect(buildObjectLedger(references, evidenceRoot))
        .rejects.toThrow("linked=1 resolved=0 missing=0 mismatched=1");
    });
  });

  test("rejects retention metadata changed after the DB-bound ledger was written", async () => {
    await withFixture(async ({ capture, objectPath, references }, evidenceRoot) => {
      const ledger = formatObjectLedger(await buildObjectLedger(references, evidenceRoot));
      const metadataPath = `${objectPath}.json`;
      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      metadata.retentionClass = "standard";
      writeFileSync(metadataPath, JSON.stringify(metadata));
      await expect(reconcileRestoredObjectEvidence([capture], evidenceRoot, ledger))
        .rejects.toThrow("linked=1 resolved=0 missing=0 mismatched=1");
    });
  });
});
