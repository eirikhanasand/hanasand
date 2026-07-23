import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportOrganizationPrivacyData, purgeOrganizationPrivacyData } from "../api/organizationPrivacyRoutes.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { FileObjectEvidenceStore } from "../storage/fileObjectStore.ts";
import { InMemoryObjectEvidenceStore } from "../storage/memoryObjectEvidenceStore.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("organization retention and privacy lifecycle", () => {
  test("isolates tenants, preserves holds, retries partial failures, and exports retained data", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({ id: "org_a", tenantId: "org_a", name: "A", status: "active" });
    store.saveOrganization({ id: "org_b", tenantId: "org_b", name: "B", status: "active" });
    store.saveOrganizationMember({ id: "member_removed", organizationId: "org_a", status: "removed", joinedAt: "2026-01-01T00:00:00.000Z", removedAt: "2020-01-01T00:00:00.000Z" });
    store.saveOrganizationMember({ id: "member_active", organizationId: "org_a", status: "active", joinedAt: "2020-01-01T00:00:00.000Z" });
    store.saveOrganizationInvite({ id: "invite_revoked", organizationId: "org_a", status: "revoked", createdAt: "2026-01-01T00:00:00.000Z", revokedAt: "2020-01-01T00:00:00.000Z" });
    store.saveCapture(fixtureCapture({
      id: "capture_retry", tenantId: "org_a", collectedAt: "2020-01-01T00:00:00.000Z",
      body: "", storageKind: "external_object",
      objectRef: { bucket: "evidence", key: "org_a/retry", sizeBytes: 10, sha256: "retry_hash" },
    }));
    store.saveCapture(fixtureCapture({ id: "capture_hold", tenantId: "org_a", collectedAt: "2020-01-01T00:00:00.000Z", body: "held secret", retentionClass: "legal_hold" }));
    store.saveCapture(fixtureCapture({ id: "capture_claim_hold", tenantId: "org_a", collectedAt: "2020-01-01T00:00:00.000Z", body: "claim-held secret" }));
    store.saveCapture(fixtureCapture({ id: "capture_other", tenantId: "org_b", collectedAt: "2020-01-01T00:00:00.000Z", body: "other tenant secret" }));
    store.saveCapture(fixtureCapture({ id: "capture_conflicting_scope", tenantId: "org_b", organizationId: "org_a", collectedAt: "2020-01-01T00:00:00.000Z", body: "conflicting scope secret" } as any));
    store.saveIntelligenceClaim({ id: "claim_hold", tenantId: "org_a", legalHold: true, captureIds: ["capture_claim_hold"] });
    store.saveDwmWatchlist({ id: "watchlist_hold", tenantId: "org_a", organizationId: "org_a", status: "archived", updatedAt: "2020-01-01T00:00:00.000Z" });
    store.saveDwmWatchlist({ id: "watchlist_old", tenantId: "org_a", organizationId: "org_a", status: "archived", updatedAt: "2020-01-01T00:00:00.000Z" });
    store.saveDwmAlert({ id: "alert_hold", tenantId: "org_a", captureIds: ["capture_hold"], watchlistIds: ["watchlist_hold"], createdAt: "2020-01-01T00:00:00.000Z" });
    store.saveDwmWebhookDelivery({ id: "delivery_old", tenantId: "org_a", alertId: "alert_old", payload: { secret: "redact me" }, status: "failed", attemptedAt: "2020-01-01T00:00:00.000Z" });
    store.saveDwmWebhookDelivery({ id: "delivery_hold", tenantId: "org_a", alertId: "alert_hold", payload: { secret: "hold me" }, status: "failed", attemptedAt: "2020-01-01T00:00:00.000Z" });
    store.saveDwmWebhookDelivery({ id: "delivery_other", tenantId: "org_b", alertId: "alert_other", payload: { secret: "other tenant" }, status: "failed", attemptedAt: "2020-01-01T00:00:00.000Z" });

    let objectFailure = true;
    const options: any = {
      store,
      frontier: new FocusedFrontier(),
      objectStore: { deleteObject: () => { if (objectFailure) throw new Error("object store unavailable"); return true; } },
    };
    const input = { organizationId: "org_a", cutoffAt: "2025-01-01T00:00:00.000Z", mode: "scheduled" as const, limit: 100, runId: "run_retry" };

    const first = await purgeOrganizationPrivacyData(options, input);
    expect(first.failed).toEqual([expect.objectContaining({ recordId: "capture_retry", status: "failed" })]);
    expect(store.getCapture("capture_hold")?.body).toBe("held secret");
    expect(store.getCapture("capture_claim_hold")?.body).toBe("claim-held secret");
    expect(store.getDwmWatchlist("watchlist_hold")).toBeDefined();
    expect(store.getDwmWatchlist("watchlist_old")).toBeUndefined();
    expect(store.getDwmWebhookDelivery("delivery_old")?.payload).toBeUndefined();
    expect(store.getDwmWebhookDelivery("delivery_hold")?.payload).toEqual({ secret: "hold me" });
    expect(store.getCapture("capture_other")?.body).toBe("other tenant secret");
    expect(store.getCapture("capture_conflicting_scope")?.body).toBe("conflicting scope secret");
    expect(store.getDwmWebhookDelivery("delivery_other")?.payload).toEqual({ secret: "other tenant" });
    expect(store.getOrganizationMember("member_removed")).toBeUndefined();
    expect(store.getOrganizationMember("member_active")).toBeDefined();
    expect(store.getOrganizationInvite("invite_revoked")).toBeUndefined();

    objectFailure = false;
    const retry = await purgeOrganizationPrivacyData(options, input);
    expect(retry.failed).toEqual([]);
    expect(retry.hasMore).toBe(false);
    expect(store.getCapture("capture_retry")?.objectRef).toBeUndefined();
    expect(retry.completed).toEqual(expect.arrayContaining([expect.objectContaining({ recordId: "capture_retry", status: "redacted" })]));

    const rerun = await purgeOrganizationPrivacyData(options, input);
    expect(rerun.selected).toBe(0);
    expect(rerun.hasMore).toBe(false);
    expect(store.getCapture("capture_other")?.body).toBe("other tenant secret");

    const exported = await exportOrganizationPrivacyData(options, "org_a");
    expect(exported.organizationId).toBe("org_a");
    expect(exported.protection).toMatchObject({ heldClaimIds: ["claim_hold"] });
    expect(JSON.stringify(exported)).not.toContain("held secret");
    expect(JSON.stringify(exported)).not.toContain("claim-held secret");
    expect(JSON.stringify(exported)).not.toContain("other tenant secret");
    expect(JSON.stringify(exported)).not.toContain("conflicting scope secret");
  });

  test("requires confirmed object deletion while allowing idempotent retries in the owning bucket", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({ id: "org_object", tenantId: "org_object", name: "Object", status: "active" });
    store.saveCapture(fixtureCapture({
      id: "capture_object", tenantId: "org_object", collectedAt: "2020-01-01T00:00:00.000Z", body: undefined, storageKind: "external_object",
      objectRef: { bucket: "memory-evidence", key: "org/object", sizeBytes: 10, sha256: "object_hash" }
    }));
    const input = { organizationId: "org_object", cutoffAt: "2025-01-01T00:00:00.000Z", mode: "scheduled" as const, limit: 100, runId: "run_object" };
    const refused = await purgeOrganizationPrivacyData({ store, objectStore: { deleteObject: () => false } } as any, input);
    expect(refused.failed).toEqual([expect.objectContaining({ recordId: "capture_object", status: "failed" })]);
    expect(store.getCapture("capture_object")?.objectRef).toBeDefined();

    const memoryObjects = new InMemoryObjectEvidenceStore();
    const memoryRef = memoryObjects.putObject({ tenantId: "org_object", sourceId: "source", captureId: "capture", mediaType: "text/plain", body: "payload", contentHash: "hash", retentionClass: "standard" }).ref;
    expect(memoryObjects.deleteObject(memoryRef, "first")).toBe(true);
    expect(memoryObjects.deleteObject(memoryRef, "retry")).toBe(true);
    expect(() => memoryObjects.deleteObject({ ...memoryRef, bucket: "foreign" }, "wrong bucket")).toThrow("different evidence bucket");

    const directory = mkdtempSync(join(tmpdir(), "org-retention-objects-"));
    try {
      const fileObjects = new FileObjectEvidenceStore({ rootDir: directory, bucket: "file-evidence" });
      const fileRef = fileObjects.putObject({ tenantId: "org_object", sourceId: "source", captureId: "capture", mediaType: "text/plain", body: "payload", contentHash: "hash", retentionClass: "standard" }).ref;
      expect(fileObjects.deleteObject(fileRef, "first")).toBe(true);
      expect(fileObjects.deleteObject(fileRef, "retry")).toBe(true);
      expect(() => fileObjects.deleteObject({ ...fileRef, bucket: "foreign" }, "wrong bucket")).toThrow("different evidence bucket");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("hydrates completed redactions and workflow deletions after restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "org-retention-restart-"));
    const snapshotPath = join(directory, "store.json");
    try {
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveOrganization({ id: "org_restart", tenantId: "org_restart", name: "Restart", status: "active" });
      store.saveCapture(fixtureCapture({ id: "capture_restart", tenantId: "org_restart", collectedAt: "2020-01-01T00:00:00.000Z", body: "remove after restart" }));
      store.saveDwmWatchlist({ id: "watchlist_restart", tenantId: "org_restart", organizationId: "org_restart", status: "archived", updatedAt: "2020-01-01T00:00:00.000Z" });
      await purgeOrganizationPrivacyData({ store, frontier: new FocusedFrontier() } as any, {
        organizationId: "org_restart", cutoffAt: "2025-01-01T00:00:00.000Z", mode: "scheduled", limit: 100, runId: "run_restart"
      });

      const hydrated = new FileBackedScraperStore({ snapshotPath });
      expect(hydrated.getCapture("capture_restart")?.body).toBeUndefined();
      expect(hydrated.getCapture("capture_restart")?.metadata?.retentionAudit).toEqual([expect.objectContaining({ runId: "run_restart" })]);
      expect(hydrated.getDwmWatchlist("watchlist_restart")).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("requires authentication on the organization privacy route", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({ id: "org_auth", tenantId: "org_auth", name: "Auth", status: "active" });
    const options: any = { store, frontier: new FocusedFrontier(), serviceToken: "privacy-service-token" };
    const denied = await handleApiRequest(new Request("http://local/v1/organizations/org_auth/privacy"), options);
    expect(denied.status).toBe(401);
    const accepted = await handleApiRequest(new Request("http://local/v1/organizations/org_auth/privacy", { headers: { "x-hanasand-service-token": "privacy-service-token" } }), options);
    expect(accepted.status).toBe(200);
    expect((await accepted.json() as any).organizationId).toBe("org_auth");

    const configlessOptions: any = { store, frontier: new FocusedFrontier() };
    const configlessGet = await handleApiRequest(new Request("http://local/v1/organizations/org_auth/privacy"), configlessOptions);
    const configlessPost = await handleApiRequest(new Request("http://local/v1/organizations/org_auth/privacy", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "purge", runId: "configless", cutoffAt: "2025-01-01T00:00:00.000Z", mode: "deletion" })
    }), configlessOptions);
    expect(configlessGet.status).toBe(503);
    expect(configlessPost.status).toBe(503);
    expect(await configlessPost.json()).toEqual(await configlessGet.json());
  });

  test("preserves held evidence provenance across deletion and restart while blocking new writes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "org-retention-held-lineage-"));
    const snapshotPath = join(directory, "store.json");
    try {
      const store = new FileBackedScraperStore({ snapshotPath });
      const organizationId = "org_held_lineage";
      store.saveOrganization({ id: organizationId, tenantId: organizationId, name: "Held lineage", status: "active" });
      store.saveSource(source({ id: "source_held", tenantId: organizationId, name: "Held provenance source", url: "https://held-provenance.example/feed" }));
      store.saveSource(source({ id: "source_delete", tenantId: organizationId, name: "Disposable source", url: "https://delete.example/feed" }));
      store.saveCapture(fixtureCapture({ id: "capture_held_lineage", tenantId: organizationId, sourceId: "source_held", url: "https://held-provenance.example/item", body: "held evidence bytes", retentionClass: "legal_hold", collectedAt: "2020-01-01T00:00:00.000Z" }));
      store.saveCapture(fixtureCapture({ id: "capture_delete_lineage", tenantId: organizationId, sourceId: "source_delete", body: "delete evidence bytes", collectedAt: "2020-01-01T00:00:00.000Z" }));
      store.saveIntelligenceClaim({ id: "claim_held_lineage", tenantId: organizationId, sourceIds: ["source_held"], captureIds: ["capture_held_lineage"], legalHold: true, retentionClass: "legal_hold", summary: "held claim meaning" });
      store.saveClaimEvidence({ id: "claim_evidence_held_lineage", tenantId: organizationId, claimId: "claim_held_lineage", sourceId: "source_held", captureId: "capture_held_lineage", provenance: { sourceUrl: "https://held-provenance.example/feed", excerptHash: "held-byte-hash" }, createdAt: "2020-01-01T00:00:00.000Z" });

      const result = await purgeOrganizationPrivacyData({ store } as any, { organizationId, cutoffAt: "2025-01-01T00:00:00.000Z", mode: "deletion", limit: 100, runId: "run_held_lineage" });
      expect(result.failed).toEqual([]);
      expect(result.hasMore).toBe(false);

      const restarted = new FileBackedScraperStore({ snapshotPath });
      expect(restarted.getSource("source_held")).toMatchObject({ name: "Held provenance source", url: "https://held-provenance.example/feed", status: "active" });
      expect(restarted.getCapture("capture_held_lineage")).toMatchObject({ body: "held evidence bytes", sourceId: "source_held", url: "https://held-provenance.example/item" });
      expect(restarted.getClaimEvidence("claim_evidence_held_lineage")).toMatchObject({ provenance: { sourceUrl: "https://held-provenance.example/feed", excerptHash: "held-byte-hash" } });
      expect(restarted.getSource("source_delete")).toMatchObject({ name: "Deleted source", url: "privacy://deleted/source_delete" });
      expect(() => restarted.saveCapture(fixtureCapture({ id: "capture_race", tenantId: organizationId, sourceId: "source_held", body: "late write" }))).toThrow("writes are blocked");

      const blockedRoute = await handleApiRequest(new Request("http://local/v1/dwm/watchlists", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hanasand-service-token": "privacy-service", "x-organization-id": organizationId, "x-tenant-id": organizationId },
        body: JSON.stringify({ organizationId, tenantId: organizationId, name: "Late watchlist", terms: ["late"] })
      }), { store: restarted, frontier: new FocusedFrontier(), serviceToken: "privacy-service" } as any);
      expect(blockedRoute.status).toBe(409);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("paginates protected evidence before revoking access and writing the tombstone", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({ id: "org_protected_page", tenantId: "org_protected_page", name: "Protected page", status: "active" });
    store.saveOrganizationMember({ id: "member_protected_page", organizationId: "org_protected_page", userId: "owner", status: "active" });
    for (let index = 0; index < 105; index++) {
      store.saveCapture(fixtureCapture({ id: `capture_hold_${index}`, tenantId: "org_protected_page", collectedAt: "2020-01-01T00:00:00.000Z", body: `held ${index}`, retentionClass: "legal_hold" }));
    }
    const input = { organizationId: "org_protected_page", cutoffAt: "2025-01-01T00:00:00.000Z", mode: "deletion" as const, limit: 100, runId: "run_protected_page" };

    const first = await purgeOrganizationPrivacyData({ store } as any, input);
    expect(first.protected).toHaveLength(100);
    expect(first.hasMore).toBe(true);
    expect(store.getOrganizationMember("member_protected_page")).toBeDefined();
    expect(store.getOrganization("org_protected_page")).toMatchObject({ status: "suspended", privacyDeletionRunId: "run_protected_page" });

    const second = await purgeOrganizationPrivacyData({ store } as any, { ...input, protectedOffset: 100 });
    expect(second.protected).toHaveLength(100);
    expect(second.hasMore).toBe(true);
    expect(store.getOrganizationMember("member_protected_page")).toBeDefined();
    expect(store.getOrganization("org_protected_page")).toMatchObject({ status: "suspended", privacyDeletionRunId: "run_protected_page" });

    const third = await purgeOrganizationPrivacyData({ store } as any, { ...input, protectedOffset: 200 });
    expect(third.protected).toHaveLength(10);
    expect(third.hasMore).toBe(false);
    expect(store.getOrganizationMember("member_protected_page")).toBeUndefined();
    expect(store.getOrganization("org_protected_page")).toMatchObject({ status: "suspended", privacyDeletionRunId: "run_protected_page", privacyDeletedAt: expect.any(String) });
    expect(store.getCapture("capture_hold_104")?.body).toBe("held 104");
  });
});
