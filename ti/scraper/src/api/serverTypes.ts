import type { RuntimeConfig } from "../config/runtimeConfig.ts";
import type { FocusedFrontier } from "../frontier/frontier.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { InMemoryOrgAlertCaseActionLedgerRepository } from "../storage/orgAlertCaseActionLedgerPostgres.ts";

export interface ApiServerOptions {
  port?: number;
  store: ScraperStore;
  frontier: FocusedFrontier;
  config?: RuntimeConfig;
  supervisor?: { snapshot(): unknown[] };
  objectStore?: unknown;
  canaryLoop?: unknown;
  authApiBase?: string;
  authFetch?: typeof fetch;
  orgAlertCaseActionLedgerRepository?: InMemoryOrgAlertCaseActionLedgerRepository;
  [key: string]: unknown;
}

export interface ApiServerHandle {
  server: ReturnType<typeof Bun.serve>;
  port: number;
  stop(): void;
}
