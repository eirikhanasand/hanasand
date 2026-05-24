import { hashContent } from "../utils.ts";

export type DynamicBrowserFailureMode =
  | "success"
  | "js_render_timeout"
  | "redirect_chain"
  | "unsupported_mime"
  | "robots_legal_hold"
  | "capture_truncation"
  | "blank_page"
  | "parser_empty_extraction"
  | "screenshot_hash_mismatch"
  | "queue_pressure"
  | "private_network_target"
  | "credential_prompt"
  | "captcha_challenge"
  | "download_attempt"
  | "onion_redirect"
  | "third_party_request_leak";

export type DynamicBrowserCutoverDecision = "canary_ready" | "watch" | "hold" | "kill_switch";

export interface DynamicBrowserCutoverInput {
  generatedAt: string;
  approval: {
    explicitlyApproved: boolean;
    approvalId?: string;
    approvedBy?: string;
    expiresAt?: string;
  };
  pool: {
    maxWorkers: number;
    memoryCapMb: number;
    timeoutMs: number;
    maxBytes: number;
    queueMaxDepth: number;
    currentQueueDepth: number;
  };
  policy: {
    robotsAllowed: boolean;
    legalNotesPresent: boolean;
    killSwitchActive: boolean;
    hostAllowlist: string[];
  };
  fixtures: DynamicBrowserFixtureInput[];
}

export interface DynamicBrowserFixtureInput {
  fixtureId: string;
  sourceId: string;
  mode: DynamicBrowserFailureMode;
  requestedUrl: string;
  finalUrl?: string;
  objectRef?: string;
  screenshotHash?: string;
  expectedScreenshotHash?: string;
  contentType?: string;
  renderDurationMs: number;
  redirectCount: number;
  bytesRead: number;
  textLength: number;
  parserConfidence: number;
  isolation?: {
    privateNetworkTarget?: boolean;
    credentialPromptDetected?: boolean;
    captchaDetected?: boolean;
    downloadAttempted?: boolean;
    onionRedirect?: boolean;
    thirdPartyRequestCount?: number;
    blockedThirdPartyRequestCount?: number;
  };
}

export interface DynamicBrowserCutoverPacketDto {
  schemaVersion: "ti.dynamic_browser_cutover.v1";
  generatedAt: string;
  decision: DynamicBrowserCutoverDecision;
  browserWorkersEnabled: false;
  canaryOnly: true;
  requiresExplicitApproval: true;
  workerPool: {
    name: "dynamic_public_browser";
    maxWorkers: number;
    memoryCapMb: number;
    timeoutMs: number;
    maxBytes: number;
    queueMaxDepth: number;
    currentQueueDepth: number;
  };
  networkIsolation: {
    publicOnly: true;
    hostAllowlistHashes: string[];
    blockPrivateNetworks: true;
    blockCredentials: true;
    blockCaptchaSolving: true;
    blockDownloads: true;
    blockOnionLinks: true;
  };
  evidenceBoundary: {
    screenshotStorage: "hash_only";
    objectRefs: "hash_only";
    rawHtmlExposed: false;
    rawTextExposed: false;
    rawUrlExposed: false;
  };
  isolationCanary: {
    featureFlag: "disabled_by_default";
    fixtureReplayOnly: true;
    browserPoolSharedWithStaticCollectors: false;
    privateNetworkTargetsBlocked: true;
    credentialPromptsBlocked: true;
    captchaChallengesBlocked: true;
    downloadsBlocked: true;
    onionRedirectsBlocked: true;
    thirdPartyRequestLeaksBlocked: true;
    storagePolicy: "hashes_only_no_cookie_jar_no_local_storage";
  };
  resourceBudget: {
    processIsolation: "separate_worker_pool_required";
    sharedWithStaticRssPdf: false;
    maxWorkers: number;
    memoryCapMb: number;
    renderTimeoutMs: number;
    maxBytes: number;
    queueMaxDepth: number;
    estimatedWorstCaseMemoryMb: number;
    memoryBudgetStatus: "pass" | "watch" | "hold";
    timeoutBudgetStatus: "pass" | "watch";
    byteBudgetStatus: "pass" | "watch";
  };
  storageIsolation: {
    cookieJarPersisted: false;
    localStoragePersisted: false;
    sessionStoragePersisted: false;
    cachePersisted: false;
    downloadsPersisted: false;
    screenshotBytesPersisted: false;
    rawHtmlPersisted: false;
    objectRefsExposed: false;
    retainedFields: string[];
  };
  killSwitch: {
    active: boolean;
    triggerReasons: string[];
    rollbackAction: "keep_disabled" | "pause_canary_pool";
  };
  fixtures: DynamicBrowserFixtureResultDto[];
  gates: DynamicBrowserGateDto[];
  summary: {
    totalFixtures: number;
    pass: number;
    watch: number;
    hold: number;
    sourceIds: string[];
    warningCodes: string[];
    objectRefHashes: string[];
    screenshotHashes: string[];
    isolationHoldCount: number;
    blockedTargetClasses: string[];
  };
  agentHandoffs: {
    agent01SourceActivation: string[];
    agent02SchedulerBudgets: string[];
    agent04PublicSourceExpansion: string[];
    agent06EvidenceChain: string[];
    agent07QualityGates: string[];
    agent09ApiWarningFields: string[];
    agent10ResourceGates: string[];
  };
  promotionReadiness: {
    state: "ready_for_fixture_canary" | "watch" | "hold" | "kill_switch";
    liveBrowserEnablement: "disabled_requires_separate_operator_allocation";
    staticRssPdfFallbackRequired: true;
    requiredBeforeLiveCanary: string[];
    rollbackTriggers: string[];
    proofCommands: string[];
  };
  routeContract: {
    safeForPublicApi: true;
    stableFields: string[];
    forbiddenFields: string[];
  };
  safety: {
    publicOnly: true;
    dryRunOnly: true;
    noAuthBypass: true;
    noCaptchaSolving: true;
    noPrivateCommunities: true;
    noExploitPayloadDownload: true;
    noRestrictedRawMaterial: true;
    unsafeUrlExposed: false;
  };
}

export interface DynamicBrowserFixtureResultDto {
  schemaVersion: "ti.dynamic_browser_fixture.v1";
  generatedAt: string;
  fixtureId: string;
  sourceId: string;
  mode: DynamicBrowserFailureMode;
  status: "pass" | "watch" | "hold";
  requestedUrlHash: string;
  finalUrlHash?: string;
  objectRefHash?: string;
  screenshotHash?: string;
  failureCode?: DynamicBrowserFailureMode | "approval_missing" | "kill_switch_active";
  provenance: {
    taskId: string;
    requestedUrlHash: string;
    finalUrlHash?: string;
    canonicalUrlHash: string;
    contentHash: string;
    screenshotHash?: string;
    objectRefHash?: string;
    fetchedAt: string;
    robotsAllowed: boolean;
    legalNotesPresent: boolean;
    parserConfidence: number;
    extractionWarnings: string[];
    collectedItemCompatible: true;
  };
  render: {
    durationMs: number;
    timeoutMs: number;
    redirectCount: number;
    contentType?: string;
    bytesRead: number;
    textLength: number;
    parserConfidence: number;
  };
  checks: {
    timeout: boolean;
    redirectChain: boolean;
    unsupportedMime: boolean;
    robotsLegalHold: boolean;
    truncated: boolean;
    blankPage: boolean;
    emptyExtraction: boolean;
    screenshotHashMismatch: boolean;
    queuePressure: boolean;
    privateNetworkTarget: boolean;
    credentialPrompt: boolean;
    captchaChallenge: boolean;
    downloadAttempt: boolean;
    onionRedirect: boolean;
    thirdPartyRequestLeak: boolean;
  };
  handoffs: {
    agent01SourceActivation: "allow_canary_after_approval" | "hold_activation";
    agent02SchedulerBudget: "canary_cadence" | "reduce_cadence" | "pause_pool";
    agent04PublicSourceExpansion: "eligible_dynamic_gap" | "watch_dynamic_gap" | "exclude_until_repaired";
    agent06EvidenceChain: "record_hash_only_capture" | "hold_evidence_replay";
    agent07QualityGate: "pass" | "review" | "hold";
    agent09ApiWarningField: "none" | `dynamic_browser.${Exclude<DynamicBrowserFailureMode, "success">}` | "dynamic_browser.approval_missing" | "dynamic_browser.kill_switch_active";
    agent10ResourceGate: "none" | "watch" | "hold";
  };
}

export interface DynamicBrowserGateDto {
  name:
    | "explicit_approval"
    | "kill_switch"
    | "robots_legal"
    | "memory_cap"
    | "timeout_cap"
    | "byte_cap"
    | "queue_pressure"
    | "screenshot_hash_only"
    | "isolation_hazards_blocked"
    | "browser_pool_isolated"
    | "storage_ephemeral"
    | "fixture_health";
  status: "pass" | "watch" | "hold";
  message: string;
}

export function buildDynamicBrowserCutoverPacket(input: DynamicBrowserCutoverInput): DynamicBrowserCutoverPacketDto {
  const fixtures = input.fixtures.map((fixture) => fixtureResult(input, fixture));
  const gates = buildGates(input, fixtures);
  const decision = decisionFor(gates, input.policy.killSwitchActive);
  const warningCodes = uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent09ApiWarningField).filter((field) => field !== "none"));

  return {
    schemaVersion: "ti.dynamic_browser_cutover.v1",
    generatedAt: input.generatedAt,
    decision,
    browserWorkersEnabled: false,
    canaryOnly: true,
    requiresExplicitApproval: true,
    workerPool: {
      name: "dynamic_public_browser",
      maxWorkers: Math.max(0, input.pool.maxWorkers),
      memoryCapMb: Math.max(0, input.pool.memoryCapMb),
      timeoutMs: Math.max(1000, input.pool.timeoutMs),
      maxBytes: Math.max(0, input.pool.maxBytes),
      queueMaxDepth: Math.max(0, input.pool.queueMaxDepth),
      currentQueueDepth: Math.max(0, input.pool.currentQueueDepth)
    },
    networkIsolation: {
      publicOnly: true,
      hostAllowlistHashes: uniqueSorted(input.policy.hostAllowlist.map((host) => `hosthash:${hashContent(host).slice(0, 16)}`)),
      blockPrivateNetworks: true,
      blockCredentials: true,
      blockCaptchaSolving: true,
      blockDownloads: true,
      blockOnionLinks: true
    },
    evidenceBoundary: {
      screenshotStorage: "hash_only",
      objectRefs: "hash_only",
      rawHtmlExposed: false,
      rawTextExposed: false,
      rawUrlExposed: false
    },
    isolationCanary: {
      featureFlag: "disabled_by_default",
      fixtureReplayOnly: true,
      browserPoolSharedWithStaticCollectors: false,
      privateNetworkTargetsBlocked: true,
      credentialPromptsBlocked: true,
      captchaChallengesBlocked: true,
      downloadsBlocked: true,
      onionRedirectsBlocked: true,
      thirdPartyRequestLeaksBlocked: true,
      storagePolicy: "hashes_only_no_cookie_jar_no_local_storage"
    },
    resourceBudget: {
      processIsolation: "separate_worker_pool_required",
      sharedWithStaticRssPdf: false,
      maxWorkers: Math.max(0, input.pool.maxWorkers),
      memoryCapMb: Math.max(0, input.pool.memoryCapMb),
      renderTimeoutMs: Math.max(1000, input.pool.timeoutMs),
      maxBytes: Math.max(0, input.pool.maxBytes),
      queueMaxDepth: Math.max(0, input.pool.queueMaxDepth),
      estimatedWorstCaseMemoryMb: Math.max(0, input.pool.maxWorkers) * Math.max(0, input.pool.memoryCapMb),
      memoryBudgetStatus: input.pool.memoryCapMb > 2048 || input.pool.maxWorkers * input.pool.memoryCapMb > 4096 ? "hold" : input.pool.memoryCapMb > 1536 ? "watch" : "pass",
      timeoutBudgetStatus: input.pool.timeoutMs > 30_000 ? "watch" : "pass",
      byteBudgetStatus: input.pool.maxBytes > 5_000_000 ? "watch" : "pass"
    },
    storageIsolation: {
      cookieJarPersisted: false,
      localStoragePersisted: false,
      sessionStoragePersisted: false,
      cachePersisted: false,
      downloadsPersisted: false,
      screenshotBytesPersisted: false,
      rawHtmlPersisted: false,
      objectRefsExposed: false,
      retainedFields: ["sourceId", "fixtureId", "taskId", "requestedUrlHash", "finalUrlHash", "canonicalUrlHash", "contentHash", "screenshotHash", "objectRefHash", "fetchedAt", "parserConfidence", "extractionWarnings"]
    },
    killSwitch: {
      active: input.policy.killSwitchActive,
      triggerReasons: gates.filter((gate) => gate.status === "hold").map((gate) => gate.name),
      rollbackAction: input.policy.killSwitchActive ? "pause_canary_pool" : "keep_disabled"
    },
    fixtures,
    gates,
    summary: {
      totalFixtures: fixtures.length,
      pass: fixtures.filter((fixture) => fixture.status === "pass").length,
      watch: fixtures.filter((fixture) => fixture.status === "watch").length,
      hold: fixtures.filter((fixture) => fixture.status === "hold").length,
      sourceIds: uniqueSorted(fixtures.map((fixture) => fixture.sourceId)),
      warningCodes,
      objectRefHashes: uniqueSorted(fixtures.flatMap((fixture) => fixture.objectRefHash ? [fixture.objectRefHash] : [])),
      screenshotHashes: uniqueSorted(fixtures.flatMap((fixture) => fixture.screenshotHash ? [fixture.screenshotHash] : [])),
      isolationHoldCount: fixtures.filter((fixture) => hasIsolationHazard(fixture.checks)).length,
      blockedTargetClasses: uniqueSorted(fixtures.flatMap((fixture) => isolationTargetClasses(fixture.checks)))
    },
    agentHandoffs: {
      agent01SourceActivation: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent01SourceActivation)),
      agent02SchedulerBudgets: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent02SchedulerBudget)),
      agent04PublicSourceExpansion: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent04PublicSourceExpansion)),
      agent06EvidenceChain: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent06EvidenceChain)),
      agent07QualityGates: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent07QualityGate)),
      agent09ApiWarningFields: warningCodes,
      agent10ResourceGates: uniqueSorted(fixtures.map((fixture) => fixture.handoffs.agent10ResourceGate))
    },
    promotionReadiness: promotionReadinessFor(decision, gates, fixtures),
    routeContract: {
      safeForPublicApi: true,
      stableFields: ["schemaVersion", "generatedAt", "decision", "browserWorkersEnabled", "canaryOnly", "requiresExplicitApproval", "workerPool", "networkIsolation", "evidenceBoundary", "isolationCanary", "resourceBudget", "storageIsolation", "killSwitch", "fixtures", "gates", "summary", "agentHandoffs", "promotionReadiness", "routeContract", "safety"],
      forbiddenFields: ["url", "requestedUrl", "finalUrl", "rawUrl", "unsafeUrl", "rawText", "html", "rawHtml", "body", "payload", "credential", "password", "cookie", "cookieJar", "localStorage", "sessionStorage", "token", "privateInvite", "onionUrl", "downloadUrl", "screenshotBytes", "objectRef"]
    },
    safety: {
      publicOnly: true,
      dryRunOnly: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noPrivateCommunities: true,
      noExploitPayloadDownload: true,
      noRestrictedRawMaterial: true,
      unsafeUrlExposed: false
    }
  };
}

function fixtureResult(input: DynamicBrowserCutoverInput, fixture: DynamicBrowserFixtureInput): DynamicBrowserFixtureResultDto {
  const checks = {
    timeout: fixture.mode === "js_render_timeout" || fixture.renderDurationMs > input.pool.timeoutMs,
    redirectChain: fixture.mode === "redirect_chain" || fixture.redirectCount > 5,
    unsupportedMime: fixture.mode === "unsupported_mime" || unsupportedMime(fixture.contentType),
    robotsLegalHold: fixture.mode === "robots_legal_hold" || !input.policy.robotsAllowed || !input.policy.legalNotesPresent,
    truncated: fixture.mode === "capture_truncation" || fixture.bytesRead >= input.pool.maxBytes,
    blankPage: fixture.mode === "blank_page" || fixture.bytesRead === 0,
    emptyExtraction: fixture.mode === "parser_empty_extraction" || fixture.textLength === 0 || fixture.parserConfidence < 0.45,
    screenshotHashMismatch: fixture.mode === "screenshot_hash_mismatch" || Boolean(fixture.expectedScreenshotHash && fixture.screenshotHash && fixture.expectedScreenshotHash !== fixture.screenshotHash),
    queuePressure: fixture.mode === "queue_pressure" || input.pool.currentQueueDepth > input.pool.queueMaxDepth,
    privateNetworkTarget: fixture.mode === "private_network_target" || Boolean(fixture.isolation?.privateNetworkTarget),
    credentialPrompt: fixture.mode === "credential_prompt" || Boolean(fixture.isolation?.credentialPromptDetected),
    captchaChallenge: fixture.mode === "captcha_challenge" || Boolean(fixture.isolation?.captchaDetected),
    downloadAttempt: fixture.mode === "download_attempt" || Boolean(fixture.isolation?.downloadAttempted),
    onionRedirect: fixture.mode === "onion_redirect" || Boolean(fixture.isolation?.onionRedirect),
    thirdPartyRequestLeak: fixture.mode === "third_party_request_leak" || (fixture.isolation?.thirdPartyRequestCount ?? 0) > (fixture.isolation?.blockedThirdPartyRequestCount ?? 0)
  };
  const status = fixtureStatus(checks, input);
  const failureCode = input.policy.killSwitchActive
    ? "kill_switch_active"
    : !input.approval.explicitlyApproved
      ? "approval_missing"
      : fixture.mode === "success" && status === "pass"
        ? undefined
        : fixture.mode === "success"
          ? failureModeForChecks(checks)
          : fixture.mode;

  return {
    schemaVersion: "ti.dynamic_browser_fixture.v1",
    generatedAt: input.generatedAt,
    fixtureId: fixture.fixtureId,
    sourceId: fixture.sourceId,
    mode: fixture.mode,
    status,
    requestedUrlHash: `urlhash:${hashContent(fixture.requestedUrl).slice(0, 16)}`,
    finalUrlHash: fixture.finalUrl ? `urlhash:${hashContent(fixture.finalUrl).slice(0, 16)}` : undefined,
    objectRefHash: fixture.objectRef ? `objectref:${hashContent(fixture.objectRef).slice(0, 16)}` : undefined,
    screenshotHash: fixture.screenshotHash,
    failureCode,
    provenance: {
      taskId: `dynamic_canary_${fixture.fixtureId}`,
      requestedUrlHash: `urlhash:${hashContent(fixture.requestedUrl).slice(0, 16)}`,
      finalUrlHash: fixture.finalUrl ? `urlhash:${hashContent(fixture.finalUrl).slice(0, 16)}` : undefined,
      canonicalUrlHash: `urlhash:${hashContent(fixture.finalUrl ?? fixture.requestedUrl).slice(0, 16)}`,
      contentHash: hashContent(`${fixture.sourceId}:${fixture.fixtureId}:${fixture.bytesRead}:${fixture.textLength}:${fixture.parserConfidence}`),
      screenshotHash: fixture.screenshotHash,
      objectRefHash: fixture.objectRef ? `objectref:${hashContent(fixture.objectRef).slice(0, 16)}` : undefined,
      fetchedAt: input.generatedAt,
      robotsAllowed: input.policy.robotsAllowed,
      legalNotesPresent: input.policy.legalNotesPresent,
      parserConfidence: roundScore(fixture.parserConfidence),
      extractionWarnings: warningListFor(checks),
      collectedItemCompatible: true
    },
    render: {
      durationMs: fixture.renderDurationMs,
      timeoutMs: input.pool.timeoutMs,
      redirectCount: fixture.redirectCount,
      contentType: fixture.contentType,
      bytesRead: fixture.bytesRead,
      textLength: fixture.textLength,
      parserConfidence: roundScore(fixture.parserConfidence)
    },
    checks,
    handoffs: handoffsFor(fixture.mode, status, checks, input)
  };
}

function buildGates(input: DynamicBrowserCutoverInput, fixtures: DynamicBrowserFixtureResultDto[]): DynamicBrowserGateDto[] {
  const queuePressure = input.pool.currentQueueDepth > input.pool.queueMaxDepth;
  const holdFixtureCount = fixtures.filter((fixture) => fixture.status === "hold").length;
  return [
    gate("explicit_approval", input.approval.explicitlyApproved ? "pass" : "hold", input.approval.explicitlyApproved ? "explicit canary approval recorded" : "dynamic browser canary requires explicit approval"),
    gate("kill_switch", input.policy.killSwitchActive ? "hold" : "pass", input.policy.killSwitchActive ? "dynamic browser kill switch is active" : "kill switch is not active"),
    gate("robots_legal", input.policy.robotsAllowed && input.policy.legalNotesPresent ? "pass" : "hold", "robots and legal notes must be current before canary"),
    gate("memory_cap", input.pool.memoryCapMb <= 1536 ? "pass" : "watch", "dynamic browser memory cap should stay bounded per worker pool"),
    gate("timeout_cap", input.pool.timeoutMs <= 30_000 ? "pass" : "watch", "dynamic render timeout should stay within public canary budget"),
    gate("byte_cap", input.pool.maxBytes <= 5_000_000 ? "pass" : "watch", "dynamic captures should use bounded byte caps"),
    gate("queue_pressure", queuePressure ? "hold" : input.pool.currentQueueDepth > input.pool.queueMaxDepth * 0.7 ? "watch" : "pass", "queue depth must not starve static RSS or API collection"),
    gate("screenshot_hash_only", fixtures.every((fixture) => Boolean(fixture.screenshotHash) || fixture.status !== "pass") ? "pass" : "watch", "successful dynamic fixtures should preserve screenshot hashes only"),
    gate("isolation_hazards_blocked", fixtures.some((fixture) => hasIsolationHazard(fixture.checks)) ? "hold" : "pass", "private-network, credential, CAPTCHA, download, onion, and third-party request hazards must remain blocked in replay"),
    gate("browser_pool_isolated", "pass", "dynamic browser canaries require a separate disabled worker pool from static, RSS, and PDF collectors"),
    gate("storage_ephemeral", "pass", "cookies, local storage, session storage, cache, downloads, raw HTML, and screenshot bytes are not persisted"),
    gate("fixture_health", holdFixtureCount > 0 ? "hold" : fixtures.some((fixture) => fixture.status === "watch") ? "watch" : "pass", "fixture failures must be cleared before release promotion")
  ];
}

function gate(name: DynamicBrowserGateDto["name"], status: DynamicBrowserGateDto["status"], message: string): DynamicBrowserGateDto {
  return { name, status, message };
}

function decisionFor(gates: DynamicBrowserGateDto[], killSwitchActive: boolean): DynamicBrowserCutoverDecision {
  if (killSwitchActive) return "kill_switch";
  if (gates.some((gate) => gate.status === "hold")) return "hold";
  if (gates.some((gate) => gate.status === "watch")) return "watch";
  return "canary_ready";
}

function fixtureStatus(checks: DynamicBrowserFixtureResultDto["checks"], input: DynamicBrowserCutoverInput): DynamicBrowserFixtureResultDto["status"] {
  if (input.policy.killSwitchActive || !input.approval.explicitlyApproved) return "hold";
  if (checks.timeout || checks.unsupportedMime || checks.robotsLegalHold || checks.blankPage || checks.emptyExtraction || checks.screenshotHashMismatch || checks.queuePressure || hasIsolationHazard(checks)) return "hold";
  if (checks.redirectChain || checks.truncated) return "watch";
  return "pass";
}

function handoffsFor(
  mode: DynamicBrowserFailureMode,
  status: DynamicBrowserFixtureResultDto["status"],
  checks: DynamicBrowserFixtureResultDto["checks"],
  input: DynamicBrowserCutoverInput
): DynamicBrowserFixtureResultDto["handoffs"] {
  return {
    agent01SourceActivation: status === "pass" ? "allow_canary_after_approval" : "hold_activation",
    agent02SchedulerBudget: checks.queuePressure || checks.timeout || input.policy.killSwitchActive ? "pause_pool" : checks.redirectChain || checks.truncated ? "reduce_cadence" : "canary_cadence",
    agent04PublicSourceExpansion: status === "pass" ? "eligible_dynamic_gap" : status === "watch" ? "watch_dynamic_gap" : "exclude_until_repaired",
    agent06EvidenceChain: status === "pass" || status === "watch" ? "record_hash_only_capture" : "hold_evidence_replay",
    agent07QualityGate: status === "pass" ? "pass" : status === "watch" ? "review" : "hold",
    agent09ApiWarningField: warningCode(mode, checks, input),
    agent10ResourceGate: status === "pass" ? "none" : status === "watch" ? "watch" : "hold"
  };
}

function warningCode(
  mode: DynamicBrowserFailureMode,
  checks: DynamicBrowserFixtureResultDto["checks"],
  input: DynamicBrowserCutoverInput
): DynamicBrowserFixtureResultDto["handoffs"]["agent09ApiWarningField"] {
  if (input.policy.killSwitchActive) return "dynamic_browser.kill_switch_active";
  if (!input.approval.explicitlyApproved) return "dynamic_browser.approval_missing";
  if (mode !== "success") return `dynamic_browser.${mode}`;
  if (checks.timeout) return "dynamic_browser.js_render_timeout";
  if (checks.unsupportedMime) return "dynamic_browser.unsupported_mime";
  if (checks.robotsLegalHold) return "dynamic_browser.robots_legal_hold";
  if (checks.blankPage) return "dynamic_browser.blank_page";
  if (checks.emptyExtraction) return "dynamic_browser.parser_empty_extraction";
  if (checks.screenshotHashMismatch) return "dynamic_browser.screenshot_hash_mismatch";
  if (checks.queuePressure) return "dynamic_browser.queue_pressure";
  if (checks.privateNetworkTarget) return "dynamic_browser.private_network_target";
  if (checks.credentialPrompt) return "dynamic_browser.credential_prompt";
  if (checks.captchaChallenge) return "dynamic_browser.captcha_challenge";
  if (checks.downloadAttempt) return "dynamic_browser.download_attempt";
  if (checks.onionRedirect) return "dynamic_browser.onion_redirect";
  if (checks.thirdPartyRequestLeak) return "dynamic_browser.third_party_request_leak";
  if (checks.redirectChain) return "dynamic_browser.redirect_chain";
  if (checks.truncated) return "dynamic_browser.capture_truncation";
  return "none";
}

function failureModeForChecks(checks: DynamicBrowserFixtureResultDto["checks"]): DynamicBrowserFixtureResultDto["failureCode"] {
  if (checks.timeout) return "js_render_timeout";
  if (checks.unsupportedMime) return "unsupported_mime";
  if (checks.robotsLegalHold) return "robots_legal_hold";
  if (checks.blankPage) return "blank_page";
  if (checks.emptyExtraction) return "parser_empty_extraction";
  if (checks.screenshotHashMismatch) return "screenshot_hash_mismatch";
  if (checks.queuePressure) return "queue_pressure";
  if (checks.privateNetworkTarget) return "private_network_target";
  if (checks.credentialPrompt) return "credential_prompt";
  if (checks.captchaChallenge) return "captcha_challenge";
  if (checks.downloadAttempt) return "download_attempt";
  if (checks.onionRedirect) return "onion_redirect";
  if (checks.thirdPartyRequestLeak) return "third_party_request_leak";
  if (checks.redirectChain) return "redirect_chain";
  if (checks.truncated) return "capture_truncation";
  return undefined;
}

function hasIsolationHazard(checks: DynamicBrowserFixtureResultDto["checks"]): boolean {
  return checks.privateNetworkTarget
    || checks.credentialPrompt
    || checks.captchaChallenge
    || checks.downloadAttempt
    || checks.onionRedirect
    || checks.thirdPartyRequestLeak;
}

function isolationTargetClasses(checks: DynamicBrowserFixtureResultDto["checks"]): string[] {
  return [
    ...(checks.privateNetworkTarget ? ["private_network_target"] : []),
    ...(checks.credentialPrompt ? ["credential_prompt"] : []),
    ...(checks.captchaChallenge ? ["captcha_challenge"] : []),
    ...(checks.downloadAttempt ? ["download_attempt"] : []),
    ...(checks.onionRedirect ? ["onion_redirect"] : []),
    ...(checks.thirdPartyRequestLeak ? ["third_party_request_leak"] : [])
  ];
}

function warningListFor(checks: DynamicBrowserFixtureResultDto["checks"]): string[] {
  return [
    ...(checks.timeout ? ["js_render_timeout"] : []),
    ...(checks.redirectChain ? ["redirect_chain"] : []),
    ...(checks.unsupportedMime ? ["unsupported_mime"] : []),
    ...(checks.robotsLegalHold ? ["robots_legal_hold"] : []),
    ...(checks.truncated ? ["capture_truncation"] : []),
    ...(checks.blankPage ? ["blank_page"] : []),
    ...(checks.emptyExtraction ? ["parser_empty_extraction"] : []),
    ...(checks.screenshotHashMismatch ? ["screenshot_hash_mismatch"] : []),
    ...(checks.queuePressure ? ["queue_pressure"] : []),
    ...isolationTargetClasses(checks)
  ];
}

function promotionReadinessFor(
  decision: DynamicBrowserCutoverDecision,
  gates: DynamicBrowserGateDto[],
  fixtures: DynamicBrowserFixtureResultDto[]
): DynamicBrowserCutoverPacketDto["promotionReadiness"] {
  const holdGates = gates.filter((gate) => gate.status === "hold").map((gate) => gate.name);
  const watchGates = gates.filter((gate) => gate.status === "watch").map((gate) => gate.name);
  return {
    state: decision === "kill_switch" ? "kill_switch" : decision === "hold" ? "hold" : decision === "watch" ? "watch" : "ready_for_fixture_canary",
    liveBrowserEnablement: "disabled_requires_separate_operator_allocation",
    staticRssPdfFallbackRequired: true,
    requiredBeforeLiveCanary: uniqueSorted([
      "explicit_operator_approval",
      "separate_worker_pool_allocation",
      "public_host_allowlist_hash_review",
      "robots_and_legal_notes_current",
      "screenshot_hash_only_storage_verified",
      "ephemeral_storage_verified",
      "no_cookie_jar_no_local_storage_verified",
      "static_rss_pdf_fallback_documented",
      ...holdGates.map((gate) => `clear_hold_gate:${gate}`),
      ...watchGates.map((gate) => `review_watch_gate:${gate}`)
    ]),
    rollbackTriggers: uniqueSorted([
      ...fixtures.flatMap((fixture) => fixture.provenance.extractionWarnings.map((warning) => `fixture_warning:${warning}`)),
      ...holdGates.map((gate) => `hold_gate:${gate}`),
      "browser_workers_enabled_without_release_board",
      "raw_url_or_html_serialized",
      "cookie_or_storage_persistence_detected",
      "screenshot_bytes_persisted",
      "download_or_private_network_attempt"
    ]),
    proofCommands: [
      "bun test src/tests/dynamicBrowserCutover.test.ts",
      "bun test src/tests/adapterRuntimeEnablement.test.ts src/tests/productionAdapterRuntime.test.ts",
      "bun run check",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun run check:api-regression"
    ]
  };
}

function unsupportedMime(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const media = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return !["text/html", "application/xhtml+xml", "text/plain"].includes(media);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
