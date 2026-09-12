# Service resilience

The serving order is **Inspur preferred → Inspur alternate → OVHcloud**, independently for frontend, API, authentication, intelligence queries and database reads. Two HAProxy 3.2 LTS processes share the routing ports using Linux SO_REUSEPORT. OpenResty reloads gracefully. HTTP deployments start and verify two replacement workers before routing traffic and draining the previous pair.

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
- `scripts/resilience/backup.sh` performs a compressed physical backup from the local standby, verifies the manifest and isolated recovery, then sends only the verified bundle through a command-restricted SSH key. OVH retains fourteen verified bundles. The monitor alerts immediately when the job fails and when no verified off-site backup arrives within 36 hours.
- `scripts/resilience/check-database-switch.sh` uses isolated temporary databases and leaves production databases untouched.
- `api/scripts/check-recovery-records.ts` creates and deletes a scoped temporary account, case and alert to verify authenticated alerts and actual timeline events, search and read-only boundaries during a drill.

Secrets stay outside source control. OVH receives a dedicated, limited application database identity, a replication-only identity and the existing monitoring webhook. It does not receive the primary's administrative, AI or SSH credentials.

## Scale and alternatives

500,000 registered users is not a concurrency target. Measure peak active sessions, search rate, data size and recovery load before making capacity promises. OVH's 32 GB RAM is reserved for core recovery; it is not a replacement for Inspur's processing capacity. The query spare's in-memory metadata is a current capacity limit; move large detail lookups to bounded database queries as measured demand grows.

For stronger recovery guarantees, add an independent witness/fencing service or a managed highly available database, a health-aware global load balancer instead of DNS-only site switching, and appropriately sized search capacity. Synchronous cross-site replication reduces acknowledged-write loss but makes write latency and availability dependent on the remote link. Asynchronous standbys suit the current two-host setup's read-first recovery requirement; they cannot promise zero data loss or automatic safe writable promotion during every partition.


## Release validation (6 September 2026)

- Real frontend/API/auth routing passed preferred Inspur → alternate Inspur → OVH → alternate Inspur → preferred Inspur, with ten response checks at each stage.
- Public routing cutover: 2,408 valid-session checks, zero failures; login, page navigation and revoked-session rejection passed.
- Replacement-pair deployment: 1,911 valid-session checks, zero failures; no application action is replayed by the bounded authentication pre-handler retry.
- HAProxy LTS replacement: 1,432 valid-session checks, zero failures. Actual database routing switch and failback: 366 valid-session checks, zero failures and no auth/API process restarts.
- Final API/auth release: another 1,209 valid-session checks, zero failures, with frontend login/navigation and revoked-session rejection. The five successful final runs total 7,326 validations.
- Sustained OVH-only recovery: twelve rounds of actual case/timeline-event, alert and public-search reads passed, including nine verified blocked-write and hard session-expiry checks. Temporary fixtures were removed.
- A stopped local routing process left its peer serving fifty successful requests.
- Both live physical replicas streamed with verified replay positions. A compressed physical backup passed manifest/WAL verification and an isolated writable restore; OVH acknowledged checksum-verified receipt. The scheduled daily run repeated this successfully.
- The isolated database promotion/reseed/failback check preserved all three test writes without stopping production databases.
- Discord acknowledged red failover/restore-required/job-failure and green recovery messages. Simulations were labelled TEST.
- Recovery UI browser checks passed normal, read-only, unavailable-status and failback states. Full API and frontend build checks passed; sixteen focused TI checks passed. The wider TI type-check retains unrelated existing errors.
- OVH's expired manual-renewal certificate was replaced with DNS-based automatic renewal. Both sites passed strict HTTPS readiness checks. Website/API DNS records were verified at a 60-second TTL; unrelated DNS records were unchanged.

The database switching drills exposed an unhandled error on a checked-out PostgreSQL connection, in addition to the earlier monitoring-convergence gap. The shared connection pool now handles those events and discards failed clients; session checks use the actual database role, and a single bounded pre-handler retry handles a connection switch before application execution. Anonymous requests also immediately use recovery rate counters when PostgreSQL rejects a shared-counter write, before monitor convergence. These fixes are covered by runnable regression checks.

Recovery alert reads skip projection-repair writes and page through the canonical alerts table. First pages fetch one extra row to expose a continuation cursor. A scoped live fixture checks a real replicated alert and a specific timeline event rather than accepting an empty response.

Reference behavior: [PostgreSQL standby and replication](https://www.postgresql.org/docs/15/warm-standby.html), [PostgreSQL base backups](https://www.postgresql.org/docs/15/app-pgbasebackup.html), [HAProxy supported releases](https://www.haproxy.org/).

## Isolated cross-site transports (12 September 2026)

The legacy SSH connection remains in place for physical database replication and
existing consumers. Interactive database reads, intelligence queries, web traffic,
and monitor exchange use four independent SSH connections. This prevents bulk
replication or one connection's retransmission stalls from blocking all service
probes together. All forwarding listeners remain loopback-only, using the existing
restricted key and host-key verification.

Migration: run `isolated-tunnels.py authorize` as the existing OVH tunnel user,
build `Dockerfile.tunnel` with a revision tag, then run
`isolated-tunnels.py start --image REVISION_IMAGE` on Inspur. Verify the new listeners before running
`isolated-tunnels.py configure --root SITE_ROOT` at each site and gracefully
reloading the proxies. The helper retains the previous configuration; it never
stops the legacy replication tunnel. Source service ports and the stable database
proxy endpoint stay unchanged. New query forwarders use 28503/28502/28506,
intelligence 28097/29097, web 29300/29080/29090, and monitoring 29911.

HAProxy now has an explicit five-second health-response timeout. Previously its
two-second check interval implicitly bounded the response, which produced
simultaneous cross-site Layer7 timeouts. Three consecutive failures still remove
a server, and fifteen successful checks are required before failback. A slower
failure response budget trades several seconds of detection time for tolerance of
measured cross-site response variation; it does not make a failed response healthy.

Alerts retain red failover and green failback, identify the observing site, and
include proxy check status/duration. A route unavailable from OVH does not establish
that the same service is down on Inspur. `check-routing-behavior.py` exercises a
three-second healthy response, sustained HTTP failure, and recovery using an
isolated HAProxy instance; it does not stop production services.

### Collector readiness latency

The primary collector uses `SCRAPER_HEALTH_PORT=8098` for an independent worker listening at `/v1/health`; requests still go to port 8097. Set `checkPort: 8098` only for this instance in the primary site's existing resilience configuration and update its `health` URL to the same private address on 8098. Do not regenerate live configuration or change remote tunnel ports. Query replicas retain their existing checks unless explicitly enabled separately.

The runtime publishes health every 50 ms. The worker refuses success once the sample is 250 ms old, including time spent producing or delivering it. Startup, database errors and write backlogs retain their existing 503 semantics. A blocked serving event loop therefore yields a fast 503 instead of a delayed cached 200. Resource diagnostics are sampled at most once per second; storage readiness is still sampled on every heartbeat using the existing database probe policy. This bounds the readiness heartbeat's staleness, not the underlying database probe interval. An absent/dead readiness worker also fails the routing check.

The under-20 ms response target is measured on the primary host, including the local HTTP connection. WAN round trips and full intelligence queries have separate latency budgets. Drain the collector before rebuilding it, verify both readiness and an actual query, then enable the new check port and restore routing. Preserve the two local routing instances and their existing fall/rise thresholds.
