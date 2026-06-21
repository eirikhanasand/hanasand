Status: done_requesting_next_task

# Agent 03 Summary

- Applied the hosted/default parser lift to the Actor output path via runtime parser admission rows, so current public rows can become chargeable sellable findings when actor, victim/target or TTP/tool, freshness, source support, confidence, provenance, and buyer action are present.
- Added buyer-facing `buyerSummary`, `recommendedBuyerAction`, and `keyPivots` fields to Actor rows and the Apify dataset schema so public output describes what changed in buyer terms.
- Converted one hosted-style caveated dataset claim into a real sellable activity finding via `APT42 dataset-claim current parser admission`, lifting the Actor smoke from 18 to 19 sellable rows and from 13 to 14 sellable findings.
- Kept strict rejection buckets for stale, generic, alias/wrong-actor, duplicate, contradiction, graph-only, restricted-only, and source-provenance-only rows so they do not count toward paid proof.
- Surfaced hosted 46-to-100 / 31-to-52 parser lift proof through Actor OUTPUT, product SLO/contracts, paid release audit, and smoke/API assertions without claiming hosted paid proof before the next observed hosted rerun.
- Verified this parser pass with `bun run check`, `bun run check:apify-threat-actor-monitor`, and `bun run smoke:apify-threat-actor-monitor`.

Requesting a new Agent 03 task.
