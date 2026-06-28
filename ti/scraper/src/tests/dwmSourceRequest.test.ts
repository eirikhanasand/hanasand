import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("dwm source requests", () => {
  test("creates an active bounded public Telegram source", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "https://t.me/public_threat_test", type: "telegram_channel", tenantId: "tenant_acme", priority: "high" })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.source.type).toBe("telegram_public");
    expect(body.source.status).toBe("active");
    expect(body.source.metadata.canaryPortfolio).toBe(true);
    expect(body.source.metadata.collectionBoundary.noPrivateAccess).toBe(true);
    expect(store.listSources()).toHaveLength(1);
  });

  test("blocks private Telegram invite links", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "https://t.me/+privateInvite", type: "telegram_channel" })
    }), { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("telegram_policy_blocked");
  });

  test("persists restricted metadata source candidates instead of dropping them into a queue only", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "http://example.onion/posts", type: "restricted_metadata", tenantId: "tenant_acme" })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(202);
    expect(body.request.approvalState).toBe("queued");
    expect(body.source.type).toBe("tor_metadata");
    expect(body.source.status).toBe("candidate");
    expect(body.source.governance).toMatchObject({ approvalRequired: true, approvalState: "pending", metadataOnly: true });
    expect(body.policy.collectionMode).toBe("metadata_only");
    expect(store.listSources()).toHaveLength(1);
  });

  test("lets operators inspect test and activate a public Telegram candidate", async () => {
    const store = new InMemoryScraperStore();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "@candidate_public_cti", type: "telegram_channel", tenantId: "tenant_acme", activate: false })
    }), { store, frontier: new FocusedFrontier() });
    const createdBody = await created.json() as any;

    expect(created.status).toBe(201);
    expect(createdBody.source.status).toBe("candidate");

    const inspect = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "inspect", sourceId: createdBody.source.id })
    }), { store, frontier: new FocusedFrontier() });
    const inspected = await inspect.json() as any;
    expect(inspect.status).toBe(200);
    expect(inspected.lifecycle).toMatchObject({
      status: "candidate",
      activationState: "candidate_review",
      parserStatus: "telegram_public_parser_ready"
    });
    expect(inspected.policy.boundary.noPrivateAccess).toBe(true);

    const tested = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "test", sourceId: createdBody.source.id, decidedBy: "analyst-1", reason: "preview parser can read public channel metadata" })
    }), { store, frontier: new FocusedFrontier() });
    const testedBody = await tested.json() as any;
    expect(tested.status).toBe(200);
    expect(testedBody.lifecycle.healthStatus).toBe("public_preview_pass");
    expect(testedBody.lifecycle.audit[0]).toMatchObject({ action: "test", actor: "analyst-1" });

    const activated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "activate", sourceId: createdBody.source.id, approvedBy: "analyst-1" })
    }), { store, frontier: new FocusedFrontier() });
    const activatedBody = await activated.json() as any;
    expect(activated.status).toBe(200);
    expect(activatedBody.source.status).toBe("active");
    expect(activatedBody.lifecycle.activationState).toBe("active_canary");
    expect(store.getSource(createdBody.source.id)?.metadata.sourceRequestAudit).toHaveLength(2);
  });

  test("requires metadata-only approval before restricted source activation", async () => {
    const store = new InMemoryScraperStore();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "metadata://darkweb/akira/claims", type: "restricted_metadata", tenantId: "tenant_acme", priority: "critical" })
    }), { store, frontier: new FocusedFrontier() });
    const createdBody = await created.json() as any;

    const blocked = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "activate", sourceId: createdBody.source.id, approvedBy: "analyst-1" })
    }), { store, frontier: new FocusedFrontier() });
    const blockedBody = await blocked.json() as any;
    expect(blocked.status).toBe(409);
    expect(blockedBody.error.code).toBe("metadata_only_approval_required");
    expect(store.getSource(createdBody.source.id)?.status).toBe("candidate");

    const activated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        action: "activate",
        sourceId: createdBody.source.id,
        approveMetadataOnly: true,
        approvedBy: "analyst-1",
        reason: "operator approved metadata-only actor coverage"
      })
    }), { store, frontier: new FocusedFrontier() });
    const activatedBody = await activated.json() as any;
    expect(activated.status).toBe(200);
    expect(activatedBody.source).toMatchObject({
      status: "active",
      accessMethod: "approved_proxy",
      governance: { approvalState: "approved", metadataOnly: true, approvedBy: "analyst-1" }
    });
    expect(activatedBody.policy).toMatchObject({ allowed: true, collectionMode: "metadata_only" });
    expect(activatedBody.policy.boundary.payloadPathsBlocked).toBe(true);
  });

  test("records rejection and retry lifecycle decisions on persisted candidates", async () => {
    const store = new InMemoryScraperStore();
    const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "@rejectable_public_cti", type: "telegram_channel", activate: false })
    }), { store, frontier: new FocusedFrontier() });
    const createdBody = await created.json() as any;

    const retry = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "retry", sourceId: createdBody.source.id, decidedBy: "analyst-2", reason: "parser timeout recovered" })
    }), { store, frontier: new FocusedFrontier() });
    const retryBody = await retry.json() as any;
    expect(retry.status).toBe(200);
    expect(retryBody.lifecycle.healthStatus).toBe("retry_scheduled");

    const rejected = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ action: "reject", sourceId: createdBody.source.id, decidedBy: "analyst-2", reason: "not relevant to watchlist scope" })
    }), { store, frontier: new FocusedFrontier() });
    const rejectedBody = await rejected.json() as any;
    expect(rejected.status).toBe(200);
    expect(rejectedBody.source.status).toBe("rejected");
    expect(rejectedBody.lifecycle.audit.map((event: any) => event.action)).toEqual(["retry", "reject"]);
  });

  test("applies dark-web seed packs only when metadata-only approval is explicit", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        seedPackIds: ["darkweb-actor-metadata-core"],
        activate: true,
        approveMetadataOnly: true,
        approvedBy: "analyst-1",
        limit: 4
      })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.summary.darkwebMetadataCreated).toBe(4);
    expect(store.listSources()).toHaveLength(4);
    expect(store.listSources().every((source) => source.status === "active")).toBe(true);
    expect(store.listSources().every((source) => source.governance?.metadataOnly === true)).toBe(true);
  });
});
