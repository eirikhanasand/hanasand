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

      const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/webhooks`, {
        method: "POST",
        body: JSON.stringify({ name: "Case Discord", url: "https://discord.com/api/webhooks/case/token" })
      }), options);
      const webhookPayload = await webhookResponse.json() as any;

      await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        body: JSON.stringify({ organizationId, name: "Case watchlist", terms: ["acme.com"], webhookDestinationId: webhookPayload.destination.id })
      }), options);
      const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        body: JSON.stringify({ organizationId })
      }), options);
      const rebuildPayload = await rebuildResponse.json() as any;
      const alert = rebuildPayload.alerts[0];
      expect(alert.caseIdCandidate).toMatch(/^case_/);
      expect(alert.casePath).toContain(`/v1/cases/${alert.caseIdCandidate}`);
      expect(alert.workflowContext.caseIdCandidate).toBe(alert.caseIdCandidate);
      expect(alert.webhookContext.caseIdCandidate).toBe(alert.caseIdCandidate);

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

      const deliveryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
        method: "POST",
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
      expect((store as any).listCases()[0].workflowEvents).toHaveLength(3);

      const listResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases?organizationId=${organizationId}`), options);
      const listPayload = await listResponse.json() as any;
      expect(listPayload.cases).toHaveLength(1);

      const detailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}?organizationId=${organizationId}`), options);
      const detail = await detailResponse.json() as any;
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
        name: "Case watchlist",
        termCount: 1
      });
      expect(detail.watchlists[0].matchedTerms[0].value).toBe("acme.com");
      expect(detail.deliveryContext).toMatchObject({
        deliveryCount: 1,
        delivered: true,
        retryable: false
      });
      expect(detail.deliveryContext.latestDelivery).toMatchObject({ status: "delivered", webhookDestinationId: webhookPayload.destination.id });
      expect(detail.timeline.some((event: any) => event.title === "close")).toBe(true);
      expect(detail.nextActions).toContain("Keep closed unless new evidence changes the decision.");

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
        body: JSON.stringify({ organizationId, action: "suppress" })
      }), options);
      expect(missingSuppressRationale.status).toBe(400);

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

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      expect((rehydrated as any).listCases()).toHaveLength(1);
      expect((rehydrated as any).listCases()[0].status).toBe("suppressed");
      expect((rehydrated as any).listCases()[0].workflowEvents).toHaveLength(5);
      expect((rehydrated as any).getDwmAlert(alert.id).caseId).toBe(closed.case.id);
      expect((rehydrated as any).getDwmAlert(alert.id).caseIdCandidate).toBe(closed.case.id);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
