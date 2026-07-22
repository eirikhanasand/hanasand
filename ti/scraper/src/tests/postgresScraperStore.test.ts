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
    store.saveSource(source({ id: "src_governed", tenantId: "tenant_governed" }));
    const result = store.savePipelineResult(pipeline("src_governed", "tenant_governed"));
    const claim = store.listIntelligenceClaims().find((record: any) => record.claimType === "actor");
    const options = {
      store,
      frontier: new FocusedFrontier(),
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

  test("persists and rehydrates the complete monitoring record across restart", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
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
    expect(second.listCaptures()).toHaveLength(1);
    expect(second.listCaptures()[0]).toMatchObject({ retentionClass: "public_report", metadata: { retentionPolicy: { class: "public_report" } } });
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
    expect(counts).toMatchObject({ sources: 1, captures: 1, incidents: 1, claim_reviews: 1, validations: 1, alerts: 1, labels: 1, runs: 1, health: 1, timeliness: 1, legacy_runs: 0, legacy_claims: 0, public_core_tables: 0 });
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
    const skipped = delivery("delivery_skipped", "skipped", null, null, null, null);
    for (const row of [failed, delivered, skipped, failed]) {
      await admin`SELECT threat_intel.persist_public_dwm_delivery(${row}::jsonb)`;
    }

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
        content_hash, normalized_text_hash, media_type, storage_kind, body, object_ref,
        sensitive, retention_class, extractor_version,
        record || jsonb_build_object(
          'id', 'capture_historical_publication_copy',
          'collectedAt', collected_at + interval '20 minutes',
          'publishedAt', collected_at + interval '20 minutes'
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
      UPDATE threat_intel.timeliness_records AS timeliness
      SET published_at = ${"2026-07-21T11:29:27.000Z"},
          processed_at = capture.processed_at,
          record = timeliness.record || jsonb_build_object('publishedAt', ${"2026-07-21T11:29:27.000Z"}::timestamptz, 'processedAt', capture.processed_at)
      FROM threat_intel.captures AS capture
      WHERE timeliness.incident_id = ${savedVerified.incident!.id}
        AND capture.id = timeliness.capture_id
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
    await admin`DELETE FROM threat_intel.schema_migrations WHERE version IN ('023_reconcile_delivery_and_event_times', '024_finish_timestamp_backfill')`;

    const restarted = await PostgresScraperStore.create({ databaseUrl });
    await restarted.close();

    expect(await admin<{ id: string; status: string }[]>`
      SELECT id, record->>'status' AS status
      FROM threat_intel.workflow_records
      WHERE record_type = 'dwm_webhook_delivery'
      ORDER BY id
    `).toEqual([
      { id: "delivery_delivered", status: "delivered" },
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
        deliveredProvenance: { deliveryId: "delivery_delivered", httpStatus: 202 }
      }
    });
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
  });

  test("imports the legacy JSON snapshot once and then uses PostgreSQL", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ti-legacy-cutover-"));
    const snapshotPath = join(directory, "scraper-store.json");
    try {
      const legacy = new FileBackedScraperStore({ snapshotPath });
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
      expect(second.listSources().map((record: any) => record.id)).toEqual(["src_legacy"]);
      expect(second.listCaptures()).toHaveLength(1);
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
