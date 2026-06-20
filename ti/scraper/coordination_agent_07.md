Status: active_program_bd_quality_evaluation_and_marketplace_usefulness

## Main Agent Update - 2026-06-20 17:05 CEST

Use the latest monetized Actor proof as your new buyer-quality baseline: run `dQzvWhNM2OHrBWVfo`, build `0.6.3`, dataset `aP1dqnK7uEezn5jJv`, 15 rows, usage about `$0.00075`. It proved the safe-output path, but also showed APT29 stale rows and "reported by" style summaries that need richer extraction. Quality gates should now block or downgrade stale-only/current-actor claims and score rows by whether a buyer would pay `$3 / 1,000` for them.

Add metrics and fixtures for paid-row usefulness: fresh-row rate, stale-row suppression, summary specificity, source-family diversity, corroboration, buyer caveat usefulness, and no-leak proof. When your patch is coherent, run focused tests, commit, push, and leave no hanging files.

Read `coordination_product_focus.md` first. Judge output like a buyer opening an Apify dataset. The quality gate must decide whether rows from the daily 20-group run and each 100 -> 60k source tier are useful, fresh, specific, supported, and safe enough to sell.

Live product proof to optimize against: Apify run `rh6D0UInDD6x7GuuD` returned 98 rows, 48 actionable, 26 corroborated, 69 single-source, 3 unverified, 80 thin, and zero safety failures. Treat this as a baseline. The next quality gate should measure useful-row rate, fresh-row rate, stale-row suppression, summary specificity, single-source caveats, and source-family lift after Agents 01/03/04 add the first 100 sources.

## Current Assignment - Program BD: Quality Evaluation And Marketplace Usefulness

You are no longer waiting for a task. Continue the extraction/evaluation lane until the product can prove analyst usefulness, not just return rows.

Mission:
- Build measurable quality gates for actor summaries, incident claims, victim extraction, sector/country impact extraction, TTP mapping, source confidence, freshness, contradictions, and marketplace row usefulness.
- Prevent bad-looking output such as false victim extraction from legal headlines, stale actor facts presented as current, generic summaries, uncited claims, and overconfident single-source rows.

Build:
- Add evaluation fixtures for at least 20 default watchlist actors plus random/unknown actor queries. Include state actors, ransomware groups, alias-heavy groups, legal-proceeding news, vendor reports, government advisories, and stale/repost cases.
- Add row-level quality metrics: summary specificity, source support, recency, false-victim risk, legal-proceeding detection, actor alias resolution, TTP evidence support, source-family diversity, contradiction flags, and actionability correctness.
- Add route-visible quality gate packet for Agent 09/API and Agent 10/SLO: pass/warn/hold state, failing fields, remediation action, and whether the row can appear in public UI, Apify output, graph, or STIX export.
- Add regression fixtures for common bad cases: person treated as victim, actor alias mistaken as victim, "not indexed" fallback, stale 2025-only activity, source headline repeated as summary, raw unsafe URL leak, and generic non-CTI web results.
- Update Apify smoke/README/schema only if needed to expose clearer quality fields; keep copy compact and human.

Proof before status change:
- `bun run check`
- focused quality/search/API/Apify smoke tests
- full `bun test` if shared surfaces are touched
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run measure:search-product` if available
- docs update for quality gates and known limitations

If this phase completes, continue immediately into Program BE: analyst feedback loop and active-learning evaluation set without requiring an LLM/GPU dependency.

Progress:
- Added listing-visible `reviewReasons` to every `apify/public-threat-actor-monitor` dataset row so marketplace users see confidence, freshness, corroboration, single-source, partial-answer, and safe-review reasons without exposing raw content.
- Added `analysisFacets` to every Actor dataset row for stable filtering by row type, claim type, evidence grade, freshness, source class, entity presence, collection action, and safe-metadata boundary.
- Updated the Actor dataset schema, README, changelog, publication check, and smoke proof to require and verify review reasons and analysis facets while preserving the safe-metadata-only boundary.
- Added route-visible `ti.program_bd_quality_evaluation_pack.v1` under `qualityRuntimeValueGates` with 20+ default watchlist actor fixtures plus unknown/random guardrails, row-level quality metrics, pass/warn/hold gate packets, public UI/Apify/graph/STIX eligibility, regression guardrails, and Agent 07/09/10 routing.
- Added deterministic Program BD bad-case regression cases for legal-proceeding false victims, actor-alias victim collisions, stale repost suppression, headline-only summaries, not-indexed fallback, raw-locator no-leak checks, and generic non-CTI source support.
- Routed those bad-case regressions into `qualityRegressionSuite`, `analystFeedbackLearningLoop.fixtures`, and `activeLearningCandidateQueue.fixturePack` so the analyst feedback/active-learning path can replay them without model self-mutation, source activation, crawl starts, or public-answer publication.
- Documented the Program BD marketplace quality packet in `docs/quality_dashboard.md`.
- Added Program BE evaluator scoring fields to `activeLearningCandidateQueue`: summary-specificity thresholds, row-usefulness deltas, and `ti.analyst_approved_replay_promotion_report.v1` so analyst-approved replay promotion can be reviewed without model self-mutation, source activation, crawl starts, or public-answer publication.
- Repaired related TypeScript/test drift in public advisory parsing, product SLO metrics, source reliability economics, source activation approval packets, source coverage remediation, graph actor-timeline/product DTOs, Apify store readiness contracts, evidence search promotion warnings, and contract-visible source coverage paths.
- Verification green: root `bun run check`, focused pipeline/API/darkweb tests, root `bun test` (526 passing), Apify Actor `bun run check`, Apify Actor `bun run smoke`, Apify Actor `bun run check:publication`, and `bun run measure:search-product`.

Next: continue Program BE by persisting analyst-approved replay decisions into the safe analyst-loop read model and exposing route-visible replay promotion history without allowing automatic model, source, crawler, or public-answer mutation.
