# Service resilience

The serving order is **Inspur preferred → Inspur alternate → OVHcloud**, independently for frontend, API, authentication, intelligence queries and database reads. Two HAProxy processes share the routing ports using Linux SO_REUSEPORT. OpenResty reloads gracefully. HTTP deployments start and verify two replacement workers before routing traffic and draining the previous pair.

The original API remains the background-job owner. HTTP workers do not start migrations or duplicate scheduled work. The existing intelligence producer remains the only collection owner; its local and remote query spares cannot schedule collection or write intelligence records. Existing OVH applications are separate containers and are not managed by these deployment scripts.

## Database safety

PostgreSQL has one writable primary, an Inspur physical standby and an OVH physical standby. The standbys use the same pinned PostgreSQL image. The monitor verifies replay lag before making a standby eligible; replication slots have bounded WAL retention. Lost required WAL produces a restore-required alert and disqualifies the replica. After primary loss, a previously verified standby can continue serving read-only records, clearly marked as recovery data. Replication is asynchronous: recently unreplicated changes can be missing.

There is no automatic writable promotion. Two sites cannot distinguish a dead primary from a network partition without an independent fencing decision. Confirm the old primary cannot accept writes, check replay position and the accepted data-loss window, then promote through an operator-led procedure. Rejoin a former primary by reseeding it from the new primary; this installation does not assume pg_rewind prerequisites. The isolated switching check exercises replication, fenced promotion, reseeding and failback without stopping production databases.

Authentication validates actual stored sessions against the selected database. Read-only validation does not refresh timestamps or extend the persisted expiry. Missing/stale recovery status blocks mutations. Both API and frontend boundaries return a structured temporary-unavailability response; the UI identifies recovery and unavailable services. OVH permits core viewing and search, while heavy AI and administrative operations remain unavailable.

## Monitoring and alerts

The independent monitor serves loopback `/status`; public API routing exposes `/api/resilience/status`, and the frontend consumes `/api/resilience`. `/system`, database and backup pages show placement, instance health, both sites' resource availability, replication, backup verification and notification results. Recovery monitoring is independent of the application API. Red Discord embeds report failover or restore requirements; green embeds report failback and list anything still affected. Delivery is retried independently of health sampling.

DNS recovery is a last resort after public readiness fails despite service-level routing. Only explicit website/API A records are in scope. Mail and wildcard records remain unchanged. DNS caching means this path has a nonzero recovery interval; it is not a guarantee of uninterrupted requests during complete host loss.

## Operations

- `scripts/resilience/deploy-pair.sh frontend|api|auth` runs from `/home/hanasand/hanasand`. It builds an immutable revision image, starts two unused slots, verifies readiness, switches routing and drains old workers. `--no-build` requires the exact image already present.
- `scripts/resilience/maintenance.py ROOT SERVICE maint|ready INSTANCE...` updates both routing processes and persists maintenance state. Always restore maintenance after a drill.
- `scripts/resilience/backup.sh` performs a compressed physical backup from the local standby, verifies the manifest and isolated recovery, then sends only the verified bundle through a command-restricted SSH key. OVH retains fourteen verified bundles. The monitor alerts when no verified off-site backup arrives within 36 hours.
- `scripts/resilience/check-database-switch.sh` uses isolated temporary databases and leaves production databases untouched.
- `api/scripts/check-recovery-records.ts` creates and deletes a scoped temporary account and case to verify authenticated case/timeline reads, search and read-only boundaries during a drill.

Secrets stay outside source control. OVH receives a dedicated, limited application database identity, a replication-only identity and the existing monitoring webhook. It does not receive the primary's administrative, AI or SSH credentials.

## Scale and alternatives

500,000 registered users is not a concurrency target. Measure peak active sessions, search rate, data size and recovery load before making capacity promises. OVH's 32 GB RAM is reserved for core recovery; it is not a replacement for Inspur's processing capacity. The query spare's in-memory metadata is a current capacity limit; move large detail lookups to bounded database queries as measured demand grows.

For stronger recovery guarantees, add an independent witness/fencing service or a managed highly available database, a health-aware global load balancer instead of DNS-only site switching, and appropriately sized search capacity. Synchronous cross-site replication reduces acknowledged-write loss but makes write latency and availability dependent on the remote link. Asynchronous standbys suit the current two-host setup's read-first recovery requirement; they cannot promise zero data loss or automatic safe writable promotion during every partition.
