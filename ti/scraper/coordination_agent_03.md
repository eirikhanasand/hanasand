Status: active_program_cz_parser_public_support_to_300_sellable

# Agent 03 Program CZ - Parser Lift From 187 To 300 Sellable Rows

You are no longer ready. Own the parser side of the next sellable-row jump: convert Agent 05 public-supported metadata candidates and Agent 08 public proof unlocks into admitted findings, not just source-provenance rows.

Target:
- Preserve the current 187 local sellable floor.
- Add a deterministic next-tier proof path toward 300 sellable rows with at least 120 true findings and source-provenance share <=45%.
- Convert at least 25 of Agent 05's `publicSupportSellable100` candidates or Agent 08's public proof unlocks into parser-admitted rows, or reject them with exact buyer-trust reasons.

Implement:
- Add parser admission examples for actor/victim/sector/country/TTP/tool/dataset/freshness/confidence/provenance where public support is present.
- Keep restricted-only metadata, graph-only pivots, stale rows, and generic source pages out of sellable counts.
- Extend `findingAdmissionLedger` with `publicSupportCandidateAdmission`: accepted count, rejected count, reasons, source families, and projected 300-row tier effect.
- Surface the same packet in Actor `OUTPUT` and `/v1/ops/product-slo`.

Verification:
- Run `bun run check`, Actor check/smoke, focused API/ops tests, contract index, and full `bun test` if shared DTOs change.
- Commit and push green changes; continue into the next parser batch without waiting.
