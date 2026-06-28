# Hanasand Agent Operating Contract

## Default Bar
Hanasand work should feel finished, integrated, and product-grade. Do not treat user requests as tiny literal patches when the surrounding product behavior clearly needs more. Expand the ask into the adjacent obvious work that a user would reasonably expect, then ship that complete slice.

When the user points at one visible flaw, inspect the whole affected surface for the same class of flaw. If one button background is wrong, check the neighboring buttons. If one label is unclear, check nearby labels, empty states, tooltips, and generated copy. If one page has contrast issues, verify both themes and responsive layouts.

## Definition Of Done
Before final response, a task is not done until all applicable items are true:

- The user-facing behavior is implemented end to end, not only scaffolded.
- Nearby related UI/API states are handled: loading, empty, error, hover/focus, mobile, desktop, light/dark when present.
- The feature is wired to real data or an honest fallback with clear product semantics.
- The implementation is committed only when the intended diff is cleanly isolated from unrelated dirty work.
- The agent's own work is not left as loose dirty files. Commit, deliberately leave only user-owned pre-existing changes, or explicitly report a blocker.
- Verification includes focused automated checks and, for UI work, an actual browser/render proof when feasible.
- Production-impacting changes are deployed and probed live when the user asked for deploy or the thread convention expects it.
- The final answer states exactly what changed, what was verified, what commit/deploy happened, and any real remaining limitation.

## Overdelivery Heuristic
For every request, ask:

1. What would make the user say "yes, that is the thing I meant" without another correction?
2. What adjacent inconsistency will become obvious once this change ships?
3. What evidence would prove this works in the actual app, not just in code?
4. What can be improved within the same scope without creating a risky redesign?

Do that work unless it would be unsafe, destructive, or clearly outside the product direction.

## Product Language
Avoid vague AI/product filler such as "signals", "confidence" without evidence, "powered by", "seamless", or brand-as-analyst phrasing. Prefer plain explanations that say what data was used, what happened, why it matters, and what the user can inspect next.

## UI Quality Rules
UI changes must be visually checked, not guessed. Verify text contrast, overflow, responsive fit, and hover/focus affordances. Use compact, useful controls rather than decorative cards. A page should look like a real product surface, not a partial demo.

## Coordination
Respect existing dirty work. Read `git status --short` before edits and keep that as the baseline. Do not revert user or other-agent changes. If a touched file contains unrelated changes, isolate your patch carefully and say so.

## Required Task Flow
For every future prompt, especially product/UI work, use this operating loop:

1. Start by recording `git status --short` as the BASELINE.
2. Write 3-7 acceptance criteria from the user's request before or while orienting.
3. Identify the affected routes, files, and product surfaces.
4. Implement until all acceptance criteria pass, including adjacent obvious gaps in the same surface.
5. Add or adjust focused tests where the behavior can regress.
6. Verify UI work in a browser/rendered surface when feasible.
7. End with focused checks, an isolated commit, and push/deploy/probe when production-impacting or expected by the thread.

The final handoff for implementation work must include these lines:

- `BASELINE dirty files:`
- `FINAL dirty files:`
- `Commit:`
- `Checks:`
- `Live probes:`
- `Remaining blockers:`

Every agent must clean up after itself:

- Start by recording the dirty-worktree baseline.
- Before handoff, run `git status --short` again.
- If the repo was clean at start, it should be clean at handoff unless the user explicitly asked for uncommitted changes.
- If the repo was dirty at start, the final dirty list may contain only the same pre-existing paths plus files the user explicitly asked to leave uncommitted.
- Do not leave generated screenshots, temp scripts, logs, build artifacts, test outputs, or exploratory files in tracked or untracked repo paths.
- Do not use `git reset --hard`, destructive checkout, or broad cleanup to hide a mess. Clean only files you created, and preserve other agents' or the user's work.
- If a commit is appropriate, commit only the isolated intended diff. Do not bundle unrelated dirty files just to make the status clean.

## Context And Archive Discipline
The Codex archive shows multiple huge threads, including raw sessions over 1GB and hundreds of truncated events. Avoid recreating that failure mode.

- Do not paste or load giant raw chat/session files into context. Use `manifest.json`, `index.md`, targeted `rg`, and small snippets.
- When a task becomes long-running, maintain a concise handoff note with current state, decisions, commands run, verification, commits, and remaining work.
- If a chat is approaching runaway size or repeated continuation prompts, stop expanding the same thread. Summarize, checkpoint the repo, and recommend a fresh worker/thread with the handoff note.
- Prefer durable repo docs, tests, and coordination files over relying on a massive chat transcript as memory.

TI folders may have stricter local overrides. Obey `AGENTS.override.md` files inside TI paths.
