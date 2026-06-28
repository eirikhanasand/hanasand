# CTI/XDR Product Gap Map

Last updated: 2026-06-28

## Purpose

This document turns the Hanasand thesis into concrete product requirements so workers stop circling around dashboards. The sellable product is a company-exposure and threat-intelligence operating system: teams create watchlists, the system monitors real sources, alerts are generated from evidence, analysts review cases, and customers receive usable webhook/Discord/API notifications.

The product should compete with serious CTI, DWM, and XDR workflows. Current market anchors used for this pass:

- Microsoft Defender XDR sets the incident-workflow expectation: incidents group related alerts, expose impacted assets/evidence, and support investigation/remediation from one queue. Source: https://learn.microsoft.com/en-us/defender-xdr/incidents-overview
- Google Threat Intelligence/Mandiant sets the actor-intelligence expectation: actor profiles, collections, detections, IOCs, finished intelligence, and organization-relevant context. Source: https://cloud.google.com/security/products/threat-intelligence
- Recorded Future Intelligence Cloud sets the operational-intelligence expectation: broad source collection, entity context, workflows, and integrations around security operations. Source: https://www.recordedfuture.com/platform/intelligence-cloud
- Flare/Flashpoint-style DWM products set the dark-web expectation: monitored illicit communities, Telegram/leak-site visibility, alerting, investigation workflow, and evidence safe enough for teams to act on. Sources: https://flare.io/platform/ and https://flashpoint.io/ignite/

Assumption boundary: this is competitor-informed product planning, not a claim that Hanasand currently has equivalent coverage. Public competitor pages are marketing pages; use them as workflow expectations, not as exact implementation specs.

## Coordinator Scoreboard

Use this table in the 10-minute coordinator loop. The machine-readable mirror is `docs/product/cti-xdr-scoreboard.json`; keep the row IDs and KPI names stable so automation can diff progress without rereading the full document. Run `node scripts/scan-cti-xdr-scoreboard.mjs` for the compact coordinator summary.

| ID | Pillar | Owner thread/lane | Current status | Last commit/handoff | Next code slice | Measurable KPI | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ORG | Orgs | Org/API lane | Partial: auth/users exist; org APIs are actively being wired; buyer onboarding still lacks a crisp active-org console path. | `b750ac61` org-scoped DWM foundation; current dirty org route/schema work. | Add active-org selector/context, org create/list UI, and tenant propagation across TI/DWM routes. | `organizations.orgCount`, `organizations.activeOrgCount` | Need production probe proving dashboard routes use org context instead of `default`. |
| INV | Invites | Org/API lane | Partial: invite acceptance API exists, but buyer-facing invite/resend/expire UI is not confirmed. | `e3fc1cfd` invite acceptance API. | Build invite panel: create invite, copy/send link, accept invite, expire/resend, audit event. | `organizations.usersInvited24h`, `organizations.acceptedInvites24h` | Email/support fallback and expiry policy need to be productized. |
| RBAC | Members/RBAC | Org/API lane | Partial: membership routes exist; role enforcement across TI/DWM/admin actions still needs hard coverage. | `8a389e7f` membership routes; current dirty organization utility work. | Add role editor and enforce `admin/analyst/viewer` checks on watchlists, alerts, cases, support, and source controls. | `organizations.memberCount`, `organizations.roleChanges10m` | Missing cross-route authorization test matrix. |
| WATCH | Shared watchlists | Org + DWM lane | Partial: DWM watchlist API exists; shared team ownership, change history, and routing are not complete. | `607db9e1` shared watchlist API; `b750ac61` org-scoped DWM foundation. | Ship org-owned watchlist workspace with term type, owner, pause/resume, test match, last match, webhook route, and audit history. | `watchlists.sharedWatchlistCount`, `watchlists.activeWatchlistCount`, `watchlists.watchTermsCount` | Needs durable version/audit model before multiple analysts edit the same list. |
| TELE | Telegram sources | Source-ops lane | Partial: adapters and source pages exist; active Telegram count is not yet an authoritative product KPI. | `f16e8a0e` TI scraper control room. | Add source KPI endpoint with enabled/failing Telegram sources, last successful check, next scheduled check, and parser status. | `sources.activeTelegramSourceCount`, `collection.capturesCollected10m` | Need live runtime proof inside freshness window. |
| ONION | Darkweb/onion sources | Source-ops/restricted-metadata lane | Partial: darkweb metadata adapters, policy boundaries, and source request lifecycle work exist; production-safe active counts are not proven. | `ec4289dc` source request lifecycle; `f16e8a0e` control room. | Add metadata-only approval queue with active/failing onion source counts, last check, screenshots where safe, and blocked-reason fields. | `sources.activeDarkWebMetadataSourceCount`, `sources.sourceCandidatesQueued` | Must keep unsafe payloads, raw onion URLs, and credentials out of buyer/admin surfaces. |
| ALERTS | Real alerts | DWM alert lane | Partial: alert provenance/repository work exists; demo fallback must be excluded from sellable buyer paths. | `720414f2` alert provenance model; `3f55b12e` alert repository adapter. | Prove real watchlist + real capture creates saved alert with evidence ID, source ID, dedupe key, match reason, and `demoAlertsVisible=0`. | `alerts.realAlertsGenerated10m`, `alerts.alertsWithEvidence`, `alerts.demoAlertsVisible` | Need automated capture-to-alert smoke that fails if only demo data appears. |
| DELIVERY | Webhook/Discord deliveries | Delivery lane | Partial: DWM webhook files/tests are in progress; Discord delivery is operationally useful but not productized enough for buyers. | Dirty handoff: `api/scripts/smoke-dwm-webhooks.ts`, `api/src/utils/dwm/`. | Put delivery controls on the DWM page: endpoint/Discord destination, redacted secret status, test send, payload preview, last deliveries, retry failed. | `delivery.webhookDeliveries10m`, `delivery.discordDeliveries10m`, `delivery.webhookFailures10m` | Secret-safe config, retry semantics, and buyer-facing failure messages need final checks. |
| CASES | Analyst cases | Case/workbench lane | Partial: DWM alert workflow and persisted ownership exist; one durable cross-product case object is not finished. | `20f6563f` persisted DWM case ownership; `70bcbb99` readiness workbench. | Persist cases over DWM/TI alerts with assign, note, escalate, suppress/false-positive, close/reopen, timeline, and delivery replay. | `cases.openCaseCount`, `cases.casesAssigned10m`, `cases.casesClosed10m`, `cases.casesWithAnalystNotes` | Case schema must unify TI actor activity, DWM alerts, and delivery history. |
| HELP | Helpdesk/impersonation | Admin/support lane | In progress: impersonation/admin-support files are dirty; no committed buyer-support readiness packet yet. | Dirty handoff: `api/src/handlers/adminSupport.ts`, `api/scripts/smoke-admin-support-contract.ts`, impersonation route edits. | Ship safe support console: find org/user, view subscription/onboarding state, start audited impersonation, and file support actions. | `admin.helpdeskTicketsOpen`, `admin.supportActions10m`, `admin.impersonationSessions10m` | Needs strict audit trail and scoped auth before production use. |
| AUDIT | Structured audit logs | Admin/audit lane | In progress: admin audit utility and TI audit pages are dirty; audit events are not yet a stable coordinator KPI. | Dirty handoff: `api/src/utils/adminAudit.ts`, TI audit route edits. | Add append/query audit events for org, invite, watchlist, source, alert, case, support, impersonation, and delivery actions. | `admin.auditEvents10m`, `admin.auditEventsWithActor` | Need retention policy and event schema stability. |
| DEPLOY | Deploy/live status | Ops lane | Partial: `/status` and container health exist; no single product-progress record ties deploy health to CTI/DWM KPIs. | `03d29b7c` coordinator scoreboard; status work from recent thread handoffs. | Emit `/api/product-progress` or scraper SLO record every 10 minutes with commit, frontend/API/scraper health, and every KPI group in this table. | `deployment.frontendCommit`, `deployment.frontendHealthy`, `deployment.apiHealthy`, `deployment.scraperHealthy` | Branch is ahead and multiple active dirty lanes must land before clean deploy proof. |

## Do Not Build Dashboards Instead Of This

- Do not ship metric cards unless there is a queue item that can be opened, reviewed, assigned, escalated, suppressed, replayed, or closed.
- Do not show source counts without source health, last/next check, parser status, and a concrete operator action such as approve, pause, run now, or inspect evidence.
- Do not show actor profiles without source links, changed fields, last refresh, next refresh, and a clear reason the profile changed.
- Do not show alerts without evidence IDs, source IDs, timestamps, match reason, dedupe key, and delivery state.
- Do not build webhook settings without test send, payload preview, retry history, and redacted secret handling.
- Do not call a workflow autonomous unless the page exposes latest run time, changed records, next planned work, and failure/backoff state.

## KPI Movement Rules

Counts as improvement: a KPI moves from a real source, real org/user action, real delivery, or real case transition; a blocker is removed by shipped code plus a focused smoke/probe; or a dirty handoff becomes an isolated commit with product-progress output.

Counts as circular work: adding cards/counters/copy without queue-detail-action behavior; moving demo/sample data while real alerts, active sources, deliveries, cases, and org usage stay flat; or saying autonomous without latest run time, changed records, next planned work, and failure/backoff state.

## Product Pillars

| Pillar | Current repo status | Missing user-visible capability | Strong competitor expectation | Next implementable slice |
| --- | --- | --- | --- | --- |
| Organizations, teams, invites | Core users/auth exist. VM sharing has `access_users`. CTI/DWM routes pass `tenantId`, usually `default`. No clear org/team/invite product surface found. | A buyer cannot create an organization, invite teammates, assign roles, or share DWM/TI work without developer/admin help. | Enterprise CTI/XDR tools assume team ownership, RBAC, shared queues, and auditability. | Add org model and UI: create org, invite member, accept invite, assign `admin/analyst/viewer`, set active org, route DWM/TI tenant IDs from org context. |
| Shared watchlists | `ti/scraper` has `/v1/dwm/watchlists` list/create and watch terms. Frontend DWM page consumes snapshot/alerts. | Watchlists are not clearly shared by team, versioned, approved, or attached to customer/customer-owned routing rules. | DWM buyers expect shared monitored entities: domains, brands, vendors, VIPs, products, subsidiaries, and suppression terms. | Build a watchlist workspace: team-owned list, term type, owner, last matched, last edited, webhook route, test match, pause/resume, and audit events. |
| Real DWM/Telegram/onion source growth | Source registry migrations, seeds, Telegram adapters, darkweb metadata adapters, restricted metadata policy, source inventory, `/dashboard/ti/sources`, and `/dashboard/ti/control` exist. | User cannot see which sources are actively monitored, which Telegram/onion metadata sources are live, what failed, and what source should be promoted next in one operational flow. | Competitors sell coverage breadth and freshness, not static scraped rows. They show collection health, source provenance, and coverage by source family. | Make the source control room authoritative: active source count, active Telegram count, active dark-web metadata count, source family health, next candidate to approve, last capture, next scheduled run, parser status, and safe screenshot/detail links. |
| Real alert generation | `buildDwmProductSnapshot`, `/v1/dwm/alerts`, `/v1/dwm/alerts/rebuild`, and saved alert workflow states exist. Alerts are built from watchlists + captures; demo fallback exists. | It is still too easy for product pages to fall back to demo data. Buyers need proof that real captures produce real alerts without manual intervention. | DWM products must notify when a monitored company/vendor/domain appears in relevant source activity, with timestamped evidence and dedupe. | Add an alert-generation proof path: seed one team watchlist, run live/safe capture, rebuild alerts, show `realAlertCount`, `demoAlertCount=0`, evidence IDs, source IDs, and “why matched.” |
| Analyst case workflow | DWM alert PATCH/replay routes exist. DWM analyst portal and TI workbench files exist, with queues, evidence, timeline concepts. | Case workflow is split and may still be session/local in places. Need one durable case object with assigned owner, decision rationale, delivery status, false-positive handling, and close/reopen. | XDR/CTI tools revolve around case queues: triage, evidence, impacted entities, actions, timeline, and handoff. | Introduce `case` persistence backed by DWM/TI alerts: create/update case, assign, note, close, false-positive, escalate, replay evidence, and expose a single workbench queue. |
| Discord/webhook delivery | `/v1/dwm/webhooks/test`, `/deliver`, `/deliveries` exist. Frontend has DWM webhook setup paths. Discord webhook is operationally used outside repo, but not productized. | Buyer cannot confidently connect a destination, send a test, inspect payload, retry a failed delivery, or see delivery history from the DWM page without admin knowledge. | Integrations are expected: webhook, SIEM/SOAR, Slack/Teams/Discord-like delivery, retry history, payload examples, and secret-safe redaction. | Add delivery settings inside DWM: endpoint, secret status, test button, last 10 deliveries, retry failed, payload preview, Discord template, dedupe key, and per-watchlist route. |
| Source monitoring/control room | TI source pages, activity, domains, runs, audit, and control routes exist. Scraper API has source registry, source health, runs, SLO routes. | Operators still lack one source-ops workflow that says: what is broken, what to approve, what to run now, what is next, and what changed in the last run. | Serious CTI platforms expose collection health, processing queues, source reliability, and analyst controls. | Build source-ops workbench: prioritized source queue, selected source detail, last/next run, run-now, pause, approve metadata-only, parser warnings, screenshot/evidence links, and source audit trail. |
| Threat actor intelligence pages | `/ti/[query]`, `/dashboard/ti/enrichment`, actor profiles, enrichment routes, actor profile utilities, and source links exist. | Actor pages can still look static or hand-curated. They need autonomous refresh proof, source-backed sections, ambiguity handling, and clear source limits for free vs paid. | Google/Mandiant-style expectations: actor identity, aliases, campaigns, TTPs, targeted sectors/geographies, IOCs, reports, recent activity, and confidence explained by sources. | Add actor-page freshness contract: stable profile cache, recent activity short-cache, source list with first 5 free, “updated because” audit event, next enrichment plan, and links to evidence/captures. |
| Pricing, onboarding, admin readiness | Public pricing/subscription pages exist. Auth exists. Dashboard routes exist. | A buyer cannot go from signup to org, watchlist, webhook, first alert, and subscription activation in one crisp path. Admin cannot audit onboarding completion. | Competitors hide complexity but make trial-to-value fast: connect data, create watchlist, receive first alert, invite team, subscribe. | Build onboarding checklist tied to real state: org created, watchlist added, source pack active, test webhook delivered, first real alert generated, subscription enabled, teammate invited. |

## 10-Minute Automation Loop KPIs

Every automation tick should emit one compact product-progress record. These are the minimum KPIs that stop “it is working” from becoming vague:

```json
{
  "checkedAt": "2026-06-28T00:00:00.000Z",
  "deployment": {
    "frontendCommit": "git-sha",
    "frontendHealthy": true,
    "apiHealthy": true,
    "scraperHealthy": true
  },
  "organizations": {
    "orgCount": 0,
    "activeOrgCount": 0,
    "usersInvited24h": 0,
    "acceptedInvites24h": 0
  },
  "watchlists": {
    "sharedWatchlistCount": 0,
    "activeWatchlistCount": 0,
    "watchTermsCount": 0,
    "watchlistsWithWebhook": 0
  },
  "sources": {
    "registeredSourceCount": 0,
    "activeSourceCount": 0,
    "activeTelegramSourceCount": 0,
    "activeDarkWebMetadataSourceCount": 0,
    "sourcesFailingNow": 0,
    "sourceCandidatesQueued": 0
  },
  "collection": {
    "runsStarted10m": 0,
    "runsSucceeded10m": 0,
    "runsFailed10m": 0,
    "capturesCollected10m": 0,
    "screenshotsCaptured10m": 0
  },
  "alerts": {
    "realAlertsGenerated10m": 0,
    "demoAlertsVisible": 0,
    "alertsWithEvidence": 0,
    "duplicateAlertsSuppressed10m": 0
  },
  "cases": {
    "openCaseCount": 0,
    "casesAssigned10m": 0,
    "casesClosed10m": 0,
    "falsePositivesMarked10m": 0,
    "casesWithAnalystNotes": 0
  },
  "delivery": {
    "webhookDeliveries10m": 0,
    "webhookFailures10m": 0,
    "discordDeliveries10m": 0,
    "deliveryRetries10m": 0
  },
  "actorIntel": {
    "actorProfilesRefreshed10m": 0,
    "profilesWithRecentActivity": 0,
    "profilesWithSourceLinks": 0,
    "profilesWithAmbiguityWarnings": 0
  }
}
```

Rules:

- `demoAlertsVisible` must be `0` on production buyer paths. Demo/fallback rows can exist in dev and docs, but they must be labeled and excluded from sellable progress.
- Count “real alert” only when it has a real watchlist term, source ID, capture/evidence ID, timestamp, dedupe key, and non-demo source family.
- Count “active Telegram source” only when the source is enabled, has a collection path, and was checked inside its freshness window.
- Count “active dark web metadata source” only when metadata-only policy is enforced and the last check completed without unsafe payload access.
- Count “case closed” only when a close decision, actor/user, timestamp, and rationale are stored.

## Build Order That Prevents Circular Work

1. **Org and watchlist foundation**: orgs, invites, roles, shared watchlists, per-watchlist webhook route.
2. **Real alert proof**: turn live/safe captures into non-demo DWM alerts with evidence refs and delivery-ready payloads.
3. **Unified analyst case object**: queue, detail, assign, note, escalate, false-positive, close/reopen, audit trail.
4. **Source control room**: active source counts, Telegram/dark-web metadata health, next source to approve, run-now, pause, parser warnings.
5. **Actor intelligence freshness**: autonomous enrichment audit, source-backed actor pages, recent activity short-cache, paid source visibility gates.
6. **Delivery and onboarding**: webhook/Discord test, retries, payload preview, buyer onboarding checklist, subscription state.
7. **Admin readiness**: usage, billing state, org audit, deployment health, data-retention controls, support handoff.

## Worker Steering Notes

- If a worker proposes a dashboard, ask which queue item can be opened and what action the analyst can take.
- If a worker proposes more data sources, ask how those sources create alerts, cases, or actor-page updates visible to a buyer.
- If a worker says “autonomous,” ask for the latest run timestamp, changed fields, source IDs, and next scheduled work.
- If a worker says “ready for marketing,” ask whether a new buyer can sign up, invite a teammate, add a watchlist, test a webhook, receive a real alert, and close a case.
