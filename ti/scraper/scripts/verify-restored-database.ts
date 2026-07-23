import { constants } from "node:fs";
import { open, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { PostgresScraperStore } from "../src/storage/postgresScraperStore.ts";
import type { RawCapture } from "../src/types.ts";

const REFERENCE_HEADER = [
  "capture_id", "tenant_id", "source_id", "media_type", "retention_class", "content_hash",
  "bucket", "object_key", "version_id", "ref_content_hash", "size_bytes",
].join("\t");
const LEDGER_HEADER = `${REFERENCE_HEADER}\tmetadata_tenant_id\tmetadata_media_type\tmetadata_retention_class\tobject_sha256\tmetadata_sha256`;

export interface ObjectReferenceRow {
  captureId: string;
  tenantId: string;
  sourceId: string;
  mediaType: string;
  retentionClass: string;
  contentHash: string;
  bucket: string;
  key: string;
  versionId: string;
  refContentHash: string;
  sizeBytes: number;
}

export interface ObjectLedgerRow extends ObjectReferenceRow {
  metadataTenantId: string;
  metadataMediaType: string;
  metadataRetentionClass: string;
  objectSha256: string;
  metadataSha256: string;
}

export interface RestoredObjectEvidenceResult {
  linked: number;
  resolved: number;
  missing: number;
  mismatched: number;
  metadataRetentionDifferences: number;
}

class ObjectEvidenceError extends Error {
  constructor(readonly kind: "missing" | "mismatched") {
    super(kind);
  }
}

export function parseObjectReferences(value: string): ObjectReferenceRow[] {
  return parseRows(value, false);
}

export function parseObjectLedger(value: string): ObjectLedgerRow[] {
  return parseRows(value, true) as ObjectLedgerRow[];
}

export function formatObjectLedger(rows: ObjectLedgerRow[]): string {
  return `${LEDGER_HEADER}\n${rows.map((row) => [
    row.captureId, row.tenantId, row.sourceId, row.mediaType, row.retentionClass, row.contentHash,
    row.bucket, row.key, row.versionId, row.refContentHash, row.sizeBytes,
    row.metadataTenantId, row.metadataMediaType, row.metadataRetentionClass,
    row.objectSha256, row.metadataSha256,
  ].join("\t")).join("\n")}${rows.length ? "\n" : ""}`;
}

export async function buildObjectLedger(
  references: ObjectReferenceRow[],
  evidenceRoot: string,
): Promise<ObjectLedgerRow[]> {
  const rows: ObjectLedgerRow[] = [];
  let missing = 0;
  let mismatched = 0;
  for (const reference of references) {
    try {
      rows.push(await inspectObject(reference, evidenceRoot));
    } catch (error) {
      if (error instanceof ObjectEvidenceError && error.kind === "missing") missing += 1;
      else mismatched += 1;
    }
  }
  if (missing || mismatched) {
    throw new Error(`object ledger reconciliation failed: linked=${references.length} resolved=${rows.length} missing=${missing} mismatched=${mismatched}`);
  }
  return rows;
}

export async function reconcileRestoredObjectEvidence(
  captures: RawCapture[],
  evidenceRoot: string,
  ledgerValue: string,
): Promise<RestoredObjectEvidenceResult> {
  const ledger = parseObjectLedger(ledgerValue);
  const byCapture = new Map(ledger.map((row) => [row.captureId, row]));
  const seen = new Set<string>();
  const result: RestoredObjectEvidenceResult = {
    linked: 0,
    resolved: 0,
    missing: 0,
    mismatched: 0,
    metadataRetentionDifferences: ledger.filter((row) => row.metadataRetentionClass !== row.retentionClass).length,
  };

  for (const capture of captures) {
    if (!capture.objectRef && !["external_object", "object_ref"].includes(capture.storageKind)) continue;
    result.linked += 1;
    const expected = byCapture.get(capture.id);
    let reference: ObjectReferenceRow;
    try {
      reference = referenceFromCapture(capture);
    } catch {
      result.missing += 1;
      continue;
    }
    if (!expected) {
      result.missing += 1;
      continue;
    }
    seen.add(capture.id);
    if (!sameReference(reference, expected)) {
      result.mismatched += 1;
      continue;
    }
    try {
      await inspectObject(expected, evidenceRoot, expected);
      result.resolved += 1;
    } catch (error) {
      if (error instanceof ObjectEvidenceError && error.kind === "missing") result.missing += 1;
      else result.mismatched += 1;
    }
  }
  result.mismatched += ledger.filter((row) => !seen.has(row.captureId)).length;

  if (result.missing || result.mismatched) {
    throw new Error(
      `restored object reconciliation failed: linked=${result.linked} resolved=${result.resolved} missing=${result.missing} mismatched=${result.mismatched}`,
    );
  }
  return result;
}

async function inspectObject(
  reference: ObjectReferenceRow,
  evidenceRoot: string,
  expectedHashes?: ObjectLedgerRow,
): Promise<ObjectLedgerRow> {
  const objectRoot = resolve(evidenceRoot, "objects");
  const [objectBytes, metadataBytes] = await Promise.all([
    readRegularFileAt(objectRoot, reference.key, true),
    readRegularFileAt(objectRoot, `${reference.key}.json`, true),
  ]);
  let record: any;
  try {
    record = JSON.parse(new TextDecoder().decode(metadataBytes));
  } catch {
    throw new ObjectEvidenceError("mismatched");
  }
  const metadataRef = record?.ref ?? {};
  if (
    normalizeTenant(record?.tenantId) !== reference.tenantId
    || record?.captureId !== reference.captureId
    || record?.sourceId !== reference.sourceId
    || record?.mediaType !== reference.mediaType
    || typeof record?.retentionClass !== "string"
    || !record.retentionClass
    || /[\t\r\n]/.test(record.retentionClass)
    || record?.contentHash !== reference.contentHash
    || metadataRef.bucket !== reference.bucket
    || metadataRef.key !== reference.key
    || metadataRef.versionId !== reference.versionId
    || metadataRef.sha256 !== reference.refContentHash
    || metadataRef.sizeBytes !== reference.sizeBytes
    || reference.versionId !== reference.contentHash
    || reference.refContentHash !== reference.contentHash
    || objectBytes.byteLength !== reference.sizeBytes
    || Bun.hash(objectBytes).toString(16) !== reference.contentHash
  ) {
    throw new ObjectEvidenceError("mismatched");
  }
  const row: ObjectLedgerRow = {
    ...reference,
    metadataTenantId: normalizeTenant(record.tenantId),
    metadataMediaType: record.mediaType,
    metadataRetentionClass: record.retentionClass,
    objectSha256: sha256(objectBytes),
    metadataSha256: sha256(metadataBytes),
  };
  if (expectedHashes && (
    row.metadataTenantId !== expectedHashes.metadataTenantId
    || row.metadataMediaType !== expectedHashes.metadataMediaType
    || row.metadataRetentionClass !== expectedHashes.metadataRetentionClass
    || row.objectSha256 !== expectedHashes.objectSha256
    || row.metadataSha256 !== expectedHashes.metadataSha256
  )) {
    throw new ObjectEvidenceError("mismatched");
  }
  return row;
}

async function readRegularFileAt(root: string, relative: string, strictName = false): Promise<Uint8Array> {
  if (typeof relative !== "string" || !relative || relative.startsWith("/")) {
    throw new ObjectEvidenceError("mismatched");
  }
  const parts = relative.split("/");
  if (
    parts.some((part) => !part || part === "." || part === ".." || (strictName && !/^[a-zA-Z0-9._-]+$/.test(part)))
    || (strictName && !/\.bin(?:\.json)?$/.test(relative))
  ) {
    throw new ObjectEvidenceError("mismatched");
  }
  let parent = resolve(root);
  for (const part of parts.slice(0, -1)) {
    await requireDirectory(parent);
    parent = resolve(parent, part);
  }
  await requireDirectory(parent);
  const path = resolve(parent, parts.at(-1)!);
  if (!path.startsWith(`${resolve(root)}${sep}`)) throw new ObjectEvidenceError("mismatched");

  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!(await handle.stat()).isFile()) throw new ObjectEvidenceError("mismatched");
    return await handle.readFile();
  } catch (error: any) {
    if (error instanceof ObjectEvidenceError) throw error;
    throw new ObjectEvidenceError(error?.code === "ENOENT" ? "missing" : "mismatched");
  } finally {
    await handle?.close();
  }
}

async function requireDirectory(path: string): Promise<void> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
    if (!(await handle.stat()).isDirectory()) throw new ObjectEvidenceError("mismatched");
  } catch (error: any) {
    if (error instanceof ObjectEvidenceError) throw error;
    throw new ObjectEvidenceError(error?.code === "ENOENT" ? "missing" : "mismatched");
  } finally {
    await handle?.close();
  }
}

function referenceFromCapture(capture: RawCapture): ObjectReferenceRow {
  const ref = capture.objectRef;
  if (!ref) throw new Error("missing object reference");
  return validateReference({
    captureId: capture.id,
    tenantId: normalizeTenant(capture.tenantId),
    sourceId: capture.sourceId,
    mediaType: capture.mediaType,
    retentionClass: capture.retentionClass,
    contentHash: capture.contentHash,
    bucket: ref.bucket,
    key: ref.key,
    versionId: ref.versionId,
    refContentHash: ref.sha256,
    sizeBytes: ref.sizeBytes,
  });
}

function parseRows(value: string, hashes: boolean): Array<ObjectReferenceRow | ObjectLedgerRow> {
  const lines = value.trimEnd().split("\n");
  if (lines.shift() !== (hashes ? LEDGER_HEADER : REFERENCE_HEADER)) throw new Error("invalid object ledger header");
  const ids = new Set<string>();
  return lines.filter(Boolean).map((line) => {
    const fields = line.split("\t");
    if (fields.length !== (hashes ? 16 : 11)) throw new Error("invalid object ledger row");
    const reference = validateReference({
      captureId: fields[0], tenantId: fields[1], sourceId: fields[2], mediaType: fields[3],
      retentionClass: fields[4], contentHash: fields[5], bucket: fields[6], key: fields[7],
      versionId: fields[8], refContentHash: fields[9], sizeBytes: Number(fields[10]),
    });
    if (ids.has(reference.captureId)) throw new Error("duplicate object ledger capture");
    ids.add(reference.captureId);
    if (!hashes) return reference;
    const metadataTenantId = fields[11]!;
    const metadataMediaType = fields[12]!;
    const metadataRetentionClass = fields[13]!;
    const objectSha256 = fields[14]!;
    const metadataSha256 = fields[15]!;
    if ([metadataTenantId, metadataMediaType, metadataRetentionClass].some((value) => !value || /[\t\r\n]/.test(value))) {
      throw new Error("invalid object ledger metadata");
    }
    if (!/^[a-f0-9]{64}$/.test(objectSha256) || !/^[a-f0-9]{64}$/.test(metadataSha256)) {
      throw new Error("invalid object ledger hash");
    }
    return {
      ...reference,
      metadataTenantId,
      metadataMediaType,
      metadataRetentionClass,
      objectSha256,
      metadataSha256,
    };
  });
}

function validateReference(row: any): ObjectReferenceRow {
  const required = [
    row.captureId, row.tenantId, row.sourceId, row.mediaType, row.retentionClass, row.contentHash,
    row.bucket, row.key, row.versionId, row.refContentHash,
  ];
  if (required.some((value) => typeof value !== "string" || !value || /[\t\r\n]/.test(value))) {
    throw new Error("invalid object reference");
  }
  if (!Number.isSafeInteger(row.sizeBytes) || row.sizeBytes < 0) throw new Error("invalid object reference size");
  return row as ObjectReferenceRow;
}

function sameReference(left: ObjectReferenceRow, right: ObjectReferenceRow): boolean {
  return (
    left.captureId === right.captureId
    && left.tenantId === right.tenantId
    && left.sourceId === right.sourceId
    && left.mediaType === right.mediaType
    && left.retentionClass === right.retentionClass
    && left.contentHash === right.contentHash
    && left.bucket === right.bucket
    && left.key === right.key
    && left.versionId === right.versionId
    && left.refContentHash === right.refContentHash
    && left.sizeBytes === right.sizeBytes
  );
}

function normalizeTenant(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "global";
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main(): Promise<void> {
  if (process.argv[2] === "ledger") {
    const referencePath = process.argv[3];
    const evidenceRoot = process.argv[4];
    if (!referencePath || !evidenceRoot) throw new Error("object reference ledger and evidence root are required");
    const references = parseObjectReferences(await readFile(referencePath, "utf8"));
    process.stdout.write(formatObjectLedger(await buildObjectLedger(references, evidenceRoot)));
    return;
  }

  const evidenceRootPath = process.env.TI_RESTORE_EVIDENCE_ROOT;
  const evidenceInventoryPath = process.env.TI_RESTORE_EVIDENCE_INVENTORY;
  const objectLedgerPath = process.env.TI_RESTORE_OBJECT_LEDGER;
  const verifierCommit = process.env.TI_RESTORE_VERIFIER_COMMIT;
  const scraperImageId = process.env.TI_RESTORE_SCRAPER_IMAGE_ID;
  if (!evidenceRootPath || !evidenceInventoryPath || !objectLedgerPath || !verifierCommit || !scraperImageId) {
    throw new Error("restored evidence paths are required");
  }
  const evidenceRoot = resolve(evidenceRootPath);
  const evidenceInventory = await readFile(evidenceInventoryPath, "utf8");
  const evidenceRows = evidenceInventory.trimEnd().split("\n").slice(1);
  for (const row of evidenceRows) {
    const [path, expectedHash] = row.split("\t");
    if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error("invalid restored evidence inventory row");
    if (sha256(await readRegularFileAt(evidenceRoot, path ?? "")) !== expectedHash) {
      throw new Error("restored evidence hash mismatch");
    }
  }
  const objectLedger = await readFile(objectLedgerPath, "utf8");

  const store = await PostgresScraperStore.create();
  try {
    await store.flush();
    const database = await store.databaseHealth();
    if (!database.ok) throw new Error("restored threat-intelligence database is not readable");
    const captures = store.listCaptures();
    const objectEvidence = await reconcileRestoredObjectEvidence(captures, evidenceRoot, objectLedger);

    console.log(JSON.stringify({
      schemaVersion: "hanasand.ti_restore_application_read.v2",
      checkedAt: new Date().toISOString(),
      verifier: { commit: verifierCommit, scraperImageId },
      database,
      evidence: {
        files: evidenceRows.length,
        inventorySha256: sha256(evidenceInventory),
        objectLedgerSha256: sha256(objectLedger),
        objects: objectEvidence,
      },
      records: {
        sources: store.listSources().length,
        captures: captures.length,
        incidents: store.listIncidents().length,
        actorProfiles: store.listActorProfiles().length,
        claims: store.listIntelligenceClaims().length,
        alerts: store.listDwmAlerts().length,
        organizations: store.listOrganizations().length,
      },
    }));
  } finally {
    await store.close();
  }
}

if (import.meta.main) await main();
