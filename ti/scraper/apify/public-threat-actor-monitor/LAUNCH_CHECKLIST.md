# Launch Checklist

## Product

- Title: `Public Threat Actor & Ransomware Activity Monitor`
- Primary listing category: security / monitoring / news
- First promise: safe public-intelligence metadata for actor activity, targeting, and TTPs.
- Do not market as a stolen-data, credential, or payload scraper.

## Safety Gate

- Output rows must always set `rawContentIncluded: false`.
- Do not emit credential values, leaked rows, payload URLs, private messages, cookies, auth headers, or actor-interaction text.
- Darknet-related outputs must remain metadata-only and redacted unless an operator adds a reviewed source adapter later.
- Keep the output contract stable: `safe_metadata_only.v1`.

## Apify Setup

1. Create an Apify account.
2. Install/use the Apify CLI locally if desired.
3. Push this directory as the Actor root:
   `ti/scraper/apify/public-threat-actor-monitor`
4. Set the default input to:

```json
{
  "queries": ["APT29", "Volt Typhoon", "LockBit"],
  "maxRowsPerQuery": 25,
  "includeActivity": true,
  "includeTargets": true,
  "includeTtps": true,
  "includeSources": true,
  "includeDatasets": false,
  "includeCoverageGaps": true
}
```

5. Set `TI_PUBLIC_API_BASE` only if using a non-default endpoint.

## Pre-Listing Proof

Run:

```bash
bun run check
bun run smoke
bun run check:publication
docker build -t public-threat-actor-monitor .
```

Then run the image with a local Apify storage directory and fixture before publishing.

## Launch Pricing

Use Apify pay-per-event pricing. Bill normalized dataset rows rather than runtime so customers can predict cost before scheduling a run.

| Customer plan | Price per 1,000 rows |
| --- | ---: |
| Free | $3.00 |
| Bronze | $2.70 |
| Silver | $2.40 |
| Gold | $2.10 |

- Dataset item event: `apify-default-dataset-item`.
- Actor start event: `apify-actor-start` at $0.00005.
- Do not add a monthly rental at launch; usage is too early to justify one.
- Review pricing after 30 paid runs using actual rows per run, repeat usage, platform costs, and support load.
- Monetization remains blocked until Apify beneficiary details and a payout method are verified.

## Next Data Upgrades

- Cluster multiple reports about the same campaign into one claim with supporting publishers.
- Extract named victims, affected countries, sectors, and claimed impact when directly supported by public evidence.
- Record corroborating and contradicting evidence separately.
- Add long-running public-channel and reviewed darknet-metadata sources to the same provenance contract.
