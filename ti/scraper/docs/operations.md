# Scraper Operations

## Runtime
- Bun + TypeScript.
- Start: `bun run start`.
- Test: `bun test`.
- Type-check: `bun run check`.
- Health: `GET /v1/health`.
- Resource snapshot: `GET /v1/ops/resource-snapshot`.

## Production Defaults
- `SCRAPER_ENV=production`.
- `SCRAPER_PORT=8097`.
- `SCRAPER_MEMORY_TARGET_MB=8192`.
- `SCRAPER_MEMORY_CEILING_MB=14336`.
- `SCRAPER_HIGH_RISK_REQUIRES_APPROVAL=true`.
- `SCRAPER_DARKNET_METADATA_ONLY=true`.
- `TI_EVIDENCE_ROOT=/var/lib/ti-scraper/evidence`.

## Resource Budget
- Keep the scraper near 8 GB RAM until sustained collection proves it needs more.
- Treat 14 GB as the application ceiling inside the 16 GB container limit.
- Keep Playwright/dynamic browser work disabled unless explicitly isolated.
- Keep queues, captures, and object evidence disk-backed for sustained crawling.

## Adapter Order
1. RSS and static clear-web public sources.
2. Public advisory APIs and report indexes.
3. Public Telegram/channel handoffs where approved.
4. PDF/report text extraction.
5. Dynamic browser canary workers only when static capture fails.
6. Restricted/darknet metadata only after source approval and metadata-only policy checks.

## Evidence Rules
- Public API output may expose hashes, timestamps, source ids, confidence, and safe summaries.
- Never expose raw leaked material, credentials, cookies, tokens, raw object keys, raw screenshots, private invites, or unsafe links.
- Restricted material is metadata-only.
- Use provenance hashes so every claim can be traced without redistributing raw evidence.

## Deployment
- Build: `docker compose build ti-scraper`.
- Deploy: `docker compose up -d ti-scraper api frontend`.
- Internal scraper URL: `http://ti-scraper:8097`.
- Public UI path: `https://hanasand.com/ti`.
- Verify container health before routing traffic.

## Live Collection
- Activate sources deliberately through source registry APIs.
- Keep canaries bounded by task count, byte caps, timeout, and queue pressure.
- Prefer fresh, actor-specific rows over broad generic pages.
- Promote sources only when they produce useful actor/victim/target/TTP pivots.

## Rollback
- Pause or disable problematic sources first.
- Roll back to the last known-good image tag if API health or safe-output checks fail.
- Re-enable gradually by adapter family and source family.

## Backup And Restore
- Create and verify the complete application PostgreSQL snapshot plus evidence volume: `./ti/scraper/scripts/threat-intel-backup.sh backup /secure/path/ti-backup`. The artifact includes every non-system schema/table so TI workflow tables outside `threat_intel` and future migrations cannot be silently omitted. Every backup also exports external-object references from that same database snapshot, requires the referenced `.bin` and `.bin.json` files in the evidence tar, and binds their bytes plus both database and file-object recovery metadata to real SHA-256 values before publication. Historical database/file retention-class differences are preserved exactly and counted rather than rewritten during recovery.
- Exercise a full restore without changing production: `./ti/scraper/scripts/threat-intel-backup.sh drill /secure/path/ti-backup`. The drill starts ephemeral PostgreSQL and evidence-volume targets, reconciles every table, evidence-file hash, and DB-linked object, runs `PostgresScraperStore` reads against the restored state, records the exact verifier commit plus immutable verifier and PostgreSQL image IDs, and removes both targets. Backup manifests separately bind the exact running scraper/PostgreSQL source containers and images; every source read and verifier/restore run uses those resolved immutable IDs so concurrent replacement or retagging fails or remains attributable.
- The scheduled wrapper runs daily at 02:23 UTC, drills on Sunday, retains 14 days by default, and writes `LATEST-STATUS` with an exit code plus allowlisted phase/reason on success or failure. It requires host `flock`; a concurrent run is logged as skipped and does not overwrite the last completed status. If the configured backup root itself cannot be created or made private, only stderr is possible because there is no safe location for durable status.
- There is deliberately no in-place production restore action. Keep production online and restore only into an isolated target; promote recovered data through a separately reviewed incident plan.
- Store archives encrypted outside the application host and require the receipt named by `RESTORE-LATEST` to have a successful `RESTORE-REPORT` before relying on a backup. A failed drill writes bounded details to `RESTORE-LAST-ATTEMPT` and leaves the last successful receipt unchanged.

Each published archive contains `database.dump`, `DATABASE-INVENTORY.tsv`, `OBJECT-REFERENCES.tsv`, `OBJECT-LEDGER.tsv`, `evidence.tar.gz`, `EVIDENCE-INVENTORY.tsv`, `BACKUP-MANIFEST`, and `SHA256SUMS`. A successful drill atomically publishes a `RESTORE-RECEIPT-*` directory containing `RESTORE-INVENTORY.tsv`, `RESTORE-EVIDENCE-INVENTORY.tsv`, `RESTORE-OBJECT-LEDGER.tsv`, `APPLICATION-READ-PROOF.json`, `RESTORE-REPORT`, and `RESTORE-SHA256SUMS`; all source/restored inventories and the DB-bound object ledger must be byte-identical.

Deployment keeps the existing managed cron entry and defaults. After integration, build the `ti-scraper` image so the application-read command is available, run one manual backup and drill into a new archive directory, confirm `status=succeeded`, `content_hashes=matched`, `application_read=passed`, and `target_removed=true`, then observe the next scheduled daily run. Changing production cron, replacing live data, or stopping healthy services is not part of this runbook.

## Incident Response
- If unsafe output appears, stop affected source family, preserve hashes/metadata, and remove public exposure.
- If disk free space is low, pause raw capture workers before API/search.
