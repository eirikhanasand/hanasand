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
});
