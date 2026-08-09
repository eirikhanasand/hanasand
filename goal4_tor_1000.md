# Goal 4 — 1,000 qualifying lawful Tor feeds

Status: active until the production qualification count reaches 1,000. Registration, seed, parser, or health-check counts do not complete this goal.

## Truthful baseline

Measured on production PostgreSQL on 2026-08-09:

- 0 lawful Tor sources qualified for coverage.
- 3 governed Tor candidates had retained productive-cycle evidence but were blocked from further collection after their immutable seed verification aged past seven days.
- 1 additional independently reviewed lawful Tor candidate exists in the repository batch and remains non-qualifying until deployed scheduled cycles succeed.
- The remaining gap is 1,000 qualifying sources.

## Completion contract

A source counts only when all of these are true in the current monitoring window:

- The endpoint is a distinct, canonical, credential-free v3 onion source reached only through the approved proxy boundary.
- An independent current authority record supports the source identity and lawful metadata-only collection basis.
- The production parser returns useful defensive intelligence while retaining no raw page, restricted locator, file, contact, credential, or interaction data.
- At least two scheduled cycles each persist a novel useful metadata capture; duplicate, empty, failed, transport-only, synthetic, and manual runs do not count.
- The automatic source review is approved and cryptographically bound to the current source identity and retained evidence.
- The source is executable, active, `productionCollection:true`, `countsAsCoverage:true`, current, restart-safe, and agrees across PostgreSQL, scheduler/API qualification, and UI totals.

Goal completion requires 1,000 sources satisfying that contract simultaneously over sustained current cycles.

## Continuous work loop

Repeat until the remaining gap is zero:

1. Discover candidates from current independent public authority inventories; dedupe by canonical endpoint before any network request.
2. Reject non-v3, private, credentialed, interaction-dependent, mirrored, stale, unreachable, unsupported, or non-useful endpoints and retain only non-sensitive exclusion evidence.
3. Verify reachability through the approved proxy and the existing metadata-only boundary; extend an existing parser only for a real unsupported victim-listing shape.
4. Import accepted rows as inactive candidates with immutable authority/parser receipts and no runtime health claims.
5. Let the production scheduler collect; obtain two novel useful retained captures and governed automatic review approval before promotion.
6. Reverify or retire sources when authority, reachability, parser usefulness, activity, evidence, or review bindings become stale.
7. Record the dated accepted, rejected, duplicate, parser-failure, productive-cycle, qualified, and remaining-gap counts below.

## Current blocker correction

The restricted Tor lane keeps a previously admitted `restrictedMetadataCandidate` collectable after its immutable seed receipt expires, but never promotes it without an approved identity-bound review and two productive cycles. The public/Telegram lane may resume an expired candidate only when a current governed review (`approved` or `needs_review`) is bound to the unchanged source identity and retained evidence. `needs_review` permits probationary evidence collection but never promotion. Rejected, identity-changed, evidence-missing, or backoff-active candidates remain blocked.

## Progress ledger

| Measured at | Evidence-bearing governed candidates | Qualifying in production | Remaining | Evidence |
| --- | ---: | ---: | ---: | --- |
| 2026-08-09 | 4 | 0 | 1,000 | PostgreSQL source/qualification aggregate plus repository batch receipt |

Every later entry must cite an immutable commit and a production observation window. Never put onion locators or captured content in this file.
