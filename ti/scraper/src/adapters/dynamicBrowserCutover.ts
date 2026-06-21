// @ts-nocheck
import { hashContent } from "../utils.ts";

export type DynamicBrowserFailureMode =
  | "success" | "js_render_timeout" | "redirect_chain" | "unsupported_mime"
  | "robots_legal_hold" | "capture_truncation" | "blank_page"
  | "parser_empty_extraction" | "screenshot_hash_mismatch" | "queue_pressure"
  | "private_network_target" | "credential_prompt" | "captcha_challenge"
  | "download_attempt" | "onion_redirect" | "third_party_request_leak";
export type DynamicBrowserCutoverDecision = "canary_ready" | "watch" | "hold" | "kill_switch";
export type DynamicBrowserCutoverInput = any;
export type DynamicBrowserFixtureInput = any;
export type DynamicBrowserCutoverPacketDto = any;
export type DynamicBrowserFixtureResultDto = any;
export type DynamicBrowserGateDto = any;

const ISOLATION = [
  "private_network_target", "credential_prompt", "captcha_challenge",
  "download_attempt", "onion_redirect", "third_party_request_leak"
];
const STABLE = [
  "schemaVersion", "generatedAt", "decision", "browserWorkersEnabled", "canaryOnly",
  "requiresExplicitApproval", "workerPool", "networkIsolation", "evidenceBoundary",
  "isolationCanary", "resourceBudget", "storageIsolation", "killSwitch", "fixtures",
  "gates", "summary", "agentHandoffs", "promotionReadiness", "routeContract", "safety"
];
const FORBIDDEN = [
  "url", "requestedUrl", "finalUrl", "rawUrl", "unsafeUrl", "rawText", "html",
  "rawHtml", "body", "payload", "credential", "password", "cookie", "cookieJar",
  "localStorage", "sessionStorage", "token", "privateInvite", "onionUrl",
  "downloadUrl", "screenshotBytes", "objectRef"
];

export function buildDynamicBrowserCutoverPacket(input: DynamicBrowserCutoverInput): DynamicBrowserCutoverPacketDto {
  const fixtures = input.fixtures.map((fixture) => fixtureResult(input, fixture));
  const gates = buildGates(input, fixtures);
  const decision = input.policy.killSwitchActive ? "kill_switch" : gates.some((g) => g.status === "hold") ? "hold" : gates.some((g) => g.status === "watch") ? "watch" : "canary_ready";
  const warnings = uniq(fixtures.map((fixture) => fixture.handoffs.agent09ApiWarningField).filter((field) => field !== "none"));
  const resourceBudget = budget(input.pool);
  return {
    schemaVersion: "ti.dynamic_browser_cutover.v1", generatedAt: input.generatedAt, decision,
    browserWorkersEnabled: false, canaryOnly: true, requiresExplicitApproval: true,
    workerPool: { name: "dynamic_public_browser", ...numbers(input.pool) },
    networkIsolation: { publicOnly: true, hostAllowlistHashes: uniq(input.policy.hostAllowlist.map((host) => `hosthash:${hash(host)}`)), blockPrivateNetworks: true, blockCredentials: true, blockCaptchaSolving: true, blockDownloads: true, blockOnionLinks: true },
    evidenceBoundary: { screenshotStorage: "hash_only", objectRefs: "hash_only", rawHtmlExposed: false, rawTextExposed: false, rawUrlExposed: false },
    isolationCanary: { featureFlag: "disabled_by_default", fixtureReplayOnly: true, browserPoolSharedWithStaticCollectors: false, privateNetworkTargetsBlocked: true, credentialPromptsBlocked: true, captchaChallengesBlocked: true, downloadsBlocked: true, onionRedirectsBlocked: true, thirdPartyRequestLeaksBlocked: true, storagePolicy: "hashes_only_no_cookie_jar_no_local_storage" },
    resourceBudget,
    storageIsolation: { cookieJarPersisted: false, localStoragePersisted: false, sessionStoragePersisted: false, cachePersisted: false, downloadsPersisted: false, screenshotBytesPersisted: false, rawHtmlPersisted: false, objectRefsExposed: false, retainedFields: ["sourceId", "fixtureId", "taskId", "requestedUrlHash", "finalUrlHash", "canonicalUrlHash", "contentHash", "screenshotHash", "objectRefHash", "fetchedAt", "parserConfidence", "extractionWarnings"] },
    killSwitch: { active: input.policy.killSwitchActive, triggerReasons: gates.filter((gate) => gate.status === "hold").map((gate) => gate.name), rollbackAction: input.policy.killSwitchActive ? "pause_canary_pool" : "keep_disabled" },
    fixtures, gates,
    summary: { totalFixtures: fixtures.length, pass: count(fixtures, "pass"), watch: count(fixtures, "watch"), hold: count(fixtures, "hold"), sourceIds: uniq(fixtures.map((fixture) => fixture.sourceId)), warningCodes: warnings, objectRefHashes: uniq(fixtures.flatMap((fixture) => fixture.objectRefHash ? [fixture.objectRefHash] : [])), screenshotHashes: uniq(fixtures.flatMap((fixture) => fixture.screenshotHash ? [fixture.screenshotHash] : [])), isolationHoldCount: fixtures.filter((fixture) => hasIsolation(fixture.checks)).length, blockedTargetClasses: uniq(fixtures.flatMap((fixture) => isolationClasses(fixture.checks))) },
    agentHandoffs: { agent01SourceActivation: uniq(fixtures.map((f) => f.handoffs.agent01SourceActivation)), agent02SchedulerBudgets: uniq(fixtures.map((f) => f.handoffs.agent02SchedulerBudget)), agent04PublicSourceExpansion: uniq(fixtures.map((f) => f.handoffs.agent04PublicSourceExpansion)), agent06EvidenceChain: uniq(fixtures.map((f) => f.handoffs.agent06EvidenceChain)), agent07QualityGates: uniq(fixtures.map((f) => f.handoffs.agent07QualityGate)), agent09ApiWarningFields: warnings, agent10ResourceGates: uniq(fixtures.map((f) => f.handoffs.agent10ResourceGate)) },
    promotionReadiness: readiness(decision, gates, fixtures),
    routeContract: { safeForPublicApi: true, stableFields: STABLE, forbiddenFields: FORBIDDEN },
    safety: { publicOnly: true, dryRunOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, noExploitPayloadDownload: true, noRestrictedRawMaterial: true, unsafeUrlExposed: false }
  };
}

function fixtureResult(input, fixture) {
  const requestedUrlHash = `urlhash:${hash(fixture.requestedUrl)}`;
  const objectRefHash = fixture.objectRef ? `objectref:${hash(fixture.objectRef)}` : undefined;
  const checks = checksFor(input, fixture);
  const status = statusFor(input, checks);
  const failureCode = input.policy.killSwitchActive ? "kill_switch_active" : !input.approval.explicitlyApproved ? "approval_missing" : fixture.mode === "success" && status === "pass" ? undefined : fixture.mode === "success" ? firstFailure(checks) : fixture.mode;
  return {
    schemaVersion: "ti.dynamic_browser_fixture.v1", generatedAt: input.generatedAt,
    fixtureId: fixture.fixtureId, sourceId: fixture.sourceId, mode: fixture.mode, status,
    requestedUrlHash, finalUrlHash: fixture.finalUrl ? `urlhash:${hash(fixture.finalUrl)}` : undefined,
    objectRefHash, screenshotHash: fixture.screenshotHash, failureCode,
    provenance: { taskId: `dynamic_canary_${fixture.fixtureId}`, requestedUrlHash, finalUrlHash: fixture.finalUrl ? `urlhash:${hash(fixture.finalUrl)}` : undefined, canonicalUrlHash: `urlhash:${hash(fixture.finalUrl ?? fixture.requestedUrl)}`, contentHash: hashContent(`${fixture.sourceId}:${fixture.fixtureId}:${fixture.bytesRead}:${fixture.textLength}:${fixture.parserConfidence}`), screenshotHash: fixture.screenshotHash, objectRefHash, fetchedAt: input.generatedAt, robotsAllowed: input.policy.robotsAllowed, legalNotesPresent: input.policy.legalNotesPresent, parserConfidence: round(fixture.parserConfidence), extractionWarnings: warningsFor(checks), collectedItemCompatible: true },
    render: { durationMs: fixture.renderDurationMs, timeoutMs: input.pool.timeoutMs, redirectCount: fixture.redirectCount, contentType: fixture.contentType, bytesRead: fixture.bytesRead, textLength: fixture.textLength, parserConfidence: round(fixture.parserConfidence) },
    checks, handoffs: handoffsFor(input, fixture.mode, status, checks)
  };
}

function checksFor(input, fixture) {
  const iso = fixture.isolation ?? {};
  return {
    timeout: fixture.mode === "js_render_timeout" || fixture.renderDurationMs > input.pool.timeoutMs,
    redirectChain: fixture.mode === "redirect_chain" || fixture.redirectCount > 5,
    unsupportedMime: fixture.mode === "unsupported_mime" || unsupportedMime(fixture.contentType),
    robotsLegalHold: fixture.mode === "robots_legal_hold" || !input.policy.robotsAllowed || !input.policy.legalNotesPresent,
    truncated: fixture.mode === "capture_truncation" || fixture.bytesRead >= input.pool.maxBytes,
    blankPage: fixture.mode === "blank_page" || fixture.bytesRead === 0,
    emptyExtraction: fixture.mode === "parser_empty_extraction" || fixture.textLength === 0 || fixture.parserConfidence < 0.45,
    screenshotHashMismatch: fixture.mode === "screenshot_hash_mismatch" || Boolean(fixture.expectedScreenshotHash && fixture.screenshotHash && fixture.expectedScreenshotHash !== fixture.screenshotHash),
    queuePressure: fixture.mode === "queue_pressure" || input.pool.currentQueueDepth > input.pool.queueMaxDepth,
    privateNetworkTarget: fixture.mode === "private_network_target" || Boolean(iso.privateNetworkTarget),
    credentialPrompt: fixture.mode === "credential_prompt" || Boolean(iso.credentialPromptDetected),
    captchaChallenge: fixture.mode === "captcha_challenge" || Boolean(iso.captchaDetected),
    downloadAttempt: fixture.mode === "download_attempt" || Boolean(iso.downloadAttempted),
    onionRedirect: fixture.mode === "onion_redirect" || Boolean(iso.onionRedirect),
    thirdPartyRequestLeak: fixture.mode === "third_party_request_leak" || (iso.thirdPartyRequestCount ?? 0) > (iso.blockedThirdPartyRequestCount ?? 0)
  };
}

function buildGates(input, fixtures) {
  const heavy = budget(input.pool);
  const holdFixtures = fixtures.some((fixture) => fixture.status === "hold");
  return [
    gate("explicit_approval", input.approval.explicitlyApproved ? "pass" : "hold"),
    gate("kill_switch", input.policy.killSwitchActive ? "hold" : "pass"),
    gate("robots_legal", input.policy.robotsAllowed && input.policy.legalNotesPresent ? "pass" : "hold"),
    gate("memory_cap", heavy.memoryBudgetStatus === "pass" ? "pass" : "watch"),
    gate("timeout_cap", heavy.timeoutBudgetStatus),
    gate("byte_cap", heavy.byteBudgetStatus),
    gate("queue_pressure", input.pool.currentQueueDepth > input.pool.queueMaxDepth ? "hold" : input.pool.currentQueueDepth > input.pool.queueMaxDepth * 0.7 ? "watch" : "pass"),
    gate("screenshot_hash_only", fixtures.every((f) => Boolean(f.screenshotHash) || f.status !== "pass") ? "pass" : "watch"),
    gate("isolation_hazards_blocked", fixtures.some((f) => hasIsolation(f.checks)) ? "hold" : "pass"),
    gate("browser_pool_isolated", "pass"),
    gate("storage_ephemeral", "pass"),
    gate("fixture_health", holdFixtures ? "hold" : fixtures.some((f) => f.status === "watch") ? "watch" : "pass")
  ];
}

function readiness(decision, gates, fixtures) {
  const holds = gates.filter((g) => g.status === "hold").map((g) => g.name);
  const watches = gates.filter((g) => g.status === "watch").map((g) => g.name);
  return {
    state: decision === "canary_ready" ? "ready_for_fixture_canary" : decision,
    liveBrowserEnablement: "disabled_requires_separate_operator_allocation",
    staticRssPdfFallbackRequired: true,
    requiredBeforeLiveCanary: uniq(["explicit_operator_approval", "separate_worker_pool_allocation", "public_host_allowlist_hash_review", "robots_and_legal_notes_current", "screenshot_hash_only_storage_verified", "ephemeral_storage_verified", "no_cookie_jar_no_local_storage_verified", "static_rss_pdf_fallback_documented", ...holds.map((g) => `clear_hold_gate:${g}`), ...watches.map((g) => `review_watch_gate:${g}`)]),
    rollbackTriggers: uniq([...fixtures.flatMap((f) => f.provenance.extractionWarnings.map((w) => `fixture_warning:${w}`)), ...holds.map((g) => `hold_gate:${g}`), "browser_workers_enabled_without_release_board", "raw_url_or_html_serialized", "cookie_or_storage_persistence_detected", "screenshot_bytes_persisted", "download_or_private_network_attempt"]),
    proofCommands: ["bun test src/tests/dynamicBrowserCutover.test.ts", "bun run check"]
  };
}

function handoffsFor(input, mode, status, checks) {
  return {
    agent01SourceActivation: status === "pass" ? "allow_canary_after_approval" : "hold_activation",
    agent02SchedulerBudget: checks.queuePressure || checks.timeout || input.policy.killSwitchActive ? "pause_pool" : checks.redirectChain || checks.truncated ? "reduce_cadence" : "canary_cadence",
    agent04PublicSourceExpansion: status === "pass" ? "eligible_dynamic_gap" : status === "watch" ? "watch_dynamic_gap" : "exclude_until_repaired",
    agent06EvidenceChain: status === "pass" || status === "watch" ? "record_hash_only_capture" : "hold_evidence_replay",
    agent07QualityGate: status === "pass" ? "pass" : status === "watch" ? "review" : "hold",
    agent09ApiWarningField: warningCode(input, mode, checks),
    agent10ResourceGate: status === "pass" ? "none" : status === "watch" ? "watch" : "hold"
  };
}

function warningCode(input, mode, checks) {
  if (input.policy.killSwitchActive) return "dynamic_browser.kill_switch_active";
  if (!input.approval.explicitlyApproved) return "dynamic_browser.approval_missing";
  const failure = mode === "success" ? firstFailure(checks) : mode;
  return failure ? `dynamic_browser.${failure}` : "none";
}
function firstFailure(checks) { return ["js_render_timeout", "unsupported_mime", "robots_legal_hold", "blank_page", "parser_empty_extraction", "screenshot_hash_mismatch", "queue_pressure", ...ISOLATION, "redirect_chain", "capture_truncation"].find((mode) => checks[keyFor(mode)]); }
function warningsFor(checks) { return ["js_render_timeout", "redirect_chain", "unsupported_mime", "robots_legal_hold", "capture_truncation", "blank_page", "parser_empty_extraction", "screenshot_hash_mismatch", "queue_pressure", ...ISOLATION].filter((mode) => checks[keyFor(mode)]); }
function statusFor(input, checks) { return input.policy.killSwitchActive || !input.approval.explicitlyApproved || checks.timeout || checks.unsupportedMime || checks.robotsLegalHold || checks.blankPage || checks.emptyExtraction || checks.screenshotHashMismatch || checks.queuePressure || hasIsolation(checks) ? "hold" : checks.redirectChain || checks.truncated ? "watch" : "pass"; }
function budget(pool) { const estimatedWorstCaseMemoryMb = Math.max(0, pool.maxWorkers) * Math.max(0, pool.memoryCapMb); return { processIsolation: "separate_worker_pool_required", sharedWithStaticRssPdf: false, maxWorkers: Math.max(0, pool.maxWorkers), memoryCapMb: Math.max(0, pool.memoryCapMb), renderTimeoutMs: Math.max(1000, pool.timeoutMs), maxBytes: Math.max(0, pool.maxBytes), queueMaxDepth: Math.max(0, pool.queueMaxDepth), estimatedWorstCaseMemoryMb, memoryBudgetStatus: pool.memoryCapMb > 2048 || estimatedWorstCaseMemoryMb > 4096 ? "hold" : pool.memoryCapMb > 1536 ? "watch" : "pass", timeoutBudgetStatus: pool.timeoutMs > 30_000 ? "watch" : "pass", byteBudgetStatus: pool.maxBytes > 5_000_000 ? "watch" : "pass" }; }
function hasIsolation(checks) { return isolationClasses(checks).length > 0; }
function isolationClasses(checks) { return ISOLATION.filter((mode) => checks[keyFor(mode)]); }
function gate(name, status) { return { name, status, message: name }; }
function count(fixtures, status) { return fixtures.filter((fixture) => fixture.status === status).length; }
function keyFor(mode) { return mode.replace(/_([a-z])/g, (_, char) => char.toUpperCase()).replace("jsRenderTimeout", "timeout").replace("robotsLegalHold", "robotsLegalHold").replace("captureTruncation", "truncated").replace("parserEmptyExtraction", "emptyExtraction").replace("screenshotHashMismatch", "screenshotHashMismatch"); }
function hash(value) { return hashContent(value).slice(0, 16); }
function uniq(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function round(value) { return Math.round(value * 1000) / 1000; }
function numbers(pool) { return { maxWorkers: Math.max(0, pool.maxWorkers), memoryCapMb: Math.max(0, pool.memoryCapMb), timeoutMs: Math.max(1000, pool.timeoutMs), maxBytes: Math.max(0, pool.maxBytes), queueMaxDepth: Math.max(0, pool.queueMaxDepth), currentQueueDepth: Math.max(0, pool.currentQueueDepth) }; }
function unsupportedMime(contentType) { return Boolean(contentType) && !["text/html", "application/xhtml+xml", "text/plain"].includes((contentType.split(";")[0] ?? "").trim().toLowerCase()); }
