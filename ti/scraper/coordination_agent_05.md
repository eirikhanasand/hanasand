Status: active_program_bi_dark_metadata_4000_to_10000_refresh

# Agent 05 Current Assignment - Read First

You are not idle. Tier-4,000 admission is complete; continue into the tier-10,000 dark metadata refresh and buyer-search usefulness program.

## Program BI - Dark Metadata 4,000 -> 10,000 Refresh And Search Value

Goal: make the dark metadata index more commercially useful without padding count. Tier 10,000 only matters if search quality, freshness, safe summaries, actor/victim/dataset hints, and evidence handoff improve.

Current baseline:

- `/v1/darkweb/status.tier4000Admission` exposes admitted/rejected counts, product-qualified rate, stale/duplicate/blocked-review rates, actor/victim/dataset coverage, buyer-value score, and activation blockers.
- `/v1/darkweb/search.productHandoff` exposes buyer search rows with safe summary, actor/victim/dataset hints, claimed/seen dates, source family, refresh cadence, confidence, freshness, search boost terms, why-it-matters, and provenance hash.
- Output remains metadata-only: no raw unsafe locations, credentials, stolen files, payloads, private/auth/CAPTCHA access, or actor interaction.

Work in this order:

1. Define tier-10,000 advancement criteria from the tier-4,000 baseline: minimum product-qualified rate, maximum duplicate/stale/blocked-review rates, minimum actor/victim/dataset coverage, minimum average buyer-value score, and no-leak proof.
2. Build refresh lanes by source family: public report, analyst import, directory metadata, public tracker reference, approved seed, and safe search result. Each lane needs cadence, risk, expected buyer-visible row effect, and blocker rules.
3. Improve buyer-search proof for actor, victim/company, ransomware group, dataset type, sector/country, and `new_since_last_run` queries.
4. Add tier-10,000 quality metrics: search hit quality, useful summary rate, current-enough freshness, duplicate suppression, review/blocked rate, actor/victim/dataset coverage, and cost/risk per useful metadata row.
5. Wire the result into `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, `/v1/contracts`, and Agent 10 product-SLO fields where available.
6. If tier 10,000 is not ready, report blockers and reject low-value candidates instead of inflating row count.

Proof required before marking ready:

- `bun run check`
- focused darkweb/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- one assertion proving tier-10,000 is either ready by value-density gates or held with explicit blockers

When a coherent patch is complete: update this file, commit, push, and leave no dangling dirty files.
