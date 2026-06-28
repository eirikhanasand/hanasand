import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_tg_workflow",
  name: "Workflow public Telegram",
  type: "telegram_public",
  url: "https://t.me/workflow_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.8,
  legalNotes: "Public preview only.",
  createdAt: "2026-06-27T21:00:00.000Z",
  updatedAt: "2026-06-27T21:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_workflow_acme",
  sourceId: source.id,
  url: "https://t.me/workflow_public/42",
  collectedAt: "2026-06-27T21:02:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-workflow-acme",
  sensitive: false,
  body: "acme.com mentioned in Lumma C2 public Telegram chatter with Okta session cookie and AWS IAM key hints.",
  metadata: { adapter: "telegram_public", channel: "workflow_public", messageId: 42 }
} as RawCapture;

const followupCapture: RawCapture = {
  id: "cap_workflow_acme_followup",
  sourceId: source.id,
  url: "https://t.me/workflow_public/43",
  collectedAt: "2026-06-27T21:07:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-workflow-acme-followup",
  sensitive: false,
  body: "Follow-up public Telegram post repeats acme.com Okta session cookie and AWS IAM key claims.",
  metadata: { adapter: "telegram_public", channel: "workflow_public", messageId: 43 }
} as RawCapture;

describe("dwm workflow persistence", () => {
  test("persists watchlists and saves rebuilt alerts from collected evidence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-workflow-"));
    try {
      const snapshotPath = join(dir, "store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(source);
      store.saveCapture(capture);

      const createResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        body: JSON.stringify({ tenantId: "tenant_acme", name: "Acme watch", terms: ["acme.com"], webhookUrl: "https://hooks.example.com/dwm" })
      }), { store, frontier: new FocusedFrontier() });
      expect(createResponse.status).toBe(201);

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      expect((rehydrated as any).listDwmWatchlists()).toHaveLength(1);

      const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        body: JSON.stringify({ tenantId: "tenant_acme" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const rebuild = await rebuildResponse.json() as any;

      expect(rebuildResponse.status).toBe(200);
      expect(rebuild.savedAlertCount).toBe(1);
      expect(rebuild.alerts[0].tenantId).toBe("tenant_acme");
      expect(rebuild.alerts[0].deliveryState).toBe("pending_review");
      expect(rebuild.alerts[0].dedupeKey).toBe(rebuild.alerts[0].webhookDelivery.dedupeKey);
      expect(rebuild.alerts[0].recommendedRoute).toBe("identity_response");
      expect(rebuild.alerts[0].confidenceReasoning.join(" ")).toContain("Final confidence");
      expect(rebuild.alerts[0].provenance.captureIds).toContain("cap_workflow_acme");
      expect((rehydrated as any).listDwmAlerts()).toHaveLength(1);

      const updateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${rebuild.alerts[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({ reviewState: "reviewing", deliveryState: "ready_to_send", note: "Confirmed customer domain match.", assignedOwner: "iris", actor: "analyst-1" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const update = await updateResponse.json() as any;

      expect(updateResponse.status).toBe(200);
      expect(update.alert.reviewState).toBe("reviewing");
      expect(update.alert.deliveryState).toBe("ready_to_send");
      expect(update.alert.workflowNote).toBe("Confirmed customer domain match.");
      expect(update.alert.assignedOwner).toBe("iris");
      expect(update.alert.workflowEvents).toHaveLength(1);
      expect(update.alert.workflowEvents[0]).toMatchObject({ toOwner: "iris" });

      const detailResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${rebuild.alerts[0].id}?tenantId=tenant_acme`), { store: rehydrated, frontier: new FocusedFrontier() });
      const detail = await detailResponse.json() as any;

      expect(detailResponse.status).toBe(200);
      expect(detail.alert.id).toBe(rebuild.alerts[0].id);
      expect(detail.evidenceReplay[0]).toMatchObject({ sourceName: "Workflow public Telegram", contentHash: "hash-workflow-acme" });
      expect(detail.timeline.length).toBeGreaterThanOrEqual(2);
      expect(detail.nextActions).toContain("Send the customer webhook.");

      const replayResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${rebuild.alerts[0].id}/replay`, {
        method: "POST",
        body: JSON.stringify({ actor: "analyst-1" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const replay = await replayResponse.json() as any;

      expect(replayResponse.status).toBe(200);
      expect(replay.alert.replayCount).toBe(1);
      expect(replay.alert.workflowEvents).toHaveLength(2);

      rehydrated.saveCapture(followupCapture);

      const secondRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        body: JSON.stringify({ tenantId: "tenant_acme" })
      }), { store: rehydrated, frontier: new FocusedFrontier() });
      const secondRebuild = await secondRebuildResponse.json() as any;

      expect(secondRebuildResponse.status).toBe(200);
      expect(secondRebuild.alerts[0].reviewState).toBe("reviewing");
      expect(secondRebuild.alerts[0].deliveryState).toBe("ready_to_send");
      expect(secondRebuild.alerts[0].assignedOwner).toBe("iris");
      expect(secondRebuild.alerts[0].workflowEvents).toHaveLength(2);
      expect(secondRebuild.alerts[0].replayCount).toBe(1);
      expect(secondRebuild.alerts[0].sourceCount).toBe(2);
      expect(secondRebuild.alerts[0].evidenceSummary.evidenceCount).toBe(2);
      expect(secondRebuild.alerts[0].workflowContext.evidenceCount).toBe(2);
      expect(secondRebuild.alerts[0].evidence.map((item: any) => item.id)).toContain("cap_workflow_acme_followup");
      expect(secondRebuild.alerts[0].provenance.captureIds).toContain("cap_workflow_acme_followup");
      expect(secondRebuild.alerts[0].dedupeKey).toBe(rebuild.alerts[0].dedupeKey);

      const finalStore = new FileBackedScraperStore({ snapshotPath });
      expect((finalStore as any).listDwmAlerts()[0].workflowEvents).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
