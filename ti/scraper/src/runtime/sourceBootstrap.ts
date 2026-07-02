import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importSeedBundle, seedDuplicateKey } from "../registry/sourceSeeds.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

export type RuntimeSourceBootstrapResult = {
  generatedAt: string;
  sourceTarget: number;
  seedPaths: string[];
  importedSourceCount: number;
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
  "public_cti_starter_pack.json",
  "public_telegram_channel_packs.json",
  "public_threat_intel_generated_sources.json",
  "high_value_exposure_source_candidates.json",
  "restricted_metadata_source_packs.json"
].map((name) => join(dirname(fileURLToPath(import.meta.url)), "..", "..", "seeds", name));

export function bootstrapRuntimeSources(store: SourceStore, input: RuntimeSourceBootstrapInput = {}): RuntimeSourceBootstrapResult {
  if (!input.batched && typeof store.batch === "function") {
    return store.batch(() => bootstrapRuntimeSources(store, { ...input, batched: true }));
  }

  const generatedAt = input.generatedAt ?? nowIso();
  const sourceTarget = input.sourceTarget ?? Number(Bun.env.TI_SOURCE_TARGET_COUNT ?? "1000");
  const seedPaths = input.seedPaths ?? configuredSeedPaths();
  const existingByKey = new Set(store.listSources().map(seedDuplicateKey));
  const errors: RuntimeSourceBootstrapResult["errors"] = [];
  let importedSourceCount = 0;
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

    const report = importSeedBundle(bundle, { importedAt: generatedAt, existingSources: store.listSources() });
    for (const source of report.accepted as SourceRecord[]) {
      if (!shouldImportSource(source)) {
        skippedSourceCount++;
        continue;
      }
      const duplicateKey = seedDuplicateKey(source);
      if (existingByKey.has(duplicateKey)) {
        skippedSourceCount++;
        continue;
      }
      existingByKey.add(duplicateKey);
      store.saveSource(prepareRuntimeSource(source, path, generatedAt));
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
    skippedSourceCount,
    activeSourceCount,
    totalSourceCount: sources.length,
    shortfall,
    blocker: shortfall > 0 ? `source_registry_shortfall:${sources.length}/${sourceTarget}` : undefined,
    errors
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

function prepareRuntimeSource(source: SourceRecord, seedPath: string, generatedAt: string): SourceRecord {
  const activate = Bun.env.TI_SOURCE_SEED_ACTIVATE !== "false" && source.risk !== "medium" && source.risk !== "high" && source.risk !== "restricted";
  return {
    ...source,
    status: activate ? "active" : source.status ?? "candidate",
    createdAt: source.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    metadata: {
      ...(source.metadata ?? {}),
      productionCollection: true,
      canaryPortfolio: true,
      sourceSeedPath: seedPath,
      sourceImportedAt: generatedAt
    },
    crawlState: {
      ...(source.crawlState ?? {}),
      retryCount: source.crawlState?.retryCount ?? 0
    }
  };
}
