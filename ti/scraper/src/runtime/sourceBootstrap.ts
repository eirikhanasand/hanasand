import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { importSeedBundle, seedDuplicateKey } from "../registry/sourceSeeds.ts";
import { importRestrictedMetadataSeedBundle, isRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";

export type RuntimeSourceBootstrapResult = {
  generatedAt: string;
  seedPaths: string[];
  importedSourceCount: number;
  updatedSourceCount: number;
  skippedSourceCount: number;
  activeSourceCount: number;
  retainedSourceCount: number;
  totalSourceCount: number;
  errors: Array<{ path: string; message: string }>;
};

type SourceStore = {
  batch?<T>(write: () => T): T;
  saveSource(source: SourceRecord): SourceRecord;
  listSources(): SourceRecord[];
};

type RuntimeSourceBootstrapInput = {
  seedPaths?: string[];
  generatedAt?: string;
  batched?: boolean;
};

const defaultSeedPaths = [
  "public_cti_sources.json",
  "verified_long_lived_sources.json",
  "verified_query_providers.json",
  "public_cti_starter_pack.json",
  "public_telegram_channel_packs.json",
  "restricted_metadata_source_packs.json"
].map((name) => join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seeds", name));

export function bootstrapRuntimeSources(store: SourceStore, input: RuntimeSourceBootstrapInput = {}): RuntimeSourceBootstrapResult {
  if (!input.batched && typeof store.batch === "function") {
    return store.batch(() => bootstrapRuntimeSources(store, { ...input, batched: true }));
  }

  const generatedAt = input.generatedAt ?? nowIso();
  const seedPaths = input.seedPaths ?? configuredSeedPaths();
  const existingByKey = new Map(store.listSources().map((source) => [seedDuplicateKey(source), source]));
  const errors: RuntimeSourceBootstrapResult["errors"] = [];
  let importedSourceCount = 0;
  let updatedSourceCount = 0;
  let skippedSourceCount = 0;

  for (const path of seedPaths) {
    if (!existsSync(path)) {
      errors.push({ path, message: "seed file not found" });
      continue;
    }

    let bundle: any;
    try {
      bundle = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      errors.push({ path, message: error instanceof Error ? error.message : String(error) });
      continue;
    }

    const restricted = isRestrictedMetadataSeedBundle(bundle);
    const report = restricted
      ? importRestrictedMetadataSeedBundle(bundle, generatedAt)
      : importSeedBundle(bundle, { importedAt: generatedAt, existingSources: store.listSources() });
    const rejectedSourceIds = new Set((report.errors ?? []).map((error: any) => error.sourceId).filter(Boolean));
    const verifiedJsonApiExceptions = new Set((report.accepted as SourceRecord[])
      .filter((source) => source.type === "json_api"
        && isVerifiedProductionSource(source)
        && (report.errors ?? []).filter((error: any) => error.sourceId === source.id).every((error: any) => error.message === "source must be safe public CTI"))
      .map((source) => source.id));
    for (const source of report.accepted as SourceRecord[]) {
      if ((rejectedSourceIds.has(source.id) && !verifiedJsonApiExceptions.has(source.id)) || !shouldImportSource(source)) {
        skippedSourceCount++;
        continue;
      }
      const duplicateKey = seedDuplicateKey(source);
      const existing = existingByKey.get(duplicateKey);
      const prepared = prepareRuntimeSource(source, path, generatedAt, restricted);
      if (existing) {
        const reconciled = reconcileVerifiedSource(existing, prepared, generatedAt);
        if (reconciled) {
          const saved = store.saveSource(reconciled);
          existingByKey.set(duplicateKey, saved);
          updatedSourceCount++;
        } else {
          skippedSourceCount++;
        }
        continue;
      }
      const saved = store.saveSource(prepared);
      existingByKey.set(duplicateKey, saved);
      importedSourceCount++;
    }

    for (const error of report.errors ?? []) {
      if (verifiedJsonApiExceptions.has(error.sourceId) && error.message === "source must be safe public CTI") continue;
      errors.push({ path, message: `${error.sourceId ?? "unknown"}: ${error.message}` });
    }
  }

  const sources = store.listSources();
  const activeSourceCount = sources.filter(isExecutableSource).length;
  const retainedSourceCount = activeSourceCount;
  return {
    generatedAt,
    seedPaths,
    importedSourceCount,
    updatedSourceCount,
    skippedSourceCount,
    activeSourceCount,
    retainedSourceCount,
    totalSourceCount: sources.length,
    errors
  };
}

function reconcileVerifiedSource(existing: SourceRecord, verified: SourceRecord, generatedAt: string): SourceRecord | undefined {
  const restricted = isVerifiedRestrictedProductionSource(verified, generatedAt);
  if (!(restricted ? isSafeRestrictedUpgradeTarget(existing) : isVerifiedProductionSource(verified) && isSafeUpgradeTarget(existing))) return undefined;
  const metadata = {
    ...(existing.metadata ?? {}),
    ...(verified.metadata ?? {}),
    verifiedSourceId: verified.id,
    sourceImportedAt: existing.metadata?.verifiedSourceId === verified.id
      ? existing.metadata?.sourceImportedAt ?? verified.metadata?.sourceImportedAt
      : verified.metadata?.sourceImportedAt
  };
  const reconciled = {
    ...existing,
    ...verified,
    id: existing.id,
    tenantId: existing.tenantId,
    createdAt: existing.createdAt ?? verified.createdAt,
    updatedAt: generatedAt,
    metadata,
    health: existing.health,
    crawlState: existing.crawlState
  };
  return isDeepStrictEqual(managedSourceConfiguration(existing), managedSourceConfiguration(reconciled)) ? undefined : reconciled;
}

function isVerifiedProductionSource(source: SourceRecord) {
  return source.status === "active"
    && source.risk === "low"
    && source.accessMethod === "public_http"
    && source.governance?.approvalState === "approved"
    && source.metadata?.productionCollection === true
    && Boolean(source.legalNotes?.trim())
    && !unsafeAutomaticUpgrade(source);
}

function isSafeUpgradeTarget(source: SourceRecord) {
  return ["active", "canary", "candidate"].includes(source.status)
    && source.risk === "low"
    && source.accessMethod === "public_http"
    && (!source.governance?.approvalState || source.governance.approvalState === "approved")
    && source.metadata?.productionCollection !== false
    && !unsafeAutomaticUpgrade(source);
}

function isSafeRestrictedUpgradeTarget(source: SourceRecord) {
  return ["active", "candidate", "degraded", "probation"].includes(source.status)
    && ["high", "restricted"].includes(source.risk)
    && source.type === "tor_metadata"
    && source.accessMethod === "approved_proxy"
    && source.governance?.metadataOnly !== false;
}

function isVerifiedRestrictedProductionSource(source: SourceRecord, generatedAt: string) {
  const metadata = source.metadata ?? {};
  const verifiedAt = Date.parse(String(metadata.productionCollectionVerifiedAt ?? ""));
  const now = Date.parse(generatedAt);
  return source.type === "tor_metadata"
    && ["high", "restricted"].includes(source.risk)
    && source.accessMethod === "approved_proxy"
    && source.governance?.approvalState === "approved"
    && source.governance?.metadataOnly === true
    && metadata.collectionScope === "metadata_only"
    && metadata.retainRawContent === false
    && metadata.discoveryAvailability === "reported_available"
    && metadata.productionCollectionOutcome === "metadata_only_parser_verified"
    && typeof metadata.parserProfile === "string" && metadata.parserProfile.trim().length > 0
    && typeof metadata.reportedVictimCount === "number" && metadata.reportedVictimCount > 0
    && Number.isFinite(Date.parse(String(metadata.lastReportedVictimAt ?? "")))
    && Number.isFinite(verifiedAt)
    && Number.isFinite(now)
    && verifiedAt <= now + 5 * 60_000
    && now - verifiedAt <= 7 * 86_400_000;
}

function unsafeAutomaticUpgrade(source: SourceRecord) {
  const metadata = source.metadata ?? {};
  if ([
    "generatedPublicSourcePack", "generatedSourcePack", "paddedSourcePack", "paddedSource",
    "requiresAuthentication", "authenticationRequired", "authRequired", "credentialRequired",
    "private", "privateChannel", "inviteOnly", "captchaRequired", "disabledByDefault"
  ].some((key) => metadata[key] === true)) return true;
  if (Object.entries(metadata).some(([key, value]) => value === true && /generated.*(?:pack|padding)|padded|padding/i.test(key))) return true;
  if ([metadata.collectionMode, metadata.accessMode, metadata.sourceVisibility].some((value) => typeof value === "string" && /(?:^|_)(?:private|invite|auth|captcha|credential)(?:_|$)/i.test(value))) return true;
  try {
    const url = new URL(source.url);
    return !["http:", "https:"].includes(url.protocol)
      || Boolean(url.username || url.password)
      || isPrivateHostname(url.hostname)
      || /\/(?:joinchat|invite|private|login|sign-?in|auth|captcha)(?:[/?#]|$)|t\.me\/\+/i.test(url.href);
  } catch {
    return true;
  }
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || /\.(?:local|internal|onion|i2p)$/.test(host) || host === "::1" || /^(?:fc|fd|fe8|fe9|fea|feb)/i.test(host)) return true;
  const octets = host.split(".").map(Number);
  return octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    && (octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224
      || octets[0] === 169 && octets[1] === 254 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31
      || octets[0] === 192 && octets[1] === 168 || octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127
      || octets[0] === 198 && [18, 19].includes(octets[1]));
}

function managedSourceConfiguration(source: SourceRecord) {
  const { id: _id, tenantId: _tenantId, createdAt: _createdAt, updatedAt: _updatedAt, lastSeenAt: _lastSeenAt, health: _health, crawlState: _crawlState, ...configuration } = source;
  return configuration;
}

function configuredSeedPaths() {
  const configured = Bun.env.TI_SOURCE_SEED_PATHS?.split(",").map((item) => item.trim()).filter(Boolean);
  return configured?.length ? configured : defaultSeedPaths;
}

function shouldImportSource(source: SourceRecord) {
  if (source.id === "src_seed_ransomwarelive_groups") return false;
  if (source.risk === "high" || source.risk === "restricted") return Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES === "true";
  if (source.accessMethod === "api_key" || source.accessMethod === "api_key_paid_plan") return Bun.env.TI_IMPORT_CREDENTIAL_REQUIRED_SOURCES === "true";
  return true;
}

function prepareRuntimeSource(source: SourceRecord, seedPath: string, generatedAt: string, restricted = false): SourceRecord {
  const activate = !restricted && Bun.env.TI_SOURCE_SEED_ACTIVATE !== "false" && source.risk !== "medium" && source.risk !== "high" && source.risk !== "restricted";
  const transportCanary = restricted && source.metadata?.transportCanary === true;
  const verifiedRestricted = restricted && isVerifiedRestrictedProductionSource(source, generatedAt);
  return {
    ...source,
    status: transportCanary || verifiedRestricted ? "active" : restricted ? "candidate" : activate ? "active" : source.status ?? "candidate",
    createdAt: source.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    metadata: {
      ...(source.metadata ?? {}),
      productionCollection: !restricted || transportCanary || verifiedRestricted,
      canaryPortfolio: !restricted,
      ...(restricted && !transportCanary && !verifiedRestricted ? { restrictedMetadataCandidate: true } : {}),
      ...(verifiedRestricted ? { verifiedSourceId: source.metadata?.verifiedSourceId ?? source.id } : {}),
      sourceSeedPath: seedPath,
      sourceImportedAt: generatedAt
    },
    crawlState: {
      ...(source.crawlState ?? {}),
      retryCount: source.crawlState?.retryCount ?? 0
    }
  };
}
