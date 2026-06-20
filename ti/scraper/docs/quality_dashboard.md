# Search Quality Dashboard

Agent 07 owns `ti.search_quality_dashboard.v1`, exposed from `/v1/quality/evaluate` and mirrored on `/v1/intel/search` as `qualityDashboard`.

The dashboard is a compact operator DTO for deciding whether public TI output is useful enough to promote. It does not include raw capture bodies, unsafe URLs, leaked material, credentials, private access artifacts, or threat-actor interaction content.

The same routes also expose `actorProfileReviewWorkbench` with schema `ti.actor_profile_review_workbench.v1`. This is the analyst correction surface for field-level freshness, contradiction, duplicate, wrong, missing, overconfident, underconfident, and needs-evidence review across the actor profile.

The same routes expose `evaluationDatasetGovernance` with schema `ti.evaluation_dataset_governance.v1`. This is the audit contract for evaluation labels used by actor profiles, TTP mapping, freshness, contradiction handling, and public-answer quality gates.

The same routes expose `analystQualityReviewQueue` with schema `ti.analyst_quality_review_queue.v1`. This is the release-facing queue for actor summaries, recent activity, victims, TTPs, infrastructure, malware/tools, CVEs, source gaps, and unknown-query `Searching` states.

The same routes expose `analystFeedbackLearningLoop` with schema `ti.analyst_feedback_learning_loop.v1`. This is the append-only governance contract that turns analyst corrections into evaluation records, scorecards, and replay fixtures without changing extractors, source activation, rankings, or public answers automatically.

The same routes expose `activeLearningCandidateQueue` with schema `ti.active_learning_candidate_queue.v1`. This is the human-approved candidate queue for turning analyst feedback into fixture-backed improvement proposals for extraction, ranking, source reliability, TTP mapping, entity resolution, freshness, and contradiction handling.

The same routes expose `highPriorityActorFreshnessDashboard` with schema `ti.high_priority_actor_freshness_dashboard.v1`. This tracks daily and weekly freshness for priority actors such as APT29, APT42, Sandworm, Volt Typhoon, Lazarus, Turla, LockBit, and Akira without raw evidence text or source URLs.

The same routes expose `ctiEvaluationDatasetPack` with schema `ti.cti_evaluation_dataset_pack.v1`. This packages immutable fixtures and metrics for actor, victim, TTP, IOC, stale-answer, unknown-actor, restricted no-leak, and contradiction regression coverage.

The same routes expose `qualityRuntimeValueGates` with schema `ti.quality_runtime_value_gates.v1`. This is the Program BC value gate for arbitrary actor, campaign, malware/tool, CVE, country, sector, victim, infrastructure, and unknown queries. It scores timeliness, specificity, source diversity, provenance completeness, contradiction state, evidence freshness, analyst actionability, dark-web metadata caveats, source-atlas value, stale-answer rejection, and unknown-query honesty.

`qualityRuntimeValueGates.programBdQualityEvaluationPack` exposes schema `ti.program_bd_quality_evaluation_pack.v1`. This is the Program BD marketplace-usefulness fixture pack for the default watchlist. It covers at least 20 state actor, ransomware, and cybercrime rows plus random/unknown actor guardrails. Every row carries route-visible quality metrics for summary specificity, source support, recency, false-victim risk, legal-proceeding detection, alias resolution, TTP support, source-family diversity, contradiction flags, and actionability correctness.

## Field Gates

Each field emits `pass`, `warn`, `hold`, or `missing` for:

- actor summary, aliases, recent activity, targets, sectors, countries, tools/malware, CVEs, TTPs, campaigns, infrastructure, datasets, victim/company claims, IOCs, confidence, freshness, and provenance.
- Every field carries confidence, evidence count, citation count, freshness score, reasons, and feedback targets.
- Feedback targets are `source_activation`, `parser_repair`, `graph_review`, `analyst_review`, and `public_answer_hold`.

## Dashboard Metrics

- `usefulAnswerRate`: fraction of fields that can be displayed or caveated without blocking.
- `expectedFactRecall`: fraction of expected fields that have extracted support.
- `staleFactSuppression`: `hold` when stale evidence prevents ready promotion.
- `contradictionHandling`: `hold` when contradicted evidence is present.
- `sourceFamilyDiversity`: count of supporting source families.
- `citationAvailability`: fraction of provenance records with ledger, capture, or URL citation support.
- `freshnessScore`: normalized recent-activity freshness from the actor profile.

## Release Gate

The release decision is:

- `promote` only when the search quality gate is ready and every field avoids hold/missing.
- `hold` for contradicted evidence or field-level holds.
- `partial` for useful but incomplete answers.

Operators should use the dashboard as a routing surface: missing fields go to source activation, extraction misses go to parser repair, stale/contradicted/source-biased fields go to graph review, and victim/low-confidence fields go to analyst review.

Operators should use the actor-profile review workbench for the concrete correction queue. Its rows preserve evidence IDs, ledger IDs, confidence, caveats, freshness, and contradiction signals while keeping all corrections manual-only and provenance-backed.

## Evaluation Governance

Evaluation labels cover APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, unknown actor, CVE, malware/tool, country, sector, victim/company, stale, contradicted, and low-confidence cases.

Each label carries label source, reviewer, timestamp, evidence IDs, claim-ledger refs, source family, confidence, freshness, allowed downstream use, and public-answer semantics. Unknown-actor labels are explicitly `Searching` only, with no default actor and no stale demo/cache prose.

Audit checks cover stale labels, overconfident summaries, missing provenance, contradiction handling, public-channel-only caveats, restricted metadata holds, and graph/STIX export eligibility. The DTO routes fixture gaps to Agent 01, public benchmarks to Agent 04, evidence replay to Agent 06, graph drift to Agent 08, API regression fixtures to Agent 09, and release gates to Agent 10.

## Analyst Quality Release Queue

The analyst quality review queue converts the field workbench, feedback loop, regression fixtures, and label governance into release-blocking queue rows. Each row carries field, state, priority, confidence, freshness, evidence IDs, claim-ledger refs, governed label IDs, source-family support, required manual actions, and release impact.

Release gates check freshness, provenance, source diversity, contradiction state, evidence retention, restricted holds, unknown `Searching` semantics, and label governance. The queue emits Agent 09 public/API signals and Agent 10 release-board signals without applying corrections automatically.

Unknown actor queries remain `Searching` only. The queue blocks ready promotion for unknown/random/made-up actors until evidence is captured, and it forbids default actor, demo prose, or stale cache prose.

## Feedback Learning Loop

The learning loop emits eight route-visible event contracts: actor alias correction, victim false positive, TTP mapping correction, stale activity rejection, source reliability downgrade, contradiction merge/split, restricted hold confirmation, and unknown-query `Searching` approval.

Records are immutable and append-only. They include evidence IDs, claim-ledger IDs, source feedback IDs, regression case IDs, governed label IDs, reason codes, deterministic replay keys, and idempotency keys. Persistence is readiness-only until an append-only adapter is enabled; replay imports labels before fixtures, dedupes by idempotency key, recomputes scorecards, and still requires analyst approval before any downstream training or source change.

Scorecards cover extraction precision, extraction recall, source diversity, freshness, contradiction handling, unknown actor behavior, restricted no-leak handling, and public answer latency. Fixtures cover APT29 daily freshness, APT42 instant summary, made-up actor `Searching` only, stale 2025-only rejection, public-channel rumor demotion, restricted metadata hold, and graph contradiction.

The route state explains why a public answer is partial, searching, held, or ready. Routing fans out to Agent 03 parser repair, Agent 04 source coverage, Agent 08 graph corrections, Agent 09 public API fields, and Agent 10 release gates.

The loop explicitly prohibits autonomous scraping, silent source activation, model self-mutation, raw evidence export, and restricted payload access.

## Active Learning Candidate Queue

The active-learning queue emits candidates for parser prompt/model improvement, source ranking adjustment, TTP mapping rule update, actor alias merge/split, victim false-positive suppression, IOC false-positive suppression, source reliability downgrade, freshness rule update, and contradiction resolution.

Every candidate includes reviewer requirements, evidence IDs, claim-ledger IDs, reason, expected effect, rollback, fixture requirement, affected public/API/graph/STIX fields, and before/after scorecards. Candidates are immutable proposals: they cannot activate sources, start crawls, change model weights, mutate extractors, publish public answers, or export restricted payloads.

The queue requires human approval, fixture replay, and release review before any downstream change. Scorecards estimate precision/recall-like metrics, source diversity, freshness, provenance completeness, contradiction handling, public answer latency, unknown-query `Searching`, restricted no-leak behavior, and stale-answer rejection.

## High-Priority Actor Freshness

The high-priority dashboard gives each actor a daily or weekly cadence, target max age, latest source/claim timestamps, freshness state, public-answer impact, evidence IDs, source IDs, and handoffs. Stale or unknown actors are routed to scheduler cadence, source-gap review, evidence replay, API fields, and release gates.

The dashboard deliberately treats stale evidence as a hold rather than a fact. Unknown actors stay `Searching` or partial, stale activity cannot become latest activity, and no actor row can start crawling, activate sources, or promote public answers automatically.

## CTI Evaluation Dataset Pack

The CTI evaluation pack turns governed labels into fixture scenarios for actor extraction, victim/company extraction, TTP/tool mapping, IOC/CVE extraction, stale answer rejection, unknown actor `Searching`, restricted metadata no-leak behavior, and contradiction handling.

Each fixture carries label IDs, evidence IDs, claim-ledger refs, assertions, precision/recall-like targets, provenance requirements, handoffs, and no-leak guarantees. Fixtures are immutable and never mutate extractors, source rankings, graph state, model weights, or public answers by themselves.

## Runtime Value Gates

Runtime value gates answer the operator question: "is this useful enough for a CTI analyst, and what would improve it?" A ready answer must pass freshness, specificity, source diversity, provenance, contradiction, evidence, and analyst-actionability gates. Partial or held answers include owner-specific remediation handoffs for source activation, scheduler cadence, adapter repair, signal scoring, restricted review, evidence replay, graph holds, API fields, and release rollback.

Dark-web metadata can improve hints, liveness, and caveats, but metadata-only records cannot stand alone as public facts. They require public corroboration or human review, and the DTO exposes only compact labels, ids, and reasons. Raw unsafe targets, credentials, payloads, dumps, private material, and object keys remain forbidden.

Source-atlas feedback flags low-yield source families, duplicate-heavy packs, stale-only packs, parser gaps, language gaps, and activation candidates. These are scored for expected answer impact but are not source activation. Activation, crawl starts, ranking changes, and public promotion remain human-approved downstream work.

## Program BD Marketplace Quality

The Program BD pack gives Agent 09 and Agent 10 row-level pass/warn/hold packets for public UI, Apify output, graph export, and STIX export eligibility. It intentionally distinguishes "can appear as a caveated marketplace row" from "can promote into graph/STIX." Ransomware victim rows may remain useful in Apify as caveated metadata while public UI, graph, and STIX export stay held.

Regression guardrails cover person-as-victim, actor-alias-as-victim, not-indexed fallbacks, stale-only activity, headline-as-summary, raw unsafe URL leakage, and generic non-CTI web results. The pack is fixture and contract data only: it cannot mutate extractors, activate sources, start crawls, promote public answers, export graph/STIX data, or expose raw evidence, source URLs, restricted payloads, or object keys.

Program BD bad-case regressions also feed `qualityRegressionSuite`, `analystFeedbackLearningLoop.fixtures`, and `activeLearningCandidateQueue.fixturePack`. This keeps legal-proceeding false victims, actor-alias victim collisions, stale reposts, headline-only summaries, not-indexed fallbacks, raw-locator no-leak checks, and generic non-CTI source support in the same append-only replay path as analyst feedback. The learning handoff is still manual-only: it can propose parser, source reliability, claim-ledger, API, graph, and release-gate work, but it cannot change model weights, activate sources, start collection, or publish answers.

`activeLearningCandidateQueue` also exposes summary-specificity thresholds, row usefulness deltas, and `replayPromotionReport` with schema `ti.analyst_approved_replay_promotion_report.v1`. These fields explain how much each candidate is expected to improve marketplace row usefulness after approved fixture replay, which summary/victim/TTP/source-support thresholds must be met, and why promotion remains held until analyst approval plus replay. The report is metadata-only and preserves the same forbidden actions as the learning queue: no source activation, crawl start, model-weight change, extractor mutation, public-answer publication, or restricted-payload export.

`programBdQualityEvaluationPack.paidRowQualityGate` exposes schema `ti.program_bd_paid_row_quality_gate.v1`. It anchors buyer-quality gates to the current Apify paid-row baseline runs, including useful-row rate, fresh-row rate, stale-row suppression, summary specificity, source-family diversity, buyer caveat usefulness, and no-leak proof. Source tiers from 100 through 60k are held until the previous tier proves dedupe, rejection metrics, search quality, freshness expectations, safe summaries, and paid-row value.
