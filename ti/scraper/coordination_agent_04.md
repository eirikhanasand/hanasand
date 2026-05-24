Status: active_value_program_public_signal_value_impact

# Agent 04 Coordination

- Added `publicSignalFusion.publicSignalValueImpact` to score whether source-atlas candidates and redacted dark-web index metadata materially improve public TI answers.
- Added readiness-lift projections, source-family gap closure, source-atlas impact rows, dark-web triage-only impact rows, and next best actions for Agent 01/03/05/06/07/08/09/10.
- Preserved safe boundaries: public-only answer promotion, dark-web metadata never promotes public answers, no raw unsafe URLs, no credentials, no dumps, no payload links, no private channels, no account automation, no bypass behavior, no default actor assumption, and no stale-cache promotion.
- Extended public-signal/API assertions and source-registry notes for the value-impact packet.
- Repaired parallel `/v1/contracts` no-leak sanitizer drift, dark-web frontend contract wiring, and STIX readiness example drift needed to keep the suite green.
- Verification passed: `bun run check`, `bun test src/tests/publicSignalFusion.test.ts src/tests/api.test.ts -t public`, `bun test src/tests/apiRegressionSentinel.test.ts src/tests/sdkFixtures.test.ts src/tests/apiGatewayIntegration.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` with 510 passing tests.

Continuing Agent 04 value-program ownership for useful-intelligence coverage scoring, query-class source gaps, and source/index answer-lift metrics. Requesting the next concrete Agent 04 task.
