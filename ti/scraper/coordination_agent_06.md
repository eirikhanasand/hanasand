Status: active_evidence_read_model_for_sellable_rows

# Agent 06 Current Assignment

Read all of this file. Historical detail is archived in:
- `docs/coordination/coordination-agent-06-history-2026-06.part-aa`
- `docs/coordination/coordination-agent-06-history-2026-06.part-ab`

## Goal

Own evidence/read-model/search work only where it helps real source rows, dark metadata rows, and hosted Apify output become searchable, safe, and useful.

## Current Constraint

Do not add storage/export theory unless it directly improves one of:
- Hosted sellable rows.
- Hosted true findings.
- Evidence provenance for paid-row decisions.
- Safe public API search results.
- Metadata-only dark/restricted source search.
- No-leak proof.
- Cost/useful-row or freshness measurement.

## Work

- Keep evidence storage modular and safe.
- Preserve metadata-only treatment for restricted/dark material.
- Never expose raw bodies, unsafe URLs, object keys, credentials, private material, leaked rows, or actor-interaction content.
- Support Agent 05 dark metadata and Agent 01 source atlas with searchable, replayable, hash-only evidence rows.
- Make public-answer, graph, and Actor consumers able to explain why rows are sellable, caveated, held, or suppressed.

## Next Output

Produce one buyer-visible read-model improvement:
- A searchable row packet for hosted row repair.
- A public-answer cache handoff for newly corroborated rows.
- A dark metadata public-support replay receipt.
- A provenance/no-leak audit packet consumed by Agents 07/09/10.

## Proof Before Handoff

- `bun run check`
- `bun test src/tests/storageCutover.test.ts`
- Focused API/ops tests if route surfaces changed.
- Commit and push green changes.

## Latest Progress

2026-06-21 11:15 CEST:
- Added disabled Postgres audit rows/repository status for `searchableSourceMetadataPublicSupportReplayReceiptLedger`.
- New route field: `/v1/evidence/cutover-report.readModelCutover.searchableSourceMetadataPublicSupportReplayReceiptRepository`.
- The repository maps receipt ledgers to replay-run and receipt rows, then holds persistence behind `TI_SEARCHABLE_SOURCE_METADATA_PUBLIC_SUPPORT_REPLAY_RECEIPT_REPOSITORY_ENABLED`.
- It persists zero rows, mutates zero queues, promotes zero Actor rows, writes zero public-answer cache entries, and keeps restricted/dark material metadata-only.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`.
- Continue next with completed support receipt ingestion or a public-answer/Actor handoff for newly corroborated rows.
