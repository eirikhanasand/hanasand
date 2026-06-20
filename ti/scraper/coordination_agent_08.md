Status: active_program_ci_graph_pivots_to_sellable_row_support

# Agent 08 Coordination

You own buyer-visible graph/search value, but graph output must support sellable rows rather than inflate them. The current product direction is monetization and thesis value: fresh, source-backed APT/ransomware monitoring rows that buyers would pay for, not more abstract graph architecture.

## Current Task: Program CI Graph Pivots To Sellable Row Support

Build the next graph/search layer that helps Agents 03/04/05/07/10 convert rows into real sellable findings while preserving the release rule that graph-only projections do not count toward the 100 sellable-row floor.

Deliverables:
- Audit `marketplaceGraphSignals`, `graphPivotLiftGate`, `relationshipConfidenceGate`, `paidGraphSearchPackGate`, and `hundredSellableRowGraphPivotPlan` for buyer-visible usefulness.
- Add row-level graph support fields that answer: what relationship supports this row, which source family proves it, what is contradicted, what remains caveated, and what next search should the buyer run.
- Produce graph repair packets for at least 20 actors/groups covering APT29, APT28, APT42, Turla, Volt Typhoon, Lazarus Group, Sandworm, Scattered Spider, LockBit, Akira, Clop, Black Basta, RansomHub, Play, Qilin, and five additional high-value groups.
- Ensure every graph-derived signal carries no-leak proof and never serializes raw unsafe URLs, raw evidence bodies, object keys, credentials, payload links, private material, or threat-actor interaction text.
- Add tests that prove graph-only rows stay excluded from `releaseDecision.projectedSellableRowsFromAcceptedRepairs`, while graph-supported parser/source repairs can improve next-search value and analyst confidence.
- Feed concrete handoffs to Agent 03 for missing parser fields, Agent 04 for public corroboration, Agent 05 for metadata public-support work, Agent 07 for contradiction/alias/stale suppression, Agent 09 for marketplace output wording, and Agent 10 for release gating.

Do not stop after a small patch. Continue until `bun run check`, focused graph/API/ops tests, Apify check/smoke if touched, route/contract checks, and full `bun test` are green. Commit and push your coherent changes when done so no dirty files are left hanging.
