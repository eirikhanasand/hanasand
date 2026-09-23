# PostgreSQL readiness audit candidate — keep disabled

The native observer and signed verifier are implemented, but this candidate does **not** meet the storage-reduction requirement. Do not enable the rule or install the wrapper as a storage optimization in its current form.

The observer joins a live Docker exec process, namespace PID, process start ticks and nonce to Docker's own successful health history. A root-only Ed25519 key signs the complete audit event and native fact. The API pins the public key, validates exact commands and event identity, and checks current detection and Keep rules before omitting an indexed log. Full signed originals remain in compressed receipts. Missing, failed, changed, ambiguous and manual executions stay visible. Delivery delay does not invalidate an otherwise valid event-relative proof.

A live test on 2026-09-24 Oslo time confirmed a scheduled healthcheck produced a fact; an identical manual command produced none. Four of five sampled scheduled checks were observed successfully; the missed check remained unproven. This small sample is not a capture-rate guarantee.

The old healthcheck produced three audit executions: its shell, Perl launcher and native PostgreSQL binary. The temporary wrapper produced four: the initial shell, wrapper entry, nonce-bearing shell and native binary. Only the last two satisfy the signed candidate. Initial shell/wrapper entries remain indexed.

## Measured storage rejection

A disposable PostgreSQL test replicated the real before/after parsed event shapes over 1,000 cycles, with unique source IDs, the repository's service-log indexes, unique proof receipts and generic match receipts. It included compressed originals using `deflate-json-v1` (raw DEFLATE JSON).

| Component | Bytes |
| --- | ---: |
| Baseline: 3 indexed logs/cycle | 2,686,976 |
| Candidate: 2 indexed logs/cycle | 1,753,088 |
| Candidate: 2 compressed proof receipts/cycle | 2,940,928 |
| Candidate: 2 match receipts/cycle | 630,784 |
| Candidate total | 5,324,800 |

Total storage increased approximately **98%**, even assuming every cycle was proven. This is a local shape-based experiment, not a production disk measurement. Raw audit text savings or fewer indexed rows alone would be misleading. Historical logs without native proof do not qualify; their reingestion savings are zero.

A future design would need a substantially smaller representation, likely one complete-chain receipt, and fresh native identity, retention, concurrency, replay and storage tests. The current rule remains disabled and the automatic Compose wrapper mount was removed.
