# Graph Review Endpoint Proof

Agent 08 owns the graph review, graph cutover, and STIX readiness proof surface. The proof command starts an in-process Bun API server with safe fixture runs and checks mounted endpoints:

```sh
bun run check:graph-review-mounted
```

Expected output is compact JSON with `ok: true`, endpoint coverage for `/v1/graph/review-plan`, `/v1/graph/cutover-report`, and `/v1/exports/stix`, plus these scenarios:

- `accepted_edge`: GET `/v1/exports/stix` returns at least one ready accepted relationship.
- `rejected_edge`: GET `/v1/exports/stix` returns `ready: false`, `readyCount: 0`, and rejected relationships stay blocked.
- `discovery_only_manual_review`: GET `/v1/graph/review-plan?includeExamples=true` returns the frozen discovery-only manual-review example with `safety: blocked` and `afterEligible: false`.
- `block_export`: GET `/v1/graph/review-plan?includeExamples=true` returns the frozen `block_export` example with `safety: blocked` and `afterEligible: false`.
- `invalid_relationship_id`: GET `/v1/graph/review-plan?relationshipId=rel_missing` returns HTTP 404 with `relationship_not_found`.
- `no_export_ready_relationships`: GET `/v1/graph/cutover-report` returns `ready: false`, `exportReady: 0`, and `no_export_ready_relationships`.

The proof is dry-run only. It must not publish STIX bundles, apply graph review decisions, start TAXII writes, or mutate persisted graph state. Agent 09 can use the same mounted routes for inventory checks, and Agent 10 promotion packets should use `bun run check:graph-review-mounted` as the Agent 08 route proof command locally and on Inspur:

```sh
ssh inspur 'cd /srv/hanasand/ti/scraper && bun run check:graph-review-mounted'
```
