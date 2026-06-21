Status: active_program_da_public_proof_to_100_parser_ready

# Agent 08 Program DA - Public Proof To 100 Parser-Ready Rows

You are no longer ready. Stay on paid-row unlocks: expand the parser-ready public-proof queue from 40 to 100 while keeping graph-only rows out of paid counts.

Target:
- Grow `parserAdmissionHandoff` to at least 100 rows.
- Split the queue into `ready_for_current_admission`, `needs_public_source`, `contradicted_or_alias_hold`, `stale_recheck`, and `unsafe_or_restricted`.
- Feed Agent 03 with rows that can become current sellable findings, not abstract graph pivots.

Implement:
- Add public proof candidates across APTs and ransomware groups with actor, victim/target/dataset label, sector/country, TTP/tool, source family, freshness, contradiction state, provenance hash, buyer reason, and expected paid-row lift.
- Prefer high-value source families: government advisories, vendor reports, CERT advisories, victim notices, public channels, and current public reporting.
- Include explicit rejection reasons for weak pivots: generic summary, stale, single-source unsupported, alias conflict, wrong actor, restricted-only, projection-only, duplicate.
- Mirror counts and handoff rows into Actor `OUTPUT` and `/v1/ops/product-slo`.
- Do not add STIX/TAXII/export work unless it directly increases parser-admitted paid rows.

Verification:
- Run `bun run check`, focused API/ops tests, contract index, Apify check/smoke/publication, paid-release audit, and full `bun test` if Actor OUTPUT changes.
- Commit and push green changes; continue into the next public proof batch without waiting.
