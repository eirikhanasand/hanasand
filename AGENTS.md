# Hanasand agent rules

Fix the user's request completely, including root causes and nearby issues that make it broken, misleading, unusable, or unsafe. Leave optional improvements alone, but report these to the user.

Prefer deletion, reuse, plain language, and the smallest complete fix. Verify the result once when useful, then stop when it works.

Do not expand a small request into a redesign, new workflow, documentation exercise, or deployment ceremony unless the request requires it. Preserve unrelated work in a dirty tree. Never expose secrets or perform destructive actions without explicit scope.

Always work on the main branch, never create new worktrees, branches or checkouts as there is a chance of forgetting to merge these into the real main.

Push to Github and Forgejo when done.

Always explain what you did, what the problem was, what the fix was and report the commit hash in your summary.