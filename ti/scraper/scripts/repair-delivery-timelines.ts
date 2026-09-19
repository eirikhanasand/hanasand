import { SQL } from "bun";
import { isDeepStrictEqual } from "node:util";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

// Reuse the ingestion rules; retain only source evidence and actual lifecycle events.
class RepairContext extends InMemoryScraperStore {
  load(rows: any[], alerts: any[], deliveries: any[]) {
    this.hydrateWithoutOrganizationWriteGuard(() => {
      for (const row of rows) {
        if (row.source) this.saveSource(row.source);
        if (row.capture) this.hydrateCaptureSnapshot(row.capture);
        if (row.incident) this.saveIncident(row.incident);
      }
      for (const row of alerts) this.saveDwmAlert(row.record);
      for (const row of deliveries) this.hydrateDwmWebhookDeliverySnapshot(row.record);
    });
  }
}
if (!Bun.env.TI_DATABASE_URL && !Bun.env.PGHOST) throw new Error("TI database configuration is required");
const sql = Bun.env.TI_DATABASE_URL ? new SQL(Bun.env.TI_DATABASE_URL, { prepare: false, max: 1 }) : new SQL({
  hostname: Bun.env.PGHOST, port: Number(Bun.env.PGPORT || 5432), username: Bun.env.PGUSER,
  password: Bun.env.PGPASSWORD, database: Bun.env.PGDATABASE, prepare: false, max: 1
});
try {
  const rows = await sql`SELECT t.id, c.record AS capture, i.record AS incident, s.record AS source
    FROM threat_intel.timeliness_records t JOIN threat_intel.captures c ON c.id=t.capture_id
    JOIN threat_intel.incidents i ON i.id=t.incident_id LEFT JOIN threat_intel.sources s ON s.id=t.source_id`;
  const context = new RepairContext();
  context.load(rows, await sql`SELECT record FROM threat_intel.alerts`,
    await sql`SELECT record FROM threat_intel.workflow_records WHERE record_type='dwm_webhook_delivery'`);
  const dryRun = Bun.argv.includes("--dry-run");
  let repaired = 0;
  for (const row of rows) await sql.begin(async tx => {
    const [current] = await tx`SELECT record FROM threat_intel.timeliness_records WHERE id=${row.id} FOR UPDATE`;
    if (!current) return;
    const next = context.reconcileTimelinessRecord(current.record);
    if (isDeepStrictEqual(JSON.parse(JSON.stringify(next)), current.record)) return;
    if (dryRun) { repaired++; return; }
    await tx`UPDATE threat_intel.timeliness_records SET record=${JSON.stringify(next)}::jsonb,
      reported_at=${next.reportedAt ?? null}, first_reported_at=${next.firstReportedAt ?? null},
      publisher_reported_at=${next.publisherReportedAt ?? null}, actor_reported_at=${next.actorReportedAt ?? null},
      victim_reported_at=${next.victimReportedAt ?? null}, first_reported_kind=${next.firstReportedKind ?? null},
      first_reported_provenance=${JSON.stringify(next.firstReportedProvenance ?? null)}::jsonb,
      published_at=${next.publishedAt ?? null}, alert_created_at=${next.alertCreatedAt ?? null}, alerted_at=${next.alertedAt ?? null},
      delivery_attempted_at=${next.deliveryAttemptedAt ?? null}, delivered_at=${next.deliveredAt ?? null}
      WHERE id=${row.id}`;
    if (next.observedAt) await tx`UPDATE threat_intel.captures SET record=jsonb_set(record,'{observedAt}',${JSON.stringify(next.observedAt)}::jsonb)
      WHERE id=${next.captureId} AND record->>'observedAt' IS NULL`;
    // Add the repaired source references to the incident without replacing newer review data.
    if (next.firstReportedAt) await tx`UPDATE threat_intel.incidents SET record=record || ${JSON.stringify({
      reportTimestamps: next.reportTimestamps, firstReportedAt: next.firstReportedAt, reportedAt: next.reportedAt,
      firstReportedKind: next.firstReportedKind, firstReportedProvenance: next.firstReportedProvenance,
      publisherReportedAt: next.publisherReportedAt, publishedAt: next.publishedAt
    })}::jsonb WHERE id=${next.incidentId} AND record->>'firstReportedAt' IS NULL`;
    repaired++;
  });
  console.log(JSON.stringify({ examined: rows.length, repaired, dryRun }));
} finally { await sql.close(); }
