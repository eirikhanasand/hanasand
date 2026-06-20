Status: active_program_be_apify_store_and_public_api_conversion

Read `coordination_product_focus.md` first. The Actor is the first revenue vehicle. Prioritize daily 20-group run proof, Store/pricing/payout clarity, dataset sample quality, useful/fresh row metrics, and Apify usage/conversion tracking over internal frontend/API abstractions.

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
