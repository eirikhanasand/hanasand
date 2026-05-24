# Search Quality Dashboard

Agent 07 owns `ti.search_quality_dashboard.v1`, exposed from `/v1/quality/evaluate` and mirrored on `/v1/intel/search` as `qualityDashboard`.

The dashboard is a compact operator DTO for deciding whether public TI output is useful enough to promote. It does not include raw capture bodies, unsafe URLs, leaked material, credentials, private access artifacts, or threat-actor interaction content.

## Field Gates

Each field emits `pass`, `warn`, `hold`, or `missing` for:

- actor summary, aliases, recent activity, targets, sectors, countries, tools/malware, CVEs, TTPs, campaigns, infrastructure, datasets, victim/company claims, IOCs, confidence, freshness, and provenance.
- Every field carries confidence, evidence count, citation count, freshness score, reasons, and feedback targets.
- Feedback targets are `source_activation`, `parser_repair`, `graph_review`, `analyst_review`, and `public_answer_hold`.

## Dashboard Metrics

- `usefulAnswerRate`: fraction of fields that can be displayed or caveated without blocking.
- `expectedFactRecall`: fraction of expected fields that have extracted support.
- `staleFactSuppression`: `hold` when stale evidence prevents ready promotion.
- `contradictionHandling`: `hold` when contradicted evidence is present.
- `sourceFamilyDiversity`: count of supporting source families.
- `citationAvailability`: fraction of provenance records with ledger, capture, or URL citation support.
- `freshnessScore`: normalized recent-activity freshness from the actor profile.

## Release Gate

The release decision is:

- `promote` only when the search quality gate is ready and every field avoids hold/missing.
- `hold` for contradicted evidence or field-level holds.
- `partial` for useful but incomplete answers.

Operators should use the dashboard as a routing surface: missing fields go to source activation, extraction misses go to parser repair, stale/contradicted/source-biased fields go to graph review, and victim/low-confidence fields go to analyst review.
