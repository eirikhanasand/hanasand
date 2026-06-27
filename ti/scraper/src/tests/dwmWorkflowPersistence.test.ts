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
      expect((rehydrated as any).listDwmAlerts()).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
