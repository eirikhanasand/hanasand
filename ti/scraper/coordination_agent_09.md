Status: active_program_be_apify_store_and_public_api_conversion

## Main Agent Update - 2026-06-20 17:05 CEST

Monetization is configured in Apify: upcoming pricing starts July 4, 2026, `Result` / `apify-default-dataset-item` is `$3.00 / 1,000`, `Actor Start` is `$0.00005`, platform usage is included for users, and Apify margin is 20%. Published build is `0.6.3`. Latest proof run: `dQzvWhNM2OHrBWVfo`, dataset `aP1dqnK7uEezn5jJv`, 15 rows, 3.1s, usage about `$0.00075`; after pricing takes effect those 15 rows would be about `$0.045` gross row revenue.

Your next work is conversion proof and listing/API readiness: update store readiness packets with the new build/run/pricing/effective date, explain payout/beneficiary verification as an external billing blocker without storing secrets, add sample-output summaries for the proof dataset, and track views/runs/users/conversion. When your patch is coherent, run focused tests, commit, push, and leave no hanging files.

Read `coordination_product_focus.md` first. The Actor is the first revenue vehicle. Prioritize daily 20-group run proof, Store/pricing/payout clarity, dataset sample quality, useful/fresh row metrics, and Apify usage/conversion tracking over internal frontend/API abstractions.

Live product proof baseline: Apify run `rh6D0UInDD6x7GuuD` on the 20 default groups succeeded in ~10 seconds, produced 98 safe rows, cost about `$0.0023`, had zero no-leak failures, but had 80 thin rows, 69 single-source rows, stale APT29 rows, and no-evidence APT28 rows. Use this run as the marketplace conversion baseline until a stronger run replaces it.

## Current Assignment - Program BE: Apify Store And Public API Conversion

You are no longer waiting for a task. Continue the API/product-surface lane until the Apify Actor and `/ti` public API look buyer-ready, explainable, and monetizable.

Mission:
- Improve the public product surface: store listing metadata, sample input/output, API compatibility, frontend progressive updates, pricing hooks, useful proof links, and customer-facing contracts.
- Keep public output safe and compact: no raw leaked data, no credentials, no private/auth/CAPTCHA content, no inflated claims, no placeholder copy, no "not indexed" dead end.

Build:
- Add a route/API contract that mirrors the Apify Actor's exact default sample input and one or more verified sample outputs for APT29, Volt Typhoon, Scattered Spider, and one ransomware group.
- Add a "store readiness" packet that exposes whether Apify listing fields are complete: title, description, README, changelog, categories, example input, pricing model, payout/monetization status if available without secrets, latest build, latest proof run, dataset sample, and known blockers.
- Add public proof DTOs that can be consumed by `/ti` and the Actor README: run ID, build version, dataset ID, query, row count, freshness, source families, safety contract, and no-leak proof.
- Add frontend/API compatibility contracts for partial/ready/queued/searching states, empty deltas, progressive refresh, and "searching" copy for unknown actors.
- Add marketplace conversion guardrails: no placeholder/example actor defaults, no generic categories in local manifests, no hello-world sample input in any local publication file, and no AI-flavored copy.
- Coordinate with Agent 04 coverage-gap fields, Agent 07 quality gates, and Agent 10 product SLO/revenue telemetry.

Proof before status change:
- `bun run check`
- `bun run check:api-regression`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- focused API tests for store readiness/proof DTOs
- remote/public proof command documented in coordination notes
- docs update for Apify publication and payout blockers

If this phase completes, continue immediately into Program BF: pricing/usage experiment telemetry and weekly marketplace optimization loop.

# Agent 09 Coordination

- Hardened the Apify public-threat-actor monitor contract surface with coverage-gap input schema, expanded dataset schema, scheduler/source-coverage fields, and explicit safe-metadata-only safety fields.
- Strengthened the Apify smoke proof so every emitted row must expose no-raw-content safety, analyst review reasons, source coverage, scheduler reuse, and coverage-gap follow-up fields.
- Restored shared green baseline while preserving the long-running trustworthy product direction: public advisory search hardening, live product SLO route typing, graph incident claim typing, source reliability economics, source burn-rate remediation, and tenant activation approval packets.
- Verified `bun run check`, full `bun test`, `bun run check:apify-threat-actor-monitor`, and `bun run smoke:apify-threat-actor-monitor`.

Historical note: Agent 09 previously requested the next API/product-surface task; the active Program BE assignment above supersedes that request and should be continued until proof is complete.
