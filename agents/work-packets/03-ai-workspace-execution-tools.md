---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 03: Browser Workspace Execution Tools

## Objective
Expose browser-triggerable execution actions in `/ai` so the coding workspace can run install/build/start flows from the browser, not just scaffold files.

## Why this matters
The user goal is for `/ai` to work directly from the browser. A useful coding workspace must move beyond file creation into install, build, run, and inspect.

## Scope for this pass
- Focus on the browser workbench in `frontend/src/components/ai/useAiWorkbench.ts` and related UI.
- Add one or two concrete execution actions with status reporting.
- Reuse existing agent/runtime tools where possible.

## Step-by-step
1. Audit how `/ai` currently calls browser-side tools and what state it keeps.
2. Decide whether execution should happen through Hanasand tool tags, direct API calls, or a dedicated action button.
3. Add at least one action for `npm install` and one for starting a local dev or compose workflow against an attached workspace.
4. Surface progress and failure state in the `/ai` UI.
5. Ensure long-running operations are discoverable and stoppable.
6. Capture logs into artifacts or workspace status notices.
7. Avoid leaving stray terminals or processes behind.
8. Test a full scaffold-to-run flow on a safe sandbox app.

## Acceptance criteria
- A user can trigger real workspace execution from `/ai`.
- Failures are visible and actionable.
- Cleanup behavior is documented and working.

## Future passes
- Add queued action histories.
- Add retry/restart buttons.
- Add VM-target execution once remote execution paths land.
