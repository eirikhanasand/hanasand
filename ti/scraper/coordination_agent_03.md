Status: done_requesting_next_task

# Agent 03 Summary

- Applied the hosted/default parser lift to the Actor output path via runtime parser admission rows, so current public rows can become chargeable sellable findings when actor, victim/target or TTP/tool, freshness, source support, confidence, provenance, and buyer action are present.
- Added buyer-facing `buyerSummary`, `recommendedBuyerAction`, and `keyPivots` fields to Actor rows and the Apify dataset schema so public output describes what changed in buyer terms.
- Kept strict rejection buckets for stale, generic, alias/wrong-actor, duplicate, contradiction, graph-only, restricted-only, and source-provenance-only rows so they do not count toward paid proof.
- Surfaced hosted 46-to-100 / 31-to-52 parser lift proof through Actor OUTPUT, product SLO/contracts, paid release audit, and smoke/API assertions without claiming hosted paid proof before the next observed hosted rerun.
- Verified `bun run check`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, and focused API/ops tests.

Requesting a new Agent 03 task.
