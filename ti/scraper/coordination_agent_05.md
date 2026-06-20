Status: active_product_focus_dark_metadata_tier100

## Main Agent Update - 2026-06-20 17:05 CEST

The Actor is now monetized in Apify with pay-per-event pricing scheduled for July 4, 2026. Your dark metadata work is only valuable if it becomes real searchable metadata that improves paid rows. Latest proof run `dQzvWhNM2OHrBWVfo` has no dark/public-channel coverage and shows clear buyer value for current ransomware/public extortion metadata, especially when it can corroborate LockBit-style activity without exposing unsafe raw locations.

Continue Tier 100, but prioritize records that can feed Apify/public search with safe summaries, actor/victim/date/category/liveness/legal-risk/search terms, and source-family lift. Do not add another synthetic 60k packet. When Tier 100 is real and searchable, immediately start Tier 1,000 ranking criteria. When your patch is coherent, run focused tests, commit, push, and leave no hanging files.

# Agent 05 Coordination

Read `coordination_product_focus.md` first. Your next work is not another dark-web readiness contract. It is the first buyer-visible dark/hidden metadata tier: real, searchable, safe summaries that can make the Apify Actor and `/ti/darkweb/index` more useful.

## Current Assignment: Program BF Real Dark Metadata Tier 100

Build the first production-shaped tier of the dark/hidden metadata index. The goal is 100 real candidate records from allowed discovery surfaces, with safe metadata summaries, search fields, liveness state, legal-risk classification, source-family tags, dedupe state, and proof that no raw stolen data, credentials, payloads, unsafe URLs, private/auth/CAPTCHA material, or actor-interaction content enters public output.

Priorities:

- Convert the operations model into a tier-100 import/search path using safe discovery sources first: public reports, analyst-imported onion/domain lists, directory/search result metadata, public ransomware tracker references, and existing approved source seeds.
- Produce a clear split between accepted, duplicate, blocked, review-needed, and stale/dead records.
- Add or update fixtures so `/v1/darkweb/status`, `/ti/darkweb/index` contracts, and Apify/public search can show useful dark metadata summaries without exposing raw locations or unsafe evidence.
- Define the exact criteria for advancing from 100 to 1,000 records: dedupe rate, summary usefulness, category coverage, liveness confidence, legal-risk distribution, false-positive review count, and no-leak proof.
- Coordinate with Agents 01/04 for source candidates, Agent 03 for parser failures, Agent 06 for search/read model shape, Agent 07 for quality gates, Agent 09 for public/API display, and Agent 10 for cost/run proof.

Do not spend this pass on more synthetic 60k scale planning unless it directly helps tier 100 become real and searchable. When tier 100 is proven, continue into tier 1,000 candidate ingestion and ranking without waiting for another prompt.

## Progress - 2026-06-20 17:18 CEST

- Added route-visible tier-100 product proof under `/v1/darkweb/status.tier100Product` with 100 safe metadata descriptors split into accepted, duplicate, blocked, review-needed, and stale/dead groups.
- Added source-family lift rows for public reports, analyst imports, directory metadata, public tracker references, approved seeds, and safe search results.
- Added `/v1/darkweb/search.productHandoff` so Apify/public search can consume actor/victim hints, category, legal triage, liveness, safe summary, source family, last-seen, and safe record IDs without raw locations.
- Added tier-1,000 advancement criteria: accepted records, duplicate rate, useful summary rate, actor-hint coverage, category coverage, blocked unsafe rate, false-positive review count, no-leak proof, and Apify search lift.
- Updated darkweb/API focused tests and `docs/operations.md`.
- Focused proof is green: `bun test src/tests/darkwebIndex.test.ts` and `bun test src/tests/api.test.ts -t "routes darkweb metadata index status and search without unsafe leaks"`.
- Current blocker: repo-wide `bun run check` is blocked by unrelated dirty work in `src/frontier/schedulerProduction.ts` and `src/registry/sourceSeeds.ts`; do not mark Program BF complete until shared typecheck is green and the patch can be committed/pushed.

## Completed Summary

- Added the dark-web operations model for the 60k metadata-only index with Tor, I2P, Freenet, directory, analyst-import, and public-report refresh lanes.
- Added liveness/classification drift packets for newly alive/dead, category, legal-risk, source-reputation, duplicate-cluster, review-priority, and graph/export-hold changes.
- Added dark metadata search-quality metrics for category coverage, language hints, title/summary usefulness, entity extraction confidence, blocked unsafe evidence counts, false-positive rows, and public-safe display readiness.
- Added operator runbook controls for isolated collector pool, approved proxy boundary, disk budget, content-size cap, quarantine retention, emergency stop, rollback, and proof commands.
- Wired the model into `/v1/darkweb/status`, `/v1/contracts.semantics.darkwebIndex.operationsModel`, API tests, and `docs/operations.md`.
- Preserved strict metadata-only safety boundaries while allowing the product goal of controlled live public/metadata collection after approval and isolation: no stolen-file downloads, credential retrieval, payload following, private/auth/CAPTCHA access, raw unsafe URL output, or threat-actor interaction.
- Verification was green at completion: `bun run check`, `bun test`, `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run check:deploy-hygiene`.
