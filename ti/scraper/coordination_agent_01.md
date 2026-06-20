Status: active_product_focus_source_ladder_100_to_1000

# Agent 01 Coordination

Read `coordination_product_focus.md` first. Your current task is to turn completed source economics into the first 100 vetted public TI sources, then prepare the 1,000-source candidate tier. Do not add more source portfolio theory until the 100-source pack has product-value proof for Apify/public search.

Live product proof to optimize against: Apify run `rh6D0UInDD6x7GuuD` on the 20 default groups returned 98 rows for about `$0.0023`, but 80 rows were thin, 69 were single-source, APT28 had no evidence, and APT29 rows were stale. Your first-100 source pack should specifically reduce those failures before expanding toward 1,000.

Deliverables:
- `first100` source pack: source id/name/family/public URL or safe locator hash, legal/robots note, parser family, actors/query classes improved, expected freshness, expected entities, dedupe group, rejection reason if rejected, and buyer-value score.
- Candidate pipeline for 1,000 ranked sources with dedupe/rejection metrics.
- Handoff to Agent 03 parser coverage and Agent 02 scheduler cadence.
- Proof commands and a compact summary of how the pack improves daily 20-group Actor output.

## Completed Slice - Program BI: Source Reliability Economics And Activation Planning

- Added `/v1/sources/atlas.sourceEconomics` as a dry-run source portfolio economics packet for first-50, first-500, and first-5000 public-source rollout planning.
- Included per-source rows with source ids/hashes, family, query-class coverage, expected actor/query coverage, unique evidence yield, duplicate risk, parser/legal dependencies, language/region coverage, storage and scheduler cost, API/Actor usefulness, public-answer lift, economics score, decision, and rollback state.
- Included source-family metrics, marketplace value breakdowns for actor profile, ransomware victim claim, CVE/advisory, public-channel, dark-metadata corroboration, and STIX/export value, plus stale/noisy/legal/parser/low-yield/high-cost degradation queues.
- Kept all outputs source-id/hash oriented and dry-run only: no registry mutation, no source activation, no source-pack import, no worker lease, no crawling, no raw unsafe URLs, no payload downloads, and no private/invite/auth/CAPTCHA sources.
- Updated shared `/v1/sources/atlas` coordination contract and `docs/source_registry.md` before changing the shared API response.
- Verification is green: `bun run check`, `bun test src/tests/sourceSeeds.test.ts src/tests/api.test.ts src/tests/productionAdapterRuntime.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (526 pass).

## Next Agent 01 Task Request

- Program BJ is the next named continuation: tenant-aware source policy overlays and paid-product source pack segmentation.
- Please provide the BJ scope or confirm the expected shared contract fields/routes for tenant overlays, paid/free source-pack tiers, buyer-facing entitlements, and activation boundaries.
