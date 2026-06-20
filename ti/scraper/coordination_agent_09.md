Status: active_program_ca_paid_traffic_conversion_and_listing_hardening

## Current Assignment - Program CA: Paid Traffic Conversion And Listing Hardening

You are not idle. Continue as the marketplace/API product owner, but stay tightly focused on buyer-visible conversion and real monetization proof.

Goal: make the Apify Actor easier to buy, easier to trust, and easier to measure with real paid traffic. Do not add generic API abstractions, readiness DTOs, or enterprise layers unless they directly change the Store listing, Actor input/output, dataset row usefulness, pricing proof, analytics proof, or payout readiness.

Deliverables:

1. Audit the live Actor product surface:
   - `apify/public-threat-actor-monitor/README.md`
   - `.actor/actor.json`
   - `.actor/input_schema.json`
   - launch checklist and sample input/output docs
   - Actor output schema in `src/main.ts`
   - API contracts that mirror the Store readiness surface
2. Remove placeholder, TODO, inflated, or internal-sounding text from buyer-visible docs. The copy should sound like a practical analyst tool, not a pitch deck or generated text.
3. Improve the default input and sample output for a paid buyer:
   - at least 20 default monitored groups remain supported;
   - show fresh public-intelligence monitoring fields clearly;
   - make `claims`, `victims`, `targeting`, `ttps/tools`, `freshness`, `confidence`, `provenance`, `contradictions`, `sourceCoverage`, `nextPivots`, and `noLeakProof` obvious;
   - keep raw leaked data, credentials, unsafe URLs, private content, payloads, and actor interaction out.
4. Add a compact “why pay for this result” field or equivalent buyer-facing value explanation to dataset rows if it can be done without bloating rows. It should explain the useful signal in one short phrase, such as “fresh actor mention with corroborated sector targeting” or “metadata-only leak-site victim claim with no raw data included.”
5. Add conversion measurement instructions that depend only on real Apify analytics/billing values:
   - Store views;
   - Actor starts;
   - unique users;
   - trial runs;
   - paid runs;
   - dataset rows;
   - failed runs;
   - refunds;
   - platform usage cost;
   - estimated creator revenue;
   - withdrawal readiness.
6. Add or update focused tests/smoke checks proving:
   - buyer-visible docs have no TODO/placeholder copy;
   - fake traction cannot pass as paid traction;
   - sample rows expose buyer value without unsafe content;
   - pricing/payout readiness remains blocked when external Apify proof is missing and becomes measurable only from real copied values.

Metric targets:

- Increase the number of buyer-visible fields that explain why a row is payworthy, without increasing unsafe output.
- Keep Actor smoke status at `ready_for_paid_traffic`.
- Keep dataset output compact enough for marketplace buyers to scan.
- Produce at least one proof command or checklist section that lets the operator copy real Apify analytics and immediately see conversion status.

Verification before you stop:

- `bun run check`
- `bun test src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`

Coordination rule: when the patch is coherent and green, commit and push it. Do not leave files dirty for other workers. If you are blocked by missing Apify console values, keep those fields externally blocked/null and write the exact manual field needed in this file.

# Agent 09 Coordination

- Completed Program BY Apify conversion telemetry loop.
- Snapshot command now echoes marketplace telemetry, conversion rates, payout readiness, pricing usage-cost proof, payout/revenue separation, next revenue action, fake-traction guards, and unknown Apify fields.
- Added proof that a fully populated real marketplace snapshot removes telemetry/payout unknowns and reaches `nextRevenueAction: "paid_traffic"` without inventing missing numbers.
- Tightened fake-traction guards across `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and Actor `OUTPUT`: local sample runs, owner proof runs, and synthetic proof rows cannot count as users, paid runs, revenue, refunds, or conversion.
- Added the compact Apify Console runbook to the Actor launch checklist with exact fields to copy and `bun run snapshot:product-slo` environment variables.
- Preserved external blockers when Apify analytics/billing values are missing: unknown values stay `null`/`unknown`, and payout/beneficiary/withdrawal readiness still require external verification.
- Also preserved the concurrent disabled-by-default actor dataset consumer audit repository boundary in the evidence cutover DTO; it remains fail-closed and verified by storage cutover tests.
- Verification completed: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:contract-index`, `bun run check:route-inventory`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun test src/tests/storageCutover.test.ts`, and full `bun test`.

Agent 09 is ready for the next marketplace/API product-surface task.
