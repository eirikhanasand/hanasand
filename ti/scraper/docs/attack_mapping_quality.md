# ATT&CK Mapping Quality

`ti.attack_mapping_quality.v1` evaluates extracted TTP candidates before they are promoted into public answers, graph facts, or STIX export.

The DTO is mounted on:

- `GET /v1/intel/search.attackMappingQuality`
- `GET /v1/quality/evaluate.attackMappingQuality`

## What It Checks

- Technique confidence from the existing ATT&CK candidate mapper.
- Deprecated or revoked ATT&CK drift holds.
- Compact evidence citations with evidence, source, capture, stage, collection time, and extractor version.
- Actor relevance against the query and known aliases.
- Campaign or report timeframe support.
- Contradiction flags from disputed, conflicting, or negative-attribution language.
- STIX eligibility impact: `eligible`, `needs_review`, or `blocked`.

## Safety

The DTO intentionally does not expose raw evidence text, source URLs, object keys, credentials, cookies, authorization material, or restricted payloads. It carries compact provenance identifiers so analysts can replay evidence through controlled internal paths.

## Review Semantics

- `accepted`: mapped ATT&CK id, actor relevance, citations, and timeframe are strong enough for promotion.
- `proposed`: usable but below accepted confidence.
- `review_required`: missing technique id, weak actor relevance, or missing timeframe.
- `held`: contradiction or deprecated/revoked ATT&CK drift blocks promotion and STIX fact export.
