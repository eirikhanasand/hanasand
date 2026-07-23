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
    const metadata = { ...(existing?.metadata ?? {}), ...(source.metadata ?? {}), canaryPortfolio: true };
    const configured = {
      ...(existing ?? {}), ...source,
      tenantId: input.tenantId ?? existing?.tenantId ?? source.tenantId,
      status: "active",
      approvedAt: existing?.approvedAt ?? generatedAt,
      approvedBy: existing?.approvedBy ?? operatorId,
      createdAt: existing?.createdAt ?? source.createdAt,
      lastSeenAt: existing?.lastSeenAt,
      health: existing?.health,
      crawlState: existing?.crawlState,
      scoring: existing?.scoring,
      metadata
    };
    const changed = !existing || needsPortfolioReconciliation(existing, configured, source);
    const next = { ...configured, updatedAt: changed ? generatedAt : existing.updatedAt };
    if (!/^https?:\/\//.test(next.url)) { rejected.push({ sourceId: next.id, reason: "public http(s) only" }); continue; }
    if (existing?.status === "active") {
      if (changed) input.store.saveSource(next);
      alreadyActive.push(next.id);
      continue;
    }
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

function needsPortfolioReconciliation(existing: any, configured: any, source: any) {
  const fields = ["name", "type", "url", "accessMethod", "risk", "trustScore", "language", "crawlFrequencySeconds", "legalNotes", "tags", "catalog", "governance"];
  if (fields.some((field) => source[field] !== undefined && JSON.stringify(existing[field]) !== JSON.stringify(configured[field]))) return true;
  return Object.keys(source.metadata ?? {}).some((field) => JSON.stringify(existing.metadata?.[field]) !== JSON.stringify(configured.metadata?.[field]));
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
