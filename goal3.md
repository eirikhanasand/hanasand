# Hanasand Buyer-Grade Threat Intelligence Completion Goal

## Status And Authority

This is the authoritative completion contract for turning the production Hanasand threat-intelligence product into a system that a critical master's-thesis examiner and a commercial buyer can accept.

Baseline reviewed:

- Production commit: `ab29097b4dc712449d5c8db77658fe7ecbff3102`
- Review date: 21 July 2026
- Surfaces reviewed: production UI, public API and OpenAPI document, scraper/API/frontend code, PostgreSQL structures and records, running services, backups, tests, and representative external sources
- Commercial verdict at baseline: **reject**
- Overall readiness at baseline: **2.8/10**

`goal2.md` remains useful as the previous audit baseline. Where it conflicts with this file, this file controls because it is based on the newer production state and stricter buyer-grade acceptance criteria.

Do not declare this goal complete because code exists, a test passes, a metric can be produced, a screenshot looks convincing, or an error is hidden. Completion requires correct production behavior, representative real data, independent validation, and reproducible buyer-facing evidence.

## Non-Negotiable Completion Standard

The finished product must be acceptable to both:

1. A critical examiner assessing whether the thesis research question and methodology were actually implemented and evaluated.
2. A commercial buyer deciding whether to rely on the product for real threat-intelligence decisions.

The stricter standard always wins. A shortcut that an examiner might tolerate but a buyer would reject is not acceptable.

The following do not count as fixes:

- Changing wording, hiding a field, adding a disclaimer, or moving a broken feature out of view while leaving incorrect data or behavior underneath.
- Replacing a wrong value with `unknown`, zero, a question mark, or an empty state when the system should be able to calculate or collect the real value.
- Hardcoded counts, generated freshness, synthetic intelligence, demo tenants, fixture-backed production pages, or fallback records presented as live product data.
- Marking a claim as inferred or low-confidence when the inference itself is semantically invalid.
- Adding tests that only reproduce implementation assumptions, mock the end-to-end path, or validate DTO shapes without checking real persisted outcomes.
- Treating same-source syndication, mirrored datasets, or automated field parity as independent corroboration.
- Declaring success from a single happy-path query, one source, one actor, or one deployment screenshot.
- Suppressing errors, converting failures to success, silently dropping rows, or making the frontend appear stable while the backend remains wrong.
- Creating new parallel stores, duplicate pipelines, or dormant UI paths instead of fixing the production source of truth.

Every material product claim must be traceable through:

`public output -> analytical claim -> extracted field -> immutable capture -> source -> timestamps -> parser/version -> confidence -> source independence -> review/validation state`

## Current Production Findings

### 1. Public Intelligence Is Not Reliably Correct

- APT29 displays Russia as a victim or target country even though the cited MITRE source attributes APT29 to Russia's SVR.
- The backend creates a Cartesian product between all extracted sectors and all extracted countries in `ti/scraper/src/api/searchRoute.ts`.
- The frontend converts those profile targets into victim observations in `frontend/src/utils/ti/actorProfile.ts`.
- A LockBit search returned a BrainCipher record because the source text mentioned leaked LockBit code; textual mention was treated as actor identity.
- APT41 displayed `Last seen 2026-07-21` despite having zero captures, claims, incidents, and sources.
- Raw website JavaScript, cookie-manager code, navigation text, HTML entities, and duplicated RSS titles appear as recent threat activity.

This is a release blocker. A security product must not confuse actor origin, victim geography, textual mention, source freshness, and verified activity.

### 2. Production Displays Fabricated Dark-Web Scale

- `/ti/darkweb/index` displays 60,000 watch targets and 60,000 indexed pages.
- Both values are hardcoded in `ti/scraper/src/adapters/darkwebIndexStatus.ts`.
- The same production page returns zero results for Akira even though Akira exists elsewhere in the database.

No estimate may be presented as an observed count. Counts must come from queryable production records with a documented definition and freshness timestamp.

### 3. The Dataset Does Not Support An APT-Monitoring Product

Production snapshot:

- 1,473 registered sources; 1,342 marked active.
- 1,464 sources have no `last_seen_at`.
- Only 124 sources have produced captures and only 183 have any health record.
- Capture mix was approximately 1,696 RSS, 246 API, 54 Tor metadata, six static-web, and four Telegram records.
- Only two active Telegram sources produced those four Telegram records.
- No working WhatsApp or Signal collection was found.
- 31 actor profiles exist: 22 ransomware, six generic threat actors, and only three APT profiles.

The product may include ransomware groups, but they cannot substitute for the thesis's APT focus. Source registry size is not coverage.

### 4. Accuracy Has Not Been Independently Evaluated

Production snapshot:

- 2,776 intelligence claims.
- Zero claim-review rows and zero analyst-confirmed claims.
- 2,071 incidents, all unreviewed and all missing a persisted actor field.
- 625 evaluation labels: 624 true positives and one false positive.
- 600 labels are automated CISA field-parity checks against the same structured fields used by the extractor.
- 17 labels are automated cross-source checks.
- Only eight labels were produced by the thesis evaluation audit.
- No true-negative or false-negative corpus exists, so recall is not measurable.

`ti/scraper/src/pipeline/evaluation.ts` explicitly describes its results as fixture-level rather than a full benchmark, disables type checking, leaves false-positive examples empty, and calculates category precision as recall.

### 5. Thesis Timeliness Is Not Measured

Of 2,066 production timeliness rows:

- 2,066 have no `reported_at`.
- 2,066 have no `alerted_at`.
- 361 have no `published_at`.
- The apparent zero-second median is caused by source data that equates publication and collection time.
- Observed publication-to-collection p95 was approximately 49 days.

The required interval is first actor/victim/public report to website visibility and customer alert. Pipeline processing duration alone is not thesis timeliness.

### 6. Correlation, Deduplication, And IOC Quality Are Below Commercial Standard

- 2,071 incidents reduce to only 539 unique normalized titles.
- Individual feed entries are duplicated between 50 and 76 times.
- Incident identity includes a changing content hash, so refreshed feeds create new incidents rather than temporal updates.
- Approximately 28,300 indicators are dominated by benign navigation links, social sites, CDN domains, filenames, JavaScript identifiers, CSS symbols, and malformed URLs.
- URL volume is heavily duplicated and does not represent actionable IOC coverage.
- Entity records contain generic or malformed values and duplicated actor/victim identities.

The product must distinguish observables, source URLs, software assets, page implementation details, and actionable indicators.

### 7. Business-Model Research Objectives Are Not Implemented Meaningfully

- Production contains only one unique buyer/seller communication claim and one monetization-path claim.
- Current values are templated from channel classifications such as the existence of `Chat` or `DLS` metadata.
- Victim-list volume is used as a profitability signal despite not establishing payment, revenue, cost, or profit.
- There is no meaningful structured analysis of buyers, negotiations, advertised prices, payment outcomes, intermediaries, conversion, publicity strategy, or publicity-to-profit relationships.

Labels that restate source metadata do not satisfy the thesis analysis objectives.

### 8. The Commercial Monitoring Surface Is A Demo

- `/dwm` imports `sampleDwmProductSnapshot()` directly.
- It generates fictional Acme/Northwind alerts relative to the current clock and hardcodes illustrative source coverage.
- The sample itself reports `blocked_missing_live_sources`.
- Production organization data consists of six `Commercial Acceptance` test organizations, all watching `apt29`.
- Of four customer-like webhook deliveries, one failed with `results.sort is not a function`.

The production DWM page must be driven by authenticated tenant data, real watchlists, real evidence-linked alerts, review state, and durable delivery history.

### 9. The Public API Is Narrow And Contract-Inconsistent

- Public OpenAPI exposes only `/ti/search` and `/ti/search/batch`.
- There is no stable public resource API for actors, incidents, claims, sources, evidence, validations, alerts, history, evaluation, or timeliness.
- Nested objects are mostly untyped.
- Routes are not path-versioned.
- The documented error schema requires `error: string`, while production authentication returns `error: { code, message }`.
- Authentication documentation and actual session/API-key behavior are not aligned.

A buyer must be able to generate a client from the specification and receive responses that conform to it.

### 10. Maintainability And Test Quality Create Product Risk

- The TI scraper contains roughly 579 TypeScript files and 123,000 lines.
- `frontend/src/app/ti/pageClient.tsx` is approximately 9,852 lines and contains large dormant workbench sections.
- Core evaluation code relies heavily on `any` and `@ts-nocheck`.
- The selected 86 API/pipeline tests pass, but they do not catch current production semantic failures.

Tests must validate domain meaning and persisted production-equivalent behavior, not merely implementation shape.

## What Must Be Preserved

The existing implementation has valuable foundations that must not be discarded:

- The normalized `threat_intel` PostgreSQL schema and source/capture/entity/claim/evidence lineage.
- Metadata-only handling for sensitive and restricted sources.
- Production captures contain no inline stolen-data bodies.
- Source legal notes and collection justification are populated.
- Restricted locators, credentials, tokens, and secret-bearing URLs are filtered from public output.
- Tenant boundaries, retention classes, legal holds, provenance, and append-only review concepts.
- The production backup and restore-drill artifacts.
- The visually polished parts of the public interface and its evidence-boundary language.

Refactor or replace incorrect behavior behind these foundations without replacing the entire product or creating another source of truth.

## Reconciliation With `goal2.md`

`goal2.md` was reviewed against the newer production state. Its findings reconcile as follows:

| Goal 2 finding | Current state | Goal 3 disposition |
| --- | --- | --- |
| No production organizations, alerts, or deliveries | Acceptance-test organizations, alerts, and deliveries now exist, but no customer-grade workflow exists and one delivery failed | Still open; require genuine tenant end-to-end acceptance |
| Circular accuracy evaluation | Automated corpus grew, but remains overwhelmingly same-field parity with only eight thesis-audit labels | Still open; replace with independent benchmark |
| Real-time and coverage unproven | Registered sources grew substantially, but only 124 have captures and first-report/alert latency is still absent | Still open; measure useful active coverage and real timeliness |
| Dataset not APT-focused or clean | Profile count changed, but only three profiles are APTs and duplicates/junk remain | Still open |
| Keyword extraction dominates | Source-specific parsers exist, but generic extraction and semantic false matches still dominate visible results | Still open |
| Public search not reliably pipeline-backed | Pipeline integration improved, but LockBit/APT29/APT41 production behavior remains incorrect | Still open |
| API unsafe and undocumented | OpenAPI and authentication now exist; rate-limit issues may have changed, but contract mismatch and missing resources remain | Partially improved; still open |
| Business analysis is labels rather than analysis | Essentially unchanged | Still open |
| Operational maturity inadequate | Backup and restore evidence improved and a schedule now exists; production workflow and semantic monitoring remain inadequate | Partially improved; still open |

No item is closed merely because its implementation shape changed. Closure requires the acceptance gates below.

## Conflict-Safe Work Order

`goal2.md` and `goal3.md` may be worked on concurrently, but two workers must never edit the same ownership lane at the same time.

### Coordination Protocol

1. Before editing, inspect `git status`, `git log -5`, and the current diff. Treat all uncommitted changes as owned by another worker unless proven otherwise.
2. Do not reset, revert, overwrite, or reformat another worker's changes.
3. Commit one acceptance slice at a time with its tests and evidence. Avoid broad mixed commits.
4. If Goal 2 work is active in a shared file, Goal 3 skips that file and works on the next non-overlapping phase.
5. Goal 3 owns the final integration audit. After Goal 2 changes land, rebase or merge normally, inspect the resulting behavior, and fix remaining failures at their shared root.
6. Frontend truthfulness work occurs after the underlying data contract is correct. Do not mask backend failures with display logic.

### Ownership While Goal 2 Is Active

Goal 2 retains temporary ownership of any already-started work in:

- API gateway/rate limiting and proxy trust
- Existing public-search scheduling changes
- Backup scheduling and operations scripts
- Existing organization/watchlist/alert delivery changes
- Any file currently modified in the shared worktree

Goal 3 starts with non-overlapping correctness and evidence work, in this order:

1. Dark-web count truthfulness and index reconciliation.
2. Actor geography, textual-mention, freshness, and evidence semantics.
3. Independent evaluation corpus and evaluation-metric correctness.
4. Timeliness event definitions and instrumentation.
5. Incident identity, temporal deduplication, and IOC qualification.
6. APT/source coverage and source-health truthfulness.
7. Business-model/publicity/communication research data.
8. DWM live tenant integration and API contract completion.
9. Frontend integration, mobile/desktop acceptance, and final production audit.

Shared high-conflict files such as `frontend/src/app/ti/pageClient.tsx`, `api/src/utils/ti/search.ts`, `ti/scraper/src/pipeline/*`, `ti/scraper/src/storage/postgresScraperStore.ts`, and migrations are serialized. Goal 3 edits them only after current Goal 2 changes are committed or explicitly handed off.

## Ordered Implementation And Acceptance Gates

### Phase 1: Remove Fabricated And Semantically Invalid Output

- Replace hardcoded dark-web counts with exact database queries and explicit count definitions.
- Make empty, unavailable, stale, and zero-result states truthful.
- Separate actor origin, operational geography, victim geography, source geography, and generic country mentions.
- Require actor-identity evidence rather than text mention for actor search results.
- Derive `last_seen` only from qualifying actor activity with a source and event timestamp.
- Strip scripts, styles, navigation, cookie banners, repeated feed wrappers, and markup from analyst-visible activity.

Acceptance:

- APT29 correctly shows Russian attribution/origin and does not label Russia a victim without victim evidence.
- LockBit does not return BrainCipher merely because a description mentions LockBit code.
- APT41 with zero evidence shows no activity date.
- Akira index counts equal queryable records and the same canonical Akira identity resolves consistently across product surfaces.
- Tests include negative semantic cases and production-equivalent persisted data.

### Phase 2: Build A Defensible Evaluation System

- Replace circular field-parity metrics with a versioned, independently labeled corpus from real retained captures.
- Include representative APT, ransomware, victim, CVE, malware, TTP, country, sector, impact, and dataset cases.
- Include true positives, true negatives, false positives, and false negatives.
- Record annotator, source independence, adjudication, dataset split, parser version, and immutable label history.
- Correct precision, recall, F1, calibration, and error-breakdown calculations.
- Prevent automated checks from being reported as independent validation.

Acceptance:

- A qualified reviewer can reproduce every metric from stored labels and captures.
- Precision and recall are reported by entity type, source family, parser, and dataset split.
- The benchmark contains enough stratified cases to expose common failure modes; eight manual labels are not sufficient.
- A held-out set is not used to tune extraction rules.
- A sample audit of metric rows agrees with manual calculation.

### Phase 3: Implement Real Timeliness Measurement

- Define and persist actor-report time, victim-report time, publisher time, collection time, processing time, first-visible time, alert-created time, delivery-attempt time, and delivered time.
- Preserve unknown values rather than substituting collection time.
- Record which timestamp and source established `first_reported`.
- Detect impossible ordering and clock/source anomalies.
- Measure median and p95 by source family, actor, and pipeline stage.

Acceptance:

- Representative real incidents have complete, evidence-linked timelines.
- First-report-to-publication and first-report-to-delivered-alert are measurable.
- `reported_at` and `alerted_at` are not universally null.
- Zero-second values are demonstrably real rather than copied timestamps.

### Phase 4: Fix Canonical Identity, Correlation, Deduplication, And Indicators

- Use stable logical incident identity independent of changing feed content hashes.
- Preserve captures and revisions as temporal evidence without duplicating the incident.
- Resolve actor and victim aliases conservatively with explicit merge/split review.
- Persist actor linkage on incidents where supported.
- Separate source URLs, contacted domains, software assets, observables, and actionable IOCs.
- Require context and type-specific validation before exposing an IOC.

Acceptance:

- Repeated collection of the same feed entry updates lineage without creating dozens of incidents.
- Duplicate-title and duplicate-indicator rates fall to an explained, monitored threshold.
- Benign navigation links, JavaScript identifiers, CSS names, and common social/CDN links are not exported as IOCs.
- Analysts can inspect why identities were merged and reverse an incorrect merge.

### Phase 5: Establish Real APT And Source Coverage

- Select and document a defensible long-lived APT source portfolio across RSS/blog, public Telegram, public advisories/APIs, and approved metadata-only dark-web sources.
- Make source status reflect attempts, successful captures, useful yield, parser success, freshness, and legal mode.
- Stop counting registered but never-attempted sources as coverage.
- Expand APT profiles with aliases, campaigns, victims, sectors, TTPs, and temporal evidence from independent sources.
- Keep ransomware coverage, but report it separately from APT coverage.

Acceptance:

- Multiple material APTs have recent, multi-source, provenance-backed profiles.
- At least one approved source of every thesis-selected source type operates continuously end to end.
- Source fleet dashboards reconcile exactly with database attempts and captures.
- Coverage reports useful active sources, actor coverage, stale coverage, and failed coverage separately.

### Phase 6: Implement The Thesis Analysis Objectives

- Create source-backed structures for business model, extortion model, advertised product/data, buyer and intermediary communication, pricing, negotiation, payment claims, victim-pressure tactics, publication strategy, and publicity events.
- Distinguish observed communication, actor claims, third-party reporting, and analytical inference.
- Correlate publicity events with measurable outcomes only where evidence supports it.
- Do not ingest or redistribute stolen data or private conversation content.

Acceptance:

- Actor pages contain evidence-backed business-model analysis rather than generic channel labels.
- Buyer/seller and intermediary communication findings have real source evidence and review state.
- Profitability conclusions state the available evidence and cannot be inferred solely from victim counts.
- At least several representative actor case studies can be reproduced from stored evidence.

### Phase 7: Replace The Demo Monitoring Workflow

- Remove `sampleDwmProductSnapshot()` from production product paths.
- Drive DWM views from authenticated tenant organizations, watchlists, evidence matches, alerts, reviews, cases, and delivery attempts.
- Ensure alerts require a real watchlist match and evidence-supported entity resolution.
- Make retries, failures, idempotency, replay, and customer notification durable and observable.
- Add buyer-visible onboarding and a complete first-run workflow.

Acceptance:

- A fresh tenant can create an organization and watchlist, receive a real evidence-linked match, review it, deliver it to a test webhook, retry a controlled failure, and audit the entire history.
- No fictional company, generated timestamp, or sample alert appears in production.
- Webhook payloads conform to documented schemas and duplicate deliveries are prevented.
- At least one independent external receiver confirms end-to-end delivery.

### Phase 8: Publish A Stable Commercial API

- Define a versioned public API for search, actors, aliases, incidents, claims, evidence, sources, validations, alerts, evaluation, timeliness, and pagination where appropriate.
- Fully type nested OpenAPI schemas and error envelopes.
- Align API-key/session authentication, scopes, rate limits, caching, and proxy trust with documentation.
- Provide request IDs, stable error codes, idempotency where needed, and compatibility policy.
- Generate and execute contract tests from the published OpenAPI document against production-equivalent services.

Acceptance:

- A generated client can authenticate and use every documented endpoint.
- Every tested response validates against OpenAPI, including errors.
- Undocumented fields or routes are not required for core buyer workflows.
- Search and resource APIs return the same canonical identities and evidence states.

### Phase 9: Product UX, Accessibility, And Buyer Acceptance

- Keep the existing visual character while reorganizing around fast analyst decisions.
- Display provenance, freshness, review state, source independence, contradictions, and missing evidence without overwhelming non-technical users.
- Make desktop and mobile behavior reliable with empty, loading, degraded, stale, error, and large-result states.
- Remove dormant production workbench paths or split them into maintained components without changing behavior accidentally.
- Ensure public claims, pricing, developer documentation, status, and product behavior agree.

Acceptance:

- Representative users can answer who acted, what happened, who was affected, when it happened, how well it is supported, and what to do next without inspecting raw JSON.
- Desktop and mobile end-to-end checks cover APT, ransomware, company, domain, CVE, unknown, stale, contradicted, and no-result searches.
- No visible product metric or capability is sample-backed, hardcoded, or contradicted by production data.

### Phase 10: Security, Reliability, And Commercial Release Evidence

- Verify tenant isolation, authorization, outbound-fetch safety, secret handling, auditability, retention, takedown, correction, backup, restore, restart recovery, and alert delivery under failure.
- Define SLOs for collection freshness, search availability, alert latency, API availability, and delivery success.
- Add actionable monitoring for source failures, queue age, parser regressions, duplicate growth, evaluation regressions, and delivery failures.
- Perform independent security review and restore/incident drills appropriate to the product risk.

Acceptance:

- A clean environment can be installed, migrated, restored, and upgraded from the previous production version.
- Production-like failure drills demonstrate recovery without data loss, cross-tenant leakage, or silent success.
- Security and operational evidence is dated, reproducible, and tied to the released commit.
- All buyer-critical SLOs have measured baselines and alerting.

## Final Release Audit

Before marking this goal complete:

1. Deploy the exact candidate commit to production.
2. Run the full automated suite, production-equivalent PostgreSQL integration tests, generated API contract tests, and focused semantic regression tests.
3. Query production database counts, null rates, duplicates, review states, timeliness completeness, source contribution, and evaluation provenance.
4. Exercise production UI on representative desktop and mobile viewports.
5. Independently verify a stratified sample of current claims against victim disclosures, authoritative advisories, and reputable reporting.
6. Complete a fresh tenant watchlist-to-alert-to-delivery workflow.
7. Verify backup and isolated restore of the released production data.
8. Confirm that every requirement and metric in this file has attached evidence from the candidate release.
9. Re-run the critical examiner review and commercial buyer review from scratch.

## Completion Rule

This goal is complete only when all ten phases and the final release audit pass on the deployed production system.

Do not mark it complete with known buyer-blocking defects, deferred core requirements, fixture-only evidence, synthetic production data, or unmeasured claims. If a requirement cannot be completed legally or technically, the product and thesis scope must be changed explicitly and honestly rather than implying the capability exists.
