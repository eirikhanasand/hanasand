import { describe, expect, test } from "bun:test";
import {
  buildLeakSiteMetadata,
  buildRestrictedMetadataCompliancePacket,
  buildRestrictedMetadataApplyPlan,
  buildRestrictedMetadataAuditReport,
  buildRestrictedMetadataCutoverReport,
  buildRestrictedMetadataOperationsReadiness,
  buildRestrictedMetadataOperationsStatus,
  createDarknetMetadataCollectionPlan,
  createDarknetMetadataSourceSeed,
  DARKNET_METADATA_NETWORK_CONFIGS,
  DarknetMetadataAdapter,
  darknetMetadataResultFromCapture,
  evaluateDarknetMetadataPolicy,
  isSensitivePayloadTarget,
  isUnsafeInteractionTarget,
  planDarknetMetadataLiveSearch,
  restrictedMetadataApprovalBridge,
  restrictedMetadataApprovalBridgeFromDecision,
  restrictedMetadataApplyPlanApiContract,
  restrictedMetadataClaimRiskLabels,
  restrictedMetadataComplianceReport,
  restrictedMetadataComplianceSummaryForPromotion,
  restrictedMetadataComplianceSummaryForSearch,
  restrictedMetadataConnectorCertificationContract,
  restrictedMetadataConnectorFixtures,
  restrictedMetadataEmergencyStopCertificationContract,
  restrictedMetadataEvidenceDeltasFromCapture,
  restrictedMetadataEvidenceHandoffSafetyProof,
  restrictedMetadataEvidenceHandoffFromCapture,
  restrictedMetadataIntelSearchPartialSemantics,
  restrictedMetadataKillSwitchDrillContract,
  restrictedMetadataNonBlockingSearchContract,
  restrictedMetadataPolicyDelta,
  restrictedMetadataProductionAuditEvents,
  restrictedMetadataProductionBoundaryContracts,
  restrictedMetadataRedactionDtoFromCapture,
  restrictedMetadataRetentionExpiryDelta,
  restrictedMetadataRuntimeIsolationContract,
  restrictedMetadataSourcePackEntryToSource,
  validateRestrictedMetadataSourcePack,
  type ApprovedProxyBoundary,
  type DarknetMetadataSourceType,
  type DarknetNetwork,
  type RestrictedMetadataSourcePack
} from "../adapters/darknetMetadata.ts";
import { evaluateSourceForCollection } from "../policy/collectionPolicy.ts";
import { InMemorySourceRegistry } from "../registry/sourceRegistry.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { CollectionTask, RawCapture, SourceRecord, SourceReviewDecision } from "../types.ts";

const NON_BLOCKING_SEARCH_SCENARIOS: RestrictedMetadataNonBlockingSearchScenario[] = [
  "approved_metadata_canary",
  "no_approval",
  "expired_approval",
  "kill_switch",
  "proxy_failure",
  "timeout",
  "unsafe_target",
  "low_yield_source",
  "retention_expiry",
  "legal_hold",
  "redaction_repair",
  "actor_query",
  "ransomware_query",
  "victim_query",
  "cve_query",
  "country_query",
  "sector_query",
  "public_api_blocked_state"
] as const;

function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_darknet",
    tenantId: input.tenantId,
    name: input.name ?? "Approved leak metadata source",
    type: input.type ?? "tor_metadata",
    url: input.url ?? "http://exampleonion.onion/post/claim",
    accessMethod: input.accessMethod ?? "approved_proxy",
    status: input.status ?? "active",
    risk: input.risk ?? "high",
    trustScore: input.trustScore ?? 0.7,
    language: input.language,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Approved metadata-only collection fixture.",
    createdAt: input.createdAt ?? new Date(0).toISOString(),
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
    lastSeenAt: input.lastSeenAt,
    approvalRequired: input.approvalRequired ?? true,
    approvedAt: input.approvedAt ?? new Date(0).toISOString(),
    approvedBy: input.approvedBy ?? "operator",
    tags: input.tags,
    metadata: input.metadata,
    governance: input.governance ?? {
      approvalState: "approved",
      approvalRequired: true,
      metadataOnly: true,
      approvedAt: input.approvedAt ?? new Date(0).toISOString(),
      approvedBy: input.approvedBy ?? "operator",
      policyVersion: "collection-policy:v1"
    }
  };
}

function task(input: Partial<CollectionTask> = {}): CollectionTask {
  return {
    id: input.id ?? "task_darknet",
    sourceId: input.sourceId ?? "src_darknet",
    targetUrl: input.targetUrl ?? "http://exampleonion.onion/post/claim",
    sourceType: input.sourceType ?? "tor_metadata",
    queuedAt: input.queuedAt ?? new Date(0).toISOString(),
    priority: input.priority ?? 0.8,
    reason: input.reason ?? "fixture",
    retryCount: input.retryCount ?? 0,
    maxBytes: input.maxBytes
  };
}

const boundary: ApprovedProxyBoundary = {
  id: "tor-proxy-fixture",
  network: "tor",
  accessMethod: "approved_proxy",
  async fetchMetadata() {
    return {
      title: "Claim metadata",
      safeText: "actor: ExampleCrew\nvictim: Example Corp\ndate: 2026-05-01\nsector: Manufacturing\ncountry: NO\ndata type: contracts",
      sourceTimestamp: "2026-05-01T00:00:00.000Z",
      screenshotHash: "screenhash"
    };
  }
};

function boundaryFor(network: DarknetNetwork): ApprovedProxyBoundary {
  return {
    id: `${network}-proxy-fixture`,
    network,
    accessMethod: "approved_proxy",
    config: { ...DARKNET_METADATA_NETWORK_CONFIGS[network], proxyBoundaryId: `${network}-proxy-fixture` },
    async fetchMetadata() {
      return { safeText: "actor: FixtureCrew\nvictim: Fixture Corp" };
    }
  };
}

function darknetCapture(input: {
  id?: string;
  sourceId?: string;
  actor?: string;
  victim?: string;
  postStatus?: "new" | "updated" | "removed" | "unknown";
  confidence?: number;
  collectedAt?: string;
  sourceTimestamp?: string;
  urlHash?: string;
  policyAuditId?: string;
  query?: string;
  runId?: string;
} = {}): RawCapture {
  return {
    id: input.id ?? "cap_restricted",
    tenantId: "tenant_darknet",
    sourceId: input.sourceId ?? "src_darknet",
    url: "http://claims.onion/post/metadata-only",
    collectedAt: input.collectedAt ?? "2026-05-24T00:00:00.000Z",
    publishedAt: input.sourceTimestamp,
    contentHash: "hash_restricted",
    mediaType: "text/plain",
    storageKind: "metadata_only",
    retentionClass: "restricted_metadata",
    metadata: {
      adapter: "darknet_metadata",
      query: input.query,
      normalizedQuery: input.query?.toLowerCase(),
      runId: input.runId,
      leakSite: {
        actorName: input.actor ?? "Akira",
        victimName: input.victim ?? "Fjord Energy AS",
        claimDate: "2026-05-20",
        claimedSector: "Energy",
        claimedCountry: "NO",
        claimedDataCategory: "contracts",
        postStatus: input.postStatus ?? "new",
        confidence: input.confidence ?? 0.76,
        sourceTimestamp: input.sourceTimestamp ?? "2026-05-20T00:00:00.000Z",
        urlHash: input.urlHash ?? "urlhash_restricted",
        screenshotHash: "screenhash_restricted"
      },
      policyDecision: { id: input.policyAuditId ?? "policy_restricted" }
    },
    sensitive: true
  };
}

describe("darknet metadata adapter", () => {
  test("requires operator approval for high-risk metadata sources", () => {
    const decision = evaluateSourceForCollection(source({
      approvedAt: "",
      approvedBy: "",
      governance: {
        approvalState: "pending",
        approvalRequired: true,
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      }
    }));

    expect(decision.allowed).toBe(false);
    expect(decision.metadataOnly).toBe(true);
    expect(decision.reason).toContain("approval");
  });

  test("blocks sensitive payload download targets before proxy fetch", async () => {
    let called = false;
    const adapter = new DarknetMetadataAdapter("tor_metadata", {
      ...boundary,
      async fetchMetadata() {
        called = true;
        return {};
      }
    });

    const result = await adapter.collect(source(), task({ targetUrl: "http://exampleonion.onion/download/victim.zip" }));

    expect(called).toBe(false);
    expect(result.items).toHaveLength(0);
    expect(result.warnings[0]).toContain("sensitive payload download");
  });

  test("stores only leak-site metadata and hashes", async () => {
    const adapter = new DarknetMetadataAdapter("tor_metadata", boundary);
    const result = await adapter.collect(source(), task());

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sensitive).toBe(true);
    expect(result.items[0]?.html).toBeUndefined();
    expect(result.items[0]?.metadata.leakSite).toMatchObject({
      actorName: "ExampleCrew",
      victimName: "Example Corp",
      claimedSector: "Manufacturing",
      claimedCountry: "NO",
      claimedDataType: "contracts",
      claimedDataCategory: "contracts",
      postStatus: "unknown",
      screenshotHash: "screenhash"
    });
    expect(result.items[0]?.metadata.policyDecision).toMatchObject({
      allowed: true,
      reason: "allowed_metadata_only",
      sourceId: "src_darknet",
      proxyBoundaryId: "tor-proxy-fixture",
      metadataOnly: true
    });
    expect(result.items[0]?.metadata.connectorAttribution).toMatchObject({
      boundaryId: "tor-proxy-fixture",
      network: "tor",
      proxyType: "tor_socks",
      timeoutClass: "metadata_standard"
    });
    expect(result.items[0]?.metadata.urlHash).toBeTruthy();
    expect(result.warnings[0]).toContain("metadata only");
  });

  test("classifies download-like URLs as blocked targets", () => {
    expect(isSensitivePayloadTarget("http://site.onion/files/customer-dump.7z")).toBe(true);
    expect(isSensitivePayloadTarget("http://site.onion/post/metadata")).toBe(false);
  });

  test("classifies interaction affordance URLs as blocked targets", () => {
    for (const url of [
      "http://site.onion/login",
      "http://site.onion/contact/operator",
      "http://site.onion/payment/wallet",
      "http://site.onion/comments/reply",
      "http://site.onion/upload",
      "http://site.onion/search?q=victim"
    ]) {
      expect(isUnsafeInteractionTarget(url)).toBe(true);
    }
    expect(isUnsafeInteractionTarget("http://site.onion/post/claim")).toBe(false);
  });

  test("has network-specific safe proxy boundary defaults", () => {
    expect(DARKNET_METADATA_NETWORK_CONFIGS.tor).toMatchObject({
      network: "tor",
      maxConcurrency: 2,
      screenshotHashMode: "hash_only"
    });
    expect(DARKNET_METADATA_NETWORK_CONFIGS.i2p).toMatchObject({
      network: "i2p",
      maxConcurrency: 1,
      screenshotHashMode: "hash_only"
    });
    expect(DARKNET_METADATA_NETWORK_CONFIGS.freenet).toMatchObject({
      network: "freenet",
      maxConcurrency: 1,
      screenshotHashMode: "disabled"
    });
  });

  test("records blocked policy decisions without calling the proxy", () => {
    const decision = evaluateDarknetMetadataPolicy(
      source(),
      "http://user:pass@exampleonion.onion/post/claim",
      boundary
    );

    expect(decision).toMatchObject({
      allowed: false,
      reason: "credential_url_blocked",
      metadataOnly: true,
      sourceId: "src_darknet",
      proxyBoundaryId: "tor-proxy-fixture"
    });
    expect(decision.urlHash).toBeTruthy();
    expect(decision.blockedOperations).toContain("credential_bypass");
  });

  test("blocks forms authentication payment contact and upload affordances in policy", () => {
    const cases = [
      "http://exampleonion.onion/login",
      "http://exampleonion.onion/auth/prompt",
      "http://exampleonion.onion/payment",
      "http://exampleonion.onion/contact",
      "http://exampleonion.onion/form/submit",
      "http://exampleonion.onion/upload",
      "http://exampleonion.onion/search?q=ExampleCorp"
    ];

    for (const url of cases) {
      const decision = evaluateDarknetMetadataPolicy(source(), url, boundary);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("interaction_affordance_blocked");
    }
  });

  test("blocks archive database document and media download URLs across darknet networks", () => {
    const cases: Array<{ type: DarknetMetadataSourceType; network: DarknetNetwork; url: string }> = [
      { type: "tor_metadata", network: "tor", url: "http://victimabc.onion/archive/customer-data.zip" },
      { type: "tor_metadata", network: "tor", url: "http://victimabc.onion/media/proof-video.mp4" },
      { type: "i2p_metadata", network: "i2p", url: "http://claim.i2p/database/export.sql" },
      { type: "i2p_metadata", network: "i2p", url: "http://claim.i2p/files/contracts.pdf" },
      { type: "freenet_metadata", network: "freenet", url: "freenet:CHK@abcdef/customer-list.xlsx" },
      { type: "freenet_metadata", network: "freenet", url: "freenet:CHK@abcdef/screenshots/proof.png" }
    ];

    for (const item of cases) {
      const decision = evaluateDarknetMetadataPolicy(
        source({ type: item.type, url: item.url }),
        item.url,
        boundaryFor(item.network)
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("sensitive_payload_target_blocked");
    }
  });

  test("parses metadata-only leak claim fixtures", () => {
    const fixtures = [
      {
        safeText: "actor: NightCrew\nvictim: Fjord Systems AS\naccounts compromised: 124\naccount subjects: employees and contractors\ndataset size: 18 GB\nactor statement: published payroll and contract index only\ndate: 2026-05-02\nsector: Energy\ncountry: NO\ndata category: contracts and invoices\nstatus: updated\nconfidence: 0.82",
        expected: { actorName: "NightCrew", victimName: "Fjord Systems AS", affectedAccounts: "124", accountSubjects: "employees and contractors", datasetSize: "18 GB", actorStatement: "published payroll and contract index only", claimDate: "2026-05-02", claimedSector: "Energy", claimedCountry: "NO", claimedDataCategory: "contracts and invoices", postStatus: "updated", confidence: 0.82 }
      },
      {
        safeText: "Actor: ArchiveFox | Victim: Example Hospital | Date: 2026-05-03 | Sector: Healthcare | Country: US | Data Type: patient admin metadata | Status: new",
        expected: { actorName: "ArchiveFox", victimName: "Example Hospital", claimDate: "2026-05-03", claimedSector: "Healthcare", claimedCountry: "US", claimedDataType: "patient admin metadata", postStatus: "new" }
      }
    ];

    for (const fixture of fixtures) {
      expect(buildLeakSiteMetadata("http://fixture.onion/post", { safeText: fixture.safeText })).toMatchObject(fixture.expected);
    }
  });

  test("supports screenshot hash contracts without storing screenshot bytes", () => {
    expect(buildLeakSiteMetadata("http://fixture.onion/post", {
      safeText: "actor: HashOnly",
      screenshotHashMode: "hash_only",
      screenshotHash: "sha256-screen"
    })).toMatchObject({ screenshotHash: "sha256-screen" });

    expect(buildLeakSiteMetadata("freenet:CHK@fixture", {
      safeText: "actor: NoShot",
      screenshotHashMode: "disabled",
      screenshotHash: "should-not-store"
    }).screenshotHash).toBeUndefined();
  });

  test("creates disabled-by-default darknet metadata source seeds", () => {
    const seed = createDarknetMetadataSourceSeed({
      name: "Pending onion source",
      type: "tor_metadata",
      url: "http://pending.onion"
    });

    expect(seed).toMatchObject({
      accessMethod: "disabled",
      status: "needs_review",
      risk: "high",
      approvalRequired: true,
      governance: {
        approvalState: "pending",
        metadataOnly: true
      }
    });
  });

  test("plans metadata-only tasks for approved darknet sources and rejects unsafe ones", () => {
    const approvedTor = source({
      id: "tor_ok",
      type: "tor_metadata",
      url: "http://claims.onion/actor/{query}",
      trustScore: 0.8
    });
    const unsafeI2p = source({
      id: "i2p_bad",
      type: "i2p_metadata",
      url: "http://claims.i2p/download/{query}.zip"
    });
    const pendingFreenet = createDarknetMetadataSourceSeed({
      id: "freenet_pending",
      name: "Pending Freenet",
      type: "freenet_metadata",
      url: "freenet:CHK@pending"
    });

    const plan = createDarknetMetadataCollectionPlan({
      request: {
        id: "intel_darknet",
        query: "Akira",
        entityType: "actor",
        includeDarknetMetadata: true,
        tenantId: "tenant_a",
        requesterId: "analyst_1"
      },
      sources: [approvedTor, unsafeI2p, pendingFreenet],
      proxyBoundaries: {
        tor: boundaryFor("tor"),
        i2p: boundaryFor("i2p"),
        freenet: boundaryFor("freenet")
      },
      createdAt: "2026-05-24T00:00:00.000Z"
    });

    expect(plan.tasks).toHaveLength(1);
    expect(plan.reviewRequired).toHaveLength(1);
    expect(plan.tasks[0]).toMatchObject({
      sourceId: "tor_ok",
      sourceType: "tor_metadata",
      targetUrl: "http://claims.onion/actor/Akira",
      reason: expect.stringContaining("metadata-only")
    });
    expect(plan.reviewRequired[0]).toMatchObject({
      sourceId: "freenet_pending",
      reason: expect.stringContaining("safe fields are actor, victim/company, affected accounts, dataset size, actor statement")
    });
    expect(plan.rejected).toEqual(expect.arrayContaining([
      { sourceId: "i2p_bad", reason: "sensitive payload download targets are blocked" }
    ]));
    expect(plan.rejected.some((item) => item.sourceId === "freenet_pending")).toBe(false);
    expect(plan.audit[0]).toMatchObject({
      action: "darknet_metadata.plan.created",
      metadata: { metadataOnly: true }
    });
  });

  test("returns live-search states for partial metadata, approval, queue, disabled, and blocked", () => {
    const approvedTor = source({
      id: "tor_ok",
      type: "tor_metadata",
      url: "http://claims.onion/actor/{query}",
      trustScore: 0.8
    });
    const pending = createDarknetMetadataSourceSeed({
      id: "tor_pending",
      name: "Pending onion",
      type: "tor_metadata",
      url: "http://pending.onion"
    });
    const unsafe = source({
      id: "tor_unsafe",
      type: "tor_metadata",
      url: "http://claims.onion/download/{query}.zip"
    });
    const capture: RawCapture = {
      id: "cap_darknet",
      sourceId: "tor_ok",
      url: "http://claims.onion/actor/Akira",
      collectedAt: "2026-05-24T00:00:00.000Z",
      publishedAt: "2026-05-24T00:00:00.000Z",
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
          confidence: 0.82,
          sourceTimestamp: "2026-05-20T00:00:00.000Z",
          urlHash: "urlhash",
          screenshotHash: "screenhash"
        },
        policyDecision: { id: "policy_akira" }
      },
      sensitive: true
    };

    const partialPlan = planDarknetMetadataLiveSearch({
      query: "Akira",
      entityType: "actor",
      sources: [approvedTor],
      captures: [capture],
      proxyBoundaries: { tor: boundaryFor("tor") }
    });
    expect(partialPlan).toMatchObject({
      status: "partial_metadata",
      queuedTasks: 1,
      results: [{
        actor: "Akira",
        victim: "Fjord Energy AS",
        policyAuditId: "policy_akira"
      }]
    });
    expect(partialPlan.nonBlockingSearch).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      nonBlockingPublicSearch: true,
      maxPublicSearchAddedLatencyMs: 0
    });
    expect(partialPlan.nonBlockingSearch.observedScenarios).toEqual(expect.arrayContaining(["ransomware_query"]));

    const pendingPlan = planDarknetMetadataLiveSearch({
      query: "Fjord Energy",
      entityType: "victim",
      sources: [pending],
      proxyBoundaries: { tor: boundaryFor("tor") }
    });
    expect(pendingPlan).toMatchObject({
      status: "approval_required",
      queuedTasks: 0,
      blocked: [{ sourceId: "tor_pending", state: "approval_required" }]
    });
    expect(pendingPlan.nonBlockingSearch.observedScenarios).toEqual(expect.arrayContaining(["no_approval", "victim_query"]));

    const queuedPlan = planDarknetMetadataLiveSearch({
      query: "Akira",
      entityType: "actor",
      sources: [approvedTor],
      proxyBoundaries: { tor: boundaryFor("tor") }
    });
    expect(queuedPlan).toMatchObject({
      status: "queued_metadata_only",
      queuedTasks: 1
    });
    expect(queuedPlan.nonBlockingSearch.packets.every((packet) =>
      packet.publicSearchAction === "continue_clear_web_and_public_channel" &&
      packet.proof.doesNotBlockPublicSearch &&
      packet.proof.doesNotPromoteRestrictedFacts &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDownload &&
      packet.noLeakSerialization.passed
    )).toBe(true);

    const disabledPlan = planDarknetMetadataLiveSearch({
      query: "Akira",
      entityType: "actor",
      sources: [approvedTor],
      proxyBoundaries: { tor: boundaryFor("tor") },
      disabled: true
    });
    expect(disabledPlan).toMatchObject({
      status: "disabled",
      queuedTasks: 0,
      blocked: [{ sourceId: "tor_ok", state: "disabled" }]
    });
    expect(disabledPlan.nonBlockingSearch.observedScenarios).toEqual(expect.arrayContaining(["public_api_blocked_state"]));

    const blockedPlan = planDarknetMetadataLiveSearch({
      query: "Akira",
      entityType: "actor",
      sources: [unsafe],
      proxyBoundaries: { tor: boundaryFor("tor") }
    });
    expect(blockedPlan).toMatchObject({
      status: "blocked",
      queuedTasks: 0,
      blocked: [{ sourceId: "tor_unsafe", state: "blocked" }]
    });
    expect(blockedPlan.nonBlockingSearch.observedScenarios).toEqual(expect.arrayContaining(["unsafe_target"]));
  });

  test("builds metadata-only result DTOs without raw material", () => {
    const dto = darknetMetadataResultFromCapture({
      id: "cap_darknet_dto",
      sourceId: "src_darknet",
      url: "http://claims.onion/post",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: "hash",
      mediaType: "text/plain",
      storageKind: "metadata_only",
      metadata: {
        adapter: "darknet_metadata",
        leakSite: {
          actorName: "LockBit",
          victimName: "Example Corp",
          claimDate: "2026-05-21",
          claimedSector: "Manufacturing",
          claimedCountry: "US",
          claimedDataCategory: "finance records",
          postStatus: "updated",
          confidence: 0.74,
          sourceTimestamp: "2026-05-21T00:00:00.000Z",
          urlHash: "urlhash",
          screenshotHash: "screenhash"
        },
        policyDecision: { id: "policy_lockbit" }
      },
      sensitive: true
    });

    expect(dto).toEqual({
      sourceId: "src_darknet",
      urlHash: "urlhash",
      actor: "LockBit",
      victim: "Example Corp",
      claimedDate: "2026-05-21",
      sector: "Manufacturing",
      country: "US",
      claimedDataCategory: "finance records",
      postStatus: "updated",
      sourceTimestamp: "2026-05-21T00:00:00.000Z",
      screenshotHash: "screenhash",
      confidence: 0.74,
      policyAuditId: "policy_lockbit"
    });
  });

  test("builds restricted metadata evidence deltas without raw content or unsafe surfaces", () => {
    const delta = restrictedMetadataEvidenceDeltasFromCapture(darknetCapture(), {
      query: "Akira",
      runId: "run_darknet"
    })[0];

    expect(delta).toMatchObject({
      kind: "added",
      subjectType: "capture",
      retentionClass: "restricted_metadata",
      query: "Akira",
      normalizedQuery: "akira",
      runId: "run_darknet",
      captureIds: ["cap_restricted"],
      policyEventIds: ["policy_restricted"],
      metadata: {
        adapter: "darknet_metadata",
        deltaType: "newly_observed_claim",
        metadataOnly: true,
        labels: expect.arrayContaining(["unverified_actor_claim", "needs_analyst_review"])
      }
    });

    const serialized = JSON.stringify(delta.metadata).toLowerCase();
    for (const forbidden of ["rawtext", "body", "html", "screenshotbytes", "file", "comment", "form", "contact", "payment"]) {
      expect(serialized.includes(forbidden)).toBe(false);
    }
    expect(serialized.includes("http://claims.onion")).toBe(false);
  });

  test("reports changed removed mirrored stale and contradicted restricted metadata labels", () => {
    const previous = darknetCapture({ id: "cap_previous", postStatus: "new" });
    const changed = restrictedMetadataEvidenceDeltasFromCapture(
      darknetCapture({ id: "cap_changed", postStatus: "updated", collectedAt: "2026-05-24T00:10:00.000Z" }),
      { previous, query: "Akira" }
    )[0];
    const removed = restrictedMetadataEvidenceDeltasFromCapture(
      darknetCapture({ id: "cap_removed", postStatus: "removed", collectedAt: "2026-05-24T00:20:00.000Z" }),
      { previous, query: "Akira" }
    )[0];
    const mirrored = restrictedMetadataEvidenceDeltasFromCapture(
      darknetCapture({ id: "cap_mirror", sourceId: "src_mirror", collectedAt: "2026-05-24T00:30:00.000Z" }),
      { query: "Akira", mirroredBySourceIds: ["src_darknet"] }
    )[0];
    const staleContradicted = restrictedMetadataEvidenceDeltasFromCapture(
      darknetCapture({ id: "cap_stale", sourceTimestamp: "2026-04-01T00:00:00.000Z", confidence: 0.91 }),
      {
        query: "Akira",
        contradicted: true,
        staleAfterDays: 7,
        now: "2026-05-24T00:00:00.000Z"
      }
    )[0];

    expect(changed?.metadata).toMatchObject({ deltaType: "changed_claim_status", previousPostStatus: "new" });
    expect(removed).toMatchObject({ kind: "expired", metadata: { deltaType: "removed_dead_post" } });
    expect(mirrored?.metadata).toMatchObject({
      deltaType: "mirrored_post",
      mirroredBySourceIds: ["src_darknet"],
      labels: expect.arrayContaining(["mirrored_claim"])
    });
    expect(staleContradicted).toMatchObject({
      kind: "contradicted",
      metadata: {
        labels: expect.arrayContaining(["stale_claim", "contradicted_claim", "needs_analyst_review"])
      }
    });

    expect(restrictedMetadataClaimRiskLabels(darknetMetadataResultFromCapture(darknetCapture()) ?? (() => { throw new Error("missing dto"); })())).toContain("unverified_actor_claim");
  });

  test("polling can return metadata-only deltas including policy blocks and approval changes", () => {
    const store = new InMemoryScraperStore();
    const captureDelta = restrictedMetadataEvidenceDeltasFromCapture(darknetCapture(), {
      query: "Akira",
      runId: "run_darknet"
    })[0];
    const tenantSource = source({ tenantId: "tenant_darknet" });
    const unsafeDecision = evaluateDarknetMetadataPolicy(
      tenantSource,
      "http://exampleonion.onion/download/victim.zip",
      boundary
    );
    const blockedDelta = restrictedMetadataPolicyDelta({
      source: tenantSource,
      policyDecision: unsafeDecision,
      query: "Akira",
      runId: "run_darknet",
      event: "blocked_unsafe_link"
    });
    const approvedDecision = evaluateDarknetMetadataPolicy(tenantSource, "http://exampleonion.onion/post/claim", boundary);
    const approvalDelta = restrictedMetadataPolicyDelta({
      source: tenantSource,
      policyDecision: approvedDecision,
      query: "Akira",
      runId: "run_darknet",
      event: "source_newly_approved",
      previousApprovalState: "pending",
      currentApprovalState: "approved"
    });
    const killSwitchDelta = restrictedMetadataPolicyDelta({
      source: source({ tenantId: "tenant_darknet", accessMethod: "disabled", status: "disabled" }),
      policyDecision: {
        ...approvedDecision,
        id: "policy_kill_switch",
        allowed: false,
        message: "darknet metadata live search is disabled by kill switch"
      },
      query: "Akira",
      runId: "run_darknet",
      event: "kill_switch_disabled"
    });

    for (const delta of [captureDelta, blockedDelta, approvalDelta, killSwitchDelta]) {
      store.saveEvidenceDelta(delta);
    }

    const deltas = store.queries().getSearchDeltas("Akira", undefined, { tenantId: "tenant_darknet" });
    expect(deltas.map((delta) => delta.metadata.deltaType)).toEqual([
      "newly_observed_claim",
      "blocked_unsafe_link",
      "policy_change",
      "policy_change"
    ]);
    expect((store.queries().getActiveRunEvidence("run_darknet", deltas[0]?.cursor, { tenantId: "tenant_darknet" }).deltas ?? []).map((delta) => delta.subjectType)).toEqual([
      "policy_event",
      "policy_event",
      "policy_event"
    ]);
    expect(blockedDelta).toMatchObject({
      kind: "blocked",
      subjectType: "policy_event",
      metadata: {
        blockedUrlHash: unsafeDecision.urlHash,
        event: "blocked_unsafe_link"
      }
    });
    expect(JSON.stringify(blockedDelta.metadata).includes("victim.zip")).toBe(false);
  });

  test("bridges restricted source approval states into live-search explanations", () => {
    const pending = source({
      id: "src_pending_bridge",
      status: "needs_review",
      approvedAt: undefined,
      approvedBy: undefined,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      },
      url: "http://pending.onion/actor/{query}"
    });
    const missingProxy = source({
      id: "src_missing_proxy",
      accessMethod: "manual_seed",
      status: "active"
    });
    const missingLegal = source({
      id: "src_missing_legal",
      legalNotes: "",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true
      }
    });
    const approved = source({
      id: "src_bridge_approved",
      url: "http://claims.onion/actor/{query}"
    });
    const unsafe = source({
      id: "src_bridge_unsafe",
      url: "http://claims.onion/download/{query}.zip"
    });

    expect(restrictedMetadataApprovalBridge({ source: pending, proxyBoundary: boundary }).state).toBe("pending_metadata_only_approval");
    expect(restrictedMetadataApprovalBridge({ source: missingProxy, proxyBoundary: boundary }).state).toBe("missing_proxy_approval");
    expect(restrictedMetadataApprovalBridge({ source: missingLegal, proxyBoundary: boundary }).state).toBe("missing_legal_notes");
    expect(restrictedMetadataApprovalBridge({ source: approved, proxyBoundary: undefined }).state).toBe("missing_proxy_approval");
    expect(restrictedMetadataApprovalBridge({ source: approved, proxyBoundary: boundary, targetUrl: "http://claims.onion/actor/Akira" })).toMatchObject({
      state: "active_metadata_only_queue",
      liveSearchState: "queued_metadata_only",
      canQueueMetadataOnly: true,
      metadataOnly: true,
      impossibleOperations: expect.arrayContaining(["stolen_file_download", "credential_bypass", "threat_actor_interaction"])
    });
    expect(restrictedMetadataApprovalBridge({ source: unsafe, proxyBoundary: boundary, targetUrl: "http://claims.onion/download/Akira.zip" })).toMatchObject({
      state: "blocked_unsafe_target",
      requiredAction: "fix_blocked_target",
      canQueueMetadataOnly: false
    });
  });

  test("converts Agent 01 review decisions without allowing raw payload collection", () => {
    const base = source({
      id: "src_review_bridge",
      status: "needs_review",
      approvedAt: undefined,
      approvedBy: undefined,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      }
    });
    const unsafeDecision: SourceReviewDecision = {
      id: "review_raw_payload",
      sourceId: "src_review_bridge",
      action: "approve",
      decidedAt: "2026-05-24T01:00:00.000Z",
      decidedBy: "reviewer",
      reason: "Wrongly attempted raw approval",
      metadataOnly: false
    };
    expect(restrictedMetadataApprovalBridgeFromDecision(base, unsafeDecision, { proxyBoundary: boundary })).toMatchObject({
      state: "pending_metadata_only_approval",
      canQueueMetadataOnly: false,
      reviewDecisionId: "review_raw_payload"
    });

    const safeDecision: SourceReviewDecision = {
      ...unsafeDecision,
      id: "review_metadata_only",
      reason: "Approve metadata-only claim fields and hashes only",
      metadataOnly: true,
      riskJustification: "High-risk source approved only for metadata fields and hashes.",
      legalContact: "legal@example.test"
    };
    const bridge = restrictedMetadataApprovalBridgeFromDecision(base, safeDecision, { proxyBoundary: boundary });
    expect(bridge).toMatchObject({
      state: "pending_metadata_only_approval",
      requiredAction: "approve_metadata_only",
      canQueueMetadataOnly: false,
      metadataOnly: true
    });
    expect(bridge.impossibleOperations).toContain("stolen_file_download");
  });

  test("source lifecycle can approve activate disable and restore metadata-only queueing", () => {
    const registry = new InMemorySourceRegistry();
    const candidate = registry.upsert({
      id: "src_lifecycle_bridge",
      name: "Lifecycle onion metadata",
      type: "tor_metadata",
      url: "http://lifecycle.onion/actor/{query}",
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: "high",
      trustScore: 0.7,
      crawlFrequencySeconds: 3600,
      legalNotes: "Legal and ethics notes approve metadata fields and hashes only.",
      approvalRequired: true,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      }
    });
    expect(restrictedMetadataApprovalBridge({ source: candidate, proxyBoundary: boundary }).state).toBe("pending_metadata_only_approval");

    const needsReview = registry.setStatus("src_lifecycle_bridge", "needs_review", { reason: "policy_review", actorId: "agent01" });
    expect(restrictedMetadataApprovalBridge({ source: needsReview, proxyBoundary: boundary }).state).toBe("pending_metadata_only_approval");

    const approved = registry.applyReviewDecision({
      id: "review_lifecycle_approve",
      sourceId: "src_lifecycle_bridge",
      action: "approve",
      decidedAt: "2026-05-24T01:10:00.000Z",
      decidedBy: "reviewer",
      reason: "Metadata-only approval for parsed claim fields and hashes.",
      metadataOnly: true,
      riskJustification: "No payload, interaction, or raw leak collection is allowed.",
      legalContact: "legal@example.test"
    });
    expect(restrictedMetadataApprovalBridge({ source: approved, proxyBoundary: boundary }).state).toBe("pending_metadata_only_approval");

    const active = registry.setStatus("src_lifecycle_bridge", "active", { reason: "policy_review", actorId: "reviewer" });
    const activeBridge = restrictedMetadataApprovalBridge({
      source: active,
      proxyBoundary: boundary,
      targetUrl: "http://lifecycle.onion/actor/Akira"
    });
    expect(activeBridge).toMatchObject({ state: "active_metadata_only_queue", canQueueMetadataOnly: true });
    expect(evaluateSourceForCollection(active)).toMatchObject({ allowed: true, metadataOnly: true });

    const disabled = registry.setStatus("src_lifecycle_bridge", "disabled", { reason: "operator_request", actorId: "ops", note: "kill switch" });
    expect(restrictedMetadataApprovalBridge({ source: disabled, proxyBoundary: boundary }).state).toBe("disabled_kill_switch");

    const restored = registry.applyReviewDecision({
      id: "review_lifecycle_restore",
      sourceId: "src_lifecycle_bridge",
      action: "restore",
      decidedAt: "2026-05-24T01:20:00.000Z",
      decidedBy: "reviewer",
      reason: "Restore only to active metadata-only collection.",
      restoreStatus: "active",
      metadataOnly: true
    });
    expect(restrictedMetadataApprovalBridge({ source: restored, proxyBoundary: boundary, targetUrl: "http://lifecycle.onion/actor/Akira" })).toMatchObject({
      state: "active_metadata_only_queue",
      canQueueMetadataOnly: true
    });
    expect(evaluateDarknetMetadataPolicy(restored, "http://lifecycle.onion/download/Akira.zip", boundary)).toMatchObject({
      allowed: false,
      metadataOnly: true,
      reason: "sensitive_payload_target_blocked"
    });
  });

  test("actor victim and ransomware queries move from approval recommendation to metadata-only queue", () => {
    const pending = source({
      id: "src_query_pending",
      status: "needs_review",
      approvedAt: undefined,
      approvedBy: undefined,
      url: "http://claims.onion/actor/{query}",
      metadata: {
        actors: ["Akira"],
        victims: ["Fjord Energy"],
        ransomwareFamilies: ["LockBit ransomware"]
      },
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      }
    });
    for (const [query, entityType] of [
      ["Akira", "actor"],
      ["Fjord Energy", "victim"],
      ["LockBit ransomware", "malware"]
    ] as const) {
      const pendingPlan = planDarknetMetadataLiveSearch({
        query,
        entityType,
        sources: [pending],
        proxyBoundaries: { tor: boundary }
      });
      expect(pendingPlan).toMatchObject({
        status: "approval_required",
        queuedTasks: 0,
        sourceStates: [{ state: "pending_metadata_only_approval", requiredAction: "approve_metadata_only" }],
        blocked: [{ state: "approval_required", restrictedState: "pending_metadata_only_approval" }],
        activationRecommendations: [{
          sourceId: "src_query_pending",
          requiredAction: "approve_metadata_only",
          metadataOnly: true,
          allowedFields: expect.arrayContaining(["actor", "victim", "url_hash", "policy_audit_id"]),
          forbiddenOperations: expect.arrayContaining(["stolen_file_download", "credential_bypass"])
        }]
      });

      const approvedPlan = planDarknetMetadataLiveSearch({
        query,
        entityType,
        sources: [source({ ...pending, status: "active", approvedAt: new Date(0).toISOString(), approvedBy: "reviewer", governance: {
          approvalRequired: true,
          approvalState: "approved",
          metadataOnly: true,
          approvedAt: new Date(0).toISOString(),
          approvedBy: "reviewer",
          policyVersion: "collection-policy:v1"
        } })],
        proxyBoundaries: { tor: boundary }
      });
      expect(approvedPlan).toMatchObject({
        status: "queued_metadata_only",
        queuedTasks: 1,
        sourceStates: [{ state: "active_metadata_only_queue", canQueueMetadataOnly: true }],
        complianceStatuses: [{
          sourceId: "src_query_pending",
          status: "queued_metadata_only",
          canQueueMetadataOnly: true
        }]
      });
    }
  });

  test("builds API-ready restricted status contracts including retention expiry", () => {
    const expired = source({
      id: "src_retention_expired",
      metadata: {
        retentionClass: "restricted_metadata",
        restrictedRetentionExpiresAt: "2026-01-01T00:00:00.000Z",
        actors: ["Akira"]
      }
    });
    const bridge = restrictedMetadataApprovalBridge({
      source: expired,
      proxyBoundary: boundary,
      targetUrl: "http://exampleonion.onion/post/claim",
      now: "2026-05-24T00:00:00.000Z"
    });
    const allowedFields = [...bridge.allowedFields];
    expect(bridge).toMatchObject({
      state: "retention_expiry",
      liveSearchState: "approval_required",
      requiredAction: "review_retention",
      retentionClass: "restricted_metadata",
      retentionExpiresAt: "2026-01-01T00:00:00.000Z",
      canQueueMetadataOnly: false,
      allowedFields: expect.arrayContaining(["actor", "victim", "claimed_data_category", "policy_audit_id"])
    });
    for (const field of ["actor", "victim", "claimed_data_category", "url_hash", "screenshot_hash", "source_timestamp"] as const) {
      expect(allowedFields).toContain(field);
    }

    const plan = planDarknetMetadataLiveSearch({
      query: "Akira",
      entityType: "actor",
      sources: [expired],
      proxyBoundaries: { tor: boundary }
    });
    expect(plan).toMatchObject({
      status: "approval_required",
      queuedTasks: 0,
      allowedFields: expect.arrayContaining(["actor", "victim", "url_hash"]),
      forbiddenOperations: expect.arrayContaining(["stolen_file_download", "threat_actor_interaction"]),
      complianceStatuses: [{
        sourceId: "src_retention_expired",
        state: "retention_expiry",
        requiredAction: "review_retention"
      }],
      activationRecommendations: [{
        sourceId: "src_retention_expired",
        restrictedState: "retention_expiry",
        requiredAction: "review_retention"
      }]
    });
    expect(JSON.stringify(plan.activationRecommendations)).not.toContain("exampleonion.onion");
  });

  test("emits retention expiry evidence deltas without unsafe URLs or raw material", () => {
    const delta = restrictedMetadataRetentionExpiryDelta({
      source: source({
        id: "src_retention_delta",
        tenantId: "tenant_darknet",
        metadata: { retentionClass: "restricted_metadata" }
      }),
      observedAt: "2026-05-24T02:15:00.000Z",
      expiredAt: "2026-05-24T00:00:00.000Z",
      query: "Akira",
      runId: "run_retention"
    });

    expect(delta).toMatchObject({
      tenantId: "tenant_darknet",
      kind: "expired",
      subjectType: "policy_event",
      retentionClass: "restricted_metadata",
      staleAt: "2026-05-24T00:00:00.000Z",
      metadata: {
        deltaType: "retention_expiry",
        event: "retention_expired",
        metadataOnly: true,
        allowedFields: expect.arrayContaining(["actor", "victim", "policy_audit_id"]),
        forbiddenOperations: expect.arrayContaining(["stolen_file_download", "non_metadata_capture"])
      }
    });
    const serialized = JSON.stringify(delta.metadata).toLowerCase();
    for (const forbidden of ["http://", "rawtext", "body", "html", "credential", "password", "filebytes", "screenshotbytes"]) {
      expect(serialized.includes(forbidden)).toBe(false);
    }
  });

  test("redacts unsafe target URLs to hashes and blocks high-risk activation without approval", () => {
    const pending = source({
      id: "src_pending_high_risk",
      status: "active",
      approvedAt: undefined,
      approvedBy: undefined,
      url: "http://exampleonion.onion/download/customer.zip",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      }
    });
    expect(evaluateSourceForCollection(pending)).toMatchObject({
      allowed: false,
      metadataOnly: true,
      reason: "darknet metadata source requires operator approval for metadata-only collection"
    });

    const approvedUnsafe = source({
      id: "src_approved_unsafe",
      url: "http://exampleonion.onion/download/customer.zip"
    });
    const plan = planDarknetMetadataLiveSearch({
      query: "customer",
      entityType: "free_text",
      sources: [approvedUnsafe],
      proxyBoundaries: { tor: boundary }
    });
    expect(plan).toMatchObject({
      status: "blocked",
      queuedTasks: 0,
      blocked: [{
        sourceId: "src_approved_unsafe",
        restrictedState: "blocked_unsafe_target",
        requiredAction: "fix_blocked_target"
      }],
      sourceStates: [{
        state: "blocked_unsafe_target",
        urlHash: expect.any(String),
        canQueueMetadataOnly: false
      }]
    });
    expect(JSON.stringify(plan)).not.toContain("customer.zip");
    expect(JSON.stringify(plan)).not.toContain("exampleonion.onion/download");
  });

  test("builds restricted metadata audit findings and safe repairs without raw leak data", () => {
    const unhealthyBoundary: ApprovedProxyBoundary = {
      ...boundary,
      health: {
        boundaryId: "tor-proxy-fixture",
        network: "tor",
        proxyType: "tor_socks",
        isolationId: "tor:tor-proxy-fixture:metadata-only",
        healthy: false,
        checkedAt: "2026-05-24T02:20:00.000Z",
        timeoutClass: "metadata_standard",
        resolutionFailure: "timeout",
        fetchFailure: "proxy_failure",
        screenshotHashMode: "hash_only"
      }
    };
    const captureSource = source({
      id: "src_audit_capture",
      metadata: { retentionClass: "restricted_metadata", actors: ["Akira"] }
    });
    const unsafeSource = source({
      id: "src_audit_unsafe",
      url: "http://user:pass@unsafe.onion/download/customer-dump.zip",
      metadata: { retentionClass: "restricted_metadata" }
    });
    const pendingSource = source({
      id: "src_audit_pending",
      status: "needs_review",
      approvedAt: undefined,
      approvedBy: undefined,
      metadata: { actors: ["Akira"] },
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      }
    });
    const legalExpiredSource = source({
      id: "src_audit_legal_expired",
      metadata: {
        legalNotesExpiresAt: "2026-01-01T00:00:00.000Z",
        retentionClass: "restricted_metadata"
      }
    });
    const disabledSource = source({
      id: "src_audit_disabled",
      status: "disabled",
      accessMethod: "disabled",
      metadata: { retentionClass: "restricted_metadata" }
    });
    const retentionExpiredSource = source({
      id: "src_audit_retention_expired",
      metadata: {
        retentionClass: "restricted_metadata",
        restrictedRetentionExpiresAt: "2026-01-01T00:00:00.000Z"
      }
    });
    const blockedDecision = evaluateDarknetMetadataPolicy(unsafeSource, unsafeSource.url, unhealthyBoundary);
    const blockedDelta = restrictedMetadataPolicyDelta({
      source: unsafeSource,
      policyDecision: blockedDecision,
      query: "Akira",
      event: "blocked_unsafe_link"
    });
    const retentionDelta = restrictedMetadataRetentionExpiryDelta({
      source: retentionExpiredSource,
      observedAt: "2026-05-24T02:20:00.000Z",
      expiredAt: "2026-01-01T00:00:00.000Z",
      query: "Akira"
    });

    const report = buildRestrictedMetadataAuditReport({
      generatedAt: "2026-05-24T02:20:00.000Z",
      sources: [captureSource, unsafeSource, pendingSource, legalExpiredSource, disabledSource, retentionExpiredSource],
      proxyBoundaries: { tor: unhealthyBoundary },
      captures: [darknetCapture({
        id: "cap_audit_complete",
        sourceId: "src_audit_capture",
        policyAuditId: "policy_audit_capture",
        urlHash: "urlhash_audit",
        collectedAt: "2026-05-24T02:00:00.000Z"
      })],
      evidenceDeltas: [blockedDelta, retentionDelta],
      scheduler: {
        queuedSourceIds: ["src_audit_capture"],
        deadLetterSourceIds: ["src_audit_capture"]
      }
    });

    expect(report.summary).toMatchObject({
      unsafe_target_blocked: expect.any(Number),
      approval_missing: expect.any(Number),
      legal_notes_expired: expect.any(Number),
      source_disabled: expect.any(Number),
      kill_switch_active: expect.any(Number),
      raw_payload_attempted_blocked: expect.any(Number),
      retention_expired: expect.any(Number),
      screenshot_hash_only: expect.any(Number),
      url_hash_only: expect.any(Number),
      metadata_only_capture_complete: expect.any(Number)
    });
    for (const kind of [
      "unsafe_target_blocked",
      "approval_missing",
      "legal_notes_expired",
      "source_disabled",
      "kill_switch_active",
      "raw_payload_attempted_blocked",
      "retention_expired",
      "screenshot_hash_only",
      "url_hash_only",
      "metadata_only_capture_complete",
      "proxy_isolation_unhealthy",
      "scheduler_dead_lettered"
    ] as const) {
      expect(report.findings.some((finding) => finding.kind === kind)).toBe(true);
    }
    expect(report.repairs.map((repair) => repair.action)).toEqual(expect.arrayContaining([
      "approve_metadata_only",
      "add_or_refresh_legal_notes",
      "restore_source",
      "review_retention",
      "repair_target_to_metadata_listing",
      "inspect_proxy_isolation",
      "requeue_metadata_only"
    ]));
    expect(report.diagnostics.find((item) => item.sourceId === "src_audit_capture")).toMatchObject({
      schedulerState: { queued: true, deadLettered: true },
      urlHash: "urlhash_audit",
      screenshotHash: "screenhash_restricted",
      latestCaptureId: "cap_audit_complete"
    });
    expect(report.opsAlerts).toEqual(expect.arrayContaining([
      "raw_payload_attempted_blocked:src_audit_unsafe",
      "kill_switch_active:src_audit_disabled"
    ]));

    const serialized = JSON.stringify(report).toLowerCase();
    for (const forbidden of [
      "unsafe.onion",
      "user:pass",
      "customer-dump.zip",
      "http://",
      "raw leak",
      "downloaded content",
      "stolen file contents"
    ]) {
      expect(serialized.includes(forbidden)).toBe(false);
    }
    for (const repair of report.repairs) {
      expect(repair.forbiddenActions.join(" ")).not.toContain("bypass authentication");
      expect(repair.reason.toLowerCase()).not.toContain("captcha");
      expect(repair.reason.toLowerCase()).not.toContain("download");
    }
  });

  test("validates disabled-by-default restricted metadata source-pack fixtures without network access", async () => {
    let called = false;
    const unusedBoundary: ApprovedProxyBoundary = {
      ...boundary,
      async fetchMetadata() {
        called = true;
        return {};
      }
    };
    expect(unusedBoundary.id).toBe("tor-proxy-fixture");

    const pack = await Bun.file("seeds/restricted_metadata_source_packs.json").json() as RestrictedMetadataSourcePack;
    const validation = validateRestrictedMetadataSourcePack(pack, "2026-05-24T02:00:00.000Z");

    expect(called).toBe(false);
    expect(validation).toMatchObject({
      packId: "restricted-metadata-safe-fixtures",
      valid: true,
      dryRunOnly: true,
      errors: [],
      reports: [{
        sourceId: "restricted_pack_metadata_listing",
        dryRunOnly: true,
        canReviewWithoutLiveAccess: true,
        wouldQueueCollection: false,
        metadataWouldCapture: expect.arrayContaining(["actor", "victim", "url_hash", "policy_audit_id"]),
        neverCaptured: expect.arrayContaining(["stolen_file_download", "credential_bypass", "threat_actor_interaction"]),
        requiresApproval: expect.arrayContaining(["operator_metadata_only_approval", "matching_proxy_boundary", "kill_switch_group_assignment"]),
        apiNotes: expect.arrayContaining(["Show as restricted metadata recommendation only."])
      }]
    });
    expect(validation.importedSources[0]).toMatchObject({
      id: "restricted_pack_metadata_listing",
      accessMethod: "disabled",
      status: "needs_review",
      risk: "high",
      governance: {
        approvalState: "pending",
        metadataOnly: true
      },
      metadata: {
        dryRunOnly: true,
        killSwitchGroup: "restricted-metadata-tor-review",
        retentionClass: "restricted_metadata"
      }
    });
  });

  test("reports unsafe restricted metadata source-pack examples for reviewer compliance", () => {
    const pack: RestrictedMetadataSourcePack = {
      version: 1,
      id: "restricted-unsafe-fixtures",
      name: "Unsafe restricted fixtures",
      disabledByDefault: true,
      network: "tor",
      proxyBoundaryId: "tor-approved-metadata-proxy",
      killSwitchGroup: "restricted-unsafe-review",
      legalNotes: "Dry-run unsafe fixture pack for policy review only.",
      approvalScope: "metadata_only",
      retentionClass: "restricted_metadata",
      forbiddenOperations: [
        "credential_bypass",
        "captcha_solving",
        "threat_actor_interaction",
        "stolen_file_download",
        "stealth_or_evasion",
        "unapproved_proxy",
        "non_metadata_capture"
      ],
      sources: [
        {
          id: "download_heavy",
          name: "Download-heavy leak fixture",
          type: "tor_metadata",
          url: "http://unsafe.onion/download/customer-dump.zip",
          legalNotes: "Unsafe download fixture.",
          approvalScope: "metadata_only"
        },
        {
          id: "credential_dump_path",
          name: "Credential dump path fixture",
          type: "tor_metadata",
          url: "http://unsafe.onion/credentials/passwords.txt",
          legalNotes: "Unsafe credential path fixture.",
          approvalScope: "metadata_only"
        },
        {
          id: "auth_only_forum",
          name: "Auth-only forum fixture",
          type: "tor_metadata",
          url: "http://unsafe.onion/login",
          legalNotes: "Unsafe auth-only forum fixture.",
          approvalScope: "metadata_only"
        },
        {
          id: "contact_payment_page",
          name: "Contact and payment fixture",
          type: "tor_metadata",
          url: "http://unsafe.onion/contact/payment",
          legalNotes: "Unsafe contact/payment fixture.",
          approvalScope: "metadata_only"
        },
        {
          id: "media_heavy_source",
          name: "Media-heavy source fixture",
          type: "tor_metadata",
          url: "http://unsafe.onion/media/proof-video.mp4",
          legalNotes: "Unsafe media fixture.",
          approvalScope: "metadata_only"
        },
        {
          id: "metadata_only_listing",
          name: "Metadata-only listing fixture",
          type: "tor_metadata",
          url: "http://safe.onion/posts",
          legalNotes: "Safe metadata listing fixture.",
          approvalScope: "metadata_only"
        }
      ]
    };

    const validation = validateRestrictedMetadataSourcePack(pack, "2026-05-24T02:05:00.000Z");
    expect(validation.valid).toBe(true);
    expect(validation.reports).toHaveLength(6);
    expect(validation.reports.find((report) => report.sourceId === "metadata_only_listing")?.blocked).toEqual([]);
    expect(validation.reports.filter((report) => report.blocked.length > 0).map((report) => report.sourceId)).toEqual([
      "download_heavy",
      "credential_dump_path",
      "auth_only_forum",
      "contact_payment_page",
      "media_heavy_source"
    ]);
    expect(validation.reports.find((report) => report.sourceId === "download_heavy")?.blocked).toContain("download, archive, database, document, or media target is blocked");
    expect(validation.reports.find((report) => report.sourceId === "credential_dump_path")?.blocked).toContain("download, archive, database, document, or media target is blocked");
    expect(validation.reports.find((report) => report.sourceId === "auth_only_forum")?.blocked).toContain("auth, form, contact, payment, upload, comment, or interactive search target is blocked");
    expect(validation.reports.find((report) => report.sourceId === "contact_payment_page")?.alertsWouldFire).toContain("restricted_policy_block:interaction_affordance");
    expect(validation.reports.find((report) => report.sourceId === "media_heavy_source")?.alertsWouldFire).toContain("restricted_policy_block:sensitive_payload_target");
    expect(validation.reports.every((report) => report.wouldQueueCollection === false)).toBe(true);
  });

  test("rejects restricted metadata source packs that omit safety controls", () => {
    const pack: RestrictedMetadataSourcePack = {
      version: 1,
      id: "bad-restricted-pack",
      name: "Bad restricted pack",
      disabledByDefault: true,
      network: "tor",
      proxyBoundaryId: "",
      killSwitchGroup: "",
      legalNotes: "",
      approvalScope: "metadata_only",
      retentionClass: "restricted_metadata",
      forbiddenOperations: ["stolen_file_download"],
      sources: [{
        id: "bad_entry",
        name: "Bad entry",
        type: "i2p_metadata",
        url: "http://bad.i2p/login",
        legalNotes: "",
        approvalScope: "metadata_only",
        retentionClass: "standard" as "restricted_metadata"
      }]
    };

    const validation = validateRestrictedMetadataSourcePack(pack);
    expect(validation.valid).toBe(false);
    expect(validation.errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      "Restricted metadata source pack requires legal notes",
      "Restricted metadata source pack requires a proxy boundary id",
      "Restricted metadata source pack requires a kill-switch group",
      "Restricted metadata source pack must forbid credential_bypass",
      "Restricted metadata source-pack entry type must match pack network",
      "Restricted metadata source-pack entry requires legal notes",
      "Restricted metadata source-pack entry retention class is not allowed"
    ]));
  });

  test("source-pack entries convert to safe candidate SourceRecord and compliance DTO notes", () => {
    const entry = {
      id: "entry_safe_candidate",
      name: "Safe candidate",
      type: "tor_metadata" as const,
      url: "http://safe.onion/posts",
      legalNotes: "Candidate reviewed as metadata-only fields and hashes.",
      approvalScope: "metadata_only" as const,
      actors: ["Akira"],
      victims: ["Fjord Energy AS"],
      ransomwareFamilies: ["Akira"]
    };
    const pack = {
      id: "pack_safe",
      name: "Pack Safe",
      network: "tor" as const,
      proxyBoundaryId: "tor-approved-metadata-proxy",
      killSwitchGroup: "ksg-safe",
      retentionClass: "restricted_metadata" as const,
      legalNotes: "Pack legal notes."
    };
    const record = restrictedMetadataSourcePackEntryToSource(pack, entry, "2026-05-24T02:10:00.000Z");
    const report = restrictedMetadataComplianceReport(pack, entry);

    expect(record).toMatchObject({
      accessMethod: "disabled",
      status: "needs_review",
      metadata: {
        sourcePackId: "pack_safe",
        approvalScope: "metadata_only",
        dryRunOnly: true,
        forbiddenOperations: expect.arrayContaining(["stolen_file_download", "non_metadata_capture"])
      }
    });
    expect(report).toMatchObject({
      sourceId: "entry_safe_candidate",
      retentionClass: "restricted_metadata",
      blocked: [],
      apiNotes: expect.arrayContaining(["Do not imply raw leaked data, screenshots, files, credentials, or actor interaction are collected."])
    });
  });

  test("passes proxy isolation health and timeout attribution to the boundary", async () => {
    let request;
    const adapter = new DarknetMetadataAdapter("i2p_metadata", {
      ...boundaryFor("i2p"),
      health: {
        boundaryId: "i2p-proxy-fixture",
        network: "i2p",
        proxyType: "i2p_http",
        isolationId: "i2p:i2p-proxy-fixture:metadata-only",
        healthy: true,
        checkedAt: "2026-05-24T00:00:00.000Z",
        timeoutClass: "metadata_slow",
        resolutionFailure: "none",
        fetchFailure: "none",
        screenshotHashMode: "hash_only"
      },
      async fetchMetadata(input) {
        request = input;
        return { safeText: "actor: ProxyTest", postStatus: "new", confidence: 0.7 };
      }
    });

    const result = await adapter.collect(source({
      id: "i2p_ok",
      type: "i2p_metadata",
      url: "http://claims.i2p/post"
    }), task({
      sourceId: "i2p_ok",
      sourceType: "i2p_metadata",
      targetUrl: "http://claims.i2p/post"
    }));

    expect(request).toMatchObject({
      network: "i2p",
      timeoutClass: "metadata_slow",
      isolationId: "i2p:i2p-proxy-fixture:metadata-only",
      connectorAttribution: {
        proxyType: "i2p_http"
      }
    });
    expect(result.items[0]?.metadata.proxyHealth).toMatchObject({
      resolutionFailure: "none",
      fetchFailure: "none"
    });
  });

  test("builds restricted metadata cutover status and rollback actions", () => {
    const report = buildRestrictedMetadataCutoverReport({
      generatedAt: "2026-05-24T02:45:00.000Z",
      retentionExpiringWithinDays: 7,
      proxyBoundaries: {
        tor: {
          ...boundaryFor("tor"),
          health: {
            boundaryId: "tor-proxy-fixture",
            network: "tor",
            proxyType: "tor_socks",
            isolationId: "tor:tor-proxy-fixture:metadata-only",
            healthy: true,
            checkedAt: "2026-05-24T02:30:00.000Z",
            timeoutClass: "metadata_standard",
            resolutionFailure: "none",
            fetchFailure: "none",
            screenshotHashMode: "hash_only"
          }
        }
      },
      scheduler: {
        queuedSourceIds: ["ready_source"],
        deadLetterSourceIds: ["unsafe_source"]
      },
      captures: [darknetCapture({ id: "cap_ready", sourceId: "ready_source" })],
      sources: [
        source({ id: "ready_source", url: "http://ready.onion/posts" }),
        source({
          id: "pending_source",
          url: "http://pending.onion/posts",
          approvedAt: "",
          approvedBy: "",
          status: "needs_review",
          governance: {
            approvalState: "pending",
            approvalRequired: true,
            metadataOnly: true,
            policyVersion: "collection-policy:v1"
          }
        }),
        source({ id: "unsafe_source", url: "http://unsafe.onion/download/customer-dump.zip" }),
        source({ id: "disabled_source", status: "disabled", accessMethod: "disabled" }),
        source({
          id: "retention_source",
          url: "http://retention.onion/posts",
          metadata: {
            retentionClass: "restricted_metadata",
            restrictedRetentionExpiresAt: "2026-05-28T00:00:00.000Z"
          }
        })
      ]
    });

    expect(report.metadataOnly).toBe(true);
    expect(report.decision).toBe("rollback");
    expect(report.agent09.apiReady).toBe(true);
    expect(report.agent09.statuses.ready_metadata_only).toBeGreaterThanOrEqual(1);
    expect(report.agent09.statuses.audit_clean).toBeGreaterThanOrEqual(1);
    expect(report.agent09.statuses.pending_approval).toBe(1);
    expect(report.agent09.statuses.blocked_unsafe_target).toBe(1);
    expect(report.agent09.statuses.disabled).toBe(1);
    expect(report.agent09.statuses.kill_switch_active).toBe(1);
    expect(report.agent09.statuses.retention_expiring).toBe(1);
    expect(report.agent09.sources.find((item) => item.sourceId === "ready_source")).toMatchObject({
      primaryStatus: "ready_metadata_only",
      evidenceFreshness: "fresh_capture",
      canQueueMetadataOnly: true
    });
    expect(report.rollbackActions.map((action) => action.action)).toEqual(expect.arrayContaining([
      "keep_outer_fallback_enabled",
      "pause_restricted_metadata_workers",
      "quarantine_source",
      "clear_metadata_only_queue",
      "keep_restricted_sources_disabled",
      "review_retention_before_cutover",
      "restore_last_audit_clean_config"
    ]));
    expect(report.coordination.agent01GovernanceEvidence).toBe("approval_state_and_legal_notes");
    expect(report.coordination.agent06IntegrityEvidence).toBe("hashes_retention_and_metadata_only_storage");
    expect(report.coordination.agent10RollbackActions).toContain("pause_restricted_metadata_workers");
  });

  test("cutover rehearsal never fetches payloads or exposes unsafe URLs", () => {
    let called = false;
    const report = buildRestrictedMetadataCutoverReport({
      generatedAt: "2026-05-24T02:55:00.000Z",
      proxyBoundaries: {
        tor: {
          ...boundaryFor("tor"),
          async fetchMetadata() {
            called = true;
            return { safeText: "this should not be requested" };
          }
        }
      },
      sources: [
        source({
          id: "unsafe_with_credentials",
          url: "http://user:pass@unsafe.onion/download/customer-dump.zip"
        })
      ]
    });

    const serialized = JSON.stringify(report);
    expect(called).toBe(false);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("unsafe.onion");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("customer-dump.zip");
    expect(serialized).not.toContain("this should not be requested");
    expect(report.agent09.sources[0]?.primaryStatus).toBe("blocked_unsafe_target");
    for (const action of report.rollbackActions) {
      expect(action.reason.toLowerCase()).not.toContain("bypass");
      expect(action.reason.toLowerCase()).not.toContain("captcha");
      expect(action.reason.toLowerCase()).not.toContain("download");
      expect(action.reason.toLowerCase()).not.toContain("contact");
    }
  });

  test("builds restricted metadata apply plans with approval boundaries and rollback-only actions", () => {
    const plan = buildRestrictedMetadataApplyPlan({
      generatedAt: "2026-05-24T03:20:00.000Z",
      operatorId: "operator-05",
      retentionExpiringWithinDays: 7,
      proxyBoundaries: { tor: boundaryFor("tor") },
      scheduler: { queuedSourceIds: ["ready_apply"] },
      captures: [darknetCapture({ id: "cap_ready_apply", sourceId: "ready_apply" })],
      sources: [
        source({ id: "ready_apply", url: "http://readyapply.onion/posts" }),
        source({
          id: "pending_apply",
          url: "http://pendingapply.onion/posts",
          approvedAt: "",
          approvedBy: "",
          status: "needs_review",
          legalNotes: "",
          governance: {
            approvalState: "pending",
            approvalRequired: true,
            metadataOnly: true,
            policyVersion: "collection-policy:v1"
          }
        }),
        source({ id: "unsafe_apply", url: "http://unsafeapply.onion/download/customer-dump.zip" }),
        source({ id: "disabled_apply", status: "disabled", accessMethod: "disabled" }),
        source({
          id: "retention_apply",
          url: "http://retentionapply.onion/posts",
          metadata: {
            retentionClass: "restricted_metadata",
            restrictedRetentionExpiresAt: "2026-05-28T00:00:00.000Z"
          }
        })
      ]
    });

    expect(plan.dryRunOnly).toBe(true);
    expect(plan.metadataOnly).toBe(true);
    expect(plan.operatorId).toBe("operator-05");
    expect(plan.actions.map((item) => item.action)).toEqual(expect.arrayContaining([
      "enable_metadata_only_queue",
      "renew_legal_notes",
      "keep_source_blocked",
      "apply_kill_switch",
      "disable_source",
      "shorten_retention"
    ]));
    expect(plan.summary.automation_safe).toBeGreaterThanOrEqual(2);
    expect(plan.summary.human_approval_required).toBeGreaterThanOrEqual(1);
    expect(plan.summary.blocked).toBeGreaterThanOrEqual(1);
    expect(plan.summary.rollback_only).toBeGreaterThanOrEqual(1);
    expect(plan.actions.find((item) => item.action === "enable_metadata_only_queue")).toMatchObject({
      safety: "automation_safe",
      expectedDiff: { scheduler: "queue_metadata_only" },
      proof: {
        allowsPayloadDownload: false,
        allowsAuthBypass: false,
        allowsCaptchaSolving: false,
        allowsPrivateCommunityAccess: false,
        allowsThreatActorInteraction: false
      }
    });
    expect(plan.actions.find((item) => item.action === "renew_legal_notes")).toMatchObject({
      safety: "human_approval_required"
    });
    expect(plan.actions.find((item) => item.action === "keep_source_blocked")).toMatchObject({
      safety: "blocked",
      expectedDiff: {
        sourceStatus: "quarantined",
        accessMethod: "disabled",
        scheduler: "clear_metadata_only_queue"
      }
    });
    expect(plan.actions.find((item) => item.action === "apply_kill_switch")).toMatchObject({
      safety: "rollback_only",
      expectedDiff: { killSwitch: "enabled" }
    });
    for (const action of plan.actions) {
      expect(action.prohibitedAlternatives).toEqual(expect.arrayContaining([
        "payload download remains prohibited",
        "credential or authentication bypass remains prohibited",
        "CAPTCHA solving remains prohibited",
        "private community access remains prohibited",
        "threat actor interaction remains prohibited",
        "unsafe restricted URLs remain redacted to hashes"
      ]));
      expect(action.proof.exposesRawUrl).toBe(false);
      expect(action.proof.forbiddenOperations).toEqual(expect.arrayContaining(["stolen_file_download", "credential_bypass", "captcha_solving"]));
    }
  });

  test("restricted metadata apply plans redact raw URLs and credentials", () => {
    const plan = buildRestrictedMetadataApplyPlan({
      generatedAt: "2026-05-24T03:25:00.000Z",
      proxyBoundaries: { tor: boundaryFor("tor") },
      sources: [
        source({
          id: "credential_apply",
          url: "http://user:pass@unsafeapply.onion/download/customer-dump.zip"
        })
      ]
    });

    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("unsafeapply.onion");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("customer-dump.zip");
    expect(plan.actions.map((item) => item.action)).toEqual(expect.arrayContaining(["keep_source_blocked", "apply_kill_switch"]));
    expect(plan.actions.every((item) => item.dryRunOnly && item.metadataOnly)).toBe(true);
    expect(plan.actions.every((item) => item.proof.exposesRawUrl === false)).toBe(true);
    expect(plan.actions.every((item) => item.proof.allowsPayloadDownload === false)).toBe(true);
  });

  test("defines production connector contracts for Tor, I2P, and Freenet metadata only", () => {
    const contracts = restrictedMetadataProductionBoundaryContracts();
    expect(contracts.map((contract) => contract.network).sort()).toEqual(["freenet", "i2p", "tor"]);
    expect(contracts.map((contract) => contract.sourceType).sort()).toEqual(["freenet_metadata", "i2p_metadata", "tor_metadata"]);

    for (const contract of contracts) {
      expect(contract).toMatchObject({
        metadataOnly: true,
        storage: {
          storageKind: "metadata_only",
          rawBodyStored: false,
          rawUrlStoredInApi: false,
          objectRefStored: false
        },
        redaction: {
          url: "hash_only",
          rawBody: "drop",
          credentials: "reject"
        }
      });
      expect(contract.maxConcurrency).toBeLessThanOrEqual(2);
      expect(contract.requiredMetadataFields).toEqual(expect.arrayContaining([
        "actor",
        "victim",
        "claim_date",
        "sector",
        "country",
        "claimed_data_type",
        "url_hash",
        "screenshot_hash",
        "policy_audit_id",
        "provenance"
      ]));
      expect(contract.forbiddenOperations).toEqual(expect.arrayContaining([
        "stolen_file_download",
        "credential_bypass",
        "captcha_solving",
        "threat_actor_interaction",
        "stealth_or_evasion",
        "non_metadata_capture"
      ]));
      expect(contract.productionControls).toEqual(expect.arrayContaining([
        "approval_gate",
        "kill_switch",
        "retention_rule",
        "audit_event",
        "redaction"
      ]));
    }
  });

  test("redaction DTOs drop unsafe URLs, raw bodies, and object references before API output", () => {
    const capture: RawCapture = {
      ...darknetCapture({
        id: "cap_synthetic_ransomware",
        actor: "SyntheticLocker",
        victim: "Example Manufacturing",
        urlHash: "urlhash_synthetic_listing",
        policyAuditId: "policy_synthetic_listing"
      }),
      url: "http://user:pass@unsafeclaims.onion/download/customer-dump.zip",
      body: "raw leaked customer records should never be exposed",
      objectRef: {
        bucket: "restricted",
        key: "unsafe/customer-dump.zip",
        sizeBytes: 42,
        sha256: "unsafe-object-sha"
      }
    };

    const dto = restrictedMetadataRedactionDtoFromCapture(capture);
    expect(dto).toMatchObject({
      captureId: "cap_synthetic_ransomware",
      sourceId: "src_darknet",
      metadataOnly: true,
      storageKind: "metadata_only",
      bodyRedacted: true,
      objectRefRedacted: true,
      rawUrlRedacted: true,
      urlHash: "urlhash_synthetic_listing",
      screenshotHash: "screenhash_restricted",
      policyAuditId: "policy_synthetic_listing",
      safeForApi: true,
      allowedFields: expect.arrayContaining(["actor", "victim", "url_hash", "policy_audit_id"]),
      forbiddenOperations: expect.arrayContaining(["stolen_file_download", "credential_bypass", "non_metadata_capture"]),
      rejectedFields: expect.arrayContaining(["url", "body", "objectRef", "credential", "password"])
    });
    const serialized = JSON.stringify(dto).toLowerCase();
    for (const unsafe of ["http://", "unsafeclaims.onion", "user:pass", "customer-dump.zip", "raw leaked", "bucket"]) {
      expect(serialized).not.toContain(unsafe);
    }
  });

  test("production audit events expose approval, kill-switch, retention, policy, redaction, and capture states safely", () => {
    const unsafeSource = source({
      id: "src_policy_block_event",
      url: "http://unsafeevent.onion/download/customer.zip"
    });
    const blockedBridge = restrictedMetadataApprovalBridge({
      source: unsafeSource,
      targetUrl: unsafeSource.url,
      proxyBoundary: boundary
    });
    const capture = darknetCapture({
      id: "cap_event",
      sourceId: unsafeSource.id,
      policyAuditId: blockedBridge.policyAuditId,
      urlHash: blockedBridge.urlHash
    });
    const events = restrictedMetadataProductionAuditEvents({
      source: unsafeSource,
      bridge: blockedBridge,
      capture,
      occurredAt: "2026-05-24T04:00:00.000Z"
    });

    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "policy_block",
      "redaction_applied",
      "metadata_only_capture"
    ]));
    expect(events.every((event) => event.metadataOnly && event.safeForApi)).toBe(true);
    expect(events.every((event) => event.allowedFields.includes("policy_audit_id"))).toBe(true);
    expect(events.every((event) => event.forbiddenOperations.includes("stolen_file_download"))).toBe(true);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("unsafeevent.onion");
    expect(serialized).not.toContain("customer.zip");

    const killSwitchEvents = restrictedMetadataProductionAuditEvents({
      source: source({ id: "src_kill_event", status: "disabled" }),
      bridge: restrictedMetadataApprovalBridge({
        source: source({ id: "src_kill_event", status: "disabled" }),
        proxyBoundary: boundary
      }),
      occurredAt: "2026-05-24T04:00:00.000Z"
    });
    expect(killSwitchEvents.map((event) => event.eventType)).toContain("kill_switch");

    const retentionEvents = restrictedMetadataProductionAuditEvents({
      source: source({
        id: "src_retention_event",
        metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-23T00:00:00.000Z" }
      }),
      bridge: restrictedMetadataApprovalBridge({
        source: source({
          id: "src_retention_event",
          metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-23T00:00:00.000Z" }
        }),
        proxyBoundary: boundary,
        now: "2026-05-24T04:00:00.000Z"
      }),
      occurredAt: "2026-05-24T04:00:00.000Z"
    });
    expect(retentionEvents.map((event) => event.eventType)).toContain("retention_rule");
  });

  test("maps restricted metadata states to /v1/intel/search partial-result semantics", () => {
    const active = source({ id: "src_partial_ready", tags: ["akira"] });
    const pending = source({
      id: "src_partial_pending",
      tags: ["akira"],
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        policyVersion: "collection-policy:v1"
      },
      approvedAt: undefined,
      approvedBy: undefined
    });
    const killSwitch = source({ id: "src_partial_kill_switch", tags: ["akira"], status: "disabled" });
    const retention = source({
      id: "src_partial_retention",
      tags: ["akira"],
      metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-23T00:00:00.000Z" }
    });
    const unsafe = source({
      id: "src_partial_unsafe",
      tags: ["akira"],
      url: "http://unsafe-search.onion/download/customer-dump.zip"
    });

    const plan = planDarknetMetadataLiveSearch({
      query: "Akira",
      entityType: "actor",
      sources: [active, pending, killSwitch, retention, unsafe],
      captures: [darknetCapture({ id: "cap_partial", actor: "Akira", sourceId: active.id })],
      proxyBoundaries: { tor: boundary },
      maxTasks: 5
    });
    const semantics = restrictedMetadataIntelSearchPartialSemantics(plan);
    expect(semantics.map((item) => item.state)).toEqual(expect.arrayContaining([
      "metadata_only_ready",
      "pending_approval",
      "kill_switch_active",
      "retention_expiring",
      "blocked_unsafe_target"
    ]));
    expect(semantics.find((item) => item.sourceId === active.id)).toMatchObject({
      state: "metadata_only_ready",
      publicStatus: "queued_metadata_only",
      canQueueMetadataOnly: true,
      safeForApi: true
    });
    expect(semantics.find((item) => item.sourceId === unsafe.id)).toMatchObject({
      state: "blocked_unsafe_target",
      publicStatus: "blocked",
      canQueueMetadataOnly: false,
      urlHash: expect.any(String)
    });
    expect(JSON.stringify(semantics)).not.toContain("unsafe-search.onion");
    expect(JSON.stringify(semantics)).not.toContain("customer-dump.zip");

    const disabledSemantics = restrictedMetadataIntelSearchPartialSemantics(planDarknetMetadataLiveSearch({
      query: "Akira",
      entityType: "actor",
      sources: [],
      disabled: true
    }));
    expect(disabledSemantics).toEqual([expect.objectContaining({
      state: "restricted_disabled",
      publicStatus: "disabled",
      safeForApi: true
    })]);
  });

  test("builds Agent 06 and Agent 09 metadata-only evidence handoff DTOs", () => {
    const capture = darknetCapture({
      id: "cap_handoff",
      actor: "SyntheticLocker",
      victim: "Example Manufacturing",
      urlHash: "urlhash_handoff",
      policyAuditId: "policy_handoff"
    });
    const handoff = restrictedMetadataEvidenceHandoffFromCapture(capture);

    expect(handoff).toMatchObject({
      captureId: "cap_handoff",
      sourceId: "src_darknet",
      tenantId: "tenant_darknet",
      metadataOnly: true,
      storageKind: "metadata_only",
      retentionClass: "restricted_metadata",
      actor: "SyntheticLocker",
      victim: "Example Manufacturing",
      claimedDate: "2026-05-20",
      sector: "Energy",
      country: "NO",
      claimedDataType: "contracts",
      claimedDataCategory: "contracts",
      urlHash: "urlhash_handoff",
      screenshotHash: "screenhash_restricted",
      policyDecision: {
        policyAuditId: "policy_handoff",
        metadataOnly: true
      },
      redactionStatus: {
        bodyRedacted: true,
        rawUrlRedacted: true,
        safeForApi: true
      },
      safeForApi: true
    });
    expect(handoff?.agent06StorageFields).toEqual(expect.arrayContaining([
      "actor",
      "victim",
      "claimedDate",
      "sector",
      "country",
      "claimedDataType",
      "urlHash",
      "screenshotHash",
      "policyDecision",
      "redactionStatus"
    ]));
    expect(handoff?.agent09ApiFields).toEqual(handoff?.agent06StorageFields);
    const serialized = JSON.stringify(handoff);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("raw leaked");
  });

  test("summarizes runtime isolation states for approvals kill switches proxy failures timeouts and policy repair", () => {
    const now = "2026-05-24T05:00:00.000Z";
    const proxyFailureBoundary: ApprovedProxyBoundary = {
      ...boundaryFor("tor"),
      health: {
        boundaryId: "tor-proxy-fixture",
        network: "tor",
        proxyType: "tor_socks",
        isolationId: "tor:tor-proxy-fixture:metadata-only",
        healthy: false,
        checkedAt: now,
        timeoutClass: "metadata_standard",
        resolutionFailure: "proxy_unavailable",
        fetchFailure: "proxy_failure",
        screenshotHashMode: "hash_only"
      }
    };
    const timeoutBoundary: ApprovedProxyBoundary = {
      ...boundaryFor("tor"),
      health: {
        boundaryId: "tor-proxy-fixture",
        network: "tor",
        proxyType: "tor_socks",
        isolationId: "tor:tor-proxy-fixture:metadata-only",
        healthy: false,
        checkedAt: now,
        timeoutClass: "metadata_standard",
        resolutionFailure: "timeout",
        fetchFailure: "timeout",
        screenshotHashMode: "hash_only"
      }
    };
    const cases = [
      {
        expected: "pending_approval",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({
            id: "src_runtime_pending",
            governance: { approvalRequired: true, approvalState: "pending", metadataOnly: true, policyVersion: "collection-policy:v1" },
            approvedAt: undefined,
            approvedBy: undefined
          }),
          proxyBoundary: boundaryFor("tor"),
          now
        })
      },
      {
        expected: "approved_metadata_only",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({ id: "src_runtime_approved" }),
          proxyBoundary: boundaryFor("tor"),
          capture: darknetCapture({ id: "cap_runtime_approved", sourceId: "src_runtime_approved" }),
          now
        })
      },
      {
        expected: "kill_switch_active",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({ id: "src_runtime_kill", status: "disabled" }),
          proxyBoundary: boundaryFor("tor"),
          now
        })
      },
      {
        expected: "unsafe_target_blocked",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({ id: "src_runtime_unsafe", url: "http://runtimeunsafe.onion/download/customer.zip" }),
          proxyBoundary: boundaryFor("tor"),
          now
        })
      },
      {
        expected: "retention_expiring",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({
            id: "src_runtime_retention",
            metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-25T00:00:00.000Z" }
          }),
          proxyBoundary: boundaryFor("tor"),
          now,
          retentionExpiringWithinDays: 3
        })
      },
      {
        expected: "proxy_failure",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({ id: "src_runtime_proxy_failure" }),
          proxyBoundary: proxyFailureBoundary,
          now
        })
      },
      {
        expected: "timeout",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({ id: "src_runtime_timeout" }),
          proxyBoundary: timeoutBoundary,
          now
        })
      },
      {
        expected: "policy_repair",
        contract: restrictedMetadataRuntimeIsolationContract({
          source: source({ id: "src_runtime_repair", accessMethod: "public_http" }),
          proxyBoundary: boundaryFor("tor"),
          now
        })
      }
    ] as const;

    expect(cases.map((item) => item.contract.state)).toEqual(cases.map((item) => item.expected));
    for (const { contract } of cases) {
      expect(contract).toMatchObject({
        metadataOnly: true,
        safeForApi: true,
        runtime: {
          directEgressAllowed: false,
          browserStealthAllowed: false,
          accountAutomationAllowed: false,
          dnsLeakPreventionAssumptions: expect.arrayContaining([
            "all darknet name resolution stays inside the approved proxy boundary"
          ])
        },
        agent10ResourceBudget: {
          scraperTargetMb: 98304,
          restrictedWorkerPoolMaxConcurrency: 4,
          estimatedWorkerMemoryMb: 512,
          withinTarget: true
        },
        forbiddenOperations: expect.arrayContaining([
          "stolen_file_download",
          "credential_bypass",
          "captcha_solving",
          "threat_actor_interaction"
        ])
      });
      const maxConcurrency = Number(contract.runtime.maxConcurrency);
      expect(Number.isFinite(maxConcurrency)).toBe(true);
      expect(maxConcurrency).toBeLessThanOrEqual(2);
    }
    expect(cases.find((item) => item.expected === "approved_metadata_only")?.contract.evidenceHandoff).toMatchObject({
      metadataOnly: true,
      redactionStatus: { bodyRedacted: true, safeForApi: true }
    });
    expect(cases.find((item) => item.expected === "proxy_failure")?.contract.policyRepair).toMatchObject({
      required: true,
      action: "assign_approved_proxy"
    });
    expect(cases.find((item) => item.expected === "timeout")?.contract.proxyBoundary).toMatchObject({
      healthy: false,
      fetchFailure: "timeout"
    });
    const serialized = JSON.stringify(cases.map((item) => item.contract));
    expect(serialized).not.toContain("runtimeunsafe.onion");
    expect(serialized).not.toContain("customer.zip");
  });

  test("builds restricted metadata compliance packets and safe Agent 09 and Agent 10 summaries", () => {
    const packet = buildRestrictedMetadataCompliancePacket({
      source: source({
        id: "src_compliance_clean",
        tenantId: "tenant_darknet",
        metadata: { approvalId: "approval_clean" },
        governance: {
          approvalRequired: true,
          approvalState: "approved",
          metadataOnly: true,
          approvedAt: "2026-05-24T00:00:00.000Z",
          approvedBy: "operator",
          reviewTicket: "LEGAL-123",
          policyVersion: "collection-policy:v1"
        }
      }),
      proxyBoundary: boundaryFor("tor"),
      capture: darknetCapture({
        id: "cap_compliance_clean",
        sourceId: "src_compliance_clean",
        policyAuditId: "policy_clean",
        urlHash: "urlhash_clean"
      }),
      now: "2026-05-24T05:30:00.000Z",
      operatorId: "operator",
      runId: "run_compliance"
    });
    const search = restrictedMetadataComplianceSummaryForSearch(packet);
    const promotion = restrictedMetadataComplianceSummaryForPromotion(packet);

    expect(packet).toMatchObject({
      sourceId: "src_compliance_clean",
      tenantId: "tenant_darknet",
      approvalId: "approval_clean",
      operator: "operator",
      policyVersion: "collection-policy:v1",
      connectorKind: "tor_metadata",
      network: "tor",
      killSwitchState: "inactive",
      metadataOnly: true,
      safeForApi: true,
      approvalExpired: false,
      screenshotHashOnly: true,
      redactionProof: {
        bodyRedacted: true,
        rawUrlRedacted: true,
        objectRefRedacted: true,
        urlHash: "urlhash_clean",
        screenshotHash: "screenhash_restricted"
      },
      forbiddenActionChecks: {
        credentialBypass: false,
        captchaSolving: false,
        threatActorInteraction: false,
        stolenFileDownload: false,
        stealthOrEvasion: false,
        unapprovedProxy: false,
        nonMetadataCapture: false,
        unsafeTargetBlocked: false
      }
    });
    expect(packet.statuses).toEqual(expect.arrayContaining(["screenshot_hash_only", "audit_clean"]));
    expect(packet.auditEventIds.length).toBeGreaterThan(0);
    expect(search).toMatchObject({
      sourceId: "src_compliance_clean",
      metadataOnly: true,
      safeForApi: true,
      redactionProof: {
        bodyRedacted: true,
        rawUrlRedacted: true,
        objectRefRedacted: true,
        urlHash: "urlhash_clean"
      }
    });
    expect(promotion).toMatchObject({
      status: "pass",
      promotionBlockers: [],
      metadataOnly: true,
      safeForApi: true,
      agent10SoakFields: {
        killSwitchState: "inactive",
        policyBlocks: 0,
        legalHold: false
      }
    });
    const serialized = JSON.stringify({ packet, search, promotion });
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("customer");
    expect(serialized).not.toContain("user:pass");
  });

  test("classifies compliance packets for approval expiry kill switch unsafe target retention and legal hold", () => {
    const now = "2026-05-24T05:45:00.000Z";
    const packets = {
      approvalExpired: buildRestrictedMetadataCompliancePacket({
        source: source({
          id: "src_compliance_expired_approval",
          governance: {
            approvalRequired: true,
            approvalState: "approved",
            metadataOnly: true,
            approvedAt: "2026-05-20T00:00:00.000Z",
            approvedBy: "operator",
            approvalExpiresAt: "2026-05-23T00:00:00.000Z",
            policyVersion: "collection-policy:v1"
          }
        }),
        proxyBoundary: boundaryFor("tor"),
        now
      }),
      killSwitch: buildRestrictedMetadataCompliancePacket({
        source: source({ id: "src_compliance_kill", status: "disabled" }),
        proxyBoundary: boundaryFor("tor"),
        now
      }),
      forbiddenTarget: buildRestrictedMetadataCompliancePacket({
        source: source({ id: "src_compliance_forbidden", url: "http://forbiddenclaims.onion/download/customer-dump.zip" }),
        proxyBoundary: boundaryFor("tor"),
        targetUrl: "http://forbiddenclaims.onion/download/customer-dump.zip",
        now
      }),
      retentionExpired: buildRestrictedMetadataCompliancePacket({
        source: source({
          id: "src_compliance_retention_expired",
          metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-23T00:00:00.000Z" }
        }),
        proxyBoundary: boundaryFor("tor"),
        now
      }),
      legalHold: buildRestrictedMetadataCompliancePacket({
        source: source({
          id: "src_compliance_legal_hold",
          metadata: { retentionClass: "legal_hold", legalHold: true }
        }),
        proxyBoundary: boundaryFor("tor"),
        capture: { ...darknetCapture({ id: "cap_compliance_legal_hold", sourceId: "src_compliance_legal_hold" }), legalHold: true, retentionClass: "legal_hold" },
        now
      })
    };

    expect(packets.approvalExpired.statuses).toContain("approval_expired");
    expect(restrictedMetadataComplianceSummaryForPromotion(packets.approvalExpired)).toMatchObject({
      status: "hold",
      promotionBlockers: expect.arrayContaining(["approval_expired"])
    });
    expect(packets.killSwitch.statuses).toContain("kill_switch_active");
    expect(restrictedMetadataComplianceSummaryForPromotion(packets.killSwitch)).toMatchObject({
      status: "rollback",
      promotionBlockers: expect.arrayContaining(["kill_switch_active"])
    });
    expect(packets.forbiddenTarget.statuses).toContain("forbidden_target_blocked");
    expect(packets.forbiddenTarget.forbiddenActionChecks.unsafeTargetBlocked).toBe(true);
    expect(restrictedMetadataComplianceSummaryForPromotion(packets.forbiddenTarget)).toMatchObject({
      status: "rollback",
      agent10SoakFields: { policyBlocks: 1 }
    });
    expect(packets.retentionExpired.statuses).toContain("retention_expired");
    expect(packets.legalHold).toMatchObject({
      legalHold: true,
      retentionClass: "legal_hold",
    });
    expect(packets.legalHold.statuses).toEqual(expect.arrayContaining(["legal_hold", "audit_clean"]));
    const serialized = JSON.stringify(packets);
    expect(serialized).not.toContain("forbiddenclaims.onion");
    expect(serialized).not.toContain("customer-dump.zip");
    expect(serialized).not.toContain("http://");
  });

  test("builds restricted network operations readiness status fixtures and remediation plans", () => {
    const now = "2026-05-24T06:35:00.000Z";
    const sources = [
      source({
        id: "src_ops_ready",
        type: "tor_metadata",
        metadata: { approvalId: "approval_ops_ready", retentionClass: "restricted_metadata" }
      }),
      source({
        id: "src_ops_proxy_hold",
        type: "i2p_metadata",
        metadata: { approvalId: "approval_ops_i2p", retentionClass: "darknet_metadata" }
      }),
      source({
        id: "src_ops_disabled",
        type: "freenet_metadata",
        status: "disabled",
        accessMethod: "disabled",
        metadata: { retentionClass: "restricted_metadata" }
      }),
      source({
        id: "src_ops_forbidden",
        type: "tor_metadata",
        url: "http://opsclaims.onion/download/customer-dump.zip",
        metadata: { retentionClass: "restricted_metadata" }
      })
    ];
    const unhealthyI2p = {
      ...boundaryFor("i2p"),
      health: {
        boundaryId: "i2p-proxy-fixture",
        network: "i2p" as const,
        proxyType: "i2p_http" as const,
        isolationId: "i2p:i2p-proxy-fixture:metadata-only",
        healthy: false,
        checkedAt: now,
        timeoutClass: "metadata_slow" as const,
        resolutionFailure: "none" as const,
        fetchFailure: "proxy_failure" as const,
        screenshotHashMode: "hash_only" as const
      }
    };
    const captures = [
      darknetCapture({ id: "cap_ops_ready", sourceId: "src_ops_ready", urlHash: "urlhash_ops_ready" }),
      { ...darknetCapture({ id: "cap_ops_proxy", sourceId: "src_ops_proxy_hold", urlHash: "urlhash_ops_proxy" }), body: undefined, objectRef: undefined }
    ];
    const ready = buildRestrictedMetadataOperationsReadiness({
      source: sources[0],
      proxyBoundary: boundaryFor("tor"),
      capture: captures[0],
      now,
      operatorId: "operator",
      runId: "run_ops"
    });
    const status = buildRestrictedMetadataOperationsStatus({
      sources,
      captures,
      proxyBoundaries: {
        tor: boundaryFor("tor"),
        i2p: unhealthyI2p,
        freenet: boundaryFor("freenet")
      },
      generatedAt: now,
      operatorId: "operator",
      runId: "run_ops"
    });
    const fixtures = restrictedMetadataConnectorFixtures();
    const handoffProof = restrictedMetadataEvidenceHandoffSafetyProof(captures.map((capture) => restrictedMetadataEvidenceHandoffFromCapture(capture)).filter((handoff): handoff is NonNullable<typeof handoff> => Boolean(handoff)));

    expect(ready).toMatchObject({
      sourceId: "src_ops_ready",
      readiness: "ready",
      metadataOnly: true,
      safeForApi: true,
      endpoints: {
        intelSearchField: "/v1/intel/search.restrictedMetadata",
        statusRoute: "/v1/restricted-metadata/status",
        agent10SoakPacketField: "restrictedMetadata"
      },
      proxyIsolation: {
        approved: true,
        directEgressAllowed: false,
        timeoutClass: "metadata_standard"
      },
      redactionGuarantees: {
        bodyRedacted: true,
        rawUrlRedacted: true,
        objectRefRedacted: true,
        fileNameRedacted: true,
        screenshotHashOnly: true
      },
      forbiddenActionCounters: {
        credentialBypassAttempts: 0,
        stolenFileDownloadAttempts: 0,
        unsafeTargetAttempts: 0
      }
    });
    expect(status.endpoint).toBe("/v1/restricted-metadata/status");
    expect(status.summary.ready).toBeGreaterThanOrEqual(1);
    expect(status.summary.hold).toBeGreaterThanOrEqual(1);
    expect(status.summary.rollback).toBeGreaterThanOrEqual(1);
    expect(ready.runtimeProofs.map((proof) => proof.kind)).toEqual(expect.arrayContaining([
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
    expect(status.runtimeProofs.filter((proof) => proof.observed).map((proof) => proof.kind)).toEqual(expect.arrayContaining([
      "proxy_failure",
      "kill_switch_transition",
      "unsafe_target_rejection",
      "disabled_source_rollback"
    ]));
    expect(status.runtimeProofs.every((proof) => proof.metadataOnly && proof.safeForApi)).toBe(true);
    expect(status.runtimeProofs.flatMap((proof) => proof.forbiddenAlternatives)).toEqual(expect.arrayContaining([
      "payload download remains prohibited",
      "credential or authentication bypass remains prohibited",
      "CAPTCHA solving remains prohibited",
      "threat actor interaction remains prohibited"
    ]));
    expect(status.operationalSla).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      status: "breach",
      proofCommand: "bun run check:restricted-metadata-status",
      metrics: {
        sourceCount: sources.length,
        metadataOnlyEvidenceYield: 2,
        proxyFailureCount: 1,
        unsafeRejectionCount: 1
      }
    });
    expect(status.auditTrail).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      unsafeFieldsExposed: false
    });
    expect(status.auditTrail.rejectedFields).toEqual(expect.arrayContaining(["rawUrl", "body", "fileName", "credentials", "payloadReference"]));
    expect(status.agent10ReleasePacket).toMatchObject({
      owner: "Agent 05",
      runtimeProofName: "restricted_metadata_sla",
      decision: "rollback",
      enforcementLevel: "emergency_stop",
      emergencyStopState: "active",
      proofCommand: "bun run check:restricted-metadata-status",
      applyPlanProofCommand: "bun run check:restricted-metadata-apply-plan",
      metadataOnly: true,
      safeForApi: true
    });
    expect(status.enforcement).toMatchObject({
      level: "emergency_stop",
      metadataOnly: true,
      safeForApi: true,
      emergencyStop: {
        state: "active",
        dryRunOnly: true,
        workerAction: "pause_restricted_metadata_workers",
        releaseEffect: "rollback"
      },
      agent06LedgerRedactionGate: "hold"
    });
    expect(status.enforcement.activeRules.map((rule) => rule.rule)).toEqual(expect.arrayContaining([
      "kill_switch_emergency_stop",
      "proxy_isolation_failure_hold",
      "redaction_repair_hold",
      "forbidden_action_attempt_emergency_stop"
    ]));
    expect(status.enforcement.agent09WarningCodes).toEqual(expect.arrayContaining([
      "restricted_metadata_forbidden_action",
      "restricted_metadata_proxy_failure"
    ]));
    expect(status.enforcement.dryRunRepairActions).toEqual(expect.arrayContaining([
      "quarantine_proxy",
      "repair_redaction",
      "activate_kill_switch"
    ]));
    expect(status.governancePackets.length).toBe(sources.length);
    expect(status.governancePackets[0]).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      approval: {
        legalBasis: "metadata_only_legal_ethics_review"
      },
      redactionPolicy: {
        bodyRedacted: true,
        rawUrlRedacted: true,
        fileNameRedacted: true,
        objectKeyRedacted: true,
        credentialsRedacted: true,
        payloadReferenceRedacted: true
      },
      proof: {
        noStolenFilesStored: true,
        noRawPayloadsStored: true,
        noAuthBypass: true,
        noCaptchaSolving: true,
        noActorInteraction: true
      }
    });
    expect(status.governancePackets.flatMap((packet) => packet.networks).sort()).toEqual(expect.arrayContaining(["freenet", "i2p", "tor"]));
    expect(status.auditReplay).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      agent10ReleaseEffect: "rollback"
    });
    expect(status.auditReplay.observedScenarios).toEqual(expect.arrayContaining([
      "allowed_metadata_only_record",
      "kill_switch_active",
      "proxy_isolation_failure",
      "unsafe_action_attempt",
      "redaction_repair"
    ]));
    expect(status.auditReplay.scenarios.every((scenario) => scenario.metadataOnly && scenario.safeForApi && scenario.evidence.actorVictimDateSectorCountryClaimTypeOnly)).toBe(true);
    expect(status.agent10ReleasePacket.governancePacketIds.length).toBe(status.governancePackets.length);
    expect(status.agent10ReleasePacket.auditReplayScenarios).toEqual(expect.arrayContaining(["unsafe_action_attempt", "redaction_repair"]));
    expect(status.connectorCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      agent10ReleaseEffect: "rollback",
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.connectorCertification.fixtureScenarios).toEqual(expect.arrayContaining([
      "healthy_approved_metadata_source",
      "expired_approval",
      "kill_switch",
      "proxy_isolation_failure",
      "high_timeout",
      "unsafe_link_form_download",
      "redaction_repair",
      "legal_hold",
      "retention_expiry",
      "low_yield_source"
    ]));
    expect(status.connectorCertification.observedScenarios).toEqual(expect.arrayContaining([
      "healthy_approved_metadata_source",
      "kill_switch",
      "proxy_isolation_failure",
      "unsafe_link_form_download"
    ]));
    expect(status.connectorCertifications.length).toBe(sources.length);
    expect(status.connectorCertifications.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload &&
      packet.guarantees.noCredentialBypass &&
      packet.guarantees.noCaptchaSolving &&
      packet.guarantees.noStealth &&
      packet.networkIsolation.directEgressAllowed === false &&
      packet.redaction.rawUrlRedacted &&
      packet.redaction.payloadReferenceRedacted
    )).toBe(true);
    expect(status.agent10ReleasePacket.certificationPacketIds.length).toBe(status.connectorCertifications.length);
    expect(status.agent10ReleasePacket.certificationScenarios).toEqual(expect.arrayContaining(["unsafe_link_form_download", "proxy_isolation_failure"]));
    expect(status.killSwitchDrills).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      operatorVisible: true,
      agent10RcGateDecision: "rollback",
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.killSwitchDrills.fixtureScenarios).toEqual(expect.arrayContaining([
      "healthy_metadata_only_canary",
      "kill_switch_activation_mid_run",
      "expired_approval",
      "proxy_failure",
      "redaction_repair",
      "legal_hold",
      "retention_expiry",
      "low_yield_source",
      "unsafe_download_form_contact_link",
      "public_api_blocked_state"
    ]));
    expect(status.killSwitchDrills.observedScenarios).toEqual(expect.arrayContaining([
      "healthy_metadata_only_canary",
      "kill_switch_activation_mid_run",
      "proxy_failure",
      "unsafe_download_form_contact_link",
      "public_api_blocked_state"
    ]));
    expect(status.killSwitchDrills.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload &&
      packet.unsafeTargetRejection.representedByHashOnly &&
      packet.proxyIsolation.directEgressAllowed === false
    )).toBe(true);
    expect(status.agent10ReleasePacket.killSwitchDrillPacketIds.length).toBe(status.killSwitchDrills.packets.length);
    expect(status.agent10ReleasePacket.killSwitchDrillScenarios).toEqual(expect.arrayContaining(["public_api_blocked_state", "kill_switch_activation_mid_run"]));
    expect(status.emergencyStopCertification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      agent10RcGateDecision: "rollback",
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.emergencyStopCertification.fixtureScenarios).toEqual(expect.arrayContaining([
      "healthy_metadata_only_canary",
      "expired_approval",
      "kill_switch_propagation",
      "proxy_isolation_failure",
      "timeout_spike",
      "unsafe_download_form_contact_target",
      "redaction_repair",
      "retention_expiry",
      "legal_hold",
      "low_yield_source",
      "public_api_blocked_state"
    ]));
    expect(status.emergencyStopCertification.observedScenarios).toEqual(expect.arrayContaining([
      "healthy_metadata_only_canary",
      "kill_switch_propagation",
      "proxy_isolation_failure",
      "unsafe_download_form_contact_target",
      "public_api_blocked_state"
    ]));
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
    expect(status.agent10ReleasePacket.emergencyStopCertificationPacketIds.length).toBe(status.emergencyStopCertification.packets.length);
    expect(status.agent10ReleasePacket.emergencyStopCertificationScenarios).toEqual(expect.arrayContaining(["public_api_blocked_state", "kill_switch_propagation"]));
    expect(status.nonBlockingSearch).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      nonBlockingPublicSearch: true,
      maxPublicSearchAddedLatencyMs: 0,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.nonBlockingSearch.fixtureScenarios).toEqual(expect.arrayContaining([...NON_BLOCKING_SEARCH_SCENARIOS]));
    for (const scenario of ["approved_metadata_canary", "kill_switch", "proxy_failure", "unsafe_target", "actor_query"]) {
      expect(status.nonBlockingSearch.observedScenarios).toContain(scenario);
    }
    expect(status.nonBlockingSearch.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.publicSearchAction === "continue_clear_web_and_public_channel" &&
      packet.proof.doesNotBlockPublicSearch &&
      packet.proof.doesNotPromoteRestrictedFacts &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(status.agent09SearchFields).toContain("nonBlockingSearch");
    expect(status.agent10SoakFields).toContain("nonBlockingSearch");
    expect(ready.operationalSla.metrics.approvalAgeMaxDays).toBeGreaterThanOrEqual(0);
    expect(ready.governancePacket.sourceId).toBe("src_ops_ready");
    expect(ready.auditReplay.observedScenarios).toContain("allowed_metadata_only_record");
    expect(ready.connectorCertification.observedScenarios).toContain("healthy_approved_metadata_source");
    expect(ready.killSwitchDrills.observedScenarios).toContain("healthy_metadata_only_canary");
    expect(ready.emergencyStopCertification.observedScenarios).toContain("healthy_metadata_only_canary");
    expect(ready.nonBlockingSearch.observedScenarios).toContain("approved_metadata_canary");
    expect(ready.auditTrail.eventTypes).toEqual(expect.arrayContaining(["redaction_applied", "metadata_only_capture"]));
    expect(status.remediationPlan.map((item) => item.action)).toEqual(expect.arrayContaining([
      "quarantine_proxy",
      "rollback_disabled_source",
      "activate_kill_switch"
    ]));
    expect(status.agent06EvidenceHandoffProof).toMatchObject({
      unsafeDetected: false,
      agent06StorageContract: "metadata_only_no_body_object_url_filename_credentials_or_payload_reference",
      agent09ApiContract: "hashes_claim_fields_policy_and_status_only"
    });
    expect(fixtures.map((fixture) => fixture.network).sort()).toEqual(["freenet", "i2p", "tor"]);
    expect(fixtures.every((fixture) => fixture.metadataOnly && fixture.urlHash && fixture.actor && fixture.victim && fixture.claimedDataType)).toBe(true);
    expect(handoffProof.rejectedFields).toEqual(expect.arrayContaining(["body", "objectKey", "fileName", "credentials", "payloadReference"]));
    const serialized = JSON.stringify({ ready, status, fixtures, handoffProof });
    expect(serialized).not.toContain("opsclaims.onion");
    expect(serialized).not.toContain("customer-dump.zip");
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("body:");
  });

  test("freezes restricted connector certification fixtures without unsafe serialization", () => {
    const certification = restrictedMetadataConnectorCertificationContract();
    expect(certification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(certification.fixtureScenarios).toEqual([
      "healthy_approved_metadata_source",
      "expired_approval",
      "kill_switch",
      "proxy_isolation_failure",
      "high_timeout",
      "unsafe_link_form_download",
      "redaction_repair",
      "legal_hold",
      "retention_expiry",
      "low_yield_source"
    ]);
    expect(certification.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload &&
      packet.guarantees.noCredentialBypass &&
      packet.guarantees.noCaptchaSolving &&
      packet.guarantees.noStealth &&
      packet.redaction.rawUrlRedacted &&
      packet.redaction.bodyRedacted &&
      packet.redaction.fileNameRedacted &&
      packet.networkIsolation.directEgressAllowed === false
    )).toBe(true);
    expect(certification.packets.find((packet) => packet.scenario === "unsafe_link_form_download")).toMatchObject({
      status: "emergency_stop",
      guarantees: {
        unsafeTargetRejected: true
      },
      agent10EmergencyStopReleaseTrain: {
        decision: "rollback",
        proofCommand: "bun run check:restricted-metadata-status"
      }
    });
    const serialized = JSON.stringify(certification);
    for (const forbidden of ["http://", ".onion", "customer-dump", "user:pass", "raw leak", "payload body"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("freezes restricted kill-switch drill fixtures without unsafe serialization", () => {
    const drills = restrictedMetadataKillSwitchDrillContract();
    expect(drills).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      operatorVisible: true,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(drills.fixtureScenarios).toEqual([
      "healthy_metadata_only_canary",
      "kill_switch_activation_mid_run",
      "expired_approval",
      "proxy_failure",
      "redaction_repair",
      "legal_hold",
      "retention_expiry",
      "low_yield_source",
      "unsafe_download_form_contact_link",
      "public_api_blocked_state"
    ]);
    expect(drills.packets.every((packet) =>
      packet.metadataOnly &&
      packet.safeForApi &&
      packet.dryRunOnly &&
      packet.operatorVisible &&
      packet.noLeakSerialization.passed &&
      packet.guarantees.noContact &&
      packet.guarantees.noDownload &&
      packet.guarantees.noCredentialBypass &&
      packet.guarantees.noCaptchaSolving &&
      packet.guarantees.noStealth &&
      packet.unsafeTargetRejection.representedByHashOnly
    )).toBe(true);
    expect(drills.packets.find((packet) => packet.scenario === "kill_switch_activation_mid_run")).toMatchObject({
      killSwitchPropagation: {
        simulatedMidRun: true,
        workerAction: "pause_restricted_metadata_workers",
        publicApiState: "blocked"
      },
      agent10RcGate: {
        gate: "restricted_emergency_stop_rc",
        decision: "rollback"
      }
    });
    expect(drills.packets.find((packet) => packet.scenario === "public_api_blocked_state")).toMatchObject({
      killSwitchPropagation: {
        publicApiState: "blocked"
      }
    });
    const serialized = JSON.stringify(drills);
    for (const forbidden of ["http://", ".onion", "customer-dump", "user:pass", "raw leak", "payload body"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("freezes restricted emergency-stop certification fixtures without unsafe serialization", () => {
    const certification = restrictedMetadataEmergencyStopCertificationContract();
    expect(certification).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      dryRunOnly: true,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(certification.fixtureScenarios).toEqual([
      "healthy_metadata_only_canary",
      "expired_approval",
      "kill_switch_propagation",
      "proxy_isolation_failure",
      "timeout_spike",
      "unsafe_download_form_contact_target",
      "redaction_repair",
      "retention_expiry",
      "legal_hold",
      "low_yield_source",
      "public_api_blocked_state"
    ]);
    expect(certification.packets.every((packet) =>
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
    expect(certification.packets.find((packet) => packet.scenario === "kill_switch_propagation")).toMatchObject({
      controls: {
        canPauseWorkers: true,
        canRollback: true,
        canEmergencyStop: true
      },
      agent10EmergencyStopGate: {
        decision: "rollback"
      }
    });
    expect(certification.packets.find((packet) => packet.scenario === "public_api_blocked_state")).toMatchObject({
      controls: {
        publicApiBlockedState: true
      }
    });
    const serialized = JSON.stringify(certification);
    for (const forbidden of ["http://", ".onion", "customer-dump", "user:pass", "raw leak", "payload body"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("classifies runtime proof modes for approval retention legal hold timeout and redaction repair", () => {
    const now = "2026-05-24T07:05:00.000Z";
    const timeoutBoundary = {
      ...boundaryFor("tor"),
      health: {
        boundaryId: "tor-proxy-fixture",
        network: "tor" as const,
        proxyType: "tor_socks" as const,
        isolationId: "tor:tor-proxy-fixture:metadata-only",
        healthy: false,
        checkedAt: now,
        timeoutClass: "metadata_standard" as const,
        resolutionFailure: "none" as const,
        fetchFailure: "timeout" as const,
        screenshotHashMode: "hash_only" as const
      }
    };
    const status = buildRestrictedMetadataOperationsStatus({
      sources: [
        source({
          id: "src_runtime_approval_expired",
          governance: {
            approvalRequired: true,
            approvalState: "approved",
            metadataOnly: true,
            approvedAt: "2026-05-01T00:00:00.000Z",
            approvedBy: "operator",
            approvalExpiresAt: "2026-05-20T00:00:00.000Z",
            policyVersion: "collection-policy:v1"
          }
        }),
        source({
          id: "src_runtime_retention_expired",
          metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-20T00:00:00.000Z" }
        }),
        source({
          id: "src_runtime_legal_hold",
          metadata: { retentionClass: "legal_hold", legalHold: true }
        }),
        source({
          id: "src_runtime_timeout"
        })
      ],
      captures: [
        { ...darknetCapture({ id: "cap_runtime_legal_hold", sourceId: "src_runtime_legal_hold" }), legalHold: true, retentionClass: "legal_hold" }
      ],
      proxyBoundaries: { tor: timeoutBoundary },
      generatedAt: now,
      query: "Fjord Energy",
      entityType: "victim"
    });
    const observed = status.runtimeProofs.filter((proof) => proof.observed);
    expect(observed.map((proof) => proof.kind)).toEqual(expect.arrayContaining([
      "approval_expiry",
      "timeout",
      "retention_expiry",
      "legal_hold",
      "redaction_repair"
    ]));
    expect(observed.find((proof) => proof.kind === "approval_expiry")).toMatchObject({
      releaseEffect: "block",
      remediationActions: ["renew_approval"]
    });
    expect(observed.find((proof) => proof.kind === "retention_expiry")).toMatchObject({
      releaseEffect: "rollback",
      remediationActions: ["review_retention_expiry"]
    });
    expect(observed.find((proof) => proof.kind === "legal_hold")).toMatchObject({
      releaseEffect: "downgrade",
      evidence: { legalHold: true }
    });
    expect(observed.find((proof) => proof.kind === "timeout")).toMatchObject({
      releaseEffect: "downgrade",
      remediationActions: ["quarantine_proxy"]
    });
    expect(status.operationalSla.metrics).toMatchObject({
      approvalExpiredCount: 1,
      retentionExpiredCount: 1,
      legalHoldCount: 1
    });
    expect(status.operationalSla.metrics.timeoutCount).toBeGreaterThanOrEqual(1);
    expect(status.agent10ReleasePacket.runtimeProofName).toBe("restricted_metadata_sla");
    expect(status.enforcement.activeRules.map((rule) => rule.rule)).toEqual(expect.arrayContaining([
      "approval_expiry_hold",
      "retention_expiry_emergency_stop",
      "legal_hold_warning"
    ]));
    expect(status.auditReplay.observedScenarios).toEqual(expect.arrayContaining([
      "expired_approval",
      "retention_expiry",
      "legal_hold",
      "redaction_repair"
    ]));
    expect(status.query).toMatchObject({
      query: "Fjord Energy",
      entityType: "victim",
      matchingResultCount: 1,
      partialState: "partial_metadata"
    });
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("customer");
  });

  test("freezes restricted metadata apply-plan API contract examples without unsafe fields", () => {
    const contract = restrictedMetadataApplyPlanApiContract();
    expect(contract).toMatchObject({
      endpoint: "/v1/restricted-metadata/apply-plan",
      method: "POST",
      mode: "dry_run",
      response: {
        actions: expect.arrayContaining([
          "enable_metadata_only_queue",
          "disable_source",
          "renew_legal_notes",
          "approve_proxy_isolation",
          "apply_kill_switch",
          "shorten_retention",
          "keep_source_blocked"
        ]),
        safety: expect.arrayContaining([
          "automation_safe",
          "human_approval_required",
          "blocked",
          "rollback_only"
        ]),
        statuses: expect.arrayContaining([
          "disabled",
          "pending_approval",
          "ready_metadata_only",
          "blocked_unsafe_target",
          "kill_switch_active",
          "retention_expiring",
          "audit_clean"
        ]),
        forbiddenFields: expect.arrayContaining([
          "url",
          "rawUrl",
          "targetUrl",
          "body",
          "payload",
          "credential",
          "password",
          "screenshotBytes"
        ])
      }
    });
    expect(Object.keys(contract.examples).sort()).toEqual([
      "auditClean",
      "blockedUnsafeTarget",
      "disabled",
      "killSwitchActive",
      "pendingApproval",
      "readyMetadataOnly",
      "retentionExpiring"
    ]);
    expect(contract.examples.readyMetadataOnly).toMatchObject({
      action: "enable_metadata_only_queue",
      safety: "automation_safe",
      proof: {
        exposesRawUrl: false,
        allowsPayloadDownload: false,
        allowsAuthBypass: false,
        allowsCaptchaSolving: false,
        allowsPrivateCommunityAccess: false,
        allowsThreatActorInteraction: false
      }
    });
    expect(contract.examples.pendingApproval).toMatchObject({
      action: "renew_legal_notes",
      safety: "human_approval_required"
    });
    expect(contract.examples.blockedUnsafeTarget).toMatchObject({
      action: "keep_source_blocked",
      safety: "blocked"
    });
    expect(contract.examples.killSwitchActive).toMatchObject({
      action: "apply_kill_switch",
      safety: "rollback_only",
      expectedDiff: { killSwitch: "enabled" }
    });
    expect(contract.examples.retentionExpiring).toMatchObject({
      action: "shorten_retention",
      expectedDiff: { retentionClass: "shorten_restricted_window" }
    });
    for (const example of Object.values(contract.examples)) {
      expect(example.dryRunOnly).toBe(true);
      expect(example.metadataOnly).toBe(true);
      expect(example.prohibitedAlternatives).toEqual(expect.arrayContaining([
        "payload download remains prohibited",
        "credential or authentication bypass remains prohibited",
        "CAPTCHA solving remains prohibited",
        "private community access remains prohibited",
        "threat actor interaction remains prohibited",
        "unsafe restricted URLs remain redacted to hashes"
      ]));
      expect(example.proof.forbiddenOperations).toEqual(expect.arrayContaining(["stolen_file_download", "credential_bypass", "captcha_solving"]));
    }
    const serialized = JSON.stringify(contract);
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("customer-dump");
  });

  test("freezes restricted non-blocking search semantics without unsafe serialization", () => {
    const semantics = restrictedMetadataNonBlockingSearchContract();
    expect(semantics).toMatchObject({
      metadataOnly: true,
      safeForApi: true,
      nonBlockingPublicSearch: true,
      maxPublicSearchAddedLatencyMs: 0,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(semantics.fixtureScenarios).toEqual([...NON_BLOCKING_SEARCH_SCENARIOS]);
    expect(semantics.packets.map((packet) => packet.scenario)).toEqual(expect.arrayContaining([...NON_BLOCKING_SEARCH_SCENARIOS]));
    expect(semantics.packets.every((packet) =>
      packet.publicSearchAction === "continue_clear_web_and_public_channel" &&
      packet.proof.doesNotBlockPublicSearch &&
      packet.proof.doesNotPromoteRestrictedFacts &&
      packet.proof.noUnsafeAccess &&
      packet.proof.noDataExposure &&
      packet.proof.noContact &&
      packet.proof.noDownload &&
      packet.proof.noCredentialBypass &&
      packet.proof.noCaptchaSolving &&
      packet.proof.noStealth &&
      packet.proof.noRawPayloads &&
      packet.proof.noRawUrls &&
      packet.proof.hashOnlyEvidence &&
      packet.noLeakSerialization.passed
    )).toBe(true);
    expect(semantics.agent07PublicAnswerStates).toEqual(expect.arrayContaining(["restricted_context_only", "policy_hold_caveat"]));
    expect(semantics.agent10EmergencyStopDecisions).toEqual(expect.arrayContaining(["continue_public_search", "hold_restricted_context", "rollback_restricted_workers"]));
    const serialized = JSON.stringify(semantics).toLowerCase();
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("customer-dump");
  });
});
