Status: active_dark_metadata_rows

# Agent 05 Task

Stop file-splitting unless needed to edit safely.

Add useful metadata-only dark/restricted rows.

Deliver:
- Increase current useful dark metadata rows from the existing lane toward the next 4,000-row tier.
- Rows must include actor/group, victim/target or dataset claim, sector/country when available, date/freshness, source family, confidence, public support hash/pivot, and buyer action.
- Keep raw URLs, leaked content, credentials, payloads, and files out of output.
- Skip rows that are generic, stale, unsupported, duplicate, or not useful to a buyer.

Success metric:
- More buyable metadata-only rows, not more schemas.

Before stopping:
- Run dark metadata tests.
- Commit and push.
