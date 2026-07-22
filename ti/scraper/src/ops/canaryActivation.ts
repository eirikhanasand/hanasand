// @ts-nocheck
import { nowIso } from "../utils.ts";
import type { CanaryActivationResult, CanaryDeactivationResult } from "./canaryCollectionTypes.ts";
import { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "./canaryPortfolio.ts";

export function activatePublicCanarySources(input: any): CanaryActivationResult {
  const generatedAt = input.now ?? nowIso(), operatorId = input.operatorId ?? "canary-operator";
  const activated: any[] = [], alreadyActive: string[] = [], rejected: any[] = [];
  for (const source of input.portfolio ?? PUBLIC_CANARY_SOURCE_PORTFOLIO) {
    const existing = input.store.getSource?.(source.id);
    const canonical = input.store.listSources().find((record: any) => record.id !== source.id && record.type === source.type && normalizedUrl(record.url) === normalizedUrl(source.url));
    if (canonical) { alreadyActive.push(canonical.id); continue; }
    if (["retired", "rejected", "disabled"].includes(existing?.status)) { rejected.push({ sourceId: source.id, reason: `source is ${existing.status}` }); continue; }
    const next = { ...(existing ?? source), tenantId: input.tenantId ?? source.tenantId, status: "active", approvedAt: existing?.approvedAt ?? generatedAt, approvedBy: existing?.approvedBy ?? operatorId, updatedAt: generatedAt, metadata: { ...(existing?.metadata ?? source.metadata), canaryPortfolio: true } };
    if (!/^https?:\/\//.test(next.url)) { rejected.push({ sourceId: next.id, reason: "public http(s) only" }); continue; }
    if (existing?.status === "active") { alreadyActive.push(next.id); continue; }
    input.store.saveSource(next);
    activated.push({ sourceId: next.id, sourceName: next.name, from: existing?.status ?? source.status, to: "active" });
  }
  return { generatedAt, operatorId, activated, alreadyActive, rejected };
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return String(value ?? "").trim().replace(/\/+$/, "").toLowerCase();
  }
}

export function pausePublicCanarySources(input: any): CanaryDeactivationResult {
  const generatedAt = input.now ?? nowIso(), operatorId = input.operatorId ?? "canary-operator", paused: any[] = [], alreadyInactive: string[] = [];
  for (const source of input.store.listSources().filter((s: any) => s.metadata?.canaryPortfolio)) {
    if (!["active", "degraded", "probation"].includes(source.status)) { alreadyInactive.push(source.id); continue; }
    const updated = { ...source, status: "paused", updatedAt: generatedAt, crawlState: { ...(source.crawlState ?? {}), nextEligibleAt: undefined } };
    input.store.saveSource(updated); paused.push({ sourceId: source.id, sourceName: source.name, from: source.status, to: "paused" });
  }
  return { generatedAt, operatorId, paused, alreadyInactive };
}
