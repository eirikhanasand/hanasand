# Hanasand agent rules

Fix the user's request completely, including root causes and nearby issues that make it broken, misleading, unusable, or unsafe. Leave optional improvements alone, but report these to the user.

Prefer deletion, reuse, plain language, and the smallest complete fix. Verify the result once when useful, then stop when it works.

## Product language

- Write alerts, case summaries and documentation in simple, natural language. State the problem and the next action. Say “Restore the replica from a backup,” not “Reseed the affected replica from a verified source before treating it as recovered.” Keep detailed evidence in the case and do not claim recovery before the failing check passes.
- Monitoring events must be collected in HA cases. Only the shared case sender may notify Discord, at most once per case and destination every 24 hours, including across restarts and recurrence.

- Implement the requested behavior. Do not answer the prompt inside the product with explanatory cards, banners, divs, capability lists, implementation summaries, or claims that a feature is real, safe, complete, or working.
- Keep implementation explanations and verification results in the task response. Add UI text only when it helps someone choose an action, understand actual data, complete a field, or recover from an error.
- Use short, natural labels and concrete language. Remove redundant introductions, repeated headings, development jargon, and test or acceptance terminology from display copy. Preserve necessary guidance, validation, permissions, and recorded audit data.
- When cleaning up copy, remove the unnecessary element rather than replacing it with another paragraph explaining the cleanup. Do not add tests that require filler text to exist.

Do not expand a small request into a redesign, new workflow, documentation exercise, or deployment ceremony unless the request requires it. Preserve unrelated work in a dirty tree. Never expose secrets or perform destructive actions without explicit scope.

Always work on the main branch, never create new worktrees, branches or checkouts as there is a chance of forgetting to merge these into the real main.

After completing and verifying requested changes, always commit, push to both GitHub and Forgejo, and redeploy the affected service. This is standing user authorization; do not ask for confirmation again for routine publication or deployment. Verify the deployed revision and affected live behavior before reporting completion.

Always explain what you did, what the problem was, what the fix was and report the commit hash in your summary.

## Automated checks and service accounts

Do not create timestamped monitor users or one-off production audit users. Reuse an existing service account with only the endpoints the task needs. On the hanasand server, protected `/home/hanasand/monitor-state/service-accounts.env` contains `MONITOR_SERVICE_ACCOUNT_KEY` (authentication health checks) and `HANASAND_DB_MONITOR_SERVICE_ACCOUNT_KEY` (database UI monitoring). Load credentials locally on that server; never print keys, copy them into chat, or commit them. Use `X-API-Key` for API requests. A missing or insufficient scope is a configuration problem, not a reason to create a new user or grant administrator roles.

Service accounts are managed at `/management/service-accounts` or `GET/POST /api/service-accounts` and `DELETE /api/service-accounts/:id` with a system-administrator session. Creation accepts `{name, scopes: [{method, route}]}` and returns the key once. GET lists the supported endpoints. No wildcard permissions or human login sessions are granted. The database browser monitor can use its service key in a short-lived browser context; the frontend permits only GET/HEAD `/db` and the API still enforces endpoint scopes. Revoke unused accounts through the service-account API.
