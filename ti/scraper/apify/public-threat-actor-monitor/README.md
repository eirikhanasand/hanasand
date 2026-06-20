# Public Threat Actor & Ransomware Activity Monitor

Track public reporting and metadata about threat actors, ransomware groups, malware names, and campaigns.

The Actor monitors a 20-group default watchlist and returns machine-readable rows for:

- recent public activity,
- clustered incident claims with first/last reporting times,
- publisher counts and corroborating source IDs,
- optional victim, affected-sector, country, and impact extraction,
- likely targets,
- observed TTPs,
- source provenance and optional coverage metadata,
- confidence and corroboration grade,
- freshness and actionability flags,
- scheduler polling, duplicate-run reuse, retry/backoff, and source-coverage gap state,
- review reasons for stale, single-source, partial, contradicted, metadata-only, or actionable rows,
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
  "includeDatasets": false
}
```

## Output Row

```json
{
  "query": "APT29",
  "rowType": "activity",
  "actor": "APT29",
  "title": "APT29 targets cloud accounts",
  "summary": "A dated public report describing an APT29 campaign. Reported by 2 publishers: Security Vendor A, Security Vendor B.",
  "claimType": "campaign",
  "affectedSectors": ["Technology and cloud services"],
  "impact": "Reported credential or account compromise",
  "publisherCount": 2,
  "firstReportedAt": "2026-06-19T14:00:00.000Z",
  "lastReportedAt": "2026-06-20T08:30:00.000Z",
  "corroboratingSourceIds": ["source:a", "source:b"],
  "contradictingSourceIds": [],
  "sourceType": "clear_web",
  "confidence": 0.64,
  "collectionMode": "live_search",
  "sourceCount": 4,
  "sourceFamilyCount": 2,
  "activityCount": 3,
  "freshnessStatus": "current",
  "schedulerDecision": "reuse_active_run",
  "pollingHint": "source_gap_review",
  "nextPollSeconds": 3,
  "retryAfterSeconds": 3,
  "duplicateRunReuse": true,
  "sourceCoverageState": "thin",
  "sourceCoverageGaps": ["missing_public_channel_evidence"],
  "evidenceGrade": "corroborated",
  "isActionable": true,
  "reviewReasons": ["freshness:current", "evidence:corroborated", "actionable:monitor_or_triage"],
  "hasDarknetMetadata": false,
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

Each run writes one normalized dataset. Related reports are conservatively clustered into one activity row when their topic strongly overlaps within a three-day window. Filter `isActionable=true` for current findings with adequate confidence and at least one supporting source. Use `reviewReasons`, `evidenceGrade`, `publisherCount`, and the source ID arrays to distinguish actionable rows from stale, partial, single-source, contradicted, or metadata-only claims. Use `schedulerDecision`, `pollingHint`, `nextPollSeconds`, `retryAfterSeconds`, `duplicateRunReuse`, and `sourceCoverageGaps` to decide whether downstream monitoring should poll again, wait for backoff, or treat the row as a source-coverage follow-up. Retain `provenanceHash` when merging repeated runs.

The default watchlist contains 20 long-running state-linked and financially motivated groups. Custom queries can monitor up to 25 actor, malware, ransomware, or campaign names in one run. Schedule the Actor to maintain a rolling feed; downstream systems can consume dataset items through the Apify API. Coverage metadata is disabled by default so ordinary runs contain intelligence rows rather than product-roadmap rows.

Claims remain claims until corroborated. Confidence and evidence fields expose that distinction instead of presenting every public mention as confirmed activity.
