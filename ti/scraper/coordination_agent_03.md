Status: active_program_bg_live_capture_canary_and_parser_repair_loop

# Agent 03 Coordination

## Current Assignment - Program BG: Live Capture Canary And Parser Repair Loop

You are no longer waiting for a task. Continue the adapter/capture lane until approved public sources can be canaried, measured, repaired, and promoted without breaking the public product.

Mission:
- Move beyond parser contracts into a disabled-by-default live canary and repair workflow for public RSS/blog/static/report/advisory sources.
- Give Agents 01/02/07/09 concrete signals: which sources parse cleanly, which need repair, which should be paused, and which safely improve actor coverage.

Build:
- Add live-capture canary packet DTOs with source id, adapter family, approved URL hash, robots/legal note, timeout/content caps, MIME allowlist, parser version, extraction warnings, dedupe hashes, evidence replay refs, and no-leak policy result.
- Add parser repair recommendation rows for malformed feeds, changed layouts, report index drift, public advisory schema changes, unsupported MIME, excessive redirects, source outage, duplicate-heavy output, and stale source windows.
- Add canary promotion/hold/rollback states and scheduler hints for first-run, repeat-run, burst-failure, source outage, parser regression, and source-family shortage cases.
- Add fixtures for vendor blog HTML, CERT advisory HTML, GitHub Security Advisory JSON, CISA KEV JSON, RSS/Atom, report index, PDF text-layer reports, unsupported MIME, and hostile/unsafe link suppression.
- Preserve disabled-by-default network behavior unless an existing approved test harness is already present; fixture replay and dry-run previews are preferred.

Proof before status change:
- `bun run check`
- `bun test src/tests/publicAdvisory.test.ts src/tests/productionAdapterRuntime.test.ts src/tests/adapterContracts.test.ts src/tests/sourceSeeds.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- update `docs/operations.md` and `docs/source_registry.md`

If this phase completes, continue immediately into Program BH: dynamic browser isolation canary for high-value public pages, still disabled by default.

## Previous Completed Slice

- Completed Program BE: live capture adapter hardening for RSS, static HTML, report-index, and public advisory captures.
- Added `ti.live_capture_runtime_packet.v1`, per-row runtime diagnostics, safe failure taxonomy, canonical/content hashes, dedupe keys, Agent 01 source-pack readiness, Agent 02 cadence hints, and Agent 06 evidence handoff descriptors.
- Added conformance coverage for GitHub Security Advisory, CISA KEV, vendor advisory JSON, CERT HTML, vendor blog HTML, RSS/Atom, and report-index fixtures.
- Completed Program BF: PDF/report extraction readiness with OCR disabled by default, text-only projection hashes, citation-span coverage, parser confidence, extraction warnings, and evidence replay refs.
- Updated public advisory/source-pack/PDF readiness docs in `docs/operations.md` and `docs/source_registry.md`.
- Proof green: `bun run check`, `bun test src/tests/publicAdvisory.test.ts src/tests/productionAdapterRuntime.test.ts src/tests/sourceSeeds.test.ts src/tests/adapterContracts.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run check:api-regression`.

Historical note: Agent 03 previously requested the next adapter/capture task. The active Program BG assignment above supersedes that request.
