# Public Threat Actor & Ransomware Activity Monitor

Track public reporting and metadata about threat actors, ransomware groups, malware names, and campaigns.

The Actor monitors a 100-name default watchlist and returns machine-readable rows for:

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
- a compact buyer-value reason for every paid-row decision,
- first/last-seen timestamps.

It does not return stolen data, credential values, private messages, payloads, raw leak contents, or protected/private forum material.

## Pricing

The Actor is configured for Apify pay-per-event pricing, effective July 4, 2026. Hosted build `0.6.7` on Actor version `0.6` bills the built-in start event and default dataset item event automatically:

- `apify-actor-start`
- `apify-default-dataset-item`

Rows are priced at `$3.00 / 1,000`; Actor starts are `$0.00005`; platform usage is included for customers; Apify margin is 20%. This keeps customer cost tied to output volume rather than wall-clock runtime. The default dataset remains one row per normalized finding or public evidence item, and every row carries `paidRowDecision`, `paidRowReasonCodes`, `paidRowRemediationActions`, `whyWorthPayingFor`, `buyerValueScore`, `billingGuidance`, `graphQualityLift`, `graphQualityLiftReasonCodes`, `graphQualityLiftEvidence`, and `marketplaceGraphSignals` so buyers can separate sellable findings, sellable source-provenance rows, and caveated leads. Held rows, suppressed rows, and coverage-gap diagnostics are opt-in so paid runs do not bill for internal QA/remediation output. The `OUTPUT` key-value-store record includes compact monetization, paid-row quality, `monetizationReadiness`, dry-run `qualityLiftGate`, Program BO `graphLiftBatch2`, Program BP `marketplaceGraphSignals`, Program BT `revenueConversionChecklist`, Program CF `hundredRowConversionProof`, Program CL `marketplaceConversionRealRowSamplePack`, the Program CT `first100BuyerPreview`, `pricingProof`, and 12 `buyerSampleRows`. A run is paid-traffic-ready only when it has at least `100 sellable rows`, at least 25% chargeable findings, and average buyer value of at least 0.55.

Current local buyer preset proof: 607 safe rows across the 100-name default watchlist, 187 sellable rows, 420 caveated useful leads, 30.8% sellable rate, average buyer value `0.593`, and no held or coverage-gap rows in the paid default output. Re-run the hosted Actor before using these numbers in public conversion or revenue claims.

The Program CF 100-row progress surface is explicit in `OUTPUT.hundredRowConversionProof` and `/v1/contracts#apifyStoreReadiness.hundredRowConversionProgress`: current sellable rows, projected sellable rows from accepted repairs, one-repair-away rows, caveated useful rows, blocked rows, exact blockers, and the first paid-traffic experiment plan. Graph-only plans, proof-sized runs, and caveat-only runs do not count as production readiness. Paid conversion claims require real Apify analytics fields for Store views, unique users, trial runs, paid runs, runtime, platform usage, refunds, and conversion rates.

The Program CL conversion sample pack is explicit in `OUTPUT.marketplaceConversionRealRowSamplePack` and `/v1/contracts#apifyStoreReadiness.marketplaceConversionRealRowSamplePack`. It contains only current safe sellable sample rows with actor/group, claim type, safe victim or target context, sector/country, dataset or impact claim, TTP/tool/CVE pivots, freshness, confidence, corroboration state, contradiction state, next buyer searches, provenance hash, and no-leak proof. Synthetic, graph-only, stale, restricted-only, caveat-only, held, and coverage-gap rows are listed as excluded from paid-readiness proof. Marketplace telemetry descriptors for Store views, actor runs, paid runs, retention, refund risk, cost/useful row, and useful-row density remain `external_unknown` until copied from Apify analytics or `/v1/ops/product-slo`.

The Program CT first-100 preview is nested at `OUTPUT.marketplaceConversionRealRowSamplePack.first100BuyerPreview` and stays `blocked_preview_until_100_real_sellable_rows` until the release truth board confirms the real 100-row floor. It shows the current sellable count, useful-but-not-chargeable count, remaining row gap, top blocker buckets, required buyer fields, no-leak proof, freshness proof, and activation gates for the first-100 buyer sample pack without claiming production scale.

Marketplace demand and payout state are not inferred from sample rows. Store views, unique users, starts, paid runs, refunds, platform usage cost, creator revenue, beneficiary state, payout method, and withdrawal readiness stay `null` or `unknown` until copied from Apify analytics or billing. The next manual verification step is recorded in `OUTPUT.revenueConversionChecklist.nextManualVerificationStep`.

## Input

```json
{
  "maxRowsPerQuery": 25,
  "includeActivity": true,
  "includeTargets": true,
  "includeTtps": true,
  "includeSources": true,
  "includeDatasets": false,
  "includeCoverageGaps": false,
  "includeHeldRows": false
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
  "paidRowDecision": "sellable",
  "billingGuidance": "charge",
  "whyWorthPayingFor": "fresh corroborated public signal with source-family diversity",
  "buyerValueScore": 0.78,
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

`GET /v1/contracts` exposes `apifyStoreReadiness`, which mirrors the Actor default input, hosted build `0.6.7`, public proof run/dataset, pricing hooks, conversion metric handoff, buyer-facing conversion proof, and safe sample output DTOs for `APT29`, `Volt Typhoon`, `Scattered Spider`, and `LockBit`.

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

Each run writes one normalized dataset. Related reports are conservatively clustered into one activity row when their topic strongly overlaps within a three-day window. Filter `isActionable=true` for current findings with adequate confidence and at least one supporting source. Use `relationshipSummary`, `relationshipPivots`, `whyActionable`, `whyWorthPayingFor`, `corroborationState`, and `nextSearchPivots` to see the actor-to-victim/sector/country/TTP/source-family pivots that make a row worth investigating. Use `reviewReasons`, `analysisFacets`, `evidenceGrade`, `publisherCount`, and the source ID arrays to distinguish actionable rows from stale, partial, single-source, contradicted, or metadata-only claims. Use `schedulerDecision`, `pollingHint`, `nextPollSeconds`, `retryAfterSeconds`, `duplicateRunReuse`, and `sourceCoverageGaps` to decide whether downstream monitoring should poll again, wait for backoff, or treat the row as a source-coverage follow-up. Retain `provenanceHash` when merging repeated runs.

For paid monitoring workflows, start with `paidRowDecision=sellable`, then inspect `included_with_caveat` rows as leads. Profile, target, TTP, and public source-provenance rows can be sellable when they are fresh or recent, actionable, safe, and supported by multiple public sources even if a source-family gap remains visible. Source-provenance rows are evidence rows, not confirmed incident claims. Single-source activity rows, stale rows, contradicted rows, and no-evidence rows are not promoted. Treat `coverage_gap_only` rows as source-expansion work, `hold` rows as not ready for promotion, and `suppress` rows as capability or context rows that should not be counted as paid findings until remediation adds evidence. Use `graphQualityLiftEvidence` to inspect relationship readiness, source corroboration, contradiction holds, freshness lift, no-leak state, and export-review eligibility for each paid-row decision. Use `marketplaceGraphSignals` to see actor/victim/sector/country/TTP/source-family links, freshness/change hints, confidence trend, contradiction state, next buyer pivots, and the recommended buyer action for the row. The field is safe metadata only: it never includes raw evidence bodies, raw unsafe URLs, credentials, private content, stolen files, or actor-interaction material. The run-level `paidRowQuality` object gives the same counts without scanning the whole dataset. The run-level `monetizationReadiness` object states whether the dataset is ready for paid traffic, the target sellable row floor, current sellable and useful row counts, blockers, and the next revenue action. The run-level `qualityLiftGate` compares accepted and rejected repair examples against proof run `iMQGeezZ8bx7WtlhQ` and the 100-name buyer preset, reporting accepted/rejected counts, sellable/fresh/useful rows added, cost-per-useful-row delta, projected row revenue delta, and owner handoffs. The run-level `graphLiftBatch2` uses live proof `OThlfd0uzSCNnedAO` / dataset `LSen2fYtwFTtOr7vK` as the newer baseline and explicitly rejects graph-only promotion for stale, single-source, contradicted, restricted-only, missing-ledger, and unrelated-actor context. The run-level `marketplaceGraphSignals` includes eight buyer-facing APT/ransomware examples, six graph-inflation rejection cases, and Agent 03/04/05 handoffs for parser, public-channel, and restricted-metadata blockers. These gates are dry-run only: they do not mutate sources, start collection, or count repairs unless buyer-visible paid-row output improves.

The default watchlist contains 100 long-running state-linked, financially motivated, and malware/ecosystem names. Custom queries can monitor up to 100 actor, malware, ransomware, or campaign names in one run. Schedule the Actor to maintain a rolling feed; downstream systems can consume dataset items through the Apify API. Dataset coverage, held rows, and coverage-gap rows are disabled by default so ordinary runs contain buyer-useful intelligence and public evidence rows rather than internal diagnostics. Enable them for QA or source-repair workflows.

Claims remain claims until corroborated. Confidence and evidence fields expose that distinction instead of presenting every public mention as confirmed activity.
