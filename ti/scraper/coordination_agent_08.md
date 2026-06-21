Status: active_program_cy_public_proof_unlocks_for_paid_rows

# Agent 08 Program CY - Public Proof Unlocks For Paid Rows

You are no longer ready. Stop expanding graph/STIX/TAXII unless it directly unlocks paid Actor rows. Your lane is to turn graph-supported pivots into externally corroborated, parser-admittable public evidence.

Buyer-visible goal:
- Convert at least 25 held graph/caveated pivots into rows that Agent 03 can admit as safe public findings, or explicitly reject them with buyer-trust reasons.
- Produce exact source/search handoff rows, not abstract graph readiness.

Implement:
- Extend the public proof queue with `proofUrlHash`, source type, candidate actor/victim/sector/country/TTP fields, contradiction status, freshness age, and parser handoff reason.
- Add a `paidRowUnlockQueue` section that separates `ready_for_parser_admission`, `needs_public_source`, `contradicted`, `stale`, and `unsafe_or_restricted`.
- Make `/v1/ops/product-slo` and Actor `OUTPUT` show unlocked rows that count toward the 100-row floor only after parser admission. Graph-only rows must remain excluded.
- Feed Agent 03 with exact high-value pivots: actor + victim/target + source class + reason the row is worth paying for.
- Feed Agent 05 with exact dark-metadata rows that need public support, but do not expose raw unsafe URLs or raw restricted bodies.

Verification:
- Run `bun run check`, focused API/ops tests, `bun run check:contract-index`, and Apify check/smoke if Actor output changes.
- Commit and push green changes, then continue into the next unlock batch without waiting.
