# Analyst Feedback Loop

Agent 07 publishes `ti.analyst_feedback_loop.v1` as a compact contract for analyst corrections. Feedback items can mark extracted facts as `correct`, `stale`, `wrong`, `duplicate`, `overconfident`, `underconfident`, or `missing`.

## Routing

Feedback is routed to:

- `quality_gate` for field readiness, confidence, and promotion decisions.
- `source_reliability` for source-family gaps and weak support.
- `entity_resolution` for aliases, duplicate merges, and canonical naming.
- `graph_review` for relationship-impacting corrections.
- `public_answer_caveat` for stale, restricted, contradicted, or partial wording.
- `parser_repair` for missing victims, TTPs, CVEs, malware/tools, or infrastructure.

## Policy

Feedback items are immutable suggestions. They never self-mutate models, change extractors automatically, or promote claims without analyst approval. They carry evidence IDs, ledger IDs, confidence-before values, recommended confidence-after hints, and reasons.

## Safety

The DTO omits raw evidence text, source URLs, restricted payloads, object keys, credentials, cookies, authorization material, and private-access details.
