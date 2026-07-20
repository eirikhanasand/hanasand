# Threat Intelligence Governance Operations

## Stored Policy

Every source stores its access method, risk/sensitivity class, legal notes, and collection justification in the isolated `threat_intel.sources` record. Catalog sources additionally retain publisher, legal basis, license, approval scope, and collection/retention policy. Restricted sources require an approved metadata-only governance record before collection.

Every capture stores `sensitive`, `retentionClass`, and a versioned redaction policy. PostgreSQL rejects a sensitive capture unless it is metadata-only and bodyless. Restricted adapters also discard object references and raw page content before persistence.

## Governance Endpoint

Use `POST /v1/intel/governance-actions` with the exact tenant scope and a normal authenticated user session. Reasons are required, bounded, and must not contain raw sensitive material.

Supported actions:

- `redact_capture`: owner/admin only. Deletes the referenced object when present, removes body and object reference, changes storage to metadata-only, and appends a governance audit record. Legal holds return `409` and must be released through the claim review process first.
- `takedown_source`: owner/admin only. Disables collection and appends the actor, reason, timestamp, and stable action ID to source governance history. Existing evidence remains subject to its retention/legal-hold policy.
- `correct_claim`: owner/admin/analyst. Appends an immutable `correct` review containing the corrected value and rejects the superseded claim state without rewriting capture evidence.

The endpoint is idempotent for the same tenant, action, target, actor, and reason because those fields produce a stable action ID.

## Retention And Deletion

Startup assigns versioned default retention classes and runs retention enforcement after PostgreSQL hydration. Retention removes public bodies or complete capture payloads according to class while preserving a bounded audit record and evidence identity. It never mutates legal-hold captures. Restricted metadata never has a retained body to delete.

For a deletion or institutional review request:

1. Confirm tenant, source, capture, and claim IDs from safe `/v1/intel` resources.
2. Apply a source takedown first when future collection must stop.
3. Apply capture redaction to each affected stored object unless legal hold blocks it.
4. Correct or contradict affected claims through append-only review; do not rewrite source evidence.
5. Verify the safe capture DTO is bodyless/objectless, source status is disabled, and claim review history identifies the authenticated actor and reason.
6. Retain the source/capture hashes, timestamps, policy actions, and review events needed to audit what was removed and why.

## Failure Handling

Object deletion is attempted before capture metadata is replaced. A failed governance request returns an error and must not be represented as completed. Retention jobs append audit only for applied mutations. Source takedown does not erase evidence, and legal hold always fails closed.

Use the regular PostgreSQL plus evidence-volume backup/restore procedure before bulk retention changes. Never place access tokens, raw stolen data, personal records, restricted locators, or object keys in reasons, logs, tickets, or API payloads.
