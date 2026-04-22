---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 11: VM Connection Foundation

## Objective
Lay the groundwork for the agent to target Hanasand VMs as execution environments instead of only local repo sandboxes.

## Why this matters
The long-term user goal is remote work on VMs created through Hanasand. This packet should build the first real bridge instead of vague planning.

## Scope for this pass
- Stay within Hanasand project boundaries.
- Focus on what the current VM APIs already support and what the agent would need next.

## Step-by-step
1. Audit `api/src/routes.ts` and current VM handlers for create/action/details endpoints.
2. Map which VM actions are already available and authenticated.
3. Define a minimum viable agent-facing execution contract for a VM target.
4. Add any missing read-only status or metadata surface needed for that contract.
5. If safe, add a small internal helper or type layer for VM-target tool calls.
6. Document exactly what is still missing for true remote command execution.
7. Update coordination notes with concrete next steps, not just ideas.
8. Avoid promising remote file writes unless they are actually wired.

## Acceptance criteria
- There is a concrete technical bridge from `/ai` to VM concepts.
- The next agent can continue implementation without re-auditing the whole VM surface.
