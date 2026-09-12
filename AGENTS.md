# Hanasand agent rules

Fix the user's request completely, including root causes and nearby issues that make it broken, misleading, unusable, or unsafe. Leave optional improvements alone, but report these to the user.

Prefer deletion, reuse, plain language, and the smallest complete fix. Verify the result once when useful, then stop when it works.

Do not expand a small request into a redesign, new workflow, documentation exercise, or deployment ceremony unless the request requires it. Preserve unrelated work in a dirty tree. Never expose secrets or perform destructive actions without explicit scope.

Always work on the main branch, never create new worktrees, branches or checkouts as there is a chance of forgetting to merge these into the real main.

Push to Github and Forgejo when done.

Always explain what you did, what the problem was, what the fix was and report the commit hash in your summary.

## Automated checks and service accounts

Do not create timestamped monitor users or one-off production audit users. Reuse an existing service account with only the endpoints the task needs. On the hanasand server, protected `/home/hanasand/monitor-state/service-accounts.env` contains `MONITOR_SERVICE_ACCOUNT_KEY` (authentication health checks) and `HANASAND_DB_MONITOR_SERVICE_ACCOUNT_KEY` (database UI monitoring). Load credentials locally on that server; never print keys, copy them into chat, or commit them. Use `X-API-Key` for API requests. A missing or insufficient scope is a configuration problem, not a reason to create a new user or grant administrator roles.

Service accounts are managed at `/management/service-accounts` or `GET/POST /api/service-accounts` and `DELETE /api/service-accounts/:id` with a system-administrator session. Creation accepts `{name, scopes: [{method, route}]}` and returns the key once. GET lists the supported endpoints. No wildcard permissions or human login sessions are granted. The database browser monitor can use its service key in a short-lived browser context; the frontend permits only GET/HEAD `/db` and the API still enforces endpoint scopes. Revoke unused accounts through the service-account API.
