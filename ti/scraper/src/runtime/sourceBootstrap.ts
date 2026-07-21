import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importSeedBundle, seedDuplicateKey } from "../registry/sourceSeeds.ts";
import { importRestrictedMetadataSeedBundle, isRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

export type RuntimeSourceBootstrapResult = {
  generatedAt: string;
  sourceTarget: number;
  seedPaths: string[];
  importedSourceCount: number;
  updatedSourceCount: number;
  skippedSourceCount: number;
  activeSourceCount: number;
  totalSourceCount: number;
  shortfall: number;
  blocker?: string;
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
  sourceTarget?: number;
  batched?: boolean;
};

const defaultSeedPaths = [
  "public_cti_sources.json",
  "verified_long_lived_sources.json",
  "public_cti_starter_pack.json",
  "public_telegram_channel_packs.json",
  "public_threat_intel_generated_sources.json",
  "restricted_metadata_source_packs.json"
].map((name) => join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seeds", name));

export function bootstrapRuntimeSources(store: SourceStore, input: RuntimeSourceBootstrapInput = {}): RuntimeSourceBootstrapResult {
  if (!input.batched && typeof store.batch === "function") {
    return store.batch(() => bootstrapRuntimeSources(store, { ...input, batched: true }));
  }

  const generatedAt = input.generatedAt ?? nowIso();
  const sourceTarget = input.sourceTarget ?? Number(Bun.env.TI_SOURCE_TARGET_COUNT ?? "1000");
  const seedPaths = input.seedPaths ?? configuredSeedPaths();
  for (const source of store.listSources()) {
    if (generatedGdeltHold(source) && (source.status !== "candidate" || source.metadata?.productionCollection !== false)) {
      store.saveSource(holdGeneratedGdeltSource(source, generatedAt));
    }
  }
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
    for (const source of report.accepted as SourceRecord[]) {
      if (rejectedSourceIds.has(source.id) || !shouldImportSource(source)) {
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
      errors.push({ path, message: `${error.sourceId ?? "unknown"}: ${error.message}` });
    }
  }

  const sources = store.listSources();
  const activeSourceCount = sources.filter((source) => source.status === "active" || source.status === "canary").length;
  const shortfall = Math.max(0, sourceTarget - sources.length);
  return {
    generatedAt,
    sourceTarget,
    seedPaths,
    importedSourceCount,
    updatedSourceCount,
    skippedSourceCount,
    activeSourceCount,
    totalSourceCount: sources.length,
    shortfall,
    blocker: shortfall > 0 ? `source_registry_shortfall:${sources.length}/${sourceTarget}` : undefined,
    errors
  };
}

function reconcileVerifiedSource(existing: SourceRecord, verified: SourceRecord, generatedAt: string): SourceRecord | undefined {
  const approvedPreview = verified.type === "telegram_public"
    && verified.status === "active"
    && verified.accessMethod === "public_http"
    && verified.governance?.approvalState === "approved"
    && verified.metadata?.collectionMode === "public_web_preview"
    && verified.metadata?.productionCollection === true;
  const existingApproved = existing.status === "active"
    && existing.governance?.approvalState === "approved"
    && existing.metadata?.collectionMode === "public_web_preview"
    && existing.metadata?.productionCollection === true;
  if (!approvedPreview || existingApproved) return undefined;
  return {
    ...existing,
    ...verified,
    id: existing.id,
    tenantId: existing.tenantId ?? verified.tenantId,
    createdAt: existing.createdAt ?? verified.createdAt,
    updatedAt: generatedAt,
    metadata: {
      ...(existing.metadata ?? {}),
      ...(verified.metadata ?? {}),
      verifiedSourceId: verified.id
    },
    crawlState: existing.crawlState
  };
}

function configuredSeedPaths() {
  const configured = Bun.env.TI_SOURCE_SEED_PATHS?.split(",").map((item) => item.trim()).filter(Boolean);
  return configured?.length ? configured : defaultSeedPaths;
}

function shouldImportSource(source: SourceRecord) {
  if (source.risk === "high" || source.risk === "restricted") return Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES === "true";
  if (source.accessMethod === "api_key" || source.accessMethod === "api_key_paid_plan") return Bun.env.TI_IMPORT_CREDENTIAL_REQUIRED_SOURCES === "true";
  return true;
}

function prepareRuntimeSource(source: SourceRecord, seedPath: string, generatedAt: string, restricted = false): SourceRecord {
  if (generatedGdeltHold(source)) return holdGeneratedGdeltSource(source, generatedAt, seedPath);
  const activate = !restricted && Bun.env.TI_SOURCE_SEED_ACTIVATE !== "false" && source.risk !== "medium" && source.risk !== "high" && source.risk !== "restricted";
  const transportCanary = restricted && source.metadata?.transportCanary === true;
  return {
    ...source,
    status: transportCanary ? "active" : restricted ? "candidate" : activate ? "active" : source.status ?? "candidate",
    createdAt: source.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    metadata: {
      ...(source.metadata ?? {}),
      productionCollection: !restricted || transportCanary,
      canaryPortfolio: !restricted,
      restrictedMetadataCandidate: restricted || undefined,
      sourceSeedPath: seedPath,
      sourceImportedAt: generatedAt
    },
    crawlState: {
      ...(source.crawlState ?? {}),
      retryCount: source.crawlState?.retryCount ?? 0
    }
  };
}

function generatedGdeltHold(source: SourceRecord) {
  try {
    return source.metadata?.generatedPublicSourcePack === true && new URL(source.url).hostname === "api.gdeltproject.org";
  } catch {
    return false;
  }
}

function holdGeneratedGdeltSource(source: SourceRecord, generatedAt: string, seedPath?: string): SourceRecord {
  return {
    ...source,
    status: "candidate",
    updatedAt: generatedAt,
    metadata: {
      ...(source.metadata ?? {}),
      productionCollection: false,
      collectionHold: "provider_rate_limit_requires_bounded_collection_plan",
      collectionHoldAt: generatedAt,
      sourceSeedPath: seedPath ?? source.metadata?.sourceSeedPath,
      sourceImportedAt: seedPath ? generatedAt : source.metadata?.sourceImportedAt
    }
  };
}
