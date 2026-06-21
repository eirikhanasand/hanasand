import type { RuntimeConfig } from "../config/runtimeConfig.ts";

export function buildRuntimeStores(config: RuntimeConfig) {
  const evidenceRoot = Bun.env.TI_EVIDENCE_ROOT
    ?? (config.environment === "production" ? "/var/lib/ti-scraper/evidence" : "/tmp/ti-scraper-evidence");
  return {
    evidenceRoot,
    evidenceMetadataPath: Bun.env.TI_EVIDENCE_METADATA_PATH ?? `${evidenceRoot}/metadata/scraper-store.json`,
    evidenceObjectDir: Bun.env.TI_EVIDENCE_OBJECT_DIR ?? `${evidenceRoot}/objects`
  };
}
