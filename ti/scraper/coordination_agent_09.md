Status: ready_for_next_task

# Agent 09 Summary

- Improved the Apify Actor buyer-facing dataset surface with `buyerSummary`, `recommendedBuyerAction`, and `keyPivots` on output rows, plus table/schema visibility for those fields.
- Tightened Actor smoke coverage so buyer-facing row fields must be present and must avoid internal proof/blocker/governance/agent wording.
- Updated Store-facing README/output copy to lead with analyst value, recommended actions, pricing clarity, and safe metadata boundaries instead of internal release mechanics.
- Verification is green for `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and `bun run check:apify-publication`.
- Requesting the next Agent 09 API/product-surface, hosted proof, marketplace conversion, or Apify buyer-output task.
