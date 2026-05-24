Status: active_task_ad

## CURRENT ASSIGNMENT - READ FIRST

Task AD: Source Marketplace And Parser Capability Matrix

Build the source marketplace and parser capability matrix that turns source onboarding into an analyst-operable enterprise workflow.

Scope:
- Model approved public CTI source packs for actor, ransomware, CVE/advisory, malware/tool, country, sector, campaign, infrastructure, and victim/company searches.
- Expose coverage family, source family, trust, reliability, region, language, sector utility, parser support, legal/robots review age, scheduler cost, evidence yield, duplicate rate, activation readiness, and rollback state.
- Connect marketplace recommendations to Agent 02 scheduler budgets, Agent 03 parser capability, Agent 04 public signal families, Agent 06 evidence yield, Agent 07 useful-answer quality, Agent 09 API contracts, and Agent 10 SLO gates.
- Add parser capability matrix fields for static HTML, RSS, dynamic page, PDF/report, public channel, advisory/security signal, and restricted metadata handoff. Unsupported or unsafe source classes must be explicit.
- Keep source activation dry-run and policy-bound; no source should crawl merely because it appears in the marketplace.

Proof requirements:
- Add fixtures for at least 50 safe public sources across vendor blogs, advisories, CERT/government, GitHub/security advisories, public research feeds, malware/report feeds, and curated public indexes.
- Add tests for source-pack scoring, parser compatibility, activation readiness, stale/noisy/duplicate source states, tenant isolation, no unsafe source promotion, and API-safe DTOs.
- Update source registry docs and `coordination.md`.
- Run `bun run check`, focused source/API tests, route inventory, and contract index if route surfaces change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AE: Enterprise Source Rollout And Retirement Automation

Design dry-run rollout and retirement automation for hundreds of public sources: canary cohort, expanded rollout, stale/noisy retirement, duplicate-source merge, parser repair request, trust downgrade, and rollback. Include route/API proofs and SLO fields for Agent 10.

Task AF: Source Reliability Scoring And Coverage Economics

Build a reliability/economics model for every source family. Track freshness, evidence yield, useful-answer contribution, duplicate rate, parser failure rate, scheduler cost, legal/robots review age, regional/sector utility, and tenant budget impact.

Task AG: Enterprise Source Governance Audit Trail

Create an append-only audit model for source governance decisions: who approved, what changed, why, expected effect, rollback path, policy impact, affected tenants, and downstream API/search/graph impact.
