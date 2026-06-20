import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { processCollectedItem } from "../src/pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { AnalystClaimLedgerEntry, AnalystLoopSnapshot, AnalystMetadataReviewTask, AnalystSourceActivationPacket, AnalystVictimNotificationPacket, CollectionRun, RawCapture, SourceRecord } from "../src/types.ts";
import { hashContent } from "../src/utils.ts";

type RouteOwner = "Agent 01" | "Agent 02" | "Agent 04" | "Agent 05" | "Agent 06" | "Agent 07" | "Agent 08" | "Agent 09" | "Agent 10";

interface RouteCheck {
  owner: RouteOwner;
  name: string;
  method: "GET" | "POST";
  path: string;
  expectedStatus?: number;
  body?: unknown;
  expectKeys: string[];
  expectText?: string[];
  expectContentType?: string;
}

interface RouteResult {
  owner: RouteOwner;
  name: string;
  route: string;
  status: number;
  ok: boolean;
  keys: string[];
  expectedOutput: string;
  errorCode?: string;
}

const store = new InMemoryScraperStore();
const frontier = new FocusedFrontier();
seedStore(store, frontier);

const server = startApiServer({ port: 0, store, frontier });

try {
  const base = `http://127.0.0.1:${server.port}`;
  const results: RouteResult[] = [];
  for (const check of routeChecks()) {
    results.push(await runRouteCheck(base, check));
  }

  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({
    ok,
    command: "bun run check:route-inventory",
    expectedOutput: "ok=true; every mounted /v1 route returns compact safe response",
    routeCount: results.length,
    routes: results
  }, null, 2));
  if (!ok) process.exit(1);
} finally {
  server.stop();
}

function routeChecks(): RouteCheck[] {
  return [
    { owner: "Agent 09", name: "health", method: "GET", path: "/v1/health", expectKeys: ["ok", "service"] },
    { owner: "Agent 09", name: "metrics", method: "GET", path: "/v1/metrics", expectKeys: ["runs", "sources", "frontier"] },
    { owner: "Agent 10", name: "product_slo", method: "GET", path: "/v1/ops/product-slo?proofMode=local&generatedAt=2026-06-20T12:00:00.000Z", expectKeys: ["schemaVersion", "dashboard", "metrics", "paidProductEconomics", "slos", "apifyLaunchExperiment", "dailySnapshot", "deploymentProof", "resourceGuardrails"] },
    { owner: "Agent 09", name: "contracts", method: "GET", path: "/v1/contracts", expectKeys: ["endpoint", "routeInventory", "routeTruthAudit", "publicWrapperResponsiveAudit", "publicWrapperDeltaAudit", "enterpriseApiSurface", "sdkIntegration", "openapi", "surfaces", "publicCompatibility", "semantics"] },
    { owner: "Agent 01", name: "analyst_loop", method: "GET", path: "/v1/analyst/loop?q=Fjord%20Energy%20AS", expectKeys: ["contract", "state", "runStatusClarity", "reviewTasks", "sourceActivationPackets", "notificationPackets", "claimLedger"] },
    { owner: "Agent 01", name: "analyst_persistence_readiness", method: "GET", path: "/v1/analyst/persistence-readiness", expectKeys: ["endpoint", "migration", "workflowTables", "readiness", "noLeakGuardrails"] },
    { owner: "Agent 01", name: "analyst_metadata_review_tasks", method: "GET", path: "/v1/analyst/metadata-review-tasks", expectKeys: ["contract", "runStatusClarity", "tasks", "notificationPackets", "claimLedger"] },
    { owner: "Agent 01", name: "analyst_source_activation_packets", method: "GET", path: "/v1/analyst/source-activation-packets", expectKeys: ["contract", "runStatusClarity", "packets"] },
    { owner: "Agent 01", name: "analyst_source_activation_packet_execution_preview", method: "GET", path: "/v1/analyst/source-activation-packets/activation_inventory_fjord/execution-preview", expectKeys: ["contract", "readiness", "packet", "executionPreview", "forbiddenOperations"] },
    { owner: "Agent 01", name: "analyst_source_activation_packet_action", method: "POST", path: "/v1/analyst/source-activation-packets/activation_inventory_fjord/actions", body: { action: "approve_metadata_only", dryRun: true, reason: "route inventory proof" }, expectKeys: ["contract", "dryRun", "action", "packet", "result"] },
    { owner: "Agent 01", name: "analyst_victim_notification_packets", method: "GET", path: "/v1/analyst/victim-notification-packets", expectKeys: ["contract", "runStatusClarity", "packets"] },
    { owner: "Agent 01", name: "analyst_victim_notification_packet_export", method: "GET", path: "/v1/analyst/victim-notification-packets/notification_inventory_fjord/export", expectKeys: ["contract", "readiness", "packet", "delivery"] },
    { owner: "Agent 01", name: "analyst_victim_notification_packet_action", method: "POST", path: "/v1/analyst/victim-notification-packets/notification_inventory_fjord/actions", body: { action: "approve_packet", dryRun: true, reason: "route inventory proof" }, expectKeys: ["contract", "dryRun", "action", "packet", "result"] },
    { owner: "Agent 01", name: "sources_list", method: "GET", path: "/v1/sources?limit=2", expectKeys: ["sources"] },
    { owner: "Agent 01", name: "sources_apply_plan", method: "POST", path: "/v1/sources/apply-plan", body: { queryScope: { queries: ["APT29"], entityTypes: ["actor"] }, selectedActions: ["approve", "quarantine", "retire", "request_legal_notes", "leave_unchanged"], includeExecutionPreview: true }, expectKeys: ["applyPlan"] },
    { owner: "Agent 01", name: "sources_coverage_plan", method: "POST", path: "/v1/sources/coverage-plan", body: { queries: ["APT29", "Scattered Spider"], entityTypes: ["actor"] }, expectKeys: ["endpoint", "queries"] },
    { owner: "Agent 01", name: "sources_marketplace", method: "POST", path: "/v1/sources/marketplace", body: { queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234"] }, expectKeys: ["endpoint", "marketplace", "parserCapabilityMatrix", "activationReadiness"] },
    { owner: "Agent 01", name: "sources_atlas", method: "POST", path: "/v1/sources/atlas", body: { queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234"], recordLimit: 500 }, expectKeys: ["endpoint", "summary", "records", "importPlans", "coverageMatrix", "activationCanary"] },
    { owner: "Agent 01", name: "sources_atlas_export", method: "POST", path: "/v1/sources/atlas/export", body: { queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234"], planLabel: "first_100", recordLimit: 500 }, expectKeys: ["endpoint", "summary", "reviewQueue", "exportManifest", "approvalPacket", "rollbackPacket"] },
    { owner: "Agent 01", name: "sources_activation_batches", method: "POST", path: "/v1/sources/activation-batches", body: { queries: ["APT29"], entityTypes: ["actor"] }, expectKeys: ["endpoint", "queries", "coordination", "executionReadiness"] },
    { owner: "Agent 01", name: "sources_coverage_closeout", method: "POST", path: "/v1/sources/coverage-closeout", body: { queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234", "campaign infrastructure"], entityTypes: ["actor"] }, expectKeys: ["endpoint", "queries", "activationWaves", "executionReadiness", "releasePacket"] },
    { owner: "Agent 02", name: "frontier_snapshot", method: "GET", path: "/v1/frontier", expectKeys: ["queue", "summary", "scheduler"] },
    { owner: "Agent 02", name: "frontier_status", method: "GET", path: "/v1/frontier/status?q=APT29", expectKeys: ["endpoint", "summary", "scheduler"] },
    { owner: "Agent 02", name: "frontier_apply_plan", method: "POST", path: "/v1/frontier/apply-plan", body: { scenario: "normal", includeExecutionPreview: true }, expectKeys: ["applyPlan"] },
    { owner: "Agent 07", name: "canary_readiness", method: "GET", path: "/v1/ops/canary/readiness?requiredQueries=APT42,Turla", expectKeys: ["readiness", "operatorView"] },
    { owner: "Agent 07", name: "canary_soak", method: "GET", path: "/v1/ops/canary/soak?minCycles=1", expectKeys: ["soak", "operatorView"] },
    { owner: "Agent 07", name: "canary_operator_console", method: "GET", path: "/v1/ops/canary/console", expectKeys: [], expectText: ["TI Canary Ops", "Active Sources", "Public Answer Readiness", "Why Partial"], expectContentType: "text/html" },
    { owner: "Agent 04", name: "public_channel_status", method: "GET", path: "/v1/public-channels/status?q=APT29&entityType=actor", expectKeys: ["status"] },
    { owner: "Agent 04", name: "public_channel_apply_plan", method: "POST", path: "/v1/public-channels/apply-plan", body: { selectedActions: ["activate_source_pack"], dryRun: true, query: "APT29" }, expectKeys: ["applyPlan"] },
    { owner: "Agent 05", name: "restricted_metadata_apply_plan", method: "POST", path: "/v1/restricted-metadata/apply-plan", body: { sourceIds: ["src_restricted"], dryRun: true }, expectKeys: ["applyPlan"] },
    { owner: "Agent 05", name: "restricted_metadata_nested_apply_plan", method: "POST", path: "/v1/sources/src_restricted/restricted-metadata/apply-plan", body: { dryRun: true }, expectKeys: ["applyPlan"] },
    { owner: "Agent 05", name: "darkweb_index_status", method: "GET", path: "/v1/darkweb/status", expectKeys: ["status", "contract"] },
    { owner: "Agent 05", name: "darkweb_index_search", method: "GET", path: "/v1/darkweb/search?q=akira&network=tor&limit=5", expectKeys: ["darkwebIndex", "contract"] },
    { owner: "Agent 06", name: "captures", method: "GET", path: "/v1/captures", expectKeys: ["captures"] },
    { owner: "Agent 06", name: "evidence_replay_plan", method: "GET", path: "/v1/evidence/replay-plan?q=APT29&runId=run_inventory", expectKeys: ["contract", "replayPlan"] },
    { owner: "Agent 06", name: "evidence_cutover_report", method: "GET", path: "/v1/evidence/cutover-report?q=APT29&runId=run_inventory", expectKeys: ["contract", "cutoverReport"] },
    { owner: "Agent 07", name: "intel_search_quality", method: "GET", path: "/v1/intel/search?q=APT29&entityType=actor", expectKeys: ["query", "quality", "actorProfile", "sla", "qualityRegressionSuite"] },
    { owner: "Agent 07", name: "quality_evaluate", method: "GET", path: "/v1/quality/evaluate?q=APT29", expectKeys: ["query", "quality", "dashboard", "entityResolutionWorkbench", "timelinessGroundTruth", "attackMappingQuality", "analystFeedbackLoop", "qualityRegressionSuite", "examples"] },
    { owner: "Agent 08", name: "graph_review_plan", method: "GET", path: "/v1/graph/review-plan?runId=run_inventory&dryRun=true&includeExamples=true", expectKeys: ["contract", "reviewPlan"] },
    { owner: "Agent 08", name: "graph_cutover_report", method: "GET", path: "/v1/graph/cutover-report?runId=run_inventory&dryRun=true", expectKeys: ["contract", "cutoverReport"] },
    { owner: "Agent 08", name: "stix_readiness", method: "GET", path: "/v1/exports/stix?runId=run_inventory&dryRun=true", expectKeys: ["contract", "readiness"] },
    { owner: "Agent 09", name: "intel_plan", method: "POST", path: "/v1/intel/plan", expectedStatus: 201, body: { query: "APT29", entityType: "actor", includeClearWeb: true }, expectKeys: ["plan"] },
    { owner: "Agent 09", name: "intel_run_status", method: "GET", path: "/v1/intel/runs/run_inventory", expectKeys: ["run", "frontier"] },
    { owner: "Agent 09", name: "intel_run_results", method: "GET", path: "/v1/intel/runs/run_inventory/results?include=captures,incidents,indicators,entities,relationships", expectKeys: ["run", "results"] },
    { owner: "Agent 09", name: "stix_export", method: "POST", path: "/v1/exports/stix", body: { runId: "run_inventory", producerName: "route-inventory-proof" }, expectKeys: ["bundle"] }
  ];
}

async function runRouteCheck(base: string, check: RouteCheck): Promise<RouteResult> {
  const response = await fetch(`${base}${check.path}`, {
    method: check.method,
    headers: check.body ? { "content-type": "application/json" } : undefined,
    body: check.body ? JSON.stringify(check.body) : undefined
  });
  const text = await response.text();
  const json = parseJson(text);
  const keys = isRecord(json) ? Object.keys(json).sort() : [];
  const missingKeys = check.expectKeys.filter((key) => !keys.includes(key));
  const missingText = (check.expectText ?? []).filter((value) => !text.includes(value));
  const contentTypeOk = check.expectContentType ? (response.headers.get("content-type") ?? "").includes(check.expectContentType) : true;
  const expectedStatus = check.expectedStatus ?? 200;
  const unsafeLeak = ["telegram raw proof payload", "cookie=", "password=", "authorization:", "set-cookie"].some((raw) => text.toLowerCase().includes(raw));
  return {
    owner: check.owner,
    name: check.name,
    route: `${check.method} ${check.path.split("?")[0]}`,
    status: response.status,
    ok: response.status === expectedStatus && missingKeys.length === 0 && missingText.length === 0 && contentTypeOk && !unsafeLeak,
    keys,
    expectedOutput: check.expectText?.length
      ? `HTTP ${expectedStatus}; text=${check.expectText.join(",")}; compact safe response`
      : `HTTP ${expectedStatus}; keys=${check.expectKeys.join(",")}; compact safe response`,
    errorCode: response.status !== expectedStatus
      ? `status_${response.status}`
      : missingKeys.length
        ? `missing_${missingKeys.join("_")}`
        : missingText.length
          ? `missing_text_${missingText.join("_")}`
          : !contentTypeOk
            ? "content_type_mismatch"
            : isRecord(json) && isRecord(json.error) ? String(json.error.code ?? "") : undefined
  };
}

function seedStore(store: InMemoryScraperStore, frontier: FocusedFrontier): void {
  const now = "2026-05-24T04:44:32.036Z";
  const publicSource = source("src_public", "rss", "https://inventory.example.test/feed.xml");
  const publicChannel = source("src_public_channel", "telegram_public", "https://t.me/public_inventory");
  const restricted = source("src_restricted", "tor_metadata", "https://restricted.example.test", "restricted", "approved_proxy");
  store.saveSource(publicSource);
  store.saveSource(publicChannel);
  store.saveSource(restricted);

  const capture = captureFor({
    id: "cap_inventory_apt29",
    sourceId: publicSource.id,
    taskId: "task_inventory_apt29",
    url: "https://inventory.example.test/apt29",
    body: "APT29 used phishing and credential dumping against Northwind Health in healthcare.",
    collectedAt: now,
    metadata: { title: "APT29 inventory proof", evidenceStage: "reviewed_promoted", graphReviewState: "accepted" }
  });
  store.savePipelineResult(processCollectedItem({
    sourceId: capture.sourceId,
    taskId: capture.taskId,
    url: capture.url,
    collectedAt: capture.collectedAt,
    title: String(capture.metadata.title),
    rawText: capture.body ?? "",
    contentHash: capture.contentHash,
    links: [],
    metadata: capture.metadata,
    sensitive: false
  }));
  store.saveCapture(captureFor({
    id: "cap_public_channel_apt29",
    sourceId: publicChannel.id,
    taskId: "task_public_channel_apt29",
    url: "https://t.me/public_inventory/1",
    body: "Public channel summary: APT29 phishing activity observed.",
    collectedAt: now,
    metadata: { adapter: "telegram_public", channel: "public_inventory", evidenceStage: "public_channel_message", title: "APT29 public channel proof" }
  }));

  const run: CollectionRun = {
    id: "run_inventory",
    planId: "plan_inventory",
    requestId: "request_inventory",
    status: "completed",
    createdAt: now,
    updatedAt: now,
    taskCount: 1,
    reviewTaskCount: 0,
    rejectedSourceCount: 0,
    captureCount: 1,
    incidentCount: 1
  };
  store.saveRun(run);
  seedAnalystLoop(store);
  frontier.add({
    source: publicSource,
    tenantId: "tenant_inventory",
    intelRequestId: "request_inventory",
    url: "https://inventory.example.test/frontier",
    discoveredAt: now,
    anchorText: "APT29 route inventory proof",
    parentRelevance: 0.9,
    novelty: 0.8,
    freshness: 0.8
  });
}

function seedAnalystLoop(store: InMemoryScraperStore): void {
  const reviewTask: AnalystMetadataReviewTask = {
    id: "review_inventory_fjord",
    tenantId: "tenant_inventory",
    planId: "plan_inventory",
    runId: "run_inventory",
    taskId: "task_inventory_restricted",
    sourceId: "src_restricted",
    captureId: "cap_inventory_restricted_metadata",
    status: "open",
    resultState: "metadata_review",
    company: "Fjord Energy AS",
    victim: "Fjord Energy AS",
    affectedAccounts: "50k accounts",
    affectedAccountsCount: 50_000,
    accountSubjects: ["employees"],
    datasetSize: "20 GB",
    datasetSizeBytes: 20_000_000_000,
    actorStatement: "Actor claims Fjord Energy AS leaked, 50k accounts, 20 GB.",
    claimedAt: "2026-05-20T00:00:00.000Z",
    observedAt: "2026-05-24T04:44:32.036Z",
    sourceHash: "hash_inventory_fjord",
    provenance: {
      sourceId: "src_restricted",
      captureId: "cap_inventory_restricted_metadata",
      unsafeMaterialAccessed: false
    },
    allowedActions: ["notify_company", "mark_duplicate", "request_approval", "escalate"],
    confidence: 0.82,
    unsafeMaterialAccessed: false,
    whatWasNotAccessed: [
      "No restricted dataset was downloaded or opened.",
      "No credentials, cookies, private channels, or invite-only areas were accessed.",
      "No threat actor interaction was performed."
    ],
    createdAt: "2026-05-24T04:44:32.036Z",
    updatedAt: "2026-05-24T04:44:32.036Z"
  };
  const activationPacket: AnalystSourceActivationPacket = {
    id: "activation_inventory_fjord",
    tenantId: "tenant_inventory",
    planId: "plan_inventory",
    runId: "run_inventory",
    sourceId: "src_restricted",
    action: "request_operator_approval",
    execution: "approval_required",
    reason: "Operator approval required before metadata-only source restoration.",
    expectedEffect: "Queue safe metadata only.",
    rollback: "Keep source disabled.",
    dryRun: true,
    createdAt: "2026-05-24T04:44:32.036Z"
  };
  const notificationPacket: AnalystVictimNotificationPacket = {
    id: "notification_inventory_fjord",
    tenantId: "tenant_inventory",
    reviewTaskId: reviewTask.id,
    status: "draft",
    company: "Fjord Energy AS",
    victim: "Fjord Energy AS",
    claimSummary: "Fjord Energy AS was named in a metadata-only leak claim; 50k accounts and 20 GB were claimed.",
    affectedAccounts: "50k accounts",
    datasetSize: "20 GB",
    actorStatement: reviewTask.actorStatement,
    claimedAt: reviewTask.claimedAt,
    observedAt: reviewTask.observedAt,
    sourceHash: reviewTask.sourceHash,
    confidence: 0.82,
    provenance: reviewTask.provenance,
    redactions: ["restricted_dataset_material", "credential_material", "private_access_material", "actor_interaction"],
    whatWasNotAccessed: reviewTask.whatWasNotAccessed,
    safeToSend: false,
    createdAt: "2026-05-24T04:44:32.036Z",
    updatedAt: "2026-05-24T04:44:32.036Z"
  };
  const claimLedgerEntry: AnalystClaimLedgerEntry = {
    id: "claim_inventory_fjord_dataset",
    tenantId: "tenant_inventory",
    normalizedQuery: "fjord energy as",
    reviewTaskId: reviewTask.id,
    captureId: reviewTask.captureId,
    sourceId: reviewTask.sourceId,
    claimKind: "dataset_size_claim",
    company: "Fjord Energy AS",
    victim: "Fjord Energy AS",
    claimTextSummary: "20 GB was claimed as dataset size or volume.",
    sourceHash: reviewTask.sourceHash,
    confidence: 0.82,
    ledgerStatus: "metadata_review",
    observedAt: reviewTask.observedAt,
    provenance: reviewTask.provenance,
    createdAt: "2026-05-24T04:44:32.036Z"
  };
  const snapshot: AnalystLoopSnapshot = {
    id: "snapshot_inventory_fjord",
    tenantId: "tenant_inventory",
    planId: "plan_inventory",
    runId: "run_inventory",
    normalizedQuery: "fjord energy as",
    resultState: "metadata_review",
    headline: "1 metadata review item needs analyst action.",
    queuedTasks: 0,
    reviewTasks: 1,
    rejectedSources: 0,
    blockedUnsafeTargets: 0,
    meaningfulWorkCount: 1,
    nextSteps: [{
      state: "metadata_review",
      label: "Review leak metadata",
      detail: "Review actor/victim/account/dataset metadata and prepare notification without opening leaked payloads.",
      tone: "watch"
    }],
    reviewTaskIds: [reviewTask.id],
    activationPacketIds: [activationPacket.id],
    victimNotificationPacketId: notificationPacket.id,
    capturedAt: "2026-05-24T04:44:32.036Z"
  };
  store.saveAnalystMetadataReviewTask(reviewTask);
  store.saveAnalystSourceActivationPacket(activationPacket);
  store.saveAnalystVictimNotificationPacket(notificationPacket);
  store.saveAnalystClaimLedgerEntry(claimLedgerEntry);
  store.saveAnalystLoopSnapshot(snapshot);
}

function source(
  id: string,
  type: SourceRecord["type"],
  url: string,
  risk: SourceRecord["risk"] = "low",
  accessMethod: SourceRecord["accessMethod"] = type === "telegram_public" ? "official_api" : "public_http"
): SourceRecord {
  return {
    id,
    name: id,
    type,
    url,
    accessMethod,
    status: "active",
    risk,
    trustScore: 0.9,
    crawlFrequencySeconds: 3600,
    legalNotes: "Route inventory proof fixture.",
    approvedAt: "2026-05-24T00:00:00.000Z",
    approvedBy: "agent10",
    governance: risk === "restricted"
      ? { approvalState: "approved", approvedAt: "2026-05-24T00:00:00.000Z", approvedBy: "agent10", metadataOnly: true }
      : undefined,
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z"
  };
}

function captureFor(input: {
  id: string;
  sourceId: string;
  taskId: string;
  url: string;
  body: string;
  collectedAt: string;
  metadata: Record<string, unknown>;
}): RawCapture {
  return {
    id: input.id,
    sourceId: input.sourceId,
    taskId: input.taskId,
    url: input.url,
    collectedAt: input.collectedAt,
    contentHash: hashContent(input.body),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: input.body,
    metadata: input.metadata,
    sensitive: false
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
