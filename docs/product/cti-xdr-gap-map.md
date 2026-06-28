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

Use this table in the 10-minute coordinator loop. The `Metric key` names should stay stable so automation can diff progress without rereading the full document.

| ID | Pillar | Metric key | Current measurable status | Owner lane | Next code slice |
| --- | --- | --- | --- | --- | --- |
| P1 | Organizations/teams | `organizations.orgCount`, `organizations.usersInvited24h` | Partial: auth/users exist; org API work is in progress; no confirmed buyer org onboarding loop yet. | Org/API lane | Finish org create/list/invite/accept/member roles, then wire active org into dashboard and TI/DWM tenant IDs. |
| P2 | Shared watchlists | `watchlists.sharedWatchlistCount`, `watchlists.activeWatchlistCount`, `watchlists.watchTermsCount` | Partial: scraper DWM watchlist API exists; shared team ownership/version/audit not confirmed. | Org + DWM lane | Convert DWM watchlists to org-owned shared objects with owner, term types, pause/resume, audit events, and last match. |
| P3 | Webhook/Discord delivery | `watchlists.watchlistsWithWebhook`, `delivery.webhookDeliveries10m`, `delivery.discordDeliveries10m`, `delivery.webhookFailures10m` | Partial: DWM webhook test/deliver/deliveries routes exist; buyer-facing delivery settings and Discord route are not complete. | Delivery lane | Add DWM delivery settings: endpoint, Discord template, test send, payload preview, last deliveries, retry failed. |
| P4 | Real source coverage | `sources.activeTelegramSourceCount`, `sources.activeDarkWebMetadataSourceCount`, `sources.activeSourceCount`, `sources.sourcesFailingNow` | Partial: source registry, Telegram adapters, darkweb metadata adapters, and source pages exist; active production counts need authoritative API. | Source-ops lane | Add source KPI endpoint used by `/dashboard/ti/control`: active Telegram, active onion/darkweb metadata, failing sources, candidates queued, next scheduled run. |
| P5 | Collection runs | `collection.runsStarted10m`, `collection.runsSucceeded10m`, `collection.capturesCollected10m`, `collection.screenshotsCaptured10m` | Partial: run/control pages and scraper run APIs exist; screenshots and 10-minute deltas are not coordinator-ready. | Scraper/control lane | Emit compact run delta records with started/succeeded/failed, captures, screenshots, source IDs, and next run time. |
| P6 | Real alert generation | `alerts.realAlertsGenerated10m`, `alerts.alertsWithEvidence`, `alerts.demoAlertsVisible`, `alerts.duplicateAlertsSuppressed10m` | Partial: alerts can be rebuilt from watchlists + captures; demo fallback still exists and must be excluded from production buyer paths. | DWM alert lane | Add proof path: real watchlist + real capture -> saved alert with evidence ID, source ID, dedupe key, and `demoAlertsVisible=0`. |
| P7 | Analyst cases | `cases.openCaseCount`, `cases.casesAssigned10m`, `cases.casesClosed10m`, `cases.casesWithAnalystNotes` | Partial: DWM alert workflow states and TI/DWM workbench concepts exist; durable unified case object needs confirmation. | Case/workbench lane | Persist case object over DWM/TI alerts: assign, note, escalate, false-positive, close/reopen, timeline, audit actor. |
| P8 | Threat actor intelligence | `actorIntel.actorProfilesRefreshed10m`, `actorIntel.profilesWithRecentActivity`, `actorIntel.profilesWithSourceLinks` | Partial: actor pages/enrichment utilities exist; autonomous freshness and source-gated paid/free view need hard proof. | Actor-intel lane | Add actor refresh ledger: changed fields, source IDs, next refresh, stable profile cache, recent activity short-cache, first 5 sources free. |
| P9 | Audit/helpdesk/admin readiness | `admin.auditEvents10m`, `admin.helpdeskTicketsOpen`, `admin.supportActions10m` | Weak: admin/support work appears in progress; buyer/admin support loops are not yet a product KPI. | Admin/support lane | Add audit/helpdesk readiness endpoint: org audit events, support actions, failed deliveries needing help, source approval requests. |
| P10 | Deploy health | `deployment.frontendCommit`, `deployment.frontendHealthy`, `deployment.apiHealthy`, `deployment.scraperHealthy` | Partial: `/status` and container health exist; coordinator needs one product-progress record tying deploy health to CTI/DWM KPIs. | Ops lane | Emit `/api/product-progress` or scraper SLO record every 10 minutes with commit, health, and all KPI groups in this table. |

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
