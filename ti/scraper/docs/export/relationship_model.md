# Relationship And Export Model

Agent 08 owns the scraper exchange layer. The first implementation keeps this layer backend-neutral: it accepts `PipelineResult` values and emits graph contracts or STIX-like 2.1 bundles without depending on storage.

## Graph Contracts

- Nodes represent actors, aliases, campaigns, victims, sectors, countries/regions, malware/tools, ATT&CK attack patterns, indicators/infrastructure, vulnerabilities, incidents, sources, reports, captures, and sightings.
- Relationships are evidence-backed edges: `alias-of`, `attributed-to`, `targets`, `uses`, `indicates`, `exploits`, `communicates-with`, `derived-from`, `mentions`, `located-in`, `active-in`, `observed-in`, `sighted`, and `related-to`.
- Every relationship must include confidence, first/last seen timestamps, and extraction provenance.
- Edges without provenance are dropped by the relationship builder.
- Multi-entity edges such as actor-targets-victim, actor-uses-malware, actor-uses-TTP, and actor-exploits-CVE require provenance on both sides.
- Actor-result DTOs are produced by `buildActorResultDto`; Agent 09 can expose that DTO directly so API consumers do not need to understand graph internals.

## Relationship Confidence Rules

| Rule | Relationship | Weight | Notes |
| --- | --- | ---: | --- |
| `incident-mentions-entity` | incident `mentions` entity | 0.72 | Contextual mention only; useful for traceability but not strong attribution. |
| `indicator-indicates-incident` | indicator `indicates` incident | 0.90 | Combines indicator and incident confidence. |
| `incident-attributed-to-actor` | incident `attributed-to` actor | 0.86 | Conservative until corroborated by another source or analyst review. |
| `actor-targets-victim` | actor `targets` victim | 0.82 | Requires grounded actor and victim evidence. |
| `actor-uses-ttp` | actor `uses` ATT&CK/TTP | 0.78 | Kept lower because TTP extraction can be ambiguous in prose. |
| `actor-uses-malware` | actor `uses` malware | 0.88 | Stronger when explicit malware evidence is present. |
| `actor-exploits-cve` | actor `exploits` CVE | 0.84 | Requires actor and vulnerability evidence; stays below raw CVE confidence. |

Actor-result aggregation adds support-count, provenance-count, recency, stale/historical flags, and contested-attribution flags. Repeated support raises confidence modestly; contested attribution and stale context downgrade how items appear in ranked result sections.

## Actor Result Ranking

The actor result DTO ranks graph-backed relationships for pages such as an `APT29` result:

- `recent-activity`: actor-connected relationships sorted by `lastSeenAt`.
- `supported-target`: actor-target-victim edges sorted by support and confidence.
- `target-sector`: victim-sector edges for sector summaries.
- `target-region`: victim-country/region edges for geographic summaries.
- `confident-ttp`: actor-uses-ATT&CK/TTP edges.
- `malware-tooling`: actor-uses-malware/tool edges.
- `cve`: actor-exploits-CVE edges.
- `emerging-infrastructure`: indicator/infrastructure evidence sorted by recency.
- `stale-context`: relationships older than the configured stale threshold.
- `contested-claim`: relationships affected by conflicting attribution.

## Progressive Graph Updates

Live search can emit graph relationships before every source has been captured and extracted. These stages are deliberately explicit:

- `discovery`: low-confidence snippet or source-discovery evidence.
- `captured`: a capture exists, but extraction/review may still be partial.
- `extracted`: deterministic extractor output exists.
- `reviewed`: analyst or trusted review has accepted the extraction.
- `promoted`: relationship is ready for normal actor-result ranking and default exchange export.

`buildProgressiveGraphUpdate` merges staged evidence into graph relationships and emits polling deltas: `added`, `updated`, `downgraded`, `contradicted`, `stale`, and `promoted`. Confidence increases with stage and repeated provenance support, but contradictions and stale context lower operational usefulness.

For `/v1/intel/search`, callers should consume `relationshipDeltas`, the compact API-facing delta DTOs, instead of diffing full relationship arrays. Each DTO includes `relationshipId`, change `kind`, evidence `stage`, confidence before/after, source IDs, first/last seen timestamps, review requirements, review state, review reason, available review actions, STIX eligibility flags, endpoint refs, relationship type, and deterministic rank.

Delta ranking is intentionally operational rather than chronological: promoted relationships rank first, followed by contradictions, downgrades, additions, routine updates, and stale churn. Contradicted, downgraded, stale, discovery-only, and low-confidence relationships set `requiresAnalystReview` with review reasons for Agent 07/API summary text.

Discovery-only and unreviewed relationships are excluded from STIX export by default. Default progressive STIX export includes only relationships that are accepted by review or promoted by the graph stage. Callers must opt in with `includeUnreviewedDiscoveryContext` or the compatibility alias `includeDiscoveryEvidence` when they intentionally want discovery-stage context in exchange bundles.

Relationship-level STIX eligibility is exposed as `discoveryOnly`, `captureBacked`, `extracted`, `reviewed`, `promoted`, `accepted`, and `includedByDefault`. STIX relationship objects preserve the same flags under `x_ti_stix_eligibility`.

## Analyst Graph Review

Graph relationships carry review state through `reviewState`: `unreviewed`, `needs_review`, `accepted`, `rejected`, `superseded`, `contradicted`, or `expired`. `applyGraphReviewDecision` and `applyRelationshipReviewDecision` update relationships from audit-safe decisions that include reviewer ID, reason, timestamp, source IDs, evidence IDs, and optional supersession links.

Review decisions append immutable-style `reviewAudit` entries to relationship properties. Agent 06 should persist those audit entries append-only when graph review storage moves out of in-memory DTOs. Agent 07 caveats remain source-text warnings; Agent 08 review state is the graph-level enterprise CTI decision.

## Persisted Graph Views

`buildPersistedGraphSnapshot` converts an in-memory `RelationshipGraph` into storage-oriented contracts for Agent 06 and API-oriented query builders for Agent 09. The snapshot separates persisted nodes, persisted relationships, evidence support records, review audit, confidence history, temporal bounds, and export eligibility.

Query views are intentionally denormalized:

- `buildActorProfileGraphView`: actor node, aliases, neighborhood, ATT&CK matrix cells, and provenance panels.
- `buildVictimProfileGraphView`: victim node, targeting relationships, sector/region relationships, and provenance panels.
- `buildIncidentTimelineView`: relationship events sorted by last-seen time.
- `buildGraphNeighborhoodView`: bounded graph neighborhood with relationship review-state filters.
- `buildAttackMatrixView`: actor/TTP relationships grouped by ATT&CK tactic.
- `buildSourceProvenancePanel`: evidence support plus review audit for a relationship.
- `buildStixExportPreview`: relationship-level preview of what default STIX export includes or excludes.
- `buildRelationshipCursorDeltas`: cursor-visible relationship deltas for API polling.

Cursor relationship kinds are normalized for Agent 09: `actor-target`, `actor-ttp`, `actor-tool`, `actor-malware`, `victim-sector`, `victim-country`, `incident-source`, `indicator-infrastructure`, and `evidence-provenance`. The cursor DTO preserves before/after confidence, workflow state, review state, source/target labels, source IDs, evidence IDs, export eligibility, and a stable cursor.

Analyst workflow state is exposed in API language as `proposed`, `accepted`, `rejected`, `downgraded`, `superseded`, `stale`, `contradiction`, or `needs-human-review`. This maps over the persisted review states without forcing API consumers to know every storage detail.

`downgradeAndExpireStaleRelationships` is the contract for scheduled stale-fact maintenance. Stale relationships are downgraded into review; expired relationships receive an expiry audit entry and a low confidence ceiling so old graph facts do not remain authoritative forever.

## Graph Integrity Gates

`buildGraphIntegrityReport` checks persisted graph snapshots before UI panels or STIX exports consume them. It reports unsupported edges, weak discovery-only edges, contradicted edges, stale accepted edges, orphan relationships, missing provenance, missing evidence ledger IDs, restricted-only/source-biased support, unreviewed victim/CVE/TTP claims, and export schema risk.

`buildGraphReviewBatch` turns integrity findings into analyst work items with actions: accept, reject, downgrade, supersede, request evidence, or mark stale. These batches are API-ready for Agent 09 and should preserve Agent 07 quality note context without making extraction caveats the final graph state.

`checkStixExportReadiness` applies export-specific gates: discovery-only inclusion policy, minimum confidence, accepted-relationship requirements, contradictory/stale blockers, and complete evidence provenance. It should run before STIX/TAXII-style exchange export.

`buildGraphCutoverReport` is the compact rehearsal artifact for scraper-native search promotion. It combines graph integrity, STIX export readiness, review-batch state, STIX export preview, API readiness sections, and promotion blockers into one DTO. The report includes sections for actor profile, victim profile, incident timeline, ATT&CK matrix, graph neighborhood, provenance panel, and STIX export preview.

Promotion blockers use stable reason codes for Agent 09 and Agent 10: graph integrity finding codes plus `review_queue_open`, `no_export_ready_relationships`, `provenance_incomplete`, and `contradictory_or_stale_edges`. Review queues are capped by `maxReviewItems` while preserving deterministic ordering, so high-volume actor searches remain API-safe without hiding total queue counts.

`buildGraphReviewApplyPlan` converts graph review batches into dry-run apply plans. Supported actions are `accept_edge`, `reject_edge`, `downgrade_edge`, `supersede_edge`, `request_evidence`, `mark_stale`, `expire_edge`, `hold_edge`, and `block_export`. Each plan item includes preconditions, evidence IDs, confidence impact, export impact, audit notes, rollback notes, source, and safety classification: `automation_safe`, `human_approval_required`, `blocked`, or `rollback_only`.

Discovery-only weak relationships must remain `block_export` plans until stronger evidence and review preconditions pass. The apply-plan layer is intentionally non-mutating; graph changes still require explicit review decisions and audit persistence.

`buildGraphReviewPlanApiDto`, `buildGraphCutoverReportApiDto`, and `buildStixExportReadinessApiDto` are the compact API wrappers for `/v1/graph/review-plan`, `/v1/graph/cutover-report`, and `/v1/exports/stix`. They preserve the underlying plan/report/readiness contracts while making endpoint, status, blocker, preview, SLA, audit, and rollback fields explicit for Agent 09 response shapes and Agent 10 promotion gates.

`graphReviewApiExamples` freezes example payloads for accept, reject, downgrade, supersede, request evidence, mark stale, block export, and discovery-only manual-review-required. The discovery-only example is intentionally blocked and non-exportable so automation cannot turn weak discovery evidence into STIX-ready graph state without capture, extraction, and review support.

`handleGraphReviewPlanRoute`, `handleGraphCutoverReportRoute`, and `handleStixExportReadinessRoute` provide the mountable dry-run route-handler boundary for those DTOs. The handlers validate `relationshipId`, reject unsupported `selectedActions`, expose the frozen examples on request, and never apply review decisions, publish bundles, or mutate graph state.

`buildCorrelationGraphQuery` and `buildCorrelationTimeline` are the production query contracts for `/v1/graph/query` and `/v1/graph/timeline`. They expose actor-victim-malware-tool-CVE-TTP-source relationships with confidence, first/last seen timestamps, provenance IDs, source IDs, capture IDs, content hashes, evidence ledger IDs, evidence IDs, review state, workflow state, full export eligibility, relationship deltas, ATT&CK matrix cells, and provenance panels.

`buildGraphQueryApiContract` freezes the compact API contract sections consumed by the CTI frontend and Agent 09: actor, victim, campaign, TTP, malware/tool, CVE, infrastructure, sector, region, and source neighborhoods plus victim profile, incident timeline, ATT&CK matrix, relationship deltas, export readiness, and STIX preview. The contract also embeds the STIX 2.1 mapping contract so API documentation can show the same object, relationship, marking, external-reference, and `x_ti_*` provenance semantics as the exporter.

`CorrelationGraphQueryDto.neighborhoods` groups query results by production CTI facets. Each facet includes node types, node IDs, relationship IDs, maximum confidence, review states, freshness, export-ready counts, and export-hold counts. This lets actor pages show current-vs-historical TTP drift, CVE exploitation claims, infrastructure, sectors, regions, campaigns, sources, and ransomware victim neighborhoods without reading raw storage rows.

`CorrelationGraphQueryDto.relationships` now carries the enforcement state needed by query consumers directly on each edge: contradiction markers, source-family bias, evidence gap codes, answer caveats, provenance IDs, evidence ledger IDs, review state, confidence, time bounds, and export eligibility. `CorrelationGraphQueryDto.readinessFacets` summarizes actor profile, victim profile, campaign timeline, ATT&CK matrix, infrastructure pivots, source-family bias, evidence gaps, STIX bundle readiness, and TAXII collection metadata so `/v1/graph/query` can answer CTI panel readiness without re-deriving release-gate logic.

`GraphExportCertificationDto` is the release-candidate certification packet for graph query and STIX export. It freezes scenario fixtures for APT29, Scattered Spider, Akira, Turla, CVE exploitation, weak co-mentions, restricted-only evidence, missing ledger IDs, schema-risk exports, missing provenance, contradicted relationships, stale relationships, and analyst-reviewed promotion. The packet appears on graph runtime, `/v1/graph/query`, `/v1/graph/review-plan`, `/v1/exports/stix`, `/v1/intel/search.graph`, and the `/v1/contracts` index, and it includes proof routes, `noUnsupportedTaxiiServerClaims`, and `rcGate` with Agent 10 `graphStixReleaseCandidateGate` proof metadata plus descriptor-only TAXII boundaries.

`GraphLiveSearchUpdateDto` is the responsive live-search graph packet on `CorrelationGraphQueryDto.liveUpdate`, `GraphRuntimeApiDto.liveUpdate`, `/v1/intel/search.graph`, `/v1/graph/query`, and `/v1/exports/stix` runtime payloads. It freezes Task AA incremental scenarios for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, CVE exploitation, random actors, weak co-mentions, public-channel-only hints, restricted-held evidence, missing ledger IDs, stale/contradicted relationships, missing provenance, accepted promotion, and STIX export eligibility. It keeps `nextPollSeconds: 3`, `cursorField: "graph.deltas[].cursor"`, weak discovery as pivots/caveats only, public-channel-only hints held until corroborated or reviewed, restricted evidence as held context, STIX export limited to reviewed/promoted relationships, and TAXII descriptor-only.

`buildGraphReviewQueueSummary` is the shared review queue rollup for graph query, review-plan, STIX readiness, and `/v1/intel/search.graph` responses. It reports total queued relationships, export holds, human-review work, automation candidates, blocker-code counts, workflow-state counts, and top relationship IDs. Public `/ti` views should use `publicFactPolicy: "hold_weak_edges"` as the signal to keep graph claims out of fact panels until review/provenance gates pass.

These contracts can move from in-memory rows to Postgres graph tables, Neo4j, or another graph store without changing API consumers as long as the exported DTOs remain stable. Storage should preserve node IDs, relationship IDs, evidence support IDs, audit entries, confidence history, and cursor ordering semantics.

## ATT&CK Mapping

ATT&CK candidates are produced only from extracted TTP entities with provenance. Explicit IDs such as `T1566` are preserved but still flagged for analyst confirmation when the technique name is not known. Heuristic phrase mappings include review reasons when confidence is low.

Agent 07 extraction fixtures now include expected TTP hints and uncertainty labels. Agent 08 mapping should continue to consume only grounded `ttp` entities with provenance from the pipeline, not raw prose matches or unprovenanced fixture expectations.

## STIX 2.1 Export

The STIX export returns a `bundle` with identity, report, indicator, intrusion-set, malware/tool, vulnerability, attack-pattern, observed-data, and relationship objects as needed. Scraper-specific confidence/provenance fields use `x_ti_*` custom properties so downstream OpenCTI/MISP-style integrations can preserve why an object exists.

STIX-like bundles must pass `validateStixBundle` before being exposed to API/export consumers. Validation checks bundle/object IDs, STIX 2.1 version markers, relationship refs, indicator patterns, confidence bounds, report refs, and relationship provenance.

`STIX_21_GRAPH_MAPPING_CONTRACT` freezes mapping semantics for threat actors (`intrusion-set`), malware/ransomware/tools (`malware` with labels), ATT&CK techniques (`attack-pattern` plus MITRE external references), indicators, vulnerabilities, reports, STIX relationships, review-required markings, evidence external references, and custom provenance fields. `actor-vulnerability`, victim-sector, victim-country, actor-malware, actor-target, and actor-TTP edges are first-class graph query relationships.

`exportGraphSnapshotToStixBundle` is the cutover-safe graph exporter. It emits only readiness-passing evidence-backed graph relationships as STIX relationship facts, includes markings and external references, and records blocked weak, rejected, unsupported, contradicted, stale, discovery-only, or missing-provenance relationships under `x_ti_blocked_relationships` instead of flattening them into facts.

Graph drift detection now covers stale accepted edges, contradicted edges/source-family conflicts, missing provenance, weak discovery-only edges, explicit source-bias clusters, restricted-only claims, unsupported restricted-metadata relationships, unreviewed victim claims, unreviewed CVE exploitation claims, and unreviewed actor-to-TTP mappings. Source-bias, CVE, TTP, victim, and restricted-metadata findings are export holds by design: they should request corroborating evidence or a reviewed safe mapping before public/API fact promotion. `StixExportReadinessApiDto.reviewActions` exposes the dry-run analyst action slice for these holds so UI/API callers can show accept, reject, downgrade, expire, and hold actions without mutating the graph.

`GraphRuntimeApiDto` is the compact runtime contract shared by `/v1/intel/search.graph`, `/v1/graph/query`, and `/v1/exports/stix`. It carries relationship confidence, evidence ledger IDs, review state, freshness, export-ready status, export hold codes, `liveUpdate`, and the same review queue public fact policy used by answer fusion and STIX export readiness.

`GraphExportSlaDto` is the release-gate SLA view for `/v1/intel/search.graph`, `/v1/graph/query`, `/v1/graph/review-plan`, `/v1/exports/stix`, and Agent 10 release packets. It buckets export-ready, held, review-required, stale, contradicted, missing-provenance, restricted-only, weak co-mention, source-biased, unreviewed victim, unreviewed CVE, and unreviewed TTP relationships, and states public-answer/STIX impact plus the Agent 08 proof command.

`GraphExportEnforcementDto` is the compact promotion enforcement view for `/v1/intel/search.graph`, `/v1/graph/query`, `/v1/graph/review-plan`, `/v1/exports/stix`, and Agent 10 release packets. It turns integrity findings into pass, warning, hold, or rollback state, maps each finding to a dry-run analyst action, and exposes public-answer caveats plus release-gate decisions for public answers, STIX promotion, schema safety, and evidence-ledger completeness.

Promotion enforcement holds or rolls back missing ledger IDs, weak co-mentions, restricted-only evidence, unreviewed victim/CVE/TTP claims, stale or contradicted relationships, source-bias clusters, missing provenance, and export schema risk. Agent 07 answer fusion should read `answerCaveats` before promoting graph claims into public text, while Agent 10 release packets should preserve the enforcement proof alongside `graphExportSla`.

## TAXII Boundary

The project exposes only TAXII future-facing interfaces for now: collection descriptors, export page contracts, and a provider interface. A full TAXII server should not be built until API ownership and deployment boundaries are coordinated.

`buildTaxiiCollectionReadiness` emits a TAXII-facing collection descriptor for reviewed STIX 2.1 graph objects with read/write flags, media types, ready/blocked counts, and an opaque future cursor. This is metadata for Agent 09/10 planning only; it must not be treated as a deployed TAXII endpoint.
