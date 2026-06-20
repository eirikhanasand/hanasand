- Added tier-10,000 dark metadata refresh/search value gates for `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, and `/v1/contracts`.
- Defined source-family refresh lanes, advancement criteria, buyer-search proof, quality metrics, no-leak serialization, and explicit value-density blockers so low-value candidates are rejected instead of counted.
- Added darkweb/API assertions for the tier-10,000 status, search handoff, contract fields, source-family lanes, safe sample rows, and held-with-blockers decision.
- Repaired the unrelated Program BR live freshness gate duplicate so `bun run check` and full tests stay green.
- Proofs green: `bun run check`, focused darkweb/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test`.

## Main Agent Assignment - 2026-06-20 20:30 CEST

Status: active_program_bj_live_dark_metadata_value_expansion

You are not idle. Continue as the owner of the dark/restricted metadata product lane, but keep it tied to buyer-visible value rather than source-count inflation.

## Program BJ - Live Dark Metadata Value Expansion Toward 60k

Goal: turn the darkweb index from fixture/contract value into a real, refreshed, searchable metadata product that helps buyers find new actor/victim/dataset claims faster than public news. The scale path is 100 -> 1,000 -> 4,000 -> 10,000 -> 20,000 -> 60,000, but no tier advances unless useful-row quality improves.

Work in this order:

1. Build the next tier packet for 1,000 and 4,000 real candidate metadata records, with each candidate carrying source family, safe locator hash, actor hints, victim hints, dataset/claim type, sector/country when visible, first/last seen, liveness, freshness, buyer-value score, review state, and no-leak proof.
2. Add refresh scheduling semantics for approved public/restricted metadata sources: cadence, last success, next due, failure reason, parser family, source-family diversity impact, and expected rows/day. Do not fetch raw leaks, credentials, payloads, private/auth/CAPTCHA pages, or interact with threat actors.
3. Add buyer-search proof for actor queries, victim/company queries, ransomware group queries, dataset type queries, sector/country pivots, and `new since last run` pivots. The proof must show concrete useful sample rows without raw unsafe locations.
4. Add value gates that reject low-value candidates before count expansion: duplicates, stale mirrors, generic directory listings, no actor/victim/dataset hints, unsafe output risk, review/legal hold, auth/CAPTCHA/private dependency, or low buyer-value score.
5. Wire results into existing surfaces only: `/v1/darkweb/status`, `/v1/darkweb/search`, `/v1/contracts`, `/v1/ops/product-slo`, Apify output if already available. Avoid a new endpoint unless absolutely required.
6. Add focused tests proving tier advancement is blocked by low value and allowed only when payworthy density, freshness, useful summaries, actor/victim/dataset coverage, duplicate suppression, and no-leak serialization pass.

Metric targets for this batch:

- Increase real or ready-to-import value-qualified metadata candidates toward 1,000 without reducing quality.
- Keep `averageBuyerValueScore >= 0.68` for any promoted tier.
- Keep stale rate <= 28%, duplicate rate <= 16%, blocked/review rate <= 18%.
- Show at least 20 useful buyer queries and 12 useful safe sample rows per tier packet.
- Every row must explain why it is worth paying for, or be rejected.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here with tier counts, useful-row rate, average buyer value, rejected low-value count, sample buyer queries, no-leak proof, and next blockers.

When a coherent patch is complete: update this file, commit, push, and continue into the next tier batch without waiting. Leave no dangling dirty files.
