import { createHash } from 'node:crypto';
import { PostgresScraperStore } from '../src/storage/postgresScraperStore.ts';
import { publicSourceReferenceUrl, zonedSourceTimestamp } from '../src/pipeline/sourceFieldReportTimestamp.ts';

// Operator-reviewed evidence, with the retrieved documents retained beside the manifest.
const manifest = await Bun.file(process.argv[2]).json();
const apply = process.argv[3] === '--apply';
if (process.argv[3] && !apply) throw Error('Use --apply after reviewing the dry run.');
const store = await PostgresScraperStore.create({ hydrate: false, deferStartupChecks: true, runMaintenanceMigrations: false });
try {
  const records = new Map((await store.queryDeliveryRecords()).map((r: any) => [r.id, r]));
  const seen = new Set<string>();
  const ready: any[] = [];
  for (const entry of manifest.entries) {
    const { id, reference: ref } = entry;
    const row: any = records.get(id);
    const doc = manifest.documents[ref.contentSha256];
    if (seen.has(id) || !row || row.captureId !== ref.captureId || row.sourceId !== ref.sourceId || ref.incidentId !== id
      || ref.role !== 'publisher' || ref.extractionMethod !== 'source_field' || !ref.evidencePath
      || !publicSourceReferenceUrl(ref.referenceUrl) || !zonedSourceTimestamp(ref.timestamp)
      || Date.parse(ref.timestamp) > Date.parse(row.collectedAt)
      || !doc || doc.url !== ref.referenceUrl || !ref.quote || !doc.text.includes(ref.quote)
      || createHash('sha256').update(doc.text).digest('hex') !== ref.contentSha256) throw Error(`Invalid evidence: ${id}`);
    seen.add(id);
    if (!row.firstReportedAt) ready.push(entry);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', verified: ready.length }));
  // Validate the entire batch before writing any result; existing evidence is never replaced.
  if (apply) for (const { id, reference } of ready) {
    await store.finishDeliveryRecovery(id, { status: 'resolved', modelUsed: false, reason: 'Publication evidence verified against the matching public source record.', reviewedBy: 'Codex' }, reference);
  }
  console.log(JSON.stringify({ imported: apply ? ready.length : 0 }));
} finally {
  await store.close();
}
