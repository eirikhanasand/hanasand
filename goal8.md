# Lawful Tor source fleet — persistent goal

## Objective

Keep discovering, validating, deploying, and monitoring lawful Tor metadata feeds until the live source-operations API reports at least **1,000 qualifying lawful dark-web/Tor feeds**.

Live sustained baseline on 2026-08-09: **4 qualifying Tor feeds**. Raw registrations, transport canaries, candidates, mirrors, and retired rows do not count.

The corrected production scheduler first shipped at `e7aae5ba71e5a1a4a74111f62d0322e54fc9949d`; governed review follow-through is at `06b360c60a409214db6d2d0126785bf8adea151a`, and Tor bootstrap readiness is at `79e976b85ef0bb1ec1626c4eb9295b23b8aead15`. Restart reconciliation at `9f9e3a90f17e5973ed943cc1e8b0d6863d854474` now preserves both evidence-bound portfolio identities and legacy governed Tor sources with two current retained productive cycles. At 2026-08-09T09:50Z, PostgreSQL reported 13 admitted candidates, 14 current feeds with at least one productive scheduled cycle, 11 approved source reviews, and 3 complete persisted qualification proofs; the public coverage API independently reported 3 qualifying lawful-dark-web feeds. The remaining gap is 997.

At 2026-08-09T08:31Z, production commit `b206b20338cf8fe6d93b1509ed3da9bdd333c38b` had imported two additional endpoint-unique candidates. Each completed one real useful scheduled cycle, retained one bounded metadata capture, and received an approved identity-bound automatic review. PostgreSQL then reported 9 pending admitted candidates, 11 portfolio feeds with at least one retained productive cycle, and 7 approved source reviews. The source-operations API still reported exactly 2 qualifying lawful-dark-web feeds and a gap of 998 because the new candidates have not yet completed a second novel productive scheduled cycle.

At 2026-08-09T09:42:20Z, the healthy post-restart production path at source/Tor merge `5f75ad6634ff5c3362ed0353b05a6e6d52f6b564` reported exactly 3 qualifying lawful-dark-web feeds and a gap of 997. The family funnel contained 21 non-retired Tor rows: 13 candidates and 5 active/executable rows, with the remaining rows rejected. Across the two governed restricted packs, 15 intelligence feeds had some retained useful run-linked evidence and 11 exposed an approved automatic-review state; 14 remained current at the 09:50Z reconciliation, and only Blackwater, Qilin, and Genesis satisfied the complete global qualification contract. The earlier count of 4 included one additional healthy, active, executable, coverage-counting restricted source scoped to the exact `default` tenant. It remains productive but is correctly excluded from the global baseline; no fourth global source demoted.

At 2026-08-09T10:17Z, a fresh cross-authority census had found 673 endpoint keys not present in the governed pack or its hashed exclusions, but most were historical endpoints or path variants. The initial 19 independently matched identities were only the first sample slice; broader sampling produced a continuing queue. Three bounded approved-proxy batches probed 36 endpoint-unique identities. One parser-positive endpoint was already the productive exact-`default` DWM source and was rejected as an endpoint-only duplicate; four responses were parser-empty, 24 returned upstream HTTP failures, and seven failed before useful metadata could be parsed. No endpoint was admitted, excluded, or counted. Discovery must continue from the remaining independently referenced frontier without treating inventory volume, historical locators, or one source represented in multiple tenants as source coverage.

At 2026-08-09T10:36Z, production commit `d38ec5f2d4f7aa5529cc763ca7e7a6bcce2bce2c` reported 24 qualifying clear-web feeds, 13 public Telegram feeds, and the correct 3 global lawful-Tor feeds. PostgreSQL reported 20 non-retired global Tor rows, 14 candidates, 18 feeds with retained useful health evidence, 12 approved source reviews, and 3 persisted sustained-productivity proofs. DragonForce had one successful useful scheduled cycle, one retained metadata capture, and an approved review; it remains candidate/noncoverage pending a distinct second productive cycle.

At 2026-08-09T10:53:48Z, the endpoint-unique Inc Ransom JSON candidate completed its first real production-scheduled cycle with one new retained metadata capture, useful=true, no duplicate, and no parser warning. It remains candidate/noncoverage pending its source-review decision and a distinct second novel productive cycle.

At 2026-08-09T11:00:47Z, RansomHouse passed a new bounded approved-proxy review after its former unsupported-JSON rejection. The current credential-free response was HTTP 200 JSON containing 22 distinct bounded victim headings, while the production parser retained only those organization names and no descriptions, contacts, links, bodies, or ambiguous dates. Current independent Unit 42 technical research and Check Point reporting verified the actor and fresh activity; endpoint-only dedupe found zero repository or production-database matches. This is an admitted candidate only and must not count before production import, review approval, and two novel productive scheduled cycles.

At 2026-08-09T11:14:31Z, RansomHouse completed its first real production-scheduled cycle with one new retained metadata capture, useful=true, no duplicate, and no parser warning. DragonForce, Inc Ransom, and RansomHouse therefore each remain non-counting candidates with one productive cycle; a later duplicate-only response is truthful health evidence but is not a second productive cycle.

The automatic review worker had a separate PostgreSQL hydration defect: its bounded database query could return a task absent from the startup memory window, but the worker immediately dereferenced the missing memory copy and crashed before review. Commit `7ec387ea` falls back to the bounded durable task and includes a focused restart-window test. This restores review progress without granting usefulness or qualification.

At 2026-08-09T11:44Z, the live worker exposed a third review blocker: every cycle loaded roughly 240,000 durable historical review workflow rows before attempting its bounded batch. Heap usage exceeded 10 GiB, collection timers stalled, and the pending write queue grew past 2,400 without a completed review cycle. The corrected cycle projection retains all history in PostgreSQL but loads only the current bounded claim/incident work lanes plus the latest source-task identities. Against the same live dataset, the projection returned 231 rows (131 source identities and 100 current claim tasks) instead of the full history. This is pipeline capacity evidence only; it does not change any source count.

Endpoint-only reconciliation found two cross-tenant canonical collisions. BrainCipher has an active exact-`default` row but only a retired, unverified global row, so it is not re-admitted or counted. Deadlock has an independently verified, approved global candidate and an active exact-`default` duplicate with the same endpoint; the tenant row can otherwise win canonical ownership through older retained captures and permanently block global qualification as `duplicate_feed`. The bootstrap repair retires only active tenant duplicates when a current governed global Tor portfolio owner exists, preserving the row and evidence while assigning one recoverable canonical owner. It never promotes a rejected or historical global row.

At 2026-08-09T12:05Z, the bounded review worker completed two live cycles instead of exhausting the process: the first queued 47 tasks, superseded 14 stale tasks, attempted 25 at concurrency four, and drained its write queue from 1,082 to zero; the second queued one, superseded four, and attempted another 25. Heap settled below 2 GiB instead of the prior 6–10 GiB. RansomHouse received its evidence-bound approved source review. Deadlock's governed global candidate became the canonical endpoint owner and its exact-`default` duplicate is now recoverably retired. PostgreSQL reported 20 non-retired global Tor rows, 16 candidates, 18 with at least one retained productive cycle, 14 approved reviews, and three with at least two retained productive cycles. Deadlock, DragonForce, Inc Ransom, and RansomHouse each have exactly one retained productive cycle and remain non-counting candidates.

At 2026-08-09T12:14:51Z, a fresh current-authority census found seven previously unledgered actor identities spanning nine reported endpoints. The existing 64 KiB production boundary accepted none: seven endpoint identities were not credential-free v3 Onion services, one timed out on two bounded attempts, and one returned no parser-recognized victim metadata. All nine endpoint hashes are retained as non-counting exclusions; no locator or response body is stored.

At 2026-08-09T12:30:26Z, RansomHouse completed its second distinct novel productive scheduled cycle and was promoted through the existing governed path. PostgreSQL reported 20 admitted global Tor rows, 15 remaining candidates, 18 feeds with at least one retained productive cycle, 14 approved source reviews, and four complete multi-cycle proofs. The public coverage API independently reported four qualifying lawful-dark-web feeds and a gap of 996. This is the first post-repair promotion and proves that discovery, import, scheduled collection, retained evidence, review, and qualification now survive together in production.

At 2026-08-09T12:33:15Z, a second current-authority census checked six newly active or independently reported actor identities. One had no public Tor endpoint, and 15 endpoint-unique identities across the other five had zero production-usable yield: nine returned upstream HTTP failures, four timed out while the current authority marked them unavailable, and two reachable endpoints produced zero parser-recognized victim-listing items. Production PostgreSQL contained zero matching canonical endpoint identities. The 15 hashes are retained as non-counting exclusions; no locator or response body is stored.

At 2026-08-09T12:42:50Z, the remaining five unledgered identities in the current RansomLook active-group view produced 16 endpoint-unique identities and zero admissions. The authority marked 13 historical endpoints down, two live endpoints were reachable but parser-empty, and one live endpoint returned HTTP 403 through the approved proxy. Endpoint-only reconciliation found zero production or seed collisions. All 16 hashes are retained as non-counting exclusions; no locator or response body is stored.

At 2026-08-09T12:52:23Z, the current Breach House frontier exposed three endpoint-unique identities for independently documented BlackField. Two bounded approved-proxy requests timed out and one returned HTTP 500, so none produced production-parser metadata. Production PostgreSQL and the governed seed contained zero canonical endpoint collisions. All three hashes are retained as non-counting exclusions; no locator or response body is stored. A concurrent deployment interrupted the separate Section9 probe, so that attempt is discarded rather than recorded as a failure.

At 2026-08-09T13:05:00Z, the official Distributed Denial of Secrets publisher page identified the organization as a public-interest nonprofit archive rather than a ransomware actor and exposed no independently verified public Onion feed identity. Its third-party Breach House grouping is therefore retained as one non-counting identity exclusion without fetching or downloading any archive material.

At 2026-08-09T13:23:45Z, the current Breach House Section9 record exposed 19 endpoint-unique identities, but no authoritative current publisher or vendor reference independently bound any endpoint to the claimed actor. PostgreSQL contained zero canonical collisions. One bounded approved-proxy attempt produced no parser metadata; the other 18 were rejected before restricted collection because identity verification had already failed. All 19 hashes are retained as non-counting exclusions; no locator or response body is stored.

The production loss was a shared bootstrap identity defect, not missing source evidence. Restricted seed import assigned a new `createdAt` before qualification, changing the automatic-review identity hash and demoting already-qualified rows on every restart. Commit `14e1a7c2f1dbcd8ce942b16a8346894c856223fe` preserves the persisted identity during qualification, and `9f9e3a90f17e5973ed943cc1e8b0d6863d854474` preserves qualified legacy restricted sources that rely on real runtime evidence. Commit `7e357e448567e3149ecef0fe31b85c68fcd74526` fixes the second loss point: PostgreSQL now exposes successful run-linked `sourceReviewCandidate` captures to governed review even when their health row remains deliberately non-useful. After rollout, all 53 sources with that retained candidate evidence had source-review tasks and zero remained invisible; no health row received usefulness or qualification credit from the repair.

At 2026-08-09T12:17:48Z, production commit `0b40ca8a8dcbdc8ead34e1ff1cce761c02679b38` closed the remaining runtime delivery failures. Public and Tor body reads now have one total deadline after headers, and both schedulers yield to the event loop between their existing bounded task waves. The exact rebuilt image bootstrapped 1,652 sources with zero errors, stayed healthy with restart 0/OOM false, served `/v1/health` in 31–32 ms during restricted work, completed both public loops, and drained both the task queue and pending writes to zero. During the natural 12:16Z recurrence with both public lanes active, six health probes completed in 146–272 ms; the global run finished 8/8 and the exact-default run 1/1 with zero failures or remaining tasks. All 143 results were duplicates, so no cycle or source received false productivity credit. PostgreSQL reported 16 global Tor candidates, 18 admitted global Tor feeds with at least one retained productive scheduled cycle, and 14 approved source reviews. RansomHouse now has an approved evidence-bound source review but remains candidate/noncoverage because it has only one real productive cycle. Strict global qualification remains 3 and the gap remains 997.

## A source counts only when

- its endpoint identity is canonical and unique across every source type;
- a current public authority record independently identifies the source;
- the approved Tor proxy returns bounded public metadata that the production parser turns into useful intelligence;
- governance is approved for metadata-only collection and raw leak bodies, credentials, downloads, private invitations, and operator interaction remain forbidden;
- production schedules it after restart and records truthful checks, content times, useful-intelligence times, health, backoff, and retained metadata evidence;
- it produces new useful retained captures in at least two scheduled cycles inside its declared monitoring window;
- automatic source review approves the retained parser output when that review is required.

## Continuous loop

1. Read the live PostgreSQL/API/scheduler counts and reconcile the exact Tor gap.
2. Expand only from current authoritative public publisher, CERT, government, or research references.
3. Dedupe by canonical endpoint before any fetch. Keep restricted locators only in approved seed storage; use IDs or hashes in logs and reports.
4. Probe through `tor-approved-metadata-proxy` with the existing 64 KiB metadata boundary and bounded concurrency.
5. Reject dead, copied, mirrored, script-only, layout-only, unsafe, credentialed, interactive, download, or parser-empty endpoints.
6. Add only parser-positive sources to the existing restricted seed/bootstrap path, run the focused checks, commit, push, deploy from `/home/hanasand/hanasand`, and probe live.
7. Recheck candidates until they have two current productive scheduled cycles; retire sources that fail a full monitoring window.
8. Update the dated live baseline and continue immediately while the qualifying count is below 1,000.

## Corrected production path

- The lawful Tor portfolio is part of the runtime bootstrap seed paths.
- A previously admitted `restrictedMetadataCandidate` remains collectable after its immutable seed receipt ages out; expiry no longer prevents it from obtaining runtime qualification evidence.
- The source-review prompt and deterministic governance layer recognize only an exact parser-verified metadata-only victim-list contract with coherent retained names as useful CTI; navigation and malformed output remain blocked.
- The scraper cannot start its restricted scheduler until the Tor control port reports bootstrap progress at 100%; open proxy ports alone no longer count as healthy.
- Promotion remains approval-only and still requires identity-bound retained evidence plus two novel useful scheduled cycles.
- Public and Telegram candidates in `needs_review` may gather newer bound evidence after initial verification expiry, but cannot promote until the review becomes approved.
- Restricted re-import preserves the persisted source identity before qualification, so approved review evidence remains bound across restart.
- Legacy restricted seeds without a shipped portfolio-verification receipt may evaluate their current governed runtime evidence; this does not bypass review, two-cycle, freshness, or retention requirements.
- The PostgreSQL review index includes explicitly marked retained candidate evidence without changing its non-useful health state; ordinary non-useful captures remain excluded.
- A current governed global Tor portfolio source owns its endpoint across tenant scopes; active tenant duplicates are recoverably retired during bootstrap so capture volume cannot split canonical ownership or hide global qualification.
- Public and Tor response bodies share bounded total read deadlines, so a header-complete stalled stream cannot freeze a scheduler wave.
- Public and restricted schedulers yield between bounded task waves, keeping health checks and runtime timers responsive without reducing source capacity or weakening qualification.

## Live progress ledger

| Measured at | Deployed commit | Admitted candidates | At least one productive cycle | Approved review | Qualifying | Remaining |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026-08-09T06:22Z | `e7aae5ba71e5a1a4a74111f62d0322e54fc9949d` | 9 | 6 | 1 | 0 | 1,000 |
| 2026-08-09T06:47Z | `b64cdf05428dc2f6b5f60f258a6c348026a55060` | 9 | 6 | 2 | 0 | 1,000 |
| 2026-08-09T06:49Z | `b64cdf05428dc2f6b5f60f258a6c348026a55060` | 9 | 6 | 3 | 0 | 1,000 |
| 2026-08-09T07:11Z | `79e976b85ef0bb1ec1626c4eb9295b23b8aead15` | 9 | 6 | 4 | 0 | 1,000 |
| 2026-08-09T07:20Z | `32ad0e8cbd1f62b9f443b641e7933cadbb1c2eee` | 7 | 7 | 4 | 2 | 998 |
| 2026-08-09T08:31Z | `b206b20338cf8fe6d93b1509ed3da9bdd333c38b` | 9 | 11 | 7 | 2 | 998 |
| 2026-08-09T09:42:20Z | `5f75ad6634ff5c3362ed0353b05a6e6d52f6b564` | 13 | 15 | 11 | 3 | 997 |
| 2026-08-09T09:50Z | `bcac2d85028a434d232d335b1ddd9d3fc68a2053` | 13 | 14 | 11 | 3 | 997 |
| 2026-08-09T10:36Z | `d38ec5f2d4f7aa5529cc763ca7e7a6bcce2bce2c` | 14 | 18 | 12 | 3 | 997 |
| 2026-08-09T12:17:48Z | `0b40ca8a8dcbdc8ead34e1ff1cce761c02679b38` | 16 | 18 | 14 | 3 | 997 |
| 2026-08-09T12:30:26Z | `0b40ca8a8dcbdc8ead34e1ff1cce761c02679b38` | 15 | 18 | 14 | 4 | 996 |

Every later row must come from the live PostgreSQL/API/scheduler view. Never record onion locators or captured content in this file.

## Completion proof

Do not close this goal until PostgreSQL, the scheduler, source-operations API, and UI agree on at least 1,000 endpoint-unique qualifying lawful Tor feeds and every counted feed has current multi-cycle retained evidence. Deployment or registration alone is not completion.
