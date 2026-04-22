---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 18: Security And Guardrails For Agent Tooling

## Objective
Audit and strengthen the guardrails around new autonomous tooling, especially commands, compose execution, and future VM targets.

## Why this matters
The agent is getting more powerful. That must come with clear execution boundaries, safety checks, and honest failure modes.

## Scope for this pass
- Focus on practical hardening.
- Avoid vague policy writing without code or documented enforcement points.

## Step-by-step
1. Review current command sandboxing and managed process boundaries.
2. Audit the new compose helpers and scaffold tools for path and execution safety.
3. Identify any cases where the model could act outside the intended repo root or leave behind risky state.
4. Add targeted guardrails where the code is currently too permissive.
5. Improve error messages for blocked or unsafe actions.
6. Document what would need to change before VM-target execution is safe.
7. Add or update comments only where they genuinely help future maintainers.
8. Record the audit summary in this file and coordination notes.

## Acceptance criteria
- New tooling is at least as safe as existing repo tools.
- The next agent has a concrete list of remaining security gaps.
