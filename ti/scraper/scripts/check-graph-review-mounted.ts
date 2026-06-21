import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import { seedRun, source } from "./graph-review-mounted/fixtures.ts";
import {
  acceptedEdgeProof,
  blockExportProof,
  discoveryOnlyManualReviewProof,
  invalidRelationshipProof,
  noExportReadyProof,
  rejectedEdgeProof
} from "./graph-review-mounted/proofs.ts";
import type { ProofResult } from "./graph-review-mounted/types.ts";

const store = new InMemoryScraperStore();
store.saveSource(source());
const acceptedRun = seedRun(store, "accepted", {
  graphReviewState: "accepted",
  graphReviewReason: "analyst accepted mounted endpoint proof"
});
const rejectedRun = seedRun(store, "rejected", {
  graphReviewState: "rejected",
  graphReviewReason: "analyst rejected mounted endpoint proof"
});
const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
const baseUrl = `http://127.0.0.1:${server.port}`;
const results: ProofResult[] = [];

try {
  results.push(await acceptedEdgeProof(baseUrl, acceptedRun));
  results.push(await rejectedEdgeProof(baseUrl, rejectedRun));
  results.push(await discoveryOnlyManualReviewProof(baseUrl, acceptedRun));
  results.push(await blockExportProof(baseUrl, acceptedRun));
  results.push(await invalidRelationshipProof(baseUrl, acceptedRun));
  results.push(await noExportReadyProof(baseUrl, rejectedRun));
} finally {
  server.stop();
}

const ok = results.every((result) => result.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:graph-review-mounted",
  endpoints: ["/v1/graph/review-plan", "/v1/graph/cutover-report", "/v1/exports/stix"],
  scenarios: results,
  expectedOutput: "ok=true; accepted edge ready, rejected/no-export-ready blocked, examples blocked, invalid relationship id returns 404"
}, null, 2));

if (!ok) process.exit(1);
