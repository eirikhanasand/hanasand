import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import { evaluateProposedDwmWatchlistEntitlement } from "../api/dwmEntitlementRoutes.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import type { SourceRecord } from "../types.ts";

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
      expect((store as any).getDwmWatchlist("watch_limit_allowed").terms).toEqual([{ value: "allowed.example", kind: "domain" }]);

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
});
