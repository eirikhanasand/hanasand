import { PostgresScraperStore } from "./storage/postgresScraperStore.ts";
import { startApiServer } from "./api/server.ts";
import { loadRuntimeConfig } from "./config/runtimeConfig.ts";
import { FocusedFrontier } from "./frontier/frontier.ts";
import type { ApiServerOptions } from "./api/serverTypes.ts";

// Query service only: no collection, model loading, migrations or retention work.
const config = loadRuntimeConfig();
const store = await PostgresScraperStore.create({ readOnly: true, deferHighVolumeHydration: true, deferStartupChecks: true });
const options: ApiServerOptions = { port: config.port, config, store, frontier: new FocusedFrontier({ maxQueueSize: 1, defaultPerSourceConcurrency: 1 }), readOnly: true };
const server = startApiServer(options);
let refreshing = false;
const refresh = setInterval(async () => {
  if (refreshing) return;
  refreshing = true;
  try {
    await store.refreshReadOnlyRecords();
  } catch (error) { console.error("Intelligence replica refresh failed", error instanceof Error ? error.message : "unknown"); }
  finally { refreshing = false; }
}, 15_000);
process.once("SIGTERM", () => { clearInterval(refresh); void server.stop().then(() => (options.store as PostgresScraperStore).close()); });
