**Verdict**

**Commercial acceptance: reject. Overall readiness: 3/10.**  
Reviewed production commit `1295a9d9` on 20 July 2026, including code, API behavior, PostgreSQL structures and records, runtime containers, desktop/mobile frontend, and operational artifacts.

This is an unusually extensive engineering prototype with a polished interface. It is not yet a functioning commercial threat-intelligence product, and the thesis evaluation does not currently support its research claims.

**Blockers**

1. **The paid product’s central workflow has never operated in production.** The database contains `0` organizations, watchlists, alerts, webhook destinations, webhook deliveries, and analyst claim reviews. All 2,569 claims remain unreviewed. Nevertheless, pricing advertises email notifications and structured alert exports, while the developer page presents a synthetic webhook payload as a product capability: [pricing/page.tsx](/Users/eirikhanasand/Desktop/personal/hanasand/frontend/src/app/pricing/page.tsx:15), [developers/page.tsx](/Users/eirikhanasand/Desktop/personal/hanasand/frontend/src/app/developers/page.tsx:38).

2. **The accuracy evaluation is circular and academically inadequate.** Production has 624 true-positive labels, one false positive, no false negatives, and no true negatives. Six hundred labels derive expected values from CISA KEV fields and compare them with an extractor reading those same fields: [bootstrap-authoritative-evaluation.ts](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/scripts/bootstrap-authoritative-evaluation.ts:3). The metric implementation itself admits that recall and alert latency are unmeasured: [evaluationMetrics.ts](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/src/pipeline/evaluationMetrics.ts:54). Precision/recall results from this corpus cannot validate real-world extraction accuracy.

3. **“Real-time” and coverage claims are not demonstrated.** Of 1,142 globally registered sources, only 23 have ever been attempted and 17 captured. Actual global coverage is eleven RSS, two API, two Telegram, one static-web, and one Tor source. Global median publication-to-collection latency is 5,233,329 seconds, approximately 60.6 days; p95 is about 137.6 days. No timeliness record has `reported_at` or `alerted_at`, and 358 records have visibility timestamps preceding processing. Eight runs remain `running` and six public searches remain `queued`.

4. **The production dataset is not sufficiently APT-focused or clean.** Only 2 of 155 actor profiles are classified as APTs; 143 are generic threat actors and 10 ransomware groups. Duplicate normalized profiles include Akira four times and LockBit twice. Misclassified actors include `Unsafe`, `Payload`, and `Ransomware.live Victim Feed`. The schema permits duplicate names across actor types: [006_threat_intelligence_store.sql](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/migrations/006_threat_intelligence_store.sql:134).

5. **Entity extraction remains primarily deterministic keyword matching.** Actors come from a static alias table, while malware, countries, sectors, and TTPs are fixed lists and regexes: [extractors.ts](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/src/pipeline/extractors.ts:7). This explains generic results such as 396 identical `new victim claim` dataset entities and weak TTPs such as “ransomware activity.”

6. **Public search is not reliably backed by the automated pipeline.** Every query creates an `entityType: actor` collection request, including domains and companies, but the six public-query runs are still queued: [search.ts](/Users/eirikhanasand/Desktop/personal/hanasand/api/src/utils/ti/search.ts:718). Results instead come from live clear-web search and hardcoded profiles: [search.ts](/Users/eirikhanasand/Desktop/personal/hanasand/api/src/utils/ti/search.ts:921), [search.ts](/Users/eirikhanasand/Desktop/personal/hanasand/api/src/utils/ti/search.ts:1710). Searching `microsoft.com` visibly produced an “Actor country map,” attribution, motivation, and TTP profile from generic Microsoft news: [pageClient.tsx](/Users/eirikhanasand/Desktop/personal/hanasand/frontend/src/app/ti/pageClient.tsx:303).

7. **The public API is commercially unsafe and undocumented.** An unauthenticated batch request accepts 1,000 searches with concurrency ten: [search.ts](/Users/eirikhanasand/Desktop/personal/hanasand/api/src/handlers/ti/search.ts:20). Production treated ordinary external traffic as internal at 6,000 requests/minute, and `X-Forwarded-For: 127.0.0.1` can select that tier because the header is trusted directly: [rateLimit.ts](/Users/eirikhanasand/Desktop/personal/hanasand/api/src/plugins/rateLimit.ts:215). Search responses are marked cacheable for one hour: [default.vcl](/Users/eirikhanasand/Desktop/personal/hanasand/api/default.vcl:35). `/developers` contains no endpoint reference, authentication instructions, schemas, versioning, OpenAPI document, error contract, or working integration example.

8. **The thesis’s business analysis objectives are largely labels, not analysis.** Production contains only nine buyer/seller communication records, all saying a chat endpoint exists; nine identical monetization-path records; and profitability records based on victim-list counts. The code explicitly acknowledges that these do not establish payments, revenue, or profit: [sourceSpecificExtraction.ts](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/src/pipeline/sourceSpecificExtraction.ts:16). There is no analysis of conversations, buyer behavior, pricing, conversion, payments, or how publicity affects profitability.

9. **Operational maturity is below a sellable standard.** The scraper is allocated 96 GB RAM while configured with a 160 GB ceiling beyond its container limit: [docker-compose.yml](/Users/eirikhanasand/Desktop/personal/hanasand/docker-compose.yml:299). Collection cycles showed approximately 95% duplicates and often only one new capture. A good backup/restore script exists, but production has only one manual backup and no scheduled TI backup: [threat-intel-backup.sh](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/scripts/threat-intel-backup.sh:25).

**Frontend Assessment**

The `/ti` interface is visually polished, responsive, keyboard-accessible, and usable on desktop and mobile. Evidence boundaries and metadata-only wording are generally responsible.

In practical use, results changed materially between reloads, duplicated incidents appeared, APT29 data was months old, domains were presented as threat actors, and source links frequently used Google News redirects or generic MITRE pages. `/developers` and `/dwm` are mainly product presentation and examples, while pricing routes every tier to a contact form rather than functional onboarding.

**What Is Strong**

The normalized PostgreSQL schema, provenance links, retention controls, tenant boundaries, metadata-only dark-web handling, and avoidance of stolen-data redistribution are solid foundations: [006_threat_intelligence_store.sql](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/migrations/006_threat_intelligence_store.sql:32). All 1,177 captures correctly had no inline body; sensitive captures were metadata-only. Ethics and evidence safety are the strongest parts.

Type checking passes, as do 611 scraper tests. Four actual PostgreSQL integration tests are skipped unless `TI_TEST_DATABASE_URL` is provided: [postgresScraperStore.test.ts](/Users/eirikhanasand/Desktop/personal/hanasand/ti/scraper/src/tests/postgresScraperStore.test.ts:134). The frontend Playwright suite could not start its managed API server within 120 seconds.

**Acceptance Decision**

The system partially satisfies pipeline, database, JSON output, extraction, and public-interface requirements. It fails commercial acceptance on alert delivery, customer onboarding, independent accuracy validation, demonstrated timeliness, meaningful APT coverage, data quality, API security/documentation, and the thesis’s business-model analysis.

Before sale or thesis acceptance as a finished product, it needs an independently labeled benchmark, live watchlist-to-alert-to-delivery evidence, corrected source/run accounting, entity resolution and analyst review, trustworthy timeliness measurements, materially broader active APT/Telegram/dark-web coverage, and a hardened documented API.
