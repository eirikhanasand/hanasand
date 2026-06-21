Status: paused_by_user_single_agent_mode

# Agent 07 Task

Remove useless rows from paid output.

Deliver:
- Identify stale, generic, duplicate, wrong-actor, contradiction, graph-only, restricted-only, and source-provenance-only rows currently appearing in Actor/API surfaces.
- Suppress them or rewrite them into clear held/caveated rows that are not counted as sellable.
- Replace low-value rows with specific buyer actions where possible.

Success metric:
- Higher percentage of Actor rows that a buyer would keep.

Before stopping:
- Run Actor/API quality checks.
- Commit and push.
