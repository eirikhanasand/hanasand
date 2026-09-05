import { expect, test } from "bun:test";
import { PostgresScraperStore } from "../storage/postgresScraperStore.ts";

test("source summaries use the supplied timeout transaction and bounded latest-health lookups", async () => {
  let query = "";
  let parameters: unknown[] = [];
  const transaction = { unsafe: async (sql: string, values: unknown[]) => {
    query = sql;
    parameters = values;
    return [{ summary: { sourceCount: 2, failedSourceCount: 1 } }];
  } };
  const store = Object.create(PostgresScraperStore.prototype);
  store.sql = { unsafe: () => { throw new Error("escaped the timeout transaction"); } };
  const result = await store.querySourceOperationalSummary({ tenantId: "tenant-test", generatedAt: "2026-09-05T00:00:00Z" }, transaction);
  expect(result.summary).toEqual({ sourceCount: 2, failedSourceCount: 1 });
  expect(parameters).toEqual(["tenant-test"]);
  expect(query).toContain("LEFT JOIN LATERAL");
  expect(query).toContain("LIMIT 1");
  expect(query).not.toContain("threat_intel.captures");
});
