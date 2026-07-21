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
