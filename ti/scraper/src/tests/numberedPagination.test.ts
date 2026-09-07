import { expect, test } from "bun:test";
import { paginationCursor } from "../api/pagination.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

test("numbered pages select different sources while retaining scope and stable ordering", async () => {
  const store = new InMemoryScraperStore();
  for (let index = 1; index <= 5; index++) store.saveSource({ ...source({ id: `source_${index}`, name: `Feed ${index}` }), tenantId: "tenant_a" });
  store.saveSource({ ...source({ id: "other_source" }), tenantId: "tenant_b" });
  const options = { store, frontier: new FocusedFrontier(), serviceToken: "paging-test" };
  const get = async (page: string) => handleApiRequest(new Request(`http://localhost/v1/intel/source-operations?tenantId=tenant_a&includeCandidates=true&sort=source&dir=asc&limit=2&page=${page}`, { headers: { "x-hanasand-service-token": "paging-test" } }), options);
  const first = await (await get("1")).json() as any;
  const second = await (await get("2")).json() as any;
  const last = await (await get("3")).json() as any;
  expect(first.total).toBe(5);
  expect(first.sources.map((row: any) => row.id)).toEqual(["source_1", "source_2"]);
  expect(second.sources.map((row: any) => row.id)).toEqual(["source_3", "source_4"]);
  expect(last.sources.map((row: any) => row.id)).toEqual(["source_5"]);
  expect(last.nextCursor).toBeUndefined();
  expect((await (await get("4")).json() as any).sources).toEqual([]);
  for (const invalid of ["0", "-1", "1.5", "bad", "Infinity", "9007199254740991"]) expect((await get(invalid)).status).toBe(400);
});

test("page offset uses the effective page size and keeps legacy cursors compatible", () => {
  expect(paginationCursor(new URLSearchParams("page=3"), 25)).toBe("50");
  expect(paginationCursor(new URLSearchParams("cursor=legacy-token"), 25)).toBe("legacy-token");
  expect(() => paginationCursor(new URLSearchParams("page=2&cursor=abc"), 25)).toThrow();
});
