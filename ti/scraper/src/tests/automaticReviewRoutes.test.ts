import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AUTOMATIC_REVIEW_PROMPT_VERSION,
  AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
  automaticReviewSnapshot,
  handleAutomaticReviewRequest,
  runAutomaticReviewCycle,
  syncAutomaticReviewQueue
} from "../api/automaticReviewRoutes.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";

const firstAt = "2026-07-22T10:00:00.000Z";

describe("automatic Hanasand AI intelligence review", () => {
  test("persists evidence-backed decisions idempotently and appends a new decision on model upgrade", async () => {
    const store = seededStore();
    let submitted: any;
    const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
      submitted = JSON.parse(String(init?.body));
      return Response.json(supportedDecision(submitted));
    };

    const first = await runAutomaticReviewCycle(options(store), { now: firstAt, allTenants: true, modelVersion: "hanasand-v1", fetcher, aiBase: "http://ai.test" });

    expect(first).toMatchObject({ queued: 1, attempted: 1, results: [{ state: "terminal", action: "confirm" }] });
    expect(submitted).toMatchObject({
      schemaVersion: "ti.automatic_intelligence_review.request.v1",
      promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION,
      responseSchemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
      requestedModelVersion: "hanasand-v1",
      subject: { type: "claim", id: "claim_actor" },
      evidence: [{ id: "evidence_actor", source: { id: "source_public" }, capture: { id: "capture_public", safeExcerpt: "Public report attributes this activity to APT29." } }]
    });
    expect(JSON.stringify(submitted)).not.toContain("raw private body");
    expect(JSON.stringify(submitted)).not.toContain("objectRef");
    expect(store.listClaimReviews()).toEqual([expect.objectContaining({
      reviewerId: "hanasand-ai:automatic:hanasand-v1",
      modelVersion: "hanasand-v1",
      promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION,
      evidenceIds: ["evidence_actor"],
      automaticDecision: expect.objectContaining({ actorAttribution: { canonicalName: "APT29", aliases: ["Midnight Blizzard"] } })
    })]);
    expect(store.listActorProfiles()).toHaveLength(0);
    expect(store.listActorAliases()).toHaveLength(0);

    const idempotent = await runAutomaticReviewCycle(options(store), { now: "2026-07-22T10:01:00.000Z", allTenants: true, modelVersion: "hanasand-v1", fetcher, aiBase: "http://ai.test" });
    expect(idempotent).toMatchObject({ queued: 0, attempted: 0 });
    expect(store.listClaimReviews()).toHaveLength(1);

    await runAutomaticReviewCycle(options(store), { now: "2026-07-22T10:02:00.000Z", allTenants: true, modelVersion: "hanasand-v2", fetcher, aiBase: "http://ai.test" });
    expect(store.listClaimReviews().map((review: any) => review.modelVersion)).toEqual(["hanasand-v1", "hanasand-v2"]);
    expect(new Set(store.listClaimReviews().map((review: any) => review.id)).size).toBe(2);
  });

  test("quarantines malformed output, exposes evidence/history, and safely replays", async () => {
    const store = seededStore();
    const invalidFetcher = async () => Response.json({
      ...supportedDecision({ requestedModelVersion: "hanasand-v1", subject: { type: "claim", id: "claim_actor" }, evidence: [{ id: "evidence_actor" }] }),
      supportingEvidenceIds: ["fabricated_evidence"]
    });
    await runAutomaticReviewCycle(options(store), { now: firstAt, allTenants: true, modelVersion: "hanasand-v1", fetcher: invalidFetcher, aiBase: "http://ai.test" });

    const snapshot = automaticReviewSnapshot(store, "default") as any;
    expect(snapshot).toMatchObject({ counts: { quarantined: 1, terminal: 0 }, tasks: [{ state: "quarantined", evidenceIds: ["evidence_actor"] }] });
    expect(snapshot.tasks[0].history.map((event: any) => event.state)).toEqual(["queued", "running", "quarantined"]);
    expect(store.listClaimReviews()).toHaveLength(0);

    const taskId = snapshot.tasks[0].id;
    const replay = await handleAutomaticReviewRequest(api(`/v1/intel/automatic-reviews/${taskId}/replay`, { method: "POST" }), options(store));
    expect(replay?.status).toBe(201);
    const replayed = (await replay!.json()).task;
    expect(replayed).toMatchObject({ state: "queued", replayCount: 1, attempt: 0 });

    await runAutomaticReviewCycle(options(store), { now: replayed.nextAttemptAt, allTenants: true, modelVersion: "hanasand-v1", fetcher: decisionFetcher, aiBase: "http://ai.test" });
    expect(store.listClaimReviews()).toHaveLength(1);
    expect(automaticReviewSnapshot(store, "default")).toMatchObject({ counts: { terminal: 1, quarantined: 0 } });
  });

  test("bounds outages into dead letter and preserves restart-resumable work", async () => {
    const store = seededStore();
    const outage = async () => { throw new Error("model offline"); };
    await runAutomaticReviewCycle(options(store), { now: firstAt, allTenants: true, modelVersion: "hanasand-v1", fetcher: outage, aiBase: "http://ai.test" });
    expect(automaticReviewSnapshot(store, "default")).toMatchObject({ counts: { retrying: 1, dead_letter: 0 } });
    await runAutomaticReviewCycle(options(store), { now: "2026-07-22T10:01:00.000Z", allTenants: true, modelVersion: "hanasand-v1", fetcher: outage, aiBase: "http://ai.test" });
    await runAutomaticReviewCycle(options(store), { now: "2026-07-22T10:03:00.000Z", allTenants: true, modelVersion: "hanasand-v1", fetcher: outage, aiBase: "http://ai.test" });
    expect(automaticReviewSnapshot(store, "default")).toMatchObject({ counts: { retrying: 0, dead_letter: 1 } });

    const directory = mkdtempSync(join(tmpdir(), "automatic-review-restart-"));
    try {
      const path = join(directory, "store.json");
      const first = seededStore(new FileBackedScraperStore({ snapshotPath: path }));
      syncAutomaticReviewQueue(options(first), { tenantId: "default", now: firstAt, modelVersion: "hanasand-v1" });
      const task = (automaticReviewSnapshot(first, "default") as any).tasks[0];
      first.saveAnalystMetadataReviewTask({ ...task, history: undefined, state: "running", attempt: 1, leaseExpiresAt: "2026-07-22T10:00:30.000Z", updatedAt: firstAt, unsafeMaterialAccessed: false });

      const restarted = new FileBackedScraperStore({ snapshotPath: path });
      await runAutomaticReviewCycle(options(restarted), { now: "2026-07-22T10:02:00.000Z", allTenants: true, modelVersion: "hanasand-v1", fetcher: decisionFetcher, aiBase: "http://ai.test" });
      expect(restarted.listClaimReviews()).toHaveLength(1);
      expect((automaticReviewSnapshot(restarted, "default") as any).tasks[0].history.map((event: any) => event.state)).toContain("restart_recovered");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("keeps human decisions authoritative and quarantines missing evidence instead of claiming success", async () => {
    const store = seededStore();
    store.saveIntelligenceClaim({ id: "claim_human", tenantId: "default", claimType: "incident", reviewState: "unreviewed", summary: "Human-owned claim" });
    store.saveClaimReview({ id: "human_review", tenantId: "default", claimId: "claim_human", action: "confirm", reviewerId: "analyst-1", reason: "Confirmed against the retained public report.", reviewedAt: firstAt });
    store.saveIntelligenceClaim({ id: "claim_no_evidence", tenantId: "default", claimType: "incident", reviewState: "unreviewed", summary: "Claim without evidence" });
    let calls = 0;
    await runAutomaticReviewCycle(options(store), { now: firstAt, allTenants: true, modelVersion: "hanasand-v1", fetcher: async (input, init) => { calls++; return decisionFetcher(input, init); }, aiBase: "http://ai.test" });

    expect(store.getClaimReview("human_review")).toMatchObject({ reviewerId: "analyst-1", action: "confirm" });
    expect(store.listClaimReviews().filter((review: any) => review.claimId === "claim_human")).toHaveLength(1);
    expect(store.getIntelligenceClaim("claim_no_evidence")).toMatchObject({ reviewState: "needs_review" });
    const missing = (automaticReviewSnapshot(store, "default") as any).tasks.find((task: any) => task.subject.id === "claim_no_evidence");
    expect(missing).toMatchObject({ state: "quarantined", decision: { action: "mark_needs_review", confidence: 0, calibrationContext: { policyGate: "missing_governed_evidence" } } });
    expect(calls).toBe(1);
  });

  test("records incident-only decisions without mutating actor identity storage", async () => {
    const store = new InMemoryScraperStore();
    seedSourceAndCapture(store);
    store.saveIncident({ id: "incident_only", tenantId: "default", sourceId: "source_public", captureId: "capture_public", title: "Incident-only report", summary: "Public incident report.", confidence: 0.8, firstSeenAt: firstAt });
    let toolsRequest: any;
    const toolsFetcher = async (_input: string | URL | Request, init?: RequestInit) => {
      toolsRequest = JSON.parse(String(init?.body));
      const request = JSON.parse(toolsRequest.prompt.split("\n").at(-1));
      return Response.json({ message: JSON.stringify(supportedDecision(request)) });
    };

    await runAutomaticReviewCycle(options(store), { now: firstAt, allTenants: true, modelVersion: "hanasand-v1", fetcher: toolsFetcher });

    expect(toolsRequest).toMatchObject({ billingMode: "standard", metadata: { source: "ti-automatic-intelligence-review", promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION } });
    expect(automaticReviewSnapshot(store, "default")).toMatchObject({ counts: { terminal: 1 }, tasks: [{ subject: { type: "incident", id: "incident_only" }, decision: { actorAttribution: { canonicalName: "APT29" } } }] });
    expect(store.listClaimReviews()).toHaveLength(0);
    expect(store.listActorProfiles()).toHaveLength(0);
    expect(store.listActorAliases()).toHaveLength(0);
  });
});

function seededStore<T extends InMemoryScraperStore>(store = new InMemoryScraperStore() as T): T {
  seedSourceAndCapture(store);
  store.saveIntelligenceClaim({
    id: "claim_actor",
    tenantId: "default",
    claimType: "actor",
    subjectType: "entity",
    subjectId: "entity_actor",
    reviewState: "unreviewed",
    corroborationState: "single_source",
    confidence: 0.82,
    summary: "APT29 conducted the reported activity.",
    value: { actor: "APT29" },
    sourceIds: ["source_public"],
    captureIds: ["capture_public"]
  });
  store.saveClaimEvidence({ id: "evidence_actor", tenantId: "default", claimId: "claim_actor", captureId: "capture_public", sourceId: "source_public", subjectType: "entity", subjectId: "entity_actor", relationship: "supports", evidenceStage: "captured_page", confidence: 0.82, createdAt: firstAt });
  return store;
}

function seedSourceAndCapture(store: InMemoryScraperStore) {
  store.saveSource({ id: "source_public", tenantId: "default", name: "Public CTI report", type: "news", url: "https://example.test/report", status: "active", accessMethod: "public_http", risk: "low", trustScore: 0.9, crawlFrequencySeconds: 3600, legalNotes: "Public source.", createdAt: firstAt, updatedAt: firstAt });
  store.saveCapture({ id: "capture_public", tenantId: "default", sourceId: "source_public", url: "https://example.test/report", title: "APT29 report", collectedAt: firstAt, publishedAt: firstAt, contentHash: hashContent("raw private body"), mediaType: "text/plain", storageKind: "inline_text", body: "raw private body", metadata: { safeExcerpt: "Public report attributes this activity to APT29." }, sensitive: false });
}

const decisionFetcher = async (_input: string | URL | Request, init?: RequestInit) => {
  const request = JSON.parse(String(init?.body));
  return Response.json(supportedDecision(request));
};

function supportedDecision(request: any) {
  return {
    schemaVersion: AUTOMATIC_REVIEW_RESPONSE_SCHEMA,
    promptVersion: AUTOMATIC_REVIEW_PROMPT_VERSION,
    modelVersion: request.requestedModelVersion,
    subject: { type: request.subject.type, id: request.subject.id },
    action: "confirm",
    claimValidity: "supported",
    actorAttribution: { canonicalName: "APT29", aliases: ["Midnight Blizzard"] },
    supportingEvidenceIds: [request.evidence[0].id],
    contradictoryEvidenceIds: [],
    uncertainty: [],
    rationale: "The governed public report directly supports the claim and attribution.",
    confidence: 0.91,
    calibrationContext: { confidenceBand: "high", sourceCount: 1 }
  };
}

function options(store: InMemoryScraperStore) {
  return {
    store,
    frontier: {} as any,
    authApiBase: "http://auth.test/api",
    authFetch: async () => Response.json({ id: "analyst-1", roles: [{ id: "analyst" }] })
  } as any;
}

function api(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: { authorization: "Bearer test", id: "analyst-1", "x-tenant-id": "default", ...(init.headers ?? {}) }
  });
}
