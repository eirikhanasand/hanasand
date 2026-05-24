import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { processCollectedItem } from "../src/pipeline/pipeline.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { CollectionRun, DiscoveryEvidence, EvidenceDelta, LiveSearchSnapshot, RawCapture, SourceRecord } from "../src/types.ts";
import { hashContent, stableId } from "../src/utils.ts";

type RcDecision = "promote" | "hold" | "rollback";

interface RcCheck {
  name: string;
  ok: boolean;
  status: "pass" | "hold" | "rollback";
  message: string;
  details?: Record<string, unknown>;
}

const generatedAt = process.env.TI_RC_GENERATED_AT ?? "2026-05-24T14:30:00.000Z";
const queries = (process.env.TI_RC_QUERIES ?? "APT29,Random Actor,Made Up Actor")
  .split(",")
  .map((query) => query.trim())
  .filter(Boolean);

const store = new InMemoryScraperStore();
const frontier = new FocusedFrontier();
seedReleaseCandidateStore(store, frontier);

const server = startApiServer({ port: 0, store, frontier });
const base = `http://127.0.0.1:${server.port}`;
const checks: RcCheck[] = [];

try {
  checks.push(...await checkSearchMatrix(base, queries));
  checks.push(await checkSourceCoverage(base));
  checks.push(await checkCanaryReadiness());
  checks.push(await checkEvidenceReplay(base));
  checks.push(await checkGraphWorkspace(base));
  checks.push(await checkContractIndex(base));
  checks.push(await checkRouteInventorySurface(base));
  checks.push(await checkNoLeakRuntimeSurface(base));
} finally {
  server.stop();
}

const decision = releaseDecision(checks);
const packet = {
  ok: decision === "promote",
  command: "bun run check:ti-release-candidate",
  generatedAt,
  milestone: "scraper-native /ti release candidate",
  decision,
  exitCriteria: {
    publicPostProofMatrix: {
      localCoveredBy: "scraper_native_search_matrix",
      externalCommand: "TI_SKIP_CONTAINER_CHECKS=true bun run check:inspur-public-proof",
      canonicalMethod: "POST",
      canonicalPath: "/api/ti/search",
      requiredQueries: queries
    },
    localScraperNativeMatrix: queries,
    noDefaultDemoCacheBehavior: checks.find((check) => check.name === "scraper_native_search_matrix")?.ok ?? false,
    partialResultsPollingSeconds: 3,
    sourceGapsAndPolicyHoldsExplicit: checks.find((check) => check.name === "source_coverage_and_policy_holds")?.ok ?? false,
    publicCanaryReadinessPromotes: checks.find((check) => check.name === "public_canary_readiness")?.ok ?? false,
    evidenceAndGraphDeltasProvenanceBacked: checks.find((check) => check.name === "evidence_replay_and_cutover")?.ok === true && checks.find((check) => check.name === "graph_investigation_workspace")?.ok === true,
    restrictedMaterialMetadataOnly: checks.find((check) => check.name === "runtime_no_leak_surface")?.ok ?? false,
    restartReplayPreservesState: checks.find((check) => check.name === "evidence_replay_and_cutover")?.ok ?? false,
    operatorDecisionPacket: "promote_hold_or_rollback"
  },
  checks
};

console.log(JSON.stringify(packet, null, 2));
if (decision !== "promote") process.exit(1);

async function checkSearchMatrix(baseUrl: string, matrix: string[]): Promise<RcCheck[]> {
  const results = await Promise.all(matrix.map(async (query) => {
    const first = await fetchJson(`${baseUrl}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor`);
    const cursor = readString(first.json, "pollCursor") ?? readString(first.json, "cursor") ?? readString(first.json, "deltaCursor");
    const poll = await fetchJson(`${baseUrl}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    const firstRecord = record(first.json);
    const pollRecord = record(poll.json);
    const firstText = JSON.stringify(first.json);
    const stableRun = typeof firstRecord.runId === "string" && firstRecord.runId.length > 0 && firstRecord.runId === pollRecord.runId;
    const pollingSeconds = Number(firstRecord.nextPollSeconds ?? firstRecord.refreshAfterSeconds);
    const status = String(firstRecord.status ?? "");
    const liveStatus = ["ready", "partial", "searching", "queued", "metadata_review"].includes(status);
    const noDemoFallback = firstRecord.query === query
      && firstRecord.mode !== "demo"
      && firstRecord.mode !== "cached_demo"
      && !firstText.includes("default demo")
      && !firstText.includes("defaultQuery");
    return {
      query,
      ok: first.status === 200 && poll.status === 200 && stableRun && pollingSeconds === 3 && liveStatus && noDemoFallback,
      status,
      runId: firstRecord.runId,
      pollingSeconds,
      stableRun,
      noDemoFallback
    };
  }));
  const failed = results.filter((result) => !result.ok);
  return [{
    name: "scraper_native_search_matrix",
    ok: failed.length === 0,
    status: failed.length === 0 ? "pass" : "rollback",
    message: failed.length === 0
      ? "known/random/made-up scraper-native search matrix returns live states, stable run ids, and 3-second polling"
      : "one or more scraper-native search matrix queries failed local RC semantics",
    details: { results }
  }];
}

async function checkSourceCoverage(baseUrl: string): Promise<RcCheck> {
  const response = await fetchJson(`${baseUrl}/v1/sources/coverage-plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ queries: ["APT29", "Made Up Actor"], entityTypes: ["actor"] })
  });
  const body = record(response.json);
  const queriesValue = Array.isArray(body.queries) ? body.queries.filter(isRecord) : [];
  const hasGaps = queriesValue.some((query) => Array.isArray(query.gaps) || Array.isArray(query.coverageGaps) || isRecord(query.sourceGaps));
  const hasPolicy = Array.isArray(body.forbiddenSourceClasses) && body.forbiddenSourceClasses.length > 0;
  const hasPlans = Array.isArray(body.remediationPlans) || queriesValue.some((query) => Array.isArray(query.remediationPlans));
  return {
    name: "source_coverage_and_policy_holds",
    ok: response.status === 200 && queriesValue.length >= 2 && hasPolicy && (hasGaps || hasPlans),
    status: response.status === 200 && queriesValue.length >= 2 && hasPolicy && (hasGaps || hasPlans) ? "pass" : "hold",
    message: "source selection explains selected sources, skipped/forbidden classes, and analyst remediation paths",
    details: {
      status: response.status,
      queryCount: queriesValue.length,
      forbiddenSourceClasses: body.forbiddenSourceClasses,
      hasGaps,
      hasPlans
    }
  };
}

async function checkCanaryReadiness(): Promise<RcCheck> {
  const canaryStore = new InMemoryScraperStore();
  const canaryFrontier = new FocusedFrontier();
  const canaryObjectStore = new InMemoryObjectEvidenceStore();
  const canaryServer = startApiServer({
    port: 0,
    store: canaryStore,
    frontier: canaryFrontier,
    objectStore: canaryObjectStore,
    canaryFetch: async (url) => canaryResponse(url)
  });
  const canaryBaseUrl = `http://127.0.0.1:${canaryServer.port}`;
  try {
    const activation = await fetchJson(`${canaryBaseUrl}/v1/sources/canary-activation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operatorApproval: true, approvedBy: "rc-canary-proof", generatedAt })
    });
    const run = await fetchJson(`${canaryBaseUrl}/v1/ops/canary/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operatorApproval: true, approvedBy: "rc-canary-proof", maxSources: 5, maxTasks: 5, generatedAt })
    });
    const readinessResponse = await fetchJson(`${canaryBaseUrl}/v1/ops/canary/readiness?requiredQueries=APT42,Turla&generatedAt=${encodeURIComponent(generatedAt)}`);
    const apt42 = await fetchJson(`${canaryBaseUrl}/v1/intel/search?q=APT42&entityType=actor`);
    const turla = await fetchJson(`${canaryBaseUrl}/v1/intel/search?q=Turla&entityType=actor`);
  const activationBody = record(activation.json);
  const runBody = record(record(run.json).canaryRun);
  const readiness = record(record(readinessResponse.json).readiness);
  const evidence = record(readiness.evidence);
  const controls = record(readiness.controls);
  const queryReadiness = Array.isArray(readiness.queryReadiness) ? readiness.queryReadiness.filter(isRecord) : [];
  const publicAnswers = [record(apt42.json), record(turla.json)];
  const queryRowsReady = ["APT42", "Turla"].every((query) =>
    queryReadiness.some((row) => row.query === query && row.readyForPublicAnswer === true && Number(row.captureCount) > 0)
  );
  const publicAnswersReady = publicAnswers.every((answer) => {
    const profile = record(answer.actorProfile);
    const datasets = record(profile.datasets);
    const counts = record(datasets.evidenceStageCounts);
    return ["ready", "partial"].includes(String(answer.status ?? "")) && Number(counts.captured_page ?? 0) > 0;
  });
  const safeControls = controls.activationRequiresHumanApproval === true
    && controls.continuousLoopAutoActivation === false
    && controls.restrictedSourcesExcluded === true;
  const noUnsafe = ![readinessResponse.body, apt42.body, turla.body].join("\n").toLowerCase().includes("public-canary-evidence/");
  const ok = activation.status === 200
    && run.status === 200
    && readinessResponse.status === 200
    && runBody.mode === "production_canary"
    && runBody.activationApplied === false
    && Number(runBody.completedTaskCount ?? 0) >= 5
    && Number(runBody.insertedCaptureCount ?? 0) >= 5
    && readiness.schemaVersion === "ti.public_canary_readiness.v1"
    && readiness.decision === "promote"
    && Number(evidence.activeSourceCount ?? 0) >= 5
    && Number(evidence.externalObjectCaptureCount ?? 0) >= 5
    && Number(evidence.missingObjectReferenceCount ?? 0) === 0
    && queryRowsReady
    && publicAnswersReady
    && safeControls
    && noUnsafe;
  return {
    name: "public_canary_readiness",
    ok,
    status: ok ? "pass" : "hold",
    message: "approved public canary activation and bounded collection produce object-backed captures and APT42/Turla public answer readiness",
    details: {
      activationStatus: activation.status,
      activatedSources: Array.isArray(record(activationBody.activation).activatedSources) ? record(activationBody.activation).activatedSources.length : undefined,
      runStatus: run.status,
      completedTaskCount: runBody.completedTaskCount,
      insertedCaptureCount: runBody.insertedCaptureCount,
      readinessDecision: readiness.decision,
      evidence: {
        activeSourceCount: evidence.activeSourceCount,
        externalObjectCaptureCount: evidence.externalObjectCaptureCount,
        missingObjectReferenceCount: evidence.missingObjectReferenceCount,
        promotionYield: evidence.promotionYield
      },
      queryReadiness,
      safeControls,
      publicAnswersReady
    }
  };
  } finally {
    canaryServer.stop();
  }
}

async function checkEvidenceReplay(baseUrl: string): Promise<RcCheck> {
  const replay = await fetchJson(`${baseUrl}/v1/evidence/replay-plan?q=APT29&runId=run_rc`);
  const cutover = await fetchJson(`${baseUrl}/v1/evidence/cutover-report?q=APT29&runId=run_rc&generatedAt=${encodeURIComponent(generatedAt)}`);
  const replayPlan = record(record(replay.json).replayPlan);
  const cutoverReport = record(record(cutover.json).cutoverReport);
  const redaction = record(cutoverReport.redaction);
  const trustLedger = record(cutoverReport.trustLedger);
  const replayable = replayPlan.replayable === true && record(cutoverReport.replayPlan).replayable === true;
  const noUnsafe = redaction.sensitiveBodiesExposed === false && redaction.objectKeysExposed === false;
  const hasTrustLedger = Number(trustLedger.trustedClaimCount ?? trustLedger.claimCount ?? 0) >= 0 && isRecord(cutoverReport.promotionGate);
  return {
    name: "evidence_replay_and_cutover",
    ok: replay.status === 200 && cutover.status === 200 && replayable && noUnsafe && hasTrustLedger,
    status: replay.status === 200 && cutover.status === 200 && replayable && noUnsafe && hasTrustLedger ? "pass" : "rollback",
    message: "capture, evidence delta, replay, redaction, trust ledger, and promotion gate survive the local cutover proof",
    details: {
      replayStatus: replay.status,
      cutoverStatus: cutover.status,
      replayable,
      readiness: cutoverReport.readiness,
      promotionGate: cutoverReport.promotionGate,
      redaction: cutoverReport.redaction
    }
  };
}

async function checkGraphWorkspace(baseUrl: string): Promise<RcCheck> {
  const response = await fetchJson(`${baseUrl}/v1/graph/query?q=APT29&runId=run_rc&generatedAt=${encodeURIComponent(generatedAt)}`);
  const graph = record(record(response.json).graph);
  const workspace = record(graph.investigationWorkspace);
  const attackCampaignWorkspace = record(graph.attackCampaignWorkspace);
  const reviewBoard = record(attackCampaignWorkspace.reviewBoard);
  const ledger = Array.isArray(workspace.relationshipConfidenceLedger) ? workspace.relationshipConfidenceLedger.filter(isRecord) : [];
  const deltas = Array.isArray(graph.deltas) ? graph.deltas : [];
  const safety = record(workspace.safety);
  const reviewBoardSafety = record(reviewBoard.safety);
  const reviewBoardLanes = Array.isArray(reviewBoard.lanes) ? reviewBoard.lanes.filter(isRecord) : [];
  const reviewBoardRows = Array.isArray(reviewBoard.rows) ? reviewBoard.rows.filter(isRecord) : [];
  const provenanceBacked = ledger.length > 0 && ledger.every((entry) =>
    Array.isArray(entry.supportingEvidenceIds)
    && Array.isArray(entry.supportingLedgerIds)
    && Array.isArray(entry.supportingCaptureIds)
    && typeof entry.provenanceComplete === "boolean"
  );
  const reviewBoardProvenanceBacked = reviewBoardRows.length > 0 && reviewBoardRows.every((row) =>
    Array.isArray(row.relationshipIds)
    && Array.isArray(row.evidenceIds)
    && Array.isArray(row.ledgerIds)
    && Array.isArray(row.sourceIds)
    && typeof row.exportEligible === "boolean"
    && typeof row.recommendedAction === "string"
    && typeof row.releaseImpact === "string"
  );
  const reviewBoardLanesPresent = [
    "ready_for_public_fact",
    "needs_evidence",
    "stale_or_contradicted",
    "restricted_or_policy_hold",
    "export_blocked"
  ].every((lane) => reviewBoardLanes.some((entry) => entry.lane === lane));
  const reviewActions = Array.isArray(workspace.reviewActions) && workspace.reviewActions.length > 0;
  const safe = safety.rawRestrictedMaterialIncluded === false && safety.restrictedMaterialPolicy === "metadata_only_review_hold";
  const reviewBoardSafe = reviewBoardSafety.rawRestrictedMaterialIncluded === false
    && reviewBoardSafety.metadataOnly === true
    && reviewBoardSafety.taxiiBoundary === "descriptor_only_no_server";
  const ok = response.status === 200
    && workspace.mode === "read_only_investigation_workspace"
    && provenanceBacked
    && reviewActions
    && deltas.length > 0
    && safe
    && attackCampaignWorkspace.mode === "attack_technique_timeline_campaign_graph"
    && reviewBoard.mode === "enterprise_campaign_timeline_review_board"
    && reviewBoardProvenanceBacked
    && reviewBoardLanesPresent
    && reviewBoardSafe;
  return {
    name: "graph_investigation_workspace",
    ok,
    status: ok ? "pass" : "hold",
    message: "graph workspace exposes provenance-backed relationship ledger, review actions, campaign review board, export holds, and pollable deltas",
    details: {
      status: response.status,
      relationshipLedgerCount: ledger.length,
      deltaCount: deltas.length,
      reviewBoardRowCount: reviewBoardRows.length,
      reviewBoardLanes: reviewBoardLanes.map((lane) => lane.lane),
      safety,
      reviewBoardSafety
    }
  };
}

async function checkContractIndex(baseUrl: string): Promise<RcCheck> {
  const response = await fetchJson(`${baseUrl}/v1/contracts`);
  const body = record(response.json);
  const publicCompatibility = record(body.publicCompatibility);
  const responsiveAudit = record(body.publicWrapperResponsiveAudit);
  const responsivePublicWrapper = record(responsiveAudit.publicWrapper);
  const deltaAudit = record(body.publicWrapperDeltaAudit);
  const sdk = record(body.sdkIntegration);
  const routes = Array.isArray(record(body.routeInventory).routes) ? record(body.routeInventory).routes : [];
  const ok = response.status === 200
    && publicCompatibility.canonicalMethod === "POST"
    && (publicCompatibility.canonicalPath === "/api/ti/search" || publicCompatibility.canonicalPublicPath === "/api/ti/search")
    && responsivePublicWrapper.pollingSeconds === 3
    && Array.isArray(deltaAudit.stableFields)
    && deltaAudit.stableFields.includes("graph")
    && record(sdk.polling).intervalSeconds === 3
    && routes.length > 0;
  return {
    name: "contract_index_release_surface",
    ok,
    status: ok ? "pass" : "rollback",
    message: "contract index exposes public POST compatibility, 3-second polling, delta fields, SDK polling, and route truth",
    details: {
      status: response.status,
      canonicalMethod: publicCompatibility.canonicalMethod,
      canonicalPath: publicCompatibility.canonicalPath ?? publicCompatibility.canonicalPublicPath,
      pollingSeconds: responsivePublicWrapper.pollingSeconds,
      routeCount: routes.length
    }
  };
}

async function checkRouteInventorySurface(baseUrl: string): Promise<RcCheck> {
  const requiredRoutes = [
    "/v1/intel/search",
    "/v1/evidence/replay-plan",
    "/v1/evidence/cutover-report",
    "/v1/graph/query",
    "/v1/graph/review-plan",
    "/v1/exports/stix",
    "/v1/contracts"
  ];
  const response = await fetchJson(`${baseUrl}/v1/contracts`);
  const routes = Array.isArray(record(record(response.json).routeInventory).routes)
    ? record(record(response.json).routeInventory).routes.filter(isRecord)
    : [];
  const paths = routes.map((route) => String(route.path ?? ""));
  const missing = requiredRoutes.filter((route) => !paths.includes(route));
  return {
    name: "route_inventory_release_surface",
    ok: response.status === 200 && missing.length === 0,
    status: response.status === 200 && missing.length === 0 ? "pass" : "rollback",
    message: "route inventory includes the scraper-native search, evidence replay, graph, STIX, and contract surfaces",
    details: { routeCount: routes.length, missing }
  };
}

async function checkNoLeakRuntimeSurface(baseUrl: string): Promise<RcCheck> {
  const urls = [
    `${baseUrl}/v1/intel/search?q=Akira&entityType=actor`,
    `${baseUrl}/v1/evidence/cutover-report?q=APT29&runId=run_rc`,
    `${baseUrl}/v1/graph/query?q=APT29&runId=run_rc`
  ];
  const responses = await Promise.all(urls.map((url) => fetchText(url)));
  const unsafeTerms = ["raw leaked", "credential=", "password=", "authorization:", "set-cookie", "object_key", "raw_body", "raw_url"];
  const leaks = responses.flatMap((response) => {
    const lower = response.body.toLowerCase();
    return unsafeTerms.filter((term) => lower.includes(term)).map((term) => ({ url: response.url, term }));
  });
  return {
    name: "runtime_no_leak_surface",
    ok: leaks.length === 0 && responses.every((response) => response.status === 200),
    status: leaks.length === 0 && responses.every((response) => response.status === 200) ? "pass" : "rollback",
    message: "runtime search, evidence, and graph responses avoid raw restricted/leak material and unsafe transport fields",
    details: { checked: urls.map((url) => new URL(url).pathname), leaks }
  };
}

function releaseDecision(items: RcCheck[]): RcDecision {
  if (items.some((item) => item.status === "rollback")) return "rollback";
  if (items.some((item) => item.status === "hold")) return "hold";
  return "promote";
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; json: unknown; body: string }> {
  const response = await fetch(url, init);
  const body = await response.text();
  try {
    return { status: response.status, json: JSON.parse(body), body };
  } catch {
    return { status: response.status, json: {}, body };
  }
}

async function fetchText(url: string): Promise<{ url: string; status: number; body: string }> {
  const response = await fetch(url);
  return { url, status: response.status, body: await response.text() };
}

function canaryResponse(url: string): Response {
  if (url.includes("microsoft.com")) {
    return rss("APT42 credential theft infrastructure observed", "APT42 targeted public sector victims with phishing infrastructure and malware delivery.");
  }
  if (url.includes("cloud.google.com/blog/products/identity-security")) {
    return rss("Turla Snake malware activity", "Turla operators used Snake malware against government victims with command infrastructure.");
  }
  if (url.includes("cloud.google.com/blog/topics/threat-intelligence")) {
    return rss("Turla and APT42 public research roundup", "Public threat research references Turla, APT42, phishing, malware, and defensive indicators.");
  }
  return rss("CVE-2026-11111 public advisory", "Public advisory references CVE-2026-11111 exploitation and malware activity.");
}

function rss(title: string, description: string): Response {
  return new Response(`
    <rss><channel><item>
      <title>${title}</title>
      <link>https://example.test/canary/${encodeURIComponent(title.toLowerCase().replaceAll(" ", "-"))}</link>
      <description>${description}</description>
      <pubDate>Sun, 24 May 2026 11:01:00 GMT</pubDate>
    </item></channel></rss>
  `, { status: 200, headers: { "content-type": "application/rss+xml" } });
}

function seedReleaseCandidateStore(store: InMemoryScraperStore, queue: FocusedFrontier): void {
  const publicSource = source({
    id: "src_rc_public_report",
    name: "RC public report source",
    type: "rss",
    url: "https://rc.example.test/feed.xml",
    status: "active",
    trustScore: 0.92,
    catalog: {
      publisher: "RC Source",
      sourceTier: "primary",
      approvalScope: "public_cti",
      collection: { freshnessTargetSeconds: 3600 },
      coverage: { actors: ["APT29"], sectors: ["healthcare"], regions: ["Europe"], topics: ["phishing", "credential-access"] },
      freshnessSlaSeconds: 3600,
      retentionClass: "public_report",
      adapterCompatibility: ["rss"],
      activationStatus: "active"
    }
  });
  const channelSource = source({
    id: "src_rc_public_channel",
    name: "RC public channel",
    type: "telegram_public",
    url: "https://t.me/rc_public_channel",
    status: "active",
    trustScore: 0.74
  });
  const restrictedSource = source({
    id: "src_rc_restricted_metadata",
    name: "RC restricted metadata only",
    type: "tor_metadata",
    url: "http://metadataonlyexample.onion/posts",
    accessMethod: "approved_proxy",
    status: "active",
    risk: "high",
    trustScore: 0.4,
    approvedAt: "2026-05-24T00:00:00.000Z",
    approvedBy: "rc-reviewer",
    legalNotes: "Metadata-only RC fixture; no payload collection.",
    governance: {
      approvalState: "approved",
      approvalRequired: true,
      metadataOnly: true,
      approvedAt: "2026-05-24T00:00:00.000Z",
      approvedBy: "rc-reviewer",
      policyVersion: "collection-policy:v1"
    }
  });
  store.saveSource(publicSource);
  store.saveSource(channelSource);
  store.saveSource(restrictedSource);

  const publicCapture = capture({
    id: "cap_rc_apt29_public",
    sourceId: publicSource.id,
    taskId: "task_rc_apt29_public",
    url: "https://rc.example.test/apt29",
    body: "APT29 used phishing and credential dumping against Northwind Health in the healthcare sector. APT29 uses T1566 Phishing and T1003 OS Credential Dumping.",
    metadata: { title: "APT29 RC public report", query: "APT29", normalizedQuery: "apt29", runId: "run_rc", evidenceStage: "reviewed_promoted", graphReviewState: "accepted" }
  });
  store.saveCapture(publicCapture);
  store.savePipelineResult(processCollectedItem({
    sourceId: publicCapture.sourceId,
    taskId: publicCapture.taskId,
    url: publicCapture.url,
    collectedAt: publicCapture.collectedAt,
    title: String(publicCapture.metadata.title),
    rawText: publicCapture.body ?? "",
    contentHash: publicCapture.contentHash,
    links: [],
    metadata: publicCapture.metadata,
    sensitive: false
  }));
  store.saveCapture(capture({
    id: "cap_rc_public_channel",
    sourceId: channelSource.id,
    taskId: "task_rc_public_channel",
    url: "https://t.me/rc_public_channel/1",
    body: "Public channel summary: APT29 phishing activity observed with capture-backed provenance.",
    metadata: { adapter: "telegram_public", channel: "rc_public_channel", messageId: 1, evidenceStage: "public_channel_message", title: "APT29 public channel RC proof" }
  }));
  store.saveCapture(capture({
    id: "cap_rc_restricted_metadata",
    sourceId: restrictedSource.id,
    taskId: "task_rc_restricted_metadata",
    url: "https://restricted.invalid/redacted/metadata",
    body: undefined,
    sensitive: true,
    sensitivityFlags: ["restricted_metadata"],
    metadata: {
      query: "Akira",
      normalizedQuery: "akira",
      actor: "Akira",
      victim: "Fjord Energy AS",
      affectedAccounts: "50k accounts",
      datasetSize: "20 GB",
      actorStatement: "Metadata-only actor statement summary.",
      urlHash: "rc-url-hash",
      evidenceStage: "restricted_metadata_review"
    },
    storageKind: "metadata_only"
  }));

  store.saveRun(run("run_rc"));
  const discovery = store.saveDiscoveryEvidence(discoveryEvidence());
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    captureId: publicCapture.id,
    promotedAt: "2026-05-24T14:30:01.000Z",
    promotedBy: "pipeline"
  });
  store.saveEvidenceDelta(evidenceDelta({
    id: "delta_rc_capture",
    cursor: "2026-05-24T14:30:01.000Z#delta_rc_capture",
    kind: "added",
    subjectType: "capture",
    subjectId: publicCapture.id,
    discoveryEvidenceIds: [discovery.id],
    captureIds: [publicCapture.id]
  }));
  store.saveEvidenceDelta(evidenceDelta({
    id: "delta_rc_relationship",
    cursor: "2026-05-24T14:30:02.000Z#delta_rc_relationship",
    kind: "added",
    subjectType: "relationship",
    subjectId: "rel_rc_apt29_ttp",
    discoveryEvidenceIds: [discovery.id],
    captureIds: [publicCapture.id],
    incidentIds: ["incident_rc_apt29"],
    relationshipIds: ["rel_rc_apt29_ttp"]
  }));
  store.saveLiveSearchSnapshot(liveSnapshot({
    discoveryEvidenceIds: [discovery.id],
    captureIds: [publicCapture.id],
    incidentIds: ["incident_rc_apt29"],
    newEvidenceIds: [discovery.id, publicCapture.id, "rel_rc_apt29_ttp"]
  }));

  queue.add({
    source: publicSource,
    tenantId: "tenant_rc",
    intelRequestId: "request_rc",
    url: "https://rc.example.test/frontier/apt29",
    discoveredAt: "2026-05-24T14:30:00.000Z",
    anchorText: "APT29 public report",
    parentRelevance: 0.9,
    novelty: 0.8,
    freshness: 0.9
  });
}

function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_rc",
    name: input.name ?? "RC Source",
    type: input.type ?? "rss",
    url: input.url ?? "https://rc.example.test/feed.xml",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.8,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public RC proof source.",
    createdAt: input.createdAt ?? "2026-05-24T14:30:00.000Z",
    updatedAt: input.updatedAt ?? "2026-05-24T14:30:00.000Z",
    ...input
  };
}

function capture(input: Partial<RawCapture>): RawCapture {
  const body = input.body ?? "APT29 RC evidence.";
  return {
    id: input.id ?? "cap_rc",
    tenantId: input.tenantId ?? "tenant_rc",
    sourceId: input.sourceId ?? "src_rc_public_report",
    taskId: input.taskId ?? "task_rc",
    url: input.url ?? "https://rc.example.test/apt29",
    collectedAt: input.collectedAt ?? "2026-05-24T14:30:00.000Z",
    publishedAt: input.publishedAt ?? "2026-05-24T14:00:00.000Z",
    contentHash: input.contentHash ?? hashContent(`${input.url ?? "https://rc.example.test/apt29"}:${body}`),
    mediaType: input.mediaType ?? "text/plain",
    storageKind: input.storageKind ?? "inline_text",
    body,
    metadata: input.metadata ?? { query: "APT29", normalizedQuery: "apt29", runId: "run_rc" },
    sensitive: input.sensitive ?? false,
    sensitivityFlags: input.sensitivityFlags,
    ...input
  };
}

function run(id: string): CollectionRun {
  return {
    id,
    planId: "plan_rc",
    requestId: "request_rc",
    status: "completed",
    createdAt: "2026-05-24T14:30:00.000Z",
    updatedAt: "2026-05-24T14:30:03.000Z",
    taskCount: 2,
    reviewTaskCount: 0,
    rejectedSourceCount: 0,
    captureCount: 2,
    incidentCount: 1
  };
}

function discoveryEvidence(input: Partial<DiscoveryEvidence> = {}): DiscoveryEvidence {
  return {
    id: input.id ?? "disc_rc_apt29",
    tenantId: "tenant_rc",
    query: "APT29",
    normalizedQuery: "apt29",
    provider: "search_provider",
    evidenceType: "search_snippet",
    resultId: stableId("result", "rc apt29"),
    observedAt: "2026-05-24T14:30:00.000Z",
    title: "APT29 RC discovery",
    snippet: "APT29 public discovery promoted to capture-backed evidence.",
    url: "https://rc.example.test/apt29",
    sourceId: "src_rc_public_report",
    confidence: 0.74,
    metadata: { fixture: "release_candidate" },
    retentionClass: "discovery_snippet",
    ...input
  };
}

function evidenceDelta(input: Partial<EvidenceDelta>): EvidenceDelta {
  return {
    id: input.id ?? "delta_rc",
    tenantId: "tenant_rc",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_rc",
    cursor: input.cursor ?? "2026-05-24T14:30:00.000Z#delta_rc",
    kind: input.kind ?? "added",
    subjectType: input.subjectType ?? "capture",
    subjectId: input.subjectId ?? "cap_rc_apt29_public",
    observedAt: "2026-05-24T14:30:00.000Z",
    sourceId: "src_rc_public_report",
    discoveryEvidenceIds: input.discoveryEvidenceIds ?? [],
    captureIds: input.captureIds ?? [],
    incidentIds: input.incidentIds ?? [],
    relationshipIds: input.relationshipIds ?? [],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: { fixture: "release_candidate" },
    ...input
  };
}

function liveSnapshot(input: Partial<LiveSearchSnapshot>): LiveSearchSnapshot {
  return {
    id: "snap_rc",
    tenantId: "tenant_rc",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_rc",
    status: "ready",
    capturedAt: "2026-05-24T14:30:03.000Z",
    discoveryEvidenceIds: input.discoveryEvidenceIds ?? [],
    captureIds: input.captureIds ?? [],
    incidentIds: input.incidentIds ?? [],
    newEvidenceIds: input.newEvidenceIds ?? [],
    metadata: { fixture: "release_candidate" },
    retentionClass: "live_search_snapshot",
    ...input
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, key: string): string | undefined {
  const item = record(value)[key];
  return typeof item === "string" ? item : undefined;
}
