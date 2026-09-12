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
