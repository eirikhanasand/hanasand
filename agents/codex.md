# Codex Handoff

## Completed
- Auth/session management, logs ingestion/querying, status monitoring, and the request workbench are implemented locally.
- Dashboard logs, sidebar, overview styling, AI route repair, and related dashboard operations work are in place.
- Local typecheck, audit, and Playwright auth coverage were green in the last verification pass.
- Added local hardening work across `docs`, `idk`, and `pwned`.
- Verified local Docker health for `docs`, `idk_backend`, `idk_frontend`, and `pwned`.
- Verified `pwned` locally in both direct-run and Docker modes.
- Added Hanasand monitoring pages and shared monitoring data plumbing:
  - overview
  - vulnerabilities
  - richer traffic page
  - live traffic proxy route

## Remaining Work
- Add native server logs to the logs page so they are indexed and searchable like regular logs.
- Includes both history, systemctl logs, ssh logs and other logs so it can be used like a full security product.
- Rerun the expanded API audit in the deployed container and smoke `/status` plus `/dashboard/logs`.
- Deploy the Docker socket mount change and verify live container logs on the VM.
- Finish the remaining dashboard polish:
  - VM start flow end-to-end verification
  - mail left-nav/modal/overflow fixes
  - traffic/status cleanup and smoke coverage
  - larger AI simplification pass
  - pwned Playwright investigation
- Finish Queenbee parity still missing in Hanasand:
  - backup page
  - status/management surfaces
  - service detail pages
- Do authenticated runtime verification of the new monitoring/admin pages.
- Resume remote deployment work for `docs` and `idk` with a more inspectable build flow; previous SSH-triggered BuildKit runs stalled.
- Resolve share/alias context churn and the broader AI-agent/beeswarm integration work.
- Continue the broader infra/security asks:
  - scanners and rulesets
  - per-container scanning UI
  - Discord escalation webhook
  - broader Docker app review and staged remote deploys
