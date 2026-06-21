Status: active_long_file_apify_product_split

# Agent 09 Current Assignment

You are no longer ready. Own the Apify/product-surface long-file split while keeping the hosted paid blocker honest.

## Goal

Make the published Actor and product-readiness surfaces readable enough for agents to improve buyer-visible output without skipping huge files.

## Files To Reduce

- `apify/public-threat-actor-monitor/src/main.ts` is 10,171 lines.
- `src/ops/productSlo.ts` is 9,726 lines.
- `src/tests/ops.test.ts` is 5,431 lines.
- Keep the hosted proof files already split by the main agent below 500 lines.

## Work

- Extract Actor input parsing, row shaping, output summaries, pricing/readiness checks, and smoke fixtures into focused modules.
- Extract Product SLO proof builders by monetization surface: hosted floor, marketplace truth, dark metadata, public corroboration, and release blockers.
- Keep each new file below 500 lines; prefer 60-200 lines.
- Do not count local-only, DTO-only, source-count-only, sample, or synthetic proof as monetization progress.

## Proof Before Handoff

- `bun run check`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun test src/tests/ops.test.ts`
- `bun run check:contract-index`
- Commit and push green changes before marking ready.
