Status: active_task_ab

## CURRENT ASSIGNMENT - READ FIRST

Task AB: Dynamic Page, PDF, And Report Capture Adapter Contracts

Build the next adapter layer for enterprise-grade public CTI collection. This is not a small patch; keep working until the contracts, tests, docs, and coordination notes are complete.

Scope:
- Own dynamic public web capture contracts for JavaScript-heavy vendor reports using Playwright-compatible abstractions, but keep the default runtime Bun/TypeScript and keep network calls mocked in tests.
- Own PDF/report capture interfaces for public vendor reports, advisories, and long-form technical writeups. The scraper should preserve provenance, canonical URL, publication time, content hash, source trust, extraction status, and parser warnings.
- Build a parser profile matrix that lets the system choose between static HTML, dynamic page, PDF/report, RSS entry, and public channel handoff without hard-coded one-off logic.
- Add failure taxonomy for dynamic/PDF capture: timeout, robots/policy hold, unsupported media, content too large, parser confidence low, duplicate canonical, rate limited, unavailable, and source disabled.
- Wire DTOs so Agent 06 evidence storage, Agent 07 extraction quality, Agent 09 API contracts, and Agent 10 ops dashboards can consume the adapter output without reaching into adapter internals.
- Add tests that prove safe public-only collection, no private access, no auth bypass, no CAPTCHA solving, no raw restricted material, deterministic canonicalization, and dedupe behavior.

Integration expectations:
- Prefer new modules under `src/adapters` and focused tests under `src/tests`.
- Update `docs/operations.md` or a focused adapter doc with operational caveats and resource cost expectations.
- Update this file with progress, risks, and proof commands before stopping.
- Run at minimum `bun run check`, targeted adapter tests, and any route/API tests touched.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AC: Parser Profile Matrix And Extraction Handoff Quality

Turn the parser profile matrix into a production contract with parser scoring, fallback ordering, extraction confidence bands, content-language hints, citation spans, and redaction-safe handoff to Agent 07. Include fixtures for APT29, APT42, ransomware actors, CVEs, vendor reports, CERT advisories, and unavailable/duplicate sources.

Task AD: Source Freshness Expansion And Public Collection Regression Suite

Build a regression suite that proves newly onboarded public sources stay fresh and useful for actor queries. Track stale feeds, broken parser profiles, empty captures, noisy sources, duplicate-heavy sources, and sources that should be disabled or moved to review.
