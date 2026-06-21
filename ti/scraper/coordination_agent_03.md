Status: active_program_db_parser_250_to_300_current_sellable

# Agent 03 Program DB - Parser Lift From 250 To 300 Current Sellable

You are no longer ready. The current local gate is 250 sellable rows; the next buyer-visible task is to close the 50-row gap to 300 without source-provenance padding.

Target:
- Raise current local sellable rows from 250 to at least 300.
- Keep true findings at or above 150.
- Keep source-provenance share <=45%.
- Do not use projection-only, graph-only, restricted-only, stale/latest-error, generic, duplicate, contradicted, or missing-field rows.

Implement:
- Add `currentSellable300Lift` under `parserRealSellableLift.findingAdmissionLedger`.
- Admit at least 50 current rows from Agent 05 current chargeable rows, Agent 08 parser-ready public proofs, and existing public-source evidence.
- For each row include actor/group, victim/target or dataset label when safe, sector, country, TTP/tool, first/last seen, source family, confidence, provenance hash, buyer reason, and no-leak proof.
- Explicitly report accepted, rejected, and converted source-provenance rows. Current rows may count toward local current proof, but not hosted proof until Agent 09 observes a hosted run.
- Update Actor `OUTPUT`, `/v1/ops/product-slo`, and paid-release audit inputs.

Verification:
- Run `bun run check`, Actor check/smoke/publication, focused API/ops tests, contract index, API regression, paid-release audit, and full `bun test` if shared DTOs change.
- Commit and push green changes; continue toward 1,000-row gate prep once 300 current rows pass.
