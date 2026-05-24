# Scraper Architecture

## Goal
Build a Bun/TypeScript CTI collection service that can collect public intelligence reliably, preserve provenance, and later support safe metadata-only Tor/I2P/Freenet collection.

## First Production Slice
```text
source_registry
  -> scheduler/frontier
  -> adapter
  -> raw_capture store
  -> text/entity/IOC pipeline
  -> incident candidates
  -> API
```

## CTI Application Integration
The scraper exposes typed intelligence requests instead of making the CTI application understand adapter details.

```text
POST /intel/plan
{
  "query": "APT29",
  "entityType": "actor",
  "includeDarknetMetadata": true
}
```

The response is a `CollectionPlan`: clear-web tasks, RSS/API tasks, public-channel tasks, and approved metadata-only darknet tasks. The CTI application can show the plan, approve high-risk parts, run it, and track provenance across captures and extracted incident candidates.

The contract is deliberately modular:
- Source registry decides which sources are eligible.
- Planner turns intelligence needs into source-specific candidates.
- Frontier prioritizes candidates.
- Adapters fetch through their own safe boundary.
- Pipeline extracts intelligence with provenance and confidence.
- API returns machine-readable state for the broader CTI app.

## Key Boundaries
- Adapters fetch and normalize source material.
- Frontier decides what is worth crawling next.
- Policy blocks unsafe collection before network work starts.
- Storage keeps raw evidence immutable and separated from extracted intelligence.
- Pipeline never drops provenance.

## Focused Crawling Strategy
Initial scoring follows the hybrid crawler notes:
- link context score
- parent page score
- source reputation
- novelty
- safety risk
- freshness

Destination-page classification is a later hook because it costs more and requires fetching.

## Darknet Handling
Tor, I2P, and Freenet are treated as high-risk source classes. The first implementation should capture metadata only:
- source id
- network type
- URL or content hash
- actor/victim/date claims
- claimed sector/country/data type
- screenshot hash when approved
- collection timestamp

The service must not download stolen files or bypass access controls.
