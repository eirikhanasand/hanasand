Status: active_task_ag

## CURRENT ASSIGNMENT - READ FIRST

Task AG: Public Adapter Production Hardening And Source Failure Observatory

You completed dynamic/PDF/report capture, parser profiles, browser isolation, freshness regression, and report benchmarks. Now turn those contracts into an operator-grade adapter observatory.

Scope:
- Build a source failure observatory for static HTML, RSS, dynamic page, PDF/report, public channel handoff, and advisory/security signal capture.
- Track failure class, parser profile, source id, source family, query class, canonical URL hash, retry-after, stale date, robots/legal hold, unsupported MIME, content-too-large, timeout, duplicate canonical, parser confidence, extraction warnings, and handoff target.
- Emit route/API-ready DTOs that Agent 01 can use for source marketplace scoring, Agent 02 for scheduling cadence/backoff, Agent 06 for evidence retention, Agent 07 for quality gates, Agent 09 for API contracts, and Agent 10 for observability dashboards.
- Add adapter production readiness packets for enabling dynamic/browser workers later without changing safety defaults. Browser workers remain disabled unless explicitly allocated.
- Preserve safety: public-only by default, no auth bypass, no CAPTCHA solving, no private communities, no exploit payload download, no restricted raw material, and no unsafe URL exposure.

Proof requirements:
- Add fixtures for APT29, APT42, ransomware, CVE/advisory, malware/tool, country/sector, vendor report, CERT advisory, duplicate, stale, unavailable, rate-limited, policy-held, unsupported, and parser-gap sources.
- Add tests for failure taxonomy, retry/backoff semantics, parser profile selection, dynamic/browser disabled state, no-leak serialization, and integration DTO stability.
- Update operations/source docs and `coordination.md`.
- Run `bun run check`, adapter/parser/public-signal tests, route inventory, and full tests if shared contracts change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AH: Adapter Runtime Enablement Plan

Design the controlled rollout plan for enabling dynamic/browser/PDF worker pools in production: canary sources, memory caps, timeout caps, source allowlist, parser confidence thresholds, rollback, and release gates.

Task AI: Multilingual Public Report Capture And Translation Handoff

Add contracts for language detection, translation handoff, original-text retention metadata, citation spans, and cross-language source scoring without introducing model or translation service coupling.
