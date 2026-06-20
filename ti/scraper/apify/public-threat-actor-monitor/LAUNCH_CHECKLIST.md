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
  "queries": ["APT29", "APT42", "LockBit"],
  "maxRowsPerQuery": 25,
  "includeActivity": true,
  "includeTargets": true,
  "includeTtps": true
}
```

5. Set `TI_PUBLIC_API_BASE` only if using a non-default endpoint.

## Pre-Listing Proof

Run:

```bash
bun run check
bun run smoke
docker build -t public-threat-actor-monitor .
```

Then run the image with a local Apify storage directory and fixture before publishing.

## Pricing Draft

- Free trial: 10 rows.
- Starter: 1,000 rows/month.
- Pro: 10,000 rows/month.
- Enterprise: custom source pack and support.

## First Upgrade After Listing

- Add a dedicated backend endpoint that returns already-normalized marketplace rows.
- Add canary source freshness status to each row.
- Add source coverage counters so buyers understand whether the result came from clear-web, public channel, or darknet metadata.
