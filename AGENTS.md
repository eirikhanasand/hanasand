# Hanasand Agent Operating Contract

## Ship Mode Override
The product is moving too slowly. Stop spending prompts on readiness/receipt/proof/contract work unless it directly unlocks a visible user workflow in the same change. The user wants fast, obvious product improvement across the website, not long chains of tiny implementation receipts.

Default to ship mode:

1. One main thread owns the website and portal experience end to end.
2. No more readiness, receipt, proof, or contract-only slices unless they are required to make a visible workflow work in the same prompt.
3. Prioritize these three surfaces: `/dashboard`, `/ti/<query>`, and organization/watchlist/settings workflows.
4. In one prompt, make the chosen surface visibly better with real APIs, useful UI states, quick visual check only when it directly helps ship, then always commit, push, deploy, and probe.
5. Use subagents only for narrow backend blockers that prevent the visible workflow from shipping.

If a task would only add metadata, receipts, proof ledgers, compatibility fixtures, or readiness rows, stop and instead implement the visible customer or analyst workflow those artifacts were supposed to support. The final result should be something a user can open and immediately feel is better.

## Functionality-First Sprint Override
Every agent should ship product code as fast as possible. Spend tokens on usable components, API wiring, real source output, alert workflows, DWM/TI coverage, org/watchlist/settings workflows, and deployable UI. Do not spend tokens on process artifacts, broad test campaigns, strategy essays, readiness/proof receipts, or coordination polish.

The product should feel like Microsoft Defender for Endpoint: compact queues, actionable tables, detail panes, evidence timelines, filters, assignments, source provenance, and workflow actions. Remove essay text sections, marketing copy, explanatory walls, teaser panels, and prompt-shaped labels. Replace them with controls and data the user can act on.

Sellable surfaces are the priority: `/ti`, `/ti/<query>`, DWM/exposure monitoring, actor intelligence, source coverage, alerts/cases, webhooks, and organization/watchlist/settings. Each pass should make one of those surfaces visibly more useful to a buyer or analyst.

Testing overhead is not the work. Run only the smallest fast check needed to avoid shipping obviously broken code, then return to product code. If a check will consume meaningful time or tokens without directly protecting the shipped surface, skip it and state that it was intentionally skipped for ship speed.

## One-Prompt Product Shipping Bar
Do not give agents small work-sized packets. Codex can make broad, coherent product changes in one prompt. A ship-mode prompt should ask for a complete visible product surface, not one receipt, one schema, one card, or one copy fix.

Hanasand should feel closer to Microsoft Defender for Endpoint or Wiz: dense, operator-grade, scannable, action-first, and visually disciplined. It should not feel like a text-bloated wall, a status essay, a receipt ledger, or a loose collection of cards.

For the three priority surfaces, ship the full workflow shape in one pass:

- `/dashboard`: a Defender/Wiz-style operator console with a left queue, severity and ownership, selected alert/case detail, evidence timeline, source/provenance, org/watchlist context, workflow actions, delivery/case timeline, and compact source health.
- `/ti/<query>`: an actor intelligence workspace with compact actor facts, aliases, TTPs, infrastructure, tools/malware, observed sources, evidence rows, watchlist relevance, enrichment gaps, and alert/case handoff. Ban teaser/example/signal language.
- Organization/watchlist/settings: a SaaS settings workflow for org creation, invites, member roles, shared watchlists, webhook destinations/test delivery, permissions, and audit trail.

A one-prompt ship must include real API wiring where available, loading/empty/error states, responsive desktop/mobile behavior, quick visual check only when it directly helps ship, focused checks, commit, push, deploy, and live probe. If backend support is missing, implement the missing hook in the same prompt when reasonable; otherwise ask exactly one narrow blocker agent.

## Default Bar
Hanasand work should feel finished, integrated, and product-grade. Do not treat user requests as tiny literal patches when the surrounding product behavior clearly needs more. Expand the ask into the adjacent obvious work that a user would reasonably expect, then ship that complete slice.

The goal is quality, not speed. It is acceptable for a prompt to take many steps when that is what it takes to make the product good. Do not optimize for the fastest plausible stopping point. Optimize for the point where the user can open the product and feel that the workflow actually works.

The recurring failure mode to avoid is "dashboard slop": cards, counters, charts, text walls, thin status pages, and placeholder promises that describe a future product instead of letting someone do the job now. If a product request can be interpreted as either a reporting view or an application workflow, build the workflow unless the user explicitly asked only for reporting.

When the user points at one visible flaw, inspect the whole affected surface for the same class of flaw. If one button background is wrong, check the neighboring buttons. If one label is unclear, check nearby labels, empty states, tooltips, and generated copy. If one page has contrast issues, verify both themes and responsive layouts.

## Definition Of Done
Before final response, a task is not done until all applicable items are true:

- The user-facing behavior is implemented end to end, not only scaffolded.
- For product surfaces, the result lets the target user perform the job, not only observe metrics. If the user asks for an analyst/security/customer workflow, ship a workbench: queue, detail view, evidence, decision controls, assignment/notes where applicable, delivery/replay, and audit trail. A dashboard-only answer is incomplete unless the user explicitly asked only for reporting.
- Nearby related UI/API states are handled: loading, empty, error, hover/focus, mobile, desktop, light/dark when present.
- The feature is wired to real data or an honest fallback with clear product semantics.
- The implementation is always committed. Stage only the intended diff and preserve unrelated dirty work by leaving it unstaged.
- The agent's own work is not left as loose dirty files. Commit the agent-owned diff, push it to GitHub and Forgejo, deploy it from the real server checkout, and explicitly report any unrelated pre-existing dirty files left unstaged.
- Verification includes focused automated checks and, for UI work, an actual browser/visual check when feasible.
- Production-impacting changes are always deployed and probed live.
- The final answer states exactly what changed, what was verified, what commit/deploy happened, and any real remaining limitation.

## Overdelivery Heuristic
For every request, ask:

1. What would make the user say "yes, that is the thing I meant" without another correction?
2. What adjacent inconsistency will become obvious once this change ships?
3. What evidence would prove this works in the actual app, not just in code?
4. What can be improved within the same scope without creating a risky redesign?
5. Is this only a dashboard/report when the product actually needs an operator workflow?
6. If I stop here, will the user still need to push ten more times for the feature to feel usable?
7. What would a competitor product let the user do here, and what would make this feel better?

Do that work unless it would be unsafe, destructive, or clearly outside the product direction.

## Analyst Portal Bar
Threat intelligence, DWM, XDR, SOC, monitoring, status, and incident-response work must be treated as operator portals by default. The minimum useful slice is not a card grid. It must include:

- A prioritized queue of actionable items.
- A selected-item detail panel with evidence, timestamps, source, objective confidence/reasoning, provenance, and blast-radius context.
- Analyst actions such as review, escalate, assign, mute/false-positive, replay evidence, send/test delivery, and close when the backing API supports them.
- Notes or decision rationale, persisted when the backing API supports it and clearly session-local when it does not.
- A visible timeline/audit trail.
- Source/task sidebars that show what collection or enrichment should happen next.
- Real API/data wiring where available.
- Empty states that help the analyst create the first case or run the first collection, not marketing copy.

If a worker creates only overview metrics, chart cards, or promise text for these domains, the task has underdelivered.

## Application Workflow Bar
Most Hanasand product asks should result in a usable application surface, not a decorative page. A presentable slice usually includes:

- A real primary workspace where the target user performs the job.
- Clear objects the user can select, inspect, edit, route, or act on.
- State transitions that make the workflow move forward.
- Context panels that expose evidence, history, ownership, and next steps.
- Action feedback, empty states, and failure states.
- Persistence/API wiring when available, and honest session-local behavior when persistence is not yet built.

Do not stop at scaffolding, static mocks, "coming soon" copy, or generic dashboard summaries. If the implementation still feels like a demo, keep going within the same product slice.

Do not stop at 5 percent of the ask. If the obvious next 20 percent is inside the same product slice and is what makes the feature usable, do it before handing off.

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
4. Implement until all acceptance criteria pass, including adjacent obvious gaps in the same surface and the root product gap behind the literal example.
5. Include loading, empty, error, mobile, desktop, hover/focus, and light/dark states where relevant.
6. Add or adjust focused tests where the behavior can regress.
7. Verify UI work in a browser/rendered surface when feasible.
8. End with focused checks, an isolated commit, push to GitHub and Forgejo, deploy from the real server checkout, and live probe.

## Commit And Deploy Discipline
Every implementation prompt ends with a real commit and deployment. Do not leave agent-authored code or docs uncommitted because the tree was dirty; stage only the intended paths and leave unrelated dirty files unstaged.

- Always commit the agent-owned diff locally, then push the commit to both GitHub and Forgejo.
- Always deploy from the real Hanasand directory on the server. Never deploy from a temp folder, copied checkout, archive, worktree, or generated staging directory.
- Never use `rsync` for Hanasand deployment.
- Never copy `.env`, env folders, secret folders, or environment material as part of deployment. The server's real checkout and existing server environment are the source of truth.
- On the server, update the real Hanasand checkout from git, verify it is on the intended commit/main branch, then rebuild/restart from that directory only.
- Keep local `main`, GitHub, Forgejo, and the deployed server checkout aligned to the same commit unless a command is blocked; report the exact blocker and commit hash.

Do not say a task is done because scaffolding exists. The user must be able to do meaningful work in the product. If the result still feels like dashboard cards instead of a usable application, continue.

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
- If the repo was clean at start, it should be clean at handoff after the commit unless unrelated external changes appeared during the task.
- If the repo was dirty at start, commit the agent-owned diff and leave only pre-existing unrelated paths unstaged.
- Do not leave generated screenshots, temp scripts, logs, build artifacts, test outputs, or exploratory files in tracked or untracked repo paths.
- Do not use `git reset --hard`, destructive checkout, or broad cleanup to hide a mess. Clean only files you created, and preserve other agents' or the user's work.
- A commit is always required for agent-owned changes. Commit only the isolated intended diff. Do not bundle unrelated dirty files just to make the status clean.

## Context And Archive Discipline
The Codex archive shows multiple huge threads, including raw sessions over 1GB and hundreds of truncated events. Avoid recreating that failure mode.

- Do not paste or load giant raw chat/session files into context. Use `manifest.json`, `index.md`, targeted `rg`, and small snippets.
- When a task becomes long-running, maintain a concise handoff note with current state, decisions, commands run, verification, commits, and remaining work.
- If a chat is approaching runaway size or repeated continuation prompts, stop expanding the same thread. Summarize, checkpoint the repo, and recommend a fresh worker/thread with the handoff note.
- Prefer durable repo docs, tests, and coordination files over relying on a massive chat transcript as memory.

TI folders may have stricter local overrides. Obey `AGENTS.override.md` files inside TI paths.
