Status: active_program_be_live_capture_adapter_hardening

## Current Assignment - Program BE: Live Capture Adapter Hardening

You are no longer waiting for a task. Continue the adapter/capture lane until clear-web and public advisory capture can feed durable evidence with production-grade parser quality, failure handling, and replay hooks.

Mission:
- Move approved public adapters from "can parse examples" to "can run repeatedly, fail predictably, dedupe output, emit evidence replay references, and explain freshness/coverage gaps."
- Preserve safe public-source boundaries: no private GitHub repos, auth flows, CAPTCHA bypass, payload/exploit downloads, leaked datasets, unsafe onion content, or credential collection.

Build:
- Add live capture runtime contracts for RSS/blog/static HTML/report-index/public advisory adapters with per-source timeout, content-size cap, MIME allowlist, robots/legal note propagation, parser confidence, extraction warnings, canonical URL hash, content hash, and dedupe key.
- Add parser-failure observability for HTTP errors, parse errors, malformed feeds, unsupported MIME, excessive redirects, unsafe URLs, duplicate content, and stale source windows.
- Add capture-to-evidence handoff packets for Agent 06: raw capture descriptor, text projection descriptor, source metadata, extraction version, claim candidate IDs, and replay ID.
- Add adapter conformance fixtures for GitHub Security Advisory, CISA KEV style, vendor advisory JSON, CERT HTML, vendor blog HTML, RSS/Atom, and report-index pages.
- Add source pack integration points for Agent 01 and scheduler budget/cadence hints for Agent 02.
- Keep the runtime disabled-by-default for any network path that is not already explicitly approved; route-visible dry-run previews are preferred over accidental live crawling.

Proof before status change:
- `bun run check`
- `bun test src/tests/publicAdvisory.test.ts src/tests/productionAdapterRuntime.test.ts src/tests/sourceSeeds.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- docs update in `docs/source_registry.md` and `docs/operations.md`

If this phase completes, continue immediately into Program BF: PDF/report extraction readiness with OCR-disabled defaults, text-only projections, and evidence replay.

# Agent 03 Summary

- Completed Program BD: public advisory/GitHub security adapter runtime.
- Added `PublicAdvisoryAdapter` for approved public advisory API/feed capture with GitHub Security Advisory-style JSON, CISA/KEV-style JSON, CERT/government, vendor, malware/tool, report-index, and RSS/Atom advisory records.
- Normalized advisory records into `CollectedItem` with source id, canonical URL, content hash, published/observed timestamps, source family, parser confidence, extraction warnings, matched CVE/actor/malware/tool/campaign/sector/country/victim tags, dedupe key, provenance, and evidence replay ref.
- Added route-safe `ti.public_advisory_signal_delta.v1` metadata with canonical URL hashes and replay refs while suppressing private repo paths, auth/private links, secret-bearing URLs, payload/download/exploit links, malformed/non-HTTP schemes, and onion links.
- Promoted `github_security_feed` from contract-ready to implemented in the production adapter runtime contract.
- Added focused advisory/runtime tests and updated operations/source-registry docs.
- Proof green: `bun test src/tests/publicAdvisory.test.ts src/tests/productionAdapterRuntime.test.ts src/tests/publicSignalFusion.test.ts`, `bun run check:contract-index`, `bun run check:route-inventory`, `bun run check:api-regression`.
- Known external blockers: full `bun run check` and full `bun test` are failing in unrelated dirty-worktree areas (`src/export/graphViews.ts`, source seed economics, product SLO/API tests).

Historical note: Agent 03 previously requested a new adapter/capture task; the active Program BE assignment above supersedes that request and should be continued until proof is complete.
