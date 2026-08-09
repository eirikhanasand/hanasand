# Public Telegram source completion goal

## Objective

Maintain at least 100 independently useful, lawful public Telegram feeds in production. Discovery continues while the live qualifying count is below 100.

## Live baseline

Measured from PostgreSQL, the source-operations API, and the native scheduler on 2026-08-09T15:54Z after repairing collection, review, and durable-write throughput:

- the canonical global fleet has 61 registered `telegram_public` rows: 26 active/executable, 26 candidate, 2 rejected, and 7 retired; 116 separate `default`-scoped legacy rows are retired and are not global coverage;
- 17 canonical global rows satisfy the full qualifying-count contract, leaving 83 to reach the Telegram objective; the other 9 active rows remain executable legacy sources but do not satisfy the current two-cycle, evidence-bound qualification contract;
- seed import was not the main bottleneck. A `needs_review` result copied its review cooldown into scheduler `crawlState`, preventing the newer retained evidence needed for the next review. The repair keeps the review timer in `automaticSourceReview.nextReviewAt`, clears only legacy review-created crawl backoff, and preserves HTTP, rate-limit, and collection backoff;
- all 8 affected Telegram candidates became scheduler-eligible without changing their review due dates. Native run `canary-run_758cd0e2fd5979dc` leased them and persisted truthful HTTP/parser/capture outcomes; Alexander Leonov then reached a second productive cycle, passed evidence-bound review, and became the 17th qualifying Telegram source, while duplicate-only and parser-low-yield rows remained candidates;
- `src_lukas_stefanko_android_malware_telegram` then reached two distinct productive scheduled cycles and was automatically promoted to one global `active`, executable, `productionCollection=true`, `countsAsCoverage=true`, `sustained_productive` identity. It has 21 retained captures, 6 scheduled health rows, 2 productive cycles, 99 duplicates, and zero parser warnings;
- `src_ransomfeed_ransomware_telegram` and `src_threat_hunting_father_telegram` remain candidates truthfully: each has one productive cycle, followed by duplicate-only or parser-low-yield checks. Registration and a successful public preview do not reduce the gap;
- a second production failure appeared after collection: a variable-arity PostgreSQL `IN` query collided with a prepared statement and left 1,327 writes pending. The shared query now uses one stable `ANY($1::text[])` statement with an explicitly encoded PostgreSQL array literal. Final scheduler run `canary-run_ed647af1a403b9f4` completed 18/18 tasks with 0 failures, 2 new captures, 26 duplicates, no retries, and storage drained to 0 pending writes;
- one clean restart reported `importedSourceCount=0` and `updatedSourceCount=0`. The final current-main restart imported 8 disjoint dark-web candidates and updated 0 rows; the global Telegram counts and IDs remained exactly 61/25/27/2/7 with no channel duplicate or Telegram bootstrap churn;
- all 53 retained objects and all 53 safe excerpts from the three newest channels passed the shipped Telegram sanitizer residual scan and object SHA-256 verification: 0 unreadable objects, 0 hash mismatches, and 0 residual email, contact, credential, token, or phone matches; and
- canonical checkout `6f48eb19e4148549504a854fd405c24cd67981ea` runs scraper image `sha256:1f64d3024f8539425dd21b5f9fa9ed82edc8e8fe611f1e09cd0616c0f1860e20`, containing the scraper repair from `15d6120e6e4a84396d72f4928dce3b49f8bf65fa`, healthy with restart count 0 since 2026-08-09T15:28:37Z. The authenticated source-operations API reports 85/85 executable global sources, 28 qualifying clear-web sources, and 17 qualifying public Telegram sources.

The next promotion queue is evidence-driven, not a raw-source target. Approved one-cycle candidates need a second naturally new retained item; uncertain reviews need new retained evidence before re-review. Duplicate-only checks, successful empty parses, and repeated copies must continue to record health without being counted as productive coverage.

### 2026-08-09T16:20Z production follow-up

- Canonical production commit `5595546ab34be1123e8ad9f925d2031364df2945` imported the DCiber and REDSEG candidates globally. The measured fleet is now 63 registered, 26 active, 28 candidate, 2 rejected, and 7 retired; 17 still satisfy the strict qualification contract.
- Native scheduled run `canary-run_f8de0fa79a8877d7` completed both new sources over HTTP 200 with 20 parsed items each, 2 retained captures each, zero parser warnings, zero duplicates, and no retry. REDSEG recorded its first useful scheduled cycle; DCiber's healthy capture was not useful, so neither was promoted.
- The write queue rose to 6,662 during post-restart processing and then drained to zero without a writer error, confirming the stable PostgreSQL array-query repair under real backlog. A later serialized scraper restart at `5595546a` reported `importedSourceCount=0`; global Telegram counts remained 63/26/28/2/7 and strict coverage remained 17.
- That restart's first global run `canary-run_61d2c721e68ccfd` completed 38/38 tasks with zero failures, 56 duplicate captures, and no retry. Duplicate-only work recorded health but did not create false productive cycles or increase coverage.
- A separate endpoint-identity defect remains outside the Telegram-owned files: retired `default` rows `src_dwm_tg_seed_3350ee2e45907a1c`, `src_dwm_tg_seed_eeab7dacdf627ceb`, and `src_dwm_tg_seed_ce1eadd686201526` still own The Hacker News, ANY.RUN, and BleepingComputer endpoints. `sourceBootstrap.ts` permits a new global owner to supersede a retired tenant duplicate only for Tor; a global Telegram portfolio candidate instead selects the retired row, fails the safe-upgrade check, and is skipped. The smallest shared hook is to extend canonical global-owner reconciliation to current, low-risk, approved `public_http` Telegram portfolio candidates, insert one global stable identity, and leave the tenant duplicate retired. Until that shared hook has its own global-versus-tenant restart regression, these endpoints remain excluded rather than being re-registered under alternate URLs.

### 2026-08-09T20:21Z production recovery acceptance and open qualification gap

- Candidate commit `40e2e6a16701b3bdaee8abc1ed768ac3e4979bdc` added the independently verified `avleonovcom` and `maldevcc` global public-preview sources. MalDevCC recorded its first useful retained scheduled cycle; Leonov, DCiber, and REDSEG recorded truthful healthy or duplicate-only outcomes but have not satisfied the two-useful-cycle contract. They remain zero coverage credit.
- The source packs were not silently ignored. They intentionally register candidates, while production credit requires two distinct useful retained run-linked cycles plus evidence-bound automatic review. Conversion then stalled behind shared runtime defects: review cooldown leaked into collection backoff, one malformed review blocked review work, duplicate captures invoked hosted exposure parsing, PostgreSQL writes collided or starved behind unbounded reads, live search kept writing plans under storage pressure, and feed discovery treated its own undurable writes as external backpressure.
- The shared repairs now keep review and collection cadence separate, skip malformed review rows, avoid exposure parsing for duplicates, use stable PostgreSQL write/read paths, return `search_unavailable` while the bounded index warms, honor planner/storage deferral, and flush discovery before canonical collection without weakening backpressure. No source was manually promoted and no qualification predicate was relaxed.
- Production runs exact `e807270c4964b534b395ad8d4bb9f12ee26dd40c` in container `e55cce0771f…` on image `sha256:9f168ead6836…`, healthy with restart count 0 and OOM false since 2026-08-09T20:07:36Z. Bootstrap reported 1,782 total sources, 7 imports, and 0 errors; that import counter is telemetry, not coverage credit.
- Three natural global cycles completed successfully. The first completed 60/60 tasks with 0 failures, persisted 20 novel and 98 duplicate captures, and created only 2 exposure claims from novel items. The final cycle completed 13/13 with 0 failures, 0 remaining, 0 inserts, 26 duplicates, and `exposureClaimCount=0`, proving duplicates do not trigger hosted exposure work.
- The default retry ended truthfully degraded on its existing run with 1 completed, 1 failed, 0 remaining, and 0 exposure claims. It was neither dropped nor relabeled as a success.
- Final storage health was HTTP 200 with `pendingWrites=0`, no last-write error, an empty task queue, a ready search index, and PostgreSQL at 0 active/0 waiting sessions after coverage reads. Internal coverage completed in 769 ms and public coverage in 798 ms; both reported the same 1,452 registered, 85 executable, 80 ever-useful, and 49 strictly qualifying sources.
- Strict family qualification remains 28 clear-web, 17 public Telegram, and 4 lawful Tor. Telegram therefore remains 83 short of its 100-source objective. The prior ever-useful count rose from 79 to 80 only because a natural cycle persisted novel evidence; strict coverage did not rise.
- The previously verified immutable Telegram objects and safe excerpts still passed SHA-256 verification, sanitizer idempotence, and residual email, bot-token, credential, and phone scans. The shipped collector continues to retain only minimized public-preview text and never fetches linked samples or private/restricted content.
- A separate endpoint-identity issue remains: retired `default`-tenant rows still own the otherwise valid The Hacker News and ANY.RUN Telegram endpoints. Do not add alternate global duplicates. Reconsider them only after shared canonical-owner reconciliation has an explicit global-versus-tenant restart proof.

The next accepted evidence is source-specific, not another fleet-level successful run. MalDevCC needs one more distinct useful retained cycle plus evidence-bound approval; Leonov needs approval followed by two useful retained cycles; DCiber and REDSEG need useful retained cycles rather than duplicate-only health. Continue bounded publisher-authoritative discovery in parallel, but never substitute pack size, candidate count, test fixtures, injected fetches, or status labels for production qualification.

Replace this section after every deployment with the current database/API measurement and deployed commit.

## Latest bounded discovery ledger

The 2026-08-09T15:47Z–16:04Z iteration accepted two unreleased, non-coverage candidates on the current Telegram feature branch:

- `src_dciber_brazil_telegram` is the exact `https://t.me/dciber` channel linked by Instituto de Defesa Cibernetica's first-party organization page. The shipped public-preview adapter parsed 20 posts, classified 3 as useful, observed a latest post at 2026-08-03T19:45:54Z, and found zero sanitizer-idempotence or residual PII/credential matches. It remains `candidate`, `productionCollection=false`, and `countsAsCoverage=false` until deployment, two useful scheduled retained-capture cycles, and review approval.
- `src_redseg_latam_telegram` is the exact `https://t.me/redseg` channel linked by REDSEG LATINOAMERICA's CIBERSEG incident-response organization page. The shipped adapter parsed 20 posts, classified 5 as useful, observed a latest post at 2026-08-09T15:33:24Z, and found zero forwarded-message markers, sanitizer-idempotence failures, or residual PII/credential matches. It remains candidate-only under the same production qualification contract.

Explicit exclusions from the same pass:

- ANY.RUN had strong current yield and a current first-party ownership link, but `https://t.me/anyrun_app` already exists in the retired `default`-tenant legacy catalog under a different source identity. Adding a global copy would violate endpoint deduplication; migrate the legacy identity through the shared source-lifecycle owner before reconsidering it.
- `https://t.me/thecybershafarat` was first-party but stale and non-useful: 2 parsed posts, 0 useful, latest 2026-02-04T17:05:31Z.
- `https://t.me/senq_cyber` was first-party but parsed 0 posts and produced 0 useful items.
- `https://t.me/UAEcybersecurity` parsed 3 stale posts, produced 0 useful items, and had no current activity after 2025-12-30.
- `https://t.me/vxunderground` was current and parser-useful, but no exact first-party publisher reference to that Telegram endpoint was verified in this pass.
- `https://t.me/s2wdailybrief` had an exact current S2W ownership reference but produced 0 useful items across 20 parsed posts; its latest preview post was 2026-07-13T09:36:40Z.
- `https://t.me/kryptonite_channel` was current but produced 0 useful items across 15 parsed posts.
- `https://t.me/CyberSecurityIL` produced only 1 useful item across 17 parsed posts and predominantly linked third-party news, so it failed the independent-yield boundary.
- Singapore PDPC's `https://t.me/pdpcsg` parsed 8 posts but was inactive after 2025-10-31 and produced 0 useful items; the government-linked `https://t.me/ncpcscamalert` parsed 0 posts.
- Resecurity, CloudSEK, ThreatMon, Singapore CSA, CERT Polska, Oman CERT, and Jordan NCSA handle guesses resolved only to landing/empty previews or lacked exact ownership evidence; none were registered.

The 2026-08-09T16:30Z–16:36Z iteration checked 262 first-party publisher homepages and accepted two more non-coverage candidates:

- `src_alexander_leonov_english_telegram` is the exact `https://t.me/avleonovcom` English research channel linked by Alexander Leonov's first-party site. The shipped parser retained 20 current posts, classified 7 as useful, observed a latest post at 2026-08-07T15:48:16Z, and found zero sanitizer-idempotence or residual PII/credential matches. This is a distinct English vulnerability-research feed, not a copy of the already-qualified Russian-language `avleonovrus` endpoint.
- `src_zhassulan_maldevcc_telegram` is the exact `https://t.me/maldevcc` channel linked in current first-party posts by independent malware researcher and Malpedia contributor Zhassulan Zhussupov. The shipped parser retained 16 posts, classified 13 as useful, observed a latest post at 2026-08-08T20:13:52Z, and found zero sanitizer-idempotence or residual PII/credential matches. Collection remains public-preview text only; linked samples and proof-of-concept files are never fetched.

Explicit exclusions from this iteration:

- The Hacker News parsed 20 posts with 12 useful and ANY.RUN parsed 19 with 7 useful; both have exact current first-party ownership evidence, but both collide with retired tenant-scoped endpoint owners and therefore remain blocked on the shared canonical-owner hook above. BleepingComputer parsed 20 posts with 17 useful, but its current first-party site did not link the exact Telegram endpoint, so ownership was not established.
- `https://t.me/w2hack` parsed 18 posts, produced 0 useful items, and was inactive after 2026-06-03.
- First-party RUSCADASEC portfolio links `ruscadasec`, `scadasecbr`, `yayca`, and `TG_3side` returned empty previews; `shipulin_anton` was stale after 2022; `zlonov`, `luntry_official`, `osint_mindset`, and `avleonovnews` were current but produced zero independently useful items or copied aggregated publisher news. `soxoj` was empty.
- `https://t.me/avleonovnews` produced 20 parser-useful current items but is an aggregation stream of other publishers; it was rejected as copied/generated padding.

Keep this ledger append-only per bounded discovery iteration so rejected endpoints are not repeatedly guessed and accepted candidates are never mistaken for coverage.

The 2026-08-09T20:39Z iteration accepted one more non-coverage candidate:

- `src_hispasec_unaaldia_telegram` is the exact `https://t.me/unaaldia` channel linked by Hispasec's first-party Una al Dia publication. The shipped public-preview adapter parsed 20 current posts, classified 10 as useful, observed a latest post at 2026-08-07T14:57:03Z, and found zero sanitizer-idempotence or residual email, bot-token, and credential matches. It remains `candidate`, `productionCollection=false`, and `countsAsCoverage=false` until governed approval and two distinct useful retained scheduled cycles.

Explicit exclusions from this iteration:

- `https://t.me/siberbulten` had an exact first-party Siber Bulten reference but its public preview parsed 0 items and produced 0 useful items.
- `https://t.me/cyberthint` had an exact current first-party reference in Cyberthint's 2026 threat-intelligence report but its public preview parsed 0 items and produced 0 useful items.
- `https://t.me/hackplayers` had a first-party Hackplayers reference but its public preview parsed 0 items and produced 0 useful items.
- `https://t.me/dragonjar` parsed 20 current posts but produced 0 useful items through the shipped classifier.
- `https://t.me/elcomsoft` parsed 20 posts but produced only 1 useful item and lacked a current exact first-party endpoint reference in this pass.
- `https://t.me/criptored` parsed 0 items and produced 0 useful items.
- Ransomware.live's current first-party homepage exposed no exact public Telegram endpoint, so no handle guess was registered.

The 2026-08-09T20:49Z–20:51Z iteration accepted one more non-coverage candidate:

- `src_cyber_bro_uzbekistan_telegram` is the exact `https://t.me/cyberbrosecurity` channel linked by CYBER-BRO's first-party website. The shipped public-preview adapter parsed 9 current posts, classified 1 as useful, observed a latest post at 2026-08-08T10:37:52Z, and found zero sanitizer changes, sanitizer-idempotence failures, or residual email, bot-token, credential, and phone matches. The useful item is CYBER-BRO's own Uzbek-language analysis of AI-enabled phishing and malware threats, providing original Central Asian regional-language coverage rather than copied news. It remains `candidate`, `productionCollection=false`, and `countsAsCoverage=false` until governed automatic review and two distinct useful retained scheduled cycles.

Explicit exclusions from this iteration:

- INCIBE's exact first-party `https://t.me/ProtegeTuEmpresa` channel parsed 20 posts but produced 0 useful items and was inactive after 2024-06-25.
- Indonesia BSSN/BSrE's exact first-party `https://t.me/bsreupdate` channel parsed 20 posts but produced 0 useful items and was inactive after 2026-02-20.
- Armenia's Ministry of Internal Affairs homepage linked the exact `https://t.me/cyberpolice_arm` endpoint, which parsed 19 current posts through 2026-08-08 but produced 0 useful items. The shared sellable-intel classifier lacks Armenian threat terminology; no source-ID fallback or fabricated search query was added in this Telegram-owned lane.
- Romania's first-party Security Patch site linked `https://t.me/PatchSecurity`, but its public preview parsed 0 items. The first-party elhacker.NET forum linked `https://t.me/elhackerdotnet`, whose public preview also parsed 0 items.
- `https://t.me/EsGeeks` had exact first-party ownership and parsed 20 current posts with 6 classifier-useful items, but five were summaries of third-party publishers rather than independent reporting. Numeric sanitizer residual matches were reviewed as CVE identifiers, a GitHub username, and dates—not phone PII—but the channel was still rejected as copied aggregation rather than source-family expansion.
- deepdarkCTI exposed only a request-access Telegram group, not an unauthenticated public channel. RansomLook and Ransomware.live exposed no exact first-party public Telegram endpoint, so no handle guesses were registered.

The 2026-08-09T19:30Z–20:15Z iteration accepted eleven more non-coverage candidates:

- `src_codeby_security_telegram` is the exact `https://t.me/codeby_sec` endpoint linked by Codeby's first-party website. The shipped adapter parsed 20 current posts, classified 2 as useful, observed a latest post at 2026-08-08T09:01:19Z, and found zero sanitizer changes, sanitizer-idempotence failures, or residual email, bot-token, and credential matches. Both useful posts link back to Codeby's own current vulnerability analyses rather than copied publisher articles. It remains `candidate`, `productionCollection=false`, and `countsAsCoverage=false` until governed review and two distinct useful retained scheduled cycles.
- `src_eset_ukraine_telegram` is the exact `https://t.me/eset_ua_news` endpoint linked by ESET Ukraine's first-party website. The shipped adapter parsed 20 posts, classified 2 current Ukrainian items as useful, observed a latest post at 2026-07-17T08:25:12Z, and found zero sanitizer changes or idempotence failures. The retained candidates include ESET's own malware telemetry and phishing analysis. It remains candidate-only under the same production qualification contract.
- The binding source-selection correction was applied before publication: a fixed bounded classifier result is evidence, not a candidate-admission gate. Nine additional exact first-party security/vendor endpoints were therefore retained as candidates after the shipped adapter parsed current public-preview text with zero sanitizer changes, zero sanitizer-idempotence failures, and zero residual email, bot-token, or credential matches. Their bounded samples classified zero items as useful, so they receive zero coverage credit and must prove useful retained yield through governed scheduled collection:
  - `src_stormwall_ddos_telegram` — `https://t.me/stormwallpro`, linked by `https://stormwall.pro/`; 10 parsed, latest 2026-08-05T10:51:00Z.
  - `src_rvision_security_telegram` — `https://t.me/rvision_pro`, linked by `https://rvision.ru/`; 10 parsed, latest 2026-08-06T08:17:01Z.
  - `src_jet_infosystems_telegram` — `https://t.me/jetinfosystems`, linked by `https://jet.su/`; 20 parsed, latest 2026-08-07T14:50:31Z.
  - `src_k2_tech_security_telegram` — `https://t.me/k2_tech`, linked by `https://k2.tech/`; 4 parsed, latest 2026-08-07T06:44:50Z.
  - `src_security_code_telegram` — `https://t.me/Kodnaprovode`, published by `https://www.securitycode.ru/`; 20 parsed, latest 2026-08-06T12:01:12Z.
  - `src_aktiv_security_telegram` — `https://t.me/aktivcompany`, linked by `https://www.aktiv-company.ru/`; 13 parsed, latest 2026-08-06T10:40:17Z.
  - `src_phishman_security_telegram` — `https://t.me/cyberphishman`, linked by `https://phishman.ru/`; 7 parsed, latest 2026-08-06T09:31:36Z.
  - `src_cryptopro_security_telegram` — `https://t.me/cryptopro_news`, linked by `https://www.cryptopro.ru/`; 18 parsed, latest 2026-07-26T11:39:02Z.
  - `src_tsarka_certkznews_telegram` — `https://t.me/certkznews`, linked by `https://cybersec.kz/`; 12 parsed, latest 2026-08-06T09:38:31Z. This supersedes the historical endpoint exclusion with current exact first-party ownership and parser evidence; it does not grant production or coverage status.

Explicit exclusions from this iteration:

- `https://t.me/it_law_security` produced 1 useful item across 20 posts, but it was secondary reporting about Qilin rather than independently produced threat intelligence.
- `https://t.me/HackYourMom` produced 1 useful item across 18 current posts and `https://t.me/cybercalm` produced 5 across 20, but both primarily summarized third-party reporting. They were rejected as secondary-news padding rather than independent source-family expansion.
- `https://t.me/cyberseckz` parsed 0 public-preview items. `https://t.me/jetinfo`, CyberSec_TR, Cyber Cache, Dr.Web, Kaspersky ICS, ThreatMon, Enigma Security, and INCIBE's ProtegeTuEmpresa were stale or empty. SecureByte, ZeroDayResearch, and Malpedia lacked a current exact first-party endpoint reference. ImMALWARE's bounded payload retained a credential-pattern residual and was excluded as unsafe. Guessed vendor handles with no first-party endpoint evidence were not registered.
- Generic Global CIO and TAdviser channels were excluded as irrelevant general-IT media, not because of classifier yield. CryptoPro was reassessed as a first-party security vendor and imported candidate-only above.
- The examined national CERT/government portfolios in Brazil, Chile, Colombia, Moldova, Georgia, Kyrgyzstan, Poland, Saudi Arabia, Qatar, Oman, Bahrain, Kuwait, Pakistan, Malaysia, Thailand, and Singapore exposed no exact current public Telegram feed that also produced useful adapter yield.

The 2026-08-09T21:34:45Z regional/government reassessment accepted two more non-coverage candidates under the corrected candidate-admission rule:

- `src_armenia_cyberpolice_telegram` is the exact `https://t.me/cyberpolice_arm` channel linked by Armenia's Ministry of Internal Affairs launch notice, which states that the ministry's Cybercrime Department operates it. The shipped adapter parsed 19 current Armenian posts through 2026-08-08T08:02:58Z. The bounded fixed-term classifier returned 0 useful items, while sanitizer change, sanitizer-idempotence failure, residual email, bot-token, and credential counts were all zero. This supersedes the earlier classifier-only exclusion; the row remains candidate-only and receives no qualification credit.
- `src_s2w_dailybrief_telegram` is the exact `https://t.me/s2wdailybrief` endpoint linked by S2W's first-party launch notice and described there as an expert-curated dark-web and Telegram threat brief. The shipped adapter parsed 20 English posts through 2026-07-13T09:36:40Z. The classifier returned 0 useful items and every sanitizer/residual count above was zero. The latest item was still within the 30-day activity window at verification but is near expiry, so governed scheduled evidence—not registration—must decide whether it remains productive.
- The preceding eleven-source batch had recorded local CEST observation times with a `Z` suffix. Those five provenance fields per source were corrected by subtracting two hours (`21:40Z`→`19:40Z`, `22:10Z`→`20:10Z`, and `22:15Z`→`20:15Z`). Item counts, latest publication times, endpoints, and qualification state did not change.

Explicit exclusions from this reassessment:

- `https://t.me/dsszzi_official` is exact, current, and first-party, but it already exists globally as active production source `src_ssscip_cert_ua_telegram` in `verified_long_lived_sources.json`; no duplicate identity was added.
- DragonJAR remained parser-positive and current, but this pass found only third-party directory results and the channel's self-description, not an exact link from the first-party publisher site. It remains unregistered until that ownership edge is independently verifiable.

## One iteration

1. Measure registered, executable, qualifying, current-useful, stale, failed, and backoff counts from PostgreSQL and the source-operations API.
2. Reconcile approved candidates that already have two distinct useful retained scheduled cycles; fix shared lifecycle defects before adding more registrations.
3. Discover a bounded batch from exact publisher, CERT/government, or independently authoritative references.
4. Require an unauthenticated public `/s` preview, current relevant parser yield, endpoint deduplication, lawful public-text collection, and sanitizer residual checks.
5. Reject private, invite-only, authenticated, CAPTCHA-gated, copied, hijacked, sample-distribution, stale, irrelevant, unsafe, or parser-empty channels. A first-party current security/vendor channel with parsed text may enter candidate review even when the bounded classifier returns zero; that result grants no qualification credit.
6. Keep accepted discoveries as non-coverage candidates until the native scheduler persists two distinct useful cycles and the evidence-bound automatic review approves them.
7. Deploy from the canonical production checkout, then verify scheduler health, captures, parser outcomes, backoff, qualification, and restart idempotence.
8. Update this baseline and repeat while the qualifying count is below 100.

## A source counts only when

- its canonical publisher ownership or independent authority is recorded;
- it is globally scoped, publicly reachable without credentials, low risk, and policy approved;
- the production collector and Telegram sanitizer/parser execute on the recurring scheduler;
- at least two distinct scheduled runs have useful retained captures linked to matching health rows;
- its automatic source review is approved and bound to retained immutable evidence;
- `status=active`, `productionCollection=true`, `countsAsCoverage=true`, and collection is executable;
- content, last-success, last-useful, parser, retry, and backoff timestamps are truthful;
- restart preserves one stable source identity without bootstrap churn; and
- PostgreSQL, source-operations API, scheduler status, and customer UI report the same qualifying result.

## Completion

This goal is complete only when production has at least 100 sources meeting every condition above, the count remains at or above 100 across a restart and two later scheduler cycles, and no counted source exposes restricted/private content or residual credentials and personal data.
