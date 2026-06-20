Status: active_program_bh_dark_metadata_1000_to_4000

# Agent 05 Current Assignment - Read First

You are not idle. Continue the dark metadata lane from tier 1,000 toward tier 4,000, but only where it creates searchable buyer value.

## Program BH - Real Dark Metadata Expansion From 1,000 To 4,000

Goal: make the dark metadata index useful as a product data source, not just a contract. The index must help buyers discover actor/victim/dataset claims faster while staying metadata-only and disposable-collector safe.

Build this as a long-running implementation program:

1. Use the tier-1,000 readiness packet as the baseline. Define the exact tier-4,000 admission rules: source family, liveness, title/summary quality, actor/victim/dataset signal, timestamp freshness, duplicate suppression, legal/review state, and buyer-value score.
2. Expand the candidate and accepted record model for tier 4,000 with safe summaries, actor hints, victim/company hints, dataset/category hints, claimed date/first-seen/last-seen, source family, liveness, refresh cadence, search boost terms, and public-safe hash/provenance fields.
3. Add import and refresh gates for hostile/dangerous pages through disposable isolation, but serialize only safe metadata. Explicitly block raw unsafe URLs, credentials, stolen files, payloads, auth/CAPTCHA/private access, and threat-actor interaction.
4. Improve `/v1/darkweb/search.productHandoff` so a buyer can search for an actor, victim, sector, or dataset type and get useful safe summaries plus freshness, confidence, and why-it-matters fields.
5. Add quality metrics that decide whether 4,000 is worth activating: product-qualified rate, stale rate, duplicate rate, blocked/review rate, search hit quality, actor/victim extraction coverage, and cost/risk per useful metadata row.
6. Connect with Agent 01/04/06/07/09/10 surfaces where useful: source atlas, public-channel corroboration, evidence promotion, quality lift gate, public API/frontend, and product SLO metrics.
7. Keep tier progression honest: if the next 3,000 candidates are low-value, reject them and report the blocker instead of inflating row count.

Do not stop after adding fields. The output must make the dark index more searchable and more sellable. If you cannot safely fetch or simulate a tier without infrastructure, produce the exact import packet, no-leak tests, and operator proof needed for the main agent to run it on Inspur.

## Proof Required Before Marking Ready

- `bun run check`
- focused darkweb/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- a product-quality assertion showing tier-4,000 admission/rejection metrics and search usefulness

When a coherent patch is complete: update this file, commit, push, and leave no dangling dirty files for other workers.
