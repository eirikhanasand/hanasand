import { publicSources, restrictedSources } from "./source-apply-plan/fixtures.ts";
import { runScenario } from "./source-apply-plan/scenario.ts";
import type { ProofResult } from "./source-apply-plan/types.ts";

const results: ProofResult[] = [];

results.push(await runScenario("happy_path", {
  sources: publicSources(),
  body: {
    queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
    sourcePackIds: ["safe-public-cti-starter-pack"],
    selectedActions: ["approve", "quarantine", "retire", "request_legal_notes", "leave_unchanged"],
    includeExecutionPreview: true
  }
}));
results.push(await runScenario("blocked_restricted_source", {
  sources: restrictedSources(),
  headers: { "x-tenant-id": "tenant_source_proof_restricted" },
  body: {
    queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
    selectedActions: ["activate", "quarantine", "request_legal_notes"],
    includeExecutionPreview: true
  }
}));
results.push(await runScenario("invalid_action", {
  sources: publicSources(),
  body: {
    queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
    selectedActions: ["launch_crawler"]
  }
}));

const ok = results.every((result) => result.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:source-apply-plan",
  endpoint: "/v1/sources/apply-plan",
  scenarios: results,
  expectedOutput: "ok=true; apply-plan stays dry-run, does not start crawling, does not mutate stores, blocks restricted activation, and rejects invalid actions"
}, null, 2));

if (!ok) process.exit(1);
