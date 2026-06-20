import { describe, expect, test } from "bun:test";
import { buildLiveProductSloDashboard } from "../ops/productSlo.ts";

const frontier = {
  total: 0,
  queued: 0,
  leased: 0,
  groups: {
    tenants: {},
    sources: {},
    adapterTypes: {},
    priorityBuckets: {},
    ageBuckets: {}
  },
  budgets: {},
  metrics: {
    queueAgeSeconds: { max: 0, average: 0, highPriorityMax: 0 },
    throughput: { completed: 0, failed: 0, cancelled: 0, retryScheduled: 0, retryExhausted: 0 },
    retryPressure: 0,
    budgetExhaustion: 0,
    sourceStarvation: 0,
    tenantStarvation: 0,
    adapterSaturation: {}
  }
};

describe("Program BH parser/capture lift", () => {
  test("proves buyer-visible row lift and keeps rejected parser repairs out of paid progress", () => {
    const dashboard = buildLiveProductSloDashboard({
      generatedAt: "2026-06-20T12:00:00.000Z",
      proofMode: "fixture",
      runs: [],
      sources: [],
      captures: [],
      incidents: [],
      frontier,
      snapshotStoragePath: "var/ops/live-product-slo/parser-capture-lift-test.jsonl"
    });

    const gate = dashboard.parserCaptureLiftGate;
    expect(gate).toMatchObject({
      schemaVersion: "ti.live_product_parser_capture_lift_gate.v1",
      owner: "agent_03",
      baselineRunId: "OThlfd0uzSCNnedAO",
      baselineDatasetId: "LSen2fYtwFTtOr7vK",
      dryRun: true,
      willMutateSources: false,
      willStartCollection: false
    });
    expect(gate.measurableLift).toMatchObject({
      rowsLifted: 5,
      sellableRowsAdded: 2,
      usefulRowsAdded: 5,
      freshRowsAdded: 5,
      estimatedAverageBuyerValueDelta: 0.042
    });
    expect(gate.measurableLift.sourceFamiliesImproved).toEqual(expect.arrayContaining([
      "rss_security_blog",
      "vendor_report",
      "cert_advisory",
      "github_security_advisory",
      "public_channel_handoff"
    ]));
    expect(gate.acceptedExamples.every((row) => row.buyerVisibleFieldsAdded.length >= 5 && row.noLeak)).toBe(true);
    expect(gate.acceptedExamples.some((row) => row.beforeDecision === "included_with_caveat" && row.afterDecision === "sellable")).toBe(true);
    expect(gate.acceptedExamples.some((row) => row.beforeDecision === "hold" && row.afterDecision === "included_with_caveat")).toBe(true);
    expect(gate.rejectedExamples.map((row) => row.rejectedReason)).toEqual(expect.arrayContaining([
      "stale_report",
      "single_source_low_context",
      "duplicate_syndication",
      "unsafe_or_restricted_capture",
      "auth_captcha_private_source",
      "raw_url_or_body_leak",
      "credential_or_payload_material"
    ]));
    expect(gate.rejectedExamples.every((row) => (
      row.doesNotCountTowardPayworthyRate
      && row.sellableRowsDelta === 0
      && row.usefulRowsDelta === 0
      && row.freshRowsDelta === 0
      && row.noLeak
    ))).toBe(true);
    expect(JSON.stringify(gate.noLeakBoundary)).not.toContain("credential");
  });
});
