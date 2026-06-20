# Public Threat Actor & Ransomware Activity Monitor

Track public reporting and metadata about threat actors, ransomware groups, malware names, and campaigns.

The Actor monitors a 20-group default watchlist and returns machine-readable rows for:

- recent public activity,
- likely targets,
- observed TTPs,
- source provenance,
- source and dataset coverage,
- confidence and corroboration grade,
- freshness and actionability flags,
- first/last-seen timestamps.

It does not return stolen data, credential values, private messages, payloads, raw leak contents, or protected/private forum material.

## Input

```json
{
  "queries": ["APT29", "Volt Typhoon", "LockBit"],
  "maxRowsPerQuery": 25,
  "includeActivity": true,
  "includeTargets": true,
  "includeTtps": true,
  "includeSources": true,
  "includeDatasets": true
}
```

## Output Row

```json
{
  "query": "APT29",
  "rowType": "activity",
  "actor": "APT29",
  "title": "APT29 reporting mention",
  "summary": "Public source mention related to APT29 activity.",
  "sourceType": "clear_web",
  "confidence": 0.48,
  "collectionMode": "live_search",
  "sourceCount": 4,
  "sourceFamilyCount": 2,
  "activityCount": 8,
  "freshnessStatus": "current",
  "evidenceGrade": "corroborated",
  "isActionable": true,
  "hasDarknetMetadata": true,
  "hasPublicChannelCoverage": false,
  "firstSeen": "2026-06-20T02:29:22.559Z",
  "lastSeen": "2026-06-20T02:29:22.559Z",
  "rawContentIncluded": false,
  "provenanceHash": "..."
}
```

## Safety Boundary

The Actor emits public metadata and summaries only. These fields are excluded:

- no credential values,
- no leaked database rows,
- no malware payloads,
- no private/invite-only content,
- no authentication or CAPTCHA bypass,
- no threat actor interaction,
- no raw darkweb URLs in public output.

## Using the results

Each run writes one normalized dataset. Filter `isActionable=true` for current findings with adequate confidence and at least one supporting source. Use `evidenceGrade` to distinguish corroborated findings from single-source claims, and retain `provenanceHash` when merging repeated runs.

The default watchlist contains 20 long-running state-linked and financially motivated groups. Custom queries can monitor up to 25 actor, malware, ransomware, or campaign names in one run. Schedule the Actor to maintain a rolling feed; downstream systems can consume dataset items through the Apify API.

Claims remain claims until corroborated. Confidence and evidence fields expose that distinction instead of presenting every public mention as confirmed activity.
