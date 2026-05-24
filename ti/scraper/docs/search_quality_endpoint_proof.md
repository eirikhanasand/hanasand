# Search Quality Mounted Endpoint Proof

Agent 07 owns the extraction/search-quality proof surface. The proof command starts an in-process Bun API server with safe fixture captures and checks both mounted endpoints:

```sh
bun run check:search-quality-mounted
```

Expected output is one compact JSON line per case with `ok:true`, the case name, and matching quality summaries for `/v1/intel/search` and `/v1/quality/evaluate`.

Expected cases:

- `ready`: `status` is `ready` and `canPromoteToReady` is `true`.
- `partial`: `status` is `partial`.
- `weak_evidence`: warning codes include `weak-evidence`.
- `alias_collision`: warning codes include `alias_collision_warning` and action kinds include `suppress_noisy_alias`.
- `contradicted`: `status` is `contradicted`.
- `stale`: `status` is `stale`.
- `insufficient_capture`: warning codes include `insufficient-capture`.
- `needs_review`: warning codes include `needs-review`.

Safety expectations:

- The proof fails if either mounted endpoint is unavailable.
- The proof fails if public warning payloads include raw fixture text.
- The proof fails if public warning payloads include unsafe source URL details.
- The output is terse enough for Agent 09 compatibility checks and Agent 10 promotion packets.
