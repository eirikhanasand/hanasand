# Source Registry Operator Procedures

## Purpose
The source registry controls which public CTI sources may be queried, why they are useful, what legal basis allows collection, how often they should be collected, and when they must be reviewed or quarantined.

## Import A Safe Public Source Pack
1. Review the JSON bundle under `seeds/`.
2. Confirm every source has `legalNotes` and `catalog.legalBasis`.
3. Run seed validation through `validateSeedBundle`.
4. Review duplicate, stale, blocked, missing-legal, and adapter-incompatible counts.
5. Import only accepted sources. Importing a seed bundle must not start crawling.

## Activate Sources
Use these rules:
- `safe_public_auto`: low-risk public HTTP, RSS, API, static web, or PDF sources may move from `candidate` to `active` after validation.
- `public_requires_review`: keep as `needs_review` until an analyst applies a `SourceReviewDecision`.
- `metadata_only`: keep raw content disabled unless the source policy explicitly allows metadata-only collection.
- `restricted_protocol` or `disabled`: do not activate without a narrow written protocol.

## Query Coverage Review
Before running an actor or sector query, generate a source activation report. The report should show:
- active sources that match actor aliases, topics, industries, regions, or countries;
- approved but idle sources that can be scheduled;
- candidate-only sources that are safe but not yet activated;
- blocked sources with policy reason;
- stale sources with missed freshness targets;
- duplicate sources by tenant/type/canonical URL;
- adapter-incompatible sources.

Use coverage explanations for common workflows:
- `APT29` or `Midnight Blizzard`: prefer vendor reports, government advisories, ATT&CK references, and public threat reports with actor alias coverage.
- `healthcare ransomware Europe`: prefer ransomware, sector, and regional coverage.
- `CVE-2024-*`: prefer government vulnerability feeds, vendor advisories, GitHub advisories, and NVD/CISA-style APIs.
- `Norway critical infrastructure`: prefer national CERT, government advisory, infrastructure-sector, and Europe/Norway coverage.

For `/v1/intel/search`, use `buildSourceActivationApiResponse` to produce the API-ready contract. It groups active coverage, approved-idle sources, candidate gaps, missing legal notes, policy blocks, stale sources, duplicate canonical URLs, adapter incompatibilities, source-pack recommendations, and underserved reasons. Underserved reasons are deterministic and cover missing actor coverage, stale cadence, no public-channel coverage, no approved restricted metadata source, unhealthy sources, and disabled sources.

For source-pack recommendations, use `buildSafePublicSourcePackInstallPlan` in dry-run mode. The plan validates the seed bundle, applies tenant scope, identifies duplicates against existing sources, returns install/skip/fix-compliance recommendations, and always reports `willStartCrawling: false`. API consumers may display the plan, but source activation still requires registry/governance changes.

Use `validateSafePublicStarterPackCoverage` before promoting a curated starter pack. The current enterprise coverage proof covers `APT29`, `Scattered Spider`, `Volt Typhoon`, `Turla`, `Akira ransomware`, `MuddyWater`, `FIN7`, `Lazarus`, `LockBit`, unknown actor searches, and `CVE-2024 exploitation`.

## Production Source Onboarding
Production clear-web source packs must stay safe-public:
- allowed source types: RSS, static web, public API, and public PDF;
- allowed access methods: public HTTP or official public API;
- forbidden source classes: private forums, credentialed sources, leaked-file endpoints, CAPTCHA bypass, threat actor interaction, and restricted raw payload collection;
- required metadata: legal notes, legal basis, publisher identity, trust basis, crawl cadence, freshness target, adapter compatibility, approval scope, retention class, and rollback state.

## Public Advisory And Security Signal Connectors
Advisory-grade connectors may ingest only approved public records from these source families:
- `github_advisory`: public GitHub Security Advisories or public repository advisory metadata, never private repository content.
- `cert_government`: CISA KEV-style records, national CERT/NCSC feeds, and government advisories.
- `vendor_report`: vendor security blogs, incident reports, and public research writeups.
- `malware_report_feed`: public malware, tool, IOC, and research feeds that do not require payload retrieval.
- `public_report_index`: curated public report indexes with canonical links back to public source material.

Each connector record must normalize into an API-ready public signal delta with source family, source id, title, canonical URL, published or observed time, confidence, reliability score, language, region, tags, matched actors, malware/tools, CVEs, campaigns, sectors, countries, victims, and a deterministic dedupe key. Dedupe keys should combine source family, canonical URL, and matched-entity identity so GitHub advisories, CISA records, vendor posts, public feeds, and static captures can merge into one evidence-backed item without duplicating evidence.

Connector output must preserve provenance and keep unsafe material out of API payloads. The DTO should expose public-only provenance, evidence-backed state, source id, connector family, collection time, parser version when available, and merge target. URLs with secrets, tokens, payload/download affordances, private repository paths, auth-gated links, or malformed schemes must be replaced with `unsafe_url_hash:<sha>` references. The raw unsafe URL must not appear in logs, evidence deltas, status DTOs, or suppression lists.

Policy guards are mandatory for every advisory connector: public-only, no auth bypass, no private repo access, no CAPTCHA solving, no terms bypass, no exploit payload download, and no leaked data redistribution. Disabled, rejected, unavailable, policy-disabled, stale, duplicate, and edited records should remain visible as suppression or state metadata so analysts can understand why a source did not contribute to the fast answer.

Use `buildPublicAdvisorySignalConnector` for source-family ranking and `buildPublicSignalFusionWorkbench` when combining advisory signals with public-channel and clear-web capture hints. The connector supports actor, malware/tool, CVE, campaign, sector, country, and victim/company queries, and writes useful signals into `publicSignalFusion.advisoryConnector` plus mergeable `publicSignalDeltas` targeting clear-web capture evidence.

Use `publicSignalFusion.analystSourceWorkbench` for analyst-facing source decisions. The workbench explains why a public source was trusted, suppressed, merged, stale, duplicated, unavailable, edited/deleted, policy-disabled, parser-gap, legal/robots-held, or low-yield. Its action rows are dry-run-only and may propose approval, disable/pause, trust changes, cadence changes, duplicate marking, parser repair, legal/robots review, or source-pack promotion. These rows are handoff packets for Agent 01 governance, Agent 02 scheduler cadence, Agent 06 evidence yield, Agent 07 quality gates, Agent 09 API fields, and Agent 10 SLO dashboards; they must not mutate source state, start crawling, expose unsafe URLs, or weaken public-only guardrails.

Use the adapter failure observatory when runtime collection has already attempted, skipped, or blocked a source. `buildAdapterFailureObservation` and `buildAdapterFailureObservatory` emit source marketplace inputs for failure class, source family, query class, parser profile, canonical URL hash, retry/backoff, stale date, unsupported MIME, content-size cap, timeout, duplicate canonical, parser confidence, extraction warnings, robots/legal hold, and Agent 01/02/06/07/09/10 handoff actions. Source scoring should use these fields to lower scores, request review, pause/decrease cadence, suppress duplicates, or create parser-gap work without exposing raw URLs, onion links, HTML, raw text, payloads, credentials, cookies, tokens, private invites, or restricted raw material.

Use `buildAdapterProductionReadinessPacket` for future dynamic/browser worker rollout planning. The packet is not an enablement switch: browser workers remain disabled in the DTO, and the gate reports blockers/warnings from robots/legal policy, memory caps, and observatory outcomes before any separate canary allocation.

The starter pack now covers actor intelligence, vulnerability intelligence, ransomware/victim reporting, vendor research, government advisories, malware reports, and public datasets. It intentionally does not activate public-channel or restricted-metadata collection; those remain separate approval tracks.

Use `buildSourceCoveragePlanApiResponse` or POST `/v1/sources/coverage-plan` to show another CTI application how to interpret coverage gaps. The DTO is dry-run-only and returns active sources, approved-idle sources, missing verticals, stale/policy/adapter gaps, safe source-pack recommendations, forbidden source classes, and install-plan summaries. It always reports `willMutate: false` and `willStartCrawling: false`.

Use `buildSourcePortfolioApiResponse` or POST `/v1/sources/portfolio` for operator portfolio views. The DTO groups approved, active, and candidate sources by family, actor coverage, region, sector, language, legal-review age, robots-review age, reliability, and extraction yield. It also returns safe-public source-pack onboarding plans with duplicate analysis, compliance completeness, expected coverage delta, scheduler-cost estimates, parser compatibility, rollback/quarantine state, promotion safety, and SLO burn-down actions. It is dry-run-only: `willMutate: false` and `willStartCrawling: false`.

Use `buildSourceActivationBatchApiResponse` or POST `/v1/sources/activation-batches` for operator decision packets that turn portfolio recommendations into runtime collection readiness. Each proposed safe-public source includes why it matters, expected coverage delta, adapter/parser owner, parser compatibility, expected cadence, estimated scheduler cost, max bytes, retention class, legal notes, legal/robots review state, rollback/quarantine state, and safe-public rationale. Activation batches are dry-run-only and non-crawling; parser gaps block activation instead of allowing snippet-only runtime degradation.

Use `buildSourceRuntimeSlaApiResponse` or POST `/v1/sources/runtime-sla` for production operator SLA checks before release. The DTO reports freshness, capture success ratio, parser compatibility, legal/robots review age, scheduler cost, evidence yield, claim yield, rollback, and quarantine state for each query-matching source. Remediation is dry-run-only and names the owning workstream for approved-source activation, noisy-source pause, quarantine, legal/robots review, cadence changes, duplicate retirement, Agent 03 parser-support requests, Agent 06 yield gaps, and Agent 10 release holds. It never mutates source state or starts crawling.

Task V promotion gates are included on each runtime SLA query and activation batch runtime SLA block. `sourceFamilyGate` enforces minimum safe-public source-family diversity for actor, ransomware/victim, CVE, sector, country, and malware/tool query classes. `promotionGate` converts SLA breaches into compact `pass`, `warn`, `hold`, or `rollback` decisions with owner-specific holds for Agent 02 scheduler cost, Agent 03 parser gaps, Agent 06 evidence/claim yield, Agent 01 legal/robots/source-family coverage, and Agent 10 quarantine rollback. `releasePacket` on `/v1/sources/runtime-sla` aggregates those query gates for release promotion without mutating queues, leases, sources, or crawl state.

Use `buildSourceCoverageCloseoutApiResponse` or POST `/v1/sources/coverage-closeout` for Task W query-family readiness and safe activation-wave planning. The closeout DTO emits dry-run activation waves for at least 50 safe public CTI sources across vendor blogs, advisories, RSS, GitHub/security advisories, public research feeds, and government CERT sources. Each wave source includes approval scope, legal/robots freshness, parser compatibility, scheduler budget, expected evidence yield, rollback/quarantine plan, and Agent 07/09/10 promotion impact. Restricted, private, leaked-file, auth, CAPTCHA, invite, and public-chat sources remain excluded from safe-public coverage.

Task X extends the same route-visible contracts with `executionReadiness` packets for first production rollout rehearsal. `/v1/sources/coverage-closeout`, `/v1/sources/activation-batches`, `/v1/contracts`, and `/v1/intel/search.sourceCoverage` now expose first-10 canary sources, a 50-source public rollout, excluded unsafe/parser-gap/duplicate source proofs, legal/robots proof age, Agent 03 parser ownership, Agent 02 queue budget impact, source retirement and duplicate-suppression dry runs, rollback/quarantine triggers, post-activation drift checks, and Agent 10 release-packet fields. These packets are execution-ready operator DTOs only: they do not mutate the registry, lease work, crawl sources, or admit restricted/private/leaked/auth/CAPTCHA/chat classes into safe-public coverage.

Task Z adds `rolloutPromotion` beside execution readiness for canary-to-expanded rollout promotion. The packet summarizes first-10 canary ids, 50-source rollout ids, rollback criteria, evidence-yield thresholds, Agent 02 cost controls, Agent 06 evidence certification, Agent 07 polling state, Agent 09 contract-index fields, Agent 10 canary/release decisions, source retirement, duplicate suppression, parser-gap handoff, and post-canary monitoring. It is safe-public-only and remains dry-run/non-crawling.

For runtime actor-query planning, source coverage DTOs also expose:
- `slo`: per-query enforcement-grade coverage SLO status for query class, active safe-public count, source-family diversity, freshness, geography/sector coverage, legal review, and robots review.
- `drift`: per-query SLO and governance drift with API-ready reason codes and dry-run remediation intent.
- `portfolio`: compact portfolio groupings for the query so `/v1/intel/search` can explain whether a partial result is blocked by source-family concentration, stale review, low reliability, missing actor/region/sector coverage, or extraction yield.
- `activationBatch`: compact dry-run source activation packet for the query, including operator legal/robots/parser decisions and Agent 02 scheduler-cost fields.
- `runtimeSla`: compact runtime SLA state for the query, including public/API impact, release-hold state, and dry-run remediation owners for Agent 01/02/03/06/10.
- `runtimeSla.promotionGate`: compact source SLA enforcement gate for release packets, including holds, warnings, repair packets, and Agent 10 release-decision fields.
- `coverageCloseout`: compact Task W query-family readiness, activation-wave ids, source-family gate state, and Agent 07/09/10 promotion impact.
- `eligibleSources`: active and approved-idle sources matching the query.
- `selectedSources`: the top active sources the planner can use immediately.
- `missingApprovedPublicSources`: safe-public pack candidates for missing actor or vertical coverage.
- `governanceDrift`: approval expiry, non-approved approval state, stale legal notes, missing/stale robots notes, degraded health, adapter mismatch, duplicate canonical URL, and source-pack version skew.
- `remediationPlans`: dry-run-only enforcement plans for activation, quarantine, cadence increase/reduction, legal review, adapter reassignment, duplicate retirement, and approved public source-pack additions.

Another CTI application should interpret coverage gaps this way:
- `activeSources`: evidence can be scheduled through normal approved collection paths.
- `approvedIdleSources`: collection may be scheduled after scheduler eligibility checks.
- `safeSourcePackRecommendations`: source onboarding candidates only; installing the pack creates candidates and does not crawl.
- `missingVerticals`: show operator-facing gaps such as vendor research, government advisories, public datasets, public-channel coverage, or restricted metadata.
- `forbiddenSourceClasses`: never offer one-click enablement; route to governance or keep disabled.

## Source Coverage SLOs
Use these source-coverage SLOs before promoting scraper-native actor search:
- High-priority actor queries require at least three active safe-public sources, two source families, current legal and robots review, fresh collection, and geographic plus sector coverage.
- Vulnerability queries require at least two active safe-public sources, two source families, current legal and robots review, and fresh government/public dataset style coverage such as CISA KEV or NVD.
- Ransomware/victim queries require at least three active safe-public sources, two source families, fresh public ransomware or incident reporting, and sector coverage, never leaked-file retrieval.
- Sector, country, and malware/tool queries require active safe-public coverage with family diversity; sector queries must expose sector coverage and country queries must expose geographic coverage.
- Public-channel and restricted-metadata verticals may appear as gaps; they must remain separate approval tracks.
- Governance drift should be zero critical items before activation and no warning item older than seven days without a review ticket.
- Restricted, leaked-file, private/forum, credentialed, chat, auth-gated, CAPTCHA-gated, or metadata-only sources never satisfy public-source SLOs even when they match the query. They can appear only as excluded drift or separate approval-track coverage.

Tenant boundaries:
- Coverage plans include only tenant-matching sources plus global sources.
- Safe source-pack recommendations inherit the requesting tenant only as dry-run candidate scope.
- Approval audit fields must include approval state, approval expiry, legal contact or ticket when required, legal notes review timestamp, and robots review timestamp for crawlable public sources.

## Registry Reconciliation
Run `buildSourceRegistryReconciliationReport` as a dry-run operational loop before changing source state. The report compares desired source-pack state, current registry state, adapter capability state, approval state, health state, scheduler state, and recent capture state.

Stable drift codes:
- `missing_approved_source`: desired safe-public pack source is absent from the registry.
- `approved_not_scheduled`: approved or active source is not visible in scheduler state.
- `active_unhealthy`: active source health is degraded, failing, or high-error.
- `active_no_recent_captures`: active source missed its recent-capture freshness window.
- `disabled_by_policy`: source is disabled, rejected, or policy-disabled.
- `expired_approval`: approval expiry has passed.
- `stale_legal_notes`: legal notes or terms review are stale.
- `duplicate_source`: tenant/type/canonical URL duplicates exist.
- `adapter_capability_mismatch`: source catalog compatibility or deployed adapter capability does not match.

Bulk review plans are dry-run-first and report `willStartCrawling: false`. They group safe operator actions: approve candidates, quarantine degraded sources, restore recovered sources, retire dead or duplicate sources, and request refreshed legal notes. Agent 02 skipped-source reasons should map scheduler-caused skips to these same drift codes where possible.

## Source Cutover Rehearsal
Run `buildSourceCutoverRehearsalReport` before promoting scraper-native search. The report combines activation coverage, reconciliation drift, dry-run source-pack install plans, source health, governance evidence, blockers, warnings, and a `source_cutover_ready` promotion gate.

Every recommended action gets governance evidence:
- who should approve it: source governance, legal, adapter owner, or scheduler owner;
- why the recommendation is safe;
- what collection would be enabled after approval;
- what remains disabled, including restricted raw payload collection and unsafe source classes;
- whether rollback or quarantine is recommended.

Agent 09 should expose compact cutover fields: state, query list, activation summaries/gaps, reconciliation summary, health summary, governance evidence, and promotion gate. It should suppress internal registry noise such as per-source reason strings, seed validation internals, and scheduler-state internals.

Agent 10 can consume `promotionGate.gate === "source_cutover_ready"` as a deployment promotion input. `promotionGate.proof.willStartCrawling` is always `false`; the rehearsal is observational and dry-run-only.

## Source Apply Plans
Use `buildSourceApplyPlan` to convert cutover rehearsal evidence into explicit dry-run mutation plans. Apply-plan generation never mutates registry state and reports `willMutate: false`.

Supported apply actions:
- `approve`: operator approval for safe-public candidates or source-pack candidates.
- `activate`: future operator-applied activation after prerequisites pass.
- `quarantine`: contain degraded or unsafe sources.
- `restore`: return recovered sources to controlled operation.
- `retire`: remove dead or duplicate sources from active use.
- `request_legal_notes`: request legal, approval, or adapter review.
- `leave_unchanged`: record that no source mutation is recommended.

Every apply item includes prerequisite checks, expected registry diff, rollback state, policy impact, collection impact, and an automation classification: `automation_safe`, `human_approval_required`, `blocked`, or `rollback_only`. Restricted and darknet metadata sources cannot be auto-activated; their plans keep restricted raw payload collection and automatic restricted-source activation disabled.

Use `executeSourceApplyPlanDryRun` only for dry-run previews. It returns would-apply/blocked results and explicitly reports `executed: false`.

## `/v1/sources/apply-plan` Contract
Use `buildSourceApplyPlanApiResponse` for the frozen source-admin DTO. The request shape includes tenant scope, query scope, source-pack ids, selected actions, `dryRun: true`, and optional execution preview. The response includes:
- `applyPlanId` for Agent 10 promotion packets as `sourceApplyPlanId`;
- action and automation summaries;
- approval counts, legal-review counts, blocked counts, and rollback-only counts;
- compact item rows with action, automation class, prerequisite failures, expected diff count, policy impact, collection impact, rollback state, and reason;
- optional dry-run execution preview;
- schema-ready examples for happy path, human approval required, blocked restricted source, duplicate source, stale legal notes, and rollback-only quarantine.

The API DTO always reports `willMutate: false` and `willStartCrawling: false`. It must not be used as an execution endpoint; future mutation endpoints need a separate explicit apply command and operator approval flow.

Agent 09 can mount `handleSourceApplyPlanRoute` behind `/v1/sources/apply-plan` without reading registry internals. The helper validates `queryScope.queries`, selected source apply actions, and dry-run-only semantics, then returns either the frozen contract plus apply-plan DTO or a safe error body with `bad_request`, `invalid_action`, or `dry_run_required`.

Use `sourceApplyPlanApiContract()` when exporting OpenAPI or JSON-schema-like route metadata. The contract lists supported request fields, item fields, allowed actions, automation states, forbidden mutation fields, and compact examples. The route must never apply review decisions, open a database transaction, mutate source records, lease frontier tasks, expose raw payloads, or start crawling.

Mounted endpoint proof:
- Local command: `bun run check:source-apply-plan`.
- Expected compact output: `ok=true`; `happy_path` returns HTTP 200 with `dryRun=true`, `willMutate=false`, and `willStartCrawling=false`; `blocked_restricted_source` keeps restricted activation and restricted raw payload collection disabled; `invalid_action` returns HTTP 400 `invalid_action`.
- The proof starts the Bun API server, posts to `/v1/sources/apply-plan`, and verifies source and frontier snapshots are unchanged.

## Health And Rollback
Adapter health signals should update `SourceHealth` and `SourceCrawlState`:
- repeated failures move active sources to `quarantined`;
- recovered sources return to `probation`;
- stale sources stay visible in activation reports;
- rollback reasons must be stored in catalog rollback metadata or review decisions.

Use `buildSourceHealthRollup` to summarize adapter observations before updating registry state. The rollup tracks success rate, HTTP status mix, parser warning count, median and p95 latency, freshness lag, changed-content rate, duplicate rate, policy-block rate, adapter failure categories, and the derived `SourceHealth` payload.

For Postgres persistence, map rollups with `sourceHealthRollupToRow` into `source_health_rollups`, and map source score snapshots with `sourceScoreHistoryRow` into `source_score_history`. These helpers intentionally return plain row-shaped objects so the future storage adapter can batch insert without changing the registry contract.

## Review Decisions
Use `SourceReviewDecision` for approval and containment:
- `approve`: records analyst/operator approval and optional expiry;
- `reject`: records a blocked source;
- `expire`: moves active reviewed sources back to `needs_review`;
- `quarantine`: contains a source without deleting it;
- `restore`: moves a recovered source back to a controlled lifecycle state.

## Coordination Notes
- Agent 02 consumes collection SLA, crawl cadence, budget class, and skipped-source reasons.
- Agent 03/04/05 provide adapter compatibility and source-specific health signals.
- Agent 06 consumes retention class.
- Agent 09 should preserve catalog metadata and activation report categories in source-admin and search APIs.
- Agent 10 should alert on health rollups, stale source rates, and quarantine events.
