# Source Registry Operator Procedures

## Purpose
The source registry controls which public CTI sources may be queried, why they are useful, what legal basis allows collection, how often they should be collected, and when they must be reviewed or quarantined.

## Import A Safe Public Source Pack
1. Review the JSON bundle under `seeds/`.
2. Confirm every source has `legalNotes` and `catalog.legalBasis`.
3. Run seed validation through `validateSeedBundle`.
4. Review duplicate, stale, blocked, missing-legal, and adapter-incompatible counts.
5. Import only accepted sources. Importing a seed bundle must not start crawling.

## Activate Sources
Use these rules:
- `safe_public_auto`: low-risk public HTTP, RSS, API, static web, or PDF sources may move from `candidate` to `active` after validation.
- `public_requires_review`: keep as `needs_review` until an analyst applies a `SourceReviewDecision`.
- `metadata_only`: keep raw content disabled unless the source policy explicitly allows metadata-only collection.
- `restricted_protocol` or `disabled`: do not activate without a narrow written protocol.

## Query Coverage Review
Before running an actor or sector query, generate a source activation report. The report should show:
- active sources that match actor aliases, topics, industries, regions, or countries;
- approved but idle sources that can be scheduled;
- candidate-only sources that are safe but not yet activated;
- blocked sources with policy reason;
- stale sources with missed freshness targets;
- duplicate sources by tenant/type/canonical URL;
- adapter-incompatible sources.

Use coverage explanations for common workflows:
- `APT29` or `Midnight Blizzard`: prefer vendor reports, government advisories, ATT&CK references, and public threat reports with actor alias coverage.
- `healthcare ransomware Europe`: prefer ransomware, sector, and regional coverage.
- `CVE-2024-*`: prefer government vulnerability feeds, vendor advisories, GitHub advisories, and NVD/CISA-style APIs.
- `Norway critical infrastructure`: prefer national CERT, government advisory, infrastructure-sector, and Europe/Norway coverage.

For `/v1/intel/search`, use `buildSourceActivationApiResponse` to produce the API-ready contract. It groups active coverage, approved-idle sources, candidate gaps, missing legal notes, policy blocks, stale sources, duplicate canonical URLs, adapter incompatibilities, source-pack recommendations, and underserved reasons. Underserved reasons are deterministic and cover missing actor coverage, stale cadence, no public-channel coverage, no approved restricted metadata source, unhealthy sources, and disabled sources.

For source-pack recommendations, use `buildSafePublicSourcePackInstallPlan` in dry-run mode. The plan validates the seed bundle, applies tenant scope, identifies duplicates against existing sources, returns install/skip/fix-compliance recommendations, and always reports `willStartCrawling: false`. API consumers may display the plan, but source activation still requires registry/governance changes.

Use `validateSafePublicStarterPackCoverage` before promoting a curated starter pack. The current enterprise coverage proof covers `APT29`, `Scattered Spider`, `Volt Typhoon`, `Turla`, `Akira ransomware`, `MuddyWater`, `FIN7`, `Lazarus`, `LockBit`, unknown actor searches, and `CVE-2024 exploitation`.

## Production Source Onboarding
Production clear-web source packs must stay safe-public:
- allowed source types: RSS, static web, public API, and public PDF;
- allowed access methods: public HTTP or official public API;
- forbidden source classes: private forums, credentialed sources, leaked-file endpoints, CAPTCHA bypass, threat actor interaction, and restricted raw payload collection;
- required metadata: legal notes, legal basis, publisher identity, trust basis, crawl cadence, freshness target, adapter compatibility, approval scope, retention class, and rollback state.

## Public Advisory And Security Signal Connectors
Advisory-grade connectors may ingest only approved public records from these source families:
- `github_advisory`: public GitHub Security Advisories or public repository advisory metadata, never private repository content.
- `cert_government`: CISA KEV-style records, national CERT/NCSC feeds, and government advisories.
- `vendor_report`: vendor security blogs, incident reports, and public research writeups.
- `malware_report_feed`: public malware, tool, IOC, and research feeds that do not require payload retrieval.
- `public_report_index`: curated public report indexes with canonical links back to public source material.

Each connector record must normalize into an API-ready public signal delta with source family, source id, title, canonical URL, published or observed time, confidence, reliability score, language, region, tags, matched actors, malware/tools, CVEs, campaigns, sectors, countries, victims, and a deterministic dedupe key. Dedupe keys should combine source family, canonical URL, and matched-entity identity so GitHub advisories, CISA records, vendor posts, public feeds, and static captures can merge into one evidence-backed item without duplicating evidence.

Connector output must preserve provenance and keep unsafe material out of API payloads. The DTO should expose public-only provenance, evidence-backed state, source id, connector family, collection time, parser version when available, and merge target. URLs with secrets, tokens, payload/download affordances, private repository paths, auth-gated links, or malformed schemes must be replaced with `unsafe_url_hash:<sha>` references. The raw unsafe URL must not appear in logs, evidence deltas, status DTOs, or suppression lists.

Policy guards are mandatory for every advisory connector: public-only, no auth bypass, no private repo access, no CAPTCHA solving, no terms bypass, no exploit payload download, and no leaked data redistribution. Disabled, rejected, unavailable, policy-disabled, stale, duplicate, and edited records should remain visible as suppression or state metadata so analysts can understand why a source did not contribute to the fast answer.

Use `buildPublicAdvisorySignalConnector` for source-family ranking and `buildPublicSignalFusionWorkbench` when combining advisory signals with public-channel and clear-web capture hints. The connector supports actor, malware/tool, CVE, campaign, sector, country, and victim/company queries, and writes useful signals into `publicSignalFusion.advisoryConnector` plus mergeable `publicSignalDeltas` targeting clear-web capture evidence.

Use `PublicAdvisoryAdapter` when the approved source is a public advisory API/feed rather than a generic static page. The adapter supports GitHub Security Advisory-style JSON, CISA/KEV-style JSON, CERT/government records, vendor advisories, malware/tool feeds, public report indexes, and RSS/Atom advisory entries. It emits normal `CollectedItem` records for the internal pipeline, plus a route-safe `ti.public_advisory_signal_delta.v1` metadata object with canonical URL hash, content hash, source family, matched entities, dedupe key, parser confidence, extraction warnings, public-only provenance, and evidence replay ref.

Production scoring should treat `github_security_feed` as implemented through the public advisory runtime when source policy, legal notes, parser certification, and runtime enablement gates pass. GitHub repository-private advisory paths, auth/private/login/invite paths, secret-bearing URLs, payload/download/exploit/PoC links, malformed schemes, non-HTTP schemes, and onion links are suppressed before capture and exposed only as reason plus `unsafe_url_hash:<hash>` in adapter metadata.

Use `buildLiveCaptureRuntimePacket` to evaluate approved RSS, static HTML, report-index, and public advisory captures before source-pack promotion or scheduler cadence changes. The packet converts adapter results into per-source capture status, safe failure taxonomy, canonical URL hash, content hash, dedupe key, freshness state, parser confidence, extraction warnings, Agent 06 replay handoff, Agent 01 source-pack readiness, and Agent 02 cadence hints. Duplicate content should decrease cadence, stale but otherwise healthy sources can request increased cadence, and policy/unsafe URL/legal holds should pause scheduling and hold source activation.

Source-pack conformance for live capture should cover GitHub Security Advisory, CISA KEV, vendor advisory JSON, CERT HTML, vendor blog HTML, RSS/Atom, and report-index fixtures before counting the adapter lane as production-ready for new public CTI packs. The packet is route-safe and does not mutate sources, import packs, lease queue work, crawl unapproved network paths, or expose raw URLs/text/HTML/object keys.

Use `buildLiveCaptureCanaryPacket` after runtime packet proof when approved public sources are ready for fixture replay, dry-run canary scoring, or separately approved live-canary review. The packet emits `ti.live_capture_canary_packet.v1` rows with source id, adapter family, approved URL hash, robots/legal note state, runtime caps, parser version, extraction warnings, dedupe hashes, replay refs, no-leak result, canary state, parser repair recommendation, and scheduler hint. It covers first-run, repeat-run, burst-failure, source-outage, parser-regression, and source-family-shortage cases for Agent 01 source governance, Agent 02 cadence, Agent 07 quality repair, and Agent 09 stable API fields.

Canary repair categories are stable: malformed feed, changed layout, report-index drift, public advisory schema change, unsupported MIME, excessive redirects, source outage, duplicate-heavy output, stale source window, and unsafe-link suppression. Promotion may only be `promote`, `watch`, `hold`, or `rollback`; `hold` and `rollback` should pause scheduling until parser or source governance work clears. Canary packets are disabled-by-default and do not start network collection, mutate sources, lease queue work, expose raw URLs/text/HTML/PDF bytes/object keys, or weaken public-only policy.

Use `buildPdfReportExtractionReadiness` after public PDF/report adapter capture and before evidence replay promotion. The readiness packet emits `ti.pdf_report_extraction_readiness.v1` with OCR disabled by default, text-only projection hashes, citation-span coverage, parser confidence, extraction warnings, language, canonical URL hash, content hash, and replay id. Agent 01 can treat legal-note or parser gaps as source-pack holds, Agent 06 receives replayable hash/provenance descriptors, Agent 07 receives quality gate state, Agent 09 receives stable route-safe status fields, and Agent 10 receives pass/watch/hold release signals.

PDF/report readiness does not mutate sources, queue OCR, start crawling, or expose raw PDF bytes, raw text, object refs, object keys, OCR vendor IDs, unsafe URLs, onion links, credentials, or restricted material. OCR remains a separate operator-approved path; low-confidence extraction, missing citation spans, parser failures, unsupported media, unavailable sources, or legal/robots holds should keep the report in watch/hold until fixtures and quality gates pass.

Use `publicSignalFusion.analystSourceWorkbench` for analyst-facing source decisions. The workbench explains why a public source was trusted, suppressed, merged, stale, duplicated, unavailable, edited/deleted, policy-disabled, parser-gap, legal/robots-held, or low-yield. Its action rows are dry-run-only and may propose approval, disable/pause, trust changes, cadence changes, duplicate marking, parser repair, legal/robots review, or source-pack promotion. These rows are handoff packets for Agent 01 governance, Agent 02 scheduler cadence, Agent 06 evidence yield, Agent 07 quality gates, Agent 09 API fields, and Agent 10 SLO dashboards; they must not mutate source state, start crawling, expose unsafe URLs, or weaken public-only guardrails.

Use `publicSignalFusion.coverageRadar` for enterprise source gap radar. The radar scores actor/source-family gaps, sector/country gaps, stale sources, missing advisory families, malware/tool feed gaps, weak ransomware/victim coverage, weak CVE coverage, parser gaps, duplicate pressure, poor useful-answer rate, and public advisory conflicts. Recommendations are dry-run safe-public source-pack or repair tasks with trust, freshness, family diversity gain, parser support, expected evidence yield, legal/robots review age, activation readiness, and handoffs for Agent 01/02/03/06/07/08/09/10. Restricted metadata may appear only as review-held context and must never count as public coverage.

Use `publicSignalFusion.sourcePackExpansion` for operator-ready safe-public source pack expansion. It classifies source-pack entries for APT, ransomware, CVE/advisory, malware/tool, country, sector, campaign, infrastructure, and victim/company searches; emits only hashed public URL references, dedupe keys, stale/duplicate/blocked suppressions, parser capability labels, rate-limit hints, onboarding actions, and Agent 01/02/03/06/07/09/10 handoffs. The packet is dry-run only and does not expose raw Telegram URLs, automate accounts, join private channels, or bypass auth/CAPTCHA/terms controls.

Use `publicSignalFusion.advisoryCorrelation` for contradiction-aware public CTI evidence. It correlates advisory, GitHub/security advisory, CERT/government, vendor, public research, and public-channel metadata by actors/aliases, CVEs, malware/tools, campaigns, sectors, countries, and victim/company hints. The packet emits compact evidence IDs, source families, source IDs, first/last seen timestamps, freshness, confidence, conflict types, analyst actions, and Agent 01/02/06/07/08/09/10 handoffs. It intentionally omits raw URLs and keeps public-channel-only, stale, duplicate, overclaimed CVE-to-actor, edited/deleted, and ambiguous sector/country claims under review or graph/STIX hold.

Use `publicSignalFusion.sourceFamilyBenchmarks` for source-family reliability benchmarks and coverage expansion decisions. It scores vendor reports, CERT/government, GitHub/security advisories, public research/blog/RSS, clear-web, public channels, social, and malware feeds for coverage, freshness, contradiction rate, duplicate rate, parser readiness, actor/campaign/CVE richness, and evidence yield by query class. Unknown actors without evidence-backed public signals stay in `Searching` with `noDefaultActorAssumption`; recommendations are dry-run only and may point to safe-public source-pack candidates, cadence repair, parser repair, dedupe, or contradiction review without activating crawling or exposing raw URLs.

Use `publicSignalFusion.publicIntelligenceCoveragePlan` as the API-ready coverage expansion packet for `/ti` and Agent 09/frontends. It maps actor, campaign, malware/tool, CVE/advisory, sector, country, victim/company, ransomware, and infrastructure queries to required public source families; reports blind spots for stale actor activity, missing source-family coverage, contradiction clusters, parser gaps, seed/cache over-reliance, and no-evidence searches; and emits safe source-pack/cadence/parser/dedupe/contradiction actions. Unknown or made-up actors must remain `Searching`/hold-only until fresh public evidence arrives; the packet forbids demo fallbacks, default actor assumptions, stale-cache copy, private-channel joins, account automation, CAPTCHA/auth bypass, restricted collection, and raw URL exposure.

Use `publicSignalFusion.freshnessGapRemediation` when `/ti` needs to explain how a partial, stale, held, or searching answer becomes useful. The packet converts coverage blind spots into owner-specific dry-run actions for Agent 01 source activation, Agent 02 scheduler cadence, Agent 03 parser/capture repair, Agent 06 evidence replay, Agent 07 quality holds, Agent 08 graph pivots, and Agent 09 API status fields. High-volume actors such as APT29, APT42, Sandworm, Volt Typhoon, Lazarus, LockBit, and Akira have explicit freshness targets; stale-only historical activity is rejected for recent-activity promotion until fresh public evidence is replayable. Query fixtures cover actor, ransomware, CVE/advisory, sector, country, victim/company, and made-up actor searches while preserving `Searching` semantics, no default/demo actor fallback, no stale cache copy, no private channels, no account automation, no auth/CAPTCHA bypass, no restricted raw collection, and no raw URL exposure.

Use `publicSignalFusion.publicIntelligenceQueryMatrix` for the compact cross-query readiness matrix behind `/ti`. Each row represents actor, ransomware, campaign, malware/tool, CVE/advisory, sector, country, victim/company, infrastructure, or unknown/made-up searches and scores source-family coverage, freshness, evidence yield, contradiction risk, parser readiness, graph readiness, public answer readiness, and analyst actionability. The matrix emits only compact API fields, primary blockers, and next actions such as source-family activation, cadence increase, parser repair, evidence replay, quality hold, graph review, or `Searching` display. It must not add default/demo actor assumptions, stale-cache copy, private-channel access, account automation, auth/CAPTCHA bypass, restricted raw collection, or raw URL exposure.

Use `publicSignalFusion.publicConflictContradictionResolver` as the release-facing conflict router before public facts, graph relationships, or STIX-like exports become authoritative. Resolver rows collapse advisory-correlation conflicts and query-matrix blockers into compact decisions for actor attribution conflicts, alias ambiguity, old campaign reuse, stale infrastructure, contradictory victim claims, CVE exploitation disagreement, sector/country ambiguity, edited/deleted public-channel evidence, and source-family conflicts. Each row carries affected query classes, source/evidence ids, freshness, confidence, public-answer effect, graph/STIX effect, release gate, analyst actions, and Agent 06/07/08/09 handoffs. Rows intentionally omit raw URLs and unsafe material, keep public-channel-only claims caveated, block conflicted graph/STIX promotion when needed, and preserve the same public-only/no-private/no-automation/no-bypass guardrails as the rest of Agent 04 collection.

Use `publicSignalFusion.publicSignalLiveCollectionLoop` as the route-visible bridge from public signal fusion to useful live collection. The loop accepts only normalized source-atlas, public-channel, clear-web/advisory, and dark-web metadata-only records; scores rows by freshness, source-family diversity, provenance strength, contradiction state, entity specificity, analyst usefulness, and query match; and penalizes stale-only, generic-summary, source-monoculture, query-mismatch, contradiction-hold, and metadata-only-hold conditions. It exposes query-class playbooks, ready/partial/searching/held UI behavior, missing source families, and next safe collection tasks for Agents 01/02/03/05/06/07/08/09/10. Dark-web context is limited to redacted site ids, category/risk/liveness labels, actor/victim/TTP hints, and blocked-payload markers; raw unsafe URLs, credentials, dumps, payload links, private channels, account automation, auth/CAPTCHA bypass, default actor assumptions, and stale-cache promotion remain forbidden.

Use `publicSignalFusion.publicSignalValueImpact` to answer the operator question "does this source atlas or dark-web index signal improve the public answer?" The packet projects answer-readiness lift from missing source-family candidates, source-pack/parser readiness, freshness gaps, replayable public evidence, and redacted dark-web metadata triage. Source-atlas rows may recommend safe public source staging, parser repair, cadence, or evidence replay when they can move a query from searching to partial or partial to ready. Dark-web index rows can improve triage only; they never promote public answers or graph/STIX facts without reviewed public evidence. The packet emits no raw URLs and preserves no-private/no-account/no-bypass/no-stale-cache/no-default-actor guardrails.

Use `publicSignalFusion.publicCoverageFreshnessValue` to keep the value program tied to live freshness instead of static source promises. It combines source-family benchmarks, the query matrix, remediation state, live collection scores, source-atlas candidates, and value-impact lift into per-family freshness states, high-value actor coverage, stale/no-evidence/metadata-only risk, expected answer lift, and owner handoffs. The packet is meant for source selection, cadence, parser repair, evidence replay, graph/STIX gating, and API/frontend status; it emits source and signal references only, never raw URLs or restricted material.

Use `publicSignalFusion.actorSourceCoverageMatrix` for Program BI/BJ actor coverage and feed prioritization. The matrix covers configured high-value actors/groups with required, covered, stale, missing, and restricted-metadata-only source families; per-family advisory/blog/news/channel value; dark metadata caveat state; freshness expectation; source-family priority rows; cadence recommendations; `highestValueMissingFamily`; `nextBestSourceAction`; `buyerCaveat`; and `expectedTimeToUsefulSignal`. Compact product fields include `sourceCoverageGaps`, `coverageStatus`, and `actorFeedPriorities` so Apify and `/ti` can explain fresh, partial, stale, metadata-held, or source-gap-held results without parsing the full matrix. It emits only source/evidence ids, family states, hashes, and safe activation handoffs for Agent 01/02/03/05/07/08/09; it must not expose raw URLs, private channels, leaked data, account automation, auth/CAPTCHA bypass, actor interaction, or default actor assumptions.

Use the adapter failure observatory when runtime collection has already attempted, skipped, or blocked a source. `buildAdapterFailureObservation` and `buildAdapterFailureObservatory` emit source marketplace inputs for failure class, source family, query class, parser profile, canonical URL hash, retry/backoff, stale date, unsupported MIME, content-size cap, timeout, duplicate canonical, parser confidence, extraction warnings, robots/legal hold, and Agent 01/02/06/07/09/10 handoff actions. Source scoring should use these fields to lower scores, request review, pause/decrease cadence, suppress duplicates, or create parser-gap work without exposing raw URLs, onion links, HTML, raw text, payloads, credentials, cookies, tokens, private invites, or restricted raw material.

Use `buildAdapterProductionReadinessPacket` for future dynamic/browser worker rollout planning. The packet is not an enablement switch: browser workers remain disabled in the DTO, and the gate reports blockers/warnings from robots/legal policy, memory caps, and observatory outcomes before any separate canary allocation.

Use `buildAdapterRuntimeEnablementPacket` when deciding whether approved sources can enter a controlled adapter canary. The packet emits one readiness row each for static HTML, RSS, dynamic public browser, PDF/report, public-channel handoff, and advisory/security signal adapters. Source rollout should consume the canary source ids, canonical URL hashes, parser profile, worker caps, memory/timeout/byte caps, parser confidence gates, evidence-yield floor, observatory health, and rollback triggers. Dynamic browser, PDF/report, and public-channel handoff rows remain canary-only until a separate operator allocation promotes them; browser workers always report `browserWorkersEnabled: false` in this planning packet.

Registry and marketplace actions from runtime enablement are advisory only. Agent 01 may approve or hold canary candidates, Agent 02 may schedule canary cadence or pause blocked pools, Agent 06 may enforce screenshot-hash-only storage, Agent 07 may block low-confidence extraction, Agent 09 may expose the stable DTO fields, and Agent 10 may hold release on rollback triggers. The packet must not mutate sources, lease work, start crawling, expose raw URLs, expose onion links, store screenshot bytes, or weaken public-only controls.

Use `buildProductionAdapterRuntimeProgram` to decide whether approved public sources have enough adapter runtime, parser certification, and capture metadata support for production collection. Registry scoring should read each capability row's implementation state, certification state, runtime mode, source family, parser profile, byte/time/worker limits, language support, conditional-request support, retry/backoff support, fixture gaps, failure classes, blockers, and warnings. A source may be activated only when the adapter is implemented or explicitly canary-contract, parser state is certified or canary-only with operator approval, legal/robots notes are current, and downstream Agent 06 evidence replay can store the required hash-only capture metadata. GitHub/security advisory feeds are contract-ready through the advisory signal lane until an official public API collector is promoted; dynamic browser remains disabled by default with explicit approval and screenshot-hash-only metadata.

Use `buildDynamicBrowserCutoverPacket` only after static HTML, RSS, and PDF/report adapters prove a source needs bounded public rendering. It is a cutover plan, not a worker enablement switch: `browserWorkersEnabled` remains false, canary mode requires explicit approval, and all public host allowlists, requested URLs, final URLs, screenshots, and object references are represented by hashes in route/API output. Registry scoring should consume the packet's failure modes, gates, `resourceBudget`, `storageIsolation`, per-fixture `provenance`, `promotionReadiness`, and handoffs to pause or repair sources on JS render timeout, redirect chain, unsupported MIME, robots/legal hold, capture truncation, blank page, parser empty extraction, screenshot hash mismatch, queue pressure, private-network targets, credential prompts, CAPTCHA challenges, download attempts, onion redirects, third-party request leaks, missing approval, kill-switch activation, resource overrun, or ephemeral-storage drift. Isolation canaries are fixture replay only and must keep the dynamic browser pool separate from static/RSS/PDF workers with no cookie jar, local storage, session storage, cache persistence, downloads, raw screenshot bytes, raw HTML, raw URLs, object refs, or unsafe link exposure. Per-fixture provenance must remain `CollectedItem`-compatible with source id, task id, canonical/final/requested URL hashes, content hash, fetched-at, parser confidence, extraction warnings, screenshot hash, object-ref hash, and robots/legal notes. `promotionReadiness.liveBrowserEnablement` stays `disabled_requires_separate_operator_allocation`; pass rows may only become fixture canaries, watch rows reduce/pause scheduling, and hold rows block source promotion. Agent 01 receives activation allow/hold, Agent 02 receives canary/reduce/pause budget signals, Agent 04 receives expansion eligibility, Agent 06 receives hash-only evidence replay state, Agent 07 receives pass/review/hold quality gates, Agent 09 receives stable warning codes, and Agent 10 receives resource-gate state. The packet must not mutate sources, lease work, start crawling, expose raw URLs or object refs, expose onion links, or weaken public-only controls.

Use `buildTranslationHandoffPacket` for multilingual public reports before promoting extracted claims. Source scoring should consume declared language, detected language, original language, requested language fit, translation-needed state, mixed-language signals, citation-span availability, adjusted parser confidence, and translation priority. This lets Agent 01 score multilingual sources, Agent 04 identify translation coverage gaps, Agent 06 retain original-language evidence metadata, Agent 07 review translation caveats, Agent 09 expose stable multilingual fields, and Agent 10 alert on language gaps. The handoff is metadata-only and vendor-neutral; it never starts translation, mutates sources, or stores translated content.

Use `buildMultilingualParserConfidenceBenchmark` across translation handoff packets before giving multilingual sources production weight. Registry scoring should read the benchmark status, language rows, adjusted parser confidence, detection confidence, citation-span coverage, mixed-language ratio, high-priority translation ratio, low-confidence blocks, and packet refs. Pass rows can count as multilingual coverage, watch rows should trigger source/parser review, and hold rows should block production promotion until fixtures or parser fallbacks improve. The benchmark is metadata-only and must not expose raw text, translated text, raw URLs, unsafe links, translation vendors, API keys, or live translation calls.

Use `runReportCorpusBenchmark` for PDF/report source activation decisions and Program BB public report/PDF/OCR extraction readiness. Registry scoring should consume row-level fixture class, parser profile, confidence band, language readiness, citation-span coverage, media readiness, stale publication state, `provenanceContract`, `extractionReadiness`, and `ocrReadiness` status. Fixture coverage should include vendor reports, advisories, multilingual reports, malformed PDFs, scanned PDFs, unsupported MIME, stale reports, duplicate canonical reports, restricted policy holds, dynamic snapshots, and RSS items.

`extractionReadiness.status=pass` rows can count toward production public-report coverage when provenance is `CollectedItem`-compatible and legal/robots notes are present. `watch` rows should create Agent 03 parser/OCR/language fixture work and may surface partial API output only with Agent 07/09 caveats. `hold` rows should block source promotion, capture replay, graph/STIX promotion, and route output until unsupported media, malformed PDF parsing, missing citation spans, duplicate canonical reports, policy holds, or blocked OCR readiness are repaired.

The benchmark is vendor-neutral and route-safe. It uses source ids, task ids, canonical URL hashes, content hashes, fetched timestamps, publication timestamps, robots/legal note state, duplicate canonical keys, citation counts, and handoff states. It must not expose raw report text, raw/canonical/unsafe URLs, HTML, bodies, object refs/keys, OCR vendor IDs, credentials, cookies, tokens, private invites, onion URLs, or live OCR service identifiers.

Use `buildAdapterSlaRepairPacket` after observatory and multilingual handoff generation to produce parser/SLA repair work for Agent 03. Registry and marketplace scoring should read contract status, breach codes, repair categories, source ids, canonical URL hashes, and Agent 01/02/04/06/07/09/10 handoffs. High-priority parser fixture, PDF, dynamic-render, and unsupported-MIME repairs should block source activation or release promotion until fixture proof is green; scheduler-backoff and duplicate-suppression repairs should reduce pressure without hiding provenance.

Adapter SLA repair output is a dry-run planning artifact. It may ask for parser fixtures, selector/readability repairs, language fallback review, cadence/backoff, duplicate suppression, and hash-only evidence replay, but it must not mutate sources, lease work, start crawling, enable browser workers, expose raw URLs, expose onion links, or weaken public-only collection rules.

Use `buildAdapterRepairTriagePacket` after SLA repair and certification replay to turn adapter failures into operator-ranked recommendations. Registry and marketplace scoring should read action (`certify_adapter`, `fix_parser`, `disable_or_pause_source`, `reduce_cadence`, `suppress_duplicate`, or `escalate_release_hold`), priority, score, customer search impact, source-family coverage, freshness debt, duplicate rate, unsupported MIME, timeout/rate-limit counts, language drift, missing certification modes, sandbox replay expectations, and Agent 01/02/04/06/07/09/10 handoffs. Triage recommendations are advisory only: they do not mutate sources, certify adapters automatically, lease work, start crawling, enable browser workers, expose raw URLs or object refs, expose onion links, or weaken public-only controls.

Use `replayAdapterCertificationFixtures` before moving source candidates into live actor-query collection. Operators should require a certification packet that includes every public adapter family, all required fixture replay modes, clean SLA repair summary, and no hold gates. `adapterGates` tells Agent 01 whether source activation may proceed, Agent 02 whether cadence/backoff is safe, Agent 04 whether public source expansion may count the adapter, Agent 06 whether replay is hash-only or suppressed, Agent 07 whether extraction quality passes, Agent 09 which warning field to expose, and Agent 10 whether release is held.

Certification packets are not crawl permissions. They accept fixture inputs with raw URLs or object refs only inside the test harness, but route/API output must expose only `fixtureUrlHash`, `objectRefHash`, `contentHash`, compact extraction stats, source ids, modes, and warning codes. A dynamic public browser adapter is certifiable only with an explicit bounded-dynamic fixture flag and still reports browser workers disabled by default.

The starter pack now covers actor intelligence, vulnerability intelligence, ransomware/victim reporting, vendor research, government advisories, malware reports, and public datasets. It intentionally does not activate public-channel or restricted-metadata collection; those remain separate approval tracks.

Use `buildSourceCoveragePlanApiResponse` or POST `/v1/sources/coverage-plan` to show another CTI application how to interpret coverage gaps. The DTO is dry-run-only and returns active sources, approved-idle sources, missing verticals, stale/policy/adapter gaps, safe source-pack recommendations, forbidden source classes, and install-plan summaries. It always reports `willMutate: false` and `willStartCrawling: false`.

Use `buildSourcePortfolioApiResponse` or POST `/v1/sources/portfolio` for operator portfolio views. The DTO groups approved, active, and candidate sources by family, actor coverage, region, sector, language, legal-review age, robots-review age, reliability, and extraction yield. It also returns `reliabilityEconomics`, a dry-run scoring packet that explains trusted, throttled, paused, retired, promote-candidate, and review-needed source decisions using freshness, useful-answer yield, parser health, legal/robots review age, duplicate rate, evidence replay success, analyst override history, false-positive history, family diversity value, and scheduler cost efficiency. Operators use the packet to suppress stale or duplicate sources, prioritize activation-wave candidates, estimate marginal value and cost per useful evidence item, and hand fields to Agent 02 scheduler priority, Agent 03 parser capability, Agent 04 source-pack recommendations, Agent 06 evidence replay, Agent 07 quality/confidence, Agent 09 API contracts, and Agent 10 SLO/runbooks. It also returns safe-public source-pack onboarding plans with duplicate analysis, compliance completeness, expected coverage delta, scheduler-cost estimates, parser compatibility, rollback/quarantine state, promotion safety, and SLO burn-down actions. It is dry-run-only: `willMutate: false` and `willStartCrawling: false`.

Task AH adds `migrationReadiness` to the same portfolio response. This packet is the executive source-portfolio migration dry run: it groups current registry rows and safe-public source-pack candidates into `candidate`, `sandbox`, `canary`, `active`, `degraded`, and `retired` lanes with approval requirements, rollback action, parser capability, source families, average reliability, legal/robots review state, cadence impact, and query-class readiness. It emits reversible recommended actions such as promote candidate to sandbox, promote sandbox to canary, restore degraded source, retire duplicate, request legal review, and request parser repair. These actions are operator packets only: no source status changes, no crawling, no queue leasing, no silent activation, and restricted/darknet sources remain metadata-only and excluded from safe-public production coverage.

Task AI adds `sloBurnRate` to the same portfolio response. This packet measures source-portfolio burn rate across freshness, parser failure, low evidence yield, duplicate rate, outage waves, retirement risk, approval expiry, and query coverage gaps, grouped by source family and query class. It returns only dry-run remediation queue items: raise/lower cadence, quarantine, retire, request parser repair, request source-pack expansion, request evidence replay, request analyst approval, or hold restricted metadata. Queue items include rollback guidance, route hints, approval requirements, and Agent 02/03/04/06/07/09/10 handoffs. The packet is API-safe and compact: no raw unsafe/restricted URLs, no leaked/private material, no source mutation, no crawling, and no automatic restricted activation.

Task AJ adds `tenantActivation` to the same portfolio response. This packet groups source activation, staging, holds, retirement, and restricted metadata holds by tenant, query class, source family, and source class. Approval packets cover public RSS/blogs, advisory/API sources, public channels, dynamic browser candidates, report/PDF sources, and restricted metadata-only sources. Each packet explains coverage gap effect, source reliability, parser certification, freshness debt, duplicate/evidence yield, legal/robots state, policy holds, tenant scope, rollback, route hints, and Agent 02/03/04/05/06/07/09/10 handoffs. The packet is dry-run-only, non-crawling, tenant-scoped, and never silently activates restricted sources or exposes unsafe/restricted raw URLs.

Program BB adds `sourceImportCanary` to `/v1/sources/portfolio`. This packet is the production source import and activation canary dry-run: first-10 canary source ids, first-50 safe-public rollout ids, tenant/query-class/source-family/source-policy/adapter/scheduler/evidence/quality/graph-STIX/API-answer activation results, fixture coverage for actor intelligence, ransomware/leak metadata, advisories, malware reports, public CERT feeds, vendor blogs, and public-channel descriptors, plus lifecycle packets for retirement, duplicate suppression, stale detection, parser certification dependencies, restricted metadata holds, and rollback. It never imports source packs, mutates source state, starts crawling, silently activates restricted sources, or exposes unsafe raw URLs; restricted/leak sources remain metadata-only review inputs.

The high-value TI source atlas is exposed at `POST /v1/sources/atlas`. It is a dry-run discovery and staging surface for thousands of public CTI sources, not a crawler or registry mutator. Atlas records include public URL/domain/feed, source family, query-class coverage, language, region, sector, reliability, freshness, evidence yield, uniqueness, parser certification, legal/robots state, duplicate/mirror suppression, scheduler/evidence estimates, activation readiness, and downstream public-answer value. The response includes first-100, first-1000, and future-10k import plans, a query-class coverage matrix, activation canary handoff fields, a `publicMonitorSourceGapHandoff` for `apify/public-threat-actor-monitor`, `lifecycleReview`, `sourceEconomics`, export/import schema metadata, and Agent 02/03/04/06/07/09/10 handoffs. The first-100 product ladder is an operator acquisition queue with concrete public source identities/domains, buyer value, actors improved, freshness expectation, likely extracted entities, parser/source family, 1-3 day Apify row impact, acquisition priority, and highest-value missing source family for default actors such as APT29, APT28, APT42, LockBit, and Akira. The public-monitor handoff is ID/count/state only: query class, coverage state, missing source families, recommended atlas source ids, scheduler dry-run priority, expected Actor effect, analyst action, and no-leak boundary. `lifecycleReview` turns duplicate, stale, low-yield, parser-gap, legal/robots-held, descriptor-only, and unsafe-class candidates into operator review rows with source ids, source hashes, reason codes, dry-run action recommendations, replacement candidate ids, scheduler dry-run deltas, rollback plan ids, and no-mutation boundaries. `sourceEconomics` models first-50, first-500, and first-5000 rollout scenarios with expected actor/query coverage, language/region diversity, unique evidence yield, duplicate risk, parser/legal dependencies, storage and scheduler cost, cost per useful evidence item, API/Actor usefulness, public-answer lift, marketplace value by use case, family metrics, degradation queues, and rollback state. It is source-id/hash oriented and never applies activation, registry writes, worker leases, source-pack imports, or crawling. These handoffs do not include raw URLs, payloads, fetched content, or source activation effects. Public-channel descriptors remain descriptor-only holds. The atlas never auto-activates, imports packs, starts crawling, or includes private, invite-only, auth-gated, CAPTCHA-gated, raw payload, credential, or threat-actor-interaction sources.

Atlas export review is exposed at `POST /v1/sources/atlas/export`. It converts a selected atlas plan into dry-run review rows and source-pack manifest rows with source hashes, approval decisions, parser/scheduler/quality/release owners, approval route hints, rollback metadata, and no-import guardrails. This route is for operator/legal review and downstream source-pack preparation only. It never imports the manifest, mutates the registry, enqueues crawling, starts collection, silently activates candidates, or turns descriptor-only public channels into runnable sources without explicit approval.

Atlas Postgres readiness is modeled in `source_atlas_records`, `source_atlas_review_queue`, and `source_atlas_export_manifest`. These tables are staging and audit records for restart-safe operator review; they are not registry activation tables. Persisting an atlas record, review row, or manifest row must preserve `approvalRequired: true`, `autoActivationAllowed: false`, dry-run state, and no-crawl/no-import boundaries until a separate explicit operator/legal workflow approves a downstream source change.

Use `buildSourceMarketplaceApiResponse` or POST `/v1/sources/marketplace` for the analyst-operable source marketplace and parser capability matrix. The DTO exposes a 50-source safe-public rollout catalog across vendor blogs, advisories, RSS/security news, GitHub/security advisories, public research feeds, and government CERT sources. Every row includes source family, source type, trust/reliability, region, language, sector utility, parser profile, parser owner/support state, legal/robots review state, scheduler cost, expected evidence yield, duplicate rate, activation readiness, rollback/quarantine path, and Agent 02/03/04/06/07/09/10 handoffs. The parser matrix explicitly covers static HTML, RSS, dynamic pages, PDF/report parsing, public-channel boundaries, advisory/security APIs, and restricted metadata handoff. Unsupported classes such as private forums, credentialed/auth-gated targets, CAPTCHA/bypass flows, public chat sources, restricted raw payloads, and restricted metadata remain visible as exclusions, never one-click activations. The marketplace is dry-run-only: `willMutate: false`, `willStartCrawling: false`, no pack installation, no queue leasing, and no silent source activation.

Use `buildSourceActivationBatchApiResponse` or POST `/v1/sources/activation-batches` for operator decision packets that turn portfolio recommendations into runtime collection readiness. Each proposed safe-public source includes why it matters, expected coverage delta, adapter/parser owner, parser compatibility, expected cadence, estimated scheduler cost, max bytes, retention class, legal notes, legal/robots review state, rollback/quarantine state, and safe-public rationale. Activation batches are dry-run-only and non-crawling; parser gaps block activation instead of allowing snippet-only runtime degradation.

Use `buildSourceRuntimeSlaApiResponse` or POST `/v1/sources/runtime-sla` for production operator SLA checks before release. The DTO reports freshness, capture success ratio, parser compatibility, legal/robots review age, scheduler cost, evidence yield, claim yield, rollback, and quarantine state for each query-matching source. Remediation is dry-run-only and names the owning workstream for approved-source activation, noisy-source pause, quarantine, legal/robots review, cadence changes, duplicate retirement, Agent 03 parser-support requests, Agent 06 yield gaps, and Agent 10 release holds. It never mutates source state or starts crawling.

Task V promotion gates are included on each runtime SLA query and activation batch runtime SLA block. `sourceFamilyGate` enforces minimum safe-public source-family diversity for actor, ransomware/victim, CVE, sector, country, and malware/tool query classes. `promotionGate` converts SLA breaches into compact `pass`, `warn`, `hold`, or `rollback` decisions with owner-specific holds for Agent 02 scheduler cost, Agent 03 parser gaps, Agent 06 evidence/claim yield, Agent 01 legal/robots/source-family coverage, and Agent 10 quarantine rollback. `releasePacket` on `/v1/sources/runtime-sla` aggregates those query gates for release promotion without mutating queues, leases, sources, or crawl state.

Use `buildSourceCoverageCloseoutApiResponse` or POST `/v1/sources/coverage-closeout` for Task W query-family readiness and safe activation-wave planning. The closeout DTO emits dry-run activation waves for at least 50 safe public CTI sources across vendor blogs, advisories, RSS, GitHub/security advisories, public research feeds, and government CERT sources. Each wave source includes approval scope, legal/robots freshness, parser compatibility, scheduler budget, expected evidence yield, rollback/quarantine plan, and Agent 07/09/10 promotion impact. Restricted, private, leaked-file, auth, CAPTCHA, invite, and public-chat sources remain excluded from safe-public coverage.

Task X extends the same route-visible contracts with `executionReadiness` packets for first production rollout rehearsal. `/v1/sources/coverage-closeout`, `/v1/sources/activation-batches`, `/v1/contracts`, and `/v1/intel/search.sourceCoverage` now expose first-10 canary sources, a 50-source public rollout, excluded unsafe/parser-gap/duplicate source proofs, legal/robots proof age, Agent 03 parser ownership, Agent 02 queue budget impact, source retirement and duplicate-suppression dry runs, rollback/quarantine triggers, post-activation drift checks, and Agent 10 release-packet fields. These packets are execution-ready operator DTOs only: they do not mutate the registry, lease work, crawl sources, or admit restricted/private/leaked/auth/CAPTCHA/chat classes into safe-public coverage.

Task Z adds `rolloutPromotion` beside execution readiness for canary-to-expanded rollout promotion. The packet summarizes first-10 canary ids, 50-source rollout ids, rollback criteria, evidence-yield thresholds, Agent 02 cost controls, Agent 06 evidence certification, Agent 07 polling state, Agent 09 contract-index fields, Agent 10 canary/release decisions, source retirement, duplicate suppression, parser-gap handoff, and post-canary monitoring. It is safe-public-only and remains dry-run/non-crawling.

For runtime actor-query planning, source coverage DTOs also expose:
- `slo`: per-query enforcement-grade coverage SLO status for query class, active safe-public count, source-family diversity, freshness, geography/sector coverage, legal review, and robots review.
- `drift`: per-query SLO and governance drift with API-ready reason codes and dry-run remediation intent.
- `portfolio`: compact portfolio groupings for the query so `/v1/intel/search` can explain whether a partial result is blocked by source-family concentration, stale review, low reliability, missing actor/region/sector coverage, or extraction yield.
- `activationBatch`: compact dry-run source activation packet for the query, including operator legal/robots/parser decisions and Agent 02 scheduler-cost fields.
- `runtimeSla`: compact runtime SLA state for the query, including public/API impact, release-hold state, and dry-run remediation owners for Agent 01/02/03/06/10.
- `runtimeSla.promotionGate`: compact source SLA enforcement gate for release packets, including holds, warnings, repair packets, and Agent 10 release-decision fields.
- `coverageCloseout`: compact Task W query-family readiness, activation-wave ids, source-family gate state, and Agent 07/09/10 promotion impact.
- `eligibleSources`: active and approved-idle sources matching the query.
- `selectedSources`: the top active sources the planner can use immediately.
- `missingApprovedPublicSources`: safe-public pack candidates for missing actor or vertical coverage.
- `governanceDrift`: approval expiry, non-approved approval state, stale legal notes, missing/stale robots notes, degraded health, adapter mismatch, duplicate canonical URL, and source-pack version skew.
- `remediationPlans`: dry-run-only enforcement plans for activation, quarantine, cadence increase/reduction, legal review, adapter reassignment, duplicate retirement, and approved public source-pack additions.

Another CTI application should interpret coverage gaps this way:
- `activeSources`: evidence can be scheduled through normal approved collection paths.
- `approvedIdleSources`: collection may be scheduled after scheduler eligibility checks.
- `safeSourcePackRecommendations`: source onboarding candidates only; installing the pack creates candidates and does not crawl.
- `missingVerticals`: show operator-facing gaps such as vendor research, government advisories, public datasets, public-channel coverage, or restricted metadata.
- `forbiddenSourceClasses`: never offer one-click enablement; route to governance or keep disabled.

## Source Coverage SLOs
Use these source-coverage SLOs before promoting scraper-native actor search:
- High-priority actor queries require at least three active safe-public sources, two source families, current legal and robots review, fresh collection, and geographic plus sector coverage.
- Vulnerability queries require at least two active safe-public sources, two source families, current legal and robots review, and fresh government/public dataset style coverage such as CISA KEV or NVD.
- Ransomware/victim queries require at least three active safe-public sources, two source families, fresh public ransomware or incident reporting, and sector coverage, never leaked-file retrieval.
- Sector, country, and malware/tool queries require active safe-public coverage with family diversity; sector queries must expose sector coverage and country queries must expose geographic coverage.
- Public-channel and restricted-metadata verticals may appear as gaps; they must remain separate approval tracks.
- Governance drift should be zero critical items before activation and no warning item older than seven days without a review ticket.
- Restricted, leaked-file, private/forum, credentialed, chat, auth-gated, CAPTCHA-gated, or metadata-only sources never satisfy public-source SLOs even when they match the query. They can appear only as excluded drift or separate approval-track coverage.

Tenant boundaries:
- Coverage plans include only tenant-matching sources plus global sources.
- Safe source-pack recommendations inherit the requesting tenant only as dry-run candidate scope.
- Approval audit fields must include approval state, approval expiry, legal contact or ticket when required, legal notes review timestamp, and robots review timestamp for crawlable public sources.

## Registry Reconciliation
Run `buildSourceRegistryReconciliationReport` as a dry-run operational loop before changing source state. The report compares desired source-pack state, current registry state, adapter capability state, approval state, health state, scheduler state, and recent capture state.

Stable drift codes:
- `missing_approved_source`: desired safe-public pack source is absent from the registry.
- `approved_not_scheduled`: approved or active source is not visible in scheduler state.
- `active_unhealthy`: active source health is degraded, failing, or high-error.
- `active_no_recent_captures`: active source missed its recent-capture freshness window.
- `disabled_by_policy`: source is disabled, rejected, or policy-disabled.
- `expired_approval`: approval expiry has passed.
- `stale_legal_notes`: legal notes or terms review are stale.
- `duplicate_source`: tenant/type/canonical URL duplicates exist.
- `adapter_capability_mismatch`: source catalog compatibility or deployed adapter capability does not match.

Bulk review plans are dry-run-first and report `willStartCrawling: false`. They group safe operator actions: approve candidates, quarantine degraded sources, restore recovered sources, retire dead or duplicate sources, and request refreshed legal notes. Agent 02 skipped-source reasons should map scheduler-caused skips to these same drift codes where possible.

## Source Cutover Rehearsal
Run `buildSourceCutoverRehearsalReport` before promoting scraper-native search. The report combines activation coverage, reconciliation drift, dry-run source-pack install plans, source health, governance evidence, blockers, warnings, and a `source_cutover_ready` promotion gate.

Every recommended action gets governance evidence:
- who should approve it: source governance, legal, adapter owner, or scheduler owner;
- why the recommendation is safe;
- what collection would be enabled after approval;
- what remains disabled, including restricted raw payload collection and unsafe source classes;
- whether rollback or quarantine is recommended.

Agent 09 should expose compact cutover fields: state, query list, activation summaries/gaps, reconciliation summary, health summary, governance evidence, and promotion gate. It should suppress internal registry noise such as per-source reason strings, seed validation internals, and scheduler-state internals.

Agent 10 can consume `promotionGate.gate === "source_cutover_ready"` as a deployment promotion input. `promotionGate.proof.willStartCrawling` is always `false`; the rehearsal is observational and dry-run-only.

## Source Apply Plans
Use `buildSourceApplyPlan` to convert cutover rehearsal evidence into explicit dry-run mutation plans. Apply-plan generation never mutates registry state and reports `willMutate: false`.

Supported apply actions:
- `approve`: operator approval for safe-public candidates or source-pack candidates.
- `activate`: future operator-applied activation after prerequisites pass.
- `quarantine`: contain degraded or unsafe sources.
- `restore`: return recovered sources to controlled operation.
- `retire`: remove dead or duplicate sources from active use.
- `request_legal_notes`: request legal, approval, or adapter review.
- `leave_unchanged`: record that no source mutation is recommended.

Every apply item includes prerequisite checks, expected registry diff, rollback state, policy impact, collection impact, and an automation classification: `automation_safe`, `human_approval_required`, `blocked`, or `rollback_only`. Restricted and darknet metadata sources cannot be auto-activated; their plans keep restricted raw payload collection and automatic restricted-source activation disabled.

Use `executeSourceApplyPlanDryRun` only for dry-run previews. It returns would-apply/blocked results and explicitly reports `executed: false`.

## `/v1/sources/apply-plan` Contract
Use `buildSourceApplyPlanApiResponse` for the frozen source-admin DTO. The request shape includes tenant scope, query scope, source-pack ids, selected actions, `dryRun: true`, and optional execution preview. The response includes:
- `applyPlanId` for Agent 10 promotion packets as `sourceApplyPlanId`;
- action and automation summaries;
- approval counts, legal-review counts, blocked counts, and rollback-only counts;
- compact item rows with action, automation class, prerequisite failures, expected diff count, policy impact, collection impact, rollback state, and reason;
- optional dry-run execution preview;
- schema-ready examples for happy path, human approval required, blocked restricted source, duplicate source, stale legal notes, and rollback-only quarantine.

The API DTO always reports `willMutate: false` and `willStartCrawling: false`. It must not be used as an execution endpoint; future mutation endpoints need a separate explicit apply command and operator approval flow.

Agent 09 can mount `handleSourceApplyPlanRoute` behind `/v1/sources/apply-plan` without reading registry internals. The helper validates `queryScope.queries`, selected source apply actions, and dry-run-only semantics, then returns either the frozen contract plus apply-plan DTO or a safe error body with `bad_request`, `invalid_action`, or `dry_run_required`.

Use `sourceApplyPlanApiContract()` when exporting OpenAPI or JSON-schema-like route metadata. The contract lists supported request fields, item fields, allowed actions, automation states, forbidden mutation fields, and compact examples. The route must never apply review decisions, open a database transaction, mutate source records, lease frontier tasks, expose raw payloads, or start crawling.

Mounted endpoint proof:
- Local command: `bun run check:source-apply-plan`.
- Expected compact output: `ok=true`; `happy_path` returns HTTP 200 with `dryRun=true`, `willMutate=false`, and `willStartCrawling=false`; `blocked_restricted_source` keeps restricted activation and restricted raw payload collection disabled; `invalid_action` returns HTTP 400 `invalid_action`.
- The proof starts the Bun API server, posts to `/v1/sources/apply-plan`, and verifies source and frontier snapshots are unchanged.

## Health And Rollback
Adapter health signals should update `SourceHealth` and `SourceCrawlState`:
- repeated failures move active sources to `quarantined`;
- recovered sources return to `probation`;
- stale sources stay visible in activation reports;
- rollback reasons must be stored in catalog rollback metadata or review decisions.

Use `buildSourceHealthRollup` to summarize adapter observations before updating registry state. The rollup tracks success rate, HTTP status mix, parser warning count, median and p95 latency, freshness lag, changed-content rate, duplicate rate, policy-block rate, adapter failure categories, and the derived `SourceHealth` payload.

For Postgres persistence, map rollups with `sourceHealthRollupToRow` into `source_health_rollups`, and map source score snapshots with `sourceScoreHistoryRow` into `source_score_history`. These helpers intentionally return plain row-shaped objects so the future storage adapter can batch insert without changing the registry contract.

## Review Decisions
Use `SourceReviewDecision` for approval and containment:
- `approve`: records analyst/operator approval and optional expiry;
- `reject`: records a blocked source;
- `expire`: moves active reviewed sources back to `needs_review`;
- `quarantine`: contains a source without deleting it;
- `restore`: moves a recovered source back to a controlled lifecycle state.

## Coordination Notes
- Agent 02 consumes collection SLA, crawl cadence, budget class, and skipped-source reasons.
- Agent 03/04/05 provide adapter compatibility and source-specific health signals.
- Agent 06 consumes retention class.
- Agent 09 should preserve catalog metadata and activation report categories in source-admin and search APIs.
- Agent 10 should alert on health rollups, stale source rates, and quarantine events.
