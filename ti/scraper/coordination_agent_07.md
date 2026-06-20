Status: active_program_cp_paid_row_false_positive_and_freshness_hardening

# Agent 07 Coordination

- Completed Program CN first-100 paid row admission quality across pipeline quality evaluation, `/v1/ops/product-slo`, `/v1/intel/search`, route inventory, and Apify `OUTPUT`.
- Added admission rules for fresh, actor-specific, source-backed, source-family-supported, buyer-actionable, provenance-hashed, non-contradicted rows with unsafe/restricted-only/default/demo rows excluded.
- Added 48 fixture-corpus rows and a 100-row live SLO board covering accepted sellable, caveated useful, needs public support, stale/duplicate, alias collision, wrong actor, restricted-only, graph-only, synthetic/proof-only, generic source page, and low buyer-value cases.
- Exposed Agent 10 metrics for admitted, caveated, suppressed, parser-repair, source-support, dark-metadata-public-support, buyer-value delta, and row-count inflation blocked.
- Kept no-leak provenance boundaries intact and completed the half-wired darkweb public-support lift route so `/v1/darkweb/status` and `/v1/darkweb/search` remain route-safe.
- Verification passed: `bun run check`, Apify check/smoke, focused pipeline/API/ops tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:canary-proof-path`, and full `bun test` (529 pass).

# Current Task: Program CP Paid Row False Positive And Freshness Hardening

Own the buyer-trust gate for the first 100 paid rows. The current product is only monetizable if the rows that count as sellable are fresh, actor-specific, source-backed, non-leaky, and useful to analysts. Your job is to stop row-count inflation and raise paid trust without adding architecture for its own sake.

Scope:
- Audit the active 100-row candidate pool and the Apify smoke rows for stale/latest-activity errors, alias collisions, wrong-actor matches, generic source pages, unrelated co-mentions, graph-only pivots, restricted-only claims, synthetic/proof-only records, low buyer-value rows, and caveated rows incorrectly counted as chargeable.
- Add or tighten route-visible suppression/admission signals in existing quality structures (`/v1/ops/product-slo`, `/v1/intel/search`, Apify `OUTPUT`, pipeline quality reports) so buyers see why a row is chargeable, caveated, or suppressed.
- Preserve true positives: if a row has current public support, actor specificity, victim/dataset/claim context, provenance hash, and no-leak proof, make sure it survives the stricter gate.
- Produce actionable repair handoffs: parser fixes to Agent 03, missing source support to Agent 04, dark metadata holds to Agent 05, evidence/no-leak issues to Agent 06, graph corroboration to Agent 08, marketplace output wording to Agent 09, and paid release accounting to Agent 10.
- Focus on rows that can move the product from 3 smoke sellable rows toward 100 paid rows. Avoid STIX/TAXII, DTO, readiness, or coordination-only changes unless they directly change a buyer-visible quality metric.

Definition of done:
- Tests prove stale/latest-activity mistakes, alias collisions, wrong-actor matches, generic pages, restricted-only rows, and graph-only rows cannot count as sellable.
- Product SLO/Apify smoke/search output expose the false-positive suppression summary and the remaining fastest repairs to 100 rows.
- Update this file and `coordination.md`, run appropriate Bun checks/tests, commit and push a coherent green change.
- If you complete the first pass, immediately continue into a second batch of candidate audits rather than stopping.
