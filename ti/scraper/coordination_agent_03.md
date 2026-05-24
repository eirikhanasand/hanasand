Status: active_program_bc

# Agent 03 Coordination

## CONTINUATION DIRECTIVE

DO NOT STOP AFTER ONE PATCH. Program BA/BA.5-BA.7 and Program BB are complete; continue into Agent 03 Program BC/BD in `coordination_program_backlog.md` without waiting for a new prompt. Only write `ready_for_next_task` if the adapter/capture ownership lane is genuinely exhausted or blocked by missing cross-agent code.

Side-tool support priority:
- Support Agent 05 with safe metadata-only dark-web index collectors/parsers: landing-page title/summary where policy permits, no raw unsafe URL exposure, no downloads, no auth/private/CAPTCHA paths.
- Support Agent 01 with public TI source discovery/canonicalization adapters for RSS, static HTML, reports, GitHub/security/advisory feeds, and curated source lists.
- These collectors feed the main CTI scraper and database; keep them modular and testable.

## Progress Update - 2026-05-24 22:32 CEST

- Completed Program BB public report/PDF/OCR extraction readiness.
- Extended `ti.report_corpus_benchmark.v1` in `src/adapters/reportCorpusBenchmark.ts` with fixture classes for vendor reports, advisories, multilingual reports, malformed PDFs, scanned PDFs, unsupported MIME, stale reports, duplicate canonical reports, restricted policy holds, dynamic snapshots, and RSS items.
- Added language readiness, citation-span coverage, media readiness, `CollectedItem`-compatible provenance contracts, extraction readiness pass/watch/hold gates, fixture coverage summaries, unsupported/stale/duplicate/language counts, and Agent 03/06/07/09/10 handoffs.
- Added Program BB regression fixtures in `src/tests/adapterRegressionContracts.test.ts` proving ready, watch, and hold behavior for vendor/advisory/multilingual/malformed/unsupported/stale/duplicate/policy-held reports without raw URL/text/object leakage.
- Updated `docs/operations.md` and `docs/source_registry.md` with report/PDF/OCR extraction readiness guidance.
- Repaired parallel drift in scheduler freshness SLO literal typing, darkweb index/API test typing, and public-signal source typing so checks stay green.
- Proof green: `bun run check`; focused adapter/API/public-signal tests; `bun run check:route-inventory`; `bun run check:contract-index`; `bun run check:api-regression`; full `bun test` (506 pass).
- Program BB is complete. Continuing now into Agent 03 Program BC: Dynamic Browser Isolation Canary, then Program BD public advisory/GitHub security adapter runtime.

## Progress Update - 2026-05-24 22:10 CEST

- Completed Program BA.7 dynamic browser isolation canary hardening.
- Extended `ti.dynamic_browser_cutover.v1` in `src/adapters/dynamicBrowserCutover.ts` with fixture-replay-only isolation canaries for private-network targets, credential prompts, CAPTCHA challenges, download attempts, onion redirects, and third-party request leaks.
- Added route-safe `isolationCanary`, `isolation_hazards_blocked`, `isolationHoldCount`, and `blockedTargetClasses` fields while keeping dynamic browser workers disabled by default, explicit approval required, public-only isolation, screenshot/object refs hash-only, no cookie jar/local storage, and no raw URL/HTML/text/screenshot bytes.
- Expanded `src/tests/dynamicBrowserCutover.test.ts` to cover every isolation hazard mode and successful fixtures that still contain latent isolation leaks.
- Updated `docs/operations.md` and `docs/source_registry.md` with dynamic browser canary isolation guidance.
- Repaired parallel drift in graph backend adapter cutover helper typing, scheduler contract test typing, source coverage campaign/infrastructure fixtures, and evidence endpoint no-leak assertions so checks stay green.
- Proof green: `bun run check`; focused dynamic-browser/runtime/API/graph/source/evidence tests; `bun run check:route-inventory`; `bun run check:contract-index`; `bun run check:api-regression`; full `bun test` (498 pass).
- Program BA/BA.5-BA.7 is complete. Continuing now into Agent 03 Program BB: Public Report/PDF/OCR Extraction Readiness, then BC/BD per `coordination_program_backlog.md`.

## Progress Update - 2026-05-24 21:13 CEST

- Continued Program BA.6 PDF/report extraction quality benchmark and OCR readiness.
- Extended `ti.report_corpus_benchmark.v1` in `src/adapters/reportCorpusBenchmark.ts` with OCR readiness gates for text-layer presence, scanned-page count, OCR availability/confidence, citation-span coverage, parser confidence, and Agent 03/06/07/10 handoffs.
- Added scanned PDF fixtures in `src/tests/adapterRegressionContracts.test.ts` for OCR-ready, needs-OCR, and blocked image-only cases.
- Sanitized benchmark handoff output for route-safe use by omitting raw canonical URLs/summaries and adding explicit forbidden fields for raw text, object keys, OCR vendor coupling, credentials, and unsafe links.
- Updated `docs/operations.md` and `docs/source_registry.md` with PDF/report OCR readiness guidance.
- Repaired parallel type drift in public-signal stale-delta fixtures, graph Neo4j benchmark typing, live-search soak summaries, and duplicate active-learning helper names so `bun run check` stays green.
- Proof green: `bun run check`; focused adapter/public-signal/pipeline/ops tests; full `bun test` (492 pass); `bun run check:route-inventory`; `bun run check:contract-index`; `bun run check:api-regression`.
- Remaining Program BA work: continue BA.7 dynamic browser isolation canary and then move into Agent 03 Program BB/BC/BD per the continuation directive.

## Progress Update - 2026-05-24 21:00 CEST

- Continued Program BA.5 multilingual parser confidence hardening.
- Added `ti.multilingual_parser_confidence_benchmark.v1` via `buildMultilingualParserConfidenceBenchmark` in `src/adapters/multilingualReportHandoff.ts`.
- Benchmark rows group translation handoff packets by original language and gate adjusted parser confidence, detection confidence, citation-span coverage, mixed-language ratio, high-priority translation ratio, and low-confidence blocks.
- Output stays route-safe with packet refs only and no raw text, translated text, raw URLs, unsafe links, vendor coupling, credentials, or API keys.
- Added pass/watch/hold tests in `src/tests/multilingualReportHandoff.test.ts` and docs in `docs/operations.md` and `docs/source_registry.md`.
- Repaired a parallel graph route test type drift for `attackCampaignWorkspace` so `bun run check` stays green.
- Proof green: focused multilingual/production-runtime/graph route tests; `bun run check`; full `bun test` (488 pass).

## Progress Update - 2026-05-24 20:55 CEST

- Completed Program BA first production adapter runtime slice.
- Added `src/adapters/productionAdapterRuntime.ts` with `ti.production_adapter_runtime_program.v1`, `ti.production_adapter_capability.v1`, and `ti.production_capture_metadata_contract.v1`.
- Runtime/certification matrix now covers RSS, static HTML, PDF/report, dynamic public browser canary, public-channel handoff, advisory signal, GitHub/security feed, and multilingual handoff.
- Capture metadata contract requires source ID, canonical URL hash, content hash, fetched-at, language, parser confidence, extraction warnings, provenance, and evidence replay refs while forbidding raw URLs, raw text, HTML, credentials, private invites, object keys, unsafe downloads, onion URLs, and screenshot bytes.
- Added `src/tests/productionAdapterRuntime.test.ts` plus operations/source-registry docs for adapter runtime, certification, and safe capture failure handling.
- Proof green: `bun run check`; focused adapter/parser/capture tests; `bun run check:route-inventory`; `bun run check:contract-index`; `bun run check:api-regression`; full `bun test` (485 pass).
- Remaining Program BA work: deepen live collector hardening and fixture corpus for RSS/static/PDF/dynamic canaries, expand parser quality benchmarks and OCR readiness, and continue BA.5-BA.7 before marking ready.

## CURRENT ASSIGNMENT - READ FIRST

Program BC: Dynamic Browser Isolation Canary.

Mission:
- Expand dynamic browser isolation canaries for approved public pages that static HTML, RSS, and report/PDF extraction cannot capture.
- Keep dynamic browser workers disabled by default and fixture-replay-only until explicit operator approval.
- Add browser pool isolation, memory/time caps, screenshot-hash-only output, blocked auth/CAPTCHA/private targets, blocked downloads, onion redirect holds, third-party request leak holds, and no cookie jar/local storage.
- Preserve route-safe provenance: source id, task id, canonical URL hash, final URL hash, content hash, fetched-at, parser confidence, extraction warnings, screenshot hash, object ref hash, robots/legal notes, and safe handoff fields.
- Keep restricted/dark collection metadata-only and policy-gated. No auth bypass, CAPTCHA solving, private-channel joining, credential collection, leaked-file download, or threat actor interaction.

Proof before advancing:
- `bun run check`
- focused dynamic-browser/adapter/runtime tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- docs update for dynamic browser canary isolation, failure handling, and promotion gates

Standing expansion rule:
- After Program BC, continue directly into Program BD public advisory/GitHub security adapter runtime.
- If Agent 04/07 needs fresher or higher-confidence public evidence, prioritize adapter/parser certification that feeds their contracts.
- Do not mark ready unless the adapter/capture ownership lane is genuinely exhausted or blocked by missing cross-agent code.
