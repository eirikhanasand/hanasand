import { createHash } from "node:crypto";
import { normalizeActorLabel } from "./mitreActorCatalog.ts";

const CURRENT_WINDOW_MS = 90 * 86_400_000;
const LOCATION_FRESHNESS_MS = 7 * 86_400_000;
const CLOCK_SKEW_MS = 24 * 3_600_000;
const UNRELIABLE = /\b(?:fake group|unreliable|cannot be verified|remove(?:d)? entries)\b/i;

export type RansomwareOperationIdentity = {
  id: string;
  catalogId: "ransomware-live-current-operations";
  externalId: string;
  canonicalName: string;
  normalizedCanonicalName: string;
  associatedNames: string[];
  relatedOperationNames: string[];
  status: "current";
  aptNumberDesignationPresent: false;
  identityKind: "ransomware_operation";
  createdAt: string;
  modifiedAt: string;
  sourceUrl: string;
  catalogVersion: string;
  catalogModifiedAt: string;
  bundleSha256: string;
  retrievedAt: string;
  currentEvidence: {
    recentClaimCount: number;
    latestClaimPublishedAt: string;
    liveLocationCount: number;
    latestLocationCheckedAt: string;
  };
};

export type RansomwareOperationCatalogSnapshot = {
  schemaVersion: "ti.actor_identity_catalog.v1";
  catalogId: "ransomware-live-current-operations";
  catalogName: "Ransomware.live current operations";
  catalogVersion: string;
  catalogModifiedAt: string;
  sourceUrl: string;
  bundleId: string;
  bundleSha256: string;
  retrievedAt: string;
  activityWatermarkAt: string;
  evidenceContentHashes: string[];
  counts: {
    totalIdentityCount: number;
    currentIdentityCount: number;
    deprecatedIdentityCount: 0;
    revokedIdentityCount: 0;
    aptNumberDesignationPresentCount: 0;
    associatedNameOccurrenceCount: number;
    distinctAssociatedNameCount: number;
    distinctLookupLabelCount: number;
    aliasCollisionCount: number;
    sourceGroupCount: number;
    recentClaimGroupCount: number;
    liveLocationGroupCount: number;
    unreliableExcludedCount: number;
    unmatchedRecentClaimGroupCount: number;
  };
  identities: RansomwareOperationIdentity[];
  aliasCollisions: Array<{ normalizedLabel: string; label: string; externalIds: string[] }>;
  exclusions: {
    unreliableGroupNames: string[];
    recentClaimNamesMissingFromGroupCatalog: string[];
  };
};

export function parseCurrentRansomwareOperations(
  groupsBody: string,
  victimsBody: string,
  input: { retrievedAt: string; sourceUrl?: string; minimumCurrentIdentities?: number }
): RansomwareOperationCatalogSnapshot {
  const groups = array(JSON.parse(groupsBody), "group catalog");
  const victims = array(JSON.parse(victimsBody), "victim feed");
  const retrievedAt = iso(input.retrievedAt, "retrieval time");
  const retrievedMs = Date.parse(retrievedAt);
  const sourceLatestClaimMs = Math.max(...victims.map(claimTime).filter(Number.isFinite));
  if (!Number.isFinite(sourceLatestClaimMs)) throw new Error("Ransomware operation feed contains no dated claims.");
  if (sourceLatestClaimMs > retrievedMs + CLOCK_SKEW_MS) throw new Error("Ransomware operation feed timestamp is implausibly ahead of retrieval time.");
  const latestClaimMs = Math.min(sourceLatestClaimMs, retrievedMs);
  const recentClaims = new Map<string, { name: string; count: number; latestAt: string }>();
  for (const victim of victims) {
    const sourcePublishedMs = claimTime(victim), publishedMs = Math.min(sourcePublishedMs, retrievedMs);
    const name = text(victim.group_name);
    if (!name || !Number.isFinite(publishedMs) || publishedMs < latestClaimMs - CURRENT_WINDOW_MS) continue;
    const key = normalizeActorLabel(name);
    const current = recentClaims.get(key);
    if (!current) recentClaims.set(key, { name, count: 1, latestAt: new Date(publishedMs).toISOString() });
    else {
      current.count++;
      if (publishedMs > Date.parse(current.latestAt)) current.latestAt = new Date(publishedMs).toISOString();
    }
  }

  const bundleSha256 = createHash("sha256").update(groupsBody).update("\0").update(victimsBody).digest("hex");
  const sourceUrl = input.sourceUrl ?? "https://data.ransomware.live/groups.json";
  const groupNames = new Set(groups.map((group) => normalizeActorLabel(text(group.name))).filter(Boolean));
  const unreliableGroupNames: string[] = [];
  let liveLocationGroupCount = 0;
  const identities = groups.flatMap((group): RansomwareOperationIdentity[] => {
    const canonicalName = text(group.name);
    if (!canonicalName) return [];
    if (UNRELIABLE.test(text(group.description))) {
      unreliableGroupNames.push(canonicalName);
      return [];
    }
    const liveLocations = array(group.locations ?? [], `${canonicalName} locations`).filter((location) => liveLocation(location, retrievedMs));
    if (liveLocations.length) liveLocationGroupCount++;
    const claims = recentClaims.get(normalizeActorLabel(canonicalName));
    if (!claims || !liveLocations.length) return [];
    const latestLocationCheckedAt = new Date(Math.min(retrievedMs, Math.max(...liveLocations.map(locationTime)))).toISOString();
    const createdAt = Number.isFinite(Date.parse(text(group.date))) ? new Date(Date.parse(text(group.date))).toISOString() : claims.latestAt;
    const modifiedAt = new Date(Math.max(Date.parse(claims.latestAt), Date.parse(latestLocationCheckedAt))).toISOString();
    const associatedNames = uniqueCaseInsensitive(values(group.altname));
    const relatedOperationNames = uniqueCaseInsensitive(values(group.lineage));
    const slug = normalizeActorLabel(canonicalName).replace(/\s+/g, "-");
    return [{
      id: `ransomware-live-current-operations:${slug}`,
      catalogId: "ransomware-live-current-operations",
      externalId: `ransomwarelive:${slug}`,
      canonicalName,
      normalizedCanonicalName: normalizeActorLabel(canonicalName),
      associatedNames,
      relatedOperationNames,
      status: "current",
      aptNumberDesignationPresent: false,
      identityKind: "ransomware_operation",
      createdAt,
      modifiedAt,
      sourceUrl,
      catalogVersion: new Date(latestClaimMs).toISOString().slice(0, 10),
      catalogModifiedAt: new Date(Math.max(latestClaimMs, Date.parse(latestLocationCheckedAt))).toISOString(),
      bundleSha256,
      retrievedAt,
      currentEvidence: { recentClaimCount: claims.count, latestClaimPublishedAt: claims.latestAt, liveLocationCount: liveLocations.length, latestLocationCheckedAt }
    }];
  }).sort((left, right) => left.normalizedCanonicalName.localeCompare(right.normalizedCanonicalName));

  const minimum = input.minimumCurrentIdentities ?? 25;
  if (identities.length < minimum) throw new Error(`Ransomware operation catalog is incomplete: ${identities.length} current identities, expected at least ${minimum}.`);
  const aliasCollisions = collisions(identities);
  const associatedNames = identities.flatMap((identity) => identity.associatedNames);
  const missingRecent = [...recentClaims.values()].filter((claim) => !groupNames.has(normalizeActorLabel(claim.name))).map((claim) => claim.name).sort();
  const catalogModifiedAt = identities.map((identity) => identity.catalogModifiedAt).sort().at(-1)!;
  return {
    schemaVersion: "ti.actor_identity_catalog.v1",
    catalogId: "ransomware-live-current-operations",
    catalogName: "Ransomware.live current operations",
    catalogVersion: new Date(latestClaimMs).toISOString().slice(0, 10),
    catalogModifiedAt,
    sourceUrl,
    bundleId: `ransomware-live-current-operations:${bundleSha256}`,
    bundleSha256,
    retrievedAt,
    activityWatermarkAt: new Date(latestClaimMs).toISOString(),
    evidenceContentHashes: [createHash("sha256").update(groupsBody).digest("hex"), createHash("sha256").update(victimsBody).digest("hex")],
    counts: {
      totalIdentityCount: identities.length,
      currentIdentityCount: identities.length,
      deprecatedIdentityCount: 0,
      revokedIdentityCount: 0,
      aptNumberDesignationPresentCount: 0,
      associatedNameOccurrenceCount: associatedNames.length,
      distinctAssociatedNameCount: new Set(associatedNames.map(normalizeActorLabel)).size,
      distinctLookupLabelCount: new Set(identities.flatMap((identity) => [identity.canonicalName, ...identity.associatedNames]).map(normalizeActorLabel)).size,
      aliasCollisionCount: aliasCollisions.length,
      sourceGroupCount: groups.length,
      recentClaimGroupCount: recentClaims.size,
      liveLocationGroupCount,
      unreliableExcludedCount: unreliableGroupNames.length,
      unmatchedRecentClaimGroupCount: missingRecent.length
    },
    identities,
    aliasCollisions,
    exclusions: { unreliableGroupNames: unreliableGroupNames.sort(), recentClaimNamesMissingFromGroupCatalog: missingRecent }
  };
}

function liveLocation(location: any, retrievedMs: number): boolean {
  const checkedMs = locationTime(location);
  const status = Number(location?.http?.status);
  return location?.enabled === true && location?.available === true && status >= 200 && status < 400
    && Number.isFinite(checkedMs) && checkedMs >= retrievedMs - LOCATION_FRESHNESS_MS && checkedMs <= retrievedMs + CLOCK_SKEW_MS;
}

function locationTime(location: any): number {
  return Date.parse(text(location?.lastscrape) || text(location?.http?.fetched_at) || text(location?.updated));
}

function claimTime(victim: any): number {
  return Date.parse(text(victim?.published) || text(victim?.discovered));
}

function collisions(identities: RansomwareOperationIdentity[]) {
  const labels = new Map<string, { label: string; externalIds: Set<string> }>();
  for (const identity of identities) for (const label of [identity.canonicalName, ...identity.associatedNames]) {
    const key = normalizeActorLabel(label);
    const row = labels.get(key) ?? { label, externalIds: new Set<string>() };
    row.externalIds.add(identity.externalId);
    labels.set(key, row);
  }
  return [...labels.entries()].filter(([, row]) => row.externalIds.size > 1).map(([normalizedLabel, row]) => ({ normalizedLabel, label: row.label, externalIds: [...row.externalIds].sort() })).sort((a, b) => a.normalizedLabel.localeCompare(b.normalizedLabel));
}

function array(value: unknown, field: string): any[] {
  if (!Array.isArray(value)) throw new Error(`Ransomware operation ${field} is not an array.`);
  return value;
}

function values(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? [text(value)] : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function iso(value: unknown, field: string): string {
  const parsed = Date.parse(text(value));
  if (!Number.isFinite(parsed)) throw new Error(`Ransomware operation catalog has an invalid ${field}.`);
  return new Date(parsed).toISOString();
}

function uniqueCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeActorLabel(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
