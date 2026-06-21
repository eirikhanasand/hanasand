Status: paused_by_user_single_agent_mode

# Agent 06 Task

Stop evidence/read-model/storage work.

Make API/search results more useful for buyers.

Deliver:
- Improve `/search` or Actor output so a buyer can immediately see actor summary, recent activity, victims/targets, TTPs/tools, source pivots, freshness, and confidence.
- Replace vague “not indexed” or long internal status text with concise useful output.
- Add real-time refresh status: `searching`, then useful rows as they arrive.
- Do not expose raw leaked data or unsafe URLs.

Success metric:
- Better buyer-visible search result quality for real actor queries.

Before stopping:
- Run API/search tests.
- Commit and push.
