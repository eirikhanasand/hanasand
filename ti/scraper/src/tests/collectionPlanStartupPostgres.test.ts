import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { PostgresScraperStore } from "../storage/postgresScraperStore.ts";

const databaseUrl = Bun.env.TI_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("collection plan startup", () => {
  let admin: SQL;
  beforeAll(async () => {
    const bootstrap = await PostgresScraperStore.create({ databaseUrl, hydrate: false, deferStartupChecks: true });
    await bootstrap.close();
    admin = new SQL(databaseUrl!);
  });
  afterAll(async () => { await admin?.close(); });

  test("loads recent, active and scheduled plans without reviving completed history", async () => {
    const originalLimit = Bun.env.TI_COLLECTION_PLAN_HYDRATION_LIMIT;
    Bun.env.TI_COLLECTION_PLAN_HYDRATION_LIMIT = "2";
    const now = Date.now();
    const day = 86_400_000;
    const fixtures = [
      { id: "old-completed", status: "completed", age: 60 },
      { id: "old-queued", status: "queued", age: 60 },
      { id: "old-running", status: "running", age: 60 },
      { id: "old-failed", status: "failed", age: 60 },
      { id: "future-recent", status: "completed", age: 5, next: 1 },
      { id: "future-old", status: "completed", age: 60, next: 1 },
      { id: "past-recent", status: "completed", age: 5, next: -1 },
      { id: "latest-a", status: "completed", age: 1 },
      { id: "latest-b", status: "completed", age: 1 },
      { id: "latest-c", status: "completed", age: 1 },
    ];
    try {
      for (const fixture of fixtures) {
        const createdAt = new Date(now - fixture.age * day).toISOString();
        const record = { ...fixture, createdAt, updatedAt: createdAt,
          ...(fixture.next === undefined ? {} : { nextEligibleAt: new Date(now + fixture.next * day).toISOString() }) };
        await admin.unsafe(`INSERT INTO threat_intel.workflow_records (record_type, id, created_at, updated_at, record)
          VALUES ('collection_plan', $1, $2, $2, $3::text::jsonb)`, [fixture.id, createdAt, JSON.stringify(record)]);
      }
      for (const bounded of [false, true]) {
        const restarted = await PostgresScraperStore.create({ databaseUrl, readOnly: true,
          deferHighVolumeHydration: bounded, deferStartupChecks: true });
        try {
          expect(restarted.listPlans().map(plan => plan.id).sort()).toEqual([
            ...(!bounded ? ["future-old"] : []), "future-recent", "latest-b", "latest-c",
            "old-failed", "old-queued", "old-running"
          ]);
        } finally { await restarted.close(); }
      }
      const [count] = await admin`SELECT count(*)::int AS count FROM threat_intel.workflow_records WHERE record_type = 'collection_plan'`;
      expect(count.count).toBe(fixtures.length);
    } finally {
      for (const fixture of fixtures) {
        await admin`DELETE FROM threat_intel.workflow_records WHERE record_type = 'collection_plan' AND id = ${fixture.id}`;
      }
      if (originalLimit === undefined) delete Bun.env.TI_COLLECTION_PLAN_HYDRATION_LIMIT;
      else Bun.env.TI_COLLECTION_PLAN_HYDRATION_LIMIT = originalLimit;
    }
  });

});
