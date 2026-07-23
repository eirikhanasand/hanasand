import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { PostgresScraperStore, normalizeLegacySourceForImport } from "../storage/postgresScraperStore.ts";
import { hashContent } from "../utils.ts";
import { api, body, source } from "./helpers/apiSourceFixtures.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

const collectedAt = "2026-07-19T12:00:00.000Z";

describe("structured threat-intelligence storage contract", () => {
  test("normalizes incomplete legacy sources into review-only records", () => {
    expect(normalizeLegacySourceForImport({ id: "legacy", type: "tor_metadata", url: "http://example.onion", updatedAt: collectedAt })).toMatchObject({
      accessMethod: "disabled",
      status: "candidate",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: true }
    });
  });

  test("materializes pipeline entities, actor profiles, and evidence lineage", () => {
    const store = new InMemoryScraperStore();
    installApt29Catalog(store);
    store.saveSource(source({ id: "src_structured" }));
    const result = store.savePipelineResult(pipeline("src_structured"));

    expect(store.listExtractedEntities().some((entity: any) => entity.type === "actor" && entity.captureId === result.capture.id)).toBe(true);
    expect(store.listIndicators().some((indicator: any) => indicator.type === "cve" && indicator.captureId === result.capture.id)).toBe(true);
    expect(store.listActorProfiles().some((profile: any) => profile.canonicalName === "APT29" && profile.captureIds.includes(result.capture.id))).toBe(true);
    expect(store.listActorAliases().some((alias: any) => alias.normalizedAlias === "apt29" && alias.actorProfileId)).toBe(true);
    expect(store.listEvidenceLinks().some((link: any) => link.subjectType === "incident" && link.captureId === result.capture.id)).toBe(true);
    expect(store.listIntelligenceClaims().some((claim: any) => claim.claimType === "actor" && claim.sourceCount === 1 && claim.corroborationState === "single_source")).toBe(true);
    expect(store.listClaimEvidence().every((evidence: any) => evidence.captureId === result.capture.id && evidence.subjectId)).toBe(true);
    expect(store.listTimelinessRecords()).toEqual([expect.objectContaining({ incidentId: result.incident.id, collectedAt, processedAt: expect.any(String), firstVisibleAt: expect.any(String) })]);

    store.saveSource(source({ id: "src_corroborating", url: "https://independent.test/feed" }));
    store.savePipelineResult(pipeline("src_corroborating", undefined, " Independent reporting confirmed the activity."));
    expect(store.listIntelligenceClaims().find((claim: any) => claim.claimType === "actor")).toMatchObject({ sourceCount: 2, corroborationState: "corroborated" });

    store.saveSource(source({ id: "src_syndicated", url: "https://independent.test/second-feed" }));
    store.savePipelineResult(pipeline("src_syndicated", undefined, " A separately formatted copy repeated the activity."));
    store.saveSource(source({ id: "src_identical_copy", url: "https://copy.test/feed" }));
    store.savePipelineResult(pipeline("src_identical_copy", undefined, " Independent reporting confirmed the activity."));
    expect(store.listIntelligenceClaims().find((claim: any) => claim.claimType === "actor")).toMatchObject({
      sourceCount: 2,
      sourceIds: ["src_structured", "src_corroborating", "src_syndicated", "src_identical_copy"],
      sourceIndependence: { groupCount: 2, method: "publisher_or_identical_content" }
    });
  });

  test("exposes validation and evaluation records through the JSON API", async () => {
    const store = new InMemoryScraperStore();
    installApt29Catalog(store);
    store.saveSource(source({ id: "src_research" }));
    const result = store.savePipelineResult(pipeline("src_research"));
    const options = {
      store,
      frontier: new FocusedFrontier(),
      authApiBase: "http://auth.test/api",
      authFetch: async () => Response.json({ id: "analyst_test", roles: [{ id: "analyst" }] })
    } as any;
    const analystHeaders = { "content-type": "application/json", authorization: "Bearer test", id: "analyst_test" };

    const validationResponse = await handleApiRequest(api("/v1/intel/validation-records", {
      method: "POST",
      headers: analystHeaders,
      body: JSON.stringify({
        incidentId: result.incident.id,
        validationType: "public_breach_confirmation",
        status: "supported",
        referenceUrl: "https://northwind.example/security/incident",
        matchedAt: collectedAt,
        reviewerId: "analyst_test"
      })
    }), options);
    expect(validationResponse.status).toBe(201);

    const entity = store.listExtractedEntities().find((record: any) => record.type === "actor");
    const claim = store.listIntelligenceClaims().find((record: any) => record.claimType === "actor");
    const reviewResponse = await handleApiRequest(api(`/v1/intel/claims/${claim.id}/reviews`, {
      method: "POST",
      headers: analystHeaders,
      body: JSON.stringify({ action: "confirm", reason: "Verified against the cited public report." })
    }), options);
    expect(reviewResponse.status).toBe(201);
    const labelResponse = await handleApiRequest(api("/v1/intel/evaluation-labels", {
      method: "POST",
      headers: analystHeaders,
      body: JSON.stringify({
        entityId: entity.id,
        labelType: "actor_extraction",
        expectedValue: "APT29",
        observedValue: entity.value,
        outcome: "true_positive",
        datasetSplit: "test",
        labeledBy: "analyst_test",
        labelingMethod: "manual_source_review",
        independentFromExtractor: true,
        labeledAt: collectedAt
      })
    }), options);
    expect(labelResponse.status).toBe(201);

    const response = await handleApiRequest(api("/v1/intel/actor-profiles?q=apt29"), options);
    expect((await body(response)).total).toBe(1);
    expect(store.listValidationRecords()).toHaveLength(1);
    expect(store.listEvaluationLabels()).toHaveLength(1);
    expect(store.getIntelligenceClaim(claim.id)?.reviewState).toBe("confirmed");
    expect(store.listClaimReviews()).toHaveLength(1);
  });

  test("applies authenticated takedown redaction and claim correction actions", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({ id: "tenant_governed", tenantId: "tenant_governed", name: "Governed tenant", status: "active" });
    store.saveSource(source({ id: "src_governed", tenantId: "tenant_governed" }));
    const result = store.savePipelineResult(pipeline("src_governed", "tenant_governed"));
    const lockedCapture = store.saveCapture(fixtureCapture({ id: "cap_locked_governed", sourceId: "src_governed", tenantId: "tenant_governed", objectRef: { bucket: "governed", key: "locked" } } as any));
    const claim = store.listIntelligenceClaims().find((record: any) => record.claimType === "actor");
    const deletedObjectRefs: any[] = [];
    const options = {
      store,
      frontier: new FocusedFrontier(),
      objectStore: { deleteObject: (reference: any) => deletedObjectRefs.push(reference) },
      authApiBase: "http://auth.test/api",
      authFetch: async () => Response.json({ id: "admin-test", roles: [{ id: "admin" }] })
    } as any;
    const governance = (body: any) => handleApiRequest(api("/v1/intel/governance-actions?tenantId=tenant_governed", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test", id: "admin-test" },
      body: JSON.stringify(body)
    }), options);

    expect((await governance({ action: "redact_capture", captureId: result.capture.id, reason: "Approved evidence removal request" })).status).toBe(201);
    expect(store.getCapture(result.capture.id)).toMatchObject({ storageKind: "metadata_only", body: undefined, objectRef: undefined });
    expect((await governance({ action: "takedown_source", sourceId: "src_governed", reason: "Publisher requested collection takedown" })).status).toBe(201);
    expect(store.getSource("src_governed")?.status).toBe("disabled");
    expect((await governance({ action: "correct_claim", claimId: claim.id, correctedValue: "APT28", reason: "Analyst verified the actor was misidentified" })).status).toBe(201);
    expect(store.getIntelligenceClaim(claim.id)?.reviewState).toBe("rejected");
    expect(store.listClaimReviews()).toContainEqual(expect.objectContaining({ action: "correct", correctedValue: "APT28", reviewerId: "admin-test" }));

    store.saveOrganization({ ...store.getOrganization("tenant_governed"), status: "suspended", privacyDeletionRunId: "run_locked_governed" });
    expect((await governance({ action: "redact_capture", captureId: lockedCapture.id, reason: "Late evidence removal request" })).status).toBe(409);
    expect(deletedObjectRefs).toEqual([]);
    expect(store.getCapture(lockedCapture.id)?.objectRef).toEqual({ bucket: "governed", key: "locked" });
  });
});

const databaseUrl = Bun.env.TI_TEST_DATABASE_URL;
const postgresDescribe = databaseUrl ? describe : describe.skip;

postgresDescribe("PostgreSQL threat-intelligence store", () => {
  let admin: SQL;

  beforeAll(async () => {
    const bootstrap = await PostgresScraperStore.create({ databaseUrl });
    await bootstrap.close();
    admin = new SQL(databaseUrl!);
    await admin.connect();
  });

  beforeEach(async () => {
    await admin.unsafe(`
      TRUNCATE TABLE
        threat_intel.actor_profile_identity_history,
        threat_intel.actor_identity_aliases,
        threat_intel.actor_identities,
        threat_intel.actor_identity_catalog_versions,
        threat_intel.actor_identity_catalogs,
        threat_intel.incident_identity_history,
        threat_intel.incident_revisions,
        threat_intel.workflow_records,
        threat_intel.source_health,
        threat_intel.timeliness_records,
        threat_intel.claim_reviews,
        threat_intel.claim_evidence,
        threat_intel.intelligence_claims,
        threat_intel.evaluation_labels,
        threat_intel.validation_records,
        threat_intel.alerts,
        threat_intel.evidence_links,
        threat_intel.actor_aliases,
        threat_intel.actor_profiles,
        threat_intel.indicators,
        threat_intel.entities,
        threat_intel.incidents,
        threat_intel.captures,
        threat_intel.collection_runs,
        threat_intel.sources
      CASCADE;
    `);
  });

  afterAll(async () => {
    await admin?.close({ timeout: 2 });
  });

  test("durably reconciles organization privacy purge failures through the real route", async () => {
    const organizationId = "org_privacy_postgres";
    const serviceToken = "privacy-postgres-service";
    const privacy = (store: PostgresScraperStore, runId: string, objectStore: any, id = organizationId, mode = "deletion") => handleApiRequest(api(`/v1/organizations/${id}/privacy`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hanasand-service-token": serviceToken },
      body: JSON.stringify({ action: "purge", runId, cutoffAt: "2025-01-01T00:00:00.000Z", mode, limit: 100 })
    }), { store, frontier: new FocusedFrontier(), serviceToken, objectStore } as any);

    const first = await PostgresScraperStore.create({ databaseUrl });
    first.saveSource(source({ id: "src_privacy_postgres", tenantId: organizationId, name: "Customer private source", url: "https://customer-private.example/feed" }));
    first.saveSource(source({ id: "src_privacy_held", tenantId: organizationId, name: "Held provenance source", url: "https://held-provenance.example/feed" }));
    first.saveOrganization({ id: organizationId, tenantId: organizationId, name: "Sensitive TI Customer", status: "active" });
    first.saveOrganizationMember({ id: "member_privacy_postgres", organizationId, userId: "user_privacy", status: "active", createdAt: collectedAt });
    first.saveOrganizationInvite({ id: "invite_privacy_postgres", organizationId, tenantId: organizationId, email: "private-invite@example.test", status: "revoked", updatedAt: collectedAt });
    first.saveWebhookDestination({ id: "destination_privacy_postgres", organizationId, tenantId: organizationId, name: "Private customer webhook", url: "https://customer-private.example/hook", status: "archived", updatedAt: collectedAt });
    first.saveDwmWatchlist({ id: "watch_privacy_postgres", organizationId, tenantId: organizationId, status: "archived", updatedAt: "2020-01-01T00:00:00.000Z" });
    const structured = first.savePipelineResult(pipeline("src_privacy_postgres", organizationId, " Customer private pipeline note."));
    const entity = first.listExtractedEntities().find((record: any) => record.tenantId === organizationId && record.type === "actor");
    const claim = first.listIntelligenceClaims().find((record: any) => record.tenantId === organizationId && record.claimType === "actor");
    first.saveClaimReview({ id: "review_privacy_postgres", tenantId: organizationId, claimId: claim.id, action: "confirm", reviewerId: "private-reviewer", reason: "Customer private review note", reviewedAt: collectedAt });
    first.saveValidationRecord({ id: "validation_privacy_postgres", tenantId: organizationId, incidentId: structured.incident.id, validationType: "public_breach_confirmation", status: "supported", referenceUrl: "https://customer-private.example/validation", matchedAt: collectedAt, reviewerId: "private-validator", notes: "Customer private validation note" });
    first.saveEvaluationLabel({ id: "label_privacy_postgres", tenantId: organizationId, entityId: entity.id, labelType: "actor_extraction", expectedValue: "Customer private expectation", observedValue: entity.value, outcome: "true_positive", datasetSplit: "test", labeledBy: "private-labeler", labeledAt: collectedAt, notes: "Customer private label note" });
    first.saveDwmAlert({ id: "alert_privacy_postgres", tenantId: organizationId, organizationId, captureId: structured.capture.id, incidentId: structured.incident.id, dedupeKey: "customer-private-alert", severity: "high", confidence: 80, reviewState: "confirmed", deliveryState: "pending_review", firstSeenAt: collectedAt, lastSeenAt: collectedAt, updatedAt: collectedAt, ownerId: "private-alert-owner", note: "Customer private alert note", events: [{ message: "Customer private event" }] });
    first.saveCase({ id: "case_privacy_postgres", tenantId: organizationId, organizationId, alertId: "alert_privacy_postgres", status: "open", ownerId: "private-case-owner", note: "Customer private case note", events: [{ message: "Customer private case event" }], createdAt: collectedAt, updatedAt: collectedAt });
    first.savePlan({ id: "plan_privacy_postgres", tenantId: organizationId, requestId: "customer-private-request", query: "Customer private query", createdAt: collectedAt, updatedAt: collectedAt });
    first.saveRun({ id: "run_privacy_ti", tenantId: organizationId, planId: "plan_privacy_postgres", requestId: "customer-private-request", idempotencyKey: "customer-private-key", status: "failed", startedAt: collectedAt, updatedAt: collectedAt, error: "Customer private run error" });
    first.saveSourceHealthObservation({ id: "health_privacy_postgres", tenantId: organizationId, sourceId: "src_privacy_postgres", collectionRunId: "run_privacy_ti", checkedAt: collectedAt, status: "failed", success: false, useful: false, legalMode: "public_content", failureReason: "Customer private source failure" });
    first.createReplayJob({ id: "replay_privacy_postgres", tenantId: organizationId, captureId: structured.capture.id, sourceId: "src_privacy_postgres", toExtractorVersion: "privacy-v2", requestedAt: collectedAt, metadata: { note: "Customer private replay note" } });
    first.saveDiscoveryEvidence({ id: "discovery_privacy_postgres", tenantId: organizationId, query: "Customer private query", normalizedQuery: "customer private query", provider: "search_provider", evidenceType: "search_snippet", resultId: "private-result", observedAt: collectedAt, title: "Customer private discovery", snippet: "Customer private discovery note", url: "https://customer-private.example/discovery", sourceId: "src_privacy_postgres", confidence: 0.5, retentionClass: "discovery_snippet", metadata: {} });
    first.saveLiveSearchSnapshot({ id: "snapshot_privacy_postgres", tenantId: organizationId, query: "Customer private query", normalizedQuery: "customer private query", status: "ready", capturedAt: collectedAt, discoveryEvidenceIds: ["discovery_privacy_postgres"], captureIds: [structured.capture.id], incidentIds: [structured.incident.id], newEvidenceIds: ["discovery_privacy_postgres"], metadata: { note: "Customer private snapshot note" }, retentionClass: "live_search_snapshot" });
    first.saveAnalystMetadataReviewTask({ id: "metadata_review_privacy_postgres", tenantId: organizationId, company: "Customer private company", note: "Customer private metadata review", unsafeMaterialAccessed: false, createdAt: collectedAt, updatedAt: collectedAt });
    first.saveAnalystSourceActivationPacket({ id: "activation_privacy_postgres", tenantId: organizationId, sourceId: "src_privacy_postgres", reason: "Customer private activation reason", dryRun: true, createdAt: collectedAt });
    first.saveAnalystVictimNotificationPacket({ id: "victim_privacy_postgres", tenantId: organizationId, company: "Customer private victim", claimSummary: "Customer private victim note", createdAt: collectedAt });
    first.saveAnalystClaimLedgerEntry({ id: "ledger_privacy_postgres", tenantId: organizationId, normalizedQuery: "customer private claim", captureId: structured.capture.id, sourceId: "src_privacy_postgres", claimKind: "victim_claim", company: "Customer private ledger company", victim: "Customer private ledger victim", claimTextSummary: "Customer private ledger note", sourceHash: "private-ledger-hash", confidence: 0.7, ledgerStatus: "metadata_review", observedAt: collectedAt, provenance: { sourceFamily: "public" }, createdAt: collectedAt });
    first.saveAnalystLoopSnapshot({ id: "loop_privacy_postgres", tenantId: organizationId, headline: "Customer private loop headline", capturedAt: collectedAt });
    first.saveEvaluationBenchmark({ id: "benchmark_privacy_postgres", tenantId: organizationId, status: "annotating", note: "Customer private benchmark", createdAt: collectedAt, updatedAt: collectedAt });
    first.saveEvaluationAnnotation({ id: "annotation_privacy_postgres", tenantId: organizationId, benchmarkId: "benchmark_privacy_postgres", reviewerId: "private-annotation-owner", note: "Customer private annotation", createdAt: collectedAt, updatedAt: collectedAt });
    first.saveEvaluationAdjudication({ id: "adjudication_privacy_postgres", tenantId: organizationId, benchmarkId: "benchmark_privacy_postgres", adjudicatedBy: "private-adjudicator", note: "Customer private adjudication", createdAt: collectedAt, updatedAt: collectedAt });
    first.saveActorOrgRelevanceReview({ id: "actor_review_privacy_postgres", tenantId: organizationId, organizationId, ownerId: "private-actor-review-owner", note: "Customer private actor review", createdAt: collectedAt, updatedAt: collectedAt });
    first.saveCapture(fixtureCapture({ id: "capture_privacy_inline", tenantId: organizationId, sourceId: "src_privacy_postgres", url: "https://customer-private.example/inline", collectedAt: "2020-01-01T00:00:00.000Z", body: "inline customer payload" }));
    first.saveCapture(fixtureCapture({
      id: "capture_privacy_object", tenantId: organizationId, sourceId: "src_privacy_postgres", url: "https://customer-private.example/object", collectedAt: "2020-01-01T00:00:00.000Z",
      body: undefined, storageKind: "external_object", objectRef: { bucket: "privacy", key: "org/object", sizeBytes: 10, sha256: "object_hash" }
    }));
    first.saveCapture(fixtureCapture({ id: "capture_privacy_after_cutoff", tenantId: organizationId, sourceId: "src_privacy_postgres", url: "https://customer-private.example/new", collectedAt: "2030-01-01T00:00:00.000Z", body: "newer customer payload" }));
    first.saveCapture(fixtureCapture({ id: "capture_privacy_hold", tenantId: organizationId, sourceId: "src_privacy_held", url: "https://held-provenance.example/item", collectedAt: "2020-01-01T00:00:00.000Z", body: "legally held customer payload", retentionClass: "legal_hold" }));
    first.saveDwmWebhookDelivery({ id: "delivery_privacy_after_cutoff", organizationId, tenantId: organizationId, alertId: "alert_new", attemptedAt: "2030-01-01T00:00:00.000Z", payload: { secret: "newer delivery payload" } });
    first.saveSource(source({ id: "src_privacy_other", tenantId: "org_privacy_other", name: "Other tenant source", url: "https://other-tenant.example/feed" }));
    first.saveOrganization({ id: "org_privacy_other", tenantId: "org_privacy_other", name: "Other tenant customer", status: "active" });
    first.saveCapture(fixtureCapture({ id: "capture_privacy_other", tenantId: "org_privacy_other", sourceId: "src_privacy_other", url: "https://other-tenant.example/capture", body: "other tenant untouched payload" }));
    await first.flush();

    const failedObject = await privacy(first, "run_privacy_postgres", { deleteObject: () => false });
    expect(failedObject.status).toBe(503);
    expect(await failedObject.json()).toMatchObject({ failed: [expect.objectContaining({ recordId: "capture_privacy_object", status: "failed" })] });
    await first.close();

    const retry = await PostgresScraperStore.create({ databaseUrl });
    expect(retry.getCapture("capture_privacy_inline")).toMatchObject({ body: undefined, storageKind: "metadata_only" });
    expect(retry.getCapture("capture_privacy_object")?.objectRef).toBeDefined();
    expect(retry.getCapture("capture_privacy_hold")?.body).toBe("legally held customer payload");
    expect(retry.getDwmWatchlist("watch_privacy_postgres")).toBeUndefined();
    expect(retry.getOrganizationMember("member_privacy_postgres")).toBeDefined();
    expect(retry.getOrganization(organizationId)).toMatchObject({ status: "suspended", privacyDeletionRunId: "run_privacy_postgres" });
    expect(() => retry.saveDwmWatchlist({ id: "late_privacy_write", organizationId, tenantId: organizationId, status: "active" })).toThrow("writes are blocked");
    const completed = await privacy(retry, "run_privacy_postgres", { deleteObject: () => true });
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({ failed: [], hasMore: false });
    await retry.close();

    const rehydrated = await PostgresScraperStore.create({ databaseUrl });
    expect(rehydrated.getCapture("capture_privacy_object")).toMatchObject({ body: undefined, storageKind: "metadata_only" });
    expect(rehydrated.getCapture("capture_privacy_object")?.objectRef).toBeUndefined();
    expect(rehydrated.getCapture("capture_privacy_after_cutoff")).toMatchObject({ body: undefined, storageKind: "metadata_only" });
    expect(rehydrated.getCapture("capture_privacy_hold")?.body).toBe("legally held customer payload");
    expect(rehydrated.getDwmWebhookDelivery("delivery_privacy_after_cutoff")?.payload).toBeUndefined();
    expect(rehydrated.getOrganizationMember("member_privacy_postgres")).toBeUndefined();
    expect(rehydrated.getOrganization(organizationId)).toMatchObject({ name: "Deleted organization", status: "suspended", privacyDeletionRunId: "run_privacy_postgres" });
    expect(JSON.stringify(rehydrated.getOrganization(organizationId))).not.toContain("Sensitive TI Customer");
    expect(rehydrated.getSource("src_privacy_postgres")).toMatchObject({ name: "Deleted source", status: "retired", url: "privacy://deleted/src_privacy_postgres" });
    expect(rehydrated.getSource("src_privacy_held")).toMatchObject({ name: "Held provenance source", status: "active", url: "https://held-provenance.example/feed" });
    expect(rehydrated.getCapture("capture_privacy_hold")).toMatchObject({ body: "legally held customer payload", sourceId: "src_privacy_held", url: "https://held-provenance.example/item" });
    expect(rehydrated.getSource("src_privacy_other")?.name).toBe("Other tenant source");
    expect(rehydrated.getCapture("capture_privacy_other")?.body).toBe("other tenant untouched payload");
    expect(rehydrated.getOrganization("org_privacy_other")?.name).toBe("Other tenant customer");
    const exported = await handleApiRequest(api(`/v1/organizations/${organizationId}/privacy`, { headers: { "x-hanasand-service-token": serviceToken } }), { store: rehydrated, frontier: new FocusedFrontier(), serviceToken } as any);
    const exportBody = await exported.json() as any;
    expect(exportBody).toMatchObject({ data: { organization: { name: "Deleted organization" }, members: [], invites: [], destinations: [], watchlists: [] }, protection: { heldCaptureIds: ["capture_privacy_hold"] } });
    expect(Object.keys(exportBody.data).sort()).toEqual([
      "actorAliases", "actorIdentities", "actorIdentityCatalogs", "actorOrganizationReviews", "actorProfiles", "alerts",
      "analystClaimLedgerEntries", "analystLoopSnapshots", "analystMetadataReviewTasks", "analystSourceActivationPackets", "analystVictimNotificationPackets",
      "captures", "cases", "claimEvidence", "claimReviews", "claims", "collectionPlans", "collectionRuns", "deliveries", "destinations",
      "discoveryEvidence", "entities", "evaluationAdjudications", "evaluationAnnotations", "evaluationBenchmarks", "evaluationLabels", "evidenceDeltas",
      "evidenceLinks", "incidents", "indicators", "invites", "liveSearchSnapshots", "members", "organization", "replayJobs", "sourceHealth",
      "sources", "timelinessRecords", "validationRecords", "watchlists"
    ]);
    expect(JSON.stringify(exportBody)).not.toContain("Customer private");
    expect(JSON.stringify(exportBody)).not.toContain("Northwind Health");

    const normalizedViolations = await admin<{ kind: string }[]>`
      SELECT 'source' kind FROM threat_intel.sources WHERE tenant_id = ${organizationId} AND id <> 'src_privacy_held' AND (name <> 'Deleted source' OR url NOT LIKE 'privacy://deleted/%' OR status <> 'retired')
      UNION ALL SELECT 'capture' FROM threat_intel.captures WHERE tenant_id = ${organizationId} AND retention_class <> 'legal_hold' AND (body IS NOT NULL OR object_ref IS NOT NULL OR url NOT LIKE 'privacy://deleted/%')
      UNION ALL SELECT 'incident' FROM threat_intel.incidents WHERE tenant_id = ${organizationId} AND (title <> 'Deleted incident' OR summary <> '')
      UNION ALL SELECT 'incident_revision' FROM threat_intel.incident_revisions WHERE tenant_id = ${organizationId} AND (title <> 'Deleted incident' OR summary <> '')
      UNION ALL SELECT 'entity' FROM threat_intel.entities WHERE tenant_id = ${organizationId} AND value NOT LIKE 'deleted:%'
      UNION ALL SELECT 'indicator' FROM threat_intel.indicators WHERE tenant_id = ${organizationId} AND value NOT LIKE 'deleted:%'
      UNION ALL SELECT 'actor_profile' FROM threat_intel.actor_profiles WHERE tenant_id = ${organizationId} AND normalized_name NOT LIKE 'deleted:%'
      UNION ALL SELECT 'actor_alias' FROM threat_intel.actor_aliases WHERE tenant_id = ${organizationId} AND normalized_alias NOT LIKE 'deleted:%'
      UNION ALL SELECT 'validation' FROM threat_intel.validation_records WHERE tenant_id = ${organizationId} AND (reference_url NOT LIKE 'about:blank#%' OR reviewer_id IS NOT NULL OR notes IS NOT NULL)
      UNION ALL SELECT 'evaluation_label' FROM threat_intel.evaluation_labels WHERE tenant_id = ${organizationId} AND (expected_value IS NOT NULL OR observed_value IS NOT NULL OR labeled_by <> 'deleted' OR notes IS NOT NULL)
      UNION ALL SELECT 'collection_run' FROM threat_intel.collection_runs WHERE tenant_id = ${organizationId} AND (request_id IS NOT NULL OR idempotency_key IS NOT NULL OR error IS NOT NULL)
      UNION ALL SELECT 'source_health' FROM threat_intel.source_health WHERE tenant_id = ${organizationId} AND failure_reason IS NOT NULL
      UNION ALL SELECT 'timeliness' FROM threat_intel.timeliness_records WHERE tenant_id = ${organizationId} AND first_reported_provenance IS NOT NULL
      UNION ALL SELECT 'claim' FROM threat_intel.intelligence_claims WHERE tenant_id = ${organizationId} AND (claim_value <> '{}'::jsonb OR summary <> '' OR reviewed_by IS NOT NULL OR contradiction_reason IS NOT NULL)
      UNION ALL SELECT 'claim_evidence' FROM threat_intel.claim_evidence WHERE tenant_id = ${organizationId} AND provenance <> '{}'::jsonb
      UNION ALL SELECT 'claim_review' FROM threat_intel.claim_reviews WHERE tenant_id = ${organizationId} AND (reviewer_id <> 'deleted' OR reason <> 'Privacy redacted')
      UNION ALL SELECT 'alert' FROM threat_intel.alerts WHERE tenant_id = ${organizationId} AND dedupe_key NOT LIKE 'privacy:%'
      UNION ALL SELECT 'workflow' FROM threat_intel.workflow_records WHERE tenant_id = ${organizationId} AND record_type <> 'organization' AND record->>'privacyRedactedAt' IS NULL AND COALESCE(record->>'retentionClass', '') <> 'legal_hold'
    `;
    expect(normalizedViolations).toEqual([]);
    const retainedPayloads = await admin<{ record: any }[]>`
      SELECT record FROM threat_intel.sources WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.captures WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.incidents WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.incident_revisions WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.entities WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.indicators WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.actor_profiles WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.actor_aliases WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.evidence_links WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.validation_records WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.evaluation_labels WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.collection_runs WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.source_health WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.timeliness_records WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.intelligence_claims WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.claim_evidence WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.claim_reviews WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.alerts WHERE tenant_id = ${organizationId}
      UNION ALL SELECT record FROM threat_intel.workflow_records WHERE tenant_id = ${organizationId}
    `;
    expect(JSON.stringify(retainedPayloads)).not.toContain("Customer private");
    expect(JSON.stringify(retainedPayloads)).not.toContain("Northwind Health");
    const organizationBeforeRerun = structuredClone(rehydrated.getOrganization(organizationId));
    const workflowBeforeRerun = await admin<{ id: string; tenant_id: string; updated_at: string; digest: string }[]>`
      SELECT id, tenant_id, updated_at::text, md5(record::text) digest
      FROM threat_intel.workflow_records
      WHERE record_type = 'organization' AND id = ${organizationId}
    `;
    const rerun = await privacy(rehydrated, "run_privacy_postgres", { deleteObject: () => true });
    expect(await rerun.json()).toMatchObject({ selected: 0, failed: [], hasMore: false });
    await rehydrated.flush();
    expect(rehydrated.getOrganization(organizationId)).toEqual(organizationBeforeRerun);
    expect(await admin<{ id: string; tenant_id: string; updated_at: string; digest: string }[]>`
      SELECT id, tenant_id, updated_at::text, md5(record::text) digest
      FROM threat_intel.workflow_records
      WHERE record_type = 'organization' AND id = ${organizationId}
    `).toEqual(workflowBeforeRerun);
    await rehydrated.close();

    const idempotenceRestart = await PostgresScraperStore.create({ databaseUrl });
    expect(idempotenceRestart.getOrganization(organizationId)).toEqual(organizationBeforeRerun);
    expect(await admin<{ id: string; tenant_id: string; updated_at: string; digest: string }[]>`
      SELECT id, tenant_id, updated_at::text, md5(record::text) digest
      FROM threat_intel.workflow_records
      WHERE record_type = 'organization' AND id = ${organizationId}
    `).toEqual(workflowBeforeRerun);
    await idempotenceRestart.close();

    const dbFailureOrganizationId = "org_privacy_db_failure";
    const failing = await PostgresScraperStore.create({ databaseUrl });
    failing.saveOrganization({ id: dbFailureOrganizationId, tenantId: dbFailureOrganizationId, name: "DB Failure Customer", status: "active" });
    failing.saveDwmWatchlist({ id: "watch_privacy_db_failure", organizationId: dbFailureOrganizationId, tenantId: dbFailureOrganizationId, status: "archived", updatedAt: "2020-01-01T00:00:00.000Z" });
    await failing.flush();
    await admin.unsafe(`
      CREATE OR REPLACE FUNCTION public.fail_privacy_workflow_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.id = 'watch_privacy_db_failure' THEN RAISE EXCEPTION 'forced privacy persistence failure'; END IF;
        RETURN OLD;
      END $$;
      CREATE TRIGGER fail_privacy_workflow_delete
      BEFORE DELETE ON threat_intel.workflow_records
      FOR EACH ROW EXECUTE FUNCTION public.fail_privacy_workflow_delete();
    `);
    await expect(privacy(failing, "run_privacy_db_failure", {}, dbFailureOrganizationId)).rejects.toThrow("forced privacy persistence failure");
    expect(await admin`SELECT id FROM threat_intel.workflow_records WHERE id = 'watch_privacy_db_failure'`).toHaveLength(1);
    expect(await admin`SELECT id FROM threat_intel.workflow_records WHERE id = ${dbFailureOrganizationId} AND record->>'status' = 'suspended' AND record->>'privacyDeletionRunId' = 'run_privacy_db_failure'`).toHaveLength(1);

    const restarted = await PostgresScraperStore.create({ databaseUrl });
    expect(restarted.getDwmWatchlist("watch_privacy_db_failure")).toBeDefined();
    expect(restarted.getOrganization(dbFailureOrganizationId)).toMatchObject({ status: "suspended", privacyDeletionRunId: "run_privacy_db_failure" });
    await admin.unsafe(`DROP TRIGGER fail_privacy_workflow_delete ON threat_intel.workflow_records; DROP FUNCTION public.fail_privacy_workflow_delete();`);
    expect((await privacy(restarted, "run_privacy_db_failure", {}, dbFailureOrganizationId)).status).toBe(200);
    await restarted.close();
    await expect(failing.flush()).rejects.toThrow("disappeared before PostgreSQL privacy deletion");
    await (failing as any).sql.close({ timeout: 1 });

    const verified = await PostgresScraperStore.create({ databaseUrl });
    expect(verified.getDwmWatchlist("watch_privacy_db_failure")).toBeUndefined();
    expect(verified.getOrganization(dbFailureOrganizationId)).toMatchObject({ name: "Deleted organization", status: "suspended" });
    await verified.close();

    const lifecycleOrganizationId = "org_privacy_lifecycle_times";
    const lifecycle = await PostgresScraperStore.create({ databaseUrl });
    lifecycle.saveOrganization({ id: lifecycleOrganizationId, tenantId: lifecycleOrganizationId, name: "Lifecycle times", status: "active" });
    lifecycle.saveOrganizationMember({ id: "member_privacy_removed", organizationId: lifecycleOrganizationId, status: "removed", joinedAt: "2030-01-01T00:00:00.000Z", removedAt: "2020-01-01T00:00:00.000Z" });
    lifecycle.saveOrganizationMember({ id: "member_privacy_active", organizationId: lifecycleOrganizationId, status: "active", joinedAt: "2020-01-01T00:00:00.000Z" });
    lifecycle.saveOrganizationInvite({ id: "invite_privacy_revoked", organizationId: lifecycleOrganizationId, status: "revoked", createdAt: "2030-01-01T00:00:00.000Z", revokedAt: "2020-01-01T00:00:00.000Z" });
    await lifecycle.flush();
    expect((await privacy(lifecycle, "run_privacy_lifecycle_times", {}, lifecycleOrganizationId, "scheduled")).status).toBe(200);
    await lifecycle.close();
    const lifecycleRestart = await PostgresScraperStore.create({ databaseUrl });
    expect(lifecycleRestart.getOrganizationMember("member_privacy_removed")).toBeUndefined();
    expect(lifecycleRestart.getOrganizationMember("member_privacy_active")).toBeDefined();
    expect(lifecycleRestart.getOrganizationInvite("invite_privacy_revoked")).toBeUndefined();
    expect(lifecycleRestart.getOrganization(lifecycleOrganizationId)?.status).toBe("active");
    await lifecycleRestart.close();
  });

  test("merges legacy actor-type duplicates without losing profile evidence", async () => {
    await admin.unsafe(`
      DROP INDEX threat_intel.threat_intel_actor_profiles_name_uq;
      DELETE FROM threat_intel.schema_migrations WHERE version = '016_merge_duplicate_actor_profiles';
      INSERT INTO threat_intel.actor_profiles (
        id, canonical_name, normalized_name, actor_type, confidence,
        first_seen_at, last_seen_at, evidence_count, updated_at, record
      ) VALUES
      (
        'actor_ransomware', 'Akira', 'akira', 'ransomware', 0.76,
        '2026-07-19', '2026-07-19', 1, '2026-07-20',
        '{"id":"actor_ransomware","canonicalName":"Akira","normalizedName":"akira","actorType":"ransomware","confidence":0.76,"firstSeenAt":"2026-07-19T00:00:00.000Z","lastSeenAt":"2026-07-19T00:00:00.000Z","updatedAt":"2026-07-20T00:00:00.000Z","evidenceCount":1,"aliases":["Akira"],"sourceIds":["src_one"],"captureIds":["cap_one"],"characterization":{"ttps":[{"value":"intrusion","normalizedValue":"intrusion","entityType":"ttp","confidence":0.7,"entityIds":["entity_one"],"sourceIds":["src_one"],"captureIds":["cap_one"],"reviewReasons":[]}]}}'
      ),
      (
        'actor_generic', 'AKIRA', 'akira', 'threat_actor', 0.8,
        '2026-07-18', '2026-07-20', 2, '2026-07-21',
        '{"id":"actor_generic","canonicalName":"AKIRA","normalizedName":"akira","actorType":"threat_actor","confidence":0.8,"firstSeenAt":"2026-07-18T00:00:00.000Z","lastSeenAt":"2026-07-20T00:00:00.000Z","updatedAt":"2026-07-21T00:00:00.000Z","evidenceCount":2,"aliases":["akira","Alias K"],"sourceIds":["src_two"],"captureIds":["cap_one","cap_two"],"characterization":{"ttps":[{"value":"Intrusion","normalizedValue":"intrusion","entityType":"ttp","confidence":0.8,"entityIds":["entity_two"],"sourceIds":["src_two"],"captureIds":["cap_one","cap_two"],"reviewReasons":["review"]}]}}'
      );
    `);

    const store = await PostgresScraperStore.create({ databaseUrl });
    expect(store.listActorProfiles()).toEqual([
      expect.objectContaining({
        id: "actor_ransomware",
        canonicalName: "Akira",
        actorType: "ransomware",
        confidence: 0.8,
        aliases: ["Akira", "Alias K"],
        sourceIds: ["src_one", "src_two"],
        captureIds: ["cap_one", "cap_two"],
        characterization: { ttps: [expect.objectContaining({ normalizedValue: "intrusion", entityIds: ["entity_one", "entity_two"] })] }
      })
    ]);
    await store.close();
  });

  test("persists semantic evidence-link duplicates idempotently", async () => {
    const store = await PostgresScraperStore.create({ databaseUrl });
    store.saveSource(source({ id: "src_evidence_link_idempotency" }));
    const result = store.savePipelineResult(pipeline("src_evidence_link_idempotency"));
    await store.flush();

    const original = store.listEvidenceLinks().find((link: any) =>
      link.captureId === result.capture.id && link.subjectType === "incident" && link.relationship === "supports"
    );
    store.saveEvidenceLink({ ...original, id: "evidence-link_semantic_duplicate", confidence: 0.99, extractorVersion: "idempotency-regression" });
    await store.flush();

    const rows = await admin`
      SELECT id, confidence, extractor_version, record->>'id' AS record_id
      FROM threat_intel.evidence_links
      WHERE capture_id = ${result.capture.id}
        AND subject_type = ${original.subjectType}
        AND subject_id = ${original.subjectId}
        AND relationship = ${original.relationship}
    ` as any[];
    expect(rows).toEqual([expect.objectContaining({
      id: original.id,
      confidence: 0.99,
      extractor_version: "idempotency-regression",
      record_id: original.id
    })]);
    expect(await store.databaseHealth()).toMatchObject({ ok: true, pendingWrites: 0 });
    await store.close();
  });

  test("migrates dirty null-timestamp capture history without losing scoped evidence", async () => {
    const sourceId = "src_tenant_capture_dedupe";
    const normalizedTextHash = "same-normalized-public-report";
    const capture = (id: string, tenantId: string, url: string, contentHash: string, publishedAt?: string, organizationId?: string, textHash = normalizedTextHash) => fixtureCapture({
      id,
      tenantId,
      sourceId,
      url,
      body: `Retained public incident evidence ${id}.`,
      contentHash,
      normalizedTextHash: textHash,
      publishedAt,
      metadata: { fixture: true, ...(organizationId ? { organizationId } : {}) }
    });
    const bootstrap = await PostgresScraperStore.create({ databaseUrl });
    bootstrap.saveSource(source({ id: sourceId, tenantId: undefined, url: "https://publisher.example/" }));
    await bootstrap.close();

    await admin.unsafe(`
      DROP TRIGGER IF EXISTS threat_intel_captures_reject_duplicate_text ON threat_intel.captures;
      DROP TRIGGER IF EXISTS threat_intel_captures_reject_duplicate_identity ON threat_intel.captures;
      DROP FUNCTION IF EXISTS threat_intel.reject_duplicate_capture_text();
      DROP FUNCTION IF EXISTS threat_intel.reject_duplicate_capture_identity();
      DROP INDEX IF EXISTS threat_intel.threat_intel_captures_source_text_published_uq;
      DROP INDEX IF EXISTS threat_intel.threat_intel_captures_source_text_published_lookup_idx;
      DROP INDEX IF EXISTS threat_intel.threat_intel_captures_source_content_published_uq;
      DROP INDEX IF EXISTS threat_intel.threat_intel_captures_source_url_published_uq;
      DELETE FROM threat_intel.schema_migrations WHERE version = '029_scope_capture_dedupe_by_tenant';
      CREATE UNIQUE INDEX threat_intel_captures_source_text_published_uq
        ON threat_intel.captures (source_id, normalized_text_hash, published_at)
        WHERE normalized_text_hash IS NOT NULL;
      CREATE UNIQUE INDEX threat_intel_captures_source_content_published_uq
        ON threat_intel.captures (source_id, content_hash, published_at);
    `);

    const dirtyCaptures = [
      capture("cap_dirty_null_a", "tenant_alpha", "https://publisher.example/dirty-a", "dirty-content-a"),
      capture("cap_dirty_null_b", "tenant_alpha", "https://publisher.example/dirty-b", "dirty-content-b"),
      capture("cap_dirty_null_url_a", "tenant_alpha", "https://publisher.example/versioned", "dirty-url-content-a", undefined, undefined, "dirty-url-text-a"),
      capture("cap_dirty_null_url_b", "tenant_alpha", "https://publisher.example/versioned", "dirty-url-content-b", undefined, undefined, "dirty-url-text-b")
    ];
    for (const row of dirtyCaptures) {
      await admin`
        INSERT INTO threat_intel.captures (
          id, tenant_id, source_id, url, canonical_url, collected_at, published_at,
          processed_at, first_visible_at, content_hash, normalized_text_hash, media_type,
          storage_kind, body, sensitive, retention_class, extractor_version, record
        ) VALUES (
          ${row.id}, ${row.tenantId}, ${row.sourceId}, ${row.url}, ${row.url}, ${row.collectedAt},
          NULL, ${row.collectedAt}, ${row.collectedAt}, ${row.contentHash}, ${row.normalizedTextHash},
          ${row.mediaType}, ${row.storageKind}, ${row.body}, ${row.sensitive}, ${row.retentionClass ?? "standard"},
          ${row.provenance?.extractorVersion ?? "fixture:v1"}, ${JSON.stringify(row)}::text::jsonb
        )
      `;
      await admin`
        INSERT INTO threat_intel.evidence_links (
          id, tenant_id, capture_id, subject_type, subject_id, relationship,
          confidence, extractor_version, record
        ) VALUES (
          ${`link_${row.id}`}, ${row.tenantId}, ${row.id}, 'validation', ${`validation_${row.id}`},
          'supports', 1, 'fixture:v1', ${JSON.stringify({ id: `link_${row.id}`, tenantId: row.tenantId, captureId: row.id, subjectType: "validation", subjectId: `validation_${row.id}`, relationship: "supports", confidence: 1, extractorVersion: "fixture:v1" })}::text::jsonb
        )
      `;
    }

    const dirtyBefore = {
      captures: await admin`SELECT to_jsonb(capture) AS row FROM threat_intel.captures AS capture WHERE id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`,
      links: await admin`SELECT to_jsonb(link) AS row FROM threat_intel.evidence_links AS link WHERE capture_id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`
    };

    const migrated = await PostgresScraperStore.create({ databaseUrl });
    expect(await admin`SELECT to_jsonb(capture) AS row FROM threat_intel.captures AS capture WHERE id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`).toEqual(dirtyBefore.captures);
    expect(await admin`SELECT to_jsonb(link) AS row FROM threat_intel.evidence_links AS link WHERE capture_id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`).toEqual(dirtyBefore.links);
    await admin`UPDATE threat_intel.captures SET normalized_text_hash = normalized_text_hash WHERE id = 'cap_dirty_null_a'`;
    expect(migrated.listCaptures().filter((row) => row.tenantId === "tenant_alpha")).toHaveLength(4);
    expect(migrated.listEvidenceLinks().filter((row: any) => row.tenantId === "tenant_alpha")).toHaveLength(4);
    const replay = capture("cap_dirty_null_replay", "tenant_alpha", "https://publisher.example/replay", "dirty-content-replay");
    const foundReplay = migrated.findDuplicateCapture(replay);
    expect(migrated.saveCaptureWithDedupe(replay)).toMatchObject({ status: "duplicate" });
    expect(dirtyCaptures.map((row) => row.id)).toContain(foundReplay?.id);
    expect(migrated.saveCaptureWithDedupe(capture("cap_changed_same_url", "tenant_alpha", "https://publisher.example/versioned", "changed-url-content", undefined, undefined, "changed-url-text")).status).toBe("inserted");

    expect(migrated.saveCaptureWithDedupe(capture("cap_dirty_null_beta", "tenant_beta", "https://publisher.example/dirty-a", "dirty-content-beta")).status).toBe("inserted");
    const publishedAt = "2026-07-20T10:00:00.000Z";
    const published = capture("cap_published_alpha", "tenant_alpha", "https://publisher.example/published", "published-content-a", publishedAt);
    expect(migrated.saveCaptureWithDedupe(published).status).toBe("inserted");
    expect(migrated.saveCaptureWithDedupe(capture("cap_published_duplicate", "tenant_alpha", "https://publisher.example/published-copy", "published-content-b", publishedAt))).toMatchObject({ status: "duplicate", duplicateOf: published.id });
    expect(migrated.saveCaptureWithDedupe(capture("cap_published_later", "tenant_alpha", "https://publisher.example/published-later", "published-content-c", "2026-07-20T11:00:00.000Z")).status).toBe("inserted");
    const sharedArticle = "https://publisher.example/shared-tenant-report";
    const sharedPublishedAt = "2026-07-20T12:00:00.000Z";
    const sharedAlpha = capture("cap_shared_org_alpha", "tenant_shared", sharedArticle, "shared-content", sharedPublishedAt, "org_alpha");
    const sharedBeta = capture("cap_shared_org_beta", "tenant_shared", sharedArticle, "shared-content", sharedPublishedAt, "org_beta");
    expect(migrated.saveCaptureWithDedupe(sharedAlpha).status).toBe("inserted");
    expect(migrated.saveCaptureWithDedupe(sharedBeta).status).toBe("inserted");
    expect(migrated.saveCaptureWithDedupe({ ...sharedAlpha, id: "cap_shared_org_alpha_replay" })).toMatchObject({ status: "duplicate", duplicateOf: sharedAlpha.id });
    await migrated.close();

    await admin.unsafe(`
      DO $$
      BEGIN
        BEGIN
          INSERT INTO threat_intel.captures (
            id, tenant_id, source_id, url, canonical_url, collected_at, published_at,
            processed_at, first_visible_at, content_hash, normalized_text_hash, media_type,
            storage_kind, body, sensitive, retention_class, extractor_version, record
          )
          SELECT
            'cap_database_replay', tenant_id, source_id, 'https://publisher.example/database-replay',
            'https://publisher.example/database-replay', collected_at, published_at, processed_at,
            first_visible_at, content_hash, NULL, media_type,
            storage_kind, body, sensitive, retention_class, extractor_version, record
          FROM threat_intel.captures WHERE id = 'cap_dirty_null_a';
          RAISE EXCEPTION 'expected duplicate capture rejection';
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END
      $$;
    `);
    expect(await admin`SELECT id FROM threat_intel.captures WHERE id = 'cap_database_replay'`).toHaveLength(0);

    const beforeRestart = {
      captures: await admin`SELECT id, tenant_id, content_hash FROM threat_intel.captures WHERE source_id = ${sourceId} ORDER BY id`,
      links: await admin`SELECT id, capture_id FROM threat_intel.evidence_links WHERE capture_id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`
    };
    expect(beforeRestart.captures).toHaveLength(10);
    expect(beforeRestart.links).toHaveLength(4);

    await admin`DELETE FROM threat_intel.schema_migrations WHERE version = '029_scope_capture_dedupe_by_tenant'`;
    const restarted = await PostgresScraperStore.create({ databaseUrl });
    expect(restarted.saveCaptureWithDedupe(replay).status).toBe("duplicate");
    await restarted.close();
    expect(await admin`SELECT id, tenant_id, content_hash FROM threat_intel.captures WHERE source_id = ${sourceId} ORDER BY id`).toEqual(beforeRestart.captures);
    expect(await admin`SELECT id, capture_id FROM threat_intel.evidence_links WHERE capture_id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`).toEqual(beforeRestart.links);
    expect(await admin`SELECT to_jsonb(capture) AS row FROM threat_intel.captures AS capture WHERE id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`).toEqual(dirtyBefore.captures);
    expect(await admin`SELECT to_jsonb(link) AS row FROM threat_intel.evidence_links AS link WHERE capture_id IN ('cap_dirty_null_a', 'cap_dirty_null_b', 'cap_dirty_null_url_a', 'cap_dirty_null_url_b') ORDER BY id`).toEqual(dirtyBefore.links);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '029_scope_capture_dedupe_by_tenant'`).toHaveLength(1);
  }, 30_000);

  test("persists global actor identity catalogs across refresh and restart without fabricating activity", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
    first.saveSource(source({ id: "src_actor_catalog", name: "Authoritative actor catalog" }));
    first.saveCapture(catalogCapture("cap_actor_catalog_v1", "catalog-v1"));
    first.replaceActorIdentityCatalog(actorCatalog([actorIdentity("G0001", "Alpha Group", ["Alpha Alias"]), actorIdentity("G0002", "Beta Group", ["Beta Alias"])]), {
      sourceId: "src_actor_catalog",
      captureId: "cap_actor_catalog_v1",
      importedAt: collectedAt
    });
    await first.flush();

    expect(first.listActorProfiles()).toEqual([]);
    expect(first.listIncidents()).toEqual([]);
    const tenantResponse = await handleApiRequest(api("/v1/intel/actor-identities?tenantId=tenant_catalog"), { store: first, frontier: new FocusedFrontier() });
    expect(await tenantResponse.json()).toMatchObject({ total: 2, actorIdentities: [{ catalogId: "mitre-attack-enterprise" }, { catalogId: "mitre-attack-enterprise" }] });
    await first.close();

    const second = await PostgresScraperStore.create({ databaseUrl });
    expect(second.listActorIdentityCatalogs()).toEqual([expect.objectContaining({ id: "mitre-attack-enterprise", identityIds: ["mitre-attack-enterprise:G0001", "mitre-attack-enterprise:G0002"] })]);
    expect(second.listActorIdentities()).toHaveLength(2);
    second.saveCapture(catalogCapture("cap_actor_catalog_v2", "catalog-v2"));
    second.replaceActorIdentityCatalog(actorCatalog([actorIdentity("G0001", "Alpha Group", ["Alpha Current Alias"])], "catalog-v2"), {
      sourceId: "src_actor_catalog",
      captureId: "cap_actor_catalog_v2",
      importedAt: "2026-07-20T12:00:00.000Z"
    });
    await second.close();

    const third = await PostgresScraperStore.create({ databaseUrl });
    expect(third.listActorIdentities()).toEqual([
      expect.objectContaining({ id: "mitre-attack-enterprise:G0001", status: "current", associatedNames: ["Alpha Current Alias"] }),
      expect.objectContaining({ id: "mitre-attack-enterprise:G0002", status: "retired" })
    ]);
    expect(third.listActorProfiles()).toEqual([]);
    expect(third.listIncidents()).toEqual([]);
    const [counts] = await admin<{ versions: number; current_version_identities: number; aliases: number }[]>`
      SELECT
        (SELECT count(*)::int FROM threat_intel.actor_identity_catalog_versions) AS versions,
        (SELECT jsonb_array_length(record->'identities')::int FROM threat_intel.actor_identity_catalog_versions WHERE bundle_sha256 = 'catalog-v2') AS current_version_identities,
        (SELECT count(*)::int FROM threat_intel.actor_identity_aliases) AS aliases
    `;
    expect(counts).toMatchObject({ versions: 2, current_version_identities: 1, aliases: 4 });
    await third.close();
  });

  test("reconciles canonical actor profiles per tenant and archives unresolved identities idempotently", async () => {
    const seed = await PostgresScraperStore.create({ databaseUrl });
    const sourceScopes = [
      ["src_actor_catalog", undefined],
      ["src_global_one", undefined], ["src_global_two", undefined],
      ["src_tenant_a_one", "tenant_a"], ["src_tenant_a_two", "tenant_a"],
      ["src_tenant_b_one", "tenant_b"], ["src_tenant_b_two", "tenant_b"]
    ] as const;
    for (const [id, tenantId] of sourceScopes) seed.saveSource(source({ id, tenantId, url: `https://example.test/${id}` }));
    const captureScopes = [
      ["cap_global_one", "src_global_one", undefined], ["cap_global_two", "src_global_two", undefined],
      ["cap_tenant_a_one", "src_tenant_a_one", "tenant_a"], ["cap_tenant_a_two", "src_tenant_a_two", "tenant_a"],
      ["cap_tenant_b_one", "src_tenant_b_one", "tenant_b"], ["cap_tenant_b_two", "src_tenant_b_two", "tenant_b"]
    ] as const;
    seed.saveCapture(catalogCapture("cap_actor_catalog_reconcile", "catalog-reconcile"));
    for (const [id, sourceId, tenantId] of captureScopes) seed.saveCapture(actorProfileCapture(id, sourceId, tenantId));
    const currentRansomwareMagicHound = {
      ...actorIdentity("magic-hound", "Magic Hound", []),
      id: "ransomware-live-current-operations:magic-hound",
      catalogId: "ransomware-live-current-operations",
      externalId: "magic-hound"
    };
    seed.replaceActorIdentityCatalog(actorCatalog([
      actorIdentity("G0059", "Magic Hound", ["Charming Kitten", "APT35"]),
      actorIdentity("G0030", "Lotus Blossom", ["Thrip"]),
      actorIdentity("G0076", "Thrip", []),
      { ...actorIdentity("G0046", "FIN7", ["Carbon Spider"]), status: "revoked" as const }
    ], "catalog-reconcile"), { sourceId: "src_actor_catalog", captureId: "cap_actor_catalog_reconcile", importedAt: collectedAt });
    seed.replaceActorIdentityCatalog({
      ...actorCatalog([currentRansomwareMagicHound], "ransomware-catalog-reconcile"),
      catalogId: "ransomware-live-current-operations",
      catalogName: "Ransomware.live current operations"
    }, { sourceId: "src_actor_catalog", captureId: "cap_actor_catalog_reconcile", importedAt: collectedAt });
    await seed.close();

    await admin`DELETE FROM threat_intel.schema_migrations WHERE version = '030_reconcile_actor_profiles'`;
    await admin.unsafe("DROP INDEX IF EXISTS threat_intel.threat_intel_actor_profiles_name_uq");

    const profiles = [
      legacyActorProfile("actor_global_alias", undefined, "Charming Kitten", [], ["src_global_one"], ["cap_global_one"], {
        ttps: [actorObservation("Phishing", "ttp", "entity_global_one", "src_global_one", "cap_global_one", 0.7)]
      }),
      legacyActorProfile("actor_global_canonical", "default", "Magic Hound", ["mitre-attack-enterprise:G0059"], ["src_global_two"], ["cap_global_two"], {
        ttps: [actorObservation("Phishing", "ttp", "entity_global_two", "src_global_two", "cap_global_two", 0.9)],
        malware: [actorObservation("Custom Loader", "malware", "entity_global_malware", "src_global_two", "cap_global_two", 0.8)]
      }),
      legacyActorProfile("actor_global_cross_catalog", "default", "Magic Hound", ["mitre-attack-enterprise:G0059", currentRansomwareMagicHound.id], ["src_global_two"], ["cap_global_two"]),
      legacyActorProfile("actor_tenant_a_alias", "tenant_a", "APT35", [], ["src_tenant_a_one"], ["cap_tenant_a_one"]),
      legacyActorProfile("actor_tenant_a_canonical", "tenant_a", "Magic Hound", ["mitre-attack-enterprise:G0059"], ["src_tenant_a_two"], ["cap_tenant_a_two"]),
      legacyActorProfile("actor_tenant_b_alias", "tenant_b", "Charming Kitten", [], ["src_tenant_b_one"], ["cap_tenant_b_one"]),
      legacyActorProfile("actor_tenant_b_canonical", "tenant_b", "Magic Hound", ["mitre-attack-enterprise:G0059"], ["src_tenant_b_two"], ["cap_tenant_b_two"]),
      legacyActorProfile("actor_global_unresolved", undefined, "Unregistered Group", [], ["src_global_one"], ["cap_global_one"]),
      legacyActorProfile("actor_global_ambiguous", undefined, "Thrip", [], ["src_global_one"], ["cap_global_one"]),
      legacyActorProfile("actor_global_revoked", undefined, "FIN7", ["mitre-attack-enterprise:G0046"], ["src_global_one"], ["cap_global_one"]),
      legacyActorProfile("actor_global_unknown_explicit", undefined, "Catalog Pending Group", ["future-catalog:pending"], ["src_global_one"], ["cap_global_one"]),
      legacyActorProfile("actor_tenant_a_unresolved", "tenant_a", "Tenant A Unknown", [], ["src_tenant_a_one"], ["cap_tenant_a_one"]),
      legacyActorProfile("actor_tenant_a_ambiguous", "tenant_a", "Thrip", [], ["src_tenant_a_one"], ["cap_tenant_a_one"]),
      legacyActorProfile("actor_tenant_b_unresolved", "tenant_b", "Tenant B Unknown", [], ["src_tenant_b_one"], ["cap_tenant_b_one"]),
      legacyActorProfile("actor_tenant_b_ambiguous", "tenant_b", "Thrip", [], ["src_tenant_b_one"], ["cap_tenant_b_one"])
    ];
    for (const profile of profiles) {
      await admin`
        INSERT INTO threat_intel.actor_profiles (
          id, tenant_id, canonical_name, normalized_name, actor_type, confidence,
          first_seen_at, last_seen_at, evidence_count, updated_at, record
        ) VALUES (
          ${profile.id}, ${profile.tenantId ?? null}, ${profile.canonicalName}, ${profile.normalizedName}, ${profile.actorType},
          ${profile.confidence}, ${profile.firstSeenAt}, ${profile.lastSeenAt}, ${profile.evidenceCount}, ${profile.updatedAt},
          ${JSON.stringify(profile)}::text::jsonb
        )
      `;
      for (const [index, alias] of profile.aliases.entries()) {
        const normalizedAlias = alias.toLowerCase();
        const aliasRecord = { id: `${profile.id}:alias:${index}`, tenantId: profile.tenantId, actorProfileId: profile.id, alias, normalizedAlias, confidence: profile.confidence, firstSeenAt: profile.firstSeenAt, lastSeenAt: profile.lastSeenAt, evidenceCount: profile.evidenceCount, sourceIds: profile.sourceIds, captureIds: profile.captureIds, updatedAt: profile.updatedAt };
        await admin`
          INSERT INTO threat_intel.actor_aliases (
            id, tenant_id, actor_profile_id, alias, normalized_alias, confidence,
            first_seen_at, last_seen_at, evidence_count, updated_at, record
          ) VALUES (
            ${aliasRecord.id}, ${aliasRecord.tenantId ?? null}, ${aliasRecord.actorProfileId}, ${aliasRecord.alias}, ${aliasRecord.normalizedAlias},
            ${aliasRecord.confidence}, ${aliasRecord.firstSeenAt}, ${aliasRecord.lastSeenAt}, ${aliasRecord.evidenceCount}, ${aliasRecord.updatedAt},
            ${JSON.stringify(aliasRecord)}::text::jsonb
          )
        `;
      }
    }

    const referenceScopes = [
      { tenantId: undefined, loserId: "actor_global_canonical", winnerId: "actor_global_alias", sourceId: "src_global_two", captureId: "cap_global_two" },
      { tenantId: "tenant_a", loserId: "actor_tenant_a_alias", winnerId: "actor_tenant_a_canonical", sourceId: "src_tenant_a_one", captureId: "cap_tenant_a_one" },
      { tenantId: "tenant_b", loserId: "actor_tenant_b_alias", winnerId: "actor_tenant_b_canonical", sourceId: "src_tenant_b_one", captureId: "cap_tenant_b_one" }
    ];
    await insertActorProfileEvidenceLink(admin, { id: "link_global_winner", captureId: "cap_global_one", subjectId: "actor_global_alias", tenantId: undefined });
    await insertActorProfileEvidenceLink(admin, { id: "link_global_loser_duplicate", captureId: "cap_global_one", subjectId: "actor_global_canonical", tenantId: undefined });
    for (const reference of referenceScopes) {
      await insertActorProfileEvidenceLink(admin, { id: `link_${reference.loserId}`, captureId: reference.captureId, subjectId: reference.loserId, tenantId: reference.tenantId });
      const claimId = `claim_${reference.loserId}`;
      const claimRecord = { id: claimId, tenantId: reference.tenantId, claimType: "actor", subjectType: "actor_profile", subjectId: reference.loserId, claimValue: { value: "Magic Hound" }, summary: "Evidence-backed actor profile", confidence: 0.8, evidenceStage: "extracted", extractionMethod: "source_specific", extractorVersion: "test", reviewState: "confirmed", corroborationState: "single_source", sourceCount: 1, evidenceCount: 1, firstSeenAt: collectedAt, lastSeenAt: collectedAt, sourceIds: [reference.sourceId], captureIds: [reference.captureId], reviewedBy: "reviewer_test", reviewedAt: collectedAt, retentionClass: "standard" };
      await admin`
        INSERT INTO threat_intel.intelligence_claims (
          id, tenant_id, claim_type, subject_type, subject_id, claim_value, summary, confidence,
          evidence_stage, extraction_method, extractor_version, review_state, corroboration_state,
          source_count, evidence_count, first_seen_at, last_seen_at, reviewed_by, reviewed_at, record
        ) VALUES (
          ${claimId}, ${reference.tenantId ?? null}, 'actor', 'actor_profile', ${reference.loserId}, ${JSON.stringify(claimRecord.claimValue)}::text::jsonb,
          ${claimRecord.summary}, 0.8, 'extracted', 'source_specific', 'test', 'confirmed', 'single_source', 1, 1,
          ${collectedAt}, ${collectedAt}, 'reviewer_test', ${collectedAt}, ${JSON.stringify(claimRecord)}::text::jsonb
        )
      `;
      const claimEvidenceRecord = { id: `evidence_${claimId}`, tenantId: reference.tenantId, claimId, captureId: reference.captureId, sourceId: reference.sourceId, subjectType: "actor_profile", subjectId: reference.loserId, relationship: "supports", evidenceStage: "extracted", confidence: 0.8, extractorVersion: "test", provenance: { sourceId: reference.sourceId, captureId: reference.captureId } };
      await admin`
        INSERT INTO threat_intel.claim_evidence (
          id, tenant_id, claim_id, capture_id, source_id, subject_type, subject_id,
          relationship, evidence_stage, confidence, extractor_version, provenance, record
        ) VALUES (
          ${claimEvidenceRecord.id}, ${reference.tenantId ?? null}, ${claimId}, ${reference.captureId}, ${reference.sourceId},
          'actor_profile', ${reference.loserId}, 'supports', 'extracted', 0.8, 'test', ${JSON.stringify(claimEvidenceRecord.provenance)}::text::jsonb,
          ${JSON.stringify(claimEvidenceRecord)}::text::jsonb
        )
      `;
      const reviewRecord = { id: `review_${claimId}`, tenantId: reference.tenantId, claimId, action: "confirm", previousState: "unreviewed", nextState: "confirmed", reviewerId: "reviewer_test", reason: "Confirmed against retained public evidence.", reviewedAt: collectedAt };
      await admin`
        INSERT INTO threat_intel.claim_reviews (
          id, tenant_id, claim_id, action, previous_state, next_state, reviewer_id, reason, reviewed_at, record
        ) VALUES (
          ${reviewRecord.id}, ${reference.tenantId ?? null}, ${claimId}, 'confirm', 'unreviewed', 'confirmed', 'reviewer_test',
          ${reviewRecord.reason}, ${collectedAt}, ${JSON.stringify(reviewRecord)}::text::jsonb
        )
      `;
      const workflowRecord = { id: `workflow_${reference.loserId}`, tenantId: reference.tenantId, kind: "updated", subjectType: "actor_profile", subjectId: reference.loserId, observedAt: collectedAt, sourceId: reference.sourceId, captureIds: [reference.captureId], discoveryEvidenceIds: [], incidentIds: [], relationshipIds: [], policyEventIds: [], retentionClass: "standard", metadata: {} };
      await admin`
        INSERT INTO threat_intel.workflow_records (record_type, id, tenant_id, created_at, updated_at, record)
        VALUES ('evidence_delta', ${workflowRecord.id}, ${reference.tenantId ?? null}, ${collectedAt}, ${collectedAt}, ${JSON.stringify(workflowRecord)}::text::jsonb)
      `;
    }

    const beforeProfiles = await admin<{ id: string; record_hash: string }[]>`
      SELECT id, md5(record::text) AS record_hash FROM threat_intel.actor_profiles ORDER BY id
    `;
    const migrated = await PostgresScraperStore.create({ databaseUrl });
    expect(migrated.listActorProfiles()).toHaveLength(3);
    expect(migrated.listActorProfiles()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "actor_global_alias", tenantId: null, canonicalName: "Magic Hound", actorIdentityIds: ["mitre-attack-enterprise:G0059"], identityResolutionState: "canonical", captureIds: ["cap_global_one", "cap_global_two"] }),
      expect.objectContaining({ id: "actor_tenant_a_canonical", tenantId: "tenant_a", canonicalName: "Magic Hound", actorIdentityIds: ["mitre-attack-enterprise:G0059"], captureIds: ["cap_tenant_a_one", "cap_tenant_a_two"] }),
      expect.objectContaining({ id: "actor_tenant_b_canonical", tenantId: "tenant_b", canonicalName: "Magic Hound", actorIdentityIds: ["mitre-attack-enterprise:G0059"], captureIds: ["cap_tenant_b_one", "cap_tenant_b_two"] })
    ]));
    expect(migrated.listActorProfiles().find((profile: any) => profile.id === "actor_global_alias")?.characterization).toMatchObject({
      ttps: [expect.objectContaining({ normalizedValue: "phishing", confidence: 0.9, entityIds: ["entity_global_one", "entity_global_two"], sourceIds: ["src_global_one", "src_global_two"], captureIds: ["cap_global_one", "cap_global_two"] })],
      malware: [expect.objectContaining({ value: "Custom Loader" })]
    });
    expect(await migrated.queryStructuredRecords("actorProfiles", { limit: 50 })).toMatchObject({ total: 1 });
    expect(await migrated.queryStructuredRecords("actorProfiles", { tenantId: "tenant_a", limit: 50 })).toMatchObject({ total: 1 });
    expect(await migrated.queryStructuredRecords("actorProfiles", { tenantId: "tenant_b", limit: 50 })).toMatchObject({ total: 1 });
    expect((await migrated.queryStructuredRecords("actorAliases", { limit: 50 })).records.every((alias: any) => migrated.listActorProfiles().some((profile: any) => profile.id === alias.actorProfileId))).toBe(true);
    expect(await migrated.listActorProfilesForOwnership()).toHaveLength(11);
    expect(await migrated.listActorAliasesForOwnership()).toContainEqual(expect.objectContaining({ actorProfileId: "actor_global_unresolved", normalizedAlias: "unregistered group" }));
    expect(await migrated.listActorProfileIdentityHistoryForOwnership()).toHaveLength(profiles.length);
    await migrated.close();

    const archived = await admin<{ id: string; tenant_id: string | null; reason: string; normalized_name: string }[]>`
      SELECT id, tenant_id, record->>'identityResolutionReason' AS reason, normalized_name
      FROM threat_intel.actor_profiles
      WHERE record->>'identityResolutionState' = 'archived'
      ORDER BY id
    `;
    expect(archived).toHaveLength(8);
    expect(archived.every((profile) => profile.normalized_name === `archived:${profile.id}`)).toBe(true);
    expect(archived.map((profile) => [profile.tenant_id, profile.reason])).toEqual(expect.arrayContaining([
      [null, "unresolved"], [null, "ambiguous"], [null, "inactive_identity"],
      ["tenant_a", "unresolved"], ["tenant_a", "ambiguous"],
      ["tenant_b", "unresolved"], ["tenant_b", "ambiguous"]
    ]));

    const histories = await admin<{ actor_profile_id: string; canonical_actor_profile_id: string | null; resolution_status: string; original_hash: string }[]>`
      SELECT actor_profile_id, canonical_actor_profile_id, resolution_status, md5(original_record::text) AS original_hash
      FROM threat_intel.actor_profile_identity_history ORDER BY actor_profile_id
    `;
    expect(histories).toHaveLength(profiles.length);
    const beforeHashes = new Map(beforeProfiles.map((profile) => [profile.id, profile.record_hash]));
    expect(histories.every((history) => beforeHashes.get(history.actor_profile_id) === history.original_hash)).toBe(true);
    expect(histories.filter((history) => history.resolution_status === "merged").map((history) => [history.actor_profile_id, history.canonical_actor_profile_id])).toEqual(expect.arrayContaining([
      ["actor_global_canonical", "actor_global_alias"],
      ["actor_tenant_a_alias", "actor_tenant_a_canonical"],
      ["actor_tenant_b_alias", "actor_tenant_b_canonical"]
    ]));

    for (const reference of referenceScopes) {
      expect(await admin`SELECT id FROM threat_intel.evidence_links WHERE subject_type = 'actor_profile' AND subject_id = ${reference.winnerId} AND tenant_id IS NOT DISTINCT FROM ${reference.tenantId ?? null}`).not.toHaveLength(0);
      expect((await admin`SELECT subject_id FROM threat_intel.intelligence_claims WHERE id = ${`claim_${reference.loserId}`}`)[0]?.subject_id).toBe(reference.winnerId);
      expect((await admin`SELECT subject_id FROM threat_intel.claim_evidence WHERE id = ${`evidence_claim_${reference.loserId}`}`)[0]?.subject_id).toBe(reference.winnerId);
      expect((await admin`SELECT record->>'subjectId' AS subject_id FROM threat_intel.workflow_records WHERE id = ${`workflow_${reference.loserId}`}`)[0]?.subject_id).toBe(reference.winnerId);
      expect(await admin`SELECT id FROM threat_intel.claim_reviews WHERE claim_id = ${`claim_${reference.loserId}`}`).toHaveLength(1);
    }
    const [orphanCounts] = await admin<{ evidence_links: number; claims: number; claim_evidence: number; workflows: number }[]>`
      SELECT
        (SELECT count(*)::int FROM threat_intel.evidence_links link WHERE link.subject_type = 'actor_profile' AND NOT EXISTS (SELECT 1 FROM threat_intel.actor_profiles profile WHERE profile.id = link.subject_id)) AS evidence_links,
        (SELECT count(*)::int FROM threat_intel.intelligence_claims claim WHERE claim.subject_type = 'actor_profile' AND NOT EXISTS (SELECT 1 FROM threat_intel.actor_profiles profile WHERE profile.id = claim.subject_id)) AS claims,
        (SELECT count(*)::int FROM threat_intel.claim_evidence evidence WHERE evidence.subject_type = 'actor_profile' AND NOT EXISTS (SELECT 1 FROM threat_intel.actor_profiles profile WHERE profile.id = evidence.subject_id)) AS claim_evidence,
        (SELECT count(*)::int FROM threat_intel.workflow_records workflow WHERE workflow.record->>'subjectType' = 'actor_profile' AND NOT EXISTS (SELECT 1 FROM threat_intel.actor_profiles profile WHERE profile.id = workflow.record->>'subjectId')) AS workflows
    `;
    expect(orphanCounts).toEqual({ evidence_links: 0, claims: 0, claim_evidence: 0, workflows: 0 });
    const originalReferences = (await admin<{ reference_snapshot: any }[]>`SELECT reference_snapshot FROM threat_intel.actor_profile_identity_history WHERE actor_profile_id = 'actor_global_canonical'`)[0].reference_snapshot;
    expect(originalReferences.aliases).toHaveLength(1);
    expect(originalReferences.evidenceLinks).toHaveLength(2);
    expect(originalReferences.claims).toHaveLength(1);
    expect(originalReferences.claimEvidence).toHaveLength(1);
    expect(originalReferences.claimReviews).toHaveLength(1);
    expect(originalReferences.workflows).toHaveLength(1);
    expect(originalReferences.aliases[0]).toMatchObject({ actor_profile_id: "actor_global_canonical", alias: "Magic Hound" });

    const stableSnapshot = async () => Promise.all([
      admin`SELECT id, tenant_id, canonical_name, normalized_name, actor_type, confidence, first_seen_at, last_seen_at, evidence_count, created_at, updated_at, record FROM threat_intel.actor_profiles ORDER BY id`,
      admin`SELECT * FROM threat_intel.actor_profile_identity_history ORDER BY actor_profile_id`,
      admin`SELECT * FROM threat_intel.actor_aliases ORDER BY actor_profile_id, normalized_alias`,
      admin`SELECT id, tenant_id, capture_id, subject_type, subject_id, relationship, confidence, extractor_version, created_at, record FROM threat_intel.evidence_links WHERE subject_type = 'actor_profile' ORDER BY id`,
      admin`SELECT id, tenant_id, claim_type, subject_type, subject_id, claim_value, summary, confidence, evidence_stage, extraction_method, extractor_version, review_state, corroboration_state, source_count, evidence_count, first_seen_at, last_seen_at, reviewed_by, reviewed_at, created_at, updated_at, record FROM threat_intel.intelligence_claims WHERE subject_type = 'actor_profile' ORDER BY id`,
      admin`SELECT * FROM threat_intel.claim_evidence WHERE subject_type = 'actor_profile' ORDER BY id`,
      admin`SELECT * FROM threat_intel.claim_reviews ORDER BY id`,
      admin`SELECT * FROM threat_intel.workflow_records WHERE record->>'subjectType' = 'actor_profile' ORDER BY record_type, id`
    ]);
    const afterMigration = await stableSnapshot();
    const restarted = await PostgresScraperStore.create({ databaseUrl });
    expect(restarted.listActorProfiles()).toHaveLength(3);
    await restarted.close();
    expect(await stableSnapshot()).toEqual(afterMigration);

    await admin`DELETE FROM threat_intel.schema_migrations WHERE version = '030_reconcile_actor_profiles'`;
    const rerun = await PostgresScraperStore.create({ databaseUrl });
    expect(rerun.listActorProfiles()).toHaveLength(3);
    await rerun.close();
    expect(await stableSnapshot()).toEqual(afterMigration);

    const retention = await PostgresScraperStore.create({ databaseUrl });
    const ownershipHistory = await retention.listActorProfileIdentityHistoryForOwnership();
    const historyToRedact = ownershipHistory.find((record: any) => record.actorProfileId === "actor_tenant_a_unresolved");
    const immutableHistoryBefore = await admin`
      SELECT id, actor_profile_id, canonical_actor_profile_id, reconciliation_key, resolution_status, reconciled_at
      FROM threat_intel.actor_profile_identity_history WHERE id = ${historyToRedact.id}
    `;
    const privacyRedactedAt = "2026-07-22T00:30:00.000Z";
    expect(await retention.replaceActorProfileIdentityHistoryForRetention({
      ...historyToRedact,
      originalTenantId: "privacy:deleted",
      originalRecord: { id: historyToRedact.actorProfileId, privacyAction: "redact", privacyRedactedAt },
      referenceSnapshot: { aliases: [], evidenceLinks: [], claims: [], claimEvidence: [], claimReviews: [], workflows: [], privacyRedactedAt }
    })).toMatchObject({
      id: historyToRedact.id,
      actorProfileId: historyToRedact.actorProfileId,
      resolutionStatus: historyToRedact.resolutionStatus,
      originalTenantId: "privacy:deleted",
      originalRecord: { privacyAction: "redact", privacyRedactedAt }
    });
    expect(await admin`
      SELECT id, actor_profile_id, canonical_actor_profile_id, reconciliation_key, resolution_status, reconciled_at
      FROM threat_intel.actor_profile_identity_history WHERE id = ${historyToRedact.id}
    `).toEqual(immutableHistoryBefore);
    await retention.close();

    const reactivation = await PostgresScraperStore.create({ databaseUrl });
    reactivation.saveCapture(catalogCapture("cap_actor_catalog_reconcile_v2", "catalog-reconcile-v2"));
    reactivation.replaceActorIdentityCatalog(actorCatalog([
      actorIdentity("G0059", "Magic Hound", ["Charming Kitten", "APT35"]),
      actorIdentity("G0030", "Lotus Blossom", ["Thrip"]),
      actorIdentity("G0076", "Thrip", []),
      { ...actorIdentity("G0046", "FIN7", ["Carbon Spider"]), status: "revoked" as const },
      actorIdentity("G9999", "Unregistered Group", [])
    ], "catalog-reconcile-v2"), { sourceId: "src_actor_catalog", captureId: "cap_actor_catalog_reconcile_v2", importedAt: "2026-07-22T00:00:00.000Z" });
    const reactivatedItem = processCollectedItem({
      sourceId: "src_global_one", url: "https://example.test/reactivated-actor", collectedAt: "2026-07-22T01:00:00.000Z",
      rawText: "Unregistered Group was named in a current public report.", contentHash: hashContent("reactivated-actor"), links: [], metadata: {}, sensitive: false
    }, { actorIdentities: reactivation.listActorIdentities() });
    reactivation.savePipelineResult(reactivatedItem);
    await reactivation.close();

    const afterReactivation = await PostgresScraperStore.create({ databaseUrl });
    expect(afterReactivation.listActorProfiles()).toContainEqual(expect.objectContaining({
      id: "actor_global_unresolved", canonicalName: "Unregistered Group", actorIdentityIds: ["mitre-attack-enterprise:G9999"],
      identityResolutionState: "canonical", evidenceCount: 2
    }));
    expect(afterReactivation.getActorProfile("actor_global_unresolved")).not.toHaveProperty("identityResolutionReason");
    await afterReactivation.close();
  });

  test("persists and rehydrates the complete monitoring record across restart", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
    installApt29Catalog(first);
    first.saveSource(source({ id: "src_postgres", tenantId: "tenant_postgres" }));
    const result = first.savePipelineResult(pipeline("src_postgres", "tenant_postgres"));
    first.replaceCaptureForRetention({ ...result.capture, retentionClass: "public_report", metadata: { ...result.capture.metadata, retentionPolicy: { class: "public_report" } } });
    const entity = first.listExtractedEntities().find((record: any) => record.type === "actor");
    const actorClaim = first.listIntelligenceClaims().find((record: any) => record.claimType === "actor");
    const alertedAt = new Date(Date.parse(result.capture.firstVisibleAt) + 1_000).toISOString();
    first.saveClaimReview({ id: "claim_review_postgres", tenantId: "tenant_postgres", claimId: actorClaim.id, action: "confirm", reviewerId: "analyst_test", reason: "Corroborated by the referenced public incident report.", reviewedAt: alertedAt });

    first.saveValidationRecord({
      id: "validation_postgres",
      tenantId: "tenant_postgres",
      incidentId: result.incident.id,
      validationType: "public_breach_confirmation",
      status: "supported",
      referenceUrl: "https://northwind.example/security/incident",
      matchedAt: collectedAt,
      reviewerId: "analyst_test"
    });
    first.saveEvaluationLabel({
      id: "label_postgres",
      tenantId: "tenant_postgres",
      entityId: entity.id,
      labelType: "actor_extraction",
      expectedValue: "APT29",
      observedValue: entity.value,
      outcome: "true_positive",
      datasetSplit: "test",
      labeledBy: "analyst_test",
      labeledAt: collectedAt
    });
    first.saveDwmAlert({
      id: "alert_postgres",
      tenantId: "tenant_postgres",
      dedupeKey: "apt29:northwind",
      severity: "high",
      confidence: 86,
      reviewState: "confirmed",
      deliveryState: "pending_review",
      firstSeenAt: collectedAt,
      lastSeenAt: collectedAt,
      savedAt: alertedAt,
      updatedAt: collectedAt,
      provenance: { captureIds: [] },
      workflowContext: { generationEvidenceWindow: { captureIds: [result.capture.id] } },
      company: "Northwind Health"
    });
    first.saveDwmWebhookDelivery({ id: "delivery_postgres", tenantId: "tenant_postgres", alertId: "alert_postgres", attemptedAt: new Date(Date.parse(alertedAt) + 1_000).toISOString(), deliveredAt: new Date(Date.parse(alertedAt) + 2_000).toISOString(), status: "delivered", httpStatus: 204 });
    first.savePlan({ id: "plan_postgres", tenantId: "tenant_postgres", createdAt: collectedAt, requestId: "request_postgres" });
    first.saveRun({ id: "run_postgres", tenantId: "tenant_postgres", planId: "plan_postgres", requestId: "request_postgres", status: "completed", startedAt: collectedAt, completedAt: collectedAt, updatedAt: collectedAt, taskCount: 1, sourceCount: 1, captureCount: 1, incidentCount: 1, failedTaskCount: 0 });
    first.saveSourceHealthObservation({ id: "health_postgres", tenantId: "tenant_postgres", sourceId: "src_postgres", collectionRunId: "run_postgres", checkedAt: collectedAt, status: "healthy", success: true, useful: true, latencyMs: 120, itemCount: 1, captureCount: 1, incidentCount: 1, duplicateCount: 0, parserWarningCount: 0, observedActorCount: 1, legalMode: "public_content" });
    first.saveEvaluationBenchmark({ id: "benchmark_postgres", tenantId: "tenant_postgres", status: "annotating", captureIds: [result.capture.id], labelTypes: ["actor"], taskCount: 1, requiredReviewers: 2, createdAt: collectedAt, updatedAt: collectedAt });
    first.saveEvaluationAnnotation({ id: "annotation_postgres", tenantId: "tenant_postgres", benchmarkId: "benchmark_postgres", taskId: "task_postgres", captureId: result.capture.id, labelType: "actor", reviewerId: "analyst_test", expectedValues: ["APT29"], annotatedAt: collectedAt, createdAt: collectedAt, updatedAt: collectedAt });
    first.saveEvaluationAdjudication({ id: "adjudication_postgres", tenantId: "tenant_postgres", benchmarkId: "benchmark_postgres", taskId: "task_postgres", captureId: result.capture.id, labelType: "actor", expectedValues: ["APT29"], adjudicatedBy: "analyst_second", adjudicatedAt: collectedAt, createdAt: collectedAt, updatedAt: collectedAt });
    await first.flush();
    const actorResponse = await handleApiRequest(api("/v1/intel/actor-profiles?tenantId=tenant_postgres&q=apt29&limit=1"), { store: first, frontier: new FocusedFrontier() });
    expect(await actorResponse.json()).toMatchObject({ total: 1, actorProfiles: [{ canonicalName: "APT29" }] });
    const entityResponse = await handleApiRequest(api("/v1/intel/entities?tenantId=tenant_postgres&limit=1"), { store: first, frontier: new FocusedFrontier() });
    expect(await entityResponse.json()).toMatchObject({ nextCursor: "1" });
    await first.close();

    const second = await PostgresScraperStore.create({ databaseUrl });
    expect(await second.databaseHealth()).toMatchObject({ ok: true, backend: "postgresql", schema: "threat_intel" });
    expect(second.listSources().map((record: any) => record.id)).toContain("src_postgres");
    expect(second.listCaptures().find((record: any) => record.id === result.capture.id)).toMatchObject({ retentionClass: "public_report", metadata: { retentionPolicy: { class: "public_report" } } });
    expect(second.listIncidents()).toHaveLength(1);
    expect(second.listExtractedEntities().length).toBeGreaterThan(1);
    expect(second.listIndicators()).toHaveLength(1);
    expect(second.listActorProfiles().some((profile: any) => profile.canonicalName === "APT29")).toBe(true);
    expect(second.listActorAliases().some((alias: any) => alias.normalizedAlias === "apt29")).toBe(true);
    expect(second.listEvidenceLinks().length).toBeGreaterThan(3);
    expect(second.listIntelligenceClaims().some((claim: any) => claim.id === actorClaim.id && claim.reviewState === "confirmed")).toBe(true);
    expect(second.listClaimEvidence().length).toBeGreaterThan(3);
    expect(second.listClaimReviews()).toEqual([expect.objectContaining({ id: "claim_review_postgres", nextState: "confirmed" })]);
    expect(second.listValidationRecords()).toHaveLength(1);
    expect(second.listEvaluationLabels()).toHaveLength(1);
    expect(second.listEvaluationBenchmarks()).toEqual([expect.objectContaining({ id: "benchmark_postgres" })]);
    expect(second.listEvaluationAnnotations()).toEqual([expect.objectContaining({ id: "annotation_postgres" })]);
    expect(second.listEvaluationAdjudications()).toEqual([expect.objectContaining({ id: "adjudication_postgres" })]);
    expect(second.listDwmAlerts()).toHaveLength(1);
    expect(second.listPlans()).toHaveLength(1);
    expect(second.listRuns()).toEqual([expect.objectContaining({ id: "run_postgres", status: "completed" })]);
    expect(second.listSourceHealthObservations()).toEqual([expect.objectContaining({ id: "health_postgres", useful: true })]);
    expect(second.listTimelinessRecords()).toEqual([expect.objectContaining({ incidentId: result.incident.id, firstReportedKind: "publisher", publisherReportedAt: "2026-05-24T09:58:00.000Z", firstReportedProvenance: expect.objectContaining({ sourceId: "src_postgres", evidencePath: "feed.entry.publishedAt" }), alertCreatedAt: alertedAt, alertedAt, deliveryAttemptedAt: new Date(Date.parse(alertedAt) + 1_000).toISOString(), deliveredAt: new Date(Date.parse(alertedAt) + 2_000).toISOString() })]);

    const [counts] = await admin<{ sources: number; captures: number; entities: number; profiles: number; aliases: number; incidents: number; links: number; claims: number; claim_evidence: number; claim_reviews: number; validations: number; alerts: number; labels: number; runs: number; health: number; timeliness: number; legacy_runs: number; legacy_claims: number; public_core_tables: number }[]>`
      SELECT
        (SELECT count(*)::int FROM threat_intel.sources) AS sources,
        (SELECT count(*)::int FROM threat_intel.captures) AS captures,
        (SELECT count(*)::int FROM threat_intel.entities) AS entities,
        (SELECT count(*)::int FROM threat_intel.actor_profiles) AS profiles,
        (SELECT count(*)::int FROM threat_intel.actor_aliases) AS aliases,
        (SELECT count(*)::int FROM threat_intel.incidents) AS incidents,
        (SELECT count(*)::int FROM threat_intel.evidence_links) AS links,
        (SELECT count(*)::int FROM threat_intel.intelligence_claims) AS claims,
        (SELECT count(*)::int FROM threat_intel.claim_evidence) AS claim_evidence,
        (SELECT count(*)::int FROM threat_intel.claim_reviews) AS claim_reviews,
        (SELECT count(*)::int FROM threat_intel.validation_records) AS validations,
        (SELECT count(*)::int FROM threat_intel.alerts) AS alerts,
        (SELECT count(*)::int FROM threat_intel.evaluation_labels) AS labels,
        (SELECT count(*)::int FROM threat_intel.collection_runs) AS runs,
        (SELECT count(*)::int FROM threat_intel.source_health) AS health,
        (SELECT count(*)::int FROM threat_intel.timeliness_records) AS timeliness,
        (SELECT count(*)::int FROM threat_intel.workflow_records WHERE record_type = 'collection_run') AS legacy_runs,
        (SELECT count(*)::int FROM threat_intel.workflow_records WHERE record_type = 'analyst_claim_ledger_entry') AS legacy_claims,
        (SELECT count(*)::int FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('sources', 'captures', 'entities', 'indicators', 'actor_profiles', 'incidents', 'evidence_links', 'validation_records', 'alerts', 'evaluation_labels')) AS public_core_tables
    `;
    expect(counts).toMatchObject({ sources: 2, captures: 2, incidents: 1, claim_reviews: 1, validations: 1, alerts: 1, labels: 1, runs: 1, health: 1, timeliness: 1, legacy_runs: 0, legacy_claims: 0, public_core_tables: 0 });
    expect(counts.entities).toBeGreaterThan(1);
    expect(counts.profiles).toBeGreaterThan(0);
    expect(counts.aliases).toBeGreaterThan(0);
    expect(counts.claims).toBeGreaterThan(3);
    expect(counts.claim_evidence).toBeGreaterThan(3);
    expect(counts.links).toBeGreaterThan(3);
    const [captureRetention] = await admin<{ retention_class: string; record_class: string }[]>`
      SELECT retention_class, record->>'retentionClass' AS record_class FROM threat_intel.captures WHERE id = ${result.capture.id}
    `;
    expect(captureRetention).toEqual({ retention_class: "public_report", record_class: "public_report" });
    const [timelinessRow] = await admin<any[]>`
      SELECT publisher_reported_at, first_reported_at, first_reported_kind,
             first_reported_provenance, alert_created_at, delivery_attempted_at, delivered_at
      FROM threat_intel.timeliness_records
      WHERE incident_id = ${result.incident.id}
    `;
    expect(timelinessRow).toMatchObject({
      first_reported_kind: "publisher",
      first_reported_provenance: { sourceId: "src_postgres", evidencePath: "feed.entry.publishedAt" }
    });
    expect(new Date(timelinessRow.publisher_reported_at).toISOString()).toBe("2026-05-24T09:58:00.000Z");
    expect(new Date(timelinessRow.first_reported_at).toISOString()).toBe("2026-05-24T09:58:00.000Z");
    expect(new Date(timelinessRow.alert_created_at).toISOString()).toBe(alertedAt);
    expect(new Date(timelinessRow.delivery_attempted_at).toISOString()).toBe(new Date(Date.parse(alertedAt) + 1_000).toISOString());
    expect(new Date(timelinessRow.delivered_at).toISOString()).toBe(new Date(Date.parse(alertedAt) + 2_000).toISOString());
    await second.close();
  });

  test("does not rewrite a legacy incident linked to a duplicate capture", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
    first.saveSource(source({ id: "src_duplicate_incident", tenantId: "tenant_duplicate_incident" }));
    const result = first.savePipelineResult(pipeline("src_duplicate_incident", "tenant_duplicate_incident"));
    await first.flush();
    first.saveIncident({ ...result.incident, id: "inc_legacy_content_hash", logicalIdentity: undefined, updatedAt: undefined });
    const currentLink = first.listEvidenceLinks().find((link: any) => link.captureId === result.capture.id && link.subjectType === "incident" && link.subjectId === result.incident.id);
    first.saveEvidenceLink({ ...currentLink, id: "evidence-link_legacy_duplicate_capture", subjectId: "inc_legacy_content_hash" });
    await first.flush();
    first.saveExtractedEntity({
      id: "entity_legacy_incident_link",
      tenantId: "tenant_duplicate_incident",
      sourceId: result.capture.sourceId,
      captureId: result.capture.id,
      incidentId: "inc_legacy_content_hash",
      type: "legacy_marker",
      value: "legacy",
      normalizedValue: "legacy",
      confidence: 0.5,
      extractorVersion: "legacy",
      provenance: []
    });
    await first.close();

    const sentinel = "2000-01-01T00:00:00.000Z";
    await admin`UPDATE threat_intel.incidents SET updated_at = ${sentinel} WHERE id = 'inc_legacy_content_hash'`;
    const second = await PostgresScraperStore.create({ databaseUrl });
    await admin`DELETE FROM threat_intel.evidence_links WHERE id = 'evidence-link_legacy_duplicate_capture'`;
    second.savePipelineResult(pipeline("src_duplicate_incident", "tenant_duplicate_incident"));
    await second.flush();
    const [legacy] = await admin<{ updated_at: Date }[]>`SELECT updated_at FROM threat_intel.incidents WHERE id = 'inc_legacy_content_hash'`;
    expect(legacy.updated_at.toISOString()).toBe(sentinel);
    expect(await admin`SELECT id FROM threat_intel.evidence_links WHERE id = 'evidence-link_legacy_duplicate_capture'`).toHaveLength(0);
    await second.close();
  });

  test("migrates historical incident revisions with auditable and reversible lineage", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
    first.saveSource(source({ id: "src_incident_lineage" }));
    const current = first.savePipelineResult(pipeline("src_incident_lineage"));
    const legacyId = "inc_legacy_content_revision";
    const invalidId = "inc_parser_fallback";
    const originalLink = first.listEvidenceLinks().find((link: any) =>
      link.captureId === current.capture.id && link.subjectType === "incident" && link.subjectId === current.incident.id
    );
    const currentTimeliness = first.getTimelinessRecord(current.incident.id);
    first.saveIncident({ ...current.incident, id: legacyId, logicalIdentity: undefined, updatedAt: "2026-07-18T00:00:00.000Z" });
    first.saveExtractedEntity({
      id: "entity_legacy_lineage", sourceId: current.capture.sourceId, captureId: current.capture.id,
      incidentId: legacyId, type: "legacy_marker", value: "legacy", normalizedValue: "legacy",
      confidence: 0.5, extractorVersion: "legacy", provenance: []
    });
    first.saveEvidenceLink({ ...originalLink, id: "evidence-link_legacy_lineage", subjectId: legacyId });
    first.saveTimelinessRecord({ ...currentTimeliness, id: legacyId, incidentId: legacyId });

    const invalidCapture = {
      ...current.capture,
      id: "cap_parser_fallback",
      url: "https://example.test/src_incident_lineage/fallback",
      canonicalUrl: "https://example.test/src_incident_lineage/fallback",
      contentHash: "parser-fallback-content",
      normalizedTextHash: "parser-fallback-text",
      publishedAt: undefined,
      metadata: { feedItem: false, parserWarnings: ["feed contained no RSS or Atom entries"] }
    };
    first.saveCapture(invalidCapture);
    first.saveIncident({ ...current.incident, id: invalidId, captureId: invalidCapture.id, logicalIdentity: undefined });
    first.saveExtractedEntity({
      id: "entity_invalid_lineage", sourceId: current.capture.sourceId, captureId: invalidCapture.id,
      incidentId: invalidId, type: "parser_marker", value: "fallback", normalizedValue: "fallback",
      confidence: 0.2, extractorVersion: "legacy", provenance: []
    });
    await first.close();

    await admin`
      INSERT INTO threat_intel.intelligence_claims (
        id, claim_type, subject_type, subject_id, claim_value, summary, confidence,
        evidence_stage, extraction_method, extractor_version, review_state,
        legal_hold, corroboration_state, source_count, evidence_count, first_seen_at, last_seen_at, record
      ) VALUES (
        'claim_legacy_lineage', 'incident_summary', 'incident', ${legacyId}, ${JSON.stringify({ value: "legacy" })}::text::jsonb,
        'Legacy incident claim', 0.7, 'extracted', 'test', 'legacy', 'unreviewed',
        false, 'single_source', 1, 1, ${collectedAt}, ${collectedAt},
        ${JSON.stringify({ id: "claim_legacy_lineage", subjectType: "incident", subjectId: legacyId })}::text::jsonb
      ), (
        'claim_invalid_needs_review', 'incident', 'incident', ${invalidId}, ${JSON.stringify({ value: "parser fallback" })}::text::jsonb,
        'Generated low-confidence parser fallback', 0.2, 'captured_page', 'deterministic_fallback', 'legacy', 'needs_review',
        false, 'single_source', 1, 1, ${collectedAt}, ${collectedAt},
        ${JSON.stringify({ id: "claim_invalid_needs_review", subjectType: "incident", subjectId: invalidId, reviewState: "needs_review" })}::text::jsonb
      ), (
        'claim_invalid_protected', 'incident', 'incident', ${invalidId}, ${JSON.stringify({ value: "analyst confirmed" })}::text::jsonb,
        'Analyst-confirmed claim', 0.9, 'validated', 'analyst_review', 'legacy', 'confirmed',
        true, 'single_source', 1, 1, ${collectedAt}, ${collectedAt},
        ${JSON.stringify({ id: "claim_invalid_protected", subjectType: "incident", subjectId: invalidId, reviewState: "confirmed", legalHold: true, summary: "Analyst-confirmed claim" })}::text::jsonb
      )
    `;
    await admin`
      INSERT INTO threat_intel.claim_evidence (
        id, claim_id, capture_id, source_id, subject_type, subject_id, relationship,
        evidence_stage, confidence, extractor_version, provenance, record
      ) VALUES (
        'claim-evidence_legacy_lineage', 'claim_legacy_lineage', ${current.capture.id}, ${current.capture.sourceId},
        'incident', ${legacyId}, 'supports', 'extracted', 0.7, 'legacy', '{}'::jsonb,
        ${JSON.stringify({ id: "claim-evidence_legacy_lineage", claimId: "claim_legacy_lineage", captureId: current.capture.id, subjectType: "incident", subjectId: legacyId, relationship: "supports" })}::text::jsonb
      ), (
        'claim-evidence_invalid_cross_subject', 'claim_invalid_needs_review', ${current.capture.id}, ${current.capture.sourceId},
        'entity', 'entity_invalid_lineage', 'supports', 'captured_page', 0.2, 'legacy', '{}'::jsonb,
        ${JSON.stringify({ id: "claim-evidence_invalid_cross_subject", claimId: "claim_invalid_needs_review", captureId: current.capture.id, subjectType: "entity", subjectId: "entity_invalid_lineage", relationship: "supports" })}::text::jsonb
      ), (
        'claim-evidence_invalid_protected', 'claim_invalid_protected', ${current.capture.id}, ${current.capture.sourceId},
        'incident', ${invalidId}, 'supports', 'validated', 0.9, 'legacy', '{}'::jsonb,
        ${JSON.stringify({ id: "claim-evidence_invalid_protected", claimId: "claim_invalid_protected", captureId: current.capture.id, subjectType: "incident", subjectId: invalidId, relationship: "supports" })}::text::jsonb
      )
    `;
    await admin`
      INSERT INTO threat_intel.claim_reviews (
        id, claim_id, action, previous_state, next_state, reviewer_id, reason, reviewed_at, record
      ) VALUES (
        'claim-review_invalid_protected', 'claim_invalid_protected', 'confirm', 'needs_review', 'confirmed',
        'analyst_test', 'Confirmed from independent source evidence.', ${collectedAt},
        ${JSON.stringify({ id: "claim-review_invalid_protected", claimId: "claim_invalid_protected", action: "confirm", reviewerId: "analyst_test" })}::text::jsonb
      )
    `;
    await admin`
      INSERT INTO threat_intel.validation_records (
        id, claim_id, validation_type, status, reference_url, matched_at, reviewer_id, record
      ) VALUES (
        'validation_invalid_protected', 'claim_invalid_protected', 'independent_source', 'supported',
        'https://example.test/independent-evidence', ${collectedAt}, 'analyst_test',
        ${JSON.stringify({ id: "validation_invalid_protected", claimId: "claim_invalid_protected", status: "supported" })}::text::jsonb
      )
    `;
    await admin`
      INSERT INTO threat_intel.evaluation_labels (
        id, claim_id, label_type, expected_value, observed_value, outcome,
        dataset_split, labeled_by, labeled_at, record
      ) VALUES (
        'label_invalid_protected', 'claim_invalid_protected', 'incident', '"confirmed"'::jsonb, '"confirmed"'::jsonb,
        'correct', 'test', 'analyst_test', ${collectedAt},
        ${JSON.stringify({ id: "label_invalid_protected", claimId: "claim_invalid_protected", outcome: "correct" })}::text::jsonb
      )
    `;
    await admin`
      INSERT INTO threat_intel.workflow_records (record_type, id, created_at, updated_at, record)
      VALUES ('live_search_snapshot', 'snapshot_incident_lineage', ${collectedAt}, ${collectedAt},
        ${JSON.stringify({ id: "snapshot_incident_lineage", incidentIds: [current.incident.id, legacyId, invalidId], subjectType: "incident", subjectId: invalidId })}::text::jsonb)
    `;
    await admin`
      INSERT INTO threat_intel.evidence_links (
        id, capture_id, subject_type, subject_id, relationship, confidence, extractor_version, created_at, record
      ) VALUES (
        'evidence-link_preexisting_dangling', ${current.capture.id}, 'incident', 'inc_missing_before_lineage',
        'supports', 0.2, 'legacy', ${collectedAt},
        ${JSON.stringify({ id: "evidence-link_preexisting_dangling", captureId: current.capture.id, subjectType: "incident", subjectId: "inc_missing_before_lineage", relationship: "supports" })}::text::jsonb
      )
    `;
    await admin`DELETE FROM threat_intel.incident_revisions`;
    await admin`DELETE FROM threat_intel.incident_identity_history`;
    await admin`DELETE FROM threat_intel.schema_migrations WHERE version IN ('019_incident_logical_identity', '021_remove_dangling_incident_evidence_links')`;

    const protectedGraph = async () => (await admin<{ snapshot: any }[]>`
      SELECT jsonb_build_object(
        'incidents', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.incidents AS row WHERE id IN (${current.incident.id}, ${legacyId}, ${invalidId})),
        'entities', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.entities AS row WHERE id IN ('entity_legacy_lineage', 'entity_invalid_lineage')),
        'evidenceLinks', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.evidence_links AS row WHERE id = 'evidence-link_legacy_lineage'),
        'claims', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.intelligence_claims AS row WHERE id LIKE 'claim%lineage' OR id LIKE 'claim_invalid_%'),
        'claimEvidence', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.claim_evidence AS row WHERE id LIKE 'claim-evidence_%lineage' OR id LIKE 'claim-evidence_invalid_%'),
        'claimReviews', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.claim_reviews AS row WHERE claim_id = 'claim_invalid_protected'),
        'validations', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.validation_records AS row WHERE claim_id = 'claim_invalid_protected'),
        'labels', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.evaluation_labels AS row WHERE claim_id = 'claim_invalid_protected'),
        'timeliness', (SELECT jsonb_agg(to_jsonb(row) ORDER BY id) FROM threat_intel.timeliness_records AS row WHERE id IN (${current.incident.id}, ${legacyId})),
        'workflows', (SELECT jsonb_agg(to_jsonb(row) ORDER BY record_type, id) FROM threat_intel.workflow_records AS row WHERE id = 'snapshot_incident_lineage')
      ) AS snapshot
    `)[0].snapshot;
    const graphBeforeProtectedAbort = await protectedGraph();
    const protectedClaimBefore = await admin`SELECT to_jsonb(row) AS record FROM threat_intel.intelligence_claims AS row WHERE id = 'claim_invalid_protected'`;

    await expect(PostgresScraperStore.create({ databaseUrl })).rejects.toThrow("pseudo-incident contains reviewed or protected analyst data");
    expect(await protectedGraph()).toEqual(graphBeforeProtectedAbort);
    expect(await admin`SELECT to_jsonb(row) AS record FROM threat_intel.intelligence_claims AS row WHERE id = 'claim_invalid_protected'`).toEqual(protectedClaimBefore);
    expect(await admin`SELECT old_incident_id FROM threat_intel.incident_identity_history`).toHaveLength(0);

    await admin`DELETE FROM threat_intel.evaluation_labels WHERE claim_id = 'claim_invalid_protected'`;
    await admin`DELETE FROM threat_intel.validation_records WHERE claim_id = 'claim_invalid_protected'`;
    await admin`DELETE FROM threat_intel.claim_reviews WHERE claim_id = 'claim_invalid_protected'`;
    await admin`DELETE FROM threat_intel.intelligence_claims WHERE id = 'claim_invalid_protected'`;

    const migrated = await PostgresScraperStore.create({ databaseUrl });
    await migrated.close();

    const incidents = await admin<{ id: string; record: any }[]>`SELECT id, record FROM threat_intel.incidents ORDER BY id`;
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({ id: current.incident.id, record: { revisionCount: 2 } });
    const [lineage] = await admin<any[]>`
      SELECT logical_incident_count::int, revision_count::int,
        duplicate_revision_count::int, revised_incident_count::int
      FROM threat_intel.incident_lineage_metrics
    `;
    expect(lineage).toMatchObject({ logical_incident_count: 1, revision_count: 2, duplicate_revision_count: 1, revised_incident_count: 1 });
    const history = await admin<{ old_incident_id: string; action: string; invalid_reason: string | null }[]>`
      SELECT old_incident_id, action, invalid_reason FROM threat_intel.incident_identity_history ORDER BY old_incident_id
    `;
    expect(history).toEqual([
      { old_incident_id: current.incident.id, action: "already_canonical", invalid_reason: null },
      { old_incident_id: legacyId, action: "merged", invalid_reason: null },
      { old_incident_id: invalidId, action: "invalid_archived", invalid_reason: "parser_fallback" }
    ].sort((a, b) => a.old_incident_id.localeCompare(b.old_incident_id)));
    expect(await admin`SELECT id FROM threat_intel.evidence_links WHERE capture_id = ${current.capture.id} AND subject_type = 'incident' AND subject_id = ${current.incident.id} AND relationship = ${originalLink.relationship}`).toHaveLength(1);
    expect(await admin`SELECT id FROM threat_intel.evidence_links WHERE id = 'evidence-link_preexisting_dangling'`).toHaveLength(0);
    expect(await admin`SELECT id FROM threat_intel.timeliness_records WHERE incident_id = ${current.incident.id}`).toHaveLength(1);
    expect((await admin<{ incident_id?: string }[]>`SELECT incident_id FROM threat_intel.entities WHERE id = 'entity_legacy_lineage'`)[0].incident_id).toBe(current.incident.id);
    expect((await admin<{ incident_id?: string }[]>`SELECT incident_id FROM threat_intel.entities WHERE id = 'entity_invalid_lineage'`)[0].incident_id).toBeNull();
    expect(await admin`SELECT id FROM threat_intel.intelligence_claims WHERE id = 'claim_invalid_needs_review'`).toHaveLength(0);
    const [invalidHistory] = await admin<{ reference_snapshot: any }[]>`SELECT reference_snapshot FROM threat_intel.incident_identity_history WHERE old_incident_id = ${invalidId}`;
    expect(invalidHistory.reference_snapshot.claims.map((claim: any) => claim.id)).toContain('claim_invalid_needs_review');
    expect(invalidHistory.reference_snapshot.claimEvidence.map((evidence: any) => evidence.id)).toContain('claim-evidence_invalid_cross_subject');
    const [workflow] = await admin<{ record: any }[]>`SELECT record FROM threat_intel.workflow_records WHERE id = 'snapshot_incident_lineage'`;
    expect(workflow.record.incidentIds).toEqual([current.incident.id]);
    expect(workflow.record).not.toHaveProperty('subjectId');
    const [dangling] = await admin<{ count: number }[]>`
      SELECT (
        (SELECT count(*) FROM threat_intel.entities WHERE incident_id = ${invalidId})
        + (SELECT count(*) FROM threat_intel.indicators WHERE incident_id = ${invalidId})
        + (SELECT count(*) FROM threat_intel.evidence_links WHERE subject_type = 'incident' AND subject_id = ${invalidId})
        + (SELECT count(*) FROM threat_intel.intelligence_claims WHERE subject_type = 'incident' AND subject_id = ${invalidId})
        + (SELECT count(*) FROM threat_intel.claim_evidence WHERE subject_type = 'incident' AND subject_id = ${invalidId})
        + (SELECT count(*) FROM threat_intel.timeliness_records WHERE incident_id = ${invalidId})
        + (SELECT count(*) FROM threat_intel.workflow_records WHERE record->>'incidentId' = ${invalidId} OR record->>'promotedToIncidentId' = ${invalidId} OR (record->>'subjectType' = 'incident' AND record->>'subjectId' = ${invalidId}) OR (jsonb_typeof(record->'incidentIds') = 'array' AND (record->'incidentIds') ? ${invalidId}))
      )::int AS count
    `;
    expect(dangling.count).toBe(0);

    const [reversal] = await admin<{ result: any }[]>`
      SELECT threat_intel.reverse_incident_identity_merge(${legacyId}, 'analyst_test', 'Incorrect historical merge confirmed by source review') AS result
    `;
    expect(reversal.result).toMatchObject({ oldIncidentId: legacyId, canonicalIncidentId: current.incident.id, status: "reversed" });
    expect((await admin<{ incident_id: string }[]>`SELECT incident_id FROM threat_intel.entities WHERE id = 'entity_legacy_lineage'`)[0].incident_id).toBe(legacyId);
    expect((await admin<{ subject_id: string }[]>`SELECT subject_id FROM threat_intel.evidence_links WHERE id = 'evidence-link_legacy_lineage'`)[0].subject_id).toBe(legacyId);
    expect((await admin<{ subject_id: string }[]>`SELECT subject_id FROM threat_intel.intelligence_claims WHERE id = 'claim_legacy_lineage'`)[0].subject_id).toBe(legacyId);
    expect((await admin<{ subject_id: string }[]>`SELECT subject_id FROM threat_intel.claim_evidence WHERE id = 'claim-evidence_legacy_lineage'`)[0].subject_id).toBe(legacyId);
    expect((await admin<{ incident_id: string }[]>`SELECT incident_id FROM threat_intel.timeliness_records WHERE id = ${legacyId}`)[0].incident_id).toBe(legacyId);
    expect((await admin<{ ids: string[] }[]>`SELECT ARRAY(SELECT jsonb_array_elements_text(record->'incidentIds')) AS ids FROM threat_intel.workflow_records WHERE id = 'snapshot_incident_lineage'`)[0].ids).toEqual([current.incident.id, legacyId].sort());
  });

  test("persists real delivery outcomes and repairs event times from capture provenance", async () => {
    const store = await PostgresScraperStore.create({ databaseUrl });
    store.saveSource(source({ id: "src_seed_ransomwarelive_victims" }));

    const verified = processCollectedItem({
      sourceId: "src_seed_ransomwarelive_victims",
      url: "https://www.ransomware.live/id/verified",
      title: "Akira has just published a new victim: Verified Industries",
      collectedAt: "2026-07-21T11:38:57.330Z",
      publishedAt: "2026-07-21T11:29:27.000Z",
      rawText: "Akira claims victim Verified Industries in a public victim feed.",
      contentHash: hashContent("verified-publication"),
      links: [],
      metadata: {
        exposureClaim: true,
        sourceFamily: "darkweb_metadata",
        extractionProfile: "ransomware_victim_blog",
        leakSite: { actorName: "Akira", victimName: "Verified Industries" },
        reportTimestamps: [{ role: "publisher", timestamp: "2026-07-21T11:29:27.000Z", sourceId: "src_seed_ransomwarelive_victims", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }]
      },
      sensitive: true
    });
    const unknown = processCollectedItem({
      sourceId: "src_seed_ransomwarelive_victims",
      url: "https://www.ransomware.live/id/unknown",
      title: "Akira has just published a new victim: Unknown Industries",
      collectedAt: "2026-07-21T12:38:57.330Z",
      rawText: "Akira claims victim Unknown Industries in a public victim feed.",
      contentHash: hashContent("unknown-publication"),
      links: [],
      metadata: {
        exposureClaim: true,
        sourceFamily: "darkweb_metadata",
        extractionProfile: "ransomware_victim_blog",
        leakSite: { actorName: "Akira", victimName: "Unknown Industries" }
      },
      sensitive: true
    });
    const savedVerified = store.savePipelineResult(verified);
    const savedUnknown = store.savePipelineResult(unknown);
    const alertCreatedAt = "2026-07-22T12:42:56.741Z";
    store.saveDwmAlert({
      id: "dwm_alert_delivery_projection",
      tenantId: "tenant_delivery",
      savedAt: alertCreatedAt,
      alertCreatedAt,
      workflowContext: { captureIds: [savedVerified.capture.id] },
      provenance: { captureIds: [savedVerified.capture.id] }
    });
    await store.flush();
    await store.close();

    // Keep a writer hydrated before the API-owned delivery trigger runs. A later
    // collection write must not erase delivery stages persisted behind its back.
    const staleWriter = await PostgresScraperStore.create({ databaseUrl });

    const delivery = (id: string, status: string, attemptedAt: string | null, completedAt: string | null, deliveredAt: string | null, responseStatus: number | null) => ({
      id,
      owner_id: "owner_delivery",
      org_id: "tenant_delivery",
      destination_id: "destination_delivery",
      alert_id: "dwm_alert_delivery_projection",
      event_type: "dwm.alert.created",
      status,
      dry_run: false,
      response_status: responseStatus,
      attempt_count: id === "delivery_failed" ? 1 : 2,
      idempotency_key: "delivery-idempotency",
      attempted_at: attemptedAt,
      completed_at: completedAt,
      delivered_at: deliveredAt,
      created_at: completedAt ?? "2026-07-22T12:46:29.529Z",
      updated_at: completedAt ?? "2026-07-22T12:46:29.529Z"
    });
    const failed = delivery("delivery_failed", "failed", "2026-07-22T12:45:04.000Z", "2026-07-22T12:45:04.688Z", null, 404);
    const delivered = delivery("delivery_delivered", "delivered", "2026-07-22T12:46:17.000Z", "2026-07-22T12:46:18.034Z", "2026-07-22T12:46:18.034Z", 202);
    const deliveredLater = delivery("delivery_delivered_later", "delivered", "2026-07-22T14:53:21.386Z", "2026-07-22T14:53:21.415Z", "2026-07-22T14:53:21.415Z", 202);
    const skipped = delivery("delivery_skipped", "skipped", null, null, null, null);
    for (const row of [failed, delivered, skipped, deliveredLater, failed]) {
      await admin`SELECT threat_intel.persist_public_dwm_delivery(${row}::jsonb)`;
    }
    staleWriter.savePipelineResult(verified);
    await staleWriter.flush();
    await staleWriter.close();
    expect((await admin<{ record: any }[]>`
      SELECT record FROM threat_intel.timeliness_records WHERE incident_id = ${savedVerified.incident!.id}
    `)[0].record).toMatchObject({
      deliveryAttemptProvenance: { deliveryId: "delivery_failed" },
      deliveredProvenance: { deliveryId: "delivery_delivered" },
      latencies: { alertToDeliveryAttemptSeconds: 127, deliveryAttemptToDeliveredSeconds: 74, reportToDeliveredSeconds: 91011 }
    });

    const staleProcessedAt = "2026-07-23T13:59:35.445Z";
    await admin`
      UPDATE threat_intel.captures
      SET published_at = collected_at,
          record = record || jsonb_build_object('publishedAt', collected_at)
      WHERE id IN (${savedVerified.capture.id}, ${savedUnknown.capture.id})
    `;
    await admin`
      INSERT INTO threat_intel.captures (
        id, tenant_id, source_id, task_id, url, canonical_url, collected_at, published_at, processed_at, first_visible_at,
        content_hash, normalized_text_hash, media_type, storage_kind, body, object_ref,
        sensitive, retention_class, extractor_version, record
      )
      SELECT
        'capture_historical_publication_copy', tenant_id, source_id, task_id, url || '?historical=1', canonical_url || '?historical=1',
        collected_at + interval '20 minutes', collected_at + interval '20 minutes',
        processed_at + interval '20 minutes', first_visible_at + interval '20 minutes',
        'historical-publication-content', 'historical-publication-text', media_type, storage_kind, body || ' Historical snapshot.', object_ref,
        sensitive, retention_class, extractor_version,
        record || jsonb_build_object(
          'id', 'capture_historical_publication_copy',
          'collectedAt', collected_at + interval '20 minutes',
          'publishedAt', collected_at + interval '20 minutes',
          'contentHash', 'historical-publication-content',
          'normalizedTextHash', 'historical-publication-text',
          'body', (record->>'body') || ' Historical snapshot.'
        )
      FROM threat_intel.captures
      WHERE id = ${savedVerified.capture.id}
    `;
    await admin`
      UPDATE threat_intel.incidents
      SET published_at = collected_at,
          processed_at = ${staleProcessedAt},
          record = record || jsonb_build_object('publishedAt', collected_at, 'processedAt', ${staleProcessedAt}::timestamptz)
      WHERE id IN (${savedVerified.incident!.id}, ${savedUnknown.incident!.id})
    `;
    await admin`
      UPDATE threat_intel.timeliness_records
      SET published_at = collected_at,
          processed_at = ${staleProcessedAt},
          record = record || jsonb_build_object(
            'publishedAt', collected_at,
            'processedAt', ${staleProcessedAt}::timestamptz,
            'timestampAnomalies', '["processed_after_visibility"]'::jsonb
          )
      WHERE incident_id IN (${savedVerified.incident!.id}, ${savedUnknown.incident!.id})
    `;
    await admin`
      UPDATE threat_intel.timeliness_records
      SET record = record || jsonb_build_object(
        'captureId', 'capture_historical_publication_copy',
        'timestampAnomalies', '[]'::jsonb
      )
      WHERE incident_id = ${savedVerified.incident!.id}
    `;
    await admin`
      UPDATE threat_intel.timeliness_records AS timeliness
      SET published_at = ${"2026-07-21T11:29:27.000Z"},
          processed_at = capture.processed_at,
          record = timeliness.record || jsonb_build_object('publishedAt', ${"2026-07-21T11:29:27.000Z"}::timestamptz, 'processedAt', capture.processed_at)
      FROM threat_intel.captures AS capture
      WHERE timeliness.incident_id = ${savedVerified.incident!.id}
        AND capture.id = timeliness.capture_id
    `;
    await admin`
      UPDATE threat_intel.timeliness_records
      SET record = jsonb_set(record - 'alertCreatedProvenance' - 'deliveryAttemptProvenance' - 'deliveredProvenance', '{latencies}', COALESCE(record->'latencies', '{}'::jsonb) || jsonb_build_object(
        'alertToDeliveryAttemptSeconds', 9999,
        'deliveryAttemptToDeliveredSeconds', 9999,
        'reportToDeliveredSeconds', 9999
      ))
      WHERE incident_id = ${savedVerified.incident!.id}
    `;
    await admin`
      UPDATE threat_intel.incidents AS incident
      SET published_at = ${"2026-07-21T11:29:27.000Z"},
          processed_at = capture.processed_at,
          record = incident.record || jsonb_build_object('publishedAt', ${"2026-07-21T11:29:27.000Z"}::timestamptz, 'processedAt', capture.processed_at)
      FROM threat_intel.captures AS capture
      WHERE incident.id = ${savedVerified.incident!.id}
        AND capture.id = incident.capture_id
    `;
    await admin`DELETE FROM threat_intel.schema_migrations WHERE version IN ('023_reconcile_delivery_and_event_times', '024_finish_timestamp_backfill', '025_reconcile_timeliness_capture', '026_align_timeliness_capture_record', '027_reconcile_delivery_latencies')`;

    const restarted = await PostgresScraperStore.create({ databaseUrl });
    restarted.savePipelineResult({
      ...verified,
      capture: {
        ...savedVerified.capture,
        id: "capture_verified_followup",
        url: "https://www.ransomware.live/id/verified/followup",
        canonicalUrl: "https://www.ransomware.live/id/verified/followup",
        contentHash: hashContent("verified-publication-followup"),
        normalizedTextHash: hashContent("verified-publication-followup-text"),
        collectedAt: "2026-07-22T14:51:14.400Z",
        processedAt: "2026-07-22T14:51:14.414Z",
        firstVisibleAt: "2026-07-22T14:51:14.451Z"
      },
      incident: {
        ...savedVerified.incident!,
        captureId: "capture_verified_followup",
        collectedAt: "2026-07-22T14:51:14.400Z",
        processedAt: "2026-07-22T14:51:14.414Z",
        firstVisibleAt: "2026-07-22T14:51:14.451Z",
        updatedAt: "2026-07-22T14:51:14.451Z"
      },
      entities: [],
      indicators: []
    });
    await restarted.flush();
    await restarted.close();

    expect(await admin<{ id: string; status: string }[]>`
      SELECT id, record->>'status' AS status
      FROM threat_intel.workflow_records
      WHERE record_type = 'dwm_webhook_delivery'
      ORDER BY id
    `).toEqual([
      { id: "delivery_delivered", status: "delivered" },
      { id: "delivery_delivered_later", status: "delivered" },
      { id: "delivery_failed", status: "failed" },
      { id: "delivery_skipped", status: "skipped" }
    ]);
    expect((await admin<{ delivery_attempted_at: Date; delivered_at: Date; record: any }[]>`
      SELECT delivery_attempted_at, delivered_at, record
      FROM threat_intel.timeliness_records
      WHERE incident_id = ${savedVerified.incident!.id}
    `)[0]).toMatchObject({
      delivery_attempted_at: new Date("2026-07-22T12:45:04.000Z"),
      delivered_at: new Date("2026-07-22T12:46:18.034Z"),
      record: {
        deliveryAttemptProvenance: { deliveryId: "delivery_failed", status: "failed" },
        deliveredProvenance: { deliveryId: "delivery_delivered", httpStatus: 202 },
        latencies: {
          alertToDeliveryAttemptSeconds: 127,
          deliveryAttemptToDeliveredSeconds: 74,
          reportToDeliveredSeconds: 91011
        }
      }
    });
    expect(await admin`
      SELECT id
      FROM threat_intel.timeliness_records
      WHERE (alert_created_at IS NOT NULL AND delivery_attempted_at IS NOT NULL
          AND record #> '{latencies,alertToDeliveryAttemptSeconds}' IS DISTINCT FROM to_jsonb(round(extract(epoch FROM delivery_attempted_at - alert_created_at))::bigint))
         OR (delivery_attempted_at IS NOT NULL AND delivered_at IS NOT NULL
          AND record #> '{latencies,deliveryAttemptToDeliveredSeconds}' IS DISTINCT FROM to_jsonb(round(extract(epoch FROM delivered_at - delivery_attempted_at))::bigint))
         OR (first_reported_at IS NOT NULL AND delivered_at IS NOT NULL
          AND record #> '{latencies,reportToDeliveredSeconds}' IS DISTINCT FROM to_jsonb(round(extract(epoch FROM delivered_at - first_reported_at))::bigint))
    `).toHaveLength(0);
    expect(await admin`
      SELECT incident.id, incident.processed_at, capture.processed_at
      FROM threat_intel.incidents AS incident
      JOIN threat_intel.captures AS capture ON capture.id = incident.capture_id
      WHERE incident.id IN (${savedVerified.incident!.id}, ${savedUnknown.incident!.id})
        AND incident.processed_at <> capture.processed_at
    `).toHaveLength(0);
    expect(await admin`
      SELECT timeliness.id
      FROM threat_intel.timeliness_records AS timeliness
      JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
      WHERE timeliness.incident_id IN (${savedVerified.incident!.id}, ${savedUnknown.incident!.id})
        AND (timeliness.processed_at <> capture.processed_at OR timeliness.record->'timestampAnomalies' ? 'processed_after_visibility')
    `).toHaveLength(0);
    const [persistedTiming] = await admin<{ capture_id: string; record: any }[]>`
      SELECT capture_id, record
      FROM threat_intel.timeliness_records
      WHERE incident_id = ${savedVerified.incident!.id}
    `;
    expect(persistedTiming).toMatchObject({
      capture_id: savedVerified.capture.id,
      record: {
        captureId: savedVerified.capture.id,
        processedAt: savedVerified.capture.processedAt,
        firstVisibleAt: savedVerified.capture.firstVisibleAt
      }
    });
    expect(persistedTiming.record.timestampAnomalies).not.toContain("processed_after_visibility");
    expect((await admin<{ incident_id: string; capture_published_at: Date | null; incident_published_at: Date | null; timeliness_published_at: Date | null }[]>`
      SELECT timeliness.incident_id,
             capture.published_at AS capture_published_at,
             incident.published_at AS incident_published_at,
             timeliness.published_at AS timeliness_published_at
      FROM threat_intel.timeliness_records AS timeliness
      JOIN threat_intel.captures AS capture ON capture.id = timeliness.capture_id
      JOIN threat_intel.incidents AS incident ON incident.id = timeliness.incident_id
      WHERE timeliness.incident_id IN (${savedVerified.incident!.id}, ${savedUnknown.incident!.id})
      ORDER BY timeliness.incident_id
    `).sort((left, right) => left.incident_id === savedVerified.incident!.id ? -1 : right.incident_id === savedVerified.incident!.id ? 1 : left.incident_id.localeCompare(right.incident_id))).toEqual([
      {
        incident_id: savedVerified.incident!.id,
        capture_published_at: null,
        incident_published_at: new Date("2026-07-21T11:29:27.000Z"),
        timeliness_published_at: new Date("2026-07-21T11:29:27.000Z")
      },
      {
        incident_id: savedUnknown.incident!.id,
        capture_published_at: null,
        incident_published_at: null,
        timeliness_published_at: null
      }
    ]);
    expect(await admin`
      SELECT id
      FROM threat_intel.captures
      WHERE id IN (${savedVerified.capture.id}, 'capture_historical_publication_copy')
        AND published_at IS NULL
      ORDER BY id
    `).toHaveLength(2);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '023_reconcile_delivery_and_event_times'`).toHaveLength(1);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '024_finish_timestamp_backfill'`).toHaveLength(1);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '025_reconcile_timeliness_capture'`).toHaveLength(1);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '026_align_timeliness_capture_record'`).toHaveLength(1);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '027_reconcile_delivery_latencies'`).toHaveLength(1);
  });

  test("removes generic business labels without deleting reviewed evidence", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
    installApt29Catalog(first);
    first.saveSource(source({ id: "src_business_label_cleanup" }));
    const result = first.savePipelineResult(pipeline("src_business_label_cleanup"));
    const profile = first.listActorProfiles().find((record: any) => record.canonicalName === "APT29");
    const entity = (id: string, type: string, value: string) => ({
      id,
      sourceId: result.capture.sourceId,
      captureId: result.capture.id,
      incidentId: result.incident.id,
      type,
      value,
      normalizedValue: value.toLowerCase(),
      confidence: 0.7,
      extractorVersion: "business-cleanup-regression",
      provenance: [{ sourceId: result.capture.sourceId, captureId: result.capture.id }]
    });
    const entities = [
      entity("entity_generic_channel", "channel_type", "metadata-only victim source"),
      entity("entity_generic_extortion", "extortion_type", "ransomware/extortion victim claim"),
      entity("entity_protected_extortion", "extortion_type", "leak-site extortion infrastructure"),
      entity("entity_literal_chat", "channel_type", "Chat")
    ];
    for (const record of entities) first.saveExtractedEntity(record);

    const claim = (id: string, claimType: string, subjectId: string, value: string, protectedClaim = false) => ({
      id,
      claimType,
      subjectType: "entity",
      subjectId,
      value: { value },
      summary: `${claimType}: ${value}`,
      confidence: 0.7,
      evidenceStage: "metadata_only_claim",
      extractionMethod: "source_field",
      extractorVersion: "business-cleanup-regression",
      reviewState: protectedClaim ? "confirmed" : "unreviewed",
      corroborationState: "single_source",
      sourceCount: 1,
      evidenceCount: 1,
      firstSeenAt: collectedAt,
      lastSeenAt: collectedAt,
      legalHold: protectedClaim,
      retentionClass: protectedClaim ? "legal_hold" : "standard"
    });
    const claims = [
      claim("claim_generic_channel", "channel_type", "entity_generic_channel", "metadata-only victim source"),
      claim("claim_generic_extortion", "extortion_type", "entity_generic_extortion", "ransomware/extortion victim claim"),
      claim("claim_protected_extortion", "extortion_type", "entity_protected_extortion", "leak-site extortion infrastructure", true),
      claim("claim_literal_chat", "channel_type", "entity_literal_chat", "Chat")
    ];
    for (const record of claims) {
      first.saveIntelligenceClaim(record);
      first.saveClaimEvidence({
        id: `claim-evidence_${record.id}`,
        claimId: record.id,
        captureId: result.capture.id,
        sourceId: result.capture.sourceId,
        subjectType: "entity",
        subjectId: record.subjectId,
        relationship: "supports",
        evidenceStage: record.evidenceStage,
        confidence: record.confidence,
        extractorVersion: record.extractorVersion,
        provenance: { sourceId: result.capture.sourceId, captureId: result.capture.id },
        createdAt: collectedAt
      });
      first.saveEvidenceLink({
        id: `evidence-link_${record.id}`,
        captureId: result.capture.id,
        subjectType: "claim",
        subjectId: record.id,
        relationship: "supports",
        confidence: record.confidence,
        extractorVersion: record.extractorVersion,
        createdAt: collectedAt
      });
      first.saveEvidenceLink({
        id: `evidence-link_${record.subjectId}`,
        captureId: result.capture.id,
        subjectType: "entity",
        subjectId: record.subjectId,
        relationship: "supports",
        confidence: record.confidence,
        extractorVersion: record.extractorVersion,
        createdAt: collectedAt
      });
    }
    first.saveEvaluationLabel({
      id: "label_protected_extortion",
      entityId: "entity_protected_extortion",
      claimId: "claim_protected_extortion",
      labelType: "business_signal_review",
      expectedValue: "leak-site extortion infrastructure",
      observedValue: "leak-site extortion infrastructure",
      outcome: "correct",
      datasetSplit: "test",
      labeledBy: "analyst_test",
      labeledAt: collectedAt
    });
    await first.flush();
    await first.close();

    const [profileRow] = await admin<{ record: any }[]>`SELECT record FROM threat_intel.actor_profiles WHERE id = ${profile.id}`;
    profileRow.record.characterization = {
      ...(profileRow.record.characterization ?? {}),
      channelTypes: [
        { value: "metadata-only victim source", entityIds: ["entity_generic_channel"] },
        { value: "Chat", entityIds: ["entity_literal_chat"] }
      ],
      extortionTypes: [
        { value: "ransomware/extortion victim claim", entityIds: ["entity_generic_extortion"] },
        { value: "leak-site extortion infrastructure", entityIds: ["entity_protected_extortion"] },
        { value: "double extortion", entityIds: [] }
      ]
    };
    await admin`UPDATE threat_intel.actor_profiles SET record = ${JSON.stringify(profileRow.record)}::text::jsonb WHERE id = ${profile.id}`;
    await admin`DELETE FROM threat_intel.schema_migrations WHERE version = '028_remove_generic_business_labels'`;

    const migrated = await PostgresScraperStore.create({ databaseUrl });
    await migrated.close();

    expect((await admin<{ id: string }[]>`
      SELECT id FROM threat_intel.entities
      WHERE id LIKE 'entity_generic_%' OR id IN ('entity_protected_extortion', 'entity_literal_chat')
      ORDER BY id
    `).map((row) => row.id)).toEqual(["entity_literal_chat", "entity_protected_extortion"]);
    expect((await admin<{ id: string }[]>`
      SELECT id FROM threat_intel.intelligence_claims
      WHERE id LIKE 'claim_generic_%' OR id IN ('claim_protected_extortion', 'claim_literal_chat')
      ORDER BY id
    `).map((row) => row.id)).toEqual(["claim_literal_chat", "claim_protected_extortion"]);
    expect((await admin<{ id: string }[]>`
      SELECT id FROM threat_intel.claim_evidence WHERE id LIKE 'claim-evidence_claim_%' ORDER BY id
    `).map((row) => row.id)).toEqual(["claim-evidence_claim_literal_chat", "claim-evidence_claim_protected_extortion"]);
    expect((await admin<{ id: string }[]>`
      SELECT id FROM threat_intel.evidence_links
      WHERE id LIKE 'evidence-link_claim_%' OR id LIKE 'evidence-link_entity_generic_%'
        OR id IN ('evidence-link_entity_protected_extortion', 'evidence-link_entity_literal_chat')
      ORDER BY id
    `).map((row) => row.id)).toEqual([
      "evidence-link_claim_literal_chat",
      "evidence-link_claim_protected_extortion",
      "evidence-link_entity_literal_chat",
      "evidence-link_entity_protected_extortion"
    ]);
    expect(await admin`SELECT id FROM threat_intel.evaluation_labels WHERE id = 'label_protected_extortion'`).toHaveLength(1);

    const [migratedProfile] = await admin<{ record: any }[]>`SELECT record FROM threat_intel.actor_profiles WHERE id = ${profile.id}`;
    expect(migratedProfile.record.characterization.channelTypes.map((entry: any) => entry.value)).toEqual(["Chat"]);
    expect(migratedProfile.record.characterization.extortionTypes.map((entry: any) => entry.value)).toEqual(["leak-site extortion infrastructure", "double extortion"]);
    const [dangling] = await admin<{ count: number }[]>`
      SELECT (
        (SELECT count(*) FROM threat_intel.evidence_links AS link LEFT JOIN threat_intel.entities AS entity ON entity.id = link.subject_id WHERE link.subject_type = 'entity' AND entity.id IS NULL)
        + (SELECT count(*) FROM threat_intel.evidence_links AS link LEFT JOIN threat_intel.intelligence_claims AS claim ON claim.id = link.subject_id WHERE link.subject_type = 'claim' AND claim.id IS NULL)
        + (SELECT count(*) FROM threat_intel.claim_evidence AS evidence LEFT JOIN threat_intel.entities AS entity ON entity.id = evidence.subject_id WHERE evidence.subject_type = 'entity' AND entity.id IS NULL)
        + (SELECT count(*) FROM threat_intel.evaluation_labels AS label LEFT JOIN threat_intel.entities AS entity ON entity.id = label.entity_id WHERE label.entity_id IS NOT NULL AND entity.id IS NULL)
      )::int AS count
    `;
    expect(dangling.count).toBe(0);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '028_remove_generic_business_labels'`).toHaveLength(1);

    const snapshot = await admin`
      SELECT record FROM (
        SELECT record FROM threat_intel.actor_profiles WHERE id = ${profile.id}
        UNION ALL
        SELECT record FROM threat_intel.entities WHERE id IN ('entity_protected_extortion', 'entity_literal_chat')
        UNION ALL
        SELECT record FROM threat_intel.intelligence_claims WHERE id IN ('claim_protected_extortion', 'claim_literal_chat')
      ) AS retained
      ORDER BY record->>'id'
    `;
    const restarted = await PostgresScraperStore.create({ databaseUrl });
    await restarted.close();
    expect(await admin`
      SELECT record FROM (
        SELECT record FROM threat_intel.actor_profiles WHERE id = ${profile.id}
        UNION ALL
        SELECT record FROM threat_intel.entities WHERE id IN ('entity_protected_extortion', 'entity_literal_chat')
        UNION ALL
        SELECT record FROM threat_intel.intelligence_claims WHERE id IN ('claim_protected_extortion', 'claim_literal_chat')
      ) AS retained
      ORDER BY record->>'id'
    `).toEqual(snapshot);
  });

  test("imports the legacy JSON snapshot once and then uses PostgreSQL", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ti-legacy-cutover-"));
    const snapshotPath = join(directory, "scraper-store.json");
    try {
      const legacy = new FileBackedScraperStore({ snapshotPath });
      installApt29Catalog(legacy);
      legacy.saveSource(source({ id: "src_legacy", tenantId: "tenant_legacy" }));
      const result = legacy.savePipelineResult(pipeline("src_legacy", "tenant_legacy"));
      legacy.saveDwmAlert({
        id: "alert_legacy",
        tenantId: "tenant_legacy",
        dedupeKey: "apt29:legacy",
        severity: "medium",
        confidence: 75,
        reviewState: "unreviewed",
        deliveryState: "pending_review",
        firstSeenAt: collectedAt,
        lastSeenAt: collectedAt,
        updatedAt: collectedAt,
        incidentId: result.incident.id
      });

      const first = await PostgresScraperStore.create({ databaseUrl });
      expect(await first.importLegacySnapshot(snapshotPath)).toMatchObject({ imported: true, reason: "legacy_snapshot_imported" });
      await first.close();

      const second = await PostgresScraperStore.create({ databaseUrl });
      expect(second.listSources().map((record: any) => record.id)).toEqual(["src_actor_catalog", "src_legacy"]);
      expect(second.listCaptures().map((record: any) => record.id)).toContain(result.capture.id);
      expect(second.listActorProfiles().some((profile: any) => profile.canonicalName === "APT29")).toBe(true);
      expect(second.listDwmAlerts().map((record: any) => record.id)).toEqual(["alert_legacy"]);
      expect(await second.importLegacySnapshot(snapshotPath)).toMatchObject({ imported: false, reason: "database_not_empty" });
      await second.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("retires obsolete source rows without losing evidence or inventing last-seen timestamps", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
    first.saveSource(source({ id: "src_gen_google_0001", url: "https://news.google.com/rss/search?q=gate2" }));
    const captured = first.savePipelineResult(pipeline("src_gen_google_0001"));
    first.saveSourceHealthObservation({
      id: "health_google_success",
      sourceId: "src_gen_google_0001",
      checkedAt: "2026-07-21T12:00:00.000Z",
      status: "healthy",
      success: true,
      useful: true,
      latencyMs: 10,
      itemCount: 1,
      captureCount: 1,
      incidentCount: 1,
      duplicateCount: 0,
      parserWarningCount: 0,
      observedActorCount: 1,
      legalMode: "public_content"
    });
    first.saveSource(source({ id: "src_gen_gdelt_0001", url: "https://api.gdeltproject.org/api/v2/doc/doc?query=gate2", status: "candidate" }));
    first.saveSourceHealthObservation({
      id: "health_gdelt_failure",
      sourceId: "src_gen_gdelt_0001",
      checkedAt: "2026-07-21T13:00:00.000Z",
      status: "failed",
      success: false,
      useful: false,
      latencyMs: 10,
      itemCount: 0,
      captureCount: 0,
      incidentCount: 0,
      duplicateCount: 0,
      parserWarningCount: 0,
      observedActorCount: 0,
      legalMode: "public_content"
    });
    await first.close();

    await admin`DELETE FROM threat_intel.schema_migrations WHERE version = '022_reconcile_source_fleet'`;
    const migrated = await PostgresScraperStore.create({ databaseUrl });
    await migrated.close();

    expect((await admin<{ status: string; last_seen_at: Date | null; record: any }[]>`
      SELECT status, last_seen_at, record FROM threat_intel.sources WHERE id = 'src_gen_google_0001'
    `)[0]).toMatchObject({
      status: "retired",
      last_seen_at: new Date("2026-07-21T12:00:00.000Z"),
      record: { status: "retired", metadata: { productionCollection: false, retiredReason: "query_variant_replaced_by_canonical_provider_jobs" } }
    });
    expect((await admin<{ status: string; last_seen_at: Date | null }[]>`
      SELECT status, last_seen_at FROM threat_intel.sources WHERE id = 'src_gen_gdelt_0001'
    `)[0]).toEqual({ status: "retired", last_seen_at: null });
    expect(await admin`SELECT id FROM threat_intel.captures WHERE id = ${captured.capture.id} AND source_id = 'src_gen_google_0001'`).toHaveLength(1);
    expect(await admin`SELECT version FROM threat_intel.schema_migrations WHERE version = '022_reconcile_source_fleet'`).toHaveLength(1);

    const snapshot = await admin`SELECT status, last_seen_at, updated_at, record FROM threat_intel.sources ORDER BY id`;
    const restarted = await PostgresScraperStore.create({ databaseUrl });
    await restarted.close();
    expect(await admin`SELECT status, last_seen_at, updated_at, record FROM threat_intel.sources ORDER BY id`).toEqual(snapshot);
  });
});

function pipeline(sourceId: string, tenantId?: string, suffix = "") {
  const rawText = `APT29 used phishing against Northwind Health with CVE-2026-1234.${suffix}`;
  const publishedAt = "2026-05-24T09:58:00.000Z";
  const result = processCollectedItem({
    sourceId,
    url: `https://example.test/${sourceId}/report`,
    collectedAt,
    publishedAt,
    rawText,
    contentHash: hashContent(rawText),
    links: [],
    metadata: { reportTimestamps: [{ role: "publisher", timestamp: publishedAt, sourceId, evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] },
    sensitive: false
  });
  if (tenantId) {
    result.capture.tenantId = tenantId;
    result.capture.provenance.tenantId = tenantId;
    if (result.incident) result.incident.tenantId = tenantId;
  }
  return result;
}

function catalogCapture(id: string, contentHash: string) {
  return {
    id,
    sourceId: "src_actor_catalog",
    url: `https://catalog.example/${contentHash}`,
    collectedAt,
    mediaType: "application/json",
    storageKind: "metadata_only",
    contentHash,
    sensitive: false,
    metadata: { extractionProfile: "mitre_actor_catalog", catalogEvidenceOnly: true }
  } as any;
}

function installApt29Catalog(store: any) {
  store.saveSource(source({ id: "src_actor_catalog", name: "Authoritative actor catalog", url: "https://catalog.example/enterprise-attack.json" }));
  store.saveCapture(catalogCapture("cap_actor_catalog_apt29", "catalog-apt29-v1"));
  store.replaceActorIdentityCatalog(actorCatalog([actorIdentity("G0016", "APT29", ["Cozy Bear"])]), {
    sourceId: "src_actor_catalog",
    captureId: "cap_actor_catalog_apt29",
    importedAt: collectedAt
  });
}

function actorCatalog(identities: any[], bundleSha256 = "catalog-v1") {
  return {
    schemaVersion: "ti.actor_identity_catalog.v1",
    catalogId: "mitre-attack-enterprise",
    catalogName: "Enterprise ATT&CK",
    catalogVersion: "test-version",
    catalogModifiedAt: collectedAt,
    sourceUrl: "https://catalog.example/enterprise-attack.json",
    bundleId: `bundle--${bundleSha256}`,
    bundleSha256,
    retrievedAt: collectedAt,
    counts: {
      totalIdentityCount: identities.length,
      currentIdentityCount: identities.length,
      deprecatedIdentityCount: 0,
      revokedIdentityCount: 0,
      aptNumberDesignationPresentCount: 0,
      associatedNameOccurrenceCount: identities.reduce((count, identity) => count + identity.associatedNames.length, 0),
      distinctAssociatedNameCount: identities.reduce((count, identity) => count + identity.associatedNames.length, 0),
      distinctLookupLabelCount: identities.reduce((count, identity) => count + identity.associatedNames.length + 1, 0),
      aliasCollisionCount: 0
    },
    identities,
    aliasCollisions: []
  };
}

function actorIdentity(externalId: string, canonicalName: string, associatedNames: string[]) {
  return {
    id: `mitre-attack-enterprise:${externalId}`,
    catalogId: "mitre-attack-enterprise",
    externalId,
    stixId: `intrusion-set--${externalId.toLowerCase()}`,
    canonicalName,
    normalizedCanonicalName: canonicalName.toLowerCase(),
    associatedNames,
    status: "current",
    aptNumberDesignationPresent: false,
    createdAt: collectedAt,
    modifiedAt: collectedAt,
    domains: ["enterprise-attack"],
    contributors: [],
    sourceUrl: `https://attack.mitre.org/groups/${externalId}/`,
    referenceUrls: [],
    catalogVersion: "test-version",
    catalogModifiedAt: collectedAt,
    bundleSha256: "identity-bundle",
    retrievedAt: collectedAt
  };
}

function actorProfileCapture(id: string, sourceId: string, tenantId?: string) {
  return {
    id, tenantId, sourceId, url: `https://example.test/${id}`, collectedAt,
    mediaType: "text/html", storageKind: "metadata_only", contentHash: hashContent(id),
    sensitive: false, metadata: { retentionPolicy: { class: "public_report" } }
  } as any;
}

function actorObservation(value: string, entityType: string, entityId: string, sourceId: string, captureId: string, confidence: number) {
  return {
    value, normalizedValue: value.toLowerCase(), entityType, confidence, assertionKind: "extracted",
    reviewReasons: [], firstSeenAt: collectedAt, lastSeenAt: collectedAt,
    entityIds: [entityId], sourceIds: [sourceId], captureIds: [captureId]
  };
}

function legacyActorProfile(id: string, tenantId: string | undefined, canonicalName: string, actorIdentityIds: string[], sourceIds: string[], captureIds: string[], characterization: Record<string, any[]> = {}) {
  return {
    id, tenantId, canonicalName, normalizedName: canonicalName.toLowerCase(), actorType: "apt",
    aliases: [canonicalName], actorIdentityIds, confidence: 0.8,
    firstSeenAt: "2026-07-18T00:00:00.000Z", lastSeenAt: "2026-07-20T00:00:00.000Z",
    evidenceCount: captureIds.length, sourceIds, captureIds, characterization, updatedAt: "2026-07-21T00:00:00.000Z"
  };
}

async function insertActorProfileEvidenceLink(admin: SQL, input: { id: string; tenantId?: string; captureId: string; subjectId: string }) {
  const record = { ...input, subjectType: "actor_profile", relationship: "characterizes", confidence: 0.8, extractorVersion: "test", createdAt: collectedAt };
  await admin`
    INSERT INTO threat_intel.evidence_links (
      id, tenant_id, capture_id, subject_type, subject_id, relationship,
      confidence, extractor_version, created_at, record
    ) VALUES (
      ${input.id}, ${input.tenantId ?? null}, ${input.captureId}, 'actor_profile', ${input.subjectId},
      'characterizes', 0.8, 'test', ${collectedAt}, ${JSON.stringify(record)}::text::jsonb
    )
  `;
}
