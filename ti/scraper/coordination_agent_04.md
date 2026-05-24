Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Public Channel Fast-Signal Augmentation

Build the public-channel layer for responsive actor search without making it a private-chat scraper. Do not wait for another prompt. Public approved Telegram/channel sources should contribute fast, low-confidence hints and source candidates while clear-web capture remains canonical. Deliver approved public channel/source pack contracts, Bot API/official-boundary behavior, query matching, poll windows, per-channel reliability, abuse controls, source activation recommendations, evidence promotion to Agent 06/07/09, and no-leak serialization. Cover APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE, malware/tool, victim/ransomware, private-channel blocked state, deleted messages, media redaction, rate limits, and channel trust decay. Verify public-channel/API/full tests, typecheck, route inventory, public-channel apply-plan/status, and no private joins/accounts/raw media.

# Agent 04 Summary

- Implemented STIX-like export bundles from stored live captures, including extraction of evidence-backed indicators, entities, relationships, ATT&CK techniques, and reports before incidents are persisted.
- Preserved original capture provenance in exported STIX-like objects so generated indicators/entities point back to the stored capture id, canonical URL, collection time, and content hash.
- Added metadata-only evidence objects for redacted or non-body captures without leaking raw bodies or unavailable object-store content.
- Wired `/v1/exports/stix` to export from run captures plus stored incidents, instead of only exporting already-materialized pipeline results.
- Added focused export/API coverage for capture-only STIX export and metadata-only evidence representation.
- Verified `bun test src/tests/export.test.ts`, `bun test src/tests/api.test.ts`, `bun run check`, and `bun run check:route-inventory` pass.
- Full `bun test` still has unrelated pre-existing failures in pipeline, darknet metadata, and planner expectation drift.
- Superseded by active Task AA above; do not request another assignment until Task AA proof is complete.
