import { startApiServer } from "./api/server.ts";
import { loadRuntimeConfig } from "./config/runtimeConfig.ts";
import { FocusedFrontier } from "./frontier/frontier.ts";
import { startCanaryCollectionLoop } from "./ops/canaryCollection.ts";
import { createLogger } from "./ops/logger.ts";
import { InMemorySourceRegistry } from "./registry/sourceRegistry.ts";
import { FileBackedScraperStore } from "./storage/fileBackedScraperStore.ts";
import { FileObjectEvidenceStore } from "./storage/fileObjectStore.ts";

const config = loadRuntimeConfig();
const logger = createLogger(Bun.env.SCRAPER_LOG_LEVEL === "debug" ? "debug" : "info");
const evidenceRoot = Bun.env.TI_EVIDENCE_ROOT
  ?? (config.environment === "production" ? "/var/lib/ti-scraper/evidence" : "/tmp/ti-scraper-evidence");
const evidenceMetadataPath = Bun.env.TI_EVIDENCE_METADATA_PATH ?? `${evidenceRoot}/metadata/scraper-store.json`;
const evidenceObjectDir = Bun.env.TI_EVIDENCE_OBJECT_DIR ?? `${evidenceRoot}/objects`;
const store = new FileBackedScraperStore({
  snapshotPath: evidenceMetadataPath
});
const registry = new InMemorySourceRegistry();
const frontier = new FocusedFrontier({
  maxQueueSize: Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500"),
  defaultPerSourceConcurrency: 1,
  crawlBudgetPolicies: {
    "public-canary": {
      taskLimit: Number(Bun.env.TI_CANARY_BUDGET_TASKS ?? "1000"),
      byteLimit: Number(Bun.env.TI_CANARY_BUDGET_BYTES ?? "512000000")
    }
  }
});
const objectStore = new FileObjectEvidenceStore({
  rootDir: evidenceObjectDir
});
const canaryQueueLimit = Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500");

const seed = registry.upsert({
  name: "Example security RSS seed",
  type: "rss",
  url: "https://example.com/feed.xml",
  accessMethod: "public_http",
  status: "paused",
  risk: "low",
  trustScore: 0.5,
  crawlFrequencySeconds: 3600,
  legalNotes: "Placeholder seed. Replace with approved public security RSS sources before collection."
});
if (Bun.env.TI_KEEP_PLACEHOLDER_SOURCE === "true") store.saveSource(seed);

const canary = startCanaryCollectionLoop({
  store,
  frontier,
  objectStore,
  enabled: Bun.env.TI_CANARY_ENABLED !== "false",
  intervalSeconds: Number(Bun.env.TI_CANARY_INTERVAL_SECONDS ?? "300"),
  maxTasks: Number(Bun.env.TI_CANARY_MAX_TASKS ?? "3"),
  maxSources: Number(Bun.env.TI_CANARY_MAX_SOURCES ?? "10"),
  queueLimit: canaryQueueLimit,
  operatorId: Bun.env.TI_CANARY_OPERATOR_ID ?? "startup-canary",
  activateSources: Bun.env.TI_CANARY_AUTO_ACTIVATE === "true",
  onCycle: (result) => logger.info("public canary collection cycle", { event: "canary.cycle", ...result }),
  onError: (error) => logger.warn("public canary collection failed", {
    event: "canary.error",
    error: error instanceof Error ? error.message : String(error)
  })
});
const server = startApiServer({ port: config.port, store, frontier, config, objectStore, canaryLoop: canary });
logger.info("ti-scraper started", {
  event: "service.started",
  port: server.port,
  apiVersion: config.apiVersion,
  memoryTargetMb: config.limits.maxMemoryMbTarget,
  memoryCeilingMb: config.limits.maxMemoryMbCeiling,
  publicCanaryEnabled: Bun.env.TI_CANARY_ENABLED !== "false",
  publicCanaryAutoActivate: Bun.env.TI_CANARY_AUTO_ACTIVATE === "true",
  evidenceRoot,
  evidenceMetadataPath,
  evidenceObjectDir
});

process.on("SIGTERM", () => {
  canary.stop();
  server.stop();
});
