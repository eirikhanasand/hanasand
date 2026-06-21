Status: active_long_file_dark_metadata_split

# Agent 05 Current Assignment

You are no longer ready. Own the dark/restricted metadata long-file split without changing paid semantics.

## Goal

Split the dark metadata lane into readable modules so agents can safely maintain it while scaling toward 1,000+ and then 60,000 buyable metadata rows.

## Files To Reduce

- `src/adapters/darknetMetadata.ts` is 11,272 lines.
- `src/adapters/darkwebIndex.ts` is 4,995 lines.
- `src/tests/darknetMetadata.test.ts` is 5,107 lines.
- `src/tests/darkwebIndex.test.ts` is 1,674 lines.

## Work

- Extract pure types, fixtures, row builders, source-family logic, safety gates, and route DTO helpers into focused files.
- Keep every new file below 500 lines; aim for below 200 where practical.
- Preserve metadata-only output, no raw leaked data, no credential capture, no payload following, no auth/private/CAPTCHA access, and no actor interaction.
- Keep current paid counts unchanged unless a real parser/source improvement is intentionally added and tested.

## Proof Before Handoff

- `bun run check`
- `bun test src/tests/darknetMetadata.test.ts`
- `bun test src/tests/darkwebIndex.test.ts`
- `bun run check:contract-index`
- Commit and push green changes before marking ready.
