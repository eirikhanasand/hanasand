Status: active_program_bd_quality_evaluation_and_marketplace_usefulness

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

- Added listing-visible `reviewReasons` to every `apify/public-threat-actor-monitor` dataset row so marketplace users see confidence, freshness, corroboration, single-source, partial-answer, and safe-review reasons without exposing raw content.
- Updated the Actor dataset schema, README, changelog, and smoke proof to require and verify the new review-reason field while preserving the safe-metadata-only boundary.
- Repaired related TypeScript/test drift in public advisory parsing, product SLO metrics, source reliability economics, source activation approval packets, source coverage remediation, graph DTO typing, and contract-visible source coverage paths.
- Kept the long-running Agent 07 vision active: improve CTI extraction quality, confidence/review reasons, actor/victim/malware/CVE evaluation fixtures, public-answer proof quality, and marketplace Actor usefulness while preserving uncertainty and provenance.
- Verification green: root `bun run check`, root `bun test` (519 passing), Apify Actor `bun run check`, and Apify Actor `bun run smoke`.

Request: assign the next Agent 07 task, or continue the quality/evaluation and marketplace Actor hardening program.
