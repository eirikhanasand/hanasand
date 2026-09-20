# Service resilience

The serving order is **Inspur preferred → Inspur alternate → OVHcloud**, independently for frontend, API, authentication, intelligence queries and database reads. Two HAProxy 3.2 LTS processes share the routing ports using Linux SO_REUSEPORT. OpenResty reloads gracefully. HTTP deployments start and verify two replacement workers before routing traffic and draining the previous pair.

The original API remains the background-job owner. HTTP workers do not start migrations or duplicate scheduled work. The existing intelligence producer remains the only collection owner; its local and remote query spares cannot schedule collection or write intelligence records. Existing OVH applications are separate containers and are not managed by these deployment scripts.

## Database safety

PostgreSQL has one writable primary, an Inspur physical standby and an OVH physical standby. The standbys use the same pinned PostgreSQL image. The monitor verifies replay lag before making a standby eligible; replication slots have bounded WAL retention. Lost required WAL produces a restore-required alert and disqualifies the replica. After primary loss, a previously verified standby can continue serving read-only records, clearly marked as recovery data. Replication is asynchronous: recently unreplicated changes can be missing.

The primary's WAL retention setting is 64 GB (`max_slot_wal_keep_size`). A replacement backup needed more than 19 GB of WAL, and an earlier restore ran out of retained WAL with a 32 GB setting. Keep enough free disk space for this buffer and check that replay is catching up; a larger buffer cannot fix a replica that continually falls further behind. `wal_compression=zstd` reduces replication traffic; the primary and replica images support it, and `fsync` and `full_page_writes` stay enabled. Replica checks open an HA case immediately when the slot is missing, inactive or has lost WAL, and when lag stays above 1 MB for one minute. The lag timer persists across monitor restarts and clears only after catch-up; brief lag reports “catching up.” Replica eligibility and restore-required recovery still require lag at or below 1 MB. Lost WAL stays recorded through failed samples and clears only after that replica catches up. Restore into a new volume and verify the backup before replacing the failed replica; retain the old volume until recovery is confirmed.

The primary uses `max_wal_size=32GB` and a fifteen-minute checkpoint interval to reduce checkpoint churn during log processing. Reload-only settings in `scripts/resilience/tune-log-processing.sql` also set `effective_cache_size=48GB`, `work_mem=16MB`, and `maintenance_work_mem=1GB`. The cache estimate informs query planning; it does not allocate shared buffers. Sort memory is per operation, so monitor concurrent queries and actual memory pressure. These settings were applied with `ALTER SYSTEM` and verified live on 2026-09-20. `fsync` and `full_page_writes` remain enabled. This checkpoint threshold is separate from each replica's WAL retention limit, which must remain unchanged during recovery.

The primary has a 96 GiB memory limit with swap disabled. Its former 64 GiB limit was repeatedly reached while validating the log search index, reclaiming database and temporary-file cache despite ample host memory. This allowance was raised live without restarting PostgreSQL. Check actual cgroup memory, including file cache, rather than only Docker's cache-adjusted memory display. Keep host headroom and do not lower the limit during index validation or recovery.

The local Inspur standby has a 16 GiB memory limit and a separate 2 GiB swap allowance. Its former 2 GiB limit caused constant cache eviction while sharing the primary's disk. The larger limit lets it retain more database pages; CPU limits and database durability settings are unchanged.

During the OVH replica restore, `hanasand-db` uses a 26 GiB memory limit, a separate 2 GiB swap allowance, and `shared_buffers=16GB`. The larger cache gives index updates and vacuum replay more room to retain pages while recovering on hard disks. The cache was increased from 8 GB after replay repeatedly fell behind during disk-heavy vacuum passes; the restart completed gracefully on 2026-09-20. Check host available memory, swap growth, replay progress and replication lag before reducing this temporary allowance; do not shrink it during catch-up. A container memory limit can change without a restart, but changing `shared_buffers` requires one. For a planned replica restart, wait for graceful shutdown (`docker stop --timeout -1`) rather than killing a checkpoint after a short timeout. Preserve the data volume, loopback-only listening address, pinned image, replication settings and rollback container. Keep durability and replica eligibility checks enabled.

The live `shared_buffers=16GB` and `listen_addresses=127.0.0.1` values are also persisted in the replica configuration, keeping it consistent with the container startup settings.

The restored OVH replica also uses `max_wal_size=32GB` and `checkpoint_timeout=15min`, applied with `ALTER SYSTEM` and a configuration reload on 2026-09-20. These settings reduce restartpoint pressure and match the primary; they persist in the replica data volume and require no restart. The change was checked with 524 GB of free disk space. It does not change the primary replication slot retention limit, `fsync`, or `full_page_writes`.

During recovery, the scheduled API worker can use `LOG_CATCHUP_BATCH_LIMIT=100` to limit each page of historical and recovery work. Fresh command collection, recent-event priority, enabled security rules and saved cursors stay intact. The setting accepts integers from 1 to 1000; removing it restores the default. Keep it on the scheduled worker, not HTTP workers. Measure WAL generation and replica replay before lifting the limit, and coordinate changes with the owner of any ongoing database or index work.

OVH replication uses its own compressed SSH connection, `hanasand-tunnel-replication`, on the existing loopback port 18503. No SSH permissions or database connection settings change. After a restore's backup transfer finishes, run `isolated-tunnels.py split-replication` on Inspur; supply `--image` with an available tunnel image if the original image was removed. It refuses to interrupt a running backup, checks the image before stopping anything, keeps the legacy tunnel for rollback, and restores it if startup fails. Other forwards keep their existing settings; application queries remain on their separate, uncompressed connection. Verify that the replica catches up before treating it as recovered.

The replication connection has a two-CPU limit for compression and encryption. Its former half-CPU limit caused frequent throttling during recovery. Other connections keep their existing CPU limits. Measure transfer speed and replica replay under load; spare CPU alone does not prove that replication can keep up.

There is no automatic writable promotion. Two sites cannot distinguish a dead primary from a network partition without an independent fencing decision. Confirm the old primary cannot accept writes, check replay position and the accepted data-loss window, then promote through an operator-led procedure. Rejoin a former primary by reseeding it from the new primary; this installation does not assume pg_rewind prerequisites. The isolated switching check exercises replication, fenced promotion, reseeding and failback without stopping production databases.

Authentication validates actual stored sessions against the selected database. Read-only validation does not refresh timestamps or extend the persisted expiry. Missing/stale recovery status blocks mutations. Both API and frontend boundaries return a structured temporary-unavailability response; the UI identifies recovery and unavailable services. OVH permits core viewing and search, while heavy AI and administrative operations remain unavailable.

## Monitoring and alerts

The independent monitor serves loopback `/status`; the frontend consumes `/api/resilience`. It keeps checking services and routing traffic independently of the API. The scheduled API worker reads its state through `system:resilience` and collects backup, replication and failover failures into HA cases. Only the shared case sender posts to Discord, once per case and destination every 24 hours. Recovery closes the case; recurrence reopens the same case without resetting its notification limit. If the API or writable database is down, sampling continues and case checks resume when it returns.

DNS recovery is a last resort after public readiness fails despite service-level routing. Only explicit website/API A records are in scope. Mail and wildcard records remain unchanged. DNS caching means this path has a nonzero recovery interval; it is not a guarantee of uninterrupted requests during complete host loss.

## Operations

- `scripts/resilience/deploy-pair.sh frontend|api|auth` runs from `/home/hanasand/hanasand`. It builds an immutable revision image, starts two unused slots, verifies readiness, switches routing and drains old workers. `--no-build` requires the exact image already present.
- `scripts/resilience/maintenance.py ROOT SERVICE maint|ready INSTANCE...` updates both routing processes and persists maintenance state. Always restore maintenance after a drill.
- `scripts/resilience/backup.sh` takes a compressed backup from the local standby, checks it by restoring it, then sends it through a restricted SSH key. OVH retains fourteen backups. The receiver writes `backups/status.json` in its own directory. A failed job or no completed off-site backup within 36 hours updates the backup HA case. A lost replication slot updates the replica's separate case.
- Backup verification runs in one isolated container with a 96 GiB temporary RAM filesystem, a 128 GiB memory limit, no swap and a 4 GiB database cache. It requires at least 192 GiB of available memory on Inspur and fails clearly if the backup outgrows the temporary filesystem. This keeps restore writes off the live database's disk; physical-disk throttles were removed after they delayed queued writes on the shared filesystem. Recovery can take up to two hours (`BACKUP_VERIFY_RECOVERY_TIMEOUT_SECONDS`). PostgreSQL waits for readiness and reports startup failure. A backup is verified only after its manifest, WAL replay and actual read/write check pass. The archive stays on disk; only the disposable verification copy uses RAM. These limits do not change the live databases.
- `scripts/resilience/check-database-switch.sh` uses isolated temporary databases and leaves production databases untouched.
- `api/scripts/check-recovery-records.ts` creates and deletes a scoped temporary account, case and alert to verify authenticated alerts and actual timeline events, search and read-only boundaries during a drill.

Secrets stay outside source control. OVH receives a limited application database identity and a replication-only identity. The recovery monitor does not use a Discord webhook. It does not receive the primary's administrative, AI or SSH credentials.

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
- Historical checks used direct Discord messages. That sender has been removed; HA cases now own delivery and its 24-hour limit.
- Recovery UI browser checks passed normal, read-only, unavailable-status and failback states. Full API and frontend build checks passed; sixteen focused TI checks passed. The wider TI type-check retains unrelated existing errors.
- OVH's expired manual-renewal certificate was replaced with DNS-based automatic renewal. Both sites passed strict HTTPS readiness checks. Website/API DNS records were verified at a 60-second TTL; unrelated DNS records were unchanged.

The database switching drills exposed an unhandled error on a checked-out PostgreSQL connection, in addition to the earlier monitoring-convergence gap. The shared connection pool now handles those events and discards failed clients; session checks use the actual database role, and a single bounded pre-handler retry handles a connection switch before application execution. Anonymous requests also immediately use recovery rate counters when PostgreSQL rejects a shared-counter write, before monitor convergence. These fixes are covered by runnable regression checks.

Recovery alert reads skip projection-repair writes and page through the canonical alerts table. First pages fetch one extra row to expose a continuation cursor. A scoped live fixture checks a real replicated alert and a specific timeline event rather than accepting an empty response.

Reference behavior: [PostgreSQL standby and replication](https://www.postgresql.org/docs/15/warm-standby.html), [PostgreSQL base backups](https://www.postgresql.org/docs/15/app-pgbasebackup.html), [HAProxy supported releases](https://www.haproxy.org/).

## Isolated cross-site transports (12 September 2026)

The legacy SSH connection remains in place for existing consumers. Physical
database replication now uses the separate compressed connection described above.
Interactive database reads, intelligence queries, web traffic,
and monitor exchange use four independent SSH connections. This prevents bulk
replication or one connection's retransmission stalls from blocking all service
probes together. All forwarding listeners remain loopback-only, using the existing
restricted key and host-key verification.

Migration: run `isolated-tunnels.py authorize` as the existing OVH tunnel user,
build `Dockerfile.tunnel` with a revision tag, then run
`isolated-tunnels.py start --image REVISION_IMAGE` on Inspur. Verify the new listeners before running
`isolated-tunnels.py configure --root SITE_ROOT` at each site and gracefully
reloading the proxies. The helper retains the previous configuration; it never
stops the legacy tunnel. The later `split-replication` step moves only replication
off that connection. Source service ports and the stable database
proxy endpoint stay unchanged. New query forwarders use 28503/28502/28506,
intelligence 28097/29097, web 29300/29080/29090, and monitoring 29911.

HAProxy now has an explicit five-second health-response timeout. Previously its
two-second check interval implicitly bounded the response, which produced
simultaneous cross-site Layer7 timeouts. Three consecutive failures still remove
a server, and fifteen successful checks are required before failback. A slower
failure response budget trades several seconds of detection time for tolerance of
measured cross-site response variation; it does not make a failed response healthy.

Case events identify the observing site and retain proxy check status/duration.
Only the case sender notifies Discord, subject to its 24-hour limit; failover and
recovery do not send separate messages. A route unavailable from OVH does not establish
that the same service is down on Inspur. `check-routing-behavior.py` exercises a
three-second healthy response, sustained HTTP failure, and recovery using an
isolated HAProxy instance; it does not stop production services.

### Collector readiness latency

The primary collector uses `SCRAPER_HEALTH_PORT=8098` for an independent worker listening at `/v1/health`; requests still go to port 8097. Set `checkPort: 8098` only for this instance in the primary site's existing resilience configuration and update its `health` URL to the same private address on 8098. Do not regenerate live configuration or change remote tunnel ports. Query replicas retain their existing checks unless explicitly enabled separately.

The runtime publishes health every 50 ms. The worker refuses success once the sample is five seconds old, including time spent producing or delivering it. Startup, database errors and write backlogs retain their existing 503 semantics. A sustained blocked serving event loop therefore yields a fast 503. Brief scheduling/GC pauses retain the last verified result within the existing five-second routing check budget; the sub-20 ms response target is not a runtime failure deadline. Explicit database/write failures and startup still publish 503 immediately. Heartbeat age and the failure deadline are included in response headers for diagnosis. Resource diagnostics are sampled at most once per second; storage readiness is still sampled on every heartbeat using the existing database probe policy. This bounds the readiness heartbeat's staleness, not the underlying database probe interval. An absent/dead readiness worker also fails the routing check.

The under-20 ms response target is measured on the primary host, including the local HTTP connection. WAN round trips and full intelligence queries have separate latency budgets. Drain the collector before rebuilding it, verify both readiness and an actual query, then enable the new check port and restore routing. Preserve the two local routing instances and their existing fall/rise thresholds.
