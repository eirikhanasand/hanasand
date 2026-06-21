import { describe, expect, test } from "bun:test";
import { buildActiveLearningCandidateQueueDto, buildAnalystFeedbackLoopDto, buildAnalystQualityReviewQueueDto } from "../pipeline/analystFeedback.ts";
import { buildQualityRuntimeValueGatesDto, evaluateExtractionCalibration, evaluateExtractionFixtures } from "../pipeline/evaluation.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { hashContent } from "../utils.ts";

describe("compact pipeline value path", () => {
  test("extracts actor, victim, CVE and provenance from public text", () => {
    const rawText = "APT29 used phishing against Northwind Health with CVE-2026-1234.";
    const result = processCollectedItem({ sourceId: "src_public", url: "https://example.test/report", collectedAt: "2026-06-21T00:00:00.000Z", rawText, contentHash: hashContent(rawText), links: [], metadata: {}, sensitive: false });
    expect(result.entities.some((entity: any) => entity.type === "actor")).toBe(true);
    expect(result.entities.some((entity: any) => entity.type === "victim")).toBe(true);
    expect(result.indicators.some((indicator: any) => indicator.type === "cve")).toBe(true);
    expect(result.incident?.captureId).toBe(result.capture.id);
  });

  test("scores extraction fixtures and sellable row gates", () => {
    const fixtures = [{ id: "apt29", rawText: "APT29 targeted Northwind Health with CVE-2026-1234", expected: { actor: "APT29", cve: "CVE-2026-1234" } }];
    const report = evaluateExtractionFixtures(fixtures);
    const calibration = evaluateExtractionCalibration(fixtures);
    const gates = buildQualityRuntimeValueGatesDto({ rows: [{ actor: "APT29", victim: "Northwind Health" }] });
    expect(report.fixtureCount).toBe(1);
    expect(calibration.qualityNotes.length).toBeGreaterThan(0);
    expect(gates.summary.sellableRows).toBe(1);
  });

  test("builds compact analyst feedback and learning queues", () => {
    const feedback = buildAnalystFeedbackLoopDto({ items: [{ id: "row_1", mark: "needs_review" }] });
    const review = buildAnalystQualityReviewQueueDto({ rows: [{ id: "row_1", state: "queued" }] });
    const active = buildActiveLearningCandidateQueueDto({ candidates: [{ id: "row_1", score: 0.9 }] });
    expect(feedback.corrections).toHaveLength(1);
    expect(review.releaseGate).toBe("pass");
    expect(active.summary.highPriority).toBe(1);
  });
});
