import type { FocusedFrontier } from "../src/frontier/frontier.ts";
import type { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { CollectionRun } from "../src/types.ts";
import { analystFixtures } from "./routeInventoryAnalystFixtures.ts";
import { captureFor, pipelineResultFromCapture, source } from "./routeInventorySourceFixtures.ts";

export function seedStore(store: InMemoryScraperStore, frontier: FocusedFrontier): void {
  const now = "2026-05-24T04:44:32.036Z";
  const publicSource = source("src_public", "rss", "https://inventory.example.test/feed.xml");
  const publicChannel = source("src_public_channel", "telegram_public", "https://t.me/public_inventory");
  const restricted = source("src_restricted", "tor_metadata", "https://restricted.example.test", "restricted", "approved_proxy");
  store.saveSource(publicSource);
  store.saveSource(publicChannel);
  store.saveSource(restricted);

  const capture = captureFor({ id: "cap_inventory_apt29", sourceId: publicSource.id, taskId: "task_inventory_apt29", url: "https://inventory.example.test/apt29", body: "APT29 used phishing and credential dumping against Northwind Health in healthcare.", collectedAt: now, metadata: { title: "APT29 inventory proof", evidenceStage: "reviewed_promoted", graphReviewState: "accepted" } });
  store.savePipelineResult(pipelineResultFromCapture(capture));
  store.saveCapture(captureFor({ id: "cap_public_channel_apt29", sourceId: publicChannel.id, taskId: "task_public_channel_apt29", url: "https://t.me/public_inventory/1", body: "Public channel summary: APT29 phishing activity observed.", collectedAt: now, metadata: { adapter: "telegram_public", channel: "public_inventory", evidenceStage: "public_channel_message", title: "APT29 public channel proof" } }));
  store.saveRun(run(now));
  seedAnalystLoop(store);
  frontier.add({ source: publicSource, tenantId: "tenant_inventory", intelRequestId: "request_inventory", url: "https://inventory.example.test/frontier", discoveredAt: now, anchorText: "APT29 route inventory proof", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
}

function seedAnalystLoop(store: InMemoryScraperStore): void {
  const { reviewTask, activationPacket, notificationPacket, claimLedgerEntry, snapshot } = analystFixtures();
  store.saveAnalystMetadataReviewTask(reviewTask);
  store.saveAnalystSourceActivationPacket(activationPacket);
  store.saveAnalystVictimNotificationPacket(notificationPacket);
  store.saveAnalystClaimLedgerEntry(claimLedgerEntry);
  store.saveAnalystLoopSnapshot(snapshot);
}

function run(now: string): CollectionRun {
  return { id: "run_inventory", planId: "plan_inventory", requestId: "request_inventory", status: "completed", createdAt: now, updatedAt: now, taskCount: 1, reviewTaskCount: 0, rejectedSourceCount: 0, captureCount: 1, incidentCount: 1 };
}
