import { describe, expect, test } from "bun:test";
import { buildDynamicBrowserCutoverPacket, type DynamicBrowserFailureMode, type DynamicBrowserFixtureInput } from "../adapters/dynamicBrowserCutover.ts";
import { hashContent } from "../utils.ts";

const generatedAt = "2026-05-24T18:15:00.000Z";

function fixture(mode: DynamicBrowserFailureMode, index = 0): DynamicBrowserFixtureInput {
  const screenshotHash = `screenshot:${hashContent(`screenshot:${mode}:${index}`).slice(0, 16)}`;
  return {
    fixtureId: `dynamic_${mode}_${index}`,
    sourceId: `src_dynamic_${mode}`,
    mode,
    requestedUrl: `https://dynamic.example.test/${mode}?secret=must-not-leak`,
    finalUrl: mode === "redirect_chain" ? `https://dynamic.example.test/final/${mode}` : undefined,
    objectRef: `s3://ti-dynamic-fixtures/${mode}/capture.html`,
    screenshotHash,
    expectedScreenshotHash: mode === "screenshot_hash_mismatch" ? `screenshot:${hashContent("different").slice(0, 16)}` : screenshotHash,
    contentType: mode === "unsupported_mime" ? "application/zip" : "text/html",
    renderDurationMs: mode === "js_render_timeout" ? 35_000 : 1400,
    redirectCount: mode === "redirect_chain" ? 7 : 1,
    bytesRead: mode === "capture_truncation" ? 5_000_000 : mode === "blank_page" ? 0 : 120_000,
    textLength: mode === "parser_empty_extraction" || mode === "blank_page" ? 0 : 2400,
    parserConfidence: mode === "parser_empty_extraction" ? 0.2 : 0.82
  };
}

function baseInput(overrides: Partial<Parameters<typeof buildDynamicBrowserCutoverPacket>[0]> = {}): Parameters<typeof buildDynamicBrowserCutoverPacket>[0] {
  return {
    generatedAt,
    approval: {
      explicitlyApproved: true,
      approvalId: "approval_dynamic_canary_1",
      approvedBy: "operator",
      expiresAt: "2026-06-24T00:00:00.000Z"
    },
    pool: {
      maxWorkers: 2,
      memoryCapMb: 1024,
      timeoutMs: 30_000,
      maxBytes: 5_000_000,
      queueMaxDepth: 20,
      currentQueueDepth: 3
    },
    policy: {
      robotsAllowed: true,
      legalNotesPresent: true,
      killSwitchActive: false,
      hostAllowlist: ["dynamic.example.test", "reports.example.test"]
    },
    fixtures: [fixture("success")],
    ...overrides
  };
}

describe("dynamic browser cutover", () => {
  test("keeps browser disabled by default while certifying an explicitly approved canary plan", () => {
    const packet = buildDynamicBrowserCutoverPacket(baseInput());

    expect(packet).toMatchObject({
      schemaVersion: "ti.dynamic_browser_cutover.v1",
      decision: "canary_ready",
      browserWorkersEnabled: false,
      canaryOnly: true,
      requiresExplicitApproval: true,
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
      networkIsolation: {
        publicOnly: true,
        blockPrivateNetworks: true,
        blockCredentials: true,
        blockCaptchaSolving: true,
        blockDownloads: true,
        blockOnionLinks: true
      },
      resourceBudget: {
        processIsolation: "separate_worker_pool_required",
        sharedWithStaticRssPdf: false,
        estimatedWorstCaseMemoryMb: 2048,
        memoryBudgetStatus: "pass",
        timeoutBudgetStatus: "pass",
        byteBudgetStatus: "pass"
      },
      storageIsolation: {
        cookieJarPersisted: false,
        localStoragePersisted: false,
        sessionStoragePersisted: false,
        cachePersisted: false,
        downloadsPersisted: false,
        screenshotBytesPersisted: false,
        rawHtmlPersisted: false,
        objectRefsExposed: false
      },
      promotionReadiness: {
        state: "ready_for_fixture_canary",
        liveBrowserEnablement: "disabled_requires_separate_operator_allocation",
        staticRssPdfFallbackRequired: true
      }
    });
    expect(packet.fixtures[0]).toMatchObject({
      status: "pass",
      failureCode: undefined,
      requestedUrlHash: expect.stringMatching(/^urlhash:/),
      objectRefHash: expect.stringMatching(/^objectref:/),
      provenance: {
        taskId: "dynamic_canary_dynamic_success_0",
        requestedUrlHash: expect.stringMatching(/^urlhash:/),
        canonicalUrlHash: expect.stringMatching(/^urlhash:/),
        contentHash: expect.any(String),
        fetchedAt: generatedAt,
        robotsAllowed: true,
        legalNotesPresent: true,
        parserConfidence: 0.82,
        extractionWarnings: [],
        collectedItemCompatible: true
      },
      handoffs: {
        agent01SourceActivation: "allow_canary_after_approval",
        agent02SchedulerBudget: "canary_cadence",
        agent06EvidenceChain: "record_hash_only_capture",
        agent09ApiWarningField: "none",
        agent10ResourceGate: "none"
      }
    });
    expect(packet.gates.every((gate) => gate.status === "pass")).toBe(true);
    expect(packet.gates.map((gate) => gate.name)).toEqual(expect.arrayContaining(["browser_pool_isolated", "storage_ephemeral"]));
    expect(packet.promotionReadiness.requiredBeforeLiveCanary).toEqual(expect.arrayContaining([
      "separate_worker_pool_allocation",
      "ephemeral_storage_verified",
      "no_cookie_jar_no_local_storage_verified",
      "static_rss_pdf_fallback_documented"
    ]));

    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("s3://");
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain(".onion");
    expect(packet.routeContract.stableFields).toEqual(expect.arrayContaining(["resourceBudget", "storageIsolation", "promotionReadiness"]));
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["requestedUrl", "finalUrl", "rawText", "html", "screenshotBytes", "objectRef", "cookieJar", "localStorage"]));
  });

  test("maps all dynamic browser failure modes to gates, warning fields, and agent handoffs", () => {
    const modes: DynamicBrowserFailureMode[] = [
      "js_render_timeout",
      "redirect_chain",
      "unsupported_mime",
      "robots_legal_hold",
      "capture_truncation",
      "blank_page",
      "parser_empty_extraction",
      "screenshot_hash_mismatch",
      "queue_pressure",
      "private_network_target",
      "credential_prompt",
      "captcha_challenge",
      "download_attempt",
      "onion_redirect",
      "third_party_request_leak"
    ];
    const packet = buildDynamicBrowserCutoverPacket(baseInput({
      pool: {
        maxWorkers: 2,
        memoryCapMb: 1024,
        timeoutMs: 30_000,
        maxBytes: 5_000_000,
        queueMaxDepth: 20,
        currentQueueDepth: 21
      },
      fixtures: modes.map((mode, index) => fixture(mode, index))
    }));

    expect(packet.decision).toBe("hold");
    expect(packet.summary.warningCodes).toEqual(expect.arrayContaining([
      "dynamic_browser.js_render_timeout",
      "dynamic_browser.redirect_chain",
      "dynamic_browser.unsupported_mime",
      "dynamic_browser.robots_legal_hold",
      "dynamic_browser.capture_truncation",
      "dynamic_browser.blank_page",
      "dynamic_browser.parser_empty_extraction",
      "dynamic_browser.screenshot_hash_mismatch",
      "dynamic_browser.queue_pressure",
      "dynamic_browser.private_network_target",
      "dynamic_browser.credential_prompt",
      "dynamic_browser.captcha_challenge",
      "dynamic_browser.download_attempt",
      "dynamic_browser.onion_redirect",
      "dynamic_browser.third_party_request_leak"
    ]));
    expect(packet.summary.hold).toBeGreaterThan(0);
    expect(packet.fixtures.find((item) => item.mode === "redirect_chain")?.status).toBe("hold");
    expect(packet.fixtures.find((item) => item.mode === "capture_truncation")?.checks.truncated).toBe(true);
    expect(packet.fixtures.find((item) => item.mode === "screenshot_hash_mismatch")?.handoffs.agent06EvidenceChain).toBe("hold_evidence_replay");
    expect(packet.agentHandoffs.agent02SchedulerBudgets).toContain("pause_pool");
    expect(packet.agentHandoffs.agent04PublicSourceExpansion).toContain("exclude_until_repaired");
    expect(packet.agentHandoffs.agent07QualityGates).toContain("hold");
    expect(packet.agentHandoffs.agent10ResourceGates).toContain("hold");
    expect(packet.gates.find((gate) => gate.name === "queue_pressure")?.status).toBe("hold");
    expect(packet.gates.find((gate) => gate.name === "isolation_hazards_blocked")?.status).toBe("hold");
    expect(packet.summary.isolationHoldCount).toBe(6);
    expect(packet.summary.blockedTargetClasses).toEqual([
      "captcha_challenge",
      "credential_prompt",
      "download_attempt",
      "onion_redirect",
      "private_network_target",
      "third_party_request_leak"
    ]);
    expect(packet.promotionReadiness).toMatchObject({
      state: "hold",
      liveBrowserEnablement: "disabled_requires_separate_operator_allocation"
    });
    expect(packet.promotionReadiness.requiredBeforeLiveCanary).toEqual(expect.arrayContaining(["clear_hold_gate:isolation_hazards_blocked"]));
    expect(packet.promotionReadiness.rollbackTriggers).toEqual(expect.arrayContaining(["fixture_warning:private_network_target", "fixture_warning:third_party_request_leak", "download_or_private_network_attempt"]));
  });

  test("blocks isolation hazards even when fixture mode is otherwise successful", () => {
    const packet = buildDynamicBrowserCutoverPacket(baseInput({
      fixtures: [{
        ...fixture("success"),
        fixtureId: "dynamic_success_with_isolation_leak",
        isolation: {
          privateNetworkTarget: true,
          credentialPromptDetected: true,
          captchaDetected: true,
          downloadAttempted: true,
          onionRedirect: true,
          thirdPartyRequestCount: 3,
          blockedThirdPartyRequestCount: 2
        }
      }]
    }));

    expect(packet.decision).toBe("hold");
    expect(packet.summary).toMatchObject({
      isolationHoldCount: 1,
      blockedTargetClasses: [
        "captcha_challenge",
        "credential_prompt",
        "download_attempt",
        "onion_redirect",
        "private_network_target",
        "third_party_request_leak"
      ]
    });
    expect(packet.fixtures[0]).toMatchObject({
      status: "hold",
      failureCode: "private_network_target",
      provenance: {
        extractionWarnings: expect.arrayContaining(["private_network_target", "credential_prompt", "captcha_challenge", "download_attempt", "onion_redirect", "third_party_request_leak"]),
        collectedItemCompatible: true
      },
      checks: {
        privateNetworkTarget: true,
        credentialPrompt: true,
        captchaChallenge: true,
        downloadAttempt: true,
        onionRedirect: true,
        thirdPartyRequestLeak: true
      },
      handoffs: {
        agent01SourceActivation: "hold_activation",
        agent06EvidenceChain: "hold_evidence_replay",
        agent07QualityGate: "hold",
        agent09ApiWarningField: "dynamic_browser.private_network_target",
        agent10ResourceGate: "hold"
      }
    });

    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("https://dynamic.example.test");
    expect(serialized).not.toContain("s3://ti-dynamic-fixtures");
    expect(serialized).not.toContain("must-not-leak");
    expect(packet.routeContract.forbiddenFields).toContain("screenshotBytes");
    expect(packet.routeContract.forbiddenFields).toContain("downloadUrl");
  });

  test("keeps resource-heavy browser canaries in watch without enabling live workers", () => {
    const packet = buildDynamicBrowserCutoverPacket(baseInput({
      pool: {
        maxWorkers: 3,
        memoryCapMb: 1800,
        timeoutMs: 45_000,
        maxBytes: 7_000_000,
        queueMaxDepth: 20,
        currentQueueDepth: 4
      },
      fixtures: [fixture("success")]
    }));

    expect(packet.browserWorkersEnabled).toBe(false);
    expect(packet.decision).toBe("watch");
    expect(packet.resourceBudget).toMatchObject({
      processIsolation: "separate_worker_pool_required",
      sharedWithStaticRssPdf: false,
      estimatedWorstCaseMemoryMb: 5400,
      memoryBudgetStatus: "hold",
      timeoutBudgetStatus: "watch",
      byteBudgetStatus: "watch"
    });
    expect(packet.gates.find((gate) => gate.name === "memory_cap")?.status).toBe("watch");
    expect(packet.gates.find((gate) => gate.name === "timeout_cap")?.status).toBe("watch");
    expect(packet.gates.find((gate) => gate.name === "byte_cap")?.status).toBe("watch");
    expect(packet.promotionReadiness).toMatchObject({
      state: "watch",
      liveBrowserEnablement: "disabled_requires_separate_operator_allocation",
      staticRssPdfFallbackRequired: true
    });
    expect(packet.promotionReadiness.requiredBeforeLiveCanary).toEqual(expect.arrayContaining([
      "review_watch_gate:memory_cap",
      "review_watch_gate:timeout_cap",
      "review_watch_gate:byte_cap"
    ]));
  });

  test("holds cutover when approval is missing or kill switch is active", () => {
    const missingApproval = buildDynamicBrowserCutoverPacket(baseInput({
      approval: { explicitlyApproved: false },
      fixtures: [fixture("success")]
    }));
    expect(missingApproval).toMatchObject({
      decision: "hold",
      fixtures: [{
        status: "hold",
        failureCode: "approval_missing",
        handoffs: {
          agent01SourceActivation: "hold_activation",
          agent09ApiWarningField: "dynamic_browser.approval_missing",
          agent10ResourceGate: "hold"
        }
      }]
    });
    expect(missingApproval.gates.find((gate) => gate.name === "explicit_approval")?.status).toBe("hold");

    const killSwitch = buildDynamicBrowserCutoverPacket(baseInput({
      policy: {
        robotsAllowed: true,
        legalNotesPresent: true,
        killSwitchActive: true,
        hostAllowlist: ["dynamic.example.test"]
      },
      fixtures: [fixture("success")]
    }));
    expect(killSwitch.decision).toBe("kill_switch");
    expect(killSwitch.killSwitch).toMatchObject({
      active: true,
      rollbackAction: "pause_canary_pool"
    });
    expect(killSwitch.fixtures[0]).toMatchObject({
      status: "hold",
      failureCode: "kill_switch_active",
      handoffs: {
        agent02SchedulerBudget: "pause_pool",
        agent09ApiWarningField: "dynamic_browser.kill_switch_active"
      }
    });
  });
});
