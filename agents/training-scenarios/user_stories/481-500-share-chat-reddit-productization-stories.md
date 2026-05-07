# User Stories 481-500: Reddit Productization and Real-Use Complaints

These stories focus on the next class of complaints about AI/no-code builders: the first demo looks fine, then real users run into lost edits, weak previews, broken mobile layout, generic output, quota surprises, publishing gaps, auth confusion, missing CMS workflow, and poor manual control. Each story is written as a skeptical user pushing beyond a toy demo.

## 481. Lost Manual Edits Site

As a designer who has had AI overwrite hand-polished CSS, I want generated source to preserve manual edits, expose design tokens, and document version history.

Acceptance criteria:

- Manual edit control, design system tokens, version history, preview deploy, and complaint regression docs exist.
- The generated site remains responsive and accessible.
- The browser workflow proves the primary form, stress path, and mobile viewport work.

## 482. Prompt Drift Product Site

As a founder tired of prompts changing unrelated sections, I want a product site with narrow change boundaries, ADRs, version history, and regression tests for prompt drift.

Acceptance criteria:

- Version history, change review, architecture, ADR, manual edit control, and complaint regression docs exist.
- The generated source avoids vague placeholder copy.
- Playwright verifies interaction and mobile fit.

## 483. Preview Deploy Failure API

As a backend user who only sees a vague deploy failure, I want an API export with preview/deploy diagnostics, environment checks, migrations, health, readiness, and shaped runtime errors.

Acceptance criteria:

- Fastify/Postgres/migration/OpenAPI artifacts exist.
- Preview deploy, auth matrix, version history, and complaint regression docs exist.
- Browser workflow verifies bulk API scenario output and mobile-safe preview.

## 484. Auth Surprise SaaS API

As a SaaS owner, I want an API that never leaks raw unauthorized/provider text and has a real auth permission matrix for logged-out, expired, revoked, support, and admin states.

Acceptance criteria:

- Auth permission matrix, shaped errors, RBAC seams, access review, and token handling are present.
- Health, readiness, metrics, and OpenAPI remain available.
- E2E preview validates the scenario.

## 485. CMS Editor Handoff Site

As a restaurant marketer, I want menu/content edits to have draft, preview, approve, publish, rollback, and export semantics instead of being trapped in a chat.

Acceptance criteria:

- CMS workflow, manual edit control, preview deploy, mobile release, and data portability docs exist.
- Restaurant sections are concrete.
- Playwright checks desktop and narrow mobile usability.

## 486. Mobile Header Overlap Site

As a mobile user, I want a generated site that explicitly handles safe areas, sticky controls, long labels, keyboard overlap, and 390px viewport layout.

Acceptance criteria:

- Mobile release, browser verification, performance budget, beta edge cases, and complaint regression docs exist.
- Generated layout uses responsive patterns.
- Playwright proves no horizontal overflow.

## 487. Generic AI Design Complaint Site

As a client who hates generic AI-builder sameness, I want a site with design system tokens, visual hierarchy notes, manual styling control, and concrete content.

Acceptance criteria:

- Design system tokens, manual edit control, accessibility audit, and browser verification docs exist.
- The page uses concrete sections and a usable form.
- Browser workflow passes.

## 488. Collaboration Rollback API

As a team lead, I want an API handoff with version history, change requests, rollback approvals, preview deploy checks, and complaint regressions so multiple people can collaborate safely.

Acceptance criteria:

- API includes change requests, rollback approvals, version history, preview deploy, and complaint regression docs.
- Postgres and OpenAPI artifacts exist.
- Bulk scenario passes.

## 489. Quota Credit Burn Worker

As an operator angry about credit burn, I want a worker that surfaces retry budgets, quota transparency, backoff, replay limits, and complaint regression tests.

Acceptance criteria:

- Worker includes retryBudget, replayPolicy, quota transparency, complaint regression, and load testing docs.
- Queue stress path is visible.
- Playwright scenario passes.

## 490. Database Error Debug API

As a developer seeing mysterious database failures, I want an API with DB seams, migration docs, preview deploy diagnostics, request IDs, backup restore, and shaped errors.

Acceptance criteria:

- Postgres seam, migrations, preview deploy, error recovery, and support bundle docs exist.
- Health/readiness and metrics are included.
- Browser scenario passes.

## 491. Discord Permission Drift Bot

As a Discord admin, I want role/permission drift documented with auth matrix, support bundle, version history, safe stubs, and manual control over bot responses.

Acceptance criteria:

- Bot source uses env secrets only and safe admin stubs.
- Auth matrix, version history, support bundle, and manual edit control docs exist.
- Browser preview verifies bot readiness and support evidence.

## 492. SEO Copy Manual Control Site

As a marketer, I want SEO copy, headings, redirects, metadata, and manual edits to be first-class rather than replaced by generic AI text.

Acceptance criteria:

- SEO editing control, manual edit control, CMS workflow, preview deploy, and version history docs exist.
- Site includes SEO/redirect sections.
- Browser flow passes.

## 493. Marketplace Publishing Worker

As a marketplace operator, I want background publishing to include preview checks, rollback, replay, stuck-job detection, and version evidence before pushing listings live.

Acceptance criteria:

- Worker includes preview deploy, version history, release evidence, stuck jobs, cancel, replay, and alerts.
- Stress path exercises queue status.
- Playwright passes.

## 494. Multi Tenant Permission API

As a security reviewer, I want multi-tenant APIs to document auth permissions, RLS policy notes, cross-tenant tests, version history, and shaped errors.

Acceptance criteria:

- Auth permission matrix, RLS policy notes, access review, data classification, and shaped errors exist.
- Postgres and OpenAPI artifacts exist.
- Bulk scenario passes.

## 495. Slow Preview Complaint Site

As a user complaining that previews are slow and misleading, I want preview deploy diagnostics, performance budget, RUM, mobile release notes, and complaint regression tests.

Acceptance criteria:

- Preview deploy, performance, RUM, mobile release, and complaint regression docs exist.
- Browser stress path remains responsive.
- Mobile fit passes.

## 496. Invoice Workflow Rollback Worker

As a finance operator, I want invoice workers to support dry-run, replay, cancel, stuck-job detection, rollback evidence, and manual approval before side effects.

Acceptance criteria:

- Worker has queue/replay/cancel/stuck semantics and rollback docs.
- Data portability and complaint regression docs exist.
- E2E queue path passes.

## 497. Agency White Label Site

As an agency, I want a white-label site export with manual branding control, design tokens, CMS workflow, version history, and preview deploy checks.

Acceptance criteria:

- Design system tokens, manual edit control, CMS workflow, version history, and preview deploy docs exist.
- The site is accessible and responsive.
- Browser path passes.

## 498. Support Escalation API

As support, I want an API that turns raw errors into supportable diagnostics with request IDs, support bundles, complaint regressions, and clear preview/deploy failure layers.

Acceptance criteria:

- Support bundle, preview deploy, error recovery, request IDs, and complaint regression docs exist.
- API source includes shaped errors and health/readiness.
- Browser path passes.

## 499. Image Moderation Queue Worker

As a moderator, I want image processing jobs to support review, cancel, replay, poison queue isolation, mobile release notes, and complaint regression evidence.

Acceptance criteria:

- Worker source includes poison jobs, cancel, replay, queue status, and alerts.
- New docs cover mobile release, complaint regression, and manual edit control.
- Playwright path passes.

## 500. Hostile Productization Gauntlet

As a hostile CTO, I want the generated export to prove it can survive productization: manual edits, CMS workflow, preview deploy, auth matrix, mobile release, design tokens, version history, and regression tests.

Acceptance criteria:

- All new productization docs exist.
- Generated API/worker/site artifacts remain portable and testable.
- Real Playwright workflow passes without assistance.
