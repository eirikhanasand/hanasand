---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 19: Tests And Smoke Coverage

## Objective
Add or improve tests and smoke flows that cover the agent’s new scaffold-and-run capabilities.

## Why this matters
Autonomous features are only trustworthy if there is a repeatable way to prove they still work after future changes.

## Scope for this pass
- Add the most leverage-heavy tests first.
- Prefer smoke coverage over exhaustive testing if time is limited.

## Step-by-step
1. Audit current Playwright and script-based smoke coverage for `/ai`.
2. Identify the biggest untested paths introduced by recent agent tooling work.
3. Add at least one focused test or smoke script for a scaffold-and-run flow.
4. Keep test setup practical and avoid brittle environment assumptions where possible.
5. Capture useful failure logs or screenshots.
6. Document any environment preconditions explicitly.
7. Run the test if local conditions allow.
8. Record results and gaps in this file.

## Acceptance criteria
- At least one meaningful new path is covered.
- The test or smoke is reusable by future agents.
