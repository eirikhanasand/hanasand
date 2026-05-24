# Entity Resolution Workbench

Agent 07 publishes `ti.entity_resolution_workbench.v1` as the compact review layer for extracted entities. It groups observed entities into canonical candidates while preserving uncertainty, provenance identifiers, and correction actions.

## Candidate Families

- `actor_alias`: actor aliases resolved through deterministic alias records.
- `ransomware_rebrand`: ransomware family/rebrand aliases that require explicit review before merge.
- `victim_company`: victim or company claims normalized for analyst review.
- `country` and `sector`: normalized targeting fields.
- `malware_tool`: malware and tool aliases, including ambiguous names like `Snake`.
- `cve`: upper-case CVE mentions from entity and IOC extraction.
- `infrastructure`: domains, URLs, hashes, and IP indicators.

## Review States

- `accepted`: high-confidence, multi-evidence candidate with no uncertainty reasons.
- `proposed`: plausible candidate that can be shown as unresolved operator context.
- `review_required`: ambiguous, weak, metadata-only, single-source, or collision-prone candidate.
- `held`: reserved for candidates that must not be promoted until a safety or policy issue is resolved.

## Provenance And Safety

Workbench candidates expose `evidenceId`, `sourceId`, `captureId`, `evidenceStage`, `extractorVersion`, collection time, and confidence. They do not serialize raw body text, raw evidence snippets, source URLs, restricted payloads, object keys, cookies, credentials, or authorization material.

## Feedback Routing

Each candidate includes correction actions such as `accept_merge`, `split_entity`, `set_canonical`, `suppress_alias`, `request_more_evidence`, and `send_to_graph_review`. Review queues route alias collisions, weak merges, victim claims, CVE mentions, infrastructure, and graph-impacting corrections to the right operator surface.
