import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_case_tg",
  name: "Case public Telegram",
  type: "telegram_public",
  url: "https://t.me/case_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.82,
  legalNotes: "Public preview only.",
  createdAt: "2026-06-28T13:00:00.000Z",
  updatedAt: "2026-06-28T13:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_case_acme",
  sourceId: source.id,
  url: "https://t.me/case_public/19",
  collectedAt: "2026-06-28T13:04:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-case-acme",
  sensitive: false,
  body: "acme.com is named in public Telegram chatter connected to Okta session cookie exposure and AWS IAM key hints.",
  metadata: { adapter: "telegram_public", channel: "case_public", messageId: 19 }
} as RawCapture;

describe("dwm case workflow", () => {
  test("opens, updates, closes, and persists a case over a real org-scoped DWM alert", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-case-workflow-"));
    try {
      const snapshotPath = join(dir, "store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(source);
      store.saveCapture(capture);
      const seen: Array<{ url: string; body: any; headers: Headers }> = [];
      const options = {
        store,
        frontier: new FocusedFrontier(),
        webhookFetch: async (url: string, init: RequestInit) => {
          seen.push({ url, body: JSON.parse(String(init.body)), headers: new Headers(init.headers) });
          return new Response("accepted", { status: 202 });
        }
      };

      const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name: "Acme Case Team", ownerEmail: "owner@acme.com" })
      }), options);
      const orgPayload = await orgResponse.json() as any;
      const organizationId = orgPayload.organization.id;
      const otherOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name: "Globex Response Team", ownerEmail: "owner@globex.example" })
      }), options);
      const otherOrgPayload = await otherOrgResponse.json() as any;
      const otherOrganizationId = otherOrgPayload.organization.id;
      const restrictedOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name: "Restricted Visibility Team", ownerEmail: "owner@restricted.example" })
      }), options);
      const restrictedOrgPayload = await restrictedOrgResponse.json() as any;
      const restrictedOrganizationId = restrictedOrgPayload.organization.id;
      (store as any).saveOrganization({
        ...restrictedOrgPayload.organization,
        alertVisibilityPolicy: "admins",
        alert_visibility_policy: "admins"
      });
      (store as any).saveCase({
        id: "case_globex_leak_guard",
        tenantId: otherOrganizationId,
        organizationId: otherOrganizationId,
        sourceType: "manual",
        sourceId: "manual_globex",
        title: "Globex leaked credentials",
        summary: "This case must never appear in Acme filtered case results.",
        priority: "critical",
        status: "open",
        assignedOwner: "owner@globex.example",
        createdAt: "2026-06-28T13:02:00.000Z",
        updatedAt: "2026-06-28T13:02:00.000Z",
        workflowEvents: [],
        lastDecision: "Seeded for org isolation test."
      });
      (store as any).saveCase({
        id: "case_restricted_admin_only",
        tenantId: restrictedOrganizationId,
        organizationId: restrictedOrganizationId,
        sourceType: "manual",
        sourceId: "manual_restricted",
        title: "Restricted admin only case",
        summary: "Only owner and admin members should see this filtered/exportable case.",
        priority: "high",
        status: "open",
        assignedOwner: "admin@restricted.example",
        createdAt: "2026-06-28T13:03:00.000Z",
        updatedAt: "2026-06-28T13:03:00.000Z",
        workflowEvents: [],
        lastDecision: "Seeded for visibility policy test."
      });
      const memberCreatedAt = "2026-06-28T13:01:00.000Z";
      for (const member of [
        { id: "member_case_analyst_1", email: "analyst-1@acme.com", userId: "analyst-1", role: "analyst" },
        { id: "member_case_analyst_2", email: "analyst-2@acme.com", userId: "analyst-2", role: "analyst" },
        { id: "member_case_ir_lead", email: "ir-lead@acme.com", userId: "ir-lead", role: "admin" },
        { id: "member_case_viewer", email: "viewer@acme.com", userId: "viewer-1", role: "viewer" },
        { id: "member_case_removed", email: "removed@acme.com", userId: "removed-1", role: "analyst", status: "removed" },
        { id: "member_case_deactivated", email: "deactivated@acme.com", userId: "deactivated-1", role: "analyst", userActive: false }
      ]) {
        (store as any).saveOrganizationMember({
          ...member,
          organizationId,
          status: (member as any).status ?? "active",
          acceptedAt: memberCreatedAt,
          createdAt: memberCreatedAt,
          updatedAt: memberCreatedAt
        });
      }
      for (const member of [
        { id: "member_restricted_admin", email: "admin@restricted.example", userId: "restricted-admin", role: "admin" },
        { id: "member_restricted_viewer", email: "viewer@restricted.example", userId: "restricted-viewer", role: "viewer" }
      ]) {
        (store as any).saveOrganizationMember({
          ...member,
          organizationId: restrictedOrganizationId,
          status: "active",
          acceptedAt: memberCreatedAt,
          createdAt: memberCreatedAt,
          updatedAt: memberCreatedAt
        });
      }

      const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/webhooks`, {
        method: "POST",
        body: JSON.stringify({ name: "Case Discord", url: "https://discord.com/api/webhooks/case/token" })
      }), options);
      const webhookPayload = await webhookResponse.json() as any;

      const viewerWatchlistCreateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        headers: { "x-user-email": "viewer@acme.com" },
        body: JSON.stringify({ organizationId, name: "Viewer watchlist", terms: ["viewer-only.example"], webhookDestinationId: webhookPayload.destination.id })
      }), options);
      expect(viewerWatchlistCreateResponse.status).toBe(403);
      expect((await viewerWatchlistCreateResponse.json() as any).visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect((store as any).listDwmWatchlists()).toHaveLength(0);

      const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, name: "Case watchlist", terms: ["acme.com"], webhookDestinationId: webhookPayload.destination.id })
      }), options);
      const watchlistPayload = await watchlistResponse.json() as any;
      expect(watchlistResponse.status).toBe(201);
      expect(watchlistPayload.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(watchlistPayload.watchlist).toMatchObject({
        organizationId,
        tenantId: organizationId,
        name: "Case watchlist",
        status: "active"
      });
      expect(watchlistPayload.watchlist.workflowContext).toMatchObject({ alertCount: 0, activeForAlertGeneration: true });
      const watchlistId = watchlistPayload.watchlist.id;

      const viewerWatchlistListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const viewerWatchlistList = await viewerWatchlistListResponse.json() as any;
      expect(viewerWatchlistListResponse.status).toBe(200);
      expect(viewerWatchlistList.visibilityDecision).toMatchObject({ allowed: true, reason: null, alertVisibilityPolicy: "members" });
      expect(viewerWatchlistList.watchlists).toHaveLength(1);
      expect(viewerWatchlistList.watchlists[0].terms[0].value).toBe("acme.com");

      const viewerWatchlistDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists/${watchlistId}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const viewerWatchlistDetail = await viewerWatchlistDetailResponse.json() as any;
      expect(viewerWatchlistDetailResponse.status).toBe(200);
      expect(viewerWatchlistDetail.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(viewerWatchlistDetail.watchlist.id).toBe(watchlistId);

      const viewerWatchlistUpdateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists/${watchlistId}`, {
        method: "PATCH",
        headers: { "x-user-email": "viewer@acme.com" },
        body: JSON.stringify({ organizationId, terms: ["viewer-mutated.example"] })
      }), options);
      expect(viewerWatchlistUpdateResponse.status).toBe(403);
      expect((await viewerWatchlistUpdateResponse.json() as any).visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect((store as any).getDwmWatchlist(watchlistId).terms[0].value).toBe("acme.com");

      const removedWatchlistDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists/${watchlistId}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "removed@acme.com" }
      }), options);
      expect(removedWatchlistDetailResponse.status).toBe(403);
      const removedWatchlistDetail = await removedWatchlistDetailResponse.json() as any;
      expect(removedWatchlistDetail.visibilityDecision).toMatchObject({ allowed: false, reason: "member_removed" });
      expect(removedWatchlistDetail.watchlist).toBeUndefined();

      const deactivatedWatchlistListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists?organizationId=${organizationId}`, {
        headers: { "x-user-email": "deactivated@acme.com" }
      }), options);
      expect(deactivatedWatchlistListResponse.status).toBe(403);
      const deactivatedWatchlistList = await deactivatedWatchlistListResponse.json() as any;
      expect(deactivatedWatchlistList.visibilityDecision).toMatchObject({ allowed: false, reason: "member_deactivated" });
      expect(deactivatedWatchlistList.watchlists).toBeUndefined();

      const outsiderWatchlistListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists?organizationId=${organizationId}`, {
        headers: { "x-user-email": "outsider@example.com" }
      }), options);
      expect(outsiderWatchlistListResponse.status).toBe(403);
      expect((await outsiderWatchlistListResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "not_member" });

      const restrictedViewerWatchlistListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists?organizationId=${restrictedOrganizationId}`, {
        headers: { "x-user-email": "viewer@restricted.example" }
      }), options);
      expect(restrictedViewerWatchlistListResponse.status).toBe(403);
      expect((await restrictedViewerWatchlistListResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "role_not_allowed", alertVisibilityPolicy: "admins" });

      const analystWatchlistUpdateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists/${watchlistId}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, name: "Case watchlist - monitored" })
      }), options);
      const analystWatchlistUpdate = await analystWatchlistUpdateResponse.json() as any;
      expect(analystWatchlistUpdateResponse.status).toBe(200);
      expect(analystWatchlistUpdate.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(analystWatchlistUpdate.watchlist.name).toBe("Case watchlist - monitored");

      const adminReadinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/generation-readiness?organizationId=${organizationId}`, {
        headers: { "x-user-email": "ir-lead@acme.com" }
      }), options);
      const adminReadiness = await adminReadinessResponse.json() as any;
      expect(adminReadinessResponse.status).toBe(200);
      expect(adminReadiness.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(adminReadiness.readiness).toMatchObject({
        schemaVersion: "dwm.alert_generation_readiness.v1",
        organizationId,
        readyForRebuild: true,
        readyForCustomerDelivery: true,
        counts: {
          activeWatchlists: 1,
          candidateCount: 1,
          duplicateCollapseCount: 0,
          blockedWatchlists: 0
        },
        webhookReadiness: {
          ready: true,
          routedCandidateCount: 1,
          webhookDestinationIds: [webhookPayload.destination.id]
        },
        caseReadiness: {
          ready: true,
          casePathTemplate: "/v1/cases/:caseId?alertId=:alertId&dedupeKey=:dedupeKey"
        },
        productDedupeBlocker: {
          blocked: false
        }
      });
      expect(adminReadiness.readiness.blockers).toEqual([]);
      expect(adminReadiness.readiness.plan.candidates[0]).toMatchObject({
        organizationId,
        normalizedTerm: "acme.com",
        watchlistIds: [watchlistId],
        webhookDestinationIds: [webhookPayload.destination.id],
        visibilityPolicy: "members"
      });
      expect((store as any).listDwmAlerts()).toHaveLength(0);

      const analystReadinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/generation-readiness?organizationId=${organizationId}`, {
        headers: { "x-actor-id": "analyst-1" }
      }), options);
      expect(analystReadinessResponse.status).toBe(200);
      expect((await analystReadinessResponse.json() as any).readiness.counts.candidateCount).toBe(1);

      const viewerReadinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/generation-readiness?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const viewerReadiness = await viewerReadinessResponse.json() as any;
      expect(viewerReadinessResponse.status).toBe(200);
      expect(viewerReadiness.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(viewerReadiness.readiness.counts).toMatchObject({ candidateCount: 1, activeWatchlists: 1 });

      const outsiderReadinessResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/generation-readiness?organizationId=${organizationId}`, {
        headers: { "x-user-email": "outsider@example.com" }
      }), options);
      const outsiderReadiness = await outsiderReadinessResponse.json() as any;
      expect(outsiderReadinessResponse.status).toBe(403);
      expect(outsiderReadiness.visibilityDecision).toMatchObject({ allowed: false, reason: "not_member" });
      expect(outsiderReadiness.readiness).toBeUndefined();
      expect(JSON.stringify(outsiderReadiness)).not.toContain("acme.com");

      const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId })
      }), options);
      const rebuildPayload = await rebuildResponse.json() as any;
      const alert = rebuildPayload.alerts[0];
      expect(rebuildPayload.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(alert.caseIdCandidate).toMatch(/^case_/);
      expect(alert.casePath).toContain(`/v1/cases/${alert.caseIdCandidate}`);
      expect(alert.workflowContext.caseIdCandidate).toBe(alert.caseIdCandidate);
      expect(alert.webhookContext.caseIdCandidate).toBe(alert.caseIdCandidate);

      const analystWatchlistDetailAfterRebuildResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists/${watchlistId}?organizationId=${organizationId}`, {
        headers: { "x-actor-id": "analyst-1" }
      }), options);
      const analystWatchlistDetailAfterRebuild = await analystWatchlistDetailAfterRebuildResponse.json() as any;
      expect(analystWatchlistDetailAfterRebuildResponse.status).toBe(200);
      expect(analystWatchlistDetailAfterRebuild.watchlist.workflowContext).toMatchObject({
        alertCount: 1,
        alertIds: [alert.id],
        caseIds: [alert.caseIdCandidate],
        activeForAlertGeneration: true
      });

      const viewerAlertListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const viewerAlertList = await viewerAlertListResponse.json() as any;
      expect(viewerAlertListResponse.status).toBe(200);
      expect(viewerAlertList.visibilityDecision).toMatchObject({ allowed: true, reason: null, alertVisibilityPolicy: "members" });
      expect(viewerAlertList.alerts).toHaveLength(1);

      const viewerAlertDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const viewerAlertDetail = await viewerAlertDetailResponse.json() as any;
      expect(viewerAlertDetailResponse.status).toBe(200);
      expect(viewerAlertDetail.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(viewerAlertDetail.alert.id).toBe(alert.id);

      const viewerAlertMutationResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "x-user-email": "viewer@acme.com" },
        body: JSON.stringify({ organizationId, reviewState: "reviewing", note: "Viewer must not mutate alert workflow." })
      }), options);
      expect(viewerAlertMutationResponse.status).toBe(403);
      expect((await viewerAlertMutationResponse.json() as any).visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect((store as any).getDwmAlert(alert.id).reviewState).not.toBe("reviewing");

      const viewerReplayResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}/replay`, {
        method: "POST",
        headers: { "x-user-email": "viewer@acme.com" },
        body: JSON.stringify({ organizationId })
      }), options);
      expect(viewerReplayResponse.status).toBe(403);
      expect((store as any).getDwmAlert(alert.id).replayCount ?? 0).toBe(0);

      const removedAlertDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "removed@acme.com" }
      }), options);
      expect(removedAlertDetailResponse.status).toBe(403);
      expect((await removedAlertDetailResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "member_removed" });

      const deactivatedAlertDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "deactivated@acme.com" }
      }), options);
      expect(deactivatedAlertDetailResponse.status).toBe(403);
      expect((await deactivatedAlertDetailResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "member_deactivated" });

      const outsiderAlertListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}`, {
        headers: { "x-user-email": "outsider@example.com" }
      }), options);
      expect(outsiderAlertListResponse.status).toBe(403);
      expect((await outsiderAlertListResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "not_member" });

      const restrictedViewerAlertListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${restrictedOrganizationId}`, {
        headers: { "x-user-email": "viewer@restricted.example" }
      }), options);
      expect(restrictedViewerAlertListResponse.status).toBe(403);
      expect((await restrictedViewerAlertListResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "role_not_allowed", alertVisibilityPolicy: "admins" });

      const analystAlertUpdateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, status: "triaged", assignedOwner: "analyst-1", severityOverride: "high", note: "Analyst confirmed alert evidence is relevant.", rationale: "Owned-domain evidence is relevant to the customer." })
      }), options);
      const analystAlertUpdate = await analystAlertUpdateResponse.json() as any;
      expect(analystAlertUpdateResponse.status).toBe(200);
      expect(analystAlertUpdate.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(analystAlertUpdate.alert.reviewState).toBe("reviewing");
      expect(analystAlertUpdate.alert.workflowStatus).toBe("triaged");
      expect(analystAlertUpdate.alert.assignedOwner).toBe("analyst-1");
      expect(analystAlertUpdate.alert.severityOverride).toBe("high");
      expect(analystAlertUpdate.alert.workflowSummary).toMatchObject({
        status: "triaged",
        assignedOwner: "analyst-1",
        severityOverride: "high",
        eventCount: 1,
        casePath: expect.stringContaining(`/v1/cases/${alert.caseIdCandidate}`)
      });

      const createCaseResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/cases", {
        method: "POST",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, alertId: alert.id, assignedOwner: "analyst-1", note: "Confirmed watched domain in public source evidence." })
      }), options);
      const createCasePayload = await createCaseResponse.json() as any;

      expect(createCaseResponse.status).toBe(201);
      expect(createCasePayload.case).toMatchObject({
        id: alert.caseIdCandidate,
        organizationId,
        tenantId: organizationId,
        alertId: alert.id,
        status: "open",
        assignedOwner: "analyst-1"
      });
      expect(createCasePayload.case.workflowEvents[0].note).toContain("Confirmed watched domain");
      expect((store as any).getDwmAlert(alert.id).caseId).toBe(createCasePayload.case.id);
      expect((store as any).getDwmAlert(alert.id).casePath).toContain(`/v1/cases/${createCasePayload.case.id}`);

      const invalidOwnerResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, action: "note", assignedOwner: "viewer-1", note: "Viewer should not own mutable response work." })
      }), options);
      expect(invalidOwnerResponse.status).toBe(400);
      expect((await invalidOwnerResponse.json() as any).error.code).toBe("invalid_case_owner_role");
      expect((store as any).getCase(createCasePayload.case.id).assignedOwner).toBe("analyst-1");

      const viewerDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const viewerDetail = await viewerDetailResponse.json() as any;
      expect(viewerDetailResponse.status).toBe(200);
      expect(viewerDetail.access).toMatchObject({
        role: "viewer",
        readOnly: true,
        visibilityDecision: {
          allowed: true,
          reason: null,
          alertVisibilityPolicy: "members",
          allowedRoles: expect.arrayContaining(["viewer", "analyst"])
        }
      });

      const viewerMutationResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}`, {
        method: "PATCH",
        headers: { "x-user-email": "viewer@acme.com" },
        body: JSON.stringify({ organizationId, action: "close", note: "Viewer can observe but cannot close this case." })
      }), options);
      expect(viewerMutationResponse.status).toBe(403);
      expect((await viewerMutationResponse.json() as any).error.code).toBe("case_read_only_member");
      expect((store as any).getCase(createCasePayload.case.id).status).toBe("open");

      const outsiderDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "outsider@example.com" }
      }), options);
      expect(outsiderDetailResponse.status).toBe(403);
      expect((await outsiderDetailResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "not_member" });

      const removedDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "removed@acme.com" }
      }), options);
      expect(removedDetailResponse.status).toBe(403);
      expect((await removedDetailResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "member_removed" });

      const deactivatedDetailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "deactivated@acme.com" }
      }), options);
      expect(deactivatedDetailResponse.status).toBe(403);
      expect((await deactivatedDetailResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "member_deactivated" });

      const restrictedViewerListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases?organizationId=${restrictedOrganizationId}&q=Restricted`, {
        headers: { "x-user-email": "viewer@restricted.example" }
      }), options);
      expect(restrictedViewerListResponse.status).toBe(403);
      expect((await restrictedViewerListResponse.json() as any).visibilityDecision).toMatchObject({
        allowed: false,
        reason: "role_not_allowed",
        alertVisibilityPolicy: "admins",
        allowedRoles: ["owner", "admin"]
      });

      const restrictedAdminListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases?organizationId=${restrictedOrganizationId}&q=Restricted`, {
        headers: { "x-user-email": "admin@restricted.example" }
      }), options);
      const restrictedAdminList = await restrictedAdminListResponse.json() as any;
      expect(restrictedAdminListResponse.status).toBe(200);
      expect(restrictedAdminList.items).toHaveLength(1);
      expect(restrictedAdminList.items[0].caseId).toBe("case_restricted_admin_only");

      const viewerDeliveryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
        method: "POST",
        headers: { "x-user-email": "viewer@acme.com" },
        body: JSON.stringify({ organizationId, alertId: alert.id })
      }), options);
      expect(viewerDeliveryResponse.status).toBe(403);
      expect((await viewerDeliveryResponse.json() as any).visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect((store as any).listDwmWebhookDeliveries()).toHaveLength(0);

      const deliveryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
        method: "POST",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, alertId: alert.id })
      }), options);
      const deliveryPayload = await deliveryResponse.json() as any;
      expect(deliveryResponse.status).toBe(200);
      expect(deliveryPayload.deliveries[0]).toMatchObject({
        alertId: alert.id,
        webhookDestinationId: webhookPayload.destination.id,
        deliveryKind: "discord",
        status: "delivered"
      });
      expect(seen[0].body.hanasand).toMatchObject({
        caseId: createCasePayload.case.id,
        caseIdCandidate: createCasePayload.case.id,
        casePath: expect.stringContaining(`/v1/cases/${createCasePayload.case.id}`),
        alertId: alert.id
      });
      expect(seen[0].headers.get("x-hanasand-event")).toBe("darkweb.monitoring.match");

      const escalateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-2" },
        body: JSON.stringify({ organizationId, action: "escalate", assignedOwner: "ir-lead", note: "Evidence affects owned domain and needs customer notification." })
      }), options);
      const escalated = await escalateResponse.json() as any;

      expect(escalateResponse.status).toBe(200);
      expect(escalated.case.status).toBe("escalated");
      expect(escalated.case.assignedOwner).toBe("ir-lead");
      expect(escalated.alert.reviewState).toBe("route_to_customer");

      const missingCloseRationale = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-2" },
        body: JSON.stringify({ organizationId, action: "close" })
      }), options);
      expect(missingCloseRationale.status).toBe(400);

      const closeResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${createCasePayload.case.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "ir-lead" },
        body: JSON.stringify({ organizationId, action: "close", note: "Customer notified outside webhook; no new evidence after review." })
      }), options);
      const closed = await closeResponse.json() as any;

      expect(closeResponse.status).toBe(200);
      expect(closed.case.status).toBe("closed");
      expect(closed.case.closedAt).toBeTruthy();
      expect(closed.alert.reviewState).toBe("resolved");

      const rebuildAfterCloseResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId })
      }), options);
      const rebuildAfterClose = await rebuildAfterCloseResponse.json() as any;
      expect(rebuildAfterClose.alerts[0]).toMatchObject({
        id: alert.id,
        caseId: closed.case.id,
        caseIdCandidate: closed.case.id,
        reviewState: "resolved"
      });
      expect(rebuildAfterClose.alerts[0].workflowEvents.length).toBeGreaterThanOrEqual(3);
      expect((store as any).getCase(closed.case.id).workflowEvents).toHaveLength(3);
      (store as any).saveDwmAlert({
        ...(store as any).getDwmAlert(alert.id),
        evidence: [
          ...((store as any).getDwmAlert(alert.id).evidence ?? []),
          {
            id: "evidence_raw_sensitive_case_secret",
            sourceId: source.id,
            sourceName: "Restricted raw capture",
            sourceFamily: "darkweb_metadata",
            observedAt: "2026-06-28T13:09:00.000Z",
            captureMode: "metadata_only",
            redactionState: "raw_sensitive",
            excerpt: "SECRET RAW PAYLOAD SHOULD NOT EXPORT",
            contentHash: "hash-sensitive-case-export",
            provenance: { captureId: "cap_sensitive_case_export", sourceId: source.id }
          }
        ]
      });

      const listResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const listPayload = await listResponse.json() as any;
      expect(listPayload.access).toMatchObject({ role: "viewer", readOnly: true });
      expect(listPayload.cases).toHaveLength(1);

      const detailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const detail = await detailResponse.json() as any;
      expect(detail.access).toMatchObject({ role: "viewer", readOnly: true });
      expect(detail.case.workflowEvents).toHaveLength(3);
      expect(detail.evidence[0]).toMatchObject({ sourceId: source.id, contentHash: "hash-case-acme" });
      expect(detail.alertContext).toMatchObject({
        caseIdCandidate: closed.case.id,
        casePath: expect.stringContaining(`/v1/cases/${closed.case.id}`),
        reviewState: "resolved"
      });
      expect(detail.alertContext.provenance.captureIds).toContain(capture.id);
      expect(detail.watchlists[0]).toMatchObject({
        organizationId,
        name: "Case watchlist - monitored",
        termCount: 1
      });
      expect(detail.watchlists[0].matchedTerms[0].value).toBe("acme.com");
      expect(detail.deliveryContext).toMatchObject({
        deliveryCount: 1,
        delivered: true,
        retryable: false
      });
      expect(detail.deliveryContext.latestDelivery).toMatchObject({ status: "delivered", webhookDestinationId: webhookPayload.destination.id });
      const createdEvent = detail.timeline.find((event: any) => event.eventType === "case.created");
      expect(createdEvent).toMatchObject({
        eventType: "case.created",
        source: "case",
        related: {
          caseId: closed.case.id,
          alertId: alert.id,
          dedupeKey: alert.dedupeKey
        }
      });
      expect(createdEvent.related.watchlistItemIds).toEqual(alert.workflowContext.watchlistItemIds);
      expect(detail.timeline.some((event: any) => event.eventType === "webhook.delivered" && event.related.webhookDeliveryId === deliveryPayload.deliveries[0].id)).toBe(true);
      expect(detail.nextAllowedActions.find((action: any) => action.id === "close")).toMatchObject({
        enabled: false,
        disabledReason: "read_only_member"
      });
      expect(detail.timeline.some((event: any) => event.title === "close")).toBe(true);
      expect(detail.nextActions).toContain("Keep closed unless new evidence changes the decision.");

      const filteredCases = async (query: string, userEmail = "viewer@acme.com") => {
        const response = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases?organizationId=${organizationId}&${query}`, {
          headers: { "x-user-email": userEmail }
        }), options);
        return { response, payload: await response.json() as any };
      };
      const filterExpectations = [
        "status=closed",
        "assignee=ir-lead",
        `severity=${encodeURIComponent(alert.severity)}`,
        `route=${encodeURIComponent(alert.recommendedRoute)}`,
        `watchlistItemId=${encodeURIComponent(alert.workflowContext.watchlistItemIds[0])}`,
        `alertId=${encodeURIComponent(alert.id)}`,
        `dedupeKey=${encodeURIComponent(alert.dedupeKey)}`,
        `webhookDeliveryId=${encodeURIComponent(deliveryPayload.deliveries[0].id)}`,
        "webhookStatus=delivered",
        `from=${encodeURIComponent("2026-01-01T00:00:00.000Z")}&to=${encodeURIComponent("2027-01-01T00:00:00.000Z")}`,
        `q=${encodeURIComponent("Okta session cookie")}`
      ];
      for (const query of filterExpectations) {
        const { response, payload } = await filteredCases(query);
        expect(response.status).toBe(200);
        expect(payload.filters).toBeTruthy();
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0]).toMatchObject({
          caseId: closed.case.id,
          alertId: alert.id,
          dedupeKey: alert.dedupeKey,
          recommendedRoute: alert.recommendedRoute,
          webhookDeliveryIds: [deliveryPayload.deliveries[0].id],
          webhookStatuses: ["delivered"]
        });
        expect(payload.items[0].timeline.some((event: any) => event.eventType === "webhook.delivered")).toBe(true);
      }
      const noLeak = await filteredCases(`q=${encodeURIComponent("Globex")}`);
      expect(noLeak.response.status).toBe(200);
      expect(noLeak.payload.items).toHaveLength(0);
      expect(noLeak.payload.cases).toHaveLength(0);
      const unauthorizedFiltered = await filteredCases(`q=${encodeURIComponent("Okta")}`, "outsider@example.com");
      expect(unauthorizedFiltered.response.status).toBe(403);

      const viewerExportResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}/export?organizationId=${organizationId}`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const viewerExport = await viewerExportResponse.json() as any;
      expect(viewerExportResponse.status).toBe(200);
      expect(viewerExport).toMatchObject({
        schemaVersion: "analyst.case_export.v1",
        access: {
          role: "viewer",
          readOnly: true,
          visibilityDecision: { allowed: true, reason: null, alertVisibilityPolicy: "members" }
        },
        summary: {
          caseId: closed.case.id,
          alertId: alert.id,
          dedupeKey: alert.dedupeKey,
          deliveryCount: 1,
          delivered: true
        },
        auditSafety: {
          rawSensitiveEvidenceIncluded: false,
          redactedEvidenceCount: 1
        }
      });
      expect(viewerExport.exportChecksum).toMatch(/^case_export_/);
      expect(viewerExport.matchedWatchlistTerms[0]).toMatchObject({ value: "acme.com", watchlistId: expect.any(String) });
      expect(viewerExport.deliveryEvidence[0]).toMatchObject({
        deliveryId: deliveryPayload.deliveries[0].id,
        status: "delivered",
        webhookDestinationId: webhookPayload.destination.id,
        alertId: alert.id
      });
      expect(viewerExport.evidence.find((item: any) => item.id === "evidence_raw_sensitive_case_secret")).toMatchObject({
        excerpt: "[redacted: raw sensitive evidence withheld]",
        safeToCopy: false,
        redaction: {
          redacted: true,
          rawIncluded: false
        }
      });
      expect(JSON.stringify(viewerExport)).not.toContain("SECRET RAW PAYLOAD SHOULD NOT EXPORT");
      expect(viewerExport.nextAllowedActions.some((action: any) => action.request)).toBe(false);
      expect(viewerExport.copyText).toContain(closed.case.id);
      expect(viewerExport.copyText).toContain(deliveryPayload.deliveries[0].id);

      const adminExportResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}/export?organizationId=${organizationId}`, {
        headers: { "x-user-email": "ir-lead@acme.com" }
      }), options);
      const adminExport = await adminExportResponse.json() as any;
      expect(adminExportResponse.status).toBe(200);
      expect(adminExport.access).toMatchObject({ role: "admin", readOnly: false });
      expect(adminExport.nextAllowedActions.find((action: any) => action.id === "reopen").request).toMatchObject({
        method: "PATCH",
        path: `/v1/cases/${closed.case.id}`,
        body: { action: "reopen", organizationId }
      });

      const compactExportResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}/export?organizationId=${organizationId}&shape=compact`, {
        headers: { "x-user-email": "viewer@acme.com" }
      }), options);
      const compactExport = await compactExportResponse.json() as any;
      expect(compactExportResponse.status).toBe(200);
      expect(compactExport.exportOptions).toMatchObject({ shape: "compact", includeTimeline: false });
      expect(compactExport.timeline).toBeUndefined();
      expect(compactExport.evidenceSummary).toHaveLength(2);

      const outsiderExportResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}/export?organizationId=${organizationId}`, {
        headers: { "x-user-email": "outsider@example.com" }
      }), options);
      expect(outsiderExportResponse.status).toBe(403);
      expect((await outsiderExportResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "not_member" });

      const removedExportResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}/export?organizationId=${organizationId}`, {
        headers: { "x-user-email": "removed@acme.com" }
      }), options);
      expect(removedExportResponse.status).toBe(403);
      expect((await removedExportResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "member_removed" });

      const deactivatedExportResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}/export?organizationId=${organizationId}`, {
        headers: { "x-user-email": "deactivated@acme.com" }
      }), options);
      expect(deactivatedExportResponse.status).toBe(403);
      expect((await deactivatedExportResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "member_deactivated" });

      const restrictedViewerExportResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/case_restricted_admin_only/export?organizationId=${restrictedOrganizationId}`, {
        headers: { "x-user-email": "viewer@restricted.example" }
      }), options);
      expect(restrictedViewerExportResponse.status).toBe(403);
      expect((await restrictedViewerExportResponse.json() as any).visibilityDecision).toMatchObject({ allowed: false, reason: "role_not_allowed" });

      const reopenResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, action: "reopen", note: "New related activity appeared; reopen for another look." })
      }), options);
      const reopened = await reopenResponse.json() as any;
      expect(reopenResponse.status).toBe(200);
      expect(reopened.case.status).toBe("open");
      expect(reopened.case.closedAt).toBeUndefined();
      expect(reopened.alert.reviewState).toBe("reviewing");

      const missingSuppressRationale = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, action: "suppress" })
      }), options);
      expect(missingSuppressRationale.status).toBe(400);

      const outsiderUpdateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}`, {
        method: "PATCH",
        headers: { "x-user-email": "outsider@example.com" },
        body: JSON.stringify({ organizationId, action: "suppress", note: "Outsider should not mutate org cases." })
      }), options);
      expect(outsiderUpdateResponse.status).toBe(403);
      expect((store as any).getCase(closed.case.id).status).toBe("open");

      const suppressResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}`, {
        method: "PATCH",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, action: "suppress", note: "Duplicate of the same public post; suppress until new evidence lands." })
      }), options);
      const suppressed = await suppressResponse.json() as any;
      expect(suppressResponse.status).toBe(200);
      expect(suppressed.case.status).toBe("suppressed");
      expect(suppressed.alert.reviewState).toBe("false_positive_candidate");
      expect(suppressed.alert.deliveryState).toBe("muted");

      const viewerDisableWatchlistResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists/${watchlistId}/disable`, {
        method: "POST",
        headers: { "x-user-email": "viewer@acme.com" },
        body: JSON.stringify({ organizationId })
      }), options);
      expect(viewerDisableWatchlistResponse.status).toBe(403);
      expect((store as any).getDwmWatchlist(watchlistId).status).toBe("active");

      const analystDisableWatchlistResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/watchlists/${watchlistId}/disable`, {
        method: "POST",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId })
      }), options);
      const analystDisableWatchlist = await analystDisableWatchlistResponse.json() as any;
      expect(analystDisableWatchlistResponse.status).toBe(200);
      expect(analystDisableWatchlist.visibilityDecision).toMatchObject({ allowed: true, reason: null });
      expect(analystDisableWatchlist.watchlist).toMatchObject({
        id: watchlistId,
        status: "paused",
        workflowContext: { activeForAlertGeneration: false }
      });

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      expect((rehydrated as any).listCases()).toHaveLength(3);
      expect((rehydrated as any).getCase(closed.case.id).status).toBe("suppressed");
      expect((rehydrated as any).getCase(closed.case.id).workflowEvents).toHaveLength(5);
      expect((rehydrated as any).getDwmAlert(alert.id).caseId).toBe(closed.case.id);
      expect((rehydrated as any).getDwmAlert(alert.id).caseIdCandidate).toBe(closed.case.id);
      expect((rehydrated as any).getDwmWatchlist(watchlistId).status).toBe("paused");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
