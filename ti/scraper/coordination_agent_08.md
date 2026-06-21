Status: active_program_cz_public_proof_to_parser_admission

# Agent 08 Program CZ - Public Proof To Parser Admission

You are no longer ready. Your next lane is to push public proof unlocks into parser admission and paid Actor row quality, not STIX/TAXII or graph readiness.

Target:
- Move the 14 `ready_for_parser_admission` pivots into an Agent 03-ready admission package with exact field coverage and expected paid-row lift.
- Grow the parser-ready queue to at least 40 rows by finding/structuring safe public corroboration, or explicitly reject weak pivots.
- Keep graph-only rows excluded from paid-floor credit.

Implement:
- Add `parserAdmissionHandoff` under `graphPublicCorroborationPivotPacket.paidRowUnlockQueue` with actor, victim/target, sector/country, TTP/tool, source family, freshness age, contradiction state, provenance hash, and buyer reason.
- Add bucket counts for `admitted_by_parser`, `ready_for_parser`, `needs_public_source`, `contradicted`, `stale`, and `unsafe_or_restricted`.
- Feed Agent 03 with the exact rows most likely to lift true findings, and Agent 05 with restricted/dark metadata rows that still need public support.
- Do not add STIX/TAXII/export work unless it directly helps paid Actor row admission.

Verification:
- Run `bun run check`, focused API/ops tests, contract index, Apify check/smoke/publication, and full `bun test` if Actor OUTPUT changes.
- Commit and push green changes; continue into the next public proof batch without waiting.
