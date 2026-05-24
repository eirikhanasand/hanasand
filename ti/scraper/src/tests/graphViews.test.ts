import { describe, expect, test } from "bun:test";
import {
  buildActorProfileGraphView,
  buildGraphCutoverReportApiDto,
  buildGraphCutoverReport,
  buildGraphBackendCutoverRehearsalDto,
  buildGraphAttackCampaignWorkspaceDto,
  buildGraphBackendRepositoryContractDto,
  buildCorrelationGraphQuery,
  buildCorrelationTimeline,
  buildGraphExportEnforcementDto,
  buildGraphLiveSearchUpdateDto,
  buildGraphExportSlaDto,
  buildGraphNeighborhoodView,
  buildGraphIntegrityReport,
  buildGraphQueryApiContract,
  buildGraphReviewApplyPlan,
  buildGraphReviewPlanApiDto,
  buildGraphReviewBatch,
  buildPersistedGraphSnapshot,
  buildRelationshipCursorDeltas,
  buildStixExportPreview,
  buildStixExportReadinessApiDto,
  buildVictimProfileGraphView,
  checkStixExportReadiness,
  downgradeAndExpireStaleRelationships,
  graphReviewApiExamples
} from "../export/graphViews.ts";
import { buildProgressiveGraphUpdate } from "../export/progressiveGraph.ts";
import type { RelationshipGraph, ProgressiveGraphEvidence } from "../types.ts";

const apt29 = { type: "actor" as const, value: "APT29", confidence: 0.86, aliases: ["Cozy Bear", "Nobelium"] };
const apt42 = { type: "actor" as const, value: "APT42", confidence: 0.8, aliases: ["Charming Kitten"] };
const scatteredSpider = { type: "actor" as const, value: "Scattered Spider", confidence: 0.82, aliases: ["UNC3944", "Octo Tempest"] };
const akira = { type: "actor" as const, value: "Akira", confidence: 0.76, aliases: ["Akira ransomware"] };
const turla = { type: "actor" as const, value: "Turla", confidence: 0.82, aliases: ["Snake"] };
const voltTyphoon = { type: "actor" as const, value: "Volt Typhoon", confidence: 0.8, aliases: ["Vanguard Panda"] };
const randomActor = { type: "actor" as const, value: "Random Panda", confidence: 0.28 };
const phishing = { type: "attack-pattern" as const, value: "T1566 Phishing", confidence: 0.78, properties: { tactic: "initial-access" } };
const credentialDumping = { type: "attack-pattern" as const, value: "T1003 OS Credential Dumping", confidence: 0.73, properties: { tactic: "credential-access" } };
const helpDeskSocial = { type: "attack-pattern" as const, value: "Help desk social engineering", confidence: 0.72, properties: { tactic: "initial-access" } };
const livingOffLand = { type: "attack-pattern" as const, value: "T1218 System Binary Proxy Execution", confidence: 0.77, properties: { tactic: "defense-evasion" } };
const simSwap = { type: "tool" as const, value: "SIM swapping", confidence: 0.72 };
const akiraLocker = { type: "malware" as const, value: "Akira ransomware", confidence: 0.8 };
const embassy = { type: "victim" as const, value: "Example Embassy", confidence: 0.7 };
const telecom = { type: "victim" as const, value: "Contoso Telecom", confidence: 0.68 };
const energyOperator = { type: "victim" as const, value: "Pacific Energy Operator", confidence: 0.72 };
const commandServer = { type: "infrastructure" as const, value: "c2.volt.example", confidence: 0.74 };
const embassySpearphish = { type: "campaign" as const, value: "Embassy spearphish wave", confidence: 0.78 };
const healthcare = { type: "sector" as const, value: "Healthcare", confidence: 0.74 };
const energy = { type: "sector" as const, value: "Energy", confidence: 0.76 };
const norway = { type: "country" as const, value: "Norway", confidence: 0.76 };
const pacificRegion = { type: "region" as const, value: "Pacific", confidence: 0.72 };
const exploitedCve = { type: "vulnerability" as const, value: "CVE-2025-12345", confidence: 0.79 };

function evidence(input: Partial<ProgressiveGraphEvidence>): ProgressiveGraphEvidence {
  return {
    id: input.id ?? "evidence",
    stage: input.stage ?? "captured",
    observedAt: input.observedAt ?? "2026-05-24T00:00:00.000Z",
    sourceId: input.sourceId ?? "src_graph",
    captureId: input.captureId,
    url: input.url ?? "https://example.test/graph",
    contentHash: input.contentHash ?? input.id ?? "hash",
    extractorVersion: input.extractorVersion ?? "graph-view-test",
    relationships: input.relationships ?? []
  };
}

describe("CTI graph persistence and query views", () => {
  test("builds APT29 graph neighborhood views with reviewed promoted and unreviewed relationships", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_reviewed",
        stage: "reviewed",
        sourceId: "vendor_report",
        observedAt: "2026-05-20T00:00:00.000Z",
        relationships: [
          { source: apt29, target: embassy, type: "targets", confidence: 0.86 },
          { source: apt29, target: phishing, type: "uses", confidence: 0.8 }
        ]
      }),
      evidence({
        id: "apt29_unreviewed",
        stage: "captured",
        sourceId: "capture_worker",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: apt29, target: { type: "malware", value: "Test Loader", confidence: 0.55 }, type: "uses", confidence: 0.56 }]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const actorNode = snapshot.nodes.find((node) => node.value === "APT29")!;
    const neighborhood = buildGraphNeighborhoodView(snapshot, { centerNodeId: actorNode.id, depth: 1 });
    const profile = buildActorProfileGraphView(snapshot, actorNode.id);

    expect(snapshot.evidenceSupport.length).toBeGreaterThanOrEqual(snapshot.relationships.length);
    expect(snapshot.relationships.every((relationship) => relationship.evidenceSupportIds.length > 0)).toBe(true);
    expect(neighborhood.nodes.some((node) => node.value === "Example Embassy")).toBe(true);
    expect(neighborhood.relationships.some((relationship) => relationship.reviewState === "accepted")).toBe(true);
    expect(neighborhood.relationships.some((relationship) => relationship.reviewState === "unreviewed")).toBe(true);
    expect(profile.attackMatrix.some((cell) => cell.tactic === "initial-access" && cell.techniques.some((technique) => technique.name === "T1566 Phishing"))).toBe(true);
    expect(profile.provenancePanels.every((panel) => panel.support.length > 0)).toBe(true);
  });

  test("builds Scattered Spider victim and neighborhood views without exporting rejected graph churn", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "scattered_promoted",
        stage: "promoted",
        sourceId: "analyst_review",
        observedAt: "2026-05-22T00:00:00.000Z",
        relationships: [
          { source: scatteredSpider, target: telecom, type: "targets", confidence: 0.9 },
          { source: scatteredSpider, target: simSwap, type: "uses", confidence: 0.82 }
        ]
      }),
      evidence({
        id: "scattered_live",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: scatteredSpider, target: { type: "victim", value: "Rumored Victim", confidence: 0.4 }, type: "targets", confidence: 0.4 }]
      })
    ], { generatedAt: "2026-05-24T00:03:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:04:00.000Z" });
    const victimNode = snapshot.nodes.find((node) => node.value === "Contoso Telecom")!;
    const view = buildVictimProfileGraphView(snapshot, victimNode.id);

    expect(snapshot.relationships.find((relationship) => relationship.targetRef === victimNode.id)?.exportEligibility.includedByDefault).toBe(true);
    expect(snapshot.relationships.some((relationship) => relationship.reviewState === "needs_review")).toBe(true);
    expect(view.targetedBy.some((relationship) => relationship.source.value === "Scattered Spider")).toBe(true);
    expect(view.provenancePanels.some((panel) => panel.support.some((support) => support.sourceId === "analyst_review"))).toBe(true);
  });

  test("downgrades and expires stale graph facts so they do not remain high-confidence forever", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "old_apt29_targeting",
        stage: "reviewed",
        sourceId: "archive",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: embassy, type: "targets", confidence: 0.92 }]
      })
    ], { generatedAt: "2025-01-02T00:00:00.000Z" });

    const downgraded = downgradeAndExpireStaleRelationships(dto.graph, {
      generatedAt: "2025-08-01T00:00:00.000Z",
      staleAfterDays: 90,
      expireAfterDays: 365
    });
    const expired = downgradeAndExpireStaleRelationships(dto.graph, {
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 90,
      expireAfterDays: 365,
      reviewerId: "system_expiry"
    });
    const downgradedRelationship = downgraded.relationships[0]!;
    const expiredRelationship = expired.relationships[0]!;
    const snapshot = buildPersistedGraphSnapshot(expired, { generatedAt: "2026-05-24T00:01:00.000Z" });

    expect(downgradedRelationship.confidence).toBeLessThan(dto.graph.relationships[0]!.confidence);
    expect(downgradedRelationship.properties?.reviewState).toBe("needs_review");
    expect(expiredRelationship.confidence).toBeLessThanOrEqual(0.2);
    expect(expiredRelationship.properties?.reviewState).toBe("expired");
    expect(snapshot.relationships[0]?.reviewAudit[0]?.action).toBe("expire");
    expect(snapshot.relationships[0]?.confidenceHistory.at(-1)?.confidence).toBe(expiredRelationship.confidence);
  });

  test("surfaces APT29 historical and current TTP drift through cursor deltas and export preview", () => {
    const historical = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_historical_ttp",
        stage: "reviewed",
        sourceId: "archive_report",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: credentialDumping, type: "uses", confidence: 0.86 }]
      })
    ], { generatedAt: "2025-01-02T00:00:00.000Z" });
    const current = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_current_ttp",
        stage: "reviewed",
        sourceId: "vendor_report",
        observedAt: "2026-05-20T00:00:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.86 }]
      })
    ], { generatedAt: "2026-05-21T00:00:00.000Z" });
    const downgradedHistorical = downgradeAndExpireStaleRelationships(historical.graph, {
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 180,
      expireAfterDays: 900
    });
    const snapshot = buildPersistedGraphSnapshot({
      nodes: [...downgradedHistorical.nodes, ...current.graph.nodes],
      relationships: [...downgradedHistorical.relationships, ...current.graph.relationships]
    }, { generatedAt: "2026-05-24T00:01:00.000Z" });
    const deltas = buildRelationshipCursorDeltas(snapshot, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const preview = buildStixExportPreview(snapshot);

    expect(deltas.filter((delta) => delta.relationshipKind === "actor-ttp")).toHaveLength(2);
    expect(deltas.some((delta) => delta.targetLabel === "T1003 OS Credential Dumping" && delta.workflowState === "downgraded")).toBe(true);
    expect(deltas.some((delta) => delta.targetLabel === "T1566 Phishing" && delta.workflowState === "accepted")).toBe(true);
    expect(preview.items.some((item) => item.targetLabel === "T1566 Phishing" && item.included)).toBe(true);
    expect(preview.items.some((item) => item.targetLabel === "T1003 OS Credential Dumping" && !item.included)).toBe(true);
  });

  test("builds an ATT&CK technique timeline and campaign graph workspace for actor queries", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "apt29_campaign_ttp",
        stage: "reviewed",
        sourceId: "vendor_campaign_report",
        observedAt: "2026-05-20T00:00:00.000Z",
        ledgerIds: ["ledger_campaign_ttp"],
        relationships: [
          { source: apt29, target: phishing, type: "uses", confidence: 0.86 },
          { source: embassySpearphish, target: apt29, type: "attributed-to", confidence: 0.8 },
          { source: embassySpearphish, target: phishing, type: "uses", confidence: 0.79 },
          { source: embassySpearphish, target: embassy, type: "targets", confidence: 0.77 }
        ]
      }),
      evidence({
        id: "apt29_stale_ttp",
        stage: "reviewed",
        sourceId: "archive_campaign_report",
        observedAt: "2025-01-01T00:00:00.000Z",
        ledgerIds: ["ledger_stale_ttp"],
        relationships: [{ source: apt29, target: credentialDumping, type: "uses", confidence: 0.82 }]
      })
    ], { generatedAt: "2026-05-21T00:00:00.000Z" });
    const graph = downgradeAndExpireStaleRelationships(dto.graph, {
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 180,
      expireAfterDays: 900
    });
    const snapshot = buildPersistedGraphSnapshot(graph, { generatedAt: "2026-05-24T00:01:00.000Z" });
    const actorNode = snapshot.nodes.find((node) => node.value === "APT29")!;
    const query = buildCorrelationGraphQuery(snapshot, {
      query: "APT29",
      focusNodeId: actorNode.id,
      generatedAt: "2026-05-24T00:02:00.000Z"
    });
    const workspace = buildGraphAttackCampaignWorkspaceDto(snapshot, {
      query: "APT29",
      focusNodeId: actorNode.id,
      generatedAt: "2026-05-24T00:02:00.000Z",
      relationshipIds: query.relationships.map((relationship) => relationship.relationshipId),
      deltas: query.deltas
    });

    expect(query.attackCampaignWorkspace.mode).toBe("attack_technique_timeline_campaign_graph");
    expect(workspace.techniqueTimeline.some((event) => event.attackId === "T1566" && event.tactic === "initial-access")).toBe(true);
    expect(workspace.techniqueTimeline.some((event) => event.techniqueName === "T1003 OS Credential Dumping" && event.confidenceTrend === "stale")).toBe(true);
    expect(workspace.campaignGraph.campaignNodeIds).toContain(snapshot.nodes.find((node) => node.value === "Embassy spearphish wave")!.id);
    expect(workspace.campaignGraph.techniqueNodeIds.length).toBeGreaterThanOrEqual(1);
    expect(workspace.exportEligibility.heldRelationshipIds.length).toBeGreaterThanOrEqual(1);
    expect(workspace.safety.taxiiBoundary).toBe("descriptor_only_no_server");
  });

  test("groups Scattered Spider social-engineering clusters as actor TTP and tool cursor deltas", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "scattered_cluster",
        stage: "promoted",
        sourceId: "analyst_review",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: scatteredSpider, target: helpDeskSocial, type: "uses", confidence: 0.83 },
          { source: scatteredSpider, target: simSwap, type: "uses", confidence: 0.8 },
          { source: scatteredSpider, target: telecom, type: "targets", confidence: 0.9 }
        ]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const deltas = buildRelationshipCursorDeltas(snapshot, { generatedAt: "2026-05-24T00:03:00.000Z" });

    expect(deltas.some((delta) => delta.relationshipKind === "actor-ttp" && delta.targetLabel === "Help desk social engineering")).toBe(true);
    expect(deltas.some((delta) => delta.relationshipKind === "actor-tool" && delta.targetLabel === "SIM swapping")).toBe(true);
    expect(deltas.some((delta) => delta.relationshipKind === "actor-target" && delta.targetLabel === "Contoso Telecom")).toBe(true);
    expect(deltas.every((delta) => delta.workflowState === "accepted")).toBe(true);
  });

  test("keeps Akira ransomware metadata exportable only after review-backed graph relationships", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "akira_metadata",
        stage: "reviewed",
        sourceId: "restricted_metadata",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: akira, target: akiraLocker, type: "uses", confidence: 0.82 },
          { source: akira, target: { type: "victim", value: "Northwind Manufacturing", confidence: 0.7 }, type: "targets", confidence: 0.78 }
        ]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const deltas = buildRelationshipCursorDeltas(snapshot, { generatedAt: "2026-05-24T00:03:00.000Z" });
    const preview = buildStixExportPreview(snapshot);

    expect(deltas.some((delta) => delta.relationshipKind === "actor-malware" && delta.targetLabel === "Akira ransomware")).toBe(true);
    expect(deltas.some((delta) => delta.relationshipKind === "actor-target" && delta.targetLabel === "Northwind Manufacturing")).toBe(true);
    expect(preview.includedCount).toBe(2);
    expect(preview.excludedCount).toBe(0);
  });

  test("keeps noisy co-mentions proposed and out of default STIX export preview", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "noisy_comention",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: apt29, target: scatteredSpider, type: "related-to", confidence: 0.22 },
          { source: { type: "incident", value: "Roundup article", confidence: 0.4 }, target: { type: "source", value: "Aggregator blog", confidence: 0.5 }, type: "mentions", confidence: 0.35 }
        ]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const deltas = buildRelationshipCursorDeltas(snapshot, { generatedAt: "2026-05-24T00:03:00.000Z" });
    const preview = buildStixExportPreview(snapshot);

    expect(deltas.some((delta) => delta.relationshipKind === "incident-source")).toBe(true);
    expect(deltas.every((delta) => delta.workflowState === "needs-human-review")).toBe(true);
    expect(deltas.every((delta) => delta.confidenceAfter < 0.2)).toBe(true);
    expect(preview.includedCount).toBe(0);
    expect(preview.items.every((item) => item.reason.includes("Excluded"))).toBe(true);
  });

  test("builds incremental live-search graph update contracts across responsive actor scenarios", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "aa_apt29_clear_web",
        stage: "promoted",
        sourceId: "clear_web_vendor_apt29",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: apt29, target: phishing, type: "uses", confidence: 0.88 },
          { source: apt29, target: embassy, type: "targets", confidence: 0.82 }
        ]
      }),
      evidence({
        id: "aa_apt42_clear_web",
        stage: "captured",
        sourceId: "clear_web_vendor_apt42",
        observedAt: "2026-05-24T00:01:00.000Z",
        relationships: [
          { source: apt42, target: { type: "attack-pattern", value: "Spearphishing attachment", confidence: 0.72, properties: { tactic: "initial-access" } }, type: "uses", confidence: 0.72 }
        ]
      }),
      evidence({
        id: "aa_turla_clear_web",
        stage: "reviewed",
        sourceId: "clear_web_vendor_turla",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: turla, target: { type: "malware", value: "Snake malware", confidence: 0.76 }, type: "uses", confidence: 0.78 }]
      }),
      evidence({
        id: "aa_volt_public_channel",
        stage: "discovery",
        sourceId: "public_channel_volt",
        observedAt: "2026-05-24T00:02:00.000Z",
        relationships: [{ source: voltTyphoon, target: livingOffLand, type: "uses", confidence: 0.62 }]
      }),
      evidence({
        id: "aa_scattered_clear_web",
        stage: "promoted",
        sourceId: "clear_web_vendor_scattered",
        observedAt: "2026-05-24T00:03:00.000Z",
        relationships: [{ source: scatteredSpider, target: helpDeskSocial, type: "uses", confidence: 0.84 }]
      }),
      evidence({
        id: "aa_akira_restricted",
        stage: "discovery",
        sourceId: "restricted_metadata_akira",
        observedAt: "2026-05-24T00:04:00.000Z",
        relationships: [{ source: akira, target: { type: "victim", value: "Fjord Energy AS", confidence: 0.68 }, type: "targets", confidence: 0.62 }]
      }),
      evidence({
        id: "aa_cve_missing_ledger",
        stage: "extracted",
        sourceId: "missing_ledger_cve",
        observedAt: "2026-05-24T00:05:00.000Z",
        relationships: [{ source: apt42, target: exploitedCve, type: "exploits", confidence: 0.7 }]
      }),
      evidence({
        id: "aa_random_weak",
        stage: "discovery",
        sourceId: "live_search_random_actor",
        observedAt: "2026-05-24T00:06:00.000Z",
        relationships: [{ source: randomActor, target: { type: "source", value: "Search result snippet", confidence: 0.38 }, type: "mentions", confidence: 0.24 }]
      }),
      evidence({
        id: "aa_weak_comention",
        stage: "discovery",
        sourceId: "live_search_comention",
        observedAt: "2026-05-24T00:07:00.000Z",
        relationships: [{ source: apt29, target: scatteredSpider, type: "related-to", confidence: 0.25 }]
      }),
      evidence({
        id: "aa_contradicted",
        stage: "extracted",
        sourceId: "clear_web_contradiction",
        observedAt: "2026-05-24T00:08:00.000Z",
        relationships: [{ source: voltTyphoon, target: energyOperator, type: "targets", confidence: 0.58, contradicted: true }]
      })
    ], { generatedAt: "2026-05-24T00:09:00.000Z" });
    const staleGraph = downgradeAndExpireStaleRelationships(dto.graph, {
      generatedAt: "2026-05-24T00:10:00.000Z",
      staleAfterDays: 30,
      expireAfterDays: 900
    });
    const snapshot = buildPersistedGraphSnapshot(staleGraph, { generatedAt: "2026-05-24T00:11:00.000Z" });
    const apt29Node = snapshot.nodes.find((node) => node.value === "APT29")!;
    const randomNode = snapshot.nodes.find((node) => node.value === "Random Panda")!;
    snapshot.relationships.push({
      id: "rel_missing_provenance_live",
      sourceRef: apt29Node.id,
      targetRef: randomNode.id,
      type: "related-to",
      confidence: 0.31,
      firstSeenAt: "2026-05-24T00:12:00.000Z",
      lastSeenAt: "2026-05-24T00:12:00.000Z",
      reviewState: "needs_review",
      evidenceSupportIds: [],
      reviewAudit: [],
      confidenceHistory: [],
      exportEligibility: {
        discoveryOnly: true,
        captureBacked: false,
        extracted: false,
        reviewed: false,
        promoted: false,
        accepted: false,
        includedByDefault: false
      }
    });
    for (const support of snapshot.evidenceSupport) {
      if (support.sourceId === "missing_ledger_cve") support.ledgerIds = [];
    }

    const liveUpdate = buildGraphLiveSearchUpdateDto(snapshot, { endpoint: "/v1/intel/search.graph", generatedAt: "2026-05-24T00:13:00.000Z" });
    const query = buildCorrelationGraphQuery(snapshot, { query: "APT42", generatedAt: "2026-05-24T00:13:00.000Z", maxRelationships: 100 });
    const coverage = new Map(liveUpdate.scenarioCoverage.map((scenario) => [scenario.name, scenario]));

    expect(liveUpdate).toMatchObject({
      mode: "incremental_live_search_graph",
      responsePolicy: "seconds_level_polling",
      nextPollSeconds: 3,
      weakDiscoveryPolicy: "pivots_and_caveats_only",
      publicChannelPolicy: "hint_until_corroborated_or_reviewed",
      restrictedEvidencePolicy: "held_context_no_public_fact",
      stixPolicy: "export_only_reviewed_or_promoted_relationships",
      taxiiBoundary: "descriptor_only_no_server",
      agentHandoffs: {
        agent06ClaimLedger: "ledger_ids_required_for_promotion",
        agent07AnswerCaveats: "surface_weak_public_restricted_stale_contradicted_and_missing_provenance",
        agent09ContractIndex: "expose_graph_live_update",
        agent10ReleaseGate: "graph_live_incremental_gate"
      }
    });
    for (const name of [
      "apt29_clear_web",
      "apt42_clear_web",
      "turla_clear_web",
      "volt_typhoon_public_channel",
      "scattered_spider_clear_web",
      "akira_restricted_held",
      "cve_exploitation",
      "random_actor_weak_discovery",
      "weak_co_mention",
      "public_channel_only_hint",
      "restricted_held_evidence",
      "missing_ledger_id",
      "stale_relationship",
      "contradicted_relationship",
      "missing_provenance",
      "accepted_promotion",
      "stix_export_eligible"
    ]) {
      expect(coverage.get(name as never)?.relationshipIds.length).toBeGreaterThan(0);
    }
    expect(coverage.get("volt_typhoon_public_channel")?.status).toBe("held");
    expect(coverage.get("public_channel_only_hint")?.status).toBe("held");
    expect(coverage.get("restricted_held_evidence")?.status).toBe("held");
    expect(coverage.get("contradicted_relationship")?.status).toBe("blocked");
    expect(coverage.get("missing_provenance")?.status).toBe("blocked");
    expect(coverage.get("accepted_promotion")?.exportEligibleCount).toBeGreaterThan(0);
    expect(coverage.get("stix_export_eligible")?.exportEligibleCount).toBeGreaterThan(0);
    expect(liveUpdate.deltaCounts.added + liveUpdate.deltaCounts.contradicted + liveUpdate.deltaCounts.stale).toBeGreaterThan(0);
    expect(liveUpdate.deltaStream).toMatchObject({
      mode: "real_time_answer_graph_delta_stream",
      responsePolicy: "seconds_level_polling",
      nextPollSeconds: 3,
      cursorField: "graph.deltas[].cursor",
      fixtureCount: 17,
      reviewHoldPolicy: "hold_unreviewed_public_channel_restricted_weak_missing_ledger_stale_contradicted_rejected",
      stixEligibilityPolicy: "reviewed_or_promoted_with_provenance_and_ledger",
      rollbackPolicy: "contradicted_rejected_missing_provenance_or_schema_risk_blocks_export",
      taxiiBoundary: "descriptor_only_no_server"
    });
    expect(liveUpdate.deltaStream.routeBindings).toEqual(expect.arrayContaining(["/v1/intel/search.graph", "/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"]));
    expect(liveUpdate.deltaStream.queryCoverage).toEqual(expect.arrayContaining(["actor", "random_actor", "made_up_actor", "cve", "malware_tool", "victim_ransomware", "country", "sector"]));
    const fixtures = new Map(liveUpdate.deltaStream.fixtures.map((fixture) => [fixture.name, fixture]));
    for (const name of [
      "clear_web_capture_promotion",
      "public_channel_hint",
      "restricted_metadata_held",
      "claim_ledger_hold",
      "missing_ledger_id",
      "weak_co_mention_pivot",
      "actor_alias_collision",
      "contradicted_attribution",
      "stale_ttp",
      "new_victim_claim",
      "new_cve_exploitation_claim",
      "malware_tool_relation",
      "infrastructure_relation",
      "analyst_accepted_promotion",
      "analyst_rejected_relation",
      "graph_rollback",
      "stix_export_eligibility_change"
    ]) {
      expect(fixtures.get(name as never)?.agent09CursorState).toBe("pollable");
    }
    expect(fixtures.get("public_channel_hint")).toMatchObject({ reviewHold: true, publicAnswerImpact: "pivot", agent07Caveat: "public_channel_hint" });
    expect(fixtures.get("restricted_metadata_held")).toMatchObject({ reviewHold: true, agent07Caveat: "restricted_held" });
    expect(fixtures.get("missing_ledger_id")).toMatchObject({ agent06LedgerGate: "hold_missing_ledger" });
    expect(fixtures.get("contradicted_attribution")).toMatchObject({ status: "blocked", stixImpact: "blocked", agent10ReleaseGate: "rollback" });
    expect(fixtures.get("stix_export_eligibility_change")?.exportEligibleCount).toBeGreaterThan(0);
    expect(query.liveUpdate.scenarioCoverage.map((scenario) => scenario.name)).toContain("apt42_clear_web");
    expect(query.liveUpdate.deltaStream.fixtures.map((fixture) => fixture.name)).toContain("graph_rollback");
    expect(query.runtime.liveUpdate.agentHandoffs.agent10ReleaseGate).toBe("graph_live_incremental_gate");
    const backendContract = buildGraphBackendRepositoryContractDto(snapshot, { generatedAt: "2026-05-24T00:13:00.000Z" });
    expect(backendContract).toMatchObject({
      mode: "backend_neutral_graph_repository_contract",
      backendCandidates: expect.arrayContaining(["memory_snapshot", "postgres_graph_tables", "neo4j"]),
      tenantScope: "tenant_id_required_on_nodes_edges_provenance_reviews_and_deltas",
      handoffs: {
        agent06ClaimLedger: "persist_ledger_ids_with_provenance_support",
        agent07EntityResolution: "preserve_stable_node_ids_aliases_and_review_states",
        agent09Api: "serve_same_dtos_from_repository_without_route_shape_changes",
        agent10DeploymentGate: "verify_repository_replay_before_graph_export_promotion"
      }
    });
    expect(backendContract.operations.map((operation) => operation.kind)).toEqual(expect.arrayContaining(["upsert_node", "upsert_relationship", "append_provenance", "append_review_decision", "record_cursor_delta", "update_export_eligibility"]));
    expect(backendContract.operations.every((operation) => operation.tenantScoped)).toBe(true);
    expect(backendContract.reviewWorkflow.acceptedRelationshipIds.length).toBeGreaterThan(0);
    expect(backendContract.reviewWorkflow.contradictedRelationshipIds.length).toBeGreaterThan(0);
    expect(backendContract.reviewWorkflow.pendingReviewRelationshipIds.length).toBeGreaterThan(0);
    expect(backendContract.exportEligibility.readyRelationshipIds.length).toBeGreaterThan(0);
    expect(backendContract.cursorDeltas.relationshipIds.length).toBeGreaterThan(0);
    expect(query.runtime.backendContract.mode).toBe("backend_neutral_graph_repository_contract");
    const backendCutover = buildGraphBackendCutoverRehearsalDto(snapshot, { generatedAt: "2026-05-24T00:14:00.000Z" });
    expect(backendCutover).toMatchObject({
      mode: "graph_backend_cutover_rehearsal",
      targetBackends: expect.arrayContaining(["postgres_graph_tables", "neo4j"]),
      replayImport: {
        source: "agent06_evidence_claim_ledger",
        cursorField: "graph.deltas[].cursor",
        restrictedMaterialPolicy: "metadata_only_review_hold"
      },
      verification: {
        tenantScopedRows: true,
        cursorContinuity: true,
        reviewAuditAppendOnly: true,
        confidenceHistoryAppendOnly: true,
        exportEligibilityRecomputed: true,
        noRawRestrictedMaterialSerialized: true
      },
      backupRestore: {
        restoreVerification: "replay_snapshot_then_compare_counts_cursors_and_export_eligibility",
        rollbackPath: "restore_last_verified_snapshot_and_hold_graph_exports"
      },
      releasePacket: {
        owner: "Agent 08",
        proofCommand: "bun test src/tests/graphViews.test.ts",
        agent10Field: "graphBackendCutoverRehearsal"
      }
    });
    expect(backendCutover.migrationSchemas.map((schema) => schema.backend)).toEqual(["postgres_graph_tables", "neo4j"]);
    expect(backendCutover.migrationSchemas.every((schema) => schema.tenantIsolation === "tenant_id_partition_or_label_property_required")).toBe(true);
    expect(backendCutover.migrationSchemas.flatMap((schema) => schema.recordKinds)).toEqual(expect.arrayContaining(["actor", "victim", "relationship", "evidence_support", "review_decision", "cursor_delta", "export_eligibility"]));
    expect(backendCutover.replayImport.importOrder).toEqual(["nodes", "relationships", "evidence_support", "review_audit", "confidence_history", "cursor_deltas", "export_eligibility"]);
    expect(backendCutover.replayImport.replayableRelationshipIds.length).toBeGreaterThan(0);
    expect(backendCutover.replayImport.reviewHeldRelationshipIds.length).toBeGreaterThan(0);
    expect(backendCutover.exportEligibility.readyRelationshipIds.length).toBeGreaterThan(0);
    expect(backendCutover.exportEligibility.heldRelationshipIds.length).toBeGreaterThan(0);
    expect(backendCutover.exportEligibility.policy).toBe("weak_public_channel_and_restricted_edges_remain_pivots_or_review_holds_until_promoted");
    expect(query.runtime.backendCutover.mode).toBe("graph_backend_cutover_rehearsal");
    expect(query.runtime.backendCutover.repositoryContract.operations.every((operation) => operation.tenantScoped)).toBe(true);
  });

  test("reports noisy co-mentions and actor alias collisions as integrity and export blockers", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "alias_collision",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: apt29, target: scatteredSpider, type: "related-to", confidence: 0.3 },
          { source: { type: "incident", value: "Roundup article", confidence: 0.4 }, target: { type: "source", value: "Aggregator blog", confidence: 0.5 }, type: "mentions", confidence: 0.35 }
        ]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const report = buildGraphIntegrityReport(snapshot);
    const batch = buildGraphReviewBatch(snapshot);
    const readiness = checkStixExportReadiness(snapshot);

    expect(report.findings.map((finding) => finding.code)).toContain("weak_discovery_only_edge");
    expect(report.findings.map((finding) => finding.code)).toContain("unsupported_edge");
    expect(batch.items.some((item) => item.action === "reject")).toBe(true);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockedCount).toBe(snapshot.relationships.length);
  });

  test("flags stale accepted TTPs and contradictory source families for analyst review batches", () => {
    const stale = buildProgressiveGraphUpdate([
      evidence({
        id: "stale_ttp",
        stage: "reviewed",
        sourceId: "archive_report",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: credentialDumping, type: "uses", confidence: 0.88 }]
      })
    ], { generatedAt: "2025-01-02T00:00:00.000Z" });
    const contradicted = buildProgressiveGraphUpdate([
      evidence({
        id: "contradictory_family",
        stage: "extracted",
        sourceId: "vendor_a",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.42, contradicted: true }]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const staleGraph = downgradeAndExpireStaleRelationships(stale.graph, {
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 90,
      expireAfterDays: 900
    });
    staleGraph.relationships[0]!.properties = {
      ...staleGraph.relationships[0]!.properties,
      reviewState: "accepted"
    };
    const snapshot = buildPersistedGraphSnapshot({
      nodes: [...staleGraph.nodes, ...contradicted.graph.nodes],
      relationships: [...staleGraph.relationships, ...contradicted.graph.relationships]
    }, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const report = buildGraphIntegrityReport(snapshot);
    const batch = buildGraphReviewBatch(snapshot);

    expect(report.findings.map((finding) => finding.code)).toContain("stale_accepted_edge");
    expect(report.findings.map((finding) => finding.code)).toContain("contradicted_edge");
    expect(batch.items.some((item) => item.action === "mark_stale")).toBe(true);
    expect(batch.items.some((item) => item.action === "supersede")).toBe(true);
  });

  test("blocks weak ransomware victim claims until evidence and review are complete", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "weak_akira_victim",
        stage: "discovery",
        sourceId: "restricted_metadata",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: akira, target: { type: "victim", value: "Unverified Victim LLC", confidence: 0.38 }, type: "targets", confidence: 0.36 }]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const report = buildGraphIntegrityReport(snapshot);
    const readiness = checkStixExportReadiness(snapshot, { minConfidence: 0.5, requireAccepted: true });
    const preview = buildStixExportPreview(snapshot);

    expect(report.findings.some((finding) => finding.code === "weak_discovery_only_edge")).toBe(true);
    expect(readiness.relationships[0]?.blockers).toContain("weak_discovery_only_edge");
    expect(readiness.relationships[0]?.blockers).toContain("export_blocking_issue");
    expect(preview.includedCount).toBe(0);
  });

  test("reports orphan relationships and missing provenance as critical export blockers", () => {
    const graph: RelationshipGraph = {
      nodes: [{ id: "node--actor", type: "actor", value: "APT29", confidence: 0.8, provenance: [] }],
      relationships: [{
        id: "rel--orphan",
        sourceRef: "node--actor",
        targetRef: "node--missing",
        type: "targets",
        confidence: 0.8,
        firstSeenAt: "2026-05-24T00:00:00.000Z",
        lastSeenAt: "2026-05-24T00:00:00.000Z",
        provenance: [],
        properties: { reviewState: "accepted", stage: "reviewed" }
      }]
    };
    const snapshot = buildPersistedGraphSnapshot(graph, { generatedAt: "2026-05-24T00:01:00.000Z" });
    const report = buildGraphIntegrityReport(snapshot);
    const batch = buildGraphReviewBatch(snapshot);
    const readiness = checkStixExportReadiness(snapshot);

    expect(report.findings.map((finding) => finding.code)).toContain("orphan_relationship");
    expect(report.findings.map((finding) => finding.code)).toContain("missing_provenance");
    expect(report.findings.every((finding) => finding.exportBlocked)).toBe(true);
    expect(batch.items[0]?.action).toBe("request_evidence");
    expect(readiness.ready).toBe(false);
  });

  test("builds a compact graph cutover report with API-ready sections and promotion blockers", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "cutover_ready",
        stage: "reviewed",
        sourceId: "vendor_report",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: apt29, target: embassy, type: "targets", confidence: 0.86 },
          { source: apt29, target: phishing, type: "uses", confidence: 0.84 }
        ]
      }),
      evidence({
        id: "cutover_weak",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:01:00.000Z",
        relationships: [{ source: apt29, target: scatteredSpider, type: "related-to", confidence: 0.24 }]
      })
    ], { generatedAt: "2026-05-24T00:02:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:03:00.000Z" });
    const actorNode = snapshot.nodes.find((node) => node.value === "APT29")!;
    const victimNode = snapshot.nodes.find((node) => node.value === "Example Embassy")!;
    const report = buildGraphCutoverReport(snapshot, {
      actorNodeId: actorNode.id,
      victimNodeId: victimNode.id,
      generatedAt: "2026-05-24T00:04:00.000Z",
      maxReviewItems: 10
    });

    expect([...report.sections.map((section) => section.name)].sort()).toEqual([
      "actor_profile",
      "attack_matrix",
      "graph_neighborhood",
      "incident_timeline",
      "provenance_panel",
      "stix_export_preview",
      "victim_profile"
    ]);
    expect(report.sections).toHaveLength(7);
    expect([
      "actor_profile",
      "victim_profile",
      "incident_timeline",
      "attack_matrix",
      "graph_neighborhood",
      "provenance_panel",
      "stix_export_preview"
    ].every((name) => report.sections.some((section) => section.name === name))).toBe(true);
    expect(report.counts.exportReady).toBeGreaterThan(0);
    expect(report.counts.weakDiscoveryOnly).toBeGreaterThan(0);
    expect(report.promotionBlockers.map((blocker) => blocker.code)).toContain("weak_discovery_only_edge");
    expect(report.reviewBatch.items.length).toBeLessThanOrEqual(10);
    expect(report.ready).toBe(false);
  });

  test("keeps high-volume graph review queues compact and deterministic for actor searches", () => {
    const relationships = Array.from({ length: 120 }, (_, index) => ({
      source: apt29,
      target: { type: "victim" as const, value: `Unverified Victim ${String(index).padStart(3, "0")}`, confidence: 0.35 },
      type: "targets" as const,
      confidence: 0.25 + (index % 5) * 0.01
    }));
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "high_volume_ready",
        stage: "reviewed",
        sourceId: "vendor_report",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.86 }]
      }),
      evidence({
        id: "high_volume_weak",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:01:00.000Z",
        relationships
      })
    ], { generatedAt: "2026-05-24T00:02:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:03:00.000Z" });
    const actorNode = snapshot.nodes.find((node) => node.value === "APT29")!;
    const first = buildGraphCutoverReport(snapshot, {
      actorNodeId: actorNode.id,
      generatedAt: "2026-05-24T00:04:00.000Z",
      maxReviewItems: 25
    });
    const second = buildGraphCutoverReport(snapshot, {
      actorNodeId: actorNode.id,
      generatedAt: "2026-05-24T00:04:00.000Z",
      maxReviewItems: 25
    });

    expect(first.reviewBatch.items).toHaveLength(25);
    expect(first.counts.reviewQueue).toBeGreaterThan(100);
    expect(first.reviewBatch.items.map((item) => item.relationshipId)).toEqual(second.reviewBatch.items.map((item) => item.relationshipId));
    expect(first.promotionBlockers.some((blocker) => blocker.code === "review_queue_open" && blocker.count > 100)).toBe(true);
    expect(first.sections.find((section) => section.name === "stix_export_preview")?.ready).toBe(false);
  });

  test("builds dry-run graph review apply plans with safety export rollback and audit boundaries", () => {
    const stale = buildProgressiveGraphUpdate([
      evidence({
        id: "apply_stale_ttp",
        stage: "reviewed",
        sourceId: "archive_report",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: credentialDumping, type: "uses", confidence: 0.88 }]
      })
    ], { generatedAt: "2025-01-02T00:00:00.000Z" });
    const staleGraph = downgradeAndExpireStaleRelationships(stale.graph, {
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 90,
      expireAfterDays: 900
    });
    staleGraph.relationships[0]!.properties = {
      ...staleGraph.relationships[0]!.properties,
      reviewState: "accepted"
    };
    const weak = buildProgressiveGraphUpdate([
      evidence({
        id: "apply_weak_discovery",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: apt29, target: scatteredSpider, type: "related-to", confidence: 0.24 }]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot({
      nodes: [...staleGraph.nodes, ...weak.graph.nodes],
      relationships: [...staleGraph.relationships, ...weak.graph.relationships]
    }, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const plan = buildGraphReviewApplyPlan(snapshot, {
      generatedAt: "2026-05-24T00:03:00.000Z",
      source: "search_quality"
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.items.some((item) => item.action === "mark_stale" && item.safety === "automation_safe")).toBe(true);
    expect(plan.items.some((item) => item.action === "block_export" && item.safety === "blocked")).toBe(true);
    expect(plan.items.every((item) => item.auditNotes.some((note) => note.includes("does not mutate")))).toBe(true);
    expect(plan.items.every((item) => item.rollbackNotes.length > 0)).toBe(true);
    expect(plan.items.every((item) => item.source === "search_quality")).toBe(true);
  });

  test("prevents weak discovery-only edges from becoming export-ready through automation alone", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "apply_block_weak_discovery",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: akira, target: { type: "victim", value: "Rumored Victim", confidence: 0.34 }, type: "targets", confidence: 0.3 }]
      })
    ], { generatedAt: "2026-05-24T00:01:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:02:00.000Z" });
    const plan = buildGraphReviewApplyPlan(snapshot);
    const item = plan.items[0]!;

    expect(item.action).toBe("block_export");
    expect(item.safety).toBe("blocked");
    expect(item.exportImpact.beforeEligible).toBe(false);
    expect(item.exportImpact.afterEligible).toBe(false);
    expect(item.exportImpact.blockedReasonCodes).toContain("weak_discovery_only_edge");
    expect(item.preconditions).toContain("discovery-only evidence cannot be auto-promoted to export-ready");
    expect(plan.automationSafeCount).toBe(0);
    expect(plan.blockedCount).toBe(1);
  });

  test("freezes compact API DTOs for graph review cutover and STIX readiness endpoints", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "api_contract_ready",
        stage: "reviewed",
        sourceId: "vendor_report",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.86 }]
      }),
      evidence({
        id: "api_contract_blocked",
        stage: "discovery",
        sourceId: "live_search",
        observedAt: "2026-05-24T00:01:00.000Z",
        relationships: [{ source: apt29, target: scatteredSpider, type: "related-to", confidence: 0.24 }]
      })
    ], { generatedAt: "2026-05-24T00:02:00.000Z" });
    const snapshot = buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:03:00.000Z" });
    const actorNode = snapshot.nodes.find((node) => node.value === "APT29")!;
    const reviewPlan = buildGraphReviewPlanApiDto(snapshot, { generatedAt: "2026-05-24T00:04:00.000Z" });
    const cutover = buildGraphCutoverReportApiDto(snapshot, {
      actorNodeId: actorNode.id,
      generatedAt: "2026-05-24T00:04:00.000Z"
    });
    const stix = buildStixExportReadinessApiDto(snapshot);

    expect(reviewPlan.endpoint).toBe("/v1/graph/review-plan");
    expect(reviewPlan.status).toBe("blocked");
    expect(reviewPlan.summary.blocked).toBeGreaterThan(0);
    expect(reviewPlan.actions.every((action) => action.auditNotes.length > 0 && action.rollbackNotes.length > 0)).toBe(true);
    expect(cutover.endpoint).toBe("/v1/graph/cutover-report");
    expect(cutover.promotionBlockers.some((blocker) => blocker.code === "weak_discovery_only_edge")).toBe(true);
    expect(stix.endpoint).toBe("/v1/exports/stix");
    expect(stix.blockedCount).toBeGreaterThan(0);
    expect(stix.preview.excludedCount).toBeGreaterThan(0);
  });

  test("freezes graph query edge fields and STIX mapping semantics across review states", () => {
    const dto = buildProgressiveGraphUpdate([
      evidence({
        id: "contract_accepted",
        stage: "reviewed",
        sourceId: "vendor_report",
        captureId: "capture_accepted",
        contentHash: "hash_accepted",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: apt29, target: phishing, type: "uses", confidence: 0.86 },
          { source: apt29, target: exploitedCve, type: "exploits", confidence: 0.82 },
          { source: telecom, target: healthcare, type: "related-to", confidence: 0.79 },
          { source: telecom, target: norway, type: "located-in", confidence: 0.78 },
          { source: akira, target: akiraLocker, type: "uses", confidence: 0.84 },
          { source: akira, target: { type: "victim", value: "Fjord Manufacturing", confidence: 0.76 }, type: "targets", confidence: 0.77 }
        ]
      }),
      evidence({
        id: "contract_rejected",
        stage: "reviewed",
        sourceId: "analyst_reject",
        captureId: "capture_rejected",
        contentHash: "hash_rejected",
        observedAt: "2026-05-24T00:01:00.000Z",
        relationships: [{ source: apt29, target: { type: "victim", value: "Rejected Victim", confidence: 0.34 }, type: "targets", confidence: 0.34 }]
      }),
      evidence({
        id: "contract_contradicted",
        stage: "captured",
        sourceId: "vendor_conflict",
        captureId: "capture_contradicted",
        contentHash: "hash_contradicted",
        observedAt: "2026-05-24T00:02:00.000Z",
        relationships: [{ source: apt29, target: credentialDumping, type: "uses", confidence: 0.62, contradicted: true }]
      }),
      evidence({
        id: "contract_discovery",
        stage: "discovery",
        sourceId: "live_search",
        captureId: "capture_discovery",
        contentHash: "hash_discovery",
        observedAt: "2026-05-24T00:03:00.000Z",
        relationships: [{ source: apt29, target: { type: "victim", value: "Rumored Victim", confidence: 0.3 }, type: "targets", confidence: 0.3 }]
      })
    ], { generatedAt: "2026-05-24T00:04:00.000Z" });
    const stale = buildProgressiveGraphUpdate([
      evidence({
        id: "contract_stale",
        stage: "reviewed",
        sourceId: "archive_report",
        captureId: "capture_stale",
        contentHash: "hash_stale",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: { type: "attack-pattern", value: "T1003.001 LSASS Memory", confidence: 0.82, properties: { tactic: "credential-access" } }, type: "uses", confidence: 0.82 }]
      })
    ], { generatedAt: "2025-01-02T00:00:00.000Z" });

    for (const relationship of dto.graph.relationships) {
      const target = dto.graph.nodes.find((node) => node.id === relationship.targetRef);
      if (target?.value === "Rejected Victim") {
        relationship.properties = { ...relationship.properties, reviewState: "rejected", stage: "reviewed" };
      }
    }
    const staleRelationship = stale.graph.relationships[0]!;
    staleRelationship.properties = { ...staleRelationship.properties, reviewState: "accepted", stale: true, stage: "reviewed" };

    const actorNode = dto.graph.nodes.find((node) => node.value === "APT29")!;
    const cveNode = dto.graph.nodes.find((node) => node.value === "CVE-2025-12345")!;
    const graph: RelationshipGraph = {
      nodes: [...dto.graph.nodes, ...stale.graph.nodes],
      relationships: [
        ...dto.graph.relationships,
        staleRelationship,
        {
          id: "rel--missing-provenance",
          sourceRef: actorNode.id,
          targetRef: cveNode.id,
          type: "exploits",
          confidence: 0.81,
          firstSeenAt: "2026-05-24T00:05:00.000Z",
          lastSeenAt: "2026-05-24T00:05:00.000Z",
          provenance: [],
          properties: { reviewState: "accepted", stage: "reviewed" }
        }
      ]
    };
    const snapshot = buildPersistedGraphSnapshot(graph, { generatedAt: "2026-05-24T00:06:00.000Z" });
    const query = buildCorrelationGraphQuery(snapshot, { query: "contract-freeze", maxRelationships: 50 });
    const timeline = buildCorrelationTimeline(snapshot, { query: "contract-freeze", maxRelationships: 50 });
    const contract = buildGraphQueryApiContract("/v1/graph/query");

    expect(contract.edgeFields).toEqual(expect.arrayContaining(["captureIds", "contentHashes", "exportEligibility"]));
    expect(contract.sections.map((section) => section.name)).toEqual(expect.arrayContaining([
      "actor_neighborhood",
      "victim_profile",
      "attack_matrix",
      "relationship_deltas",
      "export_readiness",
      "graph_readiness_facets",
      "stix_preview"
    ]));
    expect(contract.stixMapping.objects.map((object) => object.stixType)).toEqual(expect.arrayContaining([
      "intrusion-set",
      "malware",
      "attack-pattern",
      "indicator",
      "vulnerability",
      "report",
      "relationship",
      "marking-definition"
    ]));
    expect(contract.stixMapping.customProvenanceFields).toEqual(expect.arrayContaining(["x_ti_provenance", "x_ti_blocked_relationships"]));

    expect(query.relationships.every((relationship) =>
      typeof relationship.confidence === "number"
      && typeof relationship.firstSeenAt === "string"
      && typeof relationship.lastSeenAt === "string"
      && Array.isArray(relationship.evidenceIds)
      && Array.isArray(relationship.sourceIds)
      && Array.isArray(relationship.captureIds)
      && Array.isArray(relationship.contentHashes)
      && typeof relationship.contradiction === "boolean"
      && typeof relationship.sourceFamilyBias === "boolean"
      && Array.isArray(relationship.evidenceGapCodes)
      && Array.isArray(relationship.answerCaveats)
      && typeof relationship.exportEligibility.includedByDefault === "boolean"
    )).toBe(true);

    expect(query.relationships.some((relationship) => relationship.relationshipKind === "actor-vulnerability" && relationship.target.value === "CVE-2025-12345")).toBe(true);
    expect(query.relationships.some((relationship) => relationship.relationshipKind === "victim-sector" && relationship.target.value === "Healthcare")).toBe(true);
    expect(query.relationships.some((relationship) => relationship.relationshipKind === "victim-country" && relationship.target.value === "Norway")).toBe(true);
    expect(query.relationships.some((relationship) => relationship.relationshipKind === "actor-malware" && relationship.target.value === "Akira ransomware")).toBe(true);
    expect(query.relationships.some((relationship) => relationship.relationshipKind === "actor-target" && relationship.target.value === "Fjord Manufacturing")).toBe(true);
    expect(query.investigationWorkspace).toMatchObject({
      mode: "read_only_investigation_workspace",
      deltaPolling: { cursorField: "graph.deltas[].cursor", nextPollSeconds: 3 },
      safety: {
        restrictedMaterialPolicy: "metadata_only_review_hold",
        rawRestrictedMaterialIncluded: false,
        taxiiBoundary: "descriptor_only_no_server"
      }
    });
    expect(query.investigationWorkspace.nodeGroups.map((group) => group.type)).toEqual(expect.arrayContaining(["actor", "victim", "attack-pattern", "vulnerability", "malware"]));
    expect(query.investigationWorkspace.nodes.find((node) => node.value === "APT29")).toMatchObject({
      type: "actor",
      exportReadyRelationshipCount: expect.any(Number),
      heldRelationshipCount: expect.any(Number)
    });
    expect(query.investigationWorkspace.relationshipConfidenceLedger.every((entry) =>
      Array.isArray(entry.whyExists)
      && Array.isArray(entry.supportingLedgerIds)
      && Array.isArray(entry.disagreeingSourceIds)
      && Array.isArray(entry.allowedActions)
      && typeof entry.provenanceComplete === "boolean"
    )).toBe(true);
    expect(query.investigationWorkspace.relationshipConfidenceLedger.find((entry) => entry.target.value === "T1003 OS Credential Dumping")).toMatchObject({
      contradiction: true,
      reviewBlocked: true,
      allowedActions: expect.arrayContaining(["attach_contradiction"])
    });
    expect(query.investigationWorkspace.relationshipConfidenceLedger.find((entry) => entry.target.value === "T1003.001 LSASS Memory")).toMatchObject({
      stale: true,
      allowedActions: expect.arrayContaining(["mark_stale"])
    });
    expect(query.investigationWorkspace.reviewActions.map((item) => item.action)).toEqual(expect.arrayContaining(["hold", "attach_contradiction", "mark_stale"]));
    expect(JSON.stringify(query.investigationWorkspace)).not.toContain("https://");

    const byTarget = (target: string) => query.relationships.find((relationship) => relationship.target.value === target);
    expect(byTarget("T1566 Phishing")?.exportReady).toBe(true);
    expect(byTarget("Rejected Victim")).toMatchObject({ reviewState: "rejected", exportReady: false });
    expect(byTarget("T1003 OS Credential Dumping")?.exportBlockers).toContain("contradicted_edge");
    expect(byTarget("T1003.001 LSASS Memory")?.exportBlockers).toContain("stale_accepted_edge");
    expect(byTarget("Rumored Victim")?.exportBlockers).toContain("weak_discovery_only_edge");
    const missingProvenance = query.relationships.find((relationship) => relationship.relationshipId === "rel--missing-provenance")!;
    expect(missingProvenance.exportBlockers).toContain("missing_provenance");
    expect(missingProvenance.evidenceGapCodes).toContain("missing_provenance");
    expect(missingProvenance.answerCaveats).toContain("missing_provenance");
    expect(missingProvenance.captureIds).toEqual([]);
    expect(missingProvenance.contentHashes).toEqual([]);
    expect(query.relationships.find((relationship) => relationship.target.value === "T1003 OS Credential Dumping")?.contradiction).toBe(true);
    expect(query.readinessFacets.map((facet) => facet.name)).toEqual(expect.arrayContaining([
      "actor_profile",
      "victim_profile",
      "campaign_timeline",
      "attack_matrix",
      "infrastructure_pivots",
      "source_family_bias",
      "evidence_gaps",
      "stix_bundle",
      "taxii_collection"
    ]));
    expect(query.readinessFacets.find((facet) => facet.name === "evidence_gaps")?.blockerCodes).toContain("missing_provenance");
    expect(query.certification.scenarios.find((scenario) => scenario.name === "missing_provenance")).toMatchObject({
      status: "rollback",
      blockerCodes: expect.arrayContaining(["missing_provenance"])
    });
    expect(query.certification.scenarios.find((scenario) => scenario.name === "contradicted_relationship")).toMatchObject({
      status: "rollback",
      blockerCodes: expect.arrayContaining(["contradicted_edge"])
    });
    expect(query.certification.rcGate).toMatchObject({
      gate: "graph_stix_release_candidate",
      decision: "rollback",
      taxiiBoundary: "descriptor_only_no_server"
    });
    expect(timeline.events.every((event) => Array.isArray(event.captureIds) && Array.isArray(event.contentHashes))).toBe(true);
  });

  test("summarizes graph confidence drift and holds risky export queues", () => {
    const drift = buildProgressiveGraphUpdate([
      evidence({
        id: "drift_actor_ttp",
        stage: "reviewed",
        sourceId: "vendor_report",
        captureId: "capture_ttp",
        contentHash: "hash_ttp",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: credentialDumping, type: "uses", confidence: 0.9 }]
      }),
      evidence({
        id: "drift_victim_timeline",
        stage: "captured",
        sourceId: "source_bias_vendor",
        captureId: "capture_victim",
        contentHash: "hash_victim",
        observedAt: "2026-05-24T00:01:00.000Z",
        relationships: [
          { source: apt29, target: telecom, type: "targets", confidence: 0.66 },
          { source: apt29, target: healthcare, type: "targets", confidence: 0.64 }
        ]
      }),
      evidence({
        id: "drift_cve",
        stage: "reviewed",
        sourceId: "vendor_cve",
        captureId: "capture_cve",
        contentHash: "hash_cve",
        observedAt: "2025-02-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: exploitedCve, type: "exploits", confidence: 0.84 }]
      }),
      evidence({
        id: "drift_ransomware_weak",
        stage: "discovery",
        sourceId: "restricted_metadata",
        captureId: "capture_akira_weak",
        contentHash: "hash_akira_weak",
        observedAt: "2026-05-24T00:02:00.000Z",
        relationships: [{ source: akira, target: { type: "victim", value: "Unverified Fjord Victim", confidence: 0.34 }, type: "targets", confidence: 0.31 }]
      })
    ], { generatedAt: "2026-05-24T00:03:00.000Z" });
    const aged = downgradeAndExpireStaleRelationships(drift.graph, {
      generatedAt: "2026-05-24T00:04:00.000Z",
      staleAfterDays: 90,
      expireAfterDays: 360
    });
    for (const relationship of aged.relationships) {
      const source = aged.nodes.find((node) => node.id === relationship.sourceRef);
      const target = aged.nodes.find((node) => node.id === relationship.targetRef);
      if (source?.value === "APT29" && target?.value === "Contoso Telecom") {
        relationship.properties = { ...relationship.properties, sourceBiasCluster: true };
      }
      if (source?.value === "APT29" && target?.value === "CVE-2025-12345") {
        relationship.properties = { ...relationship.properties, reviewState: "accepted", stale: true };
      }
      if (source?.value === "Akira") {
        relationship.properties = { ...relationship.properties, unsupportedRestrictedMetadata: true, metadataOnly: true };
      }
    }
    const snapshot = buildPersistedGraphSnapshot(aged, { generatedAt: "2026-05-24T00:05:00.000Z" });
    const report = buildGraphIntegrityReport(snapshot);
    const readiness = checkStixExportReadiness(snapshot);
    const query = buildCorrelationGraphQuery(snapshot, { query: "APT29", maxRelationships: 20 });
    const timeline = buildCorrelationTimeline(snapshot, { query: "APT29", maxRelationships: 20 });

    const findingCodes = report.findings.map((finding) => finding.code);
    expect(findingCodes).toContain("stale_accepted_edge");
    expect(findingCodes).toContain("source_bias_cluster");
    expect(findingCodes).toContain("unsupported_restricted_metadata");
    expect(findingCodes).toContain("weak_discovery_only_edge");
    expect(readiness.ready).toBe(false);
    expect(readiness.reviewQueue.publicFactPolicy).toBe("hold_weak_edges");
    expect(readiness.reviewQueue.byCode.map((item) => item.code)).toEqual(expect.arrayContaining([
      "source_bias_cluster",
      "unsupported_restricted_metadata",
      "stale_accepted_edge"
    ]));
    expect(query.reviewQueue.exportHoldCount).toBeGreaterThan(0);
    expect(query.relationships.find((relationship) => relationship.target.value === "CVE-2025-12345")?.exportBlockers).toContain("stale_accepted_edge");
    expect(timeline.events.some((event) => event.targetLabel === "Contoso Telecom" && event.exportBlockers.includes("source_bias_cluster"))).toBe(true);
    expect(readiness.relationships.some((relationship) =>
      relationship.blockers.includes("unsupported_restricted_metadata")
    )).toBe(true);
  });

  test("builds production graph query and STIX workflow fixtures across actor intelligence scenarios", () => {
    const current = buildProgressiveGraphUpdate([
      evidence({
        id: "s_apt29_current",
        stage: "reviewed",
        sourceId: "vendor_report",
        captureId: "capture_s_apt29_current",
        ledgerIds: ["ledger_s_apt29_current"],
        contentHash: "hash_s_apt29_current",
        observedAt: "2026-05-24T00:00:00.000Z",
        relationships: [
          { source: apt29, target: phishing, type: "uses", confidence: 0.87 },
          { source: apt29, target: exploitedCve, type: "exploits", confidence: 0.83 }
        ]
      }),
      evidence({
        id: "s_volt_infra",
        stage: "reviewed",
        sourceId: "critical_infra_report",
        captureId: "capture_s_volt",
        ledgerIds: ["ledger_s_volt"],
        contentHash: "hash_s_volt",
        observedAt: "2026-05-23T00:00:00.000Z",
        relationships: [
          { source: voltTyphoon, target: energyOperator, type: "targets", confidence: 0.82 },
          { source: voltTyphoon, target: livingOffLand, type: "uses", confidence: 0.78 },
          { source: energyOperator, target: energy, type: "related-to", confidence: 0.77 },
          { source: energyOperator, target: pacificRegion, type: "active-in", confidence: 0.76 },
          { source: { type: "indicator", value: "192.0.2.10", confidence: 0.72, properties: { indicatorType: "ipv4" } }, target: commandServer, type: "communicates-with", confidence: 0.72 }
        ]
      }),
      evidence({
        id: "s_scattered_social",
        stage: "reviewed",
        sourceId: "social_engineering_report",
        captureId: "capture_s_scattered",
        ledgerIds: ["ledger_s_scattered"],
        contentHash: "hash_s_scattered",
        observedAt: "2026-05-22T00:00:00.000Z",
        relationships: [
          { source: scatteredSpider, target: helpDeskSocial, type: "uses", confidence: 0.84 },
          { source: scatteredSpider, target: simSwap, type: "uses", confidence: 0.8 },
          { source: scatteredSpider, target: telecom, type: "targets", confidence: 0.81 }
        ]
      }),
      evidence({
        id: "s_akira_weak",
        stage: "discovery",
        sourceId: "restricted_metadata",
        captureId: "capture_s_akira",
        ledgerIds: ["ledger_s_akira_restricted"],
        contentHash: "hash_s_akira",
        observedAt: "2026-05-24T00:01:00.000Z",
        relationships: [{ source: akira, target: { type: "victim", value: "Rumored Akira Victim", confidence: 0.34 }, type: "targets", confidence: 0.32, properties: { unsupportedRestrictedMetadata: true, metadataOnly: true } }]
      }),
      evidence({
        id: "s_runtime_unreviewed",
        stage: "captured",
        sourceId: "single_vendor_bias_runtime",
        captureId: "capture_s_runtime",
        ledgerIds: ["ledger_s_runtime"],
        contentHash: "hash_s_runtime",
        observedAt: "2026-05-24T00:02:00.000Z",
        relationships: [
          { source: apt29, target: { type: "vulnerability", value: "CVE-2026-42424", confidence: 0.72 }, type: "exploits", confidence: 0.7 },
          { source: apt29, target: { type: "attack-pattern", value: "T1059 Command and Scripting Interpreter", confidence: 0.7, properties: { tactic: "execution" } }, type: "uses", confidence: 0.69 }
        ]
      }),
      evidence({
        id: "s_random_comention",
        stage: "discovery",
        sourceId: "live_search",
        captureId: "capture_s_random",
        ledgerIds: ["ledger_s_random"],
        contentHash: "hash_s_random",
        observedAt: "2026-05-24T00:02:00.000Z",
        relationships: [{ source: randomActor, target: apt29, type: "related-to", confidence: 0.23 }]
      })
    ], { generatedAt: "2026-05-24T00:03:00.000Z" });
    const historical = buildProgressiveGraphUpdate([
      evidence({
        id: "s_apt29_historical",
        stage: "reviewed",
        sourceId: "archive_report",
        captureId: "capture_s_apt29_historical",
        ledgerIds: ["ledger_s_apt29_historical"],
        contentHash: "hash_s_apt29_historical",
        observedAt: "2025-01-01T00:00:00.000Z",
        relationships: [{ source: apt29, target: credentialDumping, type: "uses", confidence: 0.9 }]
      })
    ], { generatedAt: "2025-01-02T00:00:00.000Z" });
    const staleHistorical = downgradeAndExpireStaleRelationships(historical.graph, {
      generatedAt: "2026-05-24T00:04:00.000Z",
      staleAfterDays: 180,
      expireAfterDays: 900
    });
    staleHistorical.relationships[0]!.properties = {
      ...staleHistorical.relationships[0]!.properties,
      reviewState: "accepted",
      stale: true
    };

    const snapshot = buildPersistedGraphSnapshot({
      nodes: [...current.graph.nodes, ...staleHistorical.nodes],
      relationships: [...current.graph.relationships, ...staleHistorical.relationships]
    }, { generatedAt: "2026-05-24T00:05:00.000Z" });
    const query = buildCorrelationGraphQuery(snapshot, { query: "production fixtures", maxRelationships: 100 });
    const readiness = buildStixExportReadinessApiDto(snapshot);
    const sla = buildGraphExportSlaDto(snapshot, {
      endpoint: "/v1/exports/stix",
      generatedAt: "2026-05-24T00:06:00.000Z"
    });
    const enforcement = buildGraphExportEnforcementDto(snapshot, {
      endpoint: "/v1/exports/stix",
      generatedAt: "2026-05-24T00:06:00.000Z"
    });
    const contract = buildGraphQueryApiContract("/v1/graph/query");

    expect(contract.sections.map((section) => section.name)).toEqual(expect.arrayContaining([
      "actor_neighborhood",
      "victim_neighborhood",
      "campaign_neighborhood",
      "ttp_neighborhood",
      "malware_tool_neighborhood",
      "cve_neighborhood",
      "infrastructure_neighborhood",
      "sector_neighborhood",
      "region_neighborhood",
      "source_neighborhood"
    ]));
    expect(query.neighborhoods.find((item) => item.name === "actor")?.nodeIds.length).toBeGreaterThanOrEqual(5);
    expect(query.neighborhoods.find((item) => item.name === "victim")?.relationshipIds.length).toBeGreaterThanOrEqual(3);
    expect(query.neighborhoods.find((item) => item.name === "ttp")?.freshness).toBe("mixed");
    expect(query.neighborhoods.find((item) => item.name === "cve")?.exportReadyCount).toBeGreaterThan(0);
    expect(query.neighborhoods.find((item) => item.name === "infrastructure")?.nodeIds.length).toBeGreaterThan(0);
    expect(query.neighborhoods.find((item) => item.name === "sector")?.nodeIds.length).toBeGreaterThan(0);
    expect(query.neighborhoods.find((item) => item.name === "region")?.nodeIds.length).toBeGreaterThan(0);
    expect(query.readinessFacets.find((facet) => facet.name === "actor_profile")?.relationshipIds.length).toBeGreaterThan(0);
    expect(query.readinessFacets.find((facet) => facet.name === "attack_matrix")?.warningCodes).toEqual(expect.arrayContaining(["stale_accepted_edge", "unreviewed_ttp_mapping"]));
    expect(query.readinessFacets.find((facet) => facet.name === "source_family_bias")?.warningCodes).toContain("source_bias_cluster");
    expect(query.readinessFacets.find((facet) => facet.name === "evidence_gaps")?.blockerCodes).toEqual(expect.arrayContaining(["export_schema_risk", "unsupported_restricted_metadata"]));
    expect(query.readinessFacets.find((facet) => facet.name === "taxii_collection")?.summary).toMatch(/not a TAXII server/i);
    expect(query.relationships.every((relationship) => relationship.ledgerIds.length > 0)).toBe(true);
    expect(query.relationships.some((relationship) => relationship.sourceFamilyBias)).toBe(true);
    expect(query.relationships.find((relationship) => relationship.target.value === "Rumored Akira Victim")?.answerCaveats).toEqual(expect.arrayContaining(["restricted_only_claim", "unreviewed_victim_claim"]));
    expect(query.runtime.endpoint).toBe("/v1/graph/query");
    expect(query.runtime.exportSla.endpoint).toBe("/v1/graph/query");
    expect(query.runtime.exportSla.publicAnswerImpact).toBe("hold_graph_facts");
    expect(query.runtime.enforcement.releaseGate.publicAnswers).toBe("hold");
    expect(query.runtime.enforcement.answerCaveats).toEqual(expect.arrayContaining([
      "restricted_only_claim",
      "unreviewed_cve_exploitation",
      "unreviewed_ttp_mapping",
      "unreviewed_victim_claim"
    ]));
    expect(query.runtime.relationships.every((relationship) =>
      Array.isArray(relationship.ledgerIds)
      && typeof relationship.confidence === "number"
      && ["current", "stale", "unknown"].includes(relationship.freshness)
      && Array.isArray(relationship.exportHolds)
    )).toBe(true);
    expect(query.certification.scenarios.map((scenario) => scenario.name)).toEqual(expect.arrayContaining([
      "apt29_actor_profile",
      "scattered_spider_actor_profile",
      "akira_victim_profile",
      "turla_actor_profile",
      "cve_exploitation",
      "weak_co_mention",
      "restricted_only_evidence",
      "missing_ledger_id",
      "schema_risk_export",
      "missing_provenance",
      "contradicted_relationship",
      "stale_relationship",
      "analyst_reviewed_promotion"
    ]));
    expect(query.certification.noUnsupportedTaxiiServerClaims).toBe(true);
    expect(query.certification.rcGate.requiredScenarios).toEqual(expect.arrayContaining([
      "missing_provenance",
      "contradicted_relationship",
      "analyst_reviewed_promotion"
    ]));
    expect(query.certification.rcGate.agent10ReleaseTrain).toMatchObject({
      field: "graphStixReleaseCandidateGate",
      proofRoutes: expect.arrayContaining(["/v1/contracts", "/v1/exports/stix"])
    });
    expect(query.certification.scenarios.find((scenario) => scenario.name === "turla_actor_profile")?.status).toBe("not_applicable");
    expect(query.certification.scenarios.find((scenario) => scenario.name === "cve_exploitation")?.status).toMatch(/pass|warning|hold|rollback/);
    expect(query.runtime.certification.endpoint).toBe("/v1/graph/query");
    expect(query.relationships.find((relationship) => relationship.target.value === "T1003 OS Credential Dumping")?.exportBlockers).toContain("stale_accepted_edge");
    expect(query.relationships.find((relationship) => relationship.target.value === "Rumored Akira Victim")?.exportBlockers).toEqual(expect.arrayContaining([
      "weak_discovery_only_edge",
      "unsupported_restricted_metadata",
      "restricted_only_claim",
      "unreviewed_victim_claim"
    ]));
    expect(query.relationships.find((relationship) => relationship.target.value === "CVE-2026-42424")?.exportBlockers).toContain("unreviewed_cve_exploitation");
    expect(query.relationships.find((relationship) => relationship.target.value === "T1059 Command and Scripting Interpreter")?.exportBlockers).toContain("unreviewed_ttp_mapping");
    expect(query.reviewQueue.byCode.map((item) => item.code)).toEqual(expect.arrayContaining([
      "stale_accepted_edge",
      "weak_discovery_only_edge",
      "unsupported_restricted_metadata",
      "restricted_only_claim",
      "unreviewed_victim_claim",
      "unreviewed_cve_exploitation",
      "unreviewed_ttp_mapping"
    ]));
    expect(readiness.reviewActions.length).toBeGreaterThan(0);
    expect(readiness.reviewActions.some((action) => action.action === "mark_stale" || action.action === "block_export")).toBe(true);
    expect(sla.state).toBe("rollback");
    expect(sla.buckets.find((bucket) => bucket.bucket === "export_ready")?.count).toBeGreaterThan(0);
    expect(sla.buckets.find((bucket) => bucket.bucket === "held")?.count).toBeGreaterThan(0);
    expect(sla.buckets.find((bucket) => bucket.bucket === "restricted_only")?.count).toBeGreaterThan(0);
    expect(sla.buckets.find((bucket) => bucket.bucket === "unreviewed_victim")?.count).toBeGreaterThan(0);
    expect(sla.buckets.find((bucket) => bucket.bucket === "unreviewed_cve")?.count).toBeGreaterThan(0);
    expect(sla.buckets.find((bucket) => bucket.bucket === "unreviewed_ttp")?.count).toBeGreaterThan(0);
    expect(sla.releasePacket).toMatchObject({
      owner: "Agent 08",
      proofCommand: "bun run check:graph-review-mounted",
      status: "blocker"
    });
    expect(enforcement.state).toBe("rollback");
    expect(enforcement.releaseGate).toMatchObject({
      publicAnswers: "hold",
      stixPromotion: "rollback",
      schemaSafe: false,
      ledgerComplete: true
    });
    expect(enforcement.items.map((item) => item.code)).toEqual(expect.arrayContaining([
      "export_schema_risk",
      "restricted_only_claim",
      "unreviewed_cve_exploitation",
      "unreviewed_ttp_mapping",
      "unreviewed_victim_claim"
    ]));
    expect(enforcement.items.find((item) => item.code === "unreviewed_cve_exploitation")?.dryRunAction).toBe("hold_edge");
    expect(readiness.runtime.endpoint).toBe("/v1/exports/stix");
    expect(readiness.exportSla.endpoint).toBe("/v1/exports/stix");
    expect(readiness.enforcement.releaseGate.publicAnswers).toBe("hold");
    expect(readiness.certification.endpoint).toBe("/v1/exports/stix");
    expect(readiness.certification.releasePacket.proofCommands).toEqual(expect.arrayContaining(["bun run check:route-inventory"]));
    expect(readiness.exportSla.stixImpact).toBe("hold_blocked_relationships");
    expect(readiness.taxiiCollections[0]).toMatchObject({
      id: "ti-graph-reviewed-stix-21",
      canWrite: false,
      readiness: {
        status: "hold",
        readyCount: readiness.readyCount,
        blockedCount: readiness.blockedCount
      }
    });
    expect(readiness.runtime.relationships.some((relationship) => relationship.exportHolds.includes("unreviewed_cve_exploitation"))).toBe(true);
    expect(readiness.relationships.some((relationship) => relationship.ready)).toBe(true);
    expect(readiness.relationships.some((relationship) => relationship.blockers.includes("unsupported_restricted_metadata"))).toBe(true);
  });

  test("enforces ledger-id and schema-risk promotion holds before public answer or STIX export", () => {
    const graph: RelationshipGraph = {
      nodes: [
        { id: "node--actor", type: "actor", value: "APT29", confidence: 0.8, provenance: [] },
        { id: "node--incident", type: "incident", value: "Unsupported relation", confidence: 0.7, provenance: [] }
      ],
      relationships: [{
        id: "rel--schema-ledger-risk",
        sourceRef: "node--actor",
        targetRef: "node--incident",
        type: "related-to",
        confidence: 0.82,
        firstSeenAt: "2026-05-24T00:00:00.000Z",
        lastSeenAt: "2026-05-24T00:00:00.000Z",
        provenance: [{
          sourceId: "vendor_report",
          captureId: "capture_schema",
          url: "https://example.test/schema",
          collectedAt: "2026-05-24T00:00:00.000Z",
          contentHash: "hash_schema",
          extractorVersion: "graph-view-test"
        }],
        properties: { reviewState: "accepted", stage: "reviewed" }
      }]
    };
    const snapshot = buildPersistedGraphSnapshot(graph, { generatedAt: "2026-05-24T00:01:00.000Z" });
    snapshot.evidenceSupport = snapshot.evidenceSupport.map((support) => ({ ...support, ledgerIds: [] }));
    const report = buildGraphIntegrityReport(snapshot);
    const enforcement = buildGraphExportEnforcementDto(snapshot, {
      endpoint: "/v1/exports/stix",
      generatedAt: "2026-05-24T00:02:00.000Z"
    });
    const cutover = buildGraphBackendCutoverRehearsalDto(snapshot, { generatedAt: "2026-05-24T00:03:00.000Z" });

    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "export_schema_risk",
      "missing_ledger_ids",
      "unsupported_edge"
    ]));
    expect(enforcement.releaseGate).toMatchObject({
      publicAnswers: "hold",
      stixPromotion: "rollback",
      schemaSafe: false,
      ledgerComplete: false
    });
    expect(enforcement.items.find((item) => item.code === "missing_ledger_ids")).toMatchObject({
      dryRunAction: "request_evidence",
      publicAnswerEffect: "remove",
      stixEffect: "exclude"
    });
    expect(cutover.replayImport.ledgerCompleteness).toBe("hold_missing_ledger_ids");
    expect(cutover.replayImport.missingLedgerRelationshipIds).toContain("rel--schema-ledger-risk");
    expect(cutover.releasePacket.status).toBe("rollback");
    expect(cutover.releasePacket.rollbackPath).toMatch(/hold graph\/STIX promotion/i);
  });

  test("publishes graph review API examples for every frozen action and manual discovery review", () => {
    const examples = graphReviewApiExamples("2026-05-24T00:00:00.000Z");

    expect(Object.keys(examples.actionExamples).sort()).toEqual([
      "accept_edge",
      "block_export",
      "discovery_only_manual_review_required",
      "downgrade_edge",
      "expire_edge",
      "hold_edge",
      "mark_stale",
      "reject_edge",
      "request_evidence",
      "supersede_edge"
    ]);
    expect(examples.reviewPlan.endpoint).toBe("/v1/graph/review-plan");
    expect(examples.cutoverReport.endpoint).toBe("/v1/graph/cutover-report");
    expect(examples.stixReadiness.endpoint).toBe("/v1/exports/stix");
    expect(examples.actionExamples.discovery_only_manual_review_required.safety).toBe("blocked");
    expect(examples.actionExamples.discovery_only_manual_review_required.exportImpact.afterEligible).toBe(false);
    expect(examples.actionExamples.discovery_only_manual_review_required.preconditions).toContain("discovery-only evidence cannot be auto-promoted to export-ready");
  });
});
