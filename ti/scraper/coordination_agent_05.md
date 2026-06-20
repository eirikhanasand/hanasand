Status: active_program_cv_dark_metadata_public_support_sellable_100

# Agent 05 Coordination

## Current Program: CV Dark Metadata Public-Support Sellable 100

You are no longer ready/idle. Own the next dark-metadata monetization pass that turns the 100 repair candidates into current sellable rows only when safe public corroboration exists.

Goal: make dark/restricted metadata commercially useful without pretending restricted-only metadata is chargeable. Raise the current sellable row count by attaching public corroboration to high-value metadata candidates.

Scope:
- Start from `publicSupportLift1000.first100RepairQueue` and select the highest value candidates by recency, actor confidence, victim/target specificity, business impact, and public corroboration likelihood.
- Add source-family support fields that can prove a row using clear-web or public-channel evidence while keeping dark metadata hash-only.
- Produce a row-level handoff to Agent 03 with exact parser requirements for each candidate: actor, victim, sector, country, TTP/tool, dataset claim, date, and safe public source identifiers.
- Reject or retire candidates that are unsafe, low-value, stale, duplicate, or impossible to corroborate publicly. Do not count these toward the 100 paid floor.
- Keep tier growth honest: 100 -> 1,000 -> 4,000 -> 10,000 only when value density is proven by current sellable or high-confidence public-support rows.

Definition of done:
- Route/API/Actor-visible counters show current chargeable rows, projected-after-public-support rows, retired rows, and remaining gap to 100.
- No raw leak bodies, credentials, payloads, unsafe raw URLs, stolen files, private/auth/CAPTCHA access, or threat-actor interaction.
- `bun run check`, focused darkweb/API/ops tests, `bun run check:contract-index`, and full `bun test` pass.
- Update this file, commit, push, and continue into the next metadata support batch without waiting unless the lane is genuinely blocked.
