Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Product-Critical Release Board For Responsive TI Search

Build the release board for corrected public TI behavior. Do not wait for another prompt. Decide whether scraper-native search is truly usable: arbitrary actor searches feel responsive, update without refresh, avoid default/demo content, show honest freshness, and keep policy-gated sources from blocking clear-web/public evidence. Aggregate Agent 01-09 Task AA gates with decisions `no-go`, `partial-public-ok`, `canary-ready`, `canary-with-warnings`, `promote-with-warnings`, `promote`, `rollback`, and `emergency-stop`. Include public API proof for APT29, APT42, Turla, Akira, random actor, made-up actor, and one CVE; frontend `/ti` empty/no-default proof; 3-second polling proof; scraper/container health; tests; route truth audit; no-leak guarantees; memory 96 GB target/160 GB ceiling/500 GB reserve; queue pressure; Agent 03/06 status; and rollback commands. Verify ops/API/full tests, typecheck, route inventory, deploy hygiene, Docker context checks, remote drift, cutover rehearsal/plan, live-search deploy proof, and Inspur public proof.

# Agent 10 Status

- Completed Task Z final RC board and go/no-go rollup.
- Added `rcBoard` to soak release packets with schema `ti.final_rc.board.v1` and decisions `no-go`, `canary-only`, `canary-ready`, `canary-with-warnings`, `promote-with-warnings`, `promote`, `rollback`, and `emergency-stop`.
- Aggregated Agent 01-09 readiness gates plus Agent 10 deployment proof, `rcGate`, `canaryExecution`, local/remote/public proof commands, rollback procedures, route truth audit, `/v1/contracts`, public POST API proof, frontend `/ti?q=` proof, Docker image test enforcement, remote drift, memory headroom, 500 GB CTI reserve, queue pressure, Agent 03 fail-closed status, and operator signoff fields.
- Preserved Agent 03 stale clear-web proof as fail-closed/no-go for full promotion and kept restricted safety blockers mapped to emergency-stop.
- Kept stray-root findings advisory-only with no deletion behavior.
- Fixed adjacent Agent 05 restricted metadata emergency-stop certification type drift so `bun run check` stays green.
- Updated operations docs for Task Z final RC board semantics.
- Verified `bun run check`, `bun test`, `bun run check:route-inventory`, `bun run check:remote-drift`, `bun run check:deploy-hygiene`, `bun run check:docker-contexts`, `bun run rehearse:cutover examples/cutover-rehearsal-pass.json`, `bun run plan:cutover examples/cutover-rehearsal-pass.json`, `bun run check:live-search-deploy`, and escalated `TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof`.

Superseded by active Task AA below; do not request another assignment until Task AA proof is complete.

## Main-Agent Task 2026-05-24 AA: Product-Critical Release Board For Responsive TI Search

Own the release board for the corrected public TI product behavior. The board must decide whether the scraper-native system is truly usable for real workloads: arbitrary actor searches should feel responsive, update without refresh, avoid default/demo content, show honest freshness, and keep policy-gated sources from blocking clear-web/public evidence.

Aggregate Agent 01-09 Task AA gates into one operator board with decisions `no-go`, `partial-public-ok`, `canary-ready`, `canary-with-warnings`, `promote-with-warnings`, `promote`, `rollback`, and `emergency-stop`. Include public API proof for APT29, APT42, Turla, Akira, random actor, made-up actor, and one CVE; frontend `/ti` proof for empty page/no default APT29; 3-second polling proof; scraper/container health; local/remote tests; route truth audit; no-leak guarantees; memory 96 GB target/160 GB ceiling/500 GB reserve; queue pressure; Agent 03/06 active status; and rollback commands. Verify ops/API/full tests, typecheck, route inventory, deploy hygiene, Docker context checks, remote drift, cutover rehearsal/plan, live-search deploy proof, and Inspur public proof.
