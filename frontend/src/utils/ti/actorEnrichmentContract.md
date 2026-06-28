# Public TI Actor Enrichment Contract

The public `/ti/<query>` actor page can render and export serious analyst work only when the TI search response carries these fields.

## Actor Intelligence

Populate `TiSearchResponse.actorIntelligence` with:

- `actorClass`
- `attribution`
- `firstSeen`
- `lastSeen`
- `motivation[]`
- `malwareTools[]`
- `campaigns[]`
- `infrastructure[]`
- `indicators[]`
- `targetSectors[]`
- `geographies[]`
- `confidence`
- `confidenceReasoning[]`
- `sourceProvenance[]`
- `structuredProvenance[]`

Each `structuredProvenance[]` row should include:

- `sourceId`
- `sourceName`
- `provenance`
- `reportDate`
- `captureId`
- `confidence`
- `shownBecause`

## Actionability

Populate `TiSearchResponse.actionability` with:

- `watchlistCandidates[]`
- `watchlistMatches[]`
- `relatedAlerts[]`
- `relatedCases[]`
- `sourceProvenance[]`
- `enrichmentGaps[]`
- `handoffs.watchlist`
- `handoffs.alertRebuild`
- `handoffs.caseCreate`

Each `enrichmentGaps[]` row should include:

- `id`
- `title`
- `severity`
- `detail`
- `dependency`
- `route`
- `sourceFamily`
- `requestedFields[]`

The public page derives `watchlistRelevance`, `createAlertHandoff`, `caseHandoff`, and `enrichmentGapQueue` from these fields. Missing capture IDs, alert IDs, case payloads, organization watchlist context, or actor enrichment fields must be returned as actionable gaps, not prose.
