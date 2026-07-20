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

    store.saveSource(source({ id: "src_corroborating" }));
    store.savePipelineResult(pipeline("src_corroborating"));
    expect(store.listIntelligenceClaims().find((claim: any) => claim.claimType === "actor")).toMatchObject({ sourceCount: 2, corroborationState: "corroborated" });
  });

  test("exposes validation and evaluation records through the JSON API", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_research" }));
    const result = store.savePipelineResult(pipeline("src_research"));
    const options = { store, frontier: new FocusedFrontier() };

    const validationResponse = await handleApiRequest(api("/v1/intel/validation-records", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
      headers: { "content-type": "application/json", "x-actor-id": "analyst_test" },
      body: JSON.stringify({ action: "confirm", reason: "Verified against the cited public report." })
    }), options);
    expect(reviewResponse.status).toBe(201);
    const labelResponse = await handleApiRequest(api("/v1/intel/evaluation-labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityId: entity.id,
        labelType: "actor_extraction",
        expectedValue: "APT29",
        observedValue: entity.value,
        outcome: "true_positive",
        datasetSplit: "test",
        labeledBy: "analyst_test",
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

  test("persists and rehydrates the complete monitoring record across restart", async () => {
    const first = await PostgresScraperStore.create({ databaseUrl });
    first.saveSource(source({ id: "src_postgres", tenantId: "tenant_postgres" }));
    const result = first.savePipelineResult(pipeline("src_postgres", "tenant_postgres"));
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
      updatedAt: collectedAt,
      incidentId: result.incident.id,
      alertedAt,
      company: "Northwind Health"
    });
    first.savePlan({ id: "plan_postgres", tenantId: "tenant_postgres", createdAt: collectedAt, requestId: "request_postgres" });
    first.saveRun({ id: "run_postgres", tenantId: "tenant_postgres", planId: "plan_postgres", requestId: "request_postgres", status: "completed", startedAt: collectedAt, completedAt: collectedAt, updatedAt: collectedAt, taskCount: 1, sourceCount: 1, captureCount: 1, incidentCount: 1, failedTaskCount: 0 });
    first.saveSourceHealthObservation({ id: "health_postgres", tenantId: "tenant_postgres", sourceId: "src_postgres", collectionRunId: "run_postgres", checkedAt: collectedAt, status: "healthy", success: true, useful: true, latencyMs: 120, itemCount: 1, captureCount: 1, incidentCount: 1, duplicateCount: 0, parserWarningCount: 0, observedActorCount: 1, legalMode: "public_content" });
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
    expect(second.listDwmAlerts()).toHaveLength(1);
    expect(second.listPlans()).toHaveLength(1);
    expect(second.listRuns()).toEqual([expect.objectContaining({ id: "run_postgres", status: "completed" })]);
    expect(second.listSourceHealthObservations()).toEqual([expect.objectContaining({ id: "health_postgres", useful: true })]);
    expect(second.listTimelinessRecords()).toEqual([expect.objectContaining({ incidentId: result.incident.id, alertedAt })]);

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

function pipeline(sourceId: string, tenantId?: string) {
  const rawText = "APT29 used phishing against Northwind Health with CVE-2026-1234.";
  const result = processCollectedItem({
    sourceId,
    url: `https://example.test/${sourceId}/report`,
    collectedAt,
    rawText,
    contentHash: hashContent(rawText),
    links: [],
    metadata: {},
    sensitive: false
  });
  if (tenantId) {
    result.capture.tenantId = tenantId;
    result.capture.provenance.tenantId = tenantId;
    if (result.incident) result.incident.tenantId = tenantId;
  }
  return result;
}
