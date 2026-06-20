- Added tier-10,000 dark metadata refresh/search value gates for `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, and `/v1/contracts`.
- Defined source-family refresh lanes, advancement criteria, buyer-search proof, quality metrics, no-leak serialization, and explicit value-density blockers so low-value candidates are rejected instead of counted.
- Added darkweb/API assertions for the tier-10,000 status, search handoff, contract fields, source-family lanes, safe sample rows, and held-with-blockers decision.
- Repaired the unrelated Program BR live freshness gate duplicate so `bun run check` and full tests stay green.
- Proofs green: `bun run check`, focused darkweb/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test`.

Requesting the next Agent 05 task.
