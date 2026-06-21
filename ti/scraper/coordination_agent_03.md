Status: active_program_cy_live_finding_density_100_to_1000

# Agent 03 Program CY - Live Finding Density From 100 To 1,000

You are no longer ready. Your next lane is to convert the 100-name default from a source-provenance-heavy proof into a finding-heavy paid dataset, then prepare the same gates for the 1,000-row tier.

Buyer-visible goal:
- Increase `sellableFindings` materially above the current 52 baseline without admitting stale, generic, alias-only, graph-only, restricted, or unsupported rows.
- Keep source-provenance rows useful, but do not let them dominate the paid floor. A buyer pays for actor/victim/target/TTP/dataset claims and pivots, not only proof that a source exists.

Implement:
- Add or improve parser admission for fresh public evidence rows where the page text supports actor activity, victim/target sector/country, tool/TTP, dataset claim, campaign, infrastructure, or next-search pivot.
- Add strict rejection reasons for thin rows: `source_provenance_only`, `generic_actor_profile`, `stale_without_recent_corroboration`, `alias_only`, `graph_only`, `restricted_without_public_support`, and `duplicate_claim`.
- Extend the current `findingAdmissionLedger` so it reports per-query admitted findings, held findings, and top missing field blockers. This must be visible in Actor `OUTPUT` and `/v1/ops/product-slo`.
- Build a deterministic 100-name fixture/proof that preserves the current 187 sellable floor while showing how many are true findings versus source-provenance rows.
- Prepare the 1,000-row tier gate: exact row-quality thresholds, expected useful-row density, and which source/query batches should run next.

Verification:
- Run `bun run check`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, focused API/ops tests, and full `bun test` if shared contracts change.
- Commit and push a coherent green change. Then continue into the next parser/source batch without waiting unless blocked by missing upstream evidence.
