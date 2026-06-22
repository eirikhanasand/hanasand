# Ransomware Victim Claims & Recent CVE Monitor

Track recent ransomware victim claims and what data the actor says they have, with RansomLook recent posts, RansomLook RSS, RansomLook search, RansomLook's broader post index, ransomware.live, DLS Monitor novel claims, CISA known-exploited CVEs, and recent NVD CVE updates as supporting context.

Use it to check a company, a ransomware group, a watchlist, or a broader monitoring set. Each row is built for quick triage: who was mentioned, which actor posted it, what data is claimed, when it was seen, where it came from, and what to check next.

## What You Get

- Public ransomware victim-claim rows from RansomLook recent posts, RansomLook RSS, RansomLook search, RansomLook's broader post index, ransomware.live, and novel DLS Monitor rows with actor, victim name, claimed date, sector or country when available, and a public source link for review.
- Claimed-data fields extracted from public victim descriptions, including `claimedDataSummary`, `claimedDataSize`, and `claimedDataTypes` such as employee personal data, client data, financial records, contracts, emails, databases, or technical files when mentioned.
- CISA Known Exploited Vulnerabilities rows with CVE ID, affected vendor/product, date added, remediation due date when available, and ransomware-use context when CISA includes it.
- Recent NVD CVE update rows with CVE ID, publication or update date, CVSS/CWE context when available, and NVD detail link.
- Buyer-ready fields such as `actor`, `victimName`, `matchedSearchTerm`, `victimWebsite`, `claimedDataSummary`, `claimedDataTypes`, `claimType`, `claimedDate`, `sourceUrl`, `freshnessStatus`, `confidence`, `buyerSummary`, `recommendedBuyerAction`, and `keyPivots`.
- Activity rows first, sorted toward recent and current findings.
- A capped preview mode for quick checks, plus a full mode for larger exports.

## Start With Preview Mode

Preview mode is the default. It is designed for a small first run before scheduling a larger export.

```json
{
  "runMode": "preview",
  "queries": ["qilin", "akira", "lockbit3", "play", "clop"],
  "maxTotalRows": 500,
  "maxRowsPerQuery": 250,
  "includeActivity": true,
  "includeTargets": false,
  "includeTtps": false,
  "includeSources": false
}
```

Good preview searches:

- A company or brand name.
- A company domain, supplier, partner, or subsidiary name.
- A ransomware group such as `qilin`, `akira`, `lockbit3`, `play`, or `clop`.
- A short watchlist of groups or vendors.
- A recent CVE ID, vendor, or product name.

## Full Monitoring Runs

Use full mode when you want a larger ransomware and CVE export.

```json
{
  "runMode": "full",
  "queries": ["qilin", "akira", "lockbit3", "play", "clop"],
  "maxTotalRows": 50000,
  "maxRowsPerQuery": 6000,
  "includeActivity": true,
  "includeTargets": true,
  "includeTtps": true,
  "includeSources": false
}
```

For broad ransomware monitoring, keep your group list focused on the groups you actually track. For company monitoring, use the company name, brand names, domains, product names, and major subsidiaries as queries.

## Example Row

```json
{
  "actor": "Qilin",
  "rowType": "activity",
  "claimType": "victim_claim",
  "victimName": "Example Corp",
  "matchedSearchTerm": "example.com",
  "claimedDate": "2026-06-20T00:00:00.000Z",
  "freshnessStatus": "current",
  "sourceUrl": "https://www.ransomware.live/...",
  "confidence": 0.82,
  "claimedDataSummary": "claimed 62GB; mentions employee personal data, customer/client data, contracts and agreements",
  "claimedDataSize": "62GB",
  "claimedDataTypes": ["employee personal data", "customer/client data", "contracts and agreements"],
  "buyerSummary": "Current Qilin victim claim: Example Corp. Claimed data: claimed 62GB; mentions employee personal data, customer/client data, contracts and agreements. Includes company, actor, date, source link, claimed data, and review pivots.",
  "recommendedBuyerAction": "Open the source link, confirm the company match, and route Qilin, Example Corp, example.com, Healthcare to incident response, legal, or vendor risk review.",
  "keyPivots": ["Qilin", "Example Corp", "Healthcare", "US"]
}
```

## Pricing

This actor charges per result row.

- Launch price target: `$1.00 / 1,000 rows`
- Actor start: `$0.00005`

Preview runs are capped by default so you can inspect the dataset before running a larger export. A 500-row preview is about `$0.50` at the launch target price. A 10,000-row monitoring export is about `$10`.

## Common Uses

- Check whether a company appears in recent public ransomware victim claims.
- See what kind of data the actor claims to have before you contact the affected company.
- Monitor a ransomware group and export the latest victim-claim rows.
- Build a daily queue of recent company exposure, ransomware, and CVE items for SOC or CTI triage.
- Pull known-exploited and recently updated CVE rows into a vulnerability or exposure workflow.
- Create a watchlist from actor, victim, sector, country, CVE, and source fields.

## Notes

Ransomware victim claims are public claims and should be reviewed before escalation. The dataset gives you the actor, company, claimed data, date, source page, and pivots so your team can decide what needs follow-up.
