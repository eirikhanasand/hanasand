import { readFileSync } from "node:fs";
import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import {
  buildDwmEntitlementDownstreamAdoptionExamples,
  buildDwmEntitlementVisibilityBlocker,
  evaluateProposedDwmWatchlistEntitlement
} from "../api/dwmEntitlementRoutes.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

describe("dwm entitlement policy", () => {
  test("persists org-scoped limits, audits changes, and evaluates DWM watchlist usage", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-entitlement-policy-"));
    try {
      const snapshotPath = join(dir, "store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      const options = { store, frontier: new FocusedFrontier() };

      const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@entitled.example" },
        body: JSON.stringify({ name: "Entitled Monitor", ownerEmail: "owner@entitled.example", ownerUserId: "owner-1" })
      }), options);
      const orgPayload = await orgResponse.json() as any;
      const organizationId = orgPayload.organization.id;

      for (const member of [
        { id: "member_entitled_admin", email: "admin@entitled.example", userId: "admin-1", role: "admin" },
        { id: "member_entitled_viewer", email: "viewer@entitled.example", userId: "viewer-1", role: "viewer" }
      ]) {
        (store as any).saveOrganizationMember({
          ...member,
          organizationId,
          status: "active",
          acceptedAt: "2026-06-28T15:00:00.000Z",
          createdAt: "2026-06-28T15:00:00.000Z",
          updatedAt: "2026-06-28T15:00:00.000Z"
        });
      }

      store.saveSource({
        id: "src_entitled_org_pack",
        name: "Entitled org source pack",
        type: "telegram_public",
        url: "https://t.me/entitled_org",
        accessMethod: "public_http",
        status: "active",
        trustScore: 0.8,
        legalNotes: "Public channel preview only.",
        tenantId: organizationId,
        organizationId,
        createdAt: "2026-06-28T15:01:00.000Z",
        updatedAt: "2026-06-28T15:01:00.000Z"
      } as SourceRecord);

      const defaultReadResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        headers: { "x-user-email": "viewer@entitled.example" }
      }), options);
      const defaultRead = await defaultReadResponse.json() as any;
      expect(defaultReadResponse.status).toBe(200);
      expect(defaultRead.entitlement).toMatchObject({ plan: "team", status: "active", organizationId });
      expect(defaultRead.evaluation.usage).toMatchObject({ activeWatchlists: 0, watchTerms: 0, sourcePacks: 1 });
      expect(evaluateProposedDwmWatchlistEntitlement(options, { organizationId, tenantId: organizationId, terms: [{ value: "acme.com" }], status: "active" }).allowed).toBe(true);

      const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/webhooks`, {
        method: "POST",
        headers: { "x-actor-id": "owner-1" },
        body: JSON.stringify({ name: "Entitlement Discord", url: "https://discord.com/api/webhooks/entitlement/token" })
      }), options);
      const webhookPayload = await webhookResponse.json() as any;
      expect(webhookResponse.status).toBe(201);

      (store as any).saveCase({
        id: "case_entitled_open",
        organizationId,
        tenantId: organizationId,
        status: "open",
        title: "Open entitlement case",
        summary: "Counts toward open case usage.",
        createdAt: "2026-06-28T15:02:00.000Z",
        updatedAt: "2026-06-28T15:02:00.000Z"
      });

      const viewerUpdateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        method: "PUT",
        headers: { "x-user-email": "viewer@entitled.example" },
        body: JSON.stringify({ plan: "custom", reason: "Viewer should not alter entitlement policy." })
      }), options);
      expect(viewerUpdateResponse.status).toBe(403);

      const missingReasonResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        method: "PUT",
        headers: { "x-user-email": "admin@entitled.example" },
        body: JSON.stringify({ plan: "custom", limits: { activeWatchlists: 1 } })
      }), options);
      expect(missingReasonResponse.status).toBe(400);

      const upsertResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        method: "PUT",
        headers: { "x-user-email": "admin@entitled.example", "x-request-id": "req-entitlement-1" },
        body: JSON.stringify({
          plan: "custom",
          limits: { activeWatchlists: 1, watchTerms: 1, webhookDestinations: 1, sourcePacks: 2, openCases: 5 },
          reason: "Pilot contract allows one watched term until the paid monitor is approved."
        })
      }), options);
      const upsertPayload = await upsertResponse.json() as any;
      expect(upsertResponse.status).toBe(201);
      expect(upsertPayload.access).toMatchObject({ allowed: true, role: "admin" });
      expect(upsertPayload.entitlement).toMatchObject({
        recordType: "dwm_entitlement_policy",
        organizationId,
        tenantId: organizationId,
        plan: "custom",
        status: "active",
        limits: { activeWatchlists: 1, watchTerms: 1, webhookDestinations: 1, sourcePacks: 2, openCases: 5 },
        updatedBy: { memberId: "member_entitled_admin", email: "admin@entitled.example", userId: "admin-1", role: "admin" }
      });
      expect(upsertPayload.entitlement.auditTrail[0]).toMatchObject({
        actor: { memberId: "member_entitled_admin", email: "admin@entitled.example" },
        action: "created",
        requestId: "req-entitlement-1",
        reason: "Pilot contract allows one watched term until the paid monitor is approved."
      });
      expect(upsertPayload.evaluation.usage).toMatchObject({ activeWatchlists: 0, watchTerms: 0, webhookDestinations: 1, sourcePacks: 1, openCases: 1 });
      expect(upsertPayload.evaluation.integrationHints).toMatchObject({
        dashboard: { watchlistRoute: expect.stringContaining(organizationId) },
        helpdesk: { lookupKey: organizationId, auditSource: "dwm_entitlement_policy" }
      });

      const viewerReadResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        headers: { "x-user-email": "viewer@entitled.example" }
      }), options);
      const viewerRead = await viewerReadResponse.json() as any;
      expect(viewerReadResponse.status).toBe(200);
      expect(viewerRead.access).toMatchObject({ allowed: true, role: "viewer", readOnly: true });
      expect(viewerRead.entitlement.limits.watchTerms).toBe(1);

      const outsiderReadResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        headers: { "x-user-email": "outsider@example.com" }
      }), options);
      expect(outsiderReadResponse.status).toBe(403);
      expect(JSON.stringify(await outsiderReadResponse.json())).not.toContain("Pilot contract");

      (store as any).saveDwmWatchlist({
        id: "watch_entitled_allowed",
        organizationId,
        tenantId: organizationId,
        name: "Allowed one-term watchlist",
        terms: [{ value: "acme.com", kind: "domain" }],
        webhookDestinationId: webhookPayload.destination.id,
        status: "active",
        createdAt: "2026-06-28T15:03:00.000Z",
        updatedAt: "2026-06-28T15:03:00.000Z"
      });

      const blocked = evaluateProposedDwmWatchlistEntitlement(options, {
        organizationId,
        tenantId: organizationId,
        terms: [{ value: "blocked.example" }],
        status: "active",
        webhookDestinationId: webhookPayload.destination.id
      });
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toBe("active_watchlists");
      expect(blocked.evaluation?.projectedUsage).toMatchObject({ activeWatchlists: 2, watchTerms: 2 });
      expect(blocked.evaluation?.checks.find((check: any) => check.code === "active_watchlists")).toMatchObject({ allowed: false, limit: 1, used: 2 });

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      const policies = (rehydrated as any).listPlans().filter((row: any) => row.recordType === "dwm_entitlement_policy");
      expect(policies).toHaveLength(1);
      expect(policies[0].auditTrail[0].reason).toContain("Pilot contract");
      expect((rehydrated as any).listDwmWatchlists()).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("enforces persisted org limits on DWM watchlist create and update without mutating denied writes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-entitlement-enforcement-"));
    try {
      const store = new FileBackedScraperStore({ snapshotPath: join(dir, "store.json") });
      const options = { store, frontier: new FocusedFrontier() };

      const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@limits.example" },
        body: JSON.stringify({ name: "Limited Monitor", ownerEmail: "owner@limits.example", ownerUserId: "owner-limits" })
      }), options);
      const orgPayload = await orgResponse.json() as any;
      const organizationId = orgPayload.organization.id;

      store.saveSource({
        id: "src_limits_org",
        name: "Limited org source pack",
        type: "telegram_public",
        url: "https://t.me/limits_org",
        accessMethod: "public_http",
        status: "active",
        trustScore: 0.7,
        legalNotes: "Public preview only.",
        tenantId: organizationId,
        organizationId,
        createdAt: "2026-06-29T09:00:00.000Z",
        updatedAt: "2026-06-29T09:00:00.000Z"
      } as SourceRecord);
      (store as any).saveCase({
        id: "case_limits_open",
        organizationId,
        tenantId: organizationId,
        status: "open",
        title: "Limit usage case",
        createdAt: "2026-06-29T09:01:00.000Z",
        updatedAt: "2026-06-29T09:01:00.000Z"
      });

      const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/webhooks`, {
        method: "POST",
        headers: { "x-actor-id": "owner-limits" },
        body: JSON.stringify({ name: "Limit Discord", url: "https://discord.com/api/webhooks/limit/token" })
      }), options);
      const webhookPayload = await webhookResponse.json() as any;
      expect(webhookResponse.status).toBe(201);

      const policyResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        method: "PUT",
        headers: { "x-user-email": "owner@limits.example", "x-request-id": "req-policy-limit" },
        body: JSON.stringify({
          plan: "custom",
          limits: { activeWatchlists: 1, watchTerms: 1, webhookDestinations: 5, sourcePacks: 5, openCases: 5 },
          reason: "Contracted pilot allows one active monitored term."
        })
      }), options);
      expect(policyResponse.status).toBe(201);

      const allowedCreateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        headers: { "x-user-email": "owner@limits.example", "x-request-id": "req-watch-allowed" },
        body: JSON.stringify({
          organizationId,
          id: "watch_limit_allowed",
          name: "Allowed limited watch",
          terms: ["allowed.example"],
          webhookDestinationId: webhookPayload.destination.id,
          reason: "Create first contracted watchlist."
        })
      }), options);
      const allowedCreate = await allowedCreateResponse.json() as any;
      expect(allowedCreateResponse.status).toBe(201);
      expect(allowedCreate.entitlement).toMatchObject({
        entitlementStatus: "active",
        persistedPolicy: true,
        plan: "custom",
        blockedAction: null,
        usageSnapshot: { activeWatchlists: 0, watchTerms: 0, webhookDestinations: 1, sourcePacks: 1, openCases: 1 },
        projectedUsage: { activeWatchlists: 1, watchTerms: 1 },
        audit: { requestId: "req-watch-allowed", actor: "owner@limits.example" }
      });

      const allowedUpdateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists/watch_limit_allowed", {
        method: "PATCH",
        headers: { "x-user-email": "owner@limits.example", "x-request-id": "req-watch-update" },
        body: JSON.stringify({ organizationId, name: "Allowed renamed limited watch", terms: ["allowed.example"] })
      }), options);
      const allowedUpdate = await allowedUpdateResponse.json() as any;
      expect(allowedUpdateResponse.status).toBe(200);
      expect(allowedUpdate.watchlist.name).toBe("Allowed renamed limited watch");
      expect(allowedUpdate.entitlement).toMatchObject({ blockedAction: null, projectedUsage: { activeWatchlists: 1, watchTerms: 1 } });

      const deniedCreateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        headers: { "x-user-email": "owner@limits.example", "x-request-id": "req-watch-denied" },
        body: JSON.stringify({
          organizationId,
          id: "watch_limit_denied",
          name: "Denied second watch",
          terms: ["blocked.example"],
          webhookDestinationId: webhookPayload.destination.id,
          reason: "Attempt to exceed contracted pilot limit."
        })
      }), options);
      const deniedCreate = await deniedCreateResponse.json() as any;
      expect(deniedCreateResponse.status).toBe(402);
      expect(deniedCreate.error).toMatchObject({ code: "dwm_entitlement_limit_exceeded", reason: "active_watchlists" });
      expect(deniedCreate.entitlement).toMatchObject({
        entitlementStatus: "active",
        persistedPolicy: true,
        plan: "custom",
        blockedAction: "create_dwm_watchlist",
        reason: "active_watchlists",
        limit: { code: "active_watchlists", used: 2, limit: 1, remaining: 0 },
        usageSnapshot: { activeWatchlists: 1, watchTerms: 1, webhookDestinations: 1, sourcePacks: 1, openCases: 1 },
        projectedUsage: { activeWatchlists: 2, watchTerms: 2 },
        audit: { requestId: "req-watch-denied", actor: "owner@limits.example" }
      });
      expect(deniedCreate.entitlement.nextStep).toContain("DWM entitlement limit");
      expect(deniedCreate.entitlement.helpdesk).toMatchObject({ lookupKey: organizationId, auditSource: "dwm_entitlement_policy" });
      expect((store as any).getDwmWatchlist("watch_limit_denied")).toBeUndefined();
      expect((store as any).listDwmWatchlists()).toHaveLength(1);
      expect((store as any).listDwmAlerts()).toHaveLength(0);

      const deniedUpdateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists/watch_limit_allowed", {
        method: "PATCH",
        headers: { "x-user-email": "owner@limits.example", "x-request-id": "req-watch-update-denied" },
        body: JSON.stringify({ organizationId, terms: ["allowed.example", "extra.example"] })
      }), options);
      const deniedUpdate = await deniedUpdateResponse.json() as any;
      expect(deniedUpdateResponse.status).toBe(402);
      expect(deniedUpdate.entitlement).toMatchObject({
        blockedAction: "update_dwm_watchlist",
        reason: "watch_terms",
        limit: { code: "watch_terms", used: 2, limit: 1, remaining: 0 },
        audit: { requestId: "req-watch-update-denied" }
      });
      expect((store as any).getDwmWatchlist("watch_limit_allowed").terms).toEqual([
        expect.objectContaining({ value: "allowed.example", kind: "domain", id: expect.stringMatching(/^dwm_watchlist_item_/) })
      ]);

      const outsiderResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        headers: { "x-user-email": "outsider@limits.example" },
        body: JSON.stringify({ organizationId, terms: ["outsider.example"] })
      }), options);
      const outsiderPayload = await outsiderResponse.json() as any;
      expect(outsiderResponse.status).toBe(403);
      expect(outsiderPayload.error.code).toBe("organization_visibility_denied");
      expect(outsiderPayload.entitlement).toBeUndefined();

      const permissiveOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@permissive.example" },
        body: JSON.stringify({ name: "Permissive Monitor", ownerEmail: "owner@permissive.example", ownerUserId: "owner-permissive" })
      }), options);
      const permissiveOrg = await permissiveOrgResponse.json() as any;
      for (let index = 0; index < 10; index += 1) {
        (store as any).saveDwmWatchlist({
          id: `watch_permissive_existing_${index}`,
          organizationId: permissiveOrg.organization.id,
          tenantId: permissiveOrg.organization.id,
          name: `Permissive existing ${index}`,
          terms: [{ value: `existing-${index}.example`, kind: "domain" }],
          status: "active",
          createdAt: "2026-06-29T09:05:00.000Z",
          updatedAt: "2026-06-29T09:05:00.000Z"
        });
      }
      const permissiveCreateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        headers: { "x-user-email": "owner@permissive.example", "x-request-id": "req-no-policy" },
        body: JSON.stringify({ organizationId: permissiveOrg.organization.id, id: "watch_permissive_over_default", terms: ["over-default.example"] })
      }), options);
      const permissiveCreate = await permissiveCreateResponse.json() as any;
      expect(permissiveCreateResponse.status).toBe(201);
      expect(permissiveCreate.entitlement).toMatchObject({ persistedPolicy: false, blockedAction: null, projectedUsage: { activeWatchlists: 11, watchTerms: 11 } });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("enforces alert rebuild daily entitlement without mutating denied rebuilds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-entitlement-rebuild-rate-"));
    try {
      const store = new FileBackedScraperStore({ snapshotPath: join(dir, "store.json") });
      const options = { store, frontier: new FocusedFrontier() };
      const source: SourceRecord = {
        id: "src_rebuild_rate",
        name: "Rebuild rate public Telegram",
        type: "telegram_public",
        url: "https://t.me/rebuild_rate",
        accessMethod: "public_http",
        status: "active",
        trustScore: 0.82,
        legalNotes: "Public channel preview only.",
        createdAt: "2026-06-29T10:00:00.000Z",
        updatedAt: "2026-06-29T10:00:00.000Z"
      } as SourceRecord;
      const capture: RawCapture = {
        id: "cap_rebuild_rate_acme",
        sourceId: source.id,
        url: "https://t.me/rebuild_rate/42",
        collectedAt: "2026-06-29T10:05:00.000Z",
        mediaType: "text/plain",
        storageKind: "inline_text",
        contentHash: "hash-rebuild-rate-acme",
        sensitive: false,
        body: "rate-limit.example appears in public Telegram chatter tied to credential exposure.",
        metadata: { adapter: "telegram_public", channel: "rebuild_rate", messageId: 42 }
      } as RawCapture;
      store.saveSource(source);
      store.saveCapture(capture);

      const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@rebuild.example" },
        body: JSON.stringify({ name: "Rebuild Rate Monitor", ownerEmail: "owner@rebuild.example", ownerUserId: "owner-rebuild" })
      }), options);
      const orgPayload = await orgResponse.json() as any;
      const organizationId = orgPayload.organization.id;

      const policyResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        method: "PUT",
        headers: { "x-user-email": "owner@rebuild.example", "x-request-id": "req-rebuild-policy" },
        body: JSON.stringify({
          plan: "custom",
          limits: { activeWatchlists: 5, watchTerms: 20, webhookDestinations: 5, sourcePacks: 5, alertRebuildsPerDay: 1, openCases: 5 },
          reason: "Pilot contract allows one alert rebuild per day."
        })
      }), options);
      expect(policyResponse.status).toBe(201);

      const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        headers: { "x-user-email": "owner@rebuild.example" },
        body: JSON.stringify({ organizationId, id: "watch_rebuild_rate", terms: ["rate-limit.example"] })
      }), options);
      expect(watchlistResponse.status).toBe(201);

      const firstRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        headers: { "x-user-email": "owner@rebuild.example", "x-request-id": "req-rebuild-1" },
        body: JSON.stringify({ organizationId })
      }), options);
      const firstRebuild = await firstRebuildResponse.json() as any;
      expect(firstRebuildResponse.status).toBe(200);
      expect(firstRebuild.savedAlertCount).toBe(1);
      expect(firstRebuild.entitlement).toMatchObject({
        entitlementStatus: "active",
        persistedPolicy: true,
        blockedAction: null,
        usageSnapshot: { alertRebuildsToday: 0, activeWatchlists: 1, watchTerms: 1 },
        projectedUsage: { alertRebuildsToday: 1 },
        audit: { requestId: "req-rebuild-1", actor: "owner@rebuild.example" }
      });
      expect(firstRebuild.entitlementUsageEvent).toMatchObject({
        recordType: "dwm_entitlement_usage_event",
        organizationId,
        action: "alert_rebuild",
        requestId: "req-rebuild-1",
        metadata: { route: "rebuild_dwm_alerts", savedAlertCount: 1 }
      });

      const alertId = firstRebuild.alerts[0].id;
      const updateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "x-user-email": "owner@rebuild.example" },
        body: JSON.stringify({ organizationId, action: "investigate", assignedOwner: "iris", note: "Keep this workflow state across denied rebuilds." })
      }), options);
      expect(updateResponse.status).toBe(200);
      const beforeDenied = (store as any).getDwmAlert(alertId);
      expect(beforeDenied.workflowEvents).toHaveLength(1);

      const deniedRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        headers: { "x-user-email": "owner@rebuild.example", "x-request-id": "req-rebuild-denied" },
        body: JSON.stringify({ organizationId })
      }), options);
      const deniedRebuild = await deniedRebuildResponse.json() as any;
      expect(deniedRebuildResponse.status).toBe(402);
      expect(deniedRebuild.error).toMatchObject({ code: "dwm_entitlement_limit_exceeded", reason: "alert_rebuilds_today" });
      expect(deniedRebuild.entitlement).toMatchObject({
        blockedAction: "rebuild_dwm_alerts",
        reason: "alert_rebuilds_today",
        limit: { code: "alert_rebuilds_today", used: 2, limit: 1, remaining: 0 },
        usageSnapshot: { alertRebuildsToday: 1 },
        projectedUsage: { alertRebuildsToday: 2 },
        audit: { requestId: "req-rebuild-denied", actor: "owner@rebuild.example" }
      });
      const afterDenied = (store as any).getDwmAlert(alertId);
      expect(afterDenied.workflowEvents).toHaveLength(1);
      expect(afterDenied.assignedOwner).toBe("iris");
      expect((store as any).listPlans().filter((row: any) => row.recordType === "dwm_entitlement_usage_event" && row.action === "alert_rebuild" && row.organizationId === organizationId)).toHaveLength(1);

      const deniedReplayResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alertId}/replay`, {
        method: "POST",
        headers: { "x-user-email": "owner@rebuild.example", "x-request-id": "req-replay-denied" },
        body: JSON.stringify({ organizationId })
      }), options);
      const deniedReplay = await deniedReplayResponse.json() as any;
      expect(deniedReplayResponse.status).toBe(402);
      expect(deniedReplay.entitlement).toMatchObject({
        blockedAction: "replay_dwm_alert",
        reason: "alert_rebuilds_today",
        audit: { requestId: "req-replay-denied", actor: "owner@rebuild.example" }
      });
      expect((store as any).getDwmAlert(alertId).workflowEvents).toHaveLength(1);

      const outsiderResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        headers: { "x-user-email": "outsider@rebuild.example" },
        body: JSON.stringify({ organizationId })
      }), options);
      const outsiderPayload = await outsiderResponse.json() as any;
      expect(outsiderResponse.status).toBe(403);
      expect(outsiderPayload.error.code).toBe("organization_visibility_denied");
      expect(outsiderPayload.entitlement).toBeUndefined();

      const permissiveOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@rebuild-open.example" },
        body: JSON.stringify({ name: "Open Rebuild Monitor", ownerEmail: "owner@rebuild-open.example", ownerUserId: "owner-rebuild-open" })
      }), options);
      const permissiveOrg = await permissiveOrgResponse.json() as any;
      (store as any).saveDwmWatchlist({
        id: "watch_rebuild_open",
        organizationId: permissiveOrg.organization.id,
        tenantId: permissiveOrg.organization.id,
        name: "Open rebuild watch",
        terms: [{ value: "rate-limit.example", kind: "domain" }],
        status: "active",
        createdAt: "2026-06-29T10:10:00.000Z",
        updatedAt: "2026-06-29T10:10:00.000Z"
      });
      for (let index = 0; index < 100; index += 1) {
        (store as any).savePlan({
          id: `usage_open_rebuild_${index}`,
          recordType: "dwm_entitlement_usage_event",
          organizationId: permissiveOrg.organization.id,
          tenantId: permissiveOrg.organization.id,
          action: "alert_rebuild",
          at: new Date().toISOString()
        });
      }
      const permissiveRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        headers: { "x-user-email": "owner@rebuild-open.example", "x-request-id": "req-rebuild-open" },
        body: JSON.stringify({ organizationId: permissiveOrg.organization.id })
      }), options);
      const permissiveRebuild = await permissiveRebuildResponse.json() as any;
      expect(permissiveRebuildResponse.status).toBe(200);
      expect(permissiveRebuild.entitlement).toMatchObject({ persistedPolicy: false, blockedAction: null, projectedUsage: { alertRebuildsToday: 101 } });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("exposes org entitlement readiness for dashboard, helpdesk, webhook, alerts, and handoff consumers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-entitlement-readiness-"));
    try {
      const store = new FileBackedScraperStore({ snapshotPath: join(dir, "store.json") });
      const options = { store, frontier: new FocusedFrontier() };

      const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@readiness.example" },
        body: JSON.stringify({ name: "Readiness Monitor", ownerEmail: "owner@readiness.example", ownerUserId: "owner-readiness" })
      }), options);
      const orgPayload = await orgResponse.json() as any;
      const organizationId = orgPayload.organization.id;

      store.saveSource({
        id: "src_readiness_org",
        name: "Readiness org source",
        type: "telegram_public",
        url: "https://t.me/readiness_org",
        accessMethod: "public_http",
        status: "active",
        trustScore: 0.8,
        legalNotes: "Public preview only.",
        tenantId: organizationId,
        organizationId,
        createdAt: "2026-06-29T11:00:00.000Z",
        updatedAt: "2026-06-29T11:00:00.000Z"
      } as SourceRecord);

      const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/webhooks`, {
        method: "POST",
        headers: { "x-actor-id": "owner-readiness" },
        body: JSON.stringify({ name: "Readiness Discord", url: "https://discord.com/api/webhooks/readiness/token" })
      }), options);
      expect(webhookResponse.status).toBe(201);

      (store as any).saveDwmWatchlist({
        id: "watch_readiness",
        organizationId,
        tenantId: organizationId,
        name: "Readiness watch",
        terms: [{ value: "readiness.example", kind: "domain" }],
        status: "active",
        createdAt: "2026-06-29T11:01:00.000Z",
        updatedAt: "2026-06-29T11:01:00.000Z"
      });
      (store as any).savePlan({
        id: "usage_readiness_rebuild",
        recordType: "dwm_entitlement_usage_event",
        organizationId,
        tenantId: organizationId,
        action: "alert_rebuild",
        at: new Date().toISOString()
      });

      const policyResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
        method: "PUT",
        headers: { "x-user-email": "owner@readiness.example", "x-request-id": "req-readiness-policy" },
        body: JSON.stringify({
          plan: "custom",
          limits: { activeWatchlists: 1, watchTerms: 1, webhookDestinations: 1, sourcePacks: 1, alertRebuildsPerDay: 1, openCases: 5 },
          reason: "Readiness contract pins all limits for blocker rendering."
        })
      }), options);
      expect(policyResponse.status).toBe(201);

      const readinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements/readiness`, {
        headers: { "x-user-email": "owner@readiness.example", "x-request-id": "req-readiness-get" }
      }), options);
      const readiness = await readinessResponse.json() as any;
      expect(readinessResponse.status).toBe(200);
      expect(readiness).toMatchObject({
        schemaVersion: "dwm.entitlement_readiness.v1",
        requestId: "req-readiness-get",
        policy: { plan: "custom", status: "active", persistedPolicy: true },
        usage: { activeWatchlists: 1, watchTerms: 1, webhookDestinations: 1, sourcePacks: 1, alertRebuildsToday: 1 },
        defaultNoPolicyBehavior: "permissive_until_policy_persisted"
      });
      expect(readiness.actions.watchlist_create).toMatchObject({
        ownerLane: "entitlement",
        status: "blocked",
        entitlementStatus: "active",
        plan: "custom",
        persistedPolicy: true,
        blockedAction: "create_dwm_watchlist",
        blockerCodes: ["active_watchlists"],
        limit: { code: "active_watchlists", used: 2, limit: 1, remaining: 0 },
        requestId: "req-readiness-get"
      });
      expect(readiness.actions.watchlist_create.blockers[0]).toMatchObject({
        schemaVersion: "dwm.entitlement_blocker.v1",
        ownerLane: "entitlement",
        actionId: "watchlist_create",
        action: "create_dwm_watchlist",
        blockerCode: "active_watchlists",
        blockedAction: "create_dwm_watchlist",
        route: "/v1/dwm/watchlists",
        requestId: "req-readiness-get",
        entitlementStatus: "active",
        plan: "custom",
        persistedPolicy: true,
        usage: { activeWatchlists: 1, watchTerms: 1 },
        projectedUsage: { activeWatchlists: 2, watchTerms: 2 },
        limit: { code: "active_watchlists", used: 2, limit: 1, remaining: 0 },
        source: "entitlement"
      });
      expect(readiness.actions.watchlist_create.blockers[0].supportText).toContain("Limit active_watchlists");
      expect(readiness.actions.alert_rebuild).toMatchObject({
        ownerLane: "alert-workflow",
        status: "blocked",
        blockedAction: "rebuild_dwm_alerts",
        blockerCodes: ["alert_rebuilds_today"],
        limit: { code: "alert_rebuilds_today", used: 2, limit: 1, remaining: 0 }
      });
      expect(readiness.actions.alert_rebuild.blockers[0]).toMatchObject({
        schemaVersion: "dwm.entitlement_blocker.v1",
        ownerLane: "alert-workflow",
        actionId: "alert_rebuild",
        action: "rebuild_dwm_alerts",
        blockerCode: "alert_rebuilds_today",
        route: "/v1/dwm/alerts/rebuild",
        requestId: "req-readiness-get",
        limit: { code: "alert_rebuilds_today", used: 2, limit: 1, remaining: 0 },
        source: "entitlement"
      });
      expect(readiness.actions.source_growth).toMatchObject({
        ownerLane: "source-growth",
        status: "blocked",
        blockerCodes: ["source_packs"],
        limit: { code: "source_packs", used: 2, limit: 1, remaining: 0 }
      });
      expect(readiness.actions.source_growth.blockers[0]).toMatchObject({
        schemaVersion: "dwm.entitlement_blocker.v1",
        ownerLane: "source-growth",
        actionId: "source_growth",
        action: "source_growth",
        blockerCode: "source_packs",
        route: "/v1/dwm/source-requests",
        source: "entitlement"
      });
      expect(readiness.actions.webhook_delivery).toMatchObject({
        ownerLane: "webhook",
        status: "allowed",
        blockedAction: null,
        blockers: []
      });
      expect(readiness.actions.analyst_handoff).toMatchObject({
        ownerLane: "analyst-handoff",
        status: "needs_input",
        blockerCodes: ["missing_handoff_bundle"],
        blockers: [{
          schemaVersion: "dwm.entitlement_blocker.v1",
          ownerLane: "analyst-handoff",
          actionId: "analyst_handoff",
          action: "consume_analyst_handoff",
          blockerCode: "missing_handoff_bundle",
          source: "missing_prerequisite"
        }]
      });
      expect(readiness.actions.alert_rebuild.helpdeskText).toContain("Limit alert_rebuilds_today");
      expect(readiness.actions.alert_rebuild.redactedAudit).toMatchObject({ action: "created", requestId: "req-readiness-policy" });

      const blockerBundle = JSON.parse(readFileSync(new URL("./fixtures/analyst-handoff-blockers.json", import.meta.url), "utf8"));
      const handoffResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements/readiness`, {
        method: "POST",
        headers: { "x-user-email": "owner@readiness.example", "x-request-id": "req-readiness-handoff" },
        body: JSON.stringify({ analystHandoffBundle: blockerBundle })
      }), options);
      const handoffReadiness = await handoffResponse.json() as any;
      expect(handoffResponse.status).toBe(200);
      expect(handoffReadiness.actions.analyst_handoff).toMatchObject({
        status: "blocked",
        blockedAction: "consume_analyst_handoff",
        requestId: "req-readiness-handoff"
      });
      expect(handoffReadiness.actions.analyst_handoff.blockerCodes).toContain("entitlement_blocked");
      expect(handoffReadiness.actions.analyst_handoff.blockerCodes).toContain("webhook_audit_contract_mismatch");
      expect(handoffReadiness.actions.analyst_handoff.analystHandoff.blockerCount).toBeGreaterThan(0);
      expect(handoffReadiness.actions.analyst_handoff.blockers.find((item: any) => item.blockerCode === "webhook_audit_contract_mismatch")).toMatchObject({
        schemaVersion: "dwm.entitlement_blocker.v1",
        ownerLane: "analyst-handoff",
        actionId: "analyst_handoff",
        action: "consume_analyst_handoff",
        blockedAction: "consume_analyst_handoff",
        route: "analyst_handoff_consumer",
        requestId: "req-readiness-handoff",
        source: "analyst_handoff",
        analystHandoff: {
          code: "webhook_audit_contract_mismatch",
          stage: "webhook_audit",
          recoverable: false
        }
      });

      const outsiderResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements/readiness`, {
        headers: { "x-user-email": "outsider@readiness.example" }
      }), options);
      const outsiderPayload = await outsiderResponse.json() as any;
      expect(outsiderResponse.status).toBe(403);
      expect(outsiderPayload.error.code).toBe("organization_entitlement_denied");
      expect(outsiderPayload.actions).toBeUndefined();
      expect(buildDwmEntitlementVisibilityBlocker({
        actionId: "alert_rebuild",
        ownerLane: "alert-workflow",
        actionName: "rebuild_dwm_alerts",
        blockerCode: "not_member",
        route: "/v1/dwm/alerts/rebuild",
        requestId: "req-readiness-outsider"
      })).toMatchObject({
        schemaVersion: "dwm.entitlement_blocker.v1",
        ownerLane: "alert-workflow",
        actionId: "alert_rebuild",
        blockerCode: "not_member",
        source: "visibility",
        limit: undefined,
        supportText: "Access was denied by organization visibility/RBAC before entitlement evaluation."
      });

      const webhookDeniedOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@webhook-denied.example" },
        body: JSON.stringify({ name: "Webhook Denied Monitor", ownerEmail: "owner@webhook-denied.example", ownerUserId: "owner-webhook-denied" })
      }), options);
      const webhookDeniedOrg = await webhookDeniedOrgResponse.json() as any;
      const webhookDeniedOrgId = webhookDeniedOrg.organization.id;
      for (const suffix of ["one", "two"]) {
        const response = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${webhookDeniedOrgId}/webhooks`, {
          method: "POST",
          headers: { "x-actor-id": "owner-webhook-denied" },
          body: JSON.stringify({ name: `Webhook denied ${suffix}`, url: `https://discord.com/api/webhooks/${suffix}/token` })
        }), options);
        expect(response.status).toBe(201);
      }
      const webhookPolicyResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${webhookDeniedOrgId}/entitlements`, {
        method: "PUT",
        headers: { "x-user-email": "owner@webhook-denied.example", "x-request-id": "req-webhook-denied-policy" },
        body: JSON.stringify({
          plan: "custom",
          limits: { activeWatchlists: 5, watchTerms: 50, webhookDestinations: 1, sourcePacks: 5, alertRebuildsPerDay: 5, openCases: 5 },
          reason: "Webhook destination count is over contract until the customer upgrades."
        })
      }), options);
      expect(webhookPolicyResponse.status).toBe(201);
      const webhookDeniedReadinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${webhookDeniedOrgId}/entitlements/readiness`, {
        headers: { "x-user-email": "owner@webhook-denied.example", "x-request-id": "req-webhook-denied-readiness" }
      }), options);
      const webhookDeniedReadiness = await webhookDeniedReadinessResponse.json() as any;
      expect(webhookDeniedReadiness.actions.webhook_delivery).toMatchObject({
        ownerLane: "webhook",
        status: "blocked",
        blockerCodes: ["webhook_destinations"],
        blockedAction: "deliver_dwm_webhook",
        limit: { code: "webhook_destinations", used: 2, limit: 1, remaining: 0 },
        blockers: [{
          schemaVersion: "dwm.entitlement_blocker.v1",
          actionId: "webhook_delivery",
          action: "deliver_dwm_webhook",
          blockerCode: "webhook_destinations",
          route: "/v1/dwm/webhooks/deliver",
          requestId: "req-webhook-denied-readiness",
          source: "entitlement"
        }]
      });

      const openOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-user-email": "owner@readiness-open.example" },
        body: JSON.stringify({ name: "Open Readiness Monitor", ownerEmail: "owner@readiness-open.example", ownerUserId: "owner-readiness-open" })
      }), options);
      const openOrg = await openOrgResponse.json() as any;
      for (let index = 0; index < 100; index += 1) {
        (store as any).savePlan({
          id: `usage_readiness_open_${index}`,
          recordType: "dwm_entitlement_usage_event",
          organizationId: openOrg.organization.id,
          tenantId: openOrg.organization.id,
          action: "alert_rebuild",
          at: new Date().toISOString()
        });
      }
      const openReadinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${openOrg.organization.id}/entitlements/readiness`, {
        headers: { "x-user-email": "owner@readiness-open.example" }
      }), options);
      const openReadiness = await openReadinessResponse.json() as any;
      expect(openReadinessResponse.status).toBe(200);
      expect(openReadiness.policy.persistedPolicy).toBe(false);
      expect(openReadiness.actions.alert_rebuild).toMatchObject({ status: "permissive_no_policy", blockedAction: null, persistedPolicy: false, blockers: [] });
      expect(openReadiness.actions.watchlist_create).toMatchObject({ status: "permissive_no_policy", blockedAction: null, persistedPolicy: false, blockers: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("publishes deterministic downstream entitlement adoption examples without route-string parsing", () => {
    const contract = buildDwmEntitlementDownstreamAdoptionExamples({
      generatedAt: "2026-06-29T12:00:00.000Z",
      requestId: "req-adoption-contract"
    });
    expect(contract.schemaVersion).toBe("dwm.entitlement_downstream_adoption.v1");
    expect(contract.generatedAt).toBe("2026-06-29T12:00:00.000Z");
    const examples = new Map(contract.examples.map((item) => [item.id, item]));
    for (const id of [
      "no_policy_permissive",
      "plan_limit_exceeded",
      "projected_usage_exceeded",
      "nonmember_visibility_denied",
      "source_growth_denied",
      "webhook_delivery_denied",
      "alert_rebuild_denied",
      "alert_replay_denied",
      "analyst_handoff_blocked"
    ] as const) {
      expect(examples.has(id)).toBe(true);
    }

    expect(examples.get("no_policy_permissive")).toMatchObject({
      status: "permissive_no_policy",
      separation: "permissive_no_policy",
      consumers: expect.arrayContaining(["product-progress", "helpdesk", "alert-workflow"]),
      sample: {
        readinessAction: {
          persistedPolicy: false,
          blockerCodes: [],
          blockers: [],
          blockedAction: null
        }
      }
    });
    expect(examples.get("no_policy_permissive")?.supportText).toContain("Do not mark this enterprise-ready");

    expect(examples.get("plan_limit_exceeded")?.sample.blocker).toMatchObject({
      schemaVersion: "dwm.entitlement_blocker.v1",
      ownerLane: "entitlement",
      actionId: "watchlist_create",
      action: "create_dwm_watchlist",
      blockerCode: "active_watchlists",
      blockedAction: "create_dwm_watchlist",
      status: "blocked",
      route: "/v1/dwm/watchlists",
      requestId: "req-adoption-contract",
      source: "entitlement",
      limit: { code: "active_watchlists", used: 2, limit: 1, remaining: 0 }
    });
    expect(examples.get("projected_usage_exceeded")).toMatchObject({
      consumers: expect.arrayContaining(["public-ti", "product-progress"]),
      separation: "entitlement",
      sample: {
        blocker: {
          blockerCode: "watch_terms",
          projectedUsage: { watchTerms: 7 },
          supportText: "Projected watch_terms usage exceeds the current plan."
        }
      }
    });

    expect(examples.get("nonmember_visibility_denied")?.sample.blocker).toMatchObject({
      schemaVersion: "dwm.entitlement_blocker.v1",
      source: "visibility",
      blockerCode: "not_member",
      limit: undefined,
      supportText: "Access was denied by organization visibility/RBAC before entitlement evaluation."
    });

    expect(examples.get("source_growth_denied")?.sample.blocker).toMatchObject({
      ownerLane: "source-growth",
      actionId: "source_growth",
      blockerCode: "source_packs",
      route: "/v1/dwm/source-requests"
    });
    expect(examples.get("webhook_delivery_denied")?.sample.blocker).toMatchObject({
      ownerLane: "webhook",
      actionId: "webhook_delivery",
      action: "deliver_dwm_webhook",
      blockerCode: "webhook_destinations",
      route: "/v1/dwm/webhooks/deliver"
    });
    expect(examples.get("alert_rebuild_denied")?.sample.blocker).toMatchObject({
      ownerLane: "alert-workflow",
      actionId: "alert_rebuild",
      action: "rebuild_dwm_alerts",
      blockerCode: "alert_rebuilds_today",
      route: "/v1/dwm/alerts/rebuild"
    });
    expect(examples.get("alert_replay_denied")?.sample.blocker).toMatchObject({
      ownerLane: "alert-workflow",
      actionId: "alert_replay",
      action: "replay_dwm_alert",
      blockerCode: "alert_rebuilds_today",
      route: "/v1/dwm/alerts/:id/replay"
    });
    expect(examples.get("analyst_handoff_blocked")?.sample.blocker).toMatchObject({
      ownerLane: "analyst-handoff",
      actionId: "analyst_handoff",
      source: "analyst_handoff",
      analystHandoff: {
        code: "webhook_audit_contract_mismatch",
        stage: "webhook_audit",
        field: "webhookTrigger.auditEvents",
        recoverable: false
      }
    });

    const serialized = JSON.stringify(contract);
    expect(serialized).not.toContain("@");
    expect(serialized).not.toContain("rawTerms");
  });
});
