# Lawful Tor source fleet — persistent goal

## Objective

Keep discovering, validating, deploying, and monitoring lawful Tor metadata feeds until the live source-operations API reports at least **1,000 qualifying lawful dark-web/Tor feeds**.

Live baseline on 2026-08-09: **0 qualifying Tor feeds**. Raw registrations, transport canaries, candidates, mirrors, and retired rows do not count.

The corrected production scheduler first shipped at `e7aae5ba71e5a1a4a74111f62d0322e54fc9949d`; the current scraper image at `b64cdf05428dc2f6b5f60f258a6c348026a55060` includes the governed Tor review path from `06b360c60a409214db6d2d0126785bf8adea151a`. At 2026-08-09T06:49Z, PostgreSQL reported 9 governed Tor portfolio candidates, 6 with one current productive scheduled cycle, 3 with an approved source review, and 0 with the complete two-cycle qualification proof. Three additional active Tor rows are a transport canary or legacy rows and do not qualify. The remaining gap is 1,000.

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
- Promotion remains approval-only and still requires identity-bound retained evidence plus two novel useful scheduled cycles.
- Public and Telegram candidates in `needs_review` may gather newer bound evidence after initial verification expiry, but cannot promote until the review becomes approved.

## Live progress ledger

| Measured at | Deployed commit | Admitted candidates | At least one productive cycle | Approved review | Qualifying | Remaining |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2026-08-09T06:22Z | `e7aae5ba71e5a1a4a74111f62d0322e54fc9949d` | 9 | 6 | 1 | 0 | 1,000 |
| 2026-08-09T06:49Z | `b64cdf05428dc2f6b5f60f258a6c348026a55060` | 9 | 6 | 3 | 0 | 1,000 |

Every later row must come from the live PostgreSQL/API/scheduler view. Never record onion locators or captured content in this file.

## Completion proof

Do not close this goal until PostgreSQL, the scheduler, source-operations API, and UI agree on at least 1,000 endpoint-unique qualifying lawful Tor feeds and every counted feed has current multi-cycle retained evidence. Deployment or registration alone is not completion.
