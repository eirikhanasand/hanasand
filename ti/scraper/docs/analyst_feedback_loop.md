# Analyst Feedback Loop

Agent 07 publishes `ti.analyst_feedback_loop.v1` as a compact contract for analyst corrections. Feedback items can mark extracted facts as `correct`, `stale`, `wrong`, `duplicate`, `overconfident`, `underconfident`, or `missing`.

Agent 07 also publishes `ti.quality_regression_suite.v1`, derived from the feedback loop plus timeliness and ATT&CK quality signals. Regression cases use stable correction states: `accepted`, `rejected`, `needs_evidence`, `duplicate`, `stale`, `false_positive`, `underconfident`, `overconfident`, `parser_repair`, and `source_repair`.

Agent 07 now also publishes `ti.actor_profile_review_workbench.v1` from `/v1/quality/evaluate.actorProfileReviewWorkbench` and `/v1/intel/search.actorProfileReviewWorkbench`. It joins actor-profile readiness, public answer claims, analyst feedback, timeliness gaps, and ATT&CK quality into field-level review rows for summary, aliases, recent activity, timeline changes, targets, victims, sectors, regions, TTPs, malware/tools, CVEs, infrastructure, and datasets.

Agent 07 now also publishes `ti.evaluation_dataset_governance.v1` from `/v1/quality/evaluate.evaluationDatasetGovernance` and `/v1/intel/search.evaluationDatasetGovernance`. It gives analysts and release owners a governed label corpus for actor profiles, TTP mapping, freshness, contradiction, victim/company claims, public-answer quality, and unknown-query semantics.

Agent 07 now also publishes `ti.analyst_quality_review_queue.v1` from `/v1/quality/evaluate.analystQualityReviewQueue` and `/v1/intel/search.analystQualityReviewQueue`. It turns feedback, actor-profile review rows, regression fixtures, and label governance into field-level release queue items for actor summaries, recent activity, victims, TTPs, infrastructure, malware/tools, CVEs, source gaps, and unknown-query `Searching` states.

Agent 07 now also publishes `ti.analyst_feedback_learning_loop.v1` from `/v1/quality/evaluate.analystFeedbackLearningLoop` and `/v1/intel/search.analystFeedbackLearningLoop`. It stores analyst corrections as append-only evaluation and learning-loop records, exposes scorecards and replay fixtures, and keeps all downstream changes human-approved.

Agent 07 now also publishes `ti.active_learning_candidate_queue.v1` from `/v1/quality/evaluate.activeLearningCandidateQueue` and `/v1/intel/search.activeLearningCandidateQueue`. It converts feedback and evaluation records into human-approved candidate proposals for extractor, ranking, source reliability, TTP mapping, entity resolution, freshness, and contradiction improvements.

Agent 07 now also publishes `ti.high_priority_actor_freshness_dashboard.v1` from `/v1/quality/evaluate.highPriorityActorFreshnessDashboard` and `/v1/intel/search.highPriorityActorFreshnessDashboard`. It monitors daily and weekly freshness for APT29, APT42, Sandworm, Volt Typhoon, Lazarus, Turla, LockBit, Akira, and configured priority actors.

Agent 07 now also publishes `ti.cti_evaluation_dataset_pack.v1` from `/v1/quality/evaluate.ctiEvaluationDatasetPack` and `/v1/intel/search.ctiEvaluationDatasetPack`. It packages fixture scenarios and metrics for actor/victim/TTP/IOC extraction, stale answer rejection, unknown actor `Searching`, restricted no-leak behavior, and contradiction handling.

## Routing

Feedback is routed to:

- `quality_gate` for field readiness, confidence, and promotion decisions.
- `source_reliability` for source-family gaps and weak support.
- `entity_resolution` for aliases, duplicate merges, and canonical naming.
- `graph_review` for relationship-impacting corrections.
- `public_answer_caveat` for stale, restricted, contradicted, or partial wording.
- `parser_repair` for missing victims, TTPs, CVEs, malware/tools, or infrastructure.

Regression cases fan out to Agent 01 source governance, Agent 03 parser repair, Agent 04 coverage radar, Agent 06 claim ledger, Agent 08 graph holds, Agent 09 API fields, and Agent 10 release gates. Areas cover extraction, ranking, entity resolution, ATT&CK mapping, source reliability, graph review, and public answer caveats.

Actor-profile review rows use stable states: `accepted`, `partial`, `missing`, `stale`, `contradicted`, `duplicate`, `wrong`, `overconfident`, `underconfident`, and `needs_evidence`. Correction actions are manual-only and include accepting a field, marking stale or contradicted, merging duplicates, suppressing wrong claims, requesting more evidence, lowering or raising confidence, parser repair, graph review, and claim-ledger routing. Workbench routing fans out to Agent 01 source gaps, Agent 04 public coverage, Agent 06 claim ledger, Agent 08 graph holds, Agent 09 API contracts, and Agent 10 release gates.

Evaluation governance labels fan out to Agent 01 source gaps, Agent 04 public benchmarks, Agent 06 evidence replay, Agent 08 graph drift, Agent 09 API regression fixtures, and Agent 10 release gates. Audit checks flag stale labels, overconfident summaries, missing provenance, contradiction handling, public-channel-only caveats, restricted metadata holds, graph/STIX export eligibility, and unknown-actor `Searching` semantics.

Analyst quality queue items emit Agent 09 public/API signals and Agent 10 release-board signals. The release gate checks freshness, provenance, source diversity, contradiction state, evidence retention, restricted holds, unknown `Searching` semantics, and label governance before public answer promotion.

Learning-loop records fan out to Agent 03 parser repair for alias, victim, and TTP corrections; Agent 04 source coverage for reliability downgrades; Agent 08 graph corrections for contradiction and TTP drift; Agent 09 public API fields for route-visible states; and Agent 10 release gates for promotion holds.

Active-learning candidates fan out to Agent 03 parser certification, Agent 04 freshness/source gaps, Agent 06 evidence replay, Agent 08 graph corrections, Agent 09 API fields, and Agent 10 release gates. Each candidate names the affected public/API, graph, and STIX fields so downstream owners can approve or reject the fixture-backed change.

The high-priority actor freshness dashboard fans out stale or unknown actor rows to Agent 01 source reliability, Agent 02 scheduler cadence, Agent 04 source gaps, Agent 06 evidence replay, Agent 09 API fields, and Agent 10 release gates.

The CTI evaluation dataset pack fans out parser fixtures to Agent 03, evidence replay to Agent 06, graph/STIX holds to Agent 08, API regression fixtures to Agent 09, and release gates to Agent 10.

## Policy

Feedback items are immutable suggestions. They never self-mutate models, change extractors automatically, or promote claims without analyst approval. They carry evidence IDs, ledger IDs, confidence-before values, recommended confidence-after hints, and reasons.

Regression cases are also immutable and never apply automatically. They define assertions and expected outcomes for fixture replay, including stale actor-activity suppression, ATT&CK drift holds, false-positive suppression, parser repair, source repair, and public answer caveat updates.

Actor-profile correction actions are immutable proposals. They never edit actor profiles, update model weights, alter evidence, or promote claims by themselves. Each action carries field, value, evidence IDs, ledger IDs, confidence, reasons, and downstream handoffs so analysts can approve, reject, or convert the correction into a fixture-backed regression case.

Evaluation governance labels are immutable audit records. They never alter public answers or graph exports by themselves; they preserve label provenance, evidence IDs, claim-ledger refs, reviewer, timestamp, source family, confidence, freshness, and allowed downstream use so release gates can distinguish ready, partial, review-required, and `Searching`-only cases.

Analyst quality queue rows are immutable manual-review records. They never correct data, mutate profiles, change extractors, or promote public answers automatically. Unknown/random/made-up actor rows are `Searching` only and exist specifically to prevent default actors, demo prose, or stale cache language.

Learning-loop records are append-only readiness records. They cover actor alias correction, victim false positive, TTP mapping correction, stale activity rejection, source reliability downgrade, contradiction merge/split, restricted hold confirmation, and unknown-query `Searching` approval. Replay/import semantics are deterministic and idempotent: labels import before fixtures, scorecards recompute from records, and no runtime mutation occurs until a persistence adapter is explicitly enabled and a human approves the downstream effect.

Allowed effects are limited to extractor fixtures, ranking fixtures, source-reliability fixtures, graph-review fixtures, public caveat fixtures, and API regression fixtures. Prohibited effects are autonomous scraping, silent source activation, model self-mutation, raw evidence export, and restricted payload access.

Scorecards measure extraction precision/recall, source diversity, freshness, contradiction handling, unknown actor behavior, restricted no-leak handling, and public answer latency. Fixture scenarios cover APT29 daily activity freshness, APT42 instant summary, made-up actor `Searching` only, stale 2025-only answer rejection, public-channel rumor demotion, restricted metadata hold, and graph contradiction.

Active-learning candidates require a reviewer, evidence refs, reason, expected effect, rollback, fixture requirement, before/after scorecards, and explicit no-autonomous-change guarantees. Candidate types cover parser prompt/model improvement, source ranking adjustment, TTP mapping rule update, actor alias merge/split, victim and IOC false-positive suppression, source reliability downgrade, freshness rule update, and contradiction resolution.

Candidate approval cannot activate a source, start crawling, change model weights, mutate extractors, publish a public answer, or export restricted payloads. Approval only permits fixture creation and replay; release owners still decide whether any downstream behavior changes.

High-priority freshness rows are also immutable signals. They cannot schedule work, activate sources, or promote public answers by themselves; they only explain cadence, freshness state, evidence references, source support, and release impact.

CTI evaluation fixtures are immutable no-leak records. They carry label IDs, evidence IDs, claim-ledger refs, assertions, precision/recall-like targets, and required hold semantics, but they cannot mutate extractors, rankings, graph state, source activation, model weights, or public answers automatically.

## Safety

The DTO omits raw evidence text, source URLs, restricted payloads, object keys, credentials, cookies, authorization material, and private-access details.
