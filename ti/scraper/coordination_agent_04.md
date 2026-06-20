Status: active_program_bj_public_channel_freshness_and_actor_feed_prioritization

# Agent 04 Coordination

## Current Assignment - Program BJ: Public Channel Freshness And Actor Feed Prioritization

You are no longer waiting for a task. Continue the public-coverage lane until high-value actor searches know which public-channel, blog, advisory, and metadata source families are most likely to produce fresh, useful rows.

Mission:
- Convert the 30-actor coverage matrix into source-family priorities, cadence recommendations, and buyer-visible freshness expectations.
- Focus on practical results for the Apify Actor and `/ti`: actor searches should show why a result is fresh, partial, stale, or source-gap-held.

Build:
- Add per-actor freshness profiles for APT groups, ransomware/extortion groups, financial-crime groups, and unknown queries.
- Add source-family priority rows for clear-web blogs/news, public advisories, public Telegram/channel-style sources where legal, dark metadata-only sources, malware/report feeds, CVE/advisory feeds, and official victim/news corroboration.
- Add cadence recommendations for high-volume ransomware groups versus slower-moving APT reporting, including stale-only rejection rules and source-family fallback.
- Add product-facing rows for `freshnessExpectation`, `highestValueMissingFamily`, `nextBestSourceAction`, `buyerCaveat`, and `expectedTimeToUsefulSignal`.
- Keep all output public-only or metadata-only; no private channel joins, account automation, auth/CAPTCHA bypass, actor interaction, raw unsafe URLs, credentials, dumps, or leaked-data access.

Proof before status change:
- `bun run check`
- `bun test src/tests/publicSignalFusion.test.ts src/tests/publicAdvisory.test.ts src/tests/api.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- update source/product docs if API contracts change

If this phase completes, continue immediately into Program BK: actor-specific collection playbooks for the top 50 marketplace queries.

## Previous Completed Slice

- Completed Program BI actor source coverage expansion for 30 configured actors/groups, including APT, ransomware, financial-crime, legacy, and unknown-query control rows.
- Added `publicSignalFusion.actorSourceCoverageMatrix` with required, covered, stale, missing, blocked restricted-metadata, freshness, source value, caveat, and next safe activation fields.
- Added compact product/API fields for Apify and `/ti` consumers: `sourceCoverageGaps`, `coverageStatusByActor`, and `apifyDatasetFields`.
- Preserved Agent 04 boundaries: public-only source families, restricted metadata as review-held context only, no private channel scraping, no account automation, no auth/CAPTCHA bypass, no actor interaction, no leaked-data or raw URL exposure.
- Updated source-registry operator docs for the new actor coverage matrix contract.
- Verification is green: `bun run check`, `bun test`, `bun test src/tests/publicSignalFusion.test.ts src/tests/publicAdvisory.test.ts src/tests/api.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run check:api-regression`.

Historical note: Agent 04 previously requested the next concrete task. The active Program BJ assignment above supersedes that request.
