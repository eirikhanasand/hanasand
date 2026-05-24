Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Clear-Web And Public-Channel Promotion Into Responsive Actor Search

Own the collection bridge that turns public `/ti` searches into real captured evidence fast. The product requirement is that arbitrary actor queries should feel responsive within seconds: immediate compact actor context when available, `Searching` only for truly unknown/no-result states, live discovery promoted to canonical clear-web captures, approved public-channel evidence merged as partial support, and no seeded/default actor behavior.

Deliver end-to-end fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, a random actor, a made-up actor, and one CVE. For each, show live search handoff, canonical capture task, collected item, capture id, content hash, parser profile, evidence stage, public-channel match state where relevant, failure outcomes for robots/429/404/too-large/unsupported MIME/duplicate canonical, and API-ready promotion metadata for Agent 06/07/09. Keep all public-channel work public/approved/official-boundary only: no account creation, no private joins, no invite-only content, no raw media, no darknet collection. Verify adapter fixture tests, Telegram tests, API-facing promotion tests if touched, full `bun test`, and `bun run check`.

# Agent 03 Summary

- Added injected-fetch RSS/static-web adapters with conditional request handling, robots checks, canonical URL reconciliation, parser provenance, crawl-state metadata, safe link discovery, and no-live-network fixture coverage.
- Added `promoteSearchResultToCanonicalCapture` in `src/adapters/clearWebPromotion.ts` to bridge live search-result handoffs into canonical static-web capture tasks, collected items, pipeline captures/incidents, and `DiscoveryEvidence` promotion records.
- Added fixture proof in `src/tests/adapterFixtures.test.ts`: APT29, Scattered Spider, Volt Typhoon, Akira ransomware, Turla, and CVE-2026-12345 search snippets all become promoted discovery rows with follow-up task ids, canonical capture ids, incident ids, canonical URLs, content hashes, `captured_page` evidence stage, and `vendor_report` parser profile.
- Added practical public Telegram search in `src/adapters/telegramPublic.ts`: Bot API `getUpdates` client, official MTProto search boundary DTOs, approved-channel search orchestration, query matching, evidence/promotion/reliability/readiness output, and review-only candidate source conversion.
- Kept public-channel guardrails explicit: no account creation automation, no private invite/join behavior, no darknet browsing, no raw media payload fetches, PII minimized, and discovered channels stay `needs_review` until approved.
- Added fixture tests for official Bot API polling, practical approved-channel search, official search boundary hits, and safe candidate source conversion.
- Added clickable `/ti` evidence/provenance boxes in the Hanasand UI by carrying safe source URLs through the API/frontend DTOs.
- Declined unsafe expansion requests for private groups, account creation automation, non-official/illegal APIs, and unrestricted darkweb crawling.
- Verified `bun test src/tests/adapterFixtures.test.ts`, `bun test src/tests/telegramPublic.test.ts`, scraper `bun run check`, full scraper `bun test`, frontend `npx tsc --noEmit`, and API `npx tsc --noEmit` are green.
- Superseded by active Task AA above; do not request another assignment until Task AA proof is complete.
