Status: active_program_bo_buyer_visible_graph_lift_batch_2

# Agent 08 Coordination

Read `coordination_product_focus.md` first. Continue the graph ownership lane only where it improves buyer-visible Actor/public rows. STIX/TAXII work is secondary until the Apify product has stronger fresh data, better sample rows, and clearer conversion proof.

## Current Assignment - Program BO

Goal: turn graph/context work into direct paid-row improvement for Apify and `/ti`, using the live proof run `OThlfd0uzSCNnedAO` as the new baseline: 10 APT42 rows, 4 sellable, 2 caveated, 4 held, average buyer value 0.577.

Work in this order:

1. Identify which held/caveated rows could become sellable only if graph evidence adds useful corroboration, contradiction handling, freshness, actor/target/TTP pivots, or no-leak provenance.
2. Add compact graph-derived fields only when they improve current dataset rows, public UI rows, or product SLO metrics. Avoid speculative STIX/TAXII implementation.
3. Build before/after proof examples that move at least one row from `hold` or `included_with_caveat` toward a higher buyer-value decision without weakening source/evidence gates.
4. Add tests that reject graph-only promotion when evidence is stale, single-source, contradicted, restricted-only, missing ledger proof, or unrelated to the searched actor.
5. Update Apify/public documentation only where buyers see a clearer row or stronger trust signal.

Do not mark ready until the patch has measurable buyer-visible lift or a documented blocker owned by Agent 01/03/04/06/07/09.

## Continuation Directive

Continue the graph/STIX/TAXII ownership lane beyond a single prompt. When one program is complete, summarize it briefly here and move to the next Agent 08 program in `coordination_program_backlog.md` unless the lane is genuinely blocked.

Keep all graph relationships replayable to evidence, claim ledger state, review state, confidence, freshness, and export eligibility. Weak discovery, restricted metadata, stale, contradicted, missing-ledger, public-channel-only, and budget-bounded edges remain held until reviewed and provenance-backed.

## Completed

- Completed Task AE: production graph investigation workspace and relationship confidence ledger.
- Added `graph.investigationWorkspace` with node groups, relationship confidence ledger rows, evidence/ledger/capture/source provenance IDs, contradiction/stale/review-hold/export blocker state, allowed analyst actions, 3-second cursor polling, metadata-only restricted handling, and TAXII descriptor-only boundaries.
- Completed Program BA graph backend, relationship semantics, STIX/TAXII export, and investigation workspace hardening.
- Added graph backend migration certification, ATT&CK campaign freshness SLOs, Neo4j migration adapter benchmark, graph delta client contract, query cost controls, drift monitor, review persistence, and reviewed export subset governance.
- Completed Program BB Neo4j/Postgres graph backend adapter contract.
- Added route-visible `runtime.backendAdapterCutover` / `GraphBackendAdapterCutoverContractDto` with Postgres as the primary graph backend, Neo4j as contract-only/no-live-driver, backend-neutral operation mappings, migration proof, cursor replay, review-hold parity, performance SLOs, fallback behavior, no-leak guarantees, and Agent 06/07/09/10 handoffs.
- Updated `docs/export/relationship_model.md` with the Program BB adapter-cutover boundary.
- Completed Program BC ATT&CK Campaign Freshness SLOs.
- Added deprecated/revoked ATT&CK technique lifecycle tracking, alias drift state, contradiction state, export eligibility decisions, summary counts, and held export blockers to `GraphAttackCampaignFreshnessSloDto`.
- Kept proof green: `bun run check`, full `bun test`, focused graph/API/source tests, `bun run check:graph-review-mounted`, `bun run check:ti-release-candidate`, `bun run check:route-inventory`, and `bun run check:contract-index`.
- Completed Program BD TAXII Descriptor And STIX Bundle Governance.
- Added `GraphTaxiiDescriptorStixBundleGovernanceDto` across graph runtime, investigation workspace, and STIX readiness with reviewed STIX subset governance, descriptor-only TAXII collection planning, future `TaxiiExportProvider` request/page contract, no mounted server routes, no server claim, and no-leak metadata-only safety.
- Repaired adjacent cross-agent green-build drift in darkweb index contract helpers, source-atlas duplicate handoff helpers, public coverage freshness helper naming, and restricted emergency-stop soak decision semantics.
- Updated `docs/export/relationship_model.md` with the Program BD TAXII/STIX governance boundary.
- Completed Program BE Graph/STIX Release Candidate Gate Visibility.
- Added first-class `releaseCandidate` fields across graph runtime, investigation workspace, and STIX readiness so promote/hold/rollback state, scenario coverage, Agent 10 proof commands, public API impact, STIX impact, and descriptor-only TAXII boundaries are inspectable directly from query/export surfaces.
- Updated `docs/export/relationship_model.md` with the Program BE release-candidate visibility boundary.
- Completed Program BF Incident Claim Graph And Corroboration Semantics.
- Added `GraphIncidentClaimWorkspaceDto` on graph query and investigation workspace DTOs with canonical incident/claim clusters, actor/victim/campaign/sector/country/malware/TTP/source/report relationship IDs, first/last reported timestamps, publisher/source-family counts, corroborating/contradicting evidence IDs, ledger IDs, confidence, freshness, review/export state, conservative merge/split semantics, reviewed STIX subset eligibility/holds, and no-leak metadata-only boundaries.
- Added fixtures for APT29, Volt Typhoon, LockBit, ambiguous alias attribution, same-day distinct incidents, old campaign reuse, and contradicted victim claims.
- Updated `docs/export/relationship_model.md`; verification is green for `bun run check`, focused graph/source/ops tests, and full `bun test` (519 pass).
- Completed Program BG Graph-Backed Actor Timelines And Campaign-Change Detection.
- Added `GraphActorTimelineChangeWorkspaceDto` across graph query, investigation workspace, runtime graph API, and STIX readiness so actor timelines and campaign-change rows are query-visible.
- Added relationship/evidence/ledger/capture/source provenance, confidence trend, freshness, contradiction state, review/export state, public fact state, reviewed STIX subset holds, and no-leak metadata-only boundaries for timeline events.
- Added fixtures for APT29 timeline drift, Volt-style infrastructure/LOLBIN/tooling/CVE changes, ransomware victim churn, alias splits, stale campaign reuse, contradicted campaign membership, and no-evidence random actor searches.
- Repaired adjacent source activation/API readiness drift needed to keep the shared build green.
- Verification is green for `bun run check`, focused graph/source tests, and full `bun test` (521 pass).
- Completed Program BH Graph Export Product Packaging.
- Added `GraphActorProductPacketDto` across graph query, investigation workspace, runtime graph API, and STIX readiness so `/ti`, Apify rows, and future export integrations receive the same actor product packet.
- Added actor timeline summary, campaign-change summary, incident claim summary, victim/targeting pattern summary, TTP/source corroboration, contradiction state, reviewed export readiness, STIX object-type readiness, public copy hints, Apify summary fields, and unknown-actor/searching-safe handling.
- Preserved descriptor-only TAXII semantics and no-leak metadata-only output with explicit exclusions for raw URLs, leaked content, credentials/payload evidence, private-channel material, actor interaction, unsafe dark-web details, and unrelated actor facts.
- Verification is green for `bun run check`, focused Program BH graph/API/source tests, route inventory, contract index, API regression, and full `bun test`.
- Completed Program BI Reviewed STIX Bundle Examples And TAXII Descriptor Marketplace Readiness.
- Added `GraphStixTaxiiMarketplaceReadinessDto` across graph query, investigation workspace, runtime graph API, and STIX readiness.
- Added reviewed STIX bundle examples for Apify sample rows, `/ti` previews, and enterprise STIX previews, keeping held/stale/contradicted/weak/restricted/public-channel-only/missing-ledger/unreviewed rows out of authoritative examples.
- Added descriptor-only TAXII collection and pricing readiness for `ti-graph-reviewed-stix-21` with free sample, analyst, and enterprise tiers, explicit `serverImplemented: false`, no mounted TAXII server claim, and no object-key exposure.
- Updated `docs/export/relationship_model.md` with the Program BI marketplace/STIX/TAXII boundary.
- Verification is green for `bun run check`, `bun test src/tests/graphViews.test.ts src/tests/api.test.ts src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (526 pass).
- Completed Program BJ STIX/TAXII Monetization And Export Contracts.
- Added `GraphStixTaxiiMonetizationExportContractsDto` across graph query, investigation workspace, runtime graph API, and STIX readiness with free sample, analyst, and enterprise tier contracts.
- Added STIX object eligibility matrices for `intrusion-set`, `campaign`, `malware`, `tool`, `attack-pattern`, `identity`, `relationship`, `sighting`, `indicator`, and `report`; normalized buyer-safe export blockers for weak evidence, stale activity, contradiction, restricted metadata-only, public-channel-only, missing ledger, missing analyst review, unsafe source, tenant policy hold, and TAXII server not implemented.
- Added Apify compact fields for `stixReady`, `taxiiDescriptorReady`, `exportTier`, `exportBlockers`, and `reviewedObjectTypes` while preserving descriptor-only TAXII and no-leak metadata-only output.
- Completed Program BK graph-backed actor comparison and buyer-ready investigation notebooks.
- Added `GraphActorComparisonNotebookDto` across graph query, investigation workspace, runtime graph API, and STIX readiness with actor comparison rows, shared pivots, notebook contracts for Apify listing samples, public `/ti` investigations, and enterprise export review, plus buyer readiness fields.
- Repaired source-atlas display row selection so required decision rows such as `retire_duplicate` remain visible in route/API proof without mutating source activation semantics.
- Updated `docs/export/relationship_model.md` with Program BJ/BK export-contract and notebook boundaries.
- Verification is green for `bun run check`, `bun test src/tests/graphViews.test.ts src/tests/api.test.ts src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (526 pass).
- Completed Program BL actor row relationship insights for marketplace datasets.
- Added compact Apify/public row fields for relationship summaries, actor-to-victim/sector/country/TTP/campaign/source-family pivots, why-actionable bullets, freshness/confidence deltas, contradiction hints, corroboration state, and graph-backed next search pivots.
- Updated the Apify dataset schema, publication gate, smoke gate, README, and changelog so buyer-visible rows must expose the new relationship insight contract.
- Repaired adjacent green-build/runtime drift in Product SLO helpers, API boolean query parsing, source-atlas ladder helpers, and Program BD quality evaluation rounding.
- Verification is green for `bun run check`, full `bun test` (527 pass), Apify publication/smoke/check scripts, focused API/source tests, route inventory, contract index, and API regression.
- Completed Program BN graph quality lift for paid rows.
- Added per-row Apify fields for `graphQualityLift`, `graphQualityLiftReasonCodes`, and `graphQualityLiftEvidence` so paid rows expose relationship readiness, corroboration, contradiction holds, freshness lift, export-review eligibility, and no-leak state beside the paid-row decision.
- Added dry-run `OUTPUT.qualityLiftGate` accepted/rejected repair examples with sellable/fresh/useful row lift, stale suppression, cost-per-useful-row delta, projected row revenue delta, and owner handoffs.
- Promoted fresh/recent multi-source public profile/target/TTP rows to sellable while preserving source-family gap caveats and routing graph explainability preservation to Agent 08.
- Updated the Apify dataset schema, README, changelog, and smoke gate for graph-lift visibility.
- Verification is green for `bun run check`, focused Apify/API/source/scheduler/storage/darkweb tests, route inventory, contract index, API regression, Apify check/smoke/publication, and full `bun test` (527 pass).

## Active Next Work

- Completed Program BM graph-backed tier-quality scoring for the source/dark-metadata ladder.
- Added `paidSourceTierPlan.graphRelationshipQuality` with relationship-ready source counts/rates, actor pivot rows, source-family diversity, freshness/corroboration metrics, contradiction/no-leak readiness, advancement criteria, and export-safe/no-raw boundaries.
- Added source-atlas proof coverage for candidate-1000 ranked rows, parser repair execution, activation readiness, and graph relationship quality checks.
- Repaired adjacent green-build drift in product SLO source monetization gates and public-channel scheduler work-class typing.
- Verification is green for `bun run check`, focused source/API/ops/scheduler tests, route inventory, contract index, API regression, and full `bun test` (527 pass).
- Agent 08 requests the next buyer-visible graph task from the master queue.
