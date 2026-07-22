import type { QuerySample } from "./productionSoakTypes.ts";
import { delta } from "./productionSoakConfig.ts";
import { cursorFrom, hasPartial, hasRunId, runIdFrom } from "./productionSoakIds.ts";
import { buildRollbackTriggers, coveragePercent, cpuPct, memoryGb, statusFrom } from "./productionSoakResponse.ts";
import { asRecord, parseJson, readBool, readNumber } from "./productionSoakUtils.ts";

export async function probeQuery(query: string, previousStatus: QuerySample["status"] | undefined, config: { scraperBase: string; publicApiBase: string }): Promise<QuerySample> {
  const started = Date.now();
  const [search, frontier, resource, api] = await Promise.all([
    fetchJson(`${config.scraperBase}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor`),
    fetchJson(`${config.scraperBase}/v1/frontier/status?q=${encodeURIComponent(query)}`),
    fetchJson(`${config.scraperBase}/v1/ops/resource-snapshot`),
    fetchJson(config.publicApiBase, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) })
  ]);
  const searchJson = asRecord(search.json);
  const apiJson = asRecord(api.json);
  const status = statusFrom(searchJson, apiJson);
  const queueAge = readNumber(asRecord(asRecord(frontier.json)?.scheduler)?.queueAgeSeconds, "p95") ?? readNumber(asRecord(frontier.json)?.scheduler, "queueAgeP95Seconds") ?? 0;
  const restrictedKillSwitchActive = readBool(asRecord(searchJson?.restrictedMetadata), "killSwitchActive")
    || readBool(asRecord(searchJson?.restricted_metadata), "killSwitchActive")
    || readBool(asRecord(searchJson?.restrictedMetadata), "kill_switch_active")
    || false;
  const memoryRssGb = memoryGb(resource.json);
  const cpuPercent = cpuPct(resource.json);
  const publicApiOk = api.status >= 200 && api.status < 300 && hasRunId(apiJson) && hasPartial(apiJson);
  const rejectedUnsafeActions = readNumber(searchJson, "rejectedUnsafeActions") ?? 0;
  const rollbackTriggers = buildRollbackTriggers(search.status, publicApiOk, memoryRssGb, cpuPercent, queueAge, rejectedUnsafeActions, restrictedKillSwitchActive);
  return {
    query,
    ok: search.status >= 200 && search.status < 300 && publicApiOk && rollbackTriggers.length === 0,
    runId: runIdFrom(searchJson) ?? runIdFrom(apiJson),
    cursor: cursorFrom(searchJson) ?? cursorFrom(apiJson),
    status,
    previousStatus,
    pollDelta: delta(previousStatus, status),
    sourceCoveragePercent: coveragePercent(searchJson),
    queueAgeP95Seconds: queueAge,
    memoryRssGb,
    cpuPercent,
    rejectedUnsafeActions,
    restrictedKillSwitchActive,
    publicApiOk,
    rollbackTriggers,
    latencyMs: Date.now() - started
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; json?: unknown }> {
  try {
    const response = await fetch(url, init);
    const text = await response.text();
    return { status: response.status, json: parseJson(text) ?? { body: text } };
  } catch (error) {
    return { status: 599, json: { error: error instanceof Error ? error.message : String(error) } };
  }
}
