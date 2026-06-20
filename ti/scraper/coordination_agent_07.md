Status: active_program_bz_paid_row_contradiction_and_false_positive_suppression

# Agent 07 Coordination

- Completed Program BV paid-row entity specificity lift across Apify `OUTPUT`, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/contracts`, `/v1/ops/product-slo`, and route inventory.
- Added 20 entity-specificity fixtures across APT29, APT28, APT42, Turla, Volt Typhoon, Lazarus Group, Sandworm, Scattered Spider, LockBit, Akira, Clop, Black Basta, RansomHub, Play, Qilin, and Unknown Actor Query.
- Covered missing buyer-visible fields for victim, sector, country, dataset/impact, TTP/tool, first/last seen, confidence, caveat, contradiction state, provenance hash, and next analyst action.
- Added gates for old rows, alias-only rows, single-source-without-caveat rows, unrelated actors, contradicted claims, metadata-only rows without public support, missing buyer action, and generic entity fields.
- Recorded specificity lift: 14 rows lifted, 4 rows suppressed, 2 rows held with repair action, 25 blocker codes removed, and 0.161 average buyer-value delta.
- Added owner handoffs for Agent 01, 03, 04, 05, 07, 08, 09, and 10 with no raw evidence, unsafe URLs, restricted payloads, or object keys exposed.
- Verification passed: `bun run check`, focused pipeline/API/ops tests, Apify Actor check, Apify smoke, route inventory check, contract index check, and full `bun test`.

You are not idle. Continue the quality lane by protecting paid output from false positives and contradicted claims. This is a monetization task: one wrong actor/victim/TTP row can destroy buyer trust faster than ten good rows help it.

## Program BZ - Paid Row Contradiction And False-Positive Suppression

Goal: make the Actor and `/v1/intel/search` reject or caveat rows that look specific but are not safe to sell because they are contradicted, alias-collided, victim-name ambiguous, old/reposted, single-source without caveat, or wrong-actor/wrong-family matches.

Work in this order:

1. Inspect current Apify rows, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/contracts`, `/v1/ops/product-slo`, and the latest entity-specificity fixtures.
2. Add or refine a compact `falsePositiveSuppressionGate` on existing surfaces only: Apify `OUTPUT`, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/contracts`, and `/v1/ops/product-slo`.
3. Add at least 25 fixtures across:
   - APT/ransomware alias collisions
   - victims with common names
   - unrelated actor co-mentions
   - stale reposts presented as current activity
   - single-source rows that must remain caveated
   - metadata-only leads without public support
   - true positives that must stay sellable
   - unknown/random actor searches that must stay searching or suppressed
4. For each fixture, record current paid-row decision, corrected decision, blocker/reason code, expected buyer-visible effect, required repair owner, and no-leak proof.
5. Add measurable lift: false positives suppressed, contradicted rows held, stale reposts blocked, single-source rows caveated, true positives preserved, sellable rows protected, buyer-trust delta, and rows prevented from billing.
6. Coordinate parser/source fixes to Agent 03/04/05, graph contradiction fixes to Agent 08, conversion impact to Agent 09, and release economics to Agent 10.
7. Do not add broad quality architecture unless it directly changes row billing, buyer-visible caveats, or suppression behavior.

Metric targets:

- Suppress or hold at least 10 unsafe/noisy rows.
- Preserve at least 8 true positive sellable rows.
- Every suppressed row must name a concrete reason and next repair action.
- No raw evidence bodies, unsafe URLs, restricted payloads, object keys, private material, account material, or actor-interaction content.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/pipeline.test.ts src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here with rows suppressed/held/preserved, buyer-trust delta, owner handoffs, billing impact, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next paid-row quality batch without waiting. Leave no dangling dirty files.
