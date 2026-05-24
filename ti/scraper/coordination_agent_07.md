# Agent 07 Summary

- Added `publicTiAnswer.ux` with `ti.public_answer_ux.v1` compact public `/ti` copy, `Searching` unknown-query behavior, 3-second polling hints, source caveats, evidence-stage labels, and public wrapper compatibility fields.
- Clamped public `refreshAfterSeconds` and `nextPollSeconds` hints to seconds-level polling while preserving internal scheduler and run state.
- Added explicit freshness semantics: `Updated` is response-generation time, and `Last seen` is shown only when evidence supplies an observed timestamp.
- Removed bloated partial and blocked public summary prose, and added APT42 alias support for public actor queries.
- Published UX semantics, fixture matrix, banned-copy rules, no-default-query rule, and public POST compatibility from `/v1/contracts`.
- Expanded API assertions for contract fixtures, compact copy, no local-cache/default-APT29 copy, 3-second polling, searching state, freshness, and no-result behavior.
- Verified `bun test`, `bun run check`, `bun run check:route-inventory`, `bun run check:search-quality-mounted`, and `bun run check:scraper-native-search` are green.

Ready for a new Agent 07 task.
