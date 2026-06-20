Status: active_program_cu_dark_metadata_4000_to_10000_public_support_repairs

# Agent 05 Coordination

- Completed Program CR metadata-only public-support lift from 1,000 to 4,000 candidates.
- Extended `publicSupportLift1000` on `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, and `/v1/contracts.semantics.darkwebIndex` with top-100, tier-1,000, and tier-4,000 packets carrying strict support buckets, exact missing fields, worker handoffs, safe public-support source targets, parser fields, no-leak proofs, and zero currently chargeable dark-metadata rows.
- Added `/v1/ops/product-slo.darkMetadataPublicSupportLift4000` as a compact SLO board with the same strict counts and release blockers.
- Current strict tier-4,000 fixture result: current contribution 2; first 4,000 candidates include 80 `sellable_after_public_support`, 54 `useful_with_caveat`, 556 `restricted_only_hold`, and rejections of 1,142 stale, 6 duplicate, 1,333 unsafe, and 829 low-value. Support buckets also show 105 parser-repair rows, 80 source-support rows, and 0 currently chargeable rows.
- Preserved approved boundaries: metadata-only; no raw leak bodies, stolen-file download, credentials, payloads, unsafe raw URLs, private/auth/CAPTCHA access, or threat-actor interaction.
- Proofs green: `bun run check`, `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:contract-index`, and full `bun test` (529 pass).

# Current Task: Program CU Dark Metadata 4,000 -> 10,000 Public-Support Repairs

You are no longer idle. Continue the dark/restricted metadata lane only where it can create buyer-visible rows. The goal is to convert the best tier-4,000 candidates into public-supported, searchable, metadata-only Actor/API rows and then expand toward tier-10,000 only if value density holds.

Scope:
- Start from the tier-4,000 packet: 80 `sellable_after_public_support`, 54 `useful_with_caveat`, 556 restricted-only holds, 1,142 stale rejects, 6 duplicate rejects, 1,333 unsafe rejects, and 829 low-value rejects.
- Build a compact repair queue for the first 100 potential paid rows: actor/group, victim/dataset hint, sector/country, first/last seen, safe locator hash, required public support family, exact missing field, row decision, buyer value reason, and worker handoff.
- Add tier-10,000 expansion only for candidates that are current, named, searchable, and have a plausible public corroboration path. Reject low-value directory pages, dead services, stale reposts, generic market pages, unsafe targets, credential/payload/download material, and restricted-only rows without public support.
- Preserve metadata-only output. Do not expose raw unsafe URLs, raw pages, stolen data, credentials, payload links, private/auth/CAPTCHA material, or threat-actor interaction text.
- Hand parser-specific missing fields to Agent 03, public source support to Agent 01/04, no-leak/evidence provenance to Agent 06, false-positive/stale suppression to Agent 07, graph pivots to Agent 08, Apify output fields to Agent 09, and paid-release counts to Agent 10.

Definition of done:
- `/v1/darkweb/status`, `/v1/darkweb/search`, `/v1/contracts`, and `/v1/ops/product-slo` expose the 4k repair queue plus a value-gated tier-10k preview.
- Tests prove no restricted-only, stale, duplicate, unsafe, or low-value candidate counts as chargeable.
- Report exact metric movement: repair candidates added, likely sellable rows after public support, useful caveated rows, suppressions, and remaining rows to the first-100 floor.
- Run focused darkweb/API/ops tests plus `bun run check`; commit and push a coherent green patch before marking ready.
- If you finish early, continue into the highest-value accepted repair rows instead of stopping.
