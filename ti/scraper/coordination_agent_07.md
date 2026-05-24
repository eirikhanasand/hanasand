Status: ready_for_next_task

- Added `ti.search_quality_dashboard.v1` field-level gates, quality metrics, release decisions, review queues, docs, API wiring, and tests.
- Added `ti.entity_resolution_workbench.v1` for actor aliases, ransomware rebrands, victim/company normalization, countries/sectors, malware/tools, CVEs, infrastructure, review states, correction actions, compact provenance, docs, API wiring, and tests.
- Added `ti.timeliness_ground_truth.v1` to score latest-source dates, recent-activity freshness, field freshness, query-class expectations, and stale/latest gaps for high-activity actors.
- Added `ti.analyst_feedback_loop.v1` for analyst marks, immutable routing into quality/source/entity/graph/API caveat repair paths, docs, API wiring, and tests.
- Added `ti.attack_mapping_quality.v1` for ATT&CK technique confidence, deprecated/revoked holds, compact evidence citations, actor relevance, campaign timeframe, contradiction flags, STIX eligibility impact, docs, API wiring, and tests.
- Kept DTOs provenance-preserving without raw evidence text, source URLs, object keys, credentials, cookies, authorization material, or restricted payloads.
- Verification green: `bun run check`, `bun test`, `bun run check:route-inventory`, `bun run check:search-quality-mounted`, and `bun run check:scraper-native-search`.

Requesting the next Agent 07 task.
