Status: active_program_be_dark_metadata_operations_and_refresh_model

# Agent 05 Coordination

Read `coordination_product_focus.md` first. Your current task is to make the dark metadata index real and searchable, starting with 100 safe metadata records and quality proof before 1,000. If the next output is only synthetic contracts, it does not count.

## Current Assignment - Program BE: Dark Metadata Operations And Refresh Model

You are no longer waiting for a task. Continue the restricted/dark metadata lane until the 60k-page index has an operations model for refresh, liveness, classification drift, safe search, and public UI handoff.

Mission:
- Turn the dark metadata side tool from a contract/index model into an operator-manageable refresh and quality system.
- Keep it useful for TI without becoming unsafe: metadata-only, isolated, discardable, hash/redaction-first, and review-held until corroborated.

Build:
- Add refresh-plan DTOs for 60k records with lanes for Tor, I2P, Freenet, directories, analyst imports, and public report-derived references.
- Add liveness/classification drift packets: newly alive, newly dead, category changed, legal risk changed, source reputation changed, duplicate cluster changed, review priority changed, and graph/export hold changed.
- Add search-quality metrics for dark metadata: category coverage, language hints, title/summary usefulness, actor/victim/dataset/entity extraction confidence, blocked unsafe evidence counts, false-positive review rows, and public-safe display readiness.
- Add operator runbook fields for isolated collector pool, proxy boundary, disk budget, content-size cap, quarantine retention, emergency stop, and rollback.
- Keep all fetch/execution behavior disabled unless already controlled by an approved isolated harness; never output raw onion/full unsafe URLs, raw HTML/body/text, credentials, payloads, dumps, object keys, private messages, auth/CAPTCHA/private access, or actor interaction.

Proof before status change:
- `bun run check`
- `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:deploy-hygiene`
- update `docs/operations.md`

If this phase completes, continue immediately into Program BF: dark metadata review queue and actor-search corroboration bridge.

## Previous Completed Slice

- Built the dangerous dark-web metadata index side-tool contract for Tor/I2P/Freenet metadata-only records, 60k target scale, 100 synthetic fixtures, status/search/contracts, and `/ti/darkweb/index` handoff.
- Added source ingest/dedupe/runtime, storage/search, scheduler/parser, quality/graph/UI/ops downstream, and restricted metadata reconciliation handoffs.
- Preserved strict safety boundaries: no stolen-file downloads, credentials, auth/CAPTCHA bypass, stealth, private access, malware execution, payload following, threat-actor interaction, or raw unsafe URL exposure.
- Verification green: `bun run check`, `bun test`, focused darkweb/API tests, route inventory, contract index, deploy hygiene, and restricted metadata apply-plan.

Historical note: Agent 05 previously requested a new task. The active Program BE assignment above supersedes that request.
