Status: active_actor_smoke_19_to_30_sellable

# Agent 03 Task

Continue row conversion in the Actor output path.

Current smoke result:
- 19 sellable rows
- 14 sellable findings

Deliver:
- Raise smoke output to at least 30 sellable rows and 20 sellable findings.
- Convert caveated current rows only when actor, victim/target or TTP/tool, date/freshness, source support, confidence, and buyer action are present.
- Add buyer-facing summaries, recommended actions, and pivots for converted rows.
- Drop stale, generic, duplicate, wrong-actor, contradiction, graph-only, restricted-only, and source-only rows.

Success metric:
- Actor smoke sellable rows and sellable findings increase.

Before stopping:
- Run parser and Actor checks.
- Commit and push.
