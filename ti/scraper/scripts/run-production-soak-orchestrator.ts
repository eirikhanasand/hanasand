import { evaluateLiveSearchSoak } from "../src/ops/liveSearch.ts";
import { aggregateSamples } from "./productionSoakAggregate.ts";
import { numberEnv, querySet } from "./productionSoakConfig.ts";
import { probeQuery } from "./productionSoakProbe.ts";
import { buildTrendDeltas } from "./productionSoakTrend.ts";
import type { QuerySample } from "./productionSoakTypes.ts";
import { unique } from "./productionSoakUtils.ts";

const scraperBase = process.env.TI_SCRAPER_INTERNAL_BASE ?? "http://ti-scraper:8097";
const publicApiBase = process.env.PUBLIC_TI_API_BASE_URL ?? "https://api.hanasand.com/api/ti/search";
const queries = querySet();
const durationMinutes = numberEnv("TI_SOAK_DURATION_MINUTES", 24 * 60);
const intervalSeconds = numberEnv("TI_SOAK_INTERVAL_SECONDS", 60);
const startedAt = Date.now();
const seen = new Map<string, QuerySample["status"]>();
const samples: QuerySample[] = [];

do {
  for (const query of queries) {
    const sample = await probeQuery(query, seen.get(query), { scraperBase, publicApiBase });
    samples.push(sample);
    seen.set(query, sample.status);
    console.log(JSON.stringify({ event: "production_soak.query", ...sample }));
  }
  if (Date.now() - startedAt >= durationMinutes * 60_000) break;
  await Bun.sleep(intervalSeconds * 1000);
} while (true);

const durationHours = Math.max(durationMinutes / 60, (Date.now() - startedAt) / 3_600_000);
const report = evaluateLiveSearchSoak(aggregateSamples(samples, durationHours));
const runIds = unique(samples.map((sample) => sample.runId).filter(Boolean) as string[]);
const partialToReady = samples.filter((sample) => sample.pollDelta === "partial_to_ready").length;
const rollbackTriggers = unique(samples.flatMap((sample) => sample.rollbackTriggers));

console.log(JSON.stringify({
  event: "production_soak.summary",
  ok: report.ok,
  status: report.status,
  queries,
  runIds,
  partialToReady,
  trendDeltas: buildTrendDeltas(samples),
  rollbackTriggers,
  summary: report.summary
}));

if (!report.ok) process.exitCode = report.status === "rollback" ? 2 : 1;
