import { describe, expect, test } from "bun:test";
import { handleApiRequest, startApiServer } from "../api/server.ts";
import { loadRuntimeConfig } from "../config/runtimeConfig.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { createLogger } from "../ops/logger.ts";
import { MetricsRegistry } from "../ops/metrics.ts";
import { WorkerSupervisor } from "../ops/supervisor.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";
import { hashContent } from "../utils.ts";

import {
  api,
  apiRestrictedMetadataApplyPlanSources,
  body,
  fixtureCapture,
  fixtureDelta,
  restrictedMetadataApplyPlanSources,
  seedEvidenceReplayFixture,
  source,
  telegramCapture
} from "./helpers/apiFixtures.ts";

describe("api v1", () => {
  test("returns typed health and paginated sources", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "one" }));
    store.saveSource(source({ id: "two", name: "Second" }));
    const options = { store, frontier: new FocusedFrontier() };

    const health = await body(await handleApiRequest(api("/v1/health"), options));
    expect(health).toMatchObject({ ok: true, service: "ti-scraper", version: "v1" });

    const sources = await body(await handleApiRequest(api("/v1/sources?limit=1"), options));
    expect((sources.sources as unknown[])).toHaveLength(1);
    expect(sources.nextCursor).toBe("1");
  });

  test("executes approved public canary activation collection and exposes operator view", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async () => new Response(`
      <rss><channel><item>
        <title>APT42 phishing campaign and CVE-2026-11111 exploitation</title>
        <link>https://example.test/apt42-campaign</link>
        <description>APT42 used malware in a phishing campaign targeting energy sector victims. Indicator 198.51.100.44 observed.</description>
        <pubDate>Sun, 24 May 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>
    `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    const options = { store, frontier, objectStore, canaryFetch };

    const activationBlocked = await body(await handleApiRequest(api("/v1/sources/canary-activation", { method: "POST", body: "{}" }), options));
    expect((activationBlocked.error as { code: string }).code).toBe("approval_required");

    const activation = await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:00:00.000Z" })
    }), options));
    expect((activation.activation as { activated: unknown[] }).activated.length).toBeGreaterThanOrEqual(8);
    expect(store.listSources().every((item) => item.status === "active")).toBe(true);

    const run = await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", maxSources: 2, maxTasks: 1, generatedAt: "2026-05-24T10:01:00.000Z" })
    }), options));
    expect(run.canaryRun).toMatchObject({
      mode: "production_canary",
      completedTaskCount: 1,
      failedTaskCount: 0,
      insertedCaptureCount: 1
    });
    const captures = store.listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.storageKind).toBe("external_object");
    expect(captures[0]?.objectRef).toBeDefined();
    expect(captures[0]?.body).toBeUndefined();
    expect(String(captures[0]?.metadata.safeExcerpt)).toContain("APT42");
    expect(store.listIncidents().length).toBeGreaterThanOrEqual(1);
    expect(objectStore.getObject(captures[0]!.objectRef!)).toBeDefined();

    const operator = await body(await handleApiRequest(api("/v1/ops/canary"), options));
    const operatorView = operator.operatorView as { activeSources: unknown[]; latestCaptures: unknown[]; publicAnswerReadiness: Array<{ query: string; captureCount: number }> };
    expect(operatorView.activeSources.length).toBeGreaterThanOrEqual(8);
    expect(operatorView.latestCaptures).toHaveLength(1);
    expect(operatorView.publicAnswerReadiness.find((item) => item.query === "APT42")?.captureCount).toBe(1);

    const search = await body(await handleApiRequest(api("/v1/intel/search?q=APT42"), options));
    expect(search.status).toMatch(/ready|partial/);
    expect(JSON.stringify(search.publicTiAnswer)).toContain("public_answer_ux");
    expect(JSON.stringify(search.actorProfile)).toContain("APT42");
  });

  test("publishes enterprise contract index for CTI integration without unsafe example leaks", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const contract = await body(await handleApiRequest(api("/v1/contracts"), options));
    const surfaces = contract.surfaces as Array<{ name: string; path: string; responseKeys: string[]; guarantees: string[] }>;
    const routeInventory = contract.routeInventory as {
      count: number;
      source: string;
      routes: Array<{ method: string; path: string; surface: string; responseKeys: string[]; guarantees: string[] }>;
    };
    const routeTruthAudit = contract.routeTruthAudit as {
      schemaVersion: string;
      owner: string;
      expectedRouteInventoryCount: number;
      canonicalPublicPost: { path: string; method: string; mapsTo: string; stableFields: string[] };
      fixtures: Array<{ name: string; status: string; route: string; proofCommand: string; auditFields: string[]; publicPostCompatible: boolean; noLeakRequired: boolean; rollbackPath: string }>;
      proofCommands: string[];
      guarantee: string;
    };
    const publicWrapperResponsiveAudit = contract.publicWrapperResponsiveAudit as {
      schemaVersion: string;
      owner: string;
      route: string;
      publicWrapper: {
        canonicalMethod: string;
        canonicalPath: string;
        noDefaultQuery: boolean;
        stableRunIds: boolean;
        pollingSeconds: number;
        unknownCopy: string;
        updatedSemantics: string;
        stableFields: string[];
      };
      fixtures: Array<{
        name: string;
        query: string;
        queryClass: string;
        expectedUxState: string;
        expectedDisplayState: string;
        warningCodes: string[];
        pollSeconds: number;
        stableRunId: boolean;
        publicPostCompatible: boolean;
        noDefaultActor: boolean;
        noLeakRequired: boolean;
        noStaleCacheCopy: boolean;
        compactUnknownCopy?: string;
        stableFields: string[];
      }>;
      noLeakExamples: Array<{ scenario: string; forbidden: string[] }>;
      proofCommands: string[];
      guarantee: string;
    };
    const publicCompatibility = contract.publicCompatibility as {
      canonicalMethod: string;
      canonicalPublicPath: string;
      mapsTo: string;
      stableFields: string[];
      statusMapping: Record<string, string>;
      publicAnswerContract: {
        schemaVersion: string;
        field: string;
        nestedAnswerField: string;
        requiredSections: string[];
        safeWordingGuarantee: string;
      };
    };
    const semantics = contract.semantics as {
      idempotency: { header: string; route: string; behavior: string };
      cursorPolling: { responseFields: string[] };
      stateMachine: {
        schemaVersion: string;
        states: Record<string, { requiredFields: string[]; publicPromotion: string }>;
        requiredUiFields: string[];
      };
      publicAnswerReleaseCandidate: {
        schemaVersion: string;
        field: string;
        states: string[];
        queryClasses: string[];
        visibleAnswerInputs: string[];
        requiredUiFields: string[];
        fixtures: Array<{ state: string; query: string; queryClass: string; publicPostCompatible: boolean; agent10RcGate: string }>;
        agent10RcGate: { statuses: string[]; decisions: string[]; proofCommands: string[] };
        guarantee: string;
      };
      publicAnswerUxSemantics: {
        schemaVersion: string;
        field: string;
        states: string[];
        queryFixtures: Array<{ query: string; queryClass: string; expectedUxState: string }>;
        copyRules: { unknownQuery: string; bannedPhrases: string[]; noBloatedPolicyParagraph: boolean };
        freshness: { updatedField: string; lastSeenField: string; rule: string };
        polling: { intervalSeconds: number; fields: string[] };
        publicWrapperCompatibility: { noDefaultQuery: boolean; canonicalMethod: string; canonicalPath: string };
      };
      publicWrapperResponsiveAudit: typeof publicWrapperResponsiveAudit;
      cutoverScenarios: Array<{ code: string; state: string; warningCode: string; publicBehavior: string }>;
      publicChannelCanary: { routes: string[]; fields: string[]; guarantee: string };
      publicChannelPromotionCanary: { fields: string[]; healthSignals: string[]; guarantee: string };
      publicChannelPromotionCertification: { routes: string[]; fields: string[]; influenceSurfaces: string[]; guarantee: string };
      sourceActivationExecutionReadiness: { routes: string[]; fields: string[]; guarantee: string };
      sourceRolloutPromotionPacket: { routes: string[]; fields: string[]; guarantee: string };
      restrictedMetadataConnectorCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataKillSwitchDrills: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataEmergencyStopCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      restrictedMetadataNonBlockingSearch: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      graphExportCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      graphLiveSearchUpdate: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      evidencePersistenceCertification: { routes: string[]; scenarios: string[]; packetFields: string[]; guarantee: string };
      warningCodes: string[];
      noLeakGuarantees: string[];
      errorEnvelope: { error: { code: string; message: string } };
    };
    const validation = contract.validation as {
      publicProofs: string[];
      contractIndexProof: string;
    };

    expect(contract).toMatchObject({
      endpoint: "/v1/contracts",
      version: "v1",
      schemaVersion: "ti.scraper.enterprise_api_contract.v1"
    });
    expect(routeInventory).toMatchObject({
      source: "src/api/server.ts",
      count: routeInventory.routes.length
    });
    expect(routeInventory.count).toBeGreaterThanOrEqual(40);
    expect(routeTruthAudit).toMatchObject({
      schemaVersion: "ti.route_truth_audit.v1",
      owner: "Agent 09",
      expectedRouteInventoryCount: routeInventory.count,
      canonicalPublicPost: {
        path: "/api/ti/search",
        method: "POST",
        mapsTo: "/v1/intel/search"
      }
    });
    expect(routeTruthAudit.canonicalPublicPost.stableFields).toEqual(expect.arrayContaining(["query", "mode", "status", "runId", "cursor", "nextCursor", "publicTiAnswer"]));
    expect(routeTruthAudit.fixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining([
      "route_inventory_drift",
      "missing_schema_examples",
      "public_post_compatibility",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "stale_evidence",
      "no_approved_sources",
      "policy_blocked",
      "duplicate_run_reuse",
      "restricted_emergency_stop",
      "canary_rc_decision",
      "no_leak_examples"
    ]));
    expect(routeTruthAudit.fixtures.every((fixture) => fixture.publicPostCompatible && fixture.noLeakRequired && fixture.rollbackPath.length > 0)).toBe(true);
    expect(routeTruthAudit.fixtures.find((fixture) => fixture.name === "restricted_emergency_stop")).toMatchObject({
      route: "GET /v1/restricted-metadata/status",
      status: "pass"
    });
    expect(routeTruthAudit.fixtures.find((fixture) => fixture.name === "canary_rc_decision")?.auditFields).toEqual(expect.arrayContaining([
      "publicAnswerReleaseCandidate.agent10RcGate",
      "sourceRolloutPromotionPacket",
      "schedulerCanaryControlPlane"
    ]));
    expect(routeTruthAudit.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(routeTruthAudit.guarantee).toContain("fail-closed");
    expect(publicWrapperResponsiveAudit).toMatchObject({
      schemaVersion: "ti.public_wrapper_responsive_search.v1",
      owner: "Agent 09",
      route: "GET /v1/intel/search",
      publicWrapper: {
        canonicalMethod: "POST",
        canonicalPath: "/api/ti/search",
        noDefaultQuery: true,
        stableRunIds: true,
        pollingSeconds: 3,
        unknownCopy: "Searching"
      }
    });
    expect(semantics.publicWrapperResponsiveAudit).toEqual(publicWrapperResponsiveAudit);
    expect(publicWrapperResponsiveAudit.publicWrapper.updatedSemantics).toContain("lastSeen is shown only when evidence supplies");
    expect(publicWrapperResponsiveAudit.publicWrapper.stableFields).toEqual(expect.arrayContaining(["runId", "cursor", "nextCursor", "refreshAfterSeconds", "publicTiAnswer"]));
    expect(publicWrapperResponsiveAudit.fixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining([
      "apt29_actor",
      "apt42_actor",
      "turla_actor",
      "volt_typhoon_actor",
      "scattered_spider_actor",
      "akira_ransomware",
      "random_actor",
      "made_up_actor",
      "cve",
      "malware_tool",
      "country",
      "sector",
      "victim",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "duplicate_run_reuse",
      "policy_block",
      "restricted_hold",
      "public_channel_partial",
      "graph_evidence_promotion"
    ]));
    expect(publicWrapperResponsiveAudit.fixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "Random Actor",
      "Made Up Actor",
      "CVE-2026-11111",
      "Snake",
      "Norway",
      "energy",
      "Fjord Energy AS"
    ]));
    expect(publicWrapperResponsiveAudit.fixtures.every((fixture) =>
      fixture.pollSeconds === 3
      && fixture.stableRunId
      && fixture.publicPostCompatible
      && fixture.noDefaultActor
      && fixture.noLeakRequired
      && fixture.noStaleCacheCopy
      && fixture.stableFields.includes("publicTiAnswer")
    )).toBe(true);
    expect(publicWrapperResponsiveAudit.fixtures.filter((fixture) => fixture.expectedUxState === "searching").every((fixture) => fixture.compactUnknownCopy === "Searching")).toBe(true);
    expect(publicWrapperResponsiveAudit.noLeakExamples.flatMap((example) => example.forbidden)).toEqual(expect.arrayContaining(["raw leaked files", "credentials", "raw message body"]));
    expect(publicWrapperResponsiveAudit.proofCommands).toEqual(expect.arrayContaining([
      "bun run check:contract-index",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(routeInventory.routes.map((route) => `${route.method} ${route.path}`)).toEqual(expect.arrayContaining([
      "GET /v1/health",
      "GET /v1/contracts",
      "POST /v1/intel/runs",
      "GET /v1/intel/search",
      "POST /v1/sources/coverage-closeout",
      "GET /v1/evidence/claim-ledger",
      "GET /v1/graph/query",
      "GET /v1/graph/timeline",
      "POST /v1/sources/{id}/restricted-metadata/apply-plan"
    ]));
    expect(routeInventory.routes.every((route) => route.guarantees.includes("no_leak_dto"))).toBe(true);
    expect(semantics.sourceActivationExecutionReadiness.routes).toEqual(expect.arrayContaining([
      "/v1/sources/coverage-closeout",
      "/v1/sources/activation-batches",
      "/v1/intel/search",
      "/v1/contracts"
    ]));
    expect(semantics.sourceActivationExecutionReadiness.fields).toEqual(expect.arrayContaining([
      "first10Canary",
      "publicRollout50",
      "parserGapHandoff",
      "queueBudgetImpact",
      "agent10ReleasePacket"
    ]));
    expect(semantics.sourceRolloutPromotionPacket.fields).toEqual(expect.arrayContaining([
      "rolloutPromotion",
      "publicTiAnswerEffect",
      "agent02SchedulerTelemetry",
      "agent06EvidenceCertification",
      "agent07PollingState",
      "agent09ContractIndex",
      "agent10CanaryReleaseDecision"
    ]));
    expect(surfaces.find((surface) => surface.name === "sources")?.responseKeys).toContain("executionReadiness");
    expect(surfaces.find((surface) => surface.name === "sources")?.responseKeys).toContain("rolloutPromotion");
    expect(surfaces.find((surface) => surface.name === "sources")?.guarantees).toContain("source_activation_execution_readiness");
    expect(surfaces.find((surface) => surface.name === "sources")?.guarantees).toContain("source_rollout_promotion_packet");
    expect(publicCompatibility).toMatchObject({
      canonicalMethod: "POST",
      canonicalPublicPath: "/api/ti/search",
      mapsTo: "/v1/intel/search"
    });
    expect(publicCompatibility.stableFields).toEqual(expect.arrayContaining([
      "query",
      "mode",
      "status",
      "runId",
      "refreshAfterSeconds",
      "summary",
      "warnings",
      "cursor",
      "nextCursor",
      "answer",
      "publicTiAnswer"
    ]));
    expect(publicCompatibility.publicAnswerContract).toMatchObject({
      schemaVersion: "ti.public_answer_contract.v1",
      field: "publicTiAnswer",
      nestedAnswerField: "answer.publicContract"
    });
    expect(publicCompatibility.publicAnswerContract.requiredSections).toEqual(expect.arrayContaining([
      "safeSummary",
      "stateMachine",
      "releaseCandidate",
      "ux",
      "waitReasons",
      "sourceCoverageGaps",
      "evidenceLedgerReferences",
      "graphStixReadiness",
      "safeWording"
    ]));
    expect(publicCompatibility.publicAnswerContract.safeWordingGuarantee).toContain("must not be worded as confirmed facts");
    expect(Object.keys(publicCompatibility.statusMapping).sort()).toEqual(["blocked", "error", "partial", "ready", "review_required"]);
    expect(semantics.stateMachine.schemaVersion).toBe("ti.public_answer_polling_state.v1");
    expect(Object.keys(semantics.stateMachine.states).sort()).toEqual([
      "blocked",
      "contradicted",
      "error",
      "first_response",
      "live_partial",
      "no_result",
      "promoted_evidence",
      "queued_collection",
      "ready",
      "review_required",
      "source_biased",
      "stale"
    ]);
    expect(semantics.stateMachine.states.live_partial.requiredFields).toEqual(expect.arrayContaining(["summary", "warnings", "publicTiAnswer.stateMachine.changedSinceCursor"]));
    expect(semantics.stateMachine.states.blocked.publicPromotion).toBe("blocked_fail_closed");
    expect(semantics.stateMachine.requiredUiFields).toEqual(expect.arrayContaining([
      "progress",
      "changedSinceCursor",
      "polling",
      "holds",
      "safeNoResult"
    ]));
    expect(semantics.publicAnswerReleaseCandidate).toMatchObject({
      schemaVersion: "ti.public_answer_release_candidate.v1",
      field: "publicTiAnswer.releaseCandidate"
    });
    expect(semantics.publicAnswerReleaseCandidate.states).toEqual(expect.arrayContaining([
      "ready",
      "canary_ready",
      "canary_with_warnings",
      "partial",
      "review_required",
      "blocked",
      "no_result",
      "stale",
      "contradicted",
      "source_biased",
      "provider_unavailable",
      "scraper_unavailable",
      "policy_blocked"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.queryClasses).toEqual(expect.arrayContaining([
      "actor",
      "ransomware",
      "random_actor",
      "cve",
      "malware_tool",
      "country",
      "sector",
      "victim"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.visibleAnswerInputs).toEqual(expect.arrayContaining([
      "sourceCanary",
      "schedulerControlPlane",
      "publicChannelPromotion",
      "restrictedEmergencyStop",
      "evidenceCutover",
      "graphExport",
      "apiContractState"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.requiredUiFields).toEqual(expect.arrayContaining([
      "visibleAnswer",
      "releaseGates",
      "agent10RcGate",
      "publicPostCompatibility"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.fixtures.map((fixture) => fixture.state)).toEqual(expect.arrayContaining(semantics.publicAnswerReleaseCandidate.states));
    expect(semantics.publicAnswerReleaseCandidate.fixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "Turla",
      "CVE-2026-11111",
      "Snake",
      "Norway",
      "energy",
      "Fjord Energy AS"
    ]));
    expect(semantics.publicAnswerReleaseCandidate.fixtures.every((fixture) => fixture.publicPostCompatible)).toBe(true);
    expect(semantics.publicAnswerReleaseCandidate.agent10RcGate.statuses).toEqual(["pass", "warning", "blocker"]);
    expect(semantics.publicAnswerReleaseCandidate.agent10RcGate.proofCommands).toContain("bun run check:scraper-native-search");
    expect(semantics.publicAnswerReleaseCandidate.guarantee).toContain("fail-closed");
    expect(semantics.publicAnswerUxSemantics).toMatchObject({
      schemaVersion: "ti.public_answer_ux.v1",
      field: "publicTiAnswer.ux",
      copyRules: {
        unknownQuery: "Searching",
        noBloatedPolicyParagraph: true
      },
      polling: {
        intervalSeconds: 3
      },
      publicWrapperCompatibility: {
        noDefaultQuery: true,
        canonicalMethod: "POST",
        canonicalPath: "/api/ti/search"
      }
    });
    expect(semantics.publicAnswerUxSemantics.states).toEqual(expect.arrayContaining([
      "ready",
      "partial",
      "searching",
      "no_result",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "review_required",
      "stale",
      "contradicted",
      "source_biased",
      "policy_blocked",
      "restricted_held"
    ]));
    expect(semantics.publicAnswerUxSemantics.queryFixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Turla",
      "Volt Typhoon",
      "Scattered Spider",
      "Akira",
      "Unseen Quartz Actor",
      "CVE-2026-11111",
      "Snake",
      "Norway",
      "energy",
      "Fjord Energy AS"
    ]));
    expect(semantics.publicAnswerUxSemantics.copyRules.bannedPhrases).toEqual(expect.arrayContaining(["not in local cache", "local cache", "demo", "default APT29"]));
    expect(semantics.publicAnswerUxSemantics.freshness.rule).toContain("lastSeen is shown only when evidence supplies");
    expect(semantics.publicAnswerUxSemantics.polling.fields).toEqual(expect.arrayContaining(["publicTiAnswer.ux.polling", "refreshAfterSeconds", "nextPollSeconds"]));
    expect(semantics.cutoverScenarios.map((scenario) => scenario.code)).toEqual(expect.arrayContaining([
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "stale_evidence",
      "no_approved_sources",
      "policy_blocked",
      "duplicate_run_reuse"
    ]));
    expect(semantics.cutoverScenarios.find((scenario) => scenario.code === "duplicate_run_reuse")).toMatchObject({
      state: "partial",
      warningCode: "duplicate_run_reuse"
    });
    expect(semantics.cursorPolling.responseFields).toEqual(expect.arrayContaining(["cursor", "nextCursor", "refreshAfterSeconds", "nextPollSeconds"]));
    expect(semantics.idempotency).toMatchObject({ header: "idempotency-key", route: "POST /v1/intel/runs" });
    expect(semantics.publicChannelCanary).toMatchObject({
      routes: expect.arrayContaining(["/v1/public-channels/status", "/v1/public-channels/apply-plan", "/v1/intel/search"]),
      fields: expect.arrayContaining(["canaryRollout", "promotionCanary", "promotionCertification", "agent06EvidenceHandoff", "agent07AnswerCaveats", "agent10ReleaseTrain"])
    });
    expect(semantics.publicChannelPromotionCanary).toMatchObject({
      fields: expect.arrayContaining(["sourceHealth", "evidenceFlow", "claimCandidates", "graphHints", "agent06EvidenceCutover", "agent07PublicAnswer", "agent10RcGate"]),
      healthSignals: expect.arrayContaining(["rateLimitDebt", "duplicateUrlPressure", "editDeleteChurn", "unavailableWindows", "languageDrift", "spamChurn", "evidenceYield", "claimYield", "rollbackTriggers"])
    });
    expect(semantics.publicChannelPromotionCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/public-channels/status", "/v1/public-channels/apply-plan", "/v1/intel/search", "/v1/contracts"]),
      fields: expect.arrayContaining(["decisionRules", "evidenceCertification", "claimCertification", "graphCertification", "agent06EvidenceCertification", "agent07AnswerStateMachine", "agent08GraphCertification", "agent10RcGate"]),
      influenceSurfaces: expect.arrayContaining(["public_answer", "graph", "source_health", "release"])
    });
    expect(semantics.restrictedMetadataConnectorCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"]),
      scenarios: expect.arrayContaining(["healthy_approved_metadata_source", "unsafe_link_form_download", "retention_expiry"]),
      packetFields: expect.arrayContaining(["networkIsolation", "approval", "redaction", "guarantees", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataConnectorCertification.guarantee).toContain("no downloads");
    expect(semantics.restrictedMetadataKillSwitchDrills).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"]),
      scenarios: expect.arrayContaining(["healthy_metadata_only_canary", "kill_switch_activation_mid_run", "public_api_blocked_state"]),
      packetFields: expect.arrayContaining(["killSwitchPropagation", "agent10RcGate", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataKillSwitchDrills.guarantee).toContain("no downloads");
    expect(semantics.restrictedMetadataEmergencyStopCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"]),
      scenarios: expect.arrayContaining(["kill_switch_propagation", "timeout_spike", "public_api_blocked_state"]),
      packetFields: expect.arrayContaining(["controls", "proof", "agent06EvidenceRedactionCertification", "agent10EmergencyStopGate", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataEmergencyStopCertification.guarantee).toContain("without unsafe access");
    expect(semantics.graphExportCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["apt29_actor_profile", "restricted_only_evidence", "missing_ledger_id", "schema_risk_export", "missing_provenance", "contradicted_relationship", "analyst_reviewed_promotion"]),
      packetFields: expect.arrayContaining(["scenarios", "noUnsupportedTaxiiServerClaims", "releasePacket", "rcGate"])
    });
    expect(semantics.graphExportCertification.guarantee).toMatch(/release-candidate gate/i);
    expect(semantics.graphLiveSearchUpdate).toMatchObject({
      routes: expect.arrayContaining(["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["apt42_clear_web", "volt_typhoon_public_channel", "public_channel_only_hint", "restricted_held_evidence", "stix_export_eligible"]),
      packetFields: expect.arrayContaining(["nextPollSeconds", "deltaCounts", "scenarioCoverage", "agentHandoffs", "taxiiBoundary"])
    });
    expect(semantics.graphLiveSearchUpdate.guarantee).toMatch(/seconds-level polling/i);
    expect(semantics.evidencePersistenceCertification).toMatchObject({
      routes: expect.arrayContaining(["/v1/evidence/claim-ledger", "/v1/evidence/cutover-report", "/v1/intel/search", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["clean_cutover", "missing_object", "hash_mismatch", "cursor_gap", "object_store_write_failure"]),
      packetFields: expect.arrayContaining(["objectStore", "postgresRepository", "cursorReplay", "retention", "redaction", "claimPromotion", "downstream"])
    });
    expect(semantics.evidencePersistenceCertification.guarantee).toContain("without exposing raw bodies or object keys");
    expect(semantics.warningCodes).toEqual(expect.arrayContaining([
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "stale_evidence",
      "no_approved_sources",
      "policy_blocked",
      "duplicate_run_reuse",
      "scheduler_migration_postgres_shadow",
      "scheduler_retry_debt_watch",
      "scheduler_dead_letter_watch",
      "scheduler_cursor_waiting_for_deltas"
    ]));
    expect(semantics.errorEnvelope.error.code).toContain("idempotency_conflict");
    expect(semantics.errorEnvelope.error.code).toContain("scraper_unavailable");
    expect(semantics.errorEnvelope.error.code).toContain("duplicate_run_reuse");
    expect(surfaces.map((surface) => surface.path)).toEqual(expect.arrayContaining([
      "/v1/intel/search",
      "/v1/intel/runs/{id}",
      "/v1/intel/runs/{id}/results",
      "/v1/sources/*",
      "/v1/frontier/*",
      "/v1/evidence/*",
      "/v1/graph/*",
      "/v1/exports/stix",
      "/v1/public-channels/*",
      "/v1/restricted-metadata/*"
    ]));
    expect(surfaces.find((surface) => surface.path === "/v1/intel/search")?.responseKeys).toEqual(expect.arrayContaining(["sla", "quality", "actorProfile"]));
    expect(surfaces.find((surface) => surface.path === "/v1/public-channels/*")?.responseKeys).toEqual(expect.arrayContaining(["canaryRollout"]));
    expect(surfaces.find((surface) => surface.path === "/v1/restricted-metadata/*")?.responseKeys).toEqual(expect.arrayContaining(["connectorCertification", "killSwitchDrills", "emergencyStopCertification", "nonBlockingSearch"]));
    expect(surfaces.find((surface) => surface.path === "/v1/graph/*")?.guarantees).toContain("graph_export_certification");
    expect(surfaces.find((surface) => surface.path === "/v1/graph/*")?.guarantees).toContain("graph_live_update");
    expect(surfaces.find((surface) => surface.path === "/v1/graph/*")?.guarantees).toContain("graph_stix_rc_gate");
    expect(surfaces.find((surface) => surface.path === "/v1/evidence/*")?.responseKeys).toContain("certification");
    expect(surfaces.find((surface) => surface.path === "/v1/evidence/*")?.guarantees).toContain("persistence_certification");
    expect(surfaces.find((surface) => surface.path === "/v1/exports/stix")?.guarantees).toContain("taxii_descriptor_only");
    expect(surfaces.find((surface) => surface.path === "/v1/exports/stix")?.guarantees).toContain("graph_live_update");
    expect(surfaces.find((surface) => surface.path === "/v1/exports/stix")?.guarantees).toContain("graph_stix_rc_gate");
    expect(semantics.restrictedMetadataNonBlockingSearch).toMatchObject({
      routes: expect.arrayContaining(["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"]),
      scenarios: expect.arrayContaining(["approved_metadata_canary", "unsafe_target", "public_api_blocked_state", "actor_query", "victim_query", "cve_query"]),
      packetFields: expect.arrayContaining(["publicSearchAction", "restrictedContext", "proof", "noLeakSerialization"])
    });
    expect(semantics.restrictedMetadataNonBlockingSearch.guarantee).toContain("never blocks clear-web or public-channel search");
    expect(surfaces.find((surface) => surface.path === "/v1/frontier/*")?.guarantees).toContain("worker_soak_migration");
    expect(surfaces.find((surface) => surface.path === "/v1/frontier/*")?.guarantees).toContain("scheduler_adapter_telemetry");
    expect(surfaces.every((surface) => surface.guarantees.length > 0)).toBe(true);
    expect(semantics.noLeakGuarantees).toEqual(expect.arrayContaining(["no raw Telegram message bodies", "no object storage keys"]));
    expect(contract.examples).toMatchObject({
      scraperUnavailable: { response: { warningCodes: expect.arrayContaining(["scraper_unavailable"]) } },
      queuePressure: { response: { warningCodes: expect.arrayContaining(["queue_pressure", "duplicate_run_reuse"]) } },
      noApprovedSources: { response: { status: "blocked", warningCodes: expect.arrayContaining(["no_approved_sources"]) } },
      policyBlocked: { response: { status: "blocked", warningCodes: expect.arrayContaining(["policy_blocked"]) } }
    });
    expect(validation.publicProofs).toEqual(expect.arrayContaining([
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]));
    expect(validation.contractIndexProof).toContain("GET /v1/contracts");
    const serialized = JSON.stringify(contract).toLowerCase();
    for (const forbidden of ["cookie=", "authorization:", "set-cookie", "password=", "objectkey", "raw proof payload"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("creates idempotent intelligence runs and exposes status", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const request = {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "retry-1" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    };

    const first = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const second = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const firstRun = first.run as { id: string; status: string; taskCount: number };
    const secondRun = second.run as { id: string };

    expect(firstRun.status).toBe("queued");
    expect(firstRun.taskCount).toBe(1);
    expect(secondRun.id).toBe(firstRun.id);

    const status = await body(await handleApiRequest(api(`/v1/intel/runs/${firstRun.id}`), options));
    expect((status.run as { id: string }).id).toBe(firstRun.id);
  });

  test("supports compact source admin and metrics", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Vendor API",
        type: "api",
        url: "https://api.example.test/intel?q={query}",
        accessMethod: "official_api",
        status: "candidate",
        risk: "medium",
        legalNotes: "Approved vendor API fixture."
      })
    }), options));

    const id = (created.source as { id: string }).id;
    const updated = await body(await handleApiRequest(api(`/v1/sources/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "active", trustScore: 1.5 })
    }), options));
    expect((updated.source as { status: string; trustScore: number }).status).toBe("active");
    expect((updated.source as { status: string; trustScore: number }).trustScore).toBe(1);

    const metrics = await body(await handleApiRequest(api("/v1/metrics"), options));
    expect(metrics.service).toBe("ti-scraper");
    expect((metrics.sources as { active: number }).active).toBe(1);
  });

  test("rejects idempotency key reuse with a different request body", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const headers = { "content-type": "application/json", "idempotency-key": "retry-conflict" };

    await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options);
    const conflict = await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "APT28", entityType: "actor", tenantId: "tenant_a" })
    }), options);
    const payload = await body(conflict);

    expect(conflict.status).toBe(409);
    expect(payload.error).toMatchObject({ code: "idempotency_conflict" });
  });

  test("returns redacted run results with include filters and STIX export", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const run = created.run as { id: string; planId: string };
    const plan = store.getPlan(run.planId);
    const rawText = "APT29 used phishing against a healthcare victim from https://evil.example.com and CVE-2025-12345.";
    const result = processCollectedItem({
      sourceId: "src_rss",
      taskId: plan?.tasks[0]?.id,
      url: "https://example.test/report",
      collectedAt: "2026-05-24T00:00:00.000Z",
      title: "APT29 report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { fixture: true },
      sensitive: false
    });
    store.savePipelineResult({
      ...result,
      capture: { ...result.capture, tenantId: "tenant_a" }
    });

    const capturesOnly = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}/results?include=captures`), options));
    const captures = (capturesOnly.results as { captures: { items: Array<{ body?: string; bodyRedacted: boolean }> } }).captures.items;
    expect(captures[0]?.body).toBeUndefined();
    expect(captures[0]?.bodyRedacted).toBe(true);
    expect((capturesOnly.results as Record<string, unknown>).incidents).toBeUndefined();

    const intelOnly = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}/results?include=indicators,entities,relationships`), options));
    expect(((intelOnly.results as { indicators: { items: unknown[] } }).indicators.items).length).toBeGreaterThan(0);
    expect(((intelOnly.results as { entities: { items: unknown[] } }).entities.items).length).toBeGreaterThan(0);
    expect(((intelOnly.results as { relationships: { items: unknown[] } }).relationships.items).length).toBeGreaterThan(0);

    const exportResponse = await body(await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: run.id, generatedAt: "2026-05-24T00:05:00.000Z" })
    }), options));
    expect((exportResponse.bundle as { type: string; objects: unknown[] }).type).toBe("bundle");
    expect((exportResponse.bundle as { type: string; objects: unknown[] }).objects.length).toBeGreaterThan(0);
  });

  test("exports STIX-like CTI from run captures even before incidents are persisted", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const run = created.run as { id: string; planId: string };
    const plan = store.getPlan(run.planId);
    const rawText = "APT29 used phishing and Cobalt Strike against Northwind Health Systems with CVE-2025-12345 from 198.51.100.42.";
    store.saveCapture({
      id: "cap_capture_only_stix",
      tenantId: "tenant_a",
      sourceId: "src_rss",
      taskId: plan?.tasks[0]?.id,
      url: "https://example.test/capture-only",
      canonicalUrl: "https://example.test/capture-only",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: hashContent(rawText),
      normalizedTextHash: hashContent(rawText.toLowerCase()),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: rawText,
      metadata: { title: "Capture-only APT29 report" },
      sensitive: false,
      sensitivityFlags: ["public"]
    });

    const exportResponse = await body(await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: run.id, generatedAt: "2026-05-24T00:05:00.000Z" })
    }), options));
    const objects = (exportResponse.bundle as { objects: Array<{ type: string; name?: string; x_ti_provenance?: Array<{ captureId: string }> }> }).objects;

    expect(objects.some((object) => object.type === "indicator" && object.name === "ipv4:198.51.100.42")).toBe(true);
    expect(objects.some((object) => object.type === "intrusion-set" && object.name === "APT29")).toBe(true);
    expect(objects.some((object) => object.type === "report")).toBe(true);
    expect(objects.every((object) =>
      object.x_ti_provenance ? object.x_ti_provenance.every((item) => item.captureId === "cap_capture_only_stix") : true
    )).toBe(true);
  });

  test("returns non-mutating evidence replay-plan and cutover-report DTOs without sensitive bodies or object keys", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    seedEvidenceReplayFixture(store);
    const before = {
      captures: store.listCaptures().length,
      discovery: store.listDiscoveryEvidence().length,
      deltas: store.listEvidenceDeltas().length,
      snapshots: store.listLiveSearchSnapshots().length
    };
    const options = { store, frontier: new FocusedFrontier(), objectStore };

    const replayResponse = await body(await handleApiRequest(api("/v1/evidence/replay-plan?q=APT29&runId=run_api"), options));
    const cutoverResponse = await body(await handleApiRequest(api("/v1/evidence/cutover-report?q=APT29&runId=run_api&generatedAt=2026-05-24T21:00:00.000Z"), options));
    const after = {
      captures: store.listCaptures().length,
      discovery: store.listDiscoveryEvidence().length,
      deltas: store.listEvidenceDeltas().length,
      snapshots: store.listLiveSearchSnapshots().length
    };

    expect(after).toEqual(before);
    expect(replayResponse.contract).toMatchObject({
      endpoint: "/v1/evidence/replay-plan",
      method: "GET",
      examples: {
        pass: { readiness: "ready", replayable: true },
        restrictedMetadataRedaction: { sensitiveBodiesExposed: false }
      }
    });
    expect(replayResponse.replayPlan).toMatchObject({
      endpoint: "/v1/evidence/replay-plan",
      replayable: true,
      redaction: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false
      }
    });
    expect((replayResponse.replayPlan as { stages: Array<{ stage: string }> }).stages.map((stage) => stage.stage)).toEqual([
      "discovery",
      "capture",
      "extraction",
      "relationship_delta",
      "api_cursor"
    ]);
    expect(cutoverResponse.contract).toMatchObject({
      endpoint: "/v1/evidence/cutover-report",
      examples: {
        staleSnapshotHold: { readiness: "hold", blocker: "stale_snapshot_rebuild" },
        missingObjectHold: { readiness: "blocked", blocker: "missing_objects" },
        graphExportBlocker: { readiness: "hold", blocker: "export_blockers" }
      }
    });
    expect(cutoverResponse.cutoverReport).toMatchObject({
      endpoint: "/v1/evidence/cutover-report",
      readiness: { overall: "ready" },
      redaction: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false
      },
      promotionGate: {
        agent09Fields: { cursorReplayReady: true },
        agent10Fields: { objectIntegrityReady: true }
      }
    });
    const serialized = JSON.stringify(cutoverResponse);
    expect(serialized).not.toContain("hidden sensitive body");
    expect(serialized).not.toContain("tenant/source/private-key");
    expect(serialized).not.toContain("\"body\"");
    expect(serialized).not.toContain("\"key\"");
  });

  test("returns consistent 400 and 404 error bodies", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const badExport = await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    }), options);
    expect(badExport.status).toBe(400);
    expect(await body(badExport)).toMatchObject({ error: { code: "bad_request" } });

    const missingRun = await handleApiRequest(api("/v1/intel/runs/run_missing"), options);
    expect(missingRun.status).toBe(404);
    expect(await body(missingRun)).toMatchObject({ error: { code: "not_found" } });
  });

  test("exposes frontier queue groups and run status frontier context", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const frontier = new FocusedFrontier();
    frontier.add({
      source: source(),
      tenantId: "tenant_a",
      intelRequestId: "request_a",
      url: "https://example.test/apt29",
      discoveredAt: "2026-01-01T00:00:00.000Z",
      anchorText: "APT29 ransomware campaign exploit",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });
    const options = { store, frontier };

    const frontierResponse = await body(await handleApiRequest(api("/v1/frontier"), options));
    expect((frontierResponse.queue as unknown[])).toHaveLength(1);
    expect((frontierResponse.summary as { groups: { tenants: Record<string, number> } }).groups.tenants.tenant_a).toBe(1);
    expect((frontierResponse.scheduler as {
      cutover: { targetBackend: string };
      diagnostics: { diagnostics: Array<{ workClass: string; pressureState: string; queueAgeSeconds: number }> };
    }).cutover.targetBackend).toBe("postgres_queue");
    expect((frontierResponse.scheduler as {
      diagnostics: { diagnostics: Array<{ workClass: string; pressureState: string; queueAgeSeconds: number }> };
    }).diagnostics.diagnostics[0]).toMatchObject({
      workClass: "background_refresh",
      pressureState: "accepted"
    });

    const runResponse = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const runId = (runResponse.run as { id: string }).id;
    const status = await body(await handleApiRequest(api(`/v1/intel/runs/${runId}`), options));

    expect(status.frontier).toBeDefined();
    expect((status.frontier as { summary: { queued: number } }).summary.queued).toBeGreaterThan(0);
  });

  test("exposes safe ops resource snapshot with queue and worker state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    store.saveSource(source());
    const supervisor = new WorkerSupervisor(createLogger("error"), new MetricsRegistry());
    supervisor.register("telegram-1", "telegram");
    supervisor.markRunning("telegram-1");

    await handleApiRequest(api("/v1/intel/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor" })
    }), { store, frontier, config: loadRuntimeConfig({}), supervisor });

    const snapshot = await body(await handleApiRequest(api("/v1/ops/resource-snapshot"), {
      store,
      frontier,
      config: loadRuntimeConfig({}),
      supervisor
    }));

    expect(snapshot.service).toBe("ti-scraper");
    expect((snapshot.queue as { queued: number }).queued).toBeGreaterThanOrEqual(0);
    expect((snapshot.resources as { disk: { reservedGb: number } }).disk.reservedGb).toBe(500);
    expect((snapshot.capacity as { ceilingMb: number }).ceilingMb).toBe(160 * 1024);
    expect((snapshot.workerPools as { telegram: number }).telegram).toBeGreaterThan(0);
    expect((snapshot.workers as Array<{ id: string; state: string }>)[0]).toMatchObject({ id: "telegram-1", state: "running" });
  });

  test("reports partial public-channel evidence for live intel search", async () => {
    const store = new InMemoryScraperStore();
    const telegram = source({
      id: "src_telegram",
      name: "Cybercrime public channel",
      type: "telegram_public",
      url: "https://t.me/cybercrimeintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Reviewed public Telegram channel fixture.",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: false,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      },
      metadata: { actors: ["UNC3944"], topicTags: ["cybercrime"] }
    });
    store.saveSource(telegram);
    const bodyText = "Scattered Spider posted infrastructure at https://evil.example";
    const capture: RawCapture = {
      id: "cap_telegram",
      sourceId: "src_telegram",
      url: "https://t.me/cybercrimeintel/10",
      collectedAt: "2026-05-24T00:00:00.000Z",
      publishedAt: "2026-05-23T23:59:00.000Z",
      contentHash: hashContent(bodyText),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: bodyText,
      metadata: {
        adapter: "telegram_public",
        channel: "cybercrimeintel",
        messageId: 10,
        messageState: "available",
        urlMentions: ["https://evil.example"],
        forward: { fromChannel: "public_origin", fromMessageId: 4 },
        provenance: { confidence: 0.95 }
      },
      sensitive: false
    };
    store.saveCapture(capture);

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Scattered%20Spider&entityType=actor"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.publicChannel).toMatchObject({
      status: "partial",
      queuedTasks: 1,
      summary: {
        freshness: {
          latestMessageId: 10,
          safePartialEvidenceCount: 1
        },
        reliability: {
          sourceCount: 1,
          rating: "healthy",
          needsReviewCount: 0
        },
        promotionYield: {
          rating: "high",
          promotedCount: 1
        },
        answerReadiness: {
          status: "ready"
        }
      },
      sla: {
        status: "pass",
        enforcement: {
          status: "pass",
          releaseAction: "promote",
          agent10ReleasePacket: {
            runtimeProofName: "public_channel_sla",
            decisionImpact: "promote"
          }
        },
        releaseGate: {
          agent10ProofName: "public_channel_sla",
          decisionImpact: "promote"
        },
        metrics: {
          cursorFreshness: {
            latestMessageTimestamp: "2026-05-23T23:59:00.000Z"
          },
          ledgerBackedClaimYield: {
            ledgerBackedClaimCount: 1,
            candidateClaimCount: 1
          }
        }
      },
      cutoverReport: {
        summary: {
          readyChannelCount: 1,
          safePartialEvidenceCount: 1,
          recommendedNextAction: "ready_for_cutover"
        },
        evidenceFreshness: {
          latestMessageId: 10,
          safePartialEvidenceCount: 1
        }
      },
      reliability: {
        sources: [{
          sourceId: "src_telegram",
          rating: "healthy",
          partialEvidenceOnly: false
        }]
      },
      abuseControls: [{
        sourceId: "src_telegram",
        allowed: true
      }],
      canaryRollout: {
        mode: "dry_run",
        summary: {
          selectedSourceCount: 1,
          replayableEvidenceCount: 1
        },
        selectedSources: expect.arrayContaining([expect.objectContaining({
          sourceId: "src_telegram",
          agent06EvidenceHandoff: expect.objectContaining({ metadataOnly: true })
        })])
      },
      promotionCanary: {
        mode: "dry_run",
        summary: {
          evidenceCount: 1,
          replayableEvidenceCount: 1,
          noLeakSerialization: true
        },
        sourceHealth: expect.arrayContaining([expect.objectContaining({
          sourceId: "src_telegram",
          rateLimitDebt: "none",
          evidenceYield: expect.any(Number),
          claimYield: expect.any(Number)
        })]),
        handoffs: {
          agent06EvidenceCutover: expect.objectContaining({ evidenceCutoverReady: true }),
          agent07PublicAnswer: expect.objectContaining({ answerState: expect.any(String) }),
          agent10RcGate: expect.objectContaining({ status: expect.any(String) })
        }
      },
      promotionCertification: {
        mode: "dry_run",
        summary: {
          certifiedEvidenceCount: expect.any(Number),
          sourceHealthUpdateCount: 1,
          noLeakSerialization: true
        },
        handoffs: {
          agent06EvidenceCertification: expect.objectContaining({ certifiedLedgerIds: expect.any(Array) }),
          agent07AnswerStateMachine: expect.objectContaining({ state: expect.any(String) }),
          agent08GraphCertification: expect.objectContaining({ status: expect.any(String) }),
          agent10RcGate: expect.objectContaining({ status: expect.any(String) })
        }
      },
      operatorControlEffects: expect.any(Array),
      evidence: [{
        sourceId: "src_telegram",
        channel: "cybercrimeintel",
        messageUrl: "https://t.me/cybercrimeintel/10",
        extractedUrls: ["https://evil.example"],
        forward: { fromChannel: "public_origin", fromMessageId: 4 },
        confidence: 0.95
      }]
    });
    expect(response.planner).toMatchObject({
      mode: "interactive_live_search",
      zeroTaskReason: "none"
    });
    expect((response.planner as { queuedTaskCount: number }).queuedTaskCount).toBeGreaterThan(0);
    expect(response.publicTiAnswer).toMatchObject({
      publicChannelCertification: {
        status: expect.any(String),
        summary: expect.objectContaining({
          noLeakSerialization: true
        }),
        answerStateMachine: expect.objectContaining({ state: expect.any(String) }),
        graphCertification: expect.objectContaining({ status: expect.any(String) }),
        rcGate: expect.objectContaining({ decision: expect.any(String) })
      }
    });
  });

  test("returns public-channel status DTO with promotion, polling, and safe-output guarantees", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_telegram",
      name: "APT29 public channel",
      type: "telegram_public",
      url: "https://t.me/securityalerts",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      language: "en",
      legalNotes: "Approved public Telegram channel fixture.",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: false,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      },
      metadata: {
        actors: ["APT29"],
        topicTags: ["espionage"],
        lastDiscoveredUrls: ["https://t.me/securityalerts/19"]
      }
    }));
    const bodyText = "APT29 Cozy Bear public-channel note for CVE-2026-9999 and victim: Fjord Energy AS";
    store.saveCapture({
      id: "cap_telegram_status",
      sourceId: "src_telegram",
      url: "https://t.me/securityalerts/20",
      collectedAt: "2026-05-24T00:00:00.000Z",
      publishedAt: "2026-05-23T23:59:00.000Z",
      contentHash: hashContent(bodyText),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: bodyText,
      metadata: {
        adapter: "telegram_public",
        channel: "securityalerts",
        messageId: 20,
        messageState: "available",
        replyToMessageId: 18,
        urlMentions: ["https://report.example/apt29"],
        media: {
          retention: "metadata_only",
          items: [{ type: "document", fileName: "report.pdf", sizeBytes: 4000 }]
        },
        extractionHandoff: {
          actorAliases: ["APT29", "Cozy Bear"],
          cves: ["CVE-2026-9999"],
          victims: ["Fjord Energy AS"],
          uncertaintyMarkers: []
        },
        provenance: { confidence: 0.95 }
      },
      sensitive: false
    });

    const response = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor&cursor=19"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response).toMatchObject({
      endpoint: "/v1/public-channels/status",
      status: "ready",
      query: "APT29",
      queuedTasks: 1,
      safeOutput: {
        rawPrivateDataExposed: false,
        rawMediaPayloadsExposed: false,
        credentialsExposed: false,
        mediaRetention: "metadata_only",
        piiMinimized: true
      },
      poll: {
        cursor: 19,
        nextCursor: 20,
        media: { retention: "metadata_only", rawFetchAllowed: false }
      },
      promotion: {
        status: "ready",
        safeOutput: {
          rawMediaPayloadsExposed: false,
          mediaRetention: "metadata_only"
        }
      },
      reliability: {
        summary: {
          sourceCount: 1,
          needsReviewCount: 0
        },
        sources: [{
          sourceId: "src_telegram",
          rating: "healthy",
          metrics: {
            topicFit: expect.any(Number),
            promotionYield: 1
          }
        }],
        safeOutput: {
          rawPrivateDataExposed: false,
          rawMediaPayloadsExposed: false,
          piiMinimized: true
        }
      },
      abuseControls: [{
        sourceId: "src_telegram",
        allowed: true,
        suppressedUrlCount: 0
      }],
      operatorStates: [{
        sourceId: "src_telegram",
        state: "actively_collectable",
        collectable: true
      }],
      sourcePackCompatibility: [{
        sourceId: "src_telegram",
        compatible: true,
        retentionClass: "public_chat_text",
        abuseControlDefaults: {
          mediaRetention: "metadata_only",
          piiMinimized: true
        }
      }],
      sourcePackReadiness: {
        status: expect.any(String),
        summary: {
          sourcePackCount: 0,
          candidateCount: 0,
          approvedPublicCount: 1,
          blockedCount: 0,
          replayableEvidenceCount: 1,
          releaseHold: false
        },
        sources: expect.arrayContaining([expect.objectContaining({
          sourceId: "src_telegram",
          replayableEvidenceHandoff: expect.objectContaining({
            targetAgent: "agent_06",
            metadataOnly: true
          }),
          answerCaveats: expect.objectContaining({ targetAgent: "agent_07" }),
          releaseGate: expect.objectContaining({ targetAgent: "agent_10" })
        })]),
        safeOutput: {
          rawPrivateDataExposed: false,
          rawMediaPayloadsExposed: false,
          credentialsExposed: false,
          mediaRetention: "metadata_only",
          piiMinimized: true
        }
      },
      canaryRollout: {
        mode: "dry_run",
        status: "ready",
        summary: {
          approvedSourceCount: 1,
          selectedSourceCount: 1,
          releaseTrain: "canary_ready"
        },
        selectedSources: expect.arrayContaining([expect.objectContaining({
          sourceId: "src_telegram",
          phase: "first_channel",
          agent06EvidenceHandoff: expect.objectContaining({ metadataOnly: true }),
          agent10ReleaseTrain: expect.objectContaining({ status: "pass" })
        })]),
        controls: expect.objectContaining({
          queryDedupe: expect.objectContaining({ repeatedActorQueryControls: true }),
          abuse: expect.objectContaining({ unavailableWindowHandling: "metadata_only_replay" })
        }),
        safeOutput: expect.objectContaining({
          rawPrivateDataExposed: false,
          rawMediaPayloadsExposed: false,
          credentialsExposed: false
        })
      },
      promotionCanary: {
        mode: "dry_run",
        summary: {
          evidenceCount: 1,
          claimCandidateCount: expect.any(Number),
          graphHintCount: expect.any(Number),
          noLeakSerialization: true
        },
        sourceHealth: expect.arrayContaining([expect.objectContaining({
          sourceId: "src_telegram",
          duplicateUrlPressure: "low",
          rollbackTriggers: expect.any(Array)
        })]),
        handoffs: {
          agent06EvidenceCutover: expect.objectContaining({ replayableLedgerIds: expect.any(Array) }),
          agent07PublicAnswer: expect.objectContaining({ caveatCodes: expect.any(Array) }),
          agent10RcGate: expect.objectContaining({ status: "pass" })
        }
      },
      promotionCertification: {
        mode: "dry_run",
        status: "certified",
        summary: {
          certifiedEvidenceCount: expect.any(Number),
          answerEligibleClaimCount: expect.any(Number),
          graphEligibleHintCount: expect.any(Number),
          sourceHealthUpdateCount: 1,
          releaseDecision: "promote",
          noLeakSerialization: true
        },
        handoffs: {
          agent06EvidenceCertification: expect.objectContaining({ certifiedLedgerIds: expect.any(Array) }),
          agent07AnswerStateMachine: expect.objectContaining({
            state: "ready",
            transition: "promote_public_channel_claims"
          }),
          agent08GraphCertification: expect.objectContaining({ status: "certified" }),
          agent10RcGate: expect.objectContaining({ status: "pass", decision: "promote" })
        }
      },
      actorReadiness: {
        status: "ready",
        sourceRatings: [{
          sourceId: "src_telegram",
          partialEvidenceOnly: false
        }]
      },
      answerReadiness: {
        freshness: {
          latestMessageId: 20,
          safePartialEvidenceCount: 1
        },
        reliability: {
          sourceCount: 1,
          rating: "healthy"
        },
        promotionYield: {
          rating: "high",
          promotedCount: 1
        }
      },
      sla: {
        status: "pass",
        enforcement: {
          status: "pass",
          agent06LedgerHandoff: {
            state: "pass"
          },
          agent07AnswerReadiness: {
            state: "pass",
            claimStatus: "ready"
          }
        },
        releaseGate: {
          owner: "Agent 04",
          agent10ProofName: "public_channel_sla"
        },
        metrics: {
          collectionSuccess: {
            sourceCount: 1
          },
          promotionYield: {
            averageRatio: 1
          }
        }
      },
      operatorControlEffects: expect.any(Array)
    });
    const evidence = response.evidence as Array<{
      messageUrl: string;
      media: { retention: string; rawFetchAllowed: boolean; items: unknown[] };
      extractionHandoff: { actorAliases: string[]; cves: string[]; victims: string[] };
      replyToMessageId: number;
    }>;
    expect(evidence[0]).toMatchObject({
      messageUrl: "https://t.me/securityalerts/20",
      replyToMessageId: 18,
      media: { retention: "metadata_only", rawFetchAllowed: false },
      extractionHandoff: {
        actorAliases: ["APT29", "Cozy Bear"],
        cves: ["CVE-2026-9999"],
        victims: ["Fjord Energy AS"]
      }
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("sessionString");
    expect(serialized).not.toContain("mediaPayload");
    expect(serialized).not.toContain("+privateInvite");
  });

  test("classifies public-channel status route queued rate-limited policy-disabled duplicate and edit delete states", async () => {
    const approvedGovernance = {
      approvalRequired: true,
      approvalState: "approved" as const,
      metadataOnly: false,
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer"
    };

    const queuedStore = new InMemoryScraperStore();
    queuedStore.saveSource(source({
      id: "src_queued_telegram",
      name: "Queued public channel",
      type: "telegram_public",
      url: "https://t.me/queuedintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    const queued = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: queuedStore,
      frontier: new FocusedFrontier()
    }));
    expect(queued).toMatchObject({ status: "queued", queuedTasks: 1 });

    const rateStore = new InMemoryScraperStore();
    rateStore.saveSource(source({
      id: "src_rate_telegram",
      name: "Rate limited public channel",
      type: "telegram_public",
      url: "https://t.me/ratelimitedintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"], rateLimitResetAt: "2999-01-01T00:00:00.000Z" }
    }));
    const rateLimited = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: rateStore,
      frontier: new FocusedFrontier()
    }));
    expect(rateLimited).toMatchObject({
      status: "rate_limited",
      promotion: { rateLimitBackoff: [{ sourceId: "src_rate_telegram" }] },
      operatorStates: [{ sourceId: "src_rate_telegram", state: "delayed", collectable: false }]
    });

    const disabledStore = new InMemoryScraperStore();
    disabledStore.saveSource(source({
      id: "src_disabled_telegram",
      name: "Disabled public channel",
      type: "telegram_public",
      url: "https://t.me/disabledintel",
      accessMethod: "official_api",
      status: "disabled",
      risk: "medium",
      legalNotes: "Disabled public channel.",
      metadata: { actors: ["APT29"] }
    }));
    const policyDisabled = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: disabledStore,
      frontier: new FocusedFrontier()
    }));
    expect(policyDisabled).toMatchObject({
      status: "policy_disabled",
      promotion: { policyDisabled: [{ sourceId: "src_disabled_telegram" }] },
      operatorStates: [{ sourceId: "src_disabled_telegram", state: "policy_blocked", reviewRequired: true }]
    });

    const quarantinedStore = new InMemoryScraperStore();
    quarantinedStore.saveSource(source({
      id: "src_quarantined_telegram",
      name: "Quarantined public channel",
      type: "telegram_public",
      url: "https://t.me/quarantinedintel",
      accessMethod: "official_api",
      status: "quarantined",
      risk: "medium",
      legalNotes: "Quarantined public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    const quarantined = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: quarantinedStore,
      frontier: new FocusedFrontier()
    }));
    expect(quarantined).toMatchObject({
      operatorStates: [{ sourceId: "src_quarantined_telegram", state: "quarantined", collectable: false }]
    });

    const duplicateStore = new InMemoryScraperStore();
    duplicateStore.saveSource(source({
      id: "src_duplicate_telegram",
      name: "Duplicate public channel",
      type: "telegram_public",
      url: "https://t.me/duplicateintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"], lastDiscoveredUrls: ["https://t.me/duplicateintel/40"] }
    }));
    duplicateStore.saveCapture(telegramCapture({
      id: "cap_duplicate_telegram",
      sourceId: "src_duplicate_telegram",
      url: "https://t.me/duplicateintel/40",
      channel: "duplicateintel",
      messageId: 40,
      body: "APT29 repeated public-channel URL"
    }));
    const duplicate = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor"), {
      store: duplicateStore,
      frontier: new FocusedFrontier()
    }));
    expect(duplicate).toMatchObject({
      status: "high_duplicate",
      promotion: {
        duplicateSuppressed: [{ sourceId: "src_duplicate_telegram", messageUrl: "https://t.me/duplicateintel/40" }]
      },
      reliability: {
        sources: [{
          sourceId: "src_duplicate_telegram",
          recommendedActions: expect.arrayContaining(["suppress_repeated_urls"])
        }]
      },
      abuseControls: [{
        sourceId: "src_duplicate_telegram",
        suppressedUrlCount: 1
      }]
    });

    const churnStore = new InMemoryScraperStore();
    churnStore.saveSource(source({
      id: "src_churn_telegram",
      name: "Churn public channel",
      type: "telegram_public",
      url: "https://t.me/churnintel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public channel.",
      governance: approvedGovernance,
      metadata: { actors: ["APT29"] }
    }));
    churnStore.saveCapture(telegramCapture({
      id: "cap_churn_edit",
      sourceId: "src_churn_telegram",
      url: "https://t.me/churnintel/50",
      channel: "churnintel",
      messageId: 50,
      body: "APT29 edited public-channel note",
      editDate: "2026-05-24T00:01:00.000Z"
    }));
    churnStore.saveCapture(telegramCapture({
      id: "cap_churn_deleted",
      sourceId: "src_churn_telegram",
      url: "https://t.me/churnintel/51",
      channel: "churnintel",
      messageId: 51,
      body: "APT29 deleted public-channel note",
      messageState: "deleted"
    }));
    const churn = await body(await handleApiRequest(api("/v1/public-channels/status?q=APT29&entityType=actor&cursor=49"), {
      store: churnStore,
      frontier: new FocusedFrontier()
    }));
    expect(churn).toMatchObject({
      status: "ready",
      poll: {
        updatedMessages: [{ messageId: 50 }],
        deletedOrUnavailable: [{ messageId: 51 }]
      },
      cutoverReport: {
        reconciliation: {
          summary: {
            high_edit_delete_churn: 0
          }
        }
      }
    });
  });

  test("reports pending public-channel search with activation recommendations", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_pending_telegram",
      name: "Ransomware candidate channel",
      type: "telegram_public",
      url: "https://t.me/ransomwareintel",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Candidate public Telegram channel fixture.",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false
      },
      metadata: { ransomware: ["Akira"], victims: ["Fjord Energy AS"], topicTags: ["ransomware"] }
    }));

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Fjord%20Energy%20AS&entityType=victim"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.publicChannel).toMatchObject({
      status: "pending_channel_search",
      queuedTasks: 0,
      evidence: [],
      coverageGaps: [{
        reason: "matching_channels_pending_review",
        sourceId: "src_pending_telegram",
        requiredAction: "approve"
      }],
      activationRecommendations: [{
        sourceId: "src_pending_telegram",
        requiredAction: "approve"
      }]
    });
  });

  test("reports public-channel source-pack recommendations for uncovered live search queries", async () => {
    const store = new InMemoryScraperStore();
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Volt%20Typhoon&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack]
    }));

    const publicChannel = response.publicChannel as {
      status: string;
      queuedTasks: number;
      sourcePackRecommendations: Array<{ sourcePackId: string; sourceId: string; requiredAction: string }>;
      activationRecommendations: Array<{ sourcePackId?: string; sourceId: string; requiredAction: string }>;
    };
    expect(publicChannel.status).toBe("pending_channel_search");
    expect(publicChannel.queuedTasks).toBe(0);
    expect(publicChannel.sourcePackRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    expect(publicChannel.activationRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    const activationProgram = (response.publicChannel as {
      activationProgram: {
        recommendedPublicPacks: Array<{ sourcePackId: string; sourceId: string }>;
        noApprovedChannelGaps: Array<{ reason: string }>;
      };
    }).activationProgram;
    expect(activationProgram.recommendedPublicPacks[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity"
    });
    expect(activationProgram.noApprovedChannelGaps[0]).toMatchObject({
      reason: "no_approved_channels"
    });
    expect((response.publicChannel as { reconciliation: { packCount: number; repairs: unknown[]; summary: Record<string, number> } }).reconciliation).toMatchObject({
      packCount: 1,
      summary: {
        no_query_coverage: 0
      }
    });
    expect((response.publicChannel as { cutoverReport: { summary: Record<string, unknown>; sourcePackRecommendations: unknown[] } }).cutoverReport).toMatchObject({
      summary: {
        readyChannelCount: 0,
        pendingReviewCount: 0,
        rateLimitedCount: 0,
        staleCursorCount: 0,
        highDuplicateUrlCount: 0,
        safePartialEvidenceCount: 0,
        recommendedNextAction: "activate_source_pack"
      },
      sourcePackRecommendations: expect.any(Array)
    });
    const applyPlan = (response.publicChannel as { applyPlan: { summary: Record<string, unknown>; promotionGate: Record<string, unknown>; steps: Array<Record<string, unknown>> } }).applyPlan;
    expect(applyPlan).toMatchObject({
      summary: {
        humanApprovalRequiredCount: 5,
        canAutoApply: false
      },
      promotionGate: {
        metadataOnlyMedia: true,
        piiMinimizationRequired: true
      }
    });
    expect(applyPlan.steps[0]).toMatchObject({
      action: "activate_source_pack",
      execution: "human_approval_required",
      automationSafe: false,
      manual: true
    });
  });

  test("returns frozen public-channel apply-plan contract without raw payload fields", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "unsafe_private",
      name: "Unsafe private Telegram",
      type: "telegram_public",
      url: "https://t.me/+privateInvite",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Unsafe fixture should never activate.",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false
      },
      metadata: {
        actors: ["APT29"],
        accountAutomation: true,
        rawMessage: "do not expose",
        mediaPayload: "do not expose"
      }
    }));

    const response = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor" })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.contract).toMatchObject({
      endpoint: "/v1/public-channels/apply-plan",
      method: "POST",
      mode: "dry_run",
      examples: {
        automationSafe: { execution: "automation_safe" },
        humanApprovalRequired: { execution: "human_approval_required" },
        blockedPrivateTarget: { execution: "blocked" },
        rateLimitedChannel: { action: "delay_poll" },
        rollbackOnlyQuarantine: { execution: "rollback_only" }
      }
    });
    const applyPlan = response.applyPlan as {
      steps: Array<{ action: string; execution: string; prerequisites: string[] }>;
      promotionGate: { metadataOnlyMedia: boolean; piiMinimizationRequired: boolean };
    };
    expect(applyPlan.steps.some((step) => step.action === "activate_source_pack")).toBe(false);
    expect(applyPlan.steps.find((step) => step.action === "request_review")).toMatchObject({
      execution: "blocked",
      prerequisites: expect.arrayContaining(["blocked: private, invite, or account-automation targets cannot be activated"])
    });
    expect(applyPlan.promotionGate).toMatchObject({
      metadataOnlyMedia: true,
      piiMinimizationRequired: true
    });
    const serializedApplyPlan = JSON.stringify(response.applyPlan);
    expect(serializedApplyPlan).not.toContain("do not expose");
    expect(serializedApplyPlan).not.toContain("rawMessage");
    expect(serializedApplyPlan).not.toContain("mediaPayload");
    expect(serializedApplyPlan).not.toContain("+privateInvite");
  });

  test("routes public-channel apply-plan source-pack activation and review contracts", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const activation = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Volt Typhoon", entityType: "actor", actions: ["activate_source_pack"] })
    }), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack]
    }));

    expect(activation.applyPlan).toMatchObject({
      summary: {
        stepCount: 5,
        humanApprovalRequiredCount: 5,
        automationSafeCount: 0
      }
    });
    expect((activation.applyPlan as { steps: Array<Record<string, unknown>> }).steps[0]).toMatchObject({
      action: "activate_source_pack",
      execution: "human_approval_required",
      manual: true,
      automationSafe: false
    });
    expect(activation.canaryRollout).toMatchObject({
      mode: "dry_run",
      status: "hold",
      summary: {
        selectedSourceCount: 0,
        pendingReviewCount: 7,
        releaseTrain: "hold"
      },
      controls: {
        rollback: {
          dryRunOnly: true,
          quarantineSupported: true
        }
      }
    });
    expect(activation.promotionCanary).toMatchObject({
      mode: "dry_run",
      summary: {
        evidenceCount: 0,
        noLeakSerialization: true
      },
      handoffs: {
        agent06EvidenceCutover: expect.objectContaining({ evidenceCutoverReady: true }),
        agent10RcGate: expect.objectContaining({ status: expect.any(String) })
      }
    });
    expect(activation.promotionCertification).toMatchObject({
      mode: "dry_run",
      summary: {
        certifiedEvidenceCount: 0,
        sourceHealthUpdateCount: expect.any(Number),
        noLeakSerialization: true
      },
      handoffs: {
        agent07AnswerStateMachine: expect.objectContaining({ state: expect.any(String) }),
        agent10RcGate: expect.objectContaining({ decision: expect.any(String) })
      }
    });

    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_pending_review",
      name: "Pending public channel",
      type: "telegram_public",
      url: "https://t.me/public_review_channel",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Pending public Telegram review.",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false },
      metadata: { actors: ["APT29"] }
    }));
    const review = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["request_review"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(review.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        humanApprovalRequiredCount: 1
      },
      steps: [{
        action: "request_review",
        execution: "human_approval_required"
      }]
    });
  });

  test("routes public-channel apply-plan rate-limit and rollback-only quarantine contracts", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_rate_limited_channel",
      name: "Rate limited public channel",
      type: "telegram_public",
      url: "https://t.me/rate_limited_channel",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public Telegram channel.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false },
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      metadata: {
        actors: ["APT29"],
        rateLimitResetAt: "2999-01-01T00:00:00.000Z"
      }
    }));

    const rateLimited = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["delay_poll"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(rateLimited.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        automationSafeCount: 1,
        canAutoApply: true
      },
      steps: [{
        action: "delay_poll",
        execution: "automation_safe",
        rateLimitSafety: expect.arrayContaining(["honor current rate-limit reset at 2999-01-01T00:00:00.000Z"])
      }]
    });

    const rollbackStore = new InMemoryScraperStore();
    rollbackStore.saveSource(source({
      id: "src_active_private",
      name: "Active unsafe private channel",
      type: "telegram_public",
      url: "https://t.me/+privateInvite",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Unsafe active fixture.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false },
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      metadata: { actors: ["APT29"], accountAutomation: true }
    }));
    const rollback = await body(await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", actions: ["quarantine_channel"] })
    }), {
      store: rollbackStore,
      frontier: new FocusedFrontier()
    }));

    expect(rollback.applyPlan).toMatchObject({
      summary: {
        stepCount: 1,
        rollbackOnlyCount: 1
      },
      steps: [{
        action: "quarantine_channel",
        execution: "rollback_only",
        manual: true
      }]
    });
  });

  test("rejects invalid public-channel apply-plan actions", async () => {
    const response = await handleApiRequest(api("/v1/public-channels/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", actions: ["join_private_group"] })
    }), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const payload = await body(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "Unsupported public-channel apply-plan action",
        details: {
          invalidActions: ["join_private_group"],
          allowedActions: expect.arrayContaining(["activate_source_pack", "request_review", "delay_poll"])
        }
      }
    });
  });

  test("mounted public-channel apply-plan endpoint handles proof cases without leaking unsafe fields", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json();
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_public_review_mounted",
      name: "Mounted pending public channel",
      type: "telegram_public",
      url: "https://t.me/public_review_mounted",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: "Pending public Telegram review.",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false },
      metadata: { actors: ["APT29"] }
    }));
    store.saveSource(source({
      id: "src_public_rate_limited_mounted",
      name: "Mounted rate-limited public channel",
      type: "telegram_public",
      url: "https://t.me/public_rate_limited_mounted",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Approved public Telegram channel.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false, approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer" },
      metadata: { actors: ["APT29"], rateLimitResetAt: "2999-01-01T00:00:00.000Z" }
    }));
    store.saveSource(source({
      id: "src_public_private_mounted",
      name: "Mounted unsafe private channel",
      type: "telegram_public",
      url: "https://t.me/+privateInvite",
      accessMethod: "official_api",
      status: "active",
      risk: "medium",
      legalNotes: "Unsafe mounted fixture.",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvedBy: "reviewer",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false, approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer" },
      metadata: {
        actors: ["APT29"],
        accountAutomation: true,
        rawMessage: "mounted raw body must not leak",
        mediaPayload: "mounted media payload must not leak",
        sessionString: "mounted session must not leak"
      }
    }));

    const server = startApiServer({
      port: 0,
      store,
      frontier: new FocusedFrontier(),
      publicTelegramSourcePacks: [pack]
    });
    const post = async (payload: Record<string, unknown>) => {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/public-channels/apply-plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { response, payload: await response.json() as Record<string, unknown> };
    };

    try {
      const activation = await post({ query: "Volt Typhoon", entityType: "actor", actions: ["activate_source_pack"] });
      expect(activation.response.status).toBe(200);
      expect(activation.payload.applyPlan).toMatchObject({
        summary: { humanApprovalRequiredCount: 5 },
        steps: expect.arrayContaining([
          expect.objectContaining({ action: "activate_source_pack", execution: "human_approval_required" })
        ])
      });

      const review = await post({ query: "APT29", entityType: "actor", actions: ["request_review"] });
      expect(review.payload.applyPlan).toMatchObject({
        steps: expect.arrayContaining([
          expect.objectContaining({ action: "request_review", execution: "human_approval_required" }),
          expect.objectContaining({ action: "request_review", execution: "blocked" })
        ])
      });

      const rateLimited = await post({ query: "APT29", entityType: "actor", actions: ["delay_poll"] });
      expect(rateLimited.payload.applyPlan).toMatchObject({
        summary: { automationSafeCount: 1, canAutoApply: true },
        steps: [expect.objectContaining({ action: "delay_poll", execution: "automation_safe" })]
      });

      const rollback = await post({ query: "APT29", entityType: "actor", actions: ["quarantine_channel"] });
      expect(rollback.payload.applyPlan).toMatchObject({
        summary: { rollbackOnlyCount: 1 },
        steps: [expect.objectContaining({ action: "quarantine_channel", execution: "rollback_only" })]
      });

      const statusResponse = await fetch(`http://127.0.0.1:${server.port}/v1/public-channels/status?q=APT29&entityType=actor`);
      const statusPayload = await statusResponse.json() as Record<string, unknown>;
      expect(statusPayload).toMatchObject({
        endpoint: "/v1/public-channels/status",
        operatorStates: expect.arrayContaining([
          expect.objectContaining({ sourceId: "src_public_review_mounted", state: "pending_review" }),
          expect.objectContaining({ sourceId: "src_public_rate_limited_mounted", state: "delayed" }),
          expect.objectContaining({ sourceId: "src_public_private_mounted", state: "policy_blocked" })
        ]),
        sourcePackCompatibility: expect.any(Array),
        sourcePackReadiness: expect.objectContaining({
          summary: expect.objectContaining({
            sourcePackCount: expect.any(Number),
            candidateCount: expect.any(Number)
          }),
          safeOutput: expect.objectContaining({
            rawPrivateDataExposed: false,
            rawMediaPayloadsExposed: false,
            credentialsExposed: false
          })
        }),
        actorReadiness: {
          status: expect.any(String)
        },
        answerReadiness: {
          reliability: {
            sourceCount: expect.any(Number)
          },
          promotionYield: {
            rating: expect.any(String)
          }
        },
        operatorControlEffects: expect.arrayContaining([
          expect.objectContaining({ action: "request_review", expectedAnswerQualityEffect: "queues_human_review_for_readiness" }),
          expect.objectContaining({ action: "delay_poll", expectedAnswerQualityEffect: "delays_freshness_keeps_claims_partial" })
        ])
      });

      const invalid = await post({ query: "APT29", actions: ["join_private_group"] });
      expect(invalid.response.status).toBe(400);
      expect(invalid.payload).toMatchObject({
        error: {
          code: "invalid_action",
          details: { invalidActions: ["join_private_group"] }
        }
      });

      const serialized = JSON.stringify({ activation, review, rateLimited, rollback, statusPayload, invalid });
      expect(serialized).not.toContain("mounted raw body must not leak");
      expect(serialized).not.toContain("mounted media payload must not leak");
      expect(serialized).not.toContain("mounted session must not leak");
      expect(serialized).not.toContain("+privateInvite");
    } finally {
      server.stop();
    }
  });

  test("returns restricted metadata apply-plan contracts for every cutover status", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    const response = await body(await handleApiRequest(api("/v1/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retentionExpiringWithinDays: 7, includeCutover: true })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.contract).toMatchObject({
      endpoint: "/v1/restricted-metadata/apply-plan",
      method: "POST",
      mode: "dry_run",
      examples: {
        disabled: { action: "disable_source", safety: "rollback_only" },
        pendingApproval: { action: "renew_legal_notes", safety: "human_approval_required" },
        readyMetadataOnly: { action: "enable_metadata_only_queue", safety: "automation_safe" },
        blockedUnsafeTarget: { action: "keep_source_blocked", safety: "blocked" },
        killSwitchActive: { action: "apply_kill_switch", safety: "rollback_only" },
        retentionExpiring: { action: "shorten_retention" },
        auditClean: { action: "enable_metadata_only_queue" }
      }
    });
    const applyPlan = response.applyPlan as {
      actions: Array<{
        action: string;
        sourceId: string;
        safety: string;
        prohibitedAlternatives: string[];
        proof: {
          exposesRawUrl: boolean;
          allowsPayloadDownload: boolean;
          allowsAuthBypass: boolean;
          allowsCaptchaSolving: boolean;
          allowsPrivateCommunityAccess: boolean;
          allowsThreatActorInteraction: boolean;
        };
      }>;
      connectorCertifications: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; noLeakSerialization: { passed: boolean }; guarantees: Record<string, boolean> }>;
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; rcGate: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      noLeakSerialization: { passed: boolean };
      summary: Record<string, number>;
      agent09PolicyStatusFields: string[];
      agent10KillSwitchRollback: string[];
    };
    expect(applyPlan.actions.map((item) => item.action)).toEqual(expect.arrayContaining([
      "enable_metadata_only_queue",
      "renew_legal_notes",
      "keep_source_blocked",
      "apply_kill_switch",
      "disable_source",
      "shorten_retention"
    ]));
    expect(applyPlan.summary.automation_safe).toBeGreaterThanOrEqual(2);
    expect(applyPlan.summary.human_approval_required).toBeGreaterThanOrEqual(1);
    expect(applyPlan.summary.blocked).toBeGreaterThanOrEqual(1);
    expect(applyPlan.summary.rollback_only).toBeGreaterThanOrEqual(1);
    expect(applyPlan.agent09PolicyStatusFields).toEqual(expect.arrayContaining([
      "disabled",
      "pending_approval",
      "ready_metadata_only",
      "blocked_unsafe_target",
      "kill_switch_active",
      "retention_expiring",
      "audit_clean"
    ]));
    expect(applyPlan.agent10KillSwitchRollback).toEqual(expect.arrayContaining(["pause_restricted_metadata_workers"]));
    expect(applyPlan.noLeakSerialization.passed).toBe(true);
    expect(applyPlan.connectorCertifications.map((packet) => packet.scenario)).toEqual(expect.arrayContaining([
      "unsafe_link_form_download",
      "retention_expiry",
      "low_yield_source"
    ]));
    expect(applyPlan.connectorCertifications.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(applyPlan.killSwitchDrills).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      operatorVisible: true,
      noLeakSerialization: { passed: true }
    });
    expect(applyPlan.killSwitchDrills.observedScenarios).toEqual(expect.arrayContaining([
      "unsafe_download_form_contact_link",
      "kill_switch_activation_mid_run",
      "retention_expiry",
      "public_api_blocked_state"
    ]));
    expect(applyPlan.killSwitchDrills.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(applyPlan.emergencyStopCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: { passed: true }
    });
    expect(applyPlan.emergencyStopCertification.observedScenarios).toEqual(expect.arrayContaining([
      "unsafe_download_form_contact_target",
      "kill_switch_propagation",
      "retention_expiry",
      "public_api_blocked_state"
    ]));
    expect(applyPlan.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" &&
      packet.noLeakSerialization.passed &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence
    )).toBe(true);
    for (const action of applyPlan.actions) {
      expect(action.prohibitedAlternatives).toEqual(expect.arrayContaining([
        "payload download remains prohibited",
        "credential or authentication bypass remains prohibited",
        "CAPTCHA solving remains prohibited",
        "private community access remains prohibited",
        "threat actor interaction remains prohibited",
        "unsafe restricted URLs remain redacted to hashes"
      ]));
      expect(action.proof).toMatchObject({
        exposesRawUrl: false,
        allowsPayloadDownload: false,
        allowsAuthBypass: false,
        allowsCaptchaSolving: false,
        allowsPrivateCommunityAccess: false,
        allowsThreatActorInteraction: false
      });
    }
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("customer-dump");
  });

  test("returns restricted metadata operations status without unsafe details", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    store.saveCapture({
      id: "cap_restricted_status",
      sourceId: "src_restricted_ready",
      url: "http://readyexample.onion/posts",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: "hash_restricted_status",
      mediaType: "text/plain",
      storageKind: "metadata_only",
      retentionClass: "restricted_metadata",
      metadata: {
        adapter: "darknet_metadata",
        leakSite: {
          actorName: "Akira",
          victimName: "Fjord Energy AS",
          claimDate: "2026-05-20",
          claimedSector: "Energy",
          claimedCountry: "NO",
          claimedDataCategory: "contracts",
          postStatus: "new",
          sourceTimestamp: "2026-05-23T00:00:00.000Z",
          urlHash: "urlhash_restricted_status",
          screenshotHash: "screenhash_restricted_status",
          confidence: 0.82
        },
        policyDecision: { id: "policy_restricted_status" }
      },
      sensitive: true
    });

    const response = await body(await handleApiRequest(api("/v1/restricted-metadata/status"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.status).toMatchObject({
      endpoint: "/v1/restricted-metadata/status",
      metadataOnly: true,
      safeForApi: true,
      agent06EvidenceHandoffProof: {
        unsafeDetected: false,
        agent06StorageContract: "metadata_only_no_body_object_url_filename_credentials_or_payload_reference"
      }
    });
    const status = response.status as {
      summary: Record<string, number>;
      sources: Array<{ sourceId: string; endpoints: Record<string, string>; redactionGuarantees: Record<string, unknown>; forbiddenActionCounters: Record<string, number> }>;
      operationalSla: { status: string; metrics: Record<string, number>; metadataOnly: boolean; safeForApi: boolean };
      enforcement: { level: string; metadataOnly: boolean; safeForApi: boolean; activeRules: Array<{ rule: string }>; emergencyStop: { state: string; dryRunOnly: boolean; workerAction: string }; agent09WarningCodes: string[] };
      auditTrail: { metadataOnly: boolean; safeForApi: boolean; unsafeFieldsExposed: boolean; rejectedFields: string[] };
      governancePackets: Array<{ metadataOnly: boolean; safeForApi: boolean; networks: string[]; proof: Record<string, boolean>; redactionPolicy: Record<string, boolean> }>;
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[]; scenarios: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean }> };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      connectorCertifications: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }>;
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ scenario: string; metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; rcGate: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      agent10ReleasePacket: { runtimeProofName: string; decision: string; proofCommand: string; metadataOnly: boolean; safeForApi: boolean; enforcementLevel: string; emergencyStopState: string; governancePacketIds: string[]; auditReplayScenarios: string[]; certificationPacketIds: string[]; certificationScenarios: string[]; killSwitchDrillPacketIds: string[]; killSwitchDrillScenarios: string[]; emergencyStopCertificationPacketIds: string[]; emergencyStopCertificationScenarios: string[] };
      remediationPlan: Array<{ action: string; dryRunOnly: boolean; metadataOnly: boolean }>;
      connectorFixtures: Array<{ network: string; actor: string; victim: string; urlHash: string; metadataOnly: boolean }>;
    };
    expect(status.summary.ready).toBeGreaterThanOrEqual(1);
    expect(status.sources.find((source) => source.sourceId === "src_restricted_ready")).toMatchObject({
      endpoints: {
        intelSearchField: "/v1/intel/search.restrictedMetadata",
        statusRoute: "/v1/restricted-metadata/status"
      },
      redactionGuarantees: {
        bodyRedacted: true,
        rawUrlRedacted: true,
        fileNameRedacted: true
      },
      forbiddenActionCounters: {
        credentialBypassAttempts: 0,
        stolenFileDownloadAttempts: 0
      }
    });
    expect(status.remediationPlan.map((item) => item.action)).toEqual(expect.arrayContaining([
      "renew_approval",
      "activate_kill_switch",
      "rollback_disabled_source"
    ]));
    expect(status.operationalSla).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      metrics: {
        metadataOnlyEvidenceYield: 1
      }
    });
    expect(["pass", "warning", "breach"]).toContain(status.operationalSla.status);
    expect(status.enforcement).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      emergencyStop: {
        dryRunOnly: true
      }
    });
    expect(["pass", "warning", "hold", "emergency_stop"]).toContain(status.enforcement.level);
    expect(status.enforcement.activeRules.map((rule) => rule.rule)).toEqual(expect.arrayContaining([
      "forbidden_action_attempt_emergency_stop"
    ]));
    expect(status.enforcement.agent09WarningCodes).toContain("restricted_metadata_forbidden_action");
    expect(status.auditTrail).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      unsafeFieldsExposed: false
    });
    expect(status.auditTrail.rejectedFields).toEqual(expect.arrayContaining(["rawUrl", "body", "fileName", "objectKey", "credentials"]));
    expect(status.governancePackets.length).toBeGreaterThan(0);
    expect(status.governancePackets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.proof.noStolenFilesStored &&
      packet.proof.noRawPayloadsStored &&
      packet.redactionPolicy.rawUrlRedacted
    )).toBe(true);
    expect(status.auditReplay).toMatchObject({
      metadataOnly: true,
      safeForApi: true
    });
    expect(status.auditReplay.observedScenarios).toEqual(expect.arrayContaining(["allowed_metadata_only_record", "unsafe_action_attempt"]));
    expect(status.auditReplay.scenarios.every((scenario) => scenario.metadataOnly && scenario.safeForApi)).toBe(true);
    expect(status.connectorCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.connectorCertification.observedScenarios).toEqual(expect.arrayContaining(["unsafe_link_form_download"]));
    expect(status.connectorCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(status.connectorCertifications.length).toBeGreaterThan(0);
    expect(status.killSwitchDrills).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      operatorVisible: true,
      noLeakSerialization: { passed: true }
    });
    expect(status.killSwitchDrills.observedScenarios).toEqual(expect.arrayContaining(["unsafe_download_form_contact_link", "public_api_blocked_state"]));
    expect(status.killSwitchDrills.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload
    )).toBe(true);
    expect(status.emergencyStopCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: { passed: true }
    });
    expect(status.emergencyStopCertification.observedScenarios).toEqual(expect.arrayContaining(["unsafe_download_form_contact_target", "public_api_blocked_state"]));
    expect(status.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" &&
      packet.noLeakSerialization.passed &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence
    )).toBe(true);
    expect(status.agent10ReleasePacket).toMatchObject({
      runtimeProofName: "restricted_metadata_sla",
      proofCommand: "bun run check:restricted-metadata-status",
      metadataOnly: true,
      safeForApi: true,
      enforcementLevel: status.enforcement.level,
      emergencyStopState: status.enforcement.emergencyStop.state
    });
    expect(status.agent10ReleasePacket.governancePacketIds.length).toBe(status.governancePackets.length);
    expect(status.agent10ReleasePacket.auditReplayScenarios).toEqual(expect.arrayContaining(["unsafe_action_attempt"]));
    expect(status.agent10ReleasePacket.certificationPacketIds.length).toBe(status.connectorCertification.packets.length);
    expect(status.agent10ReleasePacket.certificationScenarios).toEqual(expect.arrayContaining(["unsafe_link_form_download"]));
    expect(status.agent10ReleasePacket.killSwitchDrillPacketIds.length).toBe(status.killSwitchDrills.packets.length);
    expect(status.agent10ReleasePacket.killSwitchDrillScenarios).toEqual(expect.arrayContaining(["public_api_blocked_state"]));
    expect(status.agent10ReleasePacket.emergencyStopCertificationPacketIds.length).toBe(status.emergencyStopCertification.packets.length);
    expect(status.agent10ReleasePacket.emergencyStopCertificationScenarios).toEqual(expect.arrayContaining(["public_api_blocked_state"]));
    expect(status.remediationPlan.every((item) => item.dryRunOnly && item.metadataOnly)).toBe(true);
    expect(status.connectorFixtures.map((fixture) => fixture.network).sort()).toEqual(["freenet", "i2p", "tor"]);
    expect(status.connectorFixtures.every((fixture) => fixture.metadataOnly && fixture.actor && fixture.victim && fixture.urlHash)).toBe(true);
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("customer-dump");
    expect(serialized).not.toContain("user:pass");
  });

  test("routes restricted metadata nested apply-plan and rejects invalid actions", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);

    const nested = await body(await handleApiRequest(api("/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: ["enable_metadata_only_queue"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    }));
    expect(nested.applyPlan).toMatchObject({
      summary: {
        automation_safe: 1,
        human_approval_required: 0,
        blocked: 0,
        rollback_only: 0
      },
      actions: [{
        sourceId: "src_restricted_ready",
        action: "enable_metadata_only_queue",
        safety: "automation_safe"
      }]
    });

    const invalid = await handleApiRequest(api("/v1/restricted-metadata/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: ["download_payload"] })
    }), {
      store,
      frontier: new FocusedFrontier()
    });
    const payload = await body(invalid);
    expect(invalid.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "Unsupported restricted-metadata apply-plan action",
        details: {
          invalidActions: ["download_payload"],
          allowedActions: expect.arrayContaining(["enable_metadata_only_queue", "keep_source_blocked", "apply_kill_switch"])
        }
      }
    });
  });

  test("mounted restricted metadata apply-plan endpoints prove all statuses without unsafe leaks", async () => {
    const store = new InMemoryScraperStore();
    for (const item of apiRestrictedMetadataApplyPlanSources()) store.saveSource(item);
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    const post = async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { response, payload: await response.json() as Record<string, unknown> };
    };

    try {
      const all = await post("/v1/restricted-metadata/apply-plan", {
        retentionExpiringWithinDays: 7,
        includeCutover: true
      });
      expect(all.response.status).toBe(200);
      const allApplyPlan = all.payload.applyPlan as {
        actions: Array<{ action: string; sourceId: string; safety: string; prohibitedAlternatives: string[]; proof: Record<string, unknown> }>;
        agent09PolicyStatusFields: string[];
        agent10KillSwitchRollback: string[];
      };
      const allCutover = all.payload.cutoverReport as {
        agent09: { statuses: Record<string, number> };
      };
      expect(allCutover.agent09.statuses).toMatchObject({
        disabled: 1,
        pending_approval: 1,
        ready_metadata_only: expect.any(Number),
        blocked_unsafe_target: 1,
        kill_switch_active: 1,
        retention_expiring: 1,
        audit_clean: expect.any(Number)
      });
      expect(allApplyPlan.actions.map((item) => item.action)).toEqual(expect.arrayContaining([
        "enable_metadata_only_queue",
        "renew_legal_notes",
        "keep_source_blocked",
        "apply_kill_switch",
        "disable_source",
        "shorten_retention"
      ]));
      expect(allApplyPlan.agent09PolicyStatusFields).toEqual(expect.arrayContaining(["ready_metadata_only", "blocked_unsafe_target", "kill_switch_active"]));
      expect(allApplyPlan.agent10KillSwitchRollback).toEqual(expect.arrayContaining(["pause_restricted_metadata_workers"]));

      const nested = await post("/v1/sources/src_restricted_ready/restricted-metadata/apply-plan", {
        actions: ["enable_metadata_only_queue"]
      });
      expect(nested.response.status).toBe(200);
      expect(nested.payload.applyPlan).toMatchObject({
        summary: {
          automation_safe: 1,
          human_approval_required: 0,
          blocked: 0,
          rollback_only: 0
        },
        actions: [{
          sourceId: "src_restricted_ready",
          action: "enable_metadata_only_queue",
          safety: "automation_safe"
        }]
      });

      const invalid = await post("/v1/restricted-metadata/apply-plan", {
        actions: ["solve_captcha_then_download"]
      });
      expect(invalid.response.status).toBe(400);
      expect(invalid.payload).toMatchObject({
        error: {
          code: "invalid_action",
          details: { invalidActions: ["solve_captcha_then_download"] }
        }
      });

      for (const action of allApplyPlan.actions) {
        expect(action.prohibitedAlternatives).toEqual(expect.arrayContaining([
          "payload download remains prohibited",
          "credential or authentication bypass remains prohibited",
          "CAPTCHA solving remains prohibited",
          "private community access remains prohibited",
          "threat actor interaction remains prohibited",
          "unsafe restricted URLs remain redacted to hashes"
        ]));
        expect(action.proof).toMatchObject({
          exposesRawUrl: false,
          allowsPayloadDownload: false,
          allowsAuthBypass: false,
          allowsCaptchaSolving: false,
          allowsPrivateCommunityAccess: false,
          allowsThreatActorInteraction: false
        });
      }
      const serialized = JSON.stringify({ all, nested, invalid });
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain(".onion");
      expect(serialized).not.toContain("user:pass");
      expect(serialized).not.toContain("customer-dump");
      expect(serialized).not.toContain("raw leak");
    } finally {
      server.stop();
    }
  });

  test("returns frozen scheduler apply-plan contract without mutating frontier state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const hotSource = source({ id: "src_scheduler_hot", tags: ["apt29"] });
    store.saveSource(hotSource);
    for (let index = 0; index < 24; index += 1) {
      frontier.add({
        source: hotSource,
        tenantId: "tenant_scheduler",
        intelRequestId: `request_scheduler_${Math.floor(index / 4)}`,
        url: `https://scheduler.example.test/${index}`,
        discoveredAt: "2026-01-01T00:00:00.000Z",
        anchorText: "APT29 public ti background sweep",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.7,
        fairnessKey: "background:scheduler-hot"
      });
    }
    const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const beforeLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
    const response = await body(await handleApiRequest(api("/v1/frontier/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenario: "api_scheduler_contract",
        includeExecutionPreview: true,
        workerUtilization: 0.96,
        dbConnectionUtilization: 0.91,
        maxApiP95QueueAgeSeconds: 120
      })
    }), { store, frontier }));
    const afterQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const afterLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
    const contract = response.contract as {
      endpoint: string;
      mode: string;
      response: { actions: string[]; forbiddenMutationFields: string[] };
      examples: Array<{ name: string }>;
    };
    const applyPlan = response.applyPlan as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willLeaseTasks: boolean;
      willAcknowledgeTasks: boolean;
      willChangeRuns: boolean;
      summary: { stepCount: number };
      executionPreview: { willMutate: boolean; steps: Array<{ wouldApply: boolean }> };
      promotionPacketLink: { field: string };
    };

    expect(contract.endpoint).toBe("/v1/frontier/apply-plan");
    expect(contract.mode).toBe("dry_run");
    expect(contract.response.actions).toContain("trigger_emergency_brake");
    expect(contract.response.forbiddenMutationFields).toContain("cursorPayload");
    expect(contract.examples.map((example) => example.name)).toEqual([
      "expired_lease_release",
      "abandoned_run_cancel",
      "transient_requeue",
      "low_priority_deferral",
      "noisy_source_pause",
      "quarantine_recommendation",
      "emergency_brake"
    ]);
    for (const example of contract.examples as unknown as Array<{
      response: {
        willMutate: boolean;
        willLeaseTasks: boolean;
        willAcknowledgeTasks: boolean;
        willChangeRuns: boolean;
        item: {
          execution: string;
          riskClass: string;
          preconditions: string[];
          expectedQueueRunDelta: { cursorReplayState: string };
          rollback: string;
        };
      };
    }>) {
      expect(example.response).toMatchObject({
        willMutate: false,
        willLeaseTasks: false,
        willAcknowledgeTasks: false,
        willChangeRuns: false
      });
      expect(["automation_safe", "human_approval_required", "blocked", "rollback_only"]).toContain(example.response.item.execution);
      expect(["low", "medium", "high", "emergency"]).toContain(example.response.item.riskClass);
      expect(example.response.item.preconditions.length).toBeGreaterThan(0);
      expect(example.response.item.expectedQueueRunDelta.cursorReplayState).toBe("preserved");
      expect(example.response.item.rollback.length).toBeGreaterThan(0);
    }
    expect(applyPlan.endpoint).toBe("/v1/frontier/apply-plan");
    expect(applyPlan.dryRun).toBe(true);
    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willLeaseTasks).toBe(false);
    expect(applyPlan.willAcknowledgeTasks).toBe(false);
    expect(applyPlan.willChangeRuns).toBe(false);
    expect(applyPlan.summary.stepCount).toBeGreaterThan(0);
    expect(applyPlan.executionPreview.willMutate).toBe(false);
    expect(applyPlan.executionPreview.steps.every((step) => step.wouldApply === false)).toBe(true);
    expect(applyPlan.promotionPacketLink.field).toBe("schedulerApplyPlanId");
    expect(afterQueued).toEqual(beforeQueued);
    expect(afterLeased).toEqual(beforeLeased);
    expect(JSON.stringify(response.applyPlan)).not.toContain("dbTransaction");
    expect(JSON.stringify(response.applyPlan)).not.toContain("cursorPayload");
  });

  test("rejects invalid scheduler apply-plan actions without mutating frontier state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const activeSource = source({ id: "src_invalid_scheduler_action" });
    store.saveSource(activeSource);
    frontier.add({
      source: activeSource,
      tenantId: "tenant_scheduler",
      intelRequestId: "request_invalid_action",
      url: "https://scheduler.example.test/invalid-action",
      discoveredAt: "2026-01-01T00:00:00.000Z",
      anchorText: "APT29 scheduler invalid action fixture",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.7
    });
    const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const response = await handleApiRequest(api("/v1/frontier/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedActions: ["mutate_queue_now"] })
    }), { store, frontier });
    const payload = await body(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "selectedActions contains unsupported frontier apply actions",
        details: {
          invalid: ["mutate_queue_now"],
          allowed: expect.arrayContaining(["release_expired_leases", "trigger_emergency_brake"])
        }
      }
    });
    expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(beforeQueued);
    expect(frontier.leasedSnapshot()).toEqual([]);
  });

  test("smokes mounted scheduler apply-plan endpoint for normal degraded emergency and invalid requests", async () => {
    const scenarios: Array<{
      name: string;
      queued: number;
      ageSeconds: number;
      request: Record<string, unknown>;
      status: number;
      expectedAction?: string;
      expectedError?: string;
    }> = [
      { name: "normal", queued: 2, ageSeconds: 5, request: { scenario: "normal", includeExecutionPreview: true }, status: 200 },
      { name: "degraded", queued: 24, ageSeconds: 45, request: { scenario: "degraded", includeExecutionPreview: true, workerUtilization: 0.9 }, status: 200, expectedAction: "pause_noisy_source_queues" },
      { name: "emergency_brake", queued: 24, ageSeconds: 14_400, request: { scenario: "emergency_brake", includeExecutionPreview: true, workerUtilization: 0.96, dbConnectionUtilization: 0.92, maxApiP95QueueAgeSeconds: 120 }, status: 200, expectedAction: "trigger_emergency_brake" },
      { name: "invalid_action", queued: 1, ageSeconds: 5, request: { selectedActions: ["mutate_queue_now"] }, status: 400, expectedError: "invalid_action" }
    ];

    for (const scenario of scenarios) {
      const store = new InMemoryScraperStore();
      const frontier = new FocusedFrontier();
      const activeSource = source({ id: `src_mounted_${scenario.name}` });
      store.saveSource(activeSource);
      const queuedAt = new Date(Date.now() - scenario.ageSeconds * 1000).toISOString();
      for (let index = 0; index < scenario.queued; index += 1) {
        frontier.add({
          source: activeSource,
          tenantId: "tenant_mounted_scheduler",
          intelRequestId: `request_mounted_${scenario.name}_${Math.floor(index / 4)}`,
          url: `https://scheduler.example.test/${scenario.name}/${index}`,
          discoveredAt: queuedAt,
          anchorText: "APT29 mounted endpoint proof",
          parentRelevance: 0.9,
          novelty: 0.8,
          freshness: 0.8,
          fairnessKey: scenario.name === "normal" ? "interactive:mounted" : "background:mounted"
        });
      }
      const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
      const beforeLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
      const beforeRuns = store.listRuns().map((run) => `${run.id}:${run.status}:${run.updatedAt}`).sort();
      const server = startApiServer({ port: 0, store, frontier });
      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/v1/frontier/apply-plan`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(scenario.request)
        });
        const payload = await response.json() as {
          applyPlan?: {
            dryRun: boolean;
            willMutate: boolean;
            items: Array<{ action: string; expectedQueueRunDelta: { cursorReplayState: string } }>;
            executionPreview?: { willMutate: boolean; steps: Array<{ wouldApply: boolean }> };
            emergencyBrake: { preservesCursorReplayState: boolean };
          };
          error?: { code: string };
        };

        expect(response.status).toBe(scenario.status);
        if (scenario.status === 200) {
          expect(payload.applyPlan).toMatchObject({
            dryRun: true,
            willMutate: false,
            emergencyBrake: { preservesCursorReplayState: true }
          });
          expect(payload.applyPlan?.executionPreview?.willMutate).toBe(false);
          expect(payload.applyPlan?.executionPreview?.steps.every((step) => step.wouldApply === false)).toBe(true);
          expect(payload.applyPlan?.items.every((item) => item.expectedQueueRunDelta.cursorReplayState === "preserved")).toBe(true);
          if (scenario.expectedAction) {
            expect(payload.applyPlan?.items.map((item) => item.action)).toContain(scenario.expectedAction);
          }
        } else {
          expect(payload.error?.code).toBe(scenario.expectedError);
        }
      } finally {
        server.stop();
      }
      expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(beforeQueued);
      expect(frontier.leasedSnapshot().map((task) => task.id).sort()).toEqual(beforeLeased);
      expect(store.listRuns().map((run) => `${run.id}:${run.status}:${run.updatedAt}`).sort()).toEqual(beforeRuns);
    }
  });

  test("returns frozen source apply-plan contract without mutating sources or crawling", async () => {
    const store = new InMemoryScraperStore();
    const reviewedAt = new Date().toISOString();
    const candidate = source({ id: "src_source_apply_candidate", status: "candidate", tenantId: "tenant_source_apply", tags: ["apt29"], url: "https://candidate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } });
    const unhealthy = source({
      id: "src_source_apply_unhealthy",
      status: "active",
      tenantId: "tenant_source_apply",
      tags: ["apt29"],
      url: "https://unhealthy.example.test/feed",
      metadata: { legalNotesReviewedAt: reviewedAt },
      health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 }
    });
    const duplicateA = source({ id: "src_source_apply_duplicate_a", url: "https://duplicate.example.test/feed", tenantId: "tenant_source_apply", tags: ["apt29"], metadata: { legalNotesReviewedAt: reviewedAt } });
    const duplicateB = source({ id: "src_source_apply_duplicate_b", url: "https://duplicate.example.test/feed", tenantId: "tenant_source_apply", tags: ["apt29"], metadata: { legalNotesReviewedAt: reviewedAt } });
    for (const item of [candidate, unhealthy, duplicateA, duplicateB]) store.saveSource(item);
    const before = store.listSources().map((item) => `${item.id}:${item.status}`).sort();

    const response = await body(await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_apply" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
        sourcePackIds: ["safe-public-cti-starter-pack"],
        selectedActions: ["approve", "quarantine", "retire", "request_legal_notes", "leave_unchanged"],
        includeExecutionPreview: true
      })
    }), { store, frontier: new FocusedFrontier() }));
    const after = store.listSources().map((item) => `${item.id}:${item.status}`).sort();
    const contract = response.contract as {
      endpoint: string;
      mode: string;
      response: { actions: string[]; forbiddenMutationFields: string[] };
      examples: Array<{ name: string }>;
    };
    const applyPlan = response.applyPlan as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      approvalSummary: { approvalsRequired: number; rollbackOnly: number };
      items: Array<{ action: string; collectionImpact: { willStartCrawling: boolean }; automation: string }>;
      executionPreview: { dryRun: boolean; executed: boolean; itemResults: Array<{ reason: string }> };
      promotionPacketLink: { field: string };
      schemaExamples: Array<{ name: string; response: { willMutate: boolean; willStartCrawling: boolean } }>;
    };

    expect(contract.endpoint).toBe("/v1/sources/apply-plan");
    expect(contract.mode).toBe("dry_run");
    expect(contract.response.actions).toEqual(expect.arrayContaining(["approve", "quarantine", "retire", "request_legal_notes"]));
    expect(contract.response.forbiddenMutationFields).toEqual(expect.arrayContaining(["updatedSource", "startedCrawl", "restrictedActivation"]));
    expect(contract.examples.map((example) => example.name)).toEqual(expect.arrayContaining([
      "happy_path",
      "human_approval_required",
      "blocked_restricted_source",
      "duplicate_source",
      "stale_legal_notes",
      "rollback_only_quarantine"
    ]));
    expect(applyPlan.endpoint).toBe("/v1/sources/apply-plan");
    expect(applyPlan.dryRun).toBe(true);
    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willStartCrawling).toBe(false);
    expect(applyPlan.approvalSummary.approvalsRequired).toBeGreaterThanOrEqual(0);
    expect(applyPlan.approvalSummary.rollbackOnly).toBeGreaterThan(0);
    expect(applyPlan.items.every((item) => item.collectionImpact.willStartCrawling === false)).toBe(true);
    expect(applyPlan.items.map((item) => item.action)).toEqual(expect.arrayContaining(["approve", "quarantine"]));
    expect(applyPlan.executionPreview.dryRun).toBe(true);
    expect(applyPlan.executionPreview.executed).toBe(false);
    expect(applyPlan.executionPreview.itemResults.every((item) => item.reason.includes("Dry-run") || item.reason.includes("blocked"))).toBe(true);
    expect(applyPlan.promotionPacketLink.field).toBe("sourceApplyPlanId");
    expect(applyPlan.schemaExamples.every((example) => example.response.willMutate === false && example.response.willStartCrawling === false)).toBe(true);
    expect(after).toEqual(before);
  });

  test("source apply-plan route blocks restricted auto-activation and rejects invalid actions", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_route_restricted",
      name: "Restricted Route Source",
      type: "tor_metadata",
      url: "http://restricted-route.onion",
      accessMethod: "approved_proxy",
      risk: "restricted",
      status: "approved",
      tenantId: "tenant_restricted_route",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: "2026-05-24T00:00:00.000Z",
        approvedBy: "legal",
        policyVersion: "collection-policy:v1"
      },
      metadata: { legalNotesReviewedAt: new Date().toISOString() },
      tags: ["apt29"]
    }));

    const restricted = await body(await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_restricted_route" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
        sourcePackIds: [],
        selectedActions: ["activate", "quarantine", "request_legal_notes"],
        includeExecutionPreview: true
      })
    }), { store, frontier: new FocusedFrontier() }));
    const applyPlan = restricted.applyPlan as {
      willMutate: boolean;
      willStartCrawling: boolean;
      items: Array<{
        action: string;
        automation: string;
        policyImpact: { metadataOnlyRequired: boolean };
        collectionImpact: { enablesCollection: boolean; remainsDisabled: string[] };
      }>;
    };

    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willStartCrawling).toBe(false);
    expect(applyPlan.items.some((item) => item.action === "activate" && item.collectionImpact.enablesCollection)).toBe(false);
    expect(applyPlan.items.some((item) => item.policyImpact.metadataOnlyRequired)).toBe(true);
    expect(applyPlan.items.flatMap((item) => item.collectionImpact.remainsDisabled)).toEqual(expect.arrayContaining([
      "restricted raw payload collection",
      "automatic restricted-source activation"
    ]));

    const invalidResponse = await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"] },
        selectedActions: ["launch_crawler"]
      })
    }), { store, frontier: new FocusedFrontier() });
    const invalid = await body(invalidResponse);
    expect(invalidResponse.status).toBe(400);
    expect(invalid.error).toMatchObject({ code: "invalid_action" });
  });

  test("smokes mounted source apply-plan endpoint for happy restricted and invalid proof cases", async () => {
    const reviewedAt = new Date().toISOString();
    const scenarios: Array<{
      name: "happy_path" | "blocked_restricted_source" | "invalid_action";
      sources: SourceRecord[];
      request: Record<string, unknown>;
      headers?: Record<string, string>;
      status: number;
      expectedError?: string;
    }> = [
      {
        name: "happy_path",
        sources: [
          source({ id: "src_mounted_source_candidate", status: "candidate", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://candidate-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
          source({ id: "src_mounted_source_unhealthy", status: "active", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://unhealthy-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt }, health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 } }),
          source({ id: "src_mounted_source_duplicate_a", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://duplicate-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
          source({ id: "src_mounted_source_duplicate_b", tenantId: "tenant_mounted_source", tags: ["apt29"], url: "https://duplicate-mounted.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } })
        ],
        request: {
          queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
          sourcePackIds: ["safe-public-cti-starter-pack"],
          selectedActions: ["approve", "quarantine", "retire", "request_legal_notes", "leave_unchanged"],
          includeExecutionPreview: true
        },
        headers: { "x-tenant-id": "tenant_mounted_source" },
        status: 200
      },
      {
        name: "blocked_restricted_source",
        sources: [
          source({
            id: "src_mounted_source_restricted",
            name: "Mounted Restricted Source",
            type: "tor_metadata",
            url: "http://restricted-mounted.onion",
            accessMethod: "approved_proxy",
            risk: "restricted",
            status: "approved",
            tenantId: "tenant_mounted_restricted",
            governance: {
              approvalRequired: true,
              approvalState: "approved",
              metadataOnly: true,
              approvedAt: "2026-05-24T00:00:00.000Z",
              approvedBy: "legal",
              policyVersion: "collection-policy:v1"
            },
            metadata: { legalNotesReviewedAt: reviewedAt },
            tags: ["apt29"]
          })
        ],
        request: {
          queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
          selectedActions: ["activate", "quarantine", "request_legal_notes"],
          includeExecutionPreview: true
        },
        headers: { "x-tenant-id": "tenant_mounted_restricted" },
        status: 200
      },
      {
        name: "invalid_action",
        sources: [source({ id: "src_mounted_source_invalid", tenantId: "tenant_mounted_invalid", tags: ["apt29"] })],
        request: {
          queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
          selectedActions: ["launch_crawler"]
        },
        headers: { "x-tenant-id": "tenant_mounted_invalid" },
        status: 400,
        expectedError: "invalid_action"
      }
    ];

    for (const scenario of scenarios) {
      const store = new InMemoryScraperStore();
      for (const item of scenario.sources) store.saveSource(item);
      const frontier = new FocusedFrontier();
      const beforeSources = store.listSources().map((item) => `${item.id}:${item.status}:${item.updatedAt}`).sort();
      const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
      const beforeLeased = frontier.leasedSnapshot().map((task) => task.id).sort();
      const server = startApiServer({ port: 0, store, frontier });
      try {
        const response = await fetch(`http://127.0.0.1:${server.port}/v1/sources/apply-plan`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(scenario.headers ?? {}) },
          body: JSON.stringify(scenario.request)
        });
        const payload = await response.json() as {
          contract?: { endpoint: string; response: { forbiddenMutationFields: string[] } };
          applyPlan?: {
            dryRun: boolean;
            willMutate: boolean;
            willStartCrawling: boolean;
            items: Array<{
              action: string;
              automation: string;
              collectionImpact: { willStartCrawling: boolean; enablesCollection: boolean; remainsDisabled: string[] };
            }>;
            executionPreview?: { dryRun: boolean; executed: boolean; itemResults: Array<{ wouldApply: boolean }> };
          };
          error?: { code: string };
        };
        const serialized = JSON.stringify(payload);

        expect(response.status).toBe(scenario.status);
        if (scenario.status === 200) {
          expect(payload.contract).toMatchObject({
            endpoint: "/v1/sources/apply-plan",
            response: {
              forbiddenMutationFields: expect.arrayContaining(["updatedSource", "startedCrawl", "dbTransaction", "restrictedActivation"])
            }
          });
          expect(payload.applyPlan).toMatchObject({
            dryRun: true,
            willMutate: false,
            willStartCrawling: false
          });
          expect(payload.applyPlan?.items.every((item) => item.collectionImpact.willStartCrawling === false)).toBe(true);
          expect(payload.applyPlan?.executionPreview?.dryRun).toBe(true);
          expect(payload.applyPlan?.executionPreview?.executed).toBe(false);
          if (scenario.name === "happy_path") {
            expect(payload.applyPlan?.items.map((item) => item.action)).toEqual(expect.arrayContaining(["approve", "quarantine"]));
            expect(payload.applyPlan?.items.map((item) => item.automation)).toContain("rollback_only");
          }
          if (scenario.name === "blocked_restricted_source") {
            expect(payload.applyPlan?.items.some((item) => item.action === "activate" && item.collectionImpact.enablesCollection)).toBe(false);
            expect(payload.applyPlan?.items.flatMap((item) => item.collectionImpact.remainsDisabled)).toEqual(expect.arrayContaining([
              "restricted raw payload collection",
              "automatic restricted-source activation"
            ]));
          }
        } else {
          expect(payload.error?.code).toBe(scenario.expectedError);
        }

        const applyPlanSerialized = JSON.stringify(payload.applyPlan ?? {});
        expect(applyPlanSerialized).not.toContain("startedCrawl");
        expect(applyPlanSerialized).not.toContain("updatedSource");
        expect(applyPlanSerialized).not.toContain("reviewDecisionApplied");
        expect(applyPlanSerialized).not.toContain("dbTransaction");
        expect(applyPlanSerialized).not.toContain("restrictedActivation");
      } finally {
        server.stop();
      }
      expect(store.listSources().map((item) => `${item.id}:${item.status}:${item.updatedAt}`).sort()).toEqual(beforeSources);
      expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(beforeQueued);
      expect(frontier.leasedSnapshot().map((task) => task.id).sort()).toEqual(beforeLeased);
    }
  });

  test("routes source coverage-plan and exposes compact intel search source coverage", async () => {
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json();
    const store = new InMemoryScraperStore();
    const active = source({
      id: "src_coverage_active_apt29",
      name: "Active APT29 coverage",
      tenantId: "tenant_source_coverage",
      status: "active",
      tags: ["apt29"],
      metadata: { legalNotesReviewedAt: new Date().toISOString() },
      catalog: {
        canonicalId: "coverage:active:apt29",
        publisher: { name: "Coverage Active", trustBasis: "vendor" },
        tier: "tier_1",
        approvalScope: "safe_public_auto",
        license: "Public fixture.",
        legalBasis: "Public fixture.",
        reliability: 0.9,
        intelligenceValue: 0.9,
        retentionClass: "standard",
        coverage: {
          topics: ["actor", "threat-report"],
          actors: ["APT29"],
          aliases: ["Midnight Blizzard"],
          industries: ["government"],
          regions: ["Europe"],
          countries: ["Norway"],
          languages: ["en"],
          queryPatterns: ["APT29"]
        },
        collection: { freshnessTargetSeconds: 21600, collectionSlaSeconds: 21600, budgetClass: "normal", crawlCadenceSeconds: 21600 },
        adapterCompatibility: ["rss"],
        rollback: {}
      }
    });
    store.saveSource(active);
    const options = {
      store,
      frontier: new FocusedFrontier(),
      sourcePacks: [bundle]
    };

    const response = await body(await handleApiRequest(api("/v1/sources/coverage-plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"],
        sourcePackIds: ["safe-public-cti-starter-pack"]
      })
    }), options));
    const coverage = response as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      queries: Array<{
        query: string;
        coverageState: string;
        slo: { status: string; actuals: { activeSafePublicSources: number; excludedUnsafeSourceIds: string[] }; failures: string[] };
        drift: Array<{ code: string; recommendedAction: string }>;
        portfolio: { familyGroups: Array<{ key: string }>; actorGroups: Array<{ key: string }>; legalReviewAgeGroups: Array<{ key: string }> };
        activationBatch: { status: string; sources: Array<{ sourceId: string; safePublic: boolean; parserCompatible: boolean }>; schedulerCost: { estimatedTasksPerDay: number }; runtimeSla: { status: string; summary: { releaseHold: boolean } }; executionReadiness: { canarySourceIds: string[]; rolloutSourceIds: string[]; promotionImpact: { agent06EvidenceCertification: { certificationState: string } } } };
        runtimeSla: { status: string; summary: { apiImpact: string; releaseHold: boolean }; sourceFamilyGate: { status: string }; promotionGate: { decision: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }; remediation: Array<{ action: string }> };
        coverageCloseout: { readiness: string; queryClass: string; plannedSafePublicSourceCount: number; activationWaveIds: string[]; executionPacket: { rolloutSourceIds: string[]; promotionImpact: { agent10Decision: { field: string } } } };
        executionReadiness: { coverageReady: boolean; rolloutSourceIds: string[]; promotionImpact: { agent09ContractIndex: { field: string } } };
        activeSources: Array<{ sourceId: string }>;
        eligibleSources: Array<{ sourceId: string }>;
        selectedSources: Array<{ sourceId: string }>;
        missingApprovedPublicSources: Array<{ sourceId: string }>;
        missingVerticals: Array<{ vertical: string }>;
        safeSourcePackRecommendations: Array<{ sourceId: string; requiredAction: string }>;
      }>;
      slo: { status: string; failed: number };
      drift: Array<{ code: string; query?: string }>;
      governanceDrift: Array<{ code: string; sourceId: string }>;
      remediationPlans: Array<{ action: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }>;
      forbiddenSourceClasses: string[];
      sourcePackInstallPlans: Array<{ willStartCrawling: boolean }>;
    };
    const intel = await body(await handleApiRequest(api("/v1/intel/search?q=MuddyWater&entityType=actor", {
      headers: { "x-tenant-id": "tenant_source_coverage" }
    }), options));
    const intelCoverage = intel.sourceCoverage as {
      query: string;
      coverageState: string;
      slo: { status: string; failures: string[]; actuals: { activeSafePublicSources: number } };
      drift: Array<{ code: string }>;
      portfolio: { familyGroups: Array<{ key: string }>; actorGroups: Array<{ key: string }> };
      activationBatch: { dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; sources: Array<{ sourceId: string }>; executionReadiness: { rolloutSourceIds: string[]; promotionImpact: { publicTiAnswerEffect: string } } };
      runtimeSla: { dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; summary: { apiImpact: string }; promotionGate: { decision: string; agent10ReleaseDecision: { field: string; releaseImpact: string } } };
      coverageCloseout: { readiness: string; activationWaveIds: string[]; promotionImpact: { agent10: string }; executionPacket: { canarySourceIds: string[]; rolloutSourceIds: string[]; promotionImpact: { agent09ContractIndex: { field: string } } } };
      executionReadiness: { dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; rolloutSourceIds: string[]; promotionImpact: { agent06EvidenceCertification: { certificationState: string } } };
      eligibleSources: Array<{ sourceId: string }>;
      selectedSources: Array<{ sourceId: string }>;
      safeSourcePackRecommendations: Array<{ sourceId: string }>;
      missingVerticals: Array<{ vertical: string }>;
    };
    const portfolioResponse = await body(await handleApiRequest(api("/v1/sources/portfolio", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"],
        sourcePackIds: ["safe-public-cti-starter-pack"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      portfolio: { familyGroups: Array<{ key: string }>; legalReviewAgeGroups: Array<{ key: string }> };
      queries: Array<{ query: string; actorGroups: Array<{ key: string }> }>;
      onboardingPlans: Array<{ dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; schedulerCost: { estimatedTasksPerDay: number } }>;
      burnDown: Array<{ query: string; sourceAdditions: string[] }>;
      promotionPacket: { field: string; gate: string };
    };
    const activationBatchResponse = await body(await handleApiRequest(api("/v1/sources/activation-batches", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"],
        sourcePackIds: ["safe-public-cti-starter-pack"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      queries: Array<{ query: string; sources: Array<{ sourceId: string; safePublic: boolean; adapterOwner: string; parserOwner: string; expectedCadenceSeconds: number }>; blockedUnsafeSourceIds: string[]; executionReadiness: { canarySourceIds: string[]; rolloutSourceIds: string[] } }>;
      forbiddenSourceClasses: string[];
      executionReadiness: { first10Canary: unknown[]; publicRollout50: unknown[]; parserGapHandoff: { owner: string; sourceIds: string[] }; queueBudgetImpact: { owner: string; withinBudget: boolean }; rolloutPromotion: { first10CanarySourceIds: string[]; publicRollout50SourceIds: string[]; costControls: { owner: string; state: string }; agent10CanaryReleaseDecision: { field: string; releaseDecision: string } }; agent10ReleasePacket: { field: string; decision: string } };
    };
    const runtimeSlaResponse = await body(await handleApiRequest(api("/v1/sources/runtime-sla", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "MuddyWater", "FIN7", "unknown actor"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      queries: Array<{ query: string; status: string; summary: { apiImpact: string; releaseHold: boolean }; remediation: Array<{ action: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }> }>;
      rollup: { status: string; releaseHold: boolean };
      releasePacket: { gate: string; decision: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean };
    };
    const closeoutResponse = await body(await handleApiRequest(api("/v1/sources/coverage-closeout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_source_coverage" },
      body: JSON.stringify({
        queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234", "campaign infrastructure"]
      })
    }), options)) as {
      endpoint: string;
      dryRun: boolean;
      willMutate: boolean;
      willStartCrawling: boolean;
      activationWaves: Array<{ category: string; sourceCount: number; sources: Array<{ approvalScope: string; parserCompatible: boolean }> }>;
      executionReadiness: { first10Canary: Array<{ canaryOrder?: number; parserOwner: string }>; publicRollout50: Array<{ legalReviewAgeDays: number; robotsReviewAgeDays: number | "not_required" }>; excludedSources: Array<{ excludedClass: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }>; coverageByQueryClass: Array<{ queryClass: string; sourceCount: number }>; sourceRetirement: { candidates: string[] }; duplicateSuppression: { duplicateSourceIds: string[] }; parserGapHandoff: { owner: string; sourceIds: string[] }; queueBudgetImpact: { owner: string; withinBudget: boolean }; rolloutPromotion: { coverageImpacts: Array<{ queryClass: string; publicTiAnswerEffect: string; agent02SchedulerTelemetry: { budgetState: string }; agent06EvidenceCertification: { certificationState: string }; agent07PollingState: { state: string }; agent09ContractIndex: { field: string }; agent10Decision: { field: string } }>; postCanaryMonitoring: Array<{ owner: string }>; agent10CanaryReleaseDecision: { releaseDecision: string } }; agent10ReleasePacket: { field: string; decision: string } };
      summary: { safePublicActivationSourceCount: number };
      releasePacket: { gate: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; agent10ExecutionField: string };
    };

    expect(coverage.endpoint).toBe("/v1/sources/coverage-plan");
    expect(coverage.dryRun).toBe(true);
    expect(coverage.willMutate).toBe(false);
    expect(coverage.willStartCrawling).toBe(false);
    expect(coverage.queries.find((query) => query.query === "APT29")?.activeSources.map((source) => source.sourceId)).toEqual([
      "src_coverage_active_apt29"
    ]);
    expect(coverage.queries.find((query) => query.query === "APT29")?.eligibleSources.map((source) => source.sourceId)).toContain("src_coverage_active_apt29");
    expect(coverage.queries.find((query) => query.query === "APT29")?.selectedSources.map((source) => source.sourceId)).toContain("src_coverage_active_apt29");
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageState).toBe("needs_review");
    expect(coverage.queries.find((query) => query.query === "APT29")?.portfolio.actorGroups.map((group) => group.key)).toContain("APT29");
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.activationBatch.sources.map((source) => source.sourceId)).toContain("src_seed_eset_welivesecurity");
    expect(coverage.queries.find((query) => query.query === "APT29")?.runtimeSla.status).toBe("breach");
    expect(coverage.queries.find((query) => query.query === "APT29")?.runtimeSla.promotionGate.dryRun).toBe(true);
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageCloseout.plannedSafePublicSourceCount).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageCloseout.executionPacket.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "APT29")?.coverageCloseout.executionPacket.promotionImpact.agent10Decision.field).toBe("sourceRolloutPromotionPacket");
    expect(coverage.queries.find((query) => query.query === "APT29")?.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "APT29")?.executionReadiness.promotionImpact.agent09ContractIndex.field).toBe("sourceCoverage.rolloutPromotion");
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.activationBatch.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.activationBatch.executionReadiness.promotionImpact.agent06EvidenceCertification.certificationState).toBe("ready");
    expect(coverage.queries.find((query) => query.query === "APT29")?.activationBatch.runtimeSla.summary.releaseHold).toBe(true);
    expect(coverage.queries.find((query) => query.query === "APT29")?.slo.failures).toEqual(expect.arrayContaining([
      "below_minimum_active_sources",
      "insufficient_source_family_diversity",
      "missing_robots_review"
    ]));
    expect(coverage.queries.find((query) => query.query === "APT29")?.drift.map((item) => item.code)).toContain("missing_robots_review");
    expect(coverage.slo.status).toBe("fail");
    expect(coverage.drift.map((item) => item.code)).toContain("below_minimum_active_sources");
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.safeSourcePackRecommendations.map((source) => source.sourceId)).toEqual(expect.arrayContaining([
      "src_seed_eset_welivesecurity",
      "src_seed_cisco_talos_blog"
    ]));
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.missingApprovedPublicSources.map((source) => source.sourceId)).toContain("src_seed_eset_welivesecurity");
    expect(coverage.queries.find((query) => query.query === "FIN7")?.safeSourcePackRecommendations.map((source) => source.sourceId)).toEqual(expect.arrayContaining([
      "src_seed_dfir_report"
    ]));
    expect(coverage.queries.find((query) => query.query === "unknown actor")?.missingVerticals.map((vertical) => vertical.vertical)).toEqual(expect.arrayContaining([
      "actor_intelligence",
      "vendor_research",
      "public_channel",
      "restricted_metadata"
    ]));
    expect(coverage.forbiddenSourceClasses).toEqual(expect.arrayContaining(["private forums", "credentialed sources", "leaked-file endpoints", "CAPTCHA bypass"]));
    expect(coverage.sourcePackInstallPlans.every((plan) => plan.willStartCrawling === false)).toBe(true);
    expect(coverage.governanceDrift.map((item) => item.code)).toContain("missing_robots_notes");
    expect(coverage.remediationPlans.every((plan) => plan.dryRun && plan.willMutate === false && plan.willStartCrawling === false)).toBe(true);
    expect(intelCoverage.query).toBe("MuddyWater");
    expect(intelCoverage.slo.status).toBe("fail");
    expect([
      ...intelCoverage.drift.map((item) => item.code),
      ...intelCoverage.slo.failures
    ]).toEqual(expect.arrayContaining(["missing_legal_review", "missing_robots_review"]));
    expect(intelCoverage.portfolio.familyGroups).toBeDefined();
    expect(intelCoverage.activationBatch.dryRun).toBe(true);
    expect(intelCoverage.activationBatch.willMutate).toBe(false);
    expect(intelCoverage.activationBatch.willStartCrawling).toBe(false);
    expect(intelCoverage.runtimeSla.dryRun).toBe(true);
    expect(intelCoverage.runtimeSla.willMutate).toBe(false);
    expect(intelCoverage.runtimeSla.willStartCrawling).toBe(false);
    expect(intelCoverage.runtimeSla.summary.apiImpact).toMatch(/none|partial_results|stale_results|blocked/);
    expect(intelCoverage.runtimeSla.promotionGate.agent10ReleaseDecision.field).toBe("sourceSlaPromotionGate");
    expect(intelCoverage.coverageCloseout.activationWaveIds.length).toBeGreaterThan(0);
    expect(intelCoverage.coverageCloseout.promotionImpact.agent10).toMatch(/release_candidate|release_hold/);
    expect(intelCoverage.coverageCloseout.executionPacket.canarySourceIds.length).toBeGreaterThan(0);
    expect(intelCoverage.coverageCloseout.executionPacket.promotionImpact.agent09ContractIndex.field).toBe("sourceCoverage.rolloutPromotion");
    expect(intelCoverage.executionReadiness.dryRun).toBe(true);
    expect(intelCoverage.executionReadiness.willMutate).toBe(false);
    expect(intelCoverage.executionReadiness.willStartCrawling).toBe(false);
    expect(intelCoverage.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(intelCoverage.executionReadiness.promotionImpact.agent06EvidenceCertification.certificationState).toBe("ready");
    expect(intelCoverage.eligibleSources).toBeDefined();
    expect(intelCoverage.selectedSources).toBeDefined();
    expect(Array.isArray(intelCoverage.safeSourcePackRecommendations)).toBe(true);
    expect(intelCoverage.missingVerticals.map((vertical) => vertical.vertical)).toContain("restricted_metadata");
    expect(portfolioResponse.endpoint).toBe("/v1/sources/portfolio");
    expect(portfolioResponse.dryRun).toBe(true);
    expect(portfolioResponse.willMutate).toBe(false);
    expect(portfolioResponse.willStartCrawling).toBe(false);
    expect(portfolioResponse.onboardingPlans[0]!.schedulerCost.estimatedTasksPerDay).toBeGreaterThan(0);
    expect(portfolioResponse.onboardingPlans.every((plan) => plan.dryRun && plan.willMutate === false && plan.willStartCrawling === false)).toBe(true);
    expect(portfolioResponse.burnDown.find((item) => item.query === "unknown actor")?.sourceAdditions.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(portfolioResponse.promotionPacket).toMatchObject({ field: "sourcePortfolioId", gate: "source_portfolio_ready" });
    expect(activationBatchResponse.endpoint).toBe("/v1/sources/activation-batches");
    expect(activationBatchResponse.dryRun).toBe(true);
    expect(activationBatchResponse.willMutate).toBe(false);
    expect(activationBatchResponse.willStartCrawling).toBe(false);
    expect(activationBatchResponse.queries.find((query) => query.query === "MuddyWater")?.sources.every((source) => source.safePublic)).toBe(true);
    expect(Array.isArray(activationBatchResponse.queries.find((query) => query.query === "MuddyWater")?.sources)).toBe(true);
    expect(activationBatchResponse.queries.find((query) => query.query === "MuddyWater")?.executionReadiness.rolloutSourceIds.length).toBeGreaterThan(0);
    expect(activationBatchResponse.executionReadiness.first10Canary).toHaveLength(10);
    expect(activationBatchResponse.executionReadiness.publicRollout50).toHaveLength(50);
    expect(activationBatchResponse.executionReadiness.parserGapHandoff.owner).toBe("agent_03");
    expect(activationBatchResponse.executionReadiness.parserGapHandoff.sourceIds.length).toBeGreaterThan(0);
    expect(activationBatchResponse.executionReadiness.queueBudgetImpact).toMatchObject({ owner: "agent_02", withinBudget: true });
    expect(activationBatchResponse.executionReadiness.rolloutPromotion).toMatchObject({
      costControls: { owner: "agent_02", state: "within_budget" },
      agent10CanaryReleaseDecision: {
        field: "sourceRolloutPromotionPacket",
        releaseDecision: "promote_canary_then_expand"
      }
    });
    expect(activationBatchResponse.executionReadiness.rolloutPromotion.first10CanarySourceIds).toHaveLength(10);
    expect(activationBatchResponse.executionReadiness.rolloutPromotion.publicRollout50SourceIds).toHaveLength(50);
    expect(activationBatchResponse.executionReadiness.agent10ReleasePacket.field).toBe("sourceActivationExecutionReadiness");
    expect(activationBatchResponse.forbiddenSourceClasses).toEqual(expect.arrayContaining(["restricted raw payload collection", "public chat sources"]));
    expect(runtimeSlaResponse.endpoint).toBe("/v1/sources/runtime-sla");
    expect(runtimeSlaResponse.dryRun).toBe(true);
    expect(runtimeSlaResponse.willMutate).toBe(false);
    expect(runtimeSlaResponse.willStartCrawling).toBe(false);
    expect(runtimeSlaResponse.queries.find((query) => query.query === "APT29")?.remediation.every((item) => item.dryRun && item.willMutate === false && item.willStartCrawling === false)).toBe(true);
    expect(runtimeSlaResponse.rollup.status).toMatch(/pass|warning|breach/);
    expect(runtimeSlaResponse.releasePacket).toMatchObject({
      gate: "source_sla_enforcement",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false
    });
    expect(closeoutResponse.endpoint).toBe("/v1/sources/coverage-closeout");
    expect(closeoutResponse.dryRun).toBe(true);
    expect(closeoutResponse.willMutate).toBe(false);
    expect(closeoutResponse.willStartCrawling).toBe(false);
    expect(closeoutResponse.summary.safePublicActivationSourceCount).toBeGreaterThanOrEqual(50);
    expect(closeoutResponse.activationWaves.flatMap((wave) => wave.sources).every((source) => source.approvalScope === "safe_public_auto" && source.parserCompatible)).toBe(true);
    expect(closeoutResponse.executionReadiness.first10Canary).toHaveLength(10);
    expect(closeoutResponse.executionReadiness.first10Canary.map((source) => source.canaryOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(closeoutResponse.executionReadiness.publicRollout50).toHaveLength(50);
    expect(closeoutResponse.executionReadiness.publicRollout50.every((source) => source.legalReviewAgeDays <= 90 && (source.robotsReviewAgeDays === "not_required" || source.robotsReviewAgeDays <= 90))).toBe(true);
    expect(closeoutResponse.executionReadiness.excludedSources.map((source) => source.excludedClass)).toEqual(expect.arrayContaining(["restricted_raw_payload", "parser_gap", "duplicate"]));
    expect(closeoutResponse.executionReadiness.excludedSources.every((source) => source.dryRun && source.willMutate === false && source.willStartCrawling === false)).toBe(true);
    expect(closeoutResponse.executionReadiness.coverageByQueryClass.map((row) => row.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware_victim", "cve", "campaign"]));
    expect(closeoutResponse.executionReadiness.coverageByQueryClass.every((row) => row.sourceCount > 0)).toBe(true);
    expect(closeoutResponse.executionReadiness.sourceRetirement.candidates).toEqual(closeoutResponse.executionReadiness.duplicateSuppression.duplicateSourceIds);
    expect(closeoutResponse.executionReadiness.parserGapHandoff.owner).toBe("agent_03");
    expect(closeoutResponse.executionReadiness.queueBudgetImpact).toMatchObject({ owner: "agent_02", withinBudget: true });
    expect(closeoutResponse.executionReadiness.agent10ReleasePacket).toMatchObject({ field: "sourceActivationExecutionReadiness", decision: "pass" });
    expect(closeoutResponse.executionReadiness.rolloutPromotion.coverageImpacts.every((impact) =>
      impact.agent02SchedulerTelemetry.budgetState === "within_budget" &&
      impact.agent06EvidenceCertification.certificationState === "ready" &&
      impact.agent07PollingState.state === "canary_polling" &&
      impact.agent09ContractIndex.field === "sourceCoverage.rolloutPromotion" &&
      impact.agent10Decision.field === "sourceRolloutPromotionPacket"
    )).toBe(true);
    expect(closeoutResponse.executionReadiness.rolloutPromotion.coverageImpacts.map((impact) => impact.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware_victim", "cve", "campaign"]));
    expect(closeoutResponse.executionReadiness.rolloutPromotion.postCanaryMonitoring.map((item) => item.owner)).toEqual(expect.arrayContaining(["agent_02", "agent_06", "agent_07", "agent_10"]));
    expect(closeoutResponse.executionReadiness.rolloutPromotion.agent10CanaryReleaseDecision.releaseDecision).toBe("promote_canary_then_expand");
    expect(closeoutResponse.releasePacket).toMatchObject({
      gate: "source_coverage_closeout",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      agent10ExecutionField: "sourceActivationExecutionReadiness"
    });
  });

  test("reports darknet metadata search states and safe DTOs", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_onion",
      name: "Approved onion metadata",
      type: "tor_metadata",
      url: "http://claims.onion/actor/Akira",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Approved metadata-only onion source fixture.",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      }
    }));
    store.saveCapture({
      id: "cap_onion",
      sourceId: "src_onion",
      url: "http://claims.onion/actor/Akira",
      collectedAt: "2026-05-24T00:00:00.000Z",
      publishedAt: "2026-05-23T00:00:00.000Z",
      contentHash: "hash",
      mediaType: "text/plain",
      storageKind: "metadata_only",
      metadata: {
        adapter: "darknet_metadata",
        leakSite: {
          actorName: "Akira",
          victimName: "Fjord Energy AS",
          claimDate: "2026-05-20",
          claimedSector: "Energy",
          claimedCountry: "NO",
          claimedDataCategory: "contracts",
          postStatus: "new",
          sourceTimestamp: "2026-05-23T00:00:00.000Z",
          urlHash: "urlhash",
          screenshotHash: "screenhash",
          confidence: 0.82
        },
        policyDecision: { id: "policy_akira" }
      },
      sensitive: true
    });

    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Akira&entityType=actor"), {
      store,
      frontier: new FocusedFrontier()
    }));

    expect(response.darknetMetadata).toMatchObject({
      status: "partial_metadata",
      queuedTasks: 0,
      results: [{
        actor: "Akira",
        victim: "Fjord Energy AS",
        claimedDate: "2026-05-20",
        sector: "Energy",
        country: "NO",
        claimedDataCategory: "contracts",
        sourceTimestamp: "2026-05-23T00:00:00.000Z",
        urlHash: "urlhash",
        screenshotHash: "screenhash",
        confidence: 0.82,
        policyAuditId: "policy_akira"
      }]
    });
    expect(response.restrictedMetadata).toMatchObject({
      endpoint: "/v1/restricted-metadata/status",
      query: {
        query: "Akira",
        entityType: "actor",
        matchingResultCount: 1,
        partialState: "partial_metadata",
        matchedSourceIds: ["src_onion"]
      }
    });
    const restricted = response.restrictedMetadata as {
      runtimeProofs: Array<{ kind: string; metadataOnly: boolean; safeForApi: boolean; forbiddenAlternatives: string[] }>;
      operationalSla: { metadataOnly: boolean; safeForApi: boolean; metrics: Record<string, number> };
      enforcement: { level: string; metadataOnly: boolean; safeForApi: boolean; emergencyStop: { state: string; dryRunOnly: boolean }; agent09WarningCodes: string[] };
      auditTrail: { metadataOnly: boolean; safeForApi: boolean; unsafeFieldsExposed: boolean; rejectedFields: string[] };
      governancePackets: Array<{ metadataOnly: boolean; safeForApi: boolean; proof: Record<string, boolean> }>;
      auditReplay: { metadataOnly: boolean; safeForApi: boolean; observedScenarios: string[] };
      connectorCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      killSwitchDrills: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; operatorVisible: boolean; guarantees: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      emergencyStopCertification: { metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; observedScenarios: string[]; noLeakSerialization: { passed: boolean }; packets: Array<{ metadataOnly: boolean; safeForApi: boolean; dryRunOnly: boolean; rcGate: string; proof: Record<string, boolean>; noLeakSerialization: { passed: boolean } }> };
      agent10ReleasePacket: { runtimeProofName: string; metadataOnly: boolean; safeForApi: boolean; emergencyStopState: string; auditReplayScenarios: string[]; certificationScenarios: string[]; killSwitchDrillScenarios: string[]; emergencyStopCertificationScenarios: string[] };
    };
    expect(restricted.runtimeProofs.map((proof) => proof.kind)).toEqual(expect.arrayContaining([
      "approval_expiry",
      "kill_switch_transition",
      "proxy_failure",
      "timeout",
      "retention_expiry",
      "legal_hold",
      "redaction_repair",
      "unsafe_target_rejection",
      "disabled_source_rollback"
    ]));
    expect(restricted.runtimeProofs.every((proof) => proof.metadataOnly && proof.safeForApi)).toBe(true);
    expect(restricted.operationalSla).toMatchObject({
      metadataOnly: true,
      safeForApi: true
    });
    expect(restricted.operationalSla.metrics.metadataOnlyEvidenceYield).toBeGreaterThanOrEqual(1);
    expect(restricted.enforcement).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      emergencyStop: {
        dryRunOnly: true
      }
    });
    expect(restricted.enforcement.agent09WarningCodes).toContain("restricted_metadata_forbidden_action");
    expect(restricted.auditTrail).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      unsafeFieldsExposed: false
    });
    expect(restricted.auditTrail.rejectedFields).toContain("payloadReference");
    expect(restricted.governancePackets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.proof.noStolenFilesStored)).toBe(true);
    expect(restricted.auditReplay).toMatchObject({ metadataOnly: true, safeForApi: true });
    expect(restricted.auditReplay.observedScenarios).toContain("allowed_metadata_only_record");
    expect(restricted.connectorCertification).toMatchObject({ metadataOnly: true, safeForApi: true, dryRunOnly: true, noLeakSerialization: { passed: true } });
    expect(restricted.connectorCertification.observedScenarios).toContain("healthy_approved_metadata_source");
    expect(restricted.connectorCertification.packets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload)).toBe(true);
    expect(restricted.killSwitchDrills).toMatchObject({ metadataOnly: true, safeForApi: true, dryRunOnly: true, operatorVisible: true, noLeakSerialization: { passed: true } });
    expect(restricted.killSwitchDrills.observedScenarios).toContain("healthy_metadata_only_canary");
    expect(restricted.killSwitchDrills.packets.every((packet) => packet.metadataOnly && packet.safeForApi && packet.dryRunOnly && packet.operatorVisible && packet.noLeakSerialization.passed && packet.guarantees.noContact && packet.guarantees.noDownload)).toBe(true);
    expect(restricted.emergencyStopCertification).toMatchObject({ metadataOnly: true, safeForApi: true, dryRunOnly: true, noLeakSerialization: { passed: true } });
    expect(restricted.emergencyStopCertification.observedScenarios).toContain("healthy_metadata_only_canary");
    expect(restricted.emergencyStopCertification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.rcGate === "restricted_metadata_emergency_stop_certification_rc" &&
      packet.noLeakSerialization.passed &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence
    )).toBe(true);
    expect(restricted.agent10ReleasePacket).toMatchObject({
      runtimeProofName: "restricted_metadata_sla",
      metadataOnly: true,
      safeForApi: true,
      emergencyStopState: restricted.enforcement.emergencyStop.state
    });
    expect(restricted.agent10ReleasePacket.certificationScenarios).toContain("healthy_approved_metadata_source");
    expect(restricted.agent10ReleasePacket.killSwitchDrillScenarios).toContain("healthy_metadata_only_canary");
    expect(restricted.agent10ReleasePacket.emergencyStopCertificationScenarios).toContain("healthy_metadata_only_canary");
    expect(JSON.stringify(response.restrictedMetadata)).not.toContain("http://");
    expect(JSON.stringify(response.restrictedMetadata)).not.toContain(".onion");
  });

  test("wires restricted metadata status for actor victim country sector and unknown queries", async () => {
    const store = new InMemoryScraperStore();
    for (const item of [
      source({ id: "src_runtime_tor", type: "tor_metadata", url: "http://runtime.onion/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved metadata-only fixture.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-05-01T00:00:00.000Z", approvedBy: "reviewer" } }),
      source({ id: "src_runtime_i2p", type: "i2p_metadata", url: "http://runtime.i2p/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved metadata-only fixture.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-05-01T00:00:00.000Z", approvedBy: "reviewer" } }),
      source({ id: "src_runtime_freenet", type: "freenet_metadata", url: "freenet:runtime/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved metadata-only fixture.", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-05-01T00:00:00.000Z", approvedBy: "reviewer" } })
    ]) store.saveSource(item);
    const saveRestrictedCapture = (input: { id: string; sourceId: string; actor: string; victim: string; sector: string; country: string; data: string }) => store.saveCapture({
      id: input.id,
      sourceId: input.sourceId,
      url: `http://redacted-${input.id}.onion/post`,
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: `hash_${input.id}`,
      mediaType: "text/plain",
      storageKind: "metadata_only",
      metadata: {
        adapter: "darknet_metadata",
        leakSite: {
          actorName: input.actor,
          victimName: input.victim,
          claimDate: "2026-05-20",
          claimedSector: input.sector,
          claimedCountry: input.country,
          claimedDataCategory: input.data,
          postStatus: "new",
          sourceTimestamp: "2026-05-23T00:00:00.000Z",
          urlHash: `urlhash_${input.id}`,
          screenshotHash: `screenhash_${input.id}`,
          confidence: 0.81
        },
        policyDecision: { id: `policy_${input.id}` }
      },
      sensitive: true
    });
    saveRestrictedCapture({ id: "akira", sourceId: "src_runtime_tor", actor: "Akira", victim: "Fjord Energy AS", sector: "Energy", country: "NO", data: "contracts" });
    saveRestrictedCapture({ id: "sample", sourceId: "src_runtime_i2p", actor: "SampleLocker", victim: "Baltic Health AB", sector: "Healthcare", country: "SE", data: "patient-system metadata" });
    saveRestrictedCapture({ id: "example", sourceId: "src_runtime_freenet", actor: "ExampleCrew", victim: "Nordic Manufacturing Oy", sector: "Manufacturing", country: "FI", data: "invoices" });

    const queries = [
      ["Akira", "actor", "partial_metadata", 1],
      ["Fjord Energy", "victim", "partial_metadata", 1],
      ["NO", "country", "partial_metadata", 1],
      ["Manufacturing", "sector", "partial_metadata", 1],
      ["totally unknown query", "actor", "approval_required", 0]
    ] as const;

    for (const [query, entityType, partialState, matchingResultCount] of queries) {
      const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(query)}&entityType=${entityType}`), {
        store,
        frontier: new FocusedFrontier()
      }));
      expect(response.restrictedMetadata).toMatchObject({
        query: {
          query,
          entityType,
          matchingResultCount,
          partialState
        },
        operationalSla: {
          metadataOnly: true,
          safeForApi: true
        },
        enforcement: {
          metadataOnly: true,
          safeForApi: true
        },
        auditReplay: {
          metadataOnly: true,
          safeForApi: true
        },
        connectorCertification: {
          metadataOnly: true,
          safeForApi: true,
          dryRunOnly: true,
          noLeakSerialization: {
            passed: true
          }
        },
        agent10ReleasePacket: {
          runtimeProofName: "restricted_metadata_sla"
        },
        agent06EvidenceHandoffProof: { unsafeDetected: false }
      });
      const serialized = JSON.stringify(response.restrictedMetadata);
      expect(serialized).not.toContain("http://");
      expect(serialized).not.toContain(".onion");
      expect(serialized).not.toContain("redacted-");
      expect(serialized).not.toContain("patient-system metadata file");
    }
  });

  test("reports disabled darknet metadata live search when kill switch is active", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_disabled_onion",
      name: "Approved onion metadata",
      type: "tor_metadata",
      url: "http://claims.onion/actor/{query}",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      legalNotes: "Approved metadata-only onion source fixture.",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer"
      }
    }));
    const config = loadRuntimeConfig({});
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=LockBit&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      config: {
        ...config,
        limits: { ...config.limits, maxConcurrentDarknetMetadataTasks: 0 }
      }
    }));

    expect(response.darknetMetadata).toMatchObject({
      status: "disabled",
      queuedTasks: 0,
      blocked: [{
        sourceId: "src_disabled_onion",
        state: "disabled"
      }]
    });
    expect((response.planner as { coverageGaps: string[] }).coverageGaps).toContain("public_chat");
  });

  test("exposes search quality DTOs on live intel search without leaking raw evidence", async () => {
    const cases: Array<{
      name: string;
      query: string;
      body: string;
      metadata: Record<string, unknown>;
      storageKind?: RawCapture["storageKind"];
      expectStatus?: string;
      expectWarning?: string;
    }> = [
      {
        name: "ready",
        query: "APT29",
        body: "Mandiant linked APT29 to phishing and credential dumping against Northwind Health in the healthcare sector. First seen 2026-05-22.",
        metadata: { evidenceStage: "reviewed_promoted", graphReviewState: "accepted" },
        expectStatus: "ready"
      },
      {
        name: "partial",
        query: "Partial Example",
        body: "Live discovery snippet: Partial Example may be phishing against Northwind Health.",
        metadata: { evidenceStage: "live_discovery" },
        expectStatus: "partial"
      },
      {
        name: "weak",
        query: "Crimson Pineapple",
        body: "Crimson Pineapple appeared in a copied threat actor list.",
        metadata: { evidenceStage: "live_discovery" },
        expectWarning: "weak-evidence"
      },
      {
        name: "contradicted",
        query: "Volt Typhoon",
        body: "Vendors disputed attribution to Volt Typhoon but mentioned living off the land.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "contradiction" },
        expectStatus: "contradicted"
      },
      {
        name: "stale",
        query: "Turla",
        body: "Researchers linked Turla to Snake malware against Example Embassy.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "stale" },
        expectStatus: "stale"
      },
      {
        name: "source-biased",
        query: "Scattered Spider",
        body: "Public channel message says Scattered Spider may be phishing telecom targets.",
        metadata: { evidenceStage: "public_channel_message", adapter: "telegram_public" },
        expectStatus: "source-biased"
      },
      {
        name: "insufficient-capture",
        query: "Insufficient Capture",
        body: "Live discovery snippet: Insufficient Capture may be active.",
        metadata: { evidenceStage: "live_discovery" },
        expectWarning: "insufficient-capture"
      },
      {
        name: "needs-review",
        query: "Needs Review",
        body: "Researchers linked Needs Review to credential theft against Example Telecom in 2026.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "needs-human-review" },
        expectWarning: "needs-review"
      }
    ];

    for (const item of cases) {
      const store = new InMemoryScraperStore();
      store.saveCapture(fixtureCapture({
        id: `cap_quality_${item.name}`,
        tenantId: undefined,
        url: `https://quality.example.test/${item.name}`,
        body: item.body,
        storageKind: item.storageKind ?? "inline_text",
        metadata: { title: `${item.query} quality fixture`, ...item.metadata }
      }));
      const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(item.query)}&entityType=actor`), {
        store,
        frontier: new FocusedFrontier()
      }));
      const quality = response.quality as {
        status: string;
        score: number;
        canPromoteToReady: boolean;
        evidenceStageCounts: Record<string, number>;
        analystActions: Array<{ kind: string; evidenceIds: string[] }>;
        publicWarningText: string[];
        publicWarningCodes: string[];
      };
      const publicTiAnswer = response.publicTiAnswer as {
        schemaVersion: string;
        displayState: string;
        safeSummary: string[];
        confidence: { score: number; label: string };
        waitReasons: Array<{ code: string }>;
        nextPoll: { pollable: boolean; nextPollAfterSeconds: number; cursorRequired: boolean };
        evidenceLedgerReferences: Array<{ ledgerIds: string[]; evidenceIds: string[] }>;
        graphStixReadiness: { proofRoute: string };
        safeWording: { overstatesLiveSnippets: boolean; rawEvidenceExposed: boolean; restrictedPayloadsExposed: boolean };
        route: { publicWrapperPath: string; publicWrapperMethod: string; cursor: string; nextCursor: string };
        stateMachine: {
          schemaVersion: string;
          state: string;
          phase: string;
          progress: Record<string, boolean>;
          changedSinceCursor: { cursor: string; nextCursor: string; changed: unknown[]; newDeltaCount: number };
          polling: { nextPollAfterSeconds: number; nextPollAt: string; pollReason: string; cursorRequired: boolean };
          holds: {
            sourceActivationGaps: string[];
            schedulerPressure: { active: boolean; state: string; reasons: string[] };
            publicChannelCanaryImpact: { status: string; impact: string };
            restrictedMetadataBlocked: { blocked: boolean; status: string };
            evidenceLedgerHolds: string[];
            graphStixHolds: { hold: boolean; state: string };
          };
          confidenceLabel: string;
          safeNoResult: { noResult: boolean; overstatesAbsence: boolean };
        };
        releaseCandidate: {
          schemaVersion: string;
          state: string;
          visibleAnswer: { displayState: string; canRenderFacts: boolean; safeSummaryMode: string; caveatRequired: boolean; confidenceLabel: string };
          releaseGates: Array<{ name: string; state: string; visibleAnswerEffect: string; hold: boolean; proofRoute: string }>;
          effects: Record<string, { state: string; effect: string; hold: boolean; proofRoute: string }>;
          agent10RcGate: { status: string; decision: string; dryRun: boolean; willMutate: boolean; willStartCrawling: boolean; proofCommands: string[] };
          publicPostCompatibility: { canonicalMethod: string; canonicalPath: string; mapsTo: string; stableFieldsPreserved: boolean; cursorRequired: boolean; noLeakDto: boolean };
          uiFields: string[];
          fixtures: Array<{ state: string; query: string; queryClass: string; publicPostCompatible: boolean }>;
        };
        ux: {
          schemaVersion: string;
          state: string;
          compactAnswerCopy: { heading: string; summary: string[]; statusLine: string; caveats: string[] };
          freshness: { updatedAt: string; updatedLabel: string; lastSeenAt?: string; lastSeenLabel: string; showLastSeen: boolean; semantics: string; noLastSeenFiction: boolean };
          polling: { intervalSeconds: number; nextPollAfterSeconds: number; cursorRequired: boolean; hint: string };
          sourceCaveats: string[];
          evidenceStageLabels: Record<string, { label: string; count: number }>;
          forbiddenCopy: string[];
          publicWrapperCompatibility: { canonicalMethod: string; canonicalPath: string; noDefaultQuery: boolean };
        };
      };

      if (item.expectStatus) expect(quality.status).toBe(item.expectStatus);
      if (item.expectWarning) expect(quality.publicWarningCodes).toContain(item.expectWarning);
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(1);
      expect(Object.keys(quality.evidenceStageCounts)).toContain("captured_page");
      expect(publicTiAnswer.schemaVersion).toBe("ti.public_answer_contract.v1");
      expect(["ready", "partial", "review_required", "blocked"]).toContain(publicTiAnswer.displayState);
      expect(publicTiAnswer.safeSummary.length).toBeGreaterThan(0);
      expect(publicTiAnswer.confidence.score).toBeGreaterThanOrEqual(0);
      expect(publicTiAnswer.nextPoll.cursorRequired).toBe(true);
      expect(publicTiAnswer.evidenceLedgerReferences.length).toBeGreaterThan(0);
      expect(publicTiAnswer.evidenceLedgerReferences.every((ref) => ref.ledgerIds.length > 0 && ref.evidenceIds.length > 0)).toBe(true);
      expect(publicTiAnswer.graphStixReadiness.proofRoute).toBe("/v1/exports/stix");
      expect(publicTiAnswer.route).toMatchObject({ publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" });
      expect(publicTiAnswer.stateMachine.schemaVersion).toBe("ti.public_answer_polling_state.v1");
      expect([
        "first_response",
        "queued_collection",
        "live_partial",
        "promoted_evidence",
        "review_required",
        "blocked",
        "no_result",
        "stale",
        "contradicted",
        "source_biased",
        "ready",
        "error"
      ]).toContain(publicTiAnswer.stateMachine.state);
      expect(publicTiAnswer.stateMachine.changedSinceCursor.cursor).toBe(publicTiAnswer.route.cursor);
      expect(publicTiAnswer.stateMachine.changedSinceCursor.nextCursor).toBe(publicTiAnswer.route.nextCursor);
      expect(publicTiAnswer.stateMachine.polling.cursorRequired).toBe(true);
      expect(publicTiAnswer.stateMachine.holds.schedulerPressure.state).toBeTruthy();
      expect(publicTiAnswer.stateMachine.safeNoResult.overstatesAbsence).toBe(false);
      expect(publicTiAnswer.releaseCandidate.schemaVersion).toBe("ti.public_answer_release_candidate.v1");
      expect([
        "ready",
        "canary_ready",
        "canary_with_warnings",
        "partial",
        "review_required",
        "blocked",
        "no_result",
        "stale",
        "contradicted",
        "source_biased",
        "provider_unavailable",
        "scraper_unavailable",
        "policy_blocked"
      ]).toContain(publicTiAnswer.releaseCandidate.state);
      expect(publicTiAnswer.releaseCandidate.releaseGates.map((gate) => gate.name)).toEqual([
        "sourceCanary",
        "schedulerControlPlane",
        "publicChannelPromotion",
        "restrictedEmergencyStop",
        "evidenceCutover",
        "graphExport",
        "apiContractState"
      ]);
      expect(publicTiAnswer.releaseCandidate.agent10RcGate).toMatchObject({
        dryRun: true,
        willMutate: false,
        willStartCrawling: false
      });
      expect(publicTiAnswer.releaseCandidate.publicPostCompatibility).toMatchObject({
        canonicalMethod: "POST",
        canonicalPath: "/api/ti/search",
        mapsTo: "/v1/intel/search",
        stableFieldsPreserved: true,
        cursorRequired: true,
        noLeakDto: true
      });
      expect(publicTiAnswer.releaseCandidate.uiFields).toEqual(expect.arrayContaining(["visibleAnswer", "releaseGates", "agent10RcGate", "publicPostCompatibility"]));
      expect(publicTiAnswer.releaseCandidate.fixtures.map((fixture) => fixture.state)).toEqual(expect.arrayContaining(["ready", "provider_unavailable", "scraper_unavailable", "policy_blocked"]));
      expect(publicTiAnswer.ux).toMatchObject({
        schemaVersion: "ti.public_answer_ux.v1",
        polling: {
          intervalSeconds: 3,
          nextPollAfterSeconds: 3,
          cursorRequired: true,
          hint: "poll_after_3_seconds"
        },
        publicWrapperCompatibility: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          noDefaultQuery: true
        }
      });
      expect(publicTiAnswer.ux.compactAnswerCopy.summary.length).toBeGreaterThan(0);
      expect(publicTiAnswer.ux.compactAnswerCopy.summary.length).toBeLessThanOrEqual(3);
      expect(publicTiAnswer.ux.freshness.updatedLabel).toBe("Updated");
      expect(publicTiAnswer.ux.freshness.lastSeenLabel).toBe("Last seen");
      expect(publicTiAnswer.ux.freshness.semantics).toContain("updated is the API response time");
      expect(publicTiAnswer.ux.forbiddenCopy).toEqual(expect.arrayContaining(["not in local cache", "local cache", "demo", "default APT29"]));
      expect(JSON.stringify(publicTiAnswer.ux.compactAnswerCopy)).not.toMatch(/not in local cache|local cache|default APT29/i);
      expect(publicTiAnswer.safeWording).toMatchObject({
        overstatesLiveSnippets: false,
        rawEvidenceExposed: false,
        restrictedPayloadsExposed: false
      });
      expect(JSON.stringify(quality)).not.toContain(item.body);
      expect(JSON.stringify(publicTiAnswer)).not.toContain(item.body);
      expect(JSON.stringify(quality)).not.toContain("https://quality.example.test");
      expect(JSON.stringify(publicTiAnswer)).not.toContain("https://quality.example.test");
    }
  });

  test("exposes quality evaluate examples and alias-collision warnings", async () => {
    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({
      id: "cap_quality_alias",
      tenantId: undefined,
      url: "https://quality.example.test/akira-alias",
      body: "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.",
      metadata: { title: "Akira alias collision", evidenceStage: "captured_page" }
    }));

    const response = await body(await handleApiRequest(api("/v1/quality/evaluate?q=Akira"), {
      store,
      frontier: new FocusedFrontier()
    }));
    const quality = response.quality as {
      analystActions: Array<{ kind: string }>;
      publicWarningCodes: string[];
      publicWarningText: string[];
    };
    const publicTiAnswer = response.publicTiAnswer as { schemaVersion: string; displayState: string; waitReasons: Array<{ code: string }> };
    const examples = response.examples as Array<{ quality: { status: string } }>;

    expect(examples.map((example) => example.quality.status)).toEqual(expect.arrayContaining([
      "ready",
      "partial",
      "weak-evidence",
      "contradicted",
      "stale",
      "source-biased",
      "insufficient-capture",
      "needs-review"
    ]));
    expect(quality.publicWarningCodes).toContain("alias_collision_warning");
    expect(quality.analystActions.map((action) => action.kind)).toContain("suppress_noisy_alias");
    expect(publicTiAnswer.schemaVersion).toBe("ti.public_answer_contract.v1");
    expect(["partial", "review_required"]).toContain(publicTiAnswer.displayState);
    expect(JSON.stringify(quality)).not.toContain("Cyber gang list");
    expect(JSON.stringify(quality)).not.toContain("https://quality.example.test");
  });

  test("smokes mounted quality endpoints through the Bun API server", async () => {
    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({
      id: "cap_mounted_ready",
      tenantId: undefined,
      url: "https://mounted-quality.example.test/apt29-ready",
      body: "Mandiant linked APT29 to phishing and credential dumping against Northwind Health in healthcare. First seen 2026-05-22.",
      metadata: { title: "APT29 mounted ready", evidenceStage: "reviewed_promoted", graphReviewState: "accepted" }
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_mounted_alias",
      tenantId: undefined,
      url: "https://mounted-quality.example.test/akira-alias",
      body: "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.",
      metadata: { title: "Akira mounted alias", evidenceStage: "captured_page" }
    }));
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const ready = await fetch(`${base}/v1/intel/search?q=APT29&entityType=actor`).then((response) => response.json()) as {
        quality: { status: string; canPromoteToReady: boolean; publicWarningText: string[] };
        graph: { endpoint: string; reviewQueue: { total: number; publicFactPolicy: string } };
      };
      const alias = await fetch(`${base}/v1/quality/evaluate?q=Akira`).then((response) => response.json()) as {
        quality: { publicWarningCodes: string[]; analystActions: Array<{ kind: string }> };
        examples: Array<{ quality: { status: string } }>;
      };

      expect(ready.quality).toMatchObject({ status: "ready", canPromoteToReady: true });
      expect(ready.graph).toMatchObject({
        endpoint: "/v1/intel/search.graph"
      });
      expect(["ready", "hold_weak_edges"]).toContain(ready.graph.reviewQueue.publicFactPolicy);
      expect(alias.quality.publicWarningCodes).toContain("alias_collision_warning");
      expect(alias.quality.analystActions.map((action) => action.kind)).toContain("suppress_noisy_alias");
      expect(alias.examples.map((example) => example.quality.status)).toEqual(expect.arrayContaining(["ready", "partial", "weak-evidence", "needs-review"]));
      expect(JSON.stringify(ready.quality)).not.toContain("Mandiant linked APT29");
      expect(JSON.stringify(alias.quality)).not.toContain("Cyber gang list");
      expect(JSON.stringify(alias.quality)).not.toContain("mounted-quality.example.test");
    } finally {
      server.stop();
    }
  });

  test("fuses actor profiles into live search API output with quality gates and redacted provenance", async () => {
    const cases = [
      {
        query: "APT29",
        body: "Mandiant linked APT29 to credential dumping against Northwind Health in the healthcare sector using Cobalt Strike and CVE-2026-11111. First seen 2026-05-22.",
        metadata: { evidenceStage: "reviewed_promoted", graphReviewState: "accepted", evidenceLedgerId: "ledger_api_apt29_ready" },
        expect: { status: "ready", victim: "Northwind Health", ttp: "credential dumping", malware: "cobalt strike", vulnerability: "CVE-2026-11111" }
      },
      {
        query: "Scattered Spider",
        body: "CrowdStrike linked Scattered Spider to sms phishing against Example Telecom in the telecommunications sector. Last seen 2026-05-23.",
        metadata: { evidenceStage: "reviewed_promoted", graphReviewState: "accepted" },
        expect: { status: "ready", victim: "Example Telecom", ttp: "sms phishing", sector: "telecommunications" }
      },
      {
        query: "Volt Typhoon",
        body: "Public channel message says Volt Typhoon may be using living off the land against Pacific Energy Corp in the energy sector.",
        metadata: { evidenceStage: "public_channel_message", adapter: "telegram_public" },
        expect: { status: "source-biased", warning: "insufficient-capture", ttp: "living off the land" }
      },
      {
        query: "Turla",
        body: "Researchers linked Turla to Snake malware and command and control infrastructure at https://snake-c2.example.net against Example Embassy.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "stale" },
        expect: { status: "stale", malware: "snake", warning: "stale" }
      },
      {
        query: "Akira",
        body: "Akira claimed victim: Fjord Energy AS on 2026-05-20.",
        storageKind: "metadata_only" as const,
        sensitive: true,
        metadata: {
          evidenceStage: "metadata_only_claim",
          safeExcerpt: "Akira claimed victim: Fjord Energy AS.",
          sourceUrl: "http://claims-example.onion/akira"
        },
        expect: { warning: "metadata_only_leak_claim", victim: "Fjord Energy AS" }
      },
      {
        query: "MuddyWater",
        body: "Researchers linked MuddyWater, also known as Seedworm, to spearphishing against Example Ministry in the government sector using PowGoop malware. First seen 2026-05-21.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "accepted" },
        expect: { alias: "seedworm", victim: "Example Ministry", sector: "government", malware: "powgoop" }
      },
      {
        query: "Crimson Pineapple",
        body: "Crimson Pineapple appears in a search result snippet, but no source attributes activity, victim, malware, CVE, or infrastructure to the name.",
        metadata: { evidenceStage: "live_discovery" },
        expect: { status: "partial", warning: "weak-evidence" }
      },
      {
        query: "Akira",
        body: "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.",
        metadata: { evidenceStage: "captured_page" },
        expect: { warning: "alias_collision_warning", action: "suppress_noisy_alias" }
      },
      {
        query: "Volt Typhoon",
        body: "Vendors disputed attribution to Volt Typhoon but mentioned living off the land.",
        metadata: { evidenceStage: "captured_page", graphReviewState: "contradiction" },
        expect: { status: "contradicted", warning: "contradicted" }
      }
    ];

    for (const item of cases) {
      const store = new InMemoryScraperStore();
      store.saveCapture(fixtureCapture({
        id: `cap_profile_${item.query.replace(/\W+/g, "_").toLowerCase()}_${String(item.expect.warning ?? item.expect.status ?? "ok")}`,
        tenantId: undefined,
        url: `https://profile-quality.example.test/${encodeURIComponent(item.query)}`,
        body: item.body,
        storageKind: item.storageKind ?? "inline_text",
        sensitive: item.sensitive ?? false,
        metadata: { title: `${item.query} profile fixture`, ...item.metadata }
      }));

      const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(item.query)}&entityType=actor`), {
        store,
        frontier: new FocusedFrontier()
      }));
      const profile = response.actorProfile as {
        status: string;
        confidence: number;
        warningCodes: string[];
        caveatCodes: string[];
        actor: string;
        summary: string[];
        aliases: string[];
        targets: { victims: string[]; sectors: string[]; regions: string[] };
        readiness: {
          overall: string;
          fields: Record<string, { status: string; evidenceIds: string[]; provenance: Array<{ evidenceStage: string; sourceId: string }> }>;
          downgradeReasons: string[];
          sourceFamilyCount: number;
        };
        answer: {
          status: string;
          confidence: number;
          summary: string[];
          victims: string[];
          timeline: Array<{ label: string; evidenceIds: string[] }>;
          warnings: string[];
          warningCodes: string[];
          claims: Array<{
            kind: string;
            value: string;
            status: string;
            confidence: number;
            evidenceIds: string[];
            ledgerIds: string[];
            sourceFamilySupport: string[];
            extractionVersion: string;
            freshness: { score: number };
            caveatCodes: string[];
            downgradeReasons: string[];
            analystReviewState: string;
          }>;
          reviewGates: Array<{
            claimKind: string;
            value: string;
            state: string;
            requiredForReady: boolean;
            requiredReviews: string[];
            evidenceIds: string[];
            ledgerIds: string[];
            reasons: string[];
          }>;
          deltas: Array<{
            kind: string;
            claimKind: string;
            value: string;
            status: string;
            evidenceIds: string[];
            ledgerIds: string[];
            reasons: string[];
          }>;
          readinessSla: {
            status: string;
            confidence: number;
            evidenceFamilySupport: {
              sourceFamilyCount: number;
              ledgerIds: string[];
              evidenceIds: string[];
              evidenceStageCounts: Record<string, number>;
            };
            graphState: { status: string; reasons: string[] };
            sourceSla: { status: string; reasons: string[] };
            schedulerState: { status: string; reasons: string[] };
            publicChannelSla: { status: string; reasons: string[] };
            restrictedMetadataSla: { status: string; reasons: string[] };
            explanations: Array<{ code: string; evidenceIds: string[]; claimKinds: string[] }>;
          };
          promotionPolicy: {
            state: string;
            canPromote: boolean;
            publicStatus: string;
            rules: Array<{ code: string; state: string; reasons: string[]; evidenceIds: string[]; claimKinds: string[] }>;
            caveats: Array<{ code: string; severity: string; evidenceIds: string[]; claimKinds: string[] }>;
            pollableDeltas: Array<{ kind: string; pollReason: string; nextPollAfterSeconds: number; evidenceIds: string[]; ledgerIds: string[] }>;
          };
          analystFusion: {
            queryClass: string;
            answerState: string;
            changed: Array<{ field: string; values: string[]; deltaKinds: string[]; evidenceIds: string[]; ledgerIds: string[] }>;
            firstSeen?: string;
            lastSeen?: string;
            recentAttacks: Array<{ victim?: string; sectors: string[]; regions: string[]; ttps: string[]; malwareTools: string[]; vulnerabilities: string[]; evidenceIds: string[]; ledgerIds: string[] }>;
            targetSectors: string[];
            targetRegions: string[];
            ttps: string[];
            datasets: string[];
            caveatDigest: Array<{ code: string; severity: string; evidenceIds: string[]; claimKinds: string[] }>;
            confidence: { score: number; state: string; sourceFamilyCount: number; ledgerBackedClaimCount: number };
            contradictionHandling: { contradicted: boolean; holdReadyPromotion: boolean; reasons: string[]; evidenceIds: string[] };
            sourceBias: { missingSourceFamily: boolean; sourceFamilyCount: number; reasons: string[] };
            staleEvidence: { stale: boolean; reasons: string[]; evidenceIds: string[] };
            liveCollectionWaitingFor: Array<{ code: string; message: string; evidenceIds: string[]; claimKinds: string[] }>;
            claims: Array<{ kind: string; value: string; ledgerIds: string[]; evidenceIds: string[]; provenance: Array<{ evidenceId: string; sourceId: string; evidenceStage: string }>; graphExportState: string }>;
            pollableDeltas: Array<{ kind: string; pollReason: string; nextPollAfterSeconds: number; evidenceIds: string[]; ledgerIds: string[] }>;
          };
          provenanceNotes: string[];
        };
        ttps: string[];
        malwareTools: string[];
        vulnerabilities: string[];
        datasets: { sourceCount: number; evidenceStageCounts: Record<string, number> };
        changedFields: string[];
        evidenceIds: string[];
        provenance: Array<{ evidenceId: string; evidenceStage: string; sourceId: string; captureId?: string }>;
        analystActions: Array<{ kind: string }>;
        provenanceNotes: string[];
      };

      if (item.expect.status) expect(profile.status).toBe(item.expect.status);
      if (item.expect.warning) expect(profile.warningCodes).toContain(item.expect.warning);
      if (item.expect.action) expect(profile.analystActions.map((action) => action.kind)).toContain(item.expect.action);
      if (item.expect.alias) expect(profile.aliases).toContain(item.expect.alias);
      if (item.expect.victim) expect(profile.targets.victims).toContain(item.expect.victim);
      if (item.expect.sector) expect(profile.targets.sectors).toContain(item.expect.sector);
      if (item.expect.ttp) expect(profile.ttps).toContain(item.expect.ttp);
      if (item.expect.malware) expect(profile.malwareTools).toContain(item.expect.malware);
      if (item.expect.vulnerability) expect(profile.vulnerabilities).toContain(item.expect.vulnerability);
      if (item.expect.victim) expect(profile.readiness.fields.victims.evidenceIds.length).toBeGreaterThan(0);
      if (item.expect.warning === "metadata_only_leak_claim") expect(profile.readiness.fields.victims.status).toBe("needs_review");
      if (item.expect.status === "ready") expect(profile.readiness.fields.victims.status).toBe("fact");

      expect(profile.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.confidence).toBeLessThanOrEqual(1);
      expect(["fact", "partial_evidence", "needs_review"]).toContain(profile.answer.status);
      expect(profile.answer.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.answer.summary.length).toBeGreaterThan(0);
      expect(profile.answer.warningCodes.length).toBeGreaterThan(0);
      expect(profile.answer.claims.length).toBeGreaterThan(0);
      expect(profile.answer.claims.every((claim) => claim.confidence >= 0 && claim.confidence <= 1)).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.extractionVersion === "ti-basic-extractor-v1")).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.ledgerIds.length > 0)).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.sourceFamilySupport.length > 0)).toBe(true);
      expect(profile.answer.claims.every((claim) => claim.freshness.score >= 0 && claim.freshness.score <= 1)).toBe(true);
      expect(profile.answer.claims.every((claim) => Array.isArray(claim.caveatCodes) && Array.isArray(claim.downgradeReasons))).toBe(true);
      expect(profile.answer.claims.every((claim) => ["not_required", "recommended", "required"].includes(claim.analystReviewState))).toBe(true);
      expect(profile.answer.reviewGates.every((gate) => ["passed", "recommended", "required"].includes(gate.state))).toBe(true);
      expect(profile.answer.reviewGates.every((gate) => Array.isArray(gate.requiredReviews) && Array.isArray(gate.reasons))).toBe(true);
      expect(profile.answer.deltas.length).toBeGreaterThan(0);
      expect(profile.answer.deltas.every((delta) => delta.evidenceIds.length > 0 && delta.ledgerIds.length > 0)).toBe(true);
      expect(profile.answer.deltas.map((delta) => delta.kind)).toContain("new");
      expect(["ready", "partial", "review_required", "blocked"]).toContain(profile.answer.readinessSla.status);
      expect(profile.answer.readinessSla.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.answer.readinessSla.confidence).toBeLessThanOrEqual(1);
      expect(profile.answer.readinessSla.evidenceFamilySupport.sourceFamilyCount).toBeGreaterThanOrEqual(1);
      expect(profile.answer.readinessSla.evidenceFamilySupport.ledgerIds.length).toBeGreaterThan(0);
      expect(profile.answer.readinessSla.evidenceFamilySupport.evidenceIds.length).toBeGreaterThan(0);
      expect(Object.keys(profile.answer.readinessSla.evidenceFamilySupport.evidenceStageCounts)).toContain("captured_page");
      expect(["ready", "hold", "unknown"]).toContain(profile.answer.readinessSla.graphState.status);
      expect(["met", "missed", "unknown"]).toContain(profile.answer.readinessSla.sourceSla.status);
      expect(["normal", "queue_pressure", "unknown"]).toContain(profile.answer.readinessSla.schedulerState.status);
      expect(["stable", "unstable", "none"]).toContain(profile.answer.readinessSla.publicChannelSla.status);
      expect(["compliant", "restricted_only", "blocked", "none"]).toContain(profile.answer.readinessSla.restrictedMetadataSla.status);
      expect(["ready", "partial", "review_required", "blocked", "stale", "contradicted", "source_biased"]).toContain(profile.answer.promotionPolicy.state);
      expect(typeof profile.answer.promotionPolicy.canPromote).toBe("boolean");
      expect(profile.answer.promotionPolicy.publicStatus).toBe(profile.answer.readinessSla.status);
      expect(profile.answer.promotionPolicy.rules.map((rule) => rule.code)).toEqual(expect.arrayContaining([
        "ready_support",
        "source_sla",
        "scheduler_sla",
        "public_channel_sla",
        "restricted_metadata_sla",
        "graph_export_state",
        "claim_ledger",
        "freshness",
        "contradiction",
        "review_gate"
      ]));
      expect(profile.answer.promotionPolicy.rules.every((rule) => ["pass", "warning", "hold", "block"].includes(rule.state))).toBe(true);
      expect(profile.answer.promotionPolicy.pollableDeltas.every((delta) => delta.nextPollAfterSeconds > 0)).toBe(true);
      expect(["actor", "ransomware", "cve", "malware_tool", "country", "sector", "unknown"]).toContain(profile.answer.analystFusion.queryClass);
      expect(profile.answer.analystFusion.answerState).toBe(profile.answer.promotionPolicy.state);
      expect(profile.answer.analystFusion.confidence.score).toBeGreaterThanOrEqual(0);
      expect(profile.answer.analystFusion.confidence.score).toBeLessThanOrEqual(1);
      expect(profile.answer.analystFusion.claims.length).toBeGreaterThan(0);
      expect(profile.answer.analystFusion.claims.every((claim) => claim.ledgerIds.length > 0 && claim.evidenceIds.length > 0 && claim.provenance.length > 0)).toBe(true);
      expect(profile.answer.analystFusion.pollableDeltas).toEqual(profile.answer.promotionPolicy.pollableDeltas);
      if (!profile.answer.promotionPolicy.canPromote) expect(profile.answer.analystFusion.liveCollectionWaitingFor.length).toBeGreaterThan(0);
      expect(profile.answer.provenanceNotes.every((note) => !note.includes("https://"))).toBe(true);
      if (item.expect.victim) expect(profile.answer.victims).toContain(item.expect.victim);
      if (item.expect.victim) expect(profile.answer.claims.find((claim) => claim.kind === "victim" && claim.value === item.expect.victim)?.evidenceIds.length).toBeGreaterThan(0);
      if (item.query === "APT29") expect(profile.answer.claims.some((claim) => claim.ledgerIds.includes("ledger_api_apt29_ready"))).toBe(true);
      if (item.expect.warning) expect(profile.answer.reviewGates.some((gate) => gate.state !== "passed")).toBe(true);
      if (item.expect.warning) expect(profile.answer.readinessSla.explanations.length).toBeGreaterThan(0);
      if (profile.answer.promotionPolicy.state === "ready") expect(profile.answer.promotionPolicy.canPromote).toBe(true);
      if (item.expect.warning === "contradicted") expect(profile.answer.promotionPolicy.state).toBe("contradicted");
      if (item.expect.warning === "contradicted") expect(profile.answer.analystFusion.contradictionHandling.contradicted).toBe(true);
      if (item.expect.warning === "metadata_only_leak_claim") expect(profile.answer.promotionPolicy.canPromote).toBe(false);
      if (item.expect.warning === "metadata_only_leak_claim") expect(profile.answer.analystFusion.liveCollectionWaitingFor.map((wait) => wait.code)).toContain("restricted_metadata_review");
      expect(profile.readiness.sourceFamilyCount).toBe(1);
      expect(["fact", "partial_evidence", "needs_review"]).toContain(profile.readiness.overall);
      expect(profile.datasets.sourceCount).toBe(1);
      expect(profile.evidenceIds.length).toBeGreaterThan(0);
      expect(profile.provenance[0]?.evidenceStage).toBeTruthy();
      expect(profile.changedFields).toContain("new_evidence");
      expect(JSON.stringify(profile)).not.toContain(item.body);
      expect(JSON.stringify(profile)).not.toContain("profile-quality.example.test");
      expect(JSON.stringify(profile)).not.toContain(".onion");
      expect(JSON.stringify(profile)).not.toContain("prompt");
      expect(JSON.stringify(profile)).not.toContain("model");
    }
  });

  test("attaches live search polling to an active run and survives repeated polling under load", async () => {
    const store = new InMemoryScraperStore();
    for (let index = 0; index < 100; index += 1) {
      store.saveSource(source({
        id: `src_live_${index}`,
        type: index % 5 === 0 ? "api" : index % 2 === 0 ? "rss" : "static_web",
        trustScore: 0.5 + (index % 10) / 20,
        tags: index % 13 === 0 ? ["turla", "snake"] : undefined
      }));
    }
    const frontier = new FocusedFrontier();
    const options = { store, frontier };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Turla", entityType: "actor", tenantId: "tenant_live" })
    }), options));
    const run = created.run as { id: string };

    for (let poll = 0; poll < 3; poll += 1) {
      const response = await body(await handleApiRequest(api("/v1/intel/search?q=Turla&entityType=actor", {
        headers: { "x-tenant-id": "tenant_live" }
      }), options));
      const planner = response.planner as {
        activeRunId?: string;
        attachedToActiveRun: boolean;
        backpressureState: string;
        reuseKey: string;
        queuedTaskCount: number;
        nextPollSeconds: number;
      };

      expect(planner.attachedToActiveRun).toBe(true);
      expect(planner.backpressureState).toBe("attached_to_active_run");
      expect(planner.reuseKey).toMatch(/^live-reuse_/);
      expect(planner.activeRunId).toBe(run.id);
      expect(planner.queuedTaskCount).toBeGreaterThan(0);
      expect(planner.nextPollSeconds).toBe(5);
    }
  }, 15_000);

  test("exposes scraper-native search compatibility fields for public wrapper cutover", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_compat", tags: ["scattered spider"], type: "rss" }));
    const options = { store, frontier: new FocusedFrontier() };

    const first = await body(await handleApiRequest(api("/v1/intel/search?q=Scattered%20Spider&entityType=actor"), options));
    expect(first).toMatchObject({
      query: "Scattered Spider",
      mode: "interactive_live_search",
      status: expect.any(String),
      runId: expect.any(String),
      refreshAfterSeconds: expect.any(Number),
      cursor: expect.any(String),
      nextCursor: expect.any(String)
    });
    expect((first.summary as string[]).length).toBeGreaterThan(0);
    expect(Array.isArray(first.aliases)).toBe(true);
    expect(first.recentActivity).toBeDefined();
    expect(first.targets).toBeDefined();
    expect(Array.isArray(first.ttps)).toBe(true);
    expect(first.datasets).toBeDefined();
    expect(first.sources).toBeDefined();
    expect(Array.isArray(first.notes)).toBe(true);
    expect(first.sourceActivation).toMatchObject({
      query: "Scattered Spider",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false
    });
    expect(first.sla).toMatchObject({
      endpoint: "/v1/intel/search.sla",
      sourceActivation: {
        dryRun: true,
        willMutate: false,
        willStartCrawling: false
      },
      scheduler: {
        workerSafetyPlan: {
          dryRun: true,
          willMutate: false
        }
      },
      publicChannel: {
        enforcementStatus: expect.any(String),
        releaseAction: expect.any(String),
        checkCount: expect.any(Number)
      },
      enforcement: {
        endpoint: "/v1/intel/search.sla.enforcement",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        publicApiProof: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          getProofOptionalUnlessRequired: true
        },
        statePolicy: {
          ready: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          partial: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          reviewRequired: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          blocked: {
            preservesCompatibilityFields: true,
            cursorPollable: true
          },
          error: {
            preservesCompatibilityFields: true,
            cursorPollable: false
          }
        },
        polling: {
          nextPollSeconds: expect.any(Number),
          cursor: expect.any(String),
          nextCursor: expect.any(String),
          duplicateRunReuse: expect.any(Boolean)
        }
      },
      claimLedger: {
        enforcement: expect.any(Object),
        certification: {
          status: expect.any(String),
          releaseAction: expect.any(String),
          objectStore: expect.any(Object),
          postgresRepository: expect.any(Object),
          cursorReplay: expect.any(Object),
          retention: expect.any(Object),
          redaction: expect.any(Object),
          claimPromotion: expect.any(Object),
          downstream: expect.any(Object)
        },
        safeOutput: {
          sensitiveBodiesExposed: false,
          objectKeysExposed: false,
          unsafeRestrictedMetadataExposed: false
        }
      },
      polling: {
        nextPollSeconds: expect.any(Number),
        cursor: expect.any(String),
        nextCursor: expect.any(String)
      }
    });
    expect(["pass", "watch", "blocked"]).toContain((first.sla as { releaseState: string }).releaseState);
    expect((first.sla as { enforcement: { compatibilityFields: string[]; current: { status: string }; repairPackets: Array<{ dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }> } }).enforcement.compatibilityFields).toEqual(expect.arrayContaining([
      "query",
      "mode",
      "status",
      "runId",
      "refreshAfterSeconds",
      "summary",
      "warnings",
      "cursor",
      "nextCursor"
    ]));
    expect(["ready", "partial", "review_required", "blocked"]).toContain((first.sla as { enforcement: { current: { status: string } } }).enforcement.current.status);
    expect((first.sla as { enforcement: { repairPackets: Array<{ dryRun: boolean; willMutate: boolean; willStartCrawling: boolean }> } }).enforcement.repairPackets.every((packet) =>
      packet.dryRun && !packet.willMutate && !packet.willStartCrawling
    )).toBe(true);
    expect(Array.isArray((first.sourceActivation as { sources: unknown[] }).sources)).toBe(true);
    expect((first.scheduler as { queueEconomics: { apiTargets: string[] } }).queueEconomics.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(first.claimLedger).toMatchObject({
      trustGate: expect.any(String),
      counts: expect.any(Object),
      enforcement: {
        state: expect.any(String),
        releaseAction: expect.any(String),
        repairPackets: expect.any(Array),
        downstream: {
          agent07AnswerReadiness: expect.any(String),
          agent08GraphExportGate: expect.any(String),
          agent10ReleasePacket: expect.any(String)
        }
      },
      certification: {
        status: expect.any(String),
        releaseAction: expect.any(String),
        fixtures: {
          cleanCutover: "covered",
          missingObject: "covered",
          hashMismatch: "covered",
          staleExtractorReplay: "covered",
          restrictedMetadataRedaction: "covered",
          retiredSource: "covered",
          graphHold: "covered",
          lowConfidence: "covered",
          duplicateClaim: "covered",
          cursorGap: "covered",
          retentionExpiry: "covered",
          legalHold: "covered",
          objectStoreWriteFailure: "covered"
        },
        downstream: {
          agent07AnswerReadiness: expect.any(String),
          agent08ExportGate: expect.any(String),
          agent10ReleaseTrain: expect.any(String)
        }
      },
      safeOutput: {
        sensitiveBodiesExposed: false,
        objectKeysExposed: false,
        unsafeRestrictedMetadataExposed: false
      }
    });
    expect(first.graphExport).toMatchObject({
      publicFactPolicy: expect.any(String),
      slaState: expect.any(String),
      enforcementState: expect.any(String),
      schemaSafe: expect.any(Boolean),
      ledgerComplete: expect.any(Boolean),
      answerCaveats: expect.any(Array),
      proofRoute: "/v1/exports/stix"
    });
    expect(first.graph).toMatchObject({
      endpoint: "/v1/intel/search.graph",
      exportSla: {
        endpoint: "/v1/intel/search.graph",
        publicAnswerImpact: expect.any(String),
        stixImpact: expect.any(String)
      },
      enforcement: {
        endpoint: "/v1/intel/search.graph",
        releaseGate: {
          publicAnswers: expect.any(String),
          stixPromotion: expect.any(String),
          schemaSafe: expect.any(Boolean),
          ledgerComplete: expect.any(Boolean)
        },
        answerCaveats: expect.any(Array)
      },
      runtime: {
        endpoint: "/v1/intel/search.graph",
        publicFactPolicy: expect.any(String),
        relationshipCount: expect.any(Number),
        relationships: expect.any(Array),
        liveUpdate: {
          mode: "incremental_live_search_graph",
          nextPollSeconds: 3,
          cursorField: "graph.deltas[].cursor",
          weakDiscoveryPolicy: "pivots_and_caveats_only",
          publicChannelPolicy: "hint_until_corroborated_or_reviewed",
          restrictedEvidencePolicy: "held_context_no_public_fact",
          stixPolicy: "export_only_reviewed_or_promoted_relationships",
          taxiiBoundary: "descriptor_only_no_server"
        }
      },
      liveUpdate: {
        mode: "incremental_live_search_graph",
        responsePolicy: "seconds_level_polling",
        scenarioCoverage: expect.arrayContaining([
          expect.objectContaining({ name: "scattered_spider_clear_web" }),
          expect.objectContaining({ name: "stix_export_eligible" })
        ]),
        agentHandoffs: {
          agent06ClaimLedger: "ledger_ids_required_for_promotion",
          agent07AnswerCaveats: "surface_weak_public_restricted_stale_contradicted_and_missing_provenance",
          agent09ContractIndex: "expose_graph_live_update",
          agent10ReleaseGate: "graph_live_incremental_gate"
        }
      }
    });
    expect(first.answer).toBeDefined();
    expect(first.publicTiAnswer).toMatchObject({
      schemaVersion: "ti.public_answer_contract.v1",
      route: {
        endpoint: "/v1/intel/search",
        publicWrapperPath: "/api/ti/search",
        publicWrapperMethod: "POST",
        cursor: expect.any(String),
        nextCursor: expect.any(String)
      },
      safeWording: {
        overstatesLiveSnippets: false,
        rawEvidenceExposed: false,
        restrictedPayloadsExposed: false
      },
      sourceActivation: {
        dryRun: true,
        willMutate: false,
        willStartCrawling: false
      },
      graphStixReadiness: {
        proofRoute: "/v1/exports/stix"
      },
      releaseCandidate: {
        schemaVersion: "ti.public_answer_release_candidate.v1",
        publicPostCompatibility: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          stableFieldsPreserved: true,
          noLeakDto: true
        },
        agent10RcGate: {
          dryRun: true,
          willMutate: false,
          willStartCrawling: false
        }
      },
      ux: {
        schemaVersion: "ti.public_answer_ux.v1",
        polling: {
          intervalSeconds: 3,
          nextPollAfterSeconds: 3,
          cursorRequired: true
        },
        freshness: {
          updatedLabel: "Updated",
          lastSeenLabel: "Last seen",
          noLastSeenFiction: expect.any(Boolean)
        },
        publicWrapperCompatibility: {
          canonicalMethod: "POST",
          canonicalPath: "/api/ti/search",
          noDefaultQuery: true
        }
      },
      stateMachine: {
        schemaVersion: "ti.public_answer_polling_state.v1",
        polling: {
          cursorRequired: true
        },
        safeNoResult: {
          overstatesAbsence: false
        },
        holds: {
          restrictedMetadataBlocked: {
            blocked: expect.any(Boolean)
          },
          graphStixHolds: {
            hold: expect.any(Boolean)
          }
        }
      }
    });
    expect((first.publicTiAnswer as { sourceCoverageGaps: string[] }).sourceCoverageGaps).toBeArray();
    expect((first.publicTiAnswer as { nextPoll: { cursorRequired: boolean } }).nextPoll.cursorRequired).toBe(true);
    expect((first.publicTiAnswer as { releaseCandidate: { releaseGates: Array<{ name: string }>; effects: Record<string, { proofRoute: string }>; fixtures: Array<{ queryClass: string }> } }).releaseCandidate.releaseGates.map((gate) => gate.name)).toEqual(expect.arrayContaining([
      "sourceCanary",
      "schedulerControlPlane",
      "publicChannelPromotion",
      "restrictedEmergencyStop",
      "evidenceCutover",
      "graphExport",
      "apiContractState"
    ]));
    expect((first.publicTiAnswer as { releaseCandidate: { effects: Record<string, { proofRoute: string }> } }).releaseCandidate.effects.apiContractState.proofRoute).toBe("/v1/contracts");
    expect((first.publicTiAnswer as { releaseCandidate: { fixtures: Array<{ queryClass: string }> } }).releaseCandidate.fixtures.map((fixture) => fixture.queryClass)).toEqual(expect.arrayContaining(["actor", "cve", "malware_tool", "country", "sector", "victim"]));
    expect((first.publicTiAnswer as { ux: { compactAnswerCopy: { summary: string[] }; forbiddenCopy: string[]; evidenceStageLabels: Record<string, unknown> } }).ux.compactAnswerCopy.summary.length).toBeGreaterThan(0);
    expect((first.publicTiAnswer as { ux: { compactAnswerCopy: { summary: string[] } } }).ux.compactAnswerCopy.summary.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify((first.publicTiAnswer as { ux: { compactAnswerCopy: unknown } }).ux.compactAnswerCopy)).not.toMatch(/not in local cache|local cache|default APT29/i);
    expect((first.publicTiAnswer as { ux: { forbiddenCopy: string[] } }).ux.forbiddenCopy).toEqual(expect.arrayContaining(["not in local cache", "local cache", "demo", "default APT29"]));
    expect((first.publicTiAnswer as { stateMachine: { state: string; changedSinceCursor: { cursor: string; nextCursor: string }; uiFields: string[] } }).stateMachine.uiFields).toEqual(expect.arrayContaining([
      "progress",
      "changedSinceCursor",
      "polling",
      "holds"
    ]));
    expect(Array.isArray(first.answerGraphCaveats)).toBe(true);
    expect(Array.isArray(first.answerDeltas)).toBe(true);
    expect(Array.isArray(first.reviewGates)).toBe(true);

    const cursor = first.cursor as string;
    const second = await body(await handleApiRequest(api(`/v1/intel/search?q=Scattered%20Spider&entityType=actor&cursor=${encodeURIComponent(cursor)}`), options));
    expect(second.cursor).toBeTruthy();
    expect((second.scheduler as { cursorContinuity: string }).cursorContinuity).toBe("waiting_for_deltas");
    expect((second.sla as { enforcement: { polling: { cursorContinuity: string } } }).enforcement.polling.cursorContinuity).toBe("waiting_for_deltas");
  });

  test("returns a safe no-result public TI answer contract while live collection is pending", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_no_result", tags: ["apt29"], type: "rss" }));
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Unseen%20Quartz%20Actor&entityType=actor"), {
      store,
      frontier: new FocusedFrontier()
    }));
    const publicTiAnswer = response.publicTiAnswer as {
      noResult: boolean;
      displayState: string;
      safeSummary: string[];
      waitReasons: Array<{ code: string; message: string }>;
      evidenceLedgerReferences: unknown[];
      nextPoll: { pollable: boolean; nextPollAfterSeconds: number; cursorRequired: boolean };
      route: { publicWrapperPath: string; publicWrapperMethod: string };
      stateMachine: {
        state: string;
        progress: { noResult: boolean };
        polling: { pollReason: string; cursorRequired: boolean };
        holds: { sourceActivationGaps: string[] };
        safeNoResult: { noResult: boolean; wording: string; overstatesAbsence: boolean };
      };
      releaseCandidate: {
        state: string;
        visibleAnswer: { displayState: string; safeSummaryMode: string; canRenderFacts: boolean };
        agent10RcGate: { status: string; decision: string };
        publicPostCompatibility: { canonicalPath: string; cursorRequired: boolean };
      };
      ux: {
        state: string;
        compactAnswerCopy: { heading: string; summary: string[]; statusLine: string };
        freshness: { showLastSeen: boolean; noLastSeenFiction: boolean };
        polling: { intervalSeconds: number; nextPollAfterSeconds: number; hint: string };
      };
      safeWording: { overstatesLiveSnippets: boolean; rawEvidenceExposed: boolean; restrictedPayloadsExposed: boolean; guidance: string[] };
    };

    expect(typeof publicTiAnswer.noResult).toBe("boolean");
    expect(publicTiAnswer.displayState).toMatch(/partial|review_required|searching/);
    expect(publicTiAnswer.safeSummary.length).toBeGreaterThan(0);
    expect(publicTiAnswer.waitReasons.map((reason) => reason.code)).toContain("capture_promotion");
    expect(Array.isArray(publicTiAnswer.evidenceLedgerReferences)).toBe(true);
    expect(publicTiAnswer.nextPoll).toMatchObject({ pollable: true, cursorRequired: true });
    expect(publicTiAnswer.nextPoll.nextPollAfterSeconds).toBeGreaterThan(0);
    expect(publicTiAnswer.route).toMatchObject({ publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" });
    expect(publicTiAnswer.stateMachine.state).toMatch(/no_result|searching|partial|source_biased/);
    expect(typeof publicTiAnswer.stateMachine.progress.noResult).toBe("boolean");
    expect(publicTiAnswer.stateMachine.polling.cursorRequired).toBe(true);
    expect(typeof publicTiAnswer.stateMachine.safeNoResult.noResult).toBe("boolean");
    expect(publicTiAnswer.stateMachine.safeNoResult.wording).toBe("Searching");
    expect(publicTiAnswer.stateMachine.safeNoResult.overstatesAbsence).toBe(false);
    expect(publicTiAnswer.releaseCandidate.state).toMatch(/no_result|searching|partial|review_required|source_biased/);
    expect(publicTiAnswer.releaseCandidate.visibleAnswer).toMatchObject({
      safeSummaryMode: expect.any(String),
      canRenderFacts: expect.any(Boolean)
    });
    expect(publicTiAnswer.releaseCandidate.agent10RcGate.status).toMatch(/pass|warning|blocker/);
    expect(publicTiAnswer.releaseCandidate.agent10RcGate.decision).toMatch(/pass|hold|rollback/);
    expect(publicTiAnswer.releaseCandidate.publicPostCompatibility).toMatchObject({
      canonicalPath: "/api/ti/search",
      cursorRequired: true
    });
    expect(publicTiAnswer.ux.state).toBe("searching");
    expect(publicTiAnswer.ux.compactAnswerCopy).toMatchObject({
      heading: "Searching",
      summary: ["Searching"],
      statusLine: "Searching"
    });
    expect(publicTiAnswer.ux.freshness).toMatchObject({
      showLastSeen: false,
      noLastSeenFiction: true
    });
    expect(publicTiAnswer.ux.polling).toMatchObject({
      intervalSeconds: 3,
      nextPollAfterSeconds: 3,
      hint: "poll_after_3_seconds"
    });
    expect(publicTiAnswer.safeWording.overstatesLiveSnippets).toBe(false);
    expect(publicTiAnswer.safeWording.rawEvidenceExposed).toBe(false);
    expect(publicTiAnswer.safeWording.restrictedPayloadsExposed).toBe(false);
  });

  test("schedules continuous actor runs with run reuse and API-ready scheduler status", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_apt29_rss", type: "rss", tags: ["apt29", "nobelium"], crawlFrequencySeconds: 1_800 }));
    store.saveSource(source({ id: "src_apt29_api", type: "api", tags: ["apt29"], crawlFrequencySeconds: 900 }));
    store.saveSource(source({
      id: "src_apt29_metadata",
      type: "tor_metadata",
      accessMethod: "approved_proxy",
      risk: "high",
      tags: ["apt29"],
      governance: {
        approvalState: "approved",
        approvalRequired: true,
        metadataOnly: true,
        approvedAt: "2026-05-24T00:00:00.000Z",
        approvedBy: "reviewer"
      }
    }));
    const frontier = new FocusedFrontier();
    const options = { store, frontier };
    const request = {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_scheduler_api" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", includeDarknetMetadata: true, maxTasks: 4 })
    };

    const created = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    const run = created.run as { id: string; requestId: string; status: string; taskCount: number };
    const scheduler = created.scheduler as {
      runId: string;
      queuedTaskCount: number;
      selectedTaskCount: number;
      nextPollSeconds: number;
      partialResultReadiness: string;
      emergencyBrakeState: string;
      backpressure: { state: string; slo: { queueAge: { p95Seconds: number }; pollFreshness: { p95Seconds: number } }; agent10SoakPacket: { proofCommand: string } };
      queueEconomics: {
        apiTargets: string[];
        totals: { queued: number; retryDebt: number; maxQueuedAgeSeconds: number };
        workClassBudget: Array<{ workClass: string; budgetSlots: number; maxQueuedAgeSeconds: number }>;
        dryRunCapacityShiftPlan: { dryRun: boolean; willMutate: boolean; steps: unknown[] };
        agent10SoakPacket: { fields: string[]; proofCommands: string[] };
      };
      runtimeExecution: {
        apiTargets: string[];
        totals: { queued: number; leased: number; deadLettered: number };
        pollingDeltas: { cursorContinuity: string; newDeltaCount: number };
        dryRunControls: { dryRun: boolean; willMutate: boolean; controls: unknown[] };
        sourceActivationBudgetGuard: { state: string; estimatedActivationSlots: number };
        agent10SoakPacket: { fields: string[]; proofCommands: string[] };
      };
      runtimeSla: {
        apiTargets: string[];
        state: string;
        metrics: Array<{ name: string; state: string; value: number; threshold: number }>;
        workerSafetyPlan: { dryRun: boolean; willMutate: boolean; recoveryActions: unknown[] };
        agent10ReleasePacket: { fields: string[]; proofCommands: string[]; decision: string };
      };
      slaEnforcement: {
        apiTargets: string[];
        state: string;
        holds: Array<{ reason: string; severity: string }>;
        warnings: Array<{ reason: string; severity: string }>;
        releaseGate: { decision: string; dryRun: boolean; willMutate: boolean; proofCommand: string };
        drainPlan: { dryRun: boolean; willMutate: boolean; steps: unknown[] };
        agent10ReleasePacket: { fields: string[]; proofCommands: string[]; decision: string };
      };
      workerQueueCutover: {
        apiTargets: string[];
        runtime: { engine: string; dryRun: boolean; willMutate: boolean; contractFields: string[] };
        partitions: Array<{ workload: string; leaseTtlSeconds: number; retry: { maxAttempts: number }; deadLetter: { afterAttempts: number } }>;
        capacityEnvelope: { normalMemoryTargetMb: number; hardCeilingMb: number; normalTargetOk: boolean; hardCeilingOk: boolean };
        backendCutoverPackets: Array<{ backend: string; dryRun: boolean; willMutate: boolean }>;
        releaseGate: { decision: string; proofCommands: string[] };
        agent10ReleasePacket: { fields: string[]; proofCommands: string[]; decision: string };
      };
      workerSoakMigration: {
        apiTargets: string[];
        durationHours: number;
        dryRun: boolean;
        willMutate: boolean;
        partitionSlo: Array<{ workload: string; state: string; checkpointCadenceSeconds: number; retryDebtThreshold: number; safeDrainControls: string[] }>;
        aggregate: { state: string; queueAgeP95Seconds: number; queueAgeP99Seconds: number; memoryPressure: number };
        migrationPackets: Array<{ id: string; targetBackend: string; dryRun: boolean; willMutate: boolean; cursorContinuity: string; replayPreservation: string; agent09WarningCodes: string[] }>;
        routeContracts: { contractsField: string };
        releaseTrain: { decision: string; proofCommands: string[]; agent10Fields: string[] };
      };
      productionAdapterTelemetry: {
        apiTargets: string[];
        dryRun: boolean;
        willMutate: boolean;
        adapterContracts: Array<{ implementation: string; mode: string; methods: string[]; telemetryFields: string[] }>;
        telemetry: {
          leaseThroughputPerMinute: number;
          ackLatencyP95Ms: number;
          retryDebt: number;
          deadLetterCauses: Array<{ cause: string; count: number; releaseImpact: string }>;
          queueAge: { p95Seconds: number; p99Seconds: number };
          cursorContinuity: string;
          replayPreservation: string;
          runReuseRatio: number;
          duplicatePublicPollingRatio: number;
          staleClients: number;
          workerHeartbeats: number;
          cancellations: number;
          drainProgress: Array<{ action: string; state: string; estimatedTaskDelta: number }>;
        };
        soakFixtures: Array<{ scenario: string; requiredTelemetry: string[]; safeDrainControls: string[] }>;
        agent09WarningCodes: string[];
        agent10RcGate: { decision: string; fields: string[]; proofCommands: string[] };
      };
      safetyEnvelope: { allowClearWeb: boolean; allowRestrictedMetadata: boolean; metadataOnlyRestricted: boolean; forbiddenOperations: string[] };
    };

    expect(created.reused).toBe(false);
    expect(run.status).toBe("queued");
    expect(run.taskCount).toBeGreaterThanOrEqual(2);
    expect(scheduler.runId).toBe(run.id);
    expect(scheduler.queuedTaskCount).toBe(run.taskCount);
    expect(scheduler.selectedTaskCount).toBeGreaterThanOrEqual(2);
    expect(scheduler.nextPollSeconds).toBeGreaterThan(0);
    expect(scheduler.partialResultReadiness).toBe("pending");
    expect(scheduler.emergencyBrakeState).toBe("clear");
    expect(scheduler.backpressure.state).toBe("accepted");
    expect(scheduler.backpressure.slo.queueAge.p95Seconds).toBeGreaterThanOrEqual(0);
    expect(scheduler.backpressure.slo.pollFreshness.p95Seconds).toBeGreaterThanOrEqual(0);
    expect(scheduler.backpressure.agent10SoakPacket.proofCommand).toContain("check:frontier-apply-plan");
    expect(scheduler.queueEconomics.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(scheduler.queueEconomics.totals.queued).toBe(run.taskCount);
    expect(scheduler.queueEconomics.workClassBudget.length).toBeGreaterThan(0);
    expect(scheduler.queueEconomics.dryRunCapacityShiftPlan.dryRun).toBe(true);
    expect(scheduler.queueEconomics.dryRunCapacityShiftPlan.willMutate).toBe(false);
    expect(scheduler.queueEconomics.agent10SoakPacket.fields).toContain("memoryPressure");
    expect(scheduler.runtimeExecution.apiTargets).toContain("/v1/intel/runs/{id}");
    expect(scheduler.runtimeExecution.totals.queued).toBe(run.taskCount);
    expect(scheduler.runtimeExecution.pollingDeltas.cursorContinuity).toMatch(/not_started|waiting_for_deltas|continued/);
    expect(scheduler.runtimeExecution.dryRunControls.dryRun).toBe(true);
    expect(scheduler.runtimeExecution.dryRunControls.willMutate).toBe(false);
    expect(scheduler.runtimeExecution.sourceActivationBudgetGuard.state).toMatch(/within_budget|hold_activation_batches|blocked_by_emergency_brake/);
    expect(scheduler.runtimeExecution.agent10SoakPacket.fields).toContain("byWorkClass");
    expect(scheduler.runtimeSla.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(["pass", "watch", "breach"]).toContain(scheduler.runtimeSla.state);
    expect(scheduler.runtimeSla.metrics.map((metric) => metric.name)).toContain("cursor_continuity");
    expect(scheduler.runtimeSla.workerSafetyPlan.dryRun).toBe(true);
    expect(scheduler.runtimeSla.workerSafetyPlan.willMutate).toBe(false);
    expect(scheduler.runtimeSla.agent10ReleasePacket.fields).toContain("workerSafetyPlan");
    expect(scheduler.slaEnforcement.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(["pass", "warning", "hold", "rollback"]).toContain(scheduler.slaEnforcement.state);
    expect(scheduler.slaEnforcement.releaseGate.dryRun).toBe(true);
    expect(scheduler.slaEnforcement.releaseGate.willMutate).toBe(false);
    expect(scheduler.slaEnforcement.releaseGate.proofCommand).toContain("check:frontier-apply-plan");
    expect(scheduler.slaEnforcement.drainPlan.dryRun).toBe(true);
    expect(scheduler.slaEnforcement.drainPlan.willMutate).toBe(false);
    expect(scheduler.slaEnforcement.agent10ReleasePacket.fields).toContain("drainPlan");
    expect(scheduler.workerQueueCutover.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(scheduler.workerQueueCutover.runtime.engine).toBe("bun_worker_runtime");
    expect(scheduler.workerQueueCutover.runtime.dryRun).toBe(true);
    expect(scheduler.workerQueueCutover.runtime.willMutate).toBe(false);
    expect(scheduler.workerQueueCutover.partitions.map((partition) => partition.workload)).toContain("interactive_actor_search");
    expect(scheduler.workerQueueCutover.partitions.map((partition) => partition.workload)).toContain("restricted_metadata_approval");
    expect(scheduler.workerQueueCutover.capacityEnvelope.normalMemoryTargetMb).toBe(96 * 1024);
    expect(scheduler.workerQueueCutover.capacityEnvelope.hardCeilingMb).toBe(160 * 1024);
    expect(scheduler.workerQueueCutover.backendCutoverPackets.map((packet) => packet.backend)).toEqual(expect.arrayContaining(["postgres_advisory_queue", "redis_streams", "nats_jetstream"]));
    expect(scheduler.workerQueueCutover.backendCutoverPackets.every((packet) => packet.dryRun && packet.willMutate === false)).toBe(true);
    expect(scheduler.workerQueueCutover.agent10ReleasePacket.fields).toContain("backendCutoverPackets");
    expect(scheduler.workerSoakMigration.apiTargets).toContain("/v1/contracts");
    expect(scheduler.workerSoakMigration.durationHours).toBe(24);
    expect(scheduler.workerSoakMigration.dryRun).toBe(true);
    expect(scheduler.workerSoakMigration.willMutate).toBe(false);
    expect(scheduler.workerSoakMigration.partitionSlo.map((partition) => partition.workload)).toContain("interactive_actor_search");
    expect(scheduler.workerSoakMigration.migrationPackets.map((packet) => packet.id)).toEqual(expect.arrayContaining(["embedded_to_postgres", "embedded_to_redis", "embedded_to_nats"]));
    expect(scheduler.workerSoakMigration.migrationPackets.every((packet) => packet.dryRun && packet.willMutate === false && packet.cursorContinuity === "preserved")).toBe(true);
    expect(scheduler.workerSoakMigration.routeContracts.contractsField).toBe("surfaces.frontier.contracts.worker_soak_migration");
    expect(scheduler.workerSoakMigration.releaseTrain.proofCommands).toContain("bun run rehearse:cutover examples/cutover-rehearsal-pass.json");
    expect(scheduler.productionAdapterTelemetry.apiTargets).toContain("/v1/intel/search.scheduler");
    expect(scheduler.productionAdapterTelemetry.apiTargets).toContain("agent10_rc_gates");
    expect(scheduler.productionAdapterTelemetry.dryRun).toBe(true);
    expect(scheduler.productionAdapterTelemetry.willMutate).toBe(false);
    expect(scheduler.productionAdapterTelemetry.adapterContracts.map((contract) => contract.implementation)).toEqual(expect.arrayContaining(["embedded_memory", "postgres_advisory_queue", "redis_streams", "nats_jetstream"]));
    expect(scheduler.productionAdapterTelemetry.telemetry.leaseThroughputPerMinute).toBeGreaterThan(0);
    expect(scheduler.productionAdapterTelemetry.telemetry.ackLatencyP95Ms).toBeGreaterThan(0);
    expect(scheduler.productionAdapterTelemetry.telemetry.queueAge.p99Seconds).toBeGreaterThanOrEqual(scheduler.productionAdapterTelemetry.telemetry.queueAge.p95Seconds);
    expect(scheduler.productionAdapterTelemetry.telemetry.replayPreservation).toBe("preserved");
    expect(scheduler.productionAdapterTelemetry.soakFixtures.map((fixture) => fixture.scenario)).toContain("public_ti_traffic");
    expect(scheduler.productionAdapterTelemetry.agent10RcGate.fields).toContain("telemetry");
    expect(scheduler.safetyEnvelope.allowClearWeb).toBe(true);
    expect(scheduler.safetyEnvelope.allowRestrictedMetadata).toBe(true);
    expect(scheduler.safetyEnvelope.metadataOnlyRestricted).toBe(true);
    expect(scheduler.safetyEnvelope.forbiddenOperations).toContain("payload_download");

    const queued = frontier.snapshot().filter((task) => task.runId === run.id);
    expect(queued).toHaveLength(run.taskCount);
    expect(queued.every((task) => task.tenantId === "tenant_scheduler_api")).toBe(true);
    expect(queued.every((task) => task.planning?.freshnessTargetSeconds && task.planning.maxCost && task.planning.safetyEnvelope)).toBe(true);

    const reused = await body(await handleApiRequest(api("/v1/intel/runs", request), options));
    expect(reused.reused).toBe(true);
    expect((reused.run as { id: string }).id).toBe(run.id);
    expect(frontier.snapshot().filter((task) => task.runId === run.id)).toHaveLength(run.taskCount);
    expect((reused.scheduler as { attachedToActiveRun: boolean; backpressureState: string }).attachedToActiveRun).toBe(true);
    expect((reused.scheduler as { attachedToActiveRun: boolean; backpressureState: string }).backpressureState).toBe("attached_to_active_run");

    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_scheduler_added",
      tenantId: "tenant_scheduler_api",
      runId: run.id,
      cursor: "2026-05-24T21:00:01.000Z#delta_scheduler_added",
      kind: "added"
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_scheduler_promoted",
      tenantId: "tenant_scheduler_api",
      runId: run.id,
      cursor: "2026-05-24T21:00:02.000Z#delta_scheduler_promoted",
      kind: "promoted",
      captureIds: ["cap_scheduler_promoted"]
    }));

    const runStatus = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}?cursor=${encodeURIComponent("2026-05-24T21:00:01.000Z#delta_scheduler_added")}`), options));
    expect((runStatus.scheduler as { runId: string; queuedTaskCount: number }).runId).toBe(run.id);
    expect((runStatus.scheduler as { runId: string; queuedTaskCount: number }).queuedTaskCount).toBe(run.taskCount);
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).cursorContinuity).toBe("continued");
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).promotedEvidenceCount).toBe(1);
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).newEvidenceDeltaCount).toBeGreaterThanOrEqual(1);
    expect((runStatus.scheduler as { cursorContinuity: string; promotedEvidenceCount: number; newEvidenceDeltaCount: number; latestCursor: string }).latestCursor).toBe("2026-05-24T21:00:02.000Z#delta_scheduler_promoted");

    const frontierStatus = await body(await handleApiRequest(api(`/v1/frontier/status?runId=${run.id}`), options));
    expect(frontierStatus.endpoint).toBe("/v1/frontier/status");
    expect((frontierStatus.scheduler as { query: string; runId: string; queuedTaskCount: number }).query).toBe("APT29");
    expect((frontierStatus.scheduler as { query: string; runId: string; queuedTaskCount: number }).runId).toBe(run.id);
    expect((frontierStatus.scheduler as { query: string; runId: string; queuedTaskCount: number }).queuedTaskCount).toBe(run.taskCount);
    expect((frontierStatus.scheduler as { queueEconomics: { apiTargets: string[] } }).queueEconomics.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { runtimeExecution: { apiTargets: string[] } }).runtimeExecution.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { runtimeSla: { apiTargets: string[] } }).runtimeSla.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { slaEnforcement: { apiTargets: string[]; drainPlan: { dryRun: boolean; willMutate: boolean } } }).slaEnforcement.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { slaEnforcement: { apiTargets: string[]; drainPlan: { dryRun: boolean; willMutate: boolean } } }).slaEnforcement.drainPlan.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { slaEnforcement: { apiTargets: string[]; drainPlan: { dryRun: boolean; willMutate: boolean } } }).slaEnforcement.drainPlan.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { workerQueueCutover: { apiTargets: string[]; runtime: { dryRun: boolean; willMutate: boolean } } }).workerQueueCutover.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { workerQueueCutover: { apiTargets: string[]; runtime: { dryRun: boolean; willMutate: boolean } } }).workerQueueCutover.runtime.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { workerQueueCutover: { apiTargets: string[]; runtime: { dryRun: boolean; willMutate: boolean } } }).workerQueueCutover.runtime.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { workerSoakMigration: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).workerSoakMigration.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { workerSoakMigration: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).workerSoakMigration.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { workerSoakMigration: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).workerSoakMigration.willMutate).toBe(false);
    expect((frontierStatus.scheduler as { productionAdapterTelemetry: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).productionAdapterTelemetry.apiTargets).toContain("/v1/frontier/status");
    expect((frontierStatus.scheduler as { productionAdapterTelemetry: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).productionAdapterTelemetry.dryRun).toBe(true);
    expect((frontierStatus.scheduler as { productionAdapterTelemetry: { apiTargets: string[]; dryRun: boolean; willMutate: boolean } }).productionAdapterTelemetry.willMutate).toBe(false);
  });

  test("defers public live searches under background queue pressure without duplicating reuse keys", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    for (const actor of ["Scattered Spider", "Akira", "Volt Typhoon", "Turla"]) {
      store.saveSource(source({
        id: `src_${actor.replaceAll(" ", "_").toLowerCase()}`,
        type: "rss",
        trustScore: 0.9,
        tags: [actor.toLowerCase()]
      }));
    }
    for (let index = 0; index < 50; index += 1) {
      frontier.add({
        source: source({ id: `src_sweep_${index}`, type: index % 2 === 0 ? "rss" : "static_web" }),
        tenantId: `tenant_sweep_${index % 7}`,
        intelRequestId: `sweep_${Math.floor(index / 100)}`,
        url: `https://sweep.example.test/background/${index}`,
        discoveredAt: "2026-05-24T00:00:00.000Z",
        anchorText: "APT ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8,
        fairnessKey: "background:sweep"
      });
    }

    const options = { store, frontier };
    const reuseKeys = new Map<string, string>();
    for (const actor of ["Scattered Spider"]) {
      for (let poll = 0; poll < 1; poll += 1) {
        const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(actor)}&entityType=actor`, {
          headers: { "x-tenant-id": "tenant_public" }
        }), options));
        const planner = response.planner as {
          backpressureState: string;
          backpressureReason?: string;
          reuseKey: string;
          activeRunId?: string;
        };

        expect(planner.activeRunId).toBeUndefined();
        expect(planner.backpressureState).toMatch(/deferred_by_queue_pressure|deferred_by_source_backoff/);
        expect(planner.backpressureReason ?? "").toMatch(/frontier queue depth|crawl backoff|freshness/);
        if (!reuseKeys.has(actor)) reuseKeys.set(actor, planner.reuseKey);
        expect(planner.reuseKey).toBe(reuseKeys.get(actor) ?? "");
      }
    }
  }, 15_000);
});
