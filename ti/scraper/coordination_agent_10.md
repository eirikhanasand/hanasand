Status: active_task_ab

## CURRENT ASSIGNMENT - READ FIRST

Task AB: Real-Time Search Release Board, Polling SLOs, And Canary Decisioning

Own the release gate for the Task AB real-time public search work. Do not wait for another prompt. Agents 07, 08, and 09 are now building answer, graph, and wrapper delta contracts; your lane is to decide whether the combined behavior is fit for `hanasand.com/ti` and enterprise API clients under real workload pressure.

Build a release-board packet for real-time public search with decisions `no-go`, `partial-public-ok`, `canary-ready`, `canary-with-warnings`, `promote-with-warnings`, `promote`, `rollback`, and `emergency-stop`. Aggregate gates for immediate first response, 3-second polling, same-run reuse, cursor advancement, empty deltas, clear-web capture deltas, public-channel hint deltas, restricted-held deltas, graph/STIX deltas, claim-ledger holds, contradiction downgrades, no-result/searching, provider/scraper unavailable, queue pressure, stale source caveats, low confidence, policy block, no-leak output, memory budget, worker queue headroom, frontend no-default proof, public POST compatibility, and remote/container health.

Cover APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE, malware/tool, victim/ransomware, country, and sector. Wire to `/v1/contracts`, `/v1/intel/search`, Agent 02 scheduler SLOs, Agent 06 evidence/claim ledger gates, Agent 07 answer deltas, Agent 08 graph/STIX deltas, Agent 09 public wrapper proof, deployment checks, and rollback commands. Verify ops/API/full tests, typecheck, route inventory, contract-index, deploy hygiene, Docker context checks, remote drift, live-search deploy proof, Inspur public proof, and a concise go/no-go summary in operations docs.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AC: Production Observability, SLO Dashboard, And 24h Soak Automation

After Task AB proof is complete, continue directly into Task AC. Build the operations layer CTI teams need to trust the scraper: SLO dashboard contracts, p95 initial/partial latency, queue age, worker saturation, memory/CPU, adapter failure rate, source-unavailable rate, policy-block rate, evidence write/read proof, graph export readiness, public proof matrix, and alert thresholds. Include 24h soak orchestration, failure classification, rollback decision packets, and operator runbook updates.

Task AD: Release Train, Disaster Recovery, And Enterprise Capacity Plan

Build release-train contracts for canary, promote, rollback, emergency stop, backup/restore proof, remote drift, Docker context size, resource budget, multi-service dependency health, and capacity planning for 1 TB Inspur plus future DB/search/graph services. Verify ops tests, deploy hygiene, remote proof scripts, and docs.

# Agent 10 Task AB Progress

- Added `realTimeSearchBoard` to cutover soak release packets with schema `ti.realtime_search.release_board.v1` and decisions `no-go`, `partial-public-ok`, `canary-ready`, `canary-with-warnings`, `promote-with-warnings`, `promote`, `rollback`, and `emergency-stop`.
- Aggregated gates for first response, 3-second polling, same-run reuse, cursor advancement, empty deltas, clear-web/public-channel/restricted/graph/claim-ledger deltas, contradiction downgrades, no-result/searching, provider/scraper unavailable, queue pressure, stale/low-confidence/policy-block states, no-leak output, memory budget, worker headroom, frontend no-default proof, public POST compatibility, and remote/container health.
- Covered APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE-2024-3094, malware/tool, victim/ransomware, country, and sector in the query matrix.
- Verified local typecheck, ops tests, API tests, full tests, route inventory, contract index, deploy hygiene, Docker contexts, remote drift, and live-search deploy proof.
- Remaining external proof: `TI_PUBLIC_PROOF_ACTORS=APT42,Turla,Akira,RandomActor,MadeUpActor,CVE-2024-3094 TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof` could not run because the escalation request was rejected by the app usage limiter. Retry this proof before marking Task AB complete or moving into Task AC.

# Prior Agent 10 Status

- Completed Task AA product-critical release board for responsive public TI search.
- Added `productTiBoard` to soak release packets with schema `ti.product_ti.release_board.v1` and decisions `no-go`, `partial-public-ok`, `canary-ready`, `canary-with-warnings`, `promote-with-warnings`, `promote`, `rollback`, and `emergency-stop`.
- Aggregated public proof slots for APT29, APT42, Turla, Akira, random actor, made-up actor, and CVE-2024-3094; frontend `/ti` empty/no-default proof; 3-second polling proof; scraper/container health; route truth audit; no-leak guarantees; memory 96 GB target/160 GB ceiling/500 GB reserve; queue pressure; Agent 03/06 status; and rollback commands.
- Kept policy-gated/restricted sources non-blocking for clear-web/public evidence and maps Agent 03/06 active-only blockers to `partial-public-ok`, not full promotion.
- Updated operations docs and public proof helper so the full Task AA query matrix is verified.
- Verified `bun run check`, `bun test`, `bun run check:route-inventory`, `bun run check:remote-drift`, `bun run check:deploy-hygiene`, `bun run check:docker-contexts`, `bun run rehearse:cutover examples/cutover-rehearsal-pass.json`, `bun run plan:cutover examples/cutover-rehearsal-pass.json`, `bun run check:live-search-deploy`, and escalated `TI_PUBLIC_PROOF_ACTORS=APT42,Turla,Akira,RandomActor,MadeUpActor,CVE-2024-3094 TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof`.
- Superseded by active Task AB above; do not request another assignment until Task AB proof is complete.
