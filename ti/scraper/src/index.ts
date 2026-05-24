import { startApiServer } from "./api/server.ts";
import { loadRuntimeConfig } from "./config/runtimeConfig.ts";
import { FocusedFrontier } from "./frontier/frontier.ts";
import { createLogger } from "./ops/logger.ts";
import { InMemorySourceRegistry } from "./registry/sourceRegistry.ts";
import { InMemoryScraperStore } from "./storage/memoryStore.ts";

const config = loadRuntimeConfig();
const logger = createLogger(Bun.env.SCRAPER_LOG_LEVEL === "debug" ? "debug" : "info");
const store = new InMemoryScraperStore();
const registry = new InMemorySourceRegistry();
const frontier = new FocusedFrontier();

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
store.saveSource(seed);

const server = startApiServer({ port: config.port, store, frontier, config });
logger.info("ti-scraper started", {
  event: "service.started",
  port: server.port,
  apiVersion: config.apiVersion,
  memoryTargetMb: config.limits.maxMemoryMbTarget,
  memoryCeilingMb: config.limits.maxMemoryMbCeiling
});
