import { THRESHOLDS } from "./adapterSlaConfig.ts";
import { buildContracts, routeContract, safety } from "./adapterSlaContracts.ts";
import { observationRepairs, translationRepairs } from "./adapterSlaRepairRows.ts";
import { countBy, dedupe, uniq } from "./adapterSlaUtils.ts";
import type { AdapterSlaRepairInput, AdapterSlaRepairPacketDto } from "./adapterSlaTypes.ts";

export type * from "./adapterSlaTypes.ts";

export function buildAdapterSlaRepairPacket(input: AdapterSlaRepairInput): AdapterSlaRepairPacketDto {
  const thresholds = { ...THRESHOLDS, ...(input.thresholds ?? {}) };
  const contracts = buildContracts(input, thresholds);
  const repairs = dedupe([
    ...(input.observations ?? []).flatMap((observation: any) => observationRepairs(input.generatedAt, observation)),
    ...(input.translationHandoffs ?? []).flatMap((handoff: any) => translationRepairs(input.generatedAt, handoff, thresholds))
  ]);
  const counts = {
    pass: contracts.filter((c) => c.status === "pass").length,
    warn: contracts.filter((c) => c.status === "warn").length,
    hold: contracts.filter((c) => c.status === "hold").length
  };
  const canonicalUrlHashes = uniq([...contracts.flatMap((c) => c.metrics.canonicalUrlHashes), ...repairs.flatMap((r) => r.canonicalUrlHash ? [r.canonicalUrlHash] : [])]);
  return {
    schemaVersion: "ti.adapter_sla_repair_packet.v1",
    generatedAt: input.generatedAt,
    readyForPromotion: counts.hold === 0 && repairs.every((r) => r.priority !== "high"),
    contracts,
    repairs,
    summary: { contracts: contracts.length, ...counts, repairs: repairs.length, repairCategories: countBy(repairs.map((r) => r.category)), sourceIds: uniq(repairs.map((r) => r.sourceId)), canonicalUrlHashes, agentHandoffs: { agent01: uniq(repairs.map((r) => r.agentHandoffs.agent01SourceGovernance)), agent02: uniq(repairs.map((r) => r.agentHandoffs.agent02SchedulerBackoff)), agent04: uniq(repairs.map((r) => r.agentHandoffs.agent04SourceCorrelationConfidence)), agent06: uniq(repairs.map((r) => r.agentHandoffs.agent06EvidenceReplay)), agent07: uniq(repairs.map((r) => r.agentHandoffs.agent07ExtractionQuality)), agent09: uniq(repairs.map((r) => r.agentHandoffs.agent09ApiWarningCode)), agent10: uniq(repairs.map((r) => r.agentHandoffs.agent10Runbook)) } },
    routeContract: routeContract(),
    safety: safety()
  };
}
