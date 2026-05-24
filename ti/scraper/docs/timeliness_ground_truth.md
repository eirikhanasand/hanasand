# Timeliness Ground Truth Harness

Agent 07 publishes `ti.timeliness_ground_truth.v1` to prevent stale activity from being presented as current intelligence.

## Query Expectations

- `high_activity_actor`: 14 day expectation; stale evidence cannot be described as latest activity.
- `ransomware`: 7 day expectation for victim/activity claims.
- `cve`: 30 day expectation for advisory and exploitation mentions.
- `malware_tool`: 45 day expectation.
- `actor`: 60 day expectation.
- `unknown`: 90 day fallback expectation with partial wording.

## Scored Fields

The harness scores `recent_activity`, `source_freshness`, `victim_claims`, `ttps`, `malware_tools`, `cves`, and `infrastructure`. Each field reports `current`, `aging`, `stale`, or `unknown`, along with compact evidence IDs, source IDs, reasons, and the expected maximum age.

## Release Impact

Ready promotion is held when evidence is missing, recent activity is undated, the latest source is stale, latest support is metadata-only, or high-activity actor claims depend on stale observations. Public answers should use partial wording until fresh, dated evidence arrives.

## Safety

The DTO intentionally omits raw evidence text, source URLs, object keys, credentials, cookies, authorization material, and restricted payloads while preserving evidence IDs, source IDs, field status, and caveat reasons.
