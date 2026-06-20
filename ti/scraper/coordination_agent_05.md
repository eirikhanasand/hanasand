Status: active_program_cr_dark_metadata_public_support_1000_to_4000

# Agent 05 Coordination

- Completed Program CK metadata-only public-support lift from 100 to 1,000 candidates.
- Added route-visible `publicSupportLift1000` semantics for `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, and `/v1/contracts.semantics.darkwebIndex`, with top-100 and tier-1,000 rows, strict outcome buckets, safe public-support source targets, parser fields, no-leak proofs, and Agent 03/04/06/07/08/09/10 handoffs.
- Current strict fixture result: current contribution 2; first 1,000 candidates include 19 `sellable_after_public_support`, 12 `useful_with_caveat`, 141 `restricted_only_hold`, and rejections of 285 stale, 6 duplicate, 333 unsafe, and 204 low-value. Only rows with safe public support count after corroboration, and no row counts now.
- Preserved approved boundaries: metadata-only; no raw leak bodies, stolen-file download, credentials, payloads, unsafe raw URLs, private/auth/CAPTCHA access, or threat-actor interaction.
- Proofs green: `bun run check`, `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:contract-index`, and full `bun test` (529 pass).

# Current Task: Program CR Dark Metadata Public-Support Lift From 1,000 To 4,000

Own the next dark/restricted metadata expansion tier, but keep it revenue-real: the goal is not a bigger index number, it is a larger pool of rows that can become paid Actor output once public corroboration is found.

Scope:
- Expand `publicSupportLift1000` toward a strict 4,000-candidate tier in the existing darkweb/product handoff routes, using the same metadata-only and no-leak proof rules.
- Produce route-visible counts for `currently_chargeable`, `sellable_after_public_support`, `useful_with_caveat`, `restricted_only_hold`, `stale_reject`, `duplicate_reject`, `unsafe_reject`, `low_value_reject`, `needs_parser_repair`, and `needs_source_support`.
- For each top candidate bucket, include actor/group hint, victim/dataset hint, sector/country hint if present, first/last seen, safe locator hash, public support source families required, buyer value reason, exact missing field, and owning worker handoff.
- Prioritize rows that can help reach the first 100 paid rows within 24-48h: named actor or ransomware group, named victim or dataset claim, current or recently changed, and at least one safe public-source path available.
- Reject directory junk, dead onions, generic market pages, old reposts, uncorroborated restricted-only rows, graph-only pivots, and anything that would require raw stolen data, credentials, payloads, private access, CAPTCHA/auth bypass, or threat-actor interaction.
- Hand parser repair to Agent 03, source acquisition to Agent 04, no-leak/provenance requirements to Agent 06, suppression/admission issues to Agent 07, graph pivots to Agent 08, Apify output fields to Agent 09, and paid release metrics to Agent 10.

Definition of done:
- Product/SLO/darkweb routes show a 4,000-tier support packet with accepted/rejected counts and projected contribution to the first 100 paid rows.
- Tests prove restricted-only/stale/duplicate/unsafe/low-value candidates cannot count as chargeable rows.
- Update this file and `coordination.md`, run appropriate Bun checks/tests, commit and push a coherent green change.
- If you finish early, continue directly into candidate quality repair for the highest-value rejected rows instead of stopping.
