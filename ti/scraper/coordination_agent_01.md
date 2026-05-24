Status: active_task_ac

## CURRENT ASSIGNMENT - READ FIRST

Task AC: Multi-Tenant Source Governance And Analyst Approval Workbench

Build the enterprise source governance layer that lets CTI analysts safely activate, pause, review, and audit sources across tenants. This is core product work; do not stop after a schema stub.

Scope:
- Model tenant-scoped source ownership, budgets, approval state, legal/robots review state, retention class, allowed adapters, source-family coverage, and activation rationale.
- Add analyst approval workbench DTOs for source activation, source disablement, trust-score changes, parser-gap requests, legal/robots renewal, crawl-cadence change, and restricted metadata review.
- Connect source governance to existing source coverage, source apply-plan, activation batches, public search sourceActivation fields, and restricted metadata approval semantics.
- Add drift detection for sources that changed content type, redirect target, robots/legal notes, evidence yield, duplicate rate, parser compatibility, language/region/sector coverage, or safety class.
- Keep all apply actions dry-run unless an already-approved non-mutating route exists; no network crawl should start from governance planning.
- Coordinate with Agent 02 on scheduler budgets, Agent 03/04 on parser/source-family capability, Agent 06 on evidence yield, Agent 07 on useful-answer quality, Agent 09 on API contracts, and Agent 10 on release gates.

Proof requirements:
- Add tests for multi-tenant isolation, approval expiry, source-family coverage gaps, restricted-source holds, parser-gap handoff, source disable/rollback plans, and no mutation during dry-run planning.
- Update source governance docs and `coordination.md` with contract surfaces.
- Run `bun run check`, focused source/API tests, and route inventory if routes/contracts change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AD: Source Marketplace And Parser Capability Matrix

Build a source marketplace-style registry for approved public CTI source packs. It should show coverage family, trust, region/language/sector utility, parser support, legal review age, scheduler cost, evidence yield, duplicate rate, and activation readiness. Include at least actor, ransomware, CVE/advisory, malware/tool, country, sector, campaign, and infrastructure packs.

Task AE: Enterprise Source Rollout And Retirement Automation

Design dry-run rollout and retirement automation for hundreds of public sources: canary cohort, expanded rollout, stale/noisy retirement, duplicate-source merge, parser repair request, trust downgrade, and rollback. Include route/API proofs and SLO fields for Agent 10.
