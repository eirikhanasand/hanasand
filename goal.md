# Hanasand production execution goal

This is the only active product goal. Work counts only when it changes the deployed enterprise product and is verified on the live system.

## Rules

- Stop review-only, handoff-only, merge-gating, portfolio-bookkeeping, and speculative documentation work.
- Do not add candidate rows, fixtures, mock success, labels, readiness screens, or placeholder endpoints as substitutes for working product behavior.
- Every implementation lane owns deployment. A commit is not complete until it is deployed, checked through the real API and browser, and given a rollback commit.
- Use one structured review after each 100 production commits, or sooner only for security, data loss, tenant isolation, or a release blocker.
- Preserve lawful collection, provenance, redaction, retention, audit history, accessibility, and tenant isolation.

## Execution order

1. Deploy the newest canonical commit and establish a clean production baseline.
2. Rebuild the Cases UI as a compact real-data workflow: list, search, filters, detail, status, assignment, evidence, and navigation.
3. Repair DWM latest activity, public search, scraper health, source operations, and processing backlog. Unavailable data must return an honest failure state, not HTTP 200 with misleading empty content.
4. Trace customer-facing routes and replace real blockers or delete unreachable fake/demo paths. Keep only routes used by the product or documented API.
5. Make one small governed source family productive end to end: real collector, parser, persistence, review, search, recurring schedule, useful retained output, and live customer visibility. Implement reviewed active sources instead of merely recording them. A source counts only after two useful scheduled production cycles.
6. Fix tenant and permission workflows, then remove dead prototype code and duplicated UI/data layers that affect those workflows.
7. Release each lane with live API proof, live browser proof, database/runtime evidence where relevant, and rollback instructions.

## Source implementation lane

Use the reviewed source inventory to produce one clean implementation list. Select active, lawful, relevant, non-duplicate sources with executable endpoints. For each selected source, ship the configuration and collector/parser path, schedule it, persist captures, expose it in search and the customer UI, and record the live result. Do not claim that a reviewed or candidate source is productive until the deployed scheduler proves it.

## Release acceptance

- deployed commit is an exact descendant of canonical main;
- live API and browser exercise the changed path with real data;
- no fake-success or hardcoded customer output remains on the path;
- tenant and permission behavior is checked where applicable;
- production health is not worse after release;
- rollback commit and observed evidence are recorded in `docs/thesis-status.md`.

## Thesis status

`docs/thesis-status.md` is the single status record. Keep it chronological, concise, evidence-backed, and updated only from deployed behavior. Do not create new goal, coordination, handoff, review-bundle, or portfolio-plan documents.
