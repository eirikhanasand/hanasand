# Value Program: Dark-Web Metadata Index And High-Value TI Source Atlas

This is not a product direction change. These are side data engines that make the original CTI scraper goal practical: richer source discovery, faster enrichment, better query routing, and a useful database of safe metadata. The north star remains the same: answer real CTI questions with provenance, freshness, confidence, and safety.

These tools exist to populate and assist the TI database. They should not become bloated standalone products. Build them as modular, API-friendly, periodically refreshed subsystems that feed the main scraper, source registry, evidence store, graph, and `/ti` search experience.

Safety and legality boundary:
- The dark-web index is expected to fetch hostile/dangerous pages because that is where the CTI value lives, but only inside disposable isolated collectors with locked-down egress, no shared credentials, no host mounts except a quarantine output boundary, JavaScript/active-content controls, content-size caps, and kill switches.
- The dark-web index is metadata-first. It may store onion/I2P/Freenet URL hashes, normalized host/path hashes, redacted display labels, title/landing-page summary where policy permits, category, language, first/last seen, liveness, source provenance, screenshot hash if approved, content hash, extracted actor/victim/TTP hints, and risk/legal classification.
- It must not download leaked files, credential dumps, databases, malware payloads, private messages, invite-only content, raw unsafe URLs in public API output, or interact with threat actors. If a page links to credentials/payload dumps, record the safe metadata and block the payload fetch.
- It must not bypass auth, CAPTCHA, robots/legal controls, paywalls, private communities, or access controls.
- “Legal” classification is a risk/legal triage label, not legal advice. Use labels such as `benign`, `news_or_research`, `marketplace_or_illicit`, `leak_or_extortion`, `malware_or_payload`, `credential_or_abuse`, `unknown_requires_review`, and `blocked_unsafe`.
- Public UI may show a redacted onion host reference or safe display label, not unsafe full raw URLs unless an explicit operator-only route is created with access control.

## Primary Owners

Agent 05 owns the dark-web metadata index.
- Goal: discover, dedupe, classify, summarize, periodically refresh, and search roughly 60k known onion/I2P/Freenet pages as metadata-only records.
- Product route target: `hanasand.com/ti/darkweb/index`.
- Scraper API target: route-visible dark-web index DTOs and search/list/status endpoints under `/v1/darkweb/*` or an existing restricted metadata namespace if cleaner.
- Storage target: modular TI datastore tables/contracts, not mixed into unrelated public-source state except through safe references.

Agent 01 owns the high-value TI source atlas.
- Goal: find, score, dedupe, and stage thousands of public CTI sources: vendor blogs, CERTs, advisories, GitHub security feeds, malware researchers, ransomware trackers, CVE feeds, threat reports, public datasets, public channels, and regional/sector sources.
- Output: source-pack import/canary plans that feed Agent 04 coverage/freshness and Agent 03 adapters.

## Support Ownership

Agent 02: periodic refresh scheduler, crawl budgets, queue partitions, duplicate run reuse, and 60k-index refresh cadence.
Agent 03: safe metadata collectors/parsers for public landing pages, reports, directories, onion descriptor fixtures, and source discovery pages.
Agent 04: useful-intelligence coverage scoring, query-class source gaps, and “does this source/index improve answers?” metrics.
Agent 06: TI database schema/read-model/search index/replay/retention for dark-web index and source atlas.
Agent 07: classification/evaluation quality, legality/risk triage labels, false-positive/false-claim review, analyst feedback.
Agent 08: graph links from dark metadata and source atlas to actors, victims, malware, TTPs, sectors, infrastructure, and STIX holds.
Agent 09: API contracts, public wrapper, `/ti/darkweb/index` frontend contract, route inventory, SDK/OpenAPI fixtures.
Agent 10: operations, resource budget, 24h refresh soak, release gates, safety incident drills, and deployment proof.

## Dark-Web Metadata Index Tasks

1. Define `DarkwebIndexRecord` with stable id, network, redacted display URL, raw URL hash, host hash, path hash, title, summary, category, legal/risk label, language, liveness, firstSeen, lastSeen, lastChecked, provenance, confidence, review state, blocked reason, screenshot hash, content hash, source discovery path, and retention class.
2. Define `DarkwebIndexSource` for directories, seed lists, analyst imports, public reports, safe search results, and internal discoveries.
3. Define `DarkwebIndexRefreshRun` with scheduler id, batch id, budget, checked count, live count, changed count, blocked count, review count, errors, and next cursor.
4. Define `DarkwebIndexClassification` labels and confidence rules.
5. Define `DarkwebIndexLegalTriage` labels: benign, research/news, likely illicit, leak/extortion, malware/payload, credential/abuse, unknown, blocked unsafe.
6. Define database migration/readiness for darkweb index records, sources, refresh runs, classification history, liveness checks, and review notes.
7. Add ingest path for known public onion lists and directories as metadata-only seeds.
8. Add dedupe by host hash, normalized URL hash, title hash, and redirect/canonical metadata.
9. Add safe summary extraction for landing pages where policy permits.
10. Add no-fetch mode for sources requiring legal/operator review.
11. Add blocked mode for unsafe raw-payload/download/credential/private targets.
12. Add periodic refresh scheduler plan: high-value weekly/daily, low-value monthly, dead sources delayed.
13. Add liveness states: live, dead, intermittent, blocked_by_policy, requires_review, unknown.
14. Add category taxonomy: forum, marketplace, leak/extortion, paste, directory, blog, research, email/contact, mirror, service, abuse, unknown.
15. Add search endpoint with query, category, risk, liveness, first/last seen, language, source, and review filters.
16. Add index status endpoint with counts, freshness, category distribution, blocked/review counts, and storage health.
17. Add operator-only raw hash lookup, not public raw URL exposure.
18. Add public UI DTO for `hanasand.com/ti/darkweb/index`.
19. Add frontend table contract: search box, filters, category chips, risk label, summary, last seen, liveness, provenance, review state.
20. Add safe detail drawer: summary, category, why classified, what was not collected, source provenance, refresh history, graph links.
21. Add “legal/risk triage” copy that is compact and avoids legal advice.
22. Add graph edges from darkweb index records to actor/victim/source claims only when reviewed or metadata-safe.
23. Add STIX/TAXII export hold: darkweb index records are descriptors only unless reviewed.
24. Add analyst review queue for unknown, likely illicit, leak/extortion, malware/payload, credential/abuse, and classification conflicts.
25. Add false-positive and benign-site review workflow.
26. Add duplicate/mirror clustering.
27. Add language detection and region hints.
28. Add screenshot hash-only handling where screenshots are approved.
29. Add retention/legal-hold behavior.
30. Add API regression tests proving no raw unsafe URL, credentials, leaked rows, object keys, or payloads leak.
31. Add seed fixture of at least 100 synthetic safe records across categories.
32. Add scale fixture for 60k records to test pagination/search/counts.
33. Add scheduler simulation for refreshing 60k records within resource budget.
34. Add deploy hygiene checks for darkweb index storage path/table readiness.
35. Add public page proof: `/ti/darkweb/index` renders and search/filter works.
36. Add curl proof for API darkweb index endpoint.
37. Add operations docs with refresh cadence and incident stops.
38. Add safety docs with prohibited operations.
39. Add “what was not accessed” field to UI/API.
40. Add monitoring alerts for unsafe target attempts, raw URL leaks, credential patterns, and private access attempts.

## High-Value TI Source Atlas Tasks

41. Define `TiSourceAtlasRecord` with URL, domain, family, query class coverage, language, region, sector, reliability, freshness, evidence yield, parser capability, legal/robots state, duplicates, and activation readiness.
42. Build curated source categories: vendor threat blogs, CERT/government, CVE/advisory, malware researchers, ransomware trackers, exploit intelligence, GitHub security advisories, package advisories, public datasets, regional cyber agencies, ICS/OT sources, cloud/SaaS security sources, phishing/brand abuse, public channel descriptors.
43. Add source discovery pipeline from curated lists, public reports, GitHub repos, awesome lists, OPML/RSS, vendor pages, and analyst imports.
44. Add dedupe by canonical domain/feed, content similarity, source owner, and mirror.
45. Add source score based on useful answer yield, freshness, uniqueness, reliability, parser success, legal/robots clarity, and source diversity.
46. Add source family coverage matrix by actor/ransomware/CVE/malware/country/sector/victim/infrastructure.
47. Add “thousands of sources” import plan with dry-run first-100/first-1000 batches.
48. Add activation canary from source atlas into source registry.
49. Add parser certification requirement per source.
50. Add scheduler budget estimate per source.
51. Add evidence storage estimate per source.
52. Add source retirement/degrade rules.
53. Add public answer impact estimate.
54. Add stale source detection.
55. Add high-value actor coverage requirements.
56. Add regional/sector coverage gap reports.
57. Add source atlas API route or extend source marketplace route.
58. Add source atlas UI/API DTO for future admin use.
59. Add fixtures for 500+ synthetic public sources.
60. Add scale fixture for 10k candidate public sources.
61. Add tests ensuring no private/invite/auth/CAPTCHA sources are auto-activated.
62. Add docs for source atlas operations.
63. Add update cadence and periodic discovery job plan.
64. Add source conflict/contradiction scoring.
65. Add source reliability economics dashboard.
66. Add source atlas export/import JSON schema.
67. Add operator approval packet for batch activation.
68. Add rollback packet for source batch deactivation.
69. Add integration with Agent 04 coverage freshness.
70. Add integration with Agent 03 adapter certification.
71. Add integration with Agent 07 quality scorecards.
72. Add integration with Agent 10 release gates.

## Cross-Agent Implementation Tasks

73. Update `coordination_agent_05.md` as dark-web index owner.
74. Update `coordination_agent_01.md` as TI source atlas owner.
75. Update Agent 02 with refresh/cadence budget tasks.
76. Update Agent 03 with collector/parser tasks.
77. Update Agent 04 with value/coverage scoring tasks.
78. Update Agent 06 with DB/search/replay tasks.
79. Update Agent 07 with risk/legal/eval tasks.
80. Update Agent 08 with graph/STIX tasks.
81. Update Agent 09 with API/UI tasks.
82. Update Agent 10 with ops/soak tasks.
83. Add route inventory entries for darkweb index endpoints.
84. Add contract index entries for darkweb index and source atlas.
85. Add API regression sentinel checks.
86. Add SDK fixtures.
87. Add frontend route contract for `/ti/darkweb/index`.
88. Add public page implementation in the web/API app.
89. Add service-to-service API wrapper if needed.
90. Add deployment proof commands.

## Product Acceptance

91. A user can open `hanasand.com/ti/darkweb/index`, search metadata records, filter by category/risk/liveness, and read a compact safe summary.
92. A CTI operator can see how many darkweb records are indexed, when they were last checked, what is blocked, what needs review, and what changed.
93. The system can ingest and stage thousands of public TI sources without activating unsafe sources.
94. The main `/ti` search can use source atlas/source-gap intelligence to find useful public evidence beyond seeded summaries and generic web pages.
95. The scraper remains modular: darkweb index, source atlas, scheduler, evidence, API, frontend, graph, and ops are understandable and separately testable.
