Status: paused_by_user_single_agent_mode

# Agent 05 Task

Increase useful metadata-only dark/restricted rows from 1,250 to 1,500.

Deliver:
- Add 250 more buyer-useful metadata rows.
- Each row must include actor/group, victim/target or dataset claim, sector/country when available, date/freshness, source family, confidence, public support pivot, and buyer action.
- Keep raw URLs, leaked content, credentials, payloads, and files out of output.
- Skip generic, stale, unsupported, duplicate, and non-actionable rows.

Success metric:
- Current useful metadata-only rows reach 1,500 with 0 blocked or projected rows counted as useful.

Before stopping:
- Run dark metadata tests.
- Commit and push.
