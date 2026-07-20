import type { SourceRecord } from "../types.ts";

const REQUIRED_BLOCKED_OPERATIONS = [
  "credential_bypass",
  "captcha_solving",
  "threat_actor_interaction",
  "stolen_file_download",
  "stealth_or_evasion",
  "unapproved_proxy",
  "non_metadata_capture"
];

type SeedError = { sourceId?: string; message: string };

export function importRestrictedMetadataSeedBundle(bundle: unknown, importedAt: string): {
  accepted: SourceRecord[];
  errors: SeedError[];
  duplicates: never[];
  valid: boolean;
} {
  const errors: SeedError[] = [];
  if (!isRecord(bundle)) return { accepted: [], errors: [{ message: "restricted seed bundle must be an object" }], duplicates: [], valid: false };

  const sources = Array.isArray(bundle.sources) ? bundle.sources : [];
  const bundleValid = bundle.version === 1
    && bundle.disabledByDefault === true
    && bundle.network === "tor"
    && bundle.proxyBoundaryId === "tor-approved-metadata-proxy"
    && bundle.approvalScope === "metadata_only"
    && bundle.retentionClass === "restricted_metadata"
    && REQUIRED_BLOCKED_OPERATIONS.every((operation) => Array.isArray(bundle.forbiddenOperations) && bundle.forbiddenOperations.includes(operation));
  if (!bundleValid) errors.push({ message: "restricted seed bundle policy boundary is incomplete" });
  if (!Array.isArray(bundle.sources)) errors.push({ message: "restricted seed bundle sources must be an array" });
  if (!bundleValid || !Array.isArray(bundle.sources)) return { accepted: [], errors, duplicates: [], valid: false };

  const accepted: SourceRecord[] = [];
  for (const raw of sources) {
    const sourceId = isRecord(raw) && nonEmpty(raw.id) ? raw.id : undefined;
    const sourceErrors = validateSource(raw);
    errors.push(...sourceErrors.map((message) => ({ sourceId, message })));
    if (sourceErrors.length || !isRecord(raw) || !isRecord(raw.governance) || !isRecord(raw.metadata)) continue;

    accepted.push({
      id: raw.id,
      name: raw.name,
      type: "tor_metadata",
      url: raw.url,
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: raw.risk,
      trustScore: raw.trustScore,
      crawlFrequencySeconds: raw.crawlFrequencySeconds,
      legalNotes: raw.legalNotes,
      language: nonEmpty(raw.language) ? raw.language : undefined,
      createdAt: importedAt,
      updatedAt: importedAt,
      governance: {
        approvalRequired: true,
        approvalState: raw.governance.approvalState,
        metadataOnly: true,
        approvalScope: "metadata_only",
        approvedAt: raw.governance.approvedAt,
        approvedBy: raw.governance.approvedBy,
        policyVersion: raw.governance.policyVersion
      },
      metadata: {
        sourceFamily: "dark_web_victim_feed",
        actorName: raw.metadata.actorName,
        actors: Array.isArray(raw.metadata.actors) ? raw.metadata.actors.filter(nonEmpty) : [raw.metadata.actorName],
        discoveryAuthorityUrl: raw.metadata.discoveryAuthorityUrl,
        discoveryAuthorityRecordUrl: raw.metadata.discoveryAuthorityRecordUrl,
        discoveryCheckedAt: raw.metadata.discoveryCheckedAt,
        discoveryAvailability: raw.metadata.discoveryAvailability,
        discoveryObservedAt: raw.metadata.discoveryObservedAt,
        expectedPageRole: "victim_listing",
        collectionScope: "metadata_only",
        retainRawContent: false,
        retentionDays: raw.metadata.retentionDays,
        attribution: raw.metadata.attribution
      }
    } as SourceRecord);
  }

  return { accepted, errors, duplicates: [], valid: errors.length === 0 };
}

export function isRestrictedMetadataSeedBundle(bundle: unknown): boolean {
  return isRecord(bundle) && (bundle.network === "tor" || (Array.isArray(bundle.sources) && bundle.sources.some((source) => isRecord(source) && source.type === "tor_metadata")));
}

function validateSource(source: unknown): string[] {
  if (!isRecord(source)) return ["restricted source must be an object"];
  const errors: string[] = [];
  if (!nonEmpty(source.id)) errors.push("source id is required");
  if (!nonEmpty(source.name)) errors.push("source name is required");
  if (source.type !== "tor_metadata") errors.push("source type must be tor_metadata");
  if (!isV3OnionUrl(source.url)) errors.push("source URL must be a credential-free v3 onion URL");
  if (source.accessMethod !== "approved_proxy") errors.push("source access method must be approved_proxy");
  if (source.status !== "candidate" && source.status !== "disabled") errors.push("restricted seed source must be inactive");
  if (source.risk !== "high" && source.risk !== "restricted") errors.push("restricted source risk must be high or restricted");
  if (!boundedNumber(source.trustScore, 0, 1)) errors.push("trust score must be between 0 and 1");
  if (!boundedNumber(source.crawlFrequencySeconds, 900, 86_400)) errors.push("crawl frequency must be between 900 and 86400 seconds");
  if (!nonEmpty(source.legalNotes) || source.legalNotes.length < 20) errors.push("specific legal notes are required");

  const governance = isRecord(source.governance) ? source.governance : undefined;
  if (!governance || governance.approvalRequired !== true || governance.metadataOnly !== true || governance.approvalScope !== "metadata_only") {
    errors.push("metadata-only governance is required");
  } else if (governance.approvalState === "approved") {
    if (!isIsoDate(governance.approvedAt) || !nonEmpty(governance.approvedBy)) errors.push("approved governance requires approvedAt and approvedBy");
  } else if (governance.approvalState !== "pending") {
    errors.push("governance approval state must be pending or approved");
  }

  const metadata = isRecord(source.metadata) ? source.metadata : undefined;
  if (!metadata
    || metadata.sourceFamily !== "dark_web_victim_feed"
    || !nonEmpty(metadata.actorName)
    || !isPublicHttpsUrl(metadata.discoveryAuthorityUrl)
    || !isPublicHttpsUrl(metadata.discoveryAuthorityRecordUrl)
    || !isIsoDate(metadata.discoveryCheckedAt)
    || !["reported_available", "reported_unavailable", "unknown"].includes(metadata.discoveryAvailability)
    || (metadata.discoveryObservedAt !== undefined && !isIsoDate(metadata.discoveryObservedAt))
    || metadata.expectedPageRole !== "victim_listing"
    || metadata.collectionScope !== "metadata_only"
    || metadata.retainRawContent !== false
    || !boundedNumber(metadata.retentionDays, 1, 90)
    || !nonEmpty(metadata.attribution)) {
    errors.push("restricted source attribution, role, verification, and retention metadata are required");
  }
  return errors;
}

function isV3OnionUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && /^[a-z2-7]{56}\.onion$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function isPublicHttpsUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && !url.username && !url.password && !url.hostname.endsWith(".onion");
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function boundedNumber(value: unknown, min: number, max: number): boolean { return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max; }
function isIsoDate(value: unknown): boolean { return nonEmpty(value) && Number.isFinite(Date.parse(value)); }
