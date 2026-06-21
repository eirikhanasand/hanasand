import { nowIso, uniqueStrings } from "../utils.ts";
import { CANARY_FIXTURES, FIXTURES, routeContract, safetyDefaults } from "./liveCaptureConstants.ts";
import { canaryRow } from "./liveCaptureCanary.ts";
import { buildLiveCaptureRuntimeRow } from "./liveCaptureRow.ts";
import type { LiveCaptureCanaryInput, LiveCaptureCanaryPacketDto, LiveCaptureRuntimeInput, LiveCaptureRuntimePacketDto } from "./liveCaptureTypes.ts";
import { canaryFixtureClassesFor, count, failureCounts, fixtureClassFor, inferRun, order, shortageRows } from "./liveCaptureUtils.ts";

export function buildLiveCaptureRuntimePacket(input: LiveCaptureRuntimeInput): LiveCaptureRuntimePacketDto {
  const generatedAt = input.generatedAt ?? nowIso(), seen = new Set(input.previousDedupeKeys ?? []);
  const rows = input.captures.map((capture) => buildLiveCaptureRuntimeRow(capture, generatedAt, seen));
  const required = input.requiredFixtureClasses ?? FIXTURES, covered = order(required, rows.map(fixtureClassFor));
  return {
    schemaVersion: "ti.live_capture_runtime_packet.v1", generatedAt,
    readyForEvidenceReplay: rows.some((r) => r.status === "captured") && rows.every((r) => r.status !== "failed"),
    rows,
    observability: { total: rows.length, captured: count(rows, "captured"), failed: count(rows, "failed"), duplicate: count(rows, "duplicate"), stale: count(rows, "stale"), failureClasses: failureCounts(rows), parserWarnings: rows.reduce((n, r) => n + r.extractionWarnings.length, 0) },
    conformance: { requiredFixtureClasses: required, coveredFixtureClasses: covered, missingFixtureClasses: required.filter((f) => !covered.includes(f)) },
    sourcePackIntegration: { agent01ReadySourceIds: uniqueStrings(rows.filter((r) => r.agent01SourcePack.activationReadiness === "ready").map((r) => r.sourceId)), agent01HeldSourceIds: uniqueStrings(rows.filter((r) => r.agent01SourcePack.activationReadiness === "hold").map((r) => r.sourceId)), agent02CadenceHints: rows.map((r) => ({ sourceId: r.sourceId, cadenceHint: r.agent02Scheduler.cadenceHint, reason: r.agent02Scheduler.reason })) },
    routeContract: routeContract(["schemaVersion", "generatedAt", "readyForEvidenceReplay", "rows", "observability", "conformance", "sourcePackIntegration", "routeContract", "safety"]),
    safety: safetyDefaults()
  };
}

export function buildLiveCaptureCanaryPacket(input: LiveCaptureCanaryInput): LiveCaptureCanaryPacketDto {
  const generatedAt = input.generatedAt ?? nowIso(), runtime = buildLiveCaptureRuntimePacket({ generatedAt, captures: input.captures, previousDedupeKeys: input.previousDedupeKeys, requiredFixtureClasses: input.requiredFixtureClasses });
  const rows = runtime.rows.map((row: any) => canaryRow(row, input.runClass ?? inferRun(row))), required = input.requiredCanaryFixtures ?? CANARY_FIXTURES;
  const covered = order(required, [...runtime.conformance.coveredFixtureClasses, ...rows.flatMap(canaryFixtureClassesFor)]);
  return {
    schemaVersion: "ti.live_capture_canary_packet.v1", generatedAt, canaryPhase: input.canaryPhase ?? "fixture_replay", disabledByDefault: true,
    rows, parserRepairQueue: rows.filter((r) => r.parserRepair.needed).map((r) => r.parserRepair),
    promotion: { promoteSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "promote").map((r) => r.sourceId)), watchSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "watch").map((r) => r.sourceId)), holdSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "hold").map((r) => r.sourceId)), rollbackSourceIds: uniqueStrings(rows.filter((r) => r.canary.state === "rollback").map((r) => r.sourceId)), schedulerHints: rows.map((r) => ({ sourceId: r.sourceId, cadenceHint: r.schedulerHint.cadenceHint, reason: r.schedulerHint.reason })) },
    conformance: { requiredFixtureClasses: required, coveredFixtureClasses: covered, missingFixtureClasses: required.filter((f) => !covered.includes(f)) },
    sourceFamilyShortages: shortageRows(rows, input.sourceFamilyMinimums ?? {}),
    handoffs: { agent01SourceGovernance: [], agent02Scheduler: [], agent07Quality: [], agent09ApiFields: [] },
    routeContract: routeContract(["schemaVersion", "generatedAt", "canaryPhase", "rows", "promotion", "conformance", "sourceFamilyShortages"]),
    safety: { ...safetyDefaults(), willStartNetworkCollection: false, willMutateSources: false, willLeaseQueueWork: false }
  };
}
