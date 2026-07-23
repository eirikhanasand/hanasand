// @ts-nocheck
import { resolveMitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";

export function expandQueryTerms(query, entityType, actorIdentities) {
  const terms = new Set([query.trim()]);
  if (entityType === "actor" || entityType === "alias" || entityType === "free_text") actorTerms(query, actorIdentities).forEach((term) => terms.add(term));
  if (entityType === "cve" || entityType === "indicator") terms.add(query.trim().toUpperCase());
  return [...terms].filter(Boolean).slice(0, 12);
}

export function reuseTerms(query, entityType, terms, actorIdentities) {
  const resolved = ["actor", "alias", "free_text"].includes(entityType) ? actorTerms(query, actorIdentities) : [];
  return uniq((resolved.length ? resolved : terms).map((term) => term.trim().toLowerCase()));
}

function actorTerms(query, actorIdentities) {
  if (Array.isArray(actorIdentities) && actorIdentities.length) {
    const resolution = resolveMitreActorIdentity(query, actorIdentities);
    if (!resolution.ambiguous && resolution.candidates.length === 1) {
      const identity = resolution.candidates[0].identity;
      return [identity.canonicalName, ...identity.associatedNames];
    }
  }
  return [];
}

export function hour(at) {
  const ts = Date.parse(at);
  return Number.isFinite(ts) ? new Date(Math.floor(ts / 3_600_000) * 3_600_000).toISOString() : "unknown";
}

export function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
