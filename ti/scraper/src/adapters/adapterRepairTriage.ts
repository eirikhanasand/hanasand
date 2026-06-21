// @ts-nocheck
import { ADAPTERS, routeContract, safety } from "./adapterRepairTriageConfig.ts";
import { actionForRepair, handoffs, priorityFor, scoreFor } from "./adapterRepairTriageDecision.ts";
import { count, countBy, family, hash, orderedAdapters, orderedModes, pOrder, round, uniq } from "./adapterRepairTriageUtils.ts";
import type { AdapterRepairTriageInput, AdapterRepairTriagePacketDto } from "./adapterRepairTriageTypes.ts";
export type * from "./adapterRepairTriageTypes.ts";

export function buildAdapterRepairTriagePacket(input: AdapterRepairTriageInput): AdapterRepairTriagePacketDto {
  const candidates = dedupe([
    ...input.slaRepairPacket.repairs.map((repair) => fromRepair(repair, input)),
    ...input.certificationPacket.adapterGates.flatMap((gate) => fromGate(gate, input)),
    ...input.slaRepairPacket.contracts.flatMap((contract) => fromContract(contract, input))
  ]);
  const recommendations = candidates.map((candidate) => recommendation(input, candidate)).sort((a, b) => b.score - a.score || pOrder(a.priority) - pOrder(b.priority) || a.adapter.localeCompare(b.adapter)).map((item, index) => ({ ...item, rank: index + 1 }));
  const decision = decisionFor(recommendations);
  return {
    schemaVersion: "ti.adapter_repair_triage_packet.v1", generatedAt: input.generatedAt,
    decision, readyForCertification: decision === "certify", browserWorkersEnabled: false,
    recommendations, adapterSummaries: ADAPTERS.map((adapter) => summary(adapter, input, recommendations)),
    summary: packetSummary(recommendations),
    sandboxFixtureReplay: { requiredAdapters: orderedAdapters(recommendations.filter((r) => r.sandboxFixtureReplay.required).map((r) => r.adapter)), hashOnly: true, rawMaterialRequired: false, dynamicBrowserDisabledByDefault: true, dynamicRequiresExplicitApproval: true, expectedModesByAdapter: ADAPTERS.map((adapter) => ({ adapter, modes: expectedModesForAdapter(adapter, input) })).filter((x) => x.modes.length) },
    routeContract,
    safety
  };
}

function fromRepair(repair, input) {
  return { adapter: repair.adapter, sourceId: repair.sourceId, sourceFamily: repair.sourceFamily, action: actionForRepair(repair), repair, contract: contract(input, repair.adapter), gate: gate(input, repair.adapter), rationale: [repair.reason, `repair_category:${repair.category}`, `repair_priority:${repair.priority}`] };
}
function fromGate(gateInfo, input) {
  if (gateInfo.status === "certified") return [{ adapter: gateInfo.adapter, sourceFamily: family(gateInfo.adapter), action: "certify_adapter", contract: contract(input, gateInfo.adapter), gate: gateInfo, rationale: ["adapter fixture replay and SLA gates are green"] }];
  if (!gateInfo.missingModes.length && gateInfo.status !== "hold") return [];
  return [{ adapter: gateInfo.adapter, sourceFamily: family(gateInfo.adapter), action: gateInfo.status === "hold" ? "escalate_release_hold" : "fix_parser", contract: contract(input, gateInfo.adapter), gate: gateInfo, rationale: [...gateInfo.missingModes.map((m) => `missing_fixture_modes:${m}`), ...gateInfo.holdReasons] }];
}
function fromContract(contractInfo, input) {
  if (contractInfo.status === "pass") return [];
  return [{ adapter: contractInfo.adapter, sourceFamily: contractInfo.sourceFamily, action: contractInfo.status === "hold" ? "escalate_release_hold" : "fix_parser", contract: contractInfo, gate: gate(input, contractInfo.adapter), rationale: contractInfo.breaches.map((b) => `${b.code}:${b.message}`) }];
}
function recommendation(input, candidate) {
  const impact = impactFor(candidate, input.impacts ?? []), c = candidate.contract, g = candidate.gate, missingModes = g?.missingModes ?? [];
  const signals = { parserConfidence: c?.metrics.minParserConfidenceObserved, freshnessDebtHours: impact.freshnessDebtHours ?? (c?.metrics.staleCount ? 24 * c.metrics.staleCount : 0), duplicateRate: impact.duplicateRate ?? (c?.metrics.duplicateCanonicalCount ? 1 : 0), unsupportedMimeCount: c?.metrics.unsupportedMimeCount ?? 0, timeoutCount: c?.metrics.timeoutCount ?? 0, rateLimitedCount: c?.metrics.rateLimitedCount ?? 0, certificationGap: missingModes.length, languageDriftCount: c?.metrics.languageDriftCount ?? 0, releaseHold: candidate.action === "escalate_release_hold" || g?.status === "hold" || c?.status === "hold" || candidate.repair?.priority === "high" };
  const score = scoreFor(candidate, impact, signals), priority = priorityFor(score, signals.releaseHold, candidate.repair?.priority), modes = expectedModes(candidate, missingModes);
  return { schemaVersion: "ti.adapter_repair_recommendation.v1", generatedAt: input.generatedAt, recommendationId: `triage:${hash(`${candidate.adapter}:${candidate.sourceId ?? "adapter"}:${candidate.action}:${candidate.rationale.join("|")}`)}`, rank: 0, adapter: candidate.adapter, sourceId: candidate.sourceId, sourceFamily: candidate.sourceFamily, action: candidate.action, priority, score, rationale: uniq(candidate.rationale), customerImpact: { searchImpact: round(impact.customerVisibleSearchImpact), sourceFamilyCoverage: round(impact.sourceFamilyCoverage), queryClasses: uniq(impact.queryClasses ?? []) }, repairSignals: signals, sandboxFixtureReplay: { required: (candidate.action !== "reduce_cadence" && candidate.action !== "suppress_duplicate" && candidate.action !== "certify_adapter") || modes.length > 0, expectedModes: modes, hashOnly: true, rawMaterialRequired: false, dynamicBrowserDisabledByDefault: true, dynamicRequiresExplicitApproval: candidate.adapter === "dynamic_public_browser" }, handoffs: handoffs(candidate, signals.releaseHold) };
}
function packetSummary(recommendations) {
  return { recommendations: recommendations.length, p0: count(recommendations, "priority", "p0"), p1: count(recommendations, "priority", "p1"), p2: count(recommendations, "priority", "p2"), p3: count(recommendations, "priority", "p3"), actions: countBy(recommendations.map((r) => r.action)), sourceIds: uniq(recommendations.flatMap((r) => r.sourceId ? [r.sourceId] : [])), adapters: orderedAdapters(recommendations.map((r) => r.adapter)), warningCodes: uniq(recommendations.map((r) => r.handoffs.agent09WarningField).filter((c) => c !== "none")), agentHandoffs: { agent01: uniq(recommendations.map((r) => r.handoffs.agent01Activation)), agent02: uniq(recommendations.map((r) => r.handoffs.agent02Cadence)), agent04: uniq(recommendations.map((r) => r.handoffs.agent04Coverage)), agent06: uniq(recommendations.map((r) => r.handoffs.agent06EvidenceReplay)), agent07: uniq(recommendations.map((r) => r.handoffs.agent07QualityGate)), agent09: uniq(recommendations.map((r) => r.handoffs.agent09WarningField).filter((c) => c !== "none")), agent10: uniq(recommendations.map((r) => r.handoffs.agent10ReleaseGate)) } };
}
function summary(adapter, input, recommendations) {
  const g = gate(input, adapter), c = contract(input, adapter), list = recommendations.filter((r) => r.adapter === adapter);
  return { adapter, status: g?.status ?? "not_observed", slaStatus: c?.status ?? "missing", recommendationCount: list.length, topAction: list[0]?.action, releaseHold: list.some((r) => r.handoffs.agent10ReleaseGate === "hold") || g?.status === "hold" || c?.status === "hold", missingCertificationModes: g?.missingModes ?? [] };
}
function expectedModes(candidate, missingModes) { if (missingModes.length) return orderedModes(missingModes); const c = candidate.repair?.category; if (c === "dynamic_render_failure") return ["success", "timeout", "empty_extraction"]; if (c === "pdf_extraction_failure") return ["success", "truncated_capture", "empty_extraction"]; if (c === "unsupported_mime_repair") return ["success", "unsupported_mime"]; if (c === "language_detection_drift") return ["success", "language_mismatch"]; if (c === "scheduler_backoff") return ["timeout", "rate_limit"]; if (c === "evidence_duplicate_suppression") return ["duplicate_canonical"]; if (candidate.action === "fix_parser") return ["success", "parser_drift", "empty_extraction"]; return []; }
function expectedModesForAdapter(adapter, input) { const g = gate(input, adapter), repairs = input.slaRepairPacket.repairs.filter((r) => r.adapter === adapter); return orderedModes([...(g?.missingModes ?? []), ...repairs.flatMap((repair) => expectedModes({ adapter, sourceFamily: family(adapter), action: actionForRepair(repair), repair, rationale: [] }, []))]); }
function decisionFor(recommendations) { return recommendations.some((r) => r.action === "escalate_release_hold" && r.priority === "p0") ? "escalate" : recommendations.some((r) => r.action === "disable_or_pause_source" && ["p0", "p1"].includes(r.priority)) ? "disable" : recommendations.some((r) => r.action !== "certify_adapter") ? "repair" : "certify"; }
function impactFor(candidate, impacts) { return impacts.find((i) => i.sourceId === candidate.sourceId && i.adapter === candidate.adapter) ?? impacts.find((i) => i.adapter === candidate.adapter) ?? { sourceId: candidate.sourceId ?? `adapter:${candidate.adapter}`, adapter: candidate.adapter, customerVisibleSearchImpact: ["static_html", "rss_feed", "advisory_signal"].includes(candidate.adapter) ? 0.78 : ["pdf_report", "dynamic_public_browser"].includes(candidate.adapter) ? 0.66 : 0.52, sourceFamilyCoverage: ["advisory_signal", "rss_feed"].includes(candidate.adapter) ? 0.72 : ["static_html", "pdf_report"].includes(candidate.adapter) ? 0.64 : 0.5, freshnessDebtHours: candidate.contract?.metrics.staleCount ? 24 * candidate.contract.metrics.staleCount : 0, duplicateRate: candidate.contract?.metrics.duplicateCanonicalCount ? 1 : 0, queryClasses: [] }; }
function dedupe(candidates) { const seen = new Set(); return candidates.filter((c) => { const key = `${c.adapter}:${c.sourceId ?? "adapter"}:${c.action}:${c.repair?.category ?? c.gate?.status ?? c.contract?.status ?? ""}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function contract(input, adapter) { return input.slaRepairPacket.contracts.find((x) => x.adapter === adapter); }
function gate(input, adapter) { return input.certificationPacket.adapterGates.find((x) => x.adapter === adapter); }
