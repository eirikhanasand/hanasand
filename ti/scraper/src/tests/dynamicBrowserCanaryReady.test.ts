import { describe, expect, test } from "bun:test";
import { buildDynamicBrowserCutoverPacket } from "../adapters/dynamicBrowserCutover.ts";
import { baseInput, generatedAt } from "./helpers/dynamicBrowserCutoverFixtures.ts";

describe("dynamic browser canary readiness", () => {
  test("keeps browser disabled while certifying an approved canary plan", () => {
    const packet = buildDynamicBrowserCutoverPacket(baseInput());

    expect(packet).toMatchObject({
      decision: "canary_ready",
      browserWorkersEnabled: false,
      canaryOnly: true,
      requiresExplicitApproval: true,
      evidenceBoundary: { screenshotStorage: "hash_only", objectRefs: "hash_only", rawHtmlExposed: false, rawTextExposed: false, rawUrlExposed: false },
      networkIsolation: { publicOnly: true, blockPrivateNetworks: true, blockCredentials: true, blockCaptchaSolving: true, blockDownloads: true, blockOnionLinks: true },
      storageIsolation: { cookieJarPersisted: false, localStoragePersisted: false, sessionStoragePersisted: false, cachePersisted: false, downloadsPersisted: false, screenshotBytesPersisted: false, rawHtmlPersisted: false, objectRefsExposed: false },
      promotionReadiness: { state: "ready_for_fixture_canary", liveBrowserEnablement: "disabled_requires_separate_operator_allocation", staticRssPdfFallbackRequired: true }
    });
    expect(packet.fixtures[0]).toMatchObject({
      status: "pass",
      requestedUrlHash: expect.stringMatching(/^urlhash:/),
      objectRefHash: expect.stringMatching(/^objectref:/),
      provenance: { taskId: "dynamic_canary_dynamic_success_0", fetchedAt: generatedAt, parserConfidence: 0.82, extractionWarnings: [], collectedItemCompatible: true },
      handoffs: { agent01SourceActivation: "allow_canary_after_approval", agent02SchedulerBudget: "canary_cadence", agent06EvidenceChain: "record_hash_only_capture", agent09ApiWarningField: "none", agent10ResourceGate: "none" }
    });
    expect(packet.gates.every((gate) => gate.status === "pass")).toBe(true);
    expect(packet.gates.map((gate) => gate.name)).toEqual(expect.arrayContaining(["browser_pool_isolated", "storage_ephemeral"]));
    expect(packet.promotionReadiness.requiredBeforeLiveCanary).toEqual(expect.arrayContaining(["separate_worker_pool_allocation", "ephemeral_storage_verified", "no_cookie_jar_no_local_storage_verified", "static_rss_pdf_fallback_documented"]));
    expect(JSON.stringify(packet)).not.toContain("https://");
    expect(JSON.stringify(packet)).not.toContain("s3://");
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["requestedUrl", "finalUrl", "rawText", "html", "screenshotBytes", "objectRef", "cookieJar", "localStorage"]));
  });
});
