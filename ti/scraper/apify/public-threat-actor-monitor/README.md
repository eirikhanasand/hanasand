# Fresh Threat Actor & Ransomware Activity Monitor

Monitor public ransomware victim-claim metadata and fresh public threat actor activity in a clean dataset. The default run uses a 136-group high-yield ransomware preset and returns more than 20,000 safe metadata rows when the public source pages are reachable when the public source pages are reachable.

## What You Get

- Victim-claim archive rows for groups such as LockBit, Qilin, Akira, Play, Clop, RansomHub, ALPHV, DragonForce, BianLian, Black Basta, Medusa, SafePay, 8Base, Lynx, Everest, Conti, Rhysida, Cactus, Royal, and Hive.
- Fresh/current rows where recent public claims exist, plus historical rows clearly marked by `freshnessStatus`.
- Fields for `actor`, `victimName`, `affectedSectors`, `countries`, `claimedDate`, `sourceUrl`, `confidence`, `paidRowDecision`, `buyerValueScore`, `whyWorthPayingFor`, and `nextSearchPivots`.
- Safe metadata only: no credential values, stolen files, malware payloads, private messages, raw leak contents, authentication bypass, CAPTCHA bypass, or threat-actor interaction.

## Default Input

The default preset is tuned for broad ransomware monitoring and archive search:

```json
{
  "maxRowsPerQuery": 500,
  "includeActivity": true,
  "includeTargets": true,
  "includeTtps": true,
  "includeSources": true,
  "includeDatasets": false,
  "includeCoverageGaps": false,
  "includeHeldRows": false
}
```

Custom runs can replace `queries` with actor, ransomware, malware, campaign, sector, or brand terms.

## Pricing

The Actor uses Apify pay-per-event pricing.

- Dataset rows: `$3.00 / 1,000 rows`
- Actor start: `$0.00005`
- Platform usage: included for customers

Rows are priced by output volume, so buyers can estimate cost before scheduling a run.

## Good Uses

- SOC teams can filter `freshnessStatus=current` or `recent` for daily triage.
- CTI teams can search historical victim claims by actor, victim, sector, country, or date.
- Brand monitoring teams can check whether an organization appears in public ransomware victim metadata.
- Incident response teams can pivot from victim claims into public corroboration and defensive follow-up.

## Sample Row

```json
{
  "query": "Qilin",
  "rowType": "activity",
  "actor": "Qilin",
  "title": "Qilin victim claim: Example Corp",
  "claimType": "victim_claim",
  "victimName": "Example Corp",
  "affectedSectors": ["Healthcare"],
  "countries": ["US"],
  "claimedDate": "2026-06-20T00:00:00.000Z",
  "sourceType": "clear_web",
  "collectionMode": "ransomware_live_group_page",
  "freshnessStatus": "current",
  "paidRowDecision": "sellable",
  "billingGuidance": "charge",
  "whyWorthPayingFor": "specific public intelligence row ready for analyst triage",
  "rawContentIncluded": false,
  "safety": {
    "metadataOnly": true,
    "credentialsIncluded": false,
    "stolenFilesIncluded": false,
    "privateContentIncluded": false,
    "actorInteraction": false
  }
}
```

## Notes

Claims are public claims, not confirmed breaches. Use `confidence`, `freshnessStatus`, `sourceUrl`, `corroborationState`, and `nextSearchPivots` to decide what needs follow-up.
