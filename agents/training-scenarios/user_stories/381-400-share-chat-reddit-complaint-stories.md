# Share Chat Reddit Complaint User Stories 381-400

These stories are harder than 361-380. They are shaped by common Reddit-style complaints about AI/no-code builders: vendor lock-in, unusable generated code, fake demos, vague errors, no export path, missing backend ownership, poor browser verification, brittle auth, hidden rate limits, weak documentation, slow opaque progress, and workflows that collapse under real clients.

## 381. Angry Restaurant Migration Rescue
As a restaurant owner who has already been burned by a no-code builder, I want a full replacement site with reservations, menu/allergens, source export, redirects, browser verification, support bundle, and an exit plan.

Acceptance:
- Includes restaurant sections, docs/migration-plan.md, docs/browser-verification.md, docs/support-bundle.md, docs/exit-plan.md, Source export, Redirect checklist, Docker, CI.

## 382. Agency Landing Page With Maintainable Handoff
As an agency lead, I want a marketing page that does not look like generic AI filler and includes maintainability, QA, procurement, support bundle, and ownership handoff.

Acceptance:
- Includes docs/maintainability.md, docs/qa-plan.md, docs/procurement-review.md, docs/support-bundle.md, No platform lock-in, concrete copy, Docker, CI.

## 383. Discord Bot Rage Quit Recovery
As a server admin who hates bots that secretly execute destructive commands, I want a Discord bot with safe stubs, audit log, support bundle, maintainability docs, exit plan, and no hardcoded token.

Acceptance:
- Includes Discord bot source, auditLog, restartRequests, Destructive actions require explicit review, docs/support-bundle.md, docs/maintainability.md, docs/exit-plan.md, no hardcoded secrets.

## 384. Backend Ownership API
As a CTO refusing vendor lock-in, I want an API with export/import ownership, OpenAPI, support bundle, migration plan, data classification, request IDs, shaped errors, and backup restore.

Acceptance:
- Includes `/openapi.json`, `/backup`, `/restore`, x-request-id, request_error, docs/migration-plan.md, docs/support-bundle.md, docs/data-classification.md, Docker, CI.

## 385. Rate Limit Without Red Error API
As an angry user who got a raw 429, I want rate limits surfaced as humane shaped errors with retry guidance, metrics, quotas, request IDs, and support bundle evidence.

Acceptance:
- Includes rateLimit, Limit reached, `/usage-quotas`, `/metrics`, x-request-id, request_error, docs/support-bundle.md, docs/qa-plan.md.

## 386. Browser Verified Ecommerce Site
As a store owner, I want an ecommerce site that proves buttons/forms/responsive states were considered, with browser verification, QA plan, support bundle, exit plan, and Docker.

Acceptance:
- Includes ecommerce sections, docs/browser-verification.md, docs/qa-plan.md, docs/support-bundle.md, docs/exit-plan.md, accessible form, responsive CSS, Docker.

## 387. Import Export Worker
As an ops engineer, I want a worker for import/export jobs with idempotency, replay, poison quarantine, support bundle, migration plan, stuck-job detection, and retry budget.

Acceptance:
- Includes worker source, queue source, idempotency, replayRequests, poisonJobs, stuckJobDetector, retryBudget, docs/support-bundle.md, docs/migration-plan.md.

## 388. Auth Session Second Device API
As a critic testing on two devices, I want auth/session backend seams with owner scoping, RBAC, second-device QA, shaped errors, audit events, and browser verification docs.

Acceptance:
- Includes requireRole, ownerId, auditEvents, request_error, docs/qa-plan.md, docs/browser-verification.md, docs/access-review.md, docs/security-review.md.

## 389. Local SEO Redirect Recovery Site
As a local business owner, I want SEO/redirect recovery that avoids losing traffic, with migration plan, redirect checklist, QA plan, browser verification, and exit plan.

Acceptance:
- Includes Search proof, Redirect checklist, docs/migration-plan.md, docs/qa-plan.md, docs/browser-verification.md, docs/exit-plan.md, Docker.

## 390. Privacy Data Request API
As a privacy officer, I want export/delete request handling with data classification, retention holds, audit hash, backup verification, support bundle, and shaped errors.

Acceptance:
- Includes `/data-classification`, retentionHolds, auditHash, `/backup/verify`, request_error, docs/support-bundle.md, docs/data-classification.md, redact.

## 391. Slow Invisible Progress Worker
As a user who thinks the agent is stuck, I want worker progress represented by events, worker status, replay requests, stuck jobs, support bundle, and maintainability notes.

Acceptance:
- Includes events, worker-status, `/api/replay-requests`, `/api/stuck-jobs`, docs/support-bundle.md, docs/maintainability.md, retryBudget.

## 392. SaaS Procurement Packet Site
As a procurement reviewer, I want a sober site with SBOM, threat model, procurement review, support bundle, exit plan, browser verification, and no fake enterprise claims.

Acceptance:
- Includes docs/sbom.json, docs/threat-model.md, docs/procurement-review.md, docs/support-bundle.md, docs/exit-plan.md, docs/browser-verification.md, Docker.

## 393. Restaurant Back Office API
As a restaurant operator, I want a backend for menus/reservations with validation, idempotency, backup restore, metrics, data classification, and migration handoff.

Acceptance:
- Includes validation title_required, idempotency, `/backup`, `/restore`, `/metrics`, docs/data-classification.md, docs/migration-plan.md, Docker.

## 394. Failed Payment Subscription API
As a SaaS founder, I want subscription state handling with rate limits, audit events, webhook signature seam, request IDs, rollback, support bundle, and QA plan.

Acceptance:
- Includes rateLimit, auditEvents, verifyWebhookSignature, x-request-id, rollback, docs/support-bundle.md, docs/qa-plan.md, Docker.

## 395. Accessibility Rage Test Site
As a keyboard-only user, I want an accessibility-first site with skip links, labels, reduced-motion considerations, browser verification, QA plan, and maintainability docs.

Acceptance:
- Includes Skip to content, aria-label or label, Reduced motion, docs/browser-verification.md, docs/qa-plan.md, docs/maintainability.md, responsive CSS.

## 396. Incident Status Site With Real Handoff
As an SRE who distrusts pretty status pages, I want incident timeline, SLO evidence, postmortems, observability docs, support bundle, release evidence, and rollback plan.

Acceptance:
- Includes Incident timeline, SLO evidence, Postmortems, docs/observability.md, docs/support-bundle.md, docs/release-evidence.md, Rollback plan.

## 397. Data Import Vendor Exit API
As a customer leaving another platform, I want data import/export ownership with backup restore, schema drift, migration plan, exit plan, support bundle, and OpenAPI.

Acceptance:
- Includes `/backup`, `/restore`, `/schema-drift`, `/openapi.json`, docs/migration-plan.md, docs/exit-plan.md, docs/support-bundle.md.

## 398. Moderation Bot With Human Review
As a Discord moderator, I want moderation actions to be queued for review with audit log, safe stubs, role configuration, support bundle, and no destructive auto-actions.

Acceptance:
- Includes Discord bot, auditLog, maintenance or roles, Restart request logged, Destructive actions require explicit review, docs/support-bundle.md, no hardcoded secrets.

## 399. Enterprise Support Escalation Portal
As a support lead, I want escalation paths, SLA states, customer messaging, support bundle, browser verification, QA plan, and failure owner.

Acceptance:
- Includes Escalation paths, SLA states, Customer messaging, Failure owner, docs/support-bundle.md, docs/browser-verification.md, docs/qa-plan.md.

## 400. Hostile Full Stack Recovery Gauntlet
As a very critical buyer, I want a complete recovery package that addresses lock-in, export, maintainability, browser verification, support, migration, QA, security, observability, backup restore, rate limits, auth, worker replay, Docker, and CI.

Acceptance:
- Includes docs/migration-plan.md, docs/support-bundle.md, docs/qa-plan.md, docs/browser-verification.md, docs/maintainability.md, docs/exit-plan.md, docs/security-review.md, docs/observability.md, Docker, CI, request IDs, shaped errors, backup restore, replay governance.
