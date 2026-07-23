# Hanasand Autonomous Threat-Intelligence Completion Goal

## Status And Authority

This is the authoritative ordered execution contract for completing the remaining production, thesis, and maintainability work after `goal.md`, `goal2.md`, and `goal3.md`.

Work through the numbered goals in order. Earlier goal files remain binding where they add stricter evidence, safety, tenant-isolation, or research requirements. A goal is complete only when its production behavior and persisted results are verified; code, tests, UI labels, fixtures, or agent claims alone do not count.

The product must operate automatically end to end. Ambiguous or low-quality input may be quarantined, rejected, retried, or withheld from promotion, but the pipeline must not wait indefinitely for a human. Hanasand AI may perform review and adjudication only when its exact model/version, evidence input, decision, confidence, and evaluation result are persisted and reproducible.

Fake, look-real, sample, fixture, synthetic, demo, proof-only, and hardcoded production data are prohibited. Focused test fixtures remain allowed only inside tests and never count as production evidence.

Route authority: the browser product is `/browser`, with reports at `/browser/report`. `/solutions/browser` is intentionally retired; its 404 is expected and must not be treated as a missing surface or reintroduced as an alias. Commit `9896f5fc` records this authority in the agent and goal documentation.

## Global Evidence Rules

Every production claim must trace through:

`public output -> automated review -> analytical claim -> extracted field -> immutable capture -> current source -> timestamps -> parser/model version -> confidence -> independence -> validation state`

For every goal:

- Inspect runtime reachability before adding or deleting code.
- Fix the shared production path, not a UI symptom or one caller.
- Do not convert missing data into success, zero, `unknown`, a warning label, or a readiness artifact.
- Delete obsolete fallbacks, fixtures, DTOs, routes, stores, tests, and notes made unnecessary by the real fix.
- Use current authoritative sources and verify that they still resolve and produce relevant data.
- Do not count source registration, a health row, a test, or a one-off canary as coverage without real useful captures.
- Persist failures and negative outcomes; automatic review must include false-positive, false-negative, true-positive, and true-negative cases.
- Deploy from `/home/hanasand/hanasand`, probe the live API/UI/database, and preserve legal, retention, redaction, and tenant boundaries.

## Ordered Acceptance Goals

### 1. Complete Actor And APT Corpus Coverage

Baseline: production had 44 actor profiles, including five APT profiles.

Required implementation:

- Build a versioned authoritative actor catalog from current primary sources, led by MITRE ATT&CK Enterprise group records and supplemented by current government/CERT and authoritative ransomware/extortion group sources.
- Cover every current named MITRE ATT&CK Enterprise group and every current, evidence-producing ransomware/extortion group that can legally be monitored. Do not invent actors or retain aliases as separate actors.
- Resolve aliases, renamed groups, splinters, overlaps, and duplicate profiles into stable canonical identities without collapsing genuinely distinct groups.
- Require at least one current authoritative source reference for catalog identity and at least one immutable capture before presenting activity, targets, techniques, infrastructure, tools, or `lastSeen` as observed.
- Refresh the catalog and source evidence automatically on a bounded schedule. Record source version/retrieval time and remove or retire actors that are no longer present without deleting historical evidence.
- State exact production counts for canonical actors, APTs, ransomware/extortion groups, aliases, evidence-backed profiles, and profiles with recent activity.

Acceptance:

- The production catalog reconciles one-to-one with the current authoritative source inventories, with documented exclusions and no unexplained missing groups.
- Representative random APT, ransomware, renamed, alias, and negative/no-activity queries resolve correctly in the live API and `/ti/<query>`.
- No profile is created from a generic feed label, keyword mention, fixture, or duplicated alias.
- Catalog completeness and activity coverage are separate measured values; identity registration is never reported as observed activity.

### 2. Make Source Accounting Complete And Truthful

Historical baseline: 1,473 registered sources, 795 active, 357 capture-producing, and nine with `last_seen_at`.

Required minimum operating baseline: at least 5,000 qualifying clear-web feeds, 1,000 qualifying lawful dark-web/Tor feeds, and 100 qualifying public Telegram feeds, for at least 6,100 unique active intelligence-producing feeds. These are minimums, not completion caps; automatic discovery and validation must continue beyond them toward 10,000–100,000+ feeds where legitimate, relevant, useful feeds actually exist.

Required implementation:

- Audit every registered source for canonical identity, duplication, current reachability, legal mode, collection method, and production caller.
- Remove registry padding and retire obsolete, duplicate, fake, superseded, or permanently dead sources. The target is every retained source genuinely monitored, not preserving an inflated number.
- Count only active feeds that publish or update operational intelligence. Static legacy documentation, historical reference pages, generic homepages, search-result wrappers, copied mirrors, source-description records, and registration-only entries do not satisfy the baseline.
- Schedule bounded automatic health checks for every retained source, including sources that currently yield no intelligence.
- Persist `last_checked_at` for every attempt, `last_success_at` for successful retrieval, and `last_seen_at` only for a real observed source response/content event. Never update `last_seen_at` merely to make coverage look complete.
- Feed every check into source health and expose failure class, retry/backoff, freshness, useful yield, and last real evidence without leaking restricted locators.
- Use Hanasand AI automatically to review source relevance and parser output after collection; AI review cannot manufacture source success or evidence.
- Discover, validate, schedule, and retire feeds automatically with bounded concurrency, per-source cadence, backpressure, retry, and resource accounting suitable for 6,100+ feeds without starving processing, review, alerts, or API traffic.

Acceptance:

- Every retained source has a recent scheduled check or an explicit persisted bounded backoff/failure state.
- Production has at least 5,000 qualifying clear-web feeds, 1,000 qualifying lawful dark-web/Tor feeds, and 100 qualifying public Telegram feeds; no source is counted in more than one baseline slot.
- Every source counted toward the baseline has an executable production collector, regularly updated `last_checked_at`, truthful last-content/update time, and sustained useful retained intelligence over multiple scheduled cycles within its documented activity window.
- Active, checked, successful, useful, capture-producing, and recently seen counts reconcile across PostgreSQL, API, scheduler, and UI.
- No source is marked active when it has no executable production collection path.
- Duplicate, bad, irrelevant, inactive, legacy-documentation-style, copied, unsafe, or non-producing sources are excluded from qualifying counts even if registered or reachable.
- A restart resumes monitoring without duplicate schedules, lost health history, or timestamp fabrication.

### 3. Establish Large, Current Telegram And Dark-Web Coverage

Required implementation:

- Discover current Telegram channels and Tor services from authoritative publisher, CERT, research, and verified actor references. Verify ownership/relevance and current reachability before activation.
- Collect only public Telegram content and lawful metadata-only Tor evidence. Never retain stolen content, credentials, raw leak bodies, private invitations, or restricted locators in public output.
- Diversify sources across APT reporting, CERT/government reporting, malware/ransomware research, actor announcements, victim publications, and relevant regional/language coverage.
- Automatically reverify sources, retire dead or hijacked channels/services, and measure useful capture yield, actor/victim coverage, freshness, parser quality, duplicates, and failure rates.
- Maintain at least 100 qualifying public Telegram feeds and 1,000 qualifying lawful dark-web/Tor feeds, all independently verified, regularly checked, and sustainably producing useful retained intelligence. One actor mirrored across copied channels/services counts once unless each feed contributes independently useful evidence.
- Continue automatic discovery beyond the minimums until a documented source-saturation review shows that newly discovered verified feeds no longer materially change covered actors, regions, languages, and source families. Raw source count alone is not strength.

Acceptance:

- Production contains at least 100 independently verified public Telegram feeds and 1,000 independently verified lawful dark-web/Tor feeds with sustained useful captures across multiple scheduled cycles.
- Random positive and negative samples pass automated relevance, redaction, identity, and provenance checks.
- Dead, fake, copied, unverified, inactive, irrelevant, legacy-documentation-style, or non-producing sources do not count and are not active.
- The live UI/API lists every qualifying feed with source family, last checked time, last real content/update time, last useful intelligence time, current health/backoff, and retained capture/evidence counts, without exposing restricted locators.

### 4. Implement Fully Automatic Hanasand AI Review And Actor Attribution

Baseline: zero production claim reviews; 3,633 incidents were unreviewed and lacked useful persisted actor attribution.

Required implementation:

- Reuse the existing GPU-hosted Hanasand AI endpoint and its established job/runtime path; do not add a parallel review service.
- Queue every eligible new and historical claim/incident for bounded automatic review with idempotent retry, backoff, dead-letter handling, and restart recovery.
- Provide the model only governed evidence: source/capture metadata, safe excerpts, extracted fields, provenance, timestamps, and relevant independent references.
- Require a versioned structured response covering actor attribution, aliases, claim validity, evidence support, contradictions, uncertainty, false-positive reasons, and promote/reject/quarantine decision.
- Persist append-only AI review rows with model/version, prompt/schema version, evidence IDs, decision, rationale, confidence, timestamps, and calibration result. Never overwrite human or prior AI history.
- Automatically withhold or quarantine unsupported output while continuing the pipeline; no manual action may be required for routine operation.
- Train or tune the existing Hanasand model only with governed, labeled data and preserve a held-out set. Training data must include representative positive, negative, ambiguous, stale, duplicate, cross-actor-mention, and parser-failure cases.

Acceptance:

- All eligible production claims/incidents reach a terminal automatic review state or explicit retry/dead-letter state.
- Incident actor fields are populated only when evidence supports attribution; negative cases remain unattributed/rejected rather than guessed.
- Random success and failure samples are inspected against source evidence and meet the independently measured quality requirements in section 5.
- The queue drains and resumes across restart, endpoint failure, malformed response, model timeout, and model version upgrade.

### 5. Establish Independent, Fully Automatic Accuracy Evaluation

Baseline: 625 labels, including 600 field-parity checks, 17 cross-source checks, eight manual labels, one negative case, and 519 test-split labels.

Required implementation:

- Treat source-field parity and same-pipeline cross-source checks as diagnostics, never independent accuracy evidence.
- Build a prediction-hidden evaluation corpus from real retained captures with exhaustive expected values, representative negatives, and balanced TP/FP/FN/TN outcomes across actor, victim, incident, TTP, malware, country, sector, indicator, and business-mechanism extraction.
- Use an evaluation model/version isolated from the extraction decision. Hanasand AI may perform automatic reviewer and adjudicator roles only when predictions are blinded, reviewer contexts are independent, disagreements are preserved, and circular self-labeling is prevented.
- Anchor evaluation units to authoritative source fields or separately collected reference evidence. A model reviewing its own generated claim without independent reference evidence does not count.
- Automatically train/tune when held-out error analysis identifies systematic failures, while keeping the final test split locked and untouched.
- Report precision, recall, specificity, F1, calibration, class balance, confidence intervals, error breakdowns, source-family breakdowns, model/parser versions, and drift over time.

Acceptance:

- The final production evaluation includes meaningful positive and negative counts for every required label type and no circular labels.
- Metrics are reproducible from immutable evidence and terminal AI review/adjudication rows.
- Random successes and failures agree with the underlying sources; discovered errors re-enter training only outside the locked test set.
- Automatic operation continues without waiting for manual reviewers.

### 6. Run Real-Evidence Organization Monitoring Workflows

Required implementation:

- Create production research-monitoring organizations for Coop, Tine, Norsk Tipping, mnemonic, and NTNU. Label them clearly as Hanasand-operated research monitors; never imply that these organizations are customers or authorized users.
- Give each organization 20 specific, relevant monitored terms covering brand names, domains, subsidiaries/products, executives or public-facing identifiers where lawful, common misspellings, and relevant vendor/sector exposure.
- Route notifications only to Hanasand-controlled destinations. Do not contact employees or external systems belonging to the monitored organizations.
- Evaluate watchlists continuously against newly collected and retained real evidence. Backfilled alerts must preserve the original evidence/report timestamps and be identified as historical matches.
- Generate alerts only from real source evidence and real keyword/entity matches. Record nonmatches honestly; do not seed matching fixtures or manufacture incidents.
- Exercise review, assignment, case, delivery, retry, and audit history automatically through production APIs and persistence.

Acceptance:

- All five research tenants, 100 monitored terms, destinations, watchlists, memberships/service ownership, and audit records persist across restart.
- Real historical or new matches create source-backed alerts; nonmatching terms remain quiet.
- Delivery attempts and outcomes are observable at a Hanasand-controlled receiver and linked to alert/case/evidence history.
- These records are reported as operational research validation, not customer adoption.

### 7. Remove Or Implement The Fake Coverage Plan Endpoint

Required implementation:

- Trace every caller of `/v1/sources/coverage-plan` and its response fields.
- If no real production workflow consumes it, delete the route, handler, types, tests, documentation, and frontend expectations.
- If a real workflow needs it, replace the static SLO payload with a database-backed plan that names concrete coverage gaps, current source/capture evidence, scheduled actions, owners, deadlines, and observable completion states used by that workflow.

Acceptance:

- No response contains `{ goal: "add payworthy fresh rows" }` or equivalent placeholder language.
- The endpoint either does not exist anywhere or drives a verified production workflow with persisted real inputs and outcomes.

### 8. Remove The Sample DWM Product Path

Required implementation:

- Trace reachability of `sampleDwmProductSnapshot()` and the legacy `/solutions/dwm` files.
- If `/solutions/dwm` is permanently redirected to the real `/dwm` workspace, delete the unreachable sample page, snapshot helper, duplicate contracts, tests, and imports.
- Otherwise wire the surface to the existing tenant-scoped organization/watchlist/alert/case/delivery APIs with real loading, empty, error, and authorization states.

Acceptance:

- No production-reachable page imports or renders sample DWM data.
- The canonical DWM workspace operates on real tenant-scoped persistence and live alerts/deliveries.

### 9. Complete Third-Party Reporting

The thesis describes third-party reporting as optional, but it is mandatory for the intended high-grade submission. Existing evidence-linked STIX export, tenant-scoped case export, JSON APIs, webhook delivery, and authenticated public-advisory intake are foundations, not sufficient completion by themselves.

Required implementation:

- Define and document at least one canonical end-to-end production workflow in which an authenticated tenant selects evidence-backed findings or a case, produces a bounded standards-based report, delivers or exports it to an external recipient/system, and retains the exact delivery result.
- Reuse the existing case, `/v1/exports/stix`, JSON API, webhook, and advisory-intake paths. Do not create a parallel reporting service, duplicate contracts, sample report generator, or generic unbounded submission endpoint.
- Enforce tenant/organization scope, authentication, evidence provenance, redaction, retention, idempotency, bounded retry, and durable failure/audit history throughout the workflow.
- Clearly distinguish outbound customer reporting from authenticated inbound public-advisory submission. Never imply customer adoption or successful external receipt without retained production evidence.
- Document the supported report format, authentication, schema/version, errors, retry behavior, evidence limitations, and lawful-use boundary through the existing developer/product surfaces.

Acceptance:

- A live authenticated DB/API/browser/receiver run proves evidence selection, report generation, standards-valid output, external delivery or export, receipt/result persistence, retry/idempotency, and restart survival.
- The delivered report resolves every material claim to retained evidence and exposes no restricted locator, stolen content, credential, or cross-tenant data.
- Invalid, unauthorized, duplicate, oversized, unsafe, or failed submissions remain explicit failures and are never converted into success or generic empty output.
- Production contains no sample report, fabricated delivery, hardcoded recipient, or reporting UI that is disconnected from the real workflow.

### 10. Remove Stale Fixtures, Untyped Evaluation Code, Dead Paths, And Excess Complexity

Required implementation:

- Remove the stale `darkwebIndexFixtureRecords()` export and every obsolete fixture/contract/test path it solely supports, while preserving the live database-backed dark-web index.
- Trace `ti/scraper/src/pipeline/evaluation.ts`. If it is unused or fixture-only, delete it and its dead callers/tests. If production-reachable logic remains, replace `@ts-nocheck` and broad `any` with the smallest existing domain types and remove fixture-oriented behavior.
- Preserve `/browser` as canonical. Do not add `/solutions/browser`; remove any stale note that treats its absence as a defect.
- Build an import/route/runtime reachability inventory for the TI frontend, API, scraper startup, scheduled jobs, migrations, and production UI.
- Delete uncalled modules, routes, DTOs, adapters, fixture infrastructure, redundant stores, duplicate helpers, obsolete migrations/bootstrap paths where safely superseded, and tests that only validate dead code.
- Refactor the roughly 9,900-line TI page only along real ownership/render boundaries already present in the application. Do not replace one large file with dozens of speculative abstractions.
- Measure files, lines, bundle/build impact, startup time, and production behavior before and after. Deletion must preserve all verified workflows from goal files 1–4.

Acceptance:

- No production route, response, page, scheduler, or database hydration path depends on fixture/sample/synthetic/demo data.
- `@ts-nocheck` and avoidable broad `any` are absent from production evaluation code.
- Every retained scraper module has a production caller or a focused test for production-reachable behavior.
- The TI page and scraper have materially less dead/duplicated code, with no loss of live behavior.
- Type checks, focused tests, production builds, restart hydration, live API probes, database checks, and representative browser workflows pass.

## Completion Rule

Do not mark `goal4.md` or the persistent Codex goal complete until all ten goals pass in order on the live system and `goal.md`, `goal2.md`, and `goal3.md` have been reconciled against the resulting production state.

Completion requires exact final production counts, current authoritative coverage reconciliation, automatic AI review/evaluation evidence, real source/alert/delivery histories, a clean reachability audit, and explicit disclosure of any lawful or technical exclusion. If a requirement cannot be completed without fabricating data, violating source terms, exposing restricted material, impersonating a customer, or circularly evaluating the model, change the product/thesis claim honestly instead of simulating success.
