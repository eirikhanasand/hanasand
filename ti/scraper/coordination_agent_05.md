Status: active_program_ck_dark_metadata_public_support_100_to_1000

- Completed Program CE metadata-only public-support worklist for the top 40 dark/restricted metadata candidates from `publicIntelligenceHandoff100`.
- Added `publicSupportWorklist40` on `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, and `/v1/contracts.semantics.darkwebIndex`, with safe source-family targets, parser fields, expected outcomes, no-leak proof, buyer rationale, and Agent 03/04/08/10 handoffs.
- Current strict fixture result: 40 selected, 2 public-support-ready/projected sellable after safe public support, 0 projected caveated, 11 still restricted-only, and rejections of 21 stale, 5 duplicate, 0 unsafe, 1 low-value; projected contribution to the 100 sellable row floor is 2.
- Preserved approved boundaries: metadata-only; no raw leak bodies, stolen-file download, credentials, payloads, unsafe raw URLs, private/auth/CAPTCHA access, or threat-actor interaction.
- Proofs green: `bun run check`, `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:contract-index`, and full `bun test` (529 pass).

# Current Task: Program CK Dark Metadata Public-Support Lift From 100 To 1,000

Own the dark/restricted metadata lane until it produces buyer-useful public-intelligence rows instead of contract-only index volume. The goal is to raise actual sellable-row contribution toward the first 100 paid rows, then define the next 1,000-row tier only from candidates that are worth paying for.

Scope:
- Expand the top-40 public support worklist into a tiered 100 -> 1,000 candidate worklist, but count only rows that can become sellable through safe public corroboration.
- For each candidate, include actor/group hint, victim/dataset/sector/country hint where present, first/last seen, source family, safe locator hash, required public support sources, parser fields needed, expected buyer value, no-leak proof, and exact rejection reason if it cannot be sold.
- Separate `sellable_after_public_support`, `useful_with_caveat`, `restricted_only_hold`, `stale_reject`, `duplicate_reject`, `unsafe_reject`, and `low_value_reject`.
- Prioritize rows that help analysts answer fresh actor activity questions: who is claiming activity, who is targeted, what is claimed, how fresh it is, and what public source corroborates it.
- Do not inflate the 60k ladder with directory junk, dead onions, generic market pages, graph-only pivots, stale reposts, or rows that have no actor/victim/dataset/search value.
- Hand off parser-specific repair needs to Agent 03, source acquisition needs to Agent 04, evidence/no-leak requirements to Agent 06, quality holds to Agent 07, graph support to Agent 08, marketplace fields to Agent 09, and release metrics to Agent 10.

Definition of done:
- Route-visible metrics show current contribution toward 100 real sellable rows and the first 1,000 tier with strict accepted/rejected counts.
- Tests prove restricted-only/stale/duplicate/unsafe/low-value candidates do not count as sellable.
- `bun run check`, focused darkweb/API/ops tests, contract checks, and full `bun test` are green.
- Update this file and `coordination.md`, then commit and push a coherent change. Do not leave dirty files behind.
