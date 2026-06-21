import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import { restrictedMetadataSources } from "./restricted-metadata-apply-plan/fixtures.ts";
import { runScenario } from "./restricted-metadata-apply-plan/scenario.ts";
import type { ProofResult } from "./restricted-metadata-apply-plan/types.ts";

const store = new InMemoryScraperStore();
for (const source of restrictedMetadataSources()) store.saveSource(source);
const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
const results: ProofResult[] = [];

try {
  results.push(await runScenario(server.port, "all_statuses", "/v1/restricted-metadata/apply-plan", {
    retentionExpiringWithinDays: 7,
    includeCutover: true
  }));
  results.push(await runScenario(server.port, "nested_ready", "/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
    actions: ["enable_metadata_only_queue"]
  }));
  results.push(await runScenario(server.port, "invalid_action", "/v1/restricted-metadata/apply-plan", {
    actions: ["solve_captcha_then_download"]
  }));
} finally {
  server.stop();
}

const ok = results.every((result) => result.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:restricted-metadata-apply-plan",
  endpoints: ["/v1/restricted-metadata/apply-plan", "/v1/sources/src_restricted_ready/restricted-metadata/apply-plan"],
  scenarios: results,
  expectedOutput: "ok=true; statuses cover restricted states, nested source returns one queue plan, invalid action returns 400, and responses redact unsafe material"
}, null, 2));

if (!ok) process.exit(1);
