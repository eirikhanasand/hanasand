# Hanasand — Single Product Completion Plan

This file replaces `goal.md`, `goal2.md`, `goal3.md`, and `goal4.md`.

## Working rules

- Production data and behavior are the source of truth. Tests may protect behavior, but synthetic records never count as product evidence.
- Keep lawful handling, redaction, tenant isolation, provenance, retention, and audit history intact.
- Prefer the smallest shared-path fix. Do not hide missing data by displaying zero, inventing timestamps, or claiming readiness.
- Every completed item needs dated live evidence tied to the deployed commit.

## 1. Keep the product reliable and observable

- Make every internal and external route useful quickly: return the first actionable server-rendered or API-backed content within 500ms, including honest next actions, recent incidents, or relevant operational context when the primary list is empty. Target a server response time below 20ms for ordinary requests; measure p50/p95/p99 by route and separate server time, database time, rendering time, and network time. Never satisfy this objective with a blank shell, an empty placeholder, fabricated records, or a loading label presented as content. Slow work must be deferred behind the first useful response, cached where truthful, paginated, or moved to an asynchronous job with visible progress.
- Persist the real event times needed for a customer timeline: first report, publication, collection, processing, first visibility, alert creation, delivery attempt, and delivery. Unknown values stay unknown; impossible ordering is recorded and surfaced.
- Measure useful customer delays from real records and report median/p95 only when the sample is large enough to be meaningful. Include source family and pipeline stage; do not copy one timestamp into another.
- Keep PostgreSQL, collection, review, evaluation, API, and frontend health visible. Alert on source failures, queue age, parser regressions, duplicate growth, evaluation regressions, delivery failures, and unhealthy services.
- Run scheduled backups and verified isolated restores. Prove restart, migration, retention, tenant-isolation, and failure recovery without data loss or silent success.
- Finish essential desktop/mobile behavior for loading, empty, stale, unavailable, error, and large-result states. Do not add broad UI test scaffolding that does not protect a real customer workflow.

## 2. Make customer output truthful

- Separate actor origin, victim geography, source geography, and ordinary country mentions.
- Show actor activity only when the actor identity and activity have evidence; a textual mention is not an attribution. Do not show a last-seen date without a qualifying event timestamp.
- Remove fabricated dark-web totals, HTML/navigation noise, repeated feed wrappers, unsafe links, and unqualified indicators from customer output.
- Use stable incident identity with temporal updates, conservative alias merge/split history, and clear separation between source URLs, domains, software assets, observables, and actionable IOCs.
- Make searches for actors, companies, domains, and CVEs use the correct entity type and the canonical evidence-backed pipeline. A company or domain must not be turned into a fabricated actor profile.
- Add evidence-backed business and extortion analysis: observed communications, pricing, negotiation, payment claims, intermediaries, pressure tactics, publicity, and profitability signals. Distinguish observation, actor claim, third-party report, and analysis; never infer profit from victim counts alone.

## 3. Prove the real customer workflow

- From a fresh tenant, create an organization and watchlist, receive a real evidence-linked match, review it, create an alert, deliver it to a controlled receiver, force a controlled failure, retry it, and verify durable history and deduplication after restart.
- Use only real source-backed matches. No sample company, generated alert, synthetic timestamp, or demo payload may appear in the workflow.
- Keep the public API stable and documented: versioned resources for search, actors, incidents, claims, evidence, sources, validations, alerts, evaluation, timeliness, and pagination; typed OpenAPI schemas; consistent errors; authentication/scopes; rate limits; caching; request IDs; and idempotency where needed.
- Ensure pricing, developer documentation, OpenAPI, onboarding, and actual product behavior describe the same capabilities.
- Complete the final security and buyer review on desktop and mobile, including tenant isolation, authorization, outbound-fetch safety, secret handling, redaction, retention, correction/takedown, and accessible critical states.

## 4. Build the authoritative APT and actor foundation

- Maintain a versioned catalog from current MITRE ATT&CK Enterprise groups plus current authoritative government, CERT, ransomware, and extortion sources.
- Resolve aliases, renamed groups, splinters, and duplicates into stable identities. Retire identities that leave the current catalog without deleting history.
- Require an authoritative identity reference and immutable capture before presenting activity, victims, techniques, tools, infrastructure, or last-seen data.
- Refresh the catalog on a bounded schedule and persist source version, retrieval time, lineage, and activity history.
- Prove representative positive, renamed/alias, ambiguous, and no-activity queries in the live API and product UI. Report catalog identity coverage separately from observed activity.

## 5. Build and maintain the source fleet

The long-term minimum is:

- 5,000 qualifying clear-web feeds;
- 1,000 qualifying lawful Tor/dark-web metadata feeds;
- 100 qualifying public Telegram feeds.

For every counted source:

- It has an executable production collector, recurring scheduled checks, useful retained captures over multiple current cycles, truthful content/update times, health/backoff state, and restart-safe scheduling.
- It is current, relevant, legally permitted, independently useful, and not a duplicate, mirror, dead page, registration-only record, or copied feed.
- Counts reconcile across PostgreSQL, the API, scheduler, and UI. Active, checked, successful, useful, capture-producing, stale, and failed are separate numbers.

Source discovery must continue without Codex or manual source lists. The existing scraper and Hanasand AI path should follow bounded safe publisher references, test the real collector/parser, reject unsafe or low-value candidates, schedule accepted candidates, and retire sources that stop producing useful intelligence. Discovery has its own concurrency, queue, backoff, and resource limits so it cannot starve collection, review, alerts, or API traffic.

The persistent public Telegram work loop and live acceptance ledger are in [`telegram-goal.md`](telegram-goal.md). Keep running that loop until 100 public Telegram feeds qualify in production; candidate registration and one-off probes do not reduce the remaining gap.

The deployed source-operations response measured on 2026-08-09 reports only 3 qualifying sources (3 clear-web, 0 lawful Tor/dark-web, 0 public Telegram); this requirement is therefore substantially open. Keep this baseline dated to the latest live measurement rather than inferring it from raw registrations.

## 6. Use automatic review without guessing

- Every eligible claim, incident, and source-review item reaches a clear outcome: supported, rejected, uncertain/retryable, or dead-lettered. “Complete” means an outcome is persisted; it does not mean stopping the review system.
- Persist model/provider/version, prompt/schema version, evidence IDs, decision, rationale, confidence, timestamps, and retry history. Replays and changed evidence must not silently overwrite history.
- Unsupported attribution, absence-only claims, contradictions, unsafe data, and stale evidence remain withheld or quarantined.
- Actor attribution is shown only when the evidence supports it. Negative and ambiguous cases remain negative or uncertain.

## 7. Run a customer-useful quality audit

Do not create a fake benchmark or force an artificial class balance. Instead:

- Select real retained production captures from the main source families and product use cases.
- Have an independent reviewer verify each selected output against a separate authoritative public record or explicitly mark it unsupported.
- Record the exact capture, source, reviewer, independent reference, decision, and dataset split. Keep the review reproducible and append-only.
- Report actionable findings: correct output, missed output, wrong attribution, unsupported output, parser/source failure, and the affected entity/source family. Compute precision/recall or other rates only where the reviewed sample supports a meaningful interpretation; do not publish a number that customers cannot trust.
- Include enough real cases to expose common failures, but do not manufacture negatives or use test-only records as production evidence.

## 8. Finish cleanup and release proof

- Remove dead routes, stale code, unreachable production paths, obsolete stores, and unused suppression or sample code. Keep the already-closed fake coverage-plan endpoint and legacy suppression cleanup closed.
- Deploy the exact reviewed commit from the canonical production checkout.
- Run the complete test suite, production-shaped PostgreSQL checks, API contract checks, semantic regressions, and live desktop/mobile checks.
- Reconcile live counts, null rates, duplicates, review outcomes, source contributions, timeliness completeness, evaluation provenance, backup/restore results, and delivery history.
- Repeat the security, reliability, buyer, and thesis review from the released system. Remove this file only when every section above is live-proven complete and nothing remains except thesis writing and presentation.

## Already closed

- Homepage exposure `0/0` display: live checks pass; the current page reports real exposure data and unavailable states honestly.
- Fake coverage-plan endpoint: removed and verified unreachable.
- Legacy evaluation suppression cleanup: completed; remaining work is the broader reachability and release audit.
