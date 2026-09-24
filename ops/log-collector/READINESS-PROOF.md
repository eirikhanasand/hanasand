# PostgreSQL readiness audit: complete-chain proof

One rule hit represents one complete scheduled healthcheck cycle: four original audit executions retained losslessly in one compressed signed receipt. No separate generic hit receipt is written. Incomplete, duplicate, altered, ambiguous, manual or failed chains remain indexed, as does any chain whose member matches a current detection or Keep rule.

The native observer joins Docker's exact live root process, its parent and start ticks, a distinct direct wrapper child, namespace PID and nonce to Docker's own successful health history. A root-only Ed25519 key authenticates the native fact and all four original event digests. One signature is attached only to the root event, limiting overhead when a transport batch splits the group. Old version-1 facts cannot authorize a chain. Delayed delivery is checked against event time rather than current time.

The four exact roles are the Docker command shell, wrapper entry, nonce-bearing wrapper shell and native PostgreSQL probe. Commands, host process relationships, root service context, successful completion, exact output, event identity and normal cadence are mandatory. Any failure keeps the evidence. The API checks every member before receipt deduplication, including replay under a newly configured detection.

## Storage evidence

The initial two-event candidate was rejected: separate signed receipts increased service-log-only storage by approximately 98%. The final design stores the whole chain once and counts that dedicated receipt directly.

Read-only production inspection confirmed the three baseline audit events have both service-log rows and processed Mill copies: 1,867 bytes plus 4,443 bytes per observed cycle, before indexes. The processing code persists these normalized copies; raw service rows expire only after seven days and completed processing.

A disposable PostgreSQL benchmark replicated the real event shapes over 1,000 cycles with unique source IDs, compressed signed chain receipts, service-log indexes, normalized Mill copies and common Mill indexes. Search GIN and dimension overhead were excluded. All figures include retained missed captures and split batches.

| Scenario | Total bytes | Reduction from baseline |
| --- | ---: | ---: |
| Baseline: three executions per cycle and processed copies | 9,207,808 | — |
| Complete capture: one four-original receipt per cycle | 2,154,496 | 76.6% |
| 80% captured; missed cycles remain fully indexed | 4,308,992 | 53.2% |
| 76.8% complete; 20% missed and 3.2% split cycles retained | 4,800,512 | 47.9% |

A subsequent twenty-check live sample under disk pressure captured 9 native facts (45%). Repeating the benchmark with the fresh v2 event/fact sample produced 8,175,616 bytes at 45% complete capture (11.2% lower than baseline), and 8,372,224 bytes at 43.2% after a 4% split allowance (9.1% lower). These are conditional estimates: native fact capture is not the final receipt rate. Saved duration/cadence policy and incomplete transport groups can reduce qualification further. The 9.1% estimate requires 43.2% of cycles to qualify completely; below that, savings decline and may become negative because unmatched cycles retain the extra wrapper event. Measure sustained live receipts per cycle before claiming realized savings. Unproven checks are retained; capture rate is never improved by weakening proof.

Host/service/executable selectors and duration/cadence limits are persisted in the visible Mill Analysis Rule definition. The native collector only authenticates evidence and never drops it. The API checks the saved conditions and parameters for the entire chain before every new receipt or replay; Disable and Keep remain authoritative.

These are shape-based estimates, not reclaimed production disk space or a guaranteed capture rate. Historical logs without native proof do not qualify; their reingestion savings are zero. A complete signed group can be reingested safely with one receipt, while current detectors and Keep rules still take precedence. No historical deletion is part of this rollout.

Originals use raw DEFLATE JSON with `original_encoding='deflate-json-v1'`; decompression returns the exact four-event array, including its root proof.
