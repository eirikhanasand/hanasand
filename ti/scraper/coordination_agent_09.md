Status: active_actor_dataset_conversion_19_to_40

# Agent 09 Task

Improve the Apify Actor dataset so Store visitors see value immediately.

Current smoke result:
- 19 sellable rows
- Buyer fields exist on rows

Deliver:
- Raise smoke output to at least 40 rows that are useful to a buyer, with at least 30 sellable rows.
- Every sellable row should include concise summary, recommended buyer action, pivots, freshness, confidence, and safe source coverage.
- Remove internal wording from public rows.
- Improve sample input/output to show the best buyer-useful rows first.

Success metric:
- Actor smoke reaches at least 30 sellable rows and 40 useful buyer rows.

Before stopping:
- Run Actor check/smoke and publication check.
- Commit and push.
