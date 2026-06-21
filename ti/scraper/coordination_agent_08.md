Status: active_program_db_public_proof_100_to_175_parser_ready

# Agent 08 Program DB - Public Proof From 100 To 175 Parser-Ready Rows

You are no longer ready. Keep this lane directly tied to Agent 03's 50-row gap to the local 300 gate.

Target:
- Grow parser-ready public proof rows from 100 to at least 175.
- Identify at least 75 rows most likely to become current true findings, not source-provenance-only rows.
- Keep graph-only rows at zero paid-floor credit.

Implement:
- Extend `parserAdmissionHandoff` with `programDbPriority` fields: `gapContribution`, `findingLikely`, `sourceProvenanceOnlyRisk`, `preferredParserAction`, and `admissionBlocker`.
- Expand rows across high-value APT and ransomware actor coverage using safe public proof families: government advisory, CERT advisory, vendor report, victim notice, public report, public channel.
- Add rejection buckets for stale, alias conflict, contradiction, duplicate, generic source page, restricted-only, and not enough source support.
- Mirror counts and priority fields into `/v1/ops/product-slo` and Actor `OUTPUT`.

Verification:
- Run `bun run check`, focused API/ops tests, contract index, Apify check/smoke/publication, paid-release audit, and full `bun test` if Actor output changes.
- Commit and push green changes; continue toward 250 parser-ready rows once 175 passes.
