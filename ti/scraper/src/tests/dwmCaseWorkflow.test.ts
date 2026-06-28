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
      const options = { store, frontier: new FocusedFrontier() };

      const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name: "Acme Case Team", ownerEmail: "owner@acme.com" })
      }), options);
      const orgPayload = await orgResponse.json() as any;
      const organizationId = orgPayload.organization.id;

      await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        body: JSON.stringify({ organizationId, name: "Case watchlist", terms: ["acme.com"] })
      }), options);
      const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        body: JSON.stringify({ organizationId })
      }), options);
      const rebuildPayload = await rebuildResponse.json() as any;
      const alert = rebuildPayload.alerts[0];

      const createCaseResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/cases", {
        method: "POST",
        headers: { "x-actor-id": "analyst-1" },
        body: JSON.stringify({ organizationId, alertId: alert.id, assignedOwner: "analyst-1", note: "Confirmed watched domain in public source evidence." })
      }), options);
      const createCasePayload = await createCaseResponse.json() as any;

      expect(createCaseResponse.status).toBe(201);
      expect(createCasePayload.case).toMatchObject({
        organizationId,
        tenantId: organizationId,
        alertId: alert.id,
        status: "open",
        assignedOwner: "analyst-1"
      });
      expect(createCasePayload.case.workflowEvents[0].note).toContain("Confirmed watched domain");
      expect((store as any).getDwmAlert(alert.id).caseId).toBe(createCasePayload.case.id);

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

      const listResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases?organizationId=${organizationId}`), options);
      const listPayload = await listResponse.json() as any;
      expect(listPayload.cases).toHaveLength(1);

      const detailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${closed.case.id}?organizationId=${organizationId}`), options);
      const detail = await detailResponse.json() as any;
      expect(detail.case.workflowEvents).toHaveLength(3);
      expect(detail.evidence[0]).toMatchObject({ sourceId: source.id, contentHash: "hash-case-acme" });
      expect(detail.timeline.some((event: any) => event.title === "close")).toBe(true);
      expect(detail.nextActions).toContain("Keep closed unless new evidence changes the decision.");

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      expect((rehydrated as any).listCases()).toHaveLength(1);
      expect((rehydrated as any).listCases()[0].status).toBe("closed");
      expect((rehydrated as any).getDwmAlert(alert.id).caseId).toBe(closed.case.id);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
