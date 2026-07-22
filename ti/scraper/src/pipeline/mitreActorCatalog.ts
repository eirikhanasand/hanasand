import { createHash } from "node:crypto";

export const MITRE_ENTERPRISE_ACTOR_CATALOG_URL = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json";

export type MitreActorIdentityStatus = "current" | "deprecated" | "revoked" | "retired";

export type MitreActorIdentity = {
  id: string;
  catalogId: "mitre-attack-enterprise";
  externalId: string;
  stixId: string;
  canonicalName: string;
  normalizedCanonicalName: string;
  associatedNames: string[];
  status: MitreActorIdentityStatus;
  aptNumberDesignationPresent: boolean;
  createdAt: string;
  modifiedAt: string;
  description?: string;
  domains: string[];
  contributors: string[];
  sourceUrl: string;
  referenceUrls: string[];
  revokedByExternalId?: string;
  catalogVersion: string;
  catalogModifiedAt: string;
  bundleSha256: string;
  retrievedAt: string;
};

export type MitreActorAliasCollision = {
  normalizedLabel: string;
  label: string;
  externalIds: string[];
};

export type MitreActorCatalogSnapshot = {
  schemaVersion: "ti.actor_identity_catalog.v1";
  catalogId: "mitre-attack-enterprise";
  catalogName: "Enterprise ATT&CK";
  catalogVersion: string;
  catalogModifiedAt: string;
  sourceUrl: string;
  bundleId: string;
  bundleSha256: string;
  retrievedAt: string;
  counts: {
    totalIdentityCount: number;
    currentIdentityCount: number;
    deprecatedIdentityCount: number;
    revokedIdentityCount: number;
    aptNumberDesignationPresentCount: number;
    associatedNameOccurrenceCount: number;
    distinctAssociatedNameCount: number;
    distinctLookupLabelCount: number;
    aliasCollisionCount: number;
  };
  identities: MitreActorIdentity[];
  aliasCollisions: MitreActorAliasCollision[];
};

export type MitreActorResolution = {
  query: string;
  normalizedQuery: string;
  candidates: Array<{
    identity: ActorIdentityRecord;
    matchKinds: Array<"canonical" | "associated">;
    matchedLabels: string[];
  }>;
  ambiguous: boolean;
};

export type ActorIdentityRecord = {
  id: string;
  catalogId: string;
  externalId: string;
  canonicalName: string;
  normalizedCanonicalName: string;
  associatedNames: string[];
  status: MitreActorIdentityStatus;
  aptNumberDesignationPresent: boolean;
  sourceUrl: string;
  catalogVersion: string;
  catalogModifiedAt: string;
  bundleSha256: string;
  retrievedAt: string;
};

type JsonObject = Record<string, unknown>;

export function parseMitreActorCatalog(
  body: string,
  input: { retrievedAt: string; sourceUrl?: string; minimumCurrentIdentities?: number }
): MitreActorCatalogSnapshot {
  const bundle = object(JSON.parse(body));
  if (bundle.type !== "bundle" || !Array.isArray(bundle.objects) || !string(bundle.id)) throw new Error("MITRE actor catalog is not a STIX bundle.");
  const objects = bundle.objects.map(object);
  const collection = objects.find((item) => item.type === "x-mitre-collection" && item.name === "Enterprise ATT&CK");
  const catalogVersion = string(collection?.x_mitre_version);
  const catalogModifiedAt = iso(collection?.modified);
  if (!collection || !catalogVersion || !catalogModifiedAt) throw new Error("MITRE Enterprise collection metadata is missing.");

  const groups = objects.filter((item) => item.type === "intrusion-set");
  const externalIdByStixId = new Map<string, string>();
  for (const group of groups) {
    const stixId = requiredString(group.id, "intrusion-set id");
    const externalId = mitreExternalId(group);
    if (externalIdByStixId.has(stixId) || [...externalIdByStixId.values()].includes(externalId)) throw new Error(`Duplicate MITRE group identity: ${externalId}`);
    externalIdByStixId.set(stixId, externalId);
  }
  const revokedBy = new Map<string, string>();
  for (const relationship of objects.filter((item) => item.type === "relationship" && item.relationship_type === "revoked-by")) {
    const source = externalIdByStixId.get(string(relationship.source_ref));
    const target = externalIdByStixId.get(string(relationship.target_ref));
    if (source && target) revokedBy.set(source, target);
  }

  const bundleSha256 = createHash("sha256").update(body).digest("hex");
  const sourceUrl = input.sourceUrl ?? MITRE_ENTERPRISE_ACTOR_CATALOG_URL;
  const identities = groups.map((group): MitreActorIdentity => {
    const externalId = mitreExternalId(group);
    const canonicalName = requiredString(group.name, `${externalId} name`);
    const aliases = strings(group.aliases);
    const associatedNames = uniqueCaseInsensitive(aliases.filter((alias) => normalizeActorLabel(alias) !== normalizeActorLabel(canonicalName)));
    const status: MitreActorIdentityStatus = group.revoked === true ? "revoked" : group.x_mitre_deprecated === true ? "deprecated" : "current";
    const labels = [canonicalName, ...associatedNames];
    const referenceUrls = references(group).map((reference) => string(reference.url)).filter(Boolean);
    const sourceReference = references(group).find((reference) => reference.source_name === "mitre-attack");
    return {
      id: `mitre-attack-enterprise:${externalId}`,
      catalogId: "mitre-attack-enterprise",
      externalId,
      stixId: requiredString(group.id, `${externalId} STIX id`),
      canonicalName,
      normalizedCanonicalName: normalizeActorLabel(canonicalName),
      associatedNames,
      status,
      aptNumberDesignationPresent: labels.some(hasAptNumberDesignation),
      createdAt: iso(group.created, `${externalId} created`),
      modifiedAt: iso(group.modified, `${externalId} modified`),
      description: optionalString(group.description)?.slice(0, 12_000),
      domains: strings(group.x_mitre_domains),
      contributors: strings(group.x_mitre_contributors),
      sourceUrl: string(sourceReference?.url) || `https://attack.mitre.org/groups/${externalId}/`,
      referenceUrls: unique(referenceUrls),
      revokedByExternalId: revokedBy.get(externalId),
      catalogVersion,
      catalogModifiedAt,
      bundleSha256,
      retrievedAt: iso(input.retrievedAt, "catalog retrieval time")
    };
  }).sort((left, right) => left.externalId.localeCompare(right.externalId));

  const current = identities.filter((identity) => identity.status === "current");
  const minimum = input.minimumCurrentIdentities ?? 100;
  if (current.length < minimum) throw new Error(`MITRE actor catalog is incomplete: ${current.length} current identities, expected at least ${minimum}.`);
  const aliasCollisions = collisions(current);
  const associatedNames = current.flatMap((identity) => identity.associatedNames);
  const lookupLabels = current.flatMap((identity) => [identity.canonicalName, ...identity.associatedNames]);
  return {
    schemaVersion: "ti.actor_identity_catalog.v1",
    catalogId: "mitre-attack-enterprise",
    catalogName: "Enterprise ATT&CK",
    catalogVersion,
    catalogModifiedAt,
    sourceUrl,
    bundleId: requiredString(bundle.id, "bundle id"),
    bundleSha256,
    retrievedAt: iso(input.retrievedAt, "catalog retrieval time"),
    counts: {
      totalIdentityCount: identities.length,
      currentIdentityCount: current.length,
      deprecatedIdentityCount: identities.filter((identity) => identity.status === "deprecated").length,
      revokedIdentityCount: identities.filter((identity) => identity.status === "revoked").length,
      aptNumberDesignationPresentCount: current.filter((identity) => identity.aptNumberDesignationPresent).length,
      associatedNameOccurrenceCount: associatedNames.length,
      distinctAssociatedNameCount: new Set(associatedNames.map(normalizeActorLabel)).size,
      distinctLookupLabelCount: new Set(lookupLabels.map(normalizeActorLabel)).size,
      aliasCollisionCount: aliasCollisions.length
    },
    identities,
    aliasCollisions
  };
}

export function resolveMitreActorIdentity(query: string, identities: readonly ActorIdentityRecord[]): MitreActorResolution {
  const normalizedQuery = normalizeActorLabel(query);
  const current = identities.filter((identity) => identity.status === "current");
  const matched = current.flatMap((identity) => {
    const canonical = normalizeActorLabel(identity.canonicalName) === normalizedQuery ? [identity.canonicalName] : [];
    const associated = identity.associatedNames.filter((label) => normalizeActorLabel(label) === normalizedQuery);
    if (!canonical.length && !associated.length) return [];
    return [{
      identity,
      matchKinds: [...(canonical.length ? ["canonical" as const] : []), ...(associated.length ? ["associated" as const] : [])],
      matchedLabels: [...canonical, ...associated]
    }];
  });
  const candidates = [...matched.reduce((groups, candidate) => {
    const identity = canonicalIdentity(candidate.identity, current);
    const existing = groups.get(identity.id);
    groups.set(identity.id, existing ? {
      identity,
      matchKinds: [...new Set([...existing.matchKinds, ...candidate.matchKinds])],
      matchedLabels: unique([...existing.matchedLabels, ...candidate.matchedLabels])
    } : { ...candidate, identity });
    return groups;
  }, new Map<string, { identity: ActorIdentityRecord; matchKinds: Array<"canonical" | "associated">; matchedLabels: string[] }>()).values()];
  return { query, normalizedQuery, candidates, ambiguous: candidates.length > 1 };
}

export function reconcileActorIdentityCoverage(identities: readonly ActorIdentityRecord[]) {
  const current = identities.filter((identity) => identity.status === "current");
  const canonicalIds = new Set(current.map((identity) => canonicalIdentity(identity, current).id));
  const aliases = current.flatMap((identity) => identity.associatedNames);
  return {
    currentCatalogRecordCount: current.length,
    canonicalIdentityCount: canonicalIds.size,
    mitreCurrentIdentityCount: current.filter((identity) => identity.catalogId === "mitre-attack-enterprise").length,
    ransomwareCurrentOperationCount: current.filter((identity) => identity.catalogId === "ransomware-live-current-operations").length,
    crossCatalogMergedIdentityCount: current.length - canonicalIds.size,
    aptNumberDesignationPresentCount: current.filter((identity) => identity.catalogId === "mitre-attack-enterprise" && identity.aptNumberDesignationPresent).length,
    associatedNameOccurrenceCount: aliases.length,
    distinctAssociatedNameCount: new Set(aliases.map(normalizeActorLabel)).size,
    distinctLookupLabelCount: new Set(current.flatMap((identity) => [identity.canonicalName, ...identity.associatedNames]).map(normalizeActorLabel)).size
  };
}

export function normalizeActorLabel(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
}

function collisions(identities: MitreActorIdentity[]): MitreActorAliasCollision[] {
  const labels = new Map<string, { label: string; externalIds: Set<string> }>();
  for (const identity of identities) for (const label of [identity.canonicalName, ...identity.associatedNames]) {
    const normalized = normalizeActorLabel(label);
    const current = labels.get(normalized) ?? { label, externalIds: new Set<string>() };
    current.externalIds.add(identity.externalId);
    labels.set(normalized, current);
  }
  return [...labels.entries()].filter(([, value]) => value.externalIds.size > 1).map(([normalizedLabel, value]) => ({
    normalizedLabel,
    label: value.label,
    externalIds: [...value.externalIds].sort()
  })).sort((left, right) => left.normalizedLabel.localeCompare(right.normalizedLabel));
}

function hasAptNumberDesignation(value: string): boolean {
  return /^apt[- ]?\d+$/i.test(value.trim());
}

function canonicalIdentity(identity: ActorIdentityRecord, current: readonly ActorIdentityRecord[]): ActorIdentityRecord {
  if (identity.catalogId === "mitre-attack-enterprise") return identity;
  const name = normalizeActorLabel(identity.canonicalName);
  const mitreMatches = current.filter((candidate) => candidate.catalogId === "mitre-attack-enterprise" && normalizeActorLabel(candidate.canonicalName) === name);
  return mitreMatches.length === 1 ? mitreMatches[0] : identity;
}

function mitreExternalId(group: JsonObject): string {
  const externalId = string(references(group).find((reference) => reference.source_name === "mitre-attack")?.external_id);
  if (!/^G\d{4}$/.test(externalId)) throw new Error(`MITRE intrusion set is missing a G-number: ${string(group.id) || "unknown"}`);
  return externalId;
}

function references(value: JsonObject): JsonObject[] {
  return Array.isArray(value.external_references) ? value.external_references.map(object) : [];
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MITRE actor catalog contains a non-object record.");
  return value as JsonObject;
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | undefined {
  return string(value) || undefined;
}

function requiredString(value: unknown, field: string): string {
  const result = string(value);
  if (!result) throw new Error(`MITRE actor catalog is missing ${field}.`);
  return result;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(string).filter(Boolean) : [];
}

function iso(value: unknown, field = "collection modified time"): string {
  const parsed = Date.parse(string(value));
  if (!Number.isFinite(parsed)) throw new Error(`MITRE actor catalog has an invalid ${field}.`);
  return new Date(parsed).toISOString();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizeActorLabel(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
