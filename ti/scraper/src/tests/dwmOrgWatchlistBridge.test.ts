import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { orgWatchlistContractToRuntimeDwmWatchlists } from "../storage/dwmOrgWatchlistBridge.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const telegramSource: SourceRecord = {
  id: "src_org_bridge_tg",
  name: "Org bridge public Telegram",
  type: "telegram_public",
  url: "https://t.me/org_bridge",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.84,
  legalNotes: "Public channel preview only.",
  createdAt: "2026-06-28T18:00:00.000Z",
  updatedAt: "2026-06-28T18:00:00.000Z"
} as SourceRecord;

const darkwebSource: SourceRecord = {
  id: "src_org_bridge_onion",
  name: "Org bridge onion metadata",
  type: "tor_metadata",
  url: "http://org-bridge.example.onion",
  accessMethod: "approved_proxy",
  status: "active",
  trustScore: 0.79,
  legalNotes: "Metadata-only onion collection.",
  createdAt: "2026-06-28T18:00:00.000Z",
  updatedAt: "2026-06-28T18:00:00.000Z"
} as SourceRecord;

const actorPageSource: SourceRecord = {
  id: "src_org_bridge_actor_page",
  name: "Org bridge actor-page metadata",
  type: "actor_page",
  url: "https://intel.example/actors/akira",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.76,
  legalNotes: "Actor-page metadata only.",
  createdAt: "2026-06-28T18:00:00.000Z",
  updatedAt: "2026-06-28T18:00:00.000Z"
} as SourceRecord;

const telegramCapture: RawCapture = {
  id: "cap_org_bridge_tg_acme",
  sourceId: telegramSource.id,
  url: "https://t.me/org_bridge/7",
  collectedAt: "2026-06-28T18:05:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-org-bridge-tg-acme",
  sensitive: false,
  body: "acme.com appears in Lumma C2 Telegram chatter with Okta live cookie and AWS IAM key exposure.",
  metadata: { adapter: "telegram_public", channel: "org_bridge", messageId: 7 }
} as RawCapture;

const duplicateTelegramCapture: RawCapture = {
  ...telegramCapture,
  id: "cap_org_bridge_tg_acme_duplicate",
  url: "https://t.me/org_bridge/7?mirror=1"
} as RawCapture;

const darkwebCapture: RawCapture = {
  id: "cap_org_bridge_onion_acme",
  sourceId: darkwebSource.id,
  url: "http://org-bridge.example.onion/acme",
  collectedAt: "2026-06-28T18:08:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-org-bridge-onion-acme",
  sensitive: true,
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Metadata-only onion actor page claims acme.com procurement files.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

const actorPageCapture: RawCapture = {
  id: "cap_org_bridge_actor_page_acme",
  sourceId: actorPageSource.id,
  url: "https://intel.example/actors/akira#acme",
  collectedAt: "2026-06-28T18:12:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-org-bridge-actor-page-acme",
  sensitive: false,
  body: "Actor-page metadata for Akira lists acme.com as a claimed victim and supplier contract target.",
  metadata: { adapter: "actor_page", actorName: "Akira", captureMode: "metadata_only" }
} as RawCapture;

const nonmatchCapture: RawCapture = {
  id: "cap_org_bridge_nonmatch",
  sourceId: telegramSource.id,
  url: "https://t.me/org_bridge/8",
  collectedAt: "2026-06-28T18:15:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-org-bridge-nonmatch",
  sensitive: false,
  body: "Unrelated public Telegram chatter mentions example.net and generic markets.",
  metadata: { adapter: "telegram_public", channel: "org_bridge", messageId: 8 }
} as RawCapture;

describe("DWM org watchlist bridge", () => {
  test("generates member-visible org alerts from shared watchlist contract rows without leaking paused or archived rows", async () => {
    const store = new InMemoryScraperStore();
    for (const source of [telegramSource, darkwebSource, actorPageSource]) store.saveSource(source);
    for (const capture of [telegramCapture, darkwebCapture, actorPageCapture, nonmatchCapture]) store.saveCapture(capture);
    const options = { store, frontier: new FocusedFrontier() };

    const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
      method: "POST",
      headers: { "x-user-email": "owner@org-bridge.example" },
      body: JSON.stringify({ name: "Org Bridge Alert Co", ownerEmail: "owner@org-bridge.example", ownerUserId: "owner-org-bridge" })
    }), options);
    const orgPayload = await orgResponse.json() as any;
    const organizationId = orgPayload.organization.id;
    (store as any).saveOrganizationMember({
      id: "member-org-bridge",
      organizationId,
      email: "member@org-bridge.example",
      userId: "member-org-bridge",
      role: "member",
      status: "active",
      createdAt: "2026-06-28T18:00:00.000Z",
      updatedAt: "2026-06-28T18:00:00.000Z"
    });

    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId,
      tenantId: organizationId,
      ownerOrganizationId: organizationId,
      visibilityPolicy: "members",
      allowedViewerRoles: ["owner", "admin", "member", "viewer"],
      entitlementStatus: "active",
      canGenerateAlerts: true,
      activeTerms: [{
        watchlistItemId: "org_item_acme_domain",
        itemId: "org_item_acme_domain",
        organizationId,
        tenantId: organizationId,
        kind: "domain",
        termFamily: "domain",
        category: "domain",
        term: "acme.com",
        value: "acme.com",
        terms: ["acme.com"],
        status: "active",
        createdBy: "owner-org-bridge",
        updatedBy: "owner-org-bridge",
        lifecycleReason: "Live proof watchlist term from recent capture.",
        lifecycleRequestId: "req-org-bridge-watchlist-create",
        alertGeneratorKey: `org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`,
        alertGenerationRef: alertGenerationRef({
          organizationId,
          watchlistItemId: "org_item_acme_domain",
          term: "acme.com",
          termFamily: "domain",
          createdBy: "owner-org-bridge",
          updatedBy: "owner-org-bridge",
          reason: "Live proof watchlist term from recent capture.",
          requestId: "req-org-bridge-watchlist-create"
        })
      }],
      watchlistTerms: [{
        watchlistId: "org_watch_acme_paused",
        watchlistItemId: "org_item_acme_paused",
        organizationId,
        tenantId: organizationId,
        kind: "domain",
        term: "acme.com",
        status: "paused",
        createdBy: "owner-org-bridge"
      }, {
        watchlistId: "org_watch_acme_archived",
        watchlistItemId: "org_item_acme_archived",
        organizationId,
        tenantId: organizationId,
        kind: "domain",
        term: "acme.com",
        status: "archived",
        createdBy: "owner-org-bridge"
      }]
    })) {
      (store as any).saveDwmWatchlist(watchlist);
    }

    const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner@org-bridge.example" },
      body: JSON.stringify({ organizationId })
    }), options);
    const rebuild = await rebuildResponse.json() as any;
    expect(rebuildResponse.status).toBe(200);
    expect(rebuild.savedAlertCount).toBe(3);
    expect(rebuild.generationPlan.activeWatchlistIds).toEqual(["org_item_acme_domain"]);
    const generationCandidate = rebuild.generationPlan.candidates[0];
    expect(generationCandidate.alertGeneratorKeys).toEqual([`org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`]);
    expect(generationCandidate.alertGenerationRefs[0]).toMatchObject({
      watchlistItemId: "org_item_acme_domain",
      dedupe: { key: `org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com` }
    });
    expect(rebuild.generationPlan.skippedWatchlists).toEqual([
      { watchlistId: "org_watch_acme_paused", reason: "paused" },
      { watchlistId: "org_watch_acme_archived", reason: "paused" }
    ]);
    expect(rebuild.alerts.map((alert: any) => alert.sourceFamily).sort()).toEqual(["actor_page", "darkweb_metadata", "telegram_public"]);
    for (const alert of rebuild.alerts) {
      expect(alert.organizationId).toBe(organizationId);
      expect(alert.watchlistIds).toEqual(["org_item_acme_domain"]);
      expect(alert.watchlistItemIds).toEqual(["org_item_acme_domain"]);
      expect(alert.workflowContext).toMatchObject({
        organizationId,
        visibilityPolicy: "members",
        matchedTermCategory: "domain",
        membershipContext: {
          organizationId,
          tenantId: organizationId,
          entitlementStatus: "active",
          allowedViewerRoles: ["owner", "admin", "member", "viewer"]
        },
        watchlistTermContexts: [{
          watchlistId: "org_item_acme_domain",
          watchlistItemId: "org_item_acme_domain",
          category: "domain",
          alertGeneratorKey: `org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`,
          lifecycleReason: "Live proof watchlist term from recent capture.",
          lifecycleRequestId: "req-org-bridge-watchlist-create",
          status: "active",
          value: "acme.com"
        }],
        alertGeneratorKeys: [`org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`]
      });
      expect(alert.workflowContext.alertGenerationRefs[0]).toMatchObject({
        schemaVersion: "organization.watchlist_alert_generation_ref.v1",
        source: "organization_shared_watchlist",
        organizationId,
        tenantId: organizationId,
        watchlistId: "org_item_acme_domain",
        watchlistItemId: "org_item_acme_domain",
        normalizedTerm: "acme.com",
        lifecycle: {
          reason: "Live proof watchlist term from recent capture.",
          requestId: "req-org-bridge-watchlist-create"
        },
        dedupe: {
          key: `org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`,
          parts: {
            organizationId,
            tenantId: organizationId,
            watchlistItemId: "org_item_acme_domain",
            termFamily: "domain",
            normalizedTerm: "acme.com"
          }
        }
      });
      expect(alert.webhookContext).toMatchObject({
        organizationId,
        matchedTermCategory: "domain",
        alertGeneratorKeys: [`org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`],
        watchlistTermContexts: [{ watchlistItemId: "org_item_acme_domain" }]
      });
      expect(JSON.stringify(alert)).not.toContain("org_item_acme_paused");
      expect(JSON.stringify(alert)).not.toContain("org_item_acme_archived");
    }

    const memberListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}&category=domain&allowedRole=member&watchlistId=org_item_acme_domain&watchlistItemId=org_item_acme_domain&alertGeneratorKey=${encodeURIComponent(`org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`)}`, {
      headers: { "x-user-email": "member@org-bridge.example" }
    }), options);
    const memberList = await memberListResponse.json() as any;
    expect(memberListResponse.status).toBe(200);
    expect(memberList.alerts).toHaveLength(3);
    expect(memberList.alerts[0].workflowSummary).toMatchObject({
      matchedTermCategory: "domain",
      watchlistTermContexts: [{ watchlistItemId: "org_item_acme_domain" }],
      alertGeneratorKeys: [`org:${organizationId}:watchlist:org_item_acme_domain:domain:acme.com`],
      membershipContext: { visibilityPolicy: "members" }
    });

    const outsiderListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}`, {
      headers: { "x-user-email": "outsider@org-bridge.example" }
    }), options);
    expect(outsiderListResponse.status).toBe(403);

    const otherOrgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
      method: "POST",
      headers: { "x-user-email": "owner-other@org-bridge.example" },
      body: JSON.stringify({ name: "Other Org Bridge Co", ownerEmail: "owner-other@org-bridge.example", ownerUserId: "owner-other-org-bridge" })
    }), options);
    const otherOrg = await otherOrgResponse.json() as any;
    const otherListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${otherOrg.organization.id}`, {
      headers: { "x-user-email": "owner-other@org-bridge.example" }
    }), options);
    const otherList = await otherListResponse.json() as any;
    expect(otherListResponse.status).toBe(200);
    expect(otherList.alerts).toEqual([]);

    const telegramAlert = rebuild.alerts.find((alert: any) => alert.sourceFamily === "telegram_public");
    const updateResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${telegramAlert.id}`, {
      method: "PATCH",
      headers: { "x-user-email": "owner@org-bridge.example" },
      body: JSON.stringify({
        organizationId,
        status: "closed",
        assignedOwner: "owner-org-bridge",
        severityOverride: "high",
        caseId: "case_org_bridge_live",
        casePath: `/v1/cases/case_org_bridge_live?alertId=${telegramAlert.id}`,
        rationale: "Org bridge proof closed after case handoff."
      })
    }), options);
    const update = await updateResponse.json() as any;
    expect(updateResponse.status).toBe(200);
    expect(update.alert.workflowSummary).toMatchObject({
      status: "closed",
      caseId: "case_org_bridge_live",
      matchedTermCategory: "domain"
    });
    expect(update.alert.caseHandoff.payload.body).toMatchObject({
      organizationId,
      alertId: telegramAlert.id,
      caseIdCandidate: telegramAlert.caseIdCandidate,
      casePath: `/v1/cases/case_org_bridge_live?alertId=${telegramAlert.id}`,
      watchlistItemIds: ["org_item_acme_domain"]
    });

    store.saveCapture(duplicateTelegramCapture);
    const duplicateRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner@org-bridge.example" },
      body: JSON.stringify({ organizationId })
    }), options);
    const duplicateRebuild = await duplicateRebuildResponse.json() as any;
    const preserved = duplicateRebuild.alerts.find((alert: any) => alert.id === telegramAlert.id);
    expect(duplicateRebuild.savedAlertCount).toBe(3);
    expect(preserved).toMatchObject({
      workflowStatus: "closed",
      assignedOwner: "owner-org-bridge",
      severityOverride: "high",
      caseId: "case_org_bridge_live",
      casePath: `/v1/cases/case_org_bridge_live?alertId=${telegramAlert.id}`
    });
    expect(preserved.workflowEvents).toHaveLength(1);
    expect(preserved.evidence).toHaveLength(1);
    expect(preserved.provenance.captureIds).toEqual(["cap_org_bridge_tg_acme"]);
    expect(preserved.workflowContext.watchlistTermContexts).toEqual([expect.objectContaining({ watchlistItemId: "org_item_acme_domain" })]);

    const policyResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/entitlements`, {
      method: "PUT",
      headers: { "x-user-email": "owner@org-bridge.example", "x-request-id": "req-org-bridge-entitlement-limit" },
      body: JSON.stringify({
        plan: "custom",
        limits: { activeWatchlists: 1, watchTerms: 1, webhookDestinations: 5, sourcePacks: 5, alertRebuildsPerDay: 10, openCases: 10 },
        reason: "Org bridge proof keeps the pilot to one active watchlist."
      })
    }), options);
    expect(policyResponse.status).toBe(201);
    const deniedCreateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      headers: { "x-user-email": "owner@org-bridge.example", "x-request-id": "req-org-bridge-entitlement-denied" },
      body: JSON.stringify({
        organizationId,
        id: "org_watch_entitlement_denied",
        name: "Denied duplicate org watch",
        terms: ["acme.com"],
        reason: "Attempt to exceed the one-watchlist pilot entitlement."
      })
    }), options);
    const deniedCreate = await deniedCreateResponse.json() as any;
    expect(deniedCreateResponse.status).toBe(402);
    expect(deniedCreate.entitlement).toMatchObject({
      entitlementStatus: "active",
      blockedAction: "create_dwm_watchlist",
      reason: "active_watchlists",
      audit: { requestId: "req-org-bridge-entitlement-denied" }
    });
    expect((store as any).getDwmWatchlist("org_watch_entitlement_denied")).toBeUndefined();
    const afterDeniedWrite = (store as any).getDwmAlert(telegramAlert.id);
    expect(afterDeniedWrite).toMatchObject({
      workflowStatus: "closed",
      assignedOwner: "owner-org-bridge",
      severityOverride: "high",
      caseId: "case_org_bridge_live",
      casePath: `/v1/cases/case_org_bridge_live?alertId=${telegramAlert.id}`,
      watchlistIds: ["org_item_acme_domain"],
      watchlistItemIds: ["org_item_acme_domain"]
    });
    expect(afterDeniedWrite.workflowEvents).toHaveLength(1);

    const blockedWatchlists = orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId,
      tenantId: organizationId,
      ownerOrganizationId: organizationId,
      visibilityPolicy: "members",
      allowedViewerRoles: ["owner", "admin", "member", "viewer"],
      entitlementStatus: "suspended",
      canGenerateAlerts: false,
      blockedReasons: ["entitlement_suspended"],
      activeWatchlistTerms: [{
        watchlistId: "org_watch_suspended_bridge",
        watchlistItemId: "org_item_suspended_bridge",
        organizationId,
        tenantId: organizationId,
        kind: "domain",
        term: "acme.com",
        status: "active",
        createdBy: "owner-org-bridge"
      }]
    });
    expect(blockedWatchlists).toEqual([
      expect.objectContaining({
        id: "org_watch_suspended_bridge",
        status: "paused",
        orgMembershipContext: expect.objectContaining({
          entitlementStatus: "suspended",
          canGenerateAlerts: false,
          blockedReasons: ["entitlement_suspended"]
        })
      })
    ]);

    const closedListResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}&status=closed&category=domain`, {
      headers: { "x-user-email": "owner@org-bridge.example" }
    }), options);
    const closedList = await closedListResponse.json() as any;
    expect(closedListResponse.status).toBe(200);
    expect(closedList.alerts).toHaveLength(1);
    expect(closedList.alerts[0]).toMatchObject({
      id: telegramAlert.id,
      workflowStatus: "closed",
      deliveryReadiness: { state: "closed" },
      evidenceFreshness: { newestEvidenceAt: "2026-06-28T18:05:00.000Z" },
      provenanceFreshness: { matchBasis: "watchlist_capture_text", captureIds: ["cap_org_bridge_tg_acme"] }
    });
  });
});

function alertGenerationRef(input: {
  organizationId: string;
  watchlistItemId: string;
  term: string;
  termFamily: "company" | "domain" | "vendor" | "actor" | "keyword";
  createdBy: string;
  updatedBy: string | null;
  reason: string | null;
  requestId: string | null;
}) {
  const normalizedTerm = input.term.toLowerCase();
  const key = `org:${input.organizationId}:watchlist:${input.watchlistItemId}:${input.termFamily}:${normalizedTerm}`;
  return {
    schemaVersion: "organization.watchlist_alert_generation_ref.v1" as const,
    source: "organization_shared_watchlist" as const,
    organizationId: input.organizationId,
    tenantId: input.organizationId,
    ownerOrganizationId: input.organizationId,
    watchlistId: input.watchlistItemId,
    watchlistItemId: input.watchlistItemId,
    itemId: input.watchlistItemId,
    termFamily: input.termFamily,
    category: input.termFamily,
    term: input.term,
    normalizedTerm,
    status: "active" as const,
    lifecycle: {
      status: "active" as const,
      reason: input.reason,
      requestId: input.requestId,
      createdBy: input.createdBy,
      updatedBy: input.updatedBy
    },
    dedupe: {
      scope: "organization_watchlist_term" as const,
      key,
      parts: {
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        watchlistItemId: input.watchlistItemId,
        termFamily: input.termFamily,
        normalizedTerm
      }
    }
  };
}
