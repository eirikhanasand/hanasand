Status: active_product_focus_revenue_slo_and_deploy_blocker

## Main Agent Update - 2026-06-20 17:05 CEST

Apify monetization is now scheduled: `Result` rows at `$3 / 1,000`, `Actor Start` at `$0.00005`, effective July 4, 2026, platform usage included for users. Published Actor build `0.6.3`; proof run `dQzvWhNM2OHrBWVfo`, dataset `aP1dqnK7uEezn5jJv`, 15 rows, 3.1s, usage about `$0.00075`. Gross row revenue after effective date for that run shape would be about `$0.045`; net before other costs roughly `$0.036` after Apify's 20% margin.

Your SLO lane should now track paid-product economics: cost per run, cost per row, projected gross/net row revenue, useful-row rate, fresh-row rate, stale-row penalty, daily default-watchlist run status, Apify views/runs/users, and payout/beneficiary blocker state. Also keep the Inspur deploy blocker visible because stale backend data directly harms revenue. When your patch is coherent, run focused tests, commit, push, and leave no hanging files.

# Agent 10 Summary

Read `coordination_product_focus.md` first. Your current blocker is product-relevant: `/v1/ops/product-slo` is not deployed on Inspur/public. Continue only with deploy-proof, daily Actor run metrics, cost per useful row, and revenue/listing blockers. Do not expand generic ops dashboards.

- New live Actor baseline: run `rh6D0UInDD6x7GuuD`, dataset `dYbGGA37MRq7pU47O`, build `0.6.1`, 20 default groups, 98 rows, 48 actionable, 26 corroborated, 69 single-source, 3 unverified, 80 thin, zero safety failures, usage about `$0.0023`, wall time about 10 seconds. Product SLO should track this daily and show whether source expansion improves fresh/useful row rates.

- Checked for new Agent 10 work; no newer explicit assignment was present, so continued Program BG live product SLO proof.
- Collected public API proof for `POST /api/ti/search`: `APT29` returned `live_search`/`partial` with run `run_81a0064e039c8cbb`; `Volt Typhoon` returned `live_search`/`partial` with run `run_e71c4ff1c9c64619`, June 11 latest evidence, and queued collection tasks.
- Collected Inspur runtime proof from `hanasand_ti_scraper`: healthy container, RSS about 139 MB, heap about 60 MB, queue 158/500, browser workers 0, max RAM 96 GB, normal ceiling 160 GB, and 500 GB CTI reserve preserved.
- Confirmed production blocker: public and deployed Inspur scraper return 404 for `/v1/ops/product-slo`; deployed image `hanasand_ti_scraper:latest` is old and the host checkout is heavily dirty, so I did not redeploy or overwrite remote state.
- Repaired local verification drift by removing the duplicate darkweb index operations builder block and preserving representative source-atlas economics decisions after preview truncation.
- Verification is green locally: `bun run check`, `bun test src/tests/ops.test.ts src/tests/api.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` (526 pass).

Next: safely deploy the current scraper image/code to Inspur, then run `TI_PRODUCT_SLO_PROOF_MODE=inspur/public_live bun run snapshot:product-slo` to start real daily product SLO snapshots. Ready for a deploy-safe instruction or a new Agent 10 task.
