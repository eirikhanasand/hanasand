// @ts-nocheck
import { actorAliasesFor, ACTOR_ALIAS_RECORDS } from "../pipeline/actorAliases.ts";

export function expandQueryTerms(query, entityType, actorIdentities) {
  const terms = new Set([query.trim()]);
  const record = Array.isArray(actorIdentities) ? undefined : ACTOR_ALIAS_RECORDS.find((r) => r.canonical.toLowerCase() === query.trim().toLowerCase() || r.aliases.includes(query.trim().toLowerCase()));
  if ((entityType === "actor" || entityType === "alias" || entityType === "free_text") && record) [record.canonical, ...actorAliasesFor(record.canonical)].forEach((t) => terms.add(t));
  if (entityType === "cve" || entityType === "indicator") terms.add(query.trim().toUpperCase());
  return [...terms].filter(Boolean).slice(0, 12);
}

export function reuseTerms(query, entityType, terms, actorIdentities) {
  const record = Array.isArray(actorIdentities) ? undefined : ACTOR_ALIAS_RECORDS.find((r) => r.canonical.toLowerCase() === query.trim().toLowerCase() || r.aliases.includes(query.trim().toLowerCase()) || terms.some((t) => r.aliases.includes(t.toLowerCase())));
  return record && ["actor", "alias", "free_text"].includes(entityType) ? [record.canonical, ...actorAliasesFor(record.canonical)].map((t) => t.toLowerCase()).sort() : uniq(terms.map((t) => t.trim().toLowerCase()));
}

export function hour(at) {
  const ts = Date.parse(at);
  return Number.isFinite(ts) ? new Date(Math.floor(ts / 3_600_000) * 3_600_000).toISOString() : "unknown";
}

export function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
