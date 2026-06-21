import { describe, expect, test } from "bun:test";
import { buildEvidenceCutoverReportDto, buildEvidenceReplayPlanDto } from "../api/evidenceDtos.ts";
import { buildRuntimeEvidenceFixture } from "./helpers/runtimeEvidenceFixtures.ts";

describe("runtime evidence replay", () => {
  test("creates replayable evidence deltas and cutover report", () => {
    const { store, objectStore } = buildRuntimeEvidenceFixture();
    const timeline = store.queries().getEvidenceTimeline("APT29", { tenantId: "tenant_q" });
    expect(timeline.map((delta) => delta.kind)).toEqual(expect.arrayContaining(["added", "promoted", "updated", "expired"]));
    expect(timeline.some((delta) => delta.metadata.connectorDelta === true && delta.metadata.deltaType === "new_message")).toBe(true);
    expect(timeline.some((delta) => delta.subjectType === "relationship" && delta.kind === "promoted")).toBe(true);
    expect(timeline.find((delta) => delta.kind === "expired")?.metadata).toMatchObject({ adapter: "telegram_public", messageState: "deleted", mediaRetention: "metadata_only", rawMediaPayloadsExposed: false });
    const replayPlan = buildEvidenceReplayPlanDto(store, "APT29", { tenantId: "tenant_q", runId: "run_q" });
    expect(replayPlan.replayable).toBe(true);
    expect(replayPlan.cursor.next).toBeTruthy();
    const expiredIndex = timeline.findIndex((delta) => delta.kind === "expired");
    const sinceCursor = timeline[Math.max(0, expiredIndex - 1)]?.cursor;
    expect(store.queries().getSearchDeltas("APT29", sinceCursor, { tenantId: "tenant_q" }).map((delta) => delta.kind)).toContain("expired");
    const report = buildEvidenceCutoverReportDto(store, objectStore, "APT29", { tenantId: "tenant_q", runId: "run_q", generatedAt: "2026-01-01T00:06:00.000Z" });
    expect(report.readiness.overall).toBe("ready");
    expect(report.promotionGate.agent09Fields.cursorReplayReady).toBe(true);
    expect(JSON.stringify(report)).not.toContain("object/key");
  });
});
