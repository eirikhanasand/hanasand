Status: active_program_bh_public_channel_coverage_and_actor_feeds

## Current Assignment - Program BH: Public Channel Coverage And Actor Feed Value

You are no longer waiting for a task. Continue the public-channel/source-coverage lane until the scraper has useful, safe, legal public-channel and actor-feed coverage that improves real actor monitoring beyond generic news.

Mission:
- Close the current product gap where many actor results are clear-web only and the Actor has to say `missing_public_channel_evidence`.
- Build safe public-channel/source coverage contracts, candidate packs, approval workflows, and metadata-only output that can feed the Apify Actor and `/ti` without risky collection.

Build:
- Add public-channel source pack models for Telegram public channels, vendor/public RSS channels, public ransomware/news trackers, CERT social feeds, public GitHub/security feeds, and curated analyst-maintained actor feeds.
- For each candidate: source family, public/legal status, access method, API/library expectation, join/auth requirement status, safe collection mode, cadence, expected actor coverage, language, trust score, noise score, duplicate risk, parser profile, and activation gate.
- Add route-visible coverage-gap remediation packets that say exactly which source family is missing for each default watchlist actor and what safe candidate sources could fill it.
- Add PII/minimization and provenance contracts for public-channel rows: message IDs may be hashed, no private/user lists, no raw leaked content, no credentials, no invite-only content.
- Add Apify Actor integration notes and fixture rows showing how public-channel coverage changes `sourceFamilies`, `coverageStatus`, `reviewReasons`, and `recommendedCollectionAction`.
- Coordinate with Agent 01 source atlas, Agent 02 scheduler, Agent 07 quality gates, Agent 09 API/UI fields, and Agent 10 source freshness SLOs.

Proof before status change:
- `bun run check`
- `bun test src/tests/sourceSeeds.test.ts src/tests/api.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- docs update for public-channel boundaries and source-gap remediation

If this phase completes, continue immediately into Program BI: actor-specific source coverage matrix for at least 50 actors/groups.

# Agent 04 Coordination

- Added Apify Actor coverage-gap output for `apify/public-threat-actor-monitor`: optional `coverage_gap` rows now identify missing public-channel/clear-web source support, stale or missing freshness, single-family support, contradiction holds, collection priority, and the next safe collection action.
- Added source-family diagnostics to every Actor dataset row: `sourceFamilies`, `missingSourceFamilies`, `coverageStatus`, `coverageGapCodes`, `collectionPriority`, `recommendedCollectionAction`, and source-coverage gap counts.
- Added scheduler/polling fields to every Actor row so downstream monitors can distinguish active-run reuse, retry/backoff, source-gap follow-up, queued work, and safe polling hints.
- Preserved Agent 04 safety boundaries: public metadata only, no private Telegram/channel access, no account automation, no group joins, no auth/CAPTCHA bypass, no stolen data, no payload downloads, no raw leak contents, and no threat-actor interaction.
- Updated Apify input/dataset schemas, README, changelog, and smoke assertions for the new coverage diagnostics.
- Verification passed: `bun run check` and `bun run smoke` in `apify/public-threat-actor-monitor`, plus root `bun run check` and full root `bun test` with 519 passing tests.

Continuing Agent 04 ownership for public-channel/source coverage usefulness, source gaps, provenance, PII minimization, and safe public metadata feeding the marketplace Actor. Requesting the next concrete Agent 04 task.
