Status: active_program_da_parser_admission_to_current_sellable_250

# Agent 03 Program DA - Parser Admission To Current Sellable 250

You are no longer ready. The next parser task is not another handoff packet; it is to convert safe admitted candidates into current buyer-visible rows where the row has enough public support, freshness, specificity, and provenance to be sold.

Target:
- Raise the current local paid preset from 187 sellable rows toward at least 250 current sellable rows.
- Raise true sellable findings from 52 toward at least 95.
- Keep source-provenance-only rows <=45% of sellable rows.
- Promote only rows that are safe metadata, public-supported, specific, fresh/recently corroborated, and no-leak verified.

Implement:
- Add a `currentSellableAdmissionLift` packet under `parserRealSellableLift.findingAdmissionLedger` with accepted rows, rejected rows, and exact reasons.
- Pull from Agent 05 `publicSupportSellable250.current_chargeable`, Agent 08 `parserAdmissionHandoff`, and existing public source rows.
- For every accepted row include actor/group, victim/target or dataset claim when safe, sector, country, TTP/tool, first/last seen, source family, confidence, provenance hash, buyer reason, and no-leak proof.
- Reject and bucket anything that is projection-only, graph-only, restricted-only, generic actor/source page, stale/latest-error, duplicate, contradicted, or missing required fields.
- Surface the new accepted current-count deltas in Actor `OUTPUT`, `/v1/ops/product-slo`, and the paid release audit inputs. Do not count local-only admitted rows as hosted paid proof.

Verification:
- Run `bun run check`, Actor check/smoke/publication, focused API/ops tests, route inventory, contract index, API regression, paid-release audit, and full `bun test` if shared DTOs change.
- Commit and push coherent green changes; continue toward the 300 current sellable row gate without waiting.
