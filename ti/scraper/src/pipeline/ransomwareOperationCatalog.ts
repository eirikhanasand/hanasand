import { createHash } from "node:crypto";
import { actorLookupPolicy, normalizeActorLabel, type ActorIdentityRecord } from "./mitreActorCatalog.ts";

const CURRENT_WINDOW_MS = 90 * 86_400_000;
const LOCATION_FRESHNESS_MS = 7 * 86_400_000;
const UNRELIABLE = /\b(?:fake group|unreliable|cannot be verified|remove(?:d)? entries)\b/i;

export type RansomwareOperationActivityKind = "recent_public_claim" | "reachable_publication_location";

export type RansomwareOperationCurrentActivityEvidence = {
  kind: RansomwareOperationActivityKind;
  observedAt: string;
  count: number;
  contentHash: string;
};

export type RansomwareOperationIdentity = ActorIdentityRecord & {
  catalogId: "ransomware-live-current-operations";
  status: "current" | "retired";
  lookupPolicy: "text_safe" | "structured_only";
  identityKind: "ransomware_operation";
  relatedOperationNames: string[];
  lineageRelations: Array<{ relationship: "evolved_from"; name: string; targetIdentityId?: string }>;
  activityEvidence: Array<RansomwareOperationCurrentActivityEvidence>;
  descriptionAvailable: boolean;
  descriptionSha256?: string;
  sourceFirstReportedAt?: string;
  operationKinds: string[];
};

export type RansomwareOperationCatalogSnapshot = {
  schemaVersion: "ti.actor_identity_catalog.v1";
  catalogId: "ransomware-live-current-operations";
  catalogName: "Ransomware.live community group catalog";
  catalogVersion: string;
  catalogModifiedAt?: string;
  sourceUrl: string;
  bundleId: string;
  bundleSha256: string;
  retrievedAt: string;
  activityWatermarkAt?: string;
  activityCurrentnessWatermarkAt?: string;
  evidenceContentHashes: string[];
  counts: {
    totalIdentityCount: number;
    currentIdentityCount: number;
    retiredIdentityCount: number;
    deprecatedIdentityCount: 0;
    revokedIdentityCount: 0;
    aptNumberDesignationPresentCount: 0;
    associatedNameOccurrenceCount: number;
    distinctAssociatedNameCount: number;
    distinctLookupLabelCount: number;
    aliasCollisionCount: number;
    sourceGroupCount: number;
    sourceDescriptionGroupCount: number;
    sourceVictimHistoryGroupCount: number;
    registeredDescriptionIdentityCount: number;
    registeredVictimHistoryIdentityCount: number;
    historicalDescriptionIdentityCount: number;
    historicalVictimHistoryIdentityCount: number;
    recentClaimGroupCount: number;
    recentClaimIdentityCount: number;
    reachableLocationGroupCount: number;
    liveLocationGroupCount: number;
    recentClaimOnlyIdentityCount: number;
    liveLocationOnlyIdentityCount: number;
    bothCurrentEvidenceIdentityCount: number;
    historicalIdentityCount: number;
    unreliableExcludedCount: number;
    invalidIdentityLabelExcludedCount: number;
    generatedIdentityLabelExcludedCount: number;
    invalidAliasLabelExcludedCount: number;
    resolvedRecentClaimAliasCount: number;
    unmatchedRecentClaimGroupCount: number;
    identityActivityEvidenceCount: number;
    sourceVictimRecordCount: number;
    restrictedLocatorFieldCount: number;
    futureTimestampAnomalyCount: number;
  };
  identities: RansomwareOperationIdentity[];
  aliasCollisions: Array<{ normalizedLabel: string; label: string; externalIds: string[] }>;
  exclusions: {
    unreliableGroupNames: string[];
    invalidIdentityLabels: string[];
    generatedIdentityLabels: string[];
    invalidAliasLabels: string[];
    recentClaimAliasesResolvedByUniqueLocation: Array<{ claimName: string; canonicalName: string }>;
    recentClaimNamesMissingFromGroupCatalog: string[];
  };
  lifecycle: {
    recentClaimOnlyGroupNames: string[];
    liveLocationOnlyGroupNames: string[];
    bothCurrentEvidenceGroupNames: string[];
    historicalGroupNames: string[];
  };
  timestampAnomalies: Array<{
    actorIdentityId?: string;
    groupName: string;
    field: "group.date" | "victim.published" | "group.location.checked";
    sourceTimestamp: string;
    anomaly: "future_source_timestamp";
    currentnessEligible: false;
  }>;
  governance: {
    identityRegistrationSource: "tier_2_community_group_catalog";
    activityEvidenceSource: "community_public_claim_and_reachability_indexes";
    excludedDataClasses: string[];
  };
};

type GroupDefinition = {
  group: any;
  id: string;
  externalId: string;
  canonicalName: string;
  normalizedCanonicalName: string;
  associatedNames: string[];
  relatedOperationNames: string[];
  descriptionAvailable: boolean;
  descriptionSha256?: string;
  sourceFirstReportedAt?: string;
  operationKinds: string[];
};

type ClaimSummary = {
  name: string;
  count: number;
  latestAt: string;
  recentCount: number;
  latestRecentAt?: string;
  locatorHosts: string[];
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
  const sourceClaimTimes = victims.map(claimTime).filter(Number.isFinite);
  const sourceLatestClaimMs = Math.max(...sourceClaimTimes);
  if (!Number.isFinite(sourceLatestClaimMs)) throw new Error("Ransomware operation feed contains no dated claims.");

  const claims = new Map<string, ClaimSummary>();
  for (const victim of victims) {
    const publishedMs = claimTime(victim);
    const name = text(victim.group_name);
    if (!name || !Number.isFinite(publishedMs)) continue;
    const key = normalizeActorLabel(name);
    const current = claims.get(key) ?? { name, count: 0, latestAt: new Date(publishedMs).toISOString(), recentCount: 0, locatorHosts: [] };
    current.count++;
    current.locatorHosts = uniqueCaseInsensitive([...current.locatorHosts, publicHost(victim.post_url)]).filter(Boolean);
    if (publishedMs > Date.parse(current.latestAt)) current.latestAt = new Date(publishedMs).toISOString();
    if (publishedMs >= retrievedMs - CURRENT_WINDOW_MS && publishedMs <= retrievedMs) {
      current.recentCount++;
      if (!current.latestRecentAt || publishedMs > Date.parse(current.latestRecentAt)) current.latestRecentAt = new Date(publishedMs).toISOString();
    }
    claims.set(key, current);
  }
  const sourceRecentClaimGroupCount = [...claims.values()].filter((claim) => claim.recentCount > 0).length;

  const groupContentHash = hash(groupsBody);
  const activityContentHash = hash(victimsBody);
  const sourceUrl = input.sourceUrl ?? "https://data.ransomware.live/groups.json";
  const groupNames = new Set(groups.map((group) => normalizeActorLabel(text(group.name))).filter(Boolean));
  const unreliableGroupNames: string[] = [];
  const invalidIdentityLabels: string[] = [];
  const generatedIdentityLabels: string[] = [];
  const invalidAliasLabels: string[] = [];
  const definitions: GroupDefinition[] = [];

  for (const group of groups) {
    const canonicalName = text(group.name);
    if (!canonicalName) continue;
    if (UNRELIABLE.test(text(group.description))) {
      unreliableGroupNames.push(canonicalName);
      continue;
    }
    const labelExclusion = identityLabelExclusion(canonicalName);
    if (labelExclusion === "invalid") {
      invalidIdentityLabels.push(canonicalName);
      continue;
    }
    if (labelExclusion === "generated") {
      generatedIdentityLabels.push(canonicalName);
      continue;
    }
    const associatedNames = uniqueCaseInsensitive(values(group.altname)).filter((name) => {
      if (identityLabelExclusion(name)) {
        invalidAliasLabels.push(name);
        return false;
      }
      return normalizeActorLabel(name) !== normalizeActorLabel(canonicalName);
    }).sort(labelOrder);
    const relatedOperationNames = uniqueCaseInsensitive(values(group.lineage)).sort(labelOrder);
    const normalizedCanonicalName = normalizeActorLabel(canonicalName);
    const description = text(group.description);
    const sourceFirstReportedAt = optionalIso(group.date);
    const slug = normalizedCanonicalName.replace(/\s+/g, "-");
    definitions.push({
      group,
      id: `ransomware-live-current-operations:${slug}`,
      externalId: `ransomwarelive:${slug}`,
      canonicalName,
      normalizedCanonicalName,
      associatedNames,
      relatedOperationNames,
      descriptionAvailable: Boolean(description),
      ...(description ? { descriptionSha256: hash(description) } : {}),
      ...(sourceFirstReportedAt ? { sourceFirstReportedAt } : {}),
      operationKinds: Object.entries(objectOrEmpty(group.type)).filter(([, enabled]) => enabled === true).map(([kind]) => kind).sort()
    });
  }
  const recentClaimAliasesResolvedByUniqueLocation: Array<{ claimName: string; canonicalName: string }> = [];
  for (const [claimKey, claim] of [...claims]) {
    if (definitions.some((definition) => definition.normalizedCanonicalName === claimKey)) continue;
    const candidates = definitions.filter((definition) => {
      const locationHosts = array(definition.group.locations ?? [], `${definition.canonicalName} locations`)
        .flatMap((location) => [text(location?.fqdn), publicHost(location?.slug)])
        .map((host) => host.toLowerCase())
        .filter(Boolean);
      return claim.locatorHosts.some((host) => locationHosts.includes(host.toLowerCase()));
    });
    if (candidates.length !== 1) continue;
    const target = candidates[0];
    const existing = claims.get(target.normalizedCanonicalName);
    claims.set(target.normalizedCanonicalName, mergeClaimSummaries(existing, claim, target.canonicalName));
    claims.delete(claimKey);
    if (!identityLabelExclusion(claim.name)) target.associatedNames = uniqueCaseInsensitive([...target.associatedNames, claim.name]).sort(labelOrder);
    recentClaimAliasesResolvedByUniqueLocation.push({ claimName: claim.name, canonicalName: target.canonicalName });
  }
  if (new Set(definitions.map((identity) => identity.id)).size !== definitions.length) throw new Error("Ransomware operation catalog contains duplicate normalized identities.");

  const normalizedDefinitions = definitions.map(({ group: _group, ...definition }) => definition)
    .sort((left, right) => left.normalizedCanonicalName.localeCompare(right.normalizedCanonicalName));
  const bundleSha256 = hash(JSON.stringify(normalizedDefinitions));
  const catalogVersion = `groups-sha256:${bundleSha256.slice(0, 16)}`;
  const definitionIdsByName = new Map(definitions.map((definition) => [definition.normalizedCanonicalName, definition.id]));
  const timestampAnomalies: RansomwareOperationCatalogSnapshot["timestampAnomalies"] = [];
  for (const definition of definitions) {
    if (definition.sourceFirstReportedAt && Date.parse(definition.sourceFirstReportedAt) > retrievedMs) timestampAnomalies.push({
      actorIdentityId: definition.id,
      groupName: definition.canonicalName,
      field: "group.date",
      sourceTimestamp: definition.sourceFirstReportedAt,
      anomaly: "future_source_timestamp",
      currentnessEligible: false
    });
  }
  for (const victim of victims) {
    const groupName = text(victim.group_name);
    const publishedMs = claimTime(victim);
    if (!groupName || !Number.isFinite(publishedMs) || publishedMs <= retrievedMs) continue;
    const actorIdentityId = definitionIdsByName.get(normalizeActorLabel(groupName));
    timestampAnomalies.push({
      ...(actorIdentityId ? { actorIdentityId } : {}),
      groupName,
      field: "victim.published",
      sourceTimestamp: new Date(publishedMs).toISOString(),
      anomaly: "future_source_timestamp",
      currentnessEligible: false
    });
  }

  let reachableLocationGroupCount = 0;
  let liveLocationGroupCount = 0;
  const recentClaimOnlyGroupNames: string[] = [];
  const liveLocationOnlyGroupNames: string[] = [];
  const bothCurrentEvidenceGroupNames: string[] = [];
  const historicalGroupNames: string[] = [];
  const baseIdentities = definitions.map((definition): RansomwareOperationIdentity => {
    const groupClaims = claims.get(definition.normalizedCanonicalName);
    const locations = array(definition.group.locations ?? [], `${definition.canonicalName} locations`);
    const reachableLocations = locations.filter(reachableLocation);
    const liveLocations = reachableLocations.filter((location) => currentLocation(location, retrievedMs));
    if (reachableLocations.length) reachableLocationGroupCount++;
    if (liveLocations.length) liveLocationGroupCount++;
    for (const location of locations) {
      const checkedMs = locationTime(location);
      if (!Number.isFinite(checkedMs) || checkedMs <= retrievedMs) continue;
      timestampAnomalies.push({
        actorIdentityId: definition.id,
        groupName: definition.canonicalName,
        field: "group.location.checked",
        sourceTimestamp: new Date(checkedMs).toISOString(),
        anomaly: "future_source_timestamp",
        currentnessEligible: false
      });
    }
    const recentClaimCount = groupClaims?.recentCount ?? 0;
    const latestCurrentClaimPublishedAt = groupClaims?.latestRecentAt;
    const latestCurrentLocationCheckedAt = latestIso(liveLocations.map(locationTime));
    const currentActivity: RansomwareOperationCurrentActivityEvidence[] = [
      ...(latestCurrentClaimPublishedAt ? [{
        kind: "recent_public_claim" as const,
        observedAt: latestCurrentClaimPublishedAt,
        count: recentClaimCount,
        contentHash: activityContentHash
      }] : []),
      ...(latestCurrentLocationCheckedAt ? [{
        kind: "reachable_publication_location" as const,
        observedAt: latestCurrentLocationCheckedAt,
        count: liveLocations.length,
        contentHash: groupContentHash
      }] : [])
    ];
    if (currentActivity.length === 2) bothCurrentEvidenceGroupNames.push(definition.canonicalName);
    else if (latestCurrentClaimPublishedAt) recentClaimOnlyGroupNames.push(definition.canonicalName);
    else if (latestCurrentLocationCheckedAt) liveLocationOnlyGroupNames.push(definition.canonicalName);
    else historicalGroupNames.push(definition.canonicalName);

    return {
      id: definition.id,
      catalogId: "ransomware-live-current-operations",
      externalId: definition.externalId,
      canonicalName: definition.canonicalName,
      normalizedCanonicalName: definition.normalizedCanonicalName,
      associatedNames: definition.associatedNames,
      relatedOperationNames: definition.relatedOperationNames,
      status: currentActivity.length ? "current" : "retired",
      lookupPolicy: actorLookupPolicy(definition.canonicalName),
      aptNumberDesignationPresent: false,
      identityKind: "ransomware_operation",
      lineageRelations: [],
      activityEvidence: currentActivity,
      descriptionAvailable: definition.descriptionAvailable,
      ...(definition.descriptionSha256 ? { descriptionSha256: definition.descriptionSha256 } : {}),
      ...(definition.sourceFirstReportedAt ? { sourceFirstReportedAt: definition.sourceFirstReportedAt } : {}),
      operationKinds: definition.operationKinds,
      sourceUrl,
      catalogVersion,
      bundleSha256,
      retrievedAt
    };
  });

  const identities = baseIdentities.map((identity) => ({
    ...identity,
    lineageRelations: identity.relatedOperationNames.map((name) => {
      const matches = baseIdentities.filter((candidate) => [candidate.canonicalName, ...candidate.associatedNames]
        .some((label) => normalizeActorLabel(label) === normalizeActorLabel(name)));
      return {
        relationship: "evolved_from" as const,
        name,
        ...(matches.length === 1 && matches[0].id !== identity.id ? { targetIdentityId: matches[0].id } : {})
      };
    })
  })).sort((left, right) => left.normalizedCanonicalName.localeCompare(right.normalizedCanonicalName));

  const current = identities.filter((identity) => identity.status === "current");
  const minimum = input.minimumCurrentIdentities ?? 25;
  if (current.length < minimum) throw new Error(`Ransomware operation catalog is incomplete: ${current.length} current identities, expected at least ${minimum}.`);
  const aliasCollisions = collisions(current);
  const associatedNames = identities.flatMap((identity) => identity.associatedNames);
  const recentClaims = [...claims.values()].filter((claim) => claim.recentCount > 0);
  const missingRecent = recentClaims.filter((claim) => !groupNames.has(normalizeActorLabel(claim.name))).map((claim) => claim.name).sort();
  const activityCurrentnessWatermarkAt = latestIso(identities.flatMap((identity) => identity.activityEvidence).map((evidence) => Date.parse(evidence.observedAt)));
  const activityWatermarkAt = latestIso(sourceClaimTimes.filter((timestamp) => timestamp <= retrievedMs));
  const historical = identities.filter((identity) => identity.status === "retired");
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));

  return {
    schemaVersion: "ti.actor_identity_catalog.v1",
    catalogId: "ransomware-live-current-operations",
    catalogName: "Ransomware.live community group catalog",
    catalogVersion,
    sourceUrl,
    bundleId: `ransomware-live-current-operations:${bundleSha256}`,
    bundleSha256,
    retrievedAt,
    ...(activityWatermarkAt ? { activityWatermarkAt } : {}),
    ...(activityCurrentnessWatermarkAt ? { activityCurrentnessWatermarkAt } : {}),
    evidenceContentHashes: [groupContentHash, activityContentHash],
    counts: {
      totalIdentityCount: identities.length,
      currentIdentityCount: current.length,
      retiredIdentityCount: historical.length,
      deprecatedIdentityCount: 0,
      revokedIdentityCount: 0,
      aptNumberDesignationPresentCount: 0,
      associatedNameOccurrenceCount: associatedNames.length,
      distinctAssociatedNameCount: new Set(associatedNames.map(normalizeActorLabel)).size,
      distinctLookupLabelCount: new Set(identities.flatMap((identity) => [identity.canonicalName, ...identity.associatedNames]).map(normalizeActorLabel)).size,
      aliasCollisionCount: aliasCollisions.length,
      sourceGroupCount: groups.length,
      sourceDescriptionGroupCount: groups.filter((group) => Boolean(text(group.description))).length,
      sourceVictimHistoryGroupCount: groups.filter((group) => nonNegativeInteger(group._victim_count) > 0).length,
      registeredDescriptionIdentityCount: definitions.filter((definition) => definition.descriptionAvailable).length,
      registeredVictimHistoryIdentityCount: definitions.filter((definition) => nonNegativeInteger(definition.group._victim_count) > 0).length,
      historicalDescriptionIdentityCount: historical.filter((identity) => definitionById.get(identity.id)?.descriptionAvailable).length,
      historicalVictimHistoryIdentityCount: historical.filter((identity) => nonNegativeInteger(definitionById.get(identity.id)?.group?._victim_count) > 0).length,
      recentClaimGroupCount: sourceRecentClaimGroupCount,
      recentClaimIdentityCount: definitions.filter((definition) => (claims.get(definition.normalizedCanonicalName)?.recentCount ?? 0) > 0).length,
      reachableLocationGroupCount,
      liveLocationGroupCount,
      recentClaimOnlyIdentityCount: recentClaimOnlyGroupNames.length,
      liveLocationOnlyIdentityCount: liveLocationOnlyGroupNames.length,
      bothCurrentEvidenceIdentityCount: bothCurrentEvidenceGroupNames.length,
      historicalIdentityCount: historicalGroupNames.length,
      unreliableExcludedCount: unreliableGroupNames.length,
      invalidIdentityLabelExcludedCount: invalidIdentityLabels.length,
      generatedIdentityLabelExcludedCount: generatedIdentityLabels.length,
      invalidAliasLabelExcludedCount: invalidAliasLabels.length,
      resolvedRecentClaimAliasCount: recentClaimAliasesResolvedByUniqueLocation.length,
      unmatchedRecentClaimGroupCount: missingRecent.length,
      identityActivityEvidenceCount: current.reduce((count, identity) => count + identity.activityEvidence.length, 0),
      sourceVictimRecordCount: victims.length,
      restrictedLocatorFieldCount: groups.reduce((count, group) => count + array(group.locations ?? [], "locations").filter((location) => text(location?.fqdn) || text(location?.slug)).length, 0),
      futureTimestampAnomalyCount: timestampAnomalies.length
    },
    identities,
    aliasCollisions,
    exclusions: {
      unreliableGroupNames: unreliableGroupNames.sort(),
      invalidIdentityLabels: invalidIdentityLabels.sort(),
      generatedIdentityLabels: generatedIdentityLabels.sort(),
      invalidAliasLabels: invalidAliasLabels.sort(),
      recentClaimAliasesResolvedByUniqueLocation: recentClaimAliasesResolvedByUniqueLocation.sort((left, right) => left.claimName.localeCompare(right.claimName)),
      recentClaimNamesMissingFromGroupCatalog: missingRecent
    },
    lifecycle: {
      recentClaimOnlyGroupNames: recentClaimOnlyGroupNames.sort(),
      liveLocationOnlyGroupNames: liveLocationOnlyGroupNames.sort(),
      bothCurrentEvidenceGroupNames: bothCurrentEvidenceGroupNames.sort(),
      historicalGroupNames: historicalGroupNames.sort()
    },
    timestampAnomalies: timestampAnomalies.sort((left, right) => left.sourceTimestamp.localeCompare(right.sourceTimestamp) || left.groupName.localeCompare(right.groupName)),
    governance: {
      identityRegistrationSource: "tier_2_community_group_catalog",
      activityEvidenceSource: "community_public_claim_and_reachability_indexes",
      excludedDataClasses: ["victim names as identities", "raw leak bodies", "stolen data", "credentials", "restricted locators"]
    }
  };
}

function reachableLocation(location: any): boolean {
  const status = Number(location?.http?.status);
  return location?.enabled === true && location?.available === true && status >= 200 && status < 400;
}

function currentLocation(location: any, retrievedMs: number): boolean {
  const checkedMs = locationTime(location);
  return reachableLocation(location) && Number.isFinite(checkedMs) && checkedMs >= retrievedMs - LOCATION_FRESHNESS_MS && checkedMs <= retrievedMs;
}

function locationTime(location: any): number {
  return Date.parse(text(location?.lastscrape) || text(location?.http?.fetched_at) || text(location?.updated));
}

function claimTime(victim: any): number {
  return Date.parse(text(victim?.published) || text(victim?.discovered));
}

function publicHost(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  }
}

function mergeClaimSummaries(existing: ClaimSummary | undefined, alias: ClaimSummary, canonicalName: string): ClaimSummary {
  if (!existing) return { ...alias, name: canonicalName };
  const latestAt = Date.parse(existing.latestAt) >= Date.parse(alias.latestAt) ? existing.latestAt : alias.latestAt;
  const recentTimes = [existing.latestRecentAt, alias.latestRecentAt].filter(Boolean) as string[];
  return {
    name: canonicalName,
    count: existing.count + alias.count,
    latestAt,
    recentCount: existing.recentCount + alias.recentCount,
    ...(recentTimes.length ? { latestRecentAt: recentTimes.sort((left, right) => Date.parse(right) - Date.parse(left))[0] } : {}),
    locatorHosts: uniqueCaseInsensitive([...existing.locatorHosts, ...alias.locatorHosts])
  };
}

function identityLabelExclusion(value: string): "invalid" | "generated" | undefined {
  const normalized = normalizeActorLabel(value);
  if (["actor", "group", "malware", "ransomware", "ransomware live", "ransomware live victim feed", "unknown", "unknown group", "victim", "victim feed"].includes(normalized)) return "invalid";
  if (/^(?:actor|demo|fixture|group|operation|sample|test)\s*\d+$/.test(normalized)) return "generated";
  return undefined;
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

function optionalIso(value: unknown): string | undefined {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function latestIso(values: number[]): string | undefined {
  const latest = Math.max(...values.filter(Number.isFinite));
  return Number.isFinite(latest) ? new Date(latest).toISOString() : undefined;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function labelOrder(left: string, right: string): number {
  return normalizeActorLabel(left).localeCompare(normalizeActorLabel(right)) || left.localeCompare(right);
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
