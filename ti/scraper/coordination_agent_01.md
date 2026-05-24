Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Responsive Source Activation For Arbitrary Actor Search

Build the source-activation contract for responsive public actor search. Do not wait for another prompt. Deliver approved public source selection, live discovery source packs, activation recommendations, freshness windows, source-family diversity, blocked source explanations, and safe public-only crawl eligibility for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, and one CVE. Explicitly prevent default/demo actor behavior and stale cache wording. Wire to `/v1/sources/coverage-closeout`, `/v1/sources/activation-batches`, `/v1/contracts`, `/v1/intel/search.sourceCoverage`, Agent 02, Agent 07, Agent 09, and Agent 10. Verify source/API/full tests, typecheck, route inventory, contract-index, source apply-plan, and cutover rehearsal.

# Agent 01 Summary

- Completed Task Z source rollout promotion packet and post-canary monitoring.
- Added dry-run `rolloutPromotion` packets for first-10 canary to 50-source expanded rollout, including rollback criteria, evidence-yield thresholds, Agent 02 cost controls, Agent 06 evidence certification, Agent 07 polling state, Agent 09 contract-index fields, and Agent 10 canary/release decisions.
- Wired promotion impacts through coverage closeout, activation batches, `/v1/contracts`, and `/v1/intel/search.sourceCoverage` for actor, ransomware/victim, CVE, malware/tool, country, sector, campaign, and infrastructure coverage.
- Preserved safe-public-only, non-mutating, non-crawling behavior with source retirement, duplicate suppression, parser-gap handoff, and post-canary drift monitoring.
- Updated shared coordination, source registry docs, contract-index proof, source/API tests, and repaired adjacent public-channel promotion certification normalization so the full suite stays green.
- Patched the restricted/leak metadata policy boundary so source-level approval/status/legal gaps create metadata-only review tasks instead of disappearing as policy rejections; unsafe raw payload/download/interaction targets remain blocked.
- Extended darknet metadata extraction/DTOs for affected accounts, account subjects, dataset size, and actor statement/description so victim/company notification context is visible without storing leaked contents.
- Added `/ti` analyst-loop response/UI wiring in the outer API and frontend: result states for queued, metadata_review, blocked_unsafe_target, needs_source_activation, and ready; metadata review inbox items; run-status clarity; source activation actions; and redacted victim notification packets.
- Verified `bun test src/tests/sourceSeeds.test.ts`, `bun test src/tests/api.test.ts`, `bun test src/tests/telegramPublic.test.ts`, `bun run check`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:source-apply-plan`, `bun run rehearse:cutover examples/cutover-rehearsal-pass.json`, and `bun test` pass.
- Latest verification for the policy/UI patch: `bun test src/tests/planner.test.ts`, `bun test src/tests/darknetMetadata.test.ts`, `bun test src/tests/pipeline.test.ts`, scraper full `bun test`, outer API `bunx tsc --noEmit`, frontend `bunx tsc --noEmit`, frontend `bun run build`, and a direct API utility proof for `Company X leaked, 50k accounts, 20 GB` pass. Scraper `bun run check` currently fails on unrelated pre-existing restricted-metadata symbol drift in `src/adapters/darknetMetadata.ts`.
- Superseded by active Task AA below; do not request another assignment until Task AA proof is complete.

## Main-Agent Task 2026-05-24 AA: Responsive Source Activation For Arbitrary Actor Search

Own the source-activation side of responsive public actor search. Convert the Task Z promotion packet into a production contract that makes unknown or under-covered actor queries immediately useful without seeded/default behavior: approved public source selection, live discovery source packs, activation recommendations, freshness windows, source-family diversity, and safe public-only crawl eligibility.

Deliver route-visible DTOs that explain, for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, a random actor, and one CVE, which approved public sources can answer instantly, which sources are queued for capture, which sources are blocked by policy/parser/legal gaps, and which source-pack additions would improve response quality. Explicitly prevent demo defaults: no hard-coded APT29 homepage behavior, no stale promoted-cache language, and no restricted/chat/leak sources counted as safe-public coverage. Wire impacts into `/v1/sources/coverage-closeout`, `/v1/sources/activation-batches`, `/v1/contracts`, `/v1/intel/search.sourceCoverage`, Agent 02 scheduling, Agent 07 public answer state, Agent 09 public wrapper contract, and Agent 10 release board. Verify source/API/full tests, typecheck, route inventory, contract-index proof, source apply-plan proof, and cutover rehearsal compatibility.
