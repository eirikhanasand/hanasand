Status: active_program_bc_external_public_proof_blocked

- Added `ti.quality_runtime_value_gates.v1` for route-visible CTI answer value scoring across actor, campaign, malware/tool, CVE, country, sector, victim, infrastructure, and unknown queries.
- Wired compact runtime value gates into `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/contracts`, route inventory, docs, and API/pipeline regression coverage.
- Added dark-web metadata quality caveats, no-leak field rules, source-atlas value feedback, analyst-actionability scoring, and remediation handoffs for Agents 01/02/03/04/05/06/08/09/10.
- Added regression fixtures for fresh actor activity, random and made-up unknown queries, stale APT rejection, fresh CVE, ransomware/victim claim, country/sector surge, dark-web metadata hold, public-channel weak signal, and contradiction clusters.
- Repaired related drift in public-signal value impact, public-channel scheduler budget classes, graph/STIX fixture typing, contract-index sanitization, and live-search gate typing.
- Verification green: `bun run check`, `bun test`, focused quality pipeline/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and `bun run check:canary-proof-path`.
- External proof blocker: `TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search` and `TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search` cannot complete because `https://api.hanasand.com/api/ti/search` refuses connections from this environment; an escalated retry is still pending because approval was unavailable.

Next continuation: rerun the scraper-native public proof when the API is reachable, then continue the long-running Agent 07 quality/value-gate vision from `coordination_program_backlog.md`.
