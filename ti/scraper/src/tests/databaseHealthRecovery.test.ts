import { expect, spyOn, test } from "bun:test";
import { PostgresScraperStore } from "../storage/postgresScraperStore.ts";

test("database failure remains unhealthy until a fresh check succeeds, with bounded prompt retries", async () => {
  let now = 100_000, calls = 0, fail = true;
  let complete: (() => void) | undefined;
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  const sql = async () => {
    calls++;
    if (fail) throw new Error("Connection closed");
    await new Promise<void>(resolve => { complete = resolve; });
    return [{ schema_ready: true, migration_ready: true, actor_profile_scope_ready: true }];
  };
  const store = new (PostgresScraperStore as any)(sql, []);
  try {
    expect((await store.databaseHealth()).databaseAvailable).toBe(false);
    fail = false; now += 999;
    expect(store.databaseHealthSnapshot().databaseAvailable).toBe(false);
    expect(calls).toBe(1);
    now++;
    expect(store.databaseHealthSnapshot().databaseAvailable).toBe(false);
    expect(calls).toBe(2);
    now += 2_000;
    expect(store.databaseHealthSnapshot().databaseAvailable).toBe(false);
    expect(calls).toBe(2);
    complete!();
    await store.databaseHealthRefresh;
    expect(store.databaseHealthSnapshot().databaseAvailable).toBe(true);
    now += 1_000;
    store.databaseHealthSnapshot();
    expect(calls).toBe(2);
  } finally { clock.mockRestore(); }
});

test.skipIf(!Bun.env.TI_TEST_DATABASE_URL)("actor health accepts public scope aliases but rejects foreign and missing references", async () => {
  const { SQL } = await import("bun");
  const sql = new SQL(Bun.env.TI_TEST_DATABASE_URL!, { max: 1 });
  const schema = `actor_health_${crypto.randomUUID().replaceAll("-", "")}`;
  const query = (text: string, values: unknown[] = []) => sql.unsafe(text.replaceAll("threat_intel", schema), values);
  const healthSql = (strings: TemplateStringsArray, ...values: unknown[]) => query(
    strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), values,
  );
  const store = new (PostgresScraperStore as any)(healthSql, [{ version: "test" }]);
  try {
    await query(`
      CREATE SCHEMA threat_intel;
      CREATE TABLE threat_intel.schema_migrations (version text);
      INSERT INTO threat_intel.schema_migrations VALUES ('test');
      CREATE TABLE threat_intel.actor_profiles (id text, tenant_id text, record jsonb);
      CREATE TABLE threat_intel.captures (id text, tenant_id text);
      CREATE TABLE threat_intel.actor_aliases (actor_profile_id text, tenant_id text);
      CREATE TABLE threat_intel.evidence_links (subject_type text, subject_id text, capture_id text);
      CREATE TABLE threat_intel.workflow_records (tenant_id text, record jsonb);
      CREATE TABLE threat_intel.actor_profile_scope_lineage (source_actor_profile_id text, scope_key text, target_actor_profile_id text);
      INSERT INTO threat_intel.actor_profiles VALUES ('public', NULL, '{"captureIds":["capture"]}'), ('private', 'customer-a', '{}');
      INSERT INTO threat_intel.captures VALUES ('capture', 'default');
      INSERT INTO threat_intel.actor_aliases VALUES ('public', 'default');
      INSERT INTO threat_intel.evidence_links VALUES ('actor_profile', 'public', 'capture');
      INSERT INTO threat_intel.workflow_records VALUES ('default', '{"subjectType":"actor_profile","subjectId":"public"}'), ('default', '{"subjectType":"actor_profile","subjectId":"historical"}');
      INSERT INTO threat_intel.actor_profile_scope_lineage VALUES ('historical', 'global', 'public');
    `);
    expect(await store.databaseHealth()).toMatchObject({ ok: true, actorProfileScopeReady: true });
    for (const [bad, repaired] of [
      ["UPDATE threat_intel.captures SET tenant_id='customer-a'", "UPDATE threat_intel.captures SET tenant_id='default'"],
      ["UPDATE threat_intel.actor_aliases SET tenant_id='customer-a'", "UPDATE threat_intel.actor_aliases SET tenant_id='default'"],
      ["UPDATE threat_intel.evidence_links SET subject_id='missing'", "UPDATE threat_intel.evidence_links SET subject_id='public'"],
      ["UPDATE threat_intel.workflow_records SET tenant_id='customer-a'", "UPDATE threat_intel.workflow_records SET tenant_id='default'"],
      ["UPDATE threat_intel.actor_profile_scope_lineage SET target_actor_profile_id='private'", "UPDATE threat_intel.actor_profile_scope_lineage SET target_actor_profile_id='public'"],
    ]) {
      await query(bad!);
      expect(await store.databaseHealth()).toMatchObject({ ok: false, databaseAvailable: true, actorProfileScopeReady: false });
      await query(repaired!);
      expect((await store.databaseHealth()).ok).toBe(true);
    }
    await query("UPDATE threat_intel.actor_profile_scope_lineage SET scope_key='tenant:' || md5('default')");
    expect((await store.databaseHealth()).ok).toBe(true);
    await query(`
      UPDATE threat_intel.actor_profiles SET tenant_id='default' WHERE id='public';
      UPDATE threat_intel.captures SET tenant_id=NULL;
      UPDATE threat_intel.actor_aliases SET tenant_id=NULL;
      UPDATE threat_intel.workflow_records SET tenant_id=NULL;
    `);
    expect((await store.databaseHealth()).ok).toBe(true);
    await query("UPDATE threat_intel.actor_profile_scope_lineage SET scope_key='global'");
    expect((await store.databaseHealth()).ok).toBe(true);
  } finally {
    await query("DROP SCHEMA IF EXISTS threat_intel CASCADE");
    await sql.close();
  }
});
