import { expect, test } from "bun:test";
import { rankedSources } from "../planner/plannerSources.ts";
const at = "2026-09-12T12:00:00Z";
const source = (id: string, extra: any = {}) => ({ id, name: id, url: `https://${id}.example`, type: "rss", trustScore: 0.5, ...extra });

test("ranking preserves availability, relevance, trust and deterministic ties without changing inputs", () => {
  const rows = [source("b"), source("waiting", { trustScore: 1, crawlState: { backoffUntil: "2026-09-12T13:00:00Z" } }),
    source("match", { metadata: { topic: "APT29" } }), source("a"), source("trusted", { trustScore: 0.9 })];
  const original = [...rows];
  expect(rankedSources(rows, ["APT29"], at).map((s) => s.id)).toEqual(["match", "trusted", "a", "b", "waiting"]);
  expect(rows).toEqual(original);
  expect(rankedSources(rows, ["APT29"], at)[0]).toBe(rows[2]);
});

test("large metadata is serialized once per source and changes are visible on the next ranking", () => {
  let serialized = 0;
  const rows = Array.from({ length: 200 }, (_, i) => source(`source-${i}`, {
    trustScore: (i * 17 % 100) / 100,
    metadata: { toJSON() { serialized++; return { text: "ordinary evidence ".repeat(1000) }; } }
  }));
  rankedSources(rows, ["APT29"], at);
  expect(serialized).toBe(rows.length);
  const changed = [source("a"), source("b")];
  expect(rankedSources(changed, ["apt29"], at)[0].id).toBe("a");
  changed[1].metadata = { topic: "APT29" };
  expect(rankedSources(changed, ["apt29"], at)[0].id).toBe("b");
});
