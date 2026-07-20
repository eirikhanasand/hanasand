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
- `SCRAPER_MEMORY_TARGET_MB=98304`.
- `SCRAPER_MEMORY_CEILING_MB=163840`.
- `SCRAPER_HIGH_RISK_REQUIRES_APPROVAL=true`.
- `SCRAPER_DARKNET_METADATA_ONLY=true`.
- `TI_EVIDENCE_ROOT=/var/lib/ti-scraper/evidence`.

## Resource Budget
- Keep the scraper near 96 GB RAM until sustained collection proves it needs more.
- Treat 160 GB as a ceiling, not a target.
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
- Create and verify a database plus evidence-volume archive: `./ti/scraper/scripts/threat-intel-backup.sh backup /secure/path/ti-backup`.
- Exercise an isolated restore without changing production: `./ti/scraper/scripts/threat-intel-backup.sh drill /secure/path/ti-backup`.
- Stop collection and restore the isolated `threat_intel` schema and evidence volume: `TI_RESTORE_CONFIRM=restore-threat-intel ./ti/scraper/scripts/threat-intel-backup.sh restore /secure/path/ti-backup`.
- Store archives encrypted outside the application host and run the drill before relying on a new backup.

## Incident Response
- If unsafe output appears, stop affected source family, preserve hashes/metadata, and remove public exposure.
- If disk free space is low, pause raw capture workers before API/search.
