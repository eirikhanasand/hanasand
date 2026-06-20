Status: active_program_bl_source_acquisition_to_1000

# Agent 04 Current Assignment - Program BL: Source Acquisition To 1,000

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then turn source acquisition into buyer-visible live data value for the Apify Actor. This is a long-running program, not a small patch.

Mission:
- Expand from the first-100 source ladder toward 1,000 ranked, deduped, legally reviewable public TI sources that can improve fresh rows, useful rows, and source-family diversity.
- Prioritize sources that can produce timely APT/ransomware activity: vendor CTI blogs, CERT/government advisories, malware research, exploit/vulnerability intelligence, ransomware/public extortion trackers, public Telegram/channel mirrors where allowed, public datasets, ICS/cloud/SaaS abuse feeds, phishing/brand abuse, and curated public-report references.
- Avoid paper-value entries. Every candidate needs a reason it can improve paid Actor output within days or a reason to reject/hold it.

Build:
- Add the 100 -> 1,000 acquisition packet with source family, source name/domain, safe locator hash, public access method, robots/legal review, parser family, expected actor/query coverage, expected entities, freshness expectation, dedupe group, rejection reason, buyer-value score, row-lift estimate, and activation priority.
- Split candidates into `activate_canary`, `parser_needed`, `review_needed`, `duplicate`, `low_value`, and `reject`.
- Include a top-100-to-top-1,000 transition summary showing what source families are still missing for APT29, APT28, Volt Typhoon, Sandworm, Lazarus, LockBit, Clop, Akira, Black Basta, Play, and Scattered Spider.
- Coordinate with Agent 01 source activation, Agent 03 parser repair, Agent 07 paid-row gates, Agent 09 Apify output, and Agent 10 monetization SLOs.

Proof:
- `bun run check`
- focused source/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- full `bun test` if shared contracts/routes change

When your patch is coherent, update this file, commit, push, and leave no hanging files. Do not stop after one small source-list update; continue into ranking, dedupe, parser handoff, and paid-row lift proof.

# Agent 04 Coordination

- Completed the product-focused first-100 source acquisition ladder for `/v1/sources/atlas`.
- Added concrete public source identities and domains across vendor CTI, government/CERT, CVE/advisory, malware research, ransomware tracking, exploit intelligence, public datasets, ICS/OT, cloud/SaaS, phishing/brand abuse, and descriptor-only public-channel review sources.
- Each first-100 row now carries buyer value, actors improved, freshness expectation, likely extracted entities, parser/source family, 1-3 day Apify row impact, acquisition priority, and highest-value missing source families for default actors.
- Preserved Agent 04 safety boundaries: no private channel scraping, account automation, auth/CAPTCHA bypass, actor interaction, raw unsafe URL output, source activation, registry mutation, or crawling.
- Updated source registry documentation for the source-acquisition ladder.
- Verification is green: `bun run check`, focused source/advisory/public-signal/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` with 527 passing tests.

Historical note: the previous ready/request state is superseded by Program BL above. Continue the 1,000-source acquisition ladder without waiting for another prompt.
