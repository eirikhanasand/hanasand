Status: active_program_bh_deployed_product_slo_and_revenue_proof

# Agent 10 Current Assignment - Program BH: Deployed Product SLO And Revenue Proof

You are no longer waiting for a task. Read `coordination_product_focus.md` first. Your blocker is now concrete: local product SLO economics exist, but the public/Inspur scraper must expose them and daily snapshots must prove the paid product is improving.

Mission:
- Safely deploy or prepare a deploy-safe current scraper image/code path so `/v1/ops/product-slo` is available on the deployed stack.
- Capture daily/run-level economics for Apify Actor build `0.6.3` and later: usage, rows, useful rows, fresh rows, stale penalty, projected gross/net revenue, views/runs/users, payout blocker state, and conversion trend.
- Do not stop at dashboard fields; prove the public endpoint and snapshot command work.

Build:
- Add or update deploy proof commands and rollback notes for Inspur without stopping unrelated services.
- Add a daily product SLO snapshot artifact/command that can run unattended and compares against proof runs `dQzvWhNM2OHrBWVfo` and `rh6D0UInDD6x7GuuD`.
- Surface the current public blocker if deployment cannot happen cleanly, with exact files/services/commands needed.
- Keep resource budgets realistic: no GPU assumption, no unnecessary crawler surge, preserve CTI disk/RAM reserve.

Proof:
- `bun run check`
- focused ops/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- public or remote curl proof for `/v1/ops/product-slo` when deploy is safe
- full `bun test` if shared routes/contracts change

When your patch is coherent, update this file, commit, push, and leave no hanging files.

# Agent 10 Summary

- Added paid-product economics to `/v1/ops/product-slo`: cost per run, cost per row, cost per useful row, gross row revenue, Actor Start revenue, Apify margin, projected net after usage, useful-row rate, fresh-row rate, stale-row penalty, and default-watchlist run state.
- Added Apify marketplace blocker state for Actor views/runs/users, beneficiary verification, payout method readiness, and pricing effective date.
- Extended the product SLO snapshot collector env surface and output so daily snapshots include `paidProductEconomics`.
- Updated route inventory, API/ops tests, and operations docs for the paid SLO fields and thresholds.
- Preserved resource guardrails: no GPU assumption, 96 GB default target, 160 GB normal ceiling, and 500 GB CTI reserve.
- Verification is green: `bun run check`, `bun test src/tests/ops.test.ts src/tests/api.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` (527 pass).
- Remaining blocker: local route is ready, but public/Inspur deployed scraper still needs a safe current-image deploy before `/v1/ops/product-slo` can produce real deployed daily snapshots.

Ready for the next Agent 10 task.
