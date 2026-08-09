# Lawful Tor source fleet — persistent goal

## Objective

Keep discovering, validating, deploying, and monitoring lawful Tor metadata feeds until the live source-operations API reports at least **1,000 qualifying lawful dark-web/Tor feeds**.

Live baseline on 2026-08-09: **0 qualifying Tor feeds**. Raw registrations, transport canaries, candidates, mirrors, and retired rows do not count.

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

## Completion proof

Do not close this goal until PostgreSQL, the scheduler, source-operations API, and UI agree on at least 1,000 endpoint-unique qualifying lawful Tor feeds and every counted feed has current multi-cycle retained evidence. Deployment or registration alone is not completion.
