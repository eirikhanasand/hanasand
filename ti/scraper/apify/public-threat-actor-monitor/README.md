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
- analysis facets for spreadsheet/API filtering by row type, claim type, evidence grade, freshness, source family, and safety boundary,
- first/last-seen timestamps.

It does not return stolen data, credential values, private messages, payloads, raw leak contents, or protected/private forum material.

## Pricing

The Actor is configured for Apify pay-per-event pricing, effective July 4, 2026. Published build `0.6.4` on Actor version `0.6` bills the built-in start event and default dataset item event automatically:

- `apify-actor-start`
- `apify-default-dataset-item`

Rows are priced at `$3.00 / 1,000`; Actor starts are `$0.00005`; platform usage is included for customers; Apify margin is 20%. This keeps customer cost tied to output volume rather than wall-clock runtime. The default dataset remains one row per normalized finding, and every row carries `paidRowDecision`, `paidRowReasonCodes`, `paidRowRemediationActions`, `buyerValueScore`, `billingGuidance`, `graphQualityLift`, `graphQualityLiftReasonCodes`, `graphQualityLiftEvidence`, and `marketplaceGraphSignals` so buyers can separate sellable findings from caveated leads, held rows, suppressed low-evidence rows, and coverage-gap remediation. The `OUTPUT` key-value-store record includes compact monetization, paid-row quality, `monetizationReadiness`, dry-run `qualityLiftGate`, Program BO `graphLiftBatch2`, Program BP `marketplaceGraphSignals`, Program BT `revenueConversionChecklist`, `pricingProof`, and 12 `buyerSampleRows`. A run is blocked for paid-traffic confidence until at least 25% of rows are chargeable findings and average buyer value is at least 0.55.

Latest public proof: run `iMQGeezZ8bx7WtlhQ`, dataset `5PLmkE30luBA5Lbgc`, 10 safe APT42 rows, 4s runtime, about `$0.001` platform usage, and about `$0.03` gross row revenue after pricing starts.

Marketplace demand and payout state are not inferred from sample rows. Store views, unique users, starts, paid runs, refunds, platform usage cost, creator revenue, beneficiary state, payout method, and withdrawal readiness stay `null` or `unknown` until copied from Apify analytics or billing. The next manual verification step is recorded in `OUTPUT.revenueConversionChecklist.nextManualVerificationStep`.

## Input

```json
{
  "queries": [
    "APT29",
    "APT28",
    "APT42",
    "Lazarus Group",
    "Volt Typhoon",
    "Salt Typhoon",
    "Turla",
    "Sandworm",
    "Kimsuky",
    "MuddyWater",
    "Charming Kitten",
    "Scattered Spider",
    "LockBit",
    "Clop",
    "Akira",
    "Black Basta",
    "Play",
    "RansomHub",
    "ALPHV",
    "Hunters International"
  ],
  "maxRowsPerQuery": 25,
  "includeActivity": true,
  "includeTargets": true,
  "includeTtps": true,
  "includeSources": true,
  "includeDatasets": false,
  "includeCoverageGaps": true
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
  "relationshipSummary": "APT42 has a campaign row with single_source public support.",
  "relationshipPivots": ["claim:campaign", "source_family:clear_web"],
  "whyActionable": ["Single-source row: useful as a lead, not a confirmed fact.", "Run is still polling; keep the row attached to the active run."],
  "corroborationState": "single_source",
  "nextSearchPivots": ["APT42 public channel", "APT42 clear_web"],
  "evidenceGrade": "corroborated",
  "isActionable": true,
  "reviewReasons": ["freshness:current", "evidence:corroborated", "actionable:monitor_or_triage"],
  "analysisFacets": ["claim:campaign", "evidence:corroborated", "freshness:current", "row:activity", "safety:metadata_only"],
  "hasDarknetMetadata": false,
  "hasPublicChannelCoverage": false,
  "firstSeen": "2026-06-20T02:29:22.559Z",
  "lastSeen": "2026-06-20T02:29:22.559Z",
  "rawContentIncluded": false,
  "safety": {
    "metadataOnly": true,
    "credentialsIncluded": false,
    "stolenFilesIncluded": false,
    "privateContentIncluded": false,
    "actorInteraction": false
  },
  "provenanceHash": "..."
}
```

## Public Proof Contract

`GET /v1/contracts` exposes `apifyStoreReadiness`, which mirrors the Actor default input, published build `0.6.4`, public proof run/dataset, pricing hooks, conversion metric handoff, buyer-facing conversion proof, and safe sample output DTOs for `APT29`, `Volt Typhoon`, `Scattered Spider`, and `LockBit`.

Each public proof DTO includes:

- `runId`, `buildVersion`, and `datasetId`,
- query, row count, freshness, and source families,
- the `safe_metadata_only.v1` safety contract,
- a no-leak proof showing raw content, credentials, private content, and actor interaction are absent.

Run these before publication or after changing the listing contract:

```bash
bun run check
bun run check:api-regression
bun run check:apify-threat-actor-monitor
bun run smoke:apify-threat-actor-monitor
bun run check:apify-publication
TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search
TI_SEARCH_READINESS_QUERY='Volt Typhoon' bun run check:scraper-native-search
TI_SEARCH_READINESS_QUERY='Scattered Spider' bun run check:scraper-native-search
TI_SEARCH_READINESS_QUERY=LockBit bun run check:scraper-native-search
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

Each run writes one normalized dataset. Related reports are conservatively clustered into one activity row when their topic strongly overlaps within a three-day window. Filter `isActionable=true` for current findings with adequate confidence and at least one supporting source. Use `relationshipSummary`, `relationshipPivots`, `whyActionable`, `corroborationState`, and `nextSearchPivots` to see the actor-to-victim/sector/country/TTP/source-family pivots that make a row worth investigating. Use `reviewReasons`, `analysisFacets`, `evidenceGrade`, `publisherCount`, and the source ID arrays to distinguish actionable rows from stale, partial, single-source, contradicted, or metadata-only claims. Use `schedulerDecision`, `pollingHint`, `nextPollSeconds`, `retryAfterSeconds`, `duplicateRunReuse`, and `sourceCoverageGaps` to decide whether downstream monitoring should poll again, wait for backoff, or treat the row as a source-coverage follow-up. Retain `provenanceHash` when merging repeated runs.

For paid monitoring workflows, start with `paidRowDecision=sellable`, then inspect `included_with_caveat` rows as leads. Profile, target, and TTP rows can be sellable when they are fresh or recent, actionable, and supported by multiple public sources even if a source-family gap remains visible; single-source activity rows, stale rows, contradicted rows, and no-evidence rows are not promoted. Treat `coverage_gap_only` rows as source-expansion work, `hold` rows as not ready for promotion, and `suppress` rows as capability or context rows that should not be counted as paid findings until remediation adds evidence. Use `graphQualityLiftEvidence` to inspect relationship readiness, source corroboration, contradiction holds, freshness lift, no-leak state, and export-review eligibility for each paid-row decision. Use `marketplaceGraphSignals` to see actor/victim/sector/country/TTP/source-family links, freshness/change hints, confidence trend, contradiction state, next buyer pivots, and the recommended buyer action for the row. The field is safe metadata only: it never includes raw evidence bodies, raw unsafe URLs, credentials, private content, stolen files, or actor-interaction material. The run-level `paidRowQuality` object gives the same counts without scanning the whole dataset. The run-level `monetizationReadiness` object states whether the dataset is ready for paid traffic, the target sellable row floor, current sellable and useful row counts, blockers, and the next revenue action. The run-level `qualityLiftGate` compares accepted and rejected repair examples against proof run `iMQGeezZ8bx7WtlhQ` and the 20-group daily shape, reporting accepted/rejected counts, sellable/fresh/useful rows added, cost-per-useful-row delta, projected row revenue delta, and owner handoffs. The run-level `graphLiftBatch2` uses live proof `OThlfd0uzSCNnedAO` / dataset `LSen2fYtwFTtOr7vK` as the newer baseline and explicitly rejects graph-only promotion for stale, single-source, contradicted, restricted-only, missing-ledger, and unrelated-actor context. The run-level `marketplaceGraphSignals` includes eight buyer-facing APT/ransomware examples, six graph-inflation rejection cases, and Agent 03/04/05 handoffs for parser, public-channel, and restricted-metadata blockers. These gates are dry-run only: they do not mutate sources, start collection, or count repairs unless buyer-visible paid-row output improves.

The default watchlist contains 20 long-running state-linked and financially motivated groups. Custom queries can monitor up to 25 actor, malware, ransomware, or campaign names in one run. Schedule the Actor to maintain a rolling feed; downstream systems can consume dataset items through the Apify API. Dataset coverage rows are disabled by default so ordinary runs contain intelligence rows rather than product-roadmap rows. Coverage-gap rows remain enabled by default because they explain why an answer may still be partial.

Claims remain claims until corroborated. Confidence and evidence fields expose that distinction instead of presenting every public mention as confirmed activity.
