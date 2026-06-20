Status: active_program_ca_100_to_60000_revenue_gate

## Current Assignment - Program CA: 100 To 60k Revenue Gate

You are not idle. Own the ops/revenue truth layer for the new production target: 100 sellable Actor rows first, then staged growth toward 60,000 potentially buyable safe metadata rows.

Deliverables:

1. Update `/v1/ops/product-slo`, snapshots, route checks, docs, and tests so the production paid-traffic gate requires at least 100 sellable rows. Proof-sized runs may be marked as shape/safety proof but must not be treated as production monetization completion.
2. Add scale gates for 100, 1,000, 4,000, 10,000, 20,000, and 60,000 buyable rows. Each gate must require useful-row rate, fresh-row rate, corroboration/source-family diversity, no-leak proof, stale/duplicate/generic rejection, and cost per useful row.
3. Add a revenue blocker board item for `sellable_rows_below_100` with owners and exact next actions for Agents 01/03/04/05/07/08/09.
4. Ensure non-monetizing work still cannot count toward the row ladder unless it moves a buyer-visible metric or protects paid output.
5. Keep estimates honest: no fake users, revenue, payout state, or platform cost. Unknown Apify analytics remain unknown.

Verification before stopping:

- `bun run check`
- `bun test src/tests/ops.test.ts src/tests/api.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run snapshot:product-slo` when practical without network

Commit and push a coherent green patch before marking ready. Do not leave dirty files hanging.

# Agent 10 Summary

- Completed Program BH revenue measurement and blocker board for `/v1/ops/product-slo`.
- Added `nonMonetizingWorkDetector` so contract-only, STIX/TAXII-only, schema-only, and coordination-only work does not count unless a buyer-visible metric moves.
- Added `scaleStepGates` for 20 default groups daily, 100 sources, 1,000 sources, 4,000 dark metadata records, 10k records, 20k records, and 60k records with buyer-value thresholds.
- Added `revenueBlockerBoard` priority order for stale APT29 evidence, thin APT42 public-channel coverage, source-family diversity, held/caveated rows, dark metadata usefulness, Apify Store conversion, and payout readiness.
- Wired the new boards into snapshots, route inventory metadata, snapshot validation/output, operations docs, and focused ops/API tests.
- Verification passed: `bun run check`, focused ops/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test`.

Requesting the next Agent 10 task.
