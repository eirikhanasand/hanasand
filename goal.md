# Hanasand Thesis Product Goal

## Completion Condition

Build Hanasand into an excellent, submission-ready implementation of the master's thesis product **APT Monitoring with Public Intelligence**.

Remove this file only when all product engineering described below is implemented end to end, production behavior is reliable, every thesis requirement maps to working software, and nothing remains except writing and presenting the thesis itself.

Completion means:

- The collection, processing, storage, API, analyst workflow, public interface, measurement, and operations paths all meet the same high standard.
- Every material claim in the API and UI is traceable to durable source evidence and communicates confidence, freshness, provenance, and review state honestly.
- Selected RSS/blog, Telegram, and metadata-only dark-web sources work end to end within legal and ethical boundaries.
- Accuracy, timeliness, coverage, and source reliability are measurable from production data rather than inferred from feature count.
- Business-model, publicity, profitability, and buyer-communication analysis is supported by structured collected data.
- Stolen data is never redistributed, secrets and sensitive source material are handled responsibly, and legal/institutional constraints are enforced in the implementation.
- No demo, placeholder, synthetic, or stale data is presented as current verified intelligence.
- The existing landing-page UI remains intact. Do not delete UI or make a significant landing-page redesign while completing this goal.

## Working Standard

- Prioritize implementation quality and real product behavior over reports, screenshots, proof scaffolding, or bloated test suites.
- Add the smallest meaningful automated check for non-trivial behavior, with broader tests only where risk justifies them.
- Do not chase feature count. Strengthen the data and evidence spine first, then raise every product surface to the same standard.
- Reuse existing architecture and dependencies where they are sound. Keep threat-intelligence storage structurally isolated from unrelated application data.
- Treat generic regex and keyword extraction as fallback behavior, not the final characterization strategy.
- Do not imply certainty beyond available evidence. Clearly distinguish extracted, inferred, corroborated, analyst-reviewed, contradicted, stale, and unverified information.
- Do not remove handmade UI merely because code behind it is currently weak; replace weak behavior behind the existing product experience.

## Thesis Scope

### Title

APT Monitoring with Public Intelligence

### Research Question

How can automated OSINT pipelines be used to monitor and characterize APT activity in real time?

### Product Goal

Design and evaluate an automated system that monitors APT and comparable structured threat-actor activity using public intelligence. It must collect, process, correlate, and structure data from selected long-lived public sources and expose timely, accurate, understandable intelligence to technical and non-technical users through an accessible interface and JSON API.

The initial feasibility set must include at least one working feed of each selected source type, with further expansion prioritizing dark-web sources as time and legal access permit. Ransomware collectives may be included where their operations and public communication resemble APT activity.

## Required Product Capabilities

### Analysis Objectives

- [ ] Capture enough structured evidence to analyze threat-actor business models.
- [ ] Capture publicity tactics and signals that support analysis of how publicity contributes to profitability.
- [ ] Capture observable communication between threat actors, buyers, victims, and intermediaries without redistributing harmful material.

### Collection and Tracking

- [ ] Operate an automated end-to-end collection pipeline continuously and recover safely from restarts and source failures.
- [x] Collect from a defensible selected subset of RSS/news/blog sources.
- [x] Collect from at least one long-lived public Telegram source through a compliant, reliable path.
- [x] Collect metadata from at least one dark-web source through an explicitly bounded, metadata-only path.
- [x] Preserve immutable captures, source publication time, collection time, processing time, first-visible time, and alert-delivery time.
- [x] Track collection runs, source health, parser outcomes, failures, freshness, useful-item yield, source family, actors observed, and legal/ethical operating mode.
- [x] Deduplicate repeated material without losing capture lineage or changes over time.

### Processing and Characterization

- [ ] Extract actors, aliases, victims, impacts, datasets/leak types, indicators, incidents, and TTPs with source-specific parsers for priority feeds.
- [x] Retain keyword and pattern matching as transparent fallback classification.
- [ ] Correlate claims and incidents across sources while preserving contradictions and source independence.
- [ ] Resolve actor and victim entities conservatively, with confidence, provenance, temporal validity, and human review.
- [ ] Track actor behavior and characterization changes over time.
- [ ] Structure extortion type, monetization path, victim-pressure tactic, buyer/seller communication signals, advertised data type, publication strategy, and channel type.

### Canonical Data and Evidence Contract

- [x] Add an isolated `threat_intel` PostgreSQL schema to the existing PostgreSQL service.
- [x] Add durable normalized storage for sources, captures, extracted entities, indicators, actor profiles, incidents, evidence links, validations, alerts, and evaluation labels.
- [x] Preserve existing analyst, watchlist, case, and API behavior in a clearly bounded workflow-record store rather than speculative duplicate schemas.
- [x] Replace the production JSON-file store, run migrations and legacy hydration before opening the API port, and connect `ti-scraper` to the Compose PostgreSQL service.
- [x] Expose database readiness in health reporting and provide focused PostgreSQL integration coverage for persistence, deduplication, lineage, alerts, validations, and evaluation labels.
- [x] Normalize actor aliases and collection runs instead of leaving them embedded in profile or workflow JSON.
- [x] Persist source-health history from real scheduler attempts, including useful yield, failures, parser warnings, duplication, freshness, actor observations, and legal mode.
- [x] Persist and expose incident timeliness from publication/report through collection, processing, first visibility, and delivered alerts, including timestamp anomalies.
- [x] Normalize intelligence claims, capture/source evidence, corroboration, contradictions, and append-only claim review state instead of leaving analyst claims in workflow JSON.
- [x] Enforce the evidence chain: claim -> extracted field -> capture -> source -> timestamps -> parser/version -> confidence -> corroboration -> review state.
- [x] Make evidence links and temporal history queryable without reconstructing them from opaque JSON records.
- [ ] Define retention, redaction, provenance, tenant isolation, migrations, backup/restore, and failure-recovery behavior suitable for a serious monitoring platform.

### API and Product Interface

- [x] Preserve the existing UI while replacing the underlying production store.
- [x] Expose stable JSON API resources for sources, captures, entities, actors, incidents, evidence, validations, alerts, evaluation, health, and timeliness.
- [ ] Make actor pages, search results, incidents, and alerts distinguish evidence-backed facts from inferred summaries.
- [ ] Show confidence, freshness, source count and independence, contradictions, missing fields, parser/review state, and provenance where relevant.
- [ ] Ensure technical and non-technical users can explore the same evidence without misleading simplification.
- [ ] Remove production placeholders and synthetic intelligence, while preserving intentional empty and degraded states.
- [x] Provide a real source-operations view/API covering last attempt, last success, last useful item, parser success, false-positive rate, failures, family, actor coverage, and legal mode.
- [ ] Keep optional third-party reporting bounded to defensible, evidence-linked exports if implemented.

### Validation and Evaluation

- [x] Support durable analyst labels and ground truth for actor, victim, date, source, TTP, impact, and dataset/leak type.
- [ ] Build a representative labeled corpus from real captures and independently verifiable public incidents, growing beyond the initial 50-100 items.
- [ ] Cross-reference claims with victim disclosures, news reports, vendor research, and other independent public records.
- [x] Calculate extraction precision, recall, and error breakdown by entity type, parser, and source family.
- [x] Measure median and p95 latency from first actor/victim report through publication, collection, processing, first visibility, and alert delivery.
- [ ] Measure active source reliability, useful coverage, actor coverage, duplication, corroboration, and false-positive rates.
- [x] Make evaluation repeatable from stored labels and timestamps without maintaining a parallel evidence system.

### Ethics and Safety

- [x] Enforce metadata-only handling where full content would redistribute stolen, harmful, or unlawful material.
- [ ] Store source legality, access mode, collection justification, sensitivity, and retention/redaction policy as operational metadata.
- [ ] Prevent secrets, personal data, unsafe payloads, and raw stolen datasets from leaking through logs, APIs, exports, alerts, or UI.
- [ ] Document and implement deletion, correction, source takedown, and analyst-audit paths required by institutional and legal review.

### Production Quality

- [x] Make migrations forward-safe and verify clean installation, upgrade, restart persistence, backup, and restore.
- [ ] Make collection idempotent, observable, rate-limited, and resilient to malformed or unavailable sources.
- [ ] Establish authentication, authorization, tenant isolation, auditability, input validation, and safe outbound-fetch behavior across trust boundaries.
- [ ] Remove dead production paths and avoid parallel sources of truth.
- [ ] Keep type checks and focused tests green, then resolve or explicitly retire all existing failing broader tests as the affected product areas are hardened.
- [ ] Verify the complete product at representative desktop and mobile viewports without significant landing-page design changes.
- [ ] Produce deployment and operational behavior suitable for a sustained thesis evaluation period, including actionable health and failure reporting.

## Priority Order

1. Finish the canonical data and evidence spine: normalized operational tables, claim provenance, review state, timeliness, source health, retention, and recovery.
2. Turn source coverage into reliable live collection: source-specific parsers, RSS/blog, Telegram, metadata-only dark web, and operational source health.
3. Harden extraction and correlation: entity resolution, TTPs, confidence, contradictions, temporal tracking, and analyst review.
4. Make accuracy, timeliness, coverage, and error analysis continuously measurable from real labeled captures.
5. Make every API and UI surface communicate evidence and uncertainty correctly while preserving the landing-page design.
6. Add the structured research layer for business models, publicity/profitability, and buyer communication.
7. Complete security, ethics, recovery, operations, accessibility, performance, and release hardening across the full product.

## Current Verification Baseline

- The PostgreSQL storage foundation passes type checking and focused storage/API tests.
- Real PostgreSQL checks have covered restart persistence, deduplication, legacy hydration, schema isolation, lineage, alerts, validations, evaluation labels, and database pagination.
- PostgreSQL migration 007 adds normalized actor aliases, collection runs, source-health observations, and timeliness records; both clean installation and upgrade from migration 006 have been exercised against PostgreSQL.
- PostgreSQL migration 008 adds logical intelligence claims, direct extraction/capture evidence, and append-only analyst reviews; existing extracted and analyst claims migrate with portable IDs that remain correlatable with new observations.
- A production backup on 2026-07-20 captured the `threat_intel` schema and evidence volume with verified checksums, restored both into isolated drill targets, cleaned up the temporary database, and left the live scraper healthy.
- Compose configuration and runtime database readiness have been checked.
- `/v1/intel/source-operations` now derives tenant-scoped operational status from persisted source-health observations, captures, extracted actors, and evaluation labels; it reports explicit unmeasured states and redacts source URLs and restricted failure details.
- Publisher-verified CCN-CERT and SSSCIP/CERT-UA public Telegram sources now use an approved unauthenticated preview path with nested-message parsing, bounded fetches, no media downloads, multilingual relevance filtering, source health, and durable pipeline handoff. A live CCN-CERT run produced useful captures and incidents.
- The selected CISA advisory RSS source completed the same live bounded production path with useful captures, entities, indicators, incidents, and persisted source-health output.
- Restricted metadata collection has a separate opt-in scheduler and HTTP-to-Tor boundary, enforces v3 onion and metadata-only policy, writes normalized run/source health, and strips raw page content before persistence. Production collected BrainCipher and Deadlock in one bounded two-source cycle on 2026-07-20: both captures use `metadata_only` storage and `restricted_metadata` retention, contain no body or object reference, and retain normalized claim/incident lineage. Failed Blackout, Akira, and 0day attempts recorded bounded health failures and were rejected pending re-verification. The deployed safe-capture API also redacts bare onion hostnames embedded in metadata summaries.
- Stable `/v1/intel` resources now cover sources, redacted captures, entities, actor profiles and aliases, incidents, evidence links and claims, validations, safe alerts, evaluation labels, health, runs, and timeliness. Missing tenant scope means global records only; header/query/body mismatches are rejected; restricted locators, object keys, raw bodies, tokens, and webhook configuration are removed from API DTOs.
- Search, evidence reports, claim review and labeling writes, source administration reads, run status, and run results now share exact tenant scope. Pipeline persistence propagates capture tenant/source lineage to incidents, and run results are run-specific and body-redacted.
- Restricted-source bootstrap now rejects every seed with validation errors, validates Tor metadata packs through a separate fail-closed contract, and always imports restricted records as inactive review candidates. The fake onion fixture was removed; a current public-discovery candidate is recorded as pending and unavailable rather than represented as working coverage.
- The production pipeline now preserves source tenant IDs through public RSS/JSON, Telegram, static HTML, PDF, dynamic, public-advisory, and metadata-only Tor adapters. Source-specific extraction handles structured victim-blog claims, CISA KEV fields, and CERT-UA actor identifiers before the versioned deterministic fallback, and per-record extractor lineage survives persistence.
- `/v1/intel/evaluation` computes tenant-scoped precision, recall, F1, false-positive/false-negative counts by label type, parser, source family, and dataset split from immutable durable labels. It also reports median/p95 stage latency, timestamp anomalies, active/useful source coverage, actor coverage, and public-validation status without a parallel evidence store.
- Focused source-operations, storage/API, runtime evidence persistence, tenant-isolated alert lifecycle, type-check, and diff checks pass together.
- The broad scraper suite still contains pre-existing failures in product areas outside the initial storage replacement. Those failures remain work; the database milestone does not make the overall product complete.

## Removal Rule

Delete `goal.md` only after auditing the running product against every unchecked item above and confirming that the entire implementation is ready for thesis submission. Do not delete it because a milestone, test suite, demo, or thesis chapter is complete.
