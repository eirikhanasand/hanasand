# Exchange Integration Compatibility

This document keeps downstream compatibility explicit without building OpenCTI, MISP, or TAXII integrations inside the scraper yet.

## Mapping Table

| Scraper contract | STIX 2.1 object | OpenCTI target | MISP target | Notes |
| --- | --- | --- | --- | --- |
| `actor` entity | `intrusion-set` | Intrusion-Set / Threat-Actor entity | Galaxy cluster or threat-actor tag | STIX intrusion-set better fits APT-style actor result pages; aliases are preserved. |
| `victim` entity | `identity` with `victim` label | Organization/Identity | Event object or organization attribute | Victim extraction remains reviewable when grammar-derived. |
| `sector` entity | `identity` with `sector` label | Sector/Identity or custom entity | Taxonomy tag or attribute | Relationship confidence and provenance do not map cleanly to a plain MISP tag. |
| `country` / region entity | `identity` with country/region label | Location/Identity or custom entity | Country tag or attribute | Temporal bounds and provenance chains may need MISP object relations. |
| `malware` / `ransomware_family` | `malware` | Malware/Ransomware entity | Malware galaxy cluster or attribute tag | Ransomware family label is retained. |
| `ttp` / ATT&CK candidate | `attack-pattern` | Attack-Pattern linked to MITRE ATT&CK | MITRE ATT&CK galaxy cluster | Only export grounded candidates with provenance. |
| `cve` entity or indicator | `vulnerability` | Vulnerability entity | Vulnerability attribute | CVE object may be referenced by `exploits` relationships. |
| IOC indicator | `indicator` | Indicator/Observable | Attribute | Pattern uses STIX pattern syntax; confidence is 0-100. |
| IOC observation | `observed-data` | Observable/Observed data | Attribute sighting or event object | MISP cannot represent all STIX observed-data semantics without custom objects. |
| incident candidate | `report` | Report/Incident-like container | Event | Report object refs connect exported CTI objects. |
| graph relationship | `relationship` | Relationship edge | Object relation or event correlation | Relationship provenance is mandatory. |
| actor result DTO | scraper DTO | API result page model | Not directly represented | Useful for `/ti` frontend/API; not an exchange format. |
| progressive graph delta | scraper DTO | Live update/polling model | Not directly represented | Use for `/v1/intel/search` polling; export only promoted/default-safe evidence. |

## OpenCTI Notes

- OpenCTI can ingest STIX bundles, so the scraper should keep STIX IDs stable for identical normalized values.
- `x_ti_provenance`, `x_ti_review_reasons`, and `x_ti_capture_id` should be preserved by an OpenCTI connector as custom properties or mapped into notes/markings.
- The scraper should not decide OpenCTI marking definitions yet; tenant/export policy should own markings.
- OpenCTI can represent most relationships directly, but confidence aggregation internals, stale flags, support counts, and contested attribution should be preserved as custom relationship properties.

## MISP Notes

- MISP import should start from the STIX bundle or a later MISP-specific transform, not from raw scraper internals.
- Incident candidates map naturally to MISP events; indicators map to attributes; ATT&CK/malware/actor labels map to galaxies or tags.
- Sensitive darknet metadata should remain metadata-only and should not become leaked-content attributes.
- MISP does not cleanly preserve full provenance chains, temporal ranges per relationship, or relationship confidence. A future MISP transform should include these as object comments, event tags, or custom object fields.
- Contested attribution should not become a flat actor tag without the contested flag and source evidence.

## Relationship Class Limitations

| Relationship class | OpenCTI fit | MISP fit | Limitation |
| --- | --- | --- | --- |
| actor `targets` victim | Direct relationship | Object relation/event context | Victim confidence may need custom fields. |
| victim `related-to` sector | Direct or custom relation | Tag/taxonomy | MISP tags lose per-edge provenance. |
| victim `located-in` country/region | Direct or custom relation | Country tag/object | Temporal bounds are not native to simple tags. |
| actor `uses` malware/tool | Direct relationship | Galaxy/object relation | Tool vs malware distinction may need labels. |
| actor `uses` ATT&CK technique | Direct relationship | ATT&CK galaxy | ATT&CK evidence snippets should remain attached. |
| actor `exploits` CVE | Direct relationship | Vulnerability attribute relation | Exploit claim confidence is separate from CVE validity. |
| indicator `indicates` incident | Indicator/report relation | Attribute/event relation | Indicator sighting vs analytic inference can blur in MISP. |
| contested `attributed-to` | Custom relationship properties | Event notes/tags | Do not flatten to confident attribution. |

## Persisted Graph View Export Notes

Persisted graph views are CTI app/API contracts, not exchange formats. OpenCTI can ingest the STIX bundle relationships and custom `x_ti_*` properties, but should not receive every local query view field. MISP should receive only exchange-safe STIX/MISP transforms, not the graph neighborhood DTOs directly.

Exported:

- Accepted or promoted relationships by default.
- Relationship confidence, temporal bounds, provenance, review state, and STIX eligibility custom properties.
- ATT&CK `attack-pattern`, actor `intrusion-set`, victim/sector/location `identity`, indicator, malware/tool, vulnerability, report, observed-data, and relationship objects.

Intentionally not exported by default:

- Unreviewed discovery-only graph churn.
- Rejected, superseded, or expired relationships.
- Internal confidence history, graph-neighborhood rankings, API panel layout, and source activation gaps.
- Raw restricted metadata or leaked material; only metadata-safe provenance and hashes are allowed.

`StixExportPreviewDto` is safe for API/UI review because it explains export eligibility without emitting a STIX bundle. Operators can use it before publishing to OpenCTI/MISP/TAXII-style destinations.

`StixExportReadinessReportDto` is the hard gate before exchange export. It blocks relationships when provenance is incomplete, confidence is below policy threshold, accepted review is required but missing, discovery-only evidence is excluded by policy, or the relationship is contradicted/stale. OpenCTI/MISP exports should consume only relationships that pass readiness or an explicitly reviewed override.

`GraphCutoverReportDto` is the cutover rehearsal bundle for scraper-native search. It combines integrity findings, export readiness, review queue state, graph view section readiness, STIX preview counts, and promotion blockers. Agent 09 can expose it as a single readiness response; Agent 10 can consume `promotionBlockers` directly for deployment gates.

`GraphReviewApplyPlanDto` is a dry-run-only boundary for turning quality/review recommendations into explicit graph actions. It should be exposed as a preview before mutation: action, safety, preconditions, expected confidence/export impact, evidence IDs, audit notes, and rollback notes. Weak discovery-only relationships must remain blocked from export automation until capture/extraction/review evidence satisfies the graph gates.

`GraphReviewPlanApiDto`, `GraphCutoverReportApiDto`, and `StixExportReadinessApiDto` freeze the compact endpoint-facing shapes for `/v1/graph/review-plan`, `/v1/graph/cutover-report`, and `/v1/exports/stix`. They are wrappers around the Agent 08-owned contracts, not alternate mutation semantics. `graphReviewApiExamples` provides stable example bodies for all graph review actions plus discovery-only manual-review-required so Agent 09 can document responses and Agent 10 can read promotion blockers without inferring from raw graph rows.

The Task N route helpers are dry-run GET boundaries. Agent 09 can mount `/v1/graph/review-plan`, `/v1/graph/cutover-report`, and GET `/v1/exports/stix` for readiness while keeping POST `/v1/exports/stix` as the bundle export path. Invalid relationship IDs return `relationship_not_found`; `dryRun=false` is rejected; weak discovery-only relationships remain blocked from default STIX readiness.

Mounted proof for Agent 09/10 is `bun run check:graph-review-mounted`. It starts the Bun API server, checks accepted and rejected edge readiness, frozen discovery-only manual-review and block-export examples, invalid relationship IDs, no-export-ready cutover blockers, and confirms GET `/v1/exports/stix` readiness does not publish a bundle.

Production graph query routes are `/v1/graph/query` and `/v1/graph/timeline`. They return correlation views rather than raw storage rows: typed nodes, actor/victim/tool/malware/CVE/TTP/source relationships, review/workflow state, provenance IDs, source IDs, capture IDs, content hashes, evidence ledger IDs, evidence IDs, full export eligibility, export readiness, ATT&CK matrix cells, deltas, and timeline events.

`buildGraphQueryApiContract` is the compact contract descriptor for Agent 09 and the frontend. It names actor, victim, campaign, TTP, malware/tool, CVE, infrastructure, sector, region, and source neighborhood sections plus victim profile, incident timeline, ATT&CK matrix, relationship delta, export readiness, and STIX preview sections, and it embeds `STIX_21_GRAPH_MAPPING_CONTRACT` so route documentation and STIX export use the same object and relationship semantics.

Graph query edges also expose queryable enforcement state directly: `contradiction`, `sourceFamilyBias`, `evidenceGapCodes`, and `answerCaveats`. `readinessFacets` groups those edge-level signals into actor profile, victim profile, campaign timeline, ATT&CK matrix, infrastructure pivots, source-family bias, evidence gaps, STIX bundle, and TAXII collection metadata readiness. API and frontend code should read these fields instead of reverse-engineering release gates from integrity findings.

`GraphExportCertificationDto` is the compact certification contract for release-candidate graph/export proof. It is shared by `/v1/graph/query`, graph runtime, `/v1/graph/review-plan`, `/v1/exports/stix`, `/v1/intel/search.graph`, `/v1/contracts`, and Agent 10 release packets. The frozen scenario names are `apt29_actor_profile`, `scattered_spider_actor_profile`, `akira_victim_profile`, `turla_actor_profile`, `cve_exploitation`, `weak_co_mention`, `restricted_only_evidence`, `missing_ledger_id`, `schema_risk_export`, `missing_provenance`, `contradicted_relationship`, `stale_relationship`, and `analyst_reviewed_promotion`. The packet also includes `rcGate`, a final `graph_stix_release_candidate` decision with pass/hold/rollback state, required/covered/missing scenario lists, Agent 10 `graphStixReleaseCandidateGate` proof metadata, and `taxiiBoundary: "descriptor_only_no_server"` so integrations do not infer a mounted TAXII service.

For exchange cutover, use `exportGraphSnapshotToStixBundle` when exporting reviewed graph state. It exports readiness-passing relationships as STIX 2.1-compatible facts and preserves blocked relationships as custom review metadata so rejected, weak discovery-only, contradictory, stale, missing-provenance, or unsupported edges do not become downstream CTI facts.

Graph review queue summaries appear on `/v1/graph/review-plan`, `/v1/graph/query`, `/v1/exports/stix`, and `/v1/intel/search.graph`. The summary is the frontend/API gate for graph drift: stale actor/TTP claims, victim timeline drift, CVE relationship downgrades, ransomware victim weak claims, source-bias clusters, restricted-only claims, unreviewed victim claims, and unsupported restricted metadata should remain public fact holds while the queue reports `publicFactPolicy: "hold_weak_edges"`.

`/v1/intel/search.graph`, `/v1/graph/query`, and `/v1/exports/stix` also expose a compact `runtime` block. API/frontends should use this block for release-gate checks because it normalizes relationship confidence, ledger IDs, review state, freshness, export holds, `exportSla`, and `publicFactPolicy` across public answer facts and STIX export readiness.

`GraphExportSlaDto` appears on graph runtime DTOs, `/v1/graph/review-plan`, `/v1/exports/stix`, and Agent 10 release proofs. The buckets are stable for dashboards and release gates: export-ready, held, review-required, stale, contradicted, missing provenance, restricted-only, weak co-mention, source-biased, unreviewed victim, unreviewed CVE, and unreviewed TTP.

`GraphExportEnforcementDto` appears beside `exportSla` on graph runtime DTOs, `/v1/graph/review-plan`, `/v1/exports/stix`, and Agent 10 release proofs. It is the operator-facing enforcement contract for pass, warning, hold, and rollback state, including dry-run actions, public-answer caveats, STIX effects, schema safety, and evidence-ledger completeness. Missing ledger IDs, export schema risk, missing provenance, contradictions, restricted-only support, source bias, weak co-mentions, stale relationships, and unreviewed victim/CVE/TTP claims should be read from this DTO instead of re-derived by API or release code.

`/v1/exports/stix` readiness includes `reviewActions`, a capped dry-run set of graph review actions derived from the same review queue. These are UI/operator instructions only; they do not apply review decisions or publish STIX relationships. The frozen action vocabulary includes accept, reject, downgrade, supersede, request evidence, mark stale, expire, hold, and block export previews.

`/v1/exports/stix` readiness also exposes `taxiiCollections`, a descriptor-only future TAXII collection contract for reviewed STIX 2.1 graph objects. It carries media type, read/write flags, ready/blocked counts, and an opaque future cursor, but it does not imply that a TAXII server is mounted.

Certification packets must keep `noUnsupportedTaxiiServerClaims: true`; TAXII remains descriptor-only until a coordinated server implementation is approved.

## TAXII Future Plan

Do not build a full TAXII server until Agent 09/API ownership and deployment boundaries are coordinated. The intended shape is:

| Endpoint shape | Purpose | Boundary |
| --- | --- | --- |
| `GET /taxii2/` | Discovery document | Authenticated at gateway/API layer. |
| `GET /taxii2/:apiRoot/collections/` | List export collections | Backed by `TaxiiCollectionDescriptor`. |
| `GET /taxii2/:apiRoot/collections/:collectionId/objects/` | Return STIX object pages | Supports `added_after`, `limit`, and opaque `next` pagination. |
| `POST /taxii2/:apiRoot/collections/:collectionId/objects/` | Future ingest/write path | Disabled until governance approves write semantics. |

Bundle IDs should remain deterministic per producer, generated timestamp, and capture/run scope. Pagination tokens should be opaque, tenant-scoped, and short-lived. TAXII auth should be enforced before the scraper receives the request; the scraper should consume trusted tenant/actor context.

## Coordination Notes

- Agent 07: ATT&CK mapping consumes only `ttp` entities with extraction provenance. Broader NLP claims should stay as review reasons until Agent 07 marks them grounded.
- Agent 09: export endpoints should call `exportPipelineResultToStixBundle` and `validateStixBundle` before returning bundles. Actor result endpoints can return `ActorResultDto` from `buildActorResultDto` for frontend result pages, while STIX remains the exchange format and TAXII remains a future boundary.
- Agent 09: progressive search endpoints can return `ProgressiveGraphDto.relationshipDeltas` from `buildProgressiveGraphUpdate`. The DTO name is `RelationshipDeltaDto` and is intended for `/v1/intel/search` polling clients; use its rank, review state, review reason, action availability, review reasons, and STIX eligibility flags rather than diffing graph arrays.
- Agent 09: graph query routes can expose `GraphNeighborhoodViewDto`, `ActorProfileGraphViewDto`, `VictimProfileGraphViewDto`, `IncidentTimelineViewDto`, `AttackMatrixCellDto`, and `SourceProvenancePanelDto` without leaking storage internals. Suggested routes: `/v1/graph/neighborhood`, `/v1/graph/actors/:id`, `/v1/graph/victims/:id`, `/v1/graph/incidents/timeline`, `/v1/graph/attack-matrix`, and `/v1/graph/relationships/:id/provenance`.
- Agent 09: cursor polling can expose `GraphCursorRelationshipDeltaDto` for actor-target, actor-ttp, actor-tool, actor-malware, actor-vulnerability, victim-sector, victim-country, incident-source, indicator-infrastructure, and evidence-provenance links. `StixExportPreviewDto` can back a non-mutating export-preview endpoint.
- Agent 09: export/search views should call `buildGraphIntegrityReport`, `buildGraphReviewBatch`, and `checkStixExportReadiness` before surfacing relationships as ready. Review batch actions map to accept, reject, downgrade, supersede, request evidence, or mark stale.
- Agent 09: cutover readiness can call `buildGraphCutoverReport` to expose actor/victim/timeline/ATT&CK/neighborhood/provenance/STIX-preview section readiness plus compact review queues. Use `counts.reviewQueue` for total unresolved work even when `reviewBatch.items` is capped.
- Agent 09: apply endpoints should call `buildGraphReviewApplyPlan` first and return dry-run plan items before accepting any graph review mutation. Automation may execute only `automation_safe` items; `human_approval_required` and `blocked` items must not be auto-applied.
- Agent 09: API-facing graph review endpoints should prefer `buildGraphReviewPlanApiDto`, `buildGraphCutoverReportApiDto`, and `buildStixExportReadinessApiDto` so endpoint names, statuses, blockers, previews, audit notes, and rollback notes remain stable across the UI and export API.
- Agent 09: route mounting can use `handleGraphReviewPlanRoute`, `handleGraphCutoverReportRoute`, and `handleStixExportReadinessRoute`; pass a materialized `PersistedGraphSnapshot` and treat returned bodies as final response contracts.
- Agent 09: `/v1/graph/query` and `/v1/graph/timeline` can expose `CorrelationGraphQueryDto`, `CorrelationTimelineDto`, and `buildGraphQueryApiContract` directly for actor profile graph, victim timeline, TTP matrix, relationship delta panels, production neighborhood facets, export readiness, review queue summaries, and STIX preview panels.
- Agent 09: `/v1/intel/search` should preserve the `graph.endpoint === "/v1/intel/search.graph"` review queue summary so the public wrapper can hold weak graph facts without calling internal graph storage routes.
- Agent 06: provenance chains should keep capture IDs stable so graph aggregation can dedupe support and preserve first/last seen bounds.
- Agent 06: graph persistence should store `PersistedGraphSnapshot` components with append-only `GraphReviewAuditEntry`, `GraphEvidenceSupportRecord`, and `GraphConfidenceHistoryEntry` semantics; Agent 08 DTO helpers only define and populate the contract. Evidence integrity failures should map to `missing_provenance` or `orphan_relationship` findings. The rows can later move to Neo4j or graph tables if stable IDs, cursor ordering, and DTO field names are preserved.
- Agent 07: discovery-stage snippets should not be treated as grounded extraction until a capture/extraction/review stage promotes the relationship. Summary text generated from live deltas should use `RelationshipDeltaDto.reviewReasons`, while Agent 08 graph deltas remain authoritative for relationship IDs, confidence before/after, review state, and export eligibility. Agent 07 quality notes such as alias collision, stale source, weak victim claim, and source family bias should feed graph integrity/review batches as context.
- Agent 07: `buildSearchQualityApplyPlan` recommendations are input signals only. Agent 08 `GraphReviewApplyPlanDto` owns the graph action boundary, export impact, audit notes, and rollback notes.
- Agent 10: promotion gates can count accepted/exportable relationships, downgraded/stale relationship deltas, and contradiction/needs-human-review volume from graph cursor DTOs without inspecting raw evidence. Prefer `GraphCutoverReportDto.promotionBlockers` for go/no-go decisions.
- Agent 10: promotion packets should consume `GraphCutoverReportApiDto.promotionBlockers`, `StixExportReadinessApiDto.exportSla`, `StixExportReadinessApiDto.enforcement`, and runtime proofs `graphExportSla` plus `graphExportEnforcement`; discovery-only manual-review-required examples are blocked by design and should never count as export-ready automation evidence.
