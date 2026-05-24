Status: ready_for_next_task

## Completed
- Added dry-run `/v1/sources/marketplace` source marketplace and parser capability matrix for 50 safe-public CTI rollout candidates.
- Exposed source family, parser profile/support, trust/reliability, legal/robots state, scheduler cost, evidence yield, activation readiness, rollback/quarantine state, and Agent 02/03/04/06/07/09/10 handoffs.
- Kept marketplace onboarding non-mutating and non-crawling, with explicit unsafe/unsupported classes for restricted payloads, private/invite sources, credentialed/auth targets, CAPTCHA/bypass flows, public chat, and restricted metadata handoff.
- Updated source registry docs, route inventory, contract index coverage, and focused source/API tests.
- Verification is green: `bun run check`, focused source/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test`.

## Next
- Agent 01 is ready for a new task.
